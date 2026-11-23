import { PERMISSIONS, type Permission } from '#lib/access.ts';

/** The role whose holders may do everything, whatever its rows say (questionnaire 5.1). */
export const OWNER = 'Owner';

export type RoleDefinition = {
	name: string;
	description: string;
	permissions: readonly Permission[] | 'all';
};

/**
 * The roles a fresh install starts with (questionnaire 5.1). Created once each; after that the
 * Owner edits them in Admin › Roles and boot never touches their grants again.
 */
export const DEFAULT_ROLES: readonly RoleDefinition[] = [
	{ name: OWNER, description: 'Everything, including users, roles and settings', permissions: 'all' },
	{
		name: 'Manager',
		description: 'Orders, refunds, stock, tickets, bookings, members and reports',
		permissions: [
			'reports.view',
			'catalog.view',
			'catalog.manage',
			'origins.view',
			'origins.manage',
			'stock.view',
			'stock.manage',
			'orders.view',
			'orders.manage',
			'refunds.manage',
			'discounts.manage',
			'customers.view',
			'customers.manage',
			'delivery.manage',
			'wholesale.view',
			'wholesale.manage',
			'visits.view',
			'visits.manage',
			'events.manage',
			'memberships.view',
			'memberships.manage',
			'bookings.view',
			'bookings.manage',
			'inbox.view',
			'inbox.manage',
			'ai.view',
			'ai.manage',
			'messages.view',
			'messages.manage',
			'audit.view'
		]
	},
	{
		name: 'Shop staff',
		description: 'Orders, packed stock, packing runs and desk sales',
		permissions: ['orders.view', 'orders.manage', 'customers.view', 'stock.view', 'catalog.view']
	},
	{
		name: 'Roaster',
		description: 'Lots, green and roasted stock, roast batches',
		permissions: ['origins.view', 'origins.manage', 'stock.view', 'stock.manage', 'catalog.view', 'reports.view']
	},
	{
		name: 'Front desk',
		description: 'Tickets, bookings, members and form submissions',
		permissions: [
			'visits.view',
			'reports.view',
			'bookings.view',
			'bookings.manage',
			'memberships.view',
			'inbox.view',
			'inbox.manage',
			'customers.view'
		]
	},
	{ name: 'Ticket scanner', description: 'Scans and check-ins only', permissions: ['visits.view'] },
	{
		name: 'Content editor',
		description: 'Pages, posts, media, FAQ and product text',
		permissions: ['content.manage', 'catalog.view', 'origins.view']
	},
	{
		name: 'Accountant',
		description: 'Read-only: sales, VAT, refunds and stock value',
		permissions: ['reports.view', 'orders.view', 'stock.view']
	}
];

export const permissionsOf = (role: RoleDefinition): readonly string[] =>
	role.permissions === 'all' ? PERMISSIONS.map((p) => p.name) : role.permissions;
