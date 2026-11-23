<script lang="ts">
	import '#lib/site/museum.css';

	let { children } = $props();
</script>

<!-- The design's look is scoped to `.museum` (`museum.css`), clear of the dashboard's theme. -->
<div class="museum">
	{@render children()}
</div>
