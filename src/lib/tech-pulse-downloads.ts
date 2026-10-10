// Members-only Tech Pulse downloads. While membership is open (Settings > Membership), the report
// PDF of each edition is for members: /tech-pulse asks for an email, a member downloads at once and
// someone new fills the free membership form first, then downloads from their member page once they
// confirm. A cookie remembers a member's browser so they only type their email once. While
// membership is closed, the reports stay free for everyone, as before.
import type { AstroCookies } from 'astro';
import { env } from 'cloudflare:workers';
import { and, eq, like } from 'drizzle-orm';
import { getDb } from '../db';
import { posts, type Member } from '../db/schema';
import { getSettings } from './settings';
import { issueToken, peekToken, TOKEN_TTL } from './tokens';
import { memberByEmail } from './members';
import { isTechPulse, reportFile, reportKey } from './tech-pulse';

export const DOWNLOAD_COOKIE = 'ftbkk_member';

/** Downloads are members-only exactly when membership sign-up is open. */
export async function downloadsForMembers() {
  return (await getSettings()).memberSignupOpen;
}

/** A published Tech Pulse edition with a report, by its blog slug. */
export async function editionBySlug(slug: string) {
  const [p] = await getDb()
    .select()
    .from(posts)
    .where(and(eq(posts.slug, slug), eq(posts.status, 'published')))
    .limit(1);
  if (!p || !isTechPulse(p.title) || !p.publishedAt || p.publishedAt > new Date()) return null;
  const file = reportFile(p);
  return file ? { post: p, file, key: reportKey(p) } : null;
}

/**
 * The edition whose report is this R2 key, if any: /media sends such a key through the members-only
 * download instead of serving it, so a link in a post or an old bookmark can't skip the form.
 */
export async function editionForKey(key: string) {
  if (!/\.pdf$/i.test(key)) return null;
  const rows = await getDb()
    .select()
    .from(posts)
    .where(and(eq(posts.status, 'published'), like(posts.title, '%pulse%')));
  return rows.find((p) => isTechPulse(p.title) && reportKey(p) === key) ?? null;
}

/** The active member this browser was remembered as, else null. */
export async function rememberedMember(cookies: AstroCookies) {
  const row = await peekToken(cookies.get(DOWNLOAD_COOKIE)?.value, 'download');
  if (!row) return null;
  const m = await memberByEmail(row.email);
  return m?.status === 'active' ? m : null;
}

/** Remembers this browser as the member's, for the next downloads. */
export async function rememberMember(cookies: AstroCookies, m: Member, secure: boolean) {
  const token = await issueToken('download', m.email, { refId: m.id });
  cookies.set(DOWNLOAD_COOKIE, token, {
    path: '/',
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: TOKEN_TTL.download,
  });
}

/** The report as a download (never cached: the next person may not be a member). */
export async function serveReport(edition: NonNullable<Awaited<ReturnType<typeof editionBySlug>>>) {
  // A report hosted on another site can only be linked to.
  if (!edition.key)
    return new Response(null, {
      status: 302,
      headers: { Location: edition.file, 'Cache-Control': 'private, no-store' },
    });
  const obj = await env.MEDIA.get(edition.key);
  if (!obj) return new Response('Not found', { status: 404 });
  const name = edition.key.split('/').pop()!;
  const ascii = name.replace(/[^\x20-\x7e]|["\\]/g, '_');
  return new Response(obj.body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      'Content-Length': String(obj.size),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex',
    },
  });
}
