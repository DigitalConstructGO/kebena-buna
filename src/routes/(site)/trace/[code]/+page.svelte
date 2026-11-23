<script lang="ts">
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { m } from '#lib/paraglide/messages.js';
	import { formatDate, tr } from '#lib/format.ts';
	import { siteHref } from '#lib/site/locale.ts';

	let { data } = $props();

	const locale = $derived(getLocale());
	const run = $derived(data.run);

	const PROCESS: Record<string, () => string> = {
		washed: m.trace_process_washed,
		natural: m.trace_process_natural,
		honey: m.trace_process_honey,
		anaerobic: m.trace_process_anaerobic
	};
	const STATION: Record<string, () => string> = {
		washing_station: m.trace_type_washing_station,
		dry_mill: m.trace_type_dry_mill,
		farm: m.trace_type_farm
	};
	const altitude = (min: number | null, max: number | null) =>
		min && max && min !== max ? `${min}–${max} m` : min || max ? `${min ?? max} m` : null;
	const paragraphs = (text: string) => text.split(/\n{2,}|\r\n\r\n/).map((p) => p.trim()).filter(Boolean);
	const bag = $derived([run.size ? tr(run.size, locale) : null, tr(run.roastLevel, locale), run.grind ? tr(run.grind, locale) : m.trace_whole_bean()].filter(Boolean).join(' · '));
</script>

<svelte:head>
	<title>{m.trace_title({ product: tr(run.product, locale) })} · Kebena</title>
	<meta name="description" content={m.trace_lede()} />
</svelte:head>

<div class="page">
	<header class="head">
		<p class="label">{m.trace_label()}</p>
		<h1 class="title">{tr(run.product, locale)}</h1>
		<p class="lede">{bag}</p>
		<dl class="facts">
			<div><dt>{m.trace_bag_code()}</dt><dd class="num">{run.code}</dd></div>
			<div><dt>{m.trace_packed()}</dt><dd>{formatDate(run.packedAt)}</dd></div>
			{#if run.bestBefore}<div><dt>{m.trace_best_before()}</dt><dd>{formatDate(run.bestBefore)}</dd></div>{/if}
		</dl>
		{#if tr(run.tastingNotes ?? '', locale)}<p class="notes">{tr(run.tastingNotes ?? '', locale)}</p>{/if}
	</header>

	<ol class="chain">
		{#each data.stations as s, i (s.id)}
			<li class="step" class:cont={i > 0}>
				<p class="step-no" aria-hidden="true">{i === 0 ? '01' : ''}</p>
				<div class="step-body">
					<p class="label">{STATION[s.type]?.() ?? s.type} · {tr(s.region, locale)}</p>
					<h2 class="step-title">{tr(s.name, locale)}</h2>
					{#if s.photo}<img class="photo" src={s.photo} alt={tr(s.name, locale)} loading="lazy" />{/if}
					<dl class="facts">
						{#if altitude(s.altitudeMinM, s.altitudeMaxM)}<div><dt>{m.trace_altitude()}</dt><dd>{altitude(s.altitudeMinM, s.altitudeMaxM)}</dd></div>{/if}
						{#if s.farmerCount}<div><dt>{m.trace_farmers()}</dt><dd class="num">{s.farmerCount.toLocaleString()}</dd></div>{/if}
					</dl>
					{#each paragraphs(tr(s.story ?? '', locale)) as p, i (i)}<p class="story">{p}</p>{/each}
					{#if s.certifications.length}
						<ul class="certs">
							{#each s.certifications as c, i (i)}
								<li>
									{#if c.logo}<img src={c.logo} alt="" width="36" height="36" loading="lazy" />{/if}
									<span>{tr(c.name, locale)}</span>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			</li>
		{/each}

		{#each data.lots as l, i (l.id)}
			<li class="step" class:cont={i > 0}>
				<p class="step-no" aria-hidden="true">{i === 0 ? '02' : ''}</p>
				<div class="step-body">
					<p class="label">{m.trace_lot()} {l.code}</p>
					<h2 class="step-title">{PROCESS[l.process]?.() ?? l.process} · {l.cropYear}</h2>
					{#if l.photo}<img class="photo" src={l.photo} alt="" loading="lazy" />{/if}
					<dl class="facts">
						<div><dt>{m.trace_region()}</dt><dd>{tr(l.region, locale)}</dd></div>
						{#if l.grade}<div><dt>{m.trace_grade()}</dt><dd>{l.grade}</dd></div>{/if}
						{#if l.altitudeM}<div><dt>{m.trace_altitude()}</dt><dd>{l.altitudeM} m</dd></div>{/if}
						{#if l.cuppingScore}<div><dt>{m.trace_cupping()}</dt><dd class="num">{l.cuppingScore}</dd></div>{/if}
						{#if l.farmerCount}<div><dt>{m.trace_farmers()}</dt><dd class="num">{l.farmerCount.toLocaleString()}</dd></div>{/if}
						{#if l.varieties.length}<div><dt>{m.trace_varieties()}</dt><dd>{l.varieties.join(', ')}</dd></div>{/if}
					</dl>
					{#if tr(l.tastingNotes ?? '', locale)}<p class="notes">{tr(l.tastingNotes ?? '', locale)}</p>{/if}
					{#each paragraphs(tr(l.story ?? '', locale)) as p, i (i)}<p class="story">{p}</p>{/each}
					{#if l.certifications.length}
						<ul class="certs">
							{#each l.certifications as c, i (i)}
								<li>
									{#if c.logo}<img src={c.logo} alt="" width="36" height="36" loading="lazy" />{/if}
									<span>{tr(c.name, locale)}</span>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			</li>
		{/each}

		{#if data.batches.length}
			<li class="step">
				<p class="step-no" aria-hidden="true">03</p>
				<div class="step-body">
					<p class="label">{m.trace_roasted_label()}</p>
					<h2 class="step-title">{m.trace_roasted({ roast: tr(run.roastLevel, locale) })}</h2>
					<ul class="batches">
						{#each data.batches as b (b.id)}
							<li>
								<span class="num">{b.code}</span>
								<span>{formatDate(b.roastedAt)}</span>
								{#if b.cuppingScore}<span class="muted">{m.trace_cupping()} {b.cuppingScore}</span>{/if}
							</li>
						{/each}
					</ul>
				</div>
			</li>
		{/if}

		<li class="step">
			<p class="step-no" aria-hidden="true">04</p>
			<div class="step-body">
				<p class="label">{m.trace_packed_label()}</p>
				<h2 class="step-title">{m.trace_packed_title({ date: formatDate(run.packedAt) })}</h2>
				<p class="story">{m.trace_packed_story()}</p>
				<p><a class="btn" href={siteHref(`/shop/${run.productSlug}`, locale)}>{m.trace_buy()}</a></p>
			</div>
		</li>
	</ol>

	{#if !data.lots.length}
		<p class="section notice">{m.trace_no_lots()}</p>
	{/if}
</div>

<style>
	.facts {
		display: flex;
		flex-wrap: wrap;
		gap: 12px 32px;
		margin: 6px 0 0;
	}
	.facts dt {
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-soft);
	}
	.facts dd {
		margin: 2px 0 0;
		font-family: var(--font-display);
		font-size: 1.15rem;
		font-weight: 700;
	}
	.notes {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(1.2rem, 2.2vw, 1.6rem);
		font-weight: 500;
		color: var(--accent-ink);
	}
	.chain {
		display: grid;
		gap: 0;
		max-width: 1120px;
		margin: clamp(40px, 6vw, 80px) auto 0;
		padding: 0;
		list-style: none;
	}
	.step {
		display: grid;
		grid-template-columns: clamp(56px, 9vw, 120px) minmax(0, 1fr);
		gap: clamp(16px, 3vw, 40px);
		padding: clamp(28px, 4vw, 48px) 0;
		border-top: 1px solid var(--hair);
	}
	/* A second station or lot continues the same step: a lighter rule, no number. */
	.step.cont {
		border-top-style: dashed;
	}
	.step-no {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(2.4rem, 6vw, 4.8rem);
		font-weight: 800;
		line-height: 0.9;
		color: var(--accent-ink);
		opacity: 0.55;
	}
	.step-body {
		display: grid;
		gap: 14px;
		align-content: start;
		max-width: 68ch;
	}
	.step-body > p {
		margin: 0;
	}
	.step-title {
		font-size: clamp(1.8rem, 4vw, 3rem);
		font-weight: 800;
		line-height: 1;
	}
	.photo {
		width: 100%;
		max-height: 420px;
		object-fit: cover;
		border-radius: 20px;
		border: 1px solid var(--hair);
	}
	.story {
		font-size: 1.05rem;
		line-height: 1.6;
	}
	.certs {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.certs li {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 12px 6px 6px;
		border: 1px solid var(--hair);
		border-radius: 999px;
		background: var(--card);
		font-size: 14px;
	}
	.certs img {
		width: 28px;
		height: 28px;
		object-fit: contain;
		border-radius: 50%;
		background: #fff;
	}
	.batches {
		display: grid;
		gap: 8px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.batches li {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 18px;
		padding: 10px 0;
		border-bottom: 1px solid var(--line);
	}
</style>
