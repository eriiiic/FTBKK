import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

/** R2 prefixes that must never be served publicly (database backups hold personal data). */
const PRIVATE_PREFIXES = ['backups/'];

/** Streams R2 objects (images, PDFs). Keys are immutable in practice, so cache for a year. */
export const GET: APIRoute = async ({ params, request }) => {
  const key = params.key;
  if (!key || key.includes('..') || PRIVATE_PREFIXES.some((p) => key.startsWith(p)))
    return new Response('Not found', { status: 404 });
  const obj = await env.MEDIA.get(key, { onlyIf: request.headers, range: request.headers });
  if (!obj) return new Response('Not found', { status: 404 });
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('X-Content-Type-Options', 'nosniff');
  if (key.endsWith('.svg'))
    headers.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
  if (!headers.has('content-type')) headers.set('content-type', guessType(key));
  if (!('body' in obj)) return new Response(null, { status: 304, headers });
  return new Response(obj.body, { status: obj.range ? 206 : 200, headers });
};

function guessType(key: string) {
  const ext = key.split('.').pop()?.toLowerCase();
  return (
    {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      gif: 'image/gif',
      svg: 'image/svg+xml',
      avif: 'image/avif',
      ico: 'image/x-icon',
      pdf: 'application/pdf',
    }[ext ?? ''] ?? 'application/octet-stream'
  );
}
