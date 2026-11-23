/**
 * Copy and data for the museum home page. The components render whatever
 * is passed in here, so the same shapes carry the real copy and the dev-only
 * stress fixtures (?data=worst | empty | one).
 */

export type Fact = {
	/** Counted up on scroll. */
	value: number;
	/** Rendered straight after the number, e.g. "+ years" or " estates". */
	suffix: string;
	note?: string;
};

export type EntranceContent = {
	eyebrow: string;
	title: string;
	body: string[];
	photo: { src: string; alt: string; width: number; height: number };
	/** A tiny, pre-blurred copy of the photo, stretched behind the whole entrance. */
	backdrop?: string;
	facts: Fact[];
};

export type Hall = {
	id: string;
	title: string;
	text: string;
	/** Short line under the title in the navigator pill. */
	tagline: string;
	href: string;
	photo: string;
};

export type HallsContent = {
	eyebrow: string;
	title: string;
	intro: string;
	halls: Hall[];
};

export type JourneyStep = {
	id: string;
	/** The title is split in two so the end of it can carry the accent colour. */
	title: string;
	accent: string;
	text: string;
	photo: { src: string; alt: string };
	/** Starts a new act of the journey, with this as its heading. */
	act?: string;
	/** A larger card for the steps the eye should rest on. */
	wide?: boolean;
};

/** After the hero's growing stages: the work from picking to the poured cup. */
export type JourneyContent = {
	eyebrow: string;
	title: string;
	accent: string;
	steps: JourneyStep[];
	/** The line under the cup that fills at the end. */
	end: string;
	/** Where the reader goes once the cup is full. */
	next?: { label: string; href: string };
};

export type Photo = { src: string; alt: string };
export type MetaItem = { label: string; value: string };

export type Farm = {
	id: string;
	title: string;
	text: string;
	photo: Photo;
	meta: MetaItem[];
	/** Small category line above the title, e.g. "Estate" or "Washing stations". */
	kind?: string;
	/** Extra photos for the turning ribbon; the main photo comes first. */
	gallery?: Photo[];
};
export type FarmsContent = { eyebrow: string; title: string; intro: string; farms: Farm[] };

export type ProcessStep = {
	id: string;
	title: string;
	text: string;
	photo: Photo;
	/** Bean moisture at this step, in percent (approximate). */
	moisture?: number;
	/** A word that flashes over the stage as this step arrives, e.g. "Hulled". */
	moment?: string;
};
export type ProcessContent = {
	eyebrow: string;
	title: string;
	intro: string;
	readoutLabel?: string;
	steps: ProcessStep[];
};

export type Lot = { id: string; title: string; photo: Photo; specs: MetaItem[] };
export type CollectionContent = {
	eyebrow: string;
	title: string;
	tags: { label: string; tone: 'leaf' | 'sage' | 'lime' }[];
	cta: { label: string; href: string };
	lots: Lot[];
};

export type Origin = {
	id: string;
	name: string;
	lat: number;
	lon: number;
	text: string;
	/** Growing altitude in metres above sea level, low to high (approximate). */
	altitude?: [number, number];
	/** Main harvest months, 1 = January. */
	harvest?: number[];
};
export type AtlasContent = { eyebrow: string; title: string; origins: Origin[] };

export type PeopleContent = {
	eyebrow: string;
	lead: { value: number; suffix: string; text: string };
	stats: { value: number; suffix: string; label: string }[];
	body: string;
	photo: Photo;
};

export type Note = { id: string; date: string; title: string; href: string };
export type ArchiveContent = { eyebrow: string; title: string; notes: Note[]; more: string };

export type VisitContent = {
	eyebrow: string;
	title: string;
	rows: MetaItem[];
	directions: { label: string; href: string };
	call: { label: string; href: string };
	place: { name: string; area: string };
};

export type FooterContent = {
	brand: string;
	tagline: string;
	columns: { title: string; links: { label: string; href: string }[] }[];
	legal: string;
	contact: string;
};

export type MuseumContent = {
	entrance: EntranceContent;
	halls: HallsContent;
	journey: JourneyContent;
	farms: FarmsContent;
	process: ProcessContent;
	collection: CollectionContent;
	atlas: AtlasContent;
	people: PeopleContent;
	archive: ArchiveContent;
	visit: VisitContent;
	footer: FooterContent;
};

const entrance: EntranceContent = {
	eyebrow: 'Hall 00 · Entrance',
	title: 'A living museum of Ethiopian coffee',
	body: [
		'Kebena Trading is a family company that has grown and traded coffee in the Jimma zone for over three decades. Before Kebena, the family exported Limu and Jimma coffee as Haider Abamecha Coffee Export.',
		'This site is our museum. Walk the four halls, from the seed in the highland soil to the coffee in your cup.'
	],
	photo: {
		src: '/halls/drying-beds.webp',
		alt: 'Raised drying beds of coffee on a green hillside in Jimma, with workers turning the beans',
		width: 844,
		height: 649
	},
	backdrop: '/hero/museum-soft.jpg',
	facts: [
		{ value: 30, suffix: '+ years', note: 'Growing and trading coffee in Jimma' },
		{ value: 2, suffix: ' estates', note: 'Gera and Djimmah coffee farms' },
		{ value: 8, suffix: ' washing stations', note: '3 of them RFA-certified' },
		{ value: 4, suffix: ' dry mills', note: 'Hulling, sorting and grading' }
	]
};

const halls: HallsContent = {
	eyebrow: 'Floor plan',
	title: 'Four halls, one story',
	intro: 'Each hall is a stop on the journey our coffee takes. Start anywhere.',
	halls: [
		{
			id: 'origin',
			title: 'Origin',
			text: 'Jimma, the birthplace of coffee, and the highlands around it.',
			tagline: 'Where coffee was first found',
			href: '#entrance',
			photo: '/halls/drying-beds.webp'
		},
		{
			id: 'farms',
			title: 'The farms',
			text: 'Our Gera and Djimmah estates on rich volcanic soil.',
			tagline: 'Gera and Djimmah estates',
			href: '#farms',
			photo: '/halls/hall-02.webp'
		},
		{
			id: 'collection',
			title: 'The collection',
			text: 'Specialty, certified and commercial lots.',
			tagline: 'The lots on display this season',
			href: '#collection',
			photo: '/halls/hall-04.webp'
		},
		{
			id: 'people',
			title: 'The people',
			text: '10,000 farmers and the families behind them.',
			tagline: 'Out-growers, staff and families',
			href: '#people',
			photo: '/halls/hall-05.webp'
		}
	]
};

const journey: JourneyContent = {
	eyebrow: 'Interlude · From cherry to cup',
	title: 'One long,',
	accent: 'slow pour',
	steps: [
		{
			id: 'harvest',
			act: 'On the farm',
			title: 'Picked only when',
			accent: 'red',
			text: 'Cherries ripen unevenly, so pickers come back to the same trees again and again, taking only the ripe ones.',
			photo: {
				src: '/journey/harvest.webp',
				alt: 'A hand picking ripe red coffee cherries into a woven basket'
			}
		},
		{
			id: 'drying',
			title: 'Dried in the',
			accent: 'sun',
			text: 'The cherries are spread on raised beds and turned by hand for two to three weeks, until they are dark and dry.',
			photo: {
				src: '/journey/drying.webp',
				alt: 'Red coffee cherries drying on a raised bed above green hills'
			}
		},
		{
			id: 'sorting',
			title: 'Hulled and sorted',
			accent: 'by hand',
			text: 'The dry husk comes off to free the green bean inside. Every bean is checked, and the broken ones are set aside.',
			photo: {
				src: '/journey/sorting.webp',
				alt: 'Hands sorting green coffee beans from husks in a woven tray'
			}
		},
		{
			id: 'roasting',
			act: 'At the ceremony',
			wide: true,
			title: 'Roasted over',
			accent: 'charcoal',
			text: 'Green beans crackle in a flat pan over the coals, and the fragrant smoke is carried around the room for the guests.',
			photo: {
				src: '/journey/roasting.webp',
				alt: 'Dark roasted coffee beans in an iron pan over glowing charcoal'
			}
		},
		{
			id: 'grinding',
			title: 'Pounded in the',
			accent: 'mukecha',
			text: 'The warm beans are crushed in a wooden mortar, just enough for the pot about to be brewed.',
			photo: {
				src: '/journey/grinding.webp',
				alt: 'Roasted coffee beans and fresh grounds in a carved wooden mortar'
			}
		},
		{
			id: 'jebena',
			wide: true,
			title: 'Brewed in the',
			accent: 'jebena',
			text: 'The grounds go into the clay pot with water and come to the boil over the coals, then rest so they settle.',
			photo: {
				src: '/journey/jebena.webp',
				alt: 'A black clay jebena on a small charcoal stove in the grass'
			}
		},
		{
			id: 'cup',
			title: 'Poured from a',
			accent: 'height',
			text: 'The jebena is lifted high and tipped in one thin, steady stream, cup after cup. Abol, then tona, then baraka.',
			photo: {
				src: '/journey/cup.webp',
				alt: 'A white coffee cup with a red tulip pattern, steam rising'
			}
		}
	],
	end: 'And then, the first sip.',
	next: { label: 'Come and taste it', href: '#visit' }
};

const farms: FarmsContent = {
	eyebrow: 'Hall 02 · The farms',
	title: 'Two estates in the Jimma highlands',
	intro:
		'Rich volcanic soil, generous rain and a temperate climate. We farm both estates organically, and every lot can be traced back to where it grew.',
	farms: [
		{
			id: 'gera',
			kind: 'Estate',
			gallery: [
				{
					src: '/farms/helix/02-forest.webp',
					alt: 'Morning light through the forest canopy above coffee shrubs'
				},
				{
					src: '/farms/helix/03-washed-gera.webp',
					alt: 'Cherries ripening from green to red on a Gera branch'
				},
				{
					src: '/farms/helix/04-harvest.webp',
					alt: 'A picker filling a basket from a tree heavy with cherries, hills behind'
				}
			],
			title: 'Gera Coffee Farm',
			text: 'An established estate that pairs traditional Ethiopian farming knowledge with modern methods. Known for a rich body, vibrant acidity and complex notes.',
			photo: {
				src: '/farms/helix/01-gera.webp',
				alt: 'A coffee tree heavy with red cherries on the Gera estate, hills behind'
			},
			meta: [
				{ label: 'Region', value: 'Gera highlands, Jimma zone' },
				{ label: 'Farming', value: 'Organic' },
				{ label: 'Trace', value: 'Farm to cup' }
			]
		},
		{
			id: 'djimmah',
			kind: 'Estate',
			gallery: [
				{
					src: '/farms/helix/06-unwashed-djimmah.webp',
					alt: 'A heap of freshly picked red cherries'
				},
				{
					src: '/farms/helix/07-hall-04.webp',
					alt: 'Red cherries and glossy leaves on a Djimmah branch'
				},
				{
					src: '/farms/helix/08-hall-02.webp',
					alt: 'A coffee tree loaded with red cherries on a hillside'
				}
			],
			title: 'Djimmah Coffee Farm',
			text: 'Every stage is checked here, from planting and harvest to processing and packing. Grown organically, without harmful chemicals.',
			photo: {
				src: '/farms/helix/05-djimmah.webp',
				alt: 'Close-up of ripe red coffee cherries on a branch'
			},
			meta: [
				{ label: 'Region', value: 'Jimma highlands' },
				{ label: 'Farming', value: 'Organic' },
				{ label: 'Trace', value: 'Farm to cup' }
			]
		},
		{
			id: 'washing-stations',
			kind: 'Washing stations',
			title: '8 washing stations',
			text: 'Washing stations and collection centres across the Limu, Mana and Goma districts, where cherries are pulped, fermented, washed and dried on raised beds. Three of them are RFA-certified.',
			photo: {
				src: '/farms/helix/09-drying-beds.webp',
				alt: 'Long rows of raised drying beds below a forested hill'
			},
			gallery: [
				{
					src: '/farms/helix/10-drying-beds.webp',
					alt: 'Workers turning coffee on raised drying beds, forest behind them'
				},
				{
					src: '/farms/helix/11-drying.webp',
					alt: 'Cherries drying on raised beds in the highlands'
				},
				{
					src: '/farms/helix/12-hall-05.webp',
					alt: 'A team working along the drying beds at a washing station'
				}
			],
			meta: [
				{ label: 'Districts', value: 'Limu, Mana and Goma' },
				{ label: 'Certified', value: '3 RFA-certified' },
				{ label: 'Process', value: 'Washed and sun-dried' }
			]
		},
		{
			id: 'dry-mills',
			kind: 'Dry mills',
			title: '4 dry mills',
			text: 'Dried coffee is hulled, sorted by hand and graded here before each lot is bagged and sent to Addis Ababa, traceable to where it grew.',
			photo: {
				src: '/farms/helix/13-sorting.webp',
				alt: 'Hands sorting hulled green beans from their husks in a woven basket'
			},
			gallery: [
				{
					src: '/farms/helix/14-unwashed-nekemte.webp',
					alt: 'Woven baskets of cherries lined up for weighing'
				},
				{ src: '/farms/helix/15-hall-03.webp', alt: 'Baskets of dried cherries ready for hulling' },
				{
					src: '/farms/helix/16-washed-limmu.webp',
					alt: 'Red cherries on a branch before processing'
				}
			],
			meta: [
				{ label: 'Work', value: 'Hulling, sorting, grading' },
				{ label: 'Bound for', value: 'Addis Ababa' },
				{ label: 'Trace', value: 'Lot to origin' }
			]
		}
	]
};

const process: ProcessContent = {
	eyebrow: 'Hall 03 · The process',
	title: 'From red cherry to green coffee',
	intro:
		'Our coffee is prepared washed, unwashed or sun-dried at 8 washing stations and 4 dry mills across the Limu, Mana and Goma districts.',
	readoutLabel: 'Bean moisture · approx.',
	steps: [
		{
			id: 'picking',
			moisture: 65,
			title: 'Picking',
			text: 'Only ripe red cherries are selected by hand.',
			photo: { src: '/farms/gera.webp', alt: 'Ripe red cherries on the tree, ready to pick' }
		},
		{
			id: 'washed',
			moisture: 52,
			title: 'Washed',
			text: 'The fruit is removed at a washing station before the beans dry.',
			photo: {
				src: '/collection/washed-limmu.webp',
				alt: 'Red cherries on a branch before washing'
			}
		},
		{
			id: 'sun-dried',
			moisture: 11.5,
			title: 'Unwashed and sun-dried',
			text: 'Whole cherries dry slowly in the sun on raised beds.',
			photo: { src: '/journey/drying.webp', alt: 'Cherries drying on raised beds in the highlands' }
		},
		{
			id: 'dry-milling',
			moisture: 10.5,
			moment: 'Hulled',
			title: 'Dry milling',
			text: 'Dried coffee is hulled, sorted and graded at our dry mills.',
			photo: {
				src: '/journey/sorting.webp',
				alt: 'Hands sorting hulled green beans in a woven basket'
			}
		},
		{
			id: 'export',
			moisture: 11,
			title: 'Export',
			text: 'Lots leave Addis Ababa fully traceable to their origin.',
			photo: {
				src: '/collection/unwashed-nekemte.webp',
				alt: 'Baskets of coffee cherries lined up for weighing'
			}
		}
	]
};

const collection: CollectionContent = {
	eyebrow: 'Hall 03 · The collection',
	title: 'The lots on display this season',
	tags: [
		{ label: 'Specialty', tone: 'leaf' },
		{ label: 'Certified', tone: 'sage' },
		{ label: 'Commercial', tone: 'lime' }
	],
	cta: { label: 'Order crop year 2026', href: '#visit' },
	lots: [
		{
			id: 'unwashed-djimmah',
			title: 'Unwashed Djimmah',
			photo: {
				src: '/collection/unwashed-djimmah.webp',
				alt: 'A basket full of red coffee cherries'
			},
			specs: [
				{ label: 'Origin', value: 'Djimmah (Jimma)' },
				{ label: 'Process', value: 'Unwashed' },
				{ label: 'Grade', value: '1 to 5' }
			]
		},
		{
			id: 'washed-limmu',
			title: 'Washed Limmu',
			photo: {
				src: '/collection/washed-limmu.webp',
				alt: 'Red cherries and dark leaves on a Limu coffee branch'
			},
			specs: [
				{ label: 'Origin', value: 'Limu' },
				{ label: 'Process', value: 'Washed' },
				{ label: 'Grade', value: '1 to 2' }
			]
		},
		{
			id: 'washed-gera',
			title: 'Washed Gera',
			photo: {
				src: '/collection/washed-gera.webp',
				alt: 'Cherries ripening from green to red on a Gera branch'
			},
			specs: [
				{ label: 'Origin', value: 'Gera' },
				{ label: 'Process', value: 'Washed' },
				{ label: 'Grade', value: '1 to 2' }
			]
		},
		{
			id: 'unwashed-nekemte',
			title: 'Unwashed Nekemte',
			photo: {
				src: '/collection/unwashed-nekemte.webp',
				alt: 'Woven baskets of picked cherries from Nekemte'
			},
			specs: [
				{ label: 'Origin', value: 'Nekemte' },
				{ label: 'Process', value: 'Unwashed' },
				{ label: 'Grade', value: '1 to 5' }
			]
		}
	]
};

const atlas: AtlasContent = {
	eyebrow: 'Hall 03 · The collection',
	title: 'We also source from these origins',
	origins: [
		{
			id: 'jimma',
			altitude: [1400, 2100],
			harvest: [10, 11, 12, 1],
			name: 'Jimma',
			lat: 7.67,
			lon: 36.83,
			text: 'Home. Our family has grown and traded coffee in the Jimma zone for over three decades.'
		},
		{
			id: 'limu',
			altitude: [1400, 2200],
			harvest: [10, 11, 12, 1],
			name: 'Limu',
			lat: 8.15,
			lon: 36.95,
			text: 'Before Kebena, the family exported Limu and Jimma coffee as Haider Abamecha Coffee Export.'
		},
		{
			id: 'gera',
			altitude: [1800, 2200],
			harvest: [10, 11, 12, 1],
			name: 'Gera',
			lat: 7.85,
			lon: 36.3,
			text: 'Our Gera estate, on rich volcanic soil.'
		},
		{
			id: 'nekemte',
			altitude: [1500, 2100],
			harvest: [10, 11, 12, 1],
			name: 'Nekemte',
			lat: 9.08,
			lon: 36.55,
			text: 'Unwashed Nekemte is part of our collection.'
		},
		{
			id: 'sidama',
			altitude: [1500, 2200],
			harvest: [11, 12, 1],
			name: 'Sidama',
			lat: 6.75,
			lon: 38.5,
			text: 'We also source from this origin.'
		},
		{
			id: 'yirgacheffe',
			altitude: [1750, 2200],
			harvest: [10, 11, 12, 1],
			name: 'Yirgacheffe',
			lat: 6.16,
			lon: 38.2,
			text: 'We also source from this origin.'
		},
		{
			id: 'guji',
			altitude: [1800, 2300],
			harvest: [11, 12, 1, 2],
			name: 'Guji',
			lat: 5.7,
			lon: 38.9,
			text: 'We also source from this origin.'
		},
		{
			id: 'harar',
			altitude: [1500, 2100],
			harvest: [10, 11, 12, 1, 2],
			name: 'Harar',
			lat: 9.31,
			lon: 42.12,
			text: 'We also source from this origin.'
		}
	]
};

const people: PeopleContent = {
	eyebrow: 'Hall 04 · The people',
	lead: {
		value: 10000,
		suffix: '',
		text: 'out-grower farmers bring their cherries to Kebena each harvest.'
	},
	stats: [
		{ value: 5406, suffix: '', label: 'RFA-certified farmers' },
		{ value: 2000, suffix: '', label: 'permanent staff' },
		{ value: 4000, suffix: '+', label: 'harvest-season workers' }
	],
	body: 'We invest in local roads, healthcare and schools. Our operations are certified by RFA and organic standards and follow C.A.F.E. Practices. Through our import arm and our sister company, Care Land General Hospital, we also bring medical equipment to Ethiopia.',
	photo: {
		src: '/people/drying-beds.webp',
		alt: 'Workers turning coffee on raised drying beds, forest behind them'
	}
};

const archive: ArchiveContent = {
	eyebrow: 'Archive',
	title: 'Notes from the field',
	more: 'Read note',
	notes: [
		{
			id: 'afcce-22',
			date: '2026-06-09',
			title: 'Kebena shows green coffee and import work at the 22nd AFCC&E',
			href: '#archive'
		},
		{
			id: 'coe-record',
			date: '2024-12-25',
			title: 'Ethiopian Cup of Excellence auction sets a new record',
			href: '#archive'
		},
		{
			id: 'production-doubles',
			date: '2024-12-25',
			title: 'Ethiopia doubles coffee production in five years',
			href: '#archive'
		},
		{
			id: 'eudr',
			date: '2024-12-25',
			title: 'How Ethiopian farmers are meeting new EU deforestation rules',
			href: '#archive'
		}
	]
};

const visit: VisitContent = {
	eyebrow: 'Plan your visit',
	title: 'Come and taste the collection',
	rows: [
		{
			label: 'Address',
			value: 'Kebena Museum, the coffee cup building, Jimma, Oromia, Ethiopia'
		},
		{ label: 'Hours', value: 'Monday to Friday, 08:30 to 17:00' },
		{ label: 'Phone', value: '+251 912 605 824' },
		{ label: 'Email', value: 'info@kebenageneraltrading.com' }
	],
	directions: {
		label: 'Get directions',
		href: 'https://www.google.com/maps/search/?api=1&query=Coffee+cup+building+Jimma+Ethiopia'
	},
	call: { label: 'Call us', href: 'tel:+251912605824' },
	place: { name: 'Kebena Museum', area: 'Jimma · Oromia, Ethiopia' }
};

const footer: FooterContent = {
	brand: 'Kebena',
	tagline: 'A living museum of Ethiopian coffee.',
	columns: [
		{
			title: 'Museum',
			links: [
				{ label: 'Floor plan', href: '#halls' },
				{ label: 'The farms', href: '#farms' },
				{ label: 'The collection', href: '#collection' },
				{ label: 'Archive', href: '#archive' }
			]
		},
		{
			title: 'Company',
			links: [
				{ label: 'Overview', href: '#entrance' },
				{ label: 'Import', href: '#people' },
				{ label: 'Social responsibility', href: '#people' },
				{ label: 'Order online', href: '#collection' }
			]
		},
		{
			title: 'Sister companies',
			links: [
				{ label: 'Care Land General Hospital', href: '#' },
				{ label: 'Haider Abamecha Coffee Export', href: '#' }
			]
		},
		{
			title: 'Follow',
			links: [
				{ label: 'Facebook', href: '#' },
				{ label: 'Instagram', href: '#' },
				{ label: 'LinkedIn', href: '#' }
			]
		}
	],
	legal: '© Kebena Trading PLC. All rights reserved.',
	contact: 'Mon to Fri, 08:30 to 17:00 · +251 912 605 824'
};

export const museum: MuseumContent = {
	entrance,
	halls,
	journey,
	farms,
	process,
	collection,
	atlas,
	people,
	archive,
	visit,
	footer
};

/* ------------------------------------------------------------------ */
/* Dev-only stress fixtures. Plausible values, never random filler.    */
/* ------------------------------------------------------------------ */

const worst: MuseumContent = {
	...museum,
	farms: {
		...farms,
		title: 'Two organic estates in the Jimma highlands, Gera and Djimmah',
		farms: [
			{
				...farms.farms[0],
				title: 'Gera Coffee Farm and Washing Station',
				meta: [...farms.farms[0].meta, { label: 'Altitude', value: '1,900–2,100 m' }]
			},
			{
				...farms.farms[1],
				photo: { ...farms.farms[1].photo, src: '/farms/missing-photo.jpg' },
				meta: farms.farms[1].meta.slice(0, 1)
			}
		]
	},
	process: {
		...process,
		steps: [
			process.steps[0],
			{
				...process.steps[1],
				title: 'Washed, fermented and soaked in channels of spring water',
				text:
					process.steps[1].text +
					' The parchment then rests on raised beds for twelve to fifteen days.'
			},
			{ ...process.steps[2], title: 'በፀሐይ ማድረቅ', text: 'ሙሉው ፍሬ በከፍታ አልጋዎች ላይ ቀስ ብሎ ይደርቃል።' },
			...process.steps.slice(3)
		]
	},
	collection: {
		...collection,
		lots: [
			{
				...collection.lots[0],
				title: 'Unwashed Djimmah Grade 5 Natural, Seka Chekorsa',
				specs: [
					{ label: 'Origin', value: 'Seka Chekorsa, Djimmah (Jimma)' },
					...collection.lots[0].specs.slice(1)
				]
			},
			{
				...collection.lots[1],
				photo: { ...collection.lots[1].photo, src: '/collection/missing.jpg' }
			},
			...collection.lots.slice(2),
			{ ...collection.lots[0], id: 'extra', title: 'Washed Yirgacheffe' }
		]
	},
	atlas: {
		...atlas,
		origins: [
			...atlas.origins.slice(0, 7),
			{
				...atlas.origins[7],
				name: 'Harar (Eastern Highlands)',
				text: 'Longberry from the Eastern Highlands, sun-dried on the farm and graded in Dire Dawa before it reaches Addis Ababa.'
			}
		]
	},
	people: {
		...people,
		stats: [...people.stats, { value: 1, suffix: '', label: 'estate hospital' }]
	},
	archive: {
		...archive,
		notes: [
			{
				...archive.notes[0],
				title:
					'Kebena shows green coffee, import work and the Care Land medical equipment programme at the 22nd African Fine Coffees Conference & Exhibition'
			},
			...archive.notes.slice(1)
		]
	},
	visit: {
		...visit,
		rows: visit.rows.map((r) =>
			r.label === 'Email' ? { ...r, value: 'bartholomew.fitzgerald@kebenageneraltrading.com' } : r
		)
	},
	entrance: {
		...entrance,
		// the Amharic edition is coming (paraglide is set up); Ethiopic glyphs are taller than Latin
		eyebrow: 'Hall 00 · Entrance · መግቢያ',
		title: 'A living museum of Ethiopian coffee, from Limu and Gera to Seka Chekorsa',
		body: [entrance.body[0], 'ይህ ድረ-ገጽ የእኛ ሙዚየም ነው። ከደጋው አፈር ዘር እስከ ስኒዎ ቡና ድረስ አምስቱን አዳራሾች ይጎብኙ።'],
		facts: [
			{
				value: 10000,
				suffix: ' out-grower farmers',
				note: 'Bringing their cherries to Kebena each harvest across Limu, Gera and Seka'
			},
			{ value: 1, suffix: ' estate' },
			{
				value: 8,
				suffix: ' washing stations and collection centres',
				note: '3 of them RFA-certified'
			},
			{ value: 4, suffix: ' dry mills', note: 'Hulling, sorting and grading' }
		]
	},
	halls: {
		...halls,
		title: 'Seven halls, one long story from the forest to your cup',
		intro:
			'Each hall is a stop on the journey our coffee takes, from the wild forests of Kaffa to the roastery in Addis Ababa. Start anywhere.',
		halls: [
			{
				...halls.halls[0],
				text: 'Jimma, the birthplace of coffee, and the forested highlands of Limu, Gera and Seka Chekorsa around it.'
			},
			{
				...halls.halls[1],
				title: 'The farms of Gera and Djimmah',
				tagline: 'Two organic estates on volcanic soil, 1,900–2,100 m'
			},
			{
				...halls.halls[2],
				text: 'Specialty, RFA-certified, organic and commercial lots from 8 washing stations and 4 dry mills.',
				photo: '/halls/missing-photo.jpg'
			},
			{
				...halls.halls[3],
				text: '10,000 out-grower farmers, 2,000 permanent staff and 4,000+ seasonal workers.'
			},
			{
				id: 'roastery',
				title: 'The roastery',
				text: 'Where green coffee becomes the cup.',
				tagline: 'Roasted in front of you',
				href: '#roastery',
				photo: '/halls/hall-03.webp'
			},
			{
				id: 'notes',
				title: 'Notes',
				text: '',
				tagline: '',
				href: '#notes',
				photo: '/halls/hall-02.webp'
			}
		]
	},
	journey: {
		...journey,
		steps: [
			{
				...journey.steps[0],
				title: 'Picked one by one, only when the cherry is fully',
				text:
					journey.steps[0].text +
					' In a good year the same tree is visited six or seven times between October and January.'
			},
			{
				...journey.steps[1],
				photo: { ...journey.steps[1].photo, src: '/journey/missing-photo.jpg' }
			},
			{
				...journey.steps[2],
				title: 'የቡና ፍሬ',
				accent: 'መልቀም',
				text: 'ደረቁ ቅርፊት ተላጦ አረንጓዴው ፍሬ ይወጣል።'
			},
			...journey.steps.slice(3)
		]
	}
};

export type DataMode = 'demo' | 'worst' | 'empty' | 'one';
export const DATA_MODES: DataMode[] = ['demo', 'worst', 'empty', 'one'];

export function museumFor(mode: DataMode): MuseumContent {
	if (mode === 'worst') return worst;
	if (mode === 'empty')
		return {
			...museum,
			entrance: { ...entrance, facts: [] },
			halls: { ...halls, halls: [] },
			journey: { ...journey, steps: [] },
			farms: { ...farms, farms: [] },
			process: { ...process, steps: [] },
			collection: { ...collection, tags: [], lots: [] },
			atlas: { ...atlas, origins: [] },
			people: { ...people, stats: [] },
			archive: { ...archive, notes: [] }
		};
	if (mode === 'one')
		return {
			...museum,
			entrance: { ...entrance, facts: [{ value: 1, suffix: ' estate', note: 'Gera coffee farm' }] },
			halls: { ...halls, halls: halls.halls.slice(0, 1) },
			journey: { ...journey, steps: journey.steps.slice(0, 1) },
			farms: { ...farms, farms: farms.farms.slice(0, 1) },
			process: { ...process, steps: process.steps.slice(0, 1) },
			collection: { ...collection, lots: collection.lots.slice(0, 1) },
			atlas: { ...atlas, origins: atlas.origins.slice(0, 1) },
			people: { ...people, stats: people.stats.slice(0, 1) },
			archive: { ...archive, notes: archive.notes.slice(0, 1) }
		};
	return museum;
}
