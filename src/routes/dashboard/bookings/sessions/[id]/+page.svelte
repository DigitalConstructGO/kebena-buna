<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import type { ColumnDef } from '@tanstack/table-core';
	import Ban from '@lucide/svelte/icons/ban';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import UserMinus from '@lucide/svelte/icons/user-minus';
	import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import SingleTable from '@nahu/admin-kit/components/SingleTable.svelte';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import ConfirmAction from '@nahu/admin-kit/components/ConfirmAction.svelte';
	import Notice from '@nahu/admin-kit/components/Notice.svelte';
	import Empty from '@nahu/admin-kit/components/Empty.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import StatCard from '@nahu/admin-kit/components/reports/StatCard.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { dateTime, link, longText, phone, status, user } from '#lib/cells.ts';
	import { formatDateTime, humanize } from '#lib/format.ts';
	import { flag } from '#lib/status.ts';
	import { stampRows, useLinks } from '#lib/links.ts';
	import { sessionEditSchema, staffAssignmentSchema } from '#lib/schemas/bookings.ts';

	let { data } = $props();
	const s = $derived(data.session);
	const href = useLinks();

	type Booking = (typeof data.bookings)[number];
	const bookingColumns: ColumnDef<Booking>[] = [
		{ id: 'number', header: 'Booking', cell: ({ row }) => link('booking', row.original.id, row.original.number) },
		{ id: 'who', header: 'Who', cell: ({ row }) => link('customer', row.original.customerId, row.original.contactName) },
		{ id: 'phone', header: 'Phone', cell: ({ row }) => phone(row.original.contactPhone) },
		{ id: 'party', header: 'People', meta: { align: 'right' }, cell: ({ row }) => row.original.partySize },
		{ id: 'language', header: 'Language', cell: ({ row }) => row.original.language ?? '—' },
		{ id: 'requests', header: 'Requests', cell: ({ row }) => longText(row.original.specialRequests, 25) },
		{ id: 'status', header: 'Status', cell: ({ row }) => status(row.original.status) }
	];
	type Staff = (typeof data.staff)[number];
	const staffColumns: ColumnDef<Staff>[] = [
		{ id: 'user', header: 'Who', cell: ({ row }) => user(row.original.userId, row.original.user) },
		{ id: 'role', header: 'Role', cell: ({ row }) => humanize(row.original.role) },
		{ id: 'from', header: 'From', cell: ({ row }) => dateTime(row.original.startsAt) },
		{ id: 'to', header: 'To', cell: ({ row }) => dateTime(row.original.endsAt) },
		{ id: 'by', header: 'Assigned by', cell: ({ row }) => user(row.original.assignedById, row.original.assignedBy) },
		{
			id: 'remove',
			header: '',
			cell: ({ row }) =>
				data.canManage
					? renderComponent(ConfirmAction, {
							action: '?/unstaff',
							label: 'Remove',
							icon: UserMinus,
							variant: 'ghost',
							title: `Take ${row.original.user} off this session?`,
							fields: { assignmentId: row.original.id }
						})
					: ''
		}
	];
</script>

<PageHeader title={`${data.bookable} · ${formatDateTime(s.startsAt)}`} eyebrow="Session" tabTitle={`Session ${formatDateTime(s.startsAt)}`}>
	{#snippet badges()}
		<Statuses {...flag(!s.isCancelled, 'Running', 'Cancelled')} />
	{/snippet}
	{#snippet actions()}
		{#if data.canManage}
			<FormDialog title="Edit session" triggerLabel="Edit" action="?/edit" data={data.editForm} schema={sessionEditSchema}>
				{#snippet fields({ form, errors })}
					<InputComp label="Date" name="date" type="date" futureDays {form} {errors} required />
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<InputComp label="Starts" name="startsAt" type="time" {form} {errors} required />
						<InputComp label="Ends" name="endsAt" type="time" {form} {errors} required />
						<InputComp label="Places" name="capacity" type="number" {form} {errors} required />
						<InputComp label="Language" name="language" type="select" items={[{ value: 'am', name: 'Amharic' }, { value: 'en', name: 'English' }]} {form} {errors} />
					</div>
					<InputComp label="Notes" name="notes" type="textarea" rows={2} {form} {errors} />
				{/snippet}
			</FormDialog>
			<ConfirmAction
				action="?/toggle"
				label={s.isCancelled ? 'Reinstate' : 'Cancel session'}
				icon={s.isCancelled ? RotateCcw : Ban}
				variant={s.isCancelled ? 'outline' : 'destructive'}
				title={s.isCancelled ? 'Run this session after all?' : 'Cancel this session?'}
				description="Bookings on it are not changed: move or refund each from its own page."
			/>
		{/if}
	{/snippet}
</PageHeader>

{#if s.isCancelled && data.bookings.some((b) => b.status !== 'cancelled')}
	<Notice tone="warning" class="mt-4" title="Cancelled with bookings on it">
		Contact each visitor below and cancel or move their booking.
	</Notice>
{/if}

<div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
	<StatCard stat={{ key: 'booked', label: 'Booked', value: s.booked, format: 'count', group: 'session' }} />
	<StatCard stat={{ key: 'free', label: 'Free places', value: s.capacity - s.booked, format: 'count', group: 'session', tone: s.capacity - s.booked <= 0 ? 'warning' : 'positive' }} />
	<StatCard stat={{ key: 'staff', label: 'Staff', value: data.staff.length, format: 'count', group: 'session', tone: data.staff.length ? 'neutral' : 'warning' }} />
</div>

<div class="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
	<PageSection title="Session">
		<SingleTable
			singleTable={[
				{ name: 'What', value: data.bookable, href: href('bookable', s.bookableId) },
				{ name: 'Starts', value: formatDateTime(s.startsAt) },
				{ name: 'Ends', value: formatDateTime(s.endsAt) },
				{ name: 'Language', value: s.language ?? '—' },
				{ name: 'Places', value: s.capacity },
				{ name: 'Notes', value: s.notes ?? '—', long: 40 },
				...stampRows(data.stamps, href)
			]}
		/>
	</PageSection>
	<div class="grid min-w-0 grid-cols-1 content-start gap-6">
		<PageSection title="Bookings">
			{#if data.bookings.length}
				<DataTable variant="compact" columns={bookingColumns} data={data.bookings} />
			{:else}<Empty message="Nobody has booked this session" />{/if}
		</PageSection>
		<PageSection title="Staff" hint="A clash with someone's other work is warned when they are assigned.">
			{#snippet actions()}
				<FormDialog title="Put someone on this session" triggerLabel="Add staff" triggerIcon={Plus} submitIcon={Plus} action="?/staff" data={data.staffForm} schema={staffAssignmentSchema} disabled={!data.canManage}>
					{#snippet fields({ form, errors })}
						<InputComp label="Who" name="userId" type="combo" items={data.people} {form} {errors} required />
						<InputComp label="Role" name="role" placeholder="guide, host" {form} {errors} required />
						<InputComp label="Date" name="date" type="date" futureDays {form} {errors} required />
						<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<InputComp label="From" name="startsAt" type="time" {form} {errors} required />
							<InputComp label="To" name="endsAt" type="time" {form} {errors} required />
						</div>
					{/snippet}
				</FormDialog>
			{/snippet}
			{#if data.staff.length}
				<DataTable variant="compact" columns={staffColumns} data={data.staff} />
			{:else}<Empty message="Nobody assigned yet" />{/if}
		</PageSection>
	</div>
</div>
