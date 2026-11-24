/**
 * Message templates for paying by link and by transfer: the order's link when it is placed, its
 * tickets when they are paid for, a transfer receipt turned down, an event cancelled, a reply from
 * the inbox, and the staff alerts for a new receipt and a new enquiry. Editable afterwards in Admin › Message templates.
 *
 * Safe to run again and on a live database: a template already there (by key, channel and
 * language) is left as staff last wrote it.
 */
import { db, schema as s } from './db.ts';

type Wording = Record<string, [subject: string, body: string]>;

const CUSTOMER: Record<string, Wording> = {
	'order.placed': {
		en: [
			'Kebena order {{order_number}}',
			'Thank you, {{name}}! Order {{order_number}} for {{total}} ETB is placed. Pay, send a transfer receipt or follow it here: {{order_url}}'
		],
		am: [
			'የቀበና ትዕዛዝ {{order_number}}',
			'እናመሰግናለን {{name}}! የ{{total}} ብር ትዕዛዝ {{order_number}} ገብቷል። ለመክፈል፣ የዝውውር ደረሰኝ ለመላክ ወይም ለመከታተል፦ {{order_url}}'
		],
		om: [
			'Ajaja Kebena {{order_number}}',
			'Galatoomi, {{name}}! Ajajni {{order_number}} kan {{total}} ETB galmaa’eera. Kaffaluuf, nagahee dabarsaa erguuf ykn hordofuuf: {{order_url}}'
		],
		ar: [
			'طلب كبينا {{order_number}}',
			'شكرًا {{name}}! تم تسجيل الطلب {{order_number}} بقيمة {{total}} بر. للدفع أو إرسال إيصال التحويل أو المتابعة: {{order_url}}'
		],
		it: [
			'Ordine Kebena {{order_number}}',
			'Grazie, {{name}}! L’ordine {{order_number}} da {{total}} ETB è registrato. Per pagare, inviare la ricevuta del bonifico o seguirlo: {{order_url}}'
		],
		fr: [
			'Commande Kebena {{order_number}}',
			'Merci, {{name}} ! La commande {{order_number}} de {{total}} ETB est enregistrée. Pour payer, envoyer un reçu de virement ou la suivre : {{order_url}}'
		]
	},
	/** Asked for again on /track: only ever sent to the phone and email the order was placed with. */
	'order.link': {
		en: [
			'Your Kebena order {{order_number}}',
			'Here is the link to your Kebena order {{order_number}}: {{order_url}} If you did not ask for it, you can ignore this message.'
		],
		am: [
			'የቀበና ትዕዛዝዎ {{order_number}}',
			'የቀበና ትዕዛዝዎ {{order_number}} ሊንክ፦ {{order_url}} ይህን ካልጠየቁ መልዕክቱን ችላ ማለት ይችላሉ።'
		],
		om: [
			'Ajaja Kebena kee {{order_number}}',
			'Liinkii ajaja Kebena kee {{order_number}}: {{order_url}} Yoo kana hin gaafatin, ergaa kana dhiisuu dandeessa.'
		],
		ar: [
			'طلبك من كبينا {{order_number}}',
			'رابط طلبك من كبينا {{order_number}}: {{order_url}} إذا لم تطلبه، يمكنك تجاهل هذه الرسالة.'
		],
		it: [
			'Il tuo ordine Kebena {{order_number}}',
			'Ecco il link al tuo ordine Kebena {{order_number}}: {{order_url}} Se non l’hai richiesto, puoi ignorare questo messaggio.'
		],
		fr: [
			'Votre commande Kebena {{order_number}}',
			'Voici le lien de votre commande Kebena {{order_number}} : {{order_url}} Si vous ne l’avez pas demandé, ignorez ce message.'
		]
	},
	'order.tickets': {
		en: [
			'Your Kebena tickets',
			'Thank you, {{name}}! Order {{order_number}} is paid. Your tickets and their QR codes are here — show them at the gate: {{order_url}}'
		],
		am: [
			'የቀበና ትኬቶችዎ',
			'እናመሰግናለን {{name}}! ትዕዛዝ {{order_number}} ተከፍሏል። ትኬቶችዎና የQR ኮዶቻቸው እዚህ አሉ፤ በመግቢያው ላይ ያሳዩ፦ {{order_url}}'
		],
		om: [
			'Tikeetii Kebena kee',
			'Galatoomi, {{name}}! Ajajni {{order_number}} kaffalameera. Tikeetiin keessanii fi koodiin QR isaanii asi jiru — balbala irratti agarsiisi: {{order_url}}'
		],
		ar: [
			'تذاكرك في كبينا',
			'شكرًا {{name}}! تم دفع الطلب {{order_number}}. تذاكرك ورموز QR الخاصة بها هنا، أظهرها عند المدخل: {{order_url}}'
		],
		it: [
			'I tuoi biglietti Kebena',
			'Grazie, {{name}}! L’ordine {{order_number}} è pagato. Biglietti e codici QR sono qui, da mostrare all’ingresso: {{order_url}}'
		],
		fr: [
			'Vos billets Kebena',
			'Merci, {{name}} ! La commande {{order_number}} est payée. Vos billets et leurs codes QR sont ici, à présenter à l’entrée : {{order_url}}'
		]
	},
	'order.receipt_rejected': {
		en: [
			'We could not match your receipt',
			'{{name}}, we could not match your transfer receipt for order {{order_number}}: {{reason}}. Please check it and send it again: {{order_url}}'
		],
		am: [
			'ደረሰኝዎን ማረጋገጥ አልቻልንም',
			'{{name}}፣ ለትዕዛዝ {{order_number}} የላኩትን የዝውውር ደረሰኝ ማረጋገጥ አልቻልንም፦ {{reason}}። እባክዎ ይፈትሹና እንደገና ይላኩ፦ {{order_url}}'
		],
		om: [
			'Nagahee kee mirkaneessuu hin dandeenye',
			'{{name}}, nagahee dabarsaa ajaja {{order_number}} mirkaneessuu hin dandeenye: {{reason}}. Mee ilaaliitii irra deebi’ii ergi: {{order_url}}'
		],
		ar: [
			'لم نتمكن من مطابقة إيصالك',
			'{{name}}، لم نتمكن من مطابقة إيصال التحويل للطلب {{order_number}}: {{reason}}. يُرجى التحقق منه وإرساله مرة أخرى: {{order_url}}'
		],
		it: [
			'Non abbiamo potuto verificare la ricevuta',
			'{{name}}, non abbiamo potuto verificare la ricevuta del bonifico per l’ordine {{order_number}}: {{reason}}. Controllala e inviala di nuovo: {{order_url}}'
		],
		fr: [
			'Nous n’avons pas pu rapprocher votre reçu',
			'{{name}}, nous n’avons pas pu rapprocher votre reçu de virement pour la commande {{order_number}} : {{reason}}. Vérifiez-le et renvoyez-le : {{order_url}}'
		]
	},
	'event.cancelled': {
		en: [
			'{{event}} is cancelled',
			'{{name}}, we are sorry: {{event}} on {{date}} is cancelled ({{reason}}). Your tickets on order {{order_number}} no longer admit. Anything you paid for them will be refunded. Questions? Call +251 912 605 824.'
		],
		am: [
			'{{event}} ተሰርዟል',
			'{{name}}፣ ይቅርታ፦ በ{{date}} የነበረው {{event}} ተሰርዟል ({{reason}})። በትዕዛዝ {{order_number}} ላይ ያሉት ትኬቶችዎ ከእንግዲህ አያስገቡም። የከፈሉት ገንዘብ ካለ ይመለስልዎታል። ለጥያቄ፦ +251 912 605 824'
		],
		om: [
			'{{event}} haqameera',
			'{{name}}, dhiifama: {{event}} guyyaa {{date}} haqameera ({{reason}}). Tikeetiin kee ajaja {{order_number}} irra jiru siin hin galchu. Kaffaltiin kaffalte yoo jiraate siif deebi’a. Gaaffiif: +251 912 605 824'
		],
		ar: [
			'تم إلغاء {{event}}',
			'{{name}}، نأسف: تم إلغاء {{event}} بتاريخ {{date}} ({{reason}}). تذاكرك في الطلب {{order_number}} لم تعد صالحة للدخول. سيُعاد إليك أي مبلغ دفعته مقابلها. للاستفسار: +251 912 605 824'
		],
		it: [
			'{{event}} è annullato',
			'{{name}}, ci dispiace: {{event}} del {{date}} è annullato ({{reason}}). I biglietti dell’ordine {{order_number}} non sono più validi. Quanto hai pagato ti sarà rimborsato. Domande? Chiama il +251 912 605 824.'
		],
		fr: [
			'{{event}} est annulé',
			'{{name}}, nous sommes désolés : {{event}} du {{date}} est annulé ({{reason}}). Vos billets de la commande {{order_number}} ne sont plus valables. Tout montant payé vous sera remboursé. Des questions ? Appelez le +251 912 605 824.'
		]
	},
	/** Staff answering a website enquiry from the inbox: their words, signed. */
	'inbox.reply': {
		en: ['Re: {{subject}}', '{{message}} — Kebena Coffee'],
		am: ['መልስ፦ {{subject}}', '{{message}} — ቀበና ቡና'],
		om: ['Deebii: {{subject}}', '{{message}} — Buna Kebena'],
		ar: ['رد: {{subject}}', '{{message}} — قهوة كبينا'],
		it: ['Re: {{subject}}', '{{message}} — Kebena Coffee'],
		fr: ['Re : {{subject}}', '{{message}} — Kebena Coffee']
	}
};

/** Staff alerts go by email only. */
const STAFF: Record<string, Wording> = {
	'staff.inbox_new': {
		en: [
			'New {{form}} from {{name}}',
			'<p>{{name}} sent a {{form}} from the website: {{subject}}</p><p>Answer it in the inbox: <a href="{{url}}">{{url}}</a></p>'
		],
		am: [
			'አዲስ {{form}} ከ{{name}}',
			'<p>{{name}} ከድረ-ገጹ {{form}} ልከዋል፦ {{subject}}</p><p>በገቢ መልዕክቶች ውስጥ ይመልሱ፦ <a href="{{url}}">{{url}}</a></p>'
		]
	},
	'staff.receipt': {
		en: [
			'Transfer receipt for {{order_number}}: {{amount}} ETB',
			'<p>{{name}} says they paid {{amount}} ETB into {{bank}} for order {{order_number}} (reference {{reference}}).</p><p>Check the statement, then confirm or reject the receipt: <a href="{{order_url}}">{{order_url}}</a></p>'
		],
		am: [
			'ለ{{order_number}} የዝውውር ደረሰኝ፦ {{amount}} ብር',
			'<p>{{name}} ለትዕዛዝ {{order_number}} {{amount}} ብር ወደ {{bank}} እንደከፈሉ ገልጸዋል (መለያ {{reference}})።</p><p>የሂሳብ መግለጫውን አይተው ደረሰኙን ያረጋግጡ ወይም ውድቅ ያድርጉ፦ <a href="{{order_url}}">{{order_url}}</a></p>'
		]
	}
};

export async function seed() {
	const rows: (typeof s.notificationTemplate.$inferInsert)[] = [];
	for (const [key, wording] of Object.entries(CUSTOMER)) {
		for (const [locale, [subject, body]] of Object.entries(wording)) {
			rows.push({ key, channel: 'sms', locale, subject: null, body });
			rows.push({ key, channel: 'email', locale, subject, body: `<p>${body}</p>` });
		}
	}
	for (const [key, wording] of Object.entries(STAFF)) {
		for (const [locale, [subject, body]] of Object.entries(wording))
			rows.push({ key, channel: 'email', locale, subject, body });
	}
	const have = new Set(
		(
			await db
				.select({
					key: s.notificationTemplate.key,
					channel: s.notificationTemplate.channel,
					locale: s.notificationTemplate.locale
				})
				.from(s.notificationTemplate)
		).map((t) => `${t.key}|${t.channel}|${t.locale}`)
	);
	// Already there: keep staff's wording.
	const missing = rows.filter((r) => !have.has(`${r.key}|${r.channel}|${r.locale}`));
	if (missing.length) await db.insert(s.notificationTemplate).values(missing);
	const added = missing.length;
	console.log(`  payment message templates: ${added} added, ${rows.length - added} already there`);
}
