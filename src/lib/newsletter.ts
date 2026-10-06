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
import { renderTemplate } from './email-templates';

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
  const w = await renderTemplate('newsletter.confirm', { name: data.name });
  await sendEmail({
    to: data.email,
    subject: w.subject,
    paragraphs: w.paragraphs,
    action: {
      label: w.buttonLabel,
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
