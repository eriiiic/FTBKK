import { DAY_MS } from './lifecycle';
import { PROFILE_TYPES } from './members';

// Community > Reports, for the board: how membership grows, who the members are, and how many of
// the people at our events are members. Pure functions over rows the page loads.

export interface ReportMember {
  email: string;
  status: 'pending' | 'active' | 'suspended' | 'lapsed';
  profileType: string;
  interests: string[];
  confirmedAt: Date | null;
  createdAt: Date;
}
export interface ReportEvent {
  id: number;
  title: string;
  startsAt: Date;
  status: string;
}
export interface ReportRegistration {
  eventId: number;
  email: string | null;
  status: 'registered' | 'waitlist' | 'cancelled' | 'attended';
}

export interface EventShare {
  event: ReportEvent;
  /** Checked in, or registered when check-in wasn't used at that event. */
  people: number;
  counted: 'checked in' | 'registered';
  /** Of them, members on the day of the event. */
  membersThen: number;
  /** Of them, active members today. */
  membersNow: number;
}

const MONTHS = 12;
const monthLabel = new Intl.DateTimeFormat('en-GB', {
  month: 'short',
  year: '2-digit',
  timeZone: 'Asia/Bangkok',
});
// Bangkok is UTC+7 all year: shift by 7 hours to read the local month.
const OFFSET = 7 * 3600 * 1000;
const monthKey = (d: Date) => new Date(d.getTime() + OFFSET).toISOString().slice(0, 7);

/** Counts per key, biggest first, with labels; keys never seen are left out. */
function tally(keys: string[], labels: Record<string, string>): [string, number][] {
  const n = new Map<string, number>();
  for (const k of keys) n.set(k, (n.get(k) ?? 0) + 1);
  return [...n.entries()]
    .map(([k, v]) => [labels[k] ?? k, v] as [string, number])
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export function memberReports(
  members: ReportMember[],
  events: ReportEvent[],
  regs: ReportRegistration[],
  now: Date,
) {
  // Joined = confirmed their email (pending sign-ups never became members); members the team
  // added by hand have no confirmation date, so their creation date counts.
  const joined = members
    .filter((m) => m.status !== 'pending')
    .map((m) => ({ ...m, confirmedAt: m.confirmedAt ?? m.createdAt }));
  const active = members.filter((m) => m.status === 'active');

  // The last 12 months, oldest first: new members each month and the running total.
  const months: string[] = [];
  const cursor = new Date(now.getTime() + OFFSET);
  cursor.setUTCDate(1);
  for (let i = MONTHS - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() - i, 1));
    months.push(d.toISOString().slice(0, 7));
  }
  const perMonth = new Map<string, number>();
  for (const m of joined) {
    const k = monthKey(m.confirmedAt);
    perMonth.set(k, (perMonth.get(k) ?? 0) + 1);
  }
  const before = joined.filter((m) => monthKey(m.confirmedAt) < months[0]!).length;
  let running = before;
  const byMonth = months.map((k) => {
    const added = perMonth.get(k) ?? 0;
    running += added;
    return {
      key: k,
      label: monthLabel.format(new Date(`${k}-15T00:00:00Z`)),
      added,
      total: running,
    };
  });

  // Who the active members are.
  const byProfile = tally(
    active.map((m) => m.profileType),
    PROFILE_TYPES,
  );
  const bySector = tally(
    active.flatMap((m) => m.interests),
    {},
  );

  // Share of event attendees who are members, past events of the last 12 months.
  const yearAgo = new Date(now.getTime() - 365 * DAY_MS);
  const memberSince = new Map(joined.map((m) => [m.email, m.confirmedAt]));
  const activeNow = new Set(active.map((m) => m.email));
  const byEvent = new Map<number, ReportRegistration[]>();
  for (const r of regs) byEvent.set(r.eventId, [...(byEvent.get(r.eventId) ?? []), r]);
  const perEvent: EventShare[] = events
    .filter((e) => e.status !== 'draft' && e.startsAt < now && e.startsAt >= yearAgo)
    .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())
    .map((event) => {
      const rs = byEvent.get(event.id) ?? [];
      const checkedIn = rs.filter((r) => r.status === 'attended');
      const came = checkedIn.length ? checkedIn : rs.filter((r) => r.status === 'registered');
      const emails = came.map((r) => r.email?.trim().toLowerCase() ?? '');
      return {
        event,
        people: came.length,
        counted: checkedIn.length ? 'checked in' : 'registered',
        membersThen: emails.filter((e) => {
          const since = memberSince.get(e);
          return !!since && since <= event.startsAt;
        }).length,
        membersNow: emails.filter((e) => activeNow.has(e)).length,
      } satisfies EventShare;
    });
  const people = perEvent.reduce((n, e) => n + e.people, 0);
  const share = (k: 'membersThen' | 'membersNow') =>
    people ? perEvent.reduce((n, e) => n + e[k], 0) / people : null;

  const monthAgo = new Date(now.getTime() - 30 * DAY_MS);
  return {
    totals: {
      active: active.length,
      new30: joined.filter((m) => m.confirmedAt >= monthAgo).length,
      pending: members.filter((m) => m.status === 'pending').length,
      lapsed: members.filter((m) => m.status === 'lapsed').length,
    },
    byMonth,
    byProfile,
    bySector,
    perEvent,
    attendeeShare: { people, then: share('membersThen'), now: share('membersNow') },
  };
}
