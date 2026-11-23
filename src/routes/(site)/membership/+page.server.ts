import { redirect } from '@sveltejs/kit';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { fail, message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { isDuplicateKey } from '@nahu/admin-kit/server/dbErrors';
import { addLocalDays, localToday } from '@nahu/admin-kit/time';
import { db } from '#lib/server/db/index.ts';
import { membership, membershipMember, membershipPlan } from '#lib/server/db/schema.ts';
import { cardCode, createMembership } from '#lib/server/memberships.ts';
import {
	createWebOrder,
	customerFor,
	floodRefused,
	isTrapped,
	orderByIdempotencyKey,
	paymentsOn,
	recordConsent,
	startPayment,
	trackHref,
	toCheckout
} from '#lib/server/site.ts';
import { membershipSignupSchema } from '#lib/schemas/signup.ts';
import { m } from '#lib/paraglide/messages.js';
import type { Actions, PageServerLoad } from './$types';

/** Plans on sale: published, switched on, not deleted. */
const plansOnSale = () =>
	db
		.select({
			id: membershipPlan.id,
			code: membershipPlan.code,
			name: membershipPlan.name,
			description: membershipPlan.description,
			benefits: membershipPlan.benefits,
			requiresProof: membershipPlan.requiresProof,
			price: membershipPlan.price,
			taxRateId: membershipPlan.taxRateId,
			durationMonths: membershipPlan.durationMonths,
			maxAdults: membershipPlan.maxAdults,
			maxChildren: membershipPlan.maxChildren,
			freeEntry: membershipPlan.freeEntry,
			freeDelivery: membershipPlan.freeDelivery,
			shopDiscountPct: membershipPlan.shopDiscountPct,
			membersOnlyEvents: membershipPlan.membersOnlyEvents,
			image: membershipPlan.image
		})
		.from(membershipPlan)
		.where(
			and(
				eq(membershipPlan.publishStatus, 'published'),
				eq(membershipPlan.isActive, true),
				isNull(membershipPlan.deletedAt)
			)
		)
		.orderBy(asc(membershipPlan.sortOrder), asc(membershipPlan.price));

export const load: PageServerLoad = async ({ url }) => {
	const plans = await plansOnSale();
	const asked = Number(url.searchParams.get('plan'));
	const planId = plans.find((p) => p.id === asked || p.code === url.searchParams.get('plan'))?.id ?? plans[0]?.id;
	const today = localToday();
	return {
		plans: plans.map((p) => ({ ...p, price: Number(p.price), shopDiscountPct: Number(p.shopDiscountPct) })),
		today,
		latestStart: addLocalDays(today, 90),
		form: await superValidate(
			{ planId, startsOn: today, idempotencyKey: crypto.randomUUID() },
			zod4(membershipSignupSchema),
			{ errors: false }
		)
	};
};

export const actions: Actions = {
	default: async (event) => {
		const form = await superValidate(event.request, zod4(membershipSignupSchema));
		if (!form.valid) return fail(400, { form });
		// The spam check: a bot gets the same answer as a person and nothing is written.
		if (isTrapped(form.data)) return message(form, m.member_thanks());
		if (floodRefused(event, 'membership')) return message(form, m.site_err_flood(), { status: 429 });

		const done = await orderByIdempotencyKey(form.data.idempotencyKey);
		if (done) redirect(303, trackHref(done));

		const d = { ...form.data, adults: form.data.adults.filter(Boolean), children: form.data.children.filter(Boolean) };
		const [plan] = (await plansOnSale()).filter((p) => p.id === d.planId);
		if (!plan) return setError(form, 'planId', m.member_err_plan());
		const today = localToday();
		if (d.startsOn < today || d.startsOn > addLocalDays(today, 90)) {
			return setError(form, 'startsOn', m.member_err_start());
		}
		// The buyer is the first adult; the plan's room is for everyone else.
		if (d.adults.length > plan.maxAdults - 1) {
			return setError(
				form,
				'adults._errors',
				plan.maxAdults > 1 ? m.member_err_adults({ max: plan.maxAdults - 1 }) : m.member_err_single()
			);
		}
		if (d.children.length > plan.maxChildren) {
			return setError(form, 'children._errors', m.member_err_children({ max: plan.maxChildren }));
		}

		let placed: Awaited<ReturnType<typeof createWebOrder>>;
		try {
			placed = await db.transaction(async (tx) => {
				const customerId = await customerFor(tx, { name: d.name, phone: d.phone, email: d.email });
				if (d.marketingConsent) await recordConsent(tx, event, customerId, d, 'membership_form');
				const term = await createMembership(
					tx,
					{ customerId, planId: plan.id, startsOn: d.startsOn, renewalMethod: 'manual_link' },
					undefined
				);
				const others = [
					...d.adults.map((name) => ({ name, isChild: false })),
					...d.children.map((name) => ({ name, isChild: true }))
				];
				if (others.length) {
					await tx
						.insert(membershipMember)
						.values(others.map((p) => ({ ...p, membershipId: term.id, cardCode: cardCode() })));
				}
				const order = await createWebOrder(tx, event, {
					customerId,
					contact: { name: d.name, phone: d.phone, email: d.email },
					membershipId: term.id,
					idempotencyKey: d.idempotencyKey,
					lines: [
						{
							itemType: 'membership',
							description: plan.name,
							membershipPlanId: plan.id,
							taxRateId: plan.taxRateId,
							quantity: 1,
							unitPrice: Number(plan.price)
						}
					]
				});
				await tx.update(membership).set({ orderLineId: order.lineIds[0] }).where(eq(membership.id, term.id));
				return order;
			});
		} catch (err) {
			// The same form sent twice at once: the second lands on the first one's order.
			if (isDuplicateKey(err)) {
				const again = await orderByIdempotencyKey(d.idempotencyKey);
				if (again) redirect(303, trackHref(again));
			}
			throw err;
		}

		if (paymentsOn()) {
			let checkout: string | null = null;
			try {
				checkout = await startPayment(event, placed.id);
			} catch (err) {
				// The order stands; its page offers the payment again.
				console.error('[membership] could not start Chapa checkout:', err);
			}
			if (checkout) toCheckout(checkout);
		}
		redirect(303, trackHref(placed));
	}
};
