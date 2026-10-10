import { describe, expect, it } from 'vitest';
import { memberReports, type ReportMember } from '../src/lib/member-reports';
import {
  filterMembers,
  memberStats,
  parseMemberFilters,
  type MemberListItem,
} from '../src/lib/member-list';

const now = new Date('2026-10-06T08:00:00Z');

describe('memberReports', () => {
  const m = (p: Partial<ReportMember>): ReportMember => ({
    email: 'a@x.io',
    status: 'active',
    profileType: 'founder',
    interests: [],
    confirmedAt: new Date('2026-10-01T05:00:00Z'),
    createdAt: new Date('2025-01-01T00:00:00Z'),
    ...p,
  });
  const members = [
    m({
      email: 'a@x.io',
      interests: ['AI', 'Fintech'],
      confirmedAt: new Date('2026-08-20T05:00:00Z'),
    }),
    m({ email: 'b@x.io', profileType: 'investor', interests: ['AI'] }),
    m({ email: 'c@x.io', status: 'pending', confirmedAt: null }),
    m({ email: 'd@x.io', status: 'lapsed', confirmedAt: new Date('2025-01-10T05:00:00Z') }),
  ];
  const events = [
    {
      id: 1,
      title: 'Past, checked in',
      startsAt: new Date('2026-09-01T11:00:00Z'),
      status: 'published',
    },
    {
      id: 2,
      title: 'Past, no check-in',
      startsAt: new Date('2026-09-20T11:00:00Z'),
      status: 'published',
    },
    { id: 3, title: 'Upcoming', startsAt: new Date('2026-11-01T11:00:00Z'), status: 'published' },
  ];
  const regs = [
    { eventId: 1, email: 'A@x.io', status: 'attended' as const },
    { eventId: 1, email: 'b@x.io', status: 'attended' as const },
    { eventId: 1, email: 'z@x.io', status: 'registered' as const },
    { eventId: 2, email: 'b@x.io', status: 'registered' as const },
    { eventId: 2, email: 'y@x.io', status: 'cancelled' as const },
    { eventId: 3, email: 'a@x.io', status: 'registered' as const },
  ];
  const feedback = [
    { eventId: 1, email: 'a@x.io', rating: 5 },
    { eventId: 1, email: 'b@x.io', rating: 3 },
  ];
  const year = { from: new Date('2025-10-06T17:00:00Z'), to: new Date('2026-10-06T17:00:00Z') };
  const previous = { from: new Date('2024-10-06T17:00:00Z'), to: year.from };
  const r = memberReports(members, events, regs, feedback, year, previous, now);

  it('counts members by month with a running total', () => {
    expect(r.growth.unit).toBe('month');
    expect(r.growth.rows).toHaveLength(13);
    expect(r.growth.rows.at(-1)).toMatchObject({ key: '2026-10', added: 1, total: 3 });
    expect(r.growth.rows.find((x) => x.key === '2026-08')).toMatchObject({ added: 1, total: 2 });
    expect(r.growth.rows[0]).toMatchObject({ key: '2025-10', added: 0, total: 1 });
  });

  it('breaks active members down by profile and sector', () => {
    expect(r.totals).toMatchObject({
      active: 2,
      lapsed: 1,
      newMembers: 2,
      newBefore: 1,
    });
    expect(r.byProfile).toEqual([
      ['Founder or co-founder', 1],
      ['Investor', 1],
    ]);
    expect(r.bySector).toEqual([
      ['AI', 2],
      ['Fintech', 1],
    ]);
  });

  it('shares of attendees who are members, now and on the day', () => {
    const [second, first] = r.perEvent;
    // Event 1 used check-in: two came; a@ was a member by then, b@ only joined later.
    expect(first).toMatchObject({
      people: 2,
      counted: 'checked in',
      membersThen: 1,
      membersNow: 2,
    });
    // Event 2 had no check-ins: registrations count, cancelled ones don't.
    expect(second).toMatchObject({
      people: 1,
      counted: 'registered',
      membersThen: 0,
      membersNow: 1,
    });
    expect(r.attendeeShare).toEqual({ people: 3, then: 1 / 3, now: 1 });
  });

  it('follows members to events and event-goers to membership', () => {
    // Both active members came this year; b@ came to event 1 before joining.
    expect(r.totals).toMatchObject({
      activeWhoCame: 2,
      neverCame: 0,
      cameBefore: 1,
      newFaces: 1,
      nonMemberAttendees: 1,
      converted: 1,
      conversion: 1,
    });
    expect(r.mostEngaged[0]).toMatchObject({ email: 'b@x.io', events: 2 });
  });

  it("compares members' ratings with everyone else's", () => {
    expect(r.feedback).toEqual({
      member: { responses: 1, average: 5 },
      other: { responses: 1, average: 3 },
    });
  });
});

describe('member list filters', () => {
  const item = (p: Partial<MemberListItem>): MemberListItem =>
    ({
      id: 1,
      email: 'a@x.io',
      name: 'Alice',
      company: null,
      status: 'active',
      profileType: 'founder',
      interests: ['AI'],
      confirmedAt: new Date('2026-09-10T05:00:00Z'),
      createdAt: new Date('2026-09-10T04:00:00Z'),
      stats: { attended: 0, noShows: 0, noShowRate: null, newsletter: false },
      ...p,
    }) as MemberListItem;
  const list = [
    item({ id: 1 }),
    item({
      id: 2,
      name: 'Bob',
      interests: ['Fintech'],
      confirmedAt: new Date('2026-07-01T05:00:00Z'),
      stats: { attended: 3, noShows: 1, noShowRate: 0.25, newsletter: true },
    }),
    item({
      id: 3,
      name: 'Chloé',
      stats: { attended: 1, noShows: 0, noShowRate: 0, newsletter: false },
    }),
  ];
  const ids = (q: string) =>
    filterMembers(list, parseMemberFilters(new URLSearchParams(q))).map((m) => m.id);

  it('filters on sector, joined dates, events, no-shows and newsletter', () => {
    expect(ids('')).toEqual([1, 2, 3]);
    expect(ids('sector=AI')).toEqual([1, 3]);
    expect(ids('from=2026-09-01&to=2026-09-10')).toEqual([1, 3]);
    expect(ids('to=2026-08-31')).toEqual([2]);
    expect(ids('attended=0')).toEqual([1]);
    expect(ids('attended=3')).toEqual([2]);
    expect(ids('noshow=none')).toEqual([3]);
    expect(ids('noshow=25')).toEqual([2]);
    expect(ids('noshow=50')).toEqual([]);
    expect(ids('newsletter=yes')).toEqual([2]);
    expect(ids('newsletter=no')).toEqual([1, 3]);
    expect(ids('q=chlo')).toEqual([3]);
  });

  it('ignores values that are not offered', () => {
    expect(ids('sector=Nope&attended=7&from=yesterday')).toEqual([1, 2, 3]);
  });

  it('works out the no-show rate from check-in events only', () => {
    expect(memberStats(undefined)).toEqual({
      attended: 0,
      noShows: 0,
      noShowRate: null,
      newsletter: false,
    });
  });
});
