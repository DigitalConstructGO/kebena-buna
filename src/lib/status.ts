/**
 * Every domain status, mapped onto the kit's badge colours.
 *
 * The kit's `Statuses` colours a value from a fixed vocabulary; many of this app's words are not
 * in it (`roasting`, `out_for_delivery`, `grace`). Each status here names its tone, and the badge
 * shows the humanized word: `<Statuses {...badge(value)} />`, or `status()` in `#lib/cells`.
 */
import { humanize } from '#lib/format.ts';

type Tone = 'success' | 'danger' | 'warning' | 'info' | 'neutral';

/** A word the kit already colours in each tone. */
const TONE_WORD: Record<Tone, string> = {
	success: 'active',
	danger: 'inactive',
	warning: 'pending',
	info: 'ready',
	neutral: 'neutral'
};

const TONES: Record<string, Tone> = {
	// generic
	active: 'success',
	inactive: 'neutral',
	draft: 'neutral',
	published: 'success',
	archived: 'neutral',
	pending: 'warning',
	approved: 'success',
	rejected: 'danger',
	// orders
	pending_payment: 'warning',
	paid: 'success',
	roasting: 'info',
	packed: 'info',
	out_for_delivery: 'info',
	delivered: 'success',
	ready_for_pickup: 'info',
	collected: 'success',
	completed: 'success',
	cancelled: 'danger',
	unpaid: 'warning',
	partially_refunded: 'warning',
	refunded: 'neutral',
	failed: 'danger',
	// payments, refunds, invoices
	initiated: 'warning',
	succeeded: 'success',
	expired: 'neutral',
	requested: 'warning',
	processing: 'info',
	open: 'info',
	overdue: 'danger',
	void: 'neutral',
	// tickets and scans
	valid: 'success',
	used: 'neutral',
	admitted: 'success',
	re_entry: 'info',
	wrong_date: 'warning',
	unknown: 'danger',
	over_headcount: 'warning',
	duplicate_offline: 'warning',
	wrong_location: 'warning',
	card_refused: 'danger',
	// memberships and subscriptions
	grace: 'warning',
	lapsed: 'danger',
	paused: 'warning',
	scheduled: 'info',
	skipped: 'neutral',
	ordered: 'info',
	// workflow
	new: 'info',
	in_progress: 'warning',
	confirmed: 'success',
	done: 'success',
	declined: 'danger',
	// messages
	queued: 'warning',
	sending: 'info',
	sent: 'success'
};

/** Props for the kit's `Statuses` badge: the colour from the tone, the words from the value. */
export function badge(value: string | null | undefined, label?: string) {
	if (!value) return { status: 'neutral', label: label ?? '—' };
	const tone = TONES[value] ?? 'neutral';
	return { status: TONE_WORD[tone], label: label ?? humanize(value) };
}

/** A boolean flag as a badge: "Active" / "Inactive" unless told otherwise. */
export function flag(on: boolean | null | undefined, yes = 'Active', no = 'Inactive') {
	return { status: on ? 'active' : 'neutral', label: on ? yes : no };
}
