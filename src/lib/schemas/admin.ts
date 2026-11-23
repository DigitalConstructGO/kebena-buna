/**
 * The forms of the Admin screens — users, roles, locations, settings and the reference lists.
 * Client-safe, so each dialog validates with the same schema its action does.
 */
import { z } from 'zod/v4';
import { CONTACT_CHANNELS, LOCATION_TYPES } from '#lib/constants.ts';
import { LANGS } from '#lib/languages.ts';
import {
	amText,
	bool,
	boolTrue,
	code,
	enText,
	isoDate,
	optionalId,
	optionalNumber,
	optionalText,
	optionalTime,
	percentField,
	requiredId,
	requiredText,
	sortOrder
} from '#lib/schemas/common.ts';

const personName = z.string().trim().min(2, 'Enter their full name').max(100);
const password = z.string().min(10, 'At least 10 characters').max(128);

// ── Users ────────────────────────────────────────────────────────────────────────────────────

export const addUserSchema = z.object({
	name: personName,
	email: z.email('Enter a valid email address'),
	phone: optionalText(20),
	roleId: requiredId('Choose a role'),
	password
});

export const editUserSchema = z.object({
	name: personName,
	phone: optionalText(20),
	roleId: optionalId,
	locale: z.enum(LANGS).default('am'),
	isActive: boolTrue
});

export const resetPasswordSchema = z.object({ password });

export const changePasswordSchema = z
	.object({
		currentPassword: z.string().min(1, 'Enter your current password'),
		newPassword: password,
		confirm: z.string()
	})
	.refine((v) => v.newPassword === v.confirm, {
		path: ['confirm'],
		message: 'The passwords differ'
	});

export const accountSchema = z.object({ name: personName });

// ── Roles ────────────────────────────────────────────────────────────────────────────────────

export const roleSchema = z.object({
	name: requiredText(32, 'Name the role'),
	description: optionalText(255),
	status: boolTrue
});

export const permissionsSchema = z.object({
	permissionIds: z.array(z.coerce.number().int()).default([])
});

/** Permissions grouped by the part of the app they open, from their `area.verb` names. */
const AREAS: Record<string, string> = {
	reports: 'Reports',
	catalog: 'Catalogue',
	origins: 'Origins',
	stock: 'Stock & roasting',
	orders: 'Sales',
	refunds: 'Sales',
	discounts: 'Sales',
	customers: 'Customers',
	delivery: 'Customers',
	wholesale: 'Wholesale',
	visits: 'Visits & events',
	events: 'Visits & events',
	memberships: 'Members',
	bookings: 'Bookings & inbox',
	inbox: 'Bookings & inbox',
	content: 'Website',
	ai: 'Website',
	settings: 'Admin',
	messages: 'Admin',
	users: 'Admin',
	audit: 'Admin'
};

export function groupByArea<T extends { name: string }>(permissions: T[]) {
	const groups = new Map<string, T[]>();
	for (const p of permissions) {
		const area = AREAS[p.name.split('.')[0]] ?? 'Other';
		groups.set(area, [...(groups.get(area) ?? []), p]);
	}
	return [...groups].map(([area, items]) => ({ area, items }));
}

// ── Locations ────────────────────────────────────────────────────────────────────────────────

export const locationSchema = z.object({
	code: code(20),
	nameEn: enText(120),
	nameAm: amText(120),
	nameOm: amText(120),
	nameAr: amText(120),
	nameIt: amText(120),
	nameFr: amText(120),
	type: z.enum(LOCATION_TYPES),
	parentId: optionalId,
	address: optionalText(255),
	phone: optionalText(20),
	latitude: optionalNumber,
	longitude: optionalNumber,
	holdsStock: bool,
	sellsAtDesk: bool,
	fulfilsOnline: bool,
	isPickupPoint: bool,
	controlsCapacity: bool,
	admitsVisitors: bool,
	sortOrder,
	isActive: boolTrue
});

type Clock = string | null | undefined;
/** `a` is earlier than `b` (`orSame`: or the same minute), or one of them is left empty. */
const inOrder = (a: Clock, b: Clock, orSame = false) =>
	!a || !b || (orSame ? a.slice(0, 5) <= b.slice(0, 5) : a.slice(0, 5) < b.slice(0, 5));

/** An open day's times in order: opening before closing, the last entry between the two. */
export const hoursSchema = z.object({
	days: z
		.array(
			z
				.object({
					weekday: z.coerce.number().int().min(1).max(7),
					isClosed: z.boolean().default(false),
					opensAt: optionalTime,
					closesAt: optionalTime,
					lastEntryAt: optionalTime
				})
				.refine((d) => d.isClosed || inOrder(d.opensAt, d.closesAt), {
					path: ['closesAt'],
					message: 'Closes after it opens'
				})
				.refine(
					(d) =>
						d.isClosed ||
						(inOrder(d.opensAt, d.lastEntryAt, true) && inOrder(d.lastEntryAt, d.closesAt, true)),
					{ path: ['lastEntryAt'], message: 'Last entry falls between opening and closing' }
				)
		)
		.length(7)
});

// ── Reference lists ──────────────────────────────────────────────────────────────────────────

const calendarFields = z.object({
	date: isoDate,
	locationId: optionalId,
	nameEn: enText(120),
	nameAm: amText(120),
	nameOm: amText(120),
	nameAr: amText(120),
	nameIt: amText(120),
	nameFr: amText(120),
	isHoliday: bool,
	isClosed: boolTrue,
	opensAt: optionalTime,
	closesAt: optionalTime,
	blocksRoasting: bool,
	status: boolTrue
});
/** Special hours run forwards; a closed day's times are dropped on save. */
const specialHoursInOrder = (v: z.infer<typeof calendarFields>) =>
	v.isClosed || inOrder(v.opensAt, v.closesAt);
const specialHoursMessage = { path: ['closesAt'], message: 'Closes after it opens' };
export const calendarSchema = calendarFields.refine(specialHoursInOrder, specialHoursMessage);
export const calendarEditSchema = calendarFields
	.extend({ id: z.coerce.number() })
	.refine(specialHoursInOrder, specialHoursMessage);

export const taxSchema = z.object({
	code: code(20),
	nameEn: enText(60),
	nameAm: amText(60),
	nameOm: amText(60),
	nameAr: amText(60),
	nameIt: amText(60),
	nameFr: amText(60),
	rate: percentField,
	isInclusive: boolTrue,
	isDefault: bool,
	status: boolTrue
});
export const taxEditSchema = taxSchema.extend({ id: z.coerce.number() });

export const audienceSchema = z.object({
	code: code(20),
	nameEn: enText(80),
	nameAm: amText(80),
	nameOm: amText(80),
	nameAr: amText(80),
	nameIt: amText(80),
	nameFr: amText(80),
	colour: z.preprocess(
		(v) => (typeof v === 'string' && v.trim() === '' ? null : v),
		z
			.string()
			.trim()
			.regex(/^#[0-9a-fA-F]{6}$/, 'A colour like #16a34a')
			.nullable()
			.optional()
	),
	requiresIdCheck: bool,
	declarationEn: optionalText(255),
	declarationAm: amText(255),
	declarationOm: amText(255),
	declarationAr: amText(255),
	declarationIt: amText(255),
	declarationFr: amText(255),
	isDefault: bool,
	sortOrder,
	status: boolTrue
});
export const audienceEditSchema = audienceSchema.extend({ id: z.coerce.number() });

export const languageSchema = z.object({
	code: z
		.string()
		.trim()
		.min(2)
		.max(8)
		.transform((v) => v.toLowerCase()),
	name: requiredText(50),
	nativeName: requiredText(50),
	isRequired: boolTrue,
	isDefault: bool,
	sortOrder,
	status: boolTrue
});
/** Languages are keyed by code; the kit's crud posts `id`, which is the code here. */
export const languageEditSchema = languageSchema.extend({ id: z.string() });

export const settingSchema = z.object({
	key: z
		.string()
		.trim()
		.min(1)
		.max(100)
		.regex(/^[a-z0-9_.]+$/, 'Lowercase words joined by dots, like stock.green_low_kg'),
	value: z.string().refine((v) => {
		try {
			JSON.parse(v);
			return true;
		} catch {
			return false;
		}
	}, 'Must be valid JSON: a number (60), text in quotes ("abc"), a list ([2, 5]) or an object'),
	description: optionalText(255)
});

export const templateSchema = z.object({
	key: requiredText(64).regex(/^[a-z0-9_.]+$/, 'Lowercase words joined by dots, like order.paid'),
	channel: z.enum(CONTACT_CHANNELS),
	locale: z.enum(LANGS),
	subject: optionalText(255),
	body: requiredText(5000),
	status: boolTrue
});
export const templateEditSchema = templateSchema.extend({ id: z.coerce.number() });
