/**
 * Renders the small Markdown subset the site assistant is asked to write — paragraphs, bullet
 * and numbered lists, **bold**, *italic* and links — to HTML. Everything else is escaped, so the
 * output is safe for `{@html}` whatever the model sends.
 */

const escape = (s: string) =>
	s.replace(
		/[&<>"']/g,
		(c) => `&${{ '&': 'amp', '<': 'lt', '>': 'gt', '"': 'quot', "'": '#39' }[c]};`
	);

/** Site paths, mail, phone and https — never `javascript:`, `data:` or protocol-relative URLs. */
function safeHref(href: string): string | undefined {
	if (/^\/(?!\/)/.test(href)) return href;
	if (/^(mailto|tel):[^\s]+$/i.test(href)) return href;
	if (/^https:\/\/[^\s]+$/i.test(href)) return href;
}

/** Rewrites a link to a page of this site, e.g. to add the reader's language prefix. */
type Localize = (path: string) => string;

function inline(text: string, localize?: Localize): string {
	const links: string[] = [];
	// pull links out first so their URLs are not touched by the emphasis rules
	let out = text.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (_, label: string, href: string) => {
		let safe = safeHref(href);
		if (safe?.startsWith('/') && localize) safe = localize(safe);
		const html = safe
			? `<a href="${escape(safe)}"${safe.startsWith('https:') ? ' target="_blank" rel="noopener noreferrer"' : ''}>${escape(label)}</a>`
			: escape(label);
		links.push(html);
		return `\uE000${links.length - 1}\uE000`;
	});
	out = escape(out)
		.replace(/\*\*(?=\S)([^*]+?)\*\*/g, '<strong>$1</strong>')
		.replace(/(^|[^*\w])[*_](?=\S)([^*_\n]+?)[*_](?![*\w])/g, '$1<em>$2</em>');
	return out.replace(/\uE000(\d+)\uE000/g, (_, i: string) => links[Number(i)]);
}

export function renderMarkdown(source: string, localize?: Localize): string {
	const blocks: string[] = [];
	let list: { tag: 'ul' | 'ol'; items: string[] } | undefined;
	let para: string[] = [];

	const flushPara = () => {
		if (para.length) blocks.push(`<p>${para.map((l) => inline(l, localize)).join('<br>')}</p>`);
		para = [];
	};
	const flushList = () => {
		if (list)
			blocks.push(
				`<${list.tag}>${list.items.map((i) => `<li>${inline(i, localize)}</li>`).join('')}</${list.tag}>`
			);
		list = undefined;
	};

	for (const raw of source.replace(/\r\n?/g, '\n').split('\n')) {
		const line = raw.trim();
		const bullet = /^[-*•]\s+(.*)$/.exec(line);
		const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
		if (bullet || numbered) {
			flushPara();
			const tag = bullet ? 'ul' : 'ol';
			if (list?.tag !== tag) flushList();
			list ??= { tag, items: [] };
			list.items.push((bullet ?? numbered)![1]);
		} else if (!line) {
			flushPara();
			flushList();
		} else {
			flushList();
			// headings are not wanted in a chat bubble; keep their words as a bold line
			const heading = /^#{1,6}\s+(.*)$/.exec(line);
			para.push(heading ? `**${heading[1]}**` : line);
		}
	}
	flushPara();
	flushList();
	return blocks.join('');
}
