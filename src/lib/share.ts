// Social share images and the texts of social media posts about an event or a blog post.
//
// The 1200x630 share image is drawn in the admin's browser (lib/share-image-client.ts, a canvas)
// from the spec below and stored in R2 as share/<entity>-<id>-<fingerprint>.jpg. The fingerprint
// hashes everything drawn, so a changed title, date, venue or photo makes the image stale; the
// next admin visit to the event or post redraws it. Public pages use the image only while it is
// up to date (shareImageFor), otherwise the cover, as before.
import { z } from 'zod';
import type { Event, Post } from '../db/schema';
import { KIND_NAMES, eventCover, eventKind, type EventCovers } from './event-covers';
import { formatDate, formatTime, mediaUrl, TZ } from './format';
import type { ShareSpec } from './share-spec';

/** Bump when the drawing changes, so every image is redrawn. */
export const SHARE_TEMPLATE_VERSION = 1;
/** Photo used when an event or post has no cover. */
export const SHARE_FALLBACK_PHOTO = '/brand/hero-bangkok.jpg';

export { SHARE_HEIGHT, SHARE_WIDTH, type ShareEntity, type ShareSpec } from './share-spec';

export function eventLabel(series: string) {
  const kind = eventKind(series);
  if (kind !== 'other') return KIND_NAMES[kind];
  return series && series !== 'Other' ? series : 'Event';
}

/** "Thu, 12 November 2026 · 18:30" */
export function eventDateLine(e: Pick<Event, 'startsAt'>) {
  return `${formatDate(e.startsAt, { weekday: 'short' })} · ${formatTime(e.startsAt)}`;
}

export function eventShareSpec(
  e: Pick<Event, 'id' | 'title' | 'series' | 'startsAt' | 'venue' | 'coverKey'>,
  covers: EventCovers | null | undefined,
): ShareSpec {
  return {
    entity: 'event',
    id: e.id,
    label: eventLabel(e.series),
    title: e.title,
    lines: [eventDateLine(e), e.venue ?? ''].filter(Boolean),
    photo: eventCover(e, covers) ?? SHARE_FALLBACK_PHOTO,
  };
}

export function postShareSpec(
  p: Pick<Post, 'id' | 'title' | 'authorName' | 'publishedAt' | 'coverKey'>,
): ShareSpec {
  return {
    entity: 'post',
    id: p.id,
    label: 'Blog',
    title: p.title,
    lines: [
      [p.authorName, p.publishedAt ? formatDate(p.publishedAt) : ''].filter(Boolean).join(' · '),
    ].filter(Boolean),
    photo: mediaUrl(p.coverKey) ?? SHARE_FALLBACK_PHOTO,
  };
}

/** Short hash of everything drawn (10 hex characters). */
export async function shareFingerprint(spec: ShareSpec) {
  const data = new TextEncoder().encode(
    JSON.stringify([SHARE_TEMPLATE_VERSION, spec.label, spec.title, spec.lines, spec.photo]),
  );
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  return [...hash.slice(0, 5)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const shareImageKey = (spec: ShareSpec, fingerprint: string) =>
  `share/${spec.entity}-${spec.id}-${fingerprint}.jpg`;

/** The stored share image when it still matches the event or post, else null. */
export function shareImageFor(key: string | null | undefined, fingerprint: string) {
  return key && key.endsWith(`-${fingerprint}.jpg`) ? mediaUrl(key) : null;
}

// ---------- social media posts ----------

export const NETWORKS = ['linkedin', 'facebook', 'whatsapp'] as const;
export type Network = (typeof NETWORKS)[number];
export const NETWORK_LABELS: Record<Network, string> = {
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  whatsapp: 'WhatsApp',
};

const join = (...parts: (string | null | undefined | false)[]) =>
  parts.filter((p) => p && p.trim()).join('\n\n');

/** The announcement: what, when, where, and the link. */
export function eventLaunchText(
  e: Pick<Event, 'title' | 'startsAt' | 'venue' | 'summary'>,
  url: string,
) {
  return join(
    `${e.title}\n${eventDateLine(e)}${e.venue ? `, ${e.venue}` : ''}`,
    e.summary,
    `Register: ${url}`,
  );
}

/** The day-before reminder. */
export function eventReminderText(e: Pick<Event, 'title' | 'startsAt' | 'venue'>, url: string) {
  return join(
    `Tomorrow: ${e.title}\n${formatTime(e.startsAt)}${e.venue ? `, ${e.venue}` : ''}`,
    `Not registered yet? ${url}`,
  );
}

export function postLaunchText(p: Pick<Post, 'title' | 'excerpt'>, url: string) {
  return join(`New on our blog: ${p.title}`, p.excerpt, `Read it: ${url}`);
}

const HOUR_MS = 3600 * 1000;

/** Default launch time: the next full hour (the cron publishes on the hour). */
export function defaultLaunchAt(now: Date) {
  return new Date(Math.ceil((now.getTime() + 60_000) / HOUR_MS) * HOUR_MS);
}

/** Default reminder time: 09:00 Bangkok, the day before the event. */
export function defaultReminderAt(startsAt: Date) {
  const dayBefore = new Date(startsAt.getTime() - 24 * HOUR_MS);
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(dayBefore);
  return new Date(`${day}T09:00:00+07:00`); // Bangkok is UTC+7 all year
}

/** Opens WhatsApp (app or web) with the text ready to send to a group or a person. */
export const whatsappLink = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;

/**
 * LinkedIn post text uses its "little text" format, where these characters are markup and cut the
 * post when left bare: they are escaped with a backslash.
 */
export function linkedinText(text: string) {
  return text.replace(/[\\|{}@[\]()<>#*_~]/g, (c) => `\\${c}`);
}

// ---------- the schedule form (Admin > Social media posts) ----------

const bangkokInput = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Enter a date and time.')
  .transform((s) => new Date(`${s}:00+07:00`));
const postText = z
  .string()
  .trim()
  .min(1, 'Write the text of the post.')
  .max(2900, 'Keep it under 2,900 characters (LinkedIn allows 3,000).');

export const ScheduleSchema = z
  .object({
    networks: z.array(z.enum(NETWORKS)).default([]),
    launch: z.boolean().default(false),
    launchAt: z.string().optional(),
    launchText: z.string().optional(),
    reminder: z.boolean().default(false),
    reminderAt: z.string().optional(),
    reminderText: z.string().optional(),
  })
  .transform((v, ctx) => {
    const out: { kind: 'launch' | 'reminder'; at: Date; text: string }[] = [];
    if (!v.networks.length)
      ctx.addIssue({ code: 'custom', path: ['networks'], message: 'Pick at least one network.' });
    for (const kind of ['launch', 'reminder'] as const) {
      if (!v[kind]) continue;
      const at = bangkokInput.safeParse(v[`${kind}At`] ?? '');
      const text = postText.safeParse(v[`${kind}Text`] ?? '');
      if (!at.success)
        ctx.addIssue({ code: 'custom', path: [`${kind}At`], message: 'Enter a date and time.' });
      if (!text.success)
        ctx.addIssue({
          code: 'custom',
          path: [`${kind}Text`],
          message: text.error.issues[0]!.message,
        });
      if (at.success && text.success) out.push({ kind, at: at.data, text: text.data });
    }
    if (!v.launch && !v.reminder)
      ctx.addIssue({ code: 'custom', path: ['launch'], message: 'Tick the post or the reminder.' });
    return { networks: v.networks, posts: out };
  });
