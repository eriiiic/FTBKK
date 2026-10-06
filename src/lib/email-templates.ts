// The wording of the emails the site sends, editable in /admin/emails. Each email has a built-in
// default (the registry below); an edited version is a row in the email_templates table. Only the
// words are editable (subject, paragraphs, button label): details rows, logos, the ticket, links,
// attachments and the "Manage or delete my data" footer stay in the code that sends the email.
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { env } from 'cloudflare:workers';
import { getDb } from '../db';
import { emailTemplates } from '../db/schema';
import type { EmailMessage } from './email';
import { formatEventDate } from './format';

export type TemplateGroup = 'Events' | 'Community' | 'Privacy';
export const TEMPLATE_GROUPS: TemplateGroup[] = ['Events', 'Community', 'Privacy'];

export interface Placeholder {
  key: string;
  description: string;
  /** Used in the admin preview and the test email. */
  sample: string;
}

export interface EmailTemplateDef {
  label: string;
  group: TemplateGroup;
  /** Who receives it, e.g. "The person who registered". */
  audience: string;
  /** When it goes out. */
  trigger: string;
  subject: string;
  /** Plain text paragraphs, a blank line between them. */
  body: string;
  /** Only for emails with a button. */
  buttonLabel?: string;
  /** When the button shows, if not always. */
  buttonNote?: string;
  placeholders: Placeholder[];
  /** Placeholders an edited text must keep (none so far). */
  required?: string[];
  /** What the site adds around the words (not editable here). */
  added: string;
  /** Sample of the parts added by code, for the admin preview and test email. */
  preview: Omit<EmailMessage, 'to' | 'subject' | 'paragraphs' | 'action'> & { buttonUrl?: string };
}

/** Text of one email: the saved edit, or the default. */
export interface EmailText {
  subject: string;
  body: string;
  buttonLabel: string | null;
}

export interface RenderedTemplate {
  subject: string;
  paragraphs: string[];
  /** '' when the email has no button. */
  buttonLabel: string;
}

const SITE = 'https://www.french-tech-bangkok.com';
const SAMPLE_EVENT = 'French Tech Connect: AI in Southeast Asia';
const SAMPLE_DATE = 'Thu, 5 November 2026, 18:30 – 21:00';
const SAMPLE_VENUE = 'True Digital Park, 101 Sukhumvit Rd, Bangkok';

const P = {
  name: {
    key: 'name',
    description: "The person's name, as they typed it",
    sample: 'Camille Martin',
  },
  event: { key: 'event', description: 'The event title', sample: SAMPLE_EVENT },
  date: {
    key: 'date',
    description: 'Day and time of the event (Bangkok time)',
    sample: SAMPLE_DATE,
  },
  venue: {
    key: 'venue',
    description: 'Venue and address (empty when the event has none)',
    sample: SAMPLE_VENUE,
  },
} satisfies Record<string, Placeholder>;
const EVENT_PLACEHOLDERS = [P.name, P.event, P.date, P.venue];

const sampleDetails: [string, string][] = [
  ['When', `${SAMPLE_DATE} (Bangkok time)`],
  ['Where', SAMPLE_VENUE],
];
const sampleDataUrl = `${SITE}/my-data?token=sample`;
const sampleEventUrl = `${SITE}/events/sample`;

export type TemplateKey =
  | 'registration.confirmed'
  | 'registration.waitlist'
  | 'registration.promoted'
  | 'event.reminder'
  | 'event.cancelled'
  | 'event.feedback'
  | 'newsletter.confirm'
  | 'privacy.data-request';

/** Every email built from a template, in the order of the admin list. */
export const EMAIL_TEMPLATES: Record<TemplateKey, EmailTemplateDef> = {
  'registration.confirmed': {
    label: 'Registration confirmed',
    group: 'Events',
    audience: 'The person who registered',
    trigger: 'When someone registers for an event and gets a seat',
    subject: "You're registered: {event}",
    body: 'Hi {name}, see you at {event}! The calendar invite is attached.',
    buttonLabel: 'Open the map',
    buttonNote: 'Shown when the event has a map link or an address.',
    placeholders: EVENT_PLACEHOLDERS,
    added:
      'Date and venue, hosts and sponsors with their logos, the ticket with its QR code, the calendar invite, links to the event page and to cancel, and the "Manage or delete my data" link.',
    preview: {
      details: sampleDetails,
      buttonUrl: 'https://maps.google.com',
      links: [
        { label: 'Event page', url: sampleEventUrl },
        { label: "Can't come? Cancel", url: `${sampleEventUrl}/cancel` },
      ],
      dataUrl: sampleDataUrl,
    },
  },
  'registration.waitlist': {
    label: 'Waitlist confirmation',
    group: 'Events',
    audience: 'The person who registered',
    trigger: 'When someone registers for an event that is full',
    subject: "You're on the waitlist: {event}",
    body: 'Hi {name}, {event} is full for now, so you are on the waitlist.\n\nIf a seat frees up we will register you automatically and email you.',
    placeholders: EVENT_PLACEHOLDERS,
    added:
      'Date and venue, hosts and sponsors with their logos, links to the event page and to leave the waitlist, and the "Manage or delete my data" link.',
    preview: {
      details: sampleDetails,
      links: [
        { label: 'Event page', url: sampleEventUrl },
        { label: 'Leave the waitlist', url: `${sampleEventUrl}/cancel` },
      ],
      dataUrl: sampleDataUrl,
    },
  },
  'registration.promoted': {
    label: 'Seat freed: off the waitlist',
    group: 'Events',
    audience: 'The first person on the waitlist',
    trigger: 'When a seat frees up (a cancellation, or an admin moves them up)',
    subject: "A seat opened up: you're registered for {event}",
    body: "Good news {name}: a seat freed up and you are now registered for {event}. The calendar invite is attached.\n\nIf you can't come any more, please cancel so the next person can take your seat.",
    placeholders: EVENT_PLACEHOLDERS,
    added:
      'Date and venue, hosts and sponsors with their logos, the ticket with its QR code, the calendar invite, links to the event page and to cancel, and the "Manage or delete my data" link.',
    preview: {
      details: sampleDetails,
      links: [
        { label: 'Event page', url: sampleEventUrl },
        { label: 'Cancel', url: `${sampleEventUrl}/cancel` },
      ],
      dataUrl: sampleDataUrl,
    },
  },
  'event.reminder': {
    label: 'Reminder the day before',
    group: 'Events',
    audience: 'Everyone registered',
    trigger: 'At 9:00 the day before the event',
    subject: 'Tomorrow: {event}',
    body: 'Hi {name}, a reminder that {event} is tomorrow. See you there!',
    buttonLabel: 'Open the map',
    buttonNote: 'Shown when the event has a map link or an address.',
    placeholders: EVENT_PLACEHOLDERS,
    added:
      'Date and venue, hosts and sponsors with their logos, links to the ticket and to cancel, and the "Manage or delete my data" link.',
    preview: {
      details: sampleDetails,
      buttonUrl: 'https://maps.google.com',
      links: [
        { label: 'Show my ticket', url: `${sampleEventUrl}/ticket` },
        { label: "Can't come any more? Cancel", url: `${sampleEventUrl}/cancel` },
      ],
      dataUrl: sampleDataUrl,
    },
  },
  'event.cancelled': {
    label: 'Event cancelled',
    group: 'Events',
    audience: 'Everyone registered or on the waitlist',
    trigger: 'When an admin cancels an event and chooses to tell registrants',
    subject: 'Cancelled: {event}',
    body: 'Hi {name}, we are sorry: {event} on {date} is cancelled.\n\nKeep an eye on our events page for the next one.',
    buttonLabel: 'See upcoming events',
    placeholders: EVENT_PLACEHOLDERS,
    added: 'The "Manage or delete my data" link.',
    preview: { buttonUrl: `${SITE}/events`, dataUrl: sampleDataUrl },
  },
  'event.feedback': {
    label: 'Feedback request',
    group: 'Events',
    audience: "Everyone checked in (everyone registered, if check-in wasn't used)",
    trigger: 'At 9:00 the day after the event',
    subject: 'How was {event}?',
    body: 'Hi {name}, thanks for joining us at {event} yesterday.\n\nHow was it? One click on a number is enough. You can add a comment on the next page if you like: it helps us choose the next topics, and we share it with speakers and sponsors without your name.',
    placeholders: [P.name, P.event],
    added: 'The 1 to 5 rating buttons and the "Manage or delete my data" link.',
    preview: {
      choices: {
        question: 'Your rating',
        options: [1, 2, 3, 4, 5].map((n) => ({
          label: String(n),
          url: `${sampleEventUrl}/feedback`,
        })),
        hint: '1 = poor · 5 = excellent',
      },
      dataUrl: sampleDataUrl,
    },
  },
  'newsletter.confirm': {
    label: 'Newsletter: confirm your subscription',
    group: 'Community',
    audience: 'The person who signed up',
    trigger: 'When someone signs up for the newsletter on the Join page',
    subject: 'Confirm your subscription to the La French Tech Bangkok newsletter',
    body: "Hi {name}, thanks for signing up. Please confirm it's you: we'll then send you our news, upcoming events and the community's highlights, about once a month.\n\nDidn't sign up? Ignore this email and nothing happens.",
    buttonLabel: 'Confirm my subscription',
    placeholders: [P.name],
    added: 'The confirmation link (the button) and a footer: "The link works for 7 days…".',
    preview: {
      buttonUrl: `${SITE}/newsletter`,
      footer: 'The link works for 7 days. You can unsubscribe at any time.',
    },
  },
  'privacy.data-request': {
    label: 'Your data: access link',
    group: 'Privacy',
    audience: 'The person who asked',
    trigger: 'When someone asks to see or delete their data on the My data page',
    subject: 'Your data at La French Tech Bangkok',
    body: "Someone (hopefully you) asked to see or delete the data La French Tech Bangkok keeps about this email address.\n\nOpen the link below to see it, then delete it or unsubscribe from the newsletter. The link works for 24 hours. Nothing is deleted until you confirm on the page.\n\nIf you didn't ask for this, you can ignore this email: nothing changes.",
    buttonLabel: 'See or delete my data',
    placeholders: [],
    added: 'The link to the My data page (the button).',
    preview: { buttonUrl: `${SITE}/my-data` },
  },
};

export const TEMPLATE_KEYS = Object.keys(EMAIL_TEMPLATES) as TemplateKey[];

export const isTemplateKey = (k: string): k is TemplateKey =>
  Object.prototype.hasOwnProperty.call(EMAIL_TEMPLATES, k);

/** Emails written by hand each time: listed in the admin for completeness, not templates. */
export const WRITTEN_EACH_TIME = [
  {
    label: 'Email registrants',
    group: 'Events' as TemplateGroup,
    audience: 'Registrants of one event (you choose who)',
    trigger: "Written each time on the event's Email page",
  },
];

// ---------- pure helpers ----------

const PLACEHOLDER = /\{([A-Za-z][\w-]*)\}/g;

/**
 * Replaces {key} with its value. Unknown placeholders are left as typed, so a typo shows in the
 * preview instead of breaking the email. One pass: a value that contains {x} is not filled again.
 */
export function fillPlaceholders(text: string, vars: Record<string, string>) {
  return text.replace(PLACEHOLDER, (m, k: string) =>
    Object.prototype.hasOwnProperty.call(vars, k) ? vars[k]! : m,
  );
}

/** Body text to paragraphs: a blank line starts a new one; a single line break is kept. */
export function splitParagraphs(body: string) {
  return body
    .replace(/\r\n?/g, '\n')
    .split(/\n[ \t]*\n\s*/)
    .map((p) => p.replace(/[ \t]+$/gm, '').trim())
    .filter(Boolean);
}

/** The placeholder names used in a text, in order, without duplicates. */
export function placeholdersIn(text: string) {
  return [...new Set([...text.matchAll(PLACEHOLDER)].map((m) => m[1]!))];
}

/** Placeholders a text uses that this email doesn't know, and required ones it lacks. */
export function checkPlaceholders(def: EmailTemplateDef, t: EmailText) {
  const used = placeholdersIn([t.subject, t.body, t.buttonLabel ?? ''].join('\n'));
  const known = new Set(def.placeholders.map((p) => p.key));
  return {
    unknown: used.filter((k) => !known.has(k)),
    missing: (def.required ?? []).filter((k) => !used.includes(k)),
  };
}

export const defaultText = (def: EmailTemplateDef): EmailText => ({
  subject: def.subject,
  body: def.body,
  buttonLabel: def.buttonLabel ?? null,
});

/** The words of an email: the edited text (or the default) with its placeholders filled. */
export function applyTemplate(
  def: EmailTemplateDef,
  text: EmailText | null | undefined,
  vars: Record<string, string>,
): RenderedTemplate {
  const t = text ?? defaultText(def);
  const paragraphs = splitParagraphs(t.body).map((p) => fillPlaceholders(p, vars));
  return {
    subject: fillPlaceholders(t.subject.trim(), vars) || fillPlaceholders(def.subject, vars),
    paragraphs: paragraphs.length
      ? paragraphs
      : splitParagraphs(def.body).map((p) => fillPlaceholders(p, vars)),
    buttonLabel:
      def.buttonLabel === undefined
        ? ''
        : fillPlaceholders(t.buttonLabel?.trim() || def.buttonLabel, vars),
  };
}

/** The sample values of an email's placeholders, for the preview and the test email. */
export const sampleVars = (def: EmailTemplateDef) =>
  Object.fromEntries(def.placeholders.map((p) => [p.key, p.sample]));

/** The placeholder values of an event email. */
export function eventVars(
  e: {
    title: string;
    startsAt: Date;
    endsAt?: Date | null;
    venue?: string | null;
    address?: string | null;
  },
  name: string,
): Record<string, string> {
  return {
    name,
    event: e.title,
    date: formatEventDate(e.startsAt, e.endsAt),
    venue: [e.venue, e.address].filter(Boolean).join(', '),
  };
}

/** A sample email with the given words, for the admin preview and the test email. */
export function sampleEmail(def: EmailTemplateDef, t: EmailText, to = ''): EmailMessage {
  const r = applyTemplate(def, t, sampleVars(def));
  const { buttonUrl, ...rest } = def.preview;
  return {
    to,
    subject: r.subject,
    paragraphs: r.paragraphs,
    ...rest,
    action: r.buttonLabel ? { label: r.buttonLabel, url: buttonUrl ?? SITE } : undefined,
  };
}

/** The edit form. The button label is required only for emails that have a button. */
export function templateSchema(def: EmailTemplateDef) {
  const crlf = (s: string) => s.replace(/\r\n?/g, '\n');
  return z
    .object({
      subject: z
        .string()
        .trim()
        .min(1, 'Write a subject.')
        .max(200, 'Keep the subject under 200 characters.'),
      body: z
        .string()
        .transform(crlf)
        .pipe(
          z
            .string()
            .trim()
            .min(1, 'Write the message.')
            .max(5000, 'Keep the message under 5000 characters.'),
        ),
      buttonLabel:
        def.buttonLabel === undefined
          ? z
              .string()
              .optional()
              .transform(() => null)
          : z
              .string()
              .trim()
              .min(1, 'Write the button label.')
              .max(60, 'Keep the button label under 60 characters.'),
    })
    .superRefine((t, ctx) => {
      const { missing } = checkPlaceholders(def, t);
      if (missing.length)
        ctx.addIssue({
          code: 'custom',
          path: ['body'],
          message: `Keep ${missing.map((k) => `{${k}}`).join(', ')} in the text.`,
        });
    });
}

// ---------- database ----------

/** The saved edit of an email, or null (never edited, or the table isn't migrated yet). */
export async function loadTemplateText(
  key: TemplateKey,
  db: D1Database = env.DB,
): Promise<EmailText | null> {
  try {
    const [row] = await getDb(db).select().from(emailTemplates).where(eq(emailTemplates.key, key));
    return row ? { subject: row.subject, body: row.body, buttonLabel: row.buttonLabel } : null;
  } catch (err) {
    console.error('[email-templates] falling back to the default text', key, err);
    return null;
  }
}

/** The words of one email, ready to send: the saved edit (or the default), filled. */
export async function renderTemplate(
  key: TemplateKey,
  vars: Record<string, string>,
  db: D1Database = env.DB,
): Promise<RenderedTemplate> {
  return applyTemplate(EMAIL_TEMPLATES[key], await loadTemplateText(key, db), vars);
}
