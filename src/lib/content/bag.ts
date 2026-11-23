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

export const bag = {
	eyebrow: 'Take it home',
	title: 'The museum, in a bag.',
	text: 'Everything you have walked through, from the highland farm to the cup. Pick a bag up and turn it round.',
	photo: {
		src: '/hero/bag-front.jpg',
		alt: 'The front of a bag of Kebena Coffee, with line art above green highland hills',
		width: 452,
		height: 632
	},
	notes: [
		{ label: 'Inside', value: '100% Arabica coffee' },
		{ label: 'Tasting notes', value: 'Citrus, floral, chocolate, caramel' },
		{ label: 'In the cup', value: 'Bright, complex, balanced' }
	],
	sizes: [
		{
			id: '250',
			weight: '250 g',
			name: 'The first bag',
			text: 'Enough to get to know it.',
			scale: 0.76
		},
		{
			id: '500',
			weight: '500 g',
			name: 'The house bag',
			text: 'For a home that drinks it daily.',
			scale: 0.88
		},
		{
			id: '1000',
			weight: '1 kg',
			name: 'The ceremony bag',
			text: 'For a full table and three rounds.',
			scale: 1
		}
	] satisfies BagSize[],
	order: { label: 'Order this bag', all: 'Order coffee' },
	visit: { label: 'Or buy it at the museum', href: '#visit' },
	contact: { email: 'info@kebenageneraltrading.com', phone: '+251 912 605 824' }
};
