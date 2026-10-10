import { desc } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../db';
import { members } from '../db/schema';
import { loadContacts, type Contact } from './contacts';
import { SECTORS } from './directory';
import { fromLocalInput } from './admin';
import { MEMBER_STATUSES, PROFILE_TYPES } from './members';

// Admin > Members > All members: the filters, shared by the page and its CSV export. Event figures
// (attended, no-shows) and the newsletter answer come from Contacts, matched by email.

export type MemberRow = typeof members.$inferSelect;

export interface MemberStats {
  attended: number;
  /** Registered for a past event where check-in was used, but not checked in. */
  noShows: number;
  /** noShows ÷ (attended + noShows); null when they never had an event where check-in was used. */
  noShowRate: number | null;
  newsletter: boolean;
}

export type MemberListItem = MemberRow & { stats: MemberStats };

const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined);
const oneOf = (keys: string[]) =>
  z
    .string()
    .optional()
    .transform((v) => (v && keys.includes(v) ? v : ''))
    .catch('');

/** What the attended and no-show selects offer. */
export const ATTENDED_FILTERS = {
  '0': 'Never came to an event',
  '1': 'Came at least once',
  '3': 'Came 3 times or more',
  '5': 'Came 5 times or more',
} as const;
export const NO_SHOW_FILTERS = {
  none: 'Always came when registered',
  '25': 'No-shows 25% or more',
  '50': 'No-shows 50% or more',
} as const;

export const MemberListFilters = z.object({
  q: z
    .string()
    .optional()
    .transform((v) => (v ?? '').trim().slice(0, 100))
    .catch(''),
  status: oneOf(Object.keys(MEMBER_STATUSES)),
  type: oneOf(Object.keys(PROFILE_TYPES)),
  sector: oneOf([...SECTORS]),
  from: day,
  to: day,
  attended: oneOf(Object.keys(ATTENDED_FILTERS)),
  noshow: oneOf(Object.keys(NO_SHOW_FILTERS)),
  newsletter: oneOf(['yes', 'no']),
});
export type MemberListFilters = z.infer<typeof MemberListFilters>;

export const parseMemberFilters = (params: URLSearchParams) =>
  MemberListFilters.parse(Object.fromEntries(params));

/** True when any filter beyond the defaults is set (to show "Clear filters"). */
export const hasFilters = (f: MemberListFilters) =>
  Object.values(f).some((v) => v !== '' && v !== undefined);

/** When someone became a member (confirmed their email), else when they signed up. */
export const joinedAt = (m: Pick<MemberRow, 'confirmedAt' | 'createdAt'>) =>
  m.confirmedAt ?? m.createdAt;

export function memberStats(c: Contact | undefined): MemberStats {
  const attended = c?.attended ?? 0;
  const noShows = c?.noShows ?? 0;
  return {
    attended,
    noShows,
    noShowRate: attended + noShows ? noShows / (attended + noShows) : null,
    newsletter: c?.newsletter.agreed ?? false,
  };
}

export function filterMembers(list: MemberListItem[], f: MemberListFilters): MemberListItem[] {
  const q = f.q.toLowerCase();
  // "Joined between" covers whole Bangkok days: from 00:00 on the first to 00:00 after the last.
  const from = f.from ? fromLocalInput(f.from).getTime() : -Infinity;
  const to = f.to ? fromLocalInput(f.to).getTime() + 86_400_000 : Infinity;
  const minAttended = f.attended ? Number(f.attended) : null;
  return list.filter((m) => {
    if (f.status && m.status !== f.status) return false;
    if (f.type && m.profileType !== f.type) return false;
    if (f.sector && !m.interests.includes(f.sector)) return false;
    const joined = joinedAt(m).getTime();
    if (joined < from || joined >= to) return false;
    if (minAttended === 0 && m.stats.attended > 0) return false;
    if (minAttended && m.stats.attended < minAttended) return false;
    const rate = m.stats.noShowRate;
    if (f.noshow === 'none' && (rate === null || rate > 0)) return false;
    if (f.noshow && f.noshow !== 'none' && (rate === null || rate * 100 < Number(f.noshow)))
      return false;
    if (f.newsletter && m.stats.newsletter !== (f.newsletter === 'yes')) return false;
    if (q && ![m.name, m.email, m.company ?? ''].some((s) => s.toLowerCase().includes(q)))
      return false;
    return true;
  });
}

/** Every member with their event figures, newest first. */
export async function loadMemberList(): Promise<MemberListItem[]> {
  const [rows, contacts] = await Promise.all([
    getDb().select().from(members).orderBy(desc(members.createdAt)),
    loadContacts(),
  ]);
  const byEmail = new Map(contacts.map((c) => [c.key, c]));
  return rows.map((m) => ({ ...m, stats: memberStats(byEmail.get(m.email)) }));
}
