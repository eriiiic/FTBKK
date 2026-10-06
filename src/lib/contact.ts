// The public contact form (About and Join pages): topics, validation, and filing the message in
// the admin's Messages inbox. Topics are in lib/messages.ts.
export { CONTACT_TOPICS, topicLabel } from './messages';
import { z } from 'zod';
import { getDb } from '../db';
import { messageNotes, submissions } from '../db/schema';
import { clientIp, email, fieldErrors, formToObject, optionalText } from './forms';
import { verifyTurnstile } from './turnstile';
import { rateLimit } from './ratelimit';
import { sendEmail } from './email';
import { CONTACT_TOPICS, blockedBy, topicLabel, type ContactTopic } from './messages';
import { defaultOwners, loadTeam } from './ownership';
import type { Settings } from './settings';

/** A topic from a link (?topic=whatsapp), to preselect it in the form. */
export const topicFromQuery = (q: string | null): ContactTopic =>
  q && q in CONTACT_TOPICS ? (q as ContactTopic) : 'general';

const TOPIC_KEYS = Object.keys(CONTACT_TOPICS) as [ContactTopic, ...ContactTopic[]];

export const ContactSchema = z.object({
  name: z.string().trim().min(1, 'Tell us your name.').max(120),
  email,
  company: optionalText(120),
  topic: z.enum(TOPIC_KEYS).default('general'),
  message: z.string().trim().min(10, 'Write a few words.').max(4000),
});

export interface ContactResult {
  errors: Record<string, string>;
  values: Record<string, unknown>;
  sent: boolean;
}

/**
 * Handles a contact form post: anti-spam check, rate limit, validation, then the message lands in
 * Messages (assigned to the team member with the Messages role) and is emailed to the contact
 * address. A blocked sender sees the usual thank-you; the message is kept in Spam, unannounced.
 */
export async function handleContactForm(
  request: Request,
  form: FormData,
  settings: Settings,
  page: string,
): Promise<ContactResult> {
  const values = formToObject(form);
  const ip = clientIp(request);
  if (!(await verifyTurnstile(form.get('cf-turnstile-response') as string, ip)))
    return {
      values,
      sent: false,
      errors: { form: 'The anti-spam check failed. Please try again.' },
    };
  if (!(await rateLimit(`contact:${ip}`, 5, 3600)))
    return {
      values,
      sent: false,
      errors: { form: 'Too many messages from your connection. Please try again later.' },
    };
  const parsed = ContactSchema.safeParse(values);
  if (!parsed.success) return { values, sent: false, errors: fieldErrors(parsed.error) };

  const data = { ...parsed.data, page };
  const blocked = await blockedBy(data.email);
  const assignee = blocked ? null : (defaultOwners(await loadTeam()).get('messages') ?? null);
  const [saved] = await getDb()
    .insert(submissions)
    .values({
      type: 'contact',
      payload: data,
      assignee,
      ...(blocked
        ? {
            status: 'spam' as const,
            handled: true,
            statusAt: new Date(),
            statusBy: `blocked: ${blocked}`,
          }
        : {}),
    })
    .returning({ id: submissions.id });
  if (blocked && saved)
    await getDb()
      .insert(messageNotes)
      .values({
        submissionId: saved.id,
        kind: 'status',
        body: `Arrived in Spam (sender ${blocked} is blocked)`,
        author: 'website',
      });
  if (!blocked)
    await sendEmail({
      to: [...new Set([settings.contactEmail, ...(assignee ? [assignee] : [])])],
      replyTo: data.email,
      subject: `Website contact (${topicLabel(data.topic)}): ${data.name}`,
      paragraphs: [data.message],
      details: [
        ['From', `${data.name} <${data.email}>`],
        ['Company', data.company ?? '-'],
        ['Topic', topicLabel(data.topic)],
        ['Sent from', page],
        ...(assignee ? ([['Assigned to', assignee]] as [string, string][]) : []),
      ],
      footer: 'Sent from the contact form on french-tech-bangkok.com. Reply to answer directly.',
    });
  return { values: {}, sent: true, errors: {} };
}
