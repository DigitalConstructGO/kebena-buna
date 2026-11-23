/**
 * Background jobs, run inside the app server on timers (started by `init` in `hooks.server.ts`).
 * Each job is safe on more than one server at once: the sender claims each message by a
 * conditional update, the hold release re-checks every booking and order under its row lock, and every
 * reminder or alert has a dedupe key, so a second server queues nothing twice.
 *
 * `JOBS_ENABLED=false` keeps a server out of it (a second instance, a one-off script).
 */
import { JOBS_ENABLED } from '$app/env/private';
import { sendDueMessages } from './sendMessages.ts';
import { releaseExpiredHolds } from './releaseHolds.ts';
import { expireUnpaidTicketOrders } from './expireTicketOrders.ts';
import { dailySalesAlert, lowStockAlert, staleInboxAlert } from './staffAlerts.ts';
import {
	ageMemberships,
	invoiceReminders,
	markOverdueInvoices,
	membershipReminders,
	subscriptionTopUps
} from './reminders.ts';

type Job = { name: string; everySeconds: number; run: () => Promise<number> };

/** Steps run one after the other in one job; it reports what they did together. */
const steps =
	(...run: (() => Promise<number>)[]) =>
	async () => {
		let n = 0;
		for (const step of run) n += await step();
		return n;
	};

/**
 * The daily ones run every ten minutes and act once their local hour has come; each message has a
 * dedupe key per day or per reminder, so a rerun sends nothing new.
 */
const JOBS: Job[] = [
	{ name: 'messages', everySeconds: 30, run: sendDueMessages },
	{ name: 'holds', everySeconds: 300, run: steps(releaseExpiredHolds, expireUnpaidTicketOrders) },
	{ name: 'memberships', everySeconds: 600, run: steps(ageMemberships, membershipReminders) },
	{ name: 'subscriptions', everySeconds: 600, run: subscriptionTopUps },
	{ name: 'invoices', everySeconds: 600, run: steps(markOverdueInvoices, invoiceReminders) },
	{ name: 'staff alerts', everySeconds: 600, run: steps(lowStockAlert, dailySalesAlert, staleInboxAlert) }
];

/** Started once per process, even when the dev server reloads this module. */
const started = globalThis as typeof globalThis & { __kebenaJobs?: boolean };

export function startJobs() {
	if (!JOBS_ENABLED || started.__kebenaJobs) return;
	started.__kebenaJobs = true;
	for (const job of JOBS) schedule(job);
	console.log(`[jobs] started: ${JOBS.map((j) => j.name).join(', ')}`);
}

/** Runs a job, then waits its interval before the next run, so runs never overlap. */
function schedule(job: Job) {
	const tick = async () => {
		try {
			const n = await job.run();
			if (n) console.log(`[jobs] ${job.name}: ${n}`);
		} catch (err) {
			console.error(`[jobs] ${job.name} failed:`, err);
		} finally {
			setTimeout(() => void tick(), job.everySeconds * 1000).unref();
		}
	};
	setTimeout(() => void tick(), 5_000).unref();
}
