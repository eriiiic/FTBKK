import { describe, expect, it } from 'vitest';
import {
  addMonths,
  daysUntil,
  remindersDue,
  renewalDates,
  shouldDelete,
  shouldExpire,
  type ReminderCandidate,
} from '../src/lib/lifecycle';

const d = (s: string) => new Date(s);
const org = (over: Partial<ReminderCandidate> = {}): ReminderCandidate => ({
  id: 1,
  status: 'published',
  renewalDueAt: d('2027-10-03T02:00:00Z'),
  ownerEmails: ['owner@example.com'],
  ...over,
});

describe('renewal dates', () => {
  it('sets renewal 12 months after confirmation', () => {
    const r = renewalDates(d('2026-10-03T05:00:00Z'));
    expect(r.renewalDueAt.toISOString()).toBe('2027-10-03T05:00:00.000Z');
  });
  it('clamps 29 February to 28 February', () => {
    expect(addMonths(d('2028-02-29T00:00:00Z'), 12).toISOString()).toBe('2029-02-28T00:00:00.000Z');
  });
  it('counts Bangkok calendar days', () => {
    // Due at 00:00 Bangkok on the 3rd: one day away at 23:59 on the 2nd, due day one minute later.
    expect(daysUntil(d('2026-10-02T17:00:00Z'), d('2026-10-02T16:59:00Z'))).toBe(1);
    expect(daysUntil(d('2026-10-02T17:00:00Z'), d('2026-10-02T17:01:00Z'))).toBe(0);
  });
});

describe('reminder selection', () => {
  const due = d('2027-10-03T02:00:00Z');
  const at = (daysBefore: number) => new Date(due.getTime() - daysBefore * 86400e3);

  it('sends nothing more than 30 days before', () => {
    expect(remindersDue([org()], at(31), new Set())).toEqual([]);
  });
  it('sends the 30, 14 and 0 day reminders on their day', () => {
    expect(remindersDue([org()], at(30), new Set())[0]?.offset).toBe(30);
    expect(remindersDue([org()], at(14), new Set())[0]?.offset).toBe(14);
    expect(remindersDue([org()], at(0), new Set())[0]?.offset).toBe(0);
  });
  it('catches up the next day after a missed run, but never twice', () => {
    const first = remindersDue([org()], at(29), new Set());
    expect(first[0]?.offset).toBe(30);
    const sent = new Set(first.map((r) => `${r.orgId}:${r.kind}`));
    expect(remindersDue([org()], at(28), sent)).toEqual([]);
  });
  it('skips unclaimed and unpublished listings', () => {
    expect(remindersDue([org({ ownerEmails: [] })], at(30), new Set())).toEqual([]);
    expect(remindersDue([org({ status: 'pending' })], at(30), new Set())).toEqual([]);
  });
  it('resets after a confirmation moves the renewal date', () => {
    const sent = new Set([`1:renewal-30:2027-10-03`]);
    const moved = org({ renewalDueAt: d('2028-10-03T02:00:00Z') });
    expect(remindersDue([moved], d('2028-09-03T02:00:00Z'), sent)[0]?.kind).toBe(
      'renewal-30:2028-10-03',
    );
  });
});

describe('expiry and deletion', () => {
  it('expires 30 days after the renewal date', () => {
    expect(shouldExpire(org(), d('2027-11-01T02:00:00Z'))).toBe(false);
    expect(shouldExpire(org(), d('2027-11-02T02:00:00Z'))).toBe(true);
  });
  it('never expires unclaimed listings', () => {
    expect(shouldExpire(org({ ownerEmails: [] }), d('2028-11-02T02:00:00Z'))).toBe(false);
  });
  it('deletes 12 months after expiry', () => {
    const expiredAt = d('2027-11-02T02:00:00Z');
    expect(shouldDelete({ status: 'expired', expiredAt }, d('2028-11-01T02:00:00Z'))).toBe(false);
    expect(shouldDelete({ status: 'expired', expiredAt }, d('2028-11-02T02:00:00Z'))).toBe(true);
  });
});
