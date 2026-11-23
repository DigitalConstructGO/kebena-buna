import { ORIGIN, BETTER_AUTH_SECRET } from '$app/env/private';
import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { APIError } from 'better-auth/api';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { user } from '#lib/server/db/schema.ts';

/** What signing in to a switched-off account says; `/login` shows it as it is. */
export const SWITCHED_OFF = 'This account is switched off. Ask the Owner.';

export const auth = betterAuth({
	baseURL: ORIGIN,
	secret: BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: 'mysql' }),
	/**
	 * No sign-up here: staff accounts are made in Admin › Users (`addStaff`) and the seed, which
	 * write the rows themselves, and customers sign up through the storefront.
	 */
	emailAndPassword: { enabled: true, disableSignUp: true },
	/**
	 * This app's own `user` columns (`db/auth.schema.ts`). `input: false` on everything that decides
	 * access, so a sign-up can never make itself staff.
	 */
	user: {
		additionalFields: {
			kind: { type: 'string', required: false, defaultValue: 'customer', input: false },
			roleId: { type: 'number', required: false, input: false },
			isActive: { type: 'boolean', required: false, defaultValue: true, input: false },
			locale: { type: 'string', required: false, defaultValue: 'am' }
		}
	},
	databaseHooks: {
		session: {
			create: {
				/** A switched-off or deleted account cannot sign in, whatever its password. */
				before: async (session) => {
					const [row] = await db
						.select({ isActive: user.isActive })
						.from(user)
						.where(and(eq(user.id, session.userId), isNull(user.deletedAt)))
						.limit(1);
					if (!row?.isActive) throw new APIError('UNAUTHORIZED', { message: SWITCHED_OFF });
					return { data: session };
				}
			}
		}
	},
	plugins: [
		sveltekitCookies(getRequestEvent) // make sure this is the last plugin in the array
	]
});
