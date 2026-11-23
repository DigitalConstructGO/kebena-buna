import { m } from '#lib/i18n.ts';

/** The Kebena Coffee bag. The notes are read off the printed 250 g bag; the larger sizes are placeholders. */
export type BagSize = {
	id: string;
	/** As printed on the bag. */
	weight: string;
	name: string;
	text: string;
	/** How large this bag stands beside the others, 1 being the largest. */
	scale: number;
};

/** The bag's copy, read in the visitor's language; call it while rendering. */
export function bagContent() {
	return {
		eyebrow: m.museum_bag_eyebrow(),
		title: m.museum_bag_title(),
		text: m.museum_bag_text(),
		photo: {
			src: '/hero/bag-front.jpg',
			alt: m.museum_bag_photo_alt(),
			width: 452,
			height: 632
		},
		notes: [
			{ label: m.museum_bag_note_inside_label(), value: m.museum_bag_note_inside_value() },
			{ label: m.museum_bag_note_tasting_label(), value: m.museum_bag_note_tasting_value() },
			{ label: m.museum_bag_note_cup_label(), value: m.museum_bag_note_cup_value() }
		],
		sizes: [
			{
				id: '250',
				weight: '250 g',
				name: m.museum_bag_size_250_name(),
				text: m.museum_bag_size_250_text(),
				scale: 0.76
			},
			{
				id: '500',
				weight: '500 g',
				name: m.museum_bag_size_500_name(),
				text: m.museum_bag_size_500_text(),
				scale: 0.88
			},
			{
				id: '1000',
				weight: '1 kg',
				name: m.museum_bag_size_1000_name(),
				text: m.museum_bag_size_1000_text(),
				scale: 1
			}
		] satisfies BagSize[],
		order: { label: m.museum_bag_order(), all: m.museum_bag_order_all() },
		visit: { label: m.museum_bag_visit(), href: '#visit' },
		contact: { email: 'info@kebenageneraltrading.com', phone: '+251 912 605 824' }
	};
}
