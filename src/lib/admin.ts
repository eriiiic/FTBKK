import { z } from 'zod';
import { and, eq, ne } from 'drizzle-orm';
import { getDb } from '../db';
import {
  claims,
  events,
  membershipApplications,
  orgChanges,
  organisations,
  posts,
  type Attachment,
  type Organisation,
  type PostAuthor,
} from '../db/schema';
import { optionalText, optionalUrl } from './forms';
import { slugify } from './format';
import { audit, orgById, siteUrl } from './orgs';
import { sendEmail } from './email';
import { NO_REASON, renderTemplate } from './email-templates';
import { issueToken } from './tokens';
import { renewalDates } from './lifecycle';

// ---------- dates (Bangkok is UTC+7 all year, no DST) ----------

const OFFSET_MS = 7 * 3600 * 1000;

/** Date -> value for <input type="datetime-local"> in Bangkok time. */
export function toLocalInput(d: Date | null | undefined) {
  return d ? new Date(d.getTime() + OFFSET_MS).toISOString().slice(0, 16) : '';
}

/** Date -> value for <input type="date"> in Bangkok time. */
export function toDateInput(d: Date | null | undefined) {
  return toLocalInput(d).slice(0, 10);
}

/** "2026-10-06T18:30" (Bangkok) -> Date. */
export function fromLocalInput(s: string) {
  return new Date(`${s.length === 10 ? `${s}T00:00` : s}:00+07:00`);
}

const localDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/, 'Enter a date and time.')
  .transform(fromLocalInput);
const optionalLocalDate = z
  .union([z.literal(''), localDate])
  .optional()
  .transform((v) => (v ? v : null));

const slugField = z
  .string()
  .max(80)
  .optional()
  .transform((s) => slugify(s ?? ''));

// ---------- posts ----------

export const PostSchema = z.object({
  title: z.string().min(2, 'Enter a title.').max(200),
  slug: slugField,
  excerpt: optionalText(5000),
  bodyMd: z.string().max(100_000).default(''),
  authorNames: z.array(z.string().max(120)).default([]),
  authorRoles: z.array(z.string().max(120)).default([]),
  authorUrls: z.array(z.string().max(500)).default([]),
  attachmentsJson: z.string().max(100_000).optional(),
  publishedAt: optionalLocalDate,
  status: z.enum(['draft', 'published']),
  categoryIds: z.array(z.coerce.number().int()).default([]),
});

/** Author rows from the post form (parallel name / role / link fields); empty rows are dropped. */
export function formAuthors(names: string[], roles: string[], urls: string[]) {
  const authors: PostAuthor[] = [];
  let error: string | undefined;
  names.forEach((raw, i) => {
    const name = raw.trim();
    if (!name) return;
    const role = roles[i]?.trim();
    const url = optionalUrl(500).safeParse(urls[i]?.trim() ?? '');
    if (!url.success) error = `Enter a valid link for ${name}.`;
    authors.push({
      name,
      ...(role ? { role } : {}),
      ...(url.success && url.data ? { url: url.data } : {}),
    });
  });
  return { authors, error };
}

const AttachmentList = z
  .array(
    z.object({
      name: z.string().min(1).max(200),
      key: z.string().regex(/^(posts\/)?files\/[^/]+$/),
      size: z.number().int().nonnegative().optional(),
    }),
  )
  .max(200);

/** The attachment list the post editor keeps in a hidden field; null when missing or invalid. */
export function parseAttachments(json: string | undefined): Attachment[] | null {
  if (!json) return null;
  try {
    const parsed = AttachmentList.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

// ---------- events ----------

const optionalInt = z
  .union([z.literal(''), z.coerce.number().int().min(0).max(100_000)])
  .optional()
  .transform((v) => (v === '' || v === undefined ? null : v));

export const EventSchema = z
  .object({
    title: z.string().min(2, 'Enter a title.').max(200),
    slug: slugField,
    series: z.string().min(1).max(60).default('Other'),
    summary: optionalText(5000),
    bodyMd: z.string().max(50_000).default(''),
    startsAt: localDate,
    endsAt: optionalLocalDate,
    venue: optionalText(200),
    address: optionalText(1000),
    mapUrl: optionalUrl(4000),
    capacity: optionalInt,
    registrationOpen: z.boolean().optional().default(false),
    registrationOpensAt: optionalLocalDate,
    registrationClosesAt: optionalLocalDate,
    memberEarlyDays: optionalInt.transform((v) => v ?? 0),
    memberReservedSeats: optionalInt.transform((v) => v ?? 0),
    status: z.enum(['draft', 'published', 'cancelled']),
  })
  .refine((e) => !e.endsAt || e.endsAt > e.startsAt, {
    path: ['endsAt'],
    message: 'The end must be after the start.',
  });

/** Slug unique within a table (posts or events), ignoring the row being edited. */
export async function uniqueContentSlug(
  table: typeof posts | typeof events,
  base: string,
  exceptId?: number,
) {
  const db = getDb();
  let slug = base || 'untitled';
  for (let i = 2; ; i++) {
    const where = exceptId
      ? and(eq(table.slug, slug), ne(table.id, exceptId))
      : eq(table.slug, slug);
    const [hit] = await db.select({ id: table.id }).from(table).where(where).limit(1);
    if (!hit) return slug;
    slug = `${base}-${i}`;
  }
}

// ---------- organisations ----------

export const AdminOrgExtras = z.object({
  slug: slugField,
  status: z.enum(['unverified', 'pending', 'published', 'rejected', 'expired', 'hidden']),
  badges: z.array(z.enum(['member', 'sponsor', 'board', 'institutional'])).default([]),
  memberStatus: z.enum(['none', 'applied', 'member', 'lapsed']),
  renewalDueAt: optionalLocalDate,
  ownerEmails: z.array(z.email('Owner emails must be valid addresses.')).max(5).default([]),
});

/** Sends the owner(s) their links after a moderator gave them access. */
async function sendOwnerWelcome(org: Organisation, to: string) {
  const confirm = await issueToken('confirm', to, { orgId: org.id });
  const w = await renderTemplate('directory.claim-approved', { org: org.name });
  await sendEmail({
    to,
    subject: w.subject,
    paragraphs: w.paragraphs,
    action: { label: w.buttonLabel, url: siteUrl('/ecosystem/manage') },
    links: [
      { label: 'Confirm it is accurate', url: siteUrl(`/ecosystem/confirm?token=${confirm}`) },
      { label: 'See the listing', url: siteUrl(`/ecosystem/${org.slug}`) },
    ],
  });
}

export async function decideChange(id: number, approve: boolean, reason: string, actor: string) {
  const db = getDb();
  const [change] = await db
    .update(orgChanges)
    .set({
      status: approve ? 'approved' : 'rejected',
      reason: reason || null,
      decidedAt: new Date(),
    })
    .where(and(eq(orgChanges.id, id), eq(orgChanges.status, 'pending')))
    .returning();
  if (!change) return;
  const org = await orgById(change.orgId);
  if (!org) return;
  if (approve) {
    await db
      .update(organisations)
      .set({ ...(change.changes as Partial<Organisation>), updatedAt: new Date() })
      .where(eq(organisations.id, org.id));
  }
  const before = Object.fromEntries(
    Object.keys(change.changes).map((k) => [k, (org as unknown as Record<string, unknown>)[k]]),
  );
  await audit(
    actor,
    approve ? 'change_approve' : 'change_reject',
    'organisation',
    org.id,
    before,
    approve ? change.changes : { reason },
  );
  const w = await renderTemplate(
    approve ? 'directory.change-approved' : 'directory.change-rejected',
    { org: org.name, reason: reason || NO_REASON },
  );
  await sendEmail({
    to: change.email,
    subject: w.subject,
    paragraphs: w.paragraphs,
    action: {
      label: w.buttonLabel,
      url: approve ? siteUrl(`/ecosystem/${org.slug}`) : siteUrl('/ecosystem/manage'),
    },
  });
}

export async function decideClaim(id: number, approve: boolean, reason: string, actor: string) {
  const db = getDb();
  const [claim] = await db
    .update(claims)
    .set({
      status: approve ? 'approved' : 'rejected',
      reason: reason || null,
      decidedAt: new Date(),
    })
    .where(and(eq(claims.id, id), eq(claims.status, 'pending')))
    .returning();
  if (!claim) return;
  const org = await orgById(claim.orgId);
  if (!org) return;
  if (approve) {
    const owners = [...new Set([...org.ownerEmails, claim.email.toLowerCase()])];
    // A claimed listing starts its yearly cycle now (seeded listings had none).
    const dates = org.renewalDueAt ? {} : renewalDates(new Date());
    await db
      .update(organisations)
      .set({ ownerEmails: owners, ...dates, updatedAt: new Date() })
      .where(eq(organisations.id, org.id));
    await audit(
      actor,
      'claim_approve',
      'organisation',
      org.id,
      { ownerEmails: org.ownerEmails },
      {
        ownerEmails: owners,
      },
    );
    await sendOwnerWelcome({ ...org, ownerEmails: owners }, claim.email);
  } else {
    await audit(actor, 'claim_reject', 'organisation', org.id, null, {
      email: claim.email,
      reason,
    });
    const w = await renderTemplate('directory.claim-rejected', {
      org: org.name,
      reason: reason || NO_REASON,
    });
    await sendEmail({ to: claim.email, subject: w.subject, paragraphs: w.paragraphs });
  }
}

export async function decideMembership(
  id: number,
  approve: boolean,
  reason: string,
  actor: string,
) {
  const db = getDb();
  const [app] = await db
    .update(membershipApplications)
    .set({
      status: approve ? 'approved' : 'rejected',
      reason: reason || null,
      decidedAt: new Date(),
    })
    .where(and(eq(membershipApplications.id, id), eq(membershipApplications.status, 'pending')))
    .returning();
  if (!app) return;
  const org = await orgById(app.orgId);
  if (!org) return;
  const badges = approve
    ? [...new Set([...org.badges, 'member'])]
    : org.badges.filter((b) => b !== 'member');
  await db
    .update(organisations)
    .set({
      memberStatus: approve ? 'member' : 'none',
      memberSince: approve ? new Date() : org.memberSince,
      badges,
      updatedAt: new Date(),
    })
    .where(eq(organisations.id, org.id));
  await audit(actor, approve ? 'member_approve' : 'member_reject', 'organisation', org.id, null, {
    reason: reason || undefined,
  });
  const w = await renderTemplate(approve ? 'membership.approved' : 'membership.rejected', {
    org: org.name,
    reason: reason || NO_REASON,
  });
  await sendEmail({
    to: app.email,
    subject: w.subject,
    paragraphs: w.paragraphs,
    action: { label: w.buttonLabel, url: siteUrl(`/ecosystem/${org.slug}`) },
  });
}

/** Invites someone (e.g. a founder we know) to claim an unclaimed listing. */
export async function inviteToClaim(org: Organisation, to: string, actor: string) {
  const w = await renderTemplate('directory.claim-invite', { org: org.name });
  await sendEmail({
    to,
    subject: w.subject,
    paragraphs: w.paragraphs,
    action: { label: w.buttonLabel, url: siteUrl(`/ecosystem/${org.slug}/claim`) },
    links: [{ label: 'See the listing', url: siteUrl(`/ecosystem/${org.slug}`) }],
  });
  await audit(actor, 'invite_claim', 'organisation', org.id, null, { to });
}
