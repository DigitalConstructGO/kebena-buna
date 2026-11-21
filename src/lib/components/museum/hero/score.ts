/**
 * The hero's music. Any track works: the story keeps its own pace and the
 * music loops underneath it, so the client can swap the file from the
 * dashboard without re-timing a single scene. Only the storm colours it: it
 * starts muffled and opens up as the rain clears.
 */
export const SCORE_SRC = '/hero/score.mp3';
/** Story time when the rain has cleared; the beat pulse only runs after it. */
export const CLEAR = 4.4;

/** Low-pass cutoff (Hz) for a story time: muffled in the storm, wide open once it clears. */
function cutoff(t: number) {
	const keys: [number, number][] = [
		[0, 650],
		[2.6, 900],
		[4.6, 20000]
	];
	if (t <= keys[0][0]) return keys[0][1];
	for (let i = 1; i < keys.length; i++) {
		const [t1, f1] = keys[i];
		if (t <= t1) {
			const [t0, f0] = keys[i - 1];
			const p = (t - t0) / (t1 - t0);
			return Math.exp(Math.log(f0) + (Math.log(f1) - Math.log(f0)) * p);
		}
	}
	return keys[keys.length - 1][1];
}

export function createScore(url: string = SCORE_SRC) {
	let ac: AudioContext | null = null;
	let buffer: AudioBuffer | null = null;
	let loading: Promise<void> | null = null;
	let src: AudioBufferSourceNode | null = null;
	let startedAt = 0;
	/** Where in the track to pick up again after a pause. */
	let offset = 0;
	let on = false;
	let fading: ReturnType<typeof setTimeout> | undefined;
	let master: GainNode;
	let filter: BiquadFilterNode;
	let rainGain: GainNode;
	let analyser: AnalyserNode;
	let freq: Uint8Array<ArrayBuffer>;
	let last = { t: 0, running: false, rain: 0 };

	const build = () => {
		ac = new AudioContext();
		master = ac.createGain();
		master.gain.value = 0;
		analyser = ac.createAnalyser();
		analyser.fftSize = 256;
		analyser.smoothingTimeConstant = 0.72;
		freq = new Uint8Array(analyser.frequencyBinCount);
		filter = ac.createBiquadFilter();
		filter.type = 'lowpass';
		filter.Q.value = 0.9;
		filter.frequency.value = cutoff(0);
		filter.connect(master);

		// rain: looped noise, band-limited to a hiss with a little body
		const noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
		const d = noise.getChannelData(0);
		let b = 0;
		for (let i = 0; i < d.length; i++) {
			const white = Math.random() * 2 - 1;
			b = 0.97 * b + 0.03 * white;
			d[i] = white * 0.55 + b * 2.2;
		}
		const rainSrc = ac.createBufferSource();
		rainSrc.buffer = noise;
		rainSrc.loop = true;
		const hp = ac.createBiquadFilter();
		hp.type = 'highpass';
		hp.frequency.value = 380;
		const lp = ac.createBiquadFilter();
		lp.type = 'lowpass';
		lp.frequency.value = 7500;
		rainGain = ac.createGain();
		rainGain.gain.value = 0;
		rainSrc.connect(hp).connect(lp).connect(rainGain).connect(master);
		rainSrc.start();

		master.connect(analyser).connect(ac.destination);
	};

	const load = () =>
		(loading ??= fetch(url)
			.then((r) => r.arrayBuffer())
			.then((a) => ac!.decodeAudioData(a))
			.then((b) => {
				buffer = b;
			}));

	const stopSrc = () => {
		if (!src) return;
		src.onended = null;
		try {
			src.stop();
		} catch {
			/* already stopped */
		}
		src.disconnect();
		src = null;
	};

	const startAt = (at: number) => {
		if (!ac || !buffer) return;
		stopSrc();
		const from = ((at % buffer.duration) + buffer.duration) % buffer.duration;
		const s = ac.createBufferSource();
		s.buffer = buffer;
		s.loop = true;
		s.connect(filter);
		s.start(ac.currentTime + 0.01, from);
		startedAt = ac.currentTime + 0.01 - from;
		s.onended = () => {
			if (src === s) src = null;
		};
		src = s;
	};

	return {
		get on() {
			return on;
		},
		/** Must run inside a user gesture: browsers only unlock audio on one. */
		async enable() {
			if (!ac) build();
			on = true;
			await ac!.resume();
			await load();
			if (!on) return;
			const now = ac!.currentTime;
			master.gain.cancelScheduledValues(now);
			master.gain.setTargetAtTime(1, now, 0.25);
			this.update(last.t, last.running, last.rain, true);
		},
		disable() {
			on = false;
			if (!ac) return;
			const now = ac.currentTime;
			master.gain.cancelScheduledValues(now);
			master.gain.setTargetAtTime(0, now, 0.12);
			setTimeout(() => {
				if (on) return;
				stopSrc();
				void ac?.suspend();
			}, 600);
		},
		/** Called on every story tick, and whenever the story is paused, played or seeked. The track itself never jumps with the story. */
		update(t: number, running: boolean, rain: number, force = false) {
			last = { t, running, rain };
			if (!on || !ac || !buffer) return;
			const now = ac.currentTime;
			filter.frequency.setTargetAtTime(cutoff(t), now, 0.06);
			rainGain.gain.setTargetAtTime(rain * 0.28, now, 0.15);
			if (!running) {
				if (src) offset = now - startedAt;
				stopSrc();
				return;
			}
			if (fading || force) {
				clearTimeout(fading);
				fading = undefined;
				master.gain.cancelScheduledValues(now);
				master.gain.setTargetAtTime(1, now, 0.25);
			}
			if (!src) startAt(offset);
		},
		/** Start the track from its top (on replay). */
		rewind() {
			offset = 0;
			stopSrc();
		},
		/** The story has ended: let the music fade out on its own. */
		release() {
			last.running = false;
			if (!on || !ac) return;
			const now = ac.currentTime;
			master.gain.cancelScheduledValues(now);
			master.gain.setTargetAtTime(0, now, 1.6);
			clearTimeout(fading);
			fading = setTimeout(() => {
				fading = undefined;
				if (src && ac) offset = ac.currentTime - startedAt;
				stopSrc();
			}, 8000);
		},
		/** Four smoothed bands, 0..1, for meters and the beat pulse. */
		bands(out: number[]) {
			if (!on || !ac || ac.state !== 'running') {
				out.fill(0);
				return out;
			}
			analyser.getByteFrequencyData(freq);
			const edges = [1, 4, 12, 32, 80];
			for (let k = 0; k < 4; k++) {
				let sum = 0;
				for (let i = edges[k]; i < edges[k + 1]; i++) sum += freq[i];
				out[k] = sum / (edges[k + 1] - edges[k]) / 255;
			}
			return out;
		},
		/** Dev aid: where the score thinks it is. */
		inspect() {
			return {
				state: ac?.state,
				loaded: !!buffer,
				playing: !!src,
				pos: ac ? ac.currentTime - startedAt : 0,
				cutoff: filter?.frequency.value,
				rain: rainGain?.gain.value
			};
		},
		pauseForHidden(hidden: boolean) {
			if (!ac || !on) return;
			if (hidden) void ac.suspend();
			else void ac.resume();
		},
		destroy() {
			on = false;
			clearTimeout(fading);
			stopSrc();
			void ac?.close();
			ac = null;
		}
	};
}
