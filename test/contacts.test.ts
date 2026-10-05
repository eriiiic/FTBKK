import { describe, expect, it } from 'vitest';
import { buildContacts, filterContacts, type ContactRegistration } from '../src/lib/contacts';

const now = new Date('2026-10-05T08:00:00Z');
const ev = (id: number, start: string) => ({
  id,
  title: `Event ${id}`,
  slug: `e${id}`,
  startsAt: new Date(start),
  endsAt: null,
});
const e1 = ev(1, '2026-08-01T11:00:00Z');
const e2 = ev(2, '2026-09-01T11:00:00Z');
const e3 = ev(3, '2026-11-01T11:00:00Z');
const reg = (p: Partial<ContactRegistration>): ContactRegistration => ({
  name: 'Alice',
  email: 'alice@example.com',
  phone: null,
  company: null,
  role: null,
  status: 'registered',
  walkIn: false,
  createdAt: new Date('2026-07-01T00:00:00Z'),
  event: e1,
  ...p,
});

const regs = [
  reg({ status: 'attended', company: 'Old Co' }),
  reg({
    email: 'ALICE@example.com',
    name: 'Alice Martin',
    event: e2,
    status: 'registered',
    company: 'New Co',
    createdAt: new Date('2026-08-20T00:00:00Z'),
  }),
  reg({
    name: 'Alice Martin',
    event: e3,
    createdAt: new Date('2026-09-20T00:00:00Z'),
  }),
  reg({ name: 'Bob', email: 'bob@example.com', event: e2, status: 'attended' }),
  reg({ name: 'Walk  In', email: null, event: e2, status: 'attended', walkIn: true }),
  reg({ name: 'walk in', email: null, event: e1, status: 'attended', walkIn: true }),
  reg({ name: 'Carl', email: 'carl@example.com', event: e1, status: 'cancelled' }),
];
const orgs = [
  {
    id: 9,
    slug: 'acme',
    name: 'Acme',
    status: 'published',
    memberStatus: 'member',
    publicEmail: 'bob@example.com',
    ownerEmails: ['alice@example.com'],
  },
];

describe('buildContacts', () => {
  const list = buildContacts(regs, orgs, now);
  const by = (n: string) => list.find((c) => c.name === n)!;

  it('groups registrations by email, case-insensitively, with the latest details', () => {
    const a = by('Alice Martin');
    expect(a.registrations).toBe(3);
    expect(a.attended).toBe(1);
    expect(a.company).toBe('New Co');
    expect(a.lastEvent?.id).toBe(1); // last event attended wins over a later registration
  });

  it('counts a no-show only for past events where check-in was used', () => {
    expect(by('Alice Martin').noShows).toBe(1); // event 2 had check-ins, event 3 is upcoming
  });

  it('groups walk-ins without email by name', () => {
    const w = list.find((c) => c.key === 'name:walk in')!;
    expect(w.attended).toBe(2);
    expect(w.walkIns).toBe(2);
    expect(w.email).toBeNull();
  });

  it('links ecosystem listings by owner and public email', () => {
    expect(by('Alice Martin').organisations[0]).toMatchObject({ name: 'Acme', relation: 'owner' });
    expect(by('Bob').organisations[0]).toMatchObject({ relation: 'contact' });
  });

  it('keeps people who only cancelled, with nothing live', () => {
    expect(by('Carl')).toMatchObject({ registrations: 0, cancelled: 1 });
  });

  it('filters', () => {
    expect(filterContacts(list, { show: 'regulars' }).map((c) => c.key)).toEqual(['name:walk in']);
    expect(filterContacts(list, { show: 'ecosystem' })).toHaveLength(2);
    expect(filterContacts(list, { q: 'acme' })).toHaveLength(2);
    expect(filterContacts(list, { event: 3 }).map((c) => c.name)).toEqual(['Alice Martin']);
    expect(filterContacts(list, { show: 'never' })).toHaveLength(0);
  });
});
