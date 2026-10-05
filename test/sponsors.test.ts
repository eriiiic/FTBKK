import { describe, expect, it } from 'vitest';
import {
  MAX_SPONSORS,
  SponsorsFormSchema,
  emailLogos,
  groupSponsors,
  joinNames,
  planSponsors,
  showSponsor,
  sponsorDetails,
  sponsorLine,
  type SponsorRow,
  type SponsorWithOrg,
} from '../src/lib/sponsors';
import { renderEmail } from '../src/lib/email';

const prev: SponsorRow[] = [
  { id: 10, role: 'host', organisationId: 5, name: 'Acme', logoKey: null, url: 'https://acme.co' },
  {
    id: 11,
    role: 'sponsor',
    organisationId: null,
    name: 'Beta Bank',
    logoKey: 'sponsors/beta.png',
    url: null,
  },
];
const form = (over: Record<string, unknown> = {}) =>
  SponsorsFormSchema.parse({
    sponsorId: ['10', '11'],
    sponsorRole: ['host', 'sponsor'],
    sponsorName: ['', 'Beta Bank'],
    sponsorUrl: ['', ''],
    ...over,
  });

describe('SponsorsFormSchema', () => {
  it('accepts an empty add section and defaults the role to sponsor', () => {
    const d = form({ addOrgId: '', addName: '', addUrl: '' });
    expect(d.addOrgId).toBeNull();
    expect(d.addName).toBeNull();
    expect(d.addUrl).toBeNull();
    expect(d.addRole).toBe('sponsor');
  });
  it('normalises website links', () => {
    expect(form({ addName: 'Gamma', addUrl: 'gamma.io' }).addUrl).toBe('https://gamma.io');
    expect(form({ sponsorUrl: ['', 'beta.com'] }).sponsorUrl).toEqual([null, 'https://beta.com']);
  });
  it('refuses an invalid website and an unknown role', () => {
    expect(SponsorsFormSchema.safeParse({ sponsorUrl: ['not a url'] }).success).toBe(false);
    expect(SponsorsFormSchema.safeParse({ addRole: 'owner' }).success).toBe(false);
  });
  it('refuses both a directory organisation and a name', () => {
    const r = SponsorsFormSchema.safeParse({ addOrgId: '3', addName: 'Gamma' });
    expect(r.success).toBe(false);
  });
});

describe('planSponsors', () => {
  it('keeps the form order, edits roles and hand-entered names, and adds at the end', () => {
    const plan = planSponsors(
      prev,
      form({
        sponsorId: ['11', '10'],
        sponsorRole: ['partner', 'host'],
        sponsorName: ['Beta Bank PCL', ''],
        sponsorUrl: ['beta.com', ''],
      }),
      {
        role: 'sponsor',
        organisationId: null,
        name: 'Gamma',
        logoKey: 'sponsors/g.png',
        url: null,
      },
    );
    expect(plan.map((s) => [s.id, s.name, s.role, s.sortOrder])).toEqual([
      [11, 'Beta Bank PCL', 'partner', 0],
      [10, 'Acme', 'host', 1],
      [null, 'Gamma', 'sponsor', 2],
    ]);
    expect(plan[0]!.url).toBe('https://beta.com');
    expect(plan[0]!.logoKey).toBe('sponsors/beta.png');
  });
  it('ignores name and URL fields for rows linked to an organisation', () => {
    const plan = planSponsors(
      prev,
      form({ sponsorName: ['Hacked', 'Beta Bank'], sponsorUrl: ['evil.com', ''] }),
      null,
    );
    expect(plan[0]).toMatchObject({ name: 'Acme', url: 'https://acme.co' });
  });
  it('keeps the previous name when a hand-entered name is emptied', () => {
    expect(planSponsors(prev, form({ sponsorName: ['', ' '] }), null)[1]!.name).toBe('Beta Bank');
  });
  it('removes rows and keeps rows missing from the form', () => {
    const plan = planSponsors(
      prev,
      form({ sponsorId: ['11'], sponsorRole: ['sponsor'], sponsorRemove: ['11'] }),
      null,
    );
    expect(plan.map((s) => s.id)).toEqual([10]);
  });
  it('ignores unknown and repeated ids', () => {
    const plan = planSponsors(
      prev,
      form({
        sponsorId: ['99', '10', '10', '11'],
        sponsorRole: ['host', 'host', 'host', 'sponsor'],
      }),
      null,
    );
    expect(plan.map((s) => s.id)).toEqual([10, 11]);
  });
  it('lists an organisation once per role', () => {
    const add = (role: 'host' | 'sponsor') => ({
      role,
      organisationId: 5,
      name: 'Acme',
      logoKey: null,
      url: null,
    });
    expect(planSponsors(prev, form(), add('host'))).toHaveLength(2);
    expect(planSponsors(prev, form(), add('sponsor'))).toHaveLength(3);
  });
  it('caps the list', () => {
    const many: SponsorRow[] = Array.from({ length: MAX_SPONSORS }, (_, i) => ({
      ...prev[1]!,
      id: i + 1,
    }));
    const plan = planSponsors(many, SponsorsFormSchema.parse({}), {
      ...prev[1]!,
      name: 'One too many',
    });
    expect(plan).toHaveLength(MAX_SPONSORS);
  });
});

const joined = (over: Partial<SponsorWithOrg>): SponsorWithOrg => ({
  ...prev[0]!,
  orgName: 'Acme Thailand',
  orgSlug: 'acme',
  orgLogoKey: 'orgs/acme.png',
  orgWebsite: 'https://acme.co.th',
  orgStatus: 'published',
  ...over,
});

describe('showSponsor', () => {
  it("uses a published organisation's current name, logo and ecosystem page", () => {
    expect(showSponsor(joined({}))).toEqual({
      id: 10,
      role: 'host',
      name: 'Acme Thailand',
      logoKey: 'orgs/acme.png',
      href: '/ecosystem/acme',
      external: false,
    });
  });
  it('links an unpublished organisation to its website', () => {
    expect(showSponsor(joined({ orgStatus: 'hidden' }))).toMatchObject({
      href: 'https://acme.co.th',
      external: true,
    });
    expect(showSponsor(joined({ orgStatus: 'pending', orgWebsite: null })).href).toBe(
      'https://acme.co',
    );
  });
  it('falls back to the stored values when not linked (or the organisation is gone)', () => {
    const none = {
      orgName: null,
      orgSlug: null,
      orgLogoKey: null,
      orgWebsite: null,
      orgStatus: null,
    };
    expect(showSponsor(joined({ ...none, organisationId: null }))).toMatchObject({
      name: 'Acme',
      logoKey: null,
      href: 'https://acme.co',
      external: true,
    });
    expect(showSponsor(joined({ ...none, organisationId: null, url: null })).href).toBeNull();
  });
});

const shown = [
  { role: 'partner' as const, name: 'Delta' },
  { role: 'sponsor' as const, name: 'Beta' },
  { role: 'host' as const, name: 'Acme' },
  { role: 'sponsor' as const, name: 'Gamma' },
];

describe('grouping and wording', () => {
  it('groups by role in host, sponsor, partner order', () => {
    expect(groupSponsors(shown).map((g) => [g.label, g.items.map((s) => s.name)])).toEqual([
      ['Hosted by', ['Acme']],
      ['Sponsored by', ['Beta', 'Gamma']],
      ['Partners', ['Delta']],
    ]);
    expect(groupSponsors([])).toEqual([]);
  });
  it('joins names', () => {
    expect(joinNames([])).toBe('');
    expect(joinNames(['A'])).toBe('A');
    expect(joinNames(['A', 'B'])).toBe('A and B');
    expect(joinNames(['A', 'B', 'C'])).toBe('A, B and C');
  });
  it('writes email detail rows and a one-line summary', () => {
    expect(sponsorDetails(shown)).toEqual([
      ['Hosted by', 'Acme'],
      ['Sponsored by', 'Beta and Gamma'],
      ['Partners', 'Delta'],
    ]);
    expect(sponsorLine(shown)).toBe(
      'Hosted by Acme · Sponsored by Beta and Gamma · Partners: Delta',
    );
  });
});

describe('emailLogos', () => {
  const abs = (p: string) => new URL(p, 'https://example.org').href;
  it('keeps raster logos only, with absolute URLs and the name as alt', () => {
    const logos = emailLogos(
      [
        {
          id: 1,
          role: 'host',
          name: 'A & Co',
          logoKey: 'orgs/a.png',
          href: '/ecosystem/a',
          external: false,
        },
        { id: 2, role: 'sponsor', name: 'B', logoKey: 'orgs/b.svg', href: null, external: false },
        { id: 3, role: 'sponsor', name: 'C', logoKey: null, href: null, external: false },
        {
          id: 4,
          role: 'partner',
          name: 'D',
          logoKey: 'x/d.jpg',
          href: 'https://d.io',
          external: true,
        },
      ],
      abs,
    );
    expect(logos).toEqual([
      {
        src: 'https://example.org/media/orgs/a.png',
        alt: 'A & Co',
        url: 'https://example.org/ecosystem/a',
      },
      { src: 'https://example.org/media/x/d.jpg', alt: 'D', url: 'https://d.io/' },
    ]);
    const { html, text } = renderEmail({ to: 'x@y.z', subject: 's', paragraphs: ['Hi'], logos });
    expect(html).toContain('alt="A &amp; Co"');
    expect(html).toContain('src="https://example.org/media/orgs/a.png"');
    expect(text).not.toContain('media/');
  });
});
