/**
 * Phase 2 wholesale (questionnaire 11): the quantity tiers, and business accounts at every stage
 * of approval, with the customers who order for them and their addresses.
 */
import { eq } from 'drizzle-orm';
import { db, schema as s, insertId, L, daysFrom, pick } from './db.ts';
import { userIdByEmail } from './base.ts';

export async function seed() {
	await db.insert(s.wholesaleTier).values([
		{ name: L('5–19 kg', '5–19 ኪ.ግ'), minKg: 5, maxKg: 19.999, discountPct: 20, sortOrder: 1 },
		{ name: L('20–49 kg', '20–49 ኪ.ግ'), minKg: 20, maxKg: 49.999, discountPct: 27, sortOrder: 2 },
		{ name: L('50 kg and over', '50 ኪ.ግ እና በላይ'), minKg: 50, maxKg: null, discountPct: 33, sortOrder: 3 }
	]);

	const owner = await userIdByEmail('owner@kebena.coffee');
	const manager = await userIdByEmail('manager@kebena.coffee');
	const shop = await userIdByEmail('shop@kebena.coffee');
	const customers = await db
		.select({ id: s.customer.id, name: s.customer.name, phone: s.customer.phone })
		.from(s.customer)
		.orderBy(s.customer.id);
	const areas = await db.select({ id: s.deliveryArea.id }).from(s.deliveryArea);

	const accounts = [
		{ name: 'Tomoca Bole Branch', type: 'cafe', kg: 60, status: 'approved', credit: { limit: 50000, days: 30 }, discount: 2, by: shop },
		{ name: 'Kaldi’s Coffee — Kazanchis', type: 'cafe', kg: 35, status: 'approved', by: manager },
		{ name: 'Sheraton Addis', type: 'hotel', kg: 120, status: 'approved', credit: { limit: 150000, days: 45 }, discount: 3, by: manager },
		{ name: 'Skylight Hotel', type: 'hotel', kg: 80, status: 'pending', by: shop },
		{ name: 'Ethio Telecom HQ canteen', type: 'office', kg: 25, status: 'pending', by: manager },
		{ name: 'Shoa Supermarket', type: 'retailer', kg: 40, status: 'approved', by: shop },
		{ name: 'Abyssinia Green Exporters', type: 'exporter', kg: 500, status: 'rejected', reason: 'Export buyers go through the green-coffee enquiry, not retail wholesale.', by: shop },
		{ name: 'Mokarar Café', type: 'cafe', kg: 8, status: 'pending', by: owner }
	] as const;

	for (const [i, acc] of accounts.entries()) {
		const created = daysFrom(-(90 - i * 9));
		const decided = daysFrom(-(80 - i * 9));
		const credit = 'credit' in acc ? acc.credit : null;
		const id = await insertId(s.businessAccount, {
			name: acc.name,
			type: acc.type,
			tradeLicenceNumber: `AA/TL/${14000 + i * 37}/2025`,
			tin: `00${70000000 + i * 1311}`,
			vatNumber: i % 2 ? null : `VAT-${880000 + i}`,
			contactName: customers[20 + i]?.name ?? 'Contact person',
			contactPhone: `+25191${String(1200000 + i * 4711).slice(0, 7)}`,
			contactEmail: `orders@${acc.name.toLowerCase().replace(/[^a-z]+/g, '')}.et`,
			expectedMonthlyKg: acc.kg,
			discountPct: 'discount' in acc ? acc.discount : 0,
			creditApproved: Boolean(credit),
			creditLimit: credit?.limit ?? 0,
			paymentTermsDays: credit?.days ?? 0,
			minOrderKg: acc.type === 'hotel' ? 10 : null,
			approvalStatus: acc.status,
			requestedBy: acc.by,
			approvedBy: acc.status === 'approved' ? (acc.by === owner ? manager : owner) : null,
			approvedAt: acc.status === 'approved' ? decided : null,
			rejectedBy: acc.status === 'rejected' ? owner : null,
			rejectedAt: acc.status === 'rejected' ? decided : null,
			rejectionReason: 'reason' in acc ? acc.reason : null,
			notes: acc.type === 'hotel' ? 'Delivers to the kitchen entrance, mornings only.' : null,
			createdBy: acc.by,
			createdAt: created
		});

		// The people who order for it: one admin, sometimes a second orderer.
		const admin = customers[20 + i];
		if (admin) {
			await db.insert(s.businessMember).values({ businessAccountId: id, customerId: admin.id, isAdmin: true });
			await db
				.update(s.customer)
				.set({ businessName: acc.name })
				.where(eq(s.customer.id, admin.id));
		}
		if (i % 3 === 0 && customers[i + 2]) {
			await db.insert(s.businessMember).values({ businessAccountId: id, customerId: customers[i + 2].id, isAdmin: false });
		}

		await db.insert(s.businessAddress).values({
			businessAccountId: id,
			label: 'Main',
			areaId: pick(areas).id,
			line1: `${pick(['Bole Road', 'Kazanchis', 'Megenagna', 'Piassa', 'CMC'])}, building ${10 + i}`,
			landmark: pick(['Next to the bank', 'Ground floor', 'Back gate']),
			isBilling: true,
			isDefaultDelivery: true,
			createdBy: acc.by
		});
		if (acc.type === 'hotel' || acc.type === 'retailer') {
			await db.insert(s.businessAddress).values({
				businessAccountId: id,
				label: 'Second branch',
				areaId: pick(areas).id,
				line1: `Branch ${i + 1}, ${pick(['Sarbet', 'Gerji', 'Ayat', 'Summit'])}`,
				createdBy: acc.by
			});
		}
	}
}
