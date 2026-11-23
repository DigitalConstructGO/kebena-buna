import { requirePermission } from '@nahu/admin-kit/server/permissions';
import { scannerDay } from '#lib/server/scanner.ts';
import { ticketQrPublicKey } from '#lib/server/ticketQr.ts';

/**
 * The gate scanner: the camera reads a ticket's QR, checks its signature with the public key and
 * admits from today's list, all on the device, so the gate keeps working when the network drops.
 */
export const load = async ({ locals }) => {
	requirePermission(locals, 'visits.view');
	return { ...(await scannerDay()), publicKey: ticketQrPublicKey() };
};
