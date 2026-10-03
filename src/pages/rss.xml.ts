import type { APIRoute } from 'astro';
import { allPosts } from '../lib/queries';
import { plainText } from '../lib/markdown';
import { getSettings } from '../lib/settings';

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!,
  );

export const GET: APIRoute = async ({ site }) => {
  const [posts, settings] = await Promise.all([allPosts(), getSettings()]);
  const link = (p: string) => new URL(p, site).href;
  const items = posts
    .slice(0, 30)
    .map(
      (p) => `    <item>
      <title>${esc(p.title)}</title>
      <link>${link(`/blog/${p.slug}`)}</link>
      <guid isPermaLink="true">${link(`/blog/${p.slug}`)}</guid>
      ${p.publishedAt ? `<pubDate>${p.publishedAt.toUTCString()}</pubDate>` : ''}
      <description>${esc(p.excerpt ?? plainText(p.bodyMd, 300))}</description>
    </item>`,
    )
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(settings.siteTitle)} · Blog</title>
    <link>${link('/blog')}</link>
    <atom:link href="${link('/rss.xml')}" rel="self" type="application/rss+xml" />
    <description>${esc(settings.siteDescription || 'News from the French Tech community in Bangkok')}</description>
    <language>en</language>
${items}
  </channel>
</rss>
`;
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=600',
    },
  });
};
