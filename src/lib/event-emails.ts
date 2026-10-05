import { z } from 'zod';
import type { Event, Registration } from '../db/schema';
import type { EmailMessage } from './email';
import { optionalUrl } from './forms';
import { eventDetails, siteUrl } from './registrations';

/** Who an admin message goes to, and which registration statuses that covers. */
export const AUDIENCES = {
  registered: {
    label: 'Registered',
    hint: 'Everyone with a seat, checked in or not',
    statuses: ['registered', 'attended'],
  },
  attended: {
    label: 'Checked in',
    hint: 'People who came (after the event: slides, thanks)',
    statuses: ['attended'],
  },
  waitlist: { label: 'Waitlist', hint: 'People still waiting for a seat', statuses: ['waitlist'] },
  all: {
    label: 'Everyone not cancelled',
    hint: 'Registered, checked in and waitlist',
    statuses: ['registered', 'attended', 'waitlist'],
  },
} as const satisfies Record<
  string,
  { label: string; hint: string; statuses: readonly Registration['status'][] }
>;
export type Audience = keyof typeof AUDIENCES;
export const AUDIENCE_KEYS = Object.keys(AUDIENCES) as [Audience, ...Audience[]];

export const EventEmailSchema = z
  .object({
    audience: z.enum(AUDIENCE_KEYS, { error: 'Choose who gets the email.' }),
    subject: z.string().trim().min(3, 'Write a subject.').max(150),
    body: z.string().trim().min(10, 'Write the message.').max(10000),
    actionLabel: z.string().trim().max(60).optional().default(''),
    actionUrl: optionalUrl(500),
  })
  .refine((d) => !d.actionLabel || d.actionUrl, {
    path: ['actionUrl'],
    message: 'Add the link for the button, or remove its label.',
  })
  .refine((d) => !d.actionUrl || d.actionLabel, {
    path: ['actionLabel'],
    message: 'Give the button a label.',
  });
export type EventEmailInput = z.infer<typeof EventEmailSchema>;

/**
 * Plain text -> paragraphs: blank lines separate them; single line breaks (an address, a list)
 * stay inside the paragraph and show as line breaks in the email.
 */
export function toParagraphs(body: string) {
  return body
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((p) =>
      p
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .join('\n'),
    )
    .filter(Boolean);
}

/** `{name}` in the subject or message becomes the person's first name. */
export function personalise(text: string, name: string) {
  const first = name.trim().split(/\s+/)[0] || 'there';
  return text.replace(/\{name\}/gi, first);
}

/**
 * One email address per person: walk-ins without an email are skipped, and an address that
 * appears twice (case aside) gets one copy.
 */
export function recipientsFor(
  rows: { name: string; email: string | null; status: Registration['status'] }[],
  audience: Audience,
) {
  const statuses: readonly string[] = AUDIENCES[audience].statuses;
  const seen = new Set<string>();
  const out: { name: string; email: string }[] = [];
  for (const r of rows) {
    const email = r.email?.trim().toLowerCase();
    if (!email || !statuses.includes(r.status) || seen.has(email)) continue;
    seen.add(email);
    out.push({ name: r.name, email });
  }
  return out;
}

/** Recipient counts for every audience, for the radio labels and the confirm prompt. */
export function audienceCounts(
  rows: { name: string; email: string | null; status: Registration['status'] }[],
) {
  return Object.fromEntries(AUDIENCE_KEYS.map((a) => [a, recipientsFor(rows, a).length])) as Record<
    Audience,
    number
  >;
}

/** The email one person gets, in the site's usual layout with the event's date, venue and page. */
export function eventBroadcast(
  e: Pick<Event, 'title' | 'slug' | 'startsAt' | 'endsAt' | 'venue' | 'address'>,
  to: { name: string; email: string },
  m: Pick<EventEmailInput, 'subject' | 'body' | 'actionLabel' | 'actionUrl'>,
  opts: { replyTo?: string } = {},
): EmailMessage {
  return {
    to: to.email,
    subject: personalise(m.subject, to.name),
    paragraphs: toParagraphs(personalise(m.body, to.name)),
    details: [['Event', e.title], ...eventDetails(e)],
    action: m.actionLabel && m.actionUrl ? { label: m.actionLabel, url: m.actionUrl } : undefined,
    links: [{ label: 'Event page', url: siteUrl(`/events/${e.slug}`) }],
    footer: `You get this email because you registered for ${e.title} on french-tech-bangkok.com.`,
    replyTo: opts.replyTo,
  };
}
