<!--
	The discount-code box on a checkout. "Apply" asks `/discount` what the code takes off and hands
	the rule back (`bind:rule`), so the page's total can show it; the typed code is the form's own
	`discountCode` field and is checked again, for real, when the order is placed. Editing the
	code after applying it takes the discount off until it is applied again.
-->
<script lang="ts">
	import { Input } from '@nahu/admin-kit/components/ui/input/index.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { m } from '#lib/i18n.ts';
	import { money } from '#lib/format.ts';
	import { applyDiscount, type DiscountLine, type DiscountRule } from '#lib/discounts.ts';
	import { siteHref } from '#lib/site/locale.ts';

	type Applied = DiscountRule & { code: string };

	let {
		value = $bindable(),
		rule = $bindable(null),
		lines,
		errors
	}: {
		/** The form's `discountCode`. */
		value?: string | null;
		/** The code's rule once applied, for the page's total. */
		rule?: Applied | null;
		/** What the code would apply to: each line's kind and price. */
		lines: DiscountLine[];
		/** The form's errors for the field, from the server's own check. */
		errors?: string[] | null;
	} = $props();

	const id = $props.id();
	let checking = $state(false);
	let problem = $state<string | null>(null);

	/** Why an applied code takes nothing off these lines, worked out as the server will. */
	const outcome = $derived(rule ? applyDiscount(rule, lines) : null);
	const error = $derived(
		problem ??
			(outcome && !outcome.ok
				? outcome.reason === 'min'
					? m.site_discount_err_min({ amount: money(outcome.min) })
					: m.site_discount_err_not_applicable()
				: null) ??
			errors?.[0] ??
			null
	);

	const text = {
		get: () => value ?? '',
		set: (v: string) => {
			value = v;
			if (rule && v.trim().toUpperCase() !== rule.code) rule = null;
			problem = null;
		}
	};

	async function apply() {
		const code = (value ?? '').trim();
		if (!code) return;
		checking = true;
		problem = null;
		try {
			const res = await fetch(
				`${siteHref('/discount', getLocale())}?code=${encodeURIComponent(code)}`
			);
			const body = (await res.json()) as { ok: true; rule: Applied } | { ok: false; error: string };
			if (body.ok) {
				rule = body.rule;
				value = body.rule.code;
			} else {
				rule = null;
				problem = body.error;
			}
		} catch {
			// Offline or the server is down: the code is still sent with the order and checked there.
			problem = null;
		} finally {
			checking = false;
		}
	}
</script>

<div class="field discount" data-invalid={error ? '' : undefined}>
	<!-- The site's field label style is on `.field > span`. -->
	<span><label for={id}>{m.site_discount_label()}</label></span>
	<div class="row">
		<Input
			{id}
			name="discountCode"
			autocomplete="off"
			autocapitalize="characters"
			spellcheck="false"
			bind:value={text.get, text.set}
			aria-invalid={error ? 'true' : undefined}
			aria-describedby={error || outcome?.ok ? `${id}-note` : undefined}
			onkeydown={(e) => {
				// Enter applies the code instead of placing the order.
				if (e.key === 'Enter') {
					e.preventDefault();
					void apply();
				}
			}}
		/>
		{#if rule}
			<button
				type="button"
				class="btn ghost"
				onclick={() => {
					rule = null;
					value = '';
				}}
			>
				{m.site_discount_remove()}
			</button>
		{:else}
			<button
				type="button"
				class="btn ghost"
				disabled={checking || !(value ?? '').trim()}
				onclick={apply}
			>
				{m.site_discount_apply()}
			</button>
		{/if}
	</div>
	{#if error}
		<p class="error" id="{id}-note" role="alert">{error}</p>
	{:else if rule && outcome?.ok}
		<p class="ok" id="{id}-note" role="status">
			{m.site_discount_applied({ code: rule.code, amount: money(outcome.amount) })}
		</p>
	{/if}
</div>

<style>
	.row {
		display: flex;
		gap: 8px;
	}
	.row :global(input) {
		flex: 1;
		min-width: 0;
		text-transform: uppercase;
	}
	.ok {
		margin: 0;
		font-size: 14px;
		color: var(--ok, inherit);
	}
</style>
