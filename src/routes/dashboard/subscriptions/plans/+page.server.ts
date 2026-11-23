import { lookupDeleteAction } from '@nahu/admin-kit/server/lookupDelete';
import { subscriptionPlan } from '#lib/server/db/schema.ts';
import { localizedCrud } from '#lib/server/records.ts';
import { subscriptionPlanEditSchema, subscriptionPlanSchema } from '#lib/schemas/memberships.ts';

const crud = localizedCrud({
	table: subscriptionPlan,
	permission: 'memberships.manage',
	label: 'Subscription plan',
	addSchema: subscriptionPlanSchema,
	editSchema: subscriptionPlanEditSchema,
	uniqueField: 'deliveries',
	localized: ['name']
});

export const load = () => crud.load();
export const actions = {
	...crud.actions,
	delete: lookupDeleteAction(subscriptionPlan, 'subscription plan')
};
