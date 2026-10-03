import { describe, expect, it } from 'vitest';
import { registrationState } from '../src/lib/registrations';

const DAY = 86400_000;
const now = new Date('2026-11-01T03:00:00Z');
const event = (over: Partial<Parameters<typeof registrationState>[0]> = {}) => ({
  status: 'published' as const,
  startsAt: new Date(now.getTime() + 10 * DAY),
  capacity: 50 as number | null,
  registrationOpen: true,
  registrationOpensAt: null as Date | null,
  registrationClosesAt: null as Date | null,
  memberEarlyDays: 0,
  memberReservedSeats: 0,
  ...over,
});

describe('registrationState', () => {
  it('counts spots left and switches to the waitlist when full', () => {
    expect(registrationState(event(), 48, now)).toMatchObject({
      open: true,
      spotsLeft: 2,
      full: false,
    });
    expect(registrationState(event(), 50, now)).toMatchObject({
      open: true,
      spotsLeft: 0,
      full: true,
    });
    expect(registrationState(event(), 60, now).spotsLeft).toBe(0);
  });

  it('has no limit without a capacity', () => {
    expect(registrationState(event({ capacity: null }), 500, now)).toMatchObject({
      open: true,
      spotsLeft: null,
      full: false,
      capacity: null,
    });
  });

  it('is closed for drafts, when switched off, and after closing time or start', () => {
    expect(registrationState(event({ status: 'draft' }), 0, now).reason).toBe('closed');
    expect(registrationState(event({ status: 'cancelled' }), 0, now).reason).toBe('closed');
    expect(registrationState(event({ registrationOpen: false }), 0, now).reason).toBe('closed');
    expect(
      registrationState(event({ registrationClosesAt: new Date(now.getTime() - 1) }), 0, now)
        .reason,
    ).toBe('ended');
    expect(registrationState(event({ startsAt: now }), 0, now).reason).toBe('ended');
  });

  it('waits for the opening time', () => {
    const opensAt = new Date(now.getTime() + DAY);
    const s = registrationState(event({ registrationOpensAt: opensAt }), 0, now);
    expect(s).toMatchObject({ open: false, reason: 'not_yet', opensAt });
    expect(registrationState(event({ registrationOpensAt: now }), 0, now).open).toBe(true);
  });

  describe('member priority', () => {
    const opensAt = new Date(now.getTime() + 2 * DAY);
    const e = event({ registrationOpensAt: opensAt, memberEarlyDays: 3, memberReservedSeats: 10 });

    it('lets members in early and keeps reserved seats for them', () => {
      const member = registrationState(e, 0, now, { memberPriority: true, isMember: true });
      expect(member).toMatchObject({ open: true, capacity: 50, spotsLeft: 50 });
      const pub = registrationState(e, 0, now, { memberPriority: true, isMember: false });
      expect(pub).toMatchObject({ open: false, reason: 'not_yet', capacity: 40 });
    });

    it('fills the public seats before the reserved ones', () => {
      const later = new Date(opensAt.getTime() + 1);
      expect(registrationState(e, 40, later, { memberPriority: true })).toMatchObject({
        full: true,
      });
      expect(
        registrationState(e, 40, later, { memberPriority: true, isMember: true }),
      ).toMatchObject({ full: false, spotsLeft: 10 });
    });

    it('does nothing while the setting is off', () => {
      const s = registrationState(e, 0, now, { memberPriority: false, isMember: true });
      expect(s).toMatchObject({ open: false, capacity: 50 });
    });
  });
});
