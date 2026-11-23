/**
 * The website's editable content (brief modules 03, 09, 10): CMS pages and posts, the AI agent's
 * knowledge base and conversations, and the 360° tour's scenes and hotspots (questionnaire 10).
 *
 * Page bodies are block lists per language (JSON), so a new block type (a video, an origins map)
 * is front-end code, never a migration.
 */
import { relations, sql } from 'drizzle-orm';
import {
	boolean,
	datetime,
	decimal,
	index,
	int,
	json,
	mysqlTable,
	smallint,
	text,
	varchar,
	type AnyMySqlColumn
} from 'drizzle-orm/mysql-core';
import { bigId, file, id, lesserFields, localized, secureFields, status, userRef } from './fields';
import { location } from './system.schema';
import { customer } from './customers.schema';
import { product } from './catalog.schema';
import { lot, station } from './origins.schema';
import { bookable } from './bookings.schema';
import { event } from './visits.schema';
import { AI_CHANNELS, HOTSPOT_KINDS, PUBLISH_STATUSES } from '../../constants';

/** A page body: `{ en: Block[], am: Block[], … }`, each block `{ type, ...props }`. */
export type Block = { type: string; [prop: string]: unknown };
export type LocalizedBlocks = Record<string, Block[]>;

export const page = mysqlTable(
	'page',
	{
		id: id(),
		slug: varchar('slug', { length: 120 }).notNull().unique(),
		parentId: int('parent_id').references((): AnyMySqlColumn => page.id, {
			onDelete: 'set null'
		}),
		/** Which Svelte layout renders it: default, history, origins, health… */
		template: varchar('template', { length: 32 }).notNull().default('default'),
		title: localized('title').notNull(),
		body: json('body').$type<LocalizedBlocks>(),
		heroImage: file('hero_image'),
		seoTitle: localized('seo_title'),
		seoDescription: localized('seo_description'),
		showInMenu: boolean('show_in_menu').default(false).notNull(),
		sortOrder: smallint('sort_order').default(0).notNull(),
		publishStatus: status('publish_status', PUBLISH_STATUSES).notNull().default('draft'),
		publishedAt: datetime('published_at'),
		...secureFields
	},
	(table) => [index('page_parent_idx').on(table.parentId, table.sortOrder)]
);

export const postCategory = mysqlTable('post_category', {
	id: id(),
	slug: varchar('slug', { length: 64 }).notNull().unique(),
	name: localized('name').notNull(),
	...lesserFields
});

export const post = mysqlTable(
	'post',
	{
		id: id(),
		slug: varchar('slug', { length: 150 }).notNull().unique(),
		categoryId: int('category_id').references(() => postCategory.id, { onDelete: 'set null' }),
		title: localized('title').notNull(),
		excerpt: localized('excerpt'),
		body: json('body').$type<LocalizedBlocks>(),
		coverImage: file('cover_image'),
		authorId: userRef('author_id'),
		seoTitle: localized('seo_title'),
		seoDescription: localized('seo_description'),
		publishStatus: status('publish_status', PUBLISH_STATUSES).notNull().default('draft'),
		publishedAt: datetime('published_at'),
		...secureFields
	},
	(table) => [index('post_published_idx').on(table.publishStatus, table.publishedAt)]
);

/**
 * The AI agent's knowledge base (brief 09): FAQs, hours, policies — written in both languages.
 * Live facts (stock, prices, order status) are read from their own tables at answer time (Phase 2),
 * not copied here. `embeddingUpdatedAt` tells the indexer what to re-embed.
 */
export const knowledgeEntry = mysqlTable(
	'knowledge_entry',
	{
		id: id(),
		topic: varchar('topic', { length: 64 }).notNull(),
		question: localized('question').notNull(),
		answer: localized('answer').notNull(),
		tags: json('tags').$type<string[]>(),
		/** Also shown on the public FAQ page. */
		isPublicFaq: boolean('is_public_faq').default(false).notNull(),
		sortOrder: smallint('sort_order').default(0).notNull(),
		embeddingUpdatedAt: datetime('embedding_updated_at'),
		...secureFields
	},
	(table) => [index('knowledge_entry_topic_idx').on(table.topic)]
);

/** One chat, on the website or Telegram. */
export const aiConversation = mysqlTable(
	'ai_conversation',
	{
		id: id(),
		channel: status('channel', AI_CHANNELS).notNull(),
		/** The browser session or Telegram chat id. */
		externalId: varchar('external_id', { length: 64 }).notNull(),
		customerId: int('customer_id').references(() => customer.id, { onDelete: 'set null' }),
		locale: varchar('locale', { length: 8 }).notNull().default('am'),
		/** Staff took over from the bot. */
		handedOffTo: userRef('handed_off_to'),
		startedAt: datetime('started_at')
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`),
		lastMessageAt: datetime('last_message_at')
	},
	(table) => [
		index('ai_conversation_external_idx').on(table.channel, table.externalId),
		index('ai_conversation_customer_idx').on(table.customerId)
	]
);

export const aiMessage = mysqlTable(
	'ai_message',
	{
		id: bigId(),
		conversationId: int('conversation_id')
			.notNull()
			.references(() => aiConversation.id, { onDelete: 'cascade' }),
		/** user, assistant, tool, staff */
		role: varchar('role', { length: 16 }).notNull(),
		content: text('content').notNull(),
		toolCalls: json('tool_calls'),
		model: varchar('model', { length: 64 }),
		inputTokens: int('input_tokens'),
		outputTokens: int('output_tokens'),
		/** A visitor's thumbs up / down. */
		rating: smallint('rating'),
		createdAt: datetime('created_at')
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`)
	},
	(table) => [index('ai_message_conversation_idx').on(table.conversationId, table.id)]
);

/** One panorama of the 360° tour, at Site A or Site B. */
export const tourScene = mysqlTable(
	'tour_scene',
	{
		id: id(),
		slug: varchar('slug', { length: 64 }).notNull().unique(),
		locationId: int('location_id')
			.notNull()
			.references(() => location.id, { onDelete: 'restrict' }),
		title: localized('title').notNull(),
		description: localized('description'),
		panorama: file('panorama').notNull(),
		/** A small version shown while the full one loads. */
		preview: file('preview'),
		initialYaw: decimal('initial_yaw', { precision: 7, scale: 3, mode: 'number' }),
		initialPitch: decimal('initial_pitch', { precision: 7, scale: 3, mode: 'number' }),
		isStart: boolean('is_start').default(false).notNull(),
		sortOrder: smallint('sort_order').default(0).notNull(),
		...secureFields
	},
	(table) => [index('tour_scene_location_idx').on(table.locationId, table.sortOrder)]
);

/**
 * A clickable point in a scene (10.1). Its target is set in the CMS — a product, a lot, a station,
 * a bookable, an event, another scene or a link — so staff re-point hotspots without rebuilding the
 * tour.
 */
export const tourHotspot = mysqlTable(
	'tour_hotspot',
	{
		id: id(),
		sceneId: int('scene_id')
			.notNull()
			.references(() => tourScene.id, { onDelete: 'cascade' }),
		kind: status('kind', HOTSPOT_KINDS).notNull(),
		yaw: decimal('yaw', { precision: 7, scale: 3, mode: 'number' }).notNull(),
		pitch: decimal('pitch', { precision: 7, scale: 3, mode: 'number' }).notNull(),
		title: localized('title').notNull(),
		body: localized('body'),
		media: file('media'),
		videoUrl: varchar('video_url', { length: 255 }),
		productId: int('product_id').references(() => product.id, { onDelete: 'set null' }),
		lotId: int('lot_id').references(() => lot.id, { onDelete: 'set null' }),
		stationId: int('station_id').references(() => station.id, { onDelete: 'set null' }),
		bookableId: int('bookable_id').references(() => bookable.id, { onDelete: 'set null' }),
		eventId: int('event_id').references(() => event.id, { onDelete: 'set null' }),
		targetSceneId: int('target_scene_id').references((): AnyMySqlColumn => tourScene.id, {
			onDelete: 'set null'
		}),
		url: varchar('url', { length: 255 }),
		sortOrder: smallint('sort_order').default(0).notNull(),
		...secureFields
	},
	(table) => [index('tour_hotspot_scene_idx').on(table.sceneId)]
);

export const postRelations = relations(post, ({ one }) => ({
	category: one(postCategory, { fields: [post.categoryId], references: [postCategory.id] })
}));

export const aiConversationRelations = relations(aiConversation, ({ one, many }) => ({
	customer: one(customer, { fields: [aiConversation.customerId], references: [customer.id] }),
	messages: many(aiMessage)
}));

export const aiMessageRelations = relations(aiMessage, ({ one }) => ({
	conversation: one(aiConversation, {
		fields: [aiMessage.conversationId],
		references: [aiConversation.id]
	})
}));

export const tourSceneRelations = relations(tourScene, ({ one, many }) => ({
	location: one(location, { fields: [tourScene.locationId], references: [location.id] }),
	hotspots: many(tourHotspot)
}));

export const tourHotspotRelations = relations(tourHotspot, ({ one }) => ({
	scene: one(tourScene, { fields: [tourHotspot.sceneId], references: [tourScene.id] })
}));
