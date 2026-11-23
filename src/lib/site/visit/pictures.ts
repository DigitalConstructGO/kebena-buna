import { publicFileUrl } from '@nahu/admin-kit/files';

/** A photo from the design's own set, for a bookable or event with none uploaded yet. */
const FALLBACK: Record<string, string> = {
	guided_tour: '/tour/hall.webp',
	ceremony: '/journey/jebena.webp',
	cupping: '/journey/cup.webp',
	group_visit: '/journey/roasting.webp',
	event: '/tour/atrium.webp'
};

/** The picture to show: the uploaded one (served from `/media`), else the kind's stand-in. */
export const pictureOf = (image: string | null | undefined, kind: string) =>
	image ? publicFileUrl(image) : (FALLBACK[kind] ?? '/tour/collection.webp');
