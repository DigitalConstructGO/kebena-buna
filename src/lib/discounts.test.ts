import { describe, expect, it } from 'vitest';
import { applyDiscount, discountOff, type DiscountRule } from './discounts.ts';

const rule = (r: Partial<DiscountRule>): DiscountRule => ({
	kind: 'percent',
	value: 10,
	minOrderAmount: 0,
	maxDiscountAmount: null,
	appliesTo: null,
	...r
});

describe('discount codes', () => {
	it('takes a percent off every line when the code names no kinds', () => {
		const out = applyDiscount(rule({ value: 10 }), [
			{ itemType: 'product', gross: 1300 },
			{ itemType: 'ticket', gross: 200 }
		]);
		expect(out).toEqual({ ok: true, amount: 150, perLine: [130, 20] });
	});

	it('touches only the kinds it applies to', () => {
		const out = applyDiscount(rule({ value: 15, appliesTo: ['ticket', 'event_ticket'] }), [
			{ itemType: 'product', gross: 650 },
			{ itemType: 'ticket', gross: 400 }
		]);
		expect(out).toEqual({ ok: true, amount: 60, perLine: [0, 60] });
	});

	it('refuses an order with nothing the code applies to', () => {
		expect(
			applyDiscount(rule({ appliesTo: ['membership'] }), [{ itemType: 'product', gross: 900 }])
		).toEqual({
			ok: false,
			reason: 'not_applicable'
		});
	});

	it('holds the minimum against the whole order', () => {
		expect(
			applyDiscount(rule({ minOrderAmount: 500 }), [{ itemType: 'product', gross: 450 }])
		).toEqual({
			ok: false,
			reason: 'min',
			min: 500
		});
		expect(
			applyDiscount(rule({ minOrderAmount: 500 }), [{ itemType: 'product', gross: 500 }]).ok
		).toBe(true);
	});

	it('caps a percent at its maximum', () => {
		const out = applyDiscount(rule({ value: 50, maxDiscountAmount: 400 }), [
			{ itemType: 'product', gross: 2000 }
		]);
		expect(out.ok && out.amount).toBe(400);
	});

	it('never takes off more than the lines cost', () => {
		const out = applyDiscount(rule({ kind: 'fixed', value: 500 }), [
			{ itemType: 'ticket', gross: 300 }
		]);
		expect(out.ok && out.amount).toBe(300);
	});

	it('spreads a discount in proportion, the rounding on the last line it touches', () => {
		const out = applyDiscount(rule({ kind: 'fixed', value: 100 }), [
			{ itemType: 'product', gross: 100 },
			{ itemType: 'product', gross: 100 },
			{ itemType: 'product', gross: 100 }
		]);
		expect(out.ok && out.perLine).toEqual([33.33, 33.33, 33.34]);
		expect(out.ok && out.perLine.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 2);
	});

	it('shows nothing off for no code or a code that does not apply', () => {
		expect(discountOff(null, [{ itemType: 'product', gross: 900 }])).toBe(0);
		expect(discountOff(rule({ minOrderAmount: 1000 }), [{ itemType: 'product', gross: 900 }])).toBe(
			0
		);
	});
});
