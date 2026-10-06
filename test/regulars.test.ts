import { describe, expect, it } from 'vitest';
import { REGULAR_MIN_EVENTS, earlierFor, greeting, newcomersHint } from '../src/lib/regulars';
import {
  buildContacts,
  companyKey,
  filterContacts,
  type ContactRegistration,
} from '../src/lib/contacts';

describe('greeting', () => {
  it('greets newcomers and regulars, and nobody in between', () => {
    expect(greeting(0)).toEqual({ kind: 'first', label: 'First time' });
    expect(greeting(1)).toBeNull();
    expect(greeting(REGULAR_MIN_EVENTS - 1)).toBeNull();
    expect(greeting(REGULAR_MIN_EVENTS)).toEqual({ kind: 'regular', label: 'Regular · 3 events' });
    expect(greeting(7)?.label).toBe('Regular · 7 events');
  });

  it('shows no badge when we cannot tell (no email)', () => {
    expect(greeting(null)).toBeNull();
    expect(greeting(undefined)).toBeNull();
  });
});

describe('earlierFor', () => {
  const counts = new Map([['alice@example.com', 4]]);
  it('looks people up by lowercased email; unknown emails came 0 times', () => {
    expect(earlierFor(counts, ' Alice@Example.com ')).toBe(4);
    expect(earlierFor(counts, 'new@example.com')).toBe(0);
    expect(earlierFor(counts, null)).toBeNull();
  });
});

describe('newcomersHint', () => {
  it('counts newcomers in plain English', () => {
    expect(newcomersHint(0)).toBe('');
    expect(newcomersHint(1)).toBe('Say hello to the 1 newcomer');
    expect(newcomersHint(4)).toBe('Say hello to the 4 newcomers');
  });
});

describe('Regulars not yet members', () => {
  const ev = (id: number) => ({
    id,
    title: `Event ${id}`,
    slug: `e${id}`,
    startsAt: new Date(`2026-0${id}-01T11:00:00Z`),
    endsAt: null,
  });
  const came = (email: string, n: number, company: string | null = null) =>
    Array.from({ length: n }, (_, i): ContactRegistration => ({
      name: email.split('@')[0]!,
      email,
      phone: null,
      company,
      role: null,
      status: 'attended',
      walkIn: false,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      event: ev(i + 1),
    }));
  const org = (id: number, name: string, memberStatus: string, owner: string) => ({
    id,
    slug: name.toLowerCase(),
    name,
    status: 'published',
    memberStatus,
    publicEmail: null,
    ownerEmails: [owner],
  });
  const list = buildContacts(
    [
      ...came('regular@example.com', 3),
      ...came('twice@example.com', 2),
      ...came('owner@example.com', 4),
      ...came('member@example.com', 3),
      ...came('lapsed@example.com', 3),
    ],
    [org(2, 'Bistro', 'none', 'owner@example.com')],
    new Date('2026-10-05T00:00:00Z'),
    [],
    [
      { id: 1, email: 'member@example.com', status: 'active', memberSince: null },
      { id: 2, email: 'lapsed@example.com', status: 'lapsed', memberSince: null },
    ],
  );

  it('lists regulars who are not active members', () => {
    expect(filterContacts(list, { show: 'membership' }).map((c) => c.email)).toEqual([
      'owner@example.com',
      'lapsed@example.com',
      'regular@example.com',
    ]);
  });

  it('lists active members', () => {
    expect(filterContacts(list, { show: 'members' }).map((c) => c.email)).toEqual([
      'member@example.com',
    ]);
  });

  it('matches company names loosely', () => {
    expect(companyKey('Acme Co., Ltd.')).toBe('acme');
    expect(companyKey('ACME (Thailand) Limited')).toBe('acme');
    expect(companyKey('Café Bonjour')).toBe('cafebonjour');
    expect(companyKey(null)).toBe('');
  });
});
