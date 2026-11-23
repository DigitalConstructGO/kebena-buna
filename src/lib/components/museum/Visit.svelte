<script lang="ts">
	import ArrivalMap from './ArrivalMap.svelte';
	import type { VisitContent } from '#lib/content/museum.js';

	let { content }: { content: VisitContent } = $props();
</script>

<!-- The last stop on the page: the way to the museum, told as you scroll (`ArrivalMap`). -->
<ArrivalMap
	id="visit"
	eyebrow={content.eyebrow}
	title={content.title}
	beats={content.beats}
	tags={content.tags}
	place={content.place}
	rows={content.rows}
	actions={[
		{ ...content.directions, external: true },
		{ label: content.call.label, href: content.call.href }
	]}
/>
