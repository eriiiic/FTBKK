import { z } from 'zod';
import { and, eq, notInArray, sql } from 'drizzle-orm';
import { getDb } from '../db';
import { auditLog, organisations, type Organisation } from '../db/schema';
import { CATEGORY_KEYS, PARTNER_TYPE_KEYS, SECTORS, STAGES } from './directory';
import { email, optionalText, optionalUrl } from './forms';
import { getSettings } from './settings';
import { sendEmail } from './email';
import { renderTemplate } from './email-templates';
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

import { siteUrl } from './site';
export { siteUrl };

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

/** The team's private note on a listing (Ecosystem > All listings and the listing's page). */
export const OrgNotesForm = z.object({
  id: z.coerce.number().int().positive(),
  adminNotes: z
    .string()
    .trim()
    .max(4000)
    .transform((s) => s || null),
});

export async function saveOrgNotes({ id, adminNotes }: z.infer<typeof OrgNotesForm>) {
  await getDb()
    .update(organisations)
    .set({ adminNotes, updatedAt: new Date() })
    .where(eq(organisations.id, id));
}

/** One partner row of Ecosystem > Partners: its group (empty = no longer a partner), order, Home. */
export const PartnerForm = z.object({
  id: z.coerce.number().int().positive(),
  partnerType: z
    .union([z.literal(''), z.enum(PARTNER_TYPE_KEYS)])
    .optional()
    .transform((v) => v || null),
  partnerOrder: z.coerce.number().int().min(0).max(999).default(0),
  partnerHome: z
    .literal('on')
    .optional()
    .transform((v) => v === 'on'),
});

export async function savePartner(
  { id, partnerType, partnerOrder, partnerHome }: z.infer<typeof PartnerForm>,
  actor: string,
) {
  const before = await orgById(id);
  if (!before) return;
  const after = { partnerType, partnerOrder, partnerHome: !!partnerType && partnerHome };
  await getDb()
    .update(organisations)
    .set({ ...after, updatedAt: new Date() })
    .where(eq(organisations.id, id));
  await audit(
    actor,
    'partner',
    'organisation',
    id,
    {
      partnerType: before.partnerType,
      partnerOrder: before.partnerOrder,
      partnerHome: before.partnerHome,
    },
    after,
  );
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
    partner: !!o.partnerType,
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
  const w = await renderTemplate('directory.listing-approved', { org: org.name });
  for (const owner of org.ownerEmails) {
    const manage = await issueToken('confirm', owner, { orgId: org.id });
    await sendEmail({
      to: owner,
      subject: w.subject,
      paragraphs: w.paragraphs,
      action: { label: w.buttonLabel, url: siteUrl(`/ecosystem/${org.slug}`) },
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
    const w = await renderTemplate('directory.listing-rejected', { org: org.name, reason });
    await sendEmail({
      to: org.ownerEmails,
      subject: w.subject,
      paragraphs: w.paragraphs,
      action: { label: w.buttonLabel, url: siteUrl('/ecosystem/submit') },
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
  const w = await renderTemplate('directory.manage-link', {
    listings: owned.length === 1 ? owned[0]!.name : `your ${owned.length} listings`,
  });
  await sendEmail({
    to: addr,
    subject: w.subject,
    paragraphs: w.paragraphs,
    action: { label: w.buttonLabel, url: siteUrl(`/ecosystem/manage/${token}`) },
  });
}

export async function sendRenewalReminder(org: Organisation, offset: number) {
  const due = org.renewalDueAt ? formatDate(org.renewalDueAt) : 'soon';
  const w = await renderTemplate(
    offset === 0 ? 'directory.renewal-today' : 'directory.renewal-reminder',
    { org: org.name, due },
  );
  for (const owner of org.ownerEmails) {
    const token = await issueToken('confirm', owner, { orgId: org.id });
    await sendEmail({
      to: owner,
      subject: w.subject,
      paragraphs: w.paragraphs,
      action: {
        label: w.buttonLabel,
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
  const w = await renderTemplate('directory.hidden', { org: org.name });
  for (const owner of org.ownerEmails) {
    const token = await issueToken('confirm', owner, { orgId: org.id });
    await sendEmail({
      to: owner,
      subject: w.subject,
      paragraphs: w.paragraphs,
      action: {
        label: w.buttonLabel,
        url: siteUrl(`/ecosystem/confirm?token=${token}`),
      },
    });
  }
}
