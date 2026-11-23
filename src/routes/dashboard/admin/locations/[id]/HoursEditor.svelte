<script lang="ts">
	import Save from '@lucide/svelte/icons/save';
	import type { SuperValidated } from 'sveltekit-superforms';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { Input } from '@nahu/admin-kit/components/ui/input/index.js';
	import { Switch } from '@nahu/admin-kit/components/ui/switch/index.js';
	import * as Table from '@nahu/admin-kit/components/ui/table/index.js';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';
	import { confirmLeave, createForm } from '@nahu/admin-kit/forms/createForm';
	import { WEEKDAYS } from '#lib/format.ts';
	import { hoursSchema } from '#lib/schemas/admin.ts';

	/**
	 * The week's opening hours as one sheet: seven rows, each closed or with its times. The kit's
	 * `InputComp` binds one field by name and cannot reach into a list, so the rows use the kit's
	 * own input and switch primitives over a JSON form.
	 */
	type Hours = {
		days: {
			weekday: number;
			isClosed: boolean;
			opensAt?: string | null;
			closesAt?: string | null;
			lastEntryAt?: string | null;
		}[];
	};
	let { data, disabled = false }: { data: SuperValidated<Hours>; disabled?: boolean } = $props();

	// svelte-ignore state_referenced_locally
	const { form, enhance, delayed, allErrors } = createForm(data, hoursSchema, {
		taintedMessage: confirmLeave,
		dataType: 'json',
		resetForm: false
	});
</script>

<form method="POST" action="?/hours" use:enhance class="grid grid-cols-1 gap-3">
	<Errors allErrors={$allErrors} />
	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Day</Table.Head>
				<Table.Head>Open</Table.Head>
				<Table.Head>Opens</Table.Head>
				<Table.Head>Closes</Table.Head>
				<Table.Head>Last entry</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each $form.days as day, i (day.weekday)}
				<Table.Row>
					<Table.Cell class="font-medium">{WEEKDAYS[day.weekday]}</Table.Cell>
					<Table.Cell>
						<Switch
							checked={!day.isClosed}
							onCheckedChange={(open) => ($form.days[i].isClosed = !open)}
							aria-label="{WEEKDAYS[day.weekday]} open"
							{disabled}
						/>
					</Table.Cell>
					{#each ['opensAt', 'closesAt', 'lastEntryAt'] as const as field (field)}
						<Table.Cell>
							<Input
								type="time"
								class="w-32"
								aria-label="{WEEKDAYS[day.weekday]} {field}"
								disabled={disabled || day.isClosed}
								bind:value={() => $form.days[i][field] ?? '', (v) => ($form.days[i][field] = v || null)}
							/>
						</Table.Cell>
					{/each}
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>
	{#if !disabled}
		<Button type="submit" class="justify-self-start" disabled={$delayed}>
			{#if $delayed}<LoadingBtn name="Saving" />{:else}<Save class="size-4" /> Save hours{/if}
		</Button>
	{/if}
</form>
