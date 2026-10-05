import { eq } from 'drizzle-orm';
import { getDb } from '../db';
import { events, organisations, registrations } from '../db/schema';

// Contacts: everyone who ever registered for an event (or walked in), one row per person, built
// from registrations. No sign-up needed: a person is identified by their email, and walk-ins
// without an email by their name.

export interface ContactRegistration {
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  role: string | null;
  status: 'registered' | 'waitlist' | 'cancelled' | 'attended';
  walkIn: boolean;
  createdAt: Date;
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

export interface Contact {
  key: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  role: string | null;
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
}

/** The key that groups one person's registrations: their email, else their name (walk-ins). */
export const contactKey = (r: { email: string | null; name: string }) =>
  r.email
    ? r.email.trim().toLowerCase()
    : `name:${r.name.trim().toLowerCase().replace(/\s+/g, ' ')}`;

export function buildContacts(
  regs: ContactRegistration[],
  orgs: ContactOrg[],
  now: Date,
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

  const groups = new Map<string, ContactRegistration[]>();
  for (const r of regs) {
    const k = contactKey(r);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }

  return [...groups.entries()]
    .map(([key, rs]) => {
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
      return {
        key,
        name: latest[0]!.name,
        email: latest[0]!.email ? latest[0]!.email.toLowerCase() : null,
        phone: pick('phone'),
        company: pick('company'),
        role: pick('role'),
        registrations: live.length,
        attended: attended.length,
        noShows: rs.filter(
          (r) => r.status === 'registered' && ended(r.event) && checkInUsed.has(r.event.id),
        ).length,
        cancelled: rs.length - live.length,
        walkIns: rs.filter((r) => r.walkIn).length,
        firstSeen: new Date(Math.min(...rs.map((r) => r.createdAt.getTime()))),
        lastEvent: (lastAttended ?? history.find((r) => r.status !== 'cancelled'))?.event ?? null,
        history,
        organisations: key.startsWith('name:') ? [] : (byEmail.get(key) ?? []),
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
  const [regs, orgs] = await Promise.all([
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
  ]);
  return buildContacts(regs, orgs, now);
}

export const CONTACT_FILTERS = {
  all: 'Everyone',
  attended: 'Came at least once',
  regulars: 'Came 2 times or more',
  never: 'Registered, never came',
  ecosystem: 'Linked to an ecosystem listing',
} as const;
export type ContactFilter = keyof typeof CONTACT_FILTERS;

/** The list filters shared by the Contacts page and its CSV export. */
export function filterContacts(
  list: Contact[],
  { q = '', show = 'all', event = 0 }: { q?: string; show?: string; event?: number },
) {
  const query = q.trim().toLowerCase();
  return list.filter((c) => {
    if (
      query &&
      ![c.name, c.email, c.company, c.phone, ...c.organisations.map((o) => o.name)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    )
      return false;
    if (event && !c.history.some((r) => r.event.id === event && r.status !== 'cancelled'))
      return false;
    if (show === 'attended') return c.attended > 0;
    if (show === 'regulars') return c.attended > 1;
    if (show === 'never') return c.attended === 0 && c.registrations > 0;
    if (show === 'ecosystem') return c.organisations.length > 0;
    return true;
  });
}
