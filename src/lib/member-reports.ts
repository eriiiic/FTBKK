import { DAY_MS } from './lifecycle';
import { PROFILE_TYPES } from './members';
import { inPeriod, periodBuckets } from './report-period';

// Reports > Membership, for the board: how membership grows over the picked period, who the
// members are, whether they come to events, how event-goers become members, and how members rate
// the events. Pure functions over rows the page loads.

export interface ReportMember {
  email: string;
  name?: string;
  status: 'pending' | 'active' | 'suspended' | 'lapsed';
  profileType: string;
  interests: string[];
  howHeard?: string | null;
  confirmedAt: Date | null;
  createdAt: Date;
  renewalDueAt?: Date | null;
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
export interface ReportFeedback {
  eventId: number;
  email: string | null;
  rating: number;
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

type Range = { from: Date; to: Date };

/** Counts per key, biggest first, with labels; keys never seen are left out. */
function tally(keys: string[], labels: Record<string, string>): [string, number][] {
  const n = new Map<string, number>();
  for (const k of keys) n.set(k, (n.get(k) ?? 0) + 1);
  return [...n.entries()]
    .map(([k, v]) => [labels[k] ?? k, v] as [string, number])
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
const ratio = (a: number, b: number) => (b > 0 ? a / b : null);
const lower = (e: string | null | undefined) => e?.trim().toLowerCase() ?? '';

export function memberReports(
  members: ReportMember[],
  events: ReportEvent[],
  regs: ReportRegistration[],
  feedback: ReportFeedback[],
  period: Range,
  previous: Range | null,
  now: Date,
) {
  // Joined = confirmed their email (pending sign-ups never became members); members the team
  // added by hand have no confirmation date, so their creation date counts.
  const joined = members
    .filter((m) => m.status !== 'pending')
    .map((m) => ({ ...m, email: lower(m.email), joinedAt: m.confirmedAt ?? m.createdAt }));
  const active = joined.filter((m) => m.status === 'active');
  const newIn = (r: Range) => joined.filter((m) => inPeriod(m.joinedAt, r));
  const fresh = newIn(period);

  // New members per week/month/year of the period, and the running total.
  const { unit, buckets } = periodBuckets(period);
  let running = joined.filter((m) => m.joinedAt < (buckets[0]?.from ?? period.from)).length;
  const growth = buckets.map((b) => {
    const added = joined.filter((m) => inPeriod(m.joinedAt, b)).length;
    running += added;
    return { key: b.key, label: b.label, added, total: running };
  });

  // Who came to which past event: checked in, or registered where check-in wasn't used.
  const byEvent = new Map<number, ReportRegistration[]>();
  for (const r of regs) byEvent.set(r.eventId, [...(byEvent.get(r.eventId) ?? []), r]);
  const past = events
    .filter((e) => e.status !== 'draft' && e.startsAt < now)
    .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());
  const cameTo = past.map((event) => {
    const rs = byEvent.get(event.id) ?? [];
    const checkedIn = rs.filter((r) => r.status === 'attended');
    const came = checkedIn.length ? checkedIn : rs.filter((r) => r.status === 'registered');
    return {
      event,
      counted: (checkedIn.length ? 'checked in' : 'registered') as EventShare['counted'],
      emails: came.map((r) => lower(r.email)),
    };
  });
  const memberSince = new Map(joined.map((m) => [m.email, m.joinedAt]));
  const activeNow = new Set(active.map((m) => m.email));
  const memberOn = (email: string, d: Date) => {
    const since = memberSince.get(email);
    return !!since && since <= d;
  };

  // Share of attendees who are members, per event of the period.
  const perEvent: EventShare[] = cameTo
    .filter((c) => inPeriod(c.event.startsAt, period))
    .map((c) => ({
      event: c.event,
      people: c.emails.length,
      counted: c.counted,
      membersThen: c.emails.filter((e) => memberOn(e, c.event.startsAt)).length,
      membersNow: c.emails.filter((e) => activeNow.has(e)).length,
    }));
  const attendees = perEvent.reduce((n, e) => n + e.people, 0);
  const share = (k: 'membersThen' | 'membersNow') =>
    ratio(
      perEvent.reduce((n, e) => n + e[k], 0),
      attendees,
    );

  // Members at events: how many active members came to at least one event of the period.
  const visits = new Map<string, number>();
  for (const c of cameTo) {
    if (!inPeriod(c.event.startsAt, period)) continue;
    for (const e of new Set(c.emails)) if (e) visits.set(e, (visits.get(e) ?? 0) + 1);
  }
  const activeWhoCame = active.filter((m) => visits.has(m.email));
  const everCame = new Set(cameTo.flatMap((c) => c.emails));
  const mostEngaged = active
    .map((m) => ({ name: m.name ?? m.email, email: m.email, events: visits.get(m.email) ?? 0 }))
    .filter((m) => m.events > 0)
    .sort((a, b) => b.events - a.events || a.name.localeCompare(b.name))
    .slice(0, 10);

  // Where new members come from: had they been to one of our events before joining?
  const firstVisit = new Map<string, Date>();
  for (const c of [...cameTo].reverse())
    for (const e of c.emails) if (e && !firstVisit.has(e)) firstVisit.set(e, c.event.startsAt);
  const cameBefore = fresh.filter((m) => {
    const v = firstVisit.get(m.email);
    return !!v && v < m.joinedAt;
  }).length;

  // Conversion: people who came to an event of the period as non-members, members now.
  const guestsThen = new Set<string>();
  for (const c of cameTo) {
    if (!inPeriod(c.event.startsAt, period)) continue;
    for (const e of c.emails) if (e && !memberOn(e, c.event.startsAt)) guestsThen.add(e);
  }
  const converted = [...guestsThen].filter((e) => {
    const since = memberSince.get(e);
    return !!since && activeNow.has(e) && since >= period.from;
  }).length;

  // Feedback: members' ratings next to everyone else's (member on the day of the event).
  const startsAt = new Map(events.map((e) => [e.id, e.startsAt]));
  const rated = { member: [] as number[], other: [] as number[] };
  for (const f of feedback) {
    const d = startsAt.get(f.eventId);
    if (!d || !inPeriod(d, period) || f.rating < 1 || f.rating > 5) continue;
    rated[memberOn(lower(f.email), d) ? 'member' : 'other'].push(f.rating);
  }
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

  const in30 = new Date(now.getTime() + 30 * DAY_MS);
  return {
    totals: {
      active: active.length,
      newMembers: fresh.length,
      newBefore: previous ? newIn(previous).length : null,
      pending: members.filter((m) => m.status === 'pending' && inPeriod(m.createdAt, period))
        .length,
      lapsed: members.filter((m) => m.status === 'lapsed').length,
      renewalsDue: active.filter(
        (m) => m.renewalDueAt && m.renewalDueAt >= now && m.renewalDueAt < in30,
      ).length,
      activeWhoCame: activeWhoCame.length,
      cameShare: ratio(activeWhoCame.length, active.length),
      neverCame: active.filter((m) => !everCame.has(m.email)).length,
      cameBefore,
      newFaces: fresh.length - cameBefore,
      nonMemberAttendees: guestsThen.size,
      converted,
      conversion: ratio(converted, guestsThen.size),
    },
    growth: { unit, rows: growth },
    byProfile: tally(
      active.map((m) => m.profileType),
      PROFILE_TYPES,
    ),
    bySector: tally(
      active.flatMap((m) => m.interests),
      {},
    ),
    howHeard: tally(
      fresh.map((m) => m.howHeard?.trim() || 'Not answered'),
      {},
    ),
    perEvent,
    attendeeShare: { people: attendees, then: share('membersThen'), now: share('membersNow') },
    mostEngaged,
    feedback: {
      member: { responses: rated.member.length, average: avg(rated.member) },
      other: { responses: rated.other.length, average: avg(rated.other) },
    },
  };
}
