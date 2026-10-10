// Numbers for the admin events dashboard, computed in memory from events and registrations.

import { DAY_MS } from './lifecycle';

export interface StatEvent {
  id: number;
  title: string;
  series: string;
  startsAt: Date;
  capacity: number | null;
  status: string;
}

export interface StatRegistration {
  eventId: number;
  /** Null for walk-ins added at the door without an email. */
  email: string | null;
  status: 'registered' | 'waitlist' | 'cancelled' | 'attended';
  createdAt: Date;
  checkedInAt: Date | null;
  howHeard: string | null;
  /** Anonymous guests coming with them; each counts as one more person. */
  guests?: number;
}

/** People a registration stands for: the person plus their guests. */
const people = (r: StatRegistration) => 1 + (r.guests ?? 0);
const sum = (rs: StatRegistration[]) => rs.reduce((n, r) => n + people(r), 0);

export interface EventRow {
  event: StatEvent;
  registered: number; // registered + attended (seats taken)
  attended: number;
  waitlist: number;
  cancelled: number;
  /** attended / registered, for past events where check-in was used; else null. */
  showUp: number | null;
}

const MONTH = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  year: '2-digit',
  timeZone: 'Asia/Bangkok',
});
const monthKey = (d: Date) => {
  const b = new Date(d.getTime() + 7 * 3600_000); // Bangkok
  return `${b.getUTCFullYear()}-${String(b.getUTCMonth() + 1).padStart(2, '0')}`;
};

export function eventStats(events: StatEvent[], regs: StatRegistration[], now: Date) {
  const byEvent = new Map<number, StatRegistration[]>();
  for (const r of regs) byEvent.set(r.eventId, [...(byEvent.get(r.eventId) ?? []), r]);

  const rows: EventRow[] = events
    .filter((e) => e.status !== 'draft')
    .map((event) => {
      const rs = byEvent.get(event.id) ?? [];
      const n = (s: StatRegistration['status']) => sum(rs.filter((r) => r.status === s));
      const attended = n('attended');
      const registered = n('registered') + attended;
      const past = event.startsAt < now;
      return {
        event,
        registered,
        attended,
        waitlist: n('waitlist'),
        cancelled: n('cancelled'),
        showUp: past && attended > 0 && registered > 0 ? attended / registered : null,
      };
    })
    .sort((a, b) => b.event.startsAt.getTime() - a.event.startsAt.getTime());

  const upcoming = rows
    .filter((r) => r.event.startsAt >= now && r.event.status === 'published')
    .reverse();
  const next = upcoming[0] ?? null;
  const past = rows.filter((r) => r.event.startsAt < now);
  const yearAgo = new Date(now.getTime() - 365 * DAY_MS);
  const recent = regs.filter((r) => r.createdAt >= yearAgo);

  // Show-up rate over past events where check-in was used.
  const checked = past.filter((r) => r.showUp !== null);
  const showUp = checked.length
    ? checked.reduce((n, r) => n + r.attended, 0) / checked.reduce((n, r) => n + r.registered, 0)
    : null;

  // Attendees: people who came (or registered, before check-in was used), by email. Guests are
  // anonymous, so they are not in the unique and returning counts.
  const visits = new Map<string, number>();
  for (const [i, r] of regs.entries()) {
    if (r.status !== 'attended') continue;
    // A walk-in without an email counts as one person we can't match to other visits.
    const e = r.email?.toLowerCase() ?? `#${i}`;
    visits.set(e, (visits.get(e) ?? 0) + 1);
  }
  const uniqueAttendees = visits.size;
  const returning = [...visits.values()].filter((n) => n > 1).length;

  const withRegs = past.filter((r) => r.registered > 0);
  const avgPerEvent = withRegs.length
    ? withRegs.reduce((n, r) => n + r.registered, 0) / withRegs.length
    : null;

  // Last 12 months of new registrations and check-ins.
  const bkk = new Date(now.getTime() + 7 * 3600_000);
  const months = Array.from({ length: 12 }, (_, i) => {
    // The 15th of each month, Bangkok time: safely inside it whatever the time zone.
    const date = new Date(Date.UTC(bkk.getUTCFullYear(), bkk.getUTCMonth() - 11 + i, 15));
    return { key: monthKey(date), label: MONTH.format(date) };
  });
  const perMonth = (pick: (r: StatRegistration) => Date | null) =>
    months.map(({ key }) => sum(regs.filter((r) => pick(r) && monthKey(pick(r)!) === key)));
  const monthly = {
    labels: months.map((m) => m.label),
    registrations: perMonth((r) => r.createdAt),
    checkIns: perMonth((r) => r.checkedInAt),
  };

  // The last 12 past events that had registrations, oldest first.
  const trendRows = withRegs.slice(0, 12).reverse();
  const perEvent = {
    labels: trendRows.map((r) => r.event.title),
    dates: trendRows.map((r) => r.event.startsAt),
    registered: trendRows.map((r) => r.registered),
    attended: trendRows.map((r) => r.attended),
  };

  // Registration pace: seats taken N days before the event, next event vs the last one.
  const DAYS = 30;
  const pace = (row: EventRow | undefined, until: Date) => {
    if (!row) return null;
    const rs = (byEvent.get(row.event.id) ?? []).filter(
      (r) => r.status === 'registered' || r.status === 'attended',
    );
    return Array.from({ length: DAYS + 1 }, (_, i) => {
      const at = new Date(row.event.startsAt.getTime() - (DAYS - i) * DAY_MS);
      return at > until ? null : sum(rs.filter((r) => r.createdAt <= at));
    });
  };
  const previous = withRegs[0];
  const paceChart = {
    labels: Array.from({ length: DAYS + 1 }, (_, i) =>
      DAYS - i === 0 ? 'Event day' : `${DAYS - i}d`,
    ),
    next: next ? pace(next, now) : null,
    previous: pace(previous, previous?.event.startsAt ?? now),
    previousTitle: previous?.event.title ?? null,
  };

  // How people heard about the events (last 12 months).
  const heard = new Map<string, number>();
  for (const r of recent) {
    if (r.status === 'cancelled') continue;
    const k = r.howHeard || 'Not answered';
    heard.set(k, (heard.get(k) ?? 0) + 1);
  }
  const howHeard = [...heard.entries()].sort((a, b) => b[1] - a[1]);

  return {
    rows,
    next,
    upcomingCount: upcoming.length,
    totals: {
      registrations12m: sum(recent.filter((r) => r.status !== 'cancelled')),
      checkIns12m: sum(regs.filter((r) => r.checkedInAt && r.checkedInAt >= yearAgo)),
      showUp,
      uniqueAttendees,
      returning,
      avgPerEvent,
    },
    monthly,
    perEvent,
    pace: paceChart,
    howHeard,
  };
}
