import { afterEach, describe, expect, it } from 'vitest';
import { m as compiled } from '#lib/paraglide/messages.js';
import { fill, m, setSiteText } from './i18n.ts';

afterEach(() => setSiteText({}));

describe('site text edits', () => {
	it('serves the written message when nothing is edited', () => {
		expect(m.site_nav_shop({}, { locale: 'en' })).toBe(
			compiled.site_nav_shop({}, { locale: 'en' })
		);
	});

	it('serves an edit in its own language only', () => {
		setSiteText({ site_nav_shop: { en: 'Store' } });
		expect(m.site_nav_shop({}, { locale: 'en' })).toBe('Store');
		expect(m.site_nav_shop({}, { locale: 'fr' })).toBe(
			compiled.site_nav_shop({}, { locale: 'fr' })
		);
	});

	it('fills parameters in an edit', () => {
		setSiteText({ site_language_label: { en: 'Reading in {language}' } });
		expect(m.site_language_label({ language: 'English' }, { locale: 'en' })).toBe(
			'Reading in English'
		);
	});
});

describe('fill', () => {
	it('leaves an unknown name as written', () => {
		expect(fill('{a} and {b}', { a: 1 })).toBe('1 and {b}');
	});
});
