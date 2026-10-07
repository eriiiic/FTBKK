import type { APIRoute } from 'astro';
import { siteUrl } from '../lib/site';

export const GET: APIRoute = () =>
  new Response(
    `User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/
Disallow: /ecosystem/manage
Disallow: /ecosystem/verify
Disallow: /ecosystem/confirm
Disallow: /ecosystem/claim/
Disallow: /my-data

Sitemap: ${siteUrl('/sitemap.xml')}
`,
    {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, s-maxage=86400',
      },
    },
  );
