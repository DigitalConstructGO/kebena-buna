import { locales } from '#lib/paraglide/runtime.js';

/**
 * A picture staff can swap from Website › Site text: the message holds the picture's address, so
 * one uploaded to the media library can be pasted in its place. A picture has no translation, so
 * the English entry is read whatever the reader's language; if that one was left as shipped, an
 * address pasted into another language's box is taken instead. Only an address on this site or a
 * full https one is taken; anything else falls back to the picture the design shipped with.
 */
export function picture(message: Message, fallback: string): string {
	for (const locale of locales) {
		const src = address(message({}, { locale }));
		if (src && src !== fallback) return src;
	}
	return fallback;
}

/**
 * The address as the public site can show it, or nothing if it cannot. A backslash is refused along
 * with the double slash: browsers read `/\host` as another site. The staff-only copy of an upload
 * (`/dashboard/files/…`, what the media library used to hand out) becomes its public one; nothing
 * else under `/dashboard/` is ever public.
 */
function address(value: string): string | undefined {
	const src = value.trim().replace(/^\/dashboard\/files\//, '/media/');
	if (!/^(\/(?!\/)|https:\/\/)\S+$/.test(src) || src.includes('\\')) return;
	if (src.startsWith('/dashboard/')) return;
	return src;
}

/** Any of the site's messages that takes no inputs. */
type Message = (
	inputs: Record<string, never>,
	options: { locale: (typeof locales)[number] }
) => string;
