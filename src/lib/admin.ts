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
  type Organisation,
} from '../db/schema';
import { optionalText, optionalUrl } from './forms';
import { slugify } from './format';
import { audit, orgById, siteUrl } from './orgs';
import { sendEmail } from './email';
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
  excerpt: optionalText(300),
  bodyMd: z.string().max(100_000).default(''),
  authorName: optionalText(120),
  authorRole: optionalText(120),
  publishedAt: optionalLocalDate,
  status: z.enum(['draft', 'published']),
  categoryIds: z.array(z.coerce.number().int()).default([]),
});

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
    summary: optionalText(300),
    bodyMd: z.string().max(50_000).default(''),
    startsAt: localDate,
    endsAt: optionalLocalDate,
    venue: optionalText(200),
    address: optionalText(300),
    mapUrl: optionalUrl,
    capacity: optionalInt,
    registrationOpen: z.boolean().optional().default(false),
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
  await sendEmail({
    to,
    subject: `You can now manage ${org.name} on La French Tech Bangkok`,
    paragraphs: [
      `Your request was approved: you can now update the ${org.name} listing in the French Tech Bangkok ecosystem directory.`,
      'Once a year we will ask you to confirm the listing is still accurate.',
    ],
    action: { label: 'Update the listing', url: siteUrl('/ecosystem/manage') },
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
  await sendEmail({
    to: change.email,
    subject: approve
      ? `Your changes to ${org.name} are live`
      : `Your changes to ${org.name} were not published`,
    paragraphs: approve
      ? [`A moderator approved your changes to ${org.name}. They are now visible in the directory.`]
      : [
          `A moderator could not publish your changes to ${org.name}:`,
          reason || 'No reason given.',
        ],
    action: approve
      ? { label: 'See the listing', url: siteUrl(`/ecosystem/${org.slug}`) }
      : { label: 'Update the listing', url: siteUrl('/ecosystem/manage') },
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
    await sendEmail({
      to: claim.email,
      subject: `Your request to manage ${org.name}`,
      paragraphs: [
        `We could not approve your request to manage ${org.name} in the French Tech Bangkok directory:`,
        reason || 'No reason given.',
        'Reply to this email if you think this is a mistake.',
      ],
    });
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
  await sendEmail({
    to: app.email,
    subject: approve
      ? `Welcome to La French Tech Bangkok, ${org.name}`
      : `Your membership application for ${org.name}`,
    paragraphs: approve
      ? [
          `The board approved ${org.name} as a member of La French Tech Bangkok. Your listing now shows the Member badge.`,
          'We will share member news and perks by email.',
        ]
      : [
          `The board could not approve the membership of ${org.name} for now:`,
          reason || 'No reason given.',
        ],
    action: { label: 'See the listing', url: siteUrl(`/ecosystem/${org.slug}`) },
  });
}

/** Invites someone (e.g. a founder we know) to claim an unclaimed listing. */
export async function inviteToClaim(org: Organisation, to: string, actor: string) {
  await sendEmail({
    to,
    subject: `${org.name} is listed in the French Tech Bangkok directory`,
    paragraphs: [
      `${org.name} is listed in the French Tech Bangkok ecosystem directory, but nobody manages the listing yet.`,
      'Claim it to keep it accurate: update the description, logo and links, and confirm it once a year. It is free.',
    ],
    action: { label: 'Claim the listing', url: siteUrl(`/ecosystem/${org.slug}/claim`) },
    links: [{ label: 'See the listing', url: siteUrl(`/ecosystem/${org.slug}`) }],
  });
  await audit(actor, 'invite_claim', 'organisation', org.id, null, { to });
}
