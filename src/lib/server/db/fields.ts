/**
 * The column sets every table is built from, bound to this app's `user` table through the kit's
 * `fieldMixins`, and the typed columns money, coffee weights and translated text are kept in.
 */
import {
	char,
	decimal,
	int,
	json,
	varchar,
	bigint,
	type AnyMySqlColumn
} from 'drizzle-orm/mysql-core';
import { fieldMixins } from '@nahu/admin-kit/server/schema';
import { user } from './auth.schema';

/** The kit's column sets, bound to this app's `user` table. See `fieldMixins`. */
export const { deletionFields, secureFields, lesserFields, approvalFields } = fieldMixins(
	() => user.id
);

/**
 * Text shown to customers, one entry per language code: `{ en: 'Washed Limu', am: '…', om: '…',
 * ar: '…' }`. A JSON column rather than `name_en`/`name_am`, so a new language is a row in
 * `language` and an entry in `#lib/languages`, not a migration. Required languages are enforced by the forms, not the column.
 */
export type Localized = Record<string, string>;
export const localized = (name: string) => json(name).$type<Localized>();

/**
 * Room for fields nobody asked for yet — a lot's moisture reading, a product's tasting wheel —
 * without a migration. Anything queried or joined on gets promoted to a real column.
 */
export const extra = () => json('extra').$type<Record<string, unknown>>();

/** Birr, to the cent. Read and written as a JS number; never a float column. */
export const money = (name: string) =>
	decimal(name, { precision: 14, scale: 2, mode: 'number' }).notNull().default(0);

/** ISO 4217. Every price and document carries one, so multi-currency (2.5) needs no migration. */
export const currency = () => char('currency', { length: 3 }).notNull().default('ETB');

/** Kilograms of coffee, to the gram. */
export const kg = (name: string) =>
	decimal(name, { precision: 12, scale: 3, mode: 'number' }).notNull().default(0);

/** A weight that may be left blank, e.g. a low-stock level that falls back to a setting. */
export const kgOrNull = (name: string) =>
	decimal(name, { precision: 12, scale: 3, mode: 'number' });

/** A rate in percent: 15.00 for VAT, 10.00 for a member discount. */
export const percent = (name: string) =>
	decimal(name, { precision: 5, scale: 2, mode: 'number' }).notNull().default(0);

/** A staff or customer sign-in, matching `user.id`. */
export const userRef = (name: string) =>
	varchar(name, { length: 255 }).references((): AnyMySqlColumn => user.id, {
		onDelete: 'set null'
	});

/** Ids for append-only, high-volume tables (scans, movements, messages). */
export const bigId = () =>
	bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey();

/** The usual surrogate key. */
export const id = () => int('id').autoincrement().primaryKey();

/** A short status / kind column typed by one of the lists in `#lib/constants`. */
export const status = <T extends readonly [string, ...string[]]>(name: string, values: T) =>
	varchar(name, { length: 24, enum: values as unknown as [T[number], ...T[number][]] });

/** A file name as the kit's `saveUploadedFile` returns it; served by `fileUrl(name)`. */
export const file = (name: string) => varchar(name, { length: 255 });
