import { servePublicFile } from '@nahu/admin-kit/server/servePublicFile';
import { publicImageNames } from '#lib/server/site.ts';

/**
 * Pictures the public site shows — product, event, plan and origin photos — at `/media/{name}`
 * (`publicFileUrl`). Only names found in a public image column are served; anything else, like a
 * trade licence or a member's photo, is a 404.
 */
export const GET = servePublicFile({ isPublic: async (name) => (await publicImageNames()).has(name) });
