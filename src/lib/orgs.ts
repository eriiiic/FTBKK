import { z } from 'zod';
import { env } from 'cloudflare:workers';
import { and, eq, notInArray, sql } from 'drizzle-orm';
import { getDb } from '../db';
import { auditLog, organisations, type Organisation } from '../db/schema';
import { CATEGORY_KEYS, SECTORS, STAGES } from './directory';
import { email, optionalText, optionalUrl } from './forms';
import { getSettings } from './settings';
import { sendEmail } from './email';
import { issueToken } from './tokens';
import { renewalDates } from './lifecycle';
import { formatDate } from './format';

/** Fields an owner can edit (submit and manage forms). */
export const OrgFields = z.object({
  name: z.string().min(2, 'Enter the organisation name.').max(120),
  category: z.enum(CATEGORY_KEYS as [string, ...string[]], { error: 'Choose a category.' }),
  pitch: z.string().min(10, 'Write a one-line pitch (10 characters or more).').max(160),
  descriptionMd: z.string().max(4000).optional().default(''),
  website: optionalUrl(),
  linkedin: optionalUrl(),
  foundedYear: z
    .union([z.literal(''), z.coerce.number().int().min(1800).max(new Date().getFullYear())])
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : v)),
  sectors: z.array(z.enum(SECTORS)).max(3, 'Pick up to 3 sectors.').default([]),
  stage: z
    .union([z.literal(''), z.enum(STAGES)])
    .optional()
    .transform((v) => v || null),
  teamSize: optionalText(40),
  hiring: z.boolean().optional().default(false),
  raising: z.boolean().optional().default(false),
  ticketSize: optionalText(80),
  frenchLink: optionalText(200),
  publicEmail: z
    .union([z.literal(''), email])
    .optional()
    .transform((v) => v || null),
});

export const SubmitSchema = OrgFields.extend({
  ownerEmail: email,
  submitterName: z.string().min(1, 'Tell us your name.').max(120),
  consentPublish: z.literal(true, { error: 'You need to agree to publication.' }),
  consentReconfirm: z.literal(true, { error: 'You need to agree to the yearly reconfirmation.' }),
});

/** Changes to these fields wait for a moderator; the rest publish at once. */
export const REVIEWED_FIELDS = ['name', 'category', 'logoKey', 'website'] as const;

export const ORG_ARRAY_FIELDS = ['sectors'];

export function siteUrl(path: string) {
  return new URL(path, env.SITE_URL || 'https://www.french-tech-bangkok.com').href;
}

export async function orgBySlug(slug: string) {
  const [o] = await getDb()
    .select()
    .from(organisations)
    .where(eq(organisations.slug, slug))
    .limit(1);
  return o ?? null;
}

export async function orgById(id: number) {
  const [o] = await getDb().select().from(organisations).where(eq(organisations.id, id)).limit(1);
  return o ?? null;
}

export async function orgsOwnedBy(addr: string) {
  return getDb()
    .select()
    .from(organisations)
    .where(
      and(
        sql`exists (select 1 from json_each(${organisations.ownerEmails}) where value = ${addr.toLowerCase()})`,
        notInArray(organisations.status, ['unverified', 'rejected']),
      ),
    );
}

export async function uniqueSlug(base: string) {
  let slug = base || 'organisation';
  for (let i = 2; await orgBySlug(slug); i++) slug = `${base}-${i}`;
  return slug;
}

export async function audit(
  actor: string,
  action: string,
  entity: string,
  entityId: number | null,
  before?: unknown,
  after?: unknown,
) {
  await getDb()
    .insert(auditLog)
    .values({ actor, action, entity, entityId, before: before ?? null, after: after ?? null });
}

export async function moderatorEmails() {
  const s = await getSettings();
  return s.moderatorEmails.length ? s.moderatorEmails : [s.contactEmail];
}

/** Public JSON shape for the directory island (never includes owner emails). */
export function publicOrg(o: Organisation) {
  return {
    slug: o.slug,
    name: o.name,
    pitch: o.pitch,
    category: o.category,
    sectors: o.sectors,
    stage: o.stage,
    hiring: o.hiring,
    raising: o.raising,
    badges: o.badges,
    member: o.memberStatus === 'member',
    logoKey: o.logoKey,
  };
}

export function emailDomainMatches(addr: string, website: string | null) {
  if (!website) return false;
  try {
    const host = new URL(website).hostname.replace(/^www\./, '').toLowerCase();
    const domain = addr.split('@')[1]?.toLowerCase() ?? '';
    return domain === host || domain.endsWith(`.${host}`) || host.endsWith(`.${domain}`);
  } catch {
    return false;
  }
}

// ---------- state transitions ----------

export async function approveListing(org: Organisation, actor: string, now = new Date()) {
  const { confirmedAt, renewalDueAt } = renewalDates(now);
  await getDb()
    .update(organisations)
    .set({
      status: 'published',
      confirmedAt,
      renewalDueAt,
      expiredAt: null,
      rejectionReason: null,
      updatedAt: now,
    })
    .where(eq(organisations.id, org.id));
  await audit(
    actor,
    'approve',
    'organisation',
    org.id,
    { status: org.status },
    { status: 'published' },
  );
  for (const owner of org.ownerEmails) {
    const manage = await issueToken('confirm', owner, { orgId: org.id });
    await sendEmail({
      to: owner,
      subject: `${org.name} is now listed on La French Tech Bangkok`,
      paragraphs: [
        `Good news: ${org.name} is now published in La French Tech Bangkok's ecosystem directory.`,
        `Once a year we'll ask you to confirm the listing is still accurate, so the directory stays reliable. You can update it any time from the link below.`,
      ],
      action: { label: 'See your listing', url: siteUrl(`/ecosystem/${org.slug}`) },
      links: [
        { label: 'Update your listing', url: siteUrl('/ecosystem/manage') },
        { label: 'Confirm it is accurate', url: siteUrl(`/ecosystem/confirm?token=${manage}`) },
      ],
    });
  }
}

export async function rejectListing(org: Organisation, reason: string, actor: string) {
  await getDb()
    .update(organisations)
    .set({ status: 'rejected', rejectionReason: reason, updatedAt: new Date() })
    .where(eq(organisations.id, org.id));
  await audit(
    actor,
    'reject',
    'organisation',
    org.id,
    { status: org.status },
    { status: 'rejected', reason },
  );
  if (org.ownerEmails.length) {
    await sendEmail({
      to: org.ownerEmails,
      subject: `Your listing request for ${org.name}`,
      paragraphs: [
        `Thank you for submitting ${org.name} to La French Tech Bangkok's ecosystem directory. We couldn't publish it as it is:`,
        reason,
        'You are welcome to submit it again with the changes.',
      ],
      action: { label: 'Submit again', url: siteUrl('/ecosystem/submit') },
    });
  }
}

/** Owner confirms the listing is accurate: resets the yearly cycle and reactivates if expired. */
export async function confirmListing(org: Organisation, by: string, now = new Date()) {
  const { confirmedAt, renewalDueAt } = renewalDates(now);
  const reactivate = org.status === 'expired';
  await getDb()
    .update(organisations)
    .set({
      confirmedAt,
      renewalDueAt,
      status: reactivate ? 'published' : org.status,
      expiredAt: null,
      memberStatus: org.memberStatus === 'lapsed' ? 'member' : org.memberStatus,
      updatedAt: now,
    })
    .where(eq(organisations.id, org.id));
  await audit(by, reactivate ? 'reactivate' : 'confirm', 'organisation', org.id, null, {
    renewalDueAt: renewalDueAt.toISOString(),
  });
  return { renewalDueAt, reactivated: reactivate };
}

export async function sendManageLinks(addr: string) {
  const owned = await orgsOwnedBy(addr);
  if (!owned.length) return;
  const token = await issueToken('manage', addr);
  await sendEmail({
    to: addr,
    subject: 'Your link to manage your French Tech Bangkok listing',
    paragraphs: [
      `Use the button below to update ${owned.length === 1 ? owned[0]!.name : `your ${owned.length} listings`}. The link works once and expires in 30 minutes.`,
      "If you didn't ask for this, you can ignore this email.",
    ],
    action: { label: 'Manage my listing', url: siteUrl(`/ecosystem/manage/${token}`) },
  });
}

export async function sendRenewalReminder(org: Organisation, offset: number) {
  const due = org.renewalDueAt ? formatDate(org.renewalDueAt) : 'soon';
  const subject =
    offset === 0
      ? `Today: is the ${org.name} listing still accurate?`
      : `Is your ${org.name} listing still accurate?`;
  for (const owner of org.ownerEmails) {
    const token = await issueToken('confirm', owner, { orgId: org.id });
    await sendEmail({
      to: owner,
      subject,
      paragraphs: [
        `Once a year we ask every organisation in La French Tech Bangkok's directory to confirm its listing, so the directory only shows organisations that are really active.`,
        `Please confirm ${org.name} by ${due}. One click is enough if nothing changed. Listings that are not confirmed are hidden 30 days after that date.`,
      ],
      action: {
        label: 'Yes, it is still accurate',
        url: siteUrl(`/ecosystem/confirm?token=${token}`),
      },
      links: [
        { label: 'Update it first', url: siteUrl('/ecosystem/manage') },
        { label: 'See the listing', url: siteUrl(`/ecosystem/${org.slug}`) },
      ],
    });
  }
}

export async function sendExpiredNotice(org: Organisation) {
  for (const owner of org.ownerEmails) {
    const token = await issueToken('confirm', owner, { orgId: org.id });
    await sendEmail({
      to: owner,
      subject: `${org.name} is now hidden from the directory`,
      paragraphs: [
        `We didn't get a confirmation for ${org.name}, so the listing is now hidden from La French Tech Bangkok's directory.`,
        'You can bring it back at any time in the next 12 months with one click.',
      ],
      action: { label: 'Reactivate my listing', url: siteUrl(`/ecosystem/confirm?token=${token}`) },
    });
  }
}
