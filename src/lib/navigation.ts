import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
import Coffee from '@lucide/svelte/icons/coffee';
import Sprout from '@lucide/svelte/icons/sprout';
import Flame from '@lucide/svelte/icons/flame';
import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
import Users from '@lucide/svelte/icons/users';
import Ticket from '@lucide/svelte/icons/ticket';
import ScanLine from '@lucide/svelte/icons/scan-line';
import QrCode from '@lucide/svelte/icons/qr-code';
import IdCard from '@lucide/svelte/icons/id-card';
import CalendarCheck from '@lucide/svelte/icons/calendar-check';
import Inbox from '@lucide/svelte/icons/inbox';
import Globe from '@lucide/svelte/icons/globe';
import ChartPie from '@lucide/svelte/icons/chart-pie';
import Settings from '@lucide/svelte/icons/settings';
import type { NavItem } from '@nahu/admin-kit/navigation';

const D = '/dashboard';

/**
 * The lists the rest is built from, changed a few times a year: on the Setup overview and in
 * search, not in the sidebar. `section` is the overview card each belongs on.
 */
export const SETUP: { title: string; url: string; section: string; hint: string }[] = [
	{ title: 'Locations', url: `${D}/admin/locations`, section: 'Places and calendar', hint: 'Sites, shop, café, roastery, opening hours' },
	{ title: 'Holidays & closures', url: `${D}/admin/calendar`, section: 'Places and calendar', hint: 'Days the weekly pattern does not hold' },
	{ title: 'Categories', url: `${D}/catalog/categories`, section: 'Catalogue', hint: 'How products are grouped in the shop' },
	{ title: 'Bag sizes', url: `${D}/catalog/bag-sizes`, section: 'Catalogue', hint: '250 g, 500 g, 1 kg and their low-stock levels' },
	{ title: 'Roast levels', url: `${D}/catalog/roast-levels`, section: 'Catalogue', hint: 'Light, medium, dark (jebena)' },
	{ title: 'Grinds', url: `${D}/catalog/grinds`, section: 'Catalogue', hint: 'Whole bean, espresso, filter' },
	{ title: 'Packaging', url: `${D}/catalog/packaging`, section: 'Catalogue', hint: 'Bags and gift boxes' },
	{ title: 'Varieties', url: `${D}/origins/varieties`, section: 'Catalogue', hint: 'Coffee varieties for lots' },
	{ title: 'Certifications', url: `${D}/origins/certifications`, section: 'Catalogue', hint: 'Organic, Fairtrade and the like' },
	{ title: 'Roasting machines', url: `${D}/stock/machines`, section: 'Catalogue', hint: 'Roasters and their batch sizes' },
	{ title: 'Quantity tiers', url: `${D}/wholesale/tiers`, section: 'Selling', hint: 'Wholesale prices by quantity' },
	{ title: 'Tax rates', url: `${D}/admin/taxes`, section: 'Selling', hint: 'VAT, inclusive prices' },
	{ title: 'Audiences', url: `${D}/admin/audiences`, section: 'Selling', hint: 'Resident, foreign visitor' },
	{ title: 'Delivery zones', url: `${D}/customers/delivery/zones`, section: 'Selling', hint: 'Fees and days per zone' },
	{ title: 'Delivery areas', url: `${D}/customers/delivery/areas`, section: 'Selling', hint: 'Neighbourhoods in each zone' },
	{ title: 'Couriers', url: `${D}/customers/delivery/couriers`, section: 'Selling', hint: 'Outside Addis, with tracking links' },
	{ title: 'Membership plans', url: `${D}/memberships/plans`, section: 'Selling', hint: 'Levels, prices, benefits' },
	{ title: 'Subscription plans', url: `${D}/subscriptions/plans`, section: 'Selling', hint: 'Coffee subscriptions' },
	{ title: 'Ticket types', url: `${D}/visits/ticket-types`, section: 'Visits and bookings', hint: 'Who pays what to visit' },
	{ title: 'Slot pattern', url: `${D}/visits/slot-templates`, section: 'Visits and bookings', hint: 'Entry times and capacity per weekday' },
	{ title: 'Scanner devices', url: `${D}/visits/devices`, section: 'Visits and bookings', hint: 'Phones and tablets at the gate' },
	{ title: 'What can be booked', url: `${D}/bookings/bookables`, section: 'Visits and bookings', hint: 'Tours, ceremonies, cuppings, venue hire' },
	{ title: 'Post categories', url: `${D}/content/post-categories`, section: 'System', hint: 'How blog posts are grouped' },
	{ title: 'Languages', url: `${D}/admin/languages`, section: 'System', hint: 'Amharic, English, Afaan Oromo, Arabic' },
	{ title: 'Document numbers', url: `${D}/admin/sequences`, section: 'System', hint: 'Order, lot and batch series' },
	{ title: 'Message templates', url: `${D}/admin/templates`, section: 'System', hint: 'SMS and email wording' },
	{ title: 'Payment webhooks', url: `${D}/admin/webhooks`, section: 'System', hint: 'Gateway callbacks as received' }
];

/**
 * The sidebar and the search palette. Each entry is shown only if `access` lets the viewer in.
 *
 * Grouped by the work, daily things first. Setup lists — bag sizes, tax rates, ticket types —
 * are `hidden`: out of the sidebar, still found by search (Ctrl K), still lighting their group,
 * and listed on the Setup overview (`/dashboard/admin`).
 */
export const NAVIGATION: NavItem[] = [
	{ title: 'Dashboard', url: D, icon: LayoutDashboard },
	{ title: 'Inbox', url: `${D}/inbox`, icon: Inbox },
	{
		title: 'Sales',
		url: `${D}/orders`,
		icon: ShoppingBag,
		items: [
			{ title: 'Orders', url: `${D}/orders`, icon: ShoppingBag },
			{ title: 'Payments', url: `${D}/orders/payments`, icon: ShoppingBag },
			{ title: 'Refunds', url: `${D}/orders/refunds`, icon: ShoppingBag },
			{ title: 'Invoices', url: `${D}/orders/invoices`, icon: ShoppingBag },
			{ title: 'Discount codes', url: `${D}/orders/discounts`, icon: ShoppingBag }
		]
	},
	{
		title: 'Customers',
		url: `${D}/customers`,
		icon: Users,
		items: [
			{ title: 'Customers', url: `${D}/customers`, icon: Users },
			{ title: 'Business accounts', url: `${D}/wholesale/accounts`, icon: Users }
		]
	},
	{
		title: 'Visits',
		url: `${D}/visits/tickets`,
		icon: Ticket,
		items: [
			{ title: 'Gate scanner', url: `${D}/visits/scanner`, icon: QrCode },
			{ title: 'Check-in desk', url: `${D}/visits/desk`, icon: ScanLine },
			{ title: 'Tickets', url: `${D}/visits/tickets`, icon: Ticket },
			{ title: 'Visit days', url: `${D}/visits/days`, icon: Ticket },
			{ title: 'Events', url: `${D}/visits/events`, icon: Ticket },
			{ title: 'Scans', url: `${D}/visits/scans`, icon: Ticket }
		]
	},
	{
		title: 'Bookings',
		url: `${D}/bookings`,
		icon: CalendarCheck,
		items: [
			{ title: 'Bookings', url: `${D}/bookings`, icon: CalendarCheck },
			{ title: 'Sessions', url: `${D}/bookings/sessions`, icon: CalendarCheck },
			{ title: 'Staff assignments', url: `${D}/bookings/assignments`, icon: CalendarCheck }
		]
	},
	{
		title: 'Members',
		url: `${D}/memberships`,
		icon: IdCard,
		items: [
			{ title: 'Memberships', url: `${D}/memberships`, icon: IdCard },
			{ title: 'Subscriptions', url: `${D}/subscriptions`, icon: IdCard }
		]
	},
	{
		title: 'Roastery',
		url: `${D}/stock`,
		icon: Flame,
		items: [
			{ title: 'Stock on hand', url: `${D}/stock`, icon: Flame },
			{ title: 'Receive green coffee', url: `${D}/stock/receive`, icon: Flame },
			{ title: 'Roast batches', url: `${D}/stock/roasts`, icon: Flame },
			{ title: 'Packing runs', url: `${D}/stock/packing`, icon: Flame },
			{ title: 'Stock counts', url: `${D}/stock/counts`, icon: Flame },
			{ title: 'Movements', url: `${D}/stock/movements`, icon: Flame }
		]
	},
	{
		title: 'Catalogue',
		url: `${D}/catalog/products`,
		icon: Coffee,
		items: [
			{ title: 'Products', url: `${D}/catalog/products`, icon: Coffee },
			{ title: 'Variants & prices', url: `${D}/catalog/variants`, icon: Coffee },
			{ title: 'Bundles', url: `${D}/catalog/bundles`, icon: Coffee }
		]
	},
	{
		title: 'Origins',
		url: `${D}/origins/lots`,
		icon: Sprout,
		items: [
			{ title: 'Lots', url: `${D}/origins/lots`, icon: Sprout },
			{ title: 'Stations & farms', url: `${D}/origins/stations`, icon: Sprout },
			{ title: 'Regions', url: `${D}/origins/regions`, icon: Sprout }
		]
	},
	{
		title: 'Website',
		url: `${D}/content/pages`,
		icon: Globe,
		items: [
			{ title: 'Pages', url: `${D}/content/pages`, icon: Globe },
			{ title: 'Posts', url: `${D}/content/posts`, icon: Globe },
			{ title: 'Media library', url: `${D}/content/media`, icon: Globe },
			{ title: 'Knowledge base', url: `${D}/content/knowledge`, icon: Globe },
			{ title: 'Virtual tour', url: `${D}/content/tour`, icon: Globe },
			{ title: 'AI conversations', url: `${D}/content/ai`, icon: Globe }
		]
	},
	{ title: 'Reports', url: `${D}/reports`, icon: ChartPie },
	{
		title: 'Setup',
		url: `${D}/admin`,
		icon: Settings,
		items: [
			{ title: 'Overview', url: `${D}/admin`, icon: Settings },
			{ title: 'Staff & users', url: `${D}/admin/users`, icon: Settings },
			{ title: 'Roles', url: `${D}/admin/roles`, icon: Settings },
			{ title: 'Settings', url: `${D}/admin/settings`, icon: Settings },
			{ title: 'Outbox', url: `${D}/admin/messages`, icon: Settings },
			{ title: 'Audit log', url: `${D}/admin/audit-log`, icon: Settings },
			...SETUP.map((entry) => ({ title: entry.title, url: entry.url, icon: Settings, hidden: true }))
		]
	}
];

/**
 * Where each kind of record's page lives (`{base}/{id}`), so a foreign key in any table renders as
 * a link — and only for a viewer who may open it. Use with `link(entity, id, name)` in `#lib/cells`.
 */
export const ENTITIES: Record<string, string> = {
	user: `${D}/admin/users`,
	role: `${D}/admin/roles`,
	location: `${D}/admin/locations`,
	auditEntry: `${D}/admin/audit-log`,
	notification: `${D}/admin/messages`,
	webhook: `${D}/admin/webhooks`,

	product: `${D}/catalog/products`,
	variant: `${D}/catalog/variants`,
	bundle: `${D}/catalog/bundles`,
	region: `${D}/origins/regions`,
	station: `${D}/origins/stations`,
	lot: `${D}/origins/lots`,

	roastBatch: `${D}/stock/roasts`,
	packingRun: `${D}/stock/packing`,
	stockCount: `${D}/stock/counts`,

	customer: `${D}/customers`,
	business: `${D}/wholesale/accounts`,
	order: `${D}/orders`,
	payment: `${D}/orders/payments`,
	refund: `${D}/orders/refunds`,
	invoice: `${D}/orders/invoices`,
	discount: `${D}/orders/discounts`,

	ticketType: `${D}/visits/ticket-types`,
	visitDay: `${D}/visits/days`,
	ticket: `${D}/visits/tickets`,
	event: `${D}/visits/events`,
	membership: `${D}/memberships`,
	membershipPlan: `${D}/memberships/plans`,
	subscription: `${D}/subscriptions`,
	bookable: `${D}/bookings/bookables`,
	session: `${D}/bookings/sessions`,
	booking: `${D}/bookings`,
	submission: `${D}/inbox`,

	page: `${D}/content/pages`,
	post: `${D}/content/posts`,
	scene: `${D}/content/tour`,
	conversation: `${D}/content/ai`
};
