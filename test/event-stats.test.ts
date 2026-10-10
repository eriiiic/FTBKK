import { describe, expect, it } from 'vitest';
import {
  eventDetail,
  eventReport,
  eventRows,
  totals,
  type StatFeedback,
  type StatRegistration,
} from '../src/lib/event-stats';
import { delta, parsePeriod, periodBuckets } from '../src/lib/report-period';

const now = new Date('2026-10-04T08:00:00Z');
const d = (s: string) => new Date(s);
const events = [
  {
    id: 1,
    title: 'Connect #50',
    series: 'Connect',
    startsAt: d('2026-09-01T11:00:00Z'),
    capacity: 100,
    status: 'published',
  },
  {
    id: 2,
    title: 'Connect #51',
    series: 'Connect',
    startsAt: d('2026-10-06T11:00:00Z'),
    capacity: 3,
    status: 'published',
  },
  {
    id: 3,
    title: 'Draft',
    series: 'Other',
    startsAt: d('2026-11-01T11:00:00Z'),
    capacity: null,
    status: 'draft',
  },
];
const reg = (
  eventId: number,
  email: string,
  status: StatRegistration['status'],
  created: string,
  checked: string | null = null,
  howHeard: string | null = null,
): StatRegistration => ({
  eventId,
  email,
  status,
  createdAt: d(created),
  checkedInAt: checked ? d(checked) : null,
  howHeard,
});
const regs = [
  reg(1, 'a@x.co', 'attended', '2026-08-20T00:00:00Z', '2026-09-01T11:05:00Z', 'LinkedIn'),
  reg(1, 'b@x.co', 'attended', '2026-08-25T00:00:00Z', '2026-09-01T11:10:00Z', 'A friend'),
  reg(1, 'c@x.co', 'registered', '2026-08-30T00:00:00Z', null, 'LinkedIn'),
  reg(1, 'd@x.co', 'cancelled', '2026-08-30T00:00:00Z'),
  reg(2, 'A@x.co', 'registered', '2026-10-01T00:00:00Z', null, 'LinkedIn'),
  reg(2, 'e@x.co', 'waitlist', '2026-10-02T00:00:00Z'),
];

const feedback: StatFeedback[] = [
  { eventId: 1, rating: 5, comment: 'Great venue', createdAt: d('2026-09-02T02:00:00Z') },
  { eventId: 1, rating: 3, comment: null, createdAt: d('2026-09-02T03:00:00Z') },
];
const members = [
  {
    email: 'a@x.co',
    status: 'active',
    confirmedAt: d('2026-08-01T00:00:00Z'),
    createdAt: d('2026-08-01T00:00:00Z'),
  },
  {
    email: 'b@x.co',
    status: 'active',
    confirmedAt: d('2026-09-15T00:00:00Z'),
    createdAt: d('2026-09-15T00:00:00Z'),
  },
];
const year = { from: d('2025-10-04T17:00:00Z'), to: d('2026-10-04T17:00:00Z') };

describe('eventRows', () => {
  const rows = eventRows(events, regs, feedback, members, now);
  it('counts each event and skips drafts', () => {
    expect(rows.map((r) => r.event.id)).toEqual([2, 1]);
    const past = rows.find((r) => r.event.id === 1)!;
    expect(past).toMatchObject({
      registered: 3,
      attended: 2,
      cancelled: 1,
      waitlist: 0,
      noShows: 1,
      firstTimers: 2,
      returning: 0,
      kind: 'connect',
    });
    expect(past.showUp).toBeCloseTo(2 / 3);
    expect(past.fill).toBeCloseTo(0.03);
  });
  it('counts members on the day only', () => {
    // a@ joined before the event, b@ after it.
    expect(rows.find((r) => r.event.id === 1)!.members).toBe(1);
  });
  it('summarises feedback per event', () => {
    expect(rows.find((r) => r.event.id === 1)!.feedback).toMatchObject({
      responses: 2,
      average: 4,
      comments: 1,
    });
  });
  it('tells first-timers from returning people', () => {
    const later = [
      ...events,
      { ...events[0]!, id: 4, title: 'Connect #49', startsAt: d('2026-07-01T11:00:00Z') },
    ];
    const withEarlier = [
      ...regs,
      reg(4, 'a@x.co', 'attended', '2026-06-20T00:00:00Z', '2026-07-01T11:00:00Z'),
    ];
    const r = eventRows(later, withEarlier, [], members, now).find((x) => x.event.id === 1)!;
    expect(r).toMatchObject({ firstTimers: 1, returning: 1 });
  });
});

describe('eventReport', () => {
  const rows = eventRows(events, regs, feedback, members, now);
  const s = eventReport(rows, regs, feedback, { period: year, previous: null, kind: null }, now);
  it('finds the next event and the totals', () => {
    expect(s.next?.event.id).toBe(2);
    expect(s.next).toMatchObject({ registered: 1, waitlist: 1 });
    expect(s.totals).toMatchObject({
      events: 1,
      pastEvents: 1,
      registered: 3,
      attended: 2,
      uniqueAttendees: 2,
      cameTwice: 0,
      avgRegistered: 3,
    });
    expect(s.totals.showUp).toBeCloseTo(2 / 3);
    expect(s.totals.feedback.average).toBe(4);
    expect(s.comments.map((c) => c.comment)).toEqual(['Great venue']);
  });
  it('buckets registrations by Bangkok month', () => {
    expect(s.overTime.unit).toBe('month');
    expect(s.overTime.labels.at(-1)).toBe('Oct 26');
    expect(s.overTime.registrations.slice(-3)).toEqual([3, 0, 2]); // Aug, Sep, Oct (cancelled left out)
    expect(s.overTime.checkIns.slice(-3)).toEqual([0, 2, 0]);
  });
  it('ranks how people heard, for the period events', () => {
    expect(s.howHeard[0]).toEqual(['LinkedIn', 2]);
  });
  it('filters on event type', () => {
    const talks = eventReport(
      rows,
      regs,
      feedback,
      { period: year, previous: null, kind: 'talk' },
      now,
    );
    expect(talks.rows).toEqual([]);
    expect(talks.byKind.map((k) => k.kind)).toEqual(['connect']);
  });
});

describe('eventDetail', () => {
  it('compares with earlier events of the same type and counts arrivals', () => {
    const rows = eventRows(events, regs, feedback, members, now);
    const det = eventDetail(
      rows.find((r) => r.event.id === 1)!,
      rows,
      regs,
      feedback,
      now,
    );
    expect(det.usual).toBeNull();
    expect(det.door).toEqual([['18:00', 2]]);
    expect(det.comments).toHaveLength(1);
  });
});

describe('eventRows with guests', () => {
  const withGuests = [
    { ...regs[0]!, guests: 2 }, // attended with 2 guests
    ...regs.slice(1, 4),
    regs[4]!,
    { ...regs[5]!, guests: 1 }, // waitlisted with 1 guest
  ];
  const rows = eventRows(events, withGuests, [], [], now);
  it('counts each guest as a person in the event numbers', () => {
    const past = rows.find((r) => r.event.id === 1)!;
    expect(past).toMatchObject({ registered: 5, attended: 4, cancelled: 1, guests: 2 });
    expect(rows.find((r) => r.event.id === 2)).toMatchObject({ registered: 1, waitlist: 2 });
    expect(totals(rows)).toMatchObject({ registered: 6, attended: 4, avgRegistered: 5 });
  });
  it('keeps unique attendees to named people', () => {
    expect(totals(rows).uniqueAttendees).toBe(2);
  });
});

describe('report period', () => {
  const at = new Date('2026-10-10T09:00:00Z');
  const p = (q: string) => parsePeriod(new URLSearchParams(q), at, d('2023-05-01T00:00:00Z'));
  it('defaults to the last 12 months, in Bangkok days', () => {
    const x = p('');
    expect(x.key).toBe('12m');
    expect(x.fromInput).toBe('2025-10-11');
    expect(x.toInput).toBe('2026-10-10');
    expect(x.previous?.to).toEqual(x.from);
  });
  it('reads presets and custom dates', () => {
    expect(p('period=last-year')).toMatchObject({ fromInput: '2025-01-01', toInput: '2025-12-31' });
    expect(p('period=this-year').previous?.label).toBe('1 Jan 2025 – 10 Oct 2025');
    expect(p('period=all')).toMatchObject({ fromInput: '2023-05-01', previous: null });
    expect(p('period=custom&from=2026-03-01&to=2026-03-31')).toMatchObject({
      fromInput: '2026-03-01',
      toInput: '2026-03-31',
      label: '1 Mar 2026 – 31 Mar 2026',
    });
    // Swapped dates are put back in order; junk falls back to the default.
    expect(p('period=custom&from=2026-03-31&to=2026-03-01').fromInput).toBe('2026-03-01');
    expect(p('period=nope').key).toBe('12m');
  });
  it('picks weeks, months or years for charts', () => {
    expect(periodBuckets(p('period=30d')).unit).toBe('week');
    expect(periodBuckets(p('')).buckets).toHaveLength(13);
    expect(periodBuckets(p('period=custom&from=2019-01-01')).unit).toBe('year');
  });
  it('describes changes', () => {
    expect(delta(12, 10)).toEqual({ text: '+20%', tone: 'good' });
    expect(delta(0.5, 0.6, 'rate')).toEqual({ text: '−10 pts', tone: 'bad' });
    expect(delta(0.2, 0.1, 'rate', false)).toEqual({ text: '+10 pts', tone: 'bad' });
    expect(delta(4.3, 4.3, 'rating')).toEqual({ text: 'same', tone: 'flat' });
    expect(delta(3, 0)).toBeNull();
  });
});
