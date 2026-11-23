/**
 * The system's own traffic: message templates, the outbox, payment webhooks and an audit trail —
 * so Admin › Messages and the audit log show a month of believable activity. Reads what earlier
 * seeds wrote and links to orders, bookings and memberships when they exist.
 */
import { asc, eq, inArray } from 'drizzle-orm';
import { db, schema as s, between, daysFrom, pick, rand } from './db.ts';

type Ref = { type: string; id: number; customerId: number | null };

const TEMPLATES: { key: string; en: [string, string]; am: [string, string] }[] = [
	{
		key: 'order.paid',
		en: ['Your Kebena order {{order_number}}', 'Thank you, {{name}}! We received {{total}} ETB for order {{order_number}}.'],
		am: ['የቀበና ትዕዛዝ {{order_number}}', 'እናመሰግናለን {{name}}! ለትዕዛዝ {{order_number}} {{total}} ብር ተቀብለናል።']
	},
	{
		key: 'order.roasting',
		en: ['Your coffee is being roasted', '{{name}}, your coffee for order {{order_number}} is being roasted today at the Kebena roastery.'],
		am: ['ቡናዎ እየተቆላ ነው', '{{name}}፣ የትዕዛዝ {{order_number}} ቡናዎ ዛሬ በቀበና እየተቆላ ነው።']
	},
	{
		key: 'order.out_for_delivery',
		en: ['On its way', 'Order {{order_number}} is on its way. Your rider: {{rider_phone}}.'],
		am: ['በመንገድ ላይ ነው', 'ትዕዛዝ {{order_number}} በመንገድ ላይ ነው። አድራሽ፦ {{rider_phone}}']
	},
	{
		key: 'order.shipped',
		en: ['Order {{order_number}} has shipped', 'Order {{order_number}} is with {{courier}}. Tracking number: {{tracking_number}} {{tracking_url}}'],
		am: ['ትዕዛዝ {{order_number}} ተልኳል', 'ትዕዛዝ {{order_number}} ለ{{courier}} ተሰጥቷል። መከታተያ ቁጥር፦ {{tracking_number}} {{tracking_url}}']
	},
	{
		key: 'order.ready_for_pickup',
		en: ['Order {{order_number}} is ready', '{{name}}, order {{order_number}} is ready to collect at {{pickup_place}} during opening hours. Show this code: {{pickup_code}}'],
		am: ['ትዕዛዝ {{order_number}} ዝግጁ ነው', '{{name}}፣ ትዕዛዝ {{order_number}} በ{{pickup_place}} ለመውሰድ ዝግጁ ነው። ይህን ኮድ ያሳዩ፦ {{pickup_code}}']
	},
	{
		key: 'order.delivered',
		en: ['Enjoy your coffee', 'Thank you, {{name}}! Order {{order_number}} was delivered. Tell us how you liked it: {{review_url}}'],
		am: ['ቡናዎን ይደሰቱበት', 'እናመሰግናለን {{name}}! ትዕዛዝ {{order_number}} ደርሷል። አስተያየትዎን ያጋሩን፦ {{review_url}}']
	},
	{
		key: 'order.collected',
		en: ['Enjoy your coffee', 'Thank you, {{name}}, for collecting order {{order_number}}. Tell us how you liked it: {{review_url}}'],
		am: ['ቡናዎን ይደሰቱበት', 'እናመሰግናለን {{name}}፣ ትዕዛዝ {{order_number}} ስለወሰዱ። አስተያየትዎን ያጋሩን፦ {{review_url}}']
	},
	{
		key: 'membership.renewal_due',
		en: ['Your membership ends on {{ends_on}}', '{{name}}, your Kebena membership ends on {{ends_on}}. Renew in one tap: {{pay_url}}'],
		am: ['አባልነትዎ በ{{ends_on}} ያበቃል', '{{name}}፣ የቀበና አባልነትዎ በ{{ends_on}} ያበቃል። ለማደስ፦ {{pay_url}}']
	},
	{
		key: 'membership.ending',
		en: ['Your membership ends on {{ends_on}}', '{{name}}, your Kebena {{plan}} membership ends on {{ends_on}}. You have 7 days of grace to renew: {{pay_url}}'],
		am: ['አባልነትዎ በ{{ends_on}} ያበቃል', '{{name}}፣ የቀበና {{plan}} አባልነትዎ በ{{ends_on}} ያበቃል። ለማደስ 7 ቀናት አሉዎት፦ {{pay_url}}']
	},
	{
		key: 'membership.lapsing',
		en: ['Last days to renew', '{{name}}, your Kebena {{plan}} membership ended on {{ends_on}} and lapses today. Renew to keep your benefits: {{pay_url}}'],
		am: ['ለማደስ የመጨረሻ ቀናት', '{{name}}፣ የቀበና {{plan}} አባልነትዎ በ{{ends_on}} አብቅቷል፤ ዛሬ ይቋረጣል። ጥቅሞችዎን ለማቆየት ያድሱ፦ {{pay_url}}']
	},
	{
		key: 'subscription.top_up',
		en: ['One delivery left', '{{name}}, one prepaid delivery is left on your coffee subscription {{subscription_number}}. Top up to keep it coming: {{pay_url}}'],
		am: ['አንድ ማድረሻ ቀርቷል', '{{name}}፣ በቡና ምዝገባዎ {{subscription_number}} አንድ የተከፈለ ማድረሻ ቀርቷል። እንዲቀጥል ይሙሉ፦ {{pay_url}}']
	},
	{
		key: 'invoice.due_soon',
		en: ['Invoice {{invoice_number}} is due on {{due_on}}', 'Dear {{name}}, a reminder that {{balance}} ETB on invoice {{invoice_number}} is due on {{due_on}}.'],
		am: ['ደረሰኝ {{invoice_number}} በ{{due_on}} ይከፈላል', 'ውድ {{name}}፣ በደረሰኝ {{invoice_number}} ላይ {{balance}} ብር በ{{due_on}} መከፈል እንዳለበት እናስታውሳለን።']
	},
	{
		key: 'invoice.due_today',
		en: ['Invoice {{invoice_number}} is due today', 'Dear {{name}}, {{balance}} ETB on invoice {{invoice_number}} is due today.'],
		am: ['ደረሰኝ {{invoice_number}} ዛሬ ይከፈላል', 'ውድ {{name}}፣ በደረሰኝ {{invoice_number}} ላይ {{balance}} ብር ዛሬ መከፈል አለበት።']
	},
	{
		key: 'invoice.overdue',
		en: ['Invoice {{invoice_number}} is overdue', 'Dear {{name}}, {{balance}} ETB on invoice {{invoice_number}} was due on {{due_on}} and is still open. Please pay or call us on +251 912 605 824.'],
		am: ['ደረሰኝ {{invoice_number}} ጊዜው አልፏል', 'ውድ {{name}}፣ በደረሰኝ {{invoice_number}} ላይ {{balance}} ብር በ{{due_on}} መከፈል ነበረበት። እባክዎ ይክፈሉ ወይም በ+251 912 605 824 ይደውሉ።']
	},
	{
		key: 'booking.confirmed',
		en: ['Booking {{booking_number}} confirmed', '{{name}}, your {{what}} on {{date}} at {{time}} for {{party}} is confirmed. See you at the museum!'],
		am: ['ቦታ ማስያዣ {{booking_number}} ተረጋግጧል', '{{name}}፣ {{what}} በ{{date}} {{time}} ለ{{party}} ሰዎች ተረጋግጧል።']
	},
	{
		key: 'booking.cancelled',
		en: ['Booking {{booking_number}} cancelled', '{{name}}, your booking {{booking_number}} for {{what}} is cancelled. Questions? Call +251 912 605 824.'],
		am: ['ቦታ ማስያዣ {{booking_number}} ተሰርዟል', '{{name}}፣ የ{{what}} ቦታ ማስያዣዎ {{booking_number}} ተሰርዟል። ለጥያቄ፦ +251 912 605 824']
	}
];

/** Staff alerts go by email only; `{{list}}` keeps its line breaks. */
const STAFF_TEMPLATES: { key: string; en: [string, string]; am: [string, string] }[] = [
	{
		key: 'staff.low_stock',
		en: ['{{count}} items under their low-stock level', '<p>These are under their low-stock level this morning:</p><div style="white-space:pre-line">{{list}}</div>'],
		am: ['{{count}} ዕቃዎች ከዝቅተኛው ደረጃ በታች ናቸው', '<p>ዛሬ ጠዋት ከዝቅተኛው የክምችት ደረጃ በታች ያሉት፦</p><div style="white-space:pre-line">{{list}}</div>']
	},
	{
		key: 'staff.sales_daily',
		en: ['Sales for {{date}}: {{sales}} ETB', '<p>{{date}}: {{orders}} paid orders, {{sales}} ETB net of refunds, of which VAT {{vat}} ETB.</p>'],
		am: ['የ{{date}} ሽያጭ፦ {{sales}} ብር', '<p>{{date}}፦ {{orders}} የተከፈሉ ትዕዛዞች፣ {{sales}} ብር (ተመላሽ ተቀንሶ)፣ ከዚህ ውስጥ ተ.እ.ታ {{vat}} ብር።</p>']
	},
	{
		key: 'staff.inbox_stale',
		en: ['Waiting more than a day', '<p>Still new after 24 hours: {{forms}} form submissions and {{bookings}} bookings. Open the inbox in the dashboard.</p>'],
		am: ['ከአንድ ቀን በላይ የቆዩ', '<p>ከ24 ሰዓት በኋላም አዲስ ያሉ፦ {{forms}} ቅጾች እና {{bookings}} ቦታ ማስያዣዎች።</p>']
	}
];

export async function seed() {
	const staff = await db
		.select({ id: s.user.id, email: s.user.email })
		.from(s.user)
		.where(eq(s.user.kind, 'staff'));
	const staffId = (email: string) => staff.find((u) => u.email === email)?.id ?? staff[0].id;
	const owner = staffId('owner@kebena.coffee');
	const manager = staffId('manager@kebena.coffee');
	const editor = staffId('editor@kebena.coffee');
	const roaster = staffId('roaster@kebena.coffee');
	const shop = staffId('shop@kebena.coffee');

	// ── Templates ──────────────────────────────────────────────────────────────────────────────
	for (const t of STAFF_TEMPLATES) {
		await db.insert(s.notificationTemplate).values(
			(['en', 'am'] as const).map((locale) => ({ key: t.key, channel: 'email' as const, locale, subject: t[locale][0], body: t[locale][1], createdBy: editor }))
		);
	}
	for (const t of TEMPLATES) {
		for (const locale of ['en', 'am'] as const) {
			const [subject, body] = t[locale];
			await db.insert(s.notificationTemplate).values([
				{ key: t.key, channel: 'sms', locale, subject: null, body, createdBy: editor },
				{ key: t.key, channel: 'email', locale, subject, body: `<p>${body}</p>`, createdBy: editor }
			]);
		}
	}

	// ── Outbox ─────────────────────────────────────────────────────────────────────────────────
	const customers = await db
		.select({ id: s.customer.id, name: s.customer.name, phone: s.customer.phone, email: s.customer.email, locale: s.customer.locale, userId: s.customer.userId })
		.from(s.customer)
		.orderBy(asc(s.customer.id));
	const orders = await db.select({ id: s.order.id, customerId: s.order.customerId, number: s.order.number, total: s.order.total }).from(s.order).limit(60);
	const bookings = await db.select({ id: s.booking.id, customerId: s.booking.customerId, number: s.booking.number }).from(s.booking).limit(30);
	const memberships = await db.select({ id: s.membership.id, customerId: s.membership.customerId, number: s.membership.number, endsOn: s.membership.endsOn }).from(s.membership).limit(30);

	const refs: (Ref & { key: string; payload: Record<string, unknown> })[] = [];
	for (const o of orders) {
		refs.push({ type: 'order', id: o.id, customerId: o.customerId, key: 'order.paid', payload: { order_number: o.number, total: o.total } });
		if (rand() < 0.4) refs.push({ type: 'order', id: o.id, customerId: o.customerId, key: pick(['order.roasting', 'order.out_for_delivery']), payload: { order_number: o.number, rider_phone: '+251911223344' } });
	}
	for (const b of bookings) refs.push({ type: 'booking', id: b.id, customerId: b.customerId, key: 'booking.confirmed', payload: { booking_number: b.number } });
	for (const m of memberships) refs.push({ type: 'membership', id: m.id, customerId: m.customerId, key: 'membership.renewal_due', payload: { ends_on: m.endsOn } });
	// With nothing else seeded yet, the outbox still holds a month of order messages to customers.
	while (refs.length < 80 && customers.length) {
		const c = pick(customers);
		const number = `KC-26-${String(between(1, 400)).padStart(6, '0')}`;
		refs.push({ type: 'order', id: between(1, 400), customerId: c.id, key: pick(['order.paid', 'order.out_for_delivery']), payload: { order_number: number, total: between(400, 5000) } });
	}

	const byId = new Map(customers.map((c) => [c.id, c]));
	const statuses = ['sent', 'sent', 'sent', 'sent', 'sent', 'failed', 'queued', 'skipped'] as const;
	let dedupe = 0;
	for (const r of refs.slice(0, 90)) {
		const c = r.customerId ? byId.get(r.customerId) : undefined;
		if (!c) continue;
		const channel = c.email && rand() < 0.35 ? 'email' : 'sms';
		const status = pick(statuses);
		const at = daysFrom(-between(0, 30), between(8, 20), between(0, 59));
		const realRef = orders.some((o) => o.id === r.id) || r.type !== 'order';
		await db.insert(s.notification).values({
			channel,
			templateKey: r.key,
			locale: c.locale ?? 'am',
			recipient: channel === 'email' ? c.email! : (c.phone ?? '+251900000000'),
			customerId: c.id,
			userId: c.userId,
			payload: { name: c.name, ...r.payload },
			status,
			attempts: status === 'failed' ? 3 : status === 'queued' ? 0 : 1,
			lastError: status === 'failed' ? pick(['Gateway timeout (AfroMessage)', 'Invalid phone number', 'SMTP 550: mailbox unavailable']) : null,
			providerRef: status === 'sent' ? `msg_${Math.floor(rand() * 1e9).toString(36)}` : null,
			dedupeKey: `${r.type}:${r.id}:${r.key}:${channel}:${dedupe++}`,
			refType: realRef ? r.type : null,
			refId: realRef ? String(r.id) : null,
			scheduledFor: status === 'queued' ? daysFrom(0, 21, 0) : at,
			sentAt: status === 'sent' ? at : null,
			createdAt: at
		});
	}
	// A few marketing messages — only to customers whose latest SMS consent is a grant.
	const consents = await db.select().from(s.marketingConsent).where(eq(s.marketingConsent.channel, 'sms')).orderBy(asc(s.marketingConsent.id));
	const latest = new Map<number, boolean>();
	for (const c of consents) latest.set(c.customerId, c.granted);
	const opted = customers.filter((c) => latest.get(c.id)).slice(0, 8);
	for (const c of opted) {
		const at = daysFrom(-between(1, 14), 10, 0);
		await db.insert(s.notification).values({
			channel: 'sms',
			templateKey: 'marketing.meskel_tasting',
			locale: c.locale ?? 'am',
			recipient: c.phone ?? '+251900000000',
			customerId: c.id,
			payload: { name: c.name },
			isMarketing: true,
			status: 'sent',
			attempts: 1,
			dedupeKey: `marketing:meskel:${c.id}`,
			scheduledFor: at,
			sentAt: at,
			createdAt: at
		});
	}

	// ── Webhooks ───────────────────────────────────────────────────────────────────────────────
	const payments = await db.select({ id: s.payment.id, txRef: s.payment.txRef, amount: s.payment.amount }).from(s.payment).where(eq(s.payment.provider, 'chapa')).limit(15);
	for (let i = 0; i < 15; i++) {
		const p = payments[i];
		const txRef = p?.txRef ?? `KC-TX-${between(100000, 999999)}`;
		const failedSignature = i % 7 === 3;
		const errored = i % 5 === 4;
		const at = daysFrom(-between(0, 25), between(8, 21), between(0, 59));
		await db.insert(s.webhookEvent).values({
			provider: i % 6 === 5 ? 'telebirr' : 'chapa',
			eventId: `evt_${Math.floor(rand() * 1e12).toString(36)}`,
			eventType: i % 4 === 2 ? 'charge.failed' : 'charge.success',
			payload: {
				event: i % 4 === 2 ? 'charge.failed' : 'charge.success',
				tx_ref: txRef,
				amount: p?.amount ?? between(400, 6000),
				currency: 'ETB',
				status: i % 4 === 2 ? 'failed' : 'success',
				payment_method: pick(['telebirr', 'cbebirr', 'card', 'mpesa']),
				created_at: at.toISOString()
			},
			signatureValid: !failedSignature,
			processedAt: failedSignature || errored ? null : at,
			error: errored ? 'No payment with this tx_ref' : null,
			receivedAt: at
		});
	}

	// ── Audit trail ────────────────────────────────────────────────────────────────────────────
	const variants = await db.select({ id: s.productVariant.id, price: s.productVariant.price }).from(s.productVariant).limit(20);
	const products = await db.select({ id: s.product.id, publishStatus: s.product.publishStatus }).from(s.product).limit(10);
	const lots = await db.select({ id: s.lot.id, cuppingScore: s.lot.cuppingScore, lowStockKg: s.lot.lowStockKg }).from(s.lot).limit(10);
	const [vat] = await db.select({ id: s.taxRate.id }).from(s.taxRate).where(eq(s.taxRate.code, 'VAT15'));
	const roles = await db.select({ id: s.roles.id, name: s.roles.name }).from(s.roles).where(inArray(s.roles.name, ['Shop staff', 'Front desk']));
	const ip = () => pick(['196.188.12.4', '196.189.44.21', '10.0.0.15', '197.156.86.3']);

	const entries: (typeof s.auditLog.$inferInsert)[] = [];
	for (let i = 0; i < 18 && variants.length; i++) {
		const v = pick(variants);
		const was = Number(v.price);
		const now = was + pick([50, 100, -50, 150]);
		entries.push({ userId: pick([owner, manager]), action: 'update', tableName: 'product_variant', recordId: String(v.id), changes: { price: [was.toFixed(2), now.toFixed(2)] }, ipAddress: ip(), createdAt: daysFrom(-between(0, 30), between(8, 18)) });
	}
	for (let i = 0; i < 8 && products.length; i++) {
		const p = pick(products);
		entries.push({ userId: editor, action: 'update', tableName: 'product', recordId: String(p.id), changes: pick([{ publishStatus: ['draft', 'published'] }, { summary: [{ en: 'Old copy' }, { en: 'Jasmine, bergamot, honey.' }] }, { sortOrder: [3, 1] }]), ipAddress: ip(), createdAt: daysFrom(-between(0, 30), between(8, 18)) });
	}
	for (let i = 0; i < 10 && lots.length; i++) {
		const l = pick(lots);
		entries.push(
			i % 3 === 0
				? { userId: roaster, action: 'create', tableName: 'lot', recordId: String(l.id), changes: null, ipAddress: ip(), createdAt: daysFrom(-between(10, 30), 9) }
				: { userId: roaster, action: 'update', tableName: 'lot', recordId: String(l.id), changes: { cuppingScore: [l.cuppingScore, Number(l.cuppingScore ?? 84) + 0.25], lowStockKg: [l.lowStockKg, 50] }, ipAddress: ip(), createdAt: daysFrom(-between(0, 30), between(8, 18)) }
		);
	}
	if (vat) entries.push({ userId: owner, action: 'update', tableName: 'tax_rate', recordId: String(vat.id), changes: { name: [{ en: 'VAT' }, { en: 'VAT 15%', am: 'ተ.እ.ታ 15%' }] }, ipAddress: ip(), createdAt: daysFrom(-28, 11) });
	for (const r of roles) entries.push({ userId: owner, action: 'update', tableName: 'role_permissions', recordId: String(r.id), changes: { added: 1, removed: 0 }, ipAddress: ip(), createdAt: daysFrom(-between(5, 25), 15) });
	entries.push({ userId: owner, action: 'update', tableName: 'setting', recordId: 'delivery.free_above', changes: { value: [2500, 3000] }, ipAddress: ip(), createdAt: daysFrom(-12, 10) });
	entries.push({ userId: manager, action: 'create', tableName: 'user', recordId: shop, changes: { name: 'Selam Tesfaye', roleId: roles[0]?.id ?? null }, ipAddress: ip(), createdAt: daysFrom(-29, 9) });
	entries.sort((a, b) => (a.createdAt as Date).getTime() - (b.createdAt as Date).getTime());
	await db.insert(s.auditLog).values(entries);
}
