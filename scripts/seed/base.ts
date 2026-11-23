/**
 * What every other seed leans on: languages, settings, places, taxes, audiences, staff and their
 * roles, the origins (regions, stations, lots), the catalogue, delivery and customers.
 *
 * Codes written here are what later seeds look rows up by — keep them stable.
 */
import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { PERMISSIONS } from '../../src/lib/access.ts';
import { DEFAULT_ROLES, permissionsOf } from '../../src/lib/server/roles.ts';
import { db, schema as s, insertId, L, between, pick, rand, daysFrom } from './db.ts';

export const STAFF_PASSWORD = 'Kebena2026!';

/** Staff sign-ins, one per role, by email. */
export const STAFF = [
	{ email: 'owner@kebena.coffee', name: 'Hirut Abamecha', role: 'Owner' },
	{ email: 'manager@kebena.coffee', name: 'Dawit Haile', role: 'Manager' },
	{ email: 'shop@kebena.coffee', name: 'Selam Tesfaye', role: 'Shop staff' },
	{ email: 'roaster@kebena.coffee', name: 'Abebe Girma', role: 'Roaster' },
	{ email: 'desk@kebena.coffee', name: 'Meron Alemu', role: 'Front desk' },
	{ email: 'scanner@kebena.coffee', name: 'Yonas Bekele', role: 'Ticket scanner' },
	{ email: 'editor@kebena.coffee', name: 'Liya Tadesse', role: 'Content editor' },
	{ email: 'accounts@kebena.coffee', name: 'Kebede Worku', role: 'Accountant' },
	{ email: 'guide1@kebena.coffee', name: 'Tigist Mulugeta', role: 'Front desk' },
	{ email: 'guide2@kebena.coffee', name: 'Samuel Getachew', role: 'Front desk' },
	{ email: 'rider@kebena.coffee', name: 'Biruk Desta', role: 'Shop staff' }
] as const;

/** A user's id by email, for later seeds (`createdBy`, `roasterId`). */
export async function userIdByEmail(email: string) {
	const [row] = await db.select({ id: s.user.id }).from(s.user).where(eq(s.user.email, email));
	return row.id;
}

export async function makeUser(
	email: string,
	name: string,
	opts: { kind?: 'staff' | 'customer'; roleId?: number | null; phone?: string | null } = {}
) {
	const id = randomUUID();
	await db.insert(s.user).values({
		id,
		email,
		name,
		emailVerified: true,
		kind: opts.kind ?? 'staff',
		roleId: opts.roleId ?? null,
		phoneNumber: opts.phone ?? null,
		locale: rand() < 0.6 ? 'am' : 'en',
		createdAt: daysFrom(-between(30, 400))
	});
	await db.insert(s.account).values({
		id: randomUUID(),
		accountId: id,
		providerId: 'credential',
		userId: id,
		password: await hashPassword(STAFF_PASSWORD),
		createdAt: new Date(),
		updatedAt: new Date()
	});
	return id;
}

const FIRST = ['Abel', 'Bethlehem', 'Chaltu', 'Dagim', 'Eden', 'Fikru', 'Genet', 'Hana', 'Henok', 'Kalkidan', 'Lensa', 'Mahlet', 'Nahom', 'Rahel', 'Ruth', 'Saron', 'Tewodros', 'Yared', 'Zewdu', 'Mekdes', 'Lidya', 'Natnael', 'Feven', 'Robel', 'Sara', 'Emma', 'Lukas', 'Sophie', 'Daniel', 'Aisha'];
const LAST = ['Tesfaye', 'Bekele', 'Alemu', 'Girma', 'Haile', 'Kebede', 'Mengistu', 'Wolde', 'Assefa', 'Negash', 'Demissie', 'Tadesse', 'Ayele', 'Lemma', 'Schmidt', 'Rossi', 'Smith', 'Okafor'];

export async function seedBase() {
	// ── Access ────────────────────────────────────────────────────────────────────────────────
	await db.insert(s.permissions).values(PERMISSIONS.map((p) => ({ name: p.name, description: p.description })));
	const perms = await db.select().from(s.permissions);
	const permId = new Map(perms.map((p) => [p.name, p.id]));
	const roleId = new Map<string, number>();
	for (const def of DEFAULT_ROLES) {
		const id = await insertId(s.roles, { name: def.name, description: def.description });
		roleId.set(def.name, id);
		const ids = permissionsOf(def).map((n) => permId.get(n)!).filter(Boolean);
		await db.insert(s.rolePermissions).values(ids.map((permissionId) => ({ roleId: id, permissionId })));
	}
	for (const u of STAFF) await makeUser(u.email, u.name, { roleId: roleId.get(u.role) });
	const owner = await userIdByEmail('owner@kebena.coffee');
	const manager = await userIdByEmail('manager@kebena.coffee');
	// Grants were made by the Owner.
	await db.update(s.rolePermissions).set({ createdBy: owner });

	// ── System ────────────────────────────────────────────────────────────────────────────────
	await db.insert(s.language).values([
		{ code: 'am', name: 'Amharic', nativeName: 'አማርኛ', isRequired: true, isDefault: true, sortOrder: 1 },
		{ code: 'en', name: 'English', nativeName: 'English', isRequired: true, sortOrder: 2 },
		{ code: 'om', name: 'Afaan Oromo', nativeName: 'Afaan Oromoo', isRequired: false, sortOrder: 3 },
		{ code: 'ar', name: 'Arabic', nativeName: 'العربية', isRequired: false, sortOrder: 4 },
		{ code: 'it', name: 'Italian', nativeName: 'Italiano', isRequired: false, sortOrder: 5 },
		{ code: 'fr', name: 'French', nativeName: 'Français', isRequired: false, sortOrder: 6 }
	]);
	await db.insert(s.setting).values([
		{ key: 'delivery.free_above', value: 3000, description: 'Free delivery above this order total (ETB)', updatedBy: owner },
		{ key: 'roast.weekdays', value: [2, 5], description: 'Roast days for roast-to-order (ISO weekdays)', updatedBy: owner },
		{ key: 'stock.green_low_kg', value: 60, description: 'Green-lot low-stock level (kg)', updatedBy: owner },
		{ key: 'stock.roasted_low_kg', value: 10, description: 'Roasted low-stock level (kg)', updatedBy: owner },
		{ key: 'stock.packed_low_units', value: 10, description: 'Packed-bag low-stock level (bags)', updatedBy: owner },
		{ key: 'roast.loss_range', value: { min: 12, max: 20 }, description: 'Acceptable roast weight loss (%)', updatedBy: owner },
		{ key: 'booking.hold_days', value: 7, description: 'Unpaid group holds released after (days)', updatedBy: manager },
		{ key: 'tickets.pay_window_hours', value: 24, description: 'Unpaid web ticket orders cancelled, and their places released, after (hours)', updatedBy: manager },
		{ key: 'refund.window_days', value: 7, description: 'Customer refund window (days)', updatedBy: owner },
		{ key: 'receipt.tin', value: '0012345678', description: 'Kebena TIN printed on receipts', updatedBy: owner },
		{ key: 'receipt.vat_number', value: 'VAT-1234567', description: 'VAT registration printed on receipts', updatedBy: owner },
		{ key: 'notify.review_url', value: 'https://kebenageneraltrading.com', description: 'Review link in the delivered and collected messages', updatedBy: owner },
		{ key: 'notify.renew_url', value: '', description: 'Membership renewal page; the membership number is added (?m=…)', updatedBy: owner },
		{ key: 'notify.top_up_url', value: '', description: 'Subscription top-up page; the subscription number is added (?s=…)', updatedBy: owner },
		{ key: 'alerts.roles', value: { low_stock: ['Manager', 'Roaster'], sales_daily: ['Owner', 'Manager', 'Accountant'], inbox_stale: ['Manager'] }, description: 'Which staff roles get each daily email alert', updatedBy: owner },
		{ key: 'wholesale.min_order_kg', value: 5, description: 'Minimum wholesale order (kg)', updatedBy: owner },
		{ key: 'wholesale.credit_limit_default', value: 50000, description: 'Credit limit offered when credit is approved (ETB)', updatedBy: owner },
		{ key: 'wholesale.credit_days_default', value: 30, description: 'Payment terms offered when credit is approved (days)', updatedBy: owner }
	]);
	await db.insert(s.documentSequence).values([
		{ key: 'order:2026', nextValue: 1 },
		{ key: 'lot:2025', nextValue: 1 }
	]);

	const loc = async (values: Record<string, unknown>) =>
		insertId(s.location, { createdBy: owner, ...values });
	const siteA = await loc({ code: 'SITE-A', name: L('Museum — Site A (indoor halls)', 'ሙዚየም — ሳይት ኤ'), type: 'site', address: 'Kebena, Addis Ababa', latitude: 9.0412, longitude: 38.7872, phone: '+251912605824', admitsVisitors: true, controlsCapacity: true, isPickupPoint: true, sortOrder: 1 });
	const siteB = await loc({ code: 'SITE-B', name: L('Museum — Site B (outdoor square)', 'ሙዚየም — ሳይት ቢ'), type: 'site', address: 'Kebena, Addis Ababa', latitude: 9.0418, longitude: 38.7881, admitsVisitors: true, sortOrder: 2 });
	await loc({ code: 'SHOP', name: L('Museum shop', 'የሙዚየም ሱቅ'), type: 'shop', parentId: siteA, holdsStock: true, sellsAtDesk: true, isPickupPoint: true, sortOrder: 3 });
	await loc({ code: 'CAFE', name: L('Café & ceremony area', 'ካፌ እና የቡና ሥነ ሥርዓት'), type: 'cafe', parentId: siteB, holdsStock: true, sellsAtDesk: true, sortOrder: 4 });
	await loc({ code: 'ROASTERY', name: L('Roastery', 'ቡና ማቁያ'), type: 'roastery', address: 'Labu, Nefas Silk-Lafto', holdsStock: true, sortOrder: 5 });
	await loc({ code: 'WAREHOUSE', name: L('Warehouse & online fulfilment', 'መጋዘን'), type: 'warehouse', address: 'Labu, Nefas Silk-Lafto', holdsStock: true, fulfilsOnline: true, sortOrder: 6 });
	await loc({ code: 'OFFICE', name: L('Head office — Foziana Building', 'ዋና መሥሪያ ቤት'), type: 'office', address: 'Foziana Building, 1st floor, Office C1, Labu', phone: '+251912605824', sortOrder: 7 });

	for (const locationId of [siteA, siteB]) {
		await db.insert(s.openingHours).values(
			[1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
				locationId,
				weekday,
				isClosed: weekday === 1,
				opensAt: weekday === 1 ? null : '09:00:00',
				closesAt: weekday === 1 ? null : '17:00:00',
				lastEntryAt: weekday === 1 ? null : '16:00:00'
			}))
		);
	}
	await db.insert(s.calendarException).values([
		{ date: '2026-09-27', name: L('Meskel', 'መስቀል'), isHoliday: true, isClosed: false, opensAt: '10:00:00', closesAt: '15:00:00', createdBy: manager },
		{ date: '2027-01-07', name: L('Genna (Ethiopian Christmas)', 'ገና'), isHoliday: true, isClosed: true, blocksRoasting: true, createdBy: manager },
		{ date: '2027-01-19', name: L('Timket', 'ጥምቀት'), isHoliday: true, isClosed: true, blocksRoasting: true, createdBy: manager },
		{ date: '2026-12-15', locationId: siteB, name: L('Site B maintenance', 'የጥገና ቀን'), isClosed: true, createdBy: manager }
	]);

	const vat = await insertId(s.taxRate, { code: 'VAT15', name: L('VAT 15%', 'ተ.እ.ታ 15%'), rate: 15, isInclusive: true, isDefault: true });
	await insertId(s.taxRate, { code: 'ZERO', name: L('Zero-rated', 'ዜሮ'), rate: 0, isInclusive: true });
	await db.insert(s.audience).values([
		{ code: 'RES', name: L('Ethiopian resident', 'የኢትዮጵያ ነዋሪ'), colour: '#16a34a', requiresIdCheck: true, declaration: L('I will show a valid Ethiopian ID at entry', 'በመግቢያ ላይ የኢትዮጵያ መታወቂያ አሳያለሁ'), isDefault: true, sortOrder: 1 },
		{ code: 'FOR', name: L('Foreign visitor', 'የውጭ አገር ጎብኚ'), colour: '#2563eb', sortOrder: 2 },
		{ code: 'DIA', name: L('Diaspora', 'ዲያስፖራ'), colour: '#a16207', sortOrder: 3, status: false }
	]);

	// ── Origins ───────────────────────────────────────────────────────────────────────────────
	const region = (values: Record<string, unknown>) => insertId(s.region, values);
	const oromia = await region({ level: 'region', name: L('Oromia', 'ኦሮሚያ') });
	const sidama = await region({ level: 'region', name: L('Sidama', 'ሲዳማ') });
	const jimma = await region({ level: 'zone', parentId: oromia, name: L('Jimma', 'ጅማ'), story: L('Thirty years of family growing and trading in the Jimma zone.') });
	const guji = await region({ level: 'zone', parentId: oromia, name: L('Guji', 'ጉጂ') });
	await region({ level: 'zone', parentId: oromia, name: L('East Hararghe (Harar)', 'ሐረር') });
	await region({ level: 'zone', parentId: sidama, name: L('Yirgacheffe', 'ይርጋጨፌ') });
	const limu = await region({ level: 'woreda', parentId: jimma, name: L('Limu', 'ሊሙ'), story: L('High forest coffee, washed at our own stations.') });
	const mana = await region({ level: 'woreda', parentId: jimma, name: L('Mana', 'ማና') });
	const goma = await region({ level: 'woreda', parentId: jimma, name: L('Goma', 'ጎማ') });
	const gera = await region({ level: 'woreda', parentId: jimma, name: L('Gera', 'ገራ') });

	const rfa = await insertId(s.certification, { code: 'RFA', name: L('Rainforest Alliance'), url: 'https://www.rainforest-alliance.org' });
	const org = await insertId(s.certification, { code: 'ORG', name: L('Organic', 'ኦርጋኒክ') });
	const cafe = await insertId(s.certification, { code: 'CAFE', name: L('C.A.F.E. Practices') });
	const heirloom = await insertId(s.variety, { name: 'Ethiopian heirloom', description: L('Countless local landraces grown together.') });
	const v74110 = await insertId(s.variety, { name: '74110', description: L('Jimma Research Center selection, disease resistant.') });
	const v74112 = await insertId(s.variety, { name: '74112', description: L('Compact, high-yield JARC selection.') });

	const station = (values: Record<string, unknown>) => insertId(s.station, { createdBy: owner, ...values });
	const stations = {
		LIM: await station({ code: 'LIM', name: L('Limu washing station', 'ሊሙ ማጠቢያ'), type: 'washing_station', regionId: limu, altitudeMinM: 1800, altitudeMaxM: 2100, latitude: 8.0912, longitude: 36.9461, farmerCount: 1850, story: L('Our oldest station, on the Gibe river.') }),
		MAN: await station({ code: 'MAN', name: L('Mana washing station', 'ማና ማጠቢያ'), type: 'washing_station', regionId: mana, altitudeMinM: 1750, altitudeMaxM: 2000, farmerCount: 1320 }),
		GOM: await station({ code: 'GOM', name: L('Goma washing station', 'ጎማ ማጠቢያ'), type: 'washing_station', regionId: goma, altitudeMinM: 1600, altitudeMaxM: 1900, farmerCount: 1610 }),
		GER: await station({ code: 'GER', name: L('Gera farm', 'ገራ እርሻ'), type: 'farm', regionId: gera, altitudeMinM: 1900, altitudeMaxM: 2200, farmerCount: 0, story: L('Family estate under native forest shade.') }),
		DJM: await station({ code: 'DJM', name: L('Djimmah farm', 'ጅማ እርሻ'), type: 'farm', regionId: jimma, altitudeMinM: 1700, altitudeMaxM: 2000 }),
		AGR: await station({ code: 'AGR', name: L('Agaro dry mill', 'አጋሮ ደረቅ ወፍጮ'), type: 'dry_mill', regionId: jimma }),
		GUJ: await station({ code: 'GUJ', name: L('Guji partner station'), type: 'washing_station', regionId: guji, altitudeMinM: 1950, altitudeMaxM: 2300, farmerCount: 900, isActive: false })
	};
	await db.insert(s.stationCertification).values([
		{ stationId: stations.LIM, certificationId: rfa },
		{ stationId: stations.MAN, certificationId: rfa },
		{ stationId: stations.GER, certificationId: rfa },
		{ stationId: stations.GER, certificationId: org },
		{ stationId: stations.GOM, certificationId: cafe }
	]);

	const roaster = await userIdByEmail('roaster@kebena.coffee');
	const lots: { code: string; station: keyof typeof stations; region: number; process: string; year: number; grade: number; score: number; notes: string }[] = [
		{ code: 'KGT-LIM-2025-001', station: 'LIM', region: limu, process: 'washed', year: 2025, grade: 1, score: 87.5, notes: 'Jasmine, bergamot, honey' },
		{ code: 'KGT-LIM-2025-002', station: 'LIM', region: limu, process: 'washed', year: 2025, grade: 2, score: 85.25, notes: 'Lemon, black tea' },
		{ code: 'KGT-MAN-2025-001', station: 'MAN', region: mana, process: 'natural', year: 2025, grade: 3, score: 84, notes: 'Blueberry, cocoa' },
		{ code: 'KGT-GOM-2025-001', station: 'GOM', region: goma, process: 'washed', year: 2025, grade: 2, score: 84.75, notes: 'Peach, brown sugar' },
		{ code: 'KGT-GER-2025-001', station: 'GER', region: gera, process: 'washed', year: 2025, grade: 1, score: 88.25, notes: 'Floral, apricot, long finish' },
		{ code: 'KGT-GER-2025-002', station: 'GER', region: gera, process: 'anaerobic', year: 2025, grade: 1, score: 89, notes: 'Strawberry, wine, cacao nib' },
		{ code: 'KGT-DJM-2025-001', station: 'DJM', region: jimma, process: 'natural', year: 2025, grade: 3, score: 82.5, notes: 'Chocolate, dried fruit, spice' },
		{ code: 'KGT-DJM-2024-004', station: 'DJM', region: jimma, process: 'natural', year: 2024, grade: 4, score: 80.5, notes: 'Earthy, dark chocolate' },
		{ code: 'KGT-LIM-2024-011', station: 'LIM', region: limu, process: 'honey', year: 2024, grade: 2, score: 85.5, notes: 'Caramel, red apple' }
	];
	for (const lot of lots) {
		const id = await insertId(s.lot, {
			code: lot.code,
			stationId: stations[lot.station],
			regionId: lot.region,
			process: lot.process,
			cropYear: lot.year,
			grade: lot.grade,
			altitudeM: between(1700, 2150),
			farmerCount: between(80, 600),
			cuppingScore: lot.score,
			tastingNotes: L(lot.notes),
			story: L(`Harvested ${lot.year - 1}/${String(lot.year).slice(2)} and processed at ${lot.station}.`),
			externalRef: rand() < 0.5 ? `ECX-${between(100000, 999999)}` : null,
			lowStockKg: rand() < 0.3 ? 40 : null,
			createdBy: roaster,
			createdAt: daysFrom(-between(40, 300))
		});
		await db.insert(s.lotVariety).values([{ lotId: id, varietyId: heirloom }, ...(rand() < 0.5 ? [{ lotId: id, varietyId: pick([v74110, v74112]) }] : [])]);
		if (['LIM', 'GER', 'MAN'].includes(lot.station)) {
			await db.insert(s.lotCertification).values({ lotId: id, certificationId: rfa, certificateNumber: `RA-${lot.code}` });
		}
	}

	// ── Catalogue ─────────────────────────────────────────────────────────────────────────────
	const editor = await userIdByEmail('editor@kebena.coffee');
	const cat = {
		specialty: await insertId(s.productCategory, { slug: 'specialty', name: L('Specialty', 'ስፔሻሊቲ'), sortOrder: 1 }),
		certified: await insertId(s.productCategory, { slug: 'certified', name: L('Certified', 'የተረጋገጠ'), sortOrder: 2 }),
		commercial: await insertId(s.productCategory, { slug: 'commercial', name: L('Commercial', 'ኮሜርሻል'), sortOrder: 3 }),
		bundles: await insertId(s.productCategory, { slug: 'bundles', name: L('Bundles', 'ጥቅሎች'), sortOrder: 4 }),
		merch: await insertId(s.productCategory, { slug: 'merchandise', name: L('Merchandise', 'ዕቃዎች'), sortOrder: 5 })
	};
	const size = {
		g250: await insertId(s.bagSize, { code: '250G', name: L('250 g', '250 ግ'), grams: 250, sortOrder: 1 }),
		g500: await insertId(s.bagSize, { code: '500G', name: L('500 g', '500 ግ'), grams: 500, sortOrder: 2 }),
		kg1: await insertId(s.bagSize, { code: '1KG', name: L('1 kg', '1 ኪ.ግ'), grams: 1000, sortOrder: 3 })
	};
	const roast = {
		light: await insertId(s.roastLevel, { code: 'LIGHT', name: L('Light', 'ቀላል'), sortOrder: 1 }),
		medium: await insertId(s.roastLevel, { code: 'MEDIUM', name: L('Medium', 'መካከለኛ'), sortOrder: 2 }),
		dark: await insertId(s.roastLevel, { code: 'DARK', name: L('Dark (jebena)', 'ጥቁር (ጀበና)'), description: L('The traditional Ethiopian roast'), sortOrder: 3 })
	};
	const grinds = [
		await insertId(s.grind, { code: 'WHOLE', name: L('Whole bean', 'ሙሉ ፍሬ'), sortOrder: 1 }),
		await insertId(s.grind, { code: 'JEBENA', name: L('Jebena (fine)', 'ጀበና'), sortOrder: 2 }),
		await insertId(s.grind, { code: 'ESPRESSO', name: L('Espresso', 'ኤስፕሬሶ'), sortOrder: 3 }),
		await insertId(s.grind, { code: 'FILTER', name: L('Filter / pour-over', 'ማጣሪያ'), sortOrder: 4 }),
		await insertId(s.grind, { code: 'FRENCH', name: L('French press', 'ፍሬንች ፕሬስ'), sortOrder: 5 })
	];
	const standardBag = await insertId(s.packaging, { code: 'STANDARD', name: L('Standard bag', 'መደበኛ ከረጢት'), sortOrder: 1 });
	const giftBox = await insertId(s.packaging, { code: 'GIFT', name: L('Gift box', 'የስጦታ ሳጥን'), surcharge: 150, sortOrder: 2, status: false });

	const lotId = async (code: string) => (await db.select({ id: s.lot.id }).from(s.lot).where(eq(s.lot.code, code)))[0].id;
	const products: { slug: string; name: [string, string]; cat: number; prices: [number, number, number]; fulfilment: string; roasts: number[]; origin: [keyof typeof stations, string | null][]; wholesale?: boolean; notes: string }[] = [
		{ slug: 'kebena-house-blend', name: ['Kebena House Blend', 'የቀበና ቤት ቅይጥ'], cat: cat.commercial, prices: [450, 850, 1600], fulfilment: 'from_stock', roasts: [roast.medium, roast.dark], origin: [['DJM', 'KGT-DJM-2025-001'], ['LIM', 'KGT-LIM-2025-002']], wholesale: true, notes: 'Chocolate, caramel, balanced' },
		{ slug: 'washed-limu-gr1', name: ['Washed Limu Grade 1', 'የታጠበ ሊሙ ደረጃ 1'], cat: cat.specialty, prices: [650, 1250, 2400], fulfilment: 'from_stock', roasts: [roast.light, roast.medium, roast.dark], origin: [['LIM', 'KGT-LIM-2025-001']], wholesale: true, notes: 'Jasmine, bergamot, honey' },
		{ slug: 'washed-gera-gr1', name: ['Washed Gera Grade 1', 'የታጠበ ገራ ደረጃ 1'], cat: cat.specialty, prices: [700, 1350, 2600], fulfilment: 'roast_to_order', roasts: [roast.light, roast.medium], origin: [['GER', 'KGT-GER-2025-001']], notes: 'Floral, apricot' },
		{ slug: 'unwashed-djimmah-gr3', name: ['Unwashed Djimmah Grade 3', 'ያልታጠበ ጅማ ደረጃ 3'], cat: cat.commercial, prices: [400, 750, 1400], fulfilment: 'from_stock', roasts: [roast.medium, roast.dark], origin: [['DJM', 'KGT-DJM-2025-001']], wholesale: true, notes: 'Earthy, dark chocolate' },
		{ slug: 'gera-anaerobic-reserve', name: ['Gera Anaerobic Reserve', 'ገራ ልዩ ክምችት'], cat: cat.specialty, prices: [950, 1800, 0], fulfilment: 'roast_to_order', roasts: [roast.light], origin: [['GER', 'KGT-GER-2025-002']], notes: 'Strawberry, wine' },
		{ slug: 'mana-natural', name: ['Mana Natural', 'ማና ተፈጥሯዊ'], cat: cat.specialty, prices: [600, 1150, 2200], fulfilment: 'roast_to_order', roasts: [roast.light, roast.medium], origin: [['MAN', 'KGT-MAN-2025-001']], notes: 'Blueberry, cocoa' }
	];
	for (const [i, p] of products.entries()) {
		const id = await insertId(s.product, {
			slug: p.slug,
			kind: 'coffee',
			categoryId: p.cat,
			name: L(...p.name),
			summary: L(`${p.notes}.`),
			description: L(`<p>${p.name[0]} — ${p.notes.toLowerCase()}. Grown and processed by Kebena in the Jimma zone.</p>`),
			tastingNotes: L(p.notes),
			fulfilment: p.fulfilment,
			dispatchDays: p.fulfilment === 'roast_to_order' ? 3 : 1,
			taxRateId: vat,
			isWholesale: Boolean(p.wholesale),
			publishStatus: i === 5 ? 'draft' : 'published',
			sortOrder: i + 1,
			seoTitle: L(`${p.name[0]} | Kebena Coffee`),
			createdBy: editor,
			createdAt: daysFrom(-between(60, 200))
		});
		const sizes: [number, number, string][] = [[size.g250, p.prices[0], '250'], [size.g500, p.prices[1], '500'], [size.kg1, p.prices[2], '1K']];
		for (const [j, [bagSizeId, price, label]] of sizes.entries()) {
			if (!price) continue;
			await db.insert(s.productVariant).values({ productId: id, sku: `${p.slug.toUpperCase().slice(0, 12)}-${label}`, bagSizeId, price, compareAtPrice: j === 0 && i === 1 ? price + 50 : 0, sortOrder: j, createdBy: editor });
		}
		await db.insert(s.productRoastLevel).values(p.roasts.map((roastLevelId, k) => ({ productId: id, roastLevelId, isDefault: k === 0 })));
		await db.insert(s.productGrind).values(grinds.map((grindId, k) => ({ productId: id, grindId, isDefault: k === 0 })));
		await db.insert(s.productPackaging).values([{ productId: id, packagingId: standardBag, isDefault: true }, { productId: id, packagingId: giftBox }]);
		for (const [k, [st, code]] of p.origin.entries()) {
			await db.insert(s.productOrigin).values({ productId: id, stationId: stations[st], lotId: code ? await lotId(code) : null, sharePercent: p.origin.length > 1 ? (k === 0 ? 60 : 40) : 100, sortOrder: k });
		}
	}
	const bundle = await insertId(s.product, { slug: 'origins-discovery-set', kind: 'bundle', categoryId: cat.bundles, name: L('Origins Discovery Set', 'የመነሻ ማሰሻ ስብስብ'), summary: L('Three 250 g bags: Limu, Gera and Djimmah'), fulfilment: 'from_stock', taxRateId: vat, isSubscribable: false, publishStatus: 'published', sortOrder: 7, createdBy: editor });
	await db.insert(s.productVariant).values({ productId: bundle, sku: 'ORIGINS-SET-3X250', name: L('3 × 250 g'), price: 1650, sortOrder: 0, createdBy: editor });
	const mug = await insertId(s.product, { slug: 'kebena-jebena-cup-set', kind: 'merchandise', categoryId: cat.merch, name: L('Sini cup set (6)', 'ሲኒ ስብስብ'), summary: L('Hand-painted ceramic sini cups'), fulfilment: 'from_stock', taxRateId: vat, isSubscribable: false, publishStatus: 'published', sortOrder: 8, createdBy: editor });
	await db.insert(s.productVariant).values({ productId: mug, sku: 'SINI-SET-6', name: L('Set of 6'), price: 1200, sortOrder: 0, createdBy: editor });
	const tee = await insertId(s.product, { slug: 'kebena-tshirt', kind: 'merchandise', categoryId: cat.merch, name: L('Kebena T-shirt', 'የቀበና ቲሸርት'), fulfilment: 'from_stock', taxRateId: vat, isSubscribable: false, publishStatus: 'published', sortOrder: 9, createdBy: editor });
	await db.insert(s.productVariant).values(['S', 'M', 'L', 'XL'].map((sz, k) => ({ productId: tee, sku: `TEE-${sz}`, name: L(sz), price: 900, sortOrder: k, createdBy: editor })));

	// ── Bundles: more than 1 kg at a better price ─────────────────────────────────────────────
	const kiloOf = async (slug: string) =>
		(
			await db
				.select({ id: s.productVariant.id })
				.from(s.productVariant)
				.innerJoin(s.product, eq(s.productVariant.productId, s.product.id))
				.where(and(eq(s.product.slug, slug), eq(s.productVariant.bagSizeId, size.kg1)))
		)[0].id;
	const twoKilo = await insertId(s.bundle, { slug: 'two-kilo-bundle', name: L('2 kg bundle', 'የ2 ኪ.ግ ጥቅል'), summary: L('Any two 1 kg bags, 5% off'), pricing: 'percent_off', value: 5, publishStatus: 'published', sortOrder: 1, createdBy: editor });
	await db.insert(s.bundleItem).values({ bundleId: twoKilo, bagSizeId: size.kg1, quantity: 2 });
	const fiveKilo = await insertId(s.bundle, { slug: 'five-kilo-bundle', name: L('5 kg bundle', 'የ5 ኪ.ግ ጥቅል'), summary: L('Any five 1 kg bags, 10% off'), pricing: 'percent_off', value: 10, maxPerOrder: 4, publishStatus: 'published', sortOrder: 2, createdBy: editor });
	await db.insert(s.bundleItem).values({ bundleId: fiveKilo, bagSizeId: size.kg1, quantity: 5 });
	const pair = await insertId(s.bundle, { slug: 'limu-gera-pair', name: L('Limu & Gera pair', 'ሊሙ እና ገራ ጥንድ'), summary: L('A kilo of each washed Grade 1'), pricing: 'fixed_price', value: 4700, publishStatus: 'published', sortOrder: 3, createdBy: editor });
	await db.insert(s.bundleItem).values([
		{ bundleId: pair, variantId: await kiloOf('washed-limu-gr1'), quantity: 1, sortOrder: 1 },
		{ bundleId: pair, variantId: await kiloOf('washed-gera-gr1'), quantity: 1, sortOrder: 2 }
	]);
	const duo = await insertId(s.bundle, { slug: 'specialty-duo', name: L('Specialty duo', 'የስፔሻሊቲ ጥንድ'), summary: L('Two 1 kg specialty bags, ETB 300 off — this season only'), pricing: 'amount_off', value: 300, endsAt: daysFrom(45, 23, 59), publishStatus: 'draft', sortOrder: 4, createdBy: editor });
	await db.insert(s.bundleItem).values({ bundleId: duo, bagSizeId: size.kg1, categoryId: cat.specialty, quantity: 2 });

	// ── Delivery ──────────────────────────────────────────────────────────────────────────────
	const zones = [
		{ code: 'ZONE1', name: L('Addis Zone 1', 'አዲስ ዞን 1'), fee: 150, freeAbove: 3000, areas: ['Nefas Silk-Lafto', 'Kirkos', 'Lideta', 'Bole'] },
		{ code: 'ZONE2', name: L('Addis Zone 2', 'አዲስ ዞን 2'), fee: 200, freeAbove: 3000, areas: ['Arada', 'Addis Ketema', 'Kolfe Keranio', 'Yeka', 'Gullele'] },
		{ code: 'ZONE3', name: L('Addis Zone 3', 'አዲስ ዞን 3'), fee: 250, freeAbove: 3000, areas: ['Akaky Kaliti', 'Lemi Kura', 'Outskirts'] },
		{ code: 'PICKUP', name: L('Pickup at the museum', 'ከሙዚየሙ መውሰድ'), fee: 0, freeAbove: null, isPickup: true, areas: [] },
		{ code: 'REGIONS', name: L('Outside Addis (courier)', 'ከአዲስ ውጭ'), fee: 400, freeAbove: null, usesCourier: true, freeForMembers: false, transitDays: 3, areas: ['Adama', 'Hawassa', 'Bahir Dar', 'Jimma', 'Dire Dawa'] }
	];
	for (const [i, z] of zones.entries()) {
		const zoneId = await insertId(s.deliveryZone, { code: z.code, name: z.name, fee: z.fee, freeAbove: z.freeAbove, isPickup: z.isPickup ?? false, usesCourier: z.usesCourier ?? false, freeForMembers: z.freeForMembers ?? true, transitDays: z.transitDays ?? 0, sortOrder: i });
		for (const [k, a] of z.areas.entries()) await db.insert(s.deliveryArea).values({ zoneId, name: L(a), sortOrder: k });
	}
	await db.insert(s.courier).values([
		{ name: 'EMS Ethiopia', phone: '+251115515050', trackingUrlTemplate: 'https://ems.et/track?n={tracking}' },
		{ name: 'Zemen Express', phone: '+251911000111' }
	]);

	// ── Customers ─────────────────────────────────────────────────────────────────────────────
	const desk = await userIdByEmail('desk@kebena.coffee');
	const areas = await db.select({ id: s.deliveryArea.id }).from(s.deliveryArea);
	const sources = ['web', 'desk', 'newsletter_import', 'telegram'];
	for (let i = 0; i < 40; i++) {
		const first = FIRST[i % FIRST.length];
		const last = pick(LAST);
		const name = `${first} ${last}`;
		const phone = `+2519${String(10000000 + i * 137911).slice(0, 8)}`;
		const email = rand() < 0.7 ? `${first}.${last}${i}@example.com`.toLowerCase() : null;
		const hasAccount = i < 18;
		const userId = hasAccount ? await makeUser(email ?? `${first.toLowerCase()}${i}@customer.kebena.coffee`, name, { kind: 'customer', phone }) : null;
		const created = daysFrom(-between(5, 380));
		const customerId = await insertId(s.customer, {
			userId,
			name,
			phone,
			email,
			locale: pick(['am', 'en']),
			tin: i % 9 === 0 ? `00${between(10000000, 99999999)}` : null,
			businessName: i % 9 === 0 ? `${last} Trading PLC` : null,
			source: pick(sources),
			notes: i % 7 === 0 ? 'Prefers delivery after 5 pm.' : null,
			lastActivityAt: daysFrom(-between(0, 60)),
			createdBy: i % 3 === 0 ? desk : null,
			createdAt: created
		});
		if (rand() < 0.75) {
			await db.insert(s.customerAddress).values({ customerId, label: 'Home', recipientName: name, phone, areaId: pick(areas).id, line1: `House ${between(1, 900)}, ${pick(['near Edna Mall', 'behind Friendship', 'opposite Bole Medhanialem', 'next to Shoa Bakery'])}`, landmark: pick(['Blue gate', 'Second floor', 'Ask the guard', null]), isDefault: true, createdBy: userId });
		}
		for (const channel of ['sms', 'email'] as const) {
			if (rand() < 0.6) await db.insert(s.marketingConsent).values({ customerId, channel, granted: true, source: pick(['checkout', 'booking_form', 'newsletter_import']), recordedAt: created });
		}
		if (i % 11 === 0) {
			await db.insert(s.marketingConsent).values({ customerId, channel: 'sms', granted: false, source: 'sms_stop', recordedAt: daysFrom(-3) });
		}
		if (i % 8 === 0) {
			await db.insert(s.storeCredit).values({ customerId, amount: 300, reason: 'goodwill', note: 'Late delivery apology', createdBy: manager, createdAt: daysFrom(-20) });
		}
	}
}
