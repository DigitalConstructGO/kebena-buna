/**
 * Bundle arithmetic — client-safe, so the dashboard's preview and the checkout price a bundle the
 * same way. The server decides which bags are in it (`#lib/server/bundles`); this only does sums.
 */
import type { BundlePricing } from '#lib/constants.ts';
import { amount, money, qty } from '#lib/format.ts';

export type BundleRule = { pricing: BundlePricing; value: number };

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * What the bundle costs for bags whose own prices add up to `list`, and what it saves. Never more
 * than `list` and never below zero, whatever the rule says.
 */
export function bundlePrice(rule: BundleRule, list: number): { price: number; saving: number } {
	const value = Math.max(0, Number(rule.value));
	const price =
		rule.pricing === 'percent_off'
			? list * (1 - Math.min(value, 100) / 100)
			: rule.pricing === 'amount_off'
				? list - value
				: value;
	const capped = r2(Math.min(list, Math.max(0, price)));
	return { price: capped, saving: r2(list - capped) };
}

/**
 * The saving spread over the bundle's lines in proportion to what each costs, to the cent, adding
 * up exactly: the cents lost to rounding go to the lines that lost the most.
 */
export function spreadSaving(lineTotals: number[], saving: number): number[] {
	const cents = Math.round(saving * 100);
	const total = lineTotals.reduce((sum, t) => sum + t, 0);
	if (!cents || total <= 0) return lineTotals.map(() => 0);
	const exact = lineTotals.map((t) => (cents * t) / total);
	const shares = exact.map(Math.floor);
	let left = cents - shares.reduce((sum, s) => sum + s, 0);
	const byRemainder = exact.map((e, i) => [e - shares[i], i] as const).sort((a, b) => b[0] - a[0]);
	for (const [, i] of byRemainder) {
		if (!left) break;
		shares[i] += 1;
		left -= 1;
	}
	return shares.map((c) => c / 100);
}

/** "5% off", "ETB 200.00 off", "ETB 4,500.00 for the lot". */
export function describeRule(rule: BundleRule): string {
	const value = Number(rule.value);
	if (rule.pricing === 'percent_off')
		return `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}% off`;
	if (rule.pricing === 'amount_off') return `${money(value)} off`;
	return `${money(value)} for the lot`;
}

/** Whether today is inside the bundle's window; an open end is no limit. */
export function inWindow(
	b: { startsAt: Date | string | null; endsAt: Date | string | null },
	now = new Date()
) {
	if (b.startsAt && new Date(b.startsAt) > now) return false;
	if (b.endsAt && new Date(b.endsAt) < now) return false;
	return true;
}

/** "4,560.00", or "4,180.00 – 4,560.00" when the customer's choices move it. */
export const amountRange = (min: number, max: number) =>
	min === max ? amount(min) : `${amount(min)} – ${amount(max)}`;

/** A bundle's coffee by weight: "2 kg", "750 g"; "—" when a bag in it has no weight. */
export const weightOf = (grams: number | null) =>
	grams === null ? '—' : grams >= 1000 ? qty(grams / 1000, 'kg') : qty(grams, 'g');
