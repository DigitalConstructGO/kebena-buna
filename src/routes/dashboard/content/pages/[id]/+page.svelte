<script lang="ts">
	import Save from '@lucide/svelte/icons/save';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Send from '@lucide/svelte/icons/send';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import Archive from '@lucide/svelte/icons/archive';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import SingleTable from '@nahu/admin-kit/components/SingleTable.svelte';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import ConfirmAction from '@nahu/admin-kit/components/ConfirmAction.svelte';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { createForm, confirmLeave } from '@nahu/admin-kit/forms/createForm';
	import { pageSchema } from '#lib/schemas/content.ts';
	import { badge } from '#lib/status.ts';
	import { formatDateTime } from '#lib/format.ts';
	import { stampRows, useLinks } from '#lib/links.ts';
	import DocFields from '#lib/components/content/DocFields.svelte';
	import PageSettings from '../PageSettings.svelte';

	let { data } = $props();
	const p = $derived(data.page);
	const href = useLinks();

	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed, allErrors } = createForm(data.form, pageSchema, {
		taintedMessage: confirmLeave,
		resetForm: false
	});
</script>

<PageHeader title={$form.titleEn || p.title} tabTitle="{p.title} · Pages" eyebrow="Page">
	{#snippet badges()}
		<Statuses {...badge(p.publishStatus)} />
	{/snippet}
	{#snippet actions()}
		<Button href="/dashboard/content/pages" variant="outline">
			<ArrowLeft class="size-4" /> Pages
		</Button>
		{#if p.publishStatus !== 'published'}
			<ConfirmAction
				action="?/status"
				fields={{ to: 'published' }}
				label="Publish"
				icon={Send}
				title="Publish this page?"
				description="It appears on the website as last saved."
			/>
		{:else}
			<ConfirmAction
				action="?/status"
				fields={{ to: 'draft' }}
				label="Unpublish"
				icon={EyeOff}
				variant="outline"
				title="Take this page off the website?"
				description="It goes back to draft; nothing is lost."
			/>
		{/if}
		{#if p.publishStatus !== 'archived'}
			<ConfirmAction
				action="?/status"
				fields={{ to: 'archived' }}
				label="Archive"
				icon={Archive}
				variant="outline"
				title="Archive this page?"
				description="Off the website and out of the menu, kept for reference."
			/>
		{/if}
		<ConfirmAction
			action="?/delete"
			label="Delete"
			icon={Trash2}
			variant="destructive"
			title="Delete this page?"
			description="It is taken off the website at once and its address can be used again. Child pages lose their parent."
		/>
	{/snippet}
</PageHeader>

<form
	method="POST"
	action="?/save"
	enctype="multipart/form-data"
	use:enhance
	class="mt-4 grid grid-cols-1 gap-6"
>
	<Errors allErrors={$allErrors} />
	<DocFields
		{form}
		{errors}
		base="/"
		picture="heroImage"
		pictureLabel="Hero picture"
		stored={p.heroImage ?? ''}
	>
		{#snippet settings()}
			<PageSettings {form} {errors} parents={data.parents} />
		{/snippet}
	</DocFields>
	<div class="sticky bottom-2 flex justify-end">
		<Button type="submit" disabled={$delayed} class="shadow-md">
			{#if $delayed}<LoadingBtn name="Saving" />{:else}<Save class="size-4" /> Save page{/if}
		</Button>
	</div>
</form>

<div class="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
	<PageSection title="In the site">
		<SingleTable
			singleTable={[
				{ name: 'Address', value: `/${p.slug}` },
				{ name: 'Parent', value: data.parent?.title ?? '—', href: href('page', data.parent?.id) },
				...(data.children.length
					? data.children.map((c, i) => ({
							name: i ? '' : 'Child pages',
							value: c.title,
							href: href('page', c.id)
						}))
					: [{ name: 'Child pages', value: '—' }]),
				{ name: 'Published', value: formatDateTime(p.publishedAt) },
				{ name: 'Reading time', value: p.minutes ? `${p.minutes} min` : '—' }
			]}
		/>
	</PageSection>
	<PageSection title="Record">
		<SingleTable singleTable={stampRows(data.stamps, href)} />
	</PageSection>
</div>
