/**
 * The hero's scenes on one WebGL canvas. The <video>s stay in the page, unseen, and hand their
 * frames over as textures; one shader draws the scene on screen and, during a pour, the scene
 * rising out of it, with the band of liquid between them as a lens: what is behind it is seen
 * bent and tinted through it, lit along its lip. This replaces a clip-path redrawn on each
 * <video> every frame, which repaints the video's layer, plus the liquid's SVG band.
 *
 * Without WebGL, or once its context is lost, the timeline falls back to the clip-paths.
 */

/** Colours of the liquid, light at its lip to dark where it meets the scene. */
export const TONES = {
	coffee: { edge: '#a86a2e', body: '#6d3f17', core: '#3a200b', glint: '#f0cd9c', alpha: 0.97 },
	water: { edge: '#f1f8f8', body: '#b3d3d7', core: '#7fa8b0', glint: '#ffffff', alpha: 0.7 }
};
export type Tone = keyof typeof TONES;

/** A scene's tilt (degrees, like CSS rotateX) and scale, as the timeline tweens them. */
export type Look = { tilt: number; scale: number };

/** A pour under way: the surface the timeline animates, in the same units as its draw(). */
export type Pour = {
	level: number;
	lead: number;
	phase: number;
	amp: number;
	/** where the thread lands, % of the width */
	x: number;
	tone: Tone;
	/** the part of the frame the scenes fill, % of the height */
	rise: { top: number; bottom: number };
};

export type StageGL = {
	/** false once the context is lost: the caller goes back to the DOM scenes */
	readonly ok: boolean;
	/**
	 * Draw scene `a`, and scene `a + 1` pouring in over it if `pour` is set; `lens` (0..1) is the
	 * rain on the lens. Skips the work if nothing changed.
	 */
	render(a: number, pour: Pour | null, looks: Look[], fx?: { lens?: number; steam?: number }): void;
	/**
	 * Where the viewer looks from, -1..1 each way (0 straight on): the scenes' near things move
	 * against their far ones, from depth maps made offline for each clip.
	 */
	view: [number, number];
	/** The pointer over the hero (css px), for the steam to move away from. */
	pointer: [number, number];
	destroy(): void;
};

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
#define DEPTH_ROWS 6.0
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;      // canvas, device px
uniform vec2 uSize;     // canvas, css px
uniform float uPersp;   // the stage's CSS perspective, px
uniform sampler2D uTexA;
uniform sampler2D uTexB;
uniform vec4 uFitA;     // where the picture sits in the scene's box: x, y, w, h (css px)
uniform vec4 uFitB;
uniform vec2 uLookA;    // tilt (radians), scale
uniform vec2 uLookB;
uniform vec2 uFadeA;    // portrait: top of the square and its size; size 0 means no fade
uniform vec2 uFadeB;
uniform float uPour;    // 1 while B pours in over A
uniform vec4 uSurf;     // level, lead, phase, amp
uniform vec2 uRise;     // top, bottom (% of the height)
uniform float uX0;      // where the thread lands (% of the width)
uniform float uTime;
uniform float uCoffee;  // 1 coffee, 0 water
uniform vec3 uEdge;
uniform vec3 uBody;
uniform vec3 uCore;
uniform vec3 uGlint;
uniform float uLens;    // rain on the lens, 0..1
uniform sampler2D uDepthA;
uniform sampler2D uDepthB;
uniform vec3 uDepthMixA; // the depth snapshots either side of the playhead, and how far between; z < 0: none
uniform vec3 uDepthMixB;
uniform vec2 uView;     // where the viewer looks from (px): near things move against far ones
uniform vec4 uSteam;    // over scene A's cup: centre x and coffee surface y (uv), half width (uv x), strength
uniform vec2 uPointer;  // the pointer in the scene's box (css px); far away when there is none

// the same surface as the timeline's surfaceY(): % of the height at x (% of the width)
float surf(float x, float level, float ph, float amp) {
	return uRise.y + amp - level * (uRise.y - uRise.x + 2.0 * amp)
		+ amp * sin(ph + x * 0.085)
		+ amp * 0.45 * sin(ph * 1.7 + x * 0.21)
		+ amp * 0.55 * sin((x - uX0) * 0.55 - ph * 2.6) * exp(-abs(x - uX0) / 9.0);
}

float hash(vec2 q) {
	return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453);
}

// one drop of radius r at c: xy moves what is seen through it (turned over and magnified, as a
// drop on glass does), z is its light: a darker rim and a glint at its top left
vec3 drop(vec2 p, vec2 c, float r) {
	vec2 d = (p - c) / r;
	float l = dot(d, d);
	if (l >= 1.0) return vec3(0.0);
	float edge = 1.0 - smoothstep(0.8, 1.0, l);
	vec2 g = d - vec2(-0.32, -0.4);
	float light = -0.3 * smoothstep(0.4, 1.0, l) + 0.4 * exp(-dot(g, g) * 14.0);
	return vec3(-d * r * 4.0, light) * edge;
}

// the storm on the lens: beads that stay where they land, more as the rain goes on and fewer as
// it dries, and a few that run down the glass leaving a line of small beads behind them
vec3 rain(vec2 p) {
	// mostly small beads, now and then a big one: a big one is where the turned-over scene shows
	vec2 cell = vec2(46.0);
	vec2 id = floor(p / cell);
	vec3 r = vec3(0.0);
	if (hash(id) < uLens * 0.3) {
		float size = mix(2.0, 14.0, pow(hash(id + 1.9), 3.0)) * (0.6 + 0.4 * uLens);
		vec2 room = vec2(size + 1.0) / cell;
		vec2 c = (id + mix(room, 1.0 - room, vec2(hash(id + 7.1), hash(id + 3.7)))) * cell;
		r = drop(p, c, size);
	}
	float cw = 110.0;
	float col = floor(p.x / cw);
	float hc = hash(vec2(col, 17.0));
	if (hc < uLens * 0.55) {
		float span = uSize.y * 1.4;
		float y = mod(uTime * mix(50.0, 150.0, hash(vec2(col, 5.0))) + hc * span * 7.0, span)
			- uSize.y * 0.2;
		float x0 = (col + 0.25 + 0.5 * hash(vec2(col, 9.0))) * cw;
		vec3 run = drop(p, vec2(x0 + sin(y * 0.035 + col) * 5.0, y), mix(5.5, 8.5, hash(vec2(col, 2.0))));
		if (run != vec3(0.0)) return run;
		float behind = y - p.y;
		if (behind > 0.0 && behind < 170.0) {
			float tid = floor(p.y / 13.0);
			float ht = hash(vec2(col, tid));
			float cy = (tid + 0.5) * 13.0;
			if (ht < 0.6) {
				vec3 bead = drop(p, vec2(x0 + sin(cy * 0.035 + col) * 5.0, cy),
					mix(1.2, 2.4, ht / 0.6) * (1.0 - 0.5 * behind / 170.0));
				if (bead != vec3(0.0)) return bead;
			}
		}
	}
	return r;
}

// how near the scene is at uv (1 nearest): a strip of DEPTH_ROWS snapshots, blended by the playhead
float depthAt(sampler2D dt, vec3 m, vec2 uv) {
	vec2 q = vec2(uv.x, clamp(uv.y, 0.01, 0.99) / DEPTH_ROWS);
	return mix(
		texture2D(dt, q + vec2(0.0, m.x / DEPTH_ROWS)).r,
		texture2D(dt, q + vec2(0.0, m.y / DEPTH_ROWS)).r,
		m.z
	);
}

// screen point p (css px, y down) in a scene's own box, undoing its CSS rotateX + scale about the centre
vec2 boxAt(vec2 look, vec2 p) {
	vec2 c = p - 0.5 * uSize;
	float k = uPersp / (uPersp + c.y * tan(look.x));
	return vec2(k * c.x, k * c.y / cos(look.x)) / look.y + 0.5 * uSize;
}

float vnoise(vec2 x) {
	vec2 i = floor(x);
	vec2 f = fract(x);
	f = f * f * (3.0 - 2.0 * f);
	return mix(
		mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
		mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
		f.y
	);
}
float fbm(vec2 x) {
	float v = 0.0;
	float a = 0.5;
	for (int i = 0; i < 4; i++) {
		v += a * vnoise(x);
		x = x * 2.03 + 17.0;
		a *= 0.5;
	}
	return v;
}

// steam off the coffee at e (scene box px): thin curling threads in a column that widens and
// thins as it rises, pushed aside by the pointer
float steam(vec4 fit, vec2 e) {
	float hw = uSteam.z * fit.z;
	vec2 o = vec2(fit.x + uSteam.x * fit.z, fit.y + uSteam.y * fit.w);
	vec2 q = vec2(e.x - o.x, o.y - e.y) / hw;
	if (q.y < -0.1 || q.y > 3.6 || abs(q.x) > 2.2) return 0.0;
	vec2 m = vec2(uPointer.x - o.x, o.y - uPointer.y) / hw;
	vec2 dm = q - m;
	// pushed out from the pointer, smoothly: nothing at its centre, most a little way off
	vec2 w = q + dm * 1.1 * exp(-dot(dm, dm) * 2.5);
	float t = uTime;
	w.x += 0.22 * sin(w.y * 1.8 - t * 0.8) * w.y;
	float n = fbm(vec2(w.x * 1.3, w.y * 0.85 - t * 0.45));
	float threads = pow(1.0 - abs(2.0 * n - 1.0), 3.0);
	float haze = smoothstep(0.42, 0.8, fbm(vec2(w.x * 1.1 + 4.0, w.y * 0.8 - t * 0.35)));
	float column = exp(-pow(w.x / (0.6 + 0.3 * q.y), 2.0) * 2.2);
	float rise = smoothstep(0.0, 0.4, q.y) * (1.0 - smoothstep(1.3, 3.5, q.y));
	return (threads * 0.5 + haze * 0.3) * column * rise * uSteam.w;
}

// a scene at screen point p (css px, y down)
vec4 scene(sampler2D tex, sampler2D dt, vec3 dm, vec4 fit, vec2 look, vec2 fade, vec2 p, vec2 shift) {
	vec2 e = boxAt(look, p) + shift;
	vec2 uv = (e - fit.xy) / fit.zw;
	if (dm.z >= 0.0 && dot(uView, uView) > 0.0) {
		// the picture as seen from a little to one side: two steps, so the near things' edges hold
		vec2 s = uView / fit.zw;
		float z = depthAt(dt, dm, uv);
		z = depthAt(dt, dm, uv - s * (z - 0.4));
		uv -= s * (z - 0.4);
	}
	vec3 col = texture2D(tex, clamp(uv, 0.0, 1.0)).rgb;
	float a = 1.0;
	if (fade.y > 0.0) {
		// contain fit: the square sits low and fades into the dark above and below it
		vec2 inb = step(vec2(0.0), uv) * step(uv, vec2(1.0));
		float y = e.y - fade.x;
		a = inb.x * inb.y
			* clamp(y / (0.26 * fade.y), 0.0, 1.0)
			* clamp((fade.y - y) / (0.16 * fade.y), 0.0, 1.0);
	}
	return vec4(col * a, a);
}

// the story as it stands at p: one scene, or the next pouring in over it
vec4 story(vec2 p, vec3 dr) {
	if (uPour < 0.5) {
		vec4 one = scene(uTexA, uDepthA, uDepthMixA, uFitA, uLookA, uFadeA, p, dr.xy);
		if (uSteam.w > 0.0) one.rgb += vec3(1.0, 0.98, 0.95) * 0.24 * steam(uFitA, boxAt(uLookA, p)) * one.a;
		return one;
	}
	float x = p.x / uSize.x * 100.0;
	float hp = uSize.y / 100.0;
	float ph = uSurf.z;
	float b = surf(x, uSurf.x, ph, uSurf.w) * hp;
	float top = min(b - 1.0, surf(x, uSurf.y, ph + 1.4, uSurf.w * 1.25) * hp);
	float th = b - top;
	float slope = (surf(x + 0.4, uSurf.x, ph, uSurf.w) - surf(x - 0.4, uSurf.x, ph, uSurf.w))
		* hp / (0.8 * uSize.x / 100.0);

	float below = smoothstep(b - 0.75, b + 0.75, p.y);
	float band = smoothstep(top - 0.75, top + 0.75, p.y) * (1.0 - below);
	float d = clamp((p.y - top) / max(th, 1.0), 0.0, 1.0);

	// the band is a lens: what is behind it is seen magnified (a third of the way to one row,
	// any more and it smears into streaks) and pushed sideways where the surface leans
	vec2 lens = vec2(slope * th * 0.4, (0.5 - d) * th * 0.35) * band;
	vec4 A = scene(uTexA, uDepthA, uDepthMixA, uFitA, uLookA, uFadeA, p, lens + dr.xy);

	// the scene rising out of the liquid is still under its moving skin: it wobbles near the
	// surface, settling with depth, with light running through it
	float depth = max(0.0, p.y - b);
	float wet = exp(-depth / 70.0);
	vec2 wob = vec2(
		slope * 10.0 + sin(p.y * 0.045 - uTime * 2.6 + x * 0.21) * 3.5,
		cos(x * 0.31 + uTime * 2.1) * 2.5
	) * wet;
	vec4 B = scene(uTexB, uDepthB, uDepthMixB, uFitB, uLookB, uFadeB, p, wob + dr.xy);
	float ca = sin(x * 0.42 + uTime * 1.7 + sin(p.y * 0.035 - uTime * 0.9) * 2.0)
		* sin(x * 0.19 - uTime * 1.2 + p.y * 0.021);
	ca = pow(abs(ca), 7.0) * wet;
	B.rgb += uGlint * ca * mix(0.35, 0.16, uCoffee) * B.a;
	// a shadow of liquid where it meets the scene
	B.rgb = mix(B.rgb, uCore * B.a, mix(0.25, 0.55, uCoffee) * exp(-depth / 10.0));

	vec3 liq = mix(uEdge, uBody, smoothstep(0.06, 0.32, d));
	liq = mix(liq, uCore, smoothstep(0.32, 0.8, d));
	// how much shows through: water is clear, coffee only at its thin lip
	float clear = mix(
		mix(0.72, 0.5, d),
		mix(0.4, 0.04, smoothstep(0.0, 0.28, d)),
		uCoffee
	);
	vec3 seen = A.rgb * mix(vec3(0.92, 0.98, 1.0), vec3(1.0, 0.72, 0.42), uCoffee);
	vec4 L = vec4(liq * (1.0 - clear) + seen * clear, (1.0 - clear) + A.a * clear);

	// light: a rim along the lip, a broken line of glint under it, a soft highlight lower down
	float i = x * 0.48;
	float kg = clamp(0.3 + sin(i * 0.55 + ph * 1.3) * sin(i * 0.17 + 1.0), 0.0, 1.0);
	float g = smoothstep(0.03, 0.05, d) * (1.0 - smoothstep(0.035 + 0.07 * kg, 0.05 + 0.07 * kg, d)) * step(0.02, kg);
	float rim = exp(-max(0.0, p.y - top) / 1.4);
	float spec = pow(max(0.0, 1.0 - abs(d - 0.22) * 6.0), 3.0) * (0.55 + 0.45 * sin(x * 0.11 + ph * 0.8));
	vec3 light = uGlint * (g * 0.9 + rim * 0.55 + spec * mix(0.22, 0.12, uCoffee));
	L.rgb += light;
	L.a = min(1.0, L.a + (g + rim) * 0.5);

	return mix(mix(A, L, band), B, below);
}

void main() {
	vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uRes * uSize;
	vec3 dr = uLens > 0.001 ? rain(p) : vec3(0.0);
	vec4 col = story(p, dr);
	col = vec4(clamp(col.rgb + dr.z * col.a, 0.0, col.a), col.a);
	// film grain, drawn here: as a blended layer over the canvas it cost more than the film itself
	float gr = hash(floor(gl_FragCoord.xy / 1.5) + floor(uTime * 4.4) * 31.7) - 0.5;
	col.rgb = clamp(col.rgb + gr * 0.05 * col.a, 0.0, col.a);
	gl_FragColor = col;
}
`;

/**
 * Where the coffee sits in the cup at the end of the pour clip (uv of each framing): centre x,
 * surface y, half the cup's width. The square cut is the master's x 288..992 of 1280.
 */
const CUP = {
	wide: { x: 0.51, y: 0.41, hw: 0.13 },
	sq: { x: (0.51 * 1280 - 288) / 704, y: 0.41, hw: (0.13 * 1280) / 704 }
};

/** Snapshots in each depth strip, top to bottom, evenly over the clip; matches the shader's. */
const DEPTH_ROWS = 6;
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const pct = (s: string) => (s.trim().endsWith('%') ? parseFloat(s) / 100 : 0.5);

export function createStageGL(
	canvas: HTMLCanvasElement,
	videos: HTMLVideoElement[],
	onLost: () => void
): StageGL | null {
	const gl = canvas.getContext('webgl', {
		alpha: true,
		premultipliedAlpha: true,
		antialias: false,
		depth: false,
		stencil: false,
		preserveDrawingBuffer: false
	});
	if (!gl) return null;

	const compile = (type: number, src: string) => {
		const sh = gl.createShader(type)!;
		gl.shaderSource(sh, src);
		gl.compileShader(sh);
		if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
			if (import.meta.env.DEV) console.warn('[hero gl]', gl.getShaderInfoLog(sh));
			return null;
		}
		return sh;
	};
	const vs = compile(gl.VERTEX_SHADER, VERT);
	const fs = compile(gl.FRAGMENT_SHADER, FRAG);
	if (!vs || !fs) return null;
	const prog = gl.createProgram();
	gl.attachShader(prog, vs);
	gl.attachShader(prog, fs);
	gl.linkProgram(prog);
	if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
	gl.useProgram(prog);

	// one triangle over the whole canvas
	gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
	const aPos = gl.getAttribLocation(prog, 'aPos');
	gl.enableVertexAttribArray(aPos);
	gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

	const u = (name: string) => gl.getUniformLocation(prog, name);
	const U = {
		res: u('uRes'),
		size: u('uSize'),
		persp: u('uPersp'),
		fit: [u('uFitA'), u('uFitB')],
		look: [u('uLookA'), u('uLookB')],
		fade: [u('uFadeA'), u('uFadeB')],
		pour: u('uPour'),
		surf: u('uSurf'),
		rise: u('uRise'),
		x0: u('uX0'),
		time: u('uTime'),
		coffee: u('uCoffee'),
		edge: u('uEdge'),
		body: u('uBody'),
		core: u('uCore'),
		glint: u('uGlint'),
		lens: u('uLens'),
		depthMix: [u('uDepthMixA'), u('uDepthMixB')],
		view: u('uView'),
		steam: u('uSteam'),
		pointer: u('uPointer')
	};
	gl.uniform1i(u('uTexA'), 0);
	gl.uniform1i(u('uTexB'), 1);
	gl.uniform1i(u('uDepthA'), 2);
	gl.uniform1i(u('uDepthB'), 3);
	gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

	/* ---------- the scenes' pictures ---------- */
	type Slot = {
		v: HTMLVideoElement;
		tex: WebGLTexture;
		poster: HTMLImageElement | undefined;
		/** what is in the texture now, and its size */
		has: 'video' | 'poster' | null;
		w: number;
		h: number;
		/** frames to re-upload after a seek: the decoded frame can land a moment after `seeked` */
		fresh: number;
		/** a new frame has been decoded since the last one was taken, and when the clip last said so */
		frame: boolean;
		frameAt: number;
		/** counts the pictures put in the texture, so the canvas knows when there is a new one to draw */
		stamp: number;
		/** object-fit / object-position, read from the CSS so the layout keeps one source */
		cover: boolean;
		pos: [number, number];
		/** the clip's depth strip (see DEPTH_ROWS), fetched once the browser has picked a source */
		depth: WebGLTexture;
		depthAsked: boolean;
		depthReady: boolean;
	};
	const texture = () => {
		const tex = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, tex);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		return tex;
	};
	const slots: Slot[] = videos.map((v) => {
		const tex = texture();
		// the poster is the clip's CSS background: the wide cut, or the square one on portrait screens
		const url = /url\(["']?([^"')]+)/.exec(getComputedStyle(v).backgroundImage)?.[1];
		let poster: HTMLImageElement | undefined;
		if (url) {
			poster = new Image();
			poster.src = url;
		}
		return {
			v,
			tex,
			poster,
			has: null,
			w: 0,
			h: 0,
			fresh: 2,
			frame: false,
			frameAt: 0,
			stamp: 0,
			cover: true,
			pos: [0.5, 0.5],
			depth: texture(),
			depthAsked: false,
			depthReady: false
		};
	});
	// A clip says when it has a new frame (24 a second); the screen asks 60 or 120 times. Taking
	// the picture only when there is a new one saves most of the uploads, the slowest step on a phone.
	type Framed = HTMLVideoElement & {
		requestVideoFrameCallback?: (cb: () => void) => number;
		cancelVideoFrameCallback?: (id: number) => void;
	};
	const watching = slots.map((s) => {
		const v = s.v as Framed;
		if (!v.requestVideoFrameCallback) return undefined;
		let id = 0;
		const on = () => {
			s.frame = true;
			s.frameAt = performance.now();
			id = v.requestVideoFrameCallback(on);
		};
		id = v.requestVideoFrameCallback(on);
		return () => v.cancelVideoFrameCallback?.(id);
	});
	const marks = slots.map((s) => {
		const mark = () => (s.fresh = 3);
		for (const ev of ['seeked', 'loadeddata', 'playing']) s.v.addEventListener(ev, mark);
		void s.poster
			?.decode()
			.then(mark)
			.catch(() => {});
		return mark;
	});

	/**
	 * Each clip `name-scroll[-sm|-sq].mp4` has its depth in `name-depth[-sq].webp`: the wide and
	 * small clips share a framing, the square one has its own.
	 */
	const askDepth = (s: Slot) => {
		const src = s.v.currentSrc;
		if (s.depthAsked || !src.includes('-scroll')) return;
		s.depthAsked = true;
		const img = new Image();
		img.src = src.replace(/-scroll(-sm)?(-sq)?\.mp4.*$/, (_, _sm, sq: string | undefined) =>
			sq ? '-depth-sq.webp' : '-depth.webp'
		);
		void img
			.decode()
			.then(() => {
				if (!ok) return;
				gl.activeTexture(gl.TEXTURE2);
				gl.bindTexture(gl.TEXTURE_2D, s.depth);
				gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, gl.LUMINANCE, gl.UNSIGNED_BYTE, img);
				s.depthReady = true;
				lastSig = '';
			})
			.catch(() => {});
	};

	/** Put the scene's current picture in its texture if it has changed. True if it did. */
	const upload = (s: Slot) => {
		askDepth(s);
		const video = s.v.readyState >= 2 && s.v.videoWidth > 0;
		const want = video ? 'video' : s.poster?.complete && s.poster.naturalWidth ? 'poster' : null;
		if (!want) return false;
		if (want === s.has && s.fresh <= 0) {
			if (want === 'poster' || s.v.paused) return false;
			// playing: wait for the clip's next frame. A browser that stops saying (it has no
			// callback, or keeps it from a clip it thinks unseen) is asked every time, as before
			if (!s.frame && performance.now() - s.frameAt < 120) return false;
		}
		// mid-seek the clip has no settled frame to give, and for a moment reports that it has none
		// at all: keep the frame already shown rather than flash back to the poster, its first frame
		if (s.has === 'video' && s.v.readyState > 0 && (s.v.seeking || !video)) return false;
		gl.bindTexture(gl.TEXTURE_2D, s.tex);
		try {
			if (want === 'video') {
				gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, s.v);
				s.w = s.v.videoWidth;
				s.h = s.v.videoHeight;
			} else {
				gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, s.poster!);
				s.w = s.poster!.naturalWidth;
				s.h = s.poster!.naturalHeight;
			}
		} catch {
			return false;
		}
		s.has = want;
		s.fresh--;
		s.frame = false;
		s.stamp++;
		return true;
	};

	/* ---------- size ---------- */
	let W = 0;
	let H = 0;
	let persp = 1400;
	// the box is watched, not read every frame: a clientWidth read forces a layout each time
	/** share of full resolution the canvas is drawn at; lowered when the frames come slowly */
	let quality = 1;
	let stale = true;
	const sized = new ResizeObserver(() => (stale = true));
	sized.observe(canvas);
	const measure = () => {
		if (!stale) return false;
		stale = false;
		const w = canvas.clientWidth;
		const h = canvas.clientHeight;
		if (w === W && h === H && quality === drawnQuality) return false;
		W = w;
		H = h;
		drawnQuality = quality;
		// the films are 720p or less: a denser canvas only costs fill. Never under one canvas
		// pixel to a css pixel, though: below that the picture goes soft
		const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 1.5) * quality);
		canvas.width = Math.max(1, Math.round(W * dpr));
		canvas.height = Math.max(1, Math.round(H * dpr));
		gl.viewport(0, 0, canvas.width, canvas.height);
		persp = parseFloat(getComputedStyle(canvas.parentElement!).perspective) || 1400;
		for (const s of slots) {
			const cs = getComputedStyle(s.v);
			s.cover = cs.objectFit !== 'contain';
			const [px = '50%', py = '50%'] = cs.objectPosition.split(/\s+/);
			s.pos = [pct(px), pct(py)];
		}
		return true;
	};

	let drawnQuality = 1;
	/**
	 * A device that cannot keep up while the canvas draws every frame (a pour, the rain) gets a
	 * smaller canvas: a fifth fewer pixels each way, at most twice. `ms` is the time since the
	 * last frame; a stall (a tab switch, a long task) is not the canvas's doing and is left out.
	 */
	let slow = 0;
	let judged = 0;
	const pace = (ms: number) => {
		if (quality <= 0.65 || ms <= 0 || ms > 100) return;
		slow += ms;
		if (++judged < 40) return;
		// under about 48 frames a second on average
		if (slow / judged > 21) {
			quality *= 0.8;
			stale = true;
		}
		slow = 0;
		judged = 0;
	};

	const setScene = (i: 0 | 1, s: Slot, look: Look) => {
		gl.activeTexture(i ? gl.TEXTURE1 : gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, s.tex);
		const w = s.w || 16;
		const h = s.h || 9;
		const c = s.cover ? Math.max(W / w, H / h) : Math.min(W / w, H / h);
		const dw = w * c;
		const dh = h * c;
		const x = (W - dw) * s.pos[0];
		const y = (H - dh) * s.pos[1];
		gl.uniform4f(U.fit[i], x, y, dw, dh);
		// looking from the side, the scene zooms in a touch so its edges never come into view
		const zoom = 1 + 0.025 * Math.max(Math.abs(view[0]), Math.abs(view[1]));
		gl.uniform2f(U.look[i], (look.tilt * Math.PI) / 180, (look.scale || 1) * zoom);
		gl.activeTexture(i ? gl.TEXTURE3 : gl.TEXTURE2);
		gl.bindTexture(gl.TEXTURE_2D, s.depth);
		if (s.depthReady) {
			// the poster is the clip's first frame
			const at = s.has === 'video' && s.v.duration ? s.v.currentTime / s.v.duration : 0;
			const f = Math.min(1, Math.max(0, at)) * (DEPTH_ROWS - 1);
			const r0 = Math.min(Math.floor(f), DEPTH_ROWS - 2);
			gl.uniform3f(U.depthMix[i], r0, r0 + 1, f - r0);
		} else gl.uniform3f(U.depthMix[i], 0, 0, -1);
		gl.uniform2f(U.fade[i], y, s.cover ? 0 : dw);
	};

	let lastSig = '';
	let tone: Tone | undefined;
	const view: [number, number] = [0, 0];
	const pointer: [number, number] = [-1e5, -1e5];
	let drawnAt = 0;
	let askedAt = 0;
	let ok = true;
	const lost = (e: Event) => {
		e.preventDefault();
		ok = false;
		onLost();
	};
	canvas.addEventListener('webglcontextlost', lost);

	return {
		get ok() {
			return ok;
		},
		view,
		pointer,
		render(a, pour, looks, { lens = 0, steam = 0 } = {}) {
			if (!ok) return;
			const resized = measure();
			if (!W || !H) return;
			const b = pour ? a + 1 : -1;
			let changed = resized;
			for (const k of [a, b]) if (slots[k] && upload(slots[k])) changed = true;
			// a scene's slow drift moves in steps too small to see between two frames of its film: it
			// is drawn again when the film has a new frame or the drift has gone a thousandth
			const sig = [
				a,
				b,
				looks[a]?.tilt.toFixed(2),
				looks[a]?.scale.toFixed(3),
				looks[b]?.tilt.toFixed(2),
				looks[b]?.scale.toFixed(3),
				lens,
				steam.toFixed(3),
				view[0].toFixed(3),
				view[1].toFixed(3),
				// the grain steps a few times a second
				Math.floor(performance.now() / 227)
			].join();
			// the steam only rises over the cup, once the story has come to rest on it
			const cup = !pour && /cup-scroll/.test(slots[a]?.v.currentSrc ?? '') ? steam : 0;
			const now = performance.now();
			const since = now - askedAt;
			askedAt = now;
			// judged only while every frame is drawn, so the time between them is the canvas's own
			if (pour || lens > 0.001) pace(since);
			if (!changed && sig === lastSig) {
				// a pour, or rain on the lens, is never still: it moves with the clock; steam is slow
				// enough that every other frame will do
				if (!pour && lens <= 0.001 && !(cup > 0.001 && now - drawnAt > 30)) return;
			}
			lastSig = sig;
			drawnAt = now;

			gl.uniform2f(U.res, canvas.width, canvas.height);
			gl.uniform2f(U.size, W, H);
			gl.uniform1f(U.persp, persp);
			setScene(0, slots[a], looks[a]);
			gl.uniform1f(U.pour, pour ? 1 : 0);
			gl.uniform1f(U.lens, lens);
			gl.uniform1f(U.time, (performance.now() / 1000) % 1000);
			// how far the near things move, px
			const reach = Math.max(W, H) * 0.008;
			gl.uniform2f(U.view, view[0] * reach, view[1] * reach * 0.6);
			const framing = slots[a]?.v.currentSrc.includes('-sq') ? CUP.sq : CUP.wide;
			gl.uniform4f(U.steam, framing.x, framing.y, framing.hw, cup);
			gl.uniform2f(U.pointer, pointer[0], pointer[1]);
			if (pour) {
				setScene(1, slots[b], looks[b]);
				gl.uniform4f(U.surf, pour.level, pour.lead, pour.phase, pour.amp);
				gl.uniform2f(U.rise, pour.rise.top, pour.rise.bottom);
				gl.uniform1f(U.x0, pour.x);
				if (tone !== pour.tone) {
					tone = pour.tone;
					const c = TONES[tone];
					gl.uniform1f(U.coffee, tone === 'coffee' ? 1 : 0);
					gl.uniform3fv(U.edge, rgb(c.edge));
					gl.uniform3fv(U.body, rgb(c.body));
					gl.uniform3fv(U.core, rgb(c.core));
					gl.uniform3fv(U.glint, rgb(c.glint));
				}
			}
			gl.clearColor(0, 0, 0, 0);
			gl.clear(gl.COLOR_BUFFER_BIT);
			gl.drawArrays(gl.TRIANGLES, 0, 3);
		},
		destroy() {
			sized.disconnect();
			watching.forEach((stop) => stop?.());
			canvas.removeEventListener('webglcontextlost', lost);
			slots.forEach((s, k) => {
				for (const ev of ['seeked', 'loadeddata', 'playing']) s.v.removeEventListener(ev, marks[k]);
				gl.deleteTexture(s.tex);
				gl.deleteTexture(s.depth);
			});
			gl.deleteProgram(prog);
		}
	};
}
