/**
 * The kit's own words (form controls, date fields, the picture viewer) as the public site's
 * messages, so they follow the page's language and Website › Site text. Both public layouts pass
 * this to `setKitLabels`; it's read afresh on each render, so a language switch reaches them.
 */
import type { KitLabels } from '@nahu/admin-kit/labels';
import { m } from '#lib/i18n.ts';
import { getLocale } from '#lib/paraglide/runtime.js';

/** How the kit writes dates in each language. */
const DATE_LOCALES: Record<string, string> = {
	en: 'en-GB',
	am: 'am-ET',
	om: 'om-ET',
	ar: 'ar',
	it: 'it-IT',
	fr: 'fr-FR'
};

export const publicKitLabels = (): Partial<KitLabels> => ({
	uploadPrompt: m.site_upload_prompt(),
	uploadDropHere: m.site_upload_drop(),
	uploadOptimizing: m.site_upload_optimizing(),
	uploadOptimized: m.site_upload_optimized(),
	uploadHint: m.site_kit_upload_hint(),
	clear: m.site_remove(),
	preview: m.site_preview(),
	calendarEthiopian: m.site_cal_ethiopian(),
	calendarGregorian: m.site_cal_gregorian(),
	calendarEthiopianShort: m.site_cal_ethiopian_short(),
	calendarGregorianShort: m.site_cal_gregorian_short(),
	calendarSwitch: m.site_cal_switch(),
	close: m.site_kit_close(),
	loading: m.site_kit_loading(),
	fixTheFollowing: m.site_kit_fix_following(),
	select: (what) => m.site_kit_select({ what }),
	searchFor: (what) => m.site_kit_search_for({ what }),
	noneFound: (what) => m.site_kit_none_found({ what }),
	clearSelection: m.site_kit_clear_selection(),
	dateLocale: DATE_LOCALES[getLocale()] ?? 'en-GB',
	dateDay: m.site_kit_date_day(),
	dateMonth: m.site_kit_date_month(),
	dateYear: m.site_kit_date_year(),
	dateNoSuchDay: m.site_kit_date_no_such_day(),
	dateOutOfRange: m.site_kit_date_out_of_range(),
	pickADate: m.site_kit_pick_date(),
	notSet: m.site_kit_not_set(),
	selectMonthYear: m.site_kit_select_month_year(),
	viewerPosition: (index, count) => m.site_kit_viewer_position({ index, count }),
	viewerPrevious: m.site_kit_viewer_previous(),
	viewerNext: m.site_kit_viewer_next(),
	viewerZoomIn: m.site_kit_viewer_zoom_in(),
	viewerZoomOut: m.site_kit_viewer_zoom_out(),
	viewerZoomReset: m.site_kit_viewer_zoom_reset()
});
