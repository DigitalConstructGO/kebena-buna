<script lang="ts">
	import Ban from '@lucide/svelte/icons/ban';
	import Plus from '@lucide/svelte/icons/plus';
	import type { ColumnDef } from '@tanstack/table-core';
	import UserMinus from '@lucide/svelte/icons/user-minus';
	import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import SingleTable from '@nahu/admin-kit/components/SingleTable.svelte';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import ConfirmAction from '@nahu/admin-kit/components/ConfirmAction.svelte';
	import Empty from '@nahu/admin-kit/components/Empty.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { dateTime, status, user } from '#lib/cells.ts';
	import { choicesOf, formatDate, formatDateTime, humanize, money } from '#lib/format.ts';
	import { LANG_CHOICES } from '#lib/languages.ts';
	import { badge } from '#lib/status.ts';
	import { stampRows, useLinks } from '#lib/links.ts';
	import { WORKFLOW_STATUSES } from '#lib/constants.ts';
	import {
		assignSchema,
		bookingDetailsSchema,
		cancelBookingSchema,
		quoteSchema,
		scheduleSchema,
		staffAssignmentSchema,
		workflowSchema
	} from '#lib/schemas/bookings.ts';

	let { data } = $props();
	const b = $derived(data.booking);
	const info = $derived(data.info);
	const href = useLinks();
	const isOpen = $derived(
		b.status !== 'cancelled' && b.status !== 'declined' && b.status !== 'done'
	);

	type History = (typeof data.history)[number];
	const historyColumns: ColumnDef<History>[] = [
		{ id: 'at', header: 'When', cell: ({ row }) => dateTime(row.original.createdAt) },
		{
			id: 'from',
			header: 'From',
			cell: ({ row }) => (row.original.fromStatus ? status(row.original.fromStatus) : '—')
		},
		{ id: 'to', header: 'To', cell: ({ row }) => status(row.original.toStatus) },
		{ id: 'note', header: 'Note', cell: ({ row }) => row.original.note ?? '—' },
		{
			id: 'by',
			header: 'By',
			cell: ({ row }) =>
				row.original.changedById
					? user(row.original.changedById, row.original.changedBy)
					: 'Website'
		}
	];
	type Staff = (typeof data.staff)[number];
	const staffColumns: ColumnDef<Staff>[] = [
		{ id: 'user', header: 'Who', cell: ({ row }) => user(row.original.userId, row.original.user) },
		{ id: 'role', header: 'Role', cell: ({ row }) => humanize(row.original.role) },
		{ id: 'from', header: 'From', cell: ({ row }) => dateTime(row.original.startsAt) },
		{ id: 'to', header: 'To', cell: ({ row }) => dateTime(row.original.endsAt) },
		{
			id: 'by',
			header: 'Assigned by',
			cell: ({ row }) => user(row.original.assignedById, row.original.assignedBy)
		},
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
							title: `Take ${row.original.user} off this booking?`,
							fields: { assignmentId: row.original.id }
						})
					: ''
		}
	];
</script>

<PageHeader
	title={b.number}
	eyebrow="Booking"
	description={`${info.bookable} · ${b.organisationName ?? b.contactName} · ${b.partySize} people`}
>
	{#snippet badges()}
		<Statuses {...badge(b.status)} />
	{/snippet}
	{#snippet actions()}
		{#if data.canManage}
			<FormDialog
				title="Move {b.number}"
				triggerLabel="Change status"
				action="?/status"
				data={data.statusForm}
				schema={workflowSchema}
			>
				{#snippet fields({ form, errors })}
					<InputComp
						label="Status"
						name="status"
						type="select"
						items={choicesOf(WORKFLOW_STATUSES)}
						{form}
						{errors}
						required
					/>
					<InputComp label="Note" name="note" type="textarea" rows={2} {form} {errors} />
				{/snippet}
			</FormDialog>
			<FormDialog
				title="Who handles {b.number}"
				triggerLabel="Assign"
				action="?/assign"
				data={data.assignForm}
				schema={assignSchema}
			>
				{#snippet fields({ form, errors })}
					<InputComp
						label="Handled by"
						name="assignedTo"
						type="select"
						items={data.people}
						{form}
						{errors}
					/>
				{/snippet}
			</FormDialog>
			{#if isOpen}
				<FormDialog
					title="Cancel {b.number}"
					triggerLabel="Cancel"
					triggerIcon={Ban}
					submitIcon={Ban}
					submitVariant="destructive"
					action="?/cancel"
					data={data.cancelForm}
					schema={cancelBookingSchema}
					submitLabel="Cancel booking"
				>
					{#snippet fields({ form, errors })}
						<InputComp
							label="Reason"
							name="reason"
							type="textarea"
							rows={3}
							{form}
							{errors}
							required
						/>
					{/snippet}
				</FormDialog>
			{/if}
		{/if}
	{/snippet}
</PageHeader>

<div class="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[26rem_minmax(0,1fr)]">
	<div class="grid min-w-0 grid-cols-1 content-start gap-6">
		<PageSection title="Booking">
			{#snippet actions()}
				<FormDialog
					title="Edit {b.number}"
					triggerLabel="Edit"
					action="?/details"
					data={data.detailsForm}
					schema={bookingDetailsSchema}
					disabled={!data.canManage}
				>
					{#snippet fields({ form, errors })}
						<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<InputComp label="Contact" name="contactName" {form} {errors} required />
							<InputComp label="Phone" name="contactPhone" type="tel" {form} {errors} required />
							<InputComp label="Email" name="contactEmail" type="email" {form} {errors} />
							<InputComp label="Organisation" name="organisationName" {form} {errors} />
							<InputComp label="TIN" name="tin" {form} {errors} />
							<InputComp label="People" name="partySize" type="number" {form} {errors} required />
							<InputComp
								label="Audience"
								name="audienceId"
								type="select"
								items={data.audiences}
								{form}
								{errors}
							/>
							<InputComp
								label="Language"
								name="language"
								type="select"
								items={LANG_CHOICES}
								{form}
								{errors}
							/>
							<InputComp label="Age range" name="ageRange" {form} {errors} />
							<InputComp label="Kind of event" name="eventType" {form} {errors} />
						</div>
						<InputComp
							label="Special requests"
							name="specialRequests"
							type="textarea"
							rows={3}
							{form}
							{errors}
						/>
						<InputComp
							label="Accessibility needs"
							name="accessibilityNeeds"
							type="textarea"
							rows={2}
							{form}
							{errors}
						/>
					{/snippet}
				</FormDialog>
			{/snippet}
			<SingleTable
				singleTable={[
					{ name: 'What', value: info.bookable, href: href('bookable', b.bookableId) },
					{
						name: 'Session',
						value: info.sessionStartsAt ? formatDateTime(info.sessionStartsAt) : '—',
						href: href('session', b.sessionId)
					},
					{
						name: 'Visit slot',
						value: info.slotStartsAt ? formatDateTime(info.slotStartsAt) : '—',
						href: href('visitDay', info.slotDayId)
					},
					{ name: 'Event', value: info.eventTitle ?? '—', href: href('event', b.eventId) },
					{ name: 'Status', value: b.status, kind: 'status', label: humanize(b.status) },
					{ name: 'Handled by', value: data.handler ?? '—', href: href('user', b.assignedTo) },
					{ name: 'Customer', value: info.customer ?? '—', href: href('customer', b.customerId) },
					{ name: 'Contact', value: b.contactName },
					{ name: 'Phone', value: b.contactPhone, kind: 'phone' },
					{ name: 'Email', value: b.contactEmail ?? '—' },
					{ name: 'Organisation', value: b.organisationName ?? '—' },
					{ name: 'TIN', value: b.tin ?? '—' },
					{ name: 'People', value: b.partySize },
					{ name: 'Audience', value: info.audience ?? '—' },
					{ name: 'Language', value: b.language ?? '—' },
					{ name: 'Age range', value: b.ageRange ?? '—' },
					{ name: 'Kind of event', value: b.eventType ?? '—' },
					{
						name: 'Dates asked for',
						value: (b.preferredDates ?? []).map((d) => formatDate(d)).join(', ') || '—'
					},
					{ name: 'Special requests', value: b.specialRequests ?? '—', long: 40 },
					{ name: 'Accessibility', value: b.accessibilityNeeds ?? '—', long: 40 },
					{
						name: 'From the inbox',
						value: info.submission ?? '—',
						href: href('submission', b.submissionId)
					},
					...(b.cancelledAt
						? [
								{ name: 'Cancelled', value: formatDateTime(b.cancelledAt) },
								{ name: 'Reason', value: b.cancelReason ?? '—', long: 40 }
							]
						: []),
					...stampRows(data.stamps, href)
				]}
			/>
		</PageSection>
	</div>
	<div class="grid min-w-0 grid-cols-1 content-start gap-6">
		<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
			<PageSection title="Date and hold" hint="Places held on the slot or session while unpaid.">
				{#snippet actions()}
					<FormDialog
						title="Date and hold"
						triggerLabel="Set"
						action="?/schedule"
						data={data.scheduleForm}
						schema={scheduleSchema}
						disabled={!data.canManage}
					>
						{#snippet fields({ form, errors })}
							<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
								<InputComp
									label="Confirmed date"
									name="confirmedDate"
									type="date"
									futureDays
									{form}
									{errors}
								/>
								<InputComp label="Time" name="confirmedTime" type="time" {form} {errors} />
								<InputComp label="Places held" name="heldPlaces" type="number" {form} {errors} />
								<InputComp
									label="Hold released on"
									name="holdExpiresDate"
									type="date"
									futureDays
									{form}
									{errors}
								/>
							</div>
						{/snippet}
					</FormDialog>
				{/snippet}
				<SingleTable
					singleTable={[
						{
							name: 'Confirmed for',
							value: b.confirmedStartsAt ? formatDateTime(b.confirmedStartsAt) : '—'
						},
						{ name: 'Confirmed on', value: b.confirmedAt ? formatDateTime(b.confirmedAt) : '—' },
						{ name: 'Places held', value: b.heldPlaces },
						{
							name: 'Hold released',
							value: b.holdExpiresAt ? formatDateTime(b.holdExpiresAt) : '—'
						}
					]}
				/>
			</PageSection>
			<PageSection title="Money">
				{#snippet actions()}
					<FormDialog
						title="Quote and deposit"
						triggerLabel="Quote"
						action="?/quote"
						data={data.quoteForm}
						schema={quoteSchema}
						disabled={!data.canManage}
					>
						{#snippet fields({ form, errors })}
							<InputComp
								label="Quoted (ETB)"
								name="quotedAmount"
								type="number"
								step="0.01"
								{form}
								{errors}
							/>
							<InputComp
								label="Deposit (ETB)"
								name="depositAmount"
								type="number"
								step="0.01"
								{form}
								{errors}
							/>
						{/snippet}
					</FormDialog>
				{/snippet}
				<SingleTable
					singleTable={[
						{ name: 'Quoted', value: money(b.quotedAmount) },
						{ name: 'Deposit', value: money(b.depositAmount) },
						{ name: 'Order', value: info.orderNumber ?? '—', href: href('order', b.orderId) },
						{
							name: 'Invoice',
							value: info.invoiceNumber ?? '—',
							href: href('invoice', b.invoiceId)
						},
						{
							name: 'Group ticket',
							value: info.ticketCode ?? '—',
							href: href('ticket', b.groupTicketId)
						}
					]}
				/>
			</PageSection>
		</div>
		<PageSection
			title="Staff"
			hint="Who runs it. A clash with their other work is warned when they are assigned."
		>
			{#snippet actions()}
				<FormDialog
					title="Put someone on {b.number}"
					triggerLabel="Add staff"
					triggerIcon={Plus}
					submitIcon={Plus}
					action="?/staff"
					data={data.staffForm}
					schema={staffAssignmentSchema}
					disabled={!data.canManage}
					resetOnSuccess
				>
					{#snippet fields({ form, errors })}
						<InputComp
							label="Who"
							name="userId"
							type="combo"
							items={data.people}
							{form}
							{errors}
							required
						/>
						<InputComp
							label="Role"
							name="role"
							placeholder="guide, host, barista"
							{form}
							{errors}
							required
						/>
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
		<PageSection title="History">
			{#if data.history.length}
				<DataTable variant="compact" columns={historyColumns} data={data.history} />
			{:else}<Empty message="No changes yet" />{/if}
		</PageSection>
	</div>
</div>
