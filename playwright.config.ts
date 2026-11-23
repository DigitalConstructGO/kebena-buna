import { defineConfig } from '@playwright/test';

/**
 * End-to-end tests run against a build of the app on the local database, with the seed loaded
 * (`npm run db:seed`): they use its products, discount codes and bank accounts.
 *
 * Background jobs are off and messages are dry runs, so a test never sends a text or an email.
 * `E2E_BASE_URL` points them at a server already running instead (`vite dev`), and staff steps
 * run only with `E2E_STAFF_EMAIL` and `E2E_STAFF_PASSWORD` set.
 */
export default defineConfig({
	testMatch: '**/*.e2e.{ts,js}',
	use: { baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:4173' },
	webServer: process.env.E2E_BASE_URL
		? undefined
		: {
				command: 'npm run build && npm run preview',
				port: 4173,
				reuseExistingServer: true,
				timeout: 300_000,
				env: { JOBS_ENABLED: 'false', NOTIFY_DRY_RUN: 'true' }
			}
});
