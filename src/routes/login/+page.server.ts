import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { redirect } from 'sveltekit-flash-message/server';
import { redirect as plainRedirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { takeToken } from '@nahu/admin-kit/server/rateLimit';
import { auth, SWITCHED_OFF } from '#lib/server/auth.ts';
import { loginSchema } from '#lib/schemas/auth.ts';

/**
 * Where to go after signing in: a path on this site, or the dashboard. Resolved the way the
 * browser will resolve it, so tricks a pattern misses (`/\t/evil.com`, which loses its tab and
 * becomes `//evil.com`) land on another origin and are turned down.
 */
function afterSignIn(url: URL) {
	const to = url.searchParams.get('redirectTo');
	if (!to?.startsWith('/')) return '/dashboard';
	try {
		const target = new URL(to, url);
		if (target.origin !== url.origin || target.pathname.startsWith('//')) return '/dashboard';
		return target.pathname + target.search;
	} catch {
		return '/dashboard';
	}
}

export const load = async ({ locals }) => {
	if (locals.user) plainRedirect(302, '/dashboard');
	return { form: await superValidate(zod4(loginSchema)) };
};

export const actions = {
	default: async (event) => {
		const form = await superValidate(event.request, zod4(loginSchema));
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });

		// Signing in on the server skips better-auth's own limiter, so guesses are limited here: per
		// address, and per account so spreading them over many addresses does not help either.
		const email = form.data.email.trim().toLowerCase();
		if (
			!takeToken(`login:ip:${event.getClientAddress()}`, { capacity: 10, perMinute: 2 }) ||
			!takeToken(`login:email:${email}`, { capacity: 5, perMinute: 1 })
		) {
			return message(
				form,
				{ type: 'error', text: 'Too many attempts. Wait a minute.' },
				{ status: 429 }
			);
		}

		try {
			await auth.api.signInEmail({
				body: { email, password: form.data.password },
				headers: event.request.headers
			});
		} catch (err) {
			// The same words for an unknown email and a wrong password, so the form cannot be used to
			// find out who has an account. A switched-off account (right password) says so.
			const text =
				err instanceof APIError && err.message === SWITCHED_OFF
					? SWITCHED_OFF
					: 'Wrong email or password.';
			return message(form, { type: 'error', text }, { status: 401 });
		}

		redirect(afterSignIn(event.url), { type: 'success', message: 'Signed in' }, event.cookies);
	}
};
