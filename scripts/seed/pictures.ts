/**
 * The public site's pictures: the museum design's photos (`static/`), copied into the upload store
 * (`FILES_DIR`) and set as if staff had uploaded them — each product's picture and gallery, each
 * experience's and each event's picture. So the shop, experiences and events read their pictures
 * from the database like any other upload, served at `/media/{name}`.
 *
 * Safe to run again on a seeded database (`tsx --env-file=.env scripts/seed/one.ts pictures`): it
 * copies the files over, and fills a picture or a gallery only where there is none, so nothing
 * staff uploaded is replaced.
 */
import { and, eq, isNull } from 'drizzle-orm';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { db, schema as s, L } from './db.ts';

const FILES_DIR = process.env.FILES_DIR ?? '.tempFiles';

type Picture = { src: string; alt: [string, string?] };

/** Each product's main picture first, then its gallery. The T-shirt has no photo in the design. */
const PICTURES: Record<string, Picture[]> = {
	'kebena-house-blend': [
		{ src: 'hero/bag-front.jpg', alt: ['A bag of Kebena House Blend', 'የቀበና ቤት ቅይጥ ከረጢት'] },
		{ src: 'journey/roasting.webp', alt: ['The beans in the roaster'] },
		{ src: 'journey/grinding.webp', alt: ['Roasted beans pounded in a wooden mortar'] },
		{ src: 'journey/cup.webp', alt: ['A cup poured from the jebena'] }
	],
	'washed-limu-gr1': [
		{ src: 'collection/washed-limmu.webp', alt: ['Washed Limu beans', 'የታጠበ ሊሙ ቡና'] },
		{ src: 'journey/harvest.webp', alt: ['Ripe cherries picked by hand'] },
		{ src: 'journey/drying.webp', alt: ['Coffee drying on raised beds'] }
	],
	'washed-gera-gr1': [
		{ src: 'collection/washed-gera.webp', alt: ['Washed Gera beans', 'የታጠበ ገራ ቡና'] },
		{ src: 'journey/sorting.webp', alt: ['Sorting the beans by hand'] },
		{ src: 'journey/drying.webp', alt: ['Coffee drying on raised beds'] }
	],
	'unwashed-djimmah-gr3': [
		{ src: 'collection/unwashed-djimmah.webp', alt: ['Unwashed Djimmah beans', 'ያልታጠበ ጅማ ቡና'] },
		{ src: 'journey/drying.webp', alt: ['Whole cherries drying in the sun'] }
	],
	'gera-anaerobic-reserve': [
		{ src: 'collection/washed-gera.webp', alt: ['Gera Anaerobic Reserve beans', 'ገራ ልዩ ክምችት ቡና'] },
		{ src: 'journey/harvest.webp', alt: ['Ripe cherries picked by hand'] },
		{ src: 'journey/roasting.webp', alt: ['The beans in the roaster'] }
	],
	'mana-natural': [
		{ src: 'journey/harvest.webp', alt: ['Ripe cherries for Mana Natural', 'ለማና ተፈጥሯዊ የበሰለ ቡና'] },
		{ src: 'journey/drying.webp', alt: ['Whole cherries drying in the sun'] }
	],
	'origins-discovery-set': [
		{
			src: 'collection/unwashed-nekemte.webp',
			alt: ['Beans from three of our origins', 'ከሦስት መነሻዎቻችን የመጣ ቡና']
		},
		{ src: 'collection/washed-limmu.webp', alt: ['Washed Limu'] },
		{ src: 'collection/washed-gera.webp', alt: ['Washed Gera'] },
		{ src: 'collection/unwashed-djimmah.webp', alt: ['Unwashed Djimmah'] }
	],
	'kebena-jebena-cup-set': [
		{ src: 'journey/jebena.webp', alt: ['Sini cups beside a jebena', 'ከጀበና አጠገብ ያሉ ሲኒዎች'] },
		{ src: 'journey/cup.webp', alt: ['Coffee poured from a jebena into a sini'] }
	]
};

/** Each experience's picture, by slug. */
const BOOKABLES: Record<string, string> = {
	'guided-tour': 'tour/hall.webp',
	'coffee-ceremony': 'journey/jebena.webp',
	'cupping-session': 'tour/tasting.webp',
	'private-event': 'tour/building.webp',
	'school-visit': 'tour/collection.webp',
	'roasting-class': 'tour/roast.webp'
};

/** Each event's picture, by slug. */
const EVENTS: Record<string, string> = {
	'birthplace-of-coffee-talk': 'tour/origin.webp',
	'ceremony-masterclass': 'halls/hall-03.webp',
	'cupping-evening-gera': 'farms/gera.webp',
	'members-limu-preview': 'collection/washed-limmu.webp',
	'timket-exhibition': 'tour/atrium.webp',
	'roasting-at-home': 'journey/roasting.webp'
};

/** The stored name for a design photo: one copy each, however many products use it. */
const storedName = (src: string) =>
	`seed-${src.replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/gi, '-')}${extname(src)}`;

function store(src: string) {
	const name = storedName(src);
	mkdirSync(FILES_DIR, { recursive: true });
	const from = join('static', src);
	if (!existsSync(from)) throw new Error(`Missing design photo ${from}`);
	copyFileSync(from, join(FILES_DIR, name));
	return name;
}

export async function seed() {
	let pictures = 0;
	let galleries = 0;
	for (const [slug, list] of Object.entries(PICTURES)) {
		const [p] = await db
			.select({ id: s.product.id, image: s.product.image })
			.from(s.product)
			.where(eq(s.product.slug, slug));
		if (!p) continue;
		const names = list.map((pic) => store(pic.src));

		if (!p.image) {
			await db
				.update(s.product)
				.set({ image: names[0] })
				.where(and(eq(s.product.id, p.id), isNull(s.product.image)));
			pictures++;
		}

		const gallery = await db
			.select({ id: s.productImage.id })
			.from(s.productImage)
			.where(eq(s.productImage.productId, p.id))
			.limit(1);
		if (!gallery.length && list.length > 1) {
			await db.insert(s.productImage).values(
				list.slice(1).map((pic, i) => ({
					productId: p.id,
					fileName: names[i + 1],
					alt: L(...pic.alt),
					sortOrder: i
				}))
			);
			galleries++;
		}
	}
	let experiences = 0;
	for (const [slug, src] of Object.entries(BOOKABLES)) {
		const [res] = await db
			.update(s.bookable)
			.set({ image: store(src) })
			.where(and(eq(s.bookable.slug, slug), isNull(s.bookable.image)));
		experiences += res.affectedRows;
	}
	let events = 0;
	for (const [slug, src] of Object.entries(EVENTS)) {
		const [res] = await db
			.update(s.event)
			.set({ image: store(src) })
			.where(and(eq(s.event.slug, slug), isNull(s.event.image)));
		events += res.affectedRows;
	}
	console.log(
		`Pictures: ${pictures} products (${galleries} galleries), ${experiences} experiences, ${events} events; files in ${FILES_DIR}`
	);
}
