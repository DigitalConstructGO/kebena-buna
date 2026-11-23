import { error } from '@sveltejs/kit';
import { and, desc, eq, inArray, isNull, ne } from 'drizzle-orm';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { redirect } from 'sveltekit-flash-message/server';
import { localToday } from '@nahu/admin-kit/time';
import { childActions, childCrud } from '@nahu/admin-kit/server/childCrud';
import { hasPermission, requirePermission } from '@nahu/admin-kit/server/permissions';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { db } from '#lib/server/db/index.ts';
import {
	customer,
	location,
	membership,
	membershipMember,
	membershipPlan,
	orderLine,
	order,
	productVariant,
	subscription,
	ticketScan
} from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';
import { stampsOf, userAlias } from '#lib/server/people.ts';
import { idParam } from '#lib/server/records.ts';
import { membershipPlanOptions } from '#lib/server/options.ts';
import {
	cardCode,
	checkMemberRoom,
	createMembership,
	addDays,
	termDates
} from '#lib/server/memberships.ts';
import {
	cancelSchema,
	memberEditSchema,
	memberSchema,
	membershipTermSchema
} from '#lib/schemas/memberships.ts';

const members = childCrud({
	table: membershipMember,
	ownerColumn: 'membershipId',
	label: 'Member',
	addSchema: memberSchema,
	editSchema: memberEditSchema,
	fileFields: ['photo'],
	uniqueField: 'cardCode',
	permission: 'memberships.manage',
	// Every member gets their own card QR (7.3); the code is the server's, never the form's. The
	// plan's adult and child limits hold for every active member, added or brought back.
	transform: async (values, _event, before) => {
		const isChild = Boolean(values.isChild);
		if (!before) {
			await checkMemberRoom(Number(values.membershipId), isChild);
			return { ...values, cardCode: cardCode() };
		}
		const active =
			values.isActive === undefined ? Boolean(before.isActive) : Boolean(values.isActive);
		if (active && (!before.isActive || Boolean(before.isChild) !== isChild))
			await checkMemberRoom(Number(before.membershipId), isChild, Number(before.id));
		return values;
	}
});

async function loadMembership(raw: string) {
	const id = idParam(raw, 'Membership');
	const [row] = await db
		.select({
			m: membership,
			customer: customer.name,
			customerPhone: customer.phone,
			plan: enOf(membershipPlan.name),
			planPrice: membershipPlan.price,
			planMonths: membershipPlan.durationMonths,
			orderId: orderLine.orderId,
			orderNumber: order.number
		})
		.from(membership)
		.innerJoin(customer, eq(membership.customerId, customer.id))
		.innerJoin(membershipPlan, eq(membership.planId, membershipPlan.id))
		.leftJoin(orderLine, eq(membership.orderLineId, orderLine.id))
		.leftJoin(order, eq(orderLine.orderId, order.id))
		.where(and(eq(membership.id, id), isNull(membership.deletedAt)));
	if (!row) error(404, 'Membership not found');
	return row;
}

const scanner = userAlias('scanner');

export const load = async ({ params, locals }) => {
	const row = await loadMembership(params.id);
	const m = row.m;
	const [memberData, renews, renewedBy, subscriptions, stamps, plans] = await Promise.all([
		members.load(m.id),
		m.renewsMembershipId
			? db
					.select({ id: membership.id, number: membership.number, endsOn: membership.endsOn })
					.from(membership)
					.where(eq(membership.id, m.renewsMembershipId))
			: Promise.resolve([]),
		db
			.select({
				id: membership.id,
				number: membership.number,
				status: membership.status,
				startsOn: membership.startsOn
			})
			.from(membership)
			.where(and(eq(membership.renewsMembershipId, m.id), isNull(membership.deletedAt))),
		db
			.select({
				id: subscription.id,
				number: subscription.number,
				status: subscription.status,
				frequency: subscription.frequency,
				sku: productVariant.sku,
				nextRoastDate: subscription.nextRoastDate
			})
			.from(subscription)
			.innerJoin(productVariant, eq(subscription.variantId, productVariant.id))
			.where(and(eq(subscription.membershipId, m.id), isNull(subscription.deletedAt))),
		stampsOf(m),
		membershipPlanOptions()
	]);
	const memberIds = memberData.rows.map((r) => r.id);
	const scans = memberIds.length
		? await db
				.select({
					id: ticketScan.id,
					scannedAt: ticketScan.scannedAt,
					result: ticketScan.result,
					headcount: ticketScan.headcount,
					memberId: ticketScan.membershipMemberId,
					locationId: ticketScan.locationId,
					location: enOf(location.name),
					scannedById: ticketScan.scannedBy,
					scannedBy: scanner.name
				})
				.from(ticketScan)
				.leftJoin(location, eq(ticketScan.locationId, location.id))
				.leftJoin(scanner, eq(ticketScan.scannedBy, scanner.id))
				.where(inArray(ticketScan.membershipMemberId, memberIds))
				.orderBy(desc(ticketScan.scannedAt))
				.limit(50)
		: [];

	return {
		membership: m,
		customer: row.customer,
		customerPhone: row.customerPhone,
		plan: row.plan,
		planPrice: row.planPrice,
		planMonths: row.planMonths,
		orderId: row.orderId,
		orderNumber: row.orderNumber,
		renews: renews[0] ?? null,
		renewedBy,
		subscriptions,
		scans,
		stamps,
		plans,
		members: {
			...memberData,
			rows: memberData.rows.map((r) => ({ ...r, status: (r as { isActive?: boolean }).isActive }))
		},
		canManage: hasPermission(locals, 'memberships.manage'),
		termForm: await superValidate(
			{
				planId: m.planId,
				status: m.status,
				startsOn: m.startsOn,
				endsOn: m.endsOn,
				graceEndsOn: m.graceEndsOn,
				renewalMethod: m.renewalMethod
			},
			zod4(membershipTermSchema),
			{ errors: false, id: 'term' }
		),
		cancelForm: await superValidate(zod4(cancelSchema), { id: 'cancel' })
	};
};

const owner = async (event: { params: Partial<Record<string, string>> }) =>
	(await loadMembership(event.params.id ?? '')).m.id;

export const actions = {
	...childActions({ Member: members }, owner),

	term: async (event) => {
		requirePermission(event.locals, 'memberships.manage');
		const form = await superValidate(event.request, zod4(membershipTermSchema), { id: 'term' });
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		const { m: before } = await loadMembership(event.params.id);
		await db.transaction(async (tx) => {
			await tx
				.update(membership)
				.set({ ...form.data, updatedBy: event.locals.user?.id })
				.where(eq(membership.id, before.id));
			await recordAudit(tx, event, {
				table: 'membership',
				recordId: before.id,
				action: 'update',
				before,
				after: form.data
			});
		});
		return message(form, { type: 'success', text: 'Membership saved' });
	},

	/**
	 * Payment arrived by hand (desk cash, bank transfer). A term with dates still to come or still
	 * running keeps them; one with none, or one already over (grace, lapsed), starts afresh today.
	 */
	activate: async (event) => {
		requirePermission(event.locals, 'memberships.manage');
		const { m: loaded } = await loadMembership(event.params.id);
		const refusal = await db.transaction(async (tx) => {
			const [m] = await tx
				.select()
				.from(membership)
				.where(eq(membership.id, loaded.id))
				.for('update');
			if (m.status === 'active') return `${m.number} is already active`;
			if (m.status === 'cancelled')
				return `${m.number} was cancelled: sell a new membership instead`;
			const today = localToday();
			const dates =
				!m.startsOn || (m.endsOn && m.endsOn < today) ? await termDates(m.planId, today) : {};
			await tx
				.update(membership)
				.set({ status: 'active', ...dates, updatedBy: event.locals.user?.id })
				.where(eq(membership.id, m.id));
			await recordAudit(tx, event, {
				table: 'membership',
				recordId: m.id,
				action: 'update',
				before: m,
				after: { status: 'active', ...dates }
			});
			return null;
		});
		if (refusal) return { message: { type: 'error', text: refusal } };
		return { message: { type: 'success', text: `${loaded.number} is active` } };
	},

	cancel: async (event) => {
		requirePermission(event.locals, 'memberships.manage');
		const form = await superValidate(event.request, zod4(cancelSchema), { id: 'cancel' });
		if (!form.valid) return message(form, { type: 'error', text: 'Say why' }, { status: 400 });
		const { m } = await loadMembership(event.params.id);
		await db.transaction(async (tx) => {
			await tx
				.update(membership)
				.set({
					status: 'cancelled',
					cancelledAt: new Date(),
					cancelReason: form.data.reason,
					updatedBy: event.locals.user?.id
				})
				.where(eq(membership.id, m.id));
			await recordAudit(tx, event, {
				table: 'membership',
				recordId: m.id,
				action: 'update',
				before: m,
				after: { status: 'cancelled' }
			});
		});
		return message(form, { type: 'success', text: `${m.number} cancelled` });
	},

	/**
	 * The next term: a new row pointing at this one, starting the day after it ends (7.4). Under
	 * the row's lock, so a double click cannot make two renewals.
	 */
	renew: async (event) => {
		requirePermission(event.locals, 'memberships.manage');
		const { m: loaded } = await loadMembership(event.params.id);
		const result = await db.transaction(async (tx) => {
			const [m] = await tx
				.select()
				.from(membership)
				.where(eq(membership.id, loaded.id))
				.for('update');
			if (m.status === 'pending_payment' || m.status === 'cancelled')
				return {
					refusal: `A ${m.status === 'cancelled' ? 'cancelled' : 'unpaid'} membership cannot be renewed`
				};
			const [renewal] = await tx
				.select({ number: membership.number })
				.from(membership)
				.where(
					and(
						eq(membership.renewsMembershipId, m.id),
						ne(membership.status, 'cancelled'),
						isNull(membership.deletedAt)
					)
				)
				.limit(1);
			if (renewal) return { refusal: `${m.number} is already renewed by ${renewal.number}` };
			const startsOn = m.endsOn && m.endsOn >= localToday() ? addDays(m.endsOn, 1) : localToday();
			return createMembership(
				tx,
				{
					customerId: m.customerId,
					planId: m.planId,
					startsOn,
					renewalMethod: m.renewalMethod,
					renewsMembershipId: m.id
				},
				event.locals.user?.id
			);
		});
		if ('refusal' in result) return { message: { type: 'error', text: result.refusal } };
		redirect(
			`/dashboard/memberships/${result.id}`,
			{ type: 'success', message: `Renewal ${result.number} created — awaiting payment` },
			event.cookies
		);
	}
};
