<script lang="ts">
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { m } from '#lib/paraglide/messages.js';
	import { siteHref } from './locale.ts';

	const locale = $derived(getLocale());
	const columns = $derived([
		{
			title: m.site_footer_museum(),
			links: [
				{ path: '/#halls', label: m.site_footer_halls() },
				{ path: '/history', label: m.site_nav_history() },
				{ path: '/kingdoms', label: m.site_footer_kingdoms() },
				{ path: '/visit', label: m.site_footer_tickets() },
				{ path: '/events', label: m.site_footer_events() }
			]
		},
		{
			title: m.site_footer_coffee(),
			links: [
				{ path: '/shop', label: m.site_nav_shop() },
				{ path: '/subscriptions', label: m.site_footer_subscriptions() },
				{ path: '/membership', label: m.site_footer_membership() },
				{ path: '/wholesale', label: m.site_footer_wholesale() }
			]
		},
		{
			title: m.site_footer_help(),
			links: [
				{ path: '/contact', label: m.site_nav_contact() },
				{ path: '/groups', label: m.site_footer_groups() },
				{ path: '/track', label: m.site_footer_track() }
			]
		}
	]);
</script>

<footer>
	<div class="inner">
		<div class="about">
			<p class="name">Kebena</p>
			<p>{m.site_footer_tagline()}</p>
			<p class="contact">
				<a href="tel:+251912605824">+251 912 605 824</a><br />
				<a href="mailto:info@kebenageneraltrading.com">info@kebenageneraltrading.com</a>
			</p>
		</div>
		{#each columns as col (col.title)}
			<nav aria-label={col.title}>
				<p class="col-title">{col.title}</p>
				<ul>
					{#each col.links as link (link.path)}
						<li><a href={siteHref(link.path, locale)}>{link.label}</a></li>
					{/each}
				</ul>
			</nav>
		{/each}
	</div>
	<p class="legal">© Kebena Trading PLC. {m.site_footer_rights()}</p>
</footer>

<style>
	footer {
		padding: clamp(48px, 7vw, 88px) var(--gutter) 28px;
		background: var(--forest-950);
		color: #f4ebd9;
	}
	.inner {
		display: grid;
		gap: 32px;
		max-width: 1120px;
		margin: 0 auto;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr));
	}
	.about {
		display: grid;
		gap: 10px;
		align-content: start;
		color: #b8bfab;
	}
	.about p {
		margin: 0;
	}
	.name {
		font-family: var(--font-display);
		font-size: 1.6rem;
		font-weight: 700;
		color: var(--gold-soft);
	}
	.col-title {
		margin: 0 0 12px;
		font-family: var(--font-display);
		font-size: 13px;
		font-weight: 500;
		font-stretch: 75%;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--gold);
	}
	ul {
		display: grid;
		gap: 8px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	a {
		color: #f4ebd9d9;
		text-decoration: none;
	}
	a:hover {
		color: #fff;
		text-decoration: underline;
		text-underline-offset: 4px;
	}
	.legal {
		max-width: 1120px;
		margin: 40px auto 0;
		padding-top: 20px;
		border-top: 1px solid #ffffff1a;
		color: #b8bfab;
		font-size: 13px;
	}
</style>
