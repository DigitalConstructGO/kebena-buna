<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Hand from '@lucide/svelte/icons/hand';
	import Bot from '@lucide/svelte/icons/bot';
	import ThumbsUp from '@lucide/svelte/icons/thumbs-up';
	import ThumbsDown from '@lucide/svelte/icons/thumbs-down';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import SingleTable from '@nahu/admin-kit/components/SingleTable.svelte';
	import ConfirmAction from '@nahu/admin-kit/components/ConfirmAction.svelte';
	import Empty from '@nahu/admin-kit/components/Empty.svelte';
	import * as Card from '@nahu/admin-kit/components/ui/card/index.js';
	import { Badge } from '@nahu/admin-kit/components/ui/badge/index.js';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { formatDateTime, humanize, languageName } from '#lib/format.ts';
	import { useLinks } from '#lib/links.ts';

	let { data } = $props();
	const c = $derived(data.conversation);
	const href = useLinks();

	/** Whose side of the chat a message sits on: the visitor's on the left, ours on the right. */
	const ours = (role: string) => role !== 'user';
	const variantOf = (role: string) =>
		role === 'user'
			? 'secondary'
			: role === 'staff'
				? 'default'
				: role === 'tool'
					? 'outline'
					: 'outline';
</script>

<PageHeader
	title="Chat #{c.id}"
	eyebrow="AI conversation"
	description="{humanize(c.channel)} · {languageName(c.locale)} · started {formatDateTime(
		c.startedAt
	)}"
>
	{#snippet actions()}
		<Button href="/dashboard/content/ai" variant="outline">
			<ArrowLeft class="size-4" /> Conversations
		</Button>
		{#if data.canManage}
			{#if c.handedOffTo}
				<ConfirmAction
					action="?/handBack"
					label="Hand back to the agent"
					icon={Bot}
					variant="outline"
					title="Hand this chat back?"
					description="The agent answers the next message."
				/>
			{:else}
				<ConfirmAction
					action="?/takeOver"
					label="Take over"
					icon={Hand}
					title="Take over this chat?"
					description="The agent stops answering; you reply from here on."
				/>
			{/if}
		{/if}
	{/snippet}
</PageHeader>

<div class="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
	<PageSection title="Chat">
		<SingleTable
			singleTable={[
				{
					name: 'Customer',
					value: data.customer ?? 'Visitor (not signed in)',
					href: href('customer', c.customerId)
				},
				{ name: 'Phone', value: data.phone ?? '—', kind: 'phone' },
				{ name: 'Session / chat id', value: c.externalId },
				{
					name: 'Handled by',
					value: data.handedOffToName ?? 'The agent',
					href: href('user', c.handedOffTo)
				},
				{ name: 'Messages', value: data.messages.length },
				{
					name: 'Tokens in / out',
					value: `${data.tokens.input.toLocaleString()} / ${data.tokens.output.toLocaleString()}`
				},
				{ name: 'Ratings', value: `${data.ratings.up} up · ${data.ratings.down} down` },
				{ name: 'Last message', value: formatDateTime(c.lastMessageAt) }
			]}
		/>
	</PageSection>
	<PageSection title="Transcript">
		{#if data.messages.length}
			<ol class="grid grid-cols-1 gap-3">
				{#each data.messages as m (m.id)}
					<li class="flex {ours(m.role) ? 'justify-end' : 'justify-start'}">
						<Card.Root
							class="max-w-[85%] {m.role === 'user'
								? 'bg-muted'
								: m.role === 'staff'
									? 'border-primary'
									: ''}"
						>
							<Card.Content class="grid grid-cols-1 gap-2 py-3">
								<div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
									<Badge variant={variantOf(m.role)}>
										{m.role === 'user' ? 'Visitor' : humanize(m.role)}
									</Badge>
									<span>{formatDateTime(m.createdAt)}</span>
									{#if m.model}<span>· {m.model}</span>{/if}
									{#if m.inputTokens || m.outputTokens}<span>
											· {m.inputTokens ?? 0} → {m.outputTokens ?? 0} tokens
										</span>{/if}
									{#if (m.rating ?? 0) > 0}<ThumbsUp class="size-3.5 text-success" />{/if}
									{#if (m.rating ?? 0) < 0}<ThumbsDown class="size-3.5 text-destructive" />{/if}
								</div>
								<p class="whitespace-pre-wrap">{m.content}</p>
								{#if m.toolCalls}
									<pre class="overflow-x-auto rounded bg-muted p-2 text-xs">{JSON.stringify(
											m.toolCalls,
											null,
											2
										)}</pre>
								{/if}
							</Card.Content>
						</Card.Root>
					</li>
				{/each}
			</ol>
		{:else}<Empty message="No messages in this chat" />{/if}
	</PageSection>
</div>
