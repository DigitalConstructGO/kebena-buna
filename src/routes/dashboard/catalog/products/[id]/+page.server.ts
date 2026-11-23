import { error, fail } from '@sveltejs/kit';
import { and, asc, desc, eq, isNull, ne, sql } from 'drizzle-orm';
import { message, setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { z } from 'zod/v4';
import { redirect } from 'sveltekit-flash-message/server';
import { hasPermission, requirePermission } from '@nahu/admin-kit/server/permissions';
import { recordAudit } from '@nahu/admin-kit/server/audit';
import { deletionStamp } from '@nahu/admin-kit/server/softDelete';
import { childActions, childCrud, WriteRefused } from '@nahu/admin-kit/server/childCrud';
import { postedForm, saveUploadedFile, UploadRefused } from '@nahu/admin-kit/server/files';
import { db } from '#lib/server/db/index.ts';
import {
	bagSize,
	grind,
	location,
	lot,
	order,
	orderLine,
	packaging as packagingCatalog,
	packedStock,
	packingRun,
	product,
	productCategory,
	productGrind,
	productImage,
	productOrigin,
	productPackaging,
	productRoastLevel,
	productVariant,
	roastBatch,
	roastLevel,
	station,
	taxRate
} from '#lib/server/db/schema.ts';
import { enOf, flatLocalized, packLocalized, toRichLocalized, unpackLocalized } from '#lib/server/localized.ts';
import { stampsOf, userAlias } from '#lib/server/people.ts';
import { idParam } from '#lib/server/records.ts';
import { deleteVariants, packedUnitsOfVariant, setProductOptions, variantsInUse } from '#lib/server/catalog.ts';
import {
	bagSizeOptions,
	categoryOptions,
	grindOptions,
	lotOptions,
	packagingOptions,
	roastLevelOptions,
	stationOptions,
	taxRateOptions
} from '#lib/server/options.ts';
import {
	productDescriptionSchema,
	productImageSchema,
	productOptionsSchema,
	productOriginSchema,
	productPhotosSchema,
	variantEditSchema,
	variantSchema
} from '#lib/schemas/catalog.ts';
import { PUBLISH_STATUSES } from '#lib/constants.ts';
import { stockLevels } from '#lib/server/stockReads.ts';

async function loadProduct(raw: string | number) {
	const id = idParam(String(raw), 'Product');
	const [row] = await db
		.select({ product, category: enOf(productCategory.name), taxRate: enOf(taxRate.name) })
		.from(product)
		.leftJoin(productCategory, eq(product.categoryId, productCategory.id))
		.leftJoin(taxRate, eq(product.taxRateId, taxRate.id))
		.where(and(eq(product.id, id), isNull(product.deletedAt)));
	if (!row) error(404, 'Product not found');
	return row;
}

const owner = async (event: { params: { id?: string } }) =>
	(await loadProduct(event.params.id ?? '')).product.id;

/** A product's sizes: price changes are audited (questionnaire 5.1). */
const variants = childCrud({
	table: productVariant,
	ownerColumn: 'productId',
	label: 'Size',
	addSchema: variantSchema,
	editSchema: variantEditSchema,
	uniqueField: 'sku',
	audit: 'product_variant',
	permission: 'catalog.manage',
	transform: async (values, _event, before) => {
		packLocalized(values, ['name']);
		const productId = Number(values.productId ?? before?.productId);
		if (values.bagSizeId) {
			const [taken] = await db
				.select({ id: productVariant.id })
				.from(productVariant)
				.where(
					and(
						eq(productVariant.productId, productId),
						eq(productVariant.bagSizeId, Number(values.bagSizeId)),
						isNull(productVariant.deletedAt),
						before ? ne(productVariant.id, Number(before.id)) : undefined
					)
				);
			if (taken) throw new WriteRefused('bagSizeId', 'This product already has that size.');
		}
		return values;
	}
});

const runner = userAlias('runner');

export const load = async ({ params, locals }) => {
	const row = await loadProduct(params.id);
	const p = row.product;
	const [
		variantSection,
		variantStock,
		roasts,
		grinds,
		packagings,
		origins,
		photos,
		stock,
		lines,
		stamps,
		options
	] = await Promise.all([
		variants.load(p.id),
		db
			.select({ id: productVariant.id, packed: packedUnitsOfVariant, bagSize: enOf(bagSize.name) })
			.from(productVariant)
			.leftJoin(bagSize, eq(productVariant.bagSizeId, bagSize.id))
			.where(eq(productVariant.productId, p.id)),
		db
			.select({ id: roastLevel.id, name: enOf(roastLevel.name), isDefault: productRoastLevel.isDefault })
			.from(productRoastLevel)
			.innerJoin(roastLevel, eq(productRoastLevel.roastLevelId, roastLevel.id))
			.where(eq(productRoastLevel.productId, p.id))
			.orderBy(asc(roastLevel.sortOrder)),
		db
			.select({ id: grind.id, name: enOf(grind.name), isDefault: productGrind.isDefault })
			.from(productGrind)
			.innerJoin(grind, eq(productGrind.grindId, grind.id))
			.where(eq(productGrind.productId, p.id))
			.orderBy(asc(grind.sortOrder)),
		db
			.select({
				id: packagingCatalog.id,
				name: enOf(packagingCatalog.name),
				isDefault: productPackaging.isDefault
			})
			.from(productPackaging)
			.innerJoin(packagingCatalog, eq(productPackaging.packagingId, packagingCatalog.id))
			.where(eq(productPackaging.productId, p.id))
			.orderBy(asc(packagingCatalog.sortOrder)),
		db
			.select({
				id: productOrigin.id,
				stationId: productOrigin.stationId,
				station: sql<string | null>`concat(${station.code}, ' — ', ${enOf(station.name)})`,
				lotId: productOrigin.lotId,
				lot: lot.code,
				sharePercent: productOrigin.sharePercent,
				sortOrder: productOrigin.sortOrder
			})
			.from(productOrigin)
			.leftJoin(station, eq(productOrigin.stationId, station.id))
			.leftJoin(lot, eq(productOrigin.lotId, lot.id))
			.where(eq(productOrigin.productId, p.id))
			.orderBy(asc(productOrigin.sortOrder)),
		db
			.select({ id: productImage.id, fileName: productImage.fileName })
			.from(productImage)
			.where(eq(productImage.productId, p.id))
			.orderBy(asc(productImage.sortOrder), asc(productImage.id)),
		db
			.select({
				variantId: productVariant.id,
				sku: productVariant.sku,
				locationId: packedStock.locationId,
				location: enOf(location.name),
				roastLevel: enOf(roastLevel.name),
				packingRunId: packingRun.id,
				packingRun: packingRun.code,
				packedAt: packingRun.packedAt,
				bestBefore: packingRun.bestBefore,
				units: packedStock.units,
				reserved: packedStock.reservedUnits
			})
			.from(packedStock)
			.innerJoin(productVariant, eq(packedStock.variantId, productVariant.id))
			.innerJoin(location, eq(packedStock.locationId, location.id))
			.innerJoin(roastLevel, eq(packedStock.roastLevelId, roastLevel.id))
			.innerJoin(packingRun, eq(packedStock.packingRunId, packingRun.id))
			.where(and(eq(productVariant.productId, p.id), sql`${packedStock.units} > 0`))
			.orderBy(asc(packingRun.packedAt)),
		db
			.select({
				orderId: order.id,
				number: order.number,
				placedAt: order.placedAt,
				status: order.status,
				variantId: productVariant.id,
				sku: productVariant.sku,
				quantity: orderLine.quantity,
				unitPrice: orderLine.unitPrice,
				lineTotal: orderLine.lineTotal
			})
			.from(orderLine)
			.innerJoin(productVariant, eq(orderLine.variantId, productVariant.id))
			.innerJoin(order, eq(orderLine.orderId, order.id))
			.where(eq(productVariant.productId, p.id))
			.orderBy(desc(order.placedAt))
			.limit(25),
		stampsOf(p),
		Promise.all([
			categoryOptions(),
			taxRateOptions(),
			roastLevelOptions(),
			grindOptions(),
			packagingOptions(),
			bagSizeOptions(),
			stationOptions(),
			lotOptions()
		])
	]);

	const batches = await db
		.select({
			id: roastBatch.id,
			code: roastBatch.code,
			roastedAt: roastBatch.roastedAt,
			roastLevel: enOf(roastLevel.name),
			greenKgIn: roastBatch.greenKgIn,
			roastedKgOut: roastBatch.roastedKgOut,
			weightLossPct: roastBatch.weightLossPct,
			roasterId: roastBatch.roasterId,
			roaster: runner.name
		})
		.from(roastBatch)
		.innerJoin(roastLevel, eq(roastBatch.roastLevelId, roastLevel.id))
		.leftJoin(runner, eq(roastBatch.roasterId, runner.id))
		.where(and(eq(roastBatch.productId, p.id), isNull(roastBatch.deletedAt)))
		.orderBy(desc(roastBatch.roastedAt))
		.limit(25);

	const packedBy = new Map(variantStock.map((v) => [v.id, v]));
	const [categories, taxRates, roastLevels, grindList, packagingList, bagSizes, stations, lots] =
		options;

	return {
		product: p,
		roastedLowDefault: (await stockLevels()).roastedLow,
		description: (p.description ?? {}) as Record<string, string>,
		category: row.category,
		taxRate: row.taxRate,
		variants: {
			...variantSection,
			rows: variantSection.rows.map((v) => ({
				...unpackLocalized(v as Record<string, unknown>, ['name']),
				id: v.id as number,
				status: (v as Record<string, unknown>).isActive,
				bagSize: packedBy.get(v.id as number)?.bagSize ?? '',
				packed: packedBy.get(v.id as number)?.packed ?? 0
			}))
		},
		roasts,
		grinds,
		packagings,
		origins,
		photos,
		stock,
		lines,
		batches,
		stamps,
		options: {
			categories,
			taxRates,
			roastLevels,
			grinds: grindList,
			packagings: packagingList,
			bagSizes,
			stations,
			lots
		},
		canManage: hasPermission(locals, 'catalog.manage'),
		descriptionForm: await superValidate(
			flatLocalized(p, ['description']),
			zod4(productDescriptionSchema),
			{ errors: false, id: 'description' }
		),
		optionsForm: await superValidate(
			{
				roastLevelIds: roasts.map((r) => r.id),
				defaultRoastLevelId: roasts.find((r) => r.isDefault)?.id ?? null,
				grindIds: grinds.map((g) => g.id),
				defaultGrindId: grinds.find((g) => g.isDefault)?.id ?? null,
				packagingIds: packagings.map((x) => x.id),
				defaultPackagingId: packagings.find((x) => x.isDefault)?.id ?? null
			},
			zod4(productOptionsSchema),
			{ errors: false, id: 'options' }
		),
		imageForm: await superValidate(zod4(productImageSchema), { id: 'image' }),
		photosForm: await superValidate(zod4(productPhotosSchema), { id: 'photos' }),
		originForm: await superValidate({ sharePercent: 100 }, zod4(productOriginSchema), {
			errors: false,
			id: 'origin'
		})
	};
};

/** A plain post's numeric field, or a 400. */
async function numberField(request: Request, name: string) {
	const value = Number((await request.formData()).get(name));
	if (!Number.isInteger(value) || value <= 0) error(400, 'Nothing chosen');
	return value;
}

export const actions = {
	...childActions({ Variant: variants }, owner),

	/** The kit's delete, refused while the size is in use, and freeing its SKU and bag size. */
	deleteVariant: async (event) => {
		requirePermission(event.locals, 'catalog.manage');
		const productId = await owner(event);
		const form = await superValidate(event.request, zod4(z.object({ id: z.coerce.number() })));
		if (!form.valid) return message(form, { type: 'error', text: 'Nothing chosen' }, { status: 400 });
		const scope = and(
			eq(productVariant.id, form.data.id),
			eq(productVariant.productId, productId),
			isNull(productVariant.deletedAt)
		);
		const refusal = await db.transaction(async (tx) => {
			const [v] = await tx.select({ id: productVariant.id }).from(productVariant).where(scope).for('update');
			if (!v) return 'That size is already gone.';
			const inUse = await variantsInUse(tx, [v.id]);
			if (inUse) return `This size cannot be deleted. ${inUse.text}`;
			await deleteVariants(tx, eq(productVariant.id, v.id), event.locals.user?.id);
			await recordAudit(tx, event, { table: 'product_variant', recordId: v.id, action: 'delete' });
			return null;
		});
		if (refusal) return message(form, { type: 'error', text: refusal }, { status: 400 });
		return message(form, { type: 'success', text: 'Size deleted' });
	},

	description: async (event) => {
		requirePermission(event.locals, 'catalog.manage');
		const form = await superValidate(event.request, zod4(productDescriptionSchema), { id: 'description' });
		if (!form.valid) return message(form, { type: 'error', text: 'Check the text' }, { status: 400 });
		const { product: p } = await loadProduct(event.params.id);
		const description = toRichLocalized(form.data, 'description');
		await db
			.update(product)
			.set({ description, updatedBy: event.locals.user?.id } as Partial<typeof product.$inferInsert>)
			.where(eq(product.id, p.id));
		return message(form, { type: 'success', text: 'Description saved' });
	},

	options: async (event) => {
		requirePermission(event.locals, 'catalog.manage');
		const form = await superValidate(event.request, zod4(productOptionsSchema), { id: 'options' });
		if (!form.valid) return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		if (!form.data.roastLevelIds.length || !form.data.grindIds.length) {
			const field = form.data.roastLevelIds.length ? 'grindIds' : 'roastLevelIds';
			setError(form, field as never, 'Allow at least one');
			return message(form, { type: 'error', text: 'Allow at least one roast and one grind' }, { status: 400 });
		}
		const { product: p } = await loadProduct(event.params.id);
		await db.transaction((tx) => setProductOptions(tx, p.id, form.data));
		return message(form, { type: 'success', text: 'Options saved' });
	},

	image: async (event) => {
		requirePermission(event.locals, 'catalog.manage');
		const posted = await postedForm(event.request);
		const form = await superValidate(posted, zod4(productImageSchema), { id: 'image' });
		const { product: p } = await loadProduct(event.params.id);
		try {
			const image = form.data.image?.size ? await saveUploadedFile(form.data.image) : null;
			if (!image) {
				setError(form, 'image', 'Choose a picture');
				return message(form, { type: 'error', text: 'Choose a picture' }, { status: 400 });
			}
			await db.update(product).set({ image, updatedBy: event.locals.user?.id }).where(eq(product.id, p.id));
		} catch (err) {
			if (err instanceof UploadRefused) {
				setError(form, 'image', err.message);
				return message(form, { type: 'error', text: err.message }, { status: 400 });
			}
			throw err;
		}
		return message(form, { type: 'success', text: 'Main picture saved' });
	},

	addPhotos: async (event) => {
		requirePermission(event.locals, 'catalog.manage');
		const posted = await postedForm(event.request);
		const form = await superValidate(posted, zod4(productPhotosSchema), { id: 'photos' });
		const { product: p } = await loadProduct(event.params.id);
		const files = form.data.photos.filter((f) => f.size > 0);
		if (!files.length) return message(form, { type: 'error', text: 'Choose at least one photo' }, { status: 400 });
		try {
			const names = [];
			for (const file of files) names.push(await saveUploadedFile(file));
			const [{ next }] = await db
				.select({ next: sql<number>`coalesce(max(${productImage.sortOrder}), 0) + 1`.mapWith(Number) })
				.from(productImage)
				.where(eq(productImage.productId, p.id));
			await db
				.insert(productImage)
				.values(names.map((fileName, i) => ({ productId: p.id, fileName, sortOrder: next + i })));
		} catch (err) {
			if (err instanceof UploadRefused) return message(form, { type: 'error', text: err.message }, { status: 400 });
			throw err;
		}
		return message(form, {
			type: 'success',
			text: files.length === 1 ? 'Photo added' : `${files.length} photos added`
		});
	},

	deletePhoto: async (event) => {
		requirePermission(event.locals, 'catalog.manage');
		const { product: p } = await loadProduct(event.params.id);
		const imageId = await numberField(event.request, 'imageId');
		await db.delete(productImage).where(and(eq(productImage.id, imageId), eq(productImage.productId, p.id)));
		return { message: { type: 'success', text: 'Photo removed' } };
	},

	addOrigin: async (event) => {
		requirePermission(event.locals, 'catalog.manage');
		const form = await superValidate(event.request, zod4(productOriginSchema), { id: 'origin' });
		if (!form.valid) return message(form, { type: 'error', text: 'Check the form' }, { status: 400 });
		const { product: p } = await loadProduct(event.params.id);
		let stationId = form.data.stationId;
		// A lot names its station: a product sourced from a lot is sourced from that station too.
		if (form.data.lotId && !stationId) {
			const [l] = await db.select({ stationId: lot.stationId }).from(lot).where(eq(lot.id, form.data.lotId));
			stationId = l?.stationId ?? null;
		}
		await db.insert(productOrigin).values({ ...form.data, stationId, productId: p.id });
		return message(form, { type: 'success', text: 'Origin added' });
	},

	deleteOrigin: async (event) => {
		requirePermission(event.locals, 'catalog.manage');
		const { product: p } = await loadProduct(event.params.id);
		const originId = await numberField(event.request, 'originId');
		await db
			.delete(productOrigin)
			.where(and(eq(productOrigin.id, originId), eq(productOrigin.productId, p.id)));
		return { message: { type: 'success', text: 'Origin removed' } };
	},

	publish: async (event) => {
		requirePermission(event.locals, 'catalog.manage');
		const { product: p } = await loadProduct(event.params.id);
		const to = String((await event.request.formData()).get('to'));
		if (!(PUBLISH_STATUSES as readonly string[]).includes(to)) return fail(400);
		const publishStatus = to as (typeof PUBLISH_STATUSES)[number];
		await db.transaction(async (tx) => {
			await tx.update(product).set({ publishStatus, updatedBy: event.locals.user?.id }).where(eq(product.id, p.id));
			await recordAudit(tx, event, {
				table: 'product',
				recordId: p.id,
				action: 'update',
				before: p,
				after: { publishStatus }
			});
		});
		return { message: { type: 'success', text: publishStatus === 'published' ? 'Published on the website' : `Marked ${publishStatus}` } };
	},

	delete: async (event) => {
		requirePermission(event.locals, 'catalog.manage');
		const { product: p } = await loadProduct(event.params.id);
		const refusal = await db.transaction(async (tx) => {
			await tx.select({ id: product.id }).from(product).where(eq(product.id, p.id)).for('update');
			// Every size it ever had, deleted ones included: one sold before it was deleted still counts.
			const sizes = await tx
				.select({ id: productVariant.id })
				.from(productVariant)
				.where(eq(productVariant.productId, p.id));
			const inUse = await variantsInUse(tx, sizes.map((v) => v.id));
			if (inUse?.sold) return 'This product has been sold: archive it instead.';
			if (inUse) return `This product cannot be deleted while one of its sizes is in use. ${inUse.text}`;
			await tx
				.update(product)
				.set({
					...deletionStamp(event.locals.user?.id),
					// Frees the address for a new product, as a deleted page's is.
					slug: sql`concat(left(${product.slug}, 99 - length(${product.id})), '~', ${product.id})`
				})
				.where(eq(product.id, p.id));
			await deleteVariants(tx, eq(productVariant.productId, p.id), event.locals.user?.id);
			await recordAudit(tx, event, { table: 'product', recordId: p.id, action: 'delete' });
			return null;
		});
		if (refusal) return { message: { type: 'error', text: refusal } };
		redirect('/dashboard/catalog/products', { type: 'success', message: 'Product deleted' }, event.cookies);
	}
};
