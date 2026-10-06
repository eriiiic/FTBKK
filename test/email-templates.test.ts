import { describe, expect, it } from 'vitest';
import {
  EMAIL_TEMPLATES,
  TEMPLATE_KEYS,
  applyTemplate,
  checkPlaceholders,
  eventVars,
  fillPlaceholders,
  placeholdersIn,
  renderTemplate,
  sampleEmail,
  splitParagraphs,
  templateSchema,
  defaultText,
} from '../src/lib/email-templates';
import { eventCancelledEmail, reminderEmail } from '../src/lib/registrations';
import { feedbackEmail } from '../src/lib/feedback';
import { renderEmail } from '../src/lib/email';
import { formatEventDate } from '../src/lib/format';
import type { Event } from '../src/db/schema';

const event = {
  id: 1,
  title: 'French Tech Connect',
  slug: 'connect',
  startsAt: new Date('2026-11-05T11:30:00Z'),
  endsAt: new Date('2026-11-05T14:00:00Z'),
  venue: 'Hub',
  address: '1 Sukhumvit',
  mapUrl: null,
} as unknown as Event;
const r = { name: 'Ann', email: 'ann@x.com', token: 'tok' };
const vars = eventVars(event, r.name);
const t = (key: keyof typeof EMAIL_TEMPLATES, v: Record<string, string> = vars) =>
  applyTemplate(EMAIL_TEMPLATES[key], null, v);

describe('fillPlaceholders', () => {
  it('fills known placeholders and leaves unknown ones as typed', () => {
    expect(fillPlaceholders('Hi {name}, {nope} {event}', { name: 'A', event: 'E' })).toBe(
      'Hi A, {nope} E',
    );
  });

  it('does not fill a value twice, and ignores prototype keys', () => {
    expect(fillPlaceholders('{name}', { name: '{event}', event: 'X' })).toBe('{event}');
    expect(fillPlaceholders('{constructor} {toString}', {})).toBe('{constructor} {toString}');
  });

  it('keeps odd braces', () => {
    expect(fillPlaceholders('{ name } {} {1x}', { name: 'A' })).toBe('{ name } {} {1x}');
  });
});

describe('splitParagraphs', () => {
  it('splits on blank lines and keeps single line breaks', () => {
    expect(splitParagraphs('One\r\nline two\r\n\r\n  \n\nTwo  \n')).toEqual([
      'One\nline two',
      'Two',
    ]);
    expect(splitParagraphs(' \n ')).toEqual([]);
  });
});

describe('checkPlaceholders', () => {
  const def = EMAIL_TEMPLATES['event.cancelled'];
  it('lists unknown placeholders and missing required ones', () => {
    expect(placeholdersIn('{a} {b} {a}')).toEqual(['a', 'b']);
    const c = checkPlaceholders(
      { ...def, required: ['event'] },
      { subject: '{evnt}', body: 'Hi {name}', buttonLabel: null },
    );
    expect(c).toEqual({ unknown: ['evnt'], missing: ['event'] });
  });

  it('blocks a missing required placeholder in the form, but not an unknown one', () => {
    const ok = templateSchema(def).safeParse({ subject: 'S {x}', body: 'B', buttonLabel: 'Go' });
    expect(ok.success).toBe(true);
    const bad = templateSchema({ ...def, required: ['name'] }).safeParse({
      subject: 'S',
      body: 'B',
      buttonLabel: 'Go',
    });
    expect(bad.success).toBe(false);
  });

  it('validates lengths and the button label only when the email has one', () => {
    const s = templateSchema(def);
    expect(s.safeParse({ subject: '', body: 'B', buttonLabel: 'Go' }).success).toBe(false);
    expect(s.safeParse({ subject: 'S', body: 'x'.repeat(5001), buttonLabel: 'Go' }).success).toBe(
      false,
    );
    expect(s.safeParse({ subject: 'S', body: 'B', buttonLabel: 'x'.repeat(61) }).success).toBe(
      false,
    );
    const noButton = templateSchema(EMAIL_TEMPLATES['event.feedback']).parse({
      subject: 'S',
      body: 'a\r\n\r\nb',
    });
    expect(noButton).toEqual({ subject: 'S', body: 'a\n\nb', buttonLabel: null });
  });
});

describe('default templates', () => {
  it('reproduce the wording the emails had before they became editable', () => {
    const date = formatEventDate(event.startsAt, event.endsAt);
    expect(t('registration.confirmed')).toEqual({
      subject: "You're registered: French Tech Connect",
      paragraphs: ['Hi Ann, see you at French Tech Connect! The calendar invite is attached.'],
      buttonLabel: 'Open the map',
    });
    expect(t('registration.waitlist')).toEqual({
      subject: "You're on the waitlist: French Tech Connect",
      paragraphs: [
        'Hi Ann, French Tech Connect is full for now, so you are on the waitlist.',
        'If a seat frees up we will register you automatically and email you.',
      ],
      buttonLabel: '',
    });
    expect(t('registration.promoted')).toEqual({
      subject: "A seat opened up: you're registered for French Tech Connect",
      paragraphs: [
        'Good news Ann: a seat freed up and you are now registered for French Tech Connect. The calendar invite is attached.',
        "If you can't come any more, please cancel so the next person can take your seat.",
      ],
      buttonLabel: '',
    });
    expect(t('event.reminder')).toEqual({
      subject: 'Tomorrow: French Tech Connect',
      paragraphs: ['Hi Ann, a reminder that French Tech Connect is tomorrow. See you there!'],
      buttonLabel: 'Open the map',
    });
    expect(t('event.cancelled')).toEqual({
      subject: 'Cancelled: French Tech Connect',
      paragraphs: [
        `Hi Ann, we are sorry: French Tech Connect on ${date} is cancelled.`,
        'Keep an eye on our events page for the next one.',
      ],
      buttonLabel: 'See upcoming events',
    });
    expect(t('event.feedback')).toEqual({
      subject: 'How was French Tech Connect?',
      paragraphs: [
        'Hi Ann, thanks for joining us at French Tech Connect yesterday.',
        'How was it? One click on a number is enough. You can add a comment on the next page if you like: it helps us choose the next topics, and we share it with speakers and sponsors without your name.',
      ],
      buttonLabel: '',
    });
    expect(t('newsletter.confirm', { name: 'Ann' })).toEqual({
      subject: 'Confirm your subscription to the La French Tech Bangkok newsletter',
      paragraphs: [
        "Hi Ann, thanks for signing up. Please confirm it's you: we'll then send you our news, upcoming events and the community's highlights, about once a month.",
        "Didn't sign up? Ignore this email and nothing happens.",
      ],
      buttonLabel: 'Confirm my subscription',
    });
    expect(t('privacy.data-request', {})).toEqual({
      subject: 'Your data at La French Tech Bangkok',
      paragraphs: [
        'Someone (hopefully you) asked to see or delete the data La French Tech Bangkok keeps about this email address.',
        'Open the link below to see it, then delete it or unsubscribe from the newsletter. The link works for 24 hours. Nothing is deleted until you confirm on the page.',
        "If you didn't ask for this, you can ignore this email: nothing changes.",
      ],
      buttonLabel: 'See or delete my data',
    });
  });

  it('only use placeholders each email declares', () => {
    for (const k of TEMPLATE_KEYS) {
      const c = checkPlaceholders(EMAIL_TEMPLATES[k], defaultText(EMAIL_TEMPLATES[k]));
      expect(c, k).toEqual({ unknown: [], missing: [] });
    }
  });

  it('render a sample email for the admin preview', () => {
    for (const k of TEMPLATE_KEYS) {
      const def = EMAIL_TEMPLATES[k];
      const m = sampleEmail(def, defaultText(def), 'me@x.com');
      expect(m.subject).not.toMatch(/\{\w+\}/);
      expect(!!m.action).toBe(def.buttonLabel !== undefined);
      expect(renderEmail(m).html).toContain(m.paragraphs[0]!.replace(/'/g, '&#39;'));
    }
  });

  it('falls back to the default when the database cannot be read', async () => {
    expect(await renderTemplate('event.reminder', vars)).toEqual(t('event.reminder'));
  });
});

describe('edited templates', () => {
  const edit = {
    subject: 'Reminder: {event} on {date}',
    body: 'Dear {name},\n\nSee you at {venue}.\nBring a friend!\n\n{oops}',
    buttonLabel: 'Directions',
  };

  it('are used by the email builders', () => {
    const m = reminderEmail(
      { ...event, mapUrl: 'https://maps.example' } as Event,
      r,
      undefined,
      edit,
    );
    expect(m.subject).toBe(`Reminder: French Tech Connect on ${vars.date}`);
    expect(m.paragraphs).toEqual([
      'Dear Ann,',
      'See you at Hub, 1 Sukhumvit.\nBring a friend!',
      '{oops}',
    ]);
    expect(m.action).toEqual({ label: 'Directions', url: 'https://maps.example' });
    // Structural parts stay.
    expect(m.details?.[0]?.[0]).toBe('When');
    expect(m.dataUrl).toContain('tok');

    const f = feedbackEmail(event, r, {
      subject: 'Rate {event}',
      body: 'Hi {name}',
      buttonLabel: null,
    });
    expect(f.subject).toBe('Rate French Tech Connect');
    expect(f.choices?.options).toHaveLength(5);

    const c = eventCancelledEmail(event, r, { ...edit, buttonLabel: 'Next events' });
    expect(c.action?.label).toBe('Next events');
  });

  it('fall back to the default subject, body or button when one is empty', () => {
    const w = applyTemplate(
      EMAIL_TEMPLATES['event.cancelled'],
      { subject: ' ', body: '\n\n', buttonLabel: '' },
      vars,
    );
    expect(w).toEqual(t('event.cancelled'));
  });
});
