import { gsap } from 'gsap';

type Drop = { x: number; y: number; z: number; len: number; vy: number; land: number };
type Splash = { x: number; y: number; vx: number; vy: number; life: number };
export type Ground = { cx: number; cy: number; rx: number; ry: number } | null;

/**
 * Canvas rain: streaks at three depths with a slight wind, and splashes where
 * near drops hit the island surface. `state.rain` (0..1) is tweened by GSAP.
 */
export function createRain(canvas: HTMLCanvasElement, getGround: () => Ground) {
	const ctx = canvas.getContext('2d')!;
	const state = { rain: 0 };
	const drops: Drop[] = [];
	const splashes: Splash[] = [];
	const MAX = 420;
	/** Fewer drops on small screens: the same density, a fraction of the work. */
	let max = MAX;
	const WIND = 0.16;
	let w = 0;
	let h = 0;
	let dpr = 1;
	let ground: Ground = null;
	let running = false;

	const resize = () => {
		// rain streaks are soft; 1x is plenty on phones and halves the fill work
		dpr = Math.min(window.devicePixelRatio || 1, window.innerWidth < 900 ? 1 : 2);
		w = canvas.clientWidth;
		h = canvas.clientHeight;
		canvas.width = Math.round(w * dpr);
		canvas.height = Math.round(h * dpr);
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ground = getGround();
		max = Math.round(MAX * Math.min(1, Math.max(0.35, (w * h) / (1440 * 900))));
	};

	const landY = (x: number, z: number) => {
		if (ground && z > 0.66) {
			const dx = (x - ground.cx) / ground.rx;
			if (Math.abs(dx) < 0.97) {
				const half = ground.ry * Math.sqrt(1 - dx * dx);
				return ground.cy - half + Math.random() * half * 2;
			}
		}
		return h * (0.62 + Math.random() * 0.45);
	};

	const spawn = (y?: number): Drop => {
		const z = Math.random();
		const x = Math.random() * (w + 200) - 100;
		return {
			x,
			y: y ?? -Math.random() * h * 0.3,
			z,
			len: 10 + z * 26,
			vy: 9 + z * 15,
			land: landY(x + (h * WIND) / 2, z)
		};
	};

	/** Three depth layers: each is one path and one stroke per frame, not one per drop. */
	const LAYERS = [0, 1, 2].map((k) => {
		const z = (k + 0.5) / 3;
		return { a: 0.12 + z * 0.38, width: 0.6 + z * 1.1 };
	});
	let clean = true;

	const frame = () => {
		const want = Math.round(max * state.rain);
		if (want === 0 && drops.length === 0 && splashes.length === 0) {
			if (!clean) ctx.clearRect(0, 0, w, h);
			clean = true;
			return;
		}
		clean = false;
		ctx.clearRect(0, 0, w, h);
		while (drops.length < want) drops.push(spawn(Math.random() * h * 0.2 - h * 0.2));

		const fade = Math.min(1, state.rain * 1.6);
		ctx.lineCap = 'round';
		for (let k = 0; k < 3; k++) {
			ctx.beginPath();
			for (let i = drops.length - 1; i >= 0; i--) {
				const d = drops[i];
				if (Math.min(2, Math.floor(d.z * 3)) !== k) continue;
				d.y += d.vy;
				d.x += d.vy * WIND;
				if (d.y >= d.land) {
					if (d.z > 0.5) {
						for (let n = 0; n < 2 + Math.round(d.z * 2); n++) {
							splashes.push({
								x: d.x,
								y: d.land,
								vx: (Math.random() - 0.5) * 2.4,
								vy: -1.2 - Math.random() * 2,
								life: 1
							});
						}
					}
					if (drops.length > want) drops.splice(i, 1);
					else drops[i] = spawn();
					continue;
				}
				ctx.moveTo(d.x, d.y);
				ctx.lineTo(d.x - d.len * WIND, d.y - d.len);
			}
			ctx.strokeStyle = `rgba(214,232,222,${(LAYERS[k].a * fade).toFixed(3)})`;
			ctx.lineWidth = LAYERS[k].width;
			ctx.stroke();
		}

		if (splashes.length) {
			ctx.fillStyle = 'rgba(220,236,226,0.7)';
			for (let i = splashes.length - 1; i >= 0; i--) {
				const s = splashes[i];
				s.x += s.vx;
				s.y += s.vy;
				s.vy += 0.28;
				s.life -= 0.06;
				if (s.life <= 0) {
					splashes.splice(i, 1);
					continue;
				}
				ctx.globalAlpha = s.life;
				ctx.fillRect(s.x, s.y, 1.4, 1.4);
			}
			ctx.globalAlpha = 1;
		}
	};

	const ro = new ResizeObserver(resize);
	ro.observe(canvas);
	resize();

	return {
		state,
		refreshGround() {
			ground = getGround();
		},
		start() {
			if (running) return;
			running = true;
			gsap.ticker.add(frame);
		},
		stop() {
			if (!running) return;
			running = false;
			gsap.ticker.remove(frame);
			drops.length = 0;
			splashes.length = 0;
			ctx.clearRect(0, 0, w, h);
		},
		destroy() {
			gsap.ticker.remove(frame);
			ro.disconnect();
		}
	};
}
