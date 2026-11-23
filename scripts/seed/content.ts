/**
 * The website's content: pages, blog posts, the AI knowledge base, the media library, the 360°
 * tour and the agent's conversations. Reads products, lots, stations, locations and customers from
 * the base seed; bookables and events are pointed at when the bookings and visits seeds made them.
 */
import { eq } from 'drizzle-orm';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { db, schema as s, insertId, L, between, pick, rand, daysFrom } from './db.ts';
import { userIdByEmail } from './base.ts';

/**
 * A placeholder picture: a PNG gradient from one brand colour to another, written to the upload
 * store, so seeded media, covers and panoramas show something rather than a broken image.
 */
const FILES_DIR = process.env.FILES_DIR ?? '.tempFiles';
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
	let c = n;
	for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	return c >>> 0;
});
const crc32 = (buf: Buffer) => {
	let c = 0xffffffff;
	for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type: string, data: Buffer) => {
	const len = Buffer.alloc(4);
	len.writeUInt32BE(data.length);
	const td = Buffer.concat([Buffer.from(type), data]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(td));
	return Buffer.concat([len, td, crc]);
};
function placeholder(name: string, w: number, h: number, from: number[], to: number[]) {
	const rows: Buffer[] = [];
	for (let y = 0; y < h; y++) {
		const row = Buffer.alloc(1 + w * 3);
		for (let x = 0; x < w; x++) {
			const t = (x / w) * 0.7 + (y / h) * 0.3;
			for (let c = 0; c < 3; c++) row[1 + x * 3 + c] = Math.round(from[c] + (to[c] - from[c]) * t);
		}
		rows.push(row);
	}
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(w, 0);
	ihdr.writeUInt32BE(h, 4);
	ihdr[8] = 8;
	ihdr[9] = 2;
	const png = Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk('IHDR', ihdr),
		chunk('IDAT', deflateSync(Buffer.concat(rows))),
		chunk('IEND', Buffer.alloc(0))
	]);
	mkdirSync(FILES_DIR, { recursive: true });
	writeFileSync(join(FILES_DIR, name), png);
	return png.length;
}
const GREEN = [46, 125, 80];
const BROWN = [101, 67, 33];
const CREAM = [245, 236, 220];

const html = (...paragraphs: string[]) => paragraphs.map((p) => (p.startsWith('<') ? p : `<p>${p}</p>`)).join('');
const body = (en: string, am?: string) => ({
	en: [{ type: 'html', html: en }],
	...(am ? { am: [{ type: 'html', html: am }] } : {})
});

const PAGES = [
	{
		slug: 'home',
		title: L('Kebena Coffee Museum', 'የቀበና ቡና ሙዚየም'),
		template: 'default',
		menu: false,
		en: html(
			'<h2>Ethiopia, the birthplace of coffee</h2>',
			'Thirty years of growing and trading coffee in the Jimma zone, now open to visitors: walk through the story of coffee in our indoor halls, join a ceremony in the square, and take home beans roasted a few steps away.',
			'<ul><li>Timed entry, Tuesday to Sunday</li><li>Traditional coffee ceremony every afternoon</li><li>Fresh roasted coffee in the museum shop</li></ul>'
		),
		am: html(
			'<h2>ኢትዮጵያ — የቡና መገኛ</h2>',
			'በጅማ ዞን ለሠላሳ ዓመታት ቡና ያመረትንና የነገድን ቤተሰብ ነን። አሁን ለጎብኚዎች ክፍት ነን፤ የቡናን ታሪክ ይጎብኙ፣ በአደባባዩ የቡና ሥነ ሥርዓት ይካፈሉ፣ ትኩስ የተቆላ ቡና ይዘው ይሂዱ።'
		)
	},
	{
		slug: 'our-story',
		title: L('Our story', 'የእኛ ታሪክ'),
		template: 'history',
		menu: true,
		en: html(
			'<h2>A family of coffee people</h2>',
			'Kebena General Trading PLC is a family business that has grown and traded coffee in the Jimma zone for more than thirty years. Our sister company, Haider Abamecha Coffee Export, carries our green coffee to roasters around the world.',
			'Eight washing stations — three of them Rainforest Alliance certified — and four dry mills in the Limu, Mana and Goma districts work with about 10,000 outgrower farmers. Our own farms at Gera and Djimmah grow coffee under native forest shade.',
			'<blockquote>The museum is how we share what we have learned with the people who drink our coffee.</blockquote>'
		),
		am: html('<h2>የቡና ቤተሰብ</h2>', 'ቀበና ጠቅላላ ንግድ ኃ.የተ.የግ.ማ. በጅማ ዞን ከሠላሳ ዓመታት በላይ ቡና ያመረተና የነገደ የቤተሰብ ድርጅት ነው።')
	},
	{
		slug: 'origins',
		title: L('Where our coffee comes from', 'ቡናችን ከየት ይመጣል'),
		template: 'origins',
		menu: true,
		en: html(
			'<h2>Limu, Mana, Goma, Gera and Djimmah</h2>',
			'Every bag carries a QR code that opens its roast batch, the lots it was roasted from, and the station and farmers behind them.',
			'<h3>Processing</h3><ul><li><strong>Washed</strong> — bright and floral: Limu, Gera</li><li><strong>Natural</strong> — fruity and full: Djimmah, Mana</li><li><strong>Honey and anaerobic</strong> — small experimental lots</li></ul>'
		),
		am: html('<h2>ሊሙ፣ ማና፣ ጎማ፣ ገራ እና ጅማ</h2>', 'እያንዳንዱ ከረጢት የቆላውን ባች፣ ምንጩን ሎትና ጣቢያውን የሚያሳይ QR ኮድ አለው።')
	},
	{
		slug: 'visit',
		title: L('Plan your visit', 'ጉብኝትዎን ያቅዱ'),
		template: 'visit',
		menu: true,
		en: html(
			'<h2>Opening hours</h2>',
			'Tuesday to Sunday, 09:00 to 18:00 (last entry 17:00). Closed on Mondays, Genna and Timket.',
			'<h2>Tickets</h2>',
			'Entry is by one-hour time slot. Ethiopian residents pay the resident price on showing a valid Ethiopian ID; foreign visitors pay the visitor price. Children under six enter free.',
			'<h2>Getting here</h2>',
			'We are in Kebena, Addis Ababa. Site A holds the indoor halls and the shop; Site B is the outdoor square and the ceremony area.'
		),
		am: html('<h2>የመክፈቻ ሰዓት</h2>', 'ከማክሰኞ እስከ እሑድ፣ ከ3:00 እስከ 12:00። ሰኞ ዝግ ነው።')
	},
	{
		slug: 'coffee-ceremony',
		title: L('The coffee ceremony', 'የቡና ሥነ ሥርዓት'),
		template: 'default',
		menu: true,
		parent: 'visit',
		en: html(
			'Green beans washed and roasted over charcoal, ground by hand and brewed three times in the jebena: abol, tona and baraka.',
			'Ceremonies run every afternoon in the Site B ceremony area and can be booked for groups.'
		),
		am: html('አረንጓዴ ቡና በከሰል ተቆልቶ፣ በሙቀጫ ተወቅጦ በጀበና ሦስት ጊዜ ይፈላል፤ አቦል፣ ቶና እና በረካ።')
	},
	{
		slug: 'health-and-coffee',
		title: L('Coffee and health', 'ቡና እና ጤና'),
		template: 'health',
		menu: false,
		en: html(
			'What research says about coffee, caffeine and everyday health — and how roast level changes what is in your cup.',
			'<p><em>This page is general information, not medical advice.</em></p>'
		)
	},
	{
		slug: 'wholesale',
		title: L('Wholesale & export', 'ጅምላ እና ኤክስፖርት'),
		template: 'default',
		menu: true,
		en: html(
			'Cafés, hotels, offices and retailers in Ethiopia can apply for a wholesale account with quantity pricing from 5 kg.',
			'For green coffee export, request a sample through our export enquiry form.'
		)
	},
	{
		slug: 'contact',
		title: L('Contact us', 'ያግኙን'),
		template: 'contact',
		menu: true,
		en: html(
			'<strong>Kebena General Trading PLC</strong><br>Foziana Building, 1st floor, Office C1, Labu, Nefas Silk-Lafto, Addis Ababa',
			'Phone and WhatsApp: +251 912 605 824<br>Email: info@kebenageneraltrading.com',
			'Office hours: Monday to Friday, 08:30–17:00.'
		),
		am: html('ፎዚያና ሕንፃ፣ 1ኛ ፎቅ፣ ቢሮ C1፣ ላቡ፣ ንፋስ ስልክ-ላፍቶ፣ አዲስ አበባ', 'ስልክ፡ +251 912 605 824')
	},
	{
		slug: 'press-kit',
		title: L('Press kit'),
		template: 'default',
		menu: false,
		status: 'draft',
		en: html('Logos, photographs and fact sheet — coming soon.')
	}
];

const CATEGORIES = [
	{ slug: 'origin-trips', name: L('Origin trips', 'የምንጭ ጉዞዎች') },
	{ slug: 'brewing', name: L('Brewing', 'አፈላል') },
	{ slug: 'museum-news', name: L('Museum news', 'የሙዚየም ዜና') },
	{ slug: 'events', name: L('Events', 'ዝግጅቶች') }
];

const POSTS: { slug: string; title: [string, string?]; cat: string; status: 'published' | 'draft'; days: number; paragraphs: string[] }[] = [
	{ slug: 'harvest-at-limu', title: ['Harvest season at Limu', 'የሊሙ የመከር ወቅት'], cat: 'origin-trips', status: 'published', days: -80, paragraphs: ['Picking starts in October at our Limu washing station, where cherries arrive from 1,850 outgrower farmers.', 'Only ripe red cherries go to the pulper; the rest are sorted out by hand on the receiving tables.', 'After fermentation and washing, the parchment dries on raised beds for up to twelve days.'] },
	{ slug: 'how-to-brew-jebena-coffee', title: ['How to brew coffee in a jebena', 'በጀበና ቡና እንዴት እንደሚፈላ'], cat: 'brewing', status: 'published', days: -70, paragraphs: ['A jebena is a clay pot with a long neck. Ground coffee goes straight into boiling water.', 'Let it rise, take it off the heat, and let it settle before pouring in one smooth stream.', 'Use our Jebena grind — fine, but not as fine as espresso.'] },
	{ slug: 'museum-opening', title: ['The museum opens its doors', 'ሙዚየሙ ተከፈተ'], cat: 'museum-news', status: 'published', days: -60, paragraphs: ['After two years of building, the Kebena Coffee Museum welcomed its first visitors.', 'Site A holds the indoor halls; Site B, the square where ceremonies take place.'] },
	{ slug: 'washed-vs-natural', title: ['Washed or natural? Tasting the difference'], cat: 'brewing', status: 'published', days: -55, paragraphs: ['Washed coffees are bright, floral and clean; naturals are fruit-forward and heavier.', 'Try our Washed Limu next to the Unwashed Djimmah to taste it yourself.'] },
	{ slug: 'gera-farm-under-the-forest', title: ['Gera: coffee under the forest', 'ገራ፡ በደን ጥላ ሥር ያለ ቡና'], cat: 'origin-trips', status: 'published', days: -48, paragraphs: ['Our Gera farm grows coffee under native forest shade at up to 2,200 metres.', 'Slow ripening at altitude gives the floral, apricot notes of our Washed Gera Grade 1.'] },
	{ slug: 'meskel-at-the-museum', title: ['Meskel at the museum', 'መስቀል በሙዚየሙ'], cat: 'events', status: 'published', days: -40, paragraphs: ['On Meskel we open with shorter hours and a special ceremony in the square.'] },
	{ slug: 'cupping-classes', title: ['Cupping classes are here'], cat: 'events', status: 'published', days: -30, paragraphs: ['Learn to taste like a coffee buyer: fragrance, aroma, acidity, body and finish.', 'Classes run on Saturdays and can be booked online.'] },
	{ slug: 'roast-days', title: ['Why we roast on Tuesdays and Fridays'], cat: 'museum-news', status: 'published', days: -21, paragraphs: ['Specialty lots are roasted to order, so they reach you within days of roasting.', 'Grouping orders on fixed roast days keeps every batch full and every roast consistent.'] },
	{ slug: 'storing-coffee-at-home', title: ['Keeping coffee fresh at home', 'ቡናን በቤት ውስጥ ትኩስ ማቆየት'], cat: 'brewing', status: 'published', days: -14, paragraphs: ['Keep beans whole, in the bag they came in, away from light and heat.', 'Grind just before brewing — ground coffee loses its aroma within hours.'] },
	{ slug: 'rainforest-alliance', title: ['What Rainforest Alliance certification means'], cat: 'origin-trips', status: 'published', days: -9, paragraphs: ['About 5,400 of the farmers we work with are RFA certified.', 'Certification covers forest protection, fair working conditions and farmer training.'] },
	{ slug: 'school-visits-2027', title: ['School visits for 2027'], cat: 'museum-news', status: 'draft', days: -3, paragraphs: ['Bookings for school groups open in January. Teachers can request dates through the group booking form.'] },
	{ slug: 'timket-closure', title: ['Closed for Timket'], cat: 'museum-news', status: 'draft', days: -1, paragraphs: ['The museum is closed on Timket. The shop takes online orders as usual.'] }
];

const KNOWLEDGE: [string, string, string, string?, string?][] = [
	['hours', 'When is the museum open?', 'Tuesday to Sunday, 09:00–18:00, last entry at 17:00. Closed on Mondays and on Genna and Timket.', 'ሙዚየሙ መቼ ክፍት ነው?', 'ከማክሰኞ እስከ እሑድ ከ3:00 እስከ 12:00 ክፍት ነው።'],
	['hours', 'Is Site B open the same hours?', 'Yes, both sites open together; the outdoor square may close at 17:30 in the rainy season.'],
	['hours', 'Are you open on holidays?', 'We open with shorter hours on Meskel and close on Genna and Timket. Check the visit page for special hours.'],
	['tickets', 'How much is a ticket?', 'Adult tickets are priced separately for Ethiopian residents and foreign visitors. Students and children 6–12 pay less; under 6 is free.', 'የመግቢያ ዋጋ ስንት ነው?', 'ለኢትዮጵያ ነዋሪዎችና ለውጭ ጎብኚዎች የተለያየ ዋጋ አለ።'],
	['tickets', 'Do I need to book a time slot?', 'Yes. Entry is by one-hour slot, so the halls never get crowded. Book online or at the desk if space is left.'],
	['tickets', 'What ID do residents need?', 'A valid Ethiopian ID (Kebele ID, passport or driving licence) checked at the door.'],
	['tickets', 'Can I change my visit date?', 'Yes, up to 24 hours before your slot, from the link in your e-ticket.'],
	['tickets', 'Can I get a refund on a ticket?', 'Tickets are refundable up to 48 hours before the slot, less the payment fee. If we close the museum, you are refunded in full.'],
	['tickets', 'Do you offer group or school visits?', 'Yes. Groups of ten or more and schools book through the group booking form and can pay by invoice.'],
	['delivery', 'Where do you deliver?', 'Our riders deliver across Addis Ababa, priced by zone. Outside Addis we send by courier.', 'የት ድረስ ታደርሳላችሁ?', 'በአዲስ አበባ ውስጥ በራሳችን አድራሾች እናደርሳለን።'],
	['delivery', 'Is delivery free?', 'Delivery is free above 2,500 ETB in central Addis, and always free for members.'],
	['delivery', 'Can I collect my order?', 'Yes, choose pickup at the museum shop and show the QR code from your confirmation.'],
	['delivery', 'How long does delivery take?', 'Coffee from stock is dispatched within one working day; roast-to-order coffee within three, after the next roast day.'],
	['roasting', 'When do you roast?', 'Specialty lots are roasted to order on Tuesdays and Fridays. Core blends are roasted ahead and sold from stock.'],
	['roasting', 'Which grind should I choose?', 'Whole bean keeps longest. Choose Jebena for a traditional pot, Espresso for a machine, Filter for pour-over and French press for a plunger.'],
	['refunds', 'Can I cancel an order?', 'You can cancel online until roasting starts (roast-to-order) or until your order is packed (stock coffee).'],
	['refunds', 'How are refunds paid?', 'Back to the card or wallet you paid with, usually within five working days.'],
	['memberships', 'What do members get?', 'Free entry for a year, 10% off in the shop, free delivery and members-only events.', 'አባላት ምን ያገኛሉ?', 'ለአንድ ዓመት ነፃ መግቢያ፣ በሱቁ 10% ቅናሽ እና ነፃ ማድረስ።'],
	['memberships', 'How do I renew my membership?', 'We send a reminder with a payment link 14 days before it ends. Membership stays active for 7 days of grace.'],
	['memberships', 'Is there a family membership?', 'Yes, the Family plan covers two adults and up to three children, each with their own card.'],
	['subscriptions', 'How do coffee subscriptions work?', 'Buy a bundle of 3, 6 or 12 deliveries, every two weeks or monthly. You can skip, pause or change your coffee online.'],
	['subscriptions', 'Can I pause my subscription?', 'Yes, until two days before the next roast day.'],
	['wholesale', 'Do you sell wholesale?', 'Yes, to cafés, hotels, offices and retailers with a trade licence and TIN, from 5 kg per order.'],
	['wholesale', 'Can I buy green coffee for export?', 'Yes, through our sister company Haider Abamecha Coffee Export. Request a sample through the export enquiry form.'],
	['payments', 'How can I pay?', 'Online by card, telebirr or CBE Birr through Chapa. Cash and card at the museum desk. No cash on delivery.']
];

const CHAT_OPENERS: [string, string, string][] = [
	['en', 'Hi, are you open on Monday?', 'We are closed on Mondays. We are open Tuesday to Sunday, 09:00–18:00, last entry 17:00.'],
	['am', 'ሰላም፣ የመግቢያ ዋጋ ስንት ነው?', 'ለኢትዮጵያ ነዋሪዎችና ለውጭ ጎብኚዎች የተለያየ ዋጋ አለ፤ ዝርዝሩን በጉብኝት ገጹ ላይ ያገኛሉ።'],
	['en', 'Do you deliver to Bole?', 'Yes, Bole is in our central zone: delivery is 100 ETB, free above 2,500 ETB.'],
	['en', 'Where is my order KC-26-000012?', 'Your order was packed this morning and is out for delivery; the rider will call before arriving.'],
	['en', 'Which coffee is best for espresso?', 'Our Kebena House Blend in a medium roast works well; choose the Espresso grind or whole bean.'],
	['am', 'ቡና መቼ ትቆላላችሁ?', 'ልዩ ቡናዎችን ማክሰኞና ዓርብ እንቆላለን።'],
	['en', 'Can I book a coffee ceremony for 12 people?', 'Yes — I can pass you to the team to confirm a date. What day were you thinking of?'],
	['en', 'I want a refund for a damaged bag', 'I am sorry about that. I am handing you to a member of staff who can arrange a refund.'],
	['en', 'Do you have decaf?', 'Not at the moment — all our coffee is single-origin Ethiopian arabica.'],
	['am', 'የአባልነት ዋጋ ስንት ነው?', 'የግል እና የቤተሰብ አባልነት አለን፤ ዋጋዎቹ በአባልነት ገጹ ላይ ናቸው።']
];

export async function seed() {
	const editor = await userIdByEmail('editor@kebena.coffee');
	const owner = await userIdByEmail('owner@kebena.coffee');
	const desk = await userIdByEmail('desk@kebena.coffee');
	const manager = await userIdByEmail('manager@kebena.coffee');

	const MEDIA_HERO = ['seed-hero-halls.png', 'seed-limu-station.png', 'seed-gera-forest.png'];
	MEDIA_HERO.forEach((name, i) => placeholder(name, 320, 180, i % 2 ? GREEN : BROWN, CREAM));

	// ── Pages ────────────────────────────────────────────────────────────────────────────────
	const pageIds = new Map<string, number>();
	for (const [i, p] of PAGES.entries()) {
		const published = (p.status ?? 'published') === 'published';
		const id = await insertId(s.page, {
			slug: p.slug,
			parentId: p.parent ? pageIds.get(p.parent) : null,
			template: p.template,
			title: p.title,
			body: body(p.en, p.am),
			seoTitle: L(`${p.title.en} | Kebena Coffee`),
			seoDescription: L(p.en.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150)),
			heroImage: i < 3 ? MEDIA_HERO[i] : null,
			showInMenu: p.menu,
			sortOrder: i,
			publishStatus: p.status ?? 'published',
			publishedAt: published ? daysFrom(-90 + i) : null,
			createdBy: editor,
			createdAt: daysFrom(-100 + i),
			updatedBy: i % 3 === 0 ? owner : editor
		});
		pageIds.set(p.slug, id);
	}

	// ── Blog ─────────────────────────────────────────────────────────────────────────────────
	const catIds = new Map<string, number>();
	for (const c of CATEGORIES) catIds.set(c.slug, await insertId(s.postCategory, c));
	for (const [i, p] of POSTS.entries()) {
		const text = p.paragraphs.join(' ');
		const cover = `seed-cover-${p.slug}.png`;
		placeholder(cover, 480, 270, i % 2 ? GREEN : BROWN, CREAM);
		await insertId(s.post, {
			slug: p.slug,
			categoryId: catIds.get(p.cat),
			title: L(...(p.title as [string, string?])),
			excerpt: L(text.slice(0, 180)),
			body: body(html(...p.paragraphs), p.title[1] ? html(`${p.title[1]} — ${p.paragraphs[0]}`) : undefined),
			coverImage: cover,
			authorId: rand() < 0.75 ? editor : owner,
			seoTitle: L(`${p.title[0]} | Kebena Coffee`),
			publishStatus: p.status,
			publishedAt: p.status === 'published' ? daysFrom(p.days) : null,
			createdBy: editor,
			createdAt: daysFrom(p.days - 2),
			updatedBy: editor
		});
	}

	// ── Knowledge base ───────────────────────────────────────────────────────────────────────
	for (const [i, [topic, qEn, aEn, qAm, aAm]] of KNOWLEDGE.entries()) {
		await db.insert(s.knowledgeEntry).values({
			topic,
			question: qAm ? L(qEn, qAm) : L(qEn),
			answer: aAm ? L(aEn, aAm) : L(aEn),
			tags: [topic, ...(qEn.toLowerCase().match(/ticket|delivery|refund|member|roast|wholesale|pay/g) ?? [])],
			isPublicFaq: i % 3 !== 2,
			sortOrder: i,
			// Most were embedded; the last few were edited since and wait for the indexer.
			embeddingUpdatedAt: i < KNOWLEDGE.length - 5 ? daysFrom(-between(1, 20)) : null,
			createdBy: editor,
			createdAt: daysFrom(-between(20, 60))
		});
	}

	// ── Media ────────────────────────────────────────────────────────────────────────────────
	const MEDIA: [string, string, string, string][] = [
		['seed-hero-halls.png', 'image/png', 'pages', 'The indoor halls of Site A'],
		['seed-ceremony.png', 'image/png', 'pages', 'A coffee ceremony in the square'],
		['seed-limu-station.png', 'image/png', 'origins', 'Drying beds at the Limu washing station'],
		['seed-gera-forest.png', 'image/png', 'origins', 'Coffee under forest shade at Gera'],
		['seed-roaster.png', 'image/png', 'blog', 'The roaster on a Tuesday roast day'],
		['seed-cupping.png', 'image/png', 'blog', 'A cupping table set for a class'],
		['seed-shop.png', 'image/png', 'pages', 'Bags on the shelves of the museum shop'],
		['seed-jebena.png', 'image/png', 'blog', 'A jebena and sini cups'],
		['seed-map-origins.png', 'image/png', 'origins', 'Map of the Jimma zone stations'],
		['seed-press-banner.png', 'image/png', 'press', 'Press banner']
	];
	for (const [i, [fileName, mimeType, folder, alt]] of MEDIA.entries()) {
		const sizeBytes = placeholder(fileName, 320, 180, i % 2 ? GREEN : BROWN, i % 3 ? CREAM : GREEN);
		await db.insert(s.media).values({
			fileName,
			mimeType,
			sizeBytes,
			width: 320,
			height: 180,
			alt: L(alt),
			caption: rand() < 0.5 ? L(alt) : null,
			folder,
			createdBy: rand() < 0.7 ? editor : owner,
			createdAt: daysFrom(-between(5, 90))
		});
	}

	// ── Virtual tour ─────────────────────────────────────────────────────────────────────────
	const loc = async (code: string) =>
		(await db.select({ id: s.location.id }).from(s.location).where(eq(s.location.code, code)))[0].id;
	const siteA = await loc('SITE-A');
	const siteB = await loc('SITE-B');
	const SCENES = [
		{ slug: 'entrance-hall', site: siteA, title: L('Entrance hall', 'መግቢያ አዳራሽ'), start: true },
		{ slug: 'history-of-coffee', site: siteA, title: L('The history of coffee', 'የቡና ታሪክ') },
		{ slug: 'origins-gallery', site: siteA, title: L('Origins gallery', 'የመነሻ ማዕከል') },
		{ slug: 'museum-shop', site: siteA, title: L('Museum shop', 'የሙዚየም ሱቅ') },
		{ slug: 'ceremony-square', site: siteB, title: L('Ceremony square', 'የሥነ ሥርዓት አደባባይ'), start: true }
	];
	const sceneIds: number[] = [];
	for (const [i, sc] of SCENES.entries()) {
		placeholder(`seed-pano-${sc.slug}.png`, 800, 400, BROWN, i % 2 ? GREEN : CREAM);
		placeholder(`seed-pano-${sc.slug}-small.png`, 200, 100, BROWN, i % 2 ? GREEN : CREAM);
		sceneIds.push(
			await insertId(s.tourScene, {
				slug: sc.slug,
				locationId: sc.site,
				title: sc.title,
				description: L(`360° view of the ${sc.title.en.toLowerCase()}.`),
				panorama: `seed-pano-${sc.slug}.png`,
				preview: `seed-pano-${sc.slug}-small.png`,
				initialYaw: between(-180, 180),
				initialPitch: 0,
				isStart: Boolean(sc.start),
				sortOrder: i,
				createdBy: editor
			})
		);
	}
	const firstId = async (table: typeof s.product | typeof s.station | typeof s.lot | typeof s.event) =>
		(await db.select({ id: table.id }).from(table).limit(3)).map((r) => r.id);
	const [products, stations, lots, events] = await Promise.all([
		firstId(s.product),
		firstId(s.station),
		firstId(s.lot),
		firstId(s.event)
	]);
	const spot = (sceneId: number, kind: string, title: string, target: Record<string, unknown>, i: number) =>
		db.insert(s.tourHotspot).values({
			sceneId,
			kind: kind as (typeof s.tourHotspot.$inferInsert)['kind'],
			yaw: between(-170, 170),
			pitch: between(-20, 20),
			title: L(title),
			body: L(`${title} — tap to learn more.`),
			sortOrder: i,
			createdBy: editor,
			...target
		});
	await spot(sceneIds[0], 'scene', 'Into the history hall', { targetSceneId: sceneIds[1] }, 0);
	await spot(sceneIds[0], 'info', 'Welcome desk', {}, 1);
	await spot(sceneIds[0], 'link', 'Kebena General Trading', { url: 'https://kebenageneraltrading.com' }, 2);
	await spot(sceneIds[1], 'scene', 'On to the origins gallery', { targetSceneId: sceneIds[2] }, 0);
	await spot(sceneIds[1], 'info', 'Kaldi and the dancing goats', {}, 1);
	if (events[0]) await spot(sceneIds[1], 'info', 'Upcoming talk', { eventId: events[0] }, 2);
	await spot(sceneIds[2], 'origin_map', 'Limu washing station', { stationId: stations[0] }, 0);
	await spot(sceneIds[2], 'origin_map', 'Mana washing station', { stationId: stations[1] }, 1);
	await spot(sceneIds[2], 'lot', 'This season’s Limu lot', { lotId: lots[0] }, 2);
	await spot(sceneIds[2], 'scene', 'To the shop', { targetSceneId: sceneIds[3] }, 3);
	await spot(sceneIds[3], 'product', 'Kebena House Blend', { productId: products[0] }, 0);
	await spot(sceneIds[3], 'product', 'Washed Limu Grade 1', { productId: products[1] }, 1);
	await spot(sceneIds[3], 'scene', 'Out to the square', { targetSceneId: sceneIds[4] }, 2);
	const [ceremony] = await db.select({ id: s.bookable.id }).from(s.bookable).where(eq(s.bookable.slug, 'coffee-ceremony'));
	if (ceremony) await spot(sceneIds[4], 'booking', 'Book a coffee ceremony', { bookableId: ceremony.id }, 0);
	else await spot(sceneIds[4], 'info', 'Coffee ceremony every afternoon', {}, 0);
	await spot(sceneIds[4], 'scene', 'Back to the entrance', { targetSceneId: sceneIds[0] }, 1);

	// ── AI conversations ─────────────────────────────────────────────────────────────────────
	const customers = await db
		.select({ id: s.customer.id, chat: s.customer.telegramChatId })
		.from(s.customer)
		.limit(40);
	const staffIds = [desk, manager];
	for (let i = 0; i < 30; i++) {
		const channel = i % 3 === 0 ? 'telegram' : 'web';
		const [locale, question, answer] = pick(CHAT_OPENERS);
		const customer = rand() < 0.45 ? pick(customers) : null;
		const handedOff = /refund|book|ceremony/i.test(question) && rand() < 0.8 ? pick(staffIds) : null;
		const started = daysFrom(-between(0, 45), between(8, 20), between(0, 59));
		const conversationId = await insertId(s.aiConversation, {
			channel,
			externalId: channel === 'telegram' ? `tg-${between(100000000, 999999999)}` : `web-${Math.floor(rand() * 1e12).toString(36)}`,
			customerId: customer?.id ?? null,
			locale,
			handedOffTo: handedOff,
			startedAt: started
		});
		const turns: { role: string; content: string; model?: string }[] = [
			{ role: 'user', content: question },
			{ role: 'assistant', content: answer, model: 'claude-haiku-4-5' }
		];
		if (rand() < 0.5) {
			turns.push({ role: 'user', content: locale === 'am' ? 'እናመሰግናለን!' : 'Thanks! And do you sell gift boxes?' });
			turns.push({ role: 'assistant', content: locale === 'am' ? 'ስለጎበኙን እናመሰግናለን!' : 'Gift boxes are coming soon; for now our Origins Discovery Set makes a good gift.', model: 'claude-haiku-4-5' });
		}
		if (handedOff) turns.push({ role: 'staff', content: 'Hello, this is the Kebena team — I can help with that. Could you share your order number or preferred date?' });
		let at = started.getTime();
		for (const t of turns) {
			at += between(20, 240) * 1000;
			const isBot = t.role === 'assistant';
			await db.insert(s.aiMessage).values({
				conversationId,
				role: t.role,
				content: t.content,
				model: t.model ?? null,
				inputTokens: isBot ? between(900, 2600) : null,
				outputTokens: isBot ? between(40, 220) : null,
				rating: isBot && rand() < 0.3 ? (rand() < 0.8 ? 1 : -1) : null,
				toolCalls: isBot && /order/i.test(question) ? [{ name: 'order_status', input: { number: 'KC-26-000012' } }] : null,
				createdAt: new Date(at)
			});
		}
		await db.update(s.aiConversation).set({ lastMessageAt: new Date(at) }).where(eq(s.aiConversation.id, conversationId));
	}
}
