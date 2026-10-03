import type { APIRoute } from 'astro';
import { eventBySlug } from '../../../lib/queries';
import { eventIcs } from '../../../lib/ics';

export const GET: APIRoute = async ({ params, site }) => {
  const e = await eventBySlug(params.slug!);
  if (!e) return new Response('Not found', { status: 404 });
  const body = eventIcs({
    ...e,
    url: new URL(`/events/${e.slug}`, site).href,
    cancelled: e.status === 'cancelled',
  });
  return new Response(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${e.slug}.ics"`,
      'Cache-Control': 'public, s-maxage=60',
    },
  });
};
