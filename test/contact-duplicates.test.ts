import { describe, expect, it } from 'vitest';
import {
  emailLocalKey,
  findDuplicates,
  linkedinKey,
  nameKey,
  pairKey,
  phoneKey,
} from '../src/lib/contact-duplicates';
import type { Contact } from '../src/lib/contacts';

const person = (p: Partial<Contact> & { key: string }): Contact => ({
  savedId: null,
  name: 'Someone',
  email: p.key.includes(':') ? null : p.key,
  otherEmails: [],
  phone: null,
  company: null,
  role: null,
  linkedin: null,
  notes: null,
  tags: [],
  newsletter: { agreed: false, at: null, source: null },
  newsletterCard: null,
  registrations: 1,
  attended: 0,
  noShows: 0,
  cancelled: 0,
  walkIns: 0,
  firstSeen: new Date('2026-01-01'),
  lastEvent: null,
  history: [],
  organisations: [],
  member: null,
  invitedAt: null,
  ...p,
});

describe('match keys', () => {
  it('normalizes names, emails, phones and LinkedIn', () => {
    expect(nameKey('Dupont  Jéan')).toBe(nameKey('jean dupont'));
    expect(emailLocalKey('Jean.Dupont+events@gmail.com')).toBe('jeandupont');
    expect(emailLocalKey('info@company.com')).toBe('');
    expect(emailLocalKey('jd@x.com')).toBe('');
    expect(phoneKey('+66 81 234 5678')).toBe(phoneKey('081-234-5678'));
    expect(phoneKey('123')).toBe('');
    expect(linkedinKey('https://www.linkedin.com/in/Jean-Dupont/?x=1')).toBe('jean-dupont');
  });
});

describe('findDuplicates', () => {
  const contacts = [
    person({ key: 'jean.dupont@gmail.com', name: 'Jean Dupont', attended: 1 }),
    person({ key: 'jean.dupont@acme.com', name: 'J. Dupont', attended: 4 }),
    person({ key: 'name:dupont jean', name: 'Dupont Jean', attended: 1 }),
    person({ key: 'marie@a.com', name: 'Marie Curie', phone: '+66 81 111 2222' }),
    person({ key: 'mcurie@b.com', name: 'M Curie', phone: '0811112222' }),
    person({ key: 'paul@a.com', name: 'Paul', company: 'Acme Co., Ltd.' }),
    person({ key: 'paul.martin@b.com', name: 'Paul Martin', company: 'ACME' }),
    person({ key: 'alone@x.com', name: 'Alone Here' }),
  ];

  it('groups by name, email local part, phone and first name + company', () => {
    const groups = findDuplicates(contacts);
    expect(groups.map((g) => g.contacts.map((c) => c.key).sort())).toEqual(
      expect.arrayContaining([
        ['jean.dupont@acme.com', 'jean.dupont@gmail.com', 'name:dupont jean'],
        ['marie@a.com', 'mcurie@b.com'],
        ['paul.martin@b.com', 'paul@a.com'],
      ]),
    );
    expect(groups).toHaveLength(3);
    const jean = groups.find((g) => g.contacts.length === 3)!;
    expect(jean.reasons).toEqual(['name', 'email']);
    // The one with an email who came most is suggested first; the walk-in comes last.
    expect(jean.contacts[0]!.key).toBe('jean.dupont@acme.com');
    expect(jean.contacts.at(-1)!.key).toBe('name:dupont jean');
  });

  it('suggests an active member as the main contact', () => {
    const [g] = findDuplicates([
      person({ key: 'a@x.com', name: 'Ann Lee', attended: 5 }),
      person({
        key: 'b@x.com',
        name: 'Ann Lee',
        member: { id: 1, email: 'b@x.com', status: 'active', memberSince: null },
      }),
    ]);
    expect(g!.contacts[0]!.key).toBe('b@x.com');
  });

  it('skips pairs marked not the same person', () => {
    const dismissed = new Set([pairKey('mcurie@b.com', 'marie@a.com')]);
    expect(findDuplicates(contacts, dismissed)).toHaveLength(2);
  });

  it('ignores one-word names and very common values', () => {
    expect(
      findDuplicates([
        person({ key: 'a@x.com', name: 'Tom' }),
        person({ key: 'b@y.com', name: 'Tom' }),
      ]),
    ).toHaveLength(0);
    const office = Array.from({ length: 7 }, (_, i) =>
      person({ key: `p${i}@x.com`, name: `Person ${i}`, phone: '02 123 4567' }),
    );
    expect(findDuplicates(office)).toHaveLength(0);
  });
});
