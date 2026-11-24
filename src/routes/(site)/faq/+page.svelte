<script lang="ts">
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { m } from '#lib/i18n.ts';
	import { humanize, tr } from '#lib/format.ts';
	import { siteHref } from '#lib/site/locale.ts';

	let { data } = $props();

	const locale = $derived(getLocale());

	/** A topic's heading: the known ones are translated, any other reads as it was typed. */
	const TOPICS: Record<string, () => string> = {
		tickets: m.faq_topic_tickets,
		hours: m.faq_topic_hours,
		delivery: m.faq_topic_delivery,
		payments: m.faq_topic_payments,
		refunds: m.faq_topic_refunds,
		memberships: m.faq_topic_memberships,
		subscriptions: m.faq_topic_subscriptions,
		roasting: m.faq_topic_roasting,
		wholesale: m.faq_topic_wholesale
	};
	const heading = (topic: string) => TOPICS[topic]?.() ?? humanize(topic);

	/** The questions as search engines read an FAQ; `<` escaped so no answer closes the script. */
	const jsonLd = $derived(
		JSON.stringify({
			'@context': 'https://schema.org',
			'@type': 'FAQPage',
			mainEntity: data.topics.flatMap((t) =>
				t.entries.map((e) => ({
					'@type': 'Question',
					name: tr(e.question, locale),
					acceptedAnswer: { '@type': 'Answer', text: tr(e.answer, locale) }
				}))
			)
		}).replaceAll('<', '\\u003c')
	);
	// Built in pieces: a closing script tag written whole would end this block.
	const jsonLdTag = $derived(`<script type="application/ld+json">${jsonLd}<${'/'}script>`);
</script>

<svelte:head>
	<title>{m.site_page_title({ title: m.faq_title() })}</title>
	<meta name="description" content={m.faq_lede()} />
	{#if data.topics.length}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html jsonLdTag}
	{/if}
</svelte:head>

<div class="page">
	<header class="head">
		<p class="label">{m.faq_label()}</p>
		<h1 class="title">{m.faq_title()}</h1>
		<p class="lede">{m.faq_lede()}</p>
	</header>

	{#if data.topics.length}
		{#if data.topics.length > 1}
			<nav class="section chips" aria-label={m.faq_title()}>
				{#each data.topics as t (t.topic)}
					<a href="#{t.topic}">{heading(t.topic)}</a>
				{/each}
			</nav>
		{/if}
		{#each data.topics as t (t.topic)}
			<section class="section topic" id={t.topic} aria-labelledby="h-{t.topic}">
				<h2 class="section-title" id="h-{t.topic}">{heading(t.topic)}</h2>
				<div class="qa">
					{#each t.entries as e (e.id)}
						<details class="card">
							<summary>{tr(e.question, locale)}</summary>
							<p class="answer">{tr(e.answer, locale)}</p>
						</details>
					{/each}
				</div>
			</section>
		{/each}
	{:else}
		<p class="section notice">{m.faq_empty()}</p>
	{/if}

	<div class="section card ask">
		<p class="name">{m.faq_ask()}</p>
		<a class="btn" href={siteHref('/contact', locale)}>{m.faq_write()}</a>
	</div>
</div>

<style>
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.chips a {
		padding: 9px 16px;
		border: 1px solid var(--hair);
		border-radius: 999px;
		color: var(--ink);
		font-size: 14px;
		text-decoration: none;
	}
	.chips a:hover {
		background: var(--card);
	}
	.topic {
		scroll-margin-top: 110px;
	}
	.qa {
		display: grid;
		gap: 10px;
		max-width: 80ch;
	}
	details {
		padding: 0;
	}
	summary {
		padding: 18px 22px;
		font-family: var(--font-display);
		font-size: 1.1rem;
		font-weight: 600;
		cursor: pointer;
	}
	summary:focus-visible {
		outline: 2px solid var(--accent-ink);
		outline-offset: 2px;
		border-radius: 20px;
	}
	.answer {
		margin: 0;
		padding: 0 22px 20px;
		color: var(--ink-soft);
		line-height: 1.6;
		white-space: pre-line;
	}
	.ask {
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
		align-items: center;
		justify-content: space-between;
	}
	.ask .name {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.3rem;
		font-weight: 700;
	}
</style>
