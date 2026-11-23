import { createAccess } from '@nahu/admin-kit/access';

/**
 * Every permission the code knows, written to `permissions` on boot (`syncAccessTables`), so the
 * roles screen can grant it. The strings live only here and in `#lib/server/roles.ts`.
 *
 * `*.view` opens a section's pages; `*.manage` is checked by its actions (`requirePermission`)
 * and by the `new`/`edit` route rules below.
 */
export const PERMISSIONS = [
	{ name: 'reports.view', description: 'Sales, stock, visits and membership reports' },

	{ name: 'catalog.view', description: 'Products, sizes and options' },
	{ name: 'catalog.manage', description: 'Add and edit products, prices and options' },
	{ name: 'origins.view', description: 'Regions, stations, lots and certifications' },
	{ name: 'origins.manage', description: 'Add and edit lots, stations and regions' },
	{ name: 'stock.view', description: 'Green, roasted and packed stock, roasts and packing runs' },
	{ name: 'stock.manage', description: 'Record roasts, packing runs, counts and adjustments' },

	{ name: 'orders.view', description: 'Orders, payments and invoices' },
	{ name: 'orders.manage', description: 'Change order status, record payments' },
	{ name: 'refunds.manage', description: 'Request and approve refunds' },
	{ name: 'discounts.manage', description: 'Discount codes' },
	{ name: 'customers.view', description: 'Customers and their contact details' },
	{ name: 'customers.manage', description: 'Add and edit customers, addresses and credit' },
	{ name: 'delivery.manage', description: 'Delivery zones, areas and couriers' },
	{ name: 'wholesale.view', description: 'Business accounts and tiers' },
	{ name: 'wholesale.manage', description: 'Approve business accounts, set credit and tiers' },

	{ name: 'visits.view', description: 'Tickets, visit days, slots and scans' },
	{ name: 'visits.manage', description: 'Ticket types, prices, capacity and slots' },
	{ name: 'events.manage', description: 'Events' },
	{ name: 'memberships.view', description: 'Members and subscriptions' },
	{ name: 'memberships.manage', description: 'Membership plans, members and subscriptions' },
	{ name: 'bookings.view', description: 'Bookings, sessions and staff assignments' },
	{ name: 'bookings.manage', description: 'Bookables, sessions, bookings and staff' },
	{ name: 'inbox.view', description: 'Form submissions' },
	{ name: 'inbox.manage', description: 'Handle form submissions' },

	{ name: 'content.manage', description: 'Pages, posts, media, FAQ and the virtual tour' },
	{ name: 'ai.view', description: 'AI agent conversations' },
	{ name: 'ai.manage', description: 'Take over AI chats and hand them back' },

	{
		name: 'settings.manage',
		description: 'Locations, hours, taxes, audiences, languages, settings'
	},
	{ name: 'messages.view', description: 'Outgoing messages, templates and webhooks' },
	{
		name: 'messages.manage',
		description: 'Retry, skip and replay messages and webhooks; edit templates'
	},
	{ name: 'users.manage', description: 'Staff accounts, roles and permissions' },
	{ name: 'audit.view', description: 'The audit log' }
] as const;

export type Permission = (typeof PERMISSIONS)[number]['name'];

const D = '/dashboard';

/**
 * Who may open what: one rule per route prefix, first match wins, so specific prefixes go before
 * general ones. Pages under /dashboard with no rule are closed — add a rule with every new page.
 * `permission: null` means any signed-in user.
 */
export const access = createAccess({
	root: D,
	rules: [
		{ prefix: D, permission: null, exact: true },
		{ prefix: `${D}/files/`, permission: null },
		{ prefix: `${D}/account`, permission: null },
		{ prefix: `${D}/upload`, permission: 'content.manage' },
		{ prefix: `${D}/reports`, permission: 'reports.view' },

		// ── Catalogue and origins ─────────────────────────────────────────────────────────────
		{ prefix: `${D}/catalog/products/new`, permission: 'catalog.manage' },
		{ prefix: `${D}/catalog`, permission: 'catalog.view' },
		{ prefix: `${D}/origins/lots/new`, permission: 'origins.manage' },
		{ prefix: `${D}/origins`, permission: 'origins.view' },

		// ── Stock ─────────────────────────────────────────────────────────────────────────────
		{ prefix: `${D}/stock/roasts/new`, permission: 'stock.manage' },
		{ prefix: `${D}/stock/packing/new`, permission: 'stock.manage' },
		{ prefix: `${D}/stock/counts/new`, permission: 'stock.manage' },
		{ prefix: `${D}/stock/receive`, permission: 'stock.manage' },
		{ prefix: `${D}/stock`, permission: 'stock.view' },

		// ── Sales ─────────────────────────────────────────────────────────────────────────────
		{ prefix: `${D}/orders/discounts`, permission: 'discounts.manage' },
		{ prefix: `${D}/orders/refunds`, permission: 'orders.view' },
		{ prefix: `${D}/orders`, permission: 'orders.view' },
		{ prefix: `${D}/customers/delivery`, permission: 'delivery.manage' },
		{ prefix: `${D}/customers/new`, permission: 'customers.manage' },
		{ prefix: `${D}/customers`, permission: 'customers.view' },
		{ prefix: `${D}/wholesale`, permission: 'wholesale.view' },

		// ── Museum ────────────────────────────────────────────────────────────────────────────
		{ prefix: `${D}/visits/events/new`, permission: 'events.manage' },
		{ prefix: `${D}/visits`, permission: 'visits.view' },
		{ prefix: `${D}/memberships`, permission: 'memberships.view' },
		{ prefix: `${D}/subscriptions`, permission: 'memberships.view' },
		{ prefix: `${D}/bookings`, permission: 'bookings.view' },
		{ prefix: `${D}/inbox`, permission: 'inbox.view' },

		// ── Website ───────────────────────────────────────────────────────────────────────────
		{ prefix: `${D}/content/ai`, permission: 'ai.view' },
		{ prefix: `${D}/content`, permission: 'content.manage' },

		// ── Admin ─────────────────────────────────────────────────────────────────────────────
		{ prefix: `${D}/admin/users`, permission: 'users.manage' },
		{ prefix: `${D}/admin/roles`, permission: 'users.manage' },
		{ prefix: `${D}/admin/audit-log`, permission: 'audit.view' },
		{ prefix: `${D}/admin/messages`, permission: 'messages.view' },
		{ prefix: `${D}/admin/templates`, permission: 'messages.view' },
		{ prefix: `${D}/admin/webhooks`, permission: 'messages.view' },
		{ prefix: `${D}/admin`, permission: 'settings.manage' }
	]
});
