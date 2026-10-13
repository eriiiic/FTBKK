import { describe, expect, it } from 'vitest';
import {
  communityMessage,
  decodeRecipientList,
  optedOutEmails,
  parseRecipientsCsv,
  segmentRecipients,
  CommunityEmailSchema,
} from '../src/lib/community-emails';
import { cardRefs, emailMarkdown, type EmailCard } from '../src/lib/email-markdown';
import { renderEmail } from '../src/lib/email';

const ORIGIN = 'https://ft.example';
const event: EmailCard = {
  kind: 'event',
  title: 'French Tech Connect #53',
  url: `${ORIGIN}/events/connect-53`,
  image: `${ORIGIN}/media/images/cover.jpg`,
  meta: 'Thu 5 November 2026, 18:30 – 21:00',
  place: 'True Digital Park',
  summary: 'Our monthly networking evening.',
};

describe('parseRecipientsCsv', () => {
  it('reads email and name columns in any order, skipping bad rows and repeats', () => {
    const r = parseRecipientsCsv(
      'Company,Name,E-mail\nAcme,Marie Dupont,Marie@Example.com\nX,Bad,not-an-email\nY,Again,marie@example.com\nZ,,somchai@example.com\n',
    );
    expect(r.error).toBe('');
    expect(r.recipients).toEqual([
      { name: 'Marie Dupont', email: 'marie@example.com' },
      { name: '', email: 'somchai@example.com' },
    ]);
    expect(r.invalid).toBe(1);
    expect(r.duplicates).toBe(1);
  });

  it('joins first and last names, and accepts semicolons', () => {
    const r = parseRecipientsCsv('first name;last name;email\nAnn;Lee;ann@x.io\n');
    expect(r.recipients).toEqual([{ name: 'Ann Lee', email: 'ann@x.io' }]);
  });

  it('reads a file without a header line when its first row holds an email', () => {
    const r = parseRecipientsCsv('ann@x.io,Ann Lee\nBob,bob@x.io\n');
    expect(r.recipients.map((x) => x.email)).toEqual(['ann@x.io']);
    expect(r.invalid).toBe(1);
  });

  it('explains a file without an email column', () => {
    expect(parseRecipientsCsv('name,phone\nAnn,0812345678').error).toMatch(/"email" column/);
    expect(parseRecipientsCsv('').error).toMatch(/empty/);
  });
});

describe('decodeRecipientList', () => {
  it('keeps valid entries only and ignores tampered input', () => {
    expect(decodeRecipientList('[{"name":"Ann","email":"ANN@x.io"}]')).toEqual([
      { name: 'Ann', email: 'ann@x.io' },
    ]);
    expect(decodeRecipientList('[{"name":"Ann","email":"nope"}]')).toEqual([]);
    expect(decodeRecipientList('{oops')).toEqual([]);
  });
});

describe('optedOutEmails', () => {
  it('lists every address of people who said no, not of those never asked', () => {
    const out = optedOutEmails([
      {
        email: 'no@x.io',
        otherEmails: ['Old@x.io'],
        newsletter: { agreed: false, at: new Date(), source: 'card' },
      },
      {
        email: 'never@x.io',
        otherEmails: [],
        newsletter: { agreed: false, at: null, source: null },
      },
    ]);
    expect([...out]).toEqual(['no@x.io', 'old@x.io']);
  });
});

describe('emailMarkdown', () => {
  it('renders Markdown with inline styles and absolute links and images', () => {
    const r = emailMarkdown(
      '## News\n\nHello **all**,\nsee [our events](/events).\n\n![Team](/media/images/a.jpg)',
      new Map(),
      ORIGIN,
    );
    expect(r.html).toContain('<h2 style=');
    expect(r.html).toContain('<strong>all</strong>');
    expect(r.html).toContain(`href="${ORIGIN}/events"`);
    expect(r.html).toContain(`src="${ORIGIN}/media/images/a.jpg"`);
    expect(r.html).toMatch(/Hello <strong>all<\/strong>,<br/);
    expect(r.paragraphs).toEqual([
      'News',
      `Hello all,\nsee our events (${ORIGIN}/events).`,
      `Team: ${ORIGIN}/media/images/a.jpg`,
    ]);
  });

  it('turns card lines into cards and reports the ones naming nothing', () => {
    const md = 'Join us:\n\n{{event: connect-53}}\n\n{{post: gone}}\n\nSee you!';
    expect(cardRefs(md)).toEqual([
      { kind: 'event', slug: 'connect-53' },
      { kind: 'post', slug: 'gone' },
    ]);
    const r = emailMarkdown(md, new Map([['event:connect-53', event]]), ORIGIN);
    expect(r.html).toContain('French Tech Connect #53');
    expect(r.html).toContain('See the event and register');
    expect(r.html).toContain(event.image);
    expect(r.html).not.toContain('{{');
    expect(r.missing).toEqual(['post:gone']);
    expect(r.paragraphs).toEqual([
      'Join us:',
      `EVENT: French Tech Connect #53\nThu 5 November 2026, 18:30 – 21:00 · True Digital Park\nOur monthly networking evening.\n${event.url}`,
      'See you!',
    ]);
  });

  it('strips HTML typed into the message', () => {
    const r = emailMarkdown(
      'Hi <script>alert(1)</script><b onclick="x">there</b>',
      new Map(),
      ORIGIN,
    );
    expect(r.html).not.toMatch(/script|onclick/);
  });
});

describe('communityMessage', () => {
  it('fills {name} in, escaped, in the HTML and the text', () => {
    const msg = communityMessage('csv', {
      subject: 'Hi {name}',
      body: 'Hello {name},\n\nSee you soon.',
      actionLabel: '',
      actionUrl: null,
    });
    const m = msg.to({ name: '<Ann> Lee', email: 'ann@x.io' });
    expect(m.subject).toBe('Hi <Ann>');
    expect(m.paragraphs).toEqual(['Hello <Ann>,', 'See you soon.']);
    expect(m.bodyHtml).toContain('Hello &lt;Ann&gt;,');
    expect(m.footer).toMatch(/mailing list/);
    const { html, text } = renderEmail(m);
    expect(html).toContain('Hello &lt;Ann&gt;,');
    expect(text).toContain('Hello <Ann>,');
  });

  it('uses "there" without a name', () => {
    const m = communityMessage('all', {
      subject: 'News',
      body: 'Hello {name}, here is our news.',
      actionLabel: '',
      actionUrl: null,
    }).to({ name: '', email: 'x@x.io' });
    expect(m.paragraphs[0]).toBe('Hello there, here is our news.');
    expect(m.footer).toMatch(/in touch with/);
  });
});

describe('groups and tags audience', () => {
  const said = (agreed: boolean, at: Date | null) => ({ agreed, at, source: 'card' as const });
  const people = [
    { name: 'Ann', email: 'ann@x.io', newsletter: said(false, null), tags: ['vip'], groups: [] },
    { name: 'Ben', email: 'BEN@x.io', newsletter: said(true, new Date()), tags: [], groups: [2] },
    {
      name: 'Cid',
      email: 'cid@x.io',
      newsletter: said(false, new Date()),
      tags: ['vip'],
      groups: [2],
    },
    { name: 'Dan', email: null, newsletter: said(false, null), tags: ['vip'], groups: [] },
    { name: 'Eve', email: 'eve@x.io', newsletter: said(false, null), tags: [], groups: [3] },
  ];

  it('takes everyone with one of the tags or in one of the groups, minus who said no', () => {
    const emails = (tags: string[], groups: number[]) =>
      segmentRecipients(people, { tags, groups }).map((r) => r.email);
    expect(emails(['vip'], [])).toEqual(['ann@x.io']);
    expect(emails(['vip'], [2])).toEqual(['ann@x.io', 'ben@x.io']);
    expect(emails([], [3])).toEqual(['eve@x.io']);
    expect(emails([], [])).toEqual([]);
  });

  it('needs at least one group or tag', () => {
    const base = { audience: 'segment', subject: 'Hello all', body: 'A message for you.' };
    expect(CommunityEmailSchema.safeParse(base).success).toBe(false);
    expect(CommunityEmailSchema.safeParse({ ...base, segGroups: ['2'] }).success).toBe(true);
  });
});
