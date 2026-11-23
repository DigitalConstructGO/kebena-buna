import { error } from '@sveltejs/kit';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { redirect } from 'sveltekit-flash-message/server';
import { hasPermission, requirePermission } from '@nahu/admin-kit/server/permissions';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { deletionStamp } from '@nahu/admin-kit/server/softDelete';
import { isDuplicateKey } from '@nahu/admin-kit/server/dbErrors';
import { postedForm, storeFileFields, UploadRefused } from '@nahu/admin-kit/server/files';
import { db } from '#lib/server/db/index.ts';
import {
	businessAccount,
	businessAddress,
	businessMember,
	customer,
	deliveryArea,
	deliveryZone,
	invoice,
	order
} from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';
import { namesOf, stampsOf } from '#lib/server/people.ts';
import { idParam } from '#lib/server/records.ts';
import { customerOptions, deliveryAreaOptions } from '#lib/server/options.ts';
import { releaseCheck } from '#lib/server/wholesale.ts';
import { readSetting } from '#lib/server/stockReads.ts';
import {
	accountEditSchema,
	businessAddressEditSchema,
	businessAddressSchema,
	decisionSchema,
	memberSchema,
	termsSchema
} from '#lib/schemas/wholesale.ts';

async function loadAccount(raw: string) {
	const id = idParam(raw, 'Business account');
	const [row] = await db
		.select()
		.from(businessAccount)
		.where(and(eq(businessAccount.id, id), isNull(businessAccount.deletedAt)));
	if (!row) error(404, 'Business account not found');
	return row;
}

export const load = async ({ params, locals }) => {
	const a = await loadAccount(params.id);
	const canManage = hasPermission(locals, 'wholesale.manage');
	const [members, addresses, orders, invoices, stamps, names, customers, areas] = await Promise.all(
		[
			db
				.select({
					id: businessMember.id,
					customerId: businessMember.customerId,
					name: customer.name,
					phone: customer.phone,
					email: customer.email,
					isAdmin: businessMember.isAdmin
				})
				.from(businessMember)
				.innerJoin(customer, eq(businessMember.customerId, customer.id))
				.where(and(eq(businessMember.businessAccountId, a.id), isNull(businessMember.deletedAt))),
			db
				.select({
					id: businessAddress.id,
					label: businessAddress.label,
					areaId: businessAddress.areaId,
					area: enOf(deliveryArea.name),
					zone: enOf(deliveryZone.name),
					city: businessAddress.city,
					line1: businessAddress.line1,
					landmark: businessAddress.landmark,
					latitude: businessAddress.latitude,
					longitude: businessAddress.longitude,
					isBilling: businessAddress.isBilling,
					isDefaultDelivery: businessAddress.isDefaultDelivery
				})
				.from(businessAddress)
				.leftJoin(deliveryArea, eq(businessAddress.areaId, deliveryArea.id))
				.leftJoin(deliveryZone, eq(deliveryArea.zoneId, deliveryZone.id))
				.where(and(eq(businessAddress.businessAccountId, a.id), isNull(businessAddress.deletedAt))),
			db
				.select({
					id: order.id,
					number: order.number,
					placedAt: order.placedAt,
					customerId: order.customerId,
					customer: customer.name,
					status: order.status,
					paymentState: order.paymentState,
					total: order.total
				})
				.from(order)
				.innerJoin(customer, eq(order.customerId, customer.id))
				.where(eq(order.businessAccountId, a.id))
				.orderBy(desc(order.placedAt)),
			db
				.select({
					id: invoice.id,
					number: invoice.number,
					status: invoice.status,
					total: invoice.total,
					amountPaid: invoice.amountPaid,
					balance: sql<number>`${invoice.total} - ${invoice.amountPaid}`.mapWith(Number),
					dueOn: invoice.dueOn
				})
				.from(invoice)
				.where(eq(invoice.businessAccountId, a.id))
				.orderBy(desc(invoice.id)),
			stampsOf(a),
			namesOf([a.requestedBy, a.approvedBy, a.rejectedBy]),
			// The customer directory is for adding members, so only those who may add them get it.
			canManage ? customerOptions() : [],
			deliveryAreaOptions()
		]
	);

	const owed = invoices
		.filter((i) => i.status === 'open' || i.status === 'overdue')
		.reduce((sum, i) => sum + i.balance, 0);

	// Without credit the stored limit and days are 0; offer the shop defaults when it is switched on.
	const [defaultLimit, defaultDays] = a.creditApproved
		? [a.creditLimit, a.paymentTermsDays]
		: await Promise.all([
				readSetting('wholesale.credit_limit_default', 50000),
				readSetting('wholesale.credit_days_default', 30)
			]);

	const [editForm, termsForm, decisionForm, memberForm, addressForm, addressEditForm] =
		await Promise.all([
			superValidate(
				{
					id: a.id,
					name: a.name,
					type: a.type,
					tradeLicenceNumber: a.tradeLicenceNumber,
					tin: a.tin,
					vatNumber: a.vatNumber,
					contactName: a.contactName,
					contactPhone: a.contactPhone,
					contactEmail: a.contactEmail,
					expectedMonthlyKg: a.expectedMonthlyKg,
					notes: a.notes,
					isActive: a.isActive
				},
				zod4(accountEditSchema),
				{ errors: false }
			),
			superValidate(
				{
					discountPct: a.discountPct,
					creditApproved: a.creditApproved,
					creditLimit: defaultLimit,
					paymentTermsDays: defaultDays,
					minOrderKg: a.minOrderKg
				},
				zod4(termsSchema),
				{ errors: false, id: 'terms' }
			),
			superValidate({ decision: 'approve' }, zod4(decisionSchema), {
				errors: false,
				id: 'decision'
			}),
			superValidate(zod4(memberSchema), { errors: false, id: 'member' }),
			superValidate(
				{ city: 'Addis Ababa', isDefaultDelivery: !addresses.length },
				zod4(businessAddressSchema),
				{
					errors: false,
					id: 'address'
				}
			),
			superValidate(zod4(businessAddressEditSchema), { errors: false, id: 'addressEdit' })
		]);

	const release = releaseCheck(a.requestedBy, locals.user?.id, locals.isSuperAdmin);
	return {
		account: a,
		people: {
			requestedBy: a.requestedBy ? (names[a.requestedBy] ?? null) : null,
			approvedBy: a.approvedBy ? (names[a.approvedBy] ?? null) : null,
			rejectedBy: a.rejectedBy ? (names[a.rejectedBy] ?? null) : null
		},
		members,
		addresses,
		orders,
		invoices,
		owed,
		stamps,
		customers: customers.filter((c) => !members.some((m) => m.customerId === c.value)),
		areas,
		canManage,
		canRelease: release.allowed,
		releaseOverrides: release.overridden,
		editForm,
		termsForm,
		decisionForm,
		memberForm,
		addressForm,
		addressEditForm
	};
};

const manage = (event: { locals: App.Locals }) =>
	requirePermission(event.locals, 'wholesale.manage');

export const actions = {
	edit: async (event) => {
		manage(event);
		const posted = await postedForm(event.request);
		const form = await superValidate(posted, zod4(accountEditSchema));
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		// The record saved is the one in the URL; the form's hidden id is not trusted.
		const { id: _id, ...rest } = form.data;
		void _id;
		const before = await loadAccount(event.params.id);
		const id = before.id;
		const values: Record<string, unknown> = { ...rest };
		try {
			await storeFileFields(values, ['tradeLicenceFile'], posted);
			await db.transaction(async (tx) => {
				await tx
					.update(businessAccount)
					.set({
						...(values as Partial<typeof businessAccount.$inferInsert>),
						updatedBy: event.locals.user?.id
					})
					.where(eq(businessAccount.id, id));
				await recordAudit(tx, event, {
					table: 'business_account',
					recordId: id,
					action: 'update',
					before,
					after: values
				});
			});
		} catch (err) {
			if (err instanceof UploadRefused) {
				setError(form, 'tradeLicenceFile', err.message);
				return message(form, { type: 'error', text: err.message }, { status: 400 });
			}
			if (isDuplicateKey(err)) {
				setError(form, 'tin', 'Another business has this TIN.');
				return message(
					form,
					{ type: 'error', text: 'Another business has this TIN.' },
					{ status: 400 }
				);
			}
			throw err;
		}
		return message(form, { type: 'success', text: 'Account saved' });
	},

	/** Discount, credit and minimum order: the Owner's terms (11.3–11.5), audited. */
	terms: async (event) => {
		manage(event);
		const a = await loadAccount(event.params.id);
		const form = await superValidate(event.request, zod4(termsSchema), { id: 'terms' });
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the terms' }, { status: 400 });
		const values = form.data.creditApproved
			? form.data
			: { ...form.data, creditLimit: 0, paymentTermsDays: 0 };
		await db.transaction(async (tx) => {
			await tx
				.update(businessAccount)
				.set({ ...values, updatedBy: event.locals.user?.id })
				.where(eq(businessAccount.id, a.id));
			await recordAudit(tx, event, {
				table: 'business_account',
				recordId: a.id,
				action: 'update',
				before: a,
				after: values
			});
		});
		return message(form, { type: 'success', text: 'Terms saved' });
	},

	/** Maker-checker (11.2): the person who entered the application may not release it. */
	decide: async (event) => {
		manage(event);
		const a = await loadAccount(event.params.id);
		const form = await superValidate(event.request, zod4(decisionSchema), { id: 'decision' });
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		const userId = event.locals.user?.id;
		const release = releaseCheck(a.requestedBy, userId, event.locals.isSuperAdmin);
		if (!release.allowed) {
			return message(
				form,
				{ type: 'error', text: 'You entered this application: someone else must decide it.' },
				{ status: 403 }
			);
		}
		const approve = form.data.decision === 'approve';
		if (!approve && !form.data.reason) {
			setError(form, 'reason', 'Say why it is rejected');
			return message(form, { type: 'error', text: 'Say why it is rejected' }, { status: 400 });
		}
		const values = approve
			? {
					approvalStatus: 'approved' as const,
					approvedBy: userId,
					approvedAt: new Date(),
					rejectedBy: null,
					rejectedAt: null,
					rejectionReason: null,
					approvalOverridden: release.overridden
				}
			: {
					approvalStatus: 'rejected' as const,
					rejectedBy: userId,
					rejectedAt: new Date(),
					rejectionReason: form.data.reason,
					approvedBy: null,
					approvedAt: null,
					approvalOverridden: release.overridden
				};
		await db.transaction(async (tx) => {
			await tx.update(businessAccount).set(values).where(eq(businessAccount.id, a.id));
			await recordAudit(tx, event, {
				table: 'business_account',
				recordId: a.id,
				action: 'update',
				before: a,
				after: values
			});
		});
		return message(form, {
			type: 'success',
			text: approve ? `${a.name} approved` : `${a.name} rejected`
		});
	},

	addMember: async (event) => {
		manage(event);
		const a = await loadAccount(event.params.id);
		const form = await superValidate(event.request, zod4(memberSchema), { id: 'member' });
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		// A member removed earlier comes back rather than colliding with the unique pair.
		const [existing] = await db
			.select({ id: businessMember.id })
			.from(businessMember)
			.where(
				and(
					eq(businessMember.businessAccountId, a.id),
					eq(businessMember.customerId, form.data.customerId)
				)
			);
		if (existing) {
			await db
				.update(businessMember)
				.set({ isAdmin: form.data.isAdmin, deletedAt: null, deletedBy: null, status: true })
				.where(eq(businessMember.id, existing.id));
		} else {
			await db.insert(businessMember).values({ businessAccountId: a.id, ...form.data });
		}
		return message(form, { type: 'success', text: 'Person added' });
	},

	removeMember: async (event) => {
		manage(event);
		const a = await loadAccount(event.params.id);
		const id = Number((await event.request.formData()).get('id'));
		await db
			.update(businessMember)
			.set(deletionStamp(event.locals.user?.id))
			.where(and(eq(businessMember.id, id), eq(businessMember.businessAccountId, a.id)));
		return { message: { type: 'success', text: 'Person removed from the account' } };
	},

	toggleAdmin: async (event) => {
		manage(event);
		const a = await loadAccount(event.params.id);
		const data = await event.request.formData();
		await db
			.update(businessMember)
			.set({ isAdmin: data.get('isAdmin') === '1' })
			.where(
				and(
					eq(businessMember.id, Number(data.get('id'))),
					eq(businessMember.businessAccountId, a.id)
				)
			);
		return { message: { type: 'success', text: 'Role changed' } };
	},

	addAddress: async (event) => {
		manage(event);
		const a = await loadAccount(event.params.id);
		const form = await superValidate(event.request, zod4(businessAddressSchema), { id: 'address' });
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the address' }, { status: 400 });
		await db.transaction(async (tx) => {
			await clearFlags(tx, a.id, form.data);
			await tx
				.insert(businessAddress)
				.values({ ...form.data, businessAccountId: a.id, createdBy: event.locals.user?.id });
		});
		return message(form, { type: 'success', text: 'Address added' });
	},

	editAddress: async (event) => {
		manage(event);
		const a = await loadAccount(event.params.id);
		const form = await superValidate(event.request, zod4(businessAddressEditSchema), {
			id: 'addressEdit'
		});
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the address' }, { status: 400 });
		const { id, ...values } = form.data;
		await db.transaction(async (tx) => {
			await clearFlags(tx, a.id, values);
			await tx
				.update(businessAddress)
				.set({ ...values, updatedBy: event.locals.user?.id })
				.where(and(eq(businessAddress.id, id), eq(businessAddress.businessAccountId, a.id)));
		});
		return message(form, { type: 'success', text: 'Address saved' });
	},

	deleteAddress: async (event) => {
		manage(event);
		const a = await loadAccount(event.params.id);
		const id = Number((await event.request.formData()).get('id'));
		await db
			.update(businessAddress)
			.set(deletionStamp(event.locals.user?.id))
			.where(and(eq(businessAddress.id, id), eq(businessAddress.businessAccountId, a.id)));
		return { message: { type: 'success', text: 'Address removed' } };
	},

	delete: async (event) => {
		manage(event);
		const a = await loadAccount(event.params.id);
		const [used] = await db
			.select({ id: order.id })
			.from(order)
			.where(eq(order.businessAccountId, a.id))
			.limit(1);
		if (used)
			return {
				message: { type: 'error', text: 'This business has orders: switch it off instead.' }
			};
		await db.transaction(async (tx) => {
			await tx
				.update(businessAccount)
				.set(deletionStamp(event.locals.user?.id))
				.where(eq(businessAccount.id, a.id));
			await recordAudit(tx, event, { table: 'business_account', recordId: a.id, action: 'delete' });
		});
		redirect(
			'/dashboard/wholesale/accounts',
			{ type: 'success', message: `${a.name} deleted` },
			event.cookies
		);
	}
};

/** One billing address and one default delivery address per account. */
async function clearFlags(
	tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
	accountId: number,
	values: { isBilling: boolean; isDefaultDelivery: boolean }
) {
	if (values.isBilling)
		await tx
			.update(businessAddress)
			.set({ isBilling: false })
			.where(eq(businessAddress.businessAccountId, accountId));
	if (values.isDefaultDelivery)
		await tx
			.update(businessAddress)
			.set({ isDefaultDelivery: false })
			.where(eq(businessAddress.businessAccountId, accountId));
}
