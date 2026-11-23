import { paraglideVitePlugin } from '@inlang/paraglide-js';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { adminKit } from '@nahu/admin-kit/vite';

export default defineConfig({
	// gsap's plugin entry points don't load as plain Node ESM; bundle it into the server build
	ssr: { noExternal: ['gsap'] },
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter()
		}),

		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
			emitTsDeclarations: true,
			// The public site keeps its language in the URL (/am/history), so each language's pages
			// can be prerendered. Staff pages have no prefix and keep the language their user chose.
			strategy: ['url', 'cookie', 'baseLocale'],
			routeStrategies: [
				{ match: '/dashboard/:path(.*)?', strategy: ['cookie', 'baseLocale'] },
				{ match: '/login', strategy: ['cookie', 'baseLocale'] },
				{ match: '/logout', strategy: ['cookie', 'baseLocale'] },
				{ match: '/api/:path(.*)?', exclude: true },
				{ match: '/media/:path(.*)?', exclude: true }
			]
		}),
		adminKit()
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},

			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
