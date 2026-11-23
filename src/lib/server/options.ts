/**
 * Picker options (`{ value, name }[]`) for every table other tables point at — one query each, so
 * every form offers the same list in the same order. Deleted rows are never offered; switched-off
 * ones are left out unless `all` is asked for (an edit form showing a row's current choice).
 */
import { and, asc, eq, isNull, sql, type SQL } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import * as s from '#lib/server/db/schema.ts';
import { enOf } from '#lib/server/localized.ts';

type Option = { value: number; name: string };
const when = (...c: (SQL | undefined)[]) => and(...c.filter(Boolean));

export const locationOptions = (filter?: SQL): Promise<Option[]> =>
	db
		.select({ value: s.location.id, name: enOf(s.location.name) })
		.from(s.location)
		.where(when(isNull(s.location.deletedAt), filter))
		.orderBy(asc(s.location.sortOrder));

export const stockLocationOptions = () => locationOptions(eq(s.location.holdsStock, true));

export const regionOptions = (): Promise<Option[]> =>
	db
		.select({
			value: s.region.id,
			name: sql<string>`concat(${enOf(s.region.name)}, ' (', ${s.region.level}, ')')`
		})
		.from(s.region)
		.where(isNull(s.region.deletedAt))
		.orderBy(asc(enOf(s.region.name)));

export const stationOptions = (): Promise<Option[]> =>
	db
		.select({
			value: s.station.id,
			name: sql<string>`concat(${s.station.code}, ' — ', ${enOf(s.station.name)})`
		})
		.from(s.station)
		.where(isNull(s.station.deletedAt))
		.orderBy(asc(s.station.code));

export const lotOptions = (): Promise<Option[]> =>
	db
		.select({ value: s.lot.id, name: s.lot.code })
		.from(s.lot)
		.where(isNull(s.lot.deletedAt))
		.orderBy(asc(s.lot.code));

export const varietyOptions = (): Promise<Option[]> =>
	db
		.select({ value: s.variety.id, name: s.variety.name })
		.from(s.variety)
		.where(isNull(s.variety.deletedAt))
		.orderBy(asc(s.variety.name));

export const certificationOptions = (): Promise<Option[]> =>
	db
		.select({ value: s.certification.id, name: enOf(s.certification.name) })
		.from(s.certification)
		.where(isNull(s.certification.deletedAt))
		.orderBy(asc(s.certification.code));

export const categoryOptions = (): Promise<Option[]> =>
	db
		.select({ value: s.productCategory.id, name: enOf(s.productCategory.name) })
		.from(s.productCategory)
		.where(isNull(s.productCategory.deletedAt))
		.orderBy(asc(s.productCategory.sortOrder));

export const productOptions = (): Promise<Option[]> =>
	db
		.select({ value: s.product.id, name: enOf(s.product.name) })
		.from(s.product)
		.where(isNull(s.product.deletedAt))
		.orderBy(asc(s.product.sortOrder));

/** "Washed Limu Grade 1 — 500 g (SKU)". */
export const variantOptions = (): Promise<Option[]> =>
	db
		.select({
			value: s.productVariant.id,
			name: sql<string>`concat(${enOf(s.product.name)}, ' — ', coalesce(${enOf(s.bagSize.name)}, ${enOf(s.productVariant.name)}, ''), ' (', ${s.productVariant.sku}, ')')`
		})
		.from(s.productVariant)
		.innerJoin(s.product, eq(s.productVariant.productId, s.product.id))
		.leftJoin(s.bagSize, eq(s.productVariant.bagSizeId, s.bagSize.id))
		.where(and(isNull(s.productVariant.deletedAt), isNull(s.product.deletedAt)))
		.orderBy(asc(s.product.sortOrder), asc(s.productVariant.sortOrder));

export const bagSizeOptions = (): Promise<Option[]> =>
	db
		.select({ value: s.bagSize.id, name: enOf(s.bagSize.name) })
		.from(s.bagSize)
		.where(isNull(s.bagSize.deletedAt))
		.orderBy(asc(s.bagSize.sortOrder));

export const roastLevelOptions = (): Promise<Option[]> =>
	db
		.select({ value: s.roastLevel.id, name: enOf(s.roastLevel.name) })
		.from(s.roastLevel)
		.where(isNull(s.roastLevel.deletedAt))
		.orderBy(asc(s.roastLevel.sortOrder));

export const grindOptions = (): Promise<Option[]> =>
	db
		.select({ value: s.grind.id, name: enOf(s.grind.name) })
		.from(s.grind)
		.where(isNull(s.grind.deletedAt))
		.orderBy(asc(s.grind.sortOrder));

export const packagingOptions = (): Promise<Option[]> =>
	db
		.select({ value: s.packaging.id, name: enOf(s.packaging.name) })
		.from(s.packaging)
		.where(isNull(s.packaging.deletedAt))
		.orderBy(asc(s.packaging.sortOrder));

export const taxRateOptions = (): Promise<Option[]> =>
	db
		.select({ value: s.taxRate.id, name: enOf(s.taxRate.name) })
		.from(s.taxRate)
		.where(isNull(s.taxRate.deletedAt));

export const audienceOptions = (): Promise<Option[]> =>
	db
		.select({ value: s.audience.id, name: enOf(s.audience.name) })
		.from(s.audience)
		.where(isNull(s.audience.deletedAt))
		.orderBy(asc(s.audience.sortOrder));

export const roastMachineOptions = (): Promise<Option[]> =>
	db
		.select({ value: s.roastMachine.id, name: s.roastMachine.name })
		.from(s.roastMachine)
		.where(isNull(s.roastMachine.deletedAt));

/** "Abebe Girma · +2519…" */
export const customerOptions = (): Promise<Option[]> =>
	db
		.select({
			value: s.customer.id,
			name: sql<string>`concat(coalesce(${s.customer.name}, 'Guest'), ' · ', coalesce(${s.customer.phone}, ${s.customer.email}, ''))`
		})
		.from(s.customer)
		.where(and(isNull(s.customer.deletedAt), isNull(s.customer.anonymizedAt)))
		.orderBy(asc(s.customer.name));

export const deliveryZoneOptions = (): Promise<Option[]> =>
	db
		.select({ value: s.deliveryZone.id, name: enOf(s.deliveryZone.name) })
		.from(s.deliveryZone)
		.where(isNull(s.deliveryZone.deletedAt))
		.orderBy(asc(s.deliveryZone.sortOrder));

export const deliveryAreaOptions = (): Promise<Option[]> =>
	db
		.select({ value: s.deliveryArea.id, name: enOf(s.deliveryArea.name) })
		.from(s.deliveryArea)
		.where(isNull(s.deliveryArea.deletedAt))
		.orderBy(asc(s.deliveryArea.sortOrder));

export const courierOptions = (): Promise<Option[]> =>
	db
		.select({ value: s.courier.id, name: s.courier.name })
		.from(s.courier)
		.where(isNull(s.courier.deletedAt));

export const roleOptions = (): Promise<Option[]> =>
	db
		.select({ value: s.roles.id, name: s.roles.name })
		.from(s.roles)
		.where(isNull(s.roles.deletedAt))
		.orderBy(asc(s.roles.name));

export const ticketTypeOptions = (): Promise<Option[]> =>
	db
		.select({ value: s.ticketType.id, name: enOf(s.ticketType.name) })
		.from(s.ticketType)
		.where(isNull(s.ticketType.deletedAt))
		.orderBy(asc(s.ticketType.sortOrder));

export const eventOptions = (): Promise<Option[]> =>
	db
		.select({ value: s.event.id, name: enOf(s.event.title) })
		.from(s.event)
		.where(isNull(s.event.deletedAt))
		.orderBy(asc(s.event.startsAt));

export const bookableOptions = (): Promise<Option[]> =>
	db
		.select({ value: s.bookable.id, name: enOf(s.bookable.name) })
		.from(s.bookable)
		.where(isNull(s.bookable.deletedAt))
		.orderBy(asc(s.bookable.sortOrder));

export const membershipPlanOptions = (): Promise<Option[]> =>
	db
		.select({ value: s.membershipPlan.id, name: enOf(s.membershipPlan.name) })
		.from(s.membershipPlan)
		.where(isNull(s.membershipPlan.deletedAt))
		.orderBy(asc(s.membershipPlan.sortOrder));

export const subscriptionPlanOptions = (): Promise<Option[]> =>
	db
		.select({ value: s.subscriptionPlan.id, name: enOf(s.subscriptionPlan.name) })
		.from(s.subscriptionPlan)
		.where(isNull(s.subscriptionPlan.deletedAt))
		.orderBy(asc(s.subscriptionPlan.sortOrder));

export const postCategoryOptions = (): Promise<Option[]> =>
	db
		.select({ value: s.postCategory.id, name: enOf(s.postCategory.name) })
		.from(s.postCategory)
		.where(isNull(s.postCategory.deletedAt));

export const sceneOptions = (): Promise<Option[]> =>
	db
		.select({ value: s.tourScene.id, name: enOf(s.tourScene.title) })
		.from(s.tourScene)
		.where(isNull(s.tourScene.deletedAt))
		.orderBy(asc(s.tourScene.sortOrder));
