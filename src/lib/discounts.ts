/**
 * How a discount code's money is worked out, shared by the checkout's preview and the server that
 * charges it (`#lib/server/discounts.ts`), so the buyer sees the figure they will pay.
 *
 * A code applies to the lines of its `appliesTo` kinds (all lines when it names none), never to
 * delivery. Its minimum is on the whole order's goods. A percent is of the lines it applies to,
 * up to `maxDiscountAmount`; a fixed amount is at most what those lines cost. The discount is
 * spread over those lines in proportion to their price, so a later refund of one line gives back
 * what was paid for it.
 */
export type DiscountRule = {
	kind: 'percent' | 'fixed';
	value: number;
	minOrderAmount: number;
	maxDiscountAmount: number | null;
	appliesTo: string[] | null;
};

export type DiscountLine = { itemType: string; gross: number };

export type DiscountOutcome =
	| { ok: true; amount: number; perLine: number[] }
	| { ok: false; reason: 'min'; min: number }
	| { ok: false; reason: 'not_applicable' };

const r2 = (n: number) => Math.round(n * 100) / 100;

export function applyDiscount(rule: DiscountRule, lines: DiscountLine[]): DiscountOutcome {
	const subtotal = lines.reduce((sum, l) => sum + l.gross, 0);
	if (subtotal + 0.005 < rule.minOrderAmount)
		return { ok: false, reason: 'min', min: rule.minOrderAmount };
	const kinds = rule.appliesTo?.length ? rule.appliesTo : null;
	const eligible = lines.map((l) => (!kinds || kinds.includes(l.itemType) ? l.gross : 0));
	const base = r2(eligible.reduce((sum, g) => sum + g, 0));
	if (base < 0.005) return { ok: false, reason: 'not_applicable' };

	let amount = rule.kind === 'percent' ? (base * rule.value) / 100 : rule.value;
	if (rule.kind === 'percent' && rule.maxDiscountAmount != null)
		amount = Math.min(amount, rule.maxDiscountAmount);
	amount = r2(Math.min(amount, base));

	// In proportion to each line's price; the cents left by rounding go on the last line it touches.
	const perLine = eligible.map((g) => r2((amount * g) / base));
	const last = eligible.findLastIndex((g) => g > 0);
	perLine[last] = r2(perLine[last] + amount - perLine.reduce((sum, d) => sum + d, 0));
	return { ok: true, amount, perLine };
}

/** What `rule` takes off `lines`, or 0 when it does not apply (the preview shows why). */
export function discountOff(rule: DiscountRule | null | undefined, lines: DiscountLine[]) {
	if (!rule) return 0;
	const outcome = applyDiscount(rule, lines);
	return outcome.ok ? outcome.amount : 0;
}
