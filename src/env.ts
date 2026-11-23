import { defineEnvVars } from '@sveltejs/kit/env';

/** An optional variable: unset or blank reads as `undefined`. */
const optional = (value: string | undefined) => (value?.trim() ? value.trim() : undefined);

export const variables = defineEnvVars({
	DATABASE_URL: { description: 'The database connection string.' },
	ORIGIN: {
		description: 'The app origin (base URL), e.g. `http://localhost:5173`.'
	},
	BETTER_AUTH_SECRET: {
		description:
			'Secret used to sign tokens. For production use 32 characters generated with high entropy. See [Better Auth installation](https://www.better-auth.com/docs/installation).'
	},
	SMS_KEY: {
		schema: optional,
		description: 'GeezSMS API key. Unset: text messages fail with a reason and wait for a retry.'
	},
	SMTP_URL: {
		schema: optional,
		description: 'Mail server, e.g. `smtps://user:pass@mail.example.com:465`. Unset: emails fail with a reason.'
	},
	SMTP_FROM: {
		schema: optional,
		description: 'The From of every email, e.g. `Kebena Coffee <hello@kebena.coffee>`.'
	},
	NOTIFY_DRY_RUN: {
		schema: (value) => (value === 'true' ? true : value === 'false' ? false : undefined),
		description:
			'`true`: messages are rendered and marked sent without reaching any provider. Unset: on in the dev server (the seed holds made-up numbers), off otherwise.'
	},
	TICKET_QR_SECRET: {
		schema: optional,
		description:
			'Seed of the key that signs ticket QR codes (any long random string). Changing it voids every QR already issued. Unset: derived from `BETTER_AUTH_SECRET`.'
	},
	CHAPA_SECRET_KEY: {
		schema: optional,
		description: 'Chapa secret key. Unset: web orders wait for staff to take payment, and no "Pay now" button is shown.'
	},
	CHAPA_WEBHOOK_SECRET: {
		schema: optional,
		description: 'Signs Chapa webhooks to `/api/payments/chapa`. Unset: webhooks are accepted, then verified with Chapa anyway.'
	},
	JOBS_ENABLED: {
		schema: (value) => value !== 'false',
		description: '`false`: this server runs no background jobs (the sender, hold release). On by default.'
	}
});
