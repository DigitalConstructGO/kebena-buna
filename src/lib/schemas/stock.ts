/** The stock and roasting forms. Client-safe, so each form validates with its action's schema. */
import { z } from 'zod/v4';
import { STOCK_STAGES } from '#lib/constants.ts';
import {
	bool,
	boolTrue,
	clockTime,
	isoDate,
	optionalDate,
	optionalId,
	optionalNumber,
	optionalText,
	optionalUserId,
	requiredId,
	requiredText
} from '#lib/schemas/common.ts';

const kg = (message = 'Enter the kilograms') => z.coerce.number().positive(message);

export const roastInputSchema = z.object({ lotId: requiredId('Choose a lot'), greenKg: kg() });

/** One roast (questionnaire 4.7). The code is given by the server from the date. */
export const roastSchema = z.object({
	date: isoDate,
	time: clockTime,
	locationId: requiredId('Where it was roasted'),
	machineId: optionalId,
	roasterId: optionalUserId,
	productId: optionalId,
	roastLevelId: requiredId('Choose the roast'),
	roastedKgOut: kg('Enter the roasted kilograms'),
	durationMin: optionalNumber,
	dropTempC: optionalNumber,
	cuppingScore: optionalNumber,
	notes: optionalText(2000),
	isToOrder: bool,
	inputs: z.array(roastInputSchema).min(1, 'Add the green lots this batch used')
});

/** What can change on a batch once roasted: the weights move stock, so they stay. */
export const roastEditSchema = z.object({
	id: z.coerce.number(),
	machineId: optionalId,
	roasterId: optionalUserId,
	productId: optionalId,
	durationMin: optionalNumber,
	dropTempC: optionalNumber,
	cuppingScore: optionalNumber,
	notes: optionalText(2000),
	isToOrder: bool
});

/** A misread roasted weight, put right with an adjustment (the green in stays as recorded). */
export const roastCorrectSchema = z.object({
	id: z.coerce.number(),
	roastedKgOut: kg('Enter the roasted kilograms'),
	reason: requiredText(255, 'Say what was wrong')
});

/** A batch recorded by mistake, undone while nothing of it has been used. */
export const roastVoidSchema = z.object({
	id: z.coerce.number(),
	reason: requiredText(255, 'Say why it is voided')
});

export const packSourceSchema = z.object({
	roastBatchId: requiredId('Choose a batch'),
	roastedKg: kg()
});

export const packingSchema = z.object({
	date: isoDate,
	time: clockTime,
	sourceLocationId: requiredId('Where the roasted coffee is'),
	locationId: requiredId('Where the bags go'),
	variantId: requiredId('Choose the product and size'),
	roastLevelId: requiredId('Choose the roast'),
	grindId: optionalId,
	units: z.coerce.number().int().positive('Enter the bags packed'),
	bestBefore: optionalDate,
	isToOrder: bool,
	sources: z.array(packSourceSchema).min(1, 'Add the roast batches the bags came from')
});

export const packingEditSchema = z.object({
	id: z.coerce.number(),
	bestBefore: optionalDate,
	labelPrinted: bool,
	isActive: boolTrue
});

export const receiveSchema = z.object({
	lotId: requiredId('Choose the lot'),
	locationId: requiredId('Where it arrived'),
	kg: kg(),
	costPerKg: z.coerce.number().min(0, 'Cannot be negative'),
	date: isoDate,
	note: optionalText(255)
});

const stage = z.enum(STOCK_STAGES);

/** A correction, waste or internal use of one item at one location. */
export const adjustSchema = z.object({
	stage,
	itemId: requiredId('Choose what'),
	locationId: requiredId('Choose where'),
	reason: z.enum(['adjustment', 'waste', 'internal_use']),
	quantity: z.coerce.number().refine((n) => n !== 0, 'Enter how much'),
	date: isoDate,
	note: requiredText(255, 'Say why')
});

export const transferSchema = z.object({
	stage,
	itemId: requiredId('Choose what'),
	fromLocationId: requiredId('From where'),
	toLocationId: requiredId('To where'),
	quantity: z.coerce.number().positive('Enter how much'),
	date: isoDate,
	note: optionalText(255)
});

export const countLineSchema = z.object({
	itemId: z.coerce.number().int().positive(),
	label: z.string().optional(),
	expected: z.coerce.number().optional(),
	counted: z.preprocess(
		(v) => (v === '' || v === null || v === undefined ? null : v),
		z.coerce.number().min(0, 'Cannot be negative').nullable()
	)
});

/** A count: pick the location and stage, then count the sheet. Empty lines are not counted. */
export const countSchema = z.object({
	locationId: requiredId('Choose the location'),
	stage,
	date: isoDate,
	time: clockTime,
	isOpening: bool,
	note: optionalText(255),
	lines: z.array(countLineSchema).min(1, 'Nothing to count here')
});

export const machineSchema = z.object({
	name: requiredText(64),
	locationId: optionalId,
	capacityKg: z.coerce.number().min(0).default(0),
	status: boolTrue
});
export const machineEditSchema = machineSchema.extend({ id: z.coerce.number() });
