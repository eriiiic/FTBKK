import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { env } from 'cloudflare:workers';
import { registrations, type Event, type Registration } from '../db/schema';
import { email } from './forms';
import { DAY_MS } from './lifecycle';
import { formatEventDate } from './format';
import { eventIcs } from './ics';
import { sendEmail, sendEmailBatch, type EmailMessage } from './email';
import { randomToken } from './tokens';
import { qrPng, ticketCode } from './ticket';
import { sponsorsForEvent } from './queries';
import { emailLogos, showSponsor, sponsorDetails } from './sponsors';

/** Longest note a registrant can leave (the textarea's maxlength too). */
export const NOTE_MAX = 500;

/**
 * A registrant's free-text note, as plain text: control characters dropped (tabs and newlines
 * kept), trailing spaces trimmed per line, at most one blank line in a row, no blank edges.
 */
export function cleanNote(raw: string) {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export const RegisterSchema = z.object({
  name: z.string().min(2, 'Enter your name.').max(120),
  email,
  company: z.string().max(120).optional().default(''),
  phone: z
    .string()
    .max(40)
    .regex(/^[+\d\s().-]*$/, 'Enter a phone number (digits, spaces, +).')
    .optional()
    .default(''),
  role: z.string().max(120).optional().default(''),
  howHeard: z.string().max(120).optional().default(''),
  /** "Anything we should know, or something you're looking for?" Plain text, shown to admins only. */
  note: z.preprocess(
    // formToObject turns a field that says exactly "on" into true; keep it as text.
    (v) => (v === true ? 'on' : v),
    z
      .string()
      .transform(cleanNote)
      .pipe(z.string().max(NOTE_MAX, `Keep it to ${NOTE_MAX} characters or fewer.`))
      .optional()
      .default(''),
  ),
  photoConsent: z.literal(true, { error: 'Please accept the photo notice to register.' }),
  /** Opt-in only: an unticked box (absent from the form) is a "no", recorded with the date. */
  newsletter: z.boolean().optional().default(false),
});

export const HOW_HEARD = [
  'LinkedIn',
  'Instagram',
  'WhatsApp group',
  'A friend',
  'Newsletter',
  'Other',
];

type EventRules = Pick<
  Event,
  | 'status'
  | 'startsAt'
  | 'capacity'
  | 'registrationOpen'
  | 'registrationOpensAt'
  | 'registrationClosesAt'
  | 'memberEarlyDays'
  | 'memberReservedSeats'
>;

export interface RegistrationState {
  /** Can this person register (or join the waitlist) right now? */
  open: boolean;
  /** Why not, in words for the page. */
  reason?: 'closed' | 'not_yet' | 'ended';
  /** When the public opens, if it is not open yet. */
  opensAt?: Date;
  /** Seats this person can take; null = unlimited. */
  capacity: number | null;
  spotsLeft: number | null;
  /** True when a new registration would go to the waitlist. */
  full: boolean;
}

/**
 * Registration rules for one event and one person. Member priority (settings.memberPriority) lets
 * members register `memberEarlyDays` before the public and use the `memberReservedSeats`, which
 * stay closed to everyone else until registration closes.
 */
export function registrationState(
  e: EventRules,
  taken: number,
  now: Date,
  opts: { isMember?: boolean; memberPriority?: boolean } = {},
): RegistrationState {
  const priority = !!opts.memberPriority;
  const member = priority && !!opts.isMember;
  const closesAt = e.registrationClosesAt ?? e.startsAt;
  const reserved = priority && !member ? Math.min(e.memberReservedSeats, e.capacity ?? 0) : 0;
  const capacity = e.capacity === null ? null : Math.max(0, e.capacity - reserved);
  const spotsLeft = capacity === null ? null : Math.max(0, capacity - taken);
  const base = { capacity, spotsLeft, full: spotsLeft === 0 };

  if (e.status !== 'published' || !e.registrationOpen)
    return { ...base, open: false, reason: 'closed' };
  if (now >= closesAt) return { ...base, open: false, reason: 'ended' };
  if (e.registrationOpensAt) {
    const early = member ? e.memberEarlyDays * DAY_MS : 0;
    const opensAt = new Date(e.registrationOpensAt.getTime() - early);
    if (now < opensAt) return { ...base, open: false, reason: 'not_yet', opensAt };
  }
  return { ...base, open: true };
}

/** Atomic insert: decides registered vs waitlist in the same statement, so capacity holds. */
export async function insertRegistration(
  eventId: number,
  data: z.infer<typeof RegisterSchema>,
  capacity: number | null,
  db: D1Database = env.DB,
) {
  const token = randomToken(24);
  const row = await db
    .prepare(
      `INSERT INTO registrations (event_id, name, email, company, role, how_heard, photo_consent, status, token, phone,
         newsletter_consent, newsletter_consent_at, note)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, 1,
         CASE WHEN ?7 IS NULL OR (SELECT count(*) FROM registrations
           WHERE event_id = ?1 AND status IN ('registered', 'attended')) < ?7
         THEN 'registered' ELSE 'waitlist' END,
         ?8, ?9, ?10, unixepoch(), ?11
       WHERE true
       ON CONFLICT (event_id, email) DO UPDATE SET
         name = excluded.name, company = excluded.company, role = excluded.role, phone = excluded.phone,
         how_heard = excluded.how_heard, status = excluded.status, token = excluded.token,
         newsletter_consent = excluded.newsletter_consent,
         newsletter_consent_at = excluded.newsletter_consent_at, note = excluded.note,
         created_at = unixepoch(), checked_in_at = NULL, reminder_sent_at = NULL
       WHERE registrations.status = 'cancelled'
       RETURNING id, status, token`,
    )
    .bind(
      eventId,
      data.name,
      data.email,
      data.company || null,
      data.role || null,
      data.howHeard || null,
      capacity,
      token,
      data.phone || null,
      data.newsletter ? 1 : 0,
      data.note || null,
    )
    .first<{ id: number; status: 'registered' | 'waitlist'; token: string }>();
  return row; // null = already registered
}

export async function countTaken(eventId: number, db: D1Database = env.DB) {
  const r = await db
    .prepare(
      `SELECT count(*) AS n FROM registrations WHERE event_id = ? AND status IN ('registered', 'attended')`,
    )
    .bind(eventId)
    .first<{ n: number }>();
  return r?.n ?? 0;
}

/** Is this email an owner of a published Member listing? */
export async function isMemberEmail(addr: string, db: D1Database = env.DB) {
  const r = await db
    .prepare(
      `SELECT 1 FROM organisations, json_each(organisations.owner_emails)
       WHERE organisations.status = 'published' AND organisations.member_status = 'member' AND json_each.value = ?
       LIMIT 1`,
    )
    .bind(addr.toLowerCase())
    .first();
  return !!r;
}

/** Moves the first waitlisted person to registered when a seat is free. Returns them, or null. */
export async function promoteFromWaitlist(
  event: Pick<Event, 'id' | 'capacity' | 'memberReservedSeats'>,
  opts: { memberPriority?: boolean; force?: boolean } = {},
  db: D1Database = env.DB,
) {
  const reserved = opts.memberPriority ? event.memberReservedSeats : 0;
  const cap = event.capacity === null || opts.force ? null : Math.max(0, event.capacity - reserved);
  return db
    .prepare(
      `UPDATE registrations SET status = 'registered'
       WHERE id = (SELECT id FROM registrations WHERE event_id = ?1 AND status = 'waitlist'
                   ORDER BY created_at, id LIMIT 1)
         AND (?2 IS NULL OR (SELECT count(*) FROM registrations
              WHERE event_id = ?1 AND status IN ('registered', 'attended')) < ?2)
       RETURNING *`,
    )
    .bind(event.id, cap)
    .first<RegistrationRow>();
}

/** Raw D1 row (snake_case), as returned by prepared statements. */
export interface RegistrationRow {
  id: number;
  event_id: number;
  name: string;
  email: string;
  status: Registration['status'];
  token: string;
}

// ---------- emails ----------

export function siteUrl(path: string) {
  return new URL(path, env.SITE_URL || 'https://www.french-tech-bangkok.com').href;
}

function icsAttachment(e: Event) {
  const ics = eventIcs({ ...e, url: siteUrl(`/events/${e.slug}`) });
  return {
    filename: `${e.slug}.ics`,
    content: btoa(String.fromCharCode(...new TextEncoder().encode(ics))),
    contentType: 'text/calendar; charset=utf-8',
  };
}

export function eventDetails(
  e: Pick<Event, 'startsAt' | 'endsAt' | 'venue' | 'address'>,
): [string, string][] {
  return [
    ['When', `${formatEventDate(e.startsAt, e.endsAt)} (Bangkok time)`],
    ...(e.venue || e.address
      ? [['Where', [e.venue, e.address].filter(Boolean).join(', ')] as [string, string]]
      : []),
  ];
}

/** Hosts, sponsors and partners in an event email: detail rows after "Where", and their logos. */
export interface EmailSponsors {
  details: [string, string][];
  logos: NonNullable<EmailMessage['logos']>;
}
const NO_SPONSORS: EmailSponsors = { details: [], logos: [] };

export async function emailSponsors(eventId: number): Promise<EmailSponsors> {
  const shown = (await sponsorsForEvent(eventId)).map(showSponsor);
  return { details: sponsorDetails(shown), logos: emailLogos(shown, siteUrl) };
}

function mapLink(e: Event) {
  if (e.mapUrl) return e.mapUrl;
  if (!e.address) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${e.venue ?? ''} ${e.address}`)}`;
}

const ticketUrl = (e: Event, token: string) => siteUrl(`/events/${e.slug}/ticket?token=${token}`);

/** The ticket block and its inline QR code for a confirmation email. */
async function ticket(e: Event, token: string) {
  const code = await ticketCode(token);
  const png = await qrPng(code);
  return {
    ticket: { code, qrCid: 'ticket-qr', url: ticketUrl(e, token) },
    attachment: {
      filename: `ticket-${code}.png`,
      content: btoa(String.fromCharCode(...png)),
      contentType: 'image/png',
      contentId: 'ticket-qr',
    },
  };
}

export async function sendConfirmation(
  e: Event,
  r: { name: string; email: string; status: string; token: string },
) {
  const cancelUrl = siteUrl(`/events/${e.slug}/cancel?token=${r.token}`);
  const map = mapLink(e);
  const waitlist = r.status === 'waitlist';
  const t = waitlist ? null : await ticket(e, r.token);
  const sp = await emailSponsors(e.id);
  await sendEmail({
    to: r.email,
    subject: waitlist ? `You're on the waitlist: ${e.title}` : `You're registered: ${e.title}`,
    paragraphs: waitlist
      ? [
          `Hi ${r.name}, ${e.title} is full for now, so you are on the waitlist.`,
          'If a seat frees up we will register you automatically and email you.',
        ]
      : [`Hi ${r.name}, see you at ${e.title}! The calendar invite is attached.`],
    details: [...eventDetails(e), ...sp.details],
    logos: sp.logos,
    action: map && !waitlist ? { label: 'Open the map', url: map } : undefined,
    links: [
      { label: 'Event page', url: siteUrl(`/events/${e.slug}`) },
      { label: waitlist ? 'Leave the waitlist' : "Can't come? Cancel", url: cancelUrl },
    ],
    ticket: t?.ticket,
    attachments: t ? [icsAttachment(e), t.attachment] : undefined,
  });
}

export async function sendPromotion(e: Event, r: RegistrationRow) {
  const t = await ticket(e, r.token);
  const sp = await emailSponsors(e.id);
  await sendEmail({
    to: r.email,
    subject: `A seat opened up: you're registered for ${e.title}`,
    paragraphs: [
      `Good news ${r.name}: a seat freed up and you are now registered for ${e.title}. The calendar invite is attached.`,
      "If you can't come any more, please cancel so the next person can take your seat.",
    ],
    details: [...eventDetails(e), ...sp.details],
    logos: sp.logos,
    links: [
      { label: 'Event page', url: siteUrl(`/events/${e.slug}`) },
      { label: 'Cancel', url: siteUrl(`/events/${e.slug}/cancel?token=${r.token}`) },
    ],
    ticket: t.ticket,
    attachments: [icsAttachment(e), t.attachment],
  });
}

export function reminderEmail(
  e: Event,
  r: { name: string; email: string; token: string },
  sp: EmailSponsors = NO_SPONSORS,
): EmailMessage {
  const map = mapLink(e);
  return {
    to: r.email,
    subject: `Tomorrow: ${e.title}`,
    paragraphs: [`Hi ${r.name}, a reminder that ${e.title} is tomorrow. See you there!`],
    details: [...eventDetails(e), ...sp.details],
    logos: sp.logos,
    action: map ? { label: 'Open the map', url: map } : undefined,
    links: [
      { label: 'Show my ticket', url: ticketUrl(e, r.token) },
      {
        label: "Can't come any more? Cancel",
        url: siteUrl(`/events/${e.slug}/cancel?token=${r.token}`),
      },
    ],
  };
}

export async function sendReminders(
  e: Event,
  rows: { name: string; email: string; token: string }[],
) {
  if (!rows.length) return { ok: true, sent: 0 };
  const sp = await emailSponsors(e.id);
  return sendEmailBatch(rows.map((r) => reminderEmail(e, r, sp)));
}

export async function sendEventCancelled(e: Event, rows: { name: string; email: string }[]) {
  return sendEmailBatch(
    rows.map((r) => ({
      to: r.email,
      subject: `Cancelled: ${e.title}`,
      paragraphs: [
        `Hi ${r.name}, we are sorry: ${e.title} on ${formatEventDate(e.startsAt, e.endsAt)} is cancelled.`,
        'Keep an eye on our events page for the next one.',
      ],
      action: { label: 'See upcoming events', url: siteUrl('/events') },
    })),
  );
}

/**
 * Registrations per event as a column of a select on `events`. The outer id is written out as
 * "events"."id": Drizzle prints ${events.id} as a bare "id", which inside the subquery means the
 * registration's own id, so the count was wrong.
 */
export const registrationCount = (statuses: Registration['status'][]) =>
  sql<number>`(select count(*) from ${registrations} r where r.event_id = "events"."id" and r.status in (${sql.join(
    statuses.map((s) => sql`${s}`),
    sql`, `,
  )}))`;
