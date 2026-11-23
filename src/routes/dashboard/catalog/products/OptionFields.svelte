<script lang="ts">
	import type { SuperForm } from 'sveltekit-superforms';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';

	type Option = { value: number; name: string };
	/**
	 * The roasts, grinds and packagings a product may be ordered in, and which is preselected —
	 * shared by the new-product page and the options dialog. The form posts as JSON.
	 */
	let {
		form,
		errors,
		options
	}: {
		form: SuperForm<Record<string, unknown>>['form'];
		errors: SuperForm<Record<string, unknown>>['errors'];
		options: { roastLevels: Option[]; grinds: Option[]; packagings: Option[] };
	} = $props();

	const chosen = (all: Option[], key: string) =>
		all.filter((o) => ((($form[key] as number[] | undefined) ?? []).map(Number)).includes(o.value));
</script>

<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
	<div class="grid grid-cols-1 content-start gap-2">
		<InputComp label="Roast levels" name="roastLevelIds" type="checkbox" items={options.roastLevels} selectAll={false} {form} {errors} />
		<InputComp label="Default roast" name="defaultRoastLevelId" type="select" items={chosen(options.roastLevels, 'roastLevelIds')} {form} {errors} />
	</div>
	<div class="grid grid-cols-1 content-start gap-2">
		<InputComp label="Grinds" name="grindIds" type="checkbox" items={options.grinds} selectAll={false} {form} {errors} />
		<InputComp label="Default grind" name="defaultGrindId" type="select" items={chosen(options.grinds, 'grindIds')} {form} {errors} />
	</div>
	<div class="grid grid-cols-1 content-start gap-2">
		<InputComp label="Packaging" name="packagingIds" type="checkbox" items={options.packagings} selectAll={false} {form} {errors} />
		<InputComp label="Default packaging" name="defaultPackagingId" type="select" items={chosen(options.packagings, 'packagingIds')} {form} {errors} />
	</div>
</div>
