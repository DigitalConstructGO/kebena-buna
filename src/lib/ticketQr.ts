/**
 * The ticket QR, client-safe half: what a QR says and how a scanner checks it offline (6.7).
 *
 *     KT1.<CODE>.<YYYYMMDD>.<ADMITS>.<SIGNATURE>
 *
 * The signature is Ed25519 over everything before it, made on the server
 * (`#lib/server/ticketQr`). A scanner holds only the public key, so a stolen tablet cannot mint
 * tickets, and a QR whose code, date or headcount was edited fails the check.
 */

export const QR_PREFIX = 'KT1';

export type TicketQr = {
	code: string;
	/** `YYYY-MM-DD` */
	visitDate: string;
	admits: number;
	/** The signed part: `KT1.CODE.YYYYMMDD.ADMITS`. */
	message: string;
	signature: string;
};

/** What a scanned string says, or null when it is not a ticket QR. */
export function parseTicketQr(raw: string): TicketQr | null {
	const parts = raw.trim().split('.');
	if (parts.length !== 5 || parts[0] !== QR_PREFIX) return null;
	const [, code, day, admits, signature] = parts;
	if (!/^[A-Z0-9]{4,16}$/.test(code) || !/^\d{8}$/.test(day) || !/^\d{1,4}$/.test(admits))
		return null;
	return {
		code,
		visitDate: `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6)}`,
		admits: Number(admits),
		message: parts.slice(0, 4).join('.'),
		signature
	};
}

/** The string a ticket's QR carries, before signing. */
export const qrMessage = (t: { code: string; visitDate: string; admits: number }) =>
	`${QR_PREFIX}.${t.code}.${t.visitDate.replaceAll('-', '')}.${t.admits}`;

/**
 * The code in whatever a scanner or keyboard sent: a signed QR, a link ending in a code, or the
 * code typed by hand. Codes are upper case.
 */
export function ticketCodeOf(raw: string): string {
	const qr = parseTicketQr(raw);
	if (qr) return qr.code;
	return (
		raw
			.trim()
			.split(/[/?#=]/)
			.filter(Boolean)
			.at(-1)
			?.toUpperCase() ?? ''
	);
}

/**
 * A member's card QR (7.3): `KC1.<CARDCODE>`. Not signed: the card code is itself the secret, and
 * a scanner admits only cards on its downloaded members list.
 */
export const CARD_PREFIX = 'KC1';

export const memberCardQr = (cardCode: string) => `${CARD_PREFIX}.${cardCode}`;

/** The card code in a scanned member card QR, or null when it is not one. */
export function memberCardOf(raw: string): string | null {
	const [prefix, code, ...rest] = raw.trim().split('.');
	return prefix === CARD_PREFIX && !rest.length && /^[A-Z0-9]{4,16}$/.test(code ?? '')
		? code
		: null;
}

const fromBase64url = (s: string) => {
	const b64 = s.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (s.length % 4)) % 4);
	return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
};

/**
 * Loads the public key for `verifyTicketQr`. Null where the browser has no Ed25519 (older
 * Safari/Chrome): the scanner then trusts its downloaded list alone, which still catches made-up
 * codes but not an edited headcount.
 */
export async function importQrKey(publicKey: string): Promise<CryptoKey | null> {
	try {
		return await crypto.subtle.importKey(
			'raw',
			fromBase64url(publicKey),
			{ name: 'Ed25519' },
			false,
			['verify']
		);
	} catch {
		return null;
	}
}

/** True when the QR was signed by the server's key. */
export async function verifyTicketQr(qr: TicketQr, key: CryptoKey): Promise<boolean> {
	try {
		return await crypto.subtle.verify(
			{ name: 'Ed25519' },
			key,
			fromBase64url(qr.signature),
			new TextEncoder().encode(qr.message)
		);
	} catch {
		return false;
	}
}
