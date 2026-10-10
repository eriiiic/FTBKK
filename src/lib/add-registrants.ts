// Registrants added by an admin on Registrations: picked from the members, typed in, or imported
// from a CSV. Admin adds skip the public rules (registration closed, members-only, private event
// invitation) and capacity: they are always registered, and the page warns when the event goes
// over capacity. Someone already registered is skipped, so importing the same file twice is safe.

import { z } from 'zod';
import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '../db';
import { contacts, registrations, type Event } from '../db/schema';
import { aliasMap } from './contacts';
import { csvCell, parseDelimited } from './csv';
import { email } from './forms';
import { audit } from './orgs';
import { GUESTS_MAX, NOTE_MAX, cleanNote, countTaken, sendConfirmation } from './registrations';
import { randomToken } from './tokens';

/** Most confirmation emails sent in one go (each carries its own ticket, so they go one by one). */
export const EMAIL_LIMIT = 40;

/** Most rows read from one CSV file. */
export const CSV_MAX_ROWS = 1000;

/** The CSV columns, in template order. Headers are matched without case, spaces or dashes. */
export const REGISTRANT_COLUMNS = [
  { key: 'name', required: true, hint: 'Full name.', aliases: ['full name', 'guest name'] },
  { key: 'email', required: true, hint: 'One per person.', aliases: ['e-mail', 'email address'] },
  { key: 'company', hint: '', aliases: ['organisation', 'organization', 'company name'] },
  { key: 'role', hint: 'Job title.', aliases: ['job title', 'title', 'position'] },
  { key: 'phone', hint: 'Digits, spaces and +.', aliases: ['phone number', 'mobile', 'telephone'] },
  { key: 'guests', hint: `0 to ${GUESTS_MAX}, people coming with them.`, aliases: ['plus ones'] },
  { key: 'note', hint: 'Shown to admins only.', aliases: ['notes', 'comment', 'comments'] },
  {
    key: 'attended',
    hint: '"yes" marks them as checked in (for an event already held).',
    aliases: ['checked in', 'check in', 'present'],
  },
] as const;

export type RegistrantColumn = (typeof REGISTRANT_COLUMNS)[number]['key'];

/** The downloadable template: the header and two example rows. */
export const REGISTRANT_TEMPLATE = [
  REGISTRANT_COLUMNS.map((c) => c.key),
  [
    'Marie Dupont',
    'marie@example.com',
    'Acme Co',
    'Founder',
    '081 234 5678',
    '1',
    'Vegetarian',
    '',
  ],
  ['Somchai Rak', 'somchai@example.com', '', '', '', '0', '', 'yes'],
]
  .map((row) => row.map(csvCell).join(','))
  .join('\r\n');

// Our own CSV exports put a quote before + and - so Excel doesn't read a formula; it is dropped.
const trimmed = (v: unknown) => (typeof v === 'string' ? v.trim().replace(/^'(?=[=+\-@])/, '') : v);
const optional = (max: number) =>
  z.preprocess(
    trimmed,
    z
      .string()
      .max(max, `Keep it to ${max} characters or fewer.`)
      .optional()
      .transform((s) => s || null),
  );
const YES = /^(y|yes|true|1|x|oui|attended|checked ?in)$/i;

/** One person to register, from any of the three ways. */
export const RegistrantSchema = z.object({
  name: z.preprocess(
    trimmed,
    z.string().min(2, 'Name is missing or too short.').max(120, 'Name is too long.'),
  ),
  email: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() ? v.trim() : undefined),
    z.string({ error: 'Email is missing.' }).pipe(email),
  ),
  company: optional(120),
  role: optional(120),
  phone: z.preprocess(
    trimmed,
    z
      .string()
      .max(40)
      .regex(/^[+\d\s().-]*$/, 'Phone has characters other than digits, spaces and +.')
      .optional()
      .transform((s) => s || null),
  ),
  note: z.preprocess(
    (v) => (typeof v === 'string' ? cleanNote(v) : v),
    z
      .string()
      .max(NOTE_MAX, `Note is longer than ${NOTE_MAX} characters.`)
      .optional()
      .transform((s) => s || null),
  ),
  guests: z.preprocess(
    (v) => (v === '' || v === undefined || v === null ? 0 : trimmed(v)),
    z.coerce
      .number({ error: `Guests must be a number from 0 to ${GUESTS_MAX}.` })
      .int(`Guests must be a number from 0 to ${GUESTS_MAX}.`)
      .min(0, `Guests must be a number from 0 to ${GUESTS_MAX}.`)
      .max(GUESTS_MAX, `Guests must be a number from 0 to ${GUESTS_MAX}.`),
  ),
  attended: z.preprocess(
    (v) => (typeof v === 'string' ? YES.test(v.trim()) : v === true),
    z.boolean(),
  ),
});
export type Registrant = z.infer<typeof RegistrantSchema>;

export interface RowError {
  /** Line in the file (1 is the header), or 0 for the file itself. */
  line: number;
  message: string;
}

const headerKey = (h: string) => h.toLowerCase().replace(/[\s_-]+/g, ' ');
const columnFor = (h: string): RegistrantColumn | 'first' | 'last' | null => {
  const k = headerKey(h).trim();
  if (k === 'first name' || k === 'firstname' || k === 'given name') return 'first';
  if (k === 'last name' || k === 'lastname' || k === 'surname' || k === 'family name')
    return 'last';
  const col = REGISTRANT_COLUMNS.find(
    (c) => c.key === k || c.aliases.some((a) => headerKey(a) === k),
  );
  return col?.key ?? null;
};

/**
 * Reads a registrants CSV: one person per row, columns found by header (any order, extra columns
 * ignored, "first name" + "last name" accepted instead of "name"). Rows with a problem are listed
 * with their line number; a second row with the same email is left out.
 */
export function parseRegistrantsCsv(text: string): {
  rows: { line: number; data: Registrant }[];
  errors: RowError[];
} {
  const [header, ...lines] = parseDelimited(text);
  if (!header) return { rows: [], errors: [{ line: 0, message: 'The file is empty.' }] };
  const cols = header.map(columnFor);
  const has = (k: string) => cols.includes(k as RegistrantColumn);
  if (!has('email') || !(has('name') || has('first') || has('last'))) {
    return {
      rows: [],
      errors: [
        {
          line: 1,
          message:
            'The first line must name the columns, with at least "name" and "email". Download the template to see the format.',
        },
      ],
    };
  }
  if (lines.length > CSV_MAX_ROWS) {
    return {
      rows: [],
      errors: [{ line: 0, message: `Import at most ${CSV_MAX_ROWS} people at a time.` }],
    };
  }
  const rows: { line: number; data: Registrant }[] = [];
  const errors: RowError[] = [];
  const seen = new Map<string, number>();
  lines.forEach((cells, i) => {
    const line = i + 2;
    const raw: Record<string, string> = {};
    cells.forEach((v, j) => {
      const k = cols[j];
      if (k && !raw[k]) raw[k] = v;
    });
    if (!raw.name)
      raw.name = [raw.first, raw.last]
        .map((s) => s?.trim())
        .filter(Boolean)
        .join(' ');
    const parsed = RegistrantSchema.safeParse(raw);
    if (!parsed.success) {
      errors.push({ line, message: parsed.error.issues.map((e) => e.message).join(' ') });
      return;
    }
    const first = seen.get(parsed.data.email);
    if (first) {
      errors.push({ line, message: `Same email as line ${first}; left out.` });
      return;
    }
    seen.set(parsed.data.email, line);
    rows.push({ line, data: parsed.data });
  });
  return { rows, errors };
}

export interface AddSummary {
  added: { name: string; email: string; status: 'registered' | 'attended' }[];
  skipped: { name: string; email: string; reason: string }[];
  errors: RowError[];
  emailed: number;
  /** Added people who should have had an email but were over EMAIL_LIMIT, or whose send failed. */
  notEmailed: number;
  /** Seats taken beyond capacity after the add (0 when within it, or no capacity). */
  overCapacity: number;
}

const STATUS_WORD: Record<string, string> = {
  registered: 'already registered',
  attended: 'already checked in',
  waitlist: 'already on the waitlist',
};

/**
 * Registers these people for the event (see the file comment). Emails are matched without case,
 * and through the contacts' other emails, so a registration lands on the contact's main email.
 * A cancelled registration comes back with its token, so links already sent keep working. Someone
 * on the waitlist is moved to registered.
 */
export async function addRegistrants(
  event: Event,
  people: Registrant[],
  opts: { sendEmail: boolean; actor: string; source: 'members' | 'manual' | 'csv' },
): Promise<Omit<AddSummary, 'errors'>> {
  const db = getDb();
  const summary: Omit<AddSummary, 'errors'> = {
    added: [],
    skipped: [],
    emailed: 0,
    notEmailed: 0,
    overCapacity: 0,
  };
  if (!people.length) return summary;
  const existing = new Map(
    (
      await db
        .select({
          id: registrations.id,
          email: registrations.email,
          status: registrations.status,
        })
        .from(registrations)
        .where(eq(registrations.eventId, event.id))
    )
      .filter((r) => r.email)
      .map((r) => [r.email!, r]),
  );
  const aliases = aliasMap(
    await db
      .select({ email: contacts.email, otherEmails: contacts.otherEmails })
      .from(contacts)
      .where(sql`${contacts.otherEmails} != '[]'`),
  );

  const now = new Date();
  const toEmail: { name: string; email: string; token: string; guests: number }[] = [];
  const done = new Set<string>();
  for (const p of people) {
    const mail = aliases.get(p.email) ?? p.email;
    if (done.has(mail)) {
      summary.skipped.push({ name: p.name, email: p.email, reason: 'listed twice' });
      continue;
    }
    done.add(mail);
    const before = existing.get(mail);
    if (before && before.status !== 'cancelled' && before.status !== 'waitlist') {
      summary.skipped.push({ name: p.name, email: p.email, reason: STATUS_WORD[before.status] });
      continue;
    }
    const status = p.attended ? ('attended' as const) : ('registered' as const);
    const fields = {
      name: p.name,
      company: p.company,
      role: p.role,
      phone: p.phone,
      note: p.note,
      guests: p.guests,
      status,
      checkedInAt: p.attended ? now : null,
    };
    const [row] = before
      ? await db
          .update(registrations)
          .set({
            ...fields,
            // From the waitlist, they keep their place in time; a cancelled one starts afresh.
            ...(before.status === 'cancelled'
              ? { createdAt: now, reminderSentAt: null, walkIn: false }
              : {}),
          })
          .where(and(eq(registrations.id, before.id), eq(registrations.status, before.status)))
          .returning()
      : await db
          .insert(registrations)
          .values({ ...fields, eventId: event.id, email: mail, token: randomToken(24) })
          .onConflictDoNothing()
          .returning();
    if (!row) {
      summary.skipped.push({ name: p.name, email: p.email, reason: 'registered at the same time' });
      continue;
    }
    summary.added.push({ name: row.name, email: mail, status });
    if (opts.sendEmail && status === 'registered')
      toEmail.push({ name: row.name, email: mail, token: row.token, guests: row.guests });
  }

  for (const r of toEmail.slice(0, EMAIL_LIMIT)) {
    try {
      await sendConfirmation(event, { ...r, status: 'registered' });
      summary.emailed++;
    } catch (err) {
      console.error('[add-registrants] confirmation email failed', err);
    }
  }
  summary.notEmailed = toEmail.length - summary.emailed;
  if (event.capacity !== null)
    summary.overCapacity = Math.max(0, (await countTaken(event.id)) - event.capacity);
  if (summary.added.length)
    await audit(opts.actor, 'registrations_added', 'event', event.id, null, {
      source: opts.source,
      added: summary.added.length,
      skipped: summary.skipped.length,
      emailed: summary.emailed,
    });
  return summary;
}
