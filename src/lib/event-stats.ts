// Reports > Events and attendance, computed in memory from events, registrations, feedback and
// members: one row per event, totals for a period and an event type, and one event in detail.

import { DAY_MS } from './lifecycle';
import { eventKind, type EventKind } from './event-covers';
import { feedbackSummary, type FeedbackSummary } from './feedback';
import { inPeriod, periodBuckets } from './report-period';

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
  walkIn?: boolean;
  company?: string | null;
  feedbackSentAt?: Date | null;
}

export interface StatFeedback {
  eventId: number;
  rating: number;
  comment?: string | null;
  createdAt: Date;
}

export interface StatMember {
  email: string;
  status: string;
  confirmedAt: Date | null;
  createdAt: Date;
}

export const KIND_LABELS: Record<EventKind, string> = {
  connect: 'Connect',
  talk: 'Talk',
  select: 'Select',
  other: 'Other',
};

/** People a registration stands for: the person plus their guests. */
const people = (r: StatRegistration) => 1 + (r.guests ?? 0);
const sum = (rs: StatRegistration[]) => rs.reduce((n, r) => n + people(r), 0);
const ratio = (a: number, b: number) => (b > 0 ? a / b : null);
const emailOf = (e: string | null | undefined) => e?.trim().toLowerCase() || null;

export interface EventFeedback extends FeedbackSummary {
  /** Registrations the day-after email went to. */
  emailed: number;
  responseRate: number | null;
}

export interface EventRow {
  event: StatEvent;
  kind: EventKind;
  past: boolean;
  /** Seats taken: registered + checked in, with guests. */
  registered: number;
  attended: number;
  waitlist: number;
  cancelled: number;
  /** attended / registered, for past events where check-in was used; else null. */
  showUp: number | null;
  noShows: number | null;
  /** registered / capacity, when the event had a capacity. */
  fill: number | null;
  walkIns: number;
  guests: number;
  /** Named people who came: checked in, or registered when check-in wasn't used. */
  came: number;
  counted: 'checked in' | 'registered';
  /** Of them, people seen at none of our earlier events. */
  firstTimers: number;
  /** Of them, people who had come to an earlier event. */
  returning: number;
  /** Of them, members on the day of the event. */
  members: number;
  feedback: EventFeedback;
  /** Lowercased emails of the people who came (for unique counts). */
  emails: string[];
}

/** Every event but drafts, newest first, with its numbers. */
export function eventRows(
  events: StatEvent[],
  regs: StatRegistration[],
  feedback: StatFeedback[],
  members: StatMember[],
  now: Date,
): EventRow[] {
  const byEvent = group(regs, (r) => r.eventId);
  const fbByEvent = group(feedback, (f) => f.eventId);
  const memberSince = new Map(
    members
      .filter((m) => m.status !== 'pending')
      .map((m) => [m.email.toLowerCase(), m.confirmedAt ?? m.createdAt]),
  );
  const seen = new Set<string>();
  const rows = events
    .filter((e) => e.status !== 'draft')
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    .map((event): EventRow => {
      const rs = byEvent.get(event.id) ?? [];
      const by = (s: StatRegistration['status']) => rs.filter((r) => r.status === s);
      const checkedIn = by('attended');
      const attended = sum(checkedIn);
      const registered = sum(by('registered')) + attended;
      const past = event.startsAt < now;
      const showUp = past && attended > 0 && registered > 0 ? attended / registered : null;
      const came = checkedIn.length ? checkedIn : past ? by('registered') : [];
      const emails = [...new Set(came.map((r) => emailOf(r.email)).filter((e) => e !== null))];
      const firstTimers = emails.filter((e) => !seen.has(e)).length;
      if (past) for (const e of emails) seen.add(e);
      const fb = feedbackSummary(fbByEvent.get(event.id) ?? []);
      const emailed = rs.filter((r) => r.feedbackSentAt).length;
      return {
        event,
        kind: eventKind(event.series),
        past,
        registered,
        attended,
        waitlist: sum(by('waitlist')),
        cancelled: sum(by('cancelled')),
        showUp,
        noShows: showUp === null ? null : registered - attended,
        fill: event.capacity ? registered / event.capacity : null,
        walkIns: sum(rs.filter((r) => r.walkIn && r.status !== 'cancelled')),
        guests: rs
          .filter((r) => r.status === 'registered' || r.status === 'attended')
          .reduce((n, r) => n + (r.guests ?? 0), 0),
        came: came.length,
        counted: checkedIn.length ? 'checked in' : 'registered',
        firstTimers,
        returning: emails.length - firstTimers,
        members: emails.filter((e) => {
          const since = memberSince.get(e);
          return !!since && since <= event.startsAt;
        }).length,
        feedback: {
          ...fb,
          emailed,
          responseRate: emailed ? Math.min(1, fb.responses / emailed) : null,
        },
        emails,
      };
    });
  return rows.reverse();
}

export type Totals = ReturnType<typeof totals>;

/** Totals over a set of event rows. */
export function totals(rows: EventRow[]) {
  const past = rows.filter((r) => r.past);
  const checked = past.filter((r) => r.showUp !== null);
  const withRegs = past.filter((r) => r.registered > 0);
  const withCapacity = past.filter((r) => r.fill !== null);
  const s = (pick: (r: EventRow) => number, rs = rows) => rs.reduce((n, r) => n + pick(r), 0);
  const attendedChecked = s((r) => r.attended, checked);
  const registeredChecked = s((r) => r.registered, checked);
  const showUp = ratio(attendedChecked, registeredChecked);
  const came = s((r) => r.came, past);
  const known = s((r) => r.firstTimers + r.returning, past);
  const visits = new Map<string, number>();
  for (const r of past) for (const e of r.emails) visits.set(e, (visits.get(e) ?? 0) + 1);
  const responses = s((r) => r.feedback.responses);
  const ratingSum = s((r) => r.feedback.distribution.reduce((n, c, i) => n + c * (i + 1), 0));
  const emailedRows = rows.filter((r) => r.feedback.emailed > 0);
  const distribution = [0, 1, 2, 3, 4].map((i) =>
    s((r) => r.feedback.distribution[i] ?? 0),
  ) as FeedbackSummary['distribution'];
  return {
    events: rows.length,
    pastEvents: past.length,
    registered: s((r) => r.registered),
    attended: s((r) => r.attended),
    showUp,
    noShowRate: showUp === null ? null : 1 - showUp,
    noShows: registeredChecked - attendedChecked,
    avgRegistered: withRegs.length ? s((r) => r.registered, withRegs) / withRegs.length : null,
    avgAttended: checked.length ? attendedChecked / checked.length : null,
    fill: ratio(
      s((r) => r.registered, withCapacity),
      withCapacity.reduce((n, r) => n + (r.event.capacity ?? 0), 0),
    ),
    walkIns: s((r) => r.walkIns),
    guests: s((r) => r.guests),
    cancelled: s((r) => r.cancelled),
    cancelRate: ratio(
      s((r) => r.cancelled),
      s((r) => r.registered + r.cancelled),
    ),
    waitlist: s((r) => r.waitlist),
    came,
    firstTimers: s((r) => r.firstTimers, past),
    returning: s((r) => r.returning, past),
    newShare: ratio(
      s((r) => r.firstTimers, past),
      known,
    ),
    memberShare: ratio(
      s((r) => r.members, past),
      known,
    ),
    uniqueAttendees: visits.size,
    cameTwice: [...visits.values()].filter((n) => n > 1).length,
    feedback: {
      responses,
      average: responses ? ratingSum / responses : null,
      distribution,
      comments: s((r) => r.feedback.comments),
      emailed: s((r) => r.feedback.emailed),
      responseRate: ratio(
        s((r) => r.feedback.responses, emailedRows),
        s((r) => r.feedback.emailed, emailedRows),
      ),
    },
  };
}

export interface ReportFilter {
  period: { from: Date; to: Date };
  previous: { from: Date; to: Date } | null;
  kind: EventKind | null;
}

/** The overview: events of the period (and type), totals, trends and feedback. */
export function eventReport(
  rows: EventRow[],
  regs: StatRegistration[],
  feedback: StatFeedback[],
  f: ReportFilter,
  now: Date,
) {
  const ofKind = rows.filter((r) => !f.kind || r.kind === f.kind);
  const selected = ofKind.filter((r) => inPeriod(r.event.startsAt, f.period));
  const ids = new Set(ofKind.map((r) => r.event.id));
  const selectedIds = new Set(selected.map((r) => r.event.id));
  const kindRegs = regs.filter((r) => ids.has(r.eventId));

  // New registrations and check-ins over time, in the period.
  const { unit, buckets } = periodBuckets(f.period);
  const per = (pick: (r: StatRegistration) => Date | null) =>
    buckets.map((b) =>
      sum(
        kindRegs.filter((r) => {
          const d = pick(r);
          return inPeriod(d, b) && inPeriod(d, f.period);
        }),
      ),
    );
  const overTime = {
    unit,
    labels: buckets.map((b) => b.label),
    registrations: per((r) => (r.status === 'cancelled' ? null : r.createdAt)),
    checkIns: per((r) => r.checkedInAt),
  };

  // Past events with registrations, oldest first (the last 24 of the period).
  const trend = selected
    .filter((r) => r.past && r.registered > 0)
    .slice(0, 24)
    .reverse();

  // How people heard about the events.
  const heard = new Map<string, number>();
  for (const r of regs) {
    if (!selectedIds.has(r.eventId) || r.status === 'cancelled') continue;
    const k = r.howHeard?.trim() || 'Not answered';
    heard.set(k, (heard.get(k) ?? 0) + 1);
  }

  // Each type side by side, for the period (whatever type is picked).
  const inP = rows.filter((r) => inPeriod(r.event.startsAt, f.period));
  const byKind = (Object.keys(KIND_LABELS) as EventKind[])
    .map((kind) => ({
      kind,
      label: KIND_LABELS[kind],
      t: totals(inP.filter((r) => r.kind === kind)),
    }))
    .filter((k) => k.t.events > 0);

  // Latest comments of the period's events (no names: this page is shown to the board).
  const titles = new Map(selected.map((r) => [r.event.id, r.event]));
  const comments = feedback
    .filter((x) => selectedIds.has(x.eventId) && x.comment?.trim())
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 8)
    .map((x) => ({ ...x, event: titles.get(x.eventId)! }));

  const upcoming = rows
    .filter((r) => !r.past && r.event.status === 'published')
    .sort((a, b) => a.event.startsAt.getTime() - b.event.startsAt.getTime());

  return {
    rows: selected,
    totals: totals(selected),
    previous: f.previous
      ? totals(ofKind.filter((r) => inPeriod(r.event.startsAt, f.previous!)))
      : null,
    overTime,
    trend,
    howHeard: [...heard.entries()].sort((a, b) => b[1] - a[1]),
    byKind,
    comments,
    next: upcoming[0] ?? null,
    upcomingCount: upcoming.length,
    pace: upcoming[0] ? pace(upcoming[0], rows, regs, now) : null,
  };
}

/** Seats taken day by day over the 30 days before an event, next to the previous one of its type. */
export function pace(row: EventRow, rows: EventRow[], regs: StatRegistration[], now: Date) {
  const DAYS = 30;
  const curve = (r: EventRow, until: Date) => {
    const rs = regs.filter(
      (x) => x.eventId === r.event.id && (x.status === 'registered' || x.status === 'attended'),
    );
    return Array.from({ length: DAYS + 1 }, (_, i) => {
      const at = new Date(r.event.startsAt.getTime() - (DAYS - i) * DAY_MS);
      return at > until ? null : sum(rs.filter((x) => x.createdAt <= at));
    });
  };
  const previous = rows.find(
    (r) =>
      r.past &&
      r.kind === row.kind &&
      r.registered > 0 &&
      r.event.startsAt < row.event.startsAt &&
      r.event.id !== row.event.id,
  );
  return {
    labels: Array.from({ length: DAYS + 1 }, (_, i) =>
      DAYS - i === 0 ? 'Event day' : `${DAYS - i}d`,
    ),
    current: curve(row, row.past ? row.event.startsAt : now),
    previous: previous ? curve(previous, previous.event.startsAt) : null,
    previousTitle: previous?.event.title ?? null,
  };
}

const slot = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Bangkok',
});

/** One event in detail: its numbers next to the usual for its type, and what people said. */
export function eventDetail(
  row: EventRow,
  rows: EventRow[],
  regs: StatRegistration[],
  feedback: StatFeedback[],
  now: Date,
) {
  const rs = regs.filter((r) => r.eventId === row.event.id);
  // The usual: past events of the same type in the 12 months before this one.
  const yearBefore = new Date(row.event.startsAt.getTime() - 365 * DAY_MS);
  const peers = rows.filter(
    (r) =>
      r.past &&
      r.kind === row.kind &&
      r.event.id !== row.event.id &&
      r.event.startsAt < row.event.startsAt &&
      r.event.startsAt >= yearBefore,
  );

  // Arrivals at the door, by quarter of an hour.
  const quarter = 15 * 60_000;
  const arrivals = new Map<number, number>();
  for (const r of rs) {
    if (!r.checkedInAt) continue;
    const k = Math.floor(r.checkedInAt.getTime() / quarter) * quarter;
    arrivals.set(k, (arrivals.get(k) ?? 0) + people(r));
  }
  const keys = [...arrivals.keys()].sort((a, b) => a - b);
  const door: [string, number][] = [];
  for (let k = keys[0] ?? 0; keys.length && k <= keys[keys.length - 1]!; k += quarter) {
    door.push([slot.format(new Date(k)), arrivals.get(k) ?? 0]);
  }

  const tally = (pick: (r: StatRegistration) => string | null | undefined, limit = 10) => {
    const n = new Map<string, number>();
    for (const r of rs) {
      if (r.status === 'cancelled' || r.status === 'waitlist') continue;
      const k = pick(r)?.trim();
      if (k) n.set(k, (n.get(k) ?? 0) + 1);
    }
    return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit);
  };

  return {
    row,
    usual: peers.length ? totals(peers) : null,
    usualCount: peers.length,
    pace: pace(row, rows, regs, now),
    door: door.length > 64 ? [] : door,
    howHeard: tally((r) => r.howHeard || 'Not answered', 12),
    companies: tally((r) => r.company),
    comments: feedback
      .filter((f) => f.eventId === row.event.id && f.comment?.trim())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
  };
}

function group<T, K>(items: T[], key: (t: T) => K) {
  const m = new Map<K, T[]>();
  for (const t of items) {
    const k = key(t);
    const list = m.get(k);
    if (list) list.push(t);
    else m.set(k, [t]);
  }
  return m;
}
