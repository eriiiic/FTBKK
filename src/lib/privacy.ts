import { z } from 'zod';
import { email as emailField } from './forms';
import { CONTACT_EMAIL_TOKEN } from './code-of-conduct';

/**
 * Default privacy notice (Thailand's PDPA), used until it is edited in /admin/site-texts. The same
 * text is seeded by migrations/0019_privacy_notice.sql and scripts/import.ts.
 */
export const DEFAULT_PRIVACY_NOTICE = `La French Tech Bangkok is a volunteer-run community for French tech founders, employees, investors, students and friends in Thailand. This notice explains what we keep about you when you register for one of our events or become a member, why, and what you can do about it under Thailand's Personal Data Protection Act (PDPA).

## What we collect

- What you type in the registration form: your name, email, phone, company, role, how you heard about us, and your answer to "Anything we should know?".
- Whether you came: we check people in at the door, and the team may add you as a walk-in.
- If you become a member: what you type in the membership form (your name, email, phone, company, job title, LinkedIn, what describes you best, your nationality if you give it, the sectors you're interested in and how you heard about us) and when you confirmed.
- Your newsletter choice, and the date you made it.
- Your feedback after an event, if you give it.
- Notes and tags the organising team adds to help run the community (for example "speaker" or "volunteer").

## Why we use it

- To run our events: your seat, your ticket, the waitlist, check-in at the door.
- To email you about the events you registered for: confirmation, reminder, changes, the feedback request.
- To count who comes, so we can plan better events and welcome newcomers and regulars.
- To run your membership: your member page and the invitation to the members' WhatsApp community.
- To send you the newsletter, only if you said yes.

We use your details for events and your membership because you asked to take part (and it is in our legitimate interest to run them well). We send the newsletter only with your consent, which you can withdraw at any time.

## Who sees it

Only the organising team of La French Tech Bangkok. Our website host and our email provider process it on our behalf to run the site and send emails. We don't sell your details, and we don't give them to hosts, sponsors or speakers. Feedback comments may be shared with them without your name.

## How long we keep it

We keep your membership while you are a member and your event history while you take part in the community, so we know who came and can greet you as a regular. You can ask us to delete it at any time. Deleted data disappears from our weekly backups within 12 weeks.

## Your rights

Under the PDPA you can ask to see the data we hold about you, correct it, delete it, withdraw your consent to the newsletter, or object to how we use it. You can also complain to Thailand's Personal Data Protection Committee (PDPC).

## How to use them

Every email we send about an event has a "Manage or delete my data" link: it shows what we hold about you and lets you delete it, or unsubscribe from the newsletter, yourself. Members can also update their profile or leave from their member page (the link is in every member email). No email to hand? Use "Delete my data" at the bottom of every page and we will email you a link. For anything else, write to us at ${CONTACT_EMAIL_TOKEN}.`;

/**
 * The privacy notice Markdown with the contact email filled in (Markdown turns the bare address
 * into a mailto link). An emptied text falls back to the default.
 */
export function fillPrivacyNotice(md: string, contactEmail: string): string {
  const text = md.trim() ? md : DEFAULT_PRIVACY_NOTICE;
  return text.split(CONTACT_EMAIL_TOKEN).join(contactEmail);
}

/** A registration token as it appears in our links (base64url, from randomToken). */
export const DataTokenSchema = z
  .string()
  .trim()
  .min(16)
  .max(100)
  .regex(/^[A-Za-z0-9_-]+$/);

/**
 * The /my-data form: which button was pressed, and how the person is identified: the registration
 * token from an event email, or the code from a "Delete my data" request email.
 */
export const MyDataActionSchema = z
  .object({
    token: DataTokenSchema.optional(),
    code: DataTokenSchema.optional(),
    action: z.enum(['ask-delete', 'delete', 'unsubscribe']),
  })
  .refine((v) => Boolean(v.token) !== Boolean(v.code));

/** The public "Delete my data" request form on /my-data, for people without an event email. */
export const DataRequestSchema = z.object({
  email: z.preprocess((v) => (typeof v === 'string' ? v.trim() : v), emailField),
});

/** The path of the "Manage or delete my data" page for one registration token. */
export const myDataPath = (token: string) => `/my-data?token=${encodeURIComponent(token)}`;

/** The same page opened from a "Delete my data" request email (a one-day code, not a token). */
export const myDataCodePath = (code: string) => `/my-data?code=${encodeURIComponent(code)}`;

/** What we hold about someone, in plain words, for the /my-data page. */
export function describeMyData(c: {
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  role: string | null;
  registrations: number;
  attended: number;
  cancelled: number;
  newsletter: { agreed: boolean; at: Date | null };
  savedId: number | null;
}): [string, string][] {
  const events = (n: number) => `${n} event${n === 1 ? '' : 's'}`;
  const rows: [string, string][] = [
    ['Name', c.name],
    ['Email', c.email ?? 'None'],
  ];
  if (c.phone) rows.push(['Phone', c.phone]);
  if (c.company) rows.push(['Company', c.company]);
  if (c.role) rows.push(['Role', c.role]);
  rows.push([
    'Events',
    [
      `Registered for ${events(c.registrations)}, came to ${c.attended}`,
      c.cancelled ? `, cancelled ${c.cancelled}` : '',
    ].join(''),
  ]);
  rows.push([
    'Newsletter',
    c.newsletter.agreed
      ? 'Yes, you agreed to get it'
      : c.newsletter.at
        ? 'No, you said no'
        : 'No, you were never asked',
  ]);
  rows.push([
    'Contact card',
    c.savedId
      ? 'Yes: the team saved your details, and may have added tags or notes'
      : 'No, only your registrations',
  ]);
  return rows;
}
