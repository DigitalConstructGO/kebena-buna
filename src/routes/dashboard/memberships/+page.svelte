<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import type { ColumnDef } from '@tanstack/table-core';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { date, link, sortable, status, user } from '#lib/cells.ts';
	import { choicesOf, humanize } from '#lib/format.ts';
	import { RENEWAL_METHODS } from '#lib/constants.ts';
	import { newMembershipSchema } from '#lib/schemas/memberships.ts';
	import { useLinks } from '#lib/links.ts';

	let { data } = $props();
	type Row = (typeof data.rows)[number];

	/** An active or grace term ending within 30 days: due for its renewal reminder (7.4). */
	const dueSoon = (row: Row) => {
		if (!row.endsOn || !['active', 'grace'].includes(row.status)) return false;
		const days = (Date.parse(row.endsOn) - Date.parse(data.today)) / 86_400_000;
		return days <= 30;
	};

	const columns: ColumnDef<Row>[] = [
		{
			id: 'number',
			accessorKey: 'number',
			header: sortable('Membership'),
			cell: ({ row }) => link('membership', row.original.id, row.original.number)
		},
		{
			id: 'customer',
			accessorKey: 'customer',
			header: sortable('Customer'),
			cell: ({ row }) => link('customer', row.original.customerId, row.original.customer)
		},
		{
			id: 'planId',
			header: 'Plan',
			cell: ({ row }) => link('membershipPlan', row.original.planId, row.original.plan)
		},
		{ id: 'status', header: 'Status', cell: ({ row }) => status(row.original.status) },
		{
			id: 'startsOn',
			accessorKey: 'startsOn',
			header: sortable('Starts'),
			meta: { class: 'hidden md:table-cell' },
			cell: ({ row }) => date(row.original.startsOn)
		},
		{
			id: 'endsOn',
			accessorKey: 'endsOn',
			header: sortable('Ends'),
			cell: ({ row }) =>
				dueSoon(row.original) ? `${date(row.original.endsOn)} · renew` : date(row.original.endsOn)
		},
		{
			id: 'members',
			header: 'Members',
			meta: { align: 'right', class: 'hidden md:table-cell' },
			cell: ({ row }) => row.original.members
		},
		{
			id: 'renewalMethod',
			header: 'Renews by',
			meta: { class: 'hidden lg:table-cell' },
			cell: ({ row }) => humanize(row.original.renewalMethod)
		},
		{
			id: 'createdBy',
			header: 'Sold by',
			meta: { class: 'hidden lg:table-cell' },
			cell: ({ row }) => user(row.original.createdById, row.original.createdBy)
		}
	];
	const href = useLinks();
</script>

<PageHeader
	title="Memberships"
	description="Every membership term. Terms ending within 30 days are tinted: they are due their renewal reminder."
>
	{#snippet actions()}
		{#if data.canManage}
			<FormDialog
				title="New membership"
				triggerLabel="New membership"
				triggerVariant="default"
				triggerIcon={Plus}
				submitIcon={Plus}
				action="?/add"
				data={data.newForm}
				schema={newMembershipSchema}
				submitLabel="Create"
				description="Starts awaiting payment, with the customer as its first member."
			>
				{#snippet fields({ form, errors })}
					<InputComp
						label="Customer"
						name="customerId"
						type="combo"
						items={data.customers}
						{form}
						{errors}
						required
					/>
					<InputComp
						label="Plan"
						name="planId"
						type="select"
						items={data.plans}
						{form}
						{errors}
						required
					/>
					<InputComp
						label="Starts"
						name="startsOn"
						type="date"
						futureDays
						{form}
						{errors}
						required
					/>
					<InputComp
						label="Renews by"
						name="renewalMethod"
						type="select"
						items={choicesOf(RENEWAL_METHODS)}
						{form}
						{errors}
					/>
				{/snippet}
			</FormDialog>
		{/if}
	{/snippet}
</PageHeader>

<DataTable
	rowHref={(row) => href('membership', row.id)}
	{columns}
	data={data.rows}
	server={data.server}
	facetKeys={['status', 'planId']}
	facetLabels={{ status: 'Status', planId: 'Plan' }}
	dateFilter="Ends"
	rowClass={(row) => (dueSoon(row) ? 'bg-warning/10' : null)}
	charts
	fileName="Memberships"
/>
