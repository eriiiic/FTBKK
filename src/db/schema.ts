import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

const id = () => integer('id').primaryKey({ autoIncrement: true });
const ts = (name: string) => integer(name, { mode: 'timestamp' });
const createdAt = () =>
  ts('created_at')
    .notNull()
    .default(sql`(unixepoch())`);
const updatedAt = () =>
  ts('updated_at')
    .notNull()
    .default(sql`(unixepoch())`);
const json = <T>(name: string) => text(name, { mode: 'json' }).$type<T>();

// ---------- events ----------

/** A recap photo: an R2 key, with optional alt text / caption. */
export interface RecapPhoto {
  key: string;
  alt?: string;
}
/** Slides after the talk: an uploaded PDF (key) or a link elsewhere (url). */
export interface RecapSlide {
  label: string;
  key?: string;
  url?: string;
}
/** What happened at a past event, shown on its page. */
export interface EventRecap {
  photos: RecapPhoto[];
  slides: RecapSlide[];
  videoUrl?: string | null;
  /** The blog write-up. */
  postId?: number | null;
}

export const events = sqliteTable(
  'events',
  {
    id: id(),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    series: text('series').notNull().default('Other'),
    summary: text('summary'),
    bodyMd: text('body_md').notNull().default(''),
    startsAt: ts('starts_at').notNull(),
    endsAt: ts('ends_at'),
    timezone: text('timezone').notNull().default('Asia/Bangkok'),
    venue: text('venue'),
    address: text('address'),
    mapUrl: text('map_url'),
    coverKey: text('cover_key'),
    /** null = unlimited */
    capacity: integer('capacity'),
    registrationOpen: integer('registration_open', { mode: 'boolean' }).notNull().default(true),
    /** null = open as soon as the event is published. Members may start memberEarlyDays before. */
    registrationOpensAt: ts('registration_opens_at'),
    registrationClosesAt: ts('registration_closes_at'),
    /** Member priority (stage 3): members may register this many days before everyone else. */
    memberEarlyDays: integer('member_early_days').notNull().default(0),
    /** Member priority (stage 3): seats held back for members until registration closes. */
    memberReservedSeats: integer('member_reserved_seats').notNull().default(0),
    status: text('status', { enum: ['draft', 'published', 'cancelled'] })
      .notNull()
      .default('draft'),
    /** Photos, slides, video and blog write-up of a past event; null = no recap yet. */
    recap: json<EventRecap>('recap'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('events_starts_at').on(t.startsAt)],
);

export const registrations = sqliteTable(
  'registrations',
  {
    id: id(),
    eventId: integer('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    // Null only for walk-ins added at the door without an email.
    email: text('email'),
    company: text('company'),
    phone: text('phone'),
    role: text('role'),
    howHeard: text('how_heard'),
    /** Optional free text: "Anything we should know, or something you're looking for?" */
    note: text('note'),
    photoConsent: integer('photo_consent', { mode: 'boolean' }).notNull().default(false),
    /** Ticked "Send me the newsletter" (opt-in, unticked by default). */
    newsletterConsent: integer('newsletter_consent', { mode: 'boolean' }).notNull().default(false),
    /** When they answered the newsletter question; null when it was never asked (Wix imports). */
    newsletterConsentAt: ts('newsletter_consent_at'),
    walkIn: integer('walk_in', { mode: 'boolean' }).notNull().default(false),
    status: text('status', { enum: ['registered', 'waitlist', 'cancelled', 'attended'] })
      .notNull()
      .default('registered'),
    token: text('token').notNull().unique(),
    createdAt: createdAt(),
    checkedInAt: ts('checked_in_at'),
    reminderSentAt: ts('reminder_sent_at'),
    /** When the day-after feedback email went out (src/lib/cron-events.ts). */
    feedbackSentAt: ts('feedback_sent_at'),
  },
  (t) => [
    uniqueIndex('registrations_event_email').on(t.eventId, t.email),
    index('registrations_event_status').on(t.eventId, t.status),
  ],
);

/** Day-after feedback: one rating (1 to 5) and an optional comment per registration. */
export const eventFeedback = sqliteTable(
  'event_feedback',
  {
    id: id(),
    registrationId: integer('registration_id')
      .notNull()
      .unique()
      .references(() => registrations.id, { onDelete: 'cascade' }),
    eventId: integer('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    rating: integer('rating').notNull(),
    comment: text('comment'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('event_feedback_event').on(t.eventId)],
);

/** Messages an admin sent to an event's registrants from /admin/events/[id]/email. */
export const eventEmails = sqliteTable(
  'event_emails',
  {
    id: id(),
    eventId: integer('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    audience: text('audience', { enum: ['registered', 'attended', 'waitlist', 'all'] }).notNull(),
    subject: text('subject').notNull(),
    body: text('body').notNull(),
    actionLabel: text('action_label'),
    actionUrl: text('action_url'),
    /** How many emails went out. */
    recipients: integer('recipients').notNull(),
    sentBy: text('sent_by').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('event_emails_event').on(t.eventId)],
);

/**
 * A saved contact card. Contacts are built from registrations (see lib/contacts.ts); a row here
 * adds or overrides a person's details and notes, or records someone who never registered.
 */
export const contacts = sqliteTable('contacts', {
  id: id(),
  /** The main email, lowercased. Null for someone added without an email. */
  email: text('email').unique(),
  /** Their other emails (lowercased): registrations and sign-ups with these count as this person. */
  otherEmails: json<string[]>('other_emails').notNull().default([]),
  name: text('name').notNull(),
  phone: text('phone'),
  company: text('company'),
  role: text('role'),
  linkedin: text('linkedin'),
  notes: text('notes'),
  /** Tag keys from CONTACT_TAGS in lib/contacts.ts (speaker, sponsor, volunteer, board, press). */
  tags: json<string[]>('tags').notNull().default([]),
  /** Newsletter choice they told the team in person; null = go by their latest registration. */
  newsletter: text('newsletter', { enum: ['yes', 'no'] }),
  /** When they told us (see newsletter). */
  newsletterAt: ts('newsletter_at'),
  /** Last "claim your membership" invitation sent from Contacts. */
  memberInvitedAt: ts('member_invited_at'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
export type ContactRow = typeof contacts.$inferSelect;

// ---------- blog ----------

export interface Attachment {
  name: string;
  key: string;
  size?: number;
}

/** A post author; `url` is usually their LinkedIn profile. */
export interface PostAuthor {
  name: string;
  role?: string;
  url?: string;
}

export const posts = sqliteTable('posts', {
  id: id(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  excerpt: text('excerpt'),
  bodyMd: text('body_md').notNull().default(''),
  coverKey: text('cover_key'),
  authorName: text('author_name'),
  authorRole: text('author_role'),
  authors: json<PostAuthor[]>('authors').notNull().default([]),
  publishedAt: ts('published_at'),
  status: text('status', { enum: ['draft', 'published'] })
    .notNull()
    .default('draft'),
  attachments: json<Attachment[]>('attachments').notNull().default([]),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const categories = sqliteTable('categories', {
  id: id(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const postCategories = sqliteTable(
  'post_categories',
  {
    postId: integer('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    categoryId: integer('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.postId, t.categoryId] })],
);

// ---------- ecosystem directory ----------

export const organisations = sqliteTable(
  'organisations',
  {
    id: id(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    logoKey: text('logo_key'),
    coverKey: text('cover_key'),
    pitch: text('pitch'),
    descriptionMd: text('description_md').notNull().default(''),
    category: text('category', {
      enum: [
        'french_startup',
        'french_company',
        'service_provider',
        'investor',
        'incubator_coworking',
        'school',
        'institution',
      ],
    }).notNull(),
    sectors: json<string[]>('sectors').notNull().default([]),
    stage: text('stage'),
    teamSize: text('team_size'),
    hiring: integer('hiring', { mode: 'boolean' }).notNull().default(false),
    raising: integer('raising', { mode: 'boolean' }).notNull().default(false),
    ticketSize: text('ticket_size'),
    frenchLink: text('french_link'),
    badges: json<string[]>('badges').notNull().default([]),
    website: text('website'),
    linkedin: text('linkedin'),
    foundedYear: integer('founded_year'),
    publicEmail: text('public_email'),
    ownerEmails: json<string[]>('owner_emails').notNull().default([]),
    status: text('status', {
      enum: ['unverified', 'pending', 'published', 'rejected', 'expired', 'hidden'],
    })
      .notNull()
      .default('unverified'),
    rejectionReason: text('rejection_reason'),
    confirmedAt: ts('confirmed_at'),
    renewalDueAt: ts('renewal_due_at'),
    expiredAt: ts('expired_at'),
    memberStatus: text('member_status', { enum: ['none', 'applied', 'member', 'lapsed'] })
      .notNull()
      .default('none'),
    memberSince: ts('member_since'),
    submittedAt: ts('submitted_at'),
    /** The team's private notes on the listing (admin only, never shown on the site). */
    adminNotes: text('admin_notes'),
    /** Partner of La French Tech Bangkok: the key of its group (settings.partnerGroups); null = not one. */
    partnerType: text('partner_type'),
    /** Position within its partner group and in the Home strip (smaller first). */
    partnerOrder: integer('partner_order').notNull().default(0),
    /** Shown in "They support La French Tech Bangkok" on Home. */
    partnerHome: integer('partner_home', { mode: 'boolean' }).notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('organisations_status').on(t.status),
    index('organisations_renewal').on(t.renewalDueAt),
  ],
);

/** Owner edits to name, category, logo or website, waiting for a moderator. */
export const orgChanges = sqliteTable('org_changes', {
  id: id(),
  orgId: integer('org_id')
    .notNull()
    .references(() => organisations.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  changes: json<Record<string, unknown>>('changes').notNull(),
  status: text('status', { enum: ['pending', 'approved', 'rejected'] })
    .notNull()
    .default('pending'),
  reason: text('reason'),
  createdAt: createdAt(),
  decidedAt: ts('decided_at'),
});

export const claims = sqliteTable('claims', {
  id: id(),
  orgId: integer('org_id')
    .notNull()
    .references(() => organisations.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  name: text('name'),
  role: text('role'),
  domainMatches: integer('domain_matches', { mode: 'boolean' }).notNull().default(false),
  status: text('status', { enum: ['unverified', 'pending', 'approved', 'rejected'] })
    .notNull()
    .default('unverified'),
  reason: text('reason'),
  createdAt: createdAt(),
  decidedAt: ts('decided_at'),
});

export const membershipApplications = sqliteTable('membership_applications', {
  id: id(),
  orgId: integer('org_id')
    .notNull()
    .references(() => organisations.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  contactName: text('contact_name').notNull(),
  contactRole: text('contact_role'),
  motivation: text('motivation').notNull(),
  charterAccepted: integer('charter_accepted', { mode: 'boolean' }).notNull(),
  status: text('status', { enum: ['pending', 'approved', 'rejected'] })
    .notNull()
    .default('pending'),
  reason: text('reason'),
  createdAt: createdAt(),
  decidedAt: ts('decided_at'),
});

export const magicTokens = sqliteTable(
  'magic_tokens',
  {
    id: id(),
    tokenHash: text('token_hash').notNull().unique(),
    purpose: text('purpose', {
      enum: [
        'verify',
        'manage',
        'confirm',
        'claim',
        'data',
        'newsletter',
        'member_confirm',
        'member',
        'member_claim',
        'member_renew',
      ],
    }).notNull(),
    orgId: integer('org_id').references(() => organisations.id, { onDelete: 'cascade' }),
    /** For claims: the claim row this token verifies. */
    refId: integer('ref_id'),
    email: text('email').notNull(),
    expiresAt: ts('expires_at').notNull(),
    usedAt: ts('used_at'),
    /** Confirm links stay valid for repeated use until expiry (reactivation). */
    reusable: integer('reusable', { mode: 'boolean' }).notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index('magic_tokens_email').on(t.email)],
);

export const remindersSent = sqliteTable(
  'reminders_sent',
  {
    id: id(),
    orgId: integer('org_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    /** e.g. renewal-30:2027-10-03 (kind + the renewal date it refers to) */
    kind: text('kind').notNull(),
    sentAt: createdAt(),
  },
  (t) => [uniqueIndex('reminders_org_kind').on(t.orgId, t.kind)],
);

/** Simple fixed-window rate limiting for token requests and public forms. */
export const rateLimits = sqliteTable('rate_limits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull(),
  windowStart: integer('window_start').notNull(),
});

export const auditLog = sqliteTable(
  'audit_log',
  {
    id: id(),
    actor: text('actor').notNull(),
    action: text('action').notNull(),
    entity: text('entity').notNull(),
    entityId: integer('entity_id'),
    before: json<unknown>('before'),
    after: json<unknown>('after'),
    at: createdAt(),
  },
  (t) => [index('audit_entity').on(t.entity, t.entityId)],
);

// ---------- people, settings, submissions ----------

export const people = sqliteTable('people', {
  id: id(),
  name: text('name').notNull(),
  title: text('title'),
  organisationId: integer('organisation_id').references(() => organisations.id, {
    onDelete: 'set null',
  }),
  organisationName: text('organisation_name'),
  /** 'speaker' is someone who only spoke at events; board and institutional people can speak too. */
  group: text('group', { enum: ['board', 'institutional', 'speaker'] }).notNull(),
  linkedin: text('linkedin'),
  photoKey: text('photo_key'),
  sortOrder: integer('sort_order').notNull().default(0),
});

/** Who spoke at an event, in the order shown on its page. */
export const eventSpeakers = sqliteTable(
  'event_speakers',
  {
    eventId: integer('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    personId: integer('person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'cascade' }),
    talkTitle: text('talk_title'),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.eventId, t.personId] }),
    index('event_speakers_person').on(t.personId),
  ],
);

/**
 * Who hosts, sponsors or partners an event, in the order shown on its page. Linked to an
 * organisation of the ecosystem directory (its name, logo and website are used while it exists)
 * or entered by hand. `name` is kept as a fallback when the organisation is deleted.
 */
export const eventSponsors = sqliteTable(
  'event_sponsors',
  {
    id: id(),
    eventId: integer('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['host', 'sponsor', 'partner'] }).notNull(),
    organisationId: integer('organisation_id').references(() => organisations.id, {
      onDelete: 'set null',
    }),
    name: text('name').notNull(),
    logoKey: text('logo_key'),
    url: text('url'),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [
    index('event_sponsors_event').on(t.eventId),
    index('event_sponsors_org').on(t.organisationId),
  ],
);

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export const submissions = sqliteTable('submissions', {
  id: id(),
  type: text('type').notNull(),
  payload: json<Record<string, unknown>>('payload').notNull(),
  createdAt: createdAt(),
  /** Kept in sync with status (true unless status is 'new') for older code and backups. */
  handled: integer('handled', { mode: 'boolean' }).notNull().default(false),
  /** Messages are never removed: deleting, flagging as spam etc. only moves them to that folder. */
  status: text('status', { enum: ['new', 'answered', 'handled', 'spam', 'deleted'] })
    .notNull()
    .default('new'),
  statusAt: ts('status_at'),
  statusBy: text('status_by'),
});

/** The team's notes on a message, and a log of its moves between folders. */
export const messageNotes = sqliteTable(
  'message_notes',
  {
    id: id(),
    submissionId: integer('submission_id')
      .notNull()
      .references(() => submissions.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: ['note', 'status'] })
      .notNull()
      .default('note'),
    body: text('body').notNull(),
    author: text('author').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('message_notes_submission').on(t.submissionId)],
);

/** Senders whose messages go straight to Spam: a full address, or "@domain.com" for a domain. */
export const blockedSenders = sqliteTable('blocked_senders', {
  pattern: text('pattern').primaryKey(),
  createdAt: createdAt(),
  createdBy: text('created_by'),
});

/**
 * Wording of the site's emails, edited in /admin/emails. One row per edited email, keyed by its id
 * in lib/email-templates.ts; no row = the built-in default text.
 */
export const emailTemplates = sqliteTable('email_templates', {
  key: text('key').primaryKey(),
  subject: text('subject').notNull(),
  /** Plain text; a blank line between paragraphs. */
  body: text('body').notNull(),
  /** Null when the email has no button. */
  buttonLabel: text('button_label'),
  updatedBy: text('updated_by'),
  updatedAt: updatedAt(),
});

// ---------- members ----------

/**
 * Free individual membership (lib/members.ts): one row per email, active once the email is
 * confirmed; the team can suspend them.
 */
export const members = sqliteTable(
  'members',
  {
    id: id(),
    /** Lowercased. */
    email: text('email').notNull().unique(),
    name: text('name').notNull(),
    phone: text('phone'),
    company: text('company'),
    jobTitle: text('job_title'),
    linkedin: text('linkedin'),
    /** PROFILE_TYPES key in lib/members.ts. */
    profileType: text('profile_type').notNull().default('other'),
    /** NATIONALITY_GROUPS key in lib/members.ts, for the board's reporting only. */
    nationality: text('nationality'),
    /** Sectors of interest (the directory's SECTORS). */
    interests: json<string[]>('interests').notNull().default([]),
    howHeard: text('how_heard'),
    status: text('status', { enum: ['pending', 'active', 'suspended', 'lapsed'] })
      .notNull()
      .default('pending'),
    /** Code of conduct and privacy notice accepted (required to join). */
    termsAcceptedAt: ts('terms_accepted_at').notNull(),
    /** Ticked the newsletter box when joining; recorded on the contact card once confirmed. */
    newsletterRequested: integer('newsletter_requested', { mode: 'boolean' })
      .notNull()
      .default(false),
    confirmedAt: ts('confirmed_at'),
    memberSince: ts('member_since'),
    renewalDueAt: ts('renewal_due_at'),
    /** When someone in the admin looked at this new member (Members > To review); never blocks them. */
    reviewedAt: ts('reviewed_at'),
    reviewedBy: text('reviewed_by'),
    /** Last yearly reminder sent, e.g. "30:2027-10-03" (days before + the due date it was for). */
    renewalReminder: text('renewal_reminder'),
    /** Joined while registering for this event: registered once the email is confirmed. */
    pendingEventId: integer('pending_event_id').references(() => events.id, {
      onDelete: 'set null',
    }),
    /** The note typed with that registration. */
    pendingNote: text('pending_note'),
    /** Why the team suspended them (team only). */
    suspendedReason: text('suspended_reason'),
    notes: text('notes'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('members_status').on(t.status)],
);

/** "Email the community" (Community > Email the community): one row per email sent. */
export const communityEmails = sqliteTable('community_emails', {
  id: id(),
  /** members = active members; newsletter = newsletter subscribers; contacts = a Contacts selection. */
  audience: text('audience', { enum: ['members', 'newsletter', 'contacts'] }).notNull(),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  actionLabel: text('action_label'),
  actionUrl: text('action_url'),
  /** How many emails went out. */
  recipients: integer('recipients').notNull(),
  sentBy: text('sent_by').notNull(),
  createdAt: createdAt(),
});

export type Event = typeof events.$inferSelect;
export type Registration = typeof registrations.$inferSelect;
export type EventEmail = typeof eventEmails.$inferSelect;
export type EventFeedback = typeof eventFeedback.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Organisation = typeof organisations.$inferSelect;
export type Person = typeof people.$inferSelect;
export type EventSpeaker = typeof eventSpeakers.$inferSelect;
export type EventSponsor = typeof eventSponsors.$inferSelect;
export type Submission = typeof submissions.$inferSelect;
export type MessageNote = typeof messageNotes.$inferSelect;
export type Member = typeof members.$inferSelect;
export type CommunityEmail = typeof communityEmails.$inferSelect;
export type EmailTemplateRow = typeof emailTemplates.$inferSelect;
