/**
 * A picture staff can swap from Website › Site text: the message holds the picture's address, so
 * one uploaded to the media library can be pasted in its place. Read from the English entry
 * whatever the reader's language (a picture has no translation), and only an address on this site
 * or a full https one is taken; anything else falls back to the picture the design shipped with.
 */
export function picture(message: Message, fallback: string): string {
	const src = message({}, { locale: 'en' }).trim();
	return /^(\/(?!\/)|https:\/\/)\S+$/.test(src) ? src : fallback;
}

/** Any of the site's messages that takes no inputs. */
type Message = (inputs: Record<string, never>, options: { locale: 'en' }) => string;
