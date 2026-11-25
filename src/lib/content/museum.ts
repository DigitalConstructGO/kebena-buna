/**
 * Copy and data for the museum home page. The components render whatever
 * is passed in here, so the same shapes carry the real copy and the dev-only
 * stress fixtures (?data=worst | empty | one).
 *
 * The words come from Paraglide messages (`home_*`, plus a few shared `site_*` and `contact_*`
 * keys), so they follow the visitor's language and the dashboard's edits. Photos, links and
 * numbers stay here in code.
 */
import { m } from '#lib/i18n.ts';
import { picture } from './picture.ts';

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
	/** The two captions of the arrival scene: while the map sharpens, and while it tips back. */
	beats: [string, string];
	/** What waits at the museum, popping up around its pin (up to six). */
	tags: string[];
	/** The building, behind the closing headline. */
	photo: string;
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

/* ------------------------------------------------------------------ */
/* The real copy. Every word is a message (`messages/*.json`, editable */
/* from the dashboard), read when the content is built: the language   */
/* differs per request, so nothing here runs at module load.           */
/* ------------------------------------------------------------------ */

/** A message holding several paragraphs, one blank line between them. */
const paras = (text: string) => text.split(/\n{2,}/);

function entrance(): EntranceContent {
	return {
		eyebrow: m.home_entrance_eyebrow(),
		title: m.home_entrance_title(),
		body: paras(m.home_entrance_body()),
		photo: {
			src: picture(m.home_entrance_photo, '/halls/drying-beds.webp'),
			alt: m.home_entrance_photo_alt(),
			width: 844,
			height: 649
		},
		backdrop: picture(m.home_entrance_backdrop, '/hero/museum-soft.jpg'),
		facts: [
			{
				value: 30,
				suffix: `+ ${m.home_entrance_fact_years_unit()}`,
				note: m.home_entrance_fact_years_note()
			},
			{
				value: 2,
				suffix: ` ${m.home_entrance_fact_estates_unit()}`,
				note: m.home_entrance_fact_estates_note()
			},
			{
				value: 8,
				suffix: ` ${m.home_entrance_fact_stations_unit()}`,
				note: m.home_entrance_fact_stations_note({ count: 3 })
			},
			{
				value: 4,
				suffix: ` ${m.home_entrance_fact_mills_unit()}`,
				note: m.home_entrance_fact_mills_note()
			}
		]
	};
}

function halls(): HallsContent {
	return {
		eyebrow: m.home_halls_eyebrow(),
		title: m.home_halls_title(),
		intro: m.home_halls_intro(),
		halls: [
			{
				id: 'origin',
				title: m.home_halls_origin_title(),
				text: m.home_halls_origin_text(),
				tagline: m.home_halls_origin_tagline(),
				href: '#entrance',
				photo: picture(m.home_halls_origin_photo, '/halls/drying-beds.webp')
			},
			{
				id: 'farms',
				title: m.home_halls_farms_title(),
				text: m.home_halls_farms_text(),
				tagline: m.home_halls_farms_tagline(),
				href: '#farms',
				photo: picture(m.home_halls_farms_photo, '/halls/hall-02.webp')
			},
			{
				id: 'collection',
				title: m.home_halls_collection_title(),
				text: m.home_halls_collection_text(),
				tagline: m.home_halls_collection_tagline(),
				href: '#collection',
				photo: picture(m.home_halls_collection_photo, '/halls/hall-04.webp')
			},
			{
				id: 'people',
				title: m.home_halls_people_title(),
				text: m.home_halls_people_text(),
				tagline: m.home_halls_people_tagline(),
				href: '#people',
				photo: picture(m.home_halls_people_photo, '/halls/hall-05.webp')
			}
		]
	};
}

function journey(): JourneyContent {
	return {
		eyebrow: m.home_journey_eyebrow(),
		title: m.home_journey_title(),
		accent: m.home_journey_accent(),
		steps: [
			{
				id: 'harvest',
				act: m.home_journey_act_farm(),
				title: m.home_journey_harvest_title(),
				accent: m.home_journey_harvest_accent(),
				text: m.home_journey_harvest_text(),
				photo: {
					src: picture(m.home_journey_harvest_photo, '/journey/harvest.webp'),
					alt: m.home_journey_harvest_alt()
				}
			},
			{
				id: 'drying',
				title: m.home_journey_drying_title(),
				accent: m.home_journey_drying_accent(),
				text: m.home_journey_drying_text(),
				photo: {
					src: picture(m.home_journey_drying_photo, '/journey/drying.webp'),
					alt: m.home_journey_drying_alt()
				}
			},
			{
				id: 'sorting',
				title: m.home_journey_sorting_title(),
				accent: m.home_journey_sorting_accent(),
				text: m.home_journey_sorting_text(),
				photo: {
					src: picture(m.home_journey_sorting_photo, '/journey/sorting.webp'),
					alt: m.home_journey_sorting_alt()
				}
			},
			{
				id: 'roasting',
				act: m.home_journey_act_ceremony(),
				wide: true,
				title: m.home_journey_roasting_title(),
				accent: m.home_journey_roasting_accent(),
				text: m.home_journey_roasting_text(),
				photo: {
					src: picture(m.home_journey_roasting_photo, '/journey/roasting.webp'),
					alt: m.home_journey_roasting_alt()
				}
			},
			{
				id: 'grinding',
				title: m.home_journey_grinding_title(),
				accent: m.home_journey_grinding_accent(),
				text: m.home_journey_grinding_text(),
				photo: {
					src: picture(m.home_journey_grinding_photo, '/journey/grinding.webp'),
					alt: m.home_journey_grinding_alt()
				}
			},
			{
				id: 'jebena',
				wide: true,
				title: m.home_journey_jebena_title(),
				accent: m.home_journey_jebena_accent(),
				text: m.home_journey_jebena_text(),
				photo: {
					src: picture(m.home_journey_jebena_photo, '/journey/jebena.webp'),
					alt: m.home_journey_jebena_alt()
				}
			},
			{
				id: 'cup',
				title: m.home_journey_cup_title(),
				accent: m.home_journey_cup_accent(),
				text: m.home_journey_cup_text(),
				photo: {
					src: picture(m.home_journey_cup_photo, '/journey/cup.webp'),
					alt: m.home_journey_cup_alt()
				}
			}
		],
		end: m.home_journey_end(),
		next: { label: m.home_journey_next(), href: '#visit' }
	};
}

function farms(): FarmsContent {
	const organic = m.home_farms_value_organic();
	const farmToCup = m.home_farms_value_farm_to_cup();
	return {
		eyebrow: m.home_farms_eyebrow(),
		title: m.home_farms_title(),
		intro: m.home_farms_intro(),
		farms: [
			{
				id: 'gera',
				kind: m.home_farms_kind_estate(),
				gallery: [
					{
						src: picture(m.home_farms_gera_gallery_1_photo, '/farms/helix/02-forest.webp'),
						alt: m.home_farms_gera_gallery_1_alt()
					},
					{
						src: picture(m.home_farms_gera_gallery_2_photo, '/farms/helix/03-washed-gera.webp'),
						alt: m.home_farms_gera_gallery_2_alt()
					},
					{
						src: picture(m.home_farms_gera_gallery_3_photo, '/farms/helix/04-harvest.webp'),
						alt: m.home_farms_gera_gallery_3_alt()
					}
				],
				title: m.home_farms_gera_title(),
				text: m.home_farms_gera_text(),
				photo: {
					src: picture(m.home_farms_gera_photo, '/farms/helix/01-gera.webp'),
					alt: m.home_farms_gera_alt()
				},
				meta: [
					{ label: m.home_farms_label_region(), value: m.home_farms_gera_region() },
					{ label: m.home_farms_label_farming(), value: organic },
					{ label: m.home_farms_label_trace(), value: farmToCup }
				]
			},
			{
				id: 'djimmah',
				kind: m.home_farms_kind_estate(),
				gallery: [
					{
						src: picture(
							m.home_farms_djimmah_gallery_1_photo,
							'/farms/helix/06-unwashed-djimmah.webp'
						),
						alt: m.home_farms_djimmah_gallery_1_alt()
					},
					{
						src: picture(m.home_farms_djimmah_gallery_2_photo, '/farms/helix/07-hall-04.webp'),
						alt: m.home_farms_djimmah_gallery_2_alt()
					},
					{
						src: picture(m.home_farms_djimmah_gallery_3_photo, '/farms/helix/08-hall-02.webp'),
						alt: m.home_farms_djimmah_gallery_3_alt()
					}
				],
				title: m.home_farms_djimmah_title(),
				text: m.home_farms_djimmah_text(),
				photo: {
					src: picture(m.home_farms_djimmah_photo, '/farms/helix/05-djimmah.webp'),
					alt: m.home_farms_djimmah_alt()
				},
				meta: [
					{ label: m.home_farms_label_region(), value: m.home_farms_djimmah_region() },
					{ label: m.home_farms_label_farming(), value: organic },
					{ label: m.home_farms_label_trace(), value: farmToCup }
				]
			},
			{
				id: 'washing-stations',
				kind: m.home_farms_kind_stations(),
				title: m.home_farms_stations_title({ count: 8 }),
				text: m.home_farms_stations_text(),
				photo: {
					src: picture(m.home_farms_stations_photo, '/farms/helix/09-drying-beds.webp'),
					alt: m.home_farms_stations_alt()
				},
				gallery: [
					{
						src: picture(m.home_farms_stations_gallery_1_photo, '/farms/helix/10-drying-beds.webp'),
						alt: m.home_farms_stations_gallery_1_alt()
					},
					{
						src: picture(m.home_farms_stations_gallery_2_photo, '/farms/helix/11-drying.webp'),
						alt: m.home_farms_stations_gallery_2_alt()
					},
					{
						src: picture(m.home_farms_stations_gallery_3_photo, '/farms/helix/12-hall-05.webp'),
						alt: m.home_farms_stations_gallery_3_alt()
					}
				],
				meta: [
					{ label: m.home_farms_label_districts(), value: m.home_farms_stations_districts() },
					{
						label: m.home_farms_label_certified(),
						value: m.home_farms_stations_certified({ count: 3 })
					},
					{ label: m.home_farms_label_process(), value: m.home_farms_stations_process() }
				]
			},
			{
				id: 'dry-mills',
				kind: m.home_farms_kind_mills(),
				title: m.home_farms_mills_title({ count: 4 }),
				text: m.home_farms_mills_text(),
				photo: {
					src: picture(m.home_farms_mills_photo, '/farms/helix/13-sorting.webp'),
					alt: m.home_farms_mills_alt()
				},
				gallery: [
					{
						src: picture(
							m.home_farms_mills_gallery_1_photo,
							'/farms/helix/14-unwashed-nekemte.webp'
						),
						alt: m.home_farms_mills_gallery_1_alt()
					},
					{
						src: picture(m.home_farms_mills_gallery_2_photo, '/farms/helix/15-hall-03.webp'),
						alt: m.home_farms_mills_gallery_2_alt()
					},
					{
						src: picture(m.home_farms_mills_gallery_3_photo, '/farms/helix/16-washed-limmu.webp'),
						alt: m.home_farms_mills_gallery_3_alt()
					}
				],
				meta: [
					{ label: m.home_farms_label_work(), value: m.home_farms_mills_work() },
					{ label: m.home_farms_label_bound_for(), value: m.home_farms_mills_bound_for() },
					{ label: m.home_farms_label_trace(), value: m.home_farms_mills_trace() }
				]
			}
		]
	};
}

function process(): ProcessContent {
	return {
		eyebrow: m.home_process_eyebrow(),
		title: m.home_process_title(),
		intro: m.home_process_intro(),
		readoutLabel: m.home_process_readout_label(),
		steps: [
			{
				id: 'picking',
				moisture: 65,
				title: m.home_process_picking_title(),
				text: m.home_process_picking_text(),
				photo: {
					src: picture(m.home_process_picking_photo, '/farms/gera.webp'),
					alt: m.home_process_picking_alt()
				}
			},
			{
				id: 'washed',
				moisture: 52,
				title: m.home_process_washed_title(),
				text: m.home_process_washed_text(),
				photo: {
					src: picture(m.home_process_washed_photo, '/collection/washed-limmu.webp'),
					alt: m.home_process_washed_alt()
				}
			},
			{
				id: 'sun-dried',
				moisture: 11.5,
				title: m.home_process_sun_dried_title(),
				text: m.home_process_sun_dried_text(),
				photo: {
					src: picture(m.home_process_sun_dried_photo, '/journey/drying.webp'),
					alt: m.home_process_sun_dried_alt()
				}
			},
			{
				id: 'dry-milling',
				moisture: 10.5,
				moment: m.home_process_dry_milling_moment(),
				title: m.home_process_dry_milling_title(),
				text: m.home_process_dry_milling_text(),
				photo: {
					src: picture(m.home_process_dry_milling_photo, '/journey/sorting.webp'),
					alt: m.home_process_dry_milling_alt()
				}
			},
			{
				id: 'export',
				moisture: 11,
				title: m.home_process_export_title(),
				text: m.home_process_export_text(),
				photo: {
					src: picture(m.home_process_export_photo, '/collection/unwashed-nekemte.webp'),
					alt: m.home_process_export_alt()
				}
			}
		]
	};
}

function collection(): CollectionContent {
	const specs = (origin: string, washed: boolean, grade: [number, number]): MetaItem[] => [
		{ label: m.home_collection_label_origin(), value: origin },
		{
			label: m.home_collection_label_process(),
			value: washed ? m.home_collection_process_washed() : m.home_collection_process_unwashed()
		},
		{
			label: m.home_collection_label_grade(),
			value: m.home_collection_grade_range({ from: grade[0], to: grade[1] })
		}
	];
	return {
		eyebrow: m.home_collection_eyebrow(),
		title: m.home_collection_title(),
		tags: [
			{ label: m.home_collection_tag_specialty(), tone: 'leaf' },
			{ label: m.home_collection_tag_certified(), tone: 'sage' },
			{ label: m.home_collection_tag_commercial(), tone: 'lime' }
		],
		cta: { label: m.home_collection_cta({ year: 2026 }), href: '#visit' },
		lots: [
			{
				id: 'unwashed-djimmah',
				title: m.home_collection_unwashed_djimmah_title(),
				photo: {
					src: picture(
						m.home_collection_unwashed_djimmah_photo,
						'/collection/unwashed-djimmah.webp'
					),
					alt: m.home_collection_unwashed_djimmah_alt()
				},
				specs: specs(m.home_collection_unwashed_djimmah_origin(), false, [1, 5])
			},
			{
				id: 'washed-limmu',
				title: m.home_collection_washed_limmu_title(),
				photo: {
					src: picture(m.home_collection_washed_limmu_photo, '/collection/washed-limmu.webp'),
					alt: m.home_collection_washed_limmu_alt()
				},
				specs: specs(m.home_place_limu(), true, [1, 2])
			},
			{
				id: 'washed-gera',
				title: m.home_collection_washed_gera_title(),
				photo: {
					src: picture(m.home_collection_washed_gera_photo, '/collection/washed-gera.webp'),
					alt: m.home_collection_washed_gera_alt()
				},
				specs: specs(m.home_place_gera(), true, [1, 2])
			},
			{
				id: 'unwashed-nekemte',
				title: m.home_collection_unwashed_nekemte_title(),
				photo: {
					src: picture(
						m.home_collection_unwashed_nekemte_photo,
						'/collection/unwashed-nekemte.webp'
					),
					alt: m.home_collection_unwashed_nekemte_alt()
				},
				specs: specs(m.home_place_nekemte(), false, [1, 5])
			}
		]
	};
}

function atlas(): AtlasContent {
	const also = m.home_atlas_also_text();
	return {
		eyebrow: m.home_collection_eyebrow(),
		title: m.home_atlas_title(),
		origins: [
			{
				id: 'jimma',
				altitude: [1400, 2100],
				harvest: [10, 11, 12, 1],
				name: m.home_place_jimma(),
				lat: 7.67,
				lon: 36.83,
				text: m.home_atlas_jimma_text()
			},
			{
				id: 'limu',
				altitude: [1400, 2200],
				harvest: [10, 11, 12, 1],
				name: m.home_place_limu(),
				lat: 8.15,
				lon: 36.95,
				text: m.home_atlas_limu_text()
			},
			{
				id: 'gera',
				altitude: [1800, 2200],
				harvest: [10, 11, 12, 1],
				name: m.home_place_gera(),
				lat: 7.85,
				lon: 36.3,
				text: m.home_atlas_gera_text()
			},
			{
				id: 'nekemte',
				altitude: [1500, 2100],
				harvest: [10, 11, 12, 1],
				name: m.home_place_nekemte(),
				lat: 9.08,
				lon: 36.55,
				text: m.home_atlas_nekemte_text()
			},
			{
				id: 'sidama',
				altitude: [1500, 2200],
				harvest: [11, 12, 1],
				name: m.home_place_sidama(),
				lat: 6.75,
				lon: 38.5,
				text: also
			},
			{
				id: 'yirgacheffe',
				altitude: [1750, 2200],
				harvest: [10, 11, 12, 1],
				name: m.home_place_yirgacheffe(),
				lat: 6.16,
				lon: 38.2,
				text: also
			},
			{
				id: 'guji',
				altitude: [1800, 2300],
				harvest: [11, 12, 1, 2],
				name: m.home_place_guji(),
				lat: 5.7,
				lon: 38.9,
				text: also
			},
			{
				id: 'harar',
				altitude: [1500, 2100],
				harvest: [10, 11, 12, 1, 2],
				name: m.home_place_harar(),
				lat: 9.31,
				lon: 42.12,
				text: also
			}
		]
	};
}

function people(): PeopleContent {
	return {
		eyebrow: m.home_people_eyebrow(),
		lead: { value: 10000, suffix: '', text: m.home_people_lead_text() },
		stats: [
			{ value: 5406, suffix: '', label: m.home_people_stat_certified() },
			{ value: 2000, suffix: '', label: m.home_people_stat_staff() },
			{ value: 4000, suffix: '+', label: m.home_people_stat_seasonal() }
		],
		body: m.home_people_body(),
		photo: {
			src: picture(m.home_people_photo, '/people/drying-beds.webp'),
			alt: m.home_people_photo_alt()
		}
	};
}

function archive(): ArchiveContent {
	return {
		eyebrow: m.home_archive_eyebrow(),
		title: m.home_archive_title(),
		more: m.home_archive_more(),
		notes: [
			{
				id: 'afcce-22',
				date: '2026-06-09',
				title: m.home_archive_afcce_title(),
				href: '#archive'
			},
			{ id: 'coe-record', date: '2024-12-25', title: m.home_archive_coe_title(), href: '#archive' },
			{
				id: 'production-doubles',
				date: '2024-12-25',
				title: m.home_archive_production_title(),
				href: '#archive'
			},
			{ id: 'eudr', date: '2024-12-25', title: m.home_archive_eudr_title(), href: '#archive' }
		]
	};
}

const PHONE = '+251 912 605 824';
const EMAIL = 'info@kebenageneraltrading.com';

function visit(): VisitContent {
	return {
		eyebrow: m.home_visit_eyebrow(),
		title: m.home_visit_title(),
		photo: picture(m.home_visit_photo, '/tour/building.webp'),
		rows: [
			{ label: m.contact_address(), value: m.contact_address_value() },
			{ label: m.contact_hours(), value: m.contact_hours_value() },
			{ label: m.contact_phone(), value: PHONE },
			{ label: m.contact_email(), value: EMAIL }
		],
		directions: {
			label: m.contact_directions(),
			href: 'https://www.google.com/maps/search/?api=1&query=Coffee+cup+building+Jimma+Ethiopia'
		},
		call: { label: m.home_visit_call(), href: 'tel:+251912605824' },
		place: { name: m.home_visit_place_name(), area: m.home_visit_place_area() },
		beats: [m.home_visit_beat_arrive(), m.home_visit_beat_inside()],
		tags: [
			m.home_visit_tag_halls(),
			m.home_visit_tag_tours(),
			m.home_visit_tag_ceremony(),
			m.home_visit_tag_tastings(),
			m.home_visit_tag_events(),
			m.home_visit_tag_shop()
		]
	};
}

/** The footer under every museum and site page. */
export function footerContent(): FooterContent {
	return {
		brand: m.home_footer_brand(),
		tagline: m.site_footer_tagline(),
		columns: [
			{
				title: m.site_footer_museum(),
				links: [
					{ label: m.home_halls_eyebrow(), href: '/#halls' },
					{ label: m.home_halls_farms_title(), href: '/#farms' },
					{ label: m.home_halls_collection_title(), href: '/#collection' },
					{ label: m.home_archive_eyebrow(), href: '/#archive' },
					{ label: m.site_nav_history(), href: '/history' },
					{ label: m.site_footer_kingdoms(), href: '/kingdoms' }
				]
			},
			{
				title: m.site_nav_visit(),
				links: [
					{ label: m.site_footer_tickets(), href: '/visit' },
					{ label: m.site_nav_experiences(), href: '/experiences' },
					{ label: m.site_footer_events(), href: '/events' },
					{ label: m.site_footer_groups(), href: '/groups' },
					{ label: m.site_footer_membership(), href: '/membership' },
					{ label: m.site_nav_contact(), href: '/contact' }
				]
			},
			{
				title: m.site_footer_coffee(),
				links: [
					{ label: m.site_nav_shop(), href: '/shop' },
					{ label: m.site_footer_subscriptions(), href: '/subscriptions' },
					{ label: m.site_footer_wholesale(), href: '/wholesale' },
					{ label: m.site_footer_track(), href: '/track' }
				]
			},
			{
				title: m.home_footer_company(),
				links: [
					{ label: m.home_footer_overview(), href: '/#entrance' },
					{ label: m.home_footer_import(), href: '/#people' },
					{ label: m.home_footer_social(), href: '/#people' },
					{ label: m.home_footer_hospital(), href: '#' },
					{ label: m.home_footer_export(), href: '#' }
				]
			},
			{
				title: m.home_footer_follow(),
				// the networks' own names, the same in every language
				links: [
					{ label: 'Facebook', href: '#' },
					{ label: 'Instagram', href: '#' },
					{ label: 'LinkedIn', href: '#' }
				]
			}
		],
		legal: `© ${m.home_footer_legal_name()} ${m.site_footer_rights()}`,
		contact: `${m.home_footer_hours()} · ${PHONE}`
	};
}

/** The whole home page, in the language of the current request. */
export function museumContent(): MuseumContent {
	return {
		entrance: entrance(),
		halls: halls(),
		journey: journey(),
		farms: farms(),
		process: process(),
		collection: collection(),
		atlas: atlas(),
		people: people(),
		archive: archive(),
		visit: visit(),
		footer: footerContent()
	};
}

/**
 * The same content, part by part: each read builds that part in the current language. Prefer
 * `museumContent()` or `footerContent()`; this stays for older callers (`museum.footer`).
 */
export const museum: MuseumContent = {
	get entrance() {
		return entrance();
	},
	get halls() {
		return halls();
	},
	get journey() {
		return journey();
	},
	get farms() {
		return farms();
	},
	get process() {
		return process();
	},
	get collection() {
		return collection();
	},
	get atlas() {
		return atlas();
	},
	get people() {
		return people();
	},
	get archive() {
		return archive();
	},
	get visit() {
		return visit();
	},
	get footer() {
		return footerContent();
	}
};

/* ------------------------------------------------------------------ */
/* Dev-only stress fixtures. Plausible values, never random filler.    */
/* ------------------------------------------------------------------ */

function worstFrom(base: MuseumContent): MuseumContent {
	const { entrance, halls, journey, farms, process, collection, atlas, people, archive, visit } =
		base;
	return {
		...base,
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
				r.value === EMAIL ? { ...r, value: 'bartholomew.fitzgerald@kebenageneraltrading.com' } : r
			)
		},
		entrance: {
			...entrance,
			// Ethiopic glyphs are taller than Latin
			eyebrow: 'Hall 00 · Entrance · መግቢያ',
			title: 'A living museum of Ethiopian coffee, from Limu and Gera to Seka Chekorsa',
			body: [
				entrance.body[0],
				'ይህ ድረ-ገጽ የእኛ ሙዚየም ነው። ከደጋው አፈር ዘር እስከ ስኒዎ ቡና ድረስ አምስቱን አዳራሾች ይጎብኙ።'
			],
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
}

export type DataMode = 'demo' | 'worst' | 'empty' | 'one';
export const DATA_MODES: DataMode[] = ['demo', 'worst', 'empty', 'one'];

/** The home page's content in the current language; the dev stress fixtures are built on it. */
export function museumFor(mode: DataMode): MuseumContent {
	const base = museumContent();
	if (mode === 'worst') return worstFrom(base);
	const { entrance, halls, journey, farms, process, collection, atlas, people, archive } = base;
	if (mode === 'empty')
		return {
			...base,
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
			...base,
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
	return base;
}
