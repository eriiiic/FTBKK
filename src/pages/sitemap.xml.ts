import type { APIRoute } from 'astro';
import {
  allPosts,
  categoriesWithCounts,
  pastEvents,
  publishedOrganisations,
  upcomingEvents,
} from '../lib/queries';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** Built from D1 on each request (edge-cached for an hour). */
export const GET: APIRoute = async ({ site }) => {
  const base = site?.href ?? 'https://www.french-tech-bangkok.com/';
  const [up, past, posts, cats, orgs] = await Promise.all([
    upcomingEvents(),
    pastEvents(),
    allPosts(),
    categoriesWithCounts(),
    publishedOrganisations(),
  ]);
  const urls: { loc: string; lastmod?: Date }[] = [
    { loc: '' },
    { loc: 'ecosystem' },
    { loc: 'ecosystem/submit' },
    { loc: 'events' },
    { loc: 'blog' },
    { loc: 'tech-pulse' },
    { loc: 'about' },
    { loc: 'th' },
    { loc: 'join' },
    { loc: 'code-of-conduct' },
    { loc: 'privacy' },
    ...[...up, ...past].map((e) => ({ loc: `events/${e.slug}`, lastmod: e.updatedAt })),
    ...posts.map((p) => ({ loc: `blog/${p.slug}`, lastmod: p.updatedAt })),
    ...cats.filter((c) => c.count > 0).map((c) => ({ loc: `blog/category/${c.slug}` })),
    ...orgs.map((o) => ({ loc: `ecosystem/${o.slug}`, lastmod: o.updatedAt })),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `  <url><loc>${esc(new URL(u.loc, base).href)}</loc>${u.lastmod ? `<lastmod>${u.lastmod.toISOString().slice(0, 10)}</lastmod>` : ''}</url>`,
  )
  .join('\n')}
</urlset>
`;
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600',
    },
  });
};
