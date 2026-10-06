import { describe, expect, it } from 'vitest';
import {
  EventEmailSchema,
  audienceCounts,
  eventBroadcast,
  personalise,
  recipientsFor,
  toParagraphs,
} from '../src/lib/event-emails';
import { renderEmail } from '../src/lib/email';
import { communityEmail, uniqueRecipients } from '../src/lib/community-emails';

const rows = [
  { name: 'Ann Lee', email: 'ann@x.com', status: 'registered' as const },
  { name: 'Bob', email: 'bob@x.com', status: 'attended' as const },
  { name: 'Cat', email: 'cat@x.com', status: 'waitlist' as const },
  { name: 'Dan', email: 'dan@x.com', status: 'cancelled' as const },
  { name: 'Walk-in', email: null, status: 'attended' as const },
  { name: 'Ann again', email: 'ANN@x.com ', status: 'registered' as const },
];

describe('recipientsFor', () => {
  it('picks the statuses of each audience, skipping no-email walk-ins and duplicates', () => {
    expect(recipientsFor(rows, 'registered').map((r) => r.email)).toEqual([
      'ann@x.com',
      'bob@x.com',
    ]);
    expect(recipientsFor(rows, 'attended').map((r) => r.email)).toEqual(['bob@x.com']);
    expect(recipientsFor(rows, 'waitlist').map((r) => r.email)).toEqual(['cat@x.com']);
    expect(audienceCounts(rows)).toEqual({ registered: 2, attended: 1, waitlist: 1, all: 3 });
  });

  it('never includes cancelled registrations', () => {
    expect(recipientsFor(rows, 'all').some((r) => r.email === 'dan@x.com')).toBe(false);
  });
});

describe('toParagraphs', () => {
  it('splits on blank lines and keeps single line breaks', () => {
    expect(
      toParagraphs('Hello,\r\n\r\nNew venue:  \n  True Digital Park\n   \n\nSee you!\n'),
    ).toEqual(['Hello,', 'New venue:\nTrue Digital Park', 'See you!']);
  });

  it('renders line breaks as <br> in the HTML email', () => {
    const { html, text } = renderEmail({
      to: 'a@x.com',
      subject: 'S',
      paragraphs: ['New venue:\nBuilding <B>'],
    });
    expect(html).toContain('New venue:<br>Building &lt;B&gt;');
    expect(text).toContain('New venue:\nBuilding <B>');
  });
});

describe('personalise', () => {
  it('uses the first name, or "there" without one', () => {
    expect(personalise('Hi {name}, {NAME}', 'Ann Lee')).toBe('Hi Ann, Ann');
    expect(personalise('Hi {name}', '  ')).toBe('Hi there');
  });
});

describe('EventEmailSchema', () => {
  const base = {
    audience: 'registered',
    subject: 'Venue change',
    body: 'We moved to the 5th floor.',
  };

  it('requires a subject and a message', () => {
    const r = EventEmailSchema.safeParse({ audience: 'registered', subject: '', body: '' });
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.path[0])).toEqual(
      expect.arrayContaining(['subject', 'body']),
    );
  });

  it('rejects an unknown audience', () => {
    expect(EventEmailSchema.safeParse({ ...base, audience: 'cancelled' }).success).toBe(false);
  });

  it('needs both the button label and its link', () => {
    expect(EventEmailSchema.safeParse({ ...base, actionLabel: 'Slides' }).success).toBe(false);
    expect(
      EventEmailSchema.safeParse({ ...base, actionUrl: 'https://x.com/slides.pdf' }).success,
    ).toBe(false);
    const ok = EventEmailSchema.parse({ ...base, actionLabel: 'Slides', actionUrl: 'x.com/s.pdf' });
    expect(ok.actionUrl).toBe('https://x.com/s.pdf');
  });
});

describe('eventBroadcast', () => {
  it('builds the email with the event details, page link and optional button', () => {
    const e = {
      title: 'AI Night',
      slug: 'ai-night',
      startsAt: new Date('2026-11-12T11:30:00Z'),
      endsAt: null,
      venue: 'True Digital Park',
      address: null,
    };
    const m = eventBroadcast(
      e,
      { name: 'Ann Lee', email: 'ann@x.com' },
      {
        subject: '{name}, new room',
        body: 'Hi {name},\n\nRoom 5.',
        actionLabel: 'Map',
        actionUrl: 'https://m.ap',
      },
      { replyTo: 'hello@x.com' },
    );
    expect(m.subject).toBe('Ann, new room');
    expect(m.paragraphs).toEqual(['Hi Ann,', 'Room 5.']);
    expect(m.details?.[0]).toEqual(['Event', 'AI Night']);
    expect(m.details?.some(([k, v]) => k === 'Where' && v === 'True Digital Park')).toBe(true);
    expect(m.action).toEqual({ label: 'Map', url: 'https://m.ap' });
    expect(m.links?.[0]?.url).toMatch(/\/events\/ai-night$/);
    expect(m.replyTo).toBe('hello@x.com');
    const plain = eventBroadcast(
      e,
      { name: 'B', email: 'b@x.com' },
      { subject: 's', body: 'b', actionLabel: '', actionUrl: null },
    );
    expect(plain.action).toBeUndefined();
  });
});

describe('community emails', () => {
  it('sends one copy per address and skips people without one', () => {
    expect(
      uniqueRecipients([
        { name: 'Ann', email: 'Ann@x.io' },
        { name: 'Ann again', email: 'ann@x.io ' },
        { name: 'Walk-in', email: null },
      ]),
    ).toEqual([{ name: 'Ann', email: 'ann@x.io' }]);
  });

  it('says why the person gets it and links their data page', () => {
    const m = communityEmail({ name: 'Ann Lee', email: 'ann@x.io' }, 'members', {
      subject: 'Hi {name}',
      body: 'Hello {name},\n\nSee you soon.',
      actionLabel: '',
      actionUrl: null,
    });
    expect(m.subject).toBe('Hi Ann');
    expect(m.paragraphs).toEqual(['Hello Ann,', 'See you soon.']);
    expect(m.footer).toMatch(/member of La French Tech Bangkok/);
    expect(m.dataUrl).toMatch(/\/my-data$/);
    expect(m.action).toBeUndefined();
  });
});
