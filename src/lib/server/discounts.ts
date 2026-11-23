/**
 * Discount codes on the public site: looked up for the checkout's preview (`discountRule`), and
 * claimed for real when the order is written (`claimDiscount`, inside `createWebOrder`), where
 * the code row is locked so its usage limit holds under two buyers at once.
 *
 * Refusals are `DiscountRefused`, carrying a message in the buyer's language for the code field.
 */
import { and, count, eq, isNull, ne } from 'drizzle-orm';
import type { Writer } from '@nahu/admin-kit/server/db';
import { db } from '#lib/server/db/index.ts';
import { discountCode, discountRedemption, order } from '#lib/server/db/schema.ts';
import { applyDiscount, type DiscountLine, type DiscountRule } from '#lib/discounts.ts';
import { money } from '#lib/format.ts';
import { m } from '#lib/i18n.ts';

export class DiscountRefused extends Error {
	readonly field = 'discountCode';
	constructor(message: string) {
		super(message);
		this.name = 'DiscountRefused';
	}
}

type Code = typeof discountCode.$inferSelect;

/** A typed code as stored: trimmed, upper case. Empty is no code. */
export const normalizeCode = (raw: string | null | undefined) => raw?.trim().toUpperCase() || null;

const ruleOf = (c: Code): DiscountRule => ({
	kind: c.kind,
	value: Number(c.value),
	minOrderAmount: Number(c.minOrderAmount),
	maxDiscountAmount: c.maxDiscountAmount == null ? null : Number(c.maxDiscountAmount),
	appliesTo: c.appliesTo
});

/** Refuses a code that is switched off, outside its dates, or used up. */
function checkUsable(c: Code | undefined, now = new Date()): asserts c is Code {
	if (!c || !c.isActive || c.deletedAt) throw new DiscountRefused(m.site_discount_err_unknown());
	if (c.startsAt && c.startsAt > now) throw new DiscountRefused(m.site_discount_err_unknown());
	if (c.expiresAt && c.expiresAt < now) throw new DiscountRefused(m.site_discount_err_expired());
	if (c.usageLimit != null && c.usedCount >= c.usageLimit)
		throw new DiscountRefused(m.site_discount_err_used_up());
}

/** What a code takes off, for the checkout's preview: its rule, or a refusal. Not a claim. */
export async function discountRule(raw: string) {
	const code = normalizeCode(raw);
	if (!code) throw new DiscountRefused(m.site_discount_err_unknown());
	const [c] = await db.select().from(discountCode).where(eq(discountCode.code, code)).limit(1);
	checkUsable(c);
	return { code: c.code, ...ruleOf(c) };
}

/**
 * Claims `raw` for an order of `lines` by `customerId`, under the code's row lock: checks it
 * again, its per-customer limit, its minimum and what it applies to, and counts the use. Returns
 * the code's id and the discount on each line, or throws `DiscountRefused`.
 */
export async function claimDiscount(
	tx: Writer,
	raw: string,
	customerId: number,
	lines: DiscountLine[]
) {
	const code = normalizeCode(raw);
	if (!code) throw new DiscountRefused(m.site_discount_err_unknown());
	const [c] = await tx.select().from(discountCode).where(eq(discountCode.code, code)).for('update');
	checkUsable(c);
	if (c.perCustomerLimit != null) {
		const [used] = await tx
			.select({ n: count() })
			.from(discountRedemption)
			.innerJoin(order, eq(discountRedemption.orderId, order.id))
			.where(
				and(
					eq(discountRedemption.discountCodeId, c.id),
					eq(discountRedemption.customerId, customerId),
					ne(order.status, 'cancelled'),
					isNull(order.deletedAt)
				)
			);
		if (used.n >= c.perCustomerLimit) throw new DiscountRefused(m.site_discount_err_customer());
	}
	const outcome = applyDiscount(ruleOf(c), lines);
	if (!outcome.ok) {
		throw new DiscountRefused(
			outcome.reason === 'min'
				? m.site_discount_err_min({ amount: money(outcome.min) })
				: m.site_discount_err_not_applicable()
		);
	}
	await tx
		.update(discountCode)
		.set({ usedCount: c.usedCount + 1 })
		.where(eq(discountCode.id, c.id));
	return { id: c.id, amount: outcome.amount, perLine: outcome.perLine };
}

/** A cancelled order's use of a code no longer counts against its limit. */
export async function releaseDiscount(tx: Writer, orderId: number) {
	const used = await tx
		.select({ id: discountRedemption.id, codeId: discountRedemption.discountCodeId })
		.from(discountRedemption)
		.where(eq(discountRedemption.orderId, orderId));
	for (const u of used) {
		const [c] = await tx
			.select({ usedCount: discountCode.usedCount })
			.from(discountCode)
			.where(eq(discountCode.id, u.codeId))
			.for('update');
		if (c)
			await tx
				.update(discountCode)
				.set({ usedCount: Math.max(0, c.usedCount - 1) })
				.where(eq(discountCode.id, u.codeId));
		await tx.delete(discountRedemption).where(eq(discountRedemption.id, u.id));
	}
}
