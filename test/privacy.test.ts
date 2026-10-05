import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTACT_EMAIL_TOKEN } from '../src/lib/code-of-conduct';
import {
  DEFAULT_PRIVACY_NOTICE,
  DataTokenSchema,
  MyDataActionSchema,
  describeMyData,
  fillPrivacyNotice,
  myDataPath,
  myDataCodePath,
  DataRequestSchema,
} from '../src/lib/privacy';
import { DATA_LINK_LABEL, renderEmail } from '../src/lib/email';
import { eventBroadcast } from '../src/lib/event-emails';
import { feedbackEmail } from '../src/lib/feedback';
import { myDataUrl, reminderEmail } from '../src/lib/registrations';
import { renderMarkdown } from '../src/lib/markdown';
import type { Event } from '../src/db/schema';

describe('privacy notice', () => {
  it('fills in the contact email as a mailto link', () => {
    const md = fillPrivacyNotice(DEFAULT_PRIVACY_NOTICE, 'hello@example.com');
    expect(md).not.toContain(CONTACT_EMAIL_TOKEN);
    expect(renderMarkdown(md)).toContain('href="mailto:hello@example.com"');
  });

  it('falls back to the default text when emptied, and keeps an edited one', () => {
    expect(fillPrivacyNotice(' \n', 'a@b.co')).toBe(
      fillPrivacyNotice(DEFAULT_PRIVACY_NOTICE, 'a@b.co'),
    );
    expect(fillPrivacyNotice('## Ours', 'a@b.co')).toBe('## Ours');
  });

  it('covers what the PDPA asks for', () => {
    for (const s of [
      '## What we collect',
      '## Why we use it',
      '## Who sees it',
      '## How long we keep it',
      '## Your rights',
      'Manage or delete my data',
      'PDPA',
    ])
      expect(DEFAULT_PRIVACY_NOTICE).toContain(s);
  });

  it('is seeded with the same text by the data migration', () => {
    const sql = readFileSync(
      new URL('../migrations/0019_privacy_notice.sql', import.meta.url),
      'utf8',
    );
    const m = sql.match(/VALUES \('privacyNotice', '(.*)'\);/s);
    expect(JSON.parse(m![1]!.replace(/''/g, "'"))).toContain('Manage or delete my data');
  });

  it('is updated to the current text when it was never edited', () => {
    const seed = readFileSync(
      new URL('../migrations/0019_privacy_notice.sql', import.meta.url),
      'utf8',
    ).match(/VALUES \('privacyNotice', '(.*)'\);/s)![1];
    const sql = readFileSync(
      new URL('../migrations/0020_privacy_notice_request.sql', import.meta.url),
      'utf8',
    );
    const m = sql.match(/SET value = '(.*)' WHERE key = 'privacyNotice' AND value = '(.*)';/s);
    expect(JSON.parse(m![1]!.replace(/''/g, "'"))).toBe(DEFAULT_PRIVACY_NOTICE);
    expect(m![2]).toBe(seed);
  });
});

describe('my data link', () => {
  it('points to /my-data with the registration token', () => {
    expect(myDataPath('abc_DEF-123')).toBe('/my-data?token=abc_DEF-123');
    expect(myDataUrl('abc_DEF-123')).toBe(
      'https://www.french-tech-bangkok.com/my-data?token=abc_DEF-123',
    );
  });

  it('accepts only token-shaped values and known actions', () => {
    expect(DataTokenSchema.safeParse('a'.repeat(32)).success).toBe(true);
    expect(DataTokenSchema.safeParse('short').success).toBe(false);
    expect(DataTokenSchema.safeParse(`${'a'.repeat(20)}' OR 1`).success).toBe(false);
    expect(MyDataActionSchema.safeParse({ token: 'a'.repeat(32), action: 'delete' }).success).toBe(
      true,
    );
    expect(MyDataActionSchema.safeParse({ token: 'a'.repeat(32), action: 'drop' }).success).toBe(
      false,
    );
  });

  it('is in the footer of the HTML and text email', () => {
    const { html, text } = renderEmail({
      to: 'a@x.com',
      subject: 'S',
      paragraphs: ['Hi'],
      dataUrl: 'https://x.test/my-data?token=t',
    });
    expect(html).toContain(`href="https://x.test/my-data?token=t"`);
    expect(html).toContain(DATA_LINK_LABEL);
    expect(text).toContain(`${DATA_LINK_LABEL}: https://x.test/my-data?token=t`);
    expect(renderEmail({ to: 'a@x.com', subject: 'S', paragraphs: ['Hi'] }).html).not.toContain(
      DATA_LINK_LABEL,
    );
  });

  const event = {
    id: 1,
    title: 'Meetup',
    slug: 'meetup',
    startsAt: new Date('2026-10-10T11:00:00Z'),
    endsAt: null,
    venue: 'Hub',
    address: null,
    mapUrl: null,
  } as unknown as Event;

  it('is added to reminder, feedback and admin emails that have a token', () => {
    const r = { name: 'Ann', email: 'ann@x.com', token: 'tok123' };
    expect(reminderEmail(event, r).dataUrl).toBe(myDataUrl('tok123'));
    expect(feedbackEmail(event, r).dataUrl).toBe(myDataUrl('tok123'));
    const body = { subject: 'Hello', body: 'New venue', actionLabel: '', actionUrl: null };
    expect(eventBroadcast(event, r, body).dataUrl).toBe(myDataUrl('tok123'));
    // The admin's own test email has no registration behind it.
    expect(eventBroadcast(event, { name: 'there', email: 'me@x.com' }, body).dataUrl).toBe(
      undefined,
    );
  });
});

describe('describeMyData', () => {
  const base = {
    name: 'Ann Lee',
    email: 'ann@x.com',
    phone: null,
    company: 'Acme',
    role: null,
    registrations: 3,
    attended: 2,
    cancelled: 0,
    newsletter: { agreed: false, at: null },
    savedId: null,
  };

  it('says in plain words what we hold', () => {
    expect(describeMyData(base)).toEqual([
      ['Name', 'Ann Lee'],
      ['Email', 'ann@x.com'],
      ['Company', 'Acme'],
      ['Events', 'Registered for 3 events, came to 2'],
      ['Newsletter', 'No, you were never asked'],
      ['Contact card', 'No, only your registrations'],
    ]);
  });

  it('mentions cancellations, the newsletter choice and a saved card', () => {
    const rows = Object.fromEntries(
      describeMyData({
        ...base,
        registrations: 1,
        attended: 1,
        cancelled: 2,
        newsletter: { agreed: true, at: new Date() },
        savedId: 4,
      }),
    );
    expect(rows.Events).toBe('Registered for 1 event, came to 1, cancelled 2');
    expect(rows.Newsletter).toBe('Yes, you agreed to get it');
    expect(rows['Contact card']).toMatch(/^Yes/);
    expect(
      Object.fromEntries(describeMyData({ ...base, newsletter: { agreed: false, at: new Date() } }))
        .Newsletter,
    ).toBe('No, you said no');
  });
});

describe('delete my data request', () => {
  it('links request codes to /my-data?code=', () => {
    expect(myDataCodePath('abc_DEF-123')).toBe('/my-data?code=abc_DEF-123');
  });
  it('normalises the requested email', () => {
    expect(DataRequestSchema.parse({ email: ' Jo@Example.COM ' }).email).toBe('jo@example.com');
    expect(DataRequestSchema.safeParse({ email: 'nope' }).success).toBe(false);
  });
  it('needs exactly one of a registration token or a request code', () => {
    const t = 'a'.repeat(20);
    expect(MyDataActionSchema.safeParse({ token: t, action: 'delete' }).success).toBe(true);
    expect(MyDataActionSchema.safeParse({ code: t, action: 'delete' }).success).toBe(true);
    expect(MyDataActionSchema.safeParse({ action: 'delete' }).success).toBe(false);
    expect(MyDataActionSchema.safeParse({ token: t, code: t, action: 'delete' }).success).toBe(
      false,
    );
  });
});
