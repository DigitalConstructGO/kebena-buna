import { describe, it, expect } from 'vitest';
import { renderMarkdown } from './markdown.ts';

describe('renderMarkdown', () => {
	it('renders paragraphs, emphasis and lists', () => {
		expect(renderMarkdown('Try **Thur Azo** for *teff*.\n\n- one\n- two\n\n1. first')).toBe(
			'<p>Try <strong>Thur Azo</strong> for <em>teff</em>.</p><ul><li>one</li><li>two</li></ul><ol><li>first</li></ol>'
		);
	});

	it('keeps site, mail, phone and https links', () => {
		const html = renderMarkdown(
			'[Products](/products) [mail](mailto:info@thurbiotech.com) [call](tel:+251116660964) [in](https://www.linkedin.com/company/thurbiotech/)'
		);
		expect(html).toContain('<a href="/products">Products</a>');
		expect(html).toContain('<a href="mailto:info@thurbiotech.com">mail</a>');
		expect(html).toContain('<a href="tel:+251116660964">call</a>');
		expect(html).toContain('target="_blank" rel="noopener noreferrer">in</a>');
	});

	it('drops unsafe links and escapes HTML', () => {
		const html = renderMarkdown(
			'[x](javascript:alert(1)) [y](//evil.example) <img src=x onerror=alert(1)> [z](/a"onmouseover="b)'
		);
		expect(html).not.toContain('<img');
		expect(html).not.toContain('javascript:');
		expect(html).not.toContain('href="//');
		expect(html).not.toContain('"onmouseover');
		expect(html).toContain('&lt;img');
	});

	it('does not italicise snake_case or multiplication', () => {
		expect(renderMarkdown('2×10⁸ CFU/g, a_b_c, 3 * 4 * 5')).toBe(
			'<p>2×10⁸ CFU/g, a_b_c, 3 * 4 * 5</p>'
		);
	});
});
