import { describe, expect, it } from 'vitest';
import {
  MemberAdminAction,
  MemberProfileSchema,
  MemberSignupSchema,
  memberPagePath,
  memberRegistration,
  renewalDate,
  renewalReminderDue,
  signupInput,
} from '../src/lib/members';
import { MemberRegisterSchema } from '../src/lib/registrations';

const form = {
  email: 'Jane@Example.com',
  name: 'Jane Doe',
  profileType: 'founder',
  interests: ['AI', 'Fintech'],
  linkedin: 'linkedin.com/in/jane',
  howHeard: '',
  nationality: '',
  terms: true,
  newsletter: true,
};

describe('membership sign-up', () => {
  it('accepts a complete form and normalises it', () => {
    const r = MemberSignupSchema.parse(signupInput(form));
    expect(r.email).toBe('jane@example.com');
    expect(r.linkedin).toBe('https://linkedin.com/in/jane');
    expect(r.nationality).toBeNull();
    expect(r.howHeard).toBeNull();
    expect(r.newsletter).toBe(true);
    expect(r.phone).toBeNull();
  });

  it('requires the terms', () => {
    const r = MemberSignupSchema.safeParse(signupInput({ ...form, terms: undefined }));
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(['terms']);
  });

  it('treats an unticked newsletter box as no', () => {
    const r = MemberSignupSchema.parse(signupInput({ ...form, newsletter: undefined }));
    expect(r.newsletter).toBe(false);
  });

  it('limits sectors to five known ones', () => {
    const six = ['AI', 'Fintech', 'E-commerce', 'Health', 'Mobility', 'SaaS'];
    expect(MemberProfileSchema.safeParse({ ...form, interests: six }).success).toBe(false);
    expect(MemberProfileSchema.safeParse({ ...form, interests: ['Nope'] }).success).toBe(false);
    expect(MemberProfileSchema.parse({ ...form, interests: undefined }).interests).toEqual([]);
  });

  it('needs a profile type', () => {
    expect(MemberProfileSchema.safeParse({ ...form, profileType: '' }).success).toBe(false);
  });
});

describe('membership helpers', () => {
  it('renews a year later', () => {
    const from = new Date('2026-10-06T00:00:00Z');
    expect(renewalDate(from).toISOString()).toBe('2027-10-06T00:00:00.000Z');
  });

  it('builds the member page link', () => {
    expect(memberPagePath('a+b/c')).toBe('/member?token=a%2Bb%2Fc');
  });

  it('asks for a reason before suspending', () => {
    expect(MemberAdminAction.safeParse({ action: 'suspend', ids: ['3'] }).success).toBe(false);
    const ok = MemberAdminAction.parse({ action: 'suspend', ids: ['3'], reason: 'Spam' });
    expect(ok.ids).toEqual([3]);
  });
});

describe('yearly reminders', () => {
  const due = new Date('2027-10-03T00:00:00Z');
  const daysBefore = (d: number) => new Date(due.getTime() - d * 86400_000);

  it('waits until 30 days before', () => {
    expect(renewalReminderDue(due, daysBefore(31), null)).toBeNull();
    expect(renewalReminderDue(due, daysBefore(30), null)).toBe('30:2027-10-03');
  });

  it('sends each step once, then the 7-day one', () => {
    expect(renewalReminderDue(due, daysBefore(20), '30:2027-10-03')).toBeNull();
    expect(renewalReminderDue(due, daysBefore(7), '30:2027-10-03')).toBe('7:2027-10-03');
    expect(renewalReminderDue(due, daysBefore(3), '7:2027-10-03')).toBeNull();
  });

  it('skips a missed 30-day reminder and starts over for a new due date', () => {
    expect(renewalReminderDue(due, daysBefore(5), null)).toBe('7:2027-10-03');
    expect(renewalReminderDue(due, daysBefore(25), '7:2026-10-03')).toBe('30:2027-10-03');
  });

  it('sends nothing once the year has ended (the lapsed email takes over)', () => {
    expect(renewalReminderDue(due, due, null)).toBeNull();
  });
});

describe('members-only registration', () => {
  it('registers a member with the details of their membership', () => {
    const m = {
      name: 'Jane Doe',
      email: 'jane@example.com',
      company: 'Acme',
      phone: null,
      jobTitle: 'CTO',
      howHeard: 'LinkedIn',
    } as Parameters<typeof memberRegistration>[0];
    expect(memberRegistration(m, 'Vegetarian')).toEqual({
      name: 'Jane Doe',
      email: 'jane@example.com',
      company: 'Acme',
      phone: '',
      role: 'CTO',
      howHeard: 'LinkedIn',
      note: 'Vegetarian',
      photoConsent: true,
      newsletter: false,
    });
  });

  it('asks only for the email, the note and the photo notice', () => {
    const r = MemberRegisterSchema.safeParse({ email: 'A@B.co', note: '', photoConsent: true });
    expect(r.success && r.data.email).toBe('a@b.co');
    expect(MemberRegisterSchema.safeParse({ email: 'a@b.co' }).success).toBe(false);
  });
});
