import { redirect } from '@sveltejs/kit';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
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
	toCheckout,
	UnpaidRefused
} from '#lib/server/site.ts';
import { transfersOn } from '#lib/server/transfers.ts';
import { completeFreeOrder } from '#lib/server/freeOrders.ts';
import { DiscountRefused } from '#lib/server/discounts.ts';
import { membershipSignupSchema } from '#lib/schemas/signup.ts';
import { m } from '#lib/i18n.ts';
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

/** The term a renewal link names, if it can still be renewed. */
async function renewable(number: string | null | undefined) {
	if (!number) return null;
	const [row] = await db
		.select({
			id: membership.id,
			number: membership.number,
			customerId: membership.customerId,
			planId: membership.planId,
			endsOn: membership.endsOn
		})
		.from(membership)
		.where(
			and(
				eq(membership.number, number),
				inArray(membership.status, ['active', 'grace', 'lapsed']),
				isNull(membership.deletedAt)
			)
		);
	return row ?? null;
}

/** A renewal starts the day after the current term ends, or today when that has passed. */
const renewalStart = (endsOn: string | null, today: string) =>
	endsOn && endsOn >= today ? addLocalDays(endsOn, 1) : today;

export const load: PageServerLoad = async ({ url }) => {
	const plans = await plansOnSale();
	const today = localToday();
	// From a reminder's renewal link: the same plan, and only its number is shown.
	const renewing = await renewable(url.searchParams.get('m'));
	const asked = renewing?.planId ?? Number(url.searchParams.get('plan'));
	const planId =
		plans.find((p) => p.id === asked || p.code === url.searchParams.get('plan'))?.id ??
		plans[0]?.id;
	return {
		plans: plans.map((p) => ({
			...p,
			price: Number(p.price),
			shopDiscountPct: Number(p.shopDiscountPct)
		})),
		today,
		latestStart: addLocalDays(today, 90),
		paymentsOn: paymentsOn(),
		transfersOn: await transfersOn(),
		renewing: renewing?.number ?? null,
		form: await superValidate(
			{
				planId,
				startsOn: renewing ? renewalStart(renewing.endsOn, today) : today,
				renews: renewing?.number,
				idempotencyKey: crypto.randomUUID()
			},
			zod4(membershipSignupSchema),
			{ errors: false }
		)
	};
};

/** The phone given is not the one on the membership being renewed. */
class NotTheirs extends Error {
	constructor(readonly number: string) {
		super('Not the membership holder');
	}
}

export const actions: Actions = {
	default: async (event) => {
		const form = await superValidate(event.request, zod4(membershipSignupSchema));
		if (!form.valid) return fail(400, { form });
		// The spam check: a bot gets the same answer as a person and nothing is written.
		if (isTrapped(form.data)) return message(form, m.member_thanks());
		if (floodRefused(event, 'membership'))
			return message(form, m.site_err_flood(), { status: 429 });

		const done = await orderByIdempotencyKey(form.data.idempotencyKey);
		if (done) redirect(303, trackHref(done));

		const d = {
			...form.data,
			adults: form.data.adults.filter(Boolean),
			children: form.data.children.filter(Boolean)
		};
		const [plan] = (await plansOnSale()).filter((p) => p.id === d.planId);
		if (!plan) return setError(form, 'planId', m.member_err_plan());
		const today = localToday();
		const renewing = await renewable(d.renews);
		if (!renewing && (d.startsOn < today || d.startsOn > addLocalDays(today, 90))) {
			return setError(form, 'startsOn', m.member_err_start());
		}
		// The buyer is the first adult; the plan's room is for everyone else.
		if (d.adults.length > plan.maxAdults - 1) {
			return setError(
				form,
				'adults._errors',
				plan.maxAdults > 1
					? m.member_err_adults({ max: plan.maxAdults - 1 })
					: m.member_err_single()
			);
		}
		if (d.children.length > plan.maxChildren) {
			return setError(form, 'children._errors', m.member_err_children({ max: plan.maxChildren }));
		}

		let placed: Awaited<ReturnType<typeof createWebOrder>> & { free: boolean };
		try {
			placed = await db.transaction(async (tx) => {
				const customerId = await customerFor(tx, { name: d.name, phone: d.phone, email: d.email });
				// Only the person on a membership renews it: the link alone is not enough.
				if (renewing && renewing.customerId !== customerId) throw new NotTheirs(renewing.number);
				if (d.marketingConsent) await recordConsent(tx, event, customerId, d, 'membership_form');
				const term = await createMembership(
					tx,
					{
						customerId,
						planId: plan.id,
						startsOn: renewing ? renewalStart(renewing.endsOn, today) : d.startsOn,
						renewalMethod: 'manual_link',
						renewsMembershipId: renewing?.id ?? null
					},
					undefined
				);
				// A renewal carries its people over (`createMembership`); a new term takes them here.
				const others = renewing
					? []
					: [
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
					discountCode: d.discountCode,
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
				await tx
					.update(membership)
					.set({ orderLineId: order.lineIds[0] })
					.where(eq(membership.id, term.id));
				// A 100% code: nothing to pay, so the membership starts now.
				return { ...order, free: order.total < 0.005 && (await completeFreeOrder(tx, order.id)) };
			});
		} catch (err) {
			if (err instanceof NotTheirs)
				return setError(form, 'phone', m.renew_err_phone({ number: err.number }));
			if (err instanceof DiscountRefused) return setError(form, 'discountCode', err.message);
			if (err instanceof UnpaidRefused) return setError(form, 'phone', err.message);
			// The same form sent twice at once: the second lands on the first one's order.
			if (isDuplicateKey(err)) {
				const again = await orderByIdempotencyKey(d.idempotencyKey);
				if (again) redirect(303, trackHref(again));
			}
			throw err;
		}

		if (paymentsOn() && d.payWith !== 'transfer' && !placed.free) {
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
