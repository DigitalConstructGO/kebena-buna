/**
 * Links to records outside a table — a `SingleTable` row's `href`, a header button. Resolved with
 * the kit's entity map and the viewer's access, exactly as table cells are, so a detail page never
 * links to a page its viewer would be refused.
 *
 *     const href = useLinks();          // during component init
 *     { name: 'Customer', value: o.customerName, href: href('customer', o.customerId) }
 */
import { useKit } from '@nahu/admin-kit/context';
import { entityHref } from '@nahu/admin-kit/entityLinks';
import { formatDateTime } from '#lib/format.ts';

export type Href = (entity: string, id: string | number | null | undefined) => string | undefined;

export function useLinks(): Href {
	const kit = useKit();
	return (entity, id) =>
		entityHref(kit.entities, entity, id, (path) => kit.canOpen(path)) ?? undefined;
}

/** The created/updated rows of a record's `SingleTable`, from `stampsOf` on the server. */
export function stampRows(
	s: {
		createdById: string | null;
		createdByName: string | null;
		createdAt: Date | string | null;
		updatedById: string | null;
		updatedByName: string | null;
		updatedAt: Date | string | null;
	},
	href: Href
) {
	return [
		{ name: 'Created by', value: s.createdByName ?? '—', href: href('user', s.createdById) },
		{ name: 'Created', value: formatDateTime(s.createdAt) },
		{ name: 'Last changed by', value: s.updatedByName ?? '—', href: href('user', s.updatedById) },
		{ name: 'Last changed', value: formatDateTime(s.updatedAt) }
	];
}
