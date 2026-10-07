// Scheduled social media posts (Admin > Social media). The hourly cron publishes what is due:
// on LinkedIn and Facebook through their APIs once the page is connected (Worker secrets, see
// docs/deploy.md), and by email otherwise. WhatsApp has no API for groups, so a WhatsApp post is
// always an email to the admin who scheduled it, with the text and a one-tap WhatsApp link.
import { env } from 'cloudflare:workers';
import { and, eq, lte } from 'drizzle-orm';
import { getDb } from '../db';
import {
  events,
  posts,
  socialPosts,
  type Event,
  type Post,
  type SocialPost,
  type SocialResult,
} from '../db/schema';
import { sendEmail } from './email';
import { renderTemplate, splitParagraphs } from './email-templates';
import { audit } from './orgs';
import { getSettings } from './settings';
import { siteUrl } from './site';
import { mediaUrl } from './format';
import type { EventCovers } from './event-covers';
import {
  eventLaunchText,
  eventReminderText,
  eventShareSpec,
  linkedinText,
  NETWORK_LABELS,
  postLaunchText,
  postShareSpec,
  shareFingerprint,
  shareImageFor,
  whatsappLink,
  type Network,
  type ShareSpec,
} from './share';

/** Networks the site can post to by itself right now. */
export function connectedNetworks(): Record<'linkedin' | 'facebook', boolean> {
  return {
    linkedin: Boolean(env.LINKEDIN_ACCESS_TOKEN && env.LINKEDIN_ORGANIZATION_ID),
    facebook: Boolean(env.FACEBOOK_PAGE_TOKEN && env.FACEBOOK_PAGE_ID),
  };
}

export interface ShareTarget {
  title: string;
  description: string;
  url: string;
  /** R2 key of the image (share image, else cover), for LinkedIn's thumbnail. */
  imageKey: string | null;
  /** Public URL of that image, for the email. */
  imageUrl: string | null;
  /** Why it should not be posted any more (event cancelled, post unpublished…). */
  stop?: string;
}

/** What a social post links to, read fresh at publishing time. */
export async function shareTarget(
  entity: SocialPost['entity'],
  entityId: number,
): Promise<ShareTarget | null> {
  const db = getDb();
  if (entity === 'event') {
    const [e] = await db.select().from(events).where(eq(events.id, entityId)).limit(1);
    if (!e) return null;
    return eventTarget(e, (await getSettings()).eventCovers);
  }
  const [p] = await db.select().from(posts).where(eq(posts.id, entityId)).limit(1);
  return p ? postTarget(p) : null;
}

async function eventTarget(e: Event, covers: EventCovers): Promise<ShareTarget> {
  const fresh = shareImageFor(e.shareImageKey, await shareFingerprint(eventShareSpec(e, covers)));
  const imageKey = fresh ? e.shareImageKey : (e.coverKey ?? null);
  return {
    title: e.title,
    description: e.summary ?? '',
    url: siteUrl(`/events/${e.slug}`),
    imageKey,
    imageUrl: imageKey ? siteUrl(mediaUrl(imageKey)!) : null,
    stop:
      e.status === 'cancelled'
        ? 'The event was cancelled.'
        : e.status !== 'published'
          ? 'The event is not published.'
          : undefined,
  };
}

async function postTarget(p: Post): Promise<ShareTarget> {
  const fresh = shareImageFor(p.shareImageKey, await shareFingerprint(postShareSpec(p)));
  const imageKey = fresh ? p.shareImageKey : (p.coverKey ?? null);
  return {
    title: p.title,
    description: p.excerpt ?? '',
    url: siteUrl(`/blog/${p.slug}`),
    imageKey,
    imageUrl: imageKey ? siteUrl(mediaUrl(imageKey)!) : null,
    stop: p.status !== 'published' ? 'The post is not published.' : undefined,
  };
}

/**
 * Whether a reminder still makes sense: the event starts within the next 36 hours. A reminder
 * left over from an event whose date moved is cancelled instead of posted.
 */
export function reminderStillValid(startsAt: Date, now: Date) {
  const ms = startsAt.getTime() - now.getTime();
  return ms > 0 && ms <= 36 * 3600 * 1000;
}

// ---------- the networks ----------

/** LinkedIn API versions are monthly (YYYYMM) and live for a year: use the one from 2 months ago. */
export function linkedinVersion(now: Date) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1));
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function apiError(res: Response, network: string) {
  const body = await res.text().catch(() => '');
  if (res.status === 401)
    return `${network} refused the access token (expired or revoked): renew it (docs/deploy.md).`;
  return `${network} answered ${res.status}: ${body.slice(0, 300)}`;
}

/** Posts on the LinkedIn page: the text, with a link card (title, description, image). */
async function postToLinkedIn(text: string, t: ShareTarget, now: Date): Promise<SocialResult> {
  const author = `urn:li:organization:${env.LINKEDIN_ORGANIZATION_ID}`;
  const headers = {
    Authorization: `Bearer ${env.LINKEDIN_ACCESS_TOKEN}`,
    'LinkedIn-Version': linkedinVersion(now),
    'X-Restli-Protocol-Version': '2.0.0',
    'Content-Type': 'application/json',
  };
  // LinkedIn doesn't read the page's og:image for API posts: the thumbnail is uploaded first.
  let thumbnail: string | undefined;
  const obj = t.imageKey ? await env.MEDIA.get(t.imageKey) : null;
  if (obj) {
    const init = await fetch('https://api.linkedin.com/rest/images?action=initializeUpload', {
      method: 'POST',
      headers,
      body: JSON.stringify({ initializeUploadRequest: { owner: author } }),
    });
    if (!init.ok) return { ok: false, error: await apiError(init, 'LinkedIn') };
    const { value } = (await init.json()) as { value: { uploadUrl: string; image: string } };
    const put = await fetch(value.uploadUrl, {
      method: 'PUT',
      headers: { Authorization: headers.Authorization },
      body: await obj.arrayBuffer(),
    });
    if (!put.ok) return { ok: false, error: await apiError(put, 'LinkedIn') };
    thumbnail = value.image;
  }
  const res = await fetch('https://api.linkedin.com/rest/posts', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      author,
      commentary: linkedinText(text),
      visibility: 'PUBLIC',
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      content: {
        article: {
          source: t.url,
          title: t.title.slice(0, 200),
          description: t.description.slice(0, 250) || undefined,
          thumbnail,
        },
      },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    }),
  });
  if (!res.ok) return { ok: false, error: await apiError(res, 'LinkedIn') };
  const urn = res.headers.get('x-restli-id');
  return { ok: true, url: urn ? `https://www.linkedin.com/feed/update/${urn}` : undefined };
}

/** Posts on the Facebook page; Facebook builds the link preview from the page's og:image. */
async function postToFacebook(text: string, t: ShareTarget): Promise<SocialResult> {
  const res = await fetch(`https://graph.facebook.com/v23.0/${env.FACEBOOK_PAGE_ID}/feed`, {
    method: 'POST',
    body: new URLSearchParams({
      message: text,
      link: t.url,
      access_token: env.FACEBOOK_PAGE_TOKEN ?? '',
    }),
  });
  if (!res.ok) return { ok: false, error: await apiError(res, 'Facebook') };
  const { id } = (await res.json()) as { id?: string };
  return { ok: true, url: id ? `https://www.facebook.com/${id}` : undefined };
}

// ---------- publishing ----------

/**
 * Publishes one social post now: each connected network through its API, the others (and any
 * that failed) in one email to whoever scheduled it.
 */
export async function publishSocialPost(row: SocialPost, now: Date, fromAdmin = false) {
  const db = getDb();
  // Claim it first, so two runs never post twice.
  const claimed = await db
    .update(socialPosts)
    .set({ status: 'sent', sentAt: now })
    .where(and(eq(socialPosts.id, row.id), eq(socialPosts.status, 'scheduled')))
    .returning({ id: socialPosts.id });
  if (!claimed.length) return 'skipped';
  const cancel = async (note: string) => {
    await db
      .update(socialPosts)
      .set({ status: 'cancelled', note, sentAt: null })
      .where(eq(socialPosts.id, row.id));
    return 'cancelled';
  };
  const target = await shareTarget(row.entity, row.entityId);
  if (!target) return cancel('The event or post was deleted.');
  if (target.stop) return cancel(target.stop);
  // "Post now" from the admin is a deliberate choice: no date check.
  if (row.kind === 'reminder' && row.entity === 'event' && !fromAdmin) {
    const [e] = await db.select().from(events).where(eq(events.id, row.entityId)).limit(1);
    if (e && !reminderStillValid(e.startsAt, now))
      return cancel('The event is not tomorrow any more (its date changed).');
  }

  const connected = connectedNetworks();
  const results: Record<string, SocialResult> = {};
  for (const n of row.networks) {
    if (n === 'whatsapp' || !connected[n]) continue;
    try {
      results[n] =
        n === 'linkedin'
          ? await postToLinkedIn(row.text, target, now)
          : await postToFacebook(row.text, target);
    } catch (e) {
      results[n] = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
  const byHand = row.networks.filter((n) => !results[n]?.ok);
  if (byHand.length) {
    const sent = await sendPostByHandEmail(row, target, byHand, results);
    for (const n of byHand)
      results[n] = {
        ...results[n],
        ok: sent.ok,
        manual: true,
        error: results[n]?.error ?? sent.error,
      };
  }
  const ok = row.networks.every((n) => results[n]?.ok);
  await db
    .update(socialPosts)
    .set({ status: ok ? 'sent' : 'failed', results })
    .where(eq(socialPosts.id, row.id));
  return ok ? 'sent' : 'failed';
}

async function sendPostByHandEmail(
  row: SocialPost,
  t: ShareTarget,
  networks: Network[],
  results: Record<string, SocialResult>,
) {
  const errors = networks
    .map((n) => results[n]?.error && `${NETWORK_LABELS[n]}: ${results[n]!.error}`)
    .filter(Boolean) as string[];
  const w = await renderTemplate('admin.social-post', {
    title: t.title,
    networks: networks.map((n) => NETWORK_LABELS[n]).join(', '),
    text: splitParagraphs(row.text),
    errors,
  });
  return sendEmail({
    to: row.createdBy,
    subject: w.subject,
    paragraphs: w.paragraphs,
    details: [
      ['Link', t.url],
      ...(t.imageUrl ? ([['Image', t.imageUrl]] as [string, string][]) : []),
    ],
    action: networks.includes('whatsapp')
      ? { label: w.buttonLabel, url: whatsappLink(row.text) }
      : undefined,
    links: [{ label: 'Social media in the admin', url: siteUrl('/admin/social') }],
  });
}

/** Hourly: publishes every social post that is due. */
export async function runSocialPosts(now: Date) {
  const due = await getDb()
    .select()
    .from(socialPosts)
    .where(and(eq(socialPosts.status, 'scheduled'), lte(socialPosts.scheduledAt, now)));
  const out: Record<string, number> = {};
  for (const row of due) {
    const r = await publishSocialPost(row, now);
    out[r] = (out[r] ?? 0) + 1;
  }
  return out;
}

/** An event or post as the Social media screens show it. */
export interface ShareItem {
  entity: SocialPost['entity'];
  id: number;
  title: string;
  published: boolean;
  /** Events only. */
  startsAt: Date | null;
  url: string;
  editUrl: string;
  spec: ShareSpec;
  fingerprint: string;
  /** The stored share image when up to date. */
  imageUrl: string | null;
  launchText: string;
  reminderText: string | null;
}

export async function eventShareItem(e: Event, covers: EventCovers): Promise<ShareItem> {
  const spec = eventShareSpec(e, covers);
  const fingerprint = await shareFingerprint(spec);
  const url = siteUrl(`/events/${e.slug}`);
  return {
    entity: 'event',
    id: e.id,
    title: e.title,
    published: e.status === 'published',
    startsAt: e.startsAt,
    url,
    editUrl: `/admin/events/${e.id}`,
    spec,
    fingerprint,
    imageUrl: shareImageFor(e.shareImageKey, fingerprint),
    launchText: eventLaunchText(e, url),
    reminderText: eventReminderText(e, url),
  };
}

export async function postShareItem(p: Post): Promise<ShareItem> {
  const spec = postShareSpec(p);
  const fingerprint = await shareFingerprint(spec);
  const url = siteUrl(`/blog/${p.slug}`);
  return {
    entity: 'post',
    id: p.id,
    title: p.title,
    published: p.status === 'published',
    startsAt: null,
    url,
    editUrl: `/admin/posts/${p.id}`,
    spec,
    fingerprint,
    imageUrl: shareImageFor(p.shareImageKey, fingerprint),
    launchText: postLaunchText(p, url),
    reminderText: null,
  };
}

export async function loadShareItem(entity: string, id: number): Promise<ShareItem | null> {
  const db = getDb();
  if (entity === 'event') {
    const [e] = await db.select().from(events).where(eq(events.id, id)).limit(1);
    return e ? eventShareItem(e, (await getSettings()).eventCovers) : null;
  }
  if (entity === 'post') {
    const [p] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
    return p ? postShareItem(p) : null;
  }
  return null;
}

/** The row buttons of Social media: cancel, post now, delete. */
export async function socialPostAction(
  action: string,
  id: number,
  actor: string,
  now: Date,
): Promise<{ tone: 'success' | 'danger'; text: string } | null> {
  const db = getDb();
  const [row] = await db.select().from(socialPosts).where(eq(socialPosts.id, id)).limit(1);
  if (!row) return null;
  if (action === 'cancel' && row.status === 'scheduled') {
    await db.update(socialPosts).set({ status: 'cancelled' }).where(eq(socialPosts.id, id));
    await audit(actor, 'cancel', 'social_post', id, null, null);
    return { tone: 'success', text: 'Cancelled.' };
  }
  if (action === 'send-now' && row.status === 'scheduled') {
    await audit(actor, 'send-now', 'social_post', id, null, null);
    const r = await publishSocialPost(row, now, true);
    return r === 'sent'
      ? { tone: 'success', text: 'Done. See the result in the table.' }
      : { tone: 'danger', text: `Not posted (${r}). See the table for why.` };
  }
  if (action === 'delete' && row.status !== 'scheduled') {
    await db.delete(socialPosts).where(eq(socialPosts.id, id));
    await audit(actor, 'delete', 'social_post', id, null, null);
    return { tone: 'success', text: 'Removed from the list.' };
  }
  return null;
}
