import { env } from 'cloudflare:workers';
import { eq, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../db';
import { contacts, events, organisations, registrations } from '../db/schema';
import { email as emailField, optionalText, optionalUrl } from './forms';
import { promoteFromWaitlist, sendPromotion } from './registrations';
import { getSettings } from './settings';
import { audit } from './orgs';
import { fromLocalInput, toDateInput } from './admin';
import { REGULAR_MIN_EVENTS } from './regulars';

// Contacts: everyone who ever registered for an event (or walked in), one row per person, built
// from registrations. No sign-up needed: a person is identified by their email, and walk-ins
// without an email by their name. A saved contact card (contacts table) overrides the details
// taken from registrations and adds notes; it can also be someone who never registered.

/** Tags the team puts on contacts by hand. The order here is the order they are shown in. */
export const CONTACT_TAGS = {
  speaker: 'Speaker',
  sponsor: 'Sponsor',
  volunteer: 'Volunteer',
  board: 'Board',
  press: 'Press',
} as const;
export type ContactTag = keyof typeof CONTACT_TAGS;
const TAG_KEYS = Object.keys(CONTACT_TAGS) as ContactTag[];
export const isContactTag = (t: unknown): t is ContactTag =>
  typeof t === 'string' && Object.hasOwn(CONTACT_TAGS, t);

/** Known tags only, without duplicates, in CONTACT_TAGS order (whatever is stored in D1). */
export const normalizeTags = (tags: readonly unknown[] | null | undefined): ContactTag[] =>
  TAG_KEYS.filter((k) => (tags ?? []).includes(k));

/** The tags after adding or removing one. */
export const withTag = (tags: readonly unknown[], tag: ContactTag, add: boolean) =>
  normalizeTags(add ? [...tags, tag] : tags.filter((t) => t !== tag));

export interface ContactRegistration {
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  role: string | null;
  status: 'registered' | 'waitlist' | 'cancelled' | 'attended';
  walkIn: boolean;
  createdAt: Date;
  /** Ticked the newsletter box; newsletterConsentAt is null when they were never asked. */
  newsletterConsent?: boolean;
  newsletterConsentAt?: Date | null;
  /** What they wrote in "Anything we should know?" when registering. */
  note?: string | null;
  event: { id: number; title: string; slug: string; startsAt: Date; endsAt: Date | null };
}

export interface ContactOrg {
  id: number;
  slug: string;
  name: string;
  status: string;
  memberStatus: string;
  publicEmail: string | null;
  ownerEmails: string[];
}

export interface SavedContact {
  id: number;
  email: string | null;
  name: string;
  phone: string | null;
  company: string | null;
  role: string | null;
  linkedin: string | null;
  notes: string | null;
  tags?: string[] | null;
  newsletter?: 'yes' | 'no' | null;
  newsletterAt?: Date | null;
  createdAt: Date;
}

/** Someone's newsletter consent: their most recent explicit choice, and where it comes from. */
export interface NewsletterConsent {
  agreed: boolean;
  /** When they made that choice; null when they were never asked. */
  at: Date | null;
  /** 'card': they told the team (set on the contact card); 'registration': the form's box. */
  source: 'card' | 'registration' | null;
}

/**
 * The most recent explicit newsletter choice: the latest registration that asked (ticked or
 * not), unless the team recorded a later answer on the contact card. Never asked = no consent.
 */
export function newsletterConsent(
  regs: Pick<ContactRegistration, 'newsletterConsent' | 'newsletterConsentAt'>[],
  card?: Pick<SavedContact, 'newsletter' | 'newsletterAt'> | null,
): NewsletterConsent {
  let best: NewsletterConsent = { agreed: false, at: null, source: null };
  for (const r of regs) {
    if (r.newsletterConsentAt && (!best.at || r.newsletterConsentAt > best.at))
      best = { agreed: !!r.newsletterConsent, at: r.newsletterConsentAt, source: 'registration' };
  }
  if (card?.newsletter && card.newsletterAt && (!best.at || card.newsletterAt >= best.at))
    best = { agreed: card.newsletter === 'yes', at: card.newsletterAt, source: 'card' };
  return best;
}

export interface Contact {
  key: string;
  /** The saved contact card, if the admin created or edited one. */
  savedId: number | null;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  role: string | null;
  linkedin: string | null;
  notes: string | null;
  tags: ContactTag[];
  newsletter: NewsletterConsent;
  /** What the team recorded on the contact card, for the edit form. */
  newsletterCard: { choice: 'yes' | 'no'; at: Date } | null;
  /** Registrations not cancelled (registered, waitlist or attended). */
  registrations: number;
  attended: number;
  /** Registered for a past event where check-in was used, but not checked in. */
  noShows: number;
  cancelled: number;
  walkIns: number;
  firstSeen: Date;
  lastEvent: ContactRegistration['event'] | null;
  history: ContactRegistration[];
  organisations: (ContactOrg & { relation: 'owner' | 'contact' })[];
  /** Their company has the same name as a member organisation in the ecosystem directory. */
  memberCompany: boolean;
}

/** A company name for matching: lowercase, letters and digits only, without "Co., Ltd." etc. */
export const companyKey = (name: string | null | undefined) =>
  (name ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\u0e00-\u0e7f]+/g, ' ')
    .replace(/\b(co|company|ltd|limited|plc|inc|sas|sarl|pte|thailand)\b/g, ' ')
    .replace(/\s+/g, '')
    .trim();

/**
 * For the board: regulars (came to REGULAR_MIN_EVENTS events or more) with no ecosystem listing
 * of their own and not working for a member organisation.
 */
export const suggestForMembership = (c: Contact) =>
  c.attended >= REGULAR_MIN_EVENTS && c.organisations.length === 0 && !c.memberCompany;

/** The key that groups one person's registrations: their email, else their name (walk-ins). */
export const contactKey = (r: { email: string | null; name: string }) =>
  r.email
    ? r.email.trim().toLowerCase()
    : `name:${r.name.trim().toLowerCase().replace(/\s+/g, ' ')}`;

/** The key of a saved contact card: its email, or its id when it has none. */
export const savedKey = (c: { id: number; email: string | null }) =>
  c.email ? c.email.trim().toLowerCase() : `id:${c.id}`;

export function buildContacts(
  regs: ContactRegistration[],
  orgs: ContactOrg[],
  now: Date,
  saved: SavedContact[] = [],
): Contact[] {
  // Past events where at least one person was checked in: there, "registered" means no-show.
  const checkInUsed = new Set(regs.filter((r) => r.status === 'attended').map((r) => r.event.id));
  const ended = (e: ContactRegistration['event']) => (e.endsAt ?? e.startsAt) < now;

  const byEmail = new Map<string, (ContactOrg & { relation: 'owner' | 'contact' })[]>();
  const link = (email: string, org: ContactOrg, relation: 'owner' | 'contact') => {
    const k = email.trim().toLowerCase();
    const list = byEmail.get(k) ?? [];
    if (!list.some((o) => o.id === org.id)) list.push({ ...org, relation });
    byEmail.set(k, list);
  };
  for (const o of orgs) {
    for (const e of o.ownerEmails) link(e, o, 'owner');
    if (o.publicEmail) link(o.publicEmail, o, 'contact');
  }

  const memberCompanies = new Set(
    orgs.filter((o) => o.memberStatus === 'member').map((o) => companyKey(o.name)),
  );
  memberCompanies.delete('');

  const groups = new Map<string, ContactRegistration[]>();
  for (const r of regs) {
    const k = contactKey(r);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const cards = new Map(saved.map((c) => [savedKey(c), c]));
  for (const k of cards.keys()) if (!groups.has(k)) groups.set(k, []);

  return [...groups.entries()]
    .map(([key, rs]): Contact => {
      const card = cards.get(key);
      // Newest registration first: its details are the most up to date.
      const history = [...rs].sort(
        (a, b) =>
          b.event.startsAt.getTime() - a.event.startsAt.getTime() ||
          b.createdAt.getTime() - a.createdAt.getTime(),
      );
      const latest = [...rs].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const pick = <K extends 'phone' | 'company' | 'role'>(k: K) =>
        latest.find((r) => r[k])?.[k] ?? null;
      const live = rs.filter((r) => r.status !== 'cancelled');
      const attended = rs.filter((r) => r.status === 'attended');
      const lastAttended = history.find((r) => r.status === 'attended');
      const first = rs.length ? Math.min(...rs.map((r) => r.createdAt.getTime())) : Infinity;
      const company = card ? card.company : pick('company');
      return {
        key,
        savedId: card?.id ?? null,
        // A saved card wins over what people typed when they registered.
        name: card?.name ?? latest[0]!.name,
        email: card ? card.email : latest[0]!.email ? latest[0]!.email.toLowerCase() : null,
        phone: card ? card.phone : pick('phone'),
        company,
        role: card ? card.role : pick('role'),
        linkedin: card?.linkedin ?? null,
        notes: card?.notes ?? null,
        tags: normalizeTags(card?.tags),
        newsletter: newsletterConsent(rs, card),
        newsletterCard:
          card?.newsletter && card.newsletterAt
            ? { choice: card.newsletter, at: card.newsletterAt }
            : null,
        registrations: live.length,
        attended: attended.length,
        noShows: rs.filter(
          (r) => r.status === 'registered' && ended(r.event) && checkInUsed.has(r.event.id),
        ).length,
        cancelled: rs.length - live.length,
        walkIns: rs.filter((r) => r.walkIn).length,
        firstSeen: new Date(Math.min(first, card?.createdAt.getTime() ?? Infinity)),
        lastEvent: (lastAttended ?? history.find((r) => r.status !== 'cancelled'))?.event ?? null,
        history,
        organisations: key.includes(':') ? [] : (byEmail.get(key) ?? []),
        memberCompany: memberCompanies.has(companyKey(company)),
      };
    })
    .sort(
      (a, b) =>
        b.attended - a.attended ||
        b.registrations - a.registrations ||
        a.name.localeCompare(b.name),
    );
}

/** Loads every registration and listing and builds the contact list (admin only). */
export async function loadContacts(now = new Date()) {
  const db = getDb();
  const [regs, orgs, saved] = await Promise.all([
    db
      .select({
        name: registrations.name,
        email: registrations.email,
        phone: registrations.phone,
        company: registrations.company,
        role: registrations.role,
        status: registrations.status,
        walkIn: registrations.walkIn,
        createdAt: registrations.createdAt,
        newsletterConsent: registrations.newsletterConsent,
        newsletterConsentAt: registrations.newsletterConsentAt,
        note: registrations.note,
        event: {
          id: events.id,
          title: events.title,
          slug: events.slug,
          startsAt: events.startsAt,
          endsAt: events.endsAt,
        },
      })
      .from(registrations)
      .innerJoin(events, eq(events.id, registrations.eventId)),
    db
      .select({
        id: organisations.id,
        slug: organisations.slug,
        name: organisations.name,
        status: organisations.status,
        memberStatus: organisations.memberStatus,
        publicEmail: organisations.publicEmail,
        ownerEmails: organisations.ownerEmails,
      })
      .from(organisations),
    db.select().from(contacts),
  ]);
  return buildContacts(regs, orgs, now, saved);
}

export const CONTACT_FILTERS = {
  all: 'Everyone',
  attended: 'Came at least once',
  regulars: 'Came 2 times or more',
  never: 'Registered, never came',
  ecosystem: 'Linked to an ecosystem listing',
  newsletter: 'Agreed to the newsletter',
  membership: 'Suggest for membership',
} as const;
export type ContactFilter = keyof typeof CONTACT_FILTERS;

/** A line explaining a filter, shown above the list while it is active. */
export const CONTACT_FILTER_HINTS: Partial<Record<ContactFilter, string>> = {
  membership: `People who came to ${REGULAR_MIN_EVENTS} or more events and have no ecosystem listing yet.`,
};

/** The list filters shared by the Contacts page and its CSV export. */
export function filterContacts(
  list: Contact[],
  {
    q = '',
    show = 'all',
    event = 0,
    tag = '',
  }: { q?: string; show?: string; event?: number; tag?: string },
) {
  const query = q.trim().toLowerCase();
  return list.filter((c) => {
    if (
      query &&
      ![c.name, c.email, c.company, c.phone, c.notes, ...c.organisations.map((o) => o.name)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    )
      return false;
    if (isContactTag(tag) && !c.tags.includes(tag)) return false;
    if (event && !c.history.some((r) => r.event.id === event && r.status !== 'cancelled'))
      return false;
    if (show === 'attended') return c.attended > 0;
    if (show === 'regulars') return c.attended > 1;
    if (show === 'never') return c.attended === 0 && c.registrations > 0;
    if (show === 'ecosystem') return c.organisations.length > 0;
    if (show === 'newsletter') return c.newsletter.agreed;
    if (show === 'membership') return suggestForMembership(c);
    return true;
  });
}

// ---------- editing (admin only) ----------

export interface ContactInput {
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  role: string | null;
  linkedin: string | null;
  notes: string | null;
  tags: ContactTag[];
  /** Set by the team when someone tells them in person; null = go by their registrations. */
  newsletter: 'yes' | 'no' | null;
  newsletterAt: Date | null;
}

/**
 * The date typed for a newsletter choice on the contact card -> a timestamp. Today means now, so
 * the choice beats a registration made earlier today; an earlier day is that day in Bangkok.
 */
export function newsletterDate(day: string, now: Date) {
  return day === toDateInput(now) ? now : fromLocalInput(day);
}

/** The contact form, as posted from /admin/contacts. */
export const ContactSchema = z.object({
  name: z.string().trim().min(2, 'Enter a name.').max(120),
  email: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() ? v.trim() : undefined),
    emailField.optional().transform((e) => e ?? null),
  ),
  phone: z
    .string()
    .trim()
    .max(40)
    .regex(/^[+\d\s().-]*$/, 'Enter a phone number (digits, spaces, +).')
    .optional()
    .transform((s) => (s ? s : null)),
  company: optionalText(120),
  role: optionalText(120),
  linkedin: optionalUrl(),
  notes: z
    .string()
    .max(4000)
    .optional()
    .transform((s) => (s?.trim() ? s.replace(/\r\n/g, '\n').trim() : null)),
  tags: z
    .array(z.enum(TAG_KEYS as [ContactTag, ...ContactTag[]]))
    .max(20)
    .default([])
    .transform(normalizeTags),
  newsletter: z
    .enum(['', 'yes', 'no'])
    .optional()
    .transform((v) => (v ? v : null)),
  newsletterAt: z
    .union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a date.')])
    .optional(),
});

/**
 * The contact form's fields, ready to save: the newsletter date is kept as it was when neither
 * the choice nor the day changed (so saving other details doesn't move it), else today if left
 * empty. A date in the future is refused.
 */
export function contactInput(
  data: z.infer<typeof ContactSchema>,
  card: { newsletter?: 'yes' | 'no' | null; newsletterAt?: Date | null } | null,
  now = new Date(),
): ContactInput | { error: string } {
  const { newsletterAt: day, ...rest } = data;
  if (!rest.newsletter) return { ...rest, newsletterAt: null };
  if (day && day > toDateInput(now)) return { error: 'The date can’t be in the future.' };
  const keep =
    card?.newsletter === rest.newsletter &&
    card.newsletterAt &&
    (!day || day === toDateInput(card.newsletterAt));
  return {
    ...rest,
    newsletterAt: keep ? card.newsletterAt! : newsletterDate(day || toDateInput(now), now),
  };
}

type Result = { key: string } | { error: string; key?: string };

/** The saved contact card for this key, if any. */
export const cardFor = async (key: string) => {
  const db = getDb();
  if (key.startsWith('name:')) return undefined;
  if (key.startsWith('id:')) {
    const id = Number(key.slice(3));
    if (!Number.isInteger(id)) return undefined;
    return (await db.select().from(contacts).where(eq(contacts.id, id)))[0];
  }
  return (await db.select().from(contacts).where(eq(contacts.email, key)))[0];
};

/** Does this key still name someone (a saved card or at least one registration)? */
export async function contactExists(key: string) {
  if (await cardFor(key)) return true;
  if (key.startsWith('id:')) return false;
  if (key.startsWith('name:')) return (await walkInIds(key)).length > 0;
  return registeredUnder(key);
}

async function registeredUnder(email: string) {
  const [row] = await getDb()
    .select({ id: registrations.id })
    .from(registrations)
    .where(eq(registrations.email, email))
    .limit(1);
  return Boolean(row);
}

/** Registrations without an email whose name groups under this walk-in key. */
const walkInIds = async (key: string) => {
  const rows = await getDb()
    .select({ id: registrations.id, name: registrations.name })
    .from(registrations)
    .where(isNull(registrations.email));
  return rows.filter((r) => contactKey({ email: null, name: r.name }) === key).map((r) => r.id);
};

/** Is this email on a saved card other than `exceptId`? */
const cardTaken = async (email: string, exceptId?: number) => {
  const [row] = await getDb()
    .select({ id: contacts.id })
    .from(contacts)
    .where(eq(contacts.email, email));
  return row && row.id !== exceptId ? row : undefined;
};

/**
 * Saves the details of the contact `key`. A new email moves their registrations to it (merging
 * with anyone who already registered with that email); a registration for an event both emails
 * signed up for stays under the old one.
 */
export async function saveContact(key: string, input: ContactInput): Promise<Result> {
  const db = getDb();
  const card = await cardFor(key);
  const email = input.email;
  if (email && (await cardTaken(email, card?.id))) {
    return { error: 'Another contact already has this email.', key: email };
  }
  if (
    !email &&
    (input.notes || input.linkedin || input.tags.length || input.newsletter) &&
    key.startsWith('name:')
  ) {
    return { error: 'Add an email to save notes, tags, newsletter or LinkedIn for a walk-in.' };
  }
  const now = new Date();

  if (key.startsWith('name:')) {
    // A walk-in who gave no email: their details live on their registrations.
    const ids = await walkInIds(key);
    if (ids.length) {
      await db
        .update(registrations)
        .set({ name: input.name, phone: input.phone, company: input.company, role: input.role })
        .where(inArray(registrations.id, ids));
      if (email) {
        await env.DB.batch(
          ids.map((id) =>
            env.DB.prepare('UPDATE OR IGNORE registrations SET email = ? WHERE id = ?').bind(
              email,
              id,
            ),
          ),
        );
      }
    }
    if (!email) return { key: contactKey({ email: null, name: input.name }) };
  } else if (!key.startsWith('id:') && email !== key) {
    if (!email) {
      // Their registrations are filed under the email: it can only go once there are none.
      if (!card || (await registeredUnder(key)))
        return { error: 'Keep an email: their registrations are filed under it.' };
    } else {
      await env.DB.prepare('UPDATE OR IGNORE registrations SET email = ? WHERE email = ?')
        .bind(email, key)
        .run();
    }
  }

  if (card) {
    await db
      .update(contacts)
      .set({ ...input, updatedAt: now })
      .where(eq(contacts.id, card.id));
    return { key: savedKey({ id: card.id, email }) };
  }
  const [row] = await db.insert(contacts).values(input).returning({ id: contacts.id });
  return { key: savedKey({ id: row!.id, email }) };
}

/** Adds someone by hand. If the email is already known, points to that contact instead. */
export async function createContact(input: ContactInput): Promise<Result> {
  const db = getDb();
  if (input.email) {
    const known =
      (await cardTaken(input.email)) ??
      (
        await db
          .select({ id: registrations.id })
          .from(registrations)
          .where(eq(registrations.email, input.email))
          .limit(1)
      )[0];
    if (known) return { error: 'This email is already in your contacts.', key: input.email };
  }
  const [row] = await db.insert(contacts).values(input).returning({ id: contacts.id });
  return { key: savedKey({ id: row!.id, email: input.email }) };
}

/**
 * Adds or removes a tag on several contacts, logging each change. Someone without a saved card
 * gets one (with the details from their latest registration), as when editing them. Walk-ins
 * without an email can't hold a card: they are skipped and counted.
 */
export async function tagContacts(
  keys: string[],
  tag: ContactTag,
  add: boolean,
  actor: string,
  now = new Date(),
) {
  const db = getDb();
  const wanted = new Set(keys);
  let changed = 0;
  let skipped = 0;
  for (const c of await loadContacts(now)) {
    if (!wanted.has(c.key)) continue;
    if (c.key.startsWith('name:')) {
      skipped++;
      continue;
    }
    const tags = withTag(c.tags, tag, add);
    if (tags.length === c.tags.length) continue; // already there, or already gone
    if (c.savedId) {
      await db.update(contacts).set({ tags, updatedAt: now }).where(eq(contacts.id, c.savedId));
    } else {
      const { name, email, phone, company, role } = c;
      await db
        .insert(contacts)
        .values({ name, email, phone, company, role, tags })
        .onConflictDoUpdate({ target: contacts.email, set: { tags, updatedAt: now } });
    }
    await audit(
      actor,
      add ? 'contact_tag_add' : 'contact_tag_remove',
      'contact',
      null,
      { key: c.key, tags: c.tags },
      { key: c.key, tags },
    );
    changed++;
  }
  return { changed, skipped };
}

/**
 * Deletes a contact: their saved card and all their registrations. Returns the events where a
 * seat was freed, so the caller can register the next person on the waitlist.
 */
export async function deleteContact(key: string) {
  const db = getDb();
  const where = key.startsWith('name:')
    ? inArray(registrations.id, await walkInIds(key))
    : key.startsWith('id:')
      ? undefined
      : eq(registrations.email, key);
  const removed = where
    ? await db
        .delete(registrations)
        .where(where)
        .returning({ eventId: registrations.eventId, status: registrations.status })
    : [];
  const card = await cardFor(key);
  if (card) await db.delete(contacts).where(eq(contacts.id, card.id));
  return {
    registrations: removed.length,
    freedEvents: [
      ...new Set(removed.filter((r) => r.status === 'registered').map((r) => r.eventId)),
    ],
  };
}

/**
 * Deletes several contacts (see deleteContact), logs each one, then gives the seats freed on
 * upcoming events to the next people on the waitlist, as when someone cancels.
 */
export async function deleteContacts(keys: string[], actor: string, now = new Date()) {
  const freed = new Set<number>();
  let deleted = 0;
  for (const key of new Set(keys)) {
    if (!(await contactExists(key))) continue;
    const { registrations: n, freedEvents } = await deleteContact(key);
    await audit(actor, 'contact_delete', 'contact', null, { key, registrations: n }, null);
    freedEvents.forEach((id) => freed.add(id));
    deleted++;
  }
  if (freed.size) {
    const settings = await getSettings();
    const rows = await getDb()
      .select()
      .from(events)
      .where(inArray(events.id, [...freed]));
    for (const event of rows) {
      if ((event.endsAt ?? event.startsAt) < now) continue;
      const row = await promoteFromWaitlist(event, { memberPriority: settings.memberPriority });
      if (row) await sendPromotion(event, row);
    }
  }
  return deleted;
}

/** A wa.me link from a phone number; Thai numbers starting with 0 get the +66 prefix. */
export function whatsappUrl(phone: string | null) {
  const raw = (phone ?? '').replace(/[^\d+]/g, '');
  let digits = raw.replace(/\D/g, '');
  if (raw.startsWith('+')) {
    // International already.
  } else if (digits.startsWith('00')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = `66${digits.slice(1)}`;
  else if (digits.length === 9) digits = `66${digits}`; // a Thai mobile typed without its 0
  digits = digits.replace(/^660/, '66'); // "+66 (0)81…"
  return digits.length >= 8 ? `https://wa.me/${digits}` : null;
}
