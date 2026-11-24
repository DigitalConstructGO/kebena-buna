<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import Plus from '@lucide/svelte/icons/plus';
	import Save from '@lucide/svelte/icons/save';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import Notice from '@nahu/admin-kit/components/Notice.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import LineCell from '@nahu/admin-kit/components/lines/LineCell.svelte';
	import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { confirmLeave, createForm } from '@nahu/admin-kit/forms/createForm';
	import { resolve } from '$app/paths';
	import { money, pct, qty } from '#lib/format.ts';
	import { MANUAL_PROVIDERS, staffOrderSchema } from '#lib/schemas/orders.ts';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed, allErrors } = createForm(data.form, staffOrderSchema, {
		taintedMessage: confirmLeave,
		dataType: 'json'
	});

	const CHANNELS = [
		{ value: 'desk', name: 'Desk sale' },
		{ value: 'admin', name: 'Phone or message' },
		{ value: 'telegram', name: 'Telegram' },
		{ value: 'wholesale', name: 'Wholesale account' }
	];
	const METHODS = [
		{ value: 'none', name: 'Taken now' },
		{ value: 'pickup', name: 'Collected later' },
		{ value: 'rider', name: 'Our rider' },
		{ value: 'courier', name: 'Courier' }
	];
	const PROVIDER_NAMES: Record<(typeof MANUAL_PROVIDERS)[number], string> = {
		desk_cash: 'Cash',
		desk_card: 'Card',
		bank_transfer: 'Bank transfer',
		telebirr: 'Telebirr',
		cbe_birr: 'CBE Birr',
		store_credit: 'Store credit'
	};
	const providers = MANUAL_PROVIDERS.map((p) => ({ value: p, name: PROVIDER_NAMES[p] }));

	type Line = (typeof $form.lines)[number];
	type Row = Line & { index: number };

	const wholesale = $derived($form.channel === 'wholesale');
	const account = $derived(
		wholesale ? data.accounts.find((a) => a.value === Number($form.businessAccountId)) : undefined
	);
	const canCredit = $derived(Boolean(account?.creditApproved && account.termsDays > 0));
	// A tick left from an account with credit does not carry over to one without.
	$effect(() => {
		if (!canCredit && $form.onCredit) $form.onCredit = false;
	});
	const shipped = $derived($form.deliveryMethod === 'rider' || $form.deliveryMethod === 'courier');
	const variantOf = (id: unknown) => data.variants.find((v) => v.value === Number(id));
	const pick = (ids: number[], all: { value: number; name: string }[]) =>
		all.filter((o) => ids.includes(o.value));

	const rows = $derived($form.lines.map((line, index) => ({ ...line, index })));
	const update = (index: number, patch: Partial<Line>) =>
		($form.lines = $form.lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
	const addLine = () =>
		($form.lines = [
			...$form.lines,
			{ variantId: undefined as unknown as number, roastLevelId: null, grindId: null, quantity: 1 }
		]);
	const rowInvalid = (i: number) => Boolean(($errors.lines as Record<number, unknown>)?.[i]);
	const listError = $derived(
		[($errors.lines as { _errors?: string[] } | undefined)?._errors ?? []].flat().join(' ')
	);

	const retail = $derived(
		$form.lines.reduce(
			(sum, l) => sum + (variantOf(l.variantId)?.price ?? 0) * Number(l.quantity),
			0
		)
	);
	const kg = $derived(
		$form.lines.reduce((sum, l) => {
			const v = variantOf(l.variantId);
			return sum + (v?.kind === 'coffee' ? ((v.grams ?? 0) * Number(l.quantity)) / 1000 : 0);
		}, 0)
	);
	const coffee = $derived(
		$form.lines.reduce((sum, l) => {
			const v = variantOf(l.variantId);
			return sum + (v?.kind === 'coffee' ? v.price * Number(l.quantity) : 0);
		}, 0)
	);
	// The same sum the server prices with (`wholesalePricing`): tier and account discount combined.
	const tier = $derived(
		data.tiers.findLast((t) => kg >= t.minKg && (t.maxKg === null || kg <= t.maxKg))
	);
	const off = $derived(
		wholesale ? 1 - (1 - (tier?.pct ?? 0) / 100) * (1 - (account?.discountPct ?? 0) / 100) : 0
	);
	const minKg = $derived(account?.minOrderKg ?? data.minKg);
	const zoneFee = $derived(data.zones.find((z) => z.value === Number($form.deliveryZoneId))?.fee);
	const fee = $derived(shipped ? Number($form.deliveryFee ?? zoneFee ?? 0) : 0);
	const total = $derived(retail - coffee * off + Number(fee));

	const columns: ColumnDef<Row>[] = $derived([
		{
			id: 'item',
			header: 'Item',
			cell: ({ row }) =>
				renderComponent(LineCell, {
					kind: 'product',
					name: `variantId-${row.original.index}`,
					label: 'Item',
					items: data.variants,
					value: row.original.variantId ?? undefined,
					invalid: rowInvalid(row.original.index),
					onchange: (v: unknown) =>
						update(row.original.index, {
							variantId: v as number,
							roastLevelId: null,
							grindId: null
						})
				})
		},
		{
			id: 'roast',
			header: 'Roast',
			cell: ({ row }) => {
				const items = pick(variantOf(row.original.variantId)?.roasts ?? [], data.roastLevels);
				return items.length
					? renderComponent(LineCell, {
							kind: 'product',
							name: `roastLevelId-${row.original.index}`,
							label: 'Roast',
							items,
							value: row.original.roastLevelId ?? undefined,
							onchange: (v: unknown) => update(row.original.index, { roastLevelId: v as number })
						})
					: '—';
			}
		},
		{
			id: 'grind',
			header: 'Grind',
			cell: ({ row }) => {
				const items = pick(variantOf(row.original.variantId)?.grinds ?? [], data.grinds);
				return items.length
					? renderComponent(LineCell, {
							kind: 'product',
							name: `grindId-${row.original.index}`,
							label: 'Grind',
							items,
							value: row.original.grindId ?? undefined,
							onchange: (v: unknown) => update(row.original.index, { grindId: v as number })
						})
					: '—';
			}
		},
		{
			id: 'qty',
			header: 'Qty',
			meta: { align: 'right' },
			cell: ({ row }) =>
				renderComponent(LineCell, {
					kind: 'number',
					name: `quantity-${row.original.index}`,
					label: 'Quantity',
					min: 1,
					step: '1',
					narrow: true,
					value: row.original.quantity,
					invalid: Number(row.original.quantity) < 1,
					onchange: (v: unknown) => update(row.original.index, { quantity: Number(v) })
				})
		},
		{
			id: 'shelf',
			header: 'On the shelf',
			meta: { align: 'right' },
			cell: ({ row }) => {
				const v = variantOf(row.original.variantId);
				return v?.kind === 'coffee' ? qty(v.available, 'bags') : '—';
			}
		},
		{
			id: 'price',
			header: 'Retail',
			meta: { align: 'right' },
			cell: ({ row }) => {
				const v = variantOf(row.original.variantId);
				return v ? money(v.price * Number(row.original.quantity)) : '—';
			}
		},
		{
			id: 'remove',
			header: '',
			cell: ({ row }) =>
				renderComponent(LineCell, {
					kind: 'remove',
					name: `remove-${row.original.index}`,
					label: `Remove line ${row.original.index + 1}`,
					value: null,
					onchange: () => ($form.lines = $form.lines.filter((_, i) => i !== row.original.index))
				})
		}
	]);
</script>

<PageHeader
	title="New order"
	description="A sale at the desk, an order by phone or Telegram, or a wholesale order. Prices come from the catalogue; wholesale orders get their tier and account discount when saved."
/>

<form method="POST" use:enhance class="mt-4 grid max-w-5xl grid-cols-1 gap-6">
	<Errors allErrors={$allErrors} />

	<PageSection title="Who it is for">
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			<InputComp
				label="Taken as"
				name="channel"
				type="select"
				items={CHANNELS}
				{form}
				{errors}
				required
			/>
			{#if wholesale}
				<InputComp
					label="Business account"
					name="businessAccountId"
					type="combo"
					items={data.accounts}
					{form}
					{errors}
					required
				/>
				<InputComp
					label="Ordered by"
					name="customerId"
					type="combo"
					items={data.customers}
					placeholder="The account's admin"
					{form}
					{errors}
				/>
			{:else}
				<InputComp
					label="Customer"
					name="customerId"
					type="combo"
					items={data.customers}
					{form}
					{errors}
					required
				/>
			{/if}
		</div>
		{#if !wholesale}
			<p class="mt-2 text-sm text-muted-foreground">
				Not in the list? <a
					href={resolve('/dashboard/customers/new')}
					class="underline underline-offset-2"
				>
					Add the customer
				</a> first.
			</p>
		{/if}
		{#if account}
			<Notice tone="info" class="mt-4" title={account.name}>
				Account discount {pct(account.discountPct)} on top of the quantity tier · minimum {qty(
					minKg,
					'kg'
				)}.
				{#if canCredit}
					Credit: {account.termsDays} days, {money(account.owed)} owed of a {money(
						account.creditLimit
					)} limit.
				{:else}
					No credit: paid before it is sent.
				{/if}
			</Notice>
		{/if}
	</PageSection>

	<PageSection title="What is sold">
		<div class="grid grid-cols-1 gap-2">
			<DataTable
				variant="sheet"
				{columns}
				data={rows}
				summary={[
					{ label: 'Retail', value: money(retail) },
					...(wholesale
						? [
								{ label: 'Coffee', value: qty(Math.round(kg * 1000) / 1000, 'kg') },
								{ label: 'Wholesale discount', value: `${pct(Math.round(off * 10000) / 100)}` }
							]
						: []),
					...(shipped ? [{ label: 'Delivery', value: money(fee) }] : []),
					{ label: 'Total', value: money(total), strong: true }
				]}
			/>
			{#if listError}<p class="text-sm text-destructive">{listError}</p>{/if}
			<Button
				type="button"
				variant="outline"
				size="sm"
				class="justify-self-start"
				onclick={addLine}
			>
				<Plus class="size-4" /> Add a line
			</Button>
		</div>
		{#if wholesale && kg > 0 && kg < minKg}
			<Notice tone="warning" class="mt-4">
				{qty(Math.round(kg * 1000) / 1000, 'kg')} of coffee: a wholesale order is at least {qty(
					minKg,
					'kg'
				)}.
			</Notice>
		{/if}
	</PageSection>

	<PageSection title="How it gets there">
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			<InputComp
				label="Delivery"
				name="deliveryMethod"
				type="select"
				items={METHODS}
				{form}
				{errors}
				required
			/>
			<InputComp
				label={$form.deliveryMethod === 'pickup' ? 'Collected at' : 'Sold at / sent from'}
				name="locationId"
				type="select"
				items={data.locations}
				{form}
				{errors}
			/>
			{#if shipped}
				<InputComp
					label="Delivery zone"
					name="deliveryZoneId"
					type="select"
					items={data.zones}
					{form}
					{errors}
				/>
				<InputComp
					label="Delivery fee"
					name="deliveryFee"
					type="number"
					step="0.01"
					placeholder={zoneFee !== undefined ? `Zone fee ${zoneFee}` : ''}
					{form}
					{errors}
				/>
				<InputComp label="Address" name="addressLine" {form} {errors} required />
				<InputComp label="City" name="addressCity" placeholder="Addis Ababa" {form} {errors} />
			{/if}
		</div>
	</PageSection>

	<PageSection title="Payment">
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			{#if canCredit}
				<div class="sm:col-span-2">
					<InputComp
						label="On credit"
						name="onCredit"
						type="checkboxSingle"
						placeholder="Send it now and bill it on an invoice due in {account?.termsDays} days"
						{form}
						{errors}
					/>
				</div>
			{/if}
			{#if !$form.onCredit}
				<InputComp
					label="Paid now by"
					name="payNow"
					type="select"
					items={providers}
					placeholder="Not yet — send the buyer a pay link"
					{form}
					{errors}
				/>
				{#if $form.payNow}
					<InputComp label="Reference" name="payReference" {form} {errors} />
				{/if}
			{/if}
		</div>
	</PageSection>

	<PageSection title="Notes">
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			<InputComp
				label="From the customer"
				name="customerNote"
				type="textarea"
				rows={2}
				{form}
				{errors}
			/>
			<InputComp label="For staff" name="staffNote" type="textarea" rows={2} {form} {errors} />
		</div>
	</PageSection>

	<Button type="submit" size="lg" class="sm:justify-self-start" disabled={$delayed}>
		{#if $delayed}<LoadingBtn name="Saving" />{:else}<Save class="size-4" /> Place order{/if}
	</Button>
</form>
