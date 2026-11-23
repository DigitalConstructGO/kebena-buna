<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import type { ColumnDef } from '@tanstack/table-core';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Globe from '@lucide/svelte/icons/globe';
	import UserMinus from '@lucide/svelte/icons/user-minus';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import SingleTable from '@nahu/admin-kit/components/SingleTable.svelte';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import ConfirmAction from '@nahu/admin-kit/components/ConfirmAction.svelte';
	import Empty from '@nahu/admin-kit/components/Empty.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import StatCard from '@nahu/admin-kit/components/reports/StatCard.svelte';
	import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { fileUrl } from '@nahu/admin-kit/files';
	import { dateTime, flag, link, status, user } from '#lib/cells.ts';
	import { formatDateTime, humanize, tr, yesNo } from '#lib/format.ts';
	import { badge } from '#lib/status.ts';
	import { stampRows, useLinks } from '#lib/links.ts';
	import { assignmentSchema, ticketTypeSchema } from '#lib/schemas/visits.ts';
	import TicketTypeFields from '../../ticket-types/TicketTypeFields.svelte';

	let { data } = $props();
	const e = $derived(data.event);
	const href = useLinks();
	const live = $derived(data.registrations.filter((r) => r.status !== 'cancelled' && r.status !== 'refunded'));
	const checkedIn = $derived(data.registrations.filter((r) => r.status === 'used').length);

	type Type = (typeof data.types)[number];
	const typeColumns: ColumnDef<Type>[] = [
		{ id: 'name', header: 'Ticket type', cell: ({ row }) => link('ticketType', row.original.id, row.original.name) },
		{ id: 'code', header: 'Code', cell: ({ row }) => row.original.code },
		{ id: 'prices', header: 'Prices (ETB)', cell: ({ row }) => row.original.prices || 'No price set' },
		{ id: 'sold', header: 'Tickets', meta: { align: 'right' }, cell: ({ row }) => row.original.sold },
		{ id: 'active', header: 'Status', cell: ({ row }) => flag(row.original.isActive, 'On sale', 'Off sale') }
	];
	type Reg = (typeof data.registrations)[number];
	const regColumns: ColumnDef<Reg>[] = [
		{ id: 'code', header: 'Ticket', cell: ({ row }) => link('ticket', row.original.id, row.original.code) },
		{
			id: 'holder',
			header: 'Holder',
			cell: ({ row }) =>
				row.original.customerId
					? link('customer', row.original.customerId, row.original.customer ?? row.original.holderName)
					: (row.original.holderName ?? '—')
		},
		{ id: 'type', header: 'Type', cell: ({ row }) => link('ticketType', row.original.typeId, row.original.type) },
		{ id: 'audience', header: 'Audience', meta: { class: 'hidden md:table-cell' }, cell: ({ row }) => row.original.audience },
		{ id: 'order', header: 'Order', meta: { class: 'hidden lg:table-cell' }, cell: ({ row }) => (row.original.orderId ? link('order', row.original.orderId, `#${row.original.orderId}`) : '—') },
		{ id: 'issued', header: 'Registered', cell: ({ row }) => dateTime(row.original.issuedAt) },
		{ id: 'status', header: 'Status', cell: ({ row }) => status(row.original.status) }
	];
	type Assignment = (typeof data.assignments)[number];
	const staffColumns: ColumnDef<Assignment>[] = [
		{ id: 'name', header: 'Who', cell: ({ row }) => user(row.original.userId, row.original.name) },
		{ id: 'role', header: 'Role', cell: ({ row }) => humanize(row.original.role) },
		{ id: 'by', header: 'Assigned by', cell: ({ row }) => user(row.original.byId, row.original.by) },
		{
			id: 'remove',
			header: '',
			cell: ({ row }) =>
				data.canManage
					? renderComponent(ConfirmAction, {
							action: '?/unassign',
							label: 'Remove',
							icon: UserMinus,
							variant: 'ghost',
							title: `Take ${row.original.name} off this event?`,
							fields: { id: row.original.id }
						})
					: ''
		}
	];
</script>

<PageHeader title={tr(e.title)} eyebrow="Event" description="{formatDateTime(e.startsAt)} – {formatDateTime(e.endsAt)} · {data.location}">
	{#snippet badges()}
		<Statuses {...badge(e.publishStatus)} />
		<Statuses status="ready" label={humanize(e.visibility)} />
	{/snippet}
	{#snippet actions()}
		{#if data.canManage}
			<Button href="/dashboard/visits/events/{e.id}/edit" variant="outline"><Pencil class="size-4" /> Edit</Button>
			<ConfirmAction
				action="?/publish"
				label={e.publishStatus === 'published' ? 'Unpublish' : 'Publish'}
				icon={Globe}
				variant="outline"
				title={e.publishStatus === 'published' ? 'Take it off the website?' : 'Publish this event?'}
				description={e.publishStatus === 'published' ? 'It stays here as a draft; tickets already issued stay valid.' : 'It appears on the website and opens for registration.'}
			/>
			<ConfirmAction
				action="?/delete"
				label="Delete"
				icon={Trash2}
				variant="destructive"
				title="Delete {tr(e.title)}?"
				description="Only an event nobody registered for can be deleted."
			/>
		{/if}
	{/snippet}
</PageHeader>

<div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
	<StatCard stat={{ key: 'registered', label: 'Registered', value: e.registered, format: 'count', group: 'event', hint: `of ${e.capacity} places`, tone: e.registered >= e.capacity ? 'warning' : 'positive' }} />
	<StatCard stat={{ key: 'live', label: 'Tickets live', value: live.length, format: 'count', group: 'event' }} />
	<StatCard stat={{ key: 'in', label: 'Checked in', value: checkedIn, format: 'count', group: 'event' }} />
</div>

<div class="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
	<div class="grid min-w-0 grid-cols-1 content-start gap-6">
		{#if e.image}
			<img src={fileUrl(e.image)} alt="" class="w-full rounded-lg border object-cover" />
		{/if}
		<PageSection title="Event">
			<SingleTable
				singleTable={[
					{ name: 'Location', value: data.location, href: href('location', e.locationId) },
					{ name: 'Address', value: `/events/${e.slug}` },
					{ name: 'Summary', value: tr(e.summary) || '—', long: 40 },
					{ name: 'Free', value: yesNo(e.isFree) },
					{ name: 'Includes museum entry', value: yesNo(e.includesEntry) },
					{ name: 'Registration closes', value: formatDateTime(e.registrationClosesAt) },
					{ name: 'Title (Amharic)', value: e.title?.am ?? '—' },
					...stampRows(data.stamps, href)
				]}
			/>
		</PageSection>
		{#if e.description?.en}
			<PageSection title="Description">
				<!-- Sanitised on save (sanitizeRichHtml). -->
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				<div class="prose prose-sm max-w-none dark:prose-invert">{@html e.description.en}</div>
			</PageSection>
		{/if}
	</div>
	<div class="grid min-w-0 grid-cols-1 content-start gap-6">
		<PageSection title="Ticket types" hint="Prices per audience are set on each type's page.">
			{#snippet actions()}
				<FormDialog
					title="New ticket type for this event"
					triggerLabel="Add ticket type" triggerIcon={Plus} submitIcon={Plus}
					action="?/addType"
					data={data.typeForm}
					schema={ticketTypeSchema}
					resetOnSuccess
					disabled={!data.canManage}
				>
					{#snippet fields({ form, errors })}
						<InputComp type="hidden" name="eventId" {form} {errors} />
						<TicketTypeFields form={form as never} errors={errors as never} taxRates={data.taxRates} />
					{/snippet}
				</FormDialog>
			{/snippet}
			{#if data.types.length}
				<DataTable variant="compact" columns={typeColumns} data={data.types} />
			{:else}<Empty message="No ticket types yet: add one to open registration" />{/if}
		</PageSection>
		<PageSection title="Staff">
			{#snippet actions()}
				<FormDialog title="Assign staff" triggerLabel="Assign" action="?/assign" data={data.assignForm} schema={assignmentSchema} resetOnSuccess disabled={!data.canManage}>
					{#snippet fields({ form, errors })}
						<InputComp label="Who" name="userId" type="combo" items={data.staff} {form} {errors} required />
						<InputComp label="Role" name="role" placeholder="guide, host, barista…" {form} {errors} required />
					{/snippet}
				</FormDialog>
			{/snippet}
			{#if data.assignments.length}
				<DataTable variant="compact" columns={staffColumns} data={data.assignments} />
			{:else}<Empty message="Nobody assigned yet" />{/if}
		</PageSection>
		<PageSection title="Registrations">
			{#if data.registrations.length}
				<DataTable columns={regColumns} data={data.registrations} fileName="Registrations {e.slug}" />
			{:else}<Empty message="Nobody has registered yet" />{/if}
		</PageSection>
	</div>
</div>
