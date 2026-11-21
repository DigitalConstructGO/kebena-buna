import { gsap } from 'gsap';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { SplitText } from 'gsap/SplitText';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

let registered = false;

/** Register the GSAP plugins once, in the browser only. */
export function setupGsap() {
	if (!registered) {
		gsap.registerPlugin(DrawSVGPlugin, SplitText, ScrollTrigger);
		registered = true;
	}
	return { gsap, SplitText, ScrollTrigger };
}
