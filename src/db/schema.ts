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
    registrationClosesAt: ts('registration_closes_at'),
    /** Member priority (stage 3): members may register this many days before everyone else. */
    memberEarlyDays: integer('member_early_days').notNull().default(0),
    /** Member priority (stage 3): seats held back for members until registration closes. */
    memberReservedSeats: integer('member_reserved_seats').notNull().default(0),
    status: text('status', { enum: ['draft', 'published', 'cancelled'] })
      .notNull()
      .default('draft'),
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
    email: text('email').notNull(),
    company: text('company'),
    role: text('role'),
    howHeard: text('how_heard'),
    photoConsent: integer('photo_consent', { mode: 'boolean' }).notNull().default(false),
    status: text('status', { enum: ['registered', 'waitlist', 'cancelled', 'attended'] })
      .notNull()
      .default('registered'),
    token: text('token').notNull().unique(),
    createdAt: createdAt(),
    checkedInAt: ts('checked_in_at'),
    reminderSentAt: ts('reminder_sent_at'),
  },
  (t) => [
    uniqueIndex('registrations_event_email').on(t.eventId, t.email),
    index('registrations_event_status').on(t.eventId, t.status),
  ],
);

// ---------- blog ----------

export interface Attachment {
  name: string;
  key: string;
  size?: number;
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
    purpose: text('purpose', { enum: ['verify', 'manage', 'confirm', 'claim'] }).notNull(),
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
  group: text('group', { enum: ['board', 'institutional'] }).notNull(),
  linkedin: text('linkedin'),
  photoKey: text('photo_key'),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export const submissions = sqliteTable('submissions', {
  id: id(),
  type: text('type').notNull(),
  payload: json<Record<string, unknown>>('payload').notNull(),
  createdAt: createdAt(),
  handled: integer('handled', { mode: 'boolean' }).notNull().default(false),
});

export type Event = typeof events.$inferSelect;
export type Registration = typeof registrations.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Organisation = typeof organisations.$inferSelect;
export type Person = typeof people.$inferSelect;
