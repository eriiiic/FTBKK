// "Email the community" (Emails and social media > Email the community): one email, written each
// time in Markdown, to the active members, the newsletter subscribers, every contact, the people
// in some groups or with some tags, a list imported from a CSV file or a selection of contacts. Lines such as {{event: slug}} become cards.
import { z } from 'zod';
import { and, desc, eq, gte, inArray, isNotNull } from 'drizzle-orm';
import { env } from 'cloudflare:workers';
import { getDb } from '../db';
import { communityEmails, events, members, posts } from '../db/schema';
import type { EmailMessage } from './email';
import { email as emailField, optionalUrl } from './forms';
import { personalise } from './event-emails';
import { loadContacts, type Contact } from './contacts';
import { siteOrigin, siteUrl } from './site';
import { parseDelimited } from './csv';
import { cardKey, cardRefs, emailMarkdown, type EmailCard } from './email-markdown';
import { eventCover } from './event-covers';
import { formatDate, formatEventDate, mediaUrl } from './format';
import { getSettings } from './settings';

export const COMMUNITY_AUDIENCES = {
  members: { label: 'Members', hint: 'Every active member' },
  newsletter: { label: 'Newsletter subscribers', hint: 'Contacts who agreed to the newsletter' },
  all: {
    label: 'All contacts',
    hint: 'Everyone with an email in Contacts, except those who said no to emails',
  },
  segment: {
    label: 'Groups and tags',
    hint: 'The people in the groups or with the tags you pick, except those who said no to emails',
  },
  csv: { label: 'Imported list', hint: 'The people in a CSV file you upload below' },
  contacts: { label: 'Selected contacts', hint: 'The people you ticked in Contacts' },
} as const;
export type CommunityAudience = keyof typeof COMMUNITY_AUDIENCES;
export const COMMUNITY_AUDIENCE_KEYS = Object.keys(COMMUNITY_AUDIENCES) as [
  CommunityAudience,
  ...CommunityAudience[],
];

export const CommunityEmailSchema = z
  .object({
    audience: z.enum(COMMUNITY_AUDIENCE_KEYS, { error: 'Choose who gets the email.' }),
    subject: z.string().trim().min(3, 'Write a subject.').max(150),
    body: z.string().trim().min(10, 'Write the message.').max(20000),
    actionLabel: z.string().trim().max(60).optional().default(''),
    actionUrl: optionalUrl(500),
    /** For segment: tag keys and group ids (people with any of them get the email). */
    segTags: z.array(z.string().max(80)).max(100).optional().default([]),
    segGroups: z.array(z.coerce.number().int().positive()).max(200).optional().default([]),
  })
  .refine((d) => d.audience !== 'segment' || d.segTags.length + d.segGroups.length > 0, {
    path: ['audience'],
    message: 'Pick at least one group or tag.',
  })
  .refine((d) => !d.actionLabel || d.actionUrl, {
    path: ['actionUrl'],
    message: 'Add the link for the button, or remove its label.',
  })
  .refine((d) => !d.actionUrl || d.actionLabel, {
    path: ['actionLabel'],
    message: 'Give the button a label.',
  });
export type CommunityEmailInput = z.infer<typeof CommunityEmailSchema>;

export interface Recipient {
  name: string;
  email: string;
}

/** One copy per address (case aside); people without an email are left out. */
export function uniqueRecipients(rows: { name: string; email: string | null }[]) {
  const seen = new Set<string>();
  const out: Recipient[] = [];
  for (const r of rows) {
    const email = r.email?.trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    out.push({ name: r.name, email });
  }
  return out;
}

/**
 * Said no to emails: the team recorded "no" to the newsletter on their contact card, or they
 * unsubscribed from their data page (registrations never record a "no": an unticked box is
 * just no consent).
 */
export const saidNo = (c: Pick<Contact, 'newsletter'>) => !c.newsletter.agreed && !!c.newsletter.at;

/** Every address (main and other emails) of the contacts who said no to emails. */
export function optedOutEmails(contacts: Pick<Contact, 'newsletter' | 'email' | 'otherEmails'>[]) {
  const out = new Set<string>();
  for (const c of contacts) {
    if (!saidNo(c)) continue;
    for (const e of [c.email, ...c.otherEmails]) if (e) out.add(e.trim().toLowerCase());
  }
  return out;
}

/** What "Groups and tags" picks: people with any of these tags or in any of these groups. */
export interface Segment {
  tags: string[];
  groups: number[];
}

/**
 * The contacts in a segment who can get an email: with an address, and who did not say no to
 * emails (same rule as "All contacts").
 */
export function segmentRecipients(
  contacts: Pick<Contact, 'name' | 'email' | 'newsletter' | 'tags' | 'groups'>[],
  segment: Segment,
) {
  return uniqueRecipients(
    contacts.filter(
      (c) =>
        c.email &&
        !saidNo(c) &&
        (c.tags.some((t) => segment.tags.includes(t)) ||
          c.groups.some((g) => segment.groups.includes(g))),
    ),
  );
}

/** Most people in one imported list. */
export const CSV_MAX_RECIPIENTS = 2000;

/** The list as it travels in the form between the upload and the send (JSON). */
export const RecipientListSchema = z
  .array(z.object({ name: z.string().trim().max(120), email: emailField }))
  .max(CSV_MAX_RECIPIENTS);

export function decodeRecipientList(raw: unknown): Recipient[] {
  if (typeof raw !== 'string' || !raw) return [];
  try {
    const parsed = RecipientListSchema.safeParse(JSON.parse(raw));
    return parsed.success ? uniqueRecipients(parsed.data) : [];
  } catch {
    return [];
  }
}

export interface CsvList {
  recipients: Recipient[];
  /** Rows left out: no valid email, or the same email as an earlier row. */
  invalid: number;
  duplicates: number;
  /** A problem with the whole file ('' when it was read). */
  error: string;
}

const header = (h: string) =>
  h
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ')
    .trim();
const EMAIL_HEADERS = ['email', 'e mail', 'email address', 'mail'];
const NAME_HEADERS = ['name', 'full name', 'contact', 'contact name'];
const FIRST_HEADERS = ['first name', 'firstname', 'given name', 'prenom', 'prénom'];
const LAST_HEADERS = ['last name', 'lastname', 'surname', 'family name', 'nom'];
const looksLikeEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

/**
 * Reads a mailing list: a first line naming the columns, with an "email" column (required) and
 * a "name" or "first name" + "last name" (optional; "there" is used for {name} without one).
 * A file without a header line also works when its first row already holds an email. Extra
 * columns are ignored; repeats of an email are left out.
 */
export function parseRecipientsCsv(text: string): CsvList {
  const rows = parseDelimited(text);
  const out: CsvList = { recipients: [], invalid: 0, duplicates: 0, error: '' };
  if (!rows.length) return { ...out, error: 'The file is empty.' };
  const cols = rows[0]!.map(header);
  let emailCol = cols.findIndex((c) => EMAIL_HEADERS.includes(c));
  const nameCol = cols.findIndex((c) => NAME_HEADERS.includes(c));
  const firstCol = cols.findIndex((c) => FIRST_HEADERS.includes(c));
  const lastCol = cols.findIndex((c) => LAST_HEADERS.includes(c));
  let body = rows.slice(1);
  let headerless = false;
  if (emailCol < 0) {
    emailCol = rows[0]!.findIndex(looksLikeEmail);
    if (emailCol < 0)
      return {
        ...out,
        error:
          'No "email" column found. The first line must name the columns, for example: email,name',
      };
    headerless = true;
    body = rows;
  }
  if (body.length > CSV_MAX_RECIPIENTS)
    return { ...out, error: `Import at most ${CSV_MAX_RECIPIENTS} people at a time.` };
  const seen = new Set<string>();
  for (const cells of body) {
    const parsed = emailField.safeParse((cells[emailCol] ?? '').trim());
    if (!parsed.success) {
      out.invalid++;
      continue;
    }
    if (seen.has(parsed.data)) {
      out.duplicates++;
      continue;
    }
    seen.add(parsed.data);
    const cell = (i: number) => (i >= 0 ? (cells[i] ?? '').trim() : '');
    const otherCol = headerless && cells.length === 2 ? 1 - emailCol : -1;
    const name =
      cell(nameCol) ||
      [cell(firstCol), cell(lastCol)].filter(Boolean).join(' ') ||
      (looksLikeEmail(cell(otherCol)) ? '' : cell(otherCol));
    out.recipients.push({ name: name.slice(0, 120), email: parsed.data });
  }
  return out;
}

export interface Recipients {
  lists: Record<CommunityAudience, Recipient[]>;
  /** In "All contacts": how many never agreed to the newsletter. */
  allWithoutConsent: number;
  /** Left out of "All contacts" and of the imported list because they said no to emails. */
  allOptedOut: number;
  csvOptedOut: number;
  /**
   * Everyone "Groups and tags" can reach (an email, never said no), with their tags and groups,
   * so the page can count a segment as boxes are ticked.
   */
  segmentable: { email: string; tags: string[]; groups: number[] }[];
}

/**
 * Everyone in each audience: the contacts one is the keys selected in Contacts, the csv one the
 * imported list. People who said no to emails are left out of "All contacts" and of an imported
 * list (people who deleted their data are gone from Contacts already).
 */
export async function communityRecipients(
  keys: string[] = [],
  list: Recipient[] = [],
  segment: Segment = { tags: [], groups: [] },
): Promise<Recipients> {
  const [active, all] = await Promise.all([
    getDb()
      .select({ name: members.name, email: members.email })
      .from(members)
      .where(eq(members.status, 'active')),
    loadContacts(),
  ]);
  const wanted = new Set(keys);
  const optedOut = optedOutEmails(all);
  const reachable = all.filter((c) => c.email && !saidNo(c));
  const everyone = uniqueRecipients(reachable);
  const consenting = new Set(
    reachable.filter((c) => c.newsletter.agreed).map((c) => c.email!.trim().toLowerCase()),
  );
  const csv = uniqueRecipients(list);
  return {
    lists: {
      members: uniqueRecipients(active),
      newsletter: uniqueRecipients(all.filter((c) => c.newsletter.agreed)),
      all: everyone,
      segment: segmentRecipients(all, segment),
      csv: csv.filter((r) => !optedOut.has(r.email)),
      contacts: uniqueRecipients(all.filter((c) => wanted.has(c.key))),
    },
    allWithoutConsent: everyone.filter((r) => !consenting.has(r.email)).length,
    allOptedOut: all.filter((c) => c.email && saidNo(c)).length,
    csvOptedOut: csv.filter((r) => optedOut.has(r.email)).length,
    segmentable: reachable
      .filter((c) => c.tags.length || c.groups.length)
      .map((c) => ({ email: c.email!.trim().toLowerCase(), tags: c.tags, groups: c.groups })),
  };
}

const FOOTERS: Record<CommunityAudience, string> = {
  members: 'You get this email because you are a member of La French Tech Bangkok.',
  newsletter: 'You get this email because you subscribed to the La French Tech Bangkok newsletter.',
  all: 'You get this email because you are in touch with La French Tech Bangkok (an event, membership or the directory).',
  segment:
    'You get this email because you are in touch with La French Tech Bangkok (an event, membership or the directory).',
  csv: 'You get this email because you are on a La French Tech Bangkok mailing list.',
  contacts: 'You get this email because you came to a La French Tech Bangkok event.',
};

const escHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

/**
 * The message, rendered once (Markdown and cards), and the email each person gets from it in
 * the site's usual layout. `missing` lists the {{event: …}} / {{post: …}} lines naming nothing.
 */
export function communityMessage(
  audience: CommunityAudience,
  m: Pick<CommunityEmailInput, 'subject' | 'body' | 'actionLabel' | 'actionUrl'>,
  opts: { replyTo?: string; cards?: Map<string, EmailCard> } = {},
) {
  const body = emailMarkdown(m.body, opts.cards ?? new Map(), siteOrigin().origin);
  return {
    missing: body.missing,
    to(r: Recipient): EmailMessage {
      const first = personalise('{name}', r.name);
      const name = (s: string) => s.replace(/\{name\}/gi, first);
      const nameHtml = (s: string) => s.replace(/\{name\}/gi, escHtml(first));
      return {
        to: r.email,
        subject: name(m.subject),
        paragraphs: body.paragraphs.map(name),
        bodyHtml: nameHtml(body.html),
        action:
          m.actionLabel && m.actionUrl ? { label: m.actionLabel, url: m.actionUrl } : undefined,
        links: [
          audience === 'members'
            ? { label: 'My member page', url: siteUrl('/member') }
            : { label: 'Upcoming events', url: siteUrl('/events') },
        ],
        footer: FOOTERS[audience],
        replyTo: opts.replyTo,
        dataUrl: siteUrl('/my-data'),
      };
    },
  };
}

/** The email one person gets (see communityMessage). */
export function communityEmail(
  to: Recipient,
  audience: CommunityAudience,
  m: Pick<CommunityEmailInput, 'subject' | 'body' | 'actionLabel' | 'actionUrl'>,
  opts: { replyTo?: string; cards?: Map<string, EmailCard> } = {},
): EmailMessage {
  return communityMessage(audience, m, opts).to(to);
}

const absolute = (u: string | null) => (u ? siteUrl(u) : null);

/** The cards a message names: published events and posts, by slug. */
export async function loadCards(md: string) {
  const refs = cardRefs(md);
  const cards = new Map<string, EmailCard>();
  const slugs = (kind: 'event' | 'post') => refs.filter((r) => r.kind === kind).map((r) => r.slug);
  const eventSlugs = slugs('event');
  const postSlugs = slugs('post');
  if (!refs.length) return cards;
  const db = getDb();
  const [settings, eventRows, postRows] = await Promise.all([
    getSettings(),
    eventSlugs.length
      ? db
          .select()
          .from(events)
          .where(and(inArray(events.slug, eventSlugs), eq(events.status, 'published')))
      : [],
    postSlugs.length
      ? db
          .select()
          .from(posts)
          .where(and(inArray(posts.slug, postSlugs), eq(posts.status, 'published')))
      : [],
  ]);
  for (const e of eventRows)
    cards.set(cardKey('event', e.slug), {
      kind: 'event',
      title: e.title,
      url: siteUrl(`/events/${e.slug}`),
      image: absolute(eventCover(e, settings.eventCovers)),
      meta: formatEventDate(e.startsAt, e.endsAt),
      place: e.venue,
      summary: e.summary,
    });
  for (const p of postRows)
    cards.set(cardKey('post', p.slug), {
      kind: 'post',
      title: p.title,
      url: siteUrl(`/blog/${p.slug}`),
      image: absolute(mediaUrl(p.coverKey)),
      meta: p.publishedAt ? formatDate(p.publishedAt) : '',
      summary: p.excerpt,
    });
  return cards;
}

export interface CardChoice {
  token: string;
  kind: 'event' | 'post';
  title: string;
  meta: string;
  upcoming?: boolean;
}

/**
 * What the "Insert posts or events" picker offers: upcoming events (soonest first), then events
 * of the last 90 days and the latest published posts. Private and unlisted events are left out.
 */
export async function cardChoices(now = new Date()): Promise<CardChoice[]> {
  const db = getDb();
  const since = new Date(now.getTime() - 90 * 86_400_000);
  const [eventRows, postRows] = await Promise.all([
    db
      .select({
        slug: events.slug,
        title: events.title,
        startsAt: events.startsAt,
        endsAt: events.endsAt,
      })
      .from(events)
      .where(
        and(
          eq(events.status, 'published'),
          eq(events.listed, true),
          eq(events.inviteOnly, false),
          gte(events.startsAt, since),
        ),
      )
      .orderBy(desc(events.startsAt))
      .limit(40),
    db
      .select({ slug: posts.slug, title: posts.title, publishedAt: posts.publishedAt })
      .from(posts)
      .where(and(eq(posts.status, 'published'), isNotNull(posts.publishedAt)))
      .orderBy(desc(posts.publishedAt))
      .limit(40),
  ]);
  const upcoming = eventRows.filter((e) => (e.endsAt ?? e.startsAt) >= now).reverse();
  const past = eventRows.filter((e) => (e.endsAt ?? e.startsAt) < now);
  return [
    ...[...upcoming, ...past].map((e) => ({
      token: `{{event: ${e.slug}}}`,
      kind: 'event' as const,
      title: e.title,
      meta: formatEventDate(e.startsAt, e.endsAt),
      upcoming: (e.endsAt ?? e.startsAt) >= now,
    })),
    ...postRows.map((p) => ({
      token: `{{post: ${p.slug}}}`,
      kind: 'post' as const,
      title: p.title,
      meta: p.publishedAt ? formatDate(p.publishedAt) : '',
    })),
  ];
}

/**
 * The provider's daily cap (EMAIL_DAILY_LIMIT; Resend's free plan: 100) and how many emails this
 * page already sent today (UTC day, as Resend counts). 0 = no cap known.
 */
export async function dailyAllowance(now = new Date()) {
  const limit = Number(env.EMAIL_DAILY_LIMIT ?? 0) || 0;
  if (!limit) return { limit: 0, sentToday: 0 };
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const rows = await getDb()
    .select({ n: communityEmails.recipients })
    .from(communityEmails)
    .where(gte(communityEmails.createdAt, day));
  return { limit, sentToday: rows.reduce((s, r) => s + r.n, 0) };
}
