import { building } from '$app/env';
import { and, eq, isNull } from 'drizzle-orm';
import { auth } from '#lib/server/auth.ts';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { type Handle, type ServerInit, sequence } from '@sveltejs/kit/hooks';
import { getTextDirection } from '#lib/paraglide/runtime.js';
import { paraglideMiddleware } from '#lib/paraglide/server.js';
import { configureKit } from '@nahu/admin-kit/server/db';
import { db } from '#lib/server/db/index.ts';
import { auditLog, user } from '#lib/server/db/schema.ts';
import { kitHandle } from '@nahu/admin-kit/server/hooks';
import { access } from '#lib/access.ts';
import { loadGrant, syncAccessTables } from '#lib/server/permissions.ts';
import { startJobs } from '#lib/server/jobs/index.ts';
import { siteTextEdits } from '#lib/server/siteText.ts';
import { setSiteText } from '#lib/i18n.ts';

/** The outbox sender and the hold release run alongside the app (`#lib/server/jobs`). */
export const init: ServerInit = () => {
	if (!building) startJobs();
};

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
 * better-auth's HTTP API is closed: nothing here calls it from the browser. Signing in, out and
 * changing a password are form actions (`/kc-login`, `/logout`, Account) that call `auth.api`
 * on the server, behind this app's own limits. Left open, `/api/auth/sign-in/email` would be a
 * second door with only better-auth's looser limiter, and the rest (sign-up, update-user,
 * reset-password, list-sessions…) would be surface nobody uses.
 */
const handleClosed: Handle = ({ event, resolve }) => {
	const path = event.url.pathname;
	if (path === '/api/auth' || path.startsWith('/api/auth/')) {
		return new Response('Not found', { status: 404 });
	}
	return resolve(event);
};

/**
 * Headers every page and endpoint carries. No full CSP yet (the hero's inline styles and WebGL
 * would need auditing first), but the directives that cannot break anything are set: nobody may
 * frame the site (clickjacking on the dashboard), `<base>` and plugins are off.
 */
const SECURITY_HEADERS: Record<string, string> = {
	'x-content-type-options': 'nosniff',
	'x-frame-options': 'SAMEORIGIN',
	'referrer-policy': 'strict-origin-when-cross-origin',
	'content-security-policy': "frame-ancestors 'self'; base-uri 'self'; object-src 'none'",
	// The gate scanner needs the camera; nothing needs the rest.
	'permissions-policy': 'camera=(self), microphone=(), geolocation=(), payment=(), usb=()',
	'cross-origin-opener-policy': 'same-origin'
};

/** Staff pages are kept out of search results without naming them in robots.txt. */
const PRIVATE_PATH = /^\/(dashboard|kc-login|logout)(\/|$)/;

const handleHeaders: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	const set = (name: string, value: string) => {
		// A redirect from `fetch` or a static file can come back immutable; skip it rather than throw.
		try {
			if (!response.headers.has(name)) response.headers.set(name, value);
		} catch {
			/* immutable headers */
		}
	};
	for (const [name, value] of Object.entries(SECURITY_HEADERS)) set(name, value);
	if (event.url.protocol === 'https:') {
		set('strict-transport-security', 'max-age=31536000; includeSubDomains');
	}
	if (PRIVATE_PATH.test(event.url.pathname)) set('x-robots-tag', 'noindex, nofollow');
	return response;
};

/** Only a live staff account keeps a session; customers never sign in (see `auth.ts`). */
async function stillLive(userId: string) {
	const [row] = await db
		.select({ isActive: user.isActive })
		.from(user)
		.where(and(eq(user.id, userId), eq(user.kind, 'staff'), isNull(user.deletedAt)))
		.limit(1);
	return Boolean(row?.isActive);
}

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	await syncOnce();
	const session = await auth.api.getSession({ headers: event.request.headers });

	// A session that outlived its account (switched off, deleted, or not staff) counts as signed out.
	if (session && (await stillLive(session.user.id))) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

configureKit({ db, auditLog, loginPath: '/kc-login' });

/** Staff permissions come from their role (`loadGrant`); customers hold none. */
const handleKit = kitHandle({
	access,
	permissions: (event) =>
		event.locals.user ? loadGrant(event.locals.user.id) : { permList: [], isSuperAdmin: false }
});

/** The dashboard's edits to the site's words, in force for this request's messages. */
const handleSiteText: Handle = async ({ event, resolve }) => {
	setSiteText(await siteTextEdits());
	return resolve(event);
};

export const handle: Handle = sequence(
	handleHeaders,
	handleParaglide,
	handleSiteText,
	handleClosed,
	handleBetterAuth,
	handleKit
);
