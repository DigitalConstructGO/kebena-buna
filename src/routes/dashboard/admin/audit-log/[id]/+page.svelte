<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import SingleTable from '@nahu/admin-kit/components/SingleTable.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import Empty from '@nahu/admin-kit/components/Empty.svelte';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { longText } from '#lib/cells.ts';
	import { formatDateTime, humanize } from '#lib/format.ts';
	import { useLinks } from '#lib/links.ts';
	import { ACTION_TONE } from '../tones';

	let { data } = $props();
	const e = $derived(data.entry);
	const href = useLinks();
	const recordHref = $derived(data.recordEntity ? href(data.recordEntity, e.recordId) : undefined);

	type Change = (typeof data.changes)[number];
	const columns: ColumnDef<Change>[] = [
		{ id: 'field', header: 'Field', cell: ({ row }) => humanize(row.original.field) },
		{ id: 'before', header: 'Before', cell: ({ row }) => longText(row.original.before, 60) },
		{ id: 'after', header: 'After', cell: ({ row }) => longText(row.original.after, 60) }
	];
</script>

<PageHeader title="{humanize(e.action)} · {humanize(e.tableName)}" eyebrow="Audit entry #{e.id}" description="Record #{e.recordId}">
	{#snippet badges()}
		<Statuses status={ACTION_TONE[e.action] ?? 'neutral'} label={humanize(e.action)} />
	{/snippet}
	{#snippet actions()}
		{#if recordHref}
			<Button href={recordHref} variant="outline" size="sm">Open the record</Button>
		{/if}
	{/snippet}
</PageHeader>

<div class="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
	<PageSection title="Entry">
		<SingleTable
			singleTable={[
				{ name: 'When', value: formatDateTime(e.createdAt) },
				{ name: 'Who', value: data.userName ?? (e.userId ? e.userId : 'System'), href: href('user', e.userId) },
				{ name: 'Record', value: `${humanize(e.tableName)} #${e.recordId}`, href: recordHref },
				{ name: 'From (IP)', value: e.ipAddress ?? '—' }
			]}
		/>
	</PageSection>
	<PageSection title="What changed" hint="Only the fields that moved; passwords are never recorded.">
		{#if data.changes.length}
			<DataTable variant="compact" {columns} data={data.changes} />
		{:else}
			<Empty message="No field changes were recorded with this entry" />
		{/if}
	</PageSection>
</div>
