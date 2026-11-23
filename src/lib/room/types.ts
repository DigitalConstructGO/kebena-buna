/**
 * The look-around room: one photo wrapped around the visitor, with points to press.
 * Shared by the viewer, the hotspots, the HUD and the page, so each can be built on its own.
 * Angles are in degrees. Yaw 0 is the centre of the picture, positive turns right;
 * pitch 0 is the horizon, positive looks up.
 */

export type RoomPano = {
	/** Full-size picture. */
	src: string;
	/** Small blurred stand-in shown while the full picture loads. */
	lowSrc?: string;
	/**
	 * How much of a full turn the picture covers. 360 is a complete equirectangular
	 * panorama; less is a wide picture wrapped on part of a cylinder, and the viewer
	 * stops the visitor turning past its edges.
	 */
	span: number;
	/** How tall the picture is, as an angle. 180 for a full equirectangular panorama. */
	vspan: number;
	/** Where the visitor is looking when they arrive. */
	start: { yaw: number; pitch: number };
};

/** Something in the room the visitor can press to learn about. */
export type RoomHotspot = {
	id: string;
	yaw: number;
	pitch: number;
	/** Short name shown next to the point, e.g. "The jebena". */
	label: string;
	title: string;
	text: string;
	photo?: { src: string; alt: string };
};

/** A doorway to somewhere else. */
export type RoomExit = {
	id: string;
	yaw: number;
	pitch: number;
	label: string;
	href: string;
};

export type RoomScene = {
	id: string;
	title: string;
	/** One line under the title on arrival. */
	intro: string;
	/** Describes the picture for people who cannot see it. */
	alt: string;
	pano: RoomPano;
	hotspots: RoomHotspot[];
	exits: RoomExit[];
};

export type RoomView = {
	yaw: number;
	pitch: number;
	/** Vertical field of view of the camera. */
	fov: number;
};

/** A point in the room placed on screen, in CSS pixels from the viewer's top-left corner. */
export type Projected = {
	x: number;
	y: number;
	/** False when the point is behind the visitor or outside the frame. */
	visible: boolean;
};

/**
 * What the viewer hands to everything drawn on top of it.
 * Overlays subscribe and move their own elements; nothing here goes through Svelte state,
 * because it changes every frame while the visitor is turning.
 */
export type ViewerApi = {
	getView(): RoomView;
	project(yaw: number, pitch: number): Projected;
	/** Called once now and then whenever the view or the viewer's size changes, at most once a frame. */
	subscribe(fn: (view: RoomView) => void): () => void;
	/** Turn smoothly to face a point. Resolves when the turn ends (at once under reduced motion). */
	lookAt(yaw: number, pitch: number, opts?: { fov?: number; duration?: number }): Promise<void>;
	/** The limits the visitor can turn within; yaw is null when the picture is a full circle. */
	limits(): { yaw: [number, number] | null; pitch: [number, number] };
};
