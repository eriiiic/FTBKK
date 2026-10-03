import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) =>
  new Response(
    `User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/
Disallow: /ecosystem/manage
Disallow: /ecosystem/verify
Disallow: /ecosystem/confirm
Disallow: /ecosystem/claim/

Sitemap: ${new URL('/sitemap.xml', site).href}
`,
    {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, s-maxage=86400',
      },
    },
  );
