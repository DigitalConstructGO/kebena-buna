/**
 * The street plan under the arrival scene (`ArrivalMap.svelte`): a made-up town grid around the
 * museum, not a survey of Jimma. Seeded, so the prerendered page and the browser draw the same town.
 */

export type Box = { x: number; y: number; w: number; h: number; hi?: boolean };
export type Town = { blocks: Box[]; parks: Box[]; minor: string[]; major: string[]; river: string };

/** The plan's size; the museum stands in the middle of it. */
export const TOWN_W = 1600;
export const TOWN_H = 1000;

function mulberry32(seed: number) {
	return () => {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Street lines from `from` to `to`, irregularly spaced, always with one through `through`. */
function streets(rand: () => number, from: number, to: number, through: number) {
	const at = [through];
	for (let p = through; p > from;) at.unshift((p -= 90 + rand() * 80));
	for (let p = through; p < to;) at.push((p += 90 + rand() * 80));
	return at;
}

export function town(seed = 7): Town {
	const rand = mulberry32(seed);
	const cx = TOWN_W / 2;
	const cy = TOWN_H / 2;
	const xs = streets(rand, -200, TOWN_W + 200, cx - 120);
	const ys = streets(rand, -200, TOWN_H + 200, cy);

	const blocks: Box[] = [];
	const parks: Box[] = [];
	for (let i = 0; i < xs.length - 1; i++) {
		for (let j = 0; j < ys.length - 1; j++) {
			const x = xs[i] + 11;
			const y = ys[j] + 11;
			const w = xs[i + 1] - xs[i] - 22;
			const h = ys[j + 1] - ys[j] - 22;
			// the square the museum stands on stays open
			if (x < cx && x + w > cx && y < cy + 60 && y + h > cy - 60) continue;
			if (rand() < 0.1) {
				parks.push({ x, y, w, h });
				continue;
			}
			// each block is a few buildings with lanes between them
			const cols = 1 + Math.floor(rand() * 3);
			const rows = 1 + Math.floor(rand() * 2);
			const bw = (w - (cols - 1) * 8) / cols;
			const bh = (h - (rows - 1) * 8) / rows;
			for (let c = 0; c < cols; c++) {
				for (let r = 0; r < rows; r++) {
					const inset = rand() * 6;
					blocks.push({
						x: x + c * (bw + 8) + inset,
						y: y + r * (bh + 8) + inset,
						w: bw - inset * 2,
						h: bh - inset * 2,
						hi: rand() < 0.22
					});
				}
			}
		}
	}

	const minor = [
		...xs.map((x) => `M${x} -200V${TOWN_H + 200}`),
		...ys.map((y) => `M-200 ${y}H${TOWN_W + 200}`)
	];
	// the high street through the museum's square, and one road cutting across the grid
	const major = [`M-200 ${cy}H${TOWN_W + 200}`, `M${cx - 520} ${TOWN_H + 200}L${cx + 380} -200`];
	const river = `M-200 ${cy + 290}C${cx - 500} ${cy + 180} ${cx - 300} ${cy + 420} ${cx + 60} ${cy + 360}S${cx + 600} ${cy + 140} ${TOWN_W + 200} ${cy + 230}`;

	return { blocks, parks, minor, major, river };
}
