import { building } from '$app/env';
import { and, eq, isNull } from 'drizzle-orm';
import { auth } from '#lib/server/auth.ts';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { type Handle, type ServerInit, sequence } from '@sveltejs/kit/hooks';
import { defineCustomServerStrategy, getTextDirection } from '#lib/paraglide/runtime.js';
import { paraglideMiddleware } from '#lib/paraglide/server.js';
import { configureKit } from '@nahu/admin-kit/server/db';
import { db } from '#lib/server/db/index.ts';
import { auditLog, user } from '#lib/server/db/schema.ts';
import { kitHandle } from '@nahu/admin-kit/server/hooks';
import { access } from '#lib/access.ts';
import { loadGrant, syncAccessTables } from '#lib/server/permissions.ts';
import { startJobs } from '#lib/server/jobs/index.ts';
import { addressLocale } from '#lib/site/locale.ts';

/** The outbox sender and the hold release run alongside the app (`#lib/server/jobs`). */
export const init: ServerInit = () => {
	if (!building) startJobs();
};

// Site pages take their language from the address (`/am/shop`); see `#lib/site/locale`.
defineCustomServerStrategy('custom-prefix', {
	getLocale: (request) => (request ? addressLocale(new URL(request.url).pathname) : undefined)
});

const handleParaglide: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request, locale }) => {
		return resolve(
			{ ...event, request },
			{
				transformPageChunk: ({ html }) =>
					html
						.replace('%paraglide.lang%', locale)
						.replace('%paraglide.dir%', getTextDirection(locale))
			}
		);
	});

/** Brings `permissions` and the default roles up to the code, once per boot. Logged, never fatal. */
let accessSync: Promise<void> | undefined;
function syncOnce() {
	if (building) return Promise.resolve();
	accessSync ??= syncAccessTables()
		.then((r) => {
			if (r.permissions) console.log(`[access] added ${r.permissions} permission(s)`);
			if (r.roles) console.log(`[access] created ${r.roles} role(s)`);
		})
		.catch((err: unknown) => {
			console.error('[access] sync failed:', err);
			accessSync = undefined;
		});
	return accessSync;
}

/**
 * Sign-up is closed over HTTP: customers sign up through the storefront's own flow, and staff
 * accounts are made in Admin › Users. `update-user` would let anyone change their own fields.
 */
const handleClosed: Handle = ({ event, resolve }) => {
	const path = event.url.pathname;
	if (path.startsWith('/api/auth/sign-up') || path.startsWith('/api/auth/update-user')) {
		return new Response('Not found', { status: 404 });
	}
	return resolve(event);
};

async function stillLive(userId: string) {
	const [row] = await db
		.select({ isActive: user.isActive })
		.from(user)
		.where(and(eq(user.id, userId), isNull(user.deletedAt)))
		.limit(1);
	return Boolean(row?.isActive);
}

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	await syncOnce();
	const session = await auth.api.getSession({ headers: event.request.headers });

	// A session that outlived its account (switched off or deleted since) counts as signed out.
	if (session && (await stillLive(session.user.id))) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

configureKit({ db, auditLog, loginPath: '/login' });

/** Staff permissions come from their role (`loadGrant`); customers hold none. */
const handleKit = kitHandle({
	access,
	permissions: (event) =>
		event.locals.user ? loadGrant(event.locals.user.id) : { permList: [], isSuperAdmin: false }
});

export const handle: Handle = sequence(handleParaglide, handleClosed, handleBetterAuth, handleKit);
