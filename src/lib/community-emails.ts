// "Email the community" (Community > Email the community): one email, written each time, to the
// active members, the newsletter subscribers or a selection of contacts.
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb } from '../db';
import { members } from '../db/schema';
import type { EmailMessage } from './email';
import { optionalUrl } from './forms';
import { personalise, toParagraphs } from './event-emails';
import { loadContacts } from './contacts';
import { siteUrl } from './registrations';

export const COMMUNITY_AUDIENCES = {
  members: { label: 'Members', hint: 'Every active member' },
  newsletter: { label: 'Newsletter subscribers', hint: 'Contacts who agreed to the newsletter' },
  contacts: { label: 'Selected contacts', hint: 'The people you ticked in Contacts' },
} as const;
export type CommunityAudience = keyof typeof COMMUNITY_AUDIENCES;
export const COMMUNITY_AUDIENCE_KEYS = Object.keys(COMMUNITY_AUDIENCES) as [
  CommunityAudience,
  ...CommunityAudience[],
];

export const CommunityEmailSchema = z
  .object({
    audience: z.enum(COMMUNITY_AUDIENCE_KEYS, { error: 'Choose who gets the email.' }),
    subject: z.string().trim().min(3, 'Write a subject.').max(150),
    body: z.string().trim().min(10, 'Write the message.').max(10000),
    actionLabel: z.string().trim().max(60).optional().default(''),
    actionUrl: optionalUrl(500),
  })
  .refine((d) => !d.actionLabel || d.actionUrl, {
    path: ['actionUrl'],
    message: 'Add the link for the button, or remove its label.',
  })
  .refine((d) => !d.actionUrl || d.actionLabel, {
    path: ['actionLabel'],
    message: 'Give the button a label.',
  });
export type CommunityEmailInput = z.infer<typeof CommunityEmailSchema>;

export interface Recipient {
  name: string;
  email: string;
}

/** One copy per address (case aside); people without an email are left out. */
export function uniqueRecipients(rows: { name: string; email: string | null }[]) {
  const seen = new Set<string>();
  const out: Recipient[] = [];
  for (const r of rows) {
    const email = r.email?.trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    out.push({ name: r.name, email });
  }
  return out;
}

/** Everyone in each audience (the contacts one: the keys selected in Contacts). */
export async function communityRecipients(keys: string[] = []) {
  const [active, all] = await Promise.all([
    getDb()
      .select({ name: members.name, email: members.email })
      .from(members)
      .where(eq(members.status, 'active')),
    loadContacts(),
  ]);
  const wanted = new Set(keys);
  return {
    members: uniqueRecipients(active),
    newsletter: uniqueRecipients(all.filter((c) => c.newsletter.agreed)),
    contacts: uniqueRecipients(all.filter((c) => wanted.has(c.key))),
  } satisfies Record<CommunityAudience, Recipient[]>;
}

const FOOTERS: Record<CommunityAudience, string> = {
  members: 'You get this email because you are a member of La French Tech Bangkok.',
  newsletter: 'You get this email because you subscribed to the La French Tech Bangkok newsletter.',
  contacts: 'You get this email because you came to a La French Tech Bangkok event.',
};

/** The email one person gets, in the site's usual layout. */
export function communityEmail(
  to: Recipient,
  audience: CommunityAudience,
  m: Pick<CommunityEmailInput, 'subject' | 'body' | 'actionLabel' | 'actionUrl'>,
  opts: { replyTo?: string } = {},
): EmailMessage {
  return {
    to: to.email,
    subject: personalise(m.subject, to.name),
    paragraphs: toParagraphs(personalise(m.body, to.name)),
    action: m.actionLabel && m.actionUrl ? { label: m.actionLabel, url: m.actionUrl } : undefined,
    links: [
      audience === 'members'
        ? { label: 'My member page', url: siteUrl('/member') }
        : { label: 'Upcoming events', url: siteUrl('/events') },
    ],
    footer: FOOTERS[audience],
    replyTo: opts.replyTo,
    dataUrl: siteUrl('/my-data'),
  };
}
