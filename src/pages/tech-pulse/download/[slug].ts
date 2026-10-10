import type { APIRoute } from 'astro';
import {
  downloadsForMembers,
  editionBySlug,
  rememberedMember,
  serveReport,
} from '../../../lib/tech-pulse-downloads';

/**
 * The Download buttons of /tech-pulse. While downloads are members-only, a browser remembered as
 * an active member gets the PDF; anyone else goes to the email form on /tech-pulse.
 */
export const GET: APIRoute = async ({ params, cookies }) => {
  const slug = (params.slug ?? '').slice(0, 200);
  const edition = await editionBySlug(slug);
  if (!edition) return new Response('Not found', { status: 404 });
  if ((await downloadsForMembers()) && !(await rememberedMember(cookies)))
    return new Response(null, {
      status: 303,
      headers: {
        Location: `/tech-pulse?edition=${encodeURIComponent(slug)}#download`,
        'Cache-Control': 'private, no-store',
      },
    });
  return serveReport(edition);
};
