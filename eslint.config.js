import prettier from 'eslint-config-prettier';
import path from 'node:path';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig, includeIgnoreFile } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	ts.configs.recommendedTypeChecked,
	svelte.configs.recommended,
	prettier,
	svelte.configs.prettier,
	{
		languageOptions: {
			parserOptions: { projectService: true },
			globals: { ...globals.browser, ...globals.node }
		},
		rules: {
			// `{ id: _id, ...rest }` drops a field on purpose; `_x` names one left unused on purpose.
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					caughtErrorsIgnorePattern: '^_',
					ignoreRestSiblings: true
				}
			],
			// typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
			// see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
			'no-undef': 'off'
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser
			}
		}
	},
	{
		/*
		 * Routes and components lean on SvelteKit's zero-config types: `load`, `actions` and
		 * `$props()` carry no annotation, and svelte-check supplies their types. typescript-eslint
		 * cannot see those, reads every `event`, `params` and `data` as `any`, and flagged each use as
		 * unsafe — thousands of findings about types that are in fact checked. `npm run check` is
		 * what guards these files' types; `src/lib`, typed by hand, keeps the rules.
		 */
		files: ['src/routes/**', 'src/hooks.server.ts', '**/*.svelte'],
		rules: {
			'@typescript-eslint/no-unsafe-argument': 'off',
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-call': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
			'@typescript-eslint/no-unsafe-return': 'off',
			// The same blind spot: `typeof data.rows` reads as `any` here, so a union with it looks
			// redundant, and an assertion svelte-check needs (`slotEnd!`) looks unnecessary.
			'@typescript-eslint/no-redundant-type-constituents': 'off',
			'@typescript-eslint/no-unnecessary-type-assertion': 'off'
		}
	},
	{
		// Public links carry the language prefix (`localizeHref`, `siteHref`): `/am/shop` is no route
		// `resolve` can name, so they are written as paths.
		files: [
			'src/routes/(site)/**',
			'src/routes/(museum)/**',
			'src/lib/site/**',
			'src/lib/components/museum/**'
		],
		rules: { 'svelte/no-navigation-without-resolve': 'off' }
	},
	{
		// The production entry point imports `build/handler.js`, which exists only after a build and is
		// kept out of the type check (it would drag the whole bundle in), so it is linted untyped.
		files: ['server.js'],
		...ts.configs.disableTypeChecked
	}
);
