/**
 * Stock and roasting: machines, green receipts, roast batches, packing runs, café use, a transfer,
 * waste and one posted count.
 *
 * Kit server modules do not load outside Vite, so this writes the ledger (`stock_movement`) itself
 * and then rebuilds the three balance tables from it — the balances are, by construction, the
 * ledger's sums, exactly what `#lib/server/stock.ts` keeps them equal to.
 */
import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { db, schema as s, insertId, between, daysFrom, pick, rand } from './db.ts';
import { userIdByEmail } from './base.ts';

type Mv = typeof s.stockMovement.$inferInsert;
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const r2 = (n: number) => Math.round(n * 100) / 100;
const dayKey = (d: Date) =>
	`${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

export async function seed() {
	const byCode = async (code: string) =>
		(await db.select({ id: s.location.id }).from(s.location).where(eq(s.location.code, code)))[0].id;
	const ROASTERY = await byCode('ROASTERY');
	const WAREHOUSE = await byCode('WAREHOUSE');
	const SHOP = await byCode('SHOP');
	const CAFE = await byCode('CAFE');
	const roaster = await userIdByEmail('roaster@kebena.coffee');
	const shop = await userIdByEmail('shop@kebena.coffee');
	const manager = await userIdByEmail('manager@kebena.coffee');

	const probat = await insertId(s.roastMachine, { name: 'Probat P12', locationId: ROASTERY, capacityKg: 12 });
	const giesen = await insertId(s.roastMachine, { name: 'Giesen W6', locationId: ROASTERY, capacityKg: 6 });
	await insertId(s.roastMachine, { name: 'Sample roaster (Ikawa)', locationId: ROASTERY, capacityKg: 0.1, status: false });

	const moves: Mv[] = [];
	/** What the books hold, as the ledger is written: `green:lot:loc`, `roasted:batch:loc`, `packed:run:loc`. */
	const held = new Map<string, number>();
	const costs = new Map<string, number>();
	const add = (key: string, q: number) => held.set(key, r3((held.get(key) ?? 0) + q));

	// ── Green receipts ──────────────────────────────────────────────────────────────────────────
	const lots = await db.select({ id: s.lot.id, code: s.lot.code }).from(s.lot);
	for (const l of lots) {
		const kg = between(30, 90) * 10;
		const cost = between(48, 92) * 10;
		const at = daysFrom(-between(75, 95), 9);
		moves.push({ stage: 'green', reason: 'receipt', locationId: ROASTERY, lotId: l.id, quantity: kg, unitCost: cost, occurredAt: at, createdBy: roaster, note: `Truck from ${l.code.split('-')[1]} station` });
		add(`green:${l.id}:${ROASTERY}`, kg);
		costs.set(`green:${l.id}`, cost);
		if (rand() < 0.35) {
			const kg2 = between(10, 30) * 10;
			moves.push({ stage: 'green', reason: 'receipt', locationId: WAREHOUSE, lotId: l.id, quantity: kg2, unitCost: cost, occurredAt: at, createdBy: roaster });
			add(`green:${l.id}:${WAREHOUSE}`, kg2);
		}
	}

	// ── Roast batches ───────────────────────────────────────────────────────────────────────────
	const products = await db
		.select({ id: s.product.id, slug: s.product.slug })
		.from(s.product)
		.where(eq(s.product.kind, 'coffee'));
	const origins = await db.select().from(s.productOrigin);
	const allowed = await db.select().from(s.productRoastLevel);
	const seq = new Map<string, number>();
	const batches: { id: number; level: number; productId: number; kgOut: number; at: Date }[] = [];
	const flagged = new Set([7, 18]);
	for (let i = 0; i < 26; i++) {
		const daysAgo = 60 - Math.floor((i * 58) / 26);
		const at = daysFrom(-daysAgo, between(7, 13), pick([0, 15, 30, 45]));
		const product = pick(products);
		const lotsOf = origins.filter((o) => o.productId === product.id && o.lotId).map((o) => o.lotId!);
		const level = pick(allowed.filter((a) => a.productId === product.id)).roastLevelId;
		const machine = rand() < 0.65 ? probat : giesen;
		const cap = machine === probat ? 12 : 6;
		const inputs = lotsOf.map((lotId, k) => ({ lotId, greenKg: r3(lotsOf.length > 1 ? (k === 0 ? cap * 0.6 : cap * 0.4) : cap - between(0, 2)) }));
		if (inputs.some((inp) => (held.get(`green:${inp.lotId}:${ROASTERY}`) ?? 0) < inp.greenKg)) continue;
		const greenIn = r3(inputs.reduce((a, b) => a + b.greenKg, 0));
		const loss = flagged.has(i) ? (i === 7 ? 10.8 : 21.6) : 14 + rand() * 4;
		const kgOut = r3(greenIn * (1 - loss / 100));
		const key = dayKey(at);
		const n = (seq.get(key) ?? 0) + 1;
		seq.set(key, n);
		const id = await insertId(s.roastBatch, {
			code: `RB-${key}-${String(n).padStart(2, '0')}`,
			roastedAt: at,
			roasterId: roaster,
			machineId: machine,
			locationId: ROASTERY,
			productId: product.id,
			roastLevelId: level,
			greenKgIn: greenIn,
			roastedKgOut: kgOut,
			durationMin: r2(10 + rand() * 4),
			dropTempC: Math.round((200 + rand() * 25) * 10) / 10,
			cuppingScore: rand() < 0.5 ? r2(82 + rand() * 6) : null,
			notes: flagged.has(i) ? 'Loss outside range — check the probe and the scale.' : rand() < 0.3 ? 'Even colour, first crack at 9:10.' : null,
			isToOrder: rand() < 0.25,
			createdBy: roaster,
			createdAt: at
		});
		let value = 0;
		for (const inp of inputs) {
			await db.insert(s.roastBatchInput).values({ roastBatchId: id, ...inp });
			const cost = costs.get(`green:${inp.lotId}`) ?? 0;
			value += cost * inp.greenKg;
			moves.push({ stage: 'green', reason: 'roast_input', locationId: ROASTERY, lotId: inp.lotId, roastBatchId: id, quantity: -inp.greenKg, unitCost: cost, refType: 'roast_batch', refId: String(id), occurredAt: at, createdBy: roaster });
			add(`green:${inp.lotId}:${ROASTERY}`, -inp.greenKg);
		}
		const unit = r2(value / kgOut);
		costs.set(`roasted:${id}`, unit);
		moves.push({ stage: 'roasted', reason: 'roast_output', locationId: ROASTERY, roastBatchId: id, roastLevelId: level, quantity: kgOut, unitCost: unit, refType: 'roast_batch', refId: String(id), occurredAt: at, createdBy: roaster });
		add(`roasted:${id}:${ROASTERY}`, kgOut);
		batches.push({ id, level, productId: product.id, kgOut, at });
	}

	// ── Packing runs ────────────────────────────────────────────────────────────────────────────
	const variants = await db
		.select({ id: s.productVariant.id, productId: s.productVariant.productId, grams: s.bagSize.grams })
		.from(s.productVariant)
		.innerJoin(s.bagSize, eq(s.productVariant.bagSizeId, s.bagSize.id));
	const grinds = await db.select({ id: s.grind.id }).from(s.grind);
	const runSeq = new Map<string, number>();
	const runs: { id: number; loc: number }[] = [];
	for (const b of batches) {
		if (runs.length >= 22) break;
		const options = variants.filter((v) => v.productId === b.productId);
		if (!options.length) continue;
		const v = pick(options);
		const free = held.get(`roasted:${b.id}:${ROASTERY}`) ?? 0;
		const units = Math.floor((free * (0.5 + rand() * 0.4) * 1000) / v.grams!);
		if (units < 2) continue;
		const kg = r3((units * v.grams!) / 1000);
		const at = new Date(b.at.getTime() + between(1, 2) * 86400000 + 3 * 3600000);
		if (at > new Date()) continue;
		const loc = rand() < 0.55 ? SHOP : WAREHOUSE;
		const key = dayKey(at);
		const n = (runSeq.get(key) ?? 0) + 1;
		runSeq.set(key, n);
		const best = new Date(at.getTime() + 180 * 86400000);
		const id = await insertId(s.packingRun, {
			code: `PR-${key}-${String(n).padStart(2, '0')}`,
			packedAt: at,
			packedBy: shop,
			locationId: loc,
			variantId: v.id,
			roastLevelId: b.level,
			grindId: pick(grinds).id,
			units,
			bestBefore: best.toISOString().slice(0, 10),
			labelPrintedAt: rand() < 0.8 ? at : null,
			isToOrder: false,
			createdBy: shop,
			createdAt: at
		});
		await db.insert(s.packingRunSource).values({ packingRunId: id, roastBatchId: b.id, roastedKg: kg });
		const roastedUnit = costs.get(`roasted:${b.id}`) ?? 0;
		moves.push({ stage: 'roasted', reason: 'pack_input', locationId: ROASTERY, roastBatchId: b.id, packingRunId: id, roastLevelId: b.level, quantity: -kg, unitCost: roastedUnit, refType: 'packing_run', refId: String(id), occurredAt: at, createdBy: shop });
		add(`roasted:${b.id}:${ROASTERY}`, -kg);
		const unit = r2((roastedUnit * kg) / units);
		costs.set(`packed:${id}`, unit);
		moves.push({ stage: 'packed', reason: 'pack_output', locationId: loc, packingRunId: id, variantId: v.id, roastLevelId: b.level, quantity: units, unitCost: unit, refType: 'packing_run', refId: String(id), occurredAt: at, createdBy: shop });
		add(`packed:${id}:${loc}`, units);
		runs.push({ id, loc });
	}

	// ── Transfers, café use, waste ──────────────────────────────────────────────────────────────
	const runInfo = new Map(
		(await db.select().from(s.packingRun)).map((r) => [r.id, { variantId: r.variantId, roastLevelId: r.roastLevelId }])
	);
	const warehouseRun = runs.find((r) => r.loc === WAREHOUSE && (held.get(`packed:${r.id}:${WAREHOUSE}`) ?? 0) >= 6);
	if (warehouseRun) {
		const key = randomUUID();
		const info = runInfo.get(warehouseRun.id)!;
		const at = daysFrom(-4, 11);
		const unit = costs.get(`packed:${warehouseRun.id}`);
		moves.push({ stage: 'packed', reason: 'transfer_out', locationId: WAREHOUSE, packingRunId: warehouseRun.id, ...info, quantity: -5, unitCost: unit, transferKey: key, occurredAt: at, createdBy: shop, note: 'Shop restock' });
		moves.push({ stage: 'packed', reason: 'transfer_in', locationId: SHOP, packingRunId: warehouseRun.id, ...info, quantity: 5, unitCost: unit, transferKey: key, occurredAt: at, createdBy: shop, note: 'Shop restock' });
		add(`packed:${warehouseRun.id}:${WAREHOUSE}`, -5);
		add(`packed:${warehouseRun.id}:${SHOP}`, 5);
	}
	// Roasted coffee to the café, then its own use (4.2).
	const forCafe = [...batches].reverse().find((b) => (held.get(`roasted:${b.id}:${ROASTERY}`) ?? 0) >= 4);
	if (forCafe) {
		const key = randomUUID();
		const unit = costs.get(`roasted:${forCafe.id}`);
		const at = daysFrom(-10, 8);
		moves.push({ stage: 'roasted', reason: 'transfer_out', locationId: ROASTERY, roastBatchId: forCafe.id, roastLevelId: forCafe.level, quantity: -3.5, unitCost: unit, transferKey: key, occurredAt: at, createdBy: roaster, note: 'Café and ceremony supply' });
		moves.push({ stage: 'roasted', reason: 'transfer_in', locationId: CAFE, roastBatchId: forCafe.id, roastLevelId: forCafe.level, quantity: 3.5, unitCost: unit, transferKey: key, occurredAt: at, createdBy: roaster, note: 'Café and ceremony supply' });
		add(`roasted:${forCafe.id}:${ROASTERY}`, -3.5);
		add(`roasted:${forCafe.id}:${CAFE}`, 3.5);
		for (const [d, kg] of [[-8, 0.6], [-5, 0.8], [-2, 0.7]] as const) {
			moves.push({ stage: 'roasted', reason: 'internal_use', locationId: CAFE, roastBatchId: forCafe.id, roastLevelId: forCafe.level, quantity: -kg, unitCost: unit, occurredAt: daysFrom(d, 17), createdBy: manager, note: 'Ceremonies and café' });
			add(`roasted:${forCafe.id}:${CAFE}`, -kg);
		}
	}
	const wasteLot = lots.find((l) => (held.get(`green:${l.id}:${ROASTERY}`) ?? 0) > 20);
	if (wasteLot) {
		moves.push({ stage: 'green', reason: 'waste', locationId: ROASTERY, lotId: wasteLot.id, quantity: -2.4, unitCost: costs.get(`green:${wasteLot.id}`), occurredAt: daysFrom(-12, 15), createdBy: roaster, note: 'Torn sack, swept beans discarded' });
		add(`green:${wasteLot.id}:${ROASTERY}`, -2.4);
	}

	// ── One posted count at the shop ────────────────────────────────────────────────────────────
	const shopRuns = [...held.entries()].filter(([k, q]) => k.startsWith('packed:') && k.endsWith(`:${SHOP}`) && q > 0);
	if (shopRuns.length) {
		const countedAt = daysFrom(-1, 18);
		const countId = await insertId(s.stockCount, {
			locationId: SHOP,
			stage: 'packed',
			countedAt,
			isOpening: false,
			postedAt: countedAt,
			note: 'Monthly shelf count',
			lineCount: shopRuns.length,
			createdBy: manager
		});
		const [key] = shopRuns[0];
		const runId = Number(key.split(':')[1]);
		moves.push({ stage: 'packed', reason: 'adjustment', locationId: SHOP, packingRunId: runId, ...runInfo.get(runId)!, quantity: -1, unitCost: costs.get(`packed:${runId}`), refType: 'stock_count', refId: String(countId), occurredAt: countedAt, createdBy: manager, note: 'Monthly shelf count' });
		add(key, -1);
	}

	// ── Write the ledger, then the balances from it ─────────────────────────────────────────────
	for (let i = 0; i < moves.length; i += 200) {
		await db.insert(s.stockMovement).values(moves.slice(i, i + 200).map((m) => ({ ...m, createdAt: m.occurredAt })));
	}
	await db.execute(sql`
		insert into green_stock (lot_id, location_id, kg, cost_per_kg)
		select m.lot_id, m.location_id, sum(m.quantity),
			coalesce(max(case when m.reason = 'receipt' then m.unit_cost end), 0)
		from stock_movement m where m.stage = 'green' group by m.lot_id, m.location_id`);
	await db.execute(sql`
		insert into roasted_stock (roast_batch_id, location_id, kg)
		select m.roast_batch_id, m.location_id, sum(m.quantity)
		from stock_movement m where m.stage = 'roasted' group by m.roast_batch_id, m.location_id`);
	await db.execute(sql`
		insert into packed_stock (packing_run_id, location_id, variant_id, roast_level_id, units)
		select m.packing_run_id, m.location_id, r.variant_id, r.roast_level_id, sum(m.quantity)
		from stock_movement m join packing_run r on r.id = m.packing_run_id
		where m.stage = 'packed' group by m.packing_run_id, m.location_id, r.variant_id, r.roast_level_id`);

	// Future numbers continue after the seeded ones.
	for (const [key, n] of seq) await db.insert(s.documentSequence).values({ key: `roast_batch:${key}`, nextValue: n + 1 });
	for (const [key, n] of runSeq) await db.insert(s.documentSequence).values({ key: `packing_run:${key}`, nextValue: n + 1 });
}
