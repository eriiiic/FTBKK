// Free individual membership: sign up on /join, confirm by email, then a member page reached by
// email links (no passwords). Members are active as soon as they confirm; the board reviews new
// members afterwards and can suspend them. See docs/admin.md.
import { z } from 'zod';
import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm';
import { getDb } from '../db';
import { contacts, events, members, registrations, type Member } from '../db/schema';
import { email, optionalText, optionalUrl } from './forms';
import { SECTORS } from './directory';
import { HOW_HEARD } from './registrations';
import { consumeToken, issueToken, peekToken } from './tokens';
import { sendEmail } from './email';
import { renderTemplate } from './email-templates';
import { audit, siteUrl } from './orgs';
import { confirmNewsletter } from './newsletter';
import { getSettings } from './settings';
import { upcomingEvents } from './queries';
import { formatDate, formatEventDate } from './format';
import { DAY_MS } from './lifecycle';
import { loadTeam } from './ownership';

export const PROFILE_TYPES = {
  founder: 'Founder or co-founder',
  employee: 'Working at a startup or tech company',
  investor: 'Investor',
  corporate: 'Corporate or large company',
  public: 'Public institution or chamber',
  freelancer: 'Freelancer or consultant',
  student: 'Student',
  other: 'Other',
} as const;
export type ProfileType = keyof typeof PROFILE_TYPES;
const PROFILE_KEYS = Object.keys(PROFILE_TYPES) as [ProfileType, ...ProfileType[]];

/** For the board's reporting only; never shown publicly. */
export const NATIONALITY_GROUPS = {
  french: 'French or francophone',
  thai: 'Thai',
  other: 'Other',
} as const;
type Nationality = keyof typeof NATIONALITY_GROUPS;
const NATIONALITY_KEYS = Object.keys(NATIONALITY_GROUPS) as [Nationality, ...Nationality[]];

export const MEMBER_STATUSES = {
  pending: 'Email not confirmed',
  active: 'Active',
  suspended: 'Suspended',
  lapsed: 'Lapsed',
} as const;
export type MemberStatus = keyof typeof MEMBER_STATUSES;

/** Membership is confirmed once a year (the yearly reminder comes with the renewals phase). */
export const MEMBERSHIP_DAYS = 365;
export const renewalDate = (from: Date) => new Date(from.getTime() + MEMBERSHIP_DAYS * DAY_MS);

const checkbox = z
  .union([z.literal('on'), z.literal('true'), z.boolean()])
  .optional()
  .transform((v) => v === 'on' || v === 'true' || v === true);

/** What a member can edit on their page. */
export const MemberProfileSchema = z.object({
  name: z.string().trim().min(2, 'Tell us your name.').max(120),
  phone: optionalText(40),
  company: optionalText(120),
  jobTitle: optionalText(120),
  linkedin: optionalUrl(),
  profileType: z.enum(PROFILE_KEYS, { error: 'Choose what describes you best.' }),
  nationality: z
    .union([z.literal(''), z.enum(NATIONALITY_KEYS)])
    .optional()
    .transform((v) => v || null),
  interests: z
    .array(z.enum(SECTORS))
    .max(5, 'Pick up to 5 sectors.')
    .optional()
    .transform((v) => v ?? []),
});
export type MemberProfile = z.infer<typeof MemberProfileSchema>;

/** The sign-up form on /join. */
export const MemberSignupSchema = MemberProfileSchema.extend({
  email,
  howHeard: z
    .union([z.literal(''), z.enum(HOW_HEARD as [string, ...string[]])])
    .optional()
    .transform((v) => v || null),
  terms: z.literal(true, {
    error: 'Please accept the code of conduct and the privacy notice to join.',
  }),
  newsletter: z.boolean().optional().default(false),
});
export type MemberSignup = z.infer<typeof MemberSignupSchema>;

/** Form values (checkboxes arrive as "on") to schema input. */
export function signupInput(values: Record<string, unknown>) {
  return {
    ...values,
    terms: checkbox.parse(values.terms),
    newsletter: checkbox.parse(values.newsletter),
  };
}

export const memberPagePath = (token: string) => `/member?token=${encodeURIComponent(token)}`;

export async function memberByEmail(address: string) {
  const [m] = await getDb().select().from(members).where(eq(members.email, address.toLowerCase()));
  return m ?? null;
}

/**
 * A sign-up from /join. New, unconfirmed and lapsed people get a confirmation link; an active or
 * suspended member gets their member page link instead. The page shows the same answer either
 * way, so it doesn't reveal who is a member.
 */
export async function requestMembership(data: MemberSignup, now = new Date()) {
  const db = getDb();
  const existing = await memberByEmail(data.email);
  if (existing && (existing.status === 'active' || existing.status === 'suspended')) {
    await sendMemberLink(existing, true);
    return 'link' as const;
  }
  const { terms: _terms, newsletter, ...profile } = data;
  const row = {
    ...profile,
    newsletterRequested: newsletter,
    termsAcceptedAt: now,
    updatedAt: now,
  };
  const [saved] = existing
    ? await db.update(members).set(row).where(eq(members.id, existing.id)).returning()
    : await db.insert(members).values(row).returning();
  const token = await issueToken('member_confirm', data.email, { refId: saved!.id, now });
  const w = await renderTemplate('member.confirm', { name: data.name });
  await sendEmail({
    to: data.email,
    subject: w.subject,
    paragraphs: w.paragraphs,
    action: {
      label: w.buttonLabel,
      url: siteUrl(`/member/confirm?token=${encodeURIComponent(token)}`),
    },
    footer: 'The link works for 7 days.',
  });
  return 'confirm' as const;
}

/**
 * Confirms a membership from the email link: the member becomes active (a lapsed one starts a
 * new year), their newsletter choice is recorded, and they get the welcome email. Returns the
 * member and a link token to their page, or null when the link is not valid any more.
 */
export async function confirmMembership(token: string, now = new Date()) {
  const row = await consumeToken(token, 'member_confirm', now);
  if (!row?.ref_id) return null;
  const db = getDb();
  const [m] = await db.select().from(members).where(eq(members.id, row.ref_id));
  if (!m || m.email !== row.email || m.status === 'suspended') return null;
  const fresh = m.status !== 'active';
  const [updated] = await db
    .update(members)
    .set({
      status: 'active',
      confirmedAt: now,
      memberSince: m.memberSince ?? now,
      renewalDueAt: fresh || !m.renewalDueAt ? renewalDate(now) : m.renewalDueAt,
      updatedAt: now,
    })
    .where(eq(members.id, m.id))
    .returning();
  // A contact card, so members show in Contacts and My data even before their first event (an
  // existing card, which the team may have edited, is left alone).
  await db
    .insert(contacts)
    .values({
      email: m.email,
      name: m.name,
      phone: m.phone,
      company: m.company,
      role: m.jobTitle,
      linkedin: m.linkedin,
    })
    .onConflictDoNothing({ target: contacts.email });
  if (m.newsletterRequested) await confirmNewsletter(m.email, m.name, now);
  await audit('self-service', 'member_confirm', 'member', m.id, { status: m.status }, null);
  const link = await issueToken('member', m.email, { refId: m.id, now });
  if (fresh) await sendWelcome(updated!, link);
  return { member: updated!, link };
}

async function sendWelcome(m: Member, link: string) {
  const [settings, next] = await Promise.all([getSettings(), upcomingEvents(3)]);
  const whatsapp = settings.socials.whatsapp;
  const w = await renderTemplate('member.welcome', {
    name: m.name,
    whatsapp: whatsapp
      ? `Join the members' WhatsApp community, where we share events, jobs, questions and introductions: ${whatsapp}`
      : '',
    'next-events': next.length
      ? [
          'Coming up next:',
          ...next.map(
            (e) =>
              `${e.title}, ${formatEventDate(e.startsAt, e.endsAt)}: ${siteUrl(`/events/${e.slug}`)}`,
          ),
        ]
      : [],
  });
  await sendEmail({
    to: m.email,
    subject: w.subject,
    paragraphs: w.paragraphs,
    action: { label: w.buttonLabel, url: siteUrl(memberPagePath(link)) },
    links: whatsapp ? [{ label: 'Join the WhatsApp community', url: whatsapp }] : undefined,
  });
}

/**
 * The team marks a contact as a member (the Member box on a contact's Edit form): they become an
 * active, already reviewed member, with the details from their contact card. Unticking ends an
 * active membership (an unconfirmed sign-up is left alone). Suspended and lapsed memberships are changed in Members, not here. With
 * `welcome`, a new member gets the welcome email (WhatsApp invitation and member page link).
 */
export async function setMembershipByTeam(
  person: {
    email: string;
    name: string;
    phone: string | null;
    company: string | null;
    role: string | null;
    linkedin: string | null;
  },
  on: boolean,
  actor: string,
  welcome = false,
  now = new Date(),
) {
  const db = getDb();
  const existing = await memberByEmail(person.email);
  if (existing && (existing.status === 'suspended' || existing.status === 'lapsed')) return;
  if (!on) {
    // An unconfirmed sign-up stays: it is theirs to confirm.
    if (existing?.status === 'active') await deleteMembers([existing.id], actor);
    return;
  }
  if (existing?.status === 'active') return;
  const set = {
    status: 'active' as const,
    memberSince: existing?.memberSince ?? now,
    renewalDueAt: renewalDate(now),
    reviewedAt: now,
    reviewedBy: actor,
    updatedAt: now,
  };
  const [m] = existing
    ? await db.update(members).set(set).where(eq(members.id, existing.id)).returning()
    : await db
        .insert(members)
        .values({
          ...set,
          email: person.email,
          name: person.name,
          phone: person.phone,
          company: person.company,
          jobTitle: person.role,
          linkedin: person.linkedin,
          termsAcceptedAt: now,
          notes: `Added by the team from Contacts (${actor}).`,
        })
        .returning();
  await audit(actor, 'member_add', 'member', m!.id, existing ? { status: existing.status } : null, {
    status: 'active',
  });
  if (welcome) await sendWelcome(m!, await issueToken('member', m!.email, { refId: m!.id, now }));
}

/** A contact's email changed: their membership follows, unless the new email has one. */
export async function moveMembership(from: string, to: string) {
  if (from === to || (await memberByEmail(to))) return;
  await getDb()
    .update(members)
    .set({ email: to, updatedAt: new Date() })
    .where(eq(members.email, from));
}

/** Emails a link to the member page (from "Send me my link", or a repeat sign-up). */
export async function sendMemberLink(m: Member, repeat = false) {
  const token = await issueToken('member', m.email, { refId: m.id });
  const w = await renderTemplate(repeat ? 'member.already-member' : 'member.link', {
    name: m.name,
  });
  await sendEmail({
    to: m.email,
    subject: w.subject,
    paragraphs: w.paragraphs,
    action: { label: w.buttonLabel, url: siteUrl(memberPagePath(token)) },
    footer: 'The link works for 30 days.',
  });
}

/** The member a page link belongs to (the link must still be valid). */
export async function memberForLink(token: string | null, now = new Date()) {
  if (!token || token.length > 100) return null;
  const row = await peekToken(token, 'member', now);
  if (!row?.ref_id) return null;
  const [m] = await getDb()
    .select()
    .from(members)
    .where(and(eq(members.id, row.ref_id), eq(members.email, row.email)));
  return m ?? null;
}

export async function updateProfile(m: Member, profile: MemberProfile, now = new Date()) {
  await getDb()
    .update(members)
    .set({ ...profile, updatedAt: now })
    .where(eq(members.id, m.id));
  await audit('self-service', 'member_update', 'member', m.id, null, null);
}

/** Leaving the membership deletes the member row (event history stays, see /my-data). */
export async function deleteMembers(ids: number[], actor: string) {
  if (!ids.length) return 0;
  const gone = await getDb()
    .delete(members)
    .where(inArray(members.id, ids))
    .returning({ id: members.id });
  for (const g of gone)
    await audit(
      actor.startsWith('self-service:') ? 'self-service' : actor,
      'member_delete',
      'member',
      g.id,
      null,
      null,
    );
  return gone.length;
}

/** A member's events, newest first. */
export async function memberEvents(address: string) {
  return getDb()
    .select({
      title: events.title,
      slug: events.slug,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      status: registrations.status,
    })
    .from(registrations)
    .innerJoin(events, eq(events.id, registrations.eventId))
    .where(eq(registrations.email, address))
    .orderBy(desc(events.startsAt));
}

// ---------- admin ----------

export const MemberAdminAction = z.discriminatedUnion('action', [
  z.object({
    action: z.enum(['review', 'reactivate', 'delete', 'link']),
    ids: z.array(z.coerce.number().int().positive()).min(1).max(500),
  }),
  z.object({
    action: z.literal('suspend'),
    ids: z.array(z.coerce.number().int().positive()).min(1).max(500),
    reason: z.string().trim().min(3, 'Write a short reason for the team.').max(500),
  }),
  z.object({
    action: z.literal('notes'),
    ids: z.array(z.coerce.number().int().positive()).length(1),
    notes: z
      .string()
      .trim()
      .max(4000)
      .transform((s) => s || null),
  }),
]);

/** Applies an admin action; returns the confirmation shown on the page. */
export async function applyMemberAction(
  input: z.infer<typeof MemberAdminAction>,
  actor: string,
  now = new Date(),
) {
  const db = getDb();
  const n = input.ids.length;
  const what = `${n} member${n === 1 ? '' : 's'}`;
  const where = inArray(members.id, input.ids);
  switch (input.action) {
    case 'review':
      await db
        .update(members)
        .set({ reviewedAt: now, reviewedBy: actor, updatedAt: now })
        .where(where);
      break;
    case 'suspend':
      await db
        .update(members)
        .set({
          status: 'suspended',
          suspendedReason: input.reason,
          reviewedAt: now,
          reviewedBy: actor,
          updatedAt: now,
        })
        .where(where);
      break;
    case 'reactivate':
      await db
        .update(members)
        .set({ status: 'active', suspendedReason: null, updatedAt: now })
        .where(and(where, eq(members.status, 'suspended')));
      break;
    case 'notes':
      await db.update(members).set({ notes: input.notes, updatedAt: now }).where(where);
      return 'Notes saved.';
    case 'link': {
      const rows = await db.select().from(members).where(where);
      for (const m of rows) if (m.status !== 'pending') await sendMemberLink(m);
      return `Member page link sent to ${what} (not to unconfirmed ones).`;
    }
    case 'delete':
      return `${await deleteMembers(input.ids, actor)} member${n === 1 ? '' : 's'} deleted.`;
  }
  for (const id of input.ids)
    await audit(actor, `member_${input.action}`, 'member', id, null, null);
  return {
    review: `${what} marked as reviewed.`,
    suspend: `${what} suspended.`,
    reactivate: `${what} reactivated.`,
  }[input.action];
}

/** Active members the board has not reviewed yet, oldest first. */
export async function membersToReview() {
  return getDb()
    .select()
    .from(members)
    .where(and(eq(members.status, 'active'), isNull(members.reviewedAt)))
    .orderBy(asc(members.confirmedAt));
}

/**
 * Monday: the board (team members with the Board role, or the contact email) gets the list of new
 * members to review. Returns 1 when sent.
 */
export async function sendBoardMemberDigest() {
  const todo = await membersToReview();
  if (!todo.length) return 0;
  const [team, settings] = await Promise.all([loadTeam(), getSettings()]);
  const board = team.filter((m) => m.roles.includes('board')).map((m) => m.email);
  const n = todo.length;
  const w = await renderTemplate('admin.new-members', {
    count: `${n} new member${n === 1 ? '' : 's'}`,
    members: [
      ...todo
        .slice(0, 30)
        .map(
          (m) =>
            `${m.name}${m.company ? `, ${m.company}` : ''} (${PROFILE_TYPES[m.profileType as ProfileType] ?? m.profileType}), joined ${formatDate(m.confirmedAt ?? m.createdAt, { year: undefined })}`,
        ),
      ...(n > 30 ? [`And ${n - 30} more.`] : []),
    ],
  });
  await sendEmail({
    to: board.length ? board : settings.contactEmail,
    subject: w.subject,
    paragraphs: w.paragraphs,
    action: { label: w.buttonLabel, url: siteUrl('/admin/members') },
  });
  return 1;
}
