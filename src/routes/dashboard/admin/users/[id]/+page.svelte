<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import LogOut from '@lucide/svelte/icons/log-out';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import SingleTable from '@nahu/admin-kit/components/SingleTable.svelte';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import ConfirmAction from '@nahu/admin-kit/components/ConfirmAction.svelte';
	import Empty from '@nahu/admin-kit/components/Empty.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
	import DataTableLinks from '@nahu/admin-kit/components/Table/data-table-links.svelte';
	import { amount, dateTime, kg, link, longText, percent, status } from '#lib/cells.ts';
	import { formatDateTime, humanize, languageName } from '#lib/format.ts';
	import { LANG_CHOICES } from '#lib/languages.ts';
	import { flag } from '#lib/status.ts';
	import { useLinks } from '#lib/links.ts';
	import { editUserSchema, resetPasswordSchema } from '#lib/schemas/admin.ts';
	import PasswordField from '../PasswordField.svelte';
	import Credentials from '../Credentials.svelte';

	let { data, form: answer } = $props();
	const u = $derived(data.person);
	const href = useLinks();

	type Trail = (typeof data.trail)[number];
	const trailColumns: ColumnDef<Trail>[] = [
		{
			id: 'at',
			header: 'When',
			cell: ({ row }) =>
				renderComponent(DataTableLinks, {
					id: row.original.id,
					name: formatDateTime(row.original.createdAt),
					entity: 'auditEntry'
				})
		},
		{ id: 'action', header: 'Action', cell: ({ row }) => humanize(row.original.action) },
		{
			id: 'record',
			header: 'Record',
			cell: ({ row }) =>
				row.original.recordEntity
					? link(row.original.recordEntity, row.original.recordId, `${humanize(row.original.tableName)} #${row.original.recordId}`)
					: `${humanize(row.original.tableName)} #${row.original.recordId}`
		},
		{ id: 'summary', header: 'Changes', cell: ({ row }) => longText(row.original.summary, 50) }
	];

	type Roast = (typeof data.roasts)[number];
	const roastColumns: ColumnDef<Roast>[] = [
		{ id: 'code', header: 'Batch', cell: ({ row }) => link('roastBatch', row.original.id, row.original.code) },
		{ id: 'at', header: 'Roasted', cell: ({ row }) => dateTime(row.original.roastedAt) },
		{ id: 'roast', header: 'Roast', cell: ({ row }) => row.original.roastLevel },
		{ id: 'in', header: 'Green in', meta: { align: 'right' }, cell: ({ row }) => kg(row.original.greenKgIn) },
		{ id: 'out', header: 'Roasted out', meta: { align: 'right' }, cell: ({ row }) => kg(row.original.roastedKgOut) },
		{ id: 'loss', header: 'Loss', meta: { align: 'right' }, cell: ({ row }) => percent(row.original.weightLossPct) }
	];

	type Ride = (typeof data.rides)[number];
	const rideColumns: ColumnDef<Ride>[] = [
		{ id: 'number', header: 'Order', cell: ({ row }) => link('order', row.original.id, row.original.number) },
		{ id: 'customer', header: 'Customer', cell: ({ row }) => link('customer', row.original.customerId, row.original.customer) },
		{ id: 'placed', header: 'Placed', cell: ({ row }) => dateTime(row.original.placedAt) },
		{ id: 'total', header: 'Total (ETB)', meta: { align: 'right' }, cell: ({ row }) => amount(row.original.total) },
		{ id: 'status', header: 'Status', cell: ({ row }) => status(row.original.status) }
	];

	type Assignment = (typeof data.assignments)[number];
	const assignmentColumns: ColumnDef<Assignment>[] = [
		{ id: 'role', header: 'As', cell: ({ row }) => humanize(row.original.role) },
		{ id: 'starts', header: 'From', cell: ({ row }) => dateTime(row.original.startsAt) },
		{ id: 'ends', header: 'To', cell: ({ row }) => dateTime(row.original.endsAt) },
		{
			id: 'for',
			header: 'For',
			cell: ({ row }) => {
				const a = row.original;
				if (a.sessionId) return link('session', a.sessionId, `Session #${a.sessionId}`);
				if (a.bookingId) return link('booking', a.bookingId, `Booking #${a.bookingId}`);
				if (a.eventId) return link('event', a.eventId, `Event #${a.eventId}`);
				return '—';
			}
		}
	];

	type Booking = (typeof data.bookings)[number];
	const bookingColumns: ColumnDef<Booking>[] = [
		{ id: 'number', header: 'Booking', cell: ({ row }) => link('booking', row.original.id, row.original.number) },
		{ id: 'what', header: 'What', cell: ({ row }) => row.original.bookable },
		{ id: 'who', header: 'Contact', cell: ({ row }) => row.original.contactName },
		{ id: 'party', header: 'Party', meta: { align: 'right' }, cell: ({ row }) => row.original.partySize },
		{ id: 'status', header: 'Status', cell: ({ row }) => status(row.original.status) }
	];

	type Submission = (typeof data.submissions)[number];
	const submissionColumns: ColumnDef<Submission>[] = [
		{
			id: 'subject',
			header: 'Submission',
			cell: ({ row }) =>
				link('submission', row.original.id, row.original.subject ?? humanize(row.original.formType))
		},
		{ id: 'from', header: 'From', cell: ({ row }) => row.original.name ?? '—' },
		{ id: 'at', header: 'Received', cell: ({ row }) => dateTime(row.original.submittedAt) },
		{ id: 'status', header: 'Status', cell: ({ row }) => status(row.original.status) }
	];

	type Session = (typeof data.sessions)[number];
	const sessionColumns: ColumnDef<Session>[] = [
		{ id: 'started', header: 'Signed in', cell: ({ row }) => dateTime(row.original.createdAt) },
		{ id: 'seen', header: 'Last active', cell: ({ row }) => dateTime(row.original.updatedAt) },
		{ id: 'ip', header: 'IP', cell: ({ row }) => row.original.ipAddress ?? '—' },
		{ id: 'agent', header: 'Device', cell: ({ row }) => longText(row.original.userAgent, 30) },
		{
			id: 'revoke',
			header: '',
			cell: ({ row }) =>
				renderComponent(ConfirmAction, {
					action: '?/revoke',
					label: 'Sign out',
					variant: 'ghost',
					title: 'Sign this session out?',
					fields: { sessionId: row.original.id }
				})
		}
	];
</script>

<PageHeader title={u.name} eyebrow={u.kind === 'staff' ? 'Staff member' : 'Customer sign-in'} description={u.email}>
	{#snippet badges()}
		<Statuses {...flag(u.isActive, 'Active', 'Switched off')} />
		{#if data.role}<Statuses status="info" label={data.role} />{/if}
	{/snippet}
	{#snippet actions()}
		<FormDialog title="Edit {u.name}" action="?/edit" data={data.editForm} schema={editUserSchema}>
			{#snippet fields({ form, errors })}
				<InputComp label="Full name" name="name" {form} {errors} required />
				<InputComp label="Phone" name="phone" type="tel" {form} {errors} />
				{#if u.kind === 'staff'}
					<InputComp label="Role" name="roleId" type="select" items={data.roles} {form} {errors} required />
				{/if}
				<InputComp
					label="Language"
					name="locale"
					type="select"
					items={LANG_CHOICES}
					{form}
					{errors}
				/>
				<InputComp
					label="Active"
					name="isActive"
					type="checkboxSingle"
					placeholder="May sign in"
					description="Switching off signs them out everywhere; their history stays."
					{form}
					{errors}
				/>
			{/snippet}
		</FormDialog>
		<FormDialog
			title="Set a new password"
			description="They are signed out everywhere and use this from their next sign-in."
			action="?/password"
			data={data.passwordForm}
			schema={resetPasswordSchema}
			triggerLabel="Reset password"
			resetOnSuccess
		>
			{#snippet fields({ form, errors })}
				<PasswordField form={form as never} errors={errors as never} />
			{/snippet}
		</FormDialog>
		{#if data.sessions.length}
			<ConfirmAction
				action="?/revoke"
				label="Sign out everywhere"
				icon={LogOut}
				variant="outline"
				title="Sign {u.name} out of every device?"
			/>
		{/if}
	{/snippet}
</PageHeader>

<Credentials credentials={answer && 'credentials' in answer ? answer.credentials : undefined} />

<div class="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
	<div class="grid min-w-0 grid-cols-1 content-start gap-6">
		<PageSection title="Account">
			<SingleTable
				singleTable={[
					{ name: 'Email', value: u.email },
					{ name: 'Phone', value: u.phoneNumber ?? '—', kind: 'phone' },
					{ name: 'Kind', value: humanize(u.kind) },
					{ name: 'Role', value: data.role ?? '—', href: href('role', u.roleId) },
					{ name: 'Language', value: languageName(u.locale) },
					{ name: 'Two-factor', value: u.twoFactorEnabled ? 'On' : 'Off' },
					{ name: 'Email verified', value: u.emailVerified ? 'Yes' : 'No' },
					{ name: 'Telegram', value: u.telegramId ?? '—' },
					{
						name: 'Customer record',
						value: data.customer ? (data.customer.name ?? data.customer.phone ?? `#${data.customer.id}`) : '—',
						href: href('customer', data.customer?.id)
					},
					{ name: 'Joined', value: formatDateTime(u.createdAt) },
					{ name: 'Last changed', value: formatDateTime(u.updatedAt) }
				]}
			/>
		</PageSection>
		<PageSection title="Sessions" hint="Devices signed in now.">
			{#if data.sessions.length}
				<DataTable variant="compact" columns={sessionColumns} data={data.sessions} />
			{:else}<Empty message="Not signed in anywhere" />{/if}
		</PageSection>
	</div>
	<div class="grid min-w-0 grid-cols-1 content-start gap-6">
		<PageSection title="Recent changes" hint="The audit trail of what they changed.">
			{#if data.trail.length}
				<DataTable variant="compact" columns={trailColumns} data={data.trail} />
			{:else}<Empty message="No audited changes by them" />{/if}
		</PageSection>
		{#if data.roasts.length}
			<PageSection title="Roast batches roasted">
				<DataTable variant="compact" columns={roastColumns} data={data.roasts} />
			</PageSection>
		{/if}
		{#if data.rides.length}
			<PageSection title="Orders delivered">
				<DataTable variant="compact" columns={rideColumns} data={data.rides} />
			</PageSection>
		{/if}
		{#if data.assignments.length}
			<PageSection title="Staff assignments">
				<DataTable variant="compact" columns={assignmentColumns} data={data.assignments} />
			</PageSection>
		{/if}
		{#if data.bookings.length}
			<PageSection title="Bookings assigned">
				<DataTable variant="compact" columns={bookingColumns} data={data.bookings} />
			</PageSection>
		{/if}
		{#if data.submissions.length}
			<PageSection title="Inbox items assigned">
				<DataTable variant="compact" columns={submissionColumns} data={data.submissions} />
			</PageSection>
		{/if}
	</div>
</div>
