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

export type TemplateGroup =
  'Events' | 'Ecosystem' | 'Membership' | 'Community' | 'Privacy' | 'Admin notifications';
export const TEMPLATE_GROUPS: TemplateGroup[] = [
  'Events',
  'Ecosystem',
  'Membership',
  'Community',
  'Privacy',
  'Admin notifications',
];

export interface Placeholder {
  key: string;
  description: string;
  /** Used in the admin preview and the test email. For a list, one item per line. */
  sample: string;
  /**
   * A list built by the site (e.g. the tasks of a digest). On a line of its own it becomes one
   * paragraph per item; inside a sentence the items are joined with line breaks.
   */
  list?: boolean;
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
  /** Placeholders an edited text must keep (lists, reasons, the message). */
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
const sampleOrgUrl = `${SITE}/ecosystem/siam-robotics`;
const adminEcosystemUrl = `${SITE}/admin/ecosystem`;

/** The {reason} of a rejection when the moderator typed none. */
export const NO_REASON = 'No reason given.';

/** Placeholders of the directory emails. */
const D = {
  org: { key: 'org', description: 'The organisation name', sample: 'Siam Robotics' },
  reason: {
    key: 'reason',
    description: 'The reason the moderator typed ("No reason given." when empty)',
    sample: 'Please add a short description of what the company does in Thailand.',
  },
  email: {
    key: 'email',
    description: 'The email address they confirmed',
    sample: 'camille@example.com',
  },
  due: {
    key: 'due',
    description: 'The confirmation date ("soon" when unknown)',
    sample: '12 Nov 2026',
  },
} satisfies Record<string, Placeholder>;

const RENEWAL_BODY =
  "Once a year we ask every organisation in La French Tech Bangkok's directory to confirm its listing, so the directory only shows organisations that are really active.\n\nPlease confirm {org} by {due}. One click is enough if nothing changed. Listings that are not confirmed are hidden 30 days after that date.";
const renewalPreview: EmailTemplateDef['preview'] = {
  buttonUrl: `${SITE}/ecosystem/confirm`,
  links: [
    { label: 'Update it first', url: `${SITE}/ecosystem/manage` },
    { label: 'See the listing', url: sampleOrgUrl },
  ],
};

export type TemplateKey =
  | 'registration.confirmed'
  | 'registration.waitlist'
  | 'registration.promoted'
  | 'event.reminder'
  | 'event.cancelled'
  | 'event.feedback'
  | 'newsletter.confirm'
  | 'privacy.data-request'
  | 'directory.submit-confirm'
  | 'directory.listing-approved'
  | 'directory.listing-rejected'
  | 'directory.manage-link'
  | 'directory.renewal-reminder'
  | 'directory.renewal-today'
  | 'directory.hidden'
  | 'directory.claim-invite'
  | 'directory.claim-confirm'
  | 'directory.claim-approved'
  | 'directory.claim-rejected'
  | 'directory.change-approved'
  | 'directory.change-rejected'
  | 'membership.approved'
  | 'membership.rejected'
  | 'member.confirm'
  | 'member.welcome'
  | 'member.link'
  | 'member.already-member'
  | 'member.confirm-event'
  | 'member.claim'
  | 'member.renewal'
  | 'member.lapsed'
  | 'admin.contact-form'
  | 'admin.listing-to-review'
  | 'admin.claim-to-review'
  | 'admin.change-to-review'
  | 'admin.membership-application'
  | 'admin.directory-digest';

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

  // ---------- Ecosystem: emails to the people who list or manage an organisation ----------
  'directory.submit-confirm': {
    label: 'Listing request: confirm your email',
    group: 'Ecosystem',
    audience: 'The person who submitted the listing',
    trigger: 'When someone submits an organisation on the Get listed page',
    subject: 'Confirm your listing request for {org}',
    body: "Hi {name}, thanks for adding {org} to La French Tech Bangkok's ecosystem directory.\n\nPlease confirm your email address. We review every request and aim to answer within 5 days.\n\nThis link expires in 7 days.",
    buttonLabel: 'Confirm my email',
    placeholders: [{ ...P.name, description: 'The name of the person who submitted it' }, D.org],
    added: 'The confirmation link (the button).',
    preview: { buttonUrl: `${SITE}/ecosystem/verify` },
  },
  'directory.listing-approved': {
    label: 'Listing published',
    group: 'Ecosystem',
    audience: 'The managers of the listing',
    trigger: 'When a moderator approves a new listing',
    subject: '{org} is now listed on La French Tech Bangkok',
    body: "Good news: {org} is now published in La French Tech Bangkok's ecosystem directory.\n\nOnce a year we'll ask you to confirm the listing is still accurate, so the directory stays reliable. You can update it any time from the link below.",
    buttonLabel: 'See your listing',
    placeholders: [D.org],
    added: 'Links to the listing, to update it and to confirm it is accurate.',
    preview: {
      buttonUrl: sampleOrgUrl,
      links: [
        { label: 'Update your listing', url: `${SITE}/ecosystem/manage` },
        { label: 'Confirm it is accurate', url: `${SITE}/ecosystem/confirm` },
      ],
    },
  },
  'directory.listing-rejected': {
    label: 'Listing request declined',
    group: 'Ecosystem',
    audience: 'The person who submitted the listing',
    trigger: 'When a moderator rejects a new listing',
    subject: 'Your listing request for {org}',
    body: "Thank you for submitting {org} to La French Tech Bangkok's ecosystem directory. We couldn't publish it as it is:\n\n{reason}\n\nYou are welcome to submit it again with the changes.",
    buttonLabel: 'Submit again',
    placeholders: [D.org, D.reason],
    required: ['reason'],
    added: 'The link to the Get listed page (the button).',
    preview: { buttonUrl: `${SITE}/ecosystem/submit` },
  },
  'directory.manage-link': {
    label: 'Link to manage a listing',
    group: 'Ecosystem',
    audience: 'A listing manager who asked for the link',
    trigger: 'When a manager asks for a link on the Manage your listing page',
    subject: 'Your link to manage your French Tech Bangkok listing',
    body: "Use the button below to update {listings}. The link works once and expires in 30 minutes.\n\nIf you didn't ask for this, you can ignore this email.",
    buttonLabel: 'Manage my listing',
    placeholders: [
      {
        key: 'listings',
        description: 'The organisation name, or "your 2 listings" when they manage several',
        sample: 'Siam Robotics',
      },
    ],
    added: 'The one-time link (the button).',
    preview: { buttonUrl: `${SITE}/ecosystem/manage` },
  },
  'directory.renewal-reminder': {
    label: 'Yearly check: is the listing still accurate?',
    group: 'Ecosystem',
    audience: 'The managers of the listing',
    trigger: 'At 9:00, 30 and 14 days before the yearly confirmation date',
    subject: 'Is your {org} listing still accurate?',
    body: RENEWAL_BODY,
    buttonLabel: 'Yes, it is still accurate',
    placeholders: [D.org, D.due],
    added:
      'The one-click confirmation link (the button), and links to update and to see the listing.',
    preview: renewalPreview,
  },
  'directory.renewal-today': {
    label: 'Yearly check: last day',
    group: 'Ecosystem',
    audience: 'The managers of the listing',
    trigger: 'At 9:00 on the yearly confirmation date',
    subject: 'Today: is the {org} listing still accurate?',
    body: RENEWAL_BODY,
    buttonLabel: 'Yes, it is still accurate',
    placeholders: [D.org, D.due],
    added:
      'The one-click confirmation link (the button), and links to update and to see the listing.',
    preview: renewalPreview,
  },
  'directory.hidden': {
    label: 'Listing hidden (not confirmed)',
    group: 'Ecosystem',
    audience: 'The managers of the listing',
    trigger: 'When a listing is hidden, 30 days after its confirmation date passed',
    subject: '{org} is now hidden from the directory',
    body: "We didn't get a confirmation for {org}, so the listing is now hidden from La French Tech Bangkok's directory.\n\nYou can bring it back at any time in the next 12 months with one click.",
    buttonLabel: 'Reactivate my listing',
    placeholders: [D.org],
    added: 'The one-click reactivation link (the button).',
    preview: { buttonUrl: `${SITE}/ecosystem/confirm` },
  },
  'directory.claim-invite': {
    label: 'Invitation to claim a listing',
    group: 'Ecosystem',
    audience: 'The person a moderator invites',
    trigger: 'When a moderator invites someone to claim an unclaimed listing',
    subject: "{org} is listed in La French Tech Bangkok's directory",
    body: "{org} is listed in La French Tech Bangkok's ecosystem directory, but nobody manages the listing yet.\n\nClaim it to keep it accurate: update the description, logo and links, and confirm it once a year. It is free.",
    buttonLabel: 'Claim the listing',
    placeholders: [D.org],
    added: 'The link to claim the listing (the button) and a link to see it.',
    preview: {
      buttonUrl: `${sampleOrgUrl}/claim`,
      links: [{ label: 'See the listing', url: sampleOrgUrl }],
    },
  },
  'directory.claim-confirm': {
    label: 'Claim: confirm your email',
    group: 'Ecosystem',
    audience: 'The person who claims a listing',
    trigger: 'When someone asks to manage a listing on its Claim page',
    subject: 'Confirm your claim for {org}',
    body: "You asked to manage the {org} listing in La French Tech Bangkok's directory.\n\nConfirm your email and a moderator will approve the claim, usually within 5 days.",
    buttonLabel: 'Confirm my email',
    placeholders: [D.org],
    added: 'The confirmation link (the button).',
    preview: { buttonUrl: `${SITE}/ecosystem/claim/verify` },
  },
  'directory.claim-approved': {
    label: 'Claim approved: you manage the listing',
    group: 'Ecosystem',
    audience: 'The person who claimed the listing',
    trigger: 'When a moderator approves a claim',
    subject: 'You can now manage {org} on La French Tech Bangkok',
    body: "Your request was approved: you can now update the {org} listing in La French Tech Bangkok's ecosystem directory.\n\nOnce a year we will ask you to confirm the listing is still accurate.",
    buttonLabel: 'Update the listing',
    placeholders: [D.org],
    added: 'The link to update the listing (the button), and links to confirm it and to see it.',
    preview: {
      buttonUrl: `${SITE}/ecosystem/manage`,
      links: [
        { label: 'Confirm it is accurate', url: `${SITE}/ecosystem/confirm` },
        { label: 'See the listing', url: sampleOrgUrl },
      ],
    },
  },
  'directory.claim-rejected': {
    label: 'Claim declined',
    group: 'Ecosystem',
    audience: 'The person who claimed the listing',
    trigger: 'When a moderator rejects a claim',
    subject: 'Your request to manage {org}',
    body: "We could not approve your request to manage {org} in La French Tech Bangkok's directory:\n\n{reason}\n\nReply to this email if you think this is a mistake.",
    placeholders: [D.org, D.reason],
    required: ['reason'],
    added: 'Nothing: the email is only these words.',
    preview: {},
  },
  'directory.change-approved': {
    label: 'Listing changes published',
    group: 'Ecosystem',
    audience: 'The manager who asked for the changes',
    trigger: 'When a moderator approves changes to the name, category or description',
    subject: 'Your changes to {org} are live',
    body: 'A moderator approved your changes to {org}. They are now visible in the directory.',
    buttonLabel: 'See the listing',
    placeholders: [D.org],
    added: 'The link to the listing (the button).',
    preview: { buttonUrl: sampleOrgUrl },
  },
  'directory.change-rejected': {
    label: 'Listing changes declined',
    group: 'Ecosystem',
    audience: 'The manager who asked for the changes',
    trigger: 'When a moderator rejects changes to the name, category or description',
    subject: 'Your changes to {org} were not published',
    body: 'A moderator could not publish your changes to {org}:\n\n{reason}',
    buttonLabel: 'Update the listing',
    placeholders: [D.org, D.reason],
    required: ['reason'],
    added: 'The link to update the listing (the button).',
    preview: { buttonUrl: `${SITE}/ecosystem/manage` },
  },
  'membership.approved': {
    label: 'Membership approved',
    group: 'Ecosystem',
    audience: 'The person who applied',
    trigger: 'When the board approves a membership application',
    subject: 'Welcome to La French Tech Bangkok, {org}',
    body: 'The board approved {org} as a member of La French Tech Bangkok. Your listing now shows the Member badge.\n\nWe will share member news and perks by email.',
    buttonLabel: 'See the listing',
    placeholders: [D.org],
    added: 'The link to the listing (the button).',
    preview: { buttonUrl: sampleOrgUrl },
  },
  'membership.rejected': {
    label: 'Membership declined',
    group: 'Ecosystem',
    audience: 'The person who applied',
    trigger: 'When the board rejects a membership application',
    subject: 'Your membership application for {org}',
    body: 'The board could not approve the membership of {org} for now:\n\n{reason}',
    buttonLabel: 'See the listing',
    placeholders: [D.org, D.reason],
    required: ['reason'],
    added: 'The link to the listing (the button).',
    preview: { buttonUrl: sampleOrgUrl },
  },

  // ---------- Membership: the free individual membership ----------
  'member.confirm': {
    label: 'Sign-up: confirm your membership',
    group: 'Membership',
    audience: 'The person who signed up',
    trigger: 'When someone signs up on the Join page (or signs up again before confirming)',
    subject: 'Confirm your La French Tech Bangkok membership',
    body: "Hi {name}, thanks for joining La French Tech Bangkok. One click to confirm your email and your free membership starts.\n\nDidn't sign up? Ignore this email and nothing happens.",
    buttonLabel: 'Confirm my membership',
    placeholders: [P.name],
    added: 'The confirmation link (the button) and a footer: "The link works for 7 days."',
    preview: { buttonUrl: `${SITE}/member/confirm`, footer: 'The link works for 7 days.' },
  },
  'member.welcome': {
    label: 'Welcome to the membership',
    group: 'Membership',
    audience: 'The new member',
    trigger: 'When someone confirms their membership (not when an active member confirms again)',
    subject: 'Welcome to La French Tech Bangkok',
    body: "Welcome, {name}! You are now a member of La French Tech Bangkok. Membership is free; we'll ask you to confirm it once a year.\n\n{whatsapp}\n\n{next-events}\n\nYour member page lets you update your profile and see your events. Keep this email: the button opens it.",
    buttonLabel: 'Open my member page',
    placeholders: [
      P.name,
      {
        key: 'whatsapp',
        description:
          'The invitation to the WhatsApp community with its link (empty when Settings has no WhatsApp link)',
        sample: `Join the members' WhatsApp community, where we share events, jobs, questions and introductions: https://chat.whatsapp.com/sample`,
      },
      {
        key: 'next-events',
        description:
          '"Coming up next:" and the next three events, one per paragraph when on a line of its own (empty when none is planned)',
        sample: `Coming up next:\n${SAMPLE_EVENT}, ${SAMPLE_DATE}: ${sampleEventUrl}`,
        list: true,
      },
    ],
    added:
      'The link to the member page (the button) and, when Settings has a WhatsApp link, a "Join the WhatsApp community" link.',
    preview: {
      buttonUrl: `${SITE}/member`,
      links: [{ label: 'Join the WhatsApp community', url: 'https://chat.whatsapp.com/sample' }],
    },
  },
  'member.link': {
    label: 'Link to the member page',
    group: 'Membership',
    audience: 'A member who asked for their link',
    trigger: 'When a member asks for their link on the member page, or an admin sends it',
    subject: 'Your La French Tech Bangkok member page',
    body: "Hi {name}, here is the link to your member page, as you asked.\n\nDidn't ask for it? Ignore this email.",
    buttonLabel: 'Open my member page',
    placeholders: [P.name],
    added: 'The link to the member page (the button) and a footer: "The link works for 30 days."',
    preview: { buttonUrl: `${SITE}/member`, footer: 'The link works for 30 days.' },
  },
  'member.already-member': {
    label: 'Sign-up again: already a member',
    group: 'Membership',
    audience: 'A member who signs up again on the Join page',
    trigger: 'When an active or suspended member signs up again with the same email',
    subject: 'Your La French Tech Bangkok member page',
    body: "Hi {name}, you are already a member. Here is the link to your member page.\n\nDidn't ask for it? Ignore this email.",
    buttonLabel: 'Open my member page',
    placeholders: [P.name],
    added: 'The link to the member page (the button) and a footer: "The link works for 30 days."',
    preview: { buttonUrl: `${SITE}/member`, footer: 'The link works for 30 days.' },
  },
  'member.confirm-event': {
    label: 'Register as a new member: confirm',
    group: 'Membership',
    audience: 'Someone who is not a member yet and registers for an event',
    trigger:
      'When membership is open and an unknown email registers for an event (they fill the free membership form)',
    subject: 'Confirm your email to register for {event}',
    body: "Hi {name}, one click to confirm your email: you become a member of La French Tech Bangkok (it's free) and you're registered for {event}.\n\nDidn't sign up? Ignore this email and nothing happens.",
    buttonLabel: 'Confirm and register',
    placeholders: [P.name, P.event],
    added:
      'The confirmation link (the button) and a footer: "The link works for 7 days." The event confirmation with the ticket follows once they click.',
    preview: { buttonUrl: `${SITE}/member/confirm`, footer: 'The link works for 7 days.' },
  },
  'member.claim': {
    label: 'Claim your membership (invitation)',
    group: 'Membership',
    audience: 'Past attendees the team invites from Contacts',
    trigger: 'When the team clicks "Invite to join" on selected contacts',
    subject: 'Your free La French Tech Bangkok membership',
    body: "Hi {name}, thanks for coming to our events. La French Tech Bangkok now has a free membership: members register for events with just their email, get the invitation to the members' WhatsApp community and hear about what's coming first.\n\nWe've filled in what we know about you: check it, accept the code of conduct and you're in.\n\nNot interested? Ignore this email and we won't add you.",
    buttonLabel: 'Claim my membership',
    placeholders: [P.name],
    added:
      'The link to the prefilled form (the button) and a footer: "The link works for 60 days."',
    preview: { buttonUrl: `${SITE}/member/claim`, footer: 'The link works for 60 days.' },
  },
  'member.renewal': {
    label: 'Yearly reminder: confirm your membership',
    group: 'Membership',
    audience: 'Active members whose year ends soon',
    trigger: '30 days and 7 days before the membership year ends',
    subject: 'Keep your La French Tech Bangkok membership for another year',
    body: "Hi {name}, your free membership comes up for renewal on {due}. One click keeps it for another year.\n\nIf you don't confirm, your membership pauses; you can come back any time.",
    buttonLabel: 'Keep my membership',
    placeholders: [P.name, { key: 'due', description: 'The renewal date', sample: '3 Nov 2027' }],
    added: 'The one-click link (the button) and a footer: "The link works for 60 days."',
    preview: { buttonUrl: `${SITE}/member/renew`, footer: 'The link works for 60 days.' },
  },
  'member.lapsed': {
    label: 'Membership paused (not confirmed)',
    group: 'Membership',
    audience: "Members who didn't confirm their year",
    trigger: 'The day after the membership year ended without a confirmation',
    subject: 'Your La French Tech Bangkok membership is paused',
    body: "Hi {name}, we didn't hear back, so your membership is paused: you need to be a member to register for our events and see the WhatsApp invitation. One click brings it back for a year.",
    buttonLabel: 'Renew my membership',
    placeholders: [P.name],
    added: 'The one-click link (the button) and a footer: "The link works for 60 days."',
    preview: { buttonUrl: `${SITE}/member/renew`, footer: 'The link works for 60 days.' },
  },

  // ---------- Admin notifications: emails to the team ----------
  'admin.contact-form': {
    label: 'Contact form message',
    group: 'Admin notifications',
    audience: 'The contact address in Settings',
    trigger: 'When someone sends the contact form (not when the sender is blocked)',
    subject: 'Website contact ({topic}): {name}',
    body: '{message}',
    placeholders: [
      { key: 'name', description: 'The name of the sender', sample: 'Camille Martin' },
      { key: 'topic', description: 'The topic they chose', sample: 'Partnership' },
      {
        key: 'message',
        description: 'Their message, as they wrote it',
        sample: 'Hello, we would like to sponsor one of your next events. Who should we talk to?',
      },
    ],
    required: ['message'],
    added:
      'The sender, company, topic and page, and a footer: "Sent from the contact form… Reply to answer directly." Replying answers the sender.',
    preview: {
      details: [
        ['From', 'Camille Martin <camille@example.com>'],
        ['Company', 'Siam Robotics'],
        ['Topic', 'Partnership'],
        ['Sent from', '/contact'],
      ],
      footer: 'Sent from the contact form on french-tech-bangkok.com. Reply to answer directly.',
    },
  },
  'admin.listing-to-review': {
    label: 'New listing to review',
    group: 'Admin notifications',
    audience: 'The directory moderators',
    trigger: 'When someone confirms the email of a new listing request',
    subject: 'New directory listing to review: {org}',
    body: '{org} asked to be listed in the ecosystem directory and verified {email}.\n\nTarget: answer within 5 days.',
    buttonLabel: 'Review in the admin',
    placeholders: [D.org, D.email],
    added: 'The category, website and pitch, and the link to the admin (the button).',
    preview: {
      buttonUrl: adminEcosystemUrl,
      details: [
        ['Category', 'startup'],
        ['Website', 'https://siamrobotics.example'],
        ['Pitch', 'Robots for Thai warehouses'],
      ],
    },
  },
  'admin.claim-to-review': {
    label: 'Claim to review',
    group: 'Admin notifications',
    audience: 'The directory moderators',
    trigger: 'When someone confirms the email of a claim',
    subject: 'Listing claim to review: {org}',
    body: '{name} ({role}) verified {email} and asks to manage {org}.\n\n{domain-check}',
    buttonLabel: 'Review in the admin',
    placeholders: [
      { key: 'name', description: 'Their name (their email if none)', sample: 'Camille Martin' },
      { key: 'role', description: 'Their role, or "no role given"', sample: 'CEO' },
      D.email,
      D.org,
      {
        key: 'domain-check',
        description: 'Whether the email domain matches the website (a sentence)',
        sample: 'The email domain matches the website.',
      },
    ],
    added: 'The link to the admin (the button).',
    required: ['domain-check'],
    preview: { buttonUrl: adminEcosystemUrl },
  },
  'admin.change-to-review': {
    label: 'Listing change to review',
    group: 'Admin notifications',
    audience: 'The directory moderators',
    trigger: 'When a manager changes the name, category or description of a listing',
    subject: 'Listing change to review: {org}',
    body: '{email} asked to change {fields} on {org}.',
    buttonLabel: 'Review in the admin',
    placeholders: [
      D.email,
      { key: 'fields', description: 'The fields they changed', sample: 'name, pitch' },
      D.org,
    ],
    added: 'The link to the admin (the button).',
    preview: { buttonUrl: adminEcosystemUrl },
  },
  'admin.membership-application': {
    label: 'Membership application',
    group: 'Admin notifications',
    audience: 'The directory moderators',
    trigger: 'When a listing manager applies for membership',
    subject: 'Membership application: {org}',
    body: '{org} applied for the free French Tech Bangkok membership.\n\n{motivation}',
    buttonLabel: 'Review in the admin',
    placeholders: [
      D.org,
      {
        key: 'motivation',
        description: 'Their motivation, as they wrote it',
        sample: 'We hire French engineers in Bangkok and want to help the community grow.',
      },
    ],
    required: ['motivation'],
    added: 'The contact person, and the link to the admin (the button).',
    preview: {
      buttonUrl: adminEcosystemUrl,
      details: [['Contact', 'Camille Martin (CEO) <camille@example.com>']],
    },
  },
  'admin.directory-digest': {
    label: 'Directory: weekly summary',
    group: 'Admin notifications',
    audience: 'The directory moderators',
    trigger: 'Every Monday at 9:00, when something waits for review or a renewal is due',
    subject: 'Directory: {items} to review{oldest}',
    body: 'Weekly summary of the ecosystem directory. Target: answer within {target} days.\n\n{renewals}',
    buttonLabel: 'Open the moderation queue',
    placeholders: [
      { key: 'items', description: 'How many items wait, e.g. "3 items"', sample: '3 items' },
      {
        key: 'oldest',
        description:
          '" (oldest 9 days)" when the oldest waits longer than the target, otherwise empty',
        sample: ' (oldest 9 days)',
      },
      { key: 'target', description: 'The target answer time, in days', sample: '5' },
      {
        key: 'renewals',
        description:
          'Listings due for renewal this month, one per paragraph when on a line of its own',
        sample:
          'Renewal due: Siam Robotics, 12 Nov 2026\nRenewal due: Lotus Labs, 20 Nov 2026 (unclaimed, invite someone to claim it)',
        list: true,
      },
    ],
    required: ['renewals'],
    added: 'The counts per kind of item, and the link to the moderation queue (the button).',
    preview: {
      buttonUrl: adminEcosystemUrl,
      details: [
        ['New listings', '1'],
        ['Owner changes', '1'],
        ['Claims', '1'],
        ['Membership applications', '0'],
        ['Oldest item', '9 days'],
        ['Renewals due this month', '2 (1 unclaimed)'],
      ],
    },
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
  {
    label: 'Email the community',
    group: 'Community' as TemplateGroup,
    audience: 'Active members, newsletter subscribers, or contacts you select',
    trigger: 'Written each time on Community > Email the community',
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

/**
 * Placeholders a text uses that this email doesn't know, required ones missing from the message,
 * and required ones put in the subject or the button (long or multi-line values belong in the
 * message, where they are always shown in full).
 */
export function checkPlaceholders(def: EmailTemplateDef, t: EmailText) {
  const inBody = placeholdersIn(t.body);
  const inSubject = placeholdersIn(t.subject);
  const inButton = placeholdersIn(t.buttonLabel ?? '');
  const known = new Set(def.placeholders.map((p) => p.key));
  const required = def.required ?? [];
  return {
    unknown: [...new Set([...inSubject, ...inBody, ...inButton])].filter((k) => !known.has(k)),
    missing: required.filter((k) => !inBody.includes(k)),
    inSubject: required.filter((k) => inSubject.includes(k)),
    inButton: required.filter((k) => inButton.includes(k)),
  };
}

const MAX_SUBJECT = 250;
/** A filled subject on one line, at most MAX_SUBJECT characters (values can be long). */
function oneLine(s: string) {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > MAX_SUBJECT ? `${t.slice(0, MAX_SUBJECT - 1).trimEnd()}…` : t;
}

export const defaultText = (def: EmailTemplateDef): EmailText => ({
  subject: def.subject,
  body: def.body,
  buttonLabel: def.buttonLabel ?? null,
});

/**
 * Placeholder values. A list (string[]) is built by the site, e.g. the steps of a digest: on a
 * line of its own it becomes one paragraph per item, elsewhere its items are joined.
 */
export type TemplateVars = Record<string, string | readonly string[]>;

const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
const STANDALONE = /^\{([A-Za-z][\w-]*)\}$/;

/** The words of an email: the edited text (or the default) with its placeholders filled. */
export function applyTemplate(
  def: EmailTemplateDef,
  text: EmailText | null | undefined,
  vars: TemplateVars,
): RenderedTemplate {
  const t = text ?? defaultText(def);
  const flat = (sep: string) =>
    Object.fromEntries(
      Object.entries(vars).map(([k, v]) => [k, typeof v === 'string' ? v : v.join(sep)]),
    );
  const inSubject = flat(', ');
  const inBody = flat('\n');
  const source = splitParagraphs(t.body);
  const paragraphs = (source.length ? source : splitParagraphs(def.body)).flatMap((p) => {
    const k = STANDALONE.exec(p)?.[1];
    const v = k && has(vars, k) ? vars[k] : undefined;
    return v !== undefined && typeof v !== 'string' ? [...v] : [fillPlaceholders(p, inBody)];
  });
  // An optional placeholder left empty (e.g. {whatsapp} with no link) leaves no blank paragraph.
  const filled = paragraphs.filter((p) => p.trim());
  return {
    subject:
      oneLine(fillPlaceholders(t.subject, inSubject)) ||
      oneLine(fillPlaceholders(def.subject, inSubject)),
    paragraphs: filled,
    buttonLabel:
      def.buttonLabel === undefined
        ? ''
        : fillPlaceholders(t.buttonLabel?.trim() || def.buttonLabel, inSubject),
  };
}

/** The sample values of an email's placeholders, for the preview and the test email. */
export const sampleVars = (def: EmailTemplateDef): TemplateVars =>
  Object.fromEntries(
    def.placeholders.map((p) => [p.key, p.list ? p.sample.split('\n') : p.sample]),
  );

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
      const c = checkPlaceholders(def, t);
      const list = (keys: string[]) => keys.map((k) => `{${k}}`).join(', ');
      if (c.missing.length)
        ctx.addIssue({
          code: 'custom',
          path: ['body'],
          message: `Keep ${list(c.missing)} in the message.`,
        });
      if (c.inSubject.length)
        ctx.addIssue({
          code: 'custom',
          path: ['subject'],
          message: `${list(c.inSubject)} can be long: put it in the message, not the subject.`,
        });
      if (c.inButton.length)
        ctx.addIssue({
          code: 'custom',
          path: ['buttonLabel'],
          message: `${list(c.inButton)} can be long: put it in the message, not the button.`,
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
  vars: TemplateVars,
  db: D1Database = env.DB,
): Promise<RenderedTemplate> {
  return applyTemplate(EMAIL_TEMPLATES[key], await loadTemplateText(key, db), vars);
}
