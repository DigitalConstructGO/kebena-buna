<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import SingleTable from '@nahu/admin-kit/components/SingleTable.svelte';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import Notice from '@nahu/admin-kit/components/Notice.svelte';
	import Empty from '@nahu/admin-kit/components/Empty.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { dateTime, link, status, user } from '#lib/cells.ts';
	import { choicesOf, formatDate, formatDateTime, humanize, yesNo } from '#lib/format.ts';
	import { badge } from '#lib/status.ts';
	import { stampRows, useLinks } from '#lib/links.ts';
	import { WORKFLOW_STATUSES } from '#lib/constants.ts';
	import { assignSchema, submissionToBookingSchema, workflowSchema } from '#lib/schemas/bookings.ts';

	let { data } = $props();
	const f = $derived(data.submission);
	const href = useLinks();
	/** The rest of the form, whatever fields it had: `partySize` → "Party size". */
	const extra = $derived(
		Object.entries((f.data ?? {}) as Record<string, unknown>).map(([key, value]) => ({
			name: humanize(key.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase()),
			value: Array.isArray(value) ? value.join(', ') : typeof value === 'object' && value ? JSON.stringify(value) : String(value ?? '—')
		}))
	);

	type History = (typeof data.history)[number];
	const historyColumns: ColumnDef<History>[] = [
		{ id: 'at', header: 'When', cell: ({ row }) => dateTime(row.original.createdAt) },
		{ id: 'from', header: 'From', cell: ({ row }) => (row.original.fromStatus ? status(row.original.fromStatus) : '—') },
		{ id: 'to', header: 'To', cell: ({ row }) => status(row.original.toStatus) },
		{ id: 'note', header: 'Note', cell: ({ row }) => row.original.note ?? '—' },
		{ id: 'by', header: 'By', cell: ({ row }) => (row.original.changedById ? user(row.original.changedById, row.original.changedBy) : 'Website') }
	];
	type Booking = (typeof data.bookings)[number];
	const bookingColumns: ColumnDef<Booking>[] = [
		{ id: 'number', header: 'Booking', cell: ({ row }) => link('booking', row.original.id, row.original.number) },
		{ id: 'what', header: 'What', cell: ({ row }) => row.original.bookable },
		{ id: 'status', header: 'Status', cell: ({ row }) => status(row.original.status) }
	];
</script>

<PageHeader title={f.subject ?? humanize(f.formType)} eyebrow={humanize(f.formType)} description={`${f.name ?? 'Anonymous'} · ${formatDateTime(f.submittedAt)}`}>
	{#snippet badges()}
		<Statuses {...badge(f.status)} />
	{/snippet}
	{#snippet actions()}
		{#if data.canManage}
			<FormDialog title="Move this submission" triggerLabel="Change status" action="?/status" data={data.statusForm} schema={workflowSchema}>
				{#snippet fields({ form, errors })}
					<InputComp label="Status" name="status" type="select" items={choicesOf(WORKFLOW_STATUSES)} {form} {errors} required />
					<InputComp label="Note" name="note" type="textarea" rows={2} {form} {errors} />
				{/snippet}
			</FormDialog>
			<FormDialog title="Who handles this" triggerLabel="Assign" action="?/assign" data={data.assignForm} schema={assignSchema}>
				{#snippet fields({ form, errors })}
					<InputComp label="Handled by" name="assignedTo" type="select" items={data.people} {form} {errors} />
				{/snippet}
			</FormDialog>
		{/if}
		{#if data.canBook && data.canCreateBooking && !data.bookings.length}
			<FormDialog title="Make a booking" triggerLabel="Make booking" action="?/book" data={data.bookingForm} schema={submissionToBookingSchema} submitLabel="Make booking" description="With this submission's contact details. You can set the date and staff on the booking.">
				{#snippet fields({ form, errors })}
					<InputComp label="What" name="bookableId" type="select" items={data.bookables} {form} {errors} required />
					<InputComp label="People" name="partySize" type="number" {form} {errors} required />
				{/snippet}
			</FormDialog>
		{/if}
	{/snippet}
</PageHeader>

{#if (f.spamScore ?? 0) >= 50}
	<Notice tone="warning" class="mt-4" title="Probably spam">Its spam score is {f.spamScore}. Decline it if it is.</Notice>
{/if}

<div class="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[26rem_minmax(0,1fr)]">
	<div class="grid min-w-0 grid-cols-1 content-start gap-6">
		<PageSection title="From">
			<SingleTable
				singleTable={[
					{ name: 'Name', value: f.name ?? '—' },
					{ name: 'Customer', value: data.customer ?? '—', href: href('customer', f.customerId) },
					{ name: 'Phone', value: f.phone, kind: 'phone' },
					{ name: 'Email', value: f.email ?? '—' },
					{ name: 'Language', value: f.locale },
					{ name: 'Marketing consent', value: yesNo(f.marketingConsent) },
					{ name: 'Status', value: f.status, kind: 'status', label: humanize(f.status) },
					{ name: 'Handled by', value: data.handler ?? '—', href: href('user', f.assignedTo) },
					{ name: 'First handled', value: formatDateTime(f.firstHandledAt) },
					{ name: 'Spam score', value: f.spamScore ?? '—' },
					{ name: 'IP address', value: f.ipAddress ?? '—' },
					...stampRows(data.stamps, href)
				]}
			/>
		</PageSection>
	</div>
	<div class="grid min-w-0 grid-cols-1 content-start gap-6">
		<PageSection title="Message">
			<SingleTable
				singleTable={[
					{ name: 'Subject', value: f.subject ?? '—' },
					{ name: 'Message', value: f.message ?? '—', long: 200 },
					...(f.rating ? [{ name: 'Rating', value: `${'★'.repeat(f.rating)} (${f.rating}/5)` }] : []),
					...(f.visitDate ? [{ name: 'Visit date', value: formatDate(f.visitDate) }] : []),
					...extra
				]}
			/>
		</PageSection>
		{#if data.canBook}
			<PageSection title="Bookings from this">
				{#if data.bookings.length}
					<DataTable variant="compact" columns={bookingColumns} data={data.bookings} />
				{:else}<Empty message="No booking made from it yet" />{/if}
			</PageSection>
		{/if}
		<PageSection title="History">
			{#if data.history.length}
				<DataTable variant="compact" columns={historyColumns} data={data.history} />
			{:else}<Empty message="No changes yet" />{/if}
		</PageSection>
	</div>
</div>
