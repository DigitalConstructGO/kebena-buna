import { and, asc, eq, isNull } from 'drizzle-orm';
import { fail, message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import type { z } from 'zod/v4';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { isDuplicateKey } from '@nahu/admin-kit/server/dbErrors';
import { postedForm, storeFileFields, UploadRefused } from '@nahu/admin-kit/server/files';
import { db } from '#lib/server/db/index.ts';
import {
	businessAccount,
	businessAddress,
	businessMember,
	wholesaleTier
} from '#lib/server/db/schema.ts';
import { readSetting } from '#lib/server/stockReads.ts';
import {
	customerFor,
	discardUpload,
	floodRefused,
	isTrapped,
	submitForm
} from '#lib/server/site.ts';
import { inboxAction } from '#lib/server/siteForms.ts';
import { greenQuoteSchema, wholesaleSchema } from '#lib/schemas/siteForms.ts';
import { m } from '#lib/i18n.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [tiers, minOrderKg] = await Promise.all([
		db
			.select({
				id: wholesaleTier.id,
				name: wholesaleTier.name,
				minKg: wholesaleTier.minKg,
				maxKg: wholesaleTier.maxKg,
				discountPct: wholesaleTier.discountPct
			})
			.from(wholesaleTier)
			.where(and(isNull(wholesaleTier.deletedAt), eq(wholesaleTier.status, true)))
			.orderBy(asc(wholesaleTier.sortOrder), asc(wholesaleTier.minKg)),
		readSetting<number>('wholesale.min_order_kg', 5)
	]);
	return {
		tiers: tiers.map((t) => ({
			...t,
			minKg: Number(t.minKg),
			maxKg: t.maxKg === null ? null : Number(t.maxKg),
			discountPct: Number(t.discountPct)
		})),
		minOrderKg: Number(minOrderKg),
		application: await superValidate(zod4(wholesaleSchema), { id: 'application' }),
		quote: await superValidate(zod4(greenQuoteSchema), { id: 'quote' })
	};
};

export const actions: Actions = {
	/**
	 * A business account application (11.1): the account waits as `pending` for a Manager or Owner
	 * (11.2); its contact becomes the customer who administers it. The inbox gets a note too, so
	 * the application is seen.
	 */
	application: async (event) => {
		const posted = await postedForm(event.request);
		const form = await superValidate(posted, zod4(wholesaleSchema), { id: 'application' });
		if (!form.valid) return fail(400, { form });
		if (isTrapped(form.data)) return message(form, 'ok');
		if (floodRefused(event, 'wholesale', 2)) return message(form, 'flood', { status: 429 });

		const d = form.data;
		const values: Record<string, unknown> = { tradeLicenceFile: d.tradeLicenceFile };
		let accountId: number;
		try {
			await storeFileFields(values, ['tradeLicenceFile'], posted);
			accountId = await db.transaction(async (tx) => {
				const [res] = await tx.insert(businessAccount).values({
					name: d.name,
					type: d.type,
					tradeLicenceNumber: d.tradeLicenceNumber,
					tradeLicenceFile: (values.tradeLicenceFile as string | undefined) ?? null,
					tin: d.tin,
					vatNumber: d.vatNumber ?? null,
					contactName: d.contactName,
					contactPhone: d.contactPhone,
					contactEmail: d.contactEmail ?? null,
					expectedMonthlyKg: d.expectedMonthlyKg ?? null,
					notes: d.notes ?? null,
					approvalStatus: 'pending'
				});
				const id = res.insertId;
				const customerId = await customerFor(tx, {
					name: d.contactName,
					phone: d.contactPhone,
					email: d.contactEmail
				});
				await tx
					.insert(businessMember)
					.values({ businessAccountId: id, customerId, isAdmin: true });
				if (d.address) {
					await tx.insert(businessAddress).values({
						businessAccountId: id,
						label: 'Main',
						city: d.city ?? 'Addis Ababa',
						line1: d.address,
						isBilling: true,
						isDefaultDelivery: true
					});
				}
				await recordAudit(tx, event, { table: 'business_account', recordId: id, action: 'create' });
				return id;
			});
		} catch (err) {
			await discardUpload(values.tradeLicenceFile);
			if (err instanceof UploadRefused) return setError(form, 'tradeLicenceFile', err.message);
			if (isDuplicateKey(err)) return setError(form, 'tin', m.wholesale_err_tin());
			throw err;
		}

		await submitForm(event, {
			formType: 'wholesale_application',
			name: d.contactName,
			phone: d.contactPhone,
			email: d.contactEmail,
			subject: `Wholesale application: ${d.name}`,
			message: d.notes,
			data: {
				businessAccountId: accountId,
				businessName: d.name,
				type: d.type,
				tin: d.tin,
				monthlyKg: d.expectedMonthlyKg ?? null,
				subCity: d.city ?? null
			},
			marketingConsent: d.marketingConsent
		});
		return message(form, 'ok');
	},
	/** Green coffee for export is quoted offline by the export team (11); this reaches them. */
	quote: (event) =>
		inboxAction<z.infer<typeof greenQuoteSchema>>(event, greenQuoteSchema, 'quote', (d) => ({
			formType: 'green_coffee_quote',
			name: d.name,
			phone: d.phone,
			email: d.email,
			subject: `Green coffee quote: ${d.bags} bags to ${d.country}`,
			message: d.message,
			data: {
				company: d.company ?? null,
				origin: d.origin ?? null,
				grade: d.grade ?? null,
				bags: d.bags,
				incoterm: d.incoterm,
				country: d.country
			},
			marketingConsent: d.marketingConsent
		}))
};
