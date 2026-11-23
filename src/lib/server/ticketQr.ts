/**
 * The ticket QR, server half: the signing key, signed QR strings, the QR picture, and new ticket
 * codes. The format and the offline check are in `#lib/ticketQr`.
 *
 * The key is Ed25519, made from `TICKET_QR_SECRET` (or `BETTER_AUTH_SECRET`), so every server
 * instance signs alike with nothing extra to store. Scanners get only the public key.
 */
import { createHash, createPrivateKey, createPublicKey, randomInt, sign, verify, type KeyObject } from 'node:crypto';
import QRCode from 'qrcode';
import { BETTER_AUTH_SECRET, TICKET_QR_SECRET } from '$app/env/private';
import { parseTicketQr, qrMessage } from '#lib/ticketQr.ts';

/** PKCS#8 wrapping of a raw 32-byte Ed25519 seed (RFC 8410). */
const PKCS8_ED25519 = Buffer.from('302e020100300506032b657004220420', 'hex');

let keys: { privateKey: KeyObject; publicKey: KeyObject; publicRaw: string } | null = null;
function keyPair() {
	if (keys) return keys;
	const secret = TICKET_QR_SECRET ?? BETTER_AUTH_SECRET;
	if (!secret) throw new Error('Set TICKET_QR_SECRET (or BETTER_AUTH_SECRET) to sign ticket QR codes.');
	const seed = createHash('sha256').update(`kebena-ticket-qr:${secret}`).digest();
	const privateKey = createPrivateKey({ key: Buffer.concat([PKCS8_ED25519, seed]), format: 'der', type: 'pkcs8' });
	const publicKey = createPublicKey(privateKey);
	// The SPKI encoding ends with the 32-byte raw key, which is what WebCrypto imports.
	const publicRaw = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('base64url');
	keys = { privateKey, publicKey, publicRaw };
	return keys;
}

/** The scanner's key: raw Ed25519, base64url. Safe to hand to any device. */
export const ticketQrPublicKey = () => keyPair().publicRaw;

/** The string a ticket's QR carries: `KT1.CODE.YYYYMMDD.ADMITS.SIGNATURE`. */
export function signTicketQr(t: { code: string; visitDate: string; admits: number }) {
	const message = qrMessage(t);
	const signature = sign(null, Buffer.from(message), keyPair().privateKey).toString('base64url');
	return `${message}.${signature}`;
}

/** The ticket a QR string names, when its signature is ours. */
export function readTicketQr(raw: string) {
	const qr = parseTicketQr(raw);
	if (!qr) return null;
	const ok = verify(null, Buffer.from(qr.message), keyPair().publicKey, Buffer.from(qr.signature, 'base64url'));
	return ok ? qr : null;
}

/**
 * A QR picture as inline SVG, sized by its container. Error correction M: still reads from a
 * cracked phone screen or a creased print, and keeps the signed string to a small grid.
 */
export function qrSvg(text: string) {
	return QRCode.toString(text, { type: 'svg', errorCorrectionLevel: 'M', margin: 2, color: { dark: '#19211b', light: '#ffffff' } });
}

/** Unambiguous letters and digits (no 0/O, 1/I/L): codes get read out and typed at the desk. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** A new ticket code. Ten characters of 31: collisions are left to the unique index to refuse. */
export function newTicketCode(length = 10) {
	let code = '';
	for (let i = 0; i < length; i++) code += ALPHABET[randomInt(ALPHABET.length)];
	return code;
}

/** A ticket's QR, ready for a page: the signed string and its picture. */
export async function ticketQr(t: { code: string; visitDate: string; admits: number }) {
	const value = signTicketQr(t);
	return { value, svg: await qrSvg(value) };
}
