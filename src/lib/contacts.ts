import { env } from 'cloudflare:workers';
import { eq, inArray, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../db';
import {
  contacts,
  eventFeedback,
  events,
  members,
  organisations,
  registrations,
} from '../db/schema';
import { email as emailField, optionalText, optionalUrl } from './forms';
import { promoteFromWaitlist, sendPromotion } from './registrations';
import { getSettings } from './settings';
import { audit } from './orgs';
import { fromLocalInput, toDateInput } from './admin';
import { REGULAR_MIN_EVENTS } from './regulars';
import { formatDate } from './format';

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
  /** Their answer to "How did you hear about us?". */
  howHeard?: string | null;
  /** The feedback they gave after the event (1-5 stars and a comment), if any. */
  feedbackRating?: number | null;
  feedbackComment?: string | null;
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
  /** Other emails of the same person (see contacts.otherEmails). */
  otherEmails?: string[] | null;
  name: string;
  phone: string | null;
  company: string | null;
  role: string | null;
  linkedin: string | null;
  notes: string | null;
  tags?: string[] | null;
  newsletter?: 'yes' | 'no' | null;
  newsletterAt?: Date | null;
  memberInvitedAt?: Date | null;
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
 * The most recent explicit newsletter choice: the latest registration where they ticked the box
 * (an unticked box is not recorded), unless the team recorded a later answer on the contact card.
 * Never asked = no consent.
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
  /** Their other emails: registrations made with them count as this person. */
  otherEmails: string[];
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
  /** Their individual membership (Members), by email. */
  member: ContactMember | null;
  /** Last "claim your membership" invitation (Contacts > Invite to join). */
  invitedAt: Date | null;
}

export interface ContactMember {
  id: number;
  email: string;
  status: 'pending' | 'active' | 'suspended' | 'lapsed';
  memberSince: Date | null;
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

export const isActiveMember = (c: Pick<Contact, 'member'>) => c.member?.status === 'active';

/** Regulars (came to REGULAR_MIN_EVENTS events or more) who are not members yet: invite them. */
export const suggestForMembership = (c: Contact) =>
  c.attended >= REGULAR_MIN_EVENTS && !isActiveMember(c);

/** Each other email of a saved contact -> that contact's main email. */
export function aliasMap(saved: Pick<SavedContact, 'email' | 'otherEmails'>[]) {
  const map = new Map<string, string>();
  for (const c of saved)
    if (c.email) for (const e of c.otherEmails ?? []) map.set(e.toLowerCase(), c.email);
  return map;
}

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
  memberRows: ContactMember[] = [],
): Contact[] {
  const membersByEmail = new Map(memberRows.map((m) => [m.email.toLowerCase(), m]));
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

  // Another email of a saved contact files its registrations under that contact.
  const mainOf = aliasMap(saved);
  const groups = new Map<string, ContactRegistration[]>();
  for (const r of regs) {
    const k = mainOf.get(contactKey(r)) ?? contactKey(r);
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
        otherEmails: card?.otherEmails ?? [],
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
        organisations: key.includes(':')
          ? []
          : [key, ...(card?.otherEmails ?? [])]
              .flatMap((e) => byEmail.get(e) ?? [])
              .filter((o, i, all) => all.findIndex((x) => x.id === o.id) === i),
        member: key.includes(':')
          ? null
          : ([key, ...(card?.otherEmails ?? [])].map((e) => membersByEmail.get(e)).find(Boolean) ??
            null),
        invitedAt: card?.memberInvitedAt ?? null,
      };
    })
    .sort(
      (a, b) =>
        b.attended - a.attended ||
        b.registrations - a.registrations ||
        a.name.localeCompare(b.name),
    );
}

/** Individual memberships, as buildContacts wants them (all, or one email's). */
const contactMembers = (email?: string) =>
  getDb()
    .select({
      id: members.id,
      email: members.email,
      status: members.status,
      memberSince: members.memberSince,
    })
    .from(members)
    .where(email ? eq(members.email, email) : undefined);

/** Registrations with their event, as buildContacts wants them. */
const contactRegistrations = () =>
  getDb()
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
      howHeard: registrations.howHeard,
      feedbackRating: eventFeedback.rating,
      feedbackComment: eventFeedback.comment,
      event: {
        id: events.id,
        title: events.title,
        slug: events.slug,
        startsAt: events.startsAt,
        endsAt: events.endsAt,
      },
    })
    .from(registrations)
    .innerJoin(events, eq(events.id, registrations.eventId))
    .leftJoin(eventFeedback, eq(eventFeedback.registrationId, registrations.id));

/** Loads every registration and listing and builds the contact list (admin only). */
export async function loadContacts(now = new Date()) {
  const db = getDb();
  const [regs, orgs, saved, memberRows] = await Promise.all([
    contactRegistrations(),
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
    contactMembers(),
  ]);
  return buildContacts(regs, orgs, now, saved, memberRows);
}

export const CONTACT_FILTERS = {
  all: 'Everyone',
  attended: 'Came at least once',
  regulars: 'Came 2 times or more',
  never: 'Registered, never came',
  members: 'Members',
  ecosystem: 'Linked to an ecosystem listing',
  newsletter: 'Agreed to the newsletter',
  membership: 'Regulars not yet members',
} as const;
export type ContactFilter = keyof typeof CONTACT_FILTERS;

/** A line explaining a filter, shown above the list while it is active. */
export const CONTACT_FILTER_HINTS: Partial<Record<ContactFilter, string>> = {
  members: 'People with an active individual membership (see Members for the full list).',
  membership: `People who came to ${REGULAR_MIN_EVENTS} or more events and are not members yet: select them and click Invite to join (once membership is open).`,
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
      ![
        c.name,
        c.email,
        ...c.otherEmails,
        c.company,
        c.phone,
        c.notes,
        ...c.organisations.map((o) => o.name),
      ]
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
    if (show === 'members') return isActiveMember(c);
    if (show === 'membership') return suggestForMembership(c);
    return true;
  });
}

// ---------- editing (admin only) ----------

export interface ContactInput {
  name: string;
  email: string | null;
  otherEmails: string[];
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

/** "Other emails" on the contact form: one per line (or separated by commas), lowercased. */
export const OtherEmails = z
  .string()
  .max(2000)
  .optional()
  .transform((s) => [
    ...new Set(
      (s ?? '')
        .split(/[\s,;]+/)
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    ),
  ])
  .pipe(
    z.array(z.email('One of the other emails is not valid.')).max(10, 'Up to 10 other emails.'),
  );

/** The contact form, as posted from /admin/contacts. */
export const ContactSchema = z.object({
  name: z.string().trim().min(2, 'Enter a name.').max(120),
  email: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() ? v.trim() : undefined),
    emailField.optional().transform((e) => e ?? null),
  ),
  otherEmails: OtherEmails,
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

/** When they last answered on a registration form (only a tick is recorded), or null. */
export const latestRegistrationAnswer = (
  regs: Pick<ContactRegistration, 'newsletterConsentAt'>[],
) =>
  regs.reduce<Date | null>(
    (best, r) =>
      r.newsletterConsentAt && (!best || r.newsletterConsentAt > best)
        ? r.newsletterConsentAt
        : best,
    null,
  );

/**
 * The contact form's fields, ready to save. The newsletter date is kept as it was only when the
 * card is still the answer that counts and neither the choice nor the day changed (so saving
 * other details doesn't move it). A new choice is dated today when the date is left empty or
 * still shows the old card date. A date in the future, or one older than their latest answer on a
 * registration form (so the choice would change nothing), is refused.
 */
export function contactInput(
  data: z.infer<typeof ContactSchema>,
  card: { newsletter?: 'yes' | 'no' | null; newsletterAt?: Date | null } | null,
  now = new Date(),
  latestRegAt: Date | null = null,
): ContactInput | { error: string } {
  const { newsletterAt: day, ...fields } = data;
  // The main email is never also an "other" email.
  const rest = { ...fields, otherEmails: fields.otherEmails.filter((e) => e !== fields.email) };
  if (!rest.newsletter) return { ...rest, newsletterAt: null };
  if (day && day > toDateInput(now)) return { error: 'The date can’t be in the future.' };
  const old = card?.newsletter && card.newsletterAt ? card.newsletterAt : null;
  const oldDay = old ? toDateInput(old) : null;
  const counts = !!old && (!latestRegAt || old >= latestRegAt);
  if (old && counts && card?.newsletter === rest.newsletter && (!day || day === oldDay))
    return { ...rest, newsletterAt: old };
  const at = !day || day === oldDay ? now : newsletterDate(day, now);
  if (latestRegAt && at < latestRegAt)
    return {
      error: `They ticked the newsletter box on a registration form on ${formatDate(latestRegAt)}, which is later. Pick a later date, or leave it empty for today.`,
    };
  return { ...rest, newsletterAt: at };
}

type Result = { key: string } | { error: string; key?: string };

/** SQL: the contact card lists this address among its other emails. */
const hasOtherEmail = (address: string) =>
  sql`EXISTS (SELECT 1 FROM json_each(${contacts.otherEmails}) WHERE value = ${address})`;

/**
 * The main email of the contact who has `address` as one of their other emails, or null. Lets a
 * sign-up or registration with any of someone's emails count as them.
 */
export async function mainEmailFor(address: string) {
  const [row] = await getDb()
    .select({ email: contacts.email })
    .from(contacts)
    .where(hasOtherEmail(address.trim().toLowerCase()))
    .limit(1);
  return row?.email ?? null;
}

/** The contact key for an email: its contact's main email when it is one of their other emails. */
export const resolveEmailKey = async (key: string) =>
  key.includes(':') ? key : ((await mainEmailFor(key)) ?? key);

/** Every email filed under this contact key: the main one and the card's other emails. */
const emailsOf = async (key: string) => [key, ...((await cardFor(key))?.otherEmails ?? [])];

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
  if (await registeredUnder(key)) return true;
  const [m] = await getDb()
    .select({ id: members.id })
    .from(members)
    .where(eq(members.email, key))
    .limit(1);
  return Boolean(m);
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

/**
 * Why `address` can't be one of this contact's other emails, or null when it can: it already
 * belongs to another contact card or has its own membership (merge those contacts instead).
 */
async function otherEmailTaken(address: string, exceptId?: number) {
  const db = getDb();
  const [card] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(sql`(${contacts.email} = ${address} OR ${hasOtherEmail(address)})`);
  if (card && card.id !== exceptId)
    return `${address} belongs to another contact. Merge the two contacts instead.`;
  const [m] = await db
    .select({ id: members.id })
    .from(members)
    .where(eq(members.email, address))
    .limit(1);
  if (m) return `${address} has its own membership. Merge the two contacts instead.`;
  return null;
}

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
  if (input.otherEmails.length && !email) return { error: 'Add a main email before other emails.' };
  for (const other of input.otherEmails) {
    const owner = await otherEmailTaken(other, card?.id);
    if (owner) return { error: owner };
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
  if (input.otherEmails.length && !input.email)
    return { error: 'Add a main email before other emails.' };
  for (const other of input.otherEmails) {
    const owner = await otherEmailTaken(other);
    if (owner) return { error: owner };
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
      : inArray(registrations.email, await emailsOf(key));
  const removed = where
    ? await db
        .delete(registrations)
        .where(where)
        .returning({ eventId: registrations.eventId, status: registrations.status })
    : [];
  const card = await cardFor(key);
  if (card) await db.delete(contacts).where(eq(contacts.id, card.id));
  // Their membership goes too: deleting someone's data deletes all of it.
  if (!key.startsWith('name:') && !key.startsWith('id:'))
    await db.delete(members).where(eq(members.email, key));
  return {
    registrations: removed.length,
    freedEvents: [
      ...new Set(removed.filter((r) => r.status === 'registered').map((r) => r.eventId)),
    ],
  };
}

/**
 * A deleted contact's key for the history log: a short SHA-256, so the log shows that someone
 * was deleted (and the same key twice reads the same) without keeping their email or name.
 */
export async function hashedKey(key: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `deleted:${hex.slice(0, 12)}`;
}

/**
 * Removes a deleted contact's details from the history log: their contact entries (create,
 * update, tags, newsletter) keep the action and date but lose the before/after values, and
 * "self-service:<email>" becomes "self-service".
 */
async function redactContactAudit(
  key: string,
  card: { email: string | null; name: string } | null | undefined,
) {
  const emails = [...new Set([key.includes(':') ? null : key, card?.email?.toLowerCase()])].filter(
    (e): e is string => !!e,
  );
  const redacted = JSON.stringify({ redacted: true });
  const match = `entity = 'contact' AND (
      json_extract(before, '$.key') = ?1 OR json_extract(after, '$.key') = ?1
      OR lower(json_extract(after, '$.email')) IN (SELECT value FROM json_each(?2))
      OR (?3 IS NOT NULL AND json_extract(after, '$.email') IS NULL AND json_extract(after, '$.name') = ?3))`;
  const name = key.includes(':') ? (card?.name ?? null) : null;
  await env.DB.batch([
    env.DB.prepare(`UPDATE audit_log SET before = ?4, after = ?4 WHERE ${match}`).bind(
      key,
      JSON.stringify(emails),
      name,
      redacted,
    ),
    env.DB.prepare(
      `UPDATE audit_log SET actor = 'self-service' WHERE actor IN (SELECT 'self-service:' || value FROM json_each(?1))`,
    ).bind(JSON.stringify([key, ...emails])),
  ]);
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
    const card = await cardFor(key);
    const { registrations: n, freedEvents } = await deleteContact(key);
    await redactContactAudit(key, card);
    const ref = await hashedKey(key);
    await audit(
      actor.startsWith('self-service:') ? 'self-service' : actor,
      'contact_delete',
      'contact',
      null,
      { key: ref, registrations: n },
      null,
    );
    freedEvents.forEach((id) => freed.add(id));
    deleted++;
  }
  await fillFreedSeats(freed, now);
  return deleted;
}

/** Gives seats freed on upcoming events to the next people on the waitlist. */
async function fillFreedSeats(freed: Set<number>, now: Date) {
  if (!freed.size) return;
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

/** Which of two registrations for the same event to keep when merging: the one that counts most. */
const STATUS_RANK = { attended: 3, registered: 2, waitlist: 1, cancelled: 0 } as const;

/** The details picked field by field on the merge page. */
export const MERGE_FIELDS = ['name', 'phone', 'company', 'role', 'linkedin'] as const;
export type MergeField = (typeof MERGE_FIELDS)[number];
export type MergeChoice = Partial<Record<MergeField, string>> & {
  /** The emails to keep as other emails (the rest are dropped); all of them when left out. */
  otherEmails?: string[];
};

/** Every email of these contacts (main and other), main ones first, without repeats. */
export const mergeEmails = (list: Pick<Contact, 'email' | 'otherEmails'>[]) => [
  ...new Set([
    ...list.flatMap((c) => (c.email ? [c.email] : [])),
    ...list.flatMap((c) => c.otherEmails),
  ]),
];

/**
 * Merges duplicate contacts into `keep`: one person in the end, with every registration, the
 * saved card details, and the membership. The merged contact uses keep's email as its main email,
 * or the first email among the others when keep is a walk-in without one; the other emails stay
 * on the card as other emails (those in `choice.otherEmails`, or all of them), so registrations
 * made later with any of them count as this person. Details come from `choice` when picked (any
 * value one of them has), else keep's, with gaps filled from the others; tags are combined and
 * notes put together. When two of them registered for the same event, the registration that
 * counts most stays (came > registered > waitlist > cancelled) and a seat freed on an upcoming
 * event goes to the waitlist. Returns the merged contact's key.
 */
export async function mergeContacts(
  keys: string[],
  keep: string,
  actor: string,
  now = new Date(),
  choice: MergeChoice = {},
): Promise<Result> {
  const db = getDb();
  const wanted = [...new Set([keep, ...keys])];
  if (wanted.length < 2) return { error: 'Select at least two contacts to merge.' };
  const all = await loadContacts(now);
  const people = wanted.map((k) => all.find((c) => c.key === k));
  if (people.some((c) => !c)) return { error: 'One of these contacts no longer exists.' };
  const list = people as Contact[];
  const main = list[0]!;
  const others = list.slice(1);
  const email = main.email ?? others.find((c) => c.email)?.email ?? null;
  if (!email && list.some((c) => c.key.startsWith('id:')))
    return { error: 'Add an email to one of them first, then merge.' };

  // Registrations: every one moves under the merged email (or the kept walk-in's name).
  const regs = await db
    .select({
      id: registrations.id,
      eventId: registrations.eventId,
      email: registrations.email,
      name: registrations.name,
      status: registrations.status,
    })
    .from(registrations);
  const mainOf = aliasMap(list.map((c) => ({ email: c.key, otherEmails: c.otherEmails })));
  const mine = (key: string) =>
    regs.filter((r) => {
      if (key.startsWith('id:')) return false;
      const k = contactKey({ email: r.email, name: r.name });
      return (mainOf.get(k) ?? k) === key;
    });
  const moving = list.flatMap((c) => mine(c.key));
  const byEvent = new Map<number, typeof moving>();
  for (const r of moving) byEvent.set(r.eventId, [...(byEvent.get(r.eventId) ?? []), r]);
  const freed = new Set<number>();
  for (const [eventId, rs] of byEvent) {
    const [best, ...dupes] = [...rs].sort((a, b) => STATUS_RANK[b.status] - STATUS_RANK[a.status]);
    if (dupes.length) {
      const ids = dupes.map((d) => d.id);
      // Feedback given on a duplicate moves to the registration kept, unless it has its own.
      const [own] = await db
        .select({ id: eventFeedback.id })
        .from(eventFeedback)
        .where(eq(eventFeedback.registrationId, best!.id));
      if (!own) {
        const [given] = await db
          .select({ id: eventFeedback.id })
          .from(eventFeedback)
          .where(inArray(eventFeedback.registrationId, ids))
          .limit(1);
        if (given)
          await db
            .update(eventFeedback)
            .set({ registrationId: best!.id })
            .where(eq(eventFeedback.id, given.id));
      }
      await db.delete(registrations).where(inArray(registrations.id, ids));
      if (dupes.some((d) => d.status === 'registered')) freed.add(eventId);
    }
    await db
      .update(registrations)
      .set(email ? { email } : { name: main.name })
      .where(eq(registrations.id, best!.id));
  }

  // The saved card: keep's details first, gaps filled from the others.
  const cards = list.filter((c) => c.savedId);
  // A picked value counts only if one of them has it; otherwise keep's, gaps filled from the others.
  const first = <K extends MergeField>(k: K) => {
    const picked = choice[k];
    if (picked && list.some((c) => c[k] === picked)) return picked;
    return list.find((c) => c[k])?.[k] ?? null;
  };
  const otherEmails = mergeEmails(list).filter(
    (e) => e !== email && (!choice.otherEmails || choice.otherEmails.includes(e)),
  );
  const notes = list
    .map((c) => c.notes?.trim())
    .filter(Boolean)
    .join('\n\n');
  const tags = [...new Set(list.flatMap((c) => c.tags))];
  const told = list
    .flatMap((c) => (c.newsletterCard ? [c.newsletterCard] : []))
    .sort((a, b) => b.at.getTime() - a.at.getTime())[0];
  const extra = cards.filter((c) => c.savedId !== main.savedId).map((c) => c.savedId!);
  if (extra.length) await db.delete(contacts).where(inArray(contacts.id, extra));
  const card = {
    email,
    otherEmails,
    name: first('name') ?? main.name,
    phone: first('phone'),
    company: first('company'),
    role: first('role'),
    linkedin: first('linkedin'),
    notes: notes || null,
    tags,
    newsletter: told?.choice ?? null,
    newsletterAt: told?.at ?? null,
  };
  if (main.savedId)
    await db
      .update(contacts)
      .set({ ...card, updatedAt: now })
      .where(eq(contacts.id, main.savedId));
  else if (email) await db.insert(contacts).values(card);

  // Membership: one row, under the merged email; an active one wins over the others.
  const memberRows = list.flatMap((c) => (c.member ? [c.member] : []));
  if (email && memberRows.length) {
    const rank = { active: 3, suspended: 2, lapsed: 1, pending: 0 } as const;
    const [best, ...rest] = [...memberRows].sort(
      (a, b) =>
        rank[b.status] - rank[a.status] ||
        (a.memberSince?.getTime() ?? Infinity) - (b.memberSince?.getTime() ?? Infinity),
    );
    if (rest.length)
      await db.delete(members).where(
        inArray(
          members.id,
          rest.map((m) => m.id),
        ),
      );
    if (best!.email !== email)
      await db.update(members).set({ email, updatedAt: now }).where(eq(members.id, best!.id));
  }

  await audit(
    actor,
    'contact_merge',
    'contact',
    null,
    { keys: wanted },
    { key: email ?? contactKey({ email: null, name: main.name }), registrations: moving.length },
  );
  await fillFreedSeats(freed, now);
  return { key: email ?? contactKey({ email: null, name: main.name }) };
}

/**
 * One person's contact (their registrations and saved card, without ecosystem listings), for
 * the self-service /my-data page. Null when nothing is left under this key.
 */
export async function loadContact(key: string, now = new Date()) {
  key = await resolveEmailKey(key);
  const where = key.startsWith('name:')
    ? inArray(registrations.id, await walkInIds(key))
    : key.startsWith('id:')
      ? undefined
      : inArray(registrations.email, await emailsOf(key));
  const isEmail = !key.startsWith('name:') && !key.startsWith('id:');
  const [regs, card, memberRows] = await Promise.all([
    where ? contactRegistrations().where(where) : [],
    cardFor(key),
    isEmail ? contactMembers(key) : [],
  ]);
  return (
    buildContacts(regs, [], now, card ? [card] : [], memberRows).find((c) => c.key === key) ?? null
  );
}

/**
 * Records "no" to the newsletter on the person's contact card (creating the card from their
 * latest registration if they have none), dated now, so it wins over earlier registrations.
 * Logged under `actor`. Needs an email: returns false for walk-ins without one.
 */
export async function unsubscribeNewsletter(c: Contact, actor: string, now = new Date()) {
  if (!c.email || c.key.includes(':')) return false;
  const db = getDb();
  const set = { newsletter: 'no' as const, newsletterAt: now, updatedAt: now };
  if (c.savedId) {
    await db.update(contacts).set(set).where(eq(contacts.id, c.savedId));
  } else {
    const { name, email, phone, company, role } = c;
    await db
      .insert(contacts)
      .values({ name, email, phone, company, role, newsletter: 'no', newsletterAt: now })
      .onConflictDoUpdate({ target: contacts.email, set });
  }
  await audit(
    actor,
    'contact_newsletter',
    'contact',
    null,
    { key: c.key, newsletter: c.newsletter.agreed ? 'yes' : 'no' },
    { key: c.key, newsletter: 'no' },
  );
  return true;
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
