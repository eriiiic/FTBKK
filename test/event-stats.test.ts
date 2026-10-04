import { describe, expect, it } from 'vitest';
import { eventStats, type StatRegistration } from '../src/lib/event-stats';

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

describe('eventStats', () => {
  const s = eventStats(events, regs, now);
  it('counts each event and skips drafts', () => {
    expect(s.rows.map((r) => r.event.id)).toEqual([2, 1]);
    const past = s.rows.find((r) => r.event.id === 1)!;
    expect(past).toMatchObject({ registered: 3, attended: 2, cancelled: 1, waitlist: 0 });
    expect(past.showUp).toBeCloseTo(2 / 3);
  });
  it('finds the next event and the totals', () => {
    expect(s.next?.event.id).toBe(2);
    expect(s.next).toMatchObject({ registered: 1, waitlist: 1 });
    expect(s.totals).toMatchObject({
      registrations12m: 5,
      checkIns12m: 2,
      uniqueAttendees: 2,
      returning: 0,
      avgPerEvent: 3,
    });
    expect(s.totals.showUp).toBeCloseTo(2 / 3);
  });
  it('buckets registrations by Bangkok month', () => {
    expect(s.monthly.labels.at(-1)).toBe('Oct 26');
    expect(s.monthly.registrations.slice(-3)).toEqual([4, 0, 2]); // Aug, Sep, Oct
    expect(s.monthly.checkIns.slice(-3)).toEqual([0, 2, 0]);
  });
  it('ranks how people heard', () => {
    expect(s.howHeard[0]).toEqual(['LinkedIn', 3]);
  });
});
