import { describe, expect, it } from 'vitest';
import {
  ContactSchema,
  aliasMap,
  buildContacts,
  mergeEmails,
  contactInput,
  hashedKey,
  latestRegistrationAnswer,
  newsletterConsent,
  newsletterDate,
  filterContacts,
  normalizeTags,
  withTag,
  whatsappUrl,
  type ContactRegistration,
  type SavedContact,
} from '../src/lib/contacts';

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

describe('saved contact cards', () => {
  const card = (p: Partial<SavedContact>): SavedContact => ({
    id: 1,
    email: null,
    name: 'Card',
    phone: null,
    company: null,
    role: null,
    linkedin: null,
    notes: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...p,
  });
  const list = buildContacts(regs, orgs, now, [
    card({ id: 1, email: 'bob@example.com', name: 'Robert Lee', company: null, notes: 'VIP' }),
    card({ id: 2, name: 'Dana Manual', phone: '081 234 5678' }),
  ]);

  it('override the details from registrations, including emptied fields', () => {
    const bob = list.find((c) => c.key === 'bob@example.com')!;
    expect(bob).toMatchObject({ savedId: 1, name: 'Robert Lee', company: null, notes: 'VIP' });
    expect(bob.attended).toBe(1);
    expect(bob.firstSeen.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('add people who never registered', () => {
    const dana = list.find((c) => c.key === 'id:2')!;
    expect(dana).toMatchObject({ registrations: 0, lastEvent: null, organisations: [] });
  });
});

describe('other emails', () => {
  const card: SavedContact = {
    id: 9,
    email: 'bob@example.com',
    otherEmails: ['carl@example.com'],
    name: 'Bob',
    phone: null,
    company: null,
    role: null,
    linkedin: null,
    notes: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  };

  it('file registrations made with another email under the main one', () => {
    const list = buildContacts(regs, orgs, now, [card]);
    expect(list.find((c) => c.key === 'carl@example.com')).toBeUndefined();
    const bob = list.find((c) => c.key === 'bob@example.com')!;
    expect(bob.otherEmails).toEqual(['carl@example.com']);
    expect(bob.history).toHaveLength(2);
    expect(bob.cancelled).toBe(1);
    expect(aliasMap([card]).get('carl@example.com')).toBe('bob@example.com');
  });

  it('are found by the Contacts search', () => {
    const list = buildContacts(regs, orgs, now, [card]);
    expect(filterContacts(list, { q: 'carl@' }).map((c) => c.key)).toEqual(['bob@example.com']);
  });

  it('are read one per line, lowercased, without the main email', () => {
    const parsed = ContactSchema.parse({
      name: 'Bob',
      email: 'bob@example.com',
      otherEmails: 'Bob.Work@Example.com\n bob@example.com, bob.work@example.com',
    });
    expect(parsed.otherEmails).toEqual(['bob.work@example.com', 'bob@example.com']);
    const input = contactInput(parsed, null);
    expect('otherEmails' in input && input.otherEmails).toEqual(['bob.work@example.com']);
    expect(ContactSchema.safeParse({ name: 'Bob', otherEmails: 'not-an-email' }).success).toBe(
      false,
    );
  });

  it('are all offered when merging, main ones first', () => {
    expect(
      mergeEmails([
        { email: 'a@x.io', otherEmails: ['b@x.io'] },
        { email: null, otherEmails: [] },
        { email: 'b@x.io', otherEmails: ['c@x.io'] },
      ]),
    ).toEqual(['a@x.io', 'b@x.io', 'c@x.io']);
  });
});

describe('contact tags', () => {
  const card = (p: Partial<SavedContact>): SavedContact => ({
    id: 1,
    email: null,
    name: 'Card',
    phone: null,
    company: null,
    role: null,
    linkedin: null,
    notes: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...p,
  });

  it('keeps known tags only, once each, in the fixed order', () => {
    expect(normalizeTags(['press', 'speaker', 'press', 'vip', 3])).toEqual(['speaker', 'press']);
    expect(normalizeTags(null)).toEqual([]);
  });

  it('adds and removes one tag', () => {
    expect(withTag(['press'], 'board', true)).toEqual(['board', 'press']);
    expect(withTag(['board', 'press'], 'board', true)).toEqual(['board', 'press']);
    expect(withTag(['board', 'press'], 'press', false)).toEqual(['board']);
    expect(withTag([], 'press', false)).toEqual([]);
  });

  it('come from the saved card and filter the list, with the other filters', () => {
    const list = buildContacts(regs, orgs, now, [
      card({ id: 1, email: 'bob@example.com', name: 'Bob', tags: ['speaker', 'bogus'] }),
      card({ id: 2, name: 'Dana Manual', tags: ['speaker', 'board'] }),
    ]);
    expect(list.find((c) => c.key === 'bob@example.com')!.tags).toEqual(['speaker']);
    expect(list.find((c) => c.key === 'alice@example.com')!.tags).toEqual([]);
    expect(filterContacts(list, { tag: 'speaker' }).map((c) => c.key)).toEqual([
      'bob@example.com',
      'id:2',
    ]);
    expect(filterContacts(list, { tag: 'board' }).map((c) => c.key)).toEqual(['id:2']);
    expect(filterContacts(list, { tag: 'speaker', show: 'attended' }).map((c) => c.key)).toEqual([
      'bob@example.com',
    ]);
    expect(filterContacts(list, { tag: 'speaker', q: 'dana' }).map((c) => c.key)).toEqual(['id:2']);
    // An unknown tag in the URL filters nothing out.
    expect(filterContacts(list, { tag: 'vip' })).toHaveLength(list.length);
  });

  it('are validated on the contact form', () => {
    const ok = ContactSchema.parse({ name: 'Bob', tags: ['press', 'speaker', 'press'] });
    expect(ok.tags).toEqual(['speaker', 'press']);
    expect(ContactSchema.parse({ name: 'Bob' }).tags).toEqual([]);
    expect(ContactSchema.safeParse({ name: 'Bob', tags: ['vip'] }).success).toBe(false);
  });
});

describe('whatsappUrl', () => {
  it('adds the Thai prefix to local numbers and keeps international ones', () => {
    expect(whatsappUrl('081 234 5678')).toBe('https://wa.me/66812345678');
    expect(whatsappUrl('+33 6 12 34 56 78')).toBe('https://wa.me/33612345678');
    expect(whatsappUrl('0033 6 12 34 56 78')).toBe('https://wa.me/33612345678');
    expect(whatsappUrl('81 234 5678')).toBe('https://wa.me/66812345678');
    expect(whatsappUrl('+66 (0)81 234 5678')).toBe('https://wa.me/66812345678');
    expect(whatsappUrl('12')).toBeNull();
    expect(whatsappUrl(null)).toBeNull();
  });
});

describe('newsletter consent', () => {
  const d = (s: string) => new Date(s);
  const asked = (yes: boolean, at: string) => ({
    newsletterConsent: yes,
    newsletterConsentAt: d(at),
  });

  it('is no when they were never asked (Wix imports, walk-ins)', () => {
    expect(newsletterConsent([{ newsletterConsent: false, newsletterConsentAt: null }])).toEqual({
      agreed: false,
      at: null,
      source: null,
    });
    expect(newsletterConsent([])).toMatchObject({ agreed: false, source: null });
  });

  it('follows the latest dated registration answer', () => {
    // Only ticks are dated now; an older undated "no" (unticked box) never withdraws a yes.
    const regs = [
      asked(true, '2026-08-01T00:00:00Z'),
      { newsletterConsent: false, newsletterConsentAt: null },
    ];
    expect(newsletterConsent(regs)).toEqual({
      agreed: true,
      at: d('2026-08-01T00:00:00Z'),
      source: 'registration',
    });
  });

  it('takes the contact card when it is the more recent choice', () => {
    const regs = [asked(true, '2026-08-01T00:00:00Z')];
    const card = { newsletter: 'no' as const, newsletterAt: d('2026-09-01T00:00:00Z') };
    expect(newsletterConsent(regs, card)).toMatchObject({ agreed: false, source: 'card' });
    expect(newsletterConsent([asked(true, '2026-09-15T00:00:00Z')], card)).toMatchObject({
      agreed: true,
      source: 'registration',
    });
    expect(newsletterConsent(regs, { newsletter: null, newsletterAt: null })).toMatchObject({
      agreed: true,
    });
  });

  it('feeds the contact list filter', () => {
    const list = buildContacts(
      [
        reg({ ...asked(true, '2026-08-01T00:00:00Z') }),
        reg({ email: 'bob@example.com', name: 'Bob', ...asked(false, '2026-08-01T00:00:00Z') }),
      ],
      [],
      now,
    );
    expect(filterContacts(list, { show: 'newsletter' }).map((c) => c.email)).toEqual([
      'alice@example.com',
    ]);
  });

  it('dates a card choice: today is now, another day is that day in Bangkok', () => {
    expect(newsletterDate('2026-10-05', now)).toBe(now);
    expect(newsletterDate('2026-09-30', now)).toEqual(d('2026-09-29T17:00:00Z'));
  });

  it('keeps the card date when the choice did not change, and refuses future dates', () => {
    const base = ContactSchema.parse({ name: 'Alice', newsletter: 'yes', newsletterAt: '' });
    const card = { newsletter: 'yes' as const, newsletterAt: d('2026-09-01T03:00:00Z') };
    expect(contactInput(base, card, now)).toMatchObject({ newsletterAt: card.newsletterAt });
    expect(contactInput({ ...base, newsletter: 'no' }, card, now)).toMatchObject({
      newsletter: 'no',
      newsletterAt: now,
    });
    expect(contactInput({ ...base, newsletterAt: '2026-10-06' }, card, now)).toHaveProperty(
      'error',
    );
    expect(contactInput({ ...base, newsletter: null }, card, now)).toMatchObject({
      newsletter: null,
      newsletterAt: null,
    });
  });

  it('dates a changed choice today when the old card date was left in the form', () => {
    // Card yes on 1 Sept, they ticked the box on 10 Sept, then asked to stop on 5 Oct.
    const card = { newsletter: 'yes' as const, newsletterAt: d('2026-08-31T17:00:00Z') };
    const regAt = d('2026-09-10T05:00:00Z');
    const form = ContactSchema.parse({
      name: 'Alice',
      newsletter: 'no',
      newsletterAt: '2026-09-01',
    });
    const input = contactInput(form, card, now, regAt);
    expect(input).toMatchObject({ newsletter: 'no', newsletterAt: now });
    const saved = input as { newsletter: 'no'; newsletterAt: Date };
    expect(newsletterConsent([asked(true, '2026-09-10T05:00:00Z')], saved).agreed).toBe(false);
  });

  it('dates the same choice today when a later registration overrode the card', () => {
    const card = { newsletter: 'yes' as const, newsletterAt: d('2026-08-31T17:00:00Z') };
    const form = ContactSchema.parse({ name: 'Alice', newsletter: 'yes', newsletterAt: '' });
    expect(contactInput(form, card, now, d('2026-09-20T05:00:00Z'))).toMatchObject({
      newsletterAt: now,
    });
  });

  it('refuses a card date older than their latest registration answer', () => {
    const form = ContactSchema.parse({
      name: 'Alice',
      newsletter: 'no',
      newsletterAt: '2026-09-05',
    });
    const r = contactInput(form, null, now, d('2026-09-10T05:00:00Z'));
    expect(r).toHaveProperty('error');
    expect((r as { error: string }).error).toContain('10 September 2026');
  });

  it('finds the latest registration answer', () => {
    expect(latestRegistrationAnswer([])).toBeNull();
    expect(
      latestRegistrationAnswer([
        asked(true, '2026-08-01T00:00:00Z'),
        { newsletterConsentAt: null },
        asked(true, '2026-09-01T00:00:00Z'),
      ]),
    ).toEqual(d('2026-09-01T00:00:00Z'));
  });
});

describe('hashedKey', () => {
  it('is short, stable and hides the email', async () => {
    const a = await hashedKey('pat@example.com');
    expect(a).toMatch(/^deleted:[0-9a-f]{12}$/);
    expect(await hashedKey('pat@example.com')).toBe(a);
    expect(await hashedKey('sam@example.com')).not.toBe(a);
  });
});
