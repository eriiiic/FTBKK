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
import { myDataPath } from './privacy';
import { qrPng, ticketCode } from './ticket';
import { sponsorsForEvent } from './queries';
import { emailLogos, showSponsor, sponsorDetails } from './sponsors';
import {
  EMAIL_TEMPLATES,
  applyTemplate,
  eventVars,
  loadTemplateText,
  renderTemplate,
  type EmailText,
} from './email-templates';

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

/**
 * Members-only registration (when membership is open): the first step only asks for the email,
 * plus the note and the photo notice. A member is registered with the details of their membership.
 */
export const MemberRegisterSchema = RegisterSchema.pick({
  email: true,
  note: true,
  photoConsent: true,
});
export type MemberRegister = z.infer<typeof MemberRegisterSchema>;

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

/**
 * Atomic insert: decides registered vs waitlist in the same statement, so capacity holds. Only a
 * ticked newsletter box is recorded (dated): an unticked box is not a withdrawal, since the form
 * never shows that someone is already subscribed. Registering again after a cancellation keeps
 * the registration's token, so links in earlier emails ("Manage or delete my data") still work.
 */
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
         ?8, ?9, ?10, CASE WHEN ?10 THEN unixepoch() END, ?11
       WHERE true
       ON CONFLICT (event_id, email) DO UPDATE SET
         name = excluded.name, company = excluded.company, role = excluded.role, phone = excluded.phone,
         how_heard = excluded.how_heard, status = excluded.status,
         newsletter_consent = CASE WHEN excluded.newsletter_consent
           THEN 1 ELSE registrations.newsletter_consent END,
         newsletter_consent_at = coalesce(excluded.newsletter_consent_at, registrations.newsletter_consent_at),
         note = excluded.note,
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

/**
 * Does this email get member priority on events? Active individual members, and owners of a
 * published member company listing.
 */
export async function isMemberEmail(addr: string, db: D1Database = env.DB) {
  const r = await db
    .prepare(
      `SELECT 1 FROM members WHERE email = ?1 AND status = 'active'
       UNION ALL
       SELECT 1 FROM organisations, json_each(organisations.owner_emails)
       WHERE organisations.status = 'published' AND organisations.member_status = 'member' AND json_each.value = ?1
       LIMIT 1`,
    )
    .bind(addr.toLowerCase())
    .first();
  return !!r;
}

export type RegisterOutcome =
  | { status: 'registered' | 'waitlist' | 'duplicate' }
  | { status: 'closed'; state: RegistrationState };

/**
 * Registers someone for an event if it is open to them (member priority included), and sends the
 * confirmation. Used by the event page and when a new member confirms the email they joined with
 * while registering.
 */
export async function registerForEvent(
  event: Event,
  data: z.infer<typeof RegisterSchema>,
  opts: { memberPriority: boolean; now?: Date },
): Promise<RegisterOutcome> {
  const member = opts.memberPriority && (await isMemberEmail(data.email));
  const state = registrationState(event, await countTaken(event.id), opts.now ?? new Date(), {
    memberPriority: opts.memberPriority,
    isMember: member,
  });
  if (!state.open) return { status: 'closed', state };
  const row = await insertRegistration(event.id, data, state.capacity);
  if (!row) return { status: 'duplicate' };
  // Only what the email needs: the note stays with the organisers.
  await sendConfirmation(event, {
    name: data.name,
    email: data.email,
    status: row.status,
    token: row.token,
  });
  return { status: row.status };
}

/**
 * Cancels a registration or a waitlist place (from the email link or the member page). A freed
 * seat goes to the next person on the waitlist. False when it was already cancelled or attended.
 */
export async function cancelRegistration(
  event: Event,
  reg: { id: number; status: string },
  memberPriority: boolean,
) {
  const cancelled = await env.DB.prepare(
    `UPDATE registrations SET status = 'cancelled' WHERE id = ? AND status IN ('registered', 'waitlist') RETURNING status`,
  )
    .bind(reg.id)
    .first();
  if (!cancelled) return false;
  if (reg.status === 'registered') {
    const promoted = await promoteFromWaitlist(event, { memberPriority });
    if (promoted) await sendPromotion(event, promoted);
  }
  return true;
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

/** The "Manage or delete my data" page for a registration token (linked in every event email). */
export const myDataUrl = (token: string) => siteUrl(myDataPath(token));

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
  const w = await renderTemplate(
    waitlist ? 'registration.waitlist' : 'registration.confirmed',
    eventVars(e, r.name),
  );
  await sendEmail({
    to: r.email,
    subject: w.subject,
    paragraphs: w.paragraphs,
    details: [...eventDetails(e), ...sp.details],
    logos: sp.logos,
    action: map && !waitlist && w.buttonLabel ? { label: w.buttonLabel, url: map } : undefined,
    links: [
      { label: 'Event page', url: siteUrl(`/events/${e.slug}`) },
      { label: waitlist ? 'Leave the waitlist' : "Can't come? Cancel", url: cancelUrl },
    ],
    ticket: t?.ticket,
    attachments: t ? [icsAttachment(e), t.attachment] : undefined,
    dataUrl: myDataUrl(r.token),
  });
}

export async function sendPromotion(e: Event, r: RegistrationRow) {
  const t = await ticket(e, r.token);
  const sp = await emailSponsors(e.id);
  const w = await renderTemplate('registration.promoted', eventVars(e, r.name));
  await sendEmail({
    to: r.email,
    subject: w.subject,
    paragraphs: w.paragraphs,
    details: [...eventDetails(e), ...sp.details],
    logos: sp.logos,
    links: [
      { label: 'Event page', url: siteUrl(`/events/${e.slug}`) },
      { label: 'Cancel', url: siteUrl(`/events/${e.slug}/cancel?token=${r.token}`) },
    ],
    ticket: t.ticket,
    attachments: [icsAttachment(e), t.attachment],
    dataUrl: myDataUrl(r.token),
  });
}

/** `text` is the edited wording (loadTemplateText('event.reminder')); null = the default. */
export function reminderEmail(
  e: Event,
  r: { name: string; email: string; token: string },
  sp: EmailSponsors = NO_SPONSORS,
  text: EmailText | null = null,
): EmailMessage {
  const map = mapLink(e);
  const w = applyTemplate(EMAIL_TEMPLATES['event.reminder'], text, eventVars(e, r.name));
  return {
    to: r.email,
    subject: w.subject,
    paragraphs: w.paragraphs,
    details: [...eventDetails(e), ...sp.details],
    logos: sp.logos,
    action: map && w.buttonLabel ? { label: w.buttonLabel, url: map } : undefined,
    links: [
      { label: 'Show my ticket', url: ticketUrl(e, r.token) },
      {
        label: "Can't come any more? Cancel",
        url: siteUrl(`/events/${e.slug}/cancel?token=${r.token}`),
      },
    ],
    dataUrl: myDataUrl(r.token),
  };
}

export async function sendReminders(
  e: Event,
  rows: { name: string; email: string; token: string }[],
) {
  if (!rows.length) return { ok: true, sent: 0 };
  const sp = await emailSponsors(e.id);
  const text = await loadTemplateText('event.reminder');
  return sendEmailBatch(rows.map((r) => reminderEmail(e, r, sp, text)));
}

export async function sendEventCancelled(
  e: Event,
  rows: { name: string; email: string; token?: string | null }[],
) {
  const text = await loadTemplateText('event.cancelled');
  return sendEmailBatch(rows.map((r) => eventCancelledEmail(e, r, text)));
}

/** `text` is the edited wording (loadTemplateText('event.cancelled')); null = the default. */
export function eventCancelledEmail(
  e: Event,
  r: { name: string; email: string; token?: string | null },
  text: EmailText | null = null,
): EmailMessage {
  const w = applyTemplate(EMAIL_TEMPLATES['event.cancelled'], text, eventVars(e, r.name));
  return {
    to: r.email,
    subject: w.subject,
    paragraphs: w.paragraphs,
    action: { label: w.buttonLabel, url: siteUrl('/events') },
    dataUrl: r.token ? myDataUrl(r.token) : undefined,
  };
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
