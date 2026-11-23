import { describe, expect, it } from 'vitest';
import { bundlePrice, inWindow, spreadSaving } from './bundles.ts';

describe('bundlePrice', () => {
	it('takes a percentage off the bags', () => {
		expect(bundlePrice({ pricing: 'percent_off', value: 5 }, 4800)).toEqual({
			price: 4560,
			saving: 240
		});
	});

	it('takes an amount off, never below zero', () => {
		expect(bundlePrice({ pricing: 'amount_off', value: 300 }, 4800)).toEqual({
			price: 4500,
			saving: 300
		});
		expect(bundlePrice({ pricing: 'amount_off', value: 9000 }, 4800)).toEqual({
			price: 0,
			saving: 4800
		});
	});

	it('charges a fixed price, never more than the bags', () => {
		expect(bundlePrice({ pricing: 'fixed_price', value: 4400 }, 4800)).toEqual({
			price: 4400,
			saving: 400
		});
		expect(bundlePrice({ pricing: 'fixed_price', value: 5000 }, 4800)).toEqual({
			price: 4800,
			saving: 0
		});
	});

	it('rounds to the cent', () => {
		expect(bundlePrice({ pricing: 'percent_off', value: 7.5 }, 1333.33)).toEqual({
			price: 1233.33,
			saving: 100
		});
	});
});

describe('spreadSaving', () => {
	it('spreads in proportion and adds up exactly', () => {
		const shares = spreadSaving([2400, 2600, 1400], 333.33);
		expect(shares.reduce((a, b) => a + b, 0)).toBeCloseTo(333.33, 2);
		expect(shares[1]).toBeGreaterThan(shares[0]);
		expect(shares[0]).toBeGreaterThan(shares[2]);
	});

	it('splits evenly between equal lines', () => {
		expect(spreadSaving([1600, 1600], 160)).toEqual([80, 80]);
	});

	it('gives nothing when there is nothing to save', () => {
		expect(spreadSaving([1600, 1600], 0)).toEqual([0, 0]);
	});
});

describe('inWindow', () => {
	const now = new Date('2026-11-21T10:00:00Z');
	it('is always on with no dates', () => {
		expect(inWindow({ startsAt: null, endsAt: null }, now)).toBe(true);
	});
	it('is off before the start and after the end', () => {
		expect(inWindow({ startsAt: '2026-12-01T00:00:00Z', endsAt: null }, now)).toBe(false);
		expect(inWindow({ startsAt: null, endsAt: '2026-11-20T23:59:00Z' }, now)).toBe(false);
	});
});
