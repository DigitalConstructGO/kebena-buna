/** Audit actions borrow the status tones, so a delete reads red and a create green. */
export const ACTION_TONE: Record<string, string> = {
	create: 'approved',
	update: 'pending',
	delete: 'rejected',
	restore: 'approved',
	merge: 'pending'
};
