<script lang="ts">
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import * as Card from '@nahu/admin-kit/components/ui/card/index.js';
	import { useKit } from '@nahu/admin-kit/context';
	import { SETUP } from '#lib/navigation.ts';

	const kit = useKit();
	const D = '/dashboard';

	/** What each card is for, in the order the cards appear. */
	const CARDS = [
		{ title: 'People and access', description: 'Who may sign in, and what each role may do.' },
		{ title: 'Places and calendar', description: 'Where the business operates, and when.' },
		{
			title: 'Catalogue',
			description: 'The options products, lots and roasts are described with.'
		},
		{ title: 'Selling', description: 'The rates, plans and delivery prices are built from.' },
		{ title: 'Visits and bookings', description: 'Tickets, entry times and what can be booked.' },
		{
			title: 'System',
			description: 'Numbers and wording the business can change without a release.'
		}
	];

	/** Every setup screen, grouped; each card shows only the screens the viewer may open. */
	const SCREENS = [
		{
			title: 'Staff & users',
			url: `${D}/admin/users`,
			section: 'People and access',
			hint: 'Accounts, roles, passwords, sessions'
		},
		{
			title: 'Roles',
			url: `${D}/admin/roles`,
			section: 'People and access',
			hint: 'Permissions per role'
		},
		{
			title: 'Audit log',
			url: `${D}/admin/audit-log`,
			section: 'People and access',
			hint: 'Who changed what, and when'
		},
		{
			title: 'Settings',
			url: `${D}/admin/settings`,
			section: 'System',
			hint: 'Thresholds, roast days, receipt TIN'
		},
		{
			title: 'Outbox',
			url: `${D}/admin/messages`,
			section: 'System',
			hint: 'Messages queued, sent, failed'
		},
		...SETUP
	];

	const SECTIONS = CARDS.map((card) => ({
		...card,
		items: SCREENS.filter((screen) => screen.section === card.title)
	}));

	const sections = $derived(
		SECTIONS.map((s) => ({ ...s, items: s.items.filter((i) => kit.canOpen(i.url)) })).filter(
			(s) => s.items.length
		)
	);
</script>

<PageHeader
	title="Setup"
	description="The lists and settings the rest of the system is built on. Each is also found by search (Ctrl K)."
/>

<div class="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
	{#each sections as section (section.title)}
		<Card.Root>
			<Card.Header>
				<Card.Title>{section.title}</Card.Title>
				<Card.Description>{section.description}</Card.Description>
			</Card.Header>
			<Card.Content class="grid grid-cols-1 gap-1">
				{#each section.items as item (item.url)}
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the setup list's own paths, from #lib/navigation -->
					<a href={item.url} class="flex flex-col rounded-md px-3 py-2 hover:bg-accent">
						<span class="font-medium">{item.title}</span>
						<span class="text-sm text-muted-foreground">{item.hint}</span>
					</a>
				{/each}
			</Card.Content>
		</Card.Root>
	{/each}
</div>
