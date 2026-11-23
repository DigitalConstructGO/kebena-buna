<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import type { ColumnDef } from '@tanstack/table-core';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import SingleTable from '@nahu/admin-kit/components/SingleTable.svelte';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import ConfirmAction from '@nahu/admin-kit/components/ConfirmAction.svelte';
	import RowButton from '@nahu/admin-kit/components/RowButton.svelte';
	import Empty from '@nahu/admin-kit/components/Empty.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import LookupSection from '@nahu/admin-kit/components/lookup/LookupSection.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { fileUrl } from '@nahu/admin-kit/files';
	import { dateTime, link, status } from '#lib/cells.ts';
	import { WEEKDAYS, WEEKDAY_CHOICES, clock, humanize, tr, yesNo } from '#lib/format.ts';
	import { badge, flag } from '#lib/status.ts';
	import { stampRows, useLinks } from '#lib/links.ts';
	import {
		bookableEditSchema,
		bookablePriceEditSchema,
		bookablePriceSchema,
		bookableScheduleSchema,
		generateSessionsSchema,
		imageSchema
	} from '#lib/schemas/bookings.ts';
	import BookableFields from '../BookableFields.svelte';

	let { data } = $props();
	const b = $derived(data.bookable);
	const href = useLinks();

	type Schedule = (typeof data.schedules)[number];
	let editing = $state(false);
	let seed = $state<
		Partial<{
			id: number;
			weekday: number;
			startsAt: string;
			capacity: number;
			language: string | null;
		}>
	>({});
	const openSchedule = (s: Schedule | null) => {
		seed = s
			? {
					id: s.id,
					weekday: s.weekday,
					startsAt: s.startsAt.slice(0, 5),
					capacity: s.capacity,
					language: s.language
				}
			: { id: undefined, weekday: 2, startsAt: '10:00', capacity: 12, language: null };
		editing = true;
	};

	const scheduleColumns: ColumnDef<Schedule>[] = [
		{
			id: 'weekday',
			header: 'Day',
			cell: ({ row }) =>
				data.canManage
					? renderComponent(RowButton, {
							label: WEEKDAYS[row.original.weekday],
							onclick: () => openSchedule(row.original)
						})
					: WEEKDAYS[row.original.weekday]
		},
		{ id: 'startsAt', header: 'Starts', cell: ({ row }) => clock(row.original.startsAt) },
		{
			id: 'capacity',
			header: 'Places',
			meta: { align: 'right' },
			cell: ({ row }) => row.original.capacity
		},
		{ id: 'language', header: 'Language', cell: ({ row }) => row.original.language ?? 'Any' },
		{
			id: 'remove',
			header: '',
			cell: ({ row }) =>
				data.canManage
					? renderComponent(ConfirmAction, {
							action: '?/unschedule',
							label: 'Remove',
							icon: Trash2,
							variant: 'ghost',
							title: `Stop ${WEEKDAYS[row.original.weekday]} ${clock(row.original.startsAt)}?`,
							description: 'Sessions already made from it are kept.',
							fields: { scheduleId: row.original.id }
						})
					: ''
		}
	];

	type Session = (typeof data.sessions)[number];
	const sessionColumns: ColumnDef<Session>[] = [
		{
			id: 'startsAt',
			header: 'When',
			cell: ({ row }) => link('session', row.original.id, dateTime(row.original.startsAt))
		},
		{ id: 'language', header: 'Language', cell: ({ row }) => row.original.language ?? '—' },
		{
			id: 'booked',
			header: 'Booked',
			meta: { align: 'right' },
			cell: ({ row }) => `${row.original.booked} / ${row.original.capacity}`
		},
		{
			id: 'state',
			header: 'Status',
			cell: ({ row }) =>
				status(
					row.original.isCancelled ? 'cancelled' : 'scheduled',
					row.original.isCancelled ? 'Cancelled' : 'Running'
				)
		}
	];
</script>

<PageHeader
	title={tr(b.name)}
	eyebrow="Bookable"
	description={`${humanize(b.kind)} · ${b.durationMin} minutes · ${humanize(b.pricing)}`}
>
	{#snippet badges()}
		<Statuses {...badge(b.publishStatus)} />
		<Statuses {...flag(b.isActive)} />
	{/snippet}
	{#snippet actions()}
		{#if data.canManage}
			<FormDialog
				title="Edit {tr(b.name)}"
				triggerLabel="Edit"
				action="?/edit"
				data={data.form}
				schema={bookableEditSchema}
				dataType="json"
			>
				{#snippet fields({ form, errors })}
					<BookableFields form={form as never} errors={errors as never} options={data.options} />
				{/snippet}
			</FormDialog>
			<FormDialog
				title="Image"
				triggerLabel="Image"
				action="?/image"
				data={data.imageForm}
				schema={imageSchema}
				multipart
			>
				{#snippet fields({ form, errors })}
					<InputComp
						label="Image"
						name="image"
						type="file"
						accept="image/*"
						image={b.image ? fileUrl(b.image) : ''}
						{form}
						{errors}
					/>
				{/snippet}
			</FormDialog>
			<ConfirmAction
				action="?/delete"
				label="Delete"
				icon={Trash2}
				variant="destructive"
				title="Delete {tr(b.name)}?"
				description="Only one never booked can be deleted; otherwise switch it off."
			/>
		{/if}
	{/snippet}
</PageHeader>

<div class="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
	<PageSection title="Details">
		{#if b.image}<img
				src={fileUrl(b.image)}
				alt=""
				class="mb-4 max-h-40 rounded-lg object-cover"
			/>{/if}
		<SingleTable
			singleTable={[
				{ name: 'Name (Amharic)', value: b.name?.am ?? '—' },
				{ name: 'Slug', value: b.slug },
				{ name: 'Where', value: data.location ?? '—', href: href('location', b.locationId) },
				{ name: 'Party', value: `${b.minParty}–${b.maxParty ?? 'any'}` },
				{ name: 'Run in', value: (b.languages ?? []).join(', ') || '—' },
				{ name: 'Paid at booking', value: yesNo(b.requiresPrepayment) },
				{ name: 'Uses visit capacity', value: yesNo(b.usesVisitCapacity) },
				{ name: 'Needs staff', value: yesNo(b.requiresStaff) },
				{ name: 'By enquiry only', value: yesNo(b.isEnquiryOnly) },
				{ name: 'Hold days', value: b.holdDays ?? 'Setting' },
				{ name: 'Tax', value: data.tax ?? '—' },
				{ name: 'Description', value: tr(b.description) || '—', long: 40 },
				...stampRows(data.stamps, href)
			]}
		/>
	</PageSection>
	<div class="grid min-w-0 grid-cols-1 content-start gap-6">
		<PageSection title="Prices" hint="One per audience. No row: not sold to that audience.">
			<LookupSection
				config={{
					entity: 'Price',
					plural: 'Prices',
					fields: [
						{
							name: 'audienceId',
							label: 'Audience',
							type: 'reference',
							display: 'audience',
							picker: 'select'
						},
						{ name: 'price', label: 'Price', type: 'money' },
						{ name: 'status', label: 'Status', type: 'boolean' }
					]
				}}
				rows={data.prices.rows as never}
				addForm={data.prices.addForm}
				editForm={data.prices.editForm}
				options={{ audienceId: data.audiences }}
				canDelete={data.canManage}
				readonly={!data.canManage}
				schemas={{ add: bookablePriceSchema, edit: bookablePriceEditSchema }}
				actions={{ add: '?/addPrice', edit: '?/editPrice', delete: '?/deletePrice' }}
			/>
		</PageSection>
		{#if !b.isEnquiryOnly}
			<PageSection
				title="Weekly times"
				hint="Sessions are made from these. Click a day to change it."
			>
				{#snippet actions()}
					{#if data.canManage}
						<FormDialog
							title="Make sessions"
							triggerLabel="Make sessions"
							action="?/generate"
							data={data.generateForm}
							schema={generateSessionsSchema}
							submitLabel="Make"
						>
							{#snippet fields({ form, errors })}
								<InputComp
									label="For the next (days)"
									name="days"
									type="number"
									description="Closed days and times that already have a session are skipped."
									{form}
									{errors}
									required
								/>
							{/snippet}
						</FormDialog>
						<FormDialog
							title={seed.id ? 'Change weekly time' : 'Add weekly time'}
							triggerLabel="Add time"
							triggerIcon={Plus}
							submitIcon={Plus}
							action="?/schedule"
							data={data.scheduleForm}
							schema={bookableScheduleSchema}
							bind:open={editing}
							{seed}
						>
							{#snippet fields({ form, errors })}
								<InputComp type="hidden" name="id" {form} {errors} />
								<InputComp
									label="Day"
									name="weekday"
									type="select"
									items={WEEKDAY_CHOICES}
									{form}
									{errors}
									required
								/>
								<InputComp label="Starts" name="startsAt" type="time" {form} {errors} required />
								<InputComp label="Places" name="capacity" type="number" {form} {errors} required />
								<InputComp
									label="Language"
									name="language"
									type="select"
									items={[
										{ value: 'am', name: 'Amharic' },
										{ value: 'en', name: 'English' }
									]}
									{form}
									{errors}
								/>
							{/snippet}
						</FormDialog>
					{/if}
				{/snippet}
				{#if data.schedules.length}
					<DataTable variant="compact" columns={scheduleColumns} data={data.schedules} />
				{:else}<Empty message="No weekly times yet" />{/if}
			</PageSection>
			<PageSection title="Upcoming sessions">
				{#if data.sessions.length}
					<DataTable variant="compact" columns={sessionColumns} data={data.sessions} />
				{:else}<Empty message="No sessions ahead — make some from the weekly times" />{/if}
			</PageSection>
		{/if}
	</div>
</div>
