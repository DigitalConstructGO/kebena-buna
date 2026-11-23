/** The Website section's forms: pages, posts, the knowledge base, media and the virtual tour. */
import { z } from 'zod/v4';
import { HOTSPOT_KINDS, PUBLISH_STATUSES } from '#lib/constants.ts';
import {
	amText,
	boolTrue,
	bool,
	enText,
	optionalId,
	optionalNumber,
	optionalText,
	optionalUserId,
	requiredId,
	slug,
	sortOrder
} from '#lib/schemas/common.ts';

export const PAGE_TEMPLATES = [
	'default',
	'history',
	'origins',
	'health',
	'visit',
	'contact'
] as const;

/** An address no longer than its column holds (a deleted row's gets `~id` within that length). */
const slugOf = (max: number) => slug.max(max, `At most ${max} characters`);

/**
 * A link the public site may put in an `href`: an `http(s)://` address or a path on this site
 * (`/visit`). Anything else — `javascript:`, `data:`, `//elsewhere`, `/\elsewhere` — is refused.
 */
const linkUrl = (max = 255) =>
	z.preprocess(
		(v) => (typeof v === 'string' && v.trim() === '' ? null : v),
		z
			.string()
			.trim()
			.max(max)
			.refine((v) => /^https?:\/\/[^\s/]+\S*$/i.test(v) || /^\/(?![/\\])[^\s\\]*$/.test(v), {
				message: 'Use a full https:// address or a path starting with /'
			})
			.nullable()
			.optional()
	);

/** A rich body as the editor posts it: HTML, sanitised on the server. */
const body = z.string().max(200_000).default('');

/** What a page and a post share: address, title, SEO and the two rich bodies. */
const docFields = {
	slug: slugOf(150),
	titleEn: enText(200),
	titleAm: amText(200),
	titleOm: amText(200),
	titleAr: amText(200),
	titleIt: amText(200),
	titleFr: amText(200),
	seoTitleEn: optionalText(200),
	seoTitleAm: optionalText(200),
	seoTitleOm: optionalText(200),
	seoTitleAr: optionalText(200),
	seoTitleIt: optionalText(200),
	seoTitleFr: optionalText(200),
	seoDescriptionEn: optionalText(300),
	seoDescriptionAm: optionalText(300),
	seoDescriptionOm: optionalText(300),
	seoDescriptionAr: optionalText(300),
	seoDescriptionIt: optionalText(300),
	seoDescriptionFr: optionalText(300),
	bodyEn: body,
	bodyAm: body,
	bodyOm: body,
	bodyAr: body,
	bodyIt: body,
	bodyFr: body,
	publishStatus: z.enum(PUBLISH_STATUSES).default('draft')
};

export const pageSchema = z.object({
	...docFields,
	slug: slugOf(120),
	parentId: optionalId,
	template: z.enum(PAGE_TEMPLATES).default('default'),
	heroImage: z.file().optional(),
	showInMenu: bool,
	sortOrder
});
export type PageForm = z.infer<typeof pageSchema>;

export const postSchema = z.object({
	...docFields,
	categoryId: optionalId,
	authorId: optionalUserId,
	excerptEn: optionalText(500),
	excerptAm: optionalText(500),
	excerptOm: optionalText(500),
	excerptAr: optionalText(500),
	excerptIt: optionalText(500),
	excerptFr: optionalText(500),
	coverImage: z.file().optional()
});
export type PostForm = z.infer<typeof postSchema>;

export const postCategorySchema = z.object({
	slug: slugOf(64),
	nameEn: enText(80),
	nameAm: amText(80),
	nameOm: amText(80),
	nameAr: amText(80),
	nameIt: amText(80),
	nameFr: amText(80),
	status: boolTrue
});
export const postCategoryEditSchema = postCategorySchema.extend({ id: z.coerce.number() });

/** An FAQ / knowledge-base entry. Tags are one per line. */
export const knowledgeSchema = z.object({
	topic: z.string().trim().min(1, 'Required').max(64),
	questionEn: enText(500),
	questionAm: amText(500),
	questionOm: amText(500),
	questionAr: amText(500),
	questionIt: amText(500),
	questionFr: amText(500),
	answerEn: enText(5000),
	answerAm: amText(5000),
	answerOm: amText(5000),
	answerAr: amText(5000),
	answerIt: amText(5000),
	answerFr: amText(5000),
	tags: z.string().max(1000).default(''),
	isPublicFaq: bool,
	sortOrder,
	status: boolTrue
});
export const knowledgeEditSchema = knowledgeSchema.extend({ id: z.coerce.number() });

export const mediaSchema = z.object({
	fileName: z.file('Choose a file'),
	folder: optionalText(100),
	altEn: optionalText(255),
	altAm: optionalText(255),
	altOm: optionalText(255),
	altAr: optionalText(255),
	altIt: optionalText(255),
	altFr: optionalText(255),
	captionEn: optionalText(500),
	captionAm: optionalText(500),
	captionOm: optionalText(500),
	captionAr: optionalText(500),
	captionIt: optionalText(500),
	captionFr: optionalText(500),
	status: boolTrue
});
export const mediaEditSchema = mediaSchema.extend({
	id: z.coerce.number(),
	fileName: z.file().optional()
});

export const sceneSchema = z.object({
	slug: slugOf(64),
	locationId: requiredId('Choose the site'),
	titleEn: enText(200),
	titleAm: amText(200),
	titleOm: amText(200),
	titleAr: amText(200),
	titleIt: amText(200),
	titleFr: amText(200),
	descriptionEn: optionalText(2000),
	descriptionAm: optionalText(2000),
	descriptionOm: optionalText(2000),
	descriptionAr: optionalText(2000),
	descriptionIt: optionalText(2000),
	descriptionFr: optionalText(2000),
	panorama: z.file('Choose the 360° image'),
	preview: z.file().optional(),
	initialYaw: optionalNumber,
	initialPitch: optionalNumber,
	isStart: bool,
	sortOrder,
	isActive: boolTrue
});
export const sceneEditSchema = sceneSchema.extend({
	id: z.coerce.number(),
	panorama: z.file().optional()
});

export const hotspotSchema = z.object({
	sceneId: z.coerce.number(),
	kind: z.enum(HOTSPOT_KINDS),
	yaw: z.coerce.number().min(-360).max(360),
	pitch: z.coerce.number().min(-90).max(90),
	titleEn: enText(200),
	titleAm: amText(200),
	titleOm: amText(200),
	titleAr: amText(200),
	titleIt: amText(200),
	titleFr: amText(200),
	bodyEn: optionalText(2000),
	bodyAm: optionalText(2000),
	bodyOm: optionalText(2000),
	bodyAr: optionalText(2000),
	bodyIt: optionalText(2000),
	bodyFr: optionalText(2000),
	videoUrl: linkUrl(),
	productId: optionalId,
	lotId: optionalId,
	stationId: optionalId,
	bookableId: optionalId,
	eventId: optionalId,
	targetSceneId: optionalId,
	url: linkUrl(),
	sortOrder
});
export const hotspotEditSchema = hotspotSchema.extend({ id: z.coerce.number() });
