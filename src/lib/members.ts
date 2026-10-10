// Free individual membership: sign up on /join, confirm by email, then a member page reached by
// email links (no passwords). Members are active as soon as they confirm; the team looks at new
// members afterwards (Members > To review, never blocking) and can suspend them. See docs/admin.md.
import { z } from 'zod';
import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm';
import { getDb } from '../db';
import { contacts, events, members, registrations, type Event, type Member } from '../db/schema';
import { email, optionalText, optionalUrl } from './forms';
import { SECTORS } from './directory';
import {
  HOW_HEARD,
  cancelRegistration,
  registerForEvent,
  type RegisterOutcome,
} from './registrations';
import { consumeToken, issueToken, peekToken } from './tokens';
import { sendEmail, sendEmailBatch, type EmailMessage } from './email';
import {
  EMAIL_TEMPLATES,
  applyTemplate,
  loadTemplateText,
  renderTemplate,
} from './email-templates';
import { adminNotifyEmails, audit, siteUrl } from './orgs';
import { confirmNewsletter } from './newsletter';
import { getSettings } from './settings';
import { upcomingEvents } from './queries';
import { formatDate, formatEventDate } from './format';
import { loadContact, mainEmailFor, type Contact } from './contacts';
import { DAY_MS } from './lifecycle';

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

/**
 * The membership for this email, or for the contact who has it as one of their other emails (so
 * a member typing another of their emails is still recognised).
 */
export async function memberByEmail(address: string) {
  const db = getDb();
  const email = address.trim().toLowerCase();
  const [m] = await db.select().from(members).where(eq(members.email, email));
  if (m) return m;
  const main = await mainEmailFor(email);
  if (!main) return null;
  const [byMain] = await db.select().from(members).where(eq(members.email, main));
  return byMain ?? null;
}

/** A member's details as an event registration (members-only registration). */
export function memberRegistration(m: Member, note = '') {
  return {
    name: m.name,
    email: m.email,
    company: m.company ?? '',
    phone: m.phone ?? '',
    role: m.jobTitle ?? '',
    howHeard: m.howHeard ?? '',
    note,
    photoConsent: true as const,
    newsletter: false,
  };
}

/**
 * A sign-up from /join, or from an event page (`join`: the event they were registering for, and
 * their note), in which case confirming the email also registers them. New, unconfirmed and
 * lapsed people get a confirmation link; an active or suspended member gets their member page
 * link instead. The page shows the same answer either way, so it doesn't reveal who is a member.
 */
export async function requestMembership(
  data: MemberSignup,
  now = new Date(),
  join: { event: { id: number; title: string }; note: string } | null = null,
) {
  const db = getDb();
  // Typed one of a contact's other emails: the membership goes under their main email, and the
  // confirmation to the address they typed.
  const sendTo = data.email;
  data = { ...data, email: (await mainEmailFor(data.email)) ?? data.email };
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
    pendingEventId: join?.event.id ?? null,
    pendingNote: join?.note || null,
    updatedAt: now,
  };
  const [saved] = existing
    ? await db.update(members).set(row).where(eq(members.id, existing.id)).returning()
    : await db.insert(members).values(row).returning();
  const token = await issueToken('member_confirm', data.email, { refId: saved!.id, now });
  const w = join
    ? await renderTemplate('member.confirm-event', { name: data.name, event: join.event.title })
    : await renderTemplate('member.confirm', { name: data.name });
  await sendEmail({
    to: sendTo,
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
 * new year), their newsletter choice is recorded, and they get the welcome email. If they joined
 * while registering for an event, they are registered now (or told it closed). Returns the
 * member, a link token to their page and that registration, or null when the link is not valid
 * any more.
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
      renewalReminder: null,
      pendingEventId: null,
      pendingNote: null,
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
  let registration: { event: Event; outcome: RegisterOutcome } | null = null;
  if (m.pendingEventId) {
    const [event] = await db.select().from(events).where(eq(events.id, m.pendingEventId));
    if (event) {
      const settings = await getSettings();
      const outcome = await registerForEvent(
        event,
        memberRegistration(updated!, m.pendingNote ?? ''),
        {
          memberPriority: settings.memberPriority,
          now,
        },
      );
      registration = { event, outcome };
    }
  }
  // First membership only: renewals and lapsed members coming back don't notify the team.
  if (!m.memberSince)
    await notifyNewMember(updated!, registration?.event.title ?? null).catch((e) =>
      console.error('[email] new member notification', e),
    );
  return { member: updated!, link, registration };
}

/** Tells the admin notification addresses (Settings) that someone just became a member. */
export async function notifyNewMember(m: Member, event: string | null) {
  const w = await renderTemplate('admin.new-member', { name: m.name, email: m.email });
  const details: [string, string][] = [
    ['Company', m.company ?? '-'],
    ['Job title', m.jobTitle ?? '-'],
    ['Describes them', PROFILE_TYPES[m.profileType as ProfileType] ?? m.profileType],
    ['How they heard', m.howHeard ?? '-'],
  ];
  if (m.linkedin) details.push(['LinkedIn', m.linkedin]);
  if (event) details.push(['Registered for', event]);
  return sendEmail({
    to: await adminNotifyEmails(),
    replyTo: m.email,
    subject: w.subject,
    paragraphs: w.paragraphs,
    details,
    action: { label: w.buttonLabel, url: siteUrl('/admin/members') },
  });
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

/** Emails of active members (check-in's "Not a member" flag). */
export async function activeMemberEmails() {
  const rows = await getDb()
    .select({ email: members.email })
    .from(members)
    .where(eq(members.status, 'active'));
  return new Set(rows.map((r) => r.email));
}

/**
 * A walk-in who wants to become a member, enrolled at the door: they get the usual confirmation
 * email (they become a member when they click it). Nothing is sent to someone already active.
 * Returns true when the email went out.
 */
export async function enrolAtDoor(
  person: { email: string; name: string; phone: string | null; company: string | null },
  newsletter: boolean,
  actor: string,
  now = new Date(),
) {
  const existing = await memberByEmail(person.email);
  if (existing && existing.status !== 'pending' && existing.status !== 'lapsed') return false;
  await requestMembership(
    {
      email: person.email,
      name: person.name,
      phone: person.phone,
      company: person.company,
      jobTitle: existing?.jobTitle ?? null,
      linkedin: existing?.linkedin ?? null,
      profileType: (existing?.profileType as ProfileType | undefined) ?? 'other',
      interests: (existing?.interests ?? []) as MemberProfile['interests'],
      howHeard: existing?.howHeard ?? null,
      terms: true,
      newsletter,
    },
    now,
  );
  const m = await memberByEmail(person.email);
  if (m) await audit(actor, 'member_enrol_door', 'member', m.id, null, null);
  return true;
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
/** A member's email and the other emails on their contact card (see contacts.otherEmails). */
async function emailsOfMember(address: string) {
  const [card] = await getDb()
    .select({ otherEmails: contacts.otherEmails })
    .from(contacts)
    .where(eq(contacts.email, address));
  return [address, ...(card?.otherEmails ?? [])];
}

export async function memberEvents(address: string) {
  const emails = await emailsOfMember(address);
  return getDb()
    .select({
      id: registrations.id,
      title: events.title,
      slug: events.slug,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      status: registrations.status,
    })
    .from(registrations)
    .innerJoin(events, eq(events.id, registrations.eventId))
    .where(inArray(registrations.email, emails))
    .orderBy(desc(events.startsAt));
}

/**
 * A member cancels one of their registrations from their member page. Only their own, and only
 * before the event starts; the freed seat goes to the waitlist as with the email link.
 */
export async function memberCancel(member: Pick<Member, 'email'>, registrationId: number) {
  const [row] = await getDb()
    .select({ id: registrations.id, status: registrations.status, event: events })
    .from(registrations)
    .innerJoin(events, eq(events.id, registrations.eventId))
    .where(
      and(
        eq(registrations.id, registrationId),
        inArray(registrations.email, await emailsOfMember(member.email)),
      ),
    );
  if (!row || (row.status !== 'registered' && row.status !== 'waitlist')) return null;
  if (row.event.startsAt <= new Date()) return null;
  const settings = await getSettings();
  return (await cancelRegistration(row.event, row, settings.memberPriority)) ? row.event : null;
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

// ---------- claim campaign (Contacts > Invite to join) ----------

/** Someone invited less than this many days ago is not invited again. */
export const INVITE_AGAIN_DAYS = 30;

/**
 * "Claim your membership" invitations to selected contacts: each gets a link to a form prefilled
 * with what we know about them. Skipped: contacts without an email, members (any status), and
 * people invited in the last 30 days. The invitation date is kept on their contact card (created
 * from their latest details if they had none).
 */
export async function inviteToJoin(
  list: Pick<
    Contact,
    | 'key'
    | 'email'
    | 'name'
    | 'phone'
    | 'company'
    | 'role'
    | 'linkedin'
    | 'savedId'
    | 'member'
    | 'invitedAt'
  >[],
  actor: string,
  now = new Date(),
) {
  const db = getDb();
  const recent = now.getTime() - INVITE_AGAIN_DAYS * DAY_MS;
  const result = { sent: 0, noEmail: 0, members: 0, recent: 0 };
  const todo: typeof list = [];
  for (const c of list) {
    if (!c.email) result.noEmail++;
    else if (c.member) result.members++;
    else if (c.invitedAt && c.invitedAt.getTime() > recent) result.recent++;
    else todo.push(c);
  }
  const text = await loadTemplateText('member.claim');
  const messages: EmailMessage[] = [];
  for (const c of todo) {
    const token = await issueToken('member_claim', c.email!, { now });
    const w = applyTemplate(EMAIL_TEMPLATES['member.claim'], text, { name: c.name });
    messages.push({
      to: c.email!,
      subject: w.subject,
      paragraphs: w.paragraphs,
      action: {
        label: w.buttonLabel,
        url: siteUrl(`/member/claim?token=${encodeURIComponent(token)}`),
      },
      footer: 'The link works for 60 days.',
    });
  }
  const sent = await sendEmailBatch(messages);
  if (!sent.ok) throw new Error('The invitations could not be sent. Try again later.');
  for (const c of todo) {
    if (c.savedId)
      await db.update(contacts).set({ memberInvitedAt: now }).where(eq(contacts.id, c.savedId));
    else
      await db
        .insert(contacts)
        .values({
          email: c.email,
          name: c.name,
          phone: c.phone,
          company: c.company,
          role: c.role,
          linkedin: c.linkedin,
          memberInvitedAt: now,
        })
        .onConflictDoUpdate({ target: contacts.email, set: { memberInvitedAt: now } });
  }
  result.sent = todo.length;
  if (todo.length)
    await audit(actor, 'member_invite', 'contact', null, null, { count: todo.length });
  return result;
}

/** The email a claim link was sent to, or null when the link is not valid any more. */
export async function claimEmail(token: string, now = new Date()) {
  return (await peekToken(token, 'member_claim', now))?.email ?? null;
}

/** The event a "claim your membership" link also registers for (see inviteForEvent), if any. */
export async function claimEvent(token: string, now = new Date()) {
  const row = await peekToken(token, 'member_claim', now);
  if (!row?.ref_id) return null;
  const [event] = await getDb().select().from(events).where(eq(events.id, row.ref_id));
  return event ?? null;
}

/**
 * Someone we already know (past registrations or a contact card, under any of their emails) who
 * isn't an active or suspended member: they get a prefilled form instead of an empty one.
 */
export async function knownNonMember(address: string) {
  const c = await loadContact(address.trim().toLowerCase());
  if (!c?.email || (c.history.length === 0 && !c.savedId)) return null;
  if (c.member?.status === 'active' || c.member?.status === 'suspended') return null;
  return c;
}

/**
 * A known contact registers for an event while membership is open: we email the address they
 * typed a "claim your membership" link (60 days) for their main email, prefilled from what we
 * know; submitting it makes them a member and registers them for the event.
 */
export async function inviteForEvent(
  c: Pick<Contact, 'email' | 'name'>,
  sendTo: string,
  event: Pick<Event, 'id' | 'title'>,
  now = new Date(),
) {
  const token = await issueToken('member_claim', c.email!, { refId: event.id, now });
  const w = await renderTemplate('member.claim-event', { name: c.name, event: event.title });
  await sendEmail({
    to: sendTo,
    subject: w.subject,
    paragraphs: w.paragraphs,
    action: {
      label: w.buttonLabel,
      url: siteUrl(`/member/claim?token=${encodeURIComponent(token)}`),
    },
    footer: 'The link works for 60 days.',
  });
}

/**
 * Claims a membership from an invitation link: the email is proven by the link, so the member is
 * active at once and gets the welcome email. Returns a link token to their member page, or null
 * when the link is not valid any more (or the membership is suspended).
 */
export async function claimMembership(
  token: string,
  data: MemberSignup,
  now = new Date(),
  note = '',
): Promise<{
  link: string;
  registration: { event: Event; outcome: RegisterOutcome } | null;
} | null> {
  const row = await consumeToken(token, 'member_claim', now);
  if (!row) return null;
  const db = getDb();
  const existing = await memberByEmail(row.email);
  if (existing?.status === 'suspended') return null;
  // Sent from an event's registration box: register them once they are members.
  const register = async (m: Member) => {
    if (!row.ref_id) return null;
    const [event] = await db.select().from(events).where(eq(events.id, row.ref_id));
    if (!event) return null;
    const settings = await getSettings();
    const outcome = await registerForEvent(event, memberRegistration(m, note), {
      memberPriority: settings.memberPriority,
      now,
    });
    return { event, outcome };
  };
  if (existing?.status === 'active')
    return {
      link: await issueToken('member', existing.email, { refId: existing.id, now }),
      registration: await register(existing),
    };
  const { terms: _terms, newsletter, email: _email, ...profile } = data;
  const set = {
    ...profile,
    status: 'active' as const,
    newsletterRequested: newsletter,
    termsAcceptedAt: now,
    confirmedAt: now,
    memberSince: existing?.memberSince ?? now,
    renewalDueAt: renewalDate(now),
    renewalReminder: null,
    updatedAt: now,
  };
  const [m] = existing
    ? await db.update(members).set(set).where(eq(members.id, existing.id)).returning()
    : await db
        .insert(members)
        .values({ ...set, email: row.email })
        .returning();
  if (newsletter) await confirmNewsletter(m!.email, m!.name, now);
  await audit('self-service', 'member_claim', 'member', m!.id, null, null);
  const link = await issueToken('member', m!.email, { refId: m!.id, now });
  await sendWelcome(m!, link);
  return { link, registration: await register(m!) };
}

// ---------- yearly reconfirmation ----------

/** Reminders this many days before the membership year ends. */
export const RENEWAL_REMINDER_DAYS = [30, 7] as const;

async function sendRenewalEmail(m: Member, key: 'member.renewal' | 'member.lapsed', now: Date) {
  const token = await issueToken('member_renew', m.email, { refId: m.id, now });
  const w = await renderTemplate(key, {
    name: m.name,
    due: m.renewalDueAt ? formatDate(m.renewalDueAt) : '',
  });
  await sendEmail({
    to: m.email,
    subject: w.subject,
    paragraphs: w.paragraphs,
    action: {
      label: w.buttonLabel,
      url: siteUrl(`/member/renew?token=${encodeURIComponent(token)}`),
    },
    footer: 'The link works for 60 days.',
  });
}

/**
 * Which yearly reminder is due for a membership ending on `due`, as stored in renewal_reminder
 * ("30:2027-10-03"), or null when none is (too early, or already sent). One email per step; a
 * 7-day reminder makes a missed 30-day one moot, and a new due date starts over.
 */
export function renewalReminderDue(due: Date, now: Date, last: string | null) {
  const daysLeft = (due.getTime() - now.getTime()) / DAY_MS;
  if (daysLeft <= 0) return null;
  const step = [...RENEWAL_REMINDER_DAYS].reverse().find((d) => daysLeft <= d);
  if (!step) return null;
  const day = due.toISOString().slice(0, 10);
  const [sentStep, sentDay] = last?.split(':') ?? [];
  if (sentDay === day && Number(sentStep) <= step) return null;
  return `${step}:${day}`;
}

/**
 * Daily: active members get a reminder 30 and 7 days before their year ends (once each, tracked
 * in renewal_reminder), and members whose year has ended become lapsed with one last email.
 */
export async function runMemberRenewals(now = new Date()) {
  const db = getDb();
  const active = await db
    .select()
    .from(members)
    .where(and(eq(members.status, 'active'), isNotNull(members.renewalDueAt)));
  let reminded = 0;
  let lapsed = 0;
  for (const m of active) {
    const due = m.renewalDueAt!;
    if (due.getTime() <= now.getTime()) {
      await db
        .update(members)
        .set({ status: 'lapsed', updatedAt: now })
        .where(and(eq(members.id, m.id), eq(members.status, 'active')));
      await audit('cron', 'member_lapsed', 'member', m.id, null, null);
      await sendRenewalEmail(m, 'member.lapsed', now);
      lapsed++;
      continue;
    }
    const kind = renewalReminderDue(due, now, m.renewalReminder);
    if (!kind) continue;
    await db.update(members).set({ renewalReminder: kind }).where(eq(members.id, m.id));
    await sendRenewalEmail(m, 'member.renewal', now);
    reminded++;
  }
  return { reminded, lapsed };
}

/** The member a renewal link belongs to, or null when the link is not valid any more. */
export async function memberForRenewal(token: string, now = new Date()) {
  const row = await peekToken(token, 'member_renew', now);
  if (!row?.ref_id) return null;
  const [m] = await getDb()
    .select()
    .from(members)
    .where(and(eq(members.id, row.ref_id), eq(members.email, row.email)));
  return m ?? null;
}

/**
 * Another year from today (or from the current due date, if that is later). Used by the one-click
 * link in the reminder and lapsed emails, and by the Renew button on a lapsed member's page.
 */
export async function renewMember(m: Member, now = new Date()) {
  const from = m.renewalDueAt && m.renewalDueAt > now ? m.renewalDueAt : now;
  await getDb()
    .update(members)
    .set({
      status: 'active',
      confirmedAt: now,
      renewalDueAt: renewalDate(from),
      renewalReminder: null,
      updatedAt: now,
    })
    .where(eq(members.id, m.id));
  await audit('self-service', 'member_renew', 'member', m.id, { status: m.status }, null);
}

/** One click from a reminder or the lapsed email. A suspended member can't renew. */
export async function renewMembership(token: string, now = new Date()) {
  const row = await consumeToken(token, 'member_renew', now);
  if (!row?.ref_id) return null;
  const [m] = await getDb()
    .select()
    .from(members)
    .where(and(eq(members.id, row.ref_id), eq(members.email, row.email)));
  if (!m || m.status === 'suspended' || m.status === 'pending') return null;
  await renewMember(m, now);
  return issueToken('member', m.email, { refId: m.id, now });
}
