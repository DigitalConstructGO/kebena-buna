<script lang="ts">
	import Ban from '@lucide/svelte/icons/ban';
	import type { ColumnDef } from '@tanstack/table-core';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import SingleTable from '@nahu/admin-kit/components/SingleTable.svelte';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import ConfirmAction from '@nahu/admin-kit/components/ConfirmAction.svelte';
	import Empty from '@nahu/admin-kit/components/Empty.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { localClock } from '@nahu/admin-kit/time';
	import { amount, dateTime, link, status, user } from '#lib/cells.ts';
	import { formatDate, formatDateTime, humanize, languageName } from '#lib/format.ts';
	import { badge } from '#lib/status.ts';
	import { useLinks } from '#lib/links.ts';
	import { reasonSchema, rescheduleSchema } from '#lib/schemas/visits.ts';

	let { data } = $props();
	const t = $derived(data.ticket);
	const href = useLinks();
	const when = $derived(
		data.slotStart ? `${formatDate(t.visitDate)} · ${localClock(data.slotStart)}–${localClock(data.slotEnd!)}` : formatDate(t.visitDate)
	);

	type Change = (typeof data.changes)[number];
	const slotText = (v: Date | string | null) => (v ? formatDateTime(v) : null);
	const changeColumns: ColumnDef<Change>[] = [
		{ id: 'at', header: 'When', cell: ({ row }) => dateTime(row.original.createdAt) },
		{ id: 'kind', header: 'Change', cell: ({ row }) => humanize(row.original.kind) },
		{
			id: 'what',
			header: 'From → to',
			cell: ({ row }) => {
				const c = row.original;
				const parts = [
					c.fromSlot || c.toSlot ? `${slotText(c.fromSlot) ?? '—'} → ${slotText(c.toSlot) ?? '—'}` : null,
					c.fromType || c.toType ? `${c.fromType ?? '—'} → ${c.toType ?? '—'}` : null,
					c.fromAudience !== c.toAudience && (c.fromAudience || c.toAudience) ? `${c.fromAudience ?? '—'} → ${c.toAudience ?? '—'}` : null
				].filter(Boolean);
				return parts.join('; ') || '—';
			}
		},
		{ id: 'amount', header: 'Amount (ETB)', meta: { align: 'right' }, cell: ({ row }) => amount(row.original.amount) },
		{ id: 'reason', header: 'Reason', cell: ({ row }) => row.original.reason ?? '—' },
		{ id: 'by', header: 'By', cell: ({ row }) => user(row.original.byId, row.original.by) }
	];
	type Scan = (typeof data.scans)[number];
	const scanColumns: ColumnDef<Scan>[] = [
		{ id: 'at', header: 'Scanned', cell: ({ row }) => dateTime(row.original.scannedAt) },
		{ id: 'result', header: 'Result', cell: ({ row }) => status(row.original.result) },
		{ id: 'headcount', header: 'People', meta: { align: 'right' }, cell: ({ row }) => row.original.headcount },
		{ id: 'device', header: 'Device', cell: ({ row }) => row.original.device ?? 'Desk' },
		{ id: 'location', header: 'Location', cell: ({ row }) => link('location', row.original.locationId, row.original.location) },
		{ id: 'by', header: 'By', cell: ({ row }) => user(row.original.byId, row.original.by) },
		{ id: 'offline', header: 'Offline', cell: ({ row }) => (row.original.wasOffline ? `Yes, synced ${formatDateTime(row.original.syncedAt)}` : 'No') }
	];
</script>

<PageHeader title={t.code} eyebrow={t.eventId ? 'Event ticket' : 'Entry ticket'} description="{data.type} · {data.audience} · {when}">
	{#snippet badges()}
		<Statuses {...badge(t.status)} />
	{/snippet}
	{#snippet actions()}
		{#if t.status === 'valid'}
			{#if t.visitDate === data.today}
				<ConfirmAction
					action="?/checkIn"
					label="Check in"
					icon={CircleCheck}
					title="Check in {t.code}?"
					description="Admits the whole party ({t.admits - t.checkedIn} {t.admits - t.checkedIn === 1 ? 'person' : 'people'}) now, recorded as a desk scan."
				/>
			{/if}
			{#if t.visitSlotId}
				<FormDialog
					title="Move {t.code} to another slot"
					triggerLabel="Reschedule"
					submitLabel="Move ticket"
					action="?/reschedule"
					data={data.rescheduleForm}
					schema={rescheduleSchema}
					disabled={!data.canManage}
				>
					{#snippet fields({ form, errors })}
						<InputComp
							label="New slot"
							name="toSlotId"
							type="combo"
							items={data.slots}
							description="Open slots still to come at the same location, with room for the party of {t.admits}."
							{form}
							{errors}
							required
						/>
						<InputComp label="Reason" name="reason" {form} {errors} />
					{/snippet}
				</FormDialog>
			{/if}
			<FormDialog
				title="Cancel {t.code}?"
				triggerLabel="Cancel ticket" triggerIcon={Ban} submitIcon={Ban} submitVariant="destructive"
				submitLabel="Cancel ticket"
				action="?/cancel"
				data={data.cancelForm}
				schema={reasonSchema}
				description="Its places go back to the slot or the event. A refund, if one is owed, is made from the order."
				disabled={!data.canManage}
			>
				{#snippet fields({ form, errors })}
					<InputComp label="Reason" name="reason" {form} {errors} />
				{/snippet}
			</FormDialog>
		{/if}
	{/snippet}
</PageHeader>

<div class="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
	<PageSection title="Ticket">
		<SingleTable
			singleTable={[
				{ name: 'Status', value: t.status, kind: 'status', label: humanize(t.status) },
				{ name: 'Type', value: data.type, href: href('ticketType', t.ticketTypeId) },
				{ name: 'Audience', value: data.audience },
				{ name: 'Visit', value: when, href: href('visitDay', data.dayId) },
				{ name: 'Event', value: data.event ?? '—', href: href('event', t.eventId) },
				{ name: 'Holder', value: t.holderName ?? '—' },
				{ name: 'Customer', value: data.customer ?? '—', href: href('customer', t.customerId) },
				{ name: 'Phone', value: data.customerPhone ?? '—', kind: data.customerPhone ? 'phone' : undefined },
				{ name: 'Order', value: data.orderNumber ?? '—', href: href('order', t.orderId) },
				{ name: 'Order line', value: data.lineDescription ?? '—' },
				{ name: 'Membership', value: data.membershipNumber ?? '—', href: href('membership', t.membershipId) },
				{ name: 'Checked in', value: `${t.checkedIn} of ${t.admits}` },
				{ name: 'First check-in', value: formatDateTime(t.firstCheckedInAt) },
				{ name: 'Language', value: languageName(t.locale) },
				{ name: 'Issued', value: formatDateTime(t.issuedAt) },
				{ name: 'Cancelled', value: formatDateTime(t.cancelledAt) }
			]}
		/>
	</PageSection>
	<div class="grid min-w-0 grid-cols-1 content-start gap-6">
		{#if data.qr}
			<PageSection title="QR code" hint="Signed: the gate scanner checks it offline. Print or show it to reissue the ticket.">
				<div class="flex flex-wrap items-center gap-6">
					<!-- Our own SVG, made by `qrcode` from the signed string. -->
					<!-- eslint-disable-next-line svelte/no-at-html-tags -->
					<div class="size-48 shrink-0 rounded-lg border bg-white p-2 [&_svg]:size-full">{@html data.qr.svg}</div>
					<p class="max-w-md font-mono text-xs break-all text-muted-foreground">{data.qr.value}</p>
				</div>
			</PageSection>
		{/if}
		<PageSection title="Changes" hint="Reschedules, upgrades, cancellations and refunds, with the money moved.">
			{#if data.changes.length}
				<DataTable variant="compact" columns={changeColumns} data={data.changes} />
			{:else}<Empty message="Never changed" />{/if}
		</PageSection>
		<PageSection title="Scans">
			{#if data.scans.length}
				<DataTable variant="compact" columns={scanColumns} data={data.scans} />
			{:else}<Empty message="Not scanned yet" />{/if}
		</PageSection>
	</div>
</div>
