import { describe, expect, it } from 'vitest';
import { NOTE_MAX, RegisterSchema, cleanNote, registrationState } from '../src/lib/registrations';

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

describe('RegisterSchema newsletter consent', () => {
  const form = { name: 'Alice', email: 'Alice@Example.com', photoConsent: true };
  it('is opt-in: an unticked box (absent) is a no, a ticked one a yes', () => {
    expect(RegisterSchema.parse(form).newsletter).toBe(false);
    expect(RegisterSchema.parse({ ...form, newsletter: true }).newsletter).toBe(true);
    expect(RegisterSchema.safeParse({ ...form, newsletter: 'yes' }).success).toBe(false);
  });
});

describe('registration note', () => {
  const form = { name: 'Alice', email: 'alice@example.com', photoConsent: true };
  it('is optional and empty by default', () => {
    expect(RegisterSchema.parse(form).note).toBe('');
    expect(RegisterSchema.parse({ ...form, note: '   ' }).note).toBe('');
  });
  it('keeps plain text, line breaks included, and tidies the edges', () => {
    expect(
      RegisterSchema.parse({ ...form, note: '  Vegetarian\r\nLooking for a CTO  ' }).note,
    ).toBe('Vegetarian\nLooking for a CTO');
    expect(RegisterSchema.parse({ ...form, note: '<b>hi</b>' }).note).toBe('<b>hi</b>');
  });
  it('keeps a note that says exactly "on" (formToObject turns it into true)', () => {
    expect(RegisterSchema.parse({ ...form, note: true }).note).toBe('on');
  });
  it(`refuses more than ${NOTE_MAX} characters, counted after cleaning`, () => {
    expect(RegisterSchema.safeParse({ ...form, note: 'a'.repeat(NOTE_MAX) }).success).toBe(true);
    expect(
      RegisterSchema.safeParse({ ...form, note: ` ${'a'.repeat(NOTE_MAX)}\n\n` }).success,
    ).toBe(true);
    const r = RegisterSchema.safeParse({ ...form, note: 'a'.repeat(NOTE_MAX + 1) });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(['note']);
  });
});

describe('cleanNote', () => {
  it('drops control characters but keeps tabs and newlines', () => {
    expect(cleanNote('a\u0000b\u0007c\td\ne\u007f')).toBe('abc\td\ne');
  });
  it('keeps at most one blank line in a row and trims trailing spaces per line', () => {
    expect(cleanNote('one   \n\n\n\ntwo\t\nthree')).toBe('one\n\ntwo\nthree');
  });
});
