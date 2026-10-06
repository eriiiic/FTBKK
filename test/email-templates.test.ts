import { describe, expect, it } from 'vitest';
import {
  EMAIL_TEMPLATES,
  NO_REASON,
  TEMPLATE_KEYS,
  type TemplateVars,
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

describe('directory, team and admin emails', () => {
  const d = (key: keyof typeof EMAIL_TEMPLATES, v: TemplateVars) =>
    applyTemplate(EMAIL_TEMPLATES[key], null, v);
  const org = 'Acme';

  it('reproduce the wording they had before they became editable', () => {
    expect(d('directory.submit-confirm', { name: 'Ann', org })).toEqual({
      subject: 'Confirm your listing request for Acme',
      paragraphs: [
        "Hi Ann, thanks for adding Acme to La French Tech Bangkok's ecosystem directory.",
        'Please confirm your email address. We review every request and aim to answer within 5 days.',
        'This link expires in 7 days.',
      ],
      buttonLabel: 'Confirm my email',
    });
    expect(d('directory.listing-approved', { org })).toEqual({
      subject: 'Acme is now listed on La French Tech Bangkok',
      paragraphs: [
        "Good news: Acme is now published in La French Tech Bangkok's ecosystem directory.",
        "Once a year we'll ask you to confirm the listing is still accurate, so the directory stays reliable. You can update it any time from the link below.",
      ],
      buttonLabel: 'See your listing',
    });
    expect(d('directory.listing-rejected', { org, reason: 'Too vague.' })).toEqual({
      subject: 'Your listing request for Acme',
      paragraphs: [
        "Thank you for submitting Acme to La French Tech Bangkok's ecosystem directory. We couldn't publish it as it is:",
        'Too vague.',
        'You are welcome to submit it again with the changes.',
      ],
      buttonLabel: 'Submit again',
    });
    expect(d('directory.manage-link', { listings: 'your 2 listings' })).toEqual({
      subject: 'Your link to manage your French Tech Bangkok listing',
      paragraphs: [
        'Use the button below to update your 2 listings. The link works once and expires in 30 minutes.',
        "If you didn't ask for this, you can ignore this email.",
      ],
      buttonLabel: 'Manage my listing',
    });
    const renewal = [
      "Once a year we ask every organisation in La French Tech Bangkok's directory to confirm its listing, so the directory only shows organisations that are really active.",
      'Please confirm Acme by 1 Dec 2026. One click is enough if nothing changed. Listings that are not confirmed are hidden 30 days after that date.',
    ];
    expect(d('directory.renewal-reminder', { org, due: '1 Dec 2026' })).toEqual({
      subject: 'Is your Acme listing still accurate?',
      paragraphs: renewal,
      buttonLabel: 'Yes, it is still accurate',
    });
    expect(d('directory.renewal-today', { org, due: '1 Dec 2026' })).toEqual({
      subject: 'Today: is the Acme listing still accurate?',
      paragraphs: renewal,
      buttonLabel: 'Yes, it is still accurate',
    });
    expect(d('directory.hidden', { org })).toEqual({
      subject: 'Acme is now hidden from the directory',
      paragraphs: [
        "We didn't get a confirmation for Acme, so the listing is now hidden from La French Tech Bangkok's directory.",
        'You can bring it back at any time in the next 12 months with one click.',
      ],
      buttonLabel: 'Reactivate my listing',
    });
    expect(d('directory.claim-invite', { org })).toEqual({
      subject: "Acme is listed in La French Tech Bangkok's directory",
      paragraphs: [
        "Acme is listed in La French Tech Bangkok's ecosystem directory, but nobody manages the listing yet.",
        'Claim it to keep it accurate: update the description, logo and links, and confirm it once a year. It is free.',
      ],
      buttonLabel: 'Claim the listing',
    });
    expect(d('directory.claim-confirm', { org })).toEqual({
      subject: 'Confirm your claim for Acme',
      paragraphs: [
        "You asked to manage the Acme listing in La French Tech Bangkok's directory.",
        'Confirm your email and a moderator will approve the claim, usually within 5 days.',
      ],
      buttonLabel: 'Confirm my email',
    });
    expect(d('directory.claim-approved', { org })).toEqual({
      subject: 'You can now manage Acme on La French Tech Bangkok',
      paragraphs: [
        "Your request was approved: you can now update the Acme listing in La French Tech Bangkok's ecosystem directory.",
        'Once a year we will ask you to confirm the listing is still accurate.',
      ],
      buttonLabel: 'Update the listing',
    });
    expect(d('directory.claim-rejected', { org, reason: NO_REASON })).toEqual({
      subject: 'Your request to manage Acme',
      paragraphs: [
        "We could not approve your request to manage Acme in La French Tech Bangkok's directory:",
        'No reason given.',
        'Reply to this email if you think this is a mistake.',
      ],
      buttonLabel: '',
    });
    expect(d('directory.change-approved', { org })).toEqual({
      subject: 'Your changes to Acme are live',
      paragraphs: [
        'A moderator approved your changes to Acme. They are now visible in the directory.',
      ],
      buttonLabel: 'See the listing',
    });
    expect(d('directory.change-rejected', { org, reason: 'Logo too small.' })).toEqual({
      subject: 'Your changes to Acme were not published',
      paragraphs: ['A moderator could not publish your changes to Acme:', 'Logo too small.'],
      buttonLabel: 'Update the listing',
    });
    expect(d('membership.approved', { org })).toEqual({
      subject: 'Welcome to La French Tech Bangkok, Acme',
      paragraphs: [
        'The board approved Acme as a member of La French Tech Bangkok. Your listing now shows the Member badge.',
        'We will share member news and perks by email.',
      ],
      buttonLabel: 'See the listing',
    });
    expect(d('membership.rejected', { org, reason: 'Not active.' })).toEqual({
      subject: 'Your membership application for Acme',
      paragraphs: ['The board could not approve the membership of Acme for now:', 'Not active.'],
      buttonLabel: 'See the listing',
    });
    expect(
      d('team.weekly-digest', {
        name: 'Ann',
        count: '2',
        late: ' (1 late)',
        tasks: ['LATE: Connect: Book (due 2 Nov)', 'Connect: Invite (due 6 Nov)'],
      }),
    ).toEqual({
      subject: 'Your French Tech Bangkok tasks this week: 2 (1 late)',
      paragraphs: [
        'Hi Ann, here is what is on your plate for the coming week.',
        'LATE: Connect: Book (due 2 Nov)',
        'Connect: Invite (due 6 Nov)',
        'Tick a step as done on the event checklist in the admin, or hand it to someone else there.',
      ],
      buttonLabel: 'Open my tasks',
    });
    expect(
      d('admin.contact-form', { name: 'Ann', topic: 'Events', message: 'Hello {name}\n\nBye' }),
    ).toEqual({
      subject: 'Website contact (Events): Ann',
      paragraphs: ['Hello {name}\n\nBye'],
      buttonLabel: '',
    });
    expect(d('admin.listing-to-review', { org, email: 'a@acme.com' })).toEqual({
      subject: 'New directory listing to review: Acme',
      paragraphs: [
        'Acme asked to be listed in the ecosystem directory and verified a@acme.com.',
        'Target: answer within 5 days.',
      ],
      buttonLabel: 'Review in the admin',
    });
    expect(
      d('admin.claim-to-review', {
        name: 'Ann',
        role: 'no role given',
        email: 'a@acme.com',
        org,
        'domain-check': 'The email domain matches the website.',
      }),
    ).toEqual({
      subject: 'Listing claim to review: Acme',
      paragraphs: [
        'Ann (no role given) verified a@acme.com and asks to manage Acme.',
        'The email domain matches the website.',
      ],
      buttonLabel: 'Review in the admin',
    });
    expect(
      d('admin.change-to-review', { email: 'a@acme.com', fields: 'name, pitch', org }),
    ).toEqual({
      subject: 'Listing change to review: Acme',
      paragraphs: ['a@acme.com asked to change name, pitch on Acme.'],
      buttonLabel: 'Review in the admin',
    });
    expect(d('admin.membership-application', { org, motivation: 'We hire.' })).toEqual({
      subject: 'Membership application: Acme',
      paragraphs: ['Acme applied for the free French Tech Bangkok membership.', 'We hire.'],
      buttonLabel: 'Review in the admin',
    });
    const digest = (items: string, oldest: string, renewals: string[]) =>
      d('admin.directory-digest', { items, oldest, target: '5', renewals });
    expect(digest('1 item', '', [])).toEqual({
      subject: 'Directory: 1 item to review',
      paragraphs: ['Weekly summary of the ecosystem directory. Target: answer within 5 days.'],
      buttonLabel: 'Open the moderation queue',
    });
    expect(digest('3 items', ' (oldest 9 days)', ['Renewal due: Acme, 1 Dec 2026'])).toEqual({
      subject: 'Directory: 3 items to review (oldest 9 days)',
      paragraphs: [
        'Weekly summary of the ecosystem directory. Target: answer within 5 days.',
        'Renewal due: Acme, 1 Dec 2026',
      ],
      buttonLabel: 'Open the moderation queue',
    });
  });

  it('keep the lists and reasons required', () => {
    const def = EMAIL_TEMPLATES['team.weekly-digest'];
    expect(
      templateSchema(def).safeParse({ subject: 'S', body: 'Hi {name}', buttonLabel: 'Go' }).success,
    ).toBe(false);
    expect(EMAIL_TEMPLATES['directory.claim-rejected'].required).toEqual(['reason']);
  });
});

describe('list placeholders', () => {
  const def = EMAIL_TEMPLATES['team.weekly-digest'];
  const vars = { name: 'Ann', count: '2', late: '', tasks: ['One', 'Two'] };

  it('become one paragraph per item on a line of their own', () => {
    const w = applyTemplate(
      def,
      { subject: 'Tasks: {tasks}', body: 'A\n\n{tasks}\n\nB', buttonLabel: 'Go' },
      vars,
    );
    expect(w.subject).toBe('Tasks: One, Two');
    expect(w.paragraphs).toEqual(['A', 'One', 'Two', 'B']);
  });

  it('are joined with line breaks inside a sentence', () => {
    const w = applyTemplate(
      def,
      { subject: 'S', body: 'Your steps: {tasks}', buttonLabel: 'Go' },
      vars,
    );
    expect(w.paragraphs).toEqual(['Your steps: One\nTwo']);
  });

  it('use the sample items in the admin preview', () => {
    const m = sampleEmail(def, defaultText(def));
    expect(m.paragraphs.length).toBe(5);
    expect(m.paragraphs[1]).toMatch(/^LATE: /);
  });
});
