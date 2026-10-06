// Newsletter sign-up from the Join page, with double opt-in: the box sends a confirmation link,
// and only the click records the consent (on the person's contact card, as "Subscribed").
import { z } from 'zod';
import { getDb } from '../db';
import { contacts } from '../db/schema';
import { email } from './forms';
import { issueToken } from './tokens';
import { sendEmail } from './email';
import { siteUrl } from './orgs';
import { audit } from './orgs';

export const NewsletterSchema = z.object({
  name: z.string().trim().min(1, 'Tell us your name.').max(120),
  email,
});

/** The link in the confirmation email. The name rides along: the token only holds the email. */
export function newsletterConfirmPath(token: string, name: string) {
  return `/newsletter?${new URLSearchParams({ token, name })}`;
}

export async function sendNewsletterConfirmation(data: z.infer<typeof NewsletterSchema>) {
  const token = await issueToken('newsletter', data.email);
  await sendEmail({
    to: data.email,
    subject: 'Confirm your subscription to the La French Tech Bangkok newsletter',
    paragraphs: [
      `Hi ${data.name}, thanks for signing up. Please confirm it's you: we'll then send you our news, upcoming events and the community's highlights, about once a month.`,
      "Didn't sign up? Ignore this email and nothing happens.",
    ],
    action: {
      label: 'Confirm my subscription',
      url: siteUrl(newsletterConfirmPath(token, data.name)),
    },
    footer: 'The link works for 7 days. You can unsubscribe at any time.',
  });
}

/** Records the consent on the contact card (created when we don't know them yet). */
export async function confirmNewsletter(emailAddress: string, name: string, now = new Date()) {
  const set = { newsletter: 'yes' as const, newsletterAt: now, updatedAt: now };
  await getDb()
    .insert(contacts)
    .values({ email: emailAddress, name: name || emailAddress.split('@')[0]!, ...set })
    .onConflictDoUpdate({ target: contacts.email, set });
  await audit('website', 'contact_newsletter', 'contact', null, null, {
    key: emailAddress,
    newsletter: 'yes',
    source: 'join page',
  });
}
