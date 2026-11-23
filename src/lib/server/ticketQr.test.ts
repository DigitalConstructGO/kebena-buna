import { describe, expect, it, vi } from 'vitest';

vi.mock('$app/env/private', () => ({
	TICKET_QR_SECRET: 'test-secret',
	BETTER_AUTH_SECRET: undefined
}));

const { signTicketQr, readTicketQr, ticketQrPublicKey, newTicketCode, qrSvg } =
	await import('./ticketQr.ts');
const { parseTicketQr, importQrKey, verifyTicketQr, ticketCodeOf } =
	await import('#lib/ticketQr.ts');

const t = { code: 'ABCD234567', visitDate: '2026-11-24', admits: 3 };

describe('ticket QR', () => {
	it('signs a QR the server reads back', () => {
		const value = signTicketQr(t);
		expect(value.startsWith('KT1.ABCD234567.20261124.3.')).toBe(true);
		expect(readTicketQr(value)).toMatchObject(t);
	});

	it('refuses an edited headcount, date or code', () => {
		const value = signTicketQr(t);
		expect(readTicketQr(value.replace('.3.', '.9.'))).toBeNull();
		expect(readTicketQr(value.replace('20261124', '20261125'))).toBeNull();
		expect(readTicketQr(value.replace('ABCD234567', 'ABCD234568'))).toBeNull();
	});

	it('verifies offline with only the public key (WebCrypto, as the scanner does)', async () => {
		const key = await importQrKey(ticketQrPublicKey());
		expect(key).not.toBeNull();
		const good = parseTicketQr(signTicketQr(t))!;
		expect(await verifyTicketQr(good, key!)).toBe(true);
		const forged = parseTicketQr(signTicketQr(t).replace('.3.', '.4.'))!;
		expect(await verifyTicketQr(forged, key!)).toBe(false);
	});

	it('finds the code in a QR, a link or a typed code', () => {
		expect(ticketCodeOf(signTicketQr(t))).toBe('ABCD234567');
		expect(ticketCodeOf('https://kebena.coffee/t/abcd234567')).toBe('ABCD234567');
		expect(ticketCodeOf(' abcd234567 ')).toBe('ABCD234567');
	});

	it('draws a QR the gate camera can read back (jsQR)', async () => {
		const { default: QRCode } = await import('qrcode');
		const { default: jsQR } = await import('jsqr');
		const value = signTicketQr(t);
		const { modules } = QRCode.create(value, { errorCorrectionLevel: 'M' });
		const scale = 6;
		const quiet = 4;
		const size = (modules.size + quiet * 2) * scale;
		const pixels = new Uint8ClampedArray(size * size * 4).fill(255);
		for (let y = 0; y < size; y++) {
			for (let x = 0; x < size; x++) {
				const mx = Math.floor(x / scale) - quiet;
				const my = Math.floor(y / scale) - quiet;
				if (mx >= 0 && my >= 0 && mx < modules.size && my < modules.size && modules.get(my, mx)) {
					pixels.fill(0, (y * size + x) * 4, (y * size + x) * 4 + 3);
				}
			}
		}
		expect(jsQR(pixels, size, size)?.data).toBe(value);
	});

	it('makes unambiguous codes and an SVG picture', async () => {
		expect(newTicketCode()).toMatch(/^[A-HJKMNP-Z2-9]{10}$/);
		expect(await qrSvg(signTicketQr(t))).toContain('<svg');
	});
});
