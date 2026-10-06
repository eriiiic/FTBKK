import { describe, expect, it } from 'vitest';
import {
  MemberAdminAction,
  MemberProfileSchema,
  MemberSignupSchema,
  memberPagePath,
  renewalDate,
  signupInput,
} from '../src/lib/members';

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
