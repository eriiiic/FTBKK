CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`entity` text NOT NULL,
	`entity_id` integer,
	`before` text,
	`after` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_entity` ON `audit_log` (`entity`,`entity_id`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_slug_unique` ON `categories` (`slug`);--> statement-breakpoint
CREATE TABLE `claims` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`org_id` integer NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`role` text,
	`domain_matches` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'unverified' NOT NULL,
	`reason` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`decided_at` integer,
	FOREIGN KEY (`org_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`series` text DEFAULT 'Other' NOT NULL,
	`summary` text,
	`body_md` text DEFAULT '' NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer,
	`timezone` text DEFAULT 'Asia/Bangkok' NOT NULL,
	`venue` text,
	`address` text,
	`map_url` text,
	`cover_key` text,
	`capacity` integer,
	`registration_open` integer DEFAULT true NOT NULL,
	`registration_closes_at` integer,
	`member_early_days` integer DEFAULT 0 NOT NULL,
	`member_reserved_seats` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_slug_unique` ON `events` (`slug`);--> statement-breakpoint
CREATE INDEX `events_starts_at` ON `events` (`starts_at`);--> statement-breakpoint
CREATE TABLE `magic_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token_hash` text NOT NULL,
	`purpose` text NOT NULL,
	`org_id` integer,
	`ref_id` integer,
	`email` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`reusable` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `magic_tokens_token_hash_unique` ON `magic_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `magic_tokens_email` ON `magic_tokens` (`email`);--> statement-breakpoint
CREATE TABLE `membership_applications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`org_id` integer NOT NULL,
	`email` text NOT NULL,
	`contact_name` text NOT NULL,
	`contact_role` text,
	`motivation` text NOT NULL,
	`charter_accepted` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reason` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`decided_at` integer,
	FOREIGN KEY (`org_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `org_changes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`org_id` integer NOT NULL,
	`email` text NOT NULL,
	`changes` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reason` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`decided_at` integer,
	FOREIGN KEY (`org_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `organisations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`logo_key` text,
	`cover_key` text,
	`pitch` text,
	`description_md` text DEFAULT '' NOT NULL,
	`category` text NOT NULL,
	`sectors` text DEFAULT '[]' NOT NULL,
	`stage` text,
	`team_size` text,
	`hiring` integer DEFAULT false NOT NULL,
	`raising` integer DEFAULT false NOT NULL,
	`ticket_size` text,
	`french_link` text,
	`badges` text DEFAULT '[]' NOT NULL,
	`website` text,
	`linkedin` text,
	`founded_year` integer,
	`public_email` text,
	`owner_emails` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'unverified' NOT NULL,
	`rejection_reason` text,
	`confirmed_at` integer,
	`renewal_due_at` integer,
	`expired_at` integer,
	`member_status` text DEFAULT 'none' NOT NULL,
	`member_since` integer,
	`submitted_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organisations_slug_unique` ON `organisations` (`slug`);--> statement-breakpoint
CREATE INDEX `organisations_status` ON `organisations` (`status`);--> statement-breakpoint
CREATE INDEX `organisations_renewal` ON `organisations` (`renewal_due_at`);--> statement-breakpoint
CREATE TABLE `people` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`title` text,
	`organisation_id` integer,
	`organisation_name` text,
	`group` text NOT NULL,
	`linkedin` text,
	`photo_key` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `post_categories` (
	`post_id` integer NOT NULL,
	`category_id` integer NOT NULL,
	PRIMARY KEY(`post_id`, `category_id`),
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`excerpt` text,
	`body_md` text DEFAULT '' NOT NULL,
	`cover_key` text,
	`author_name` text,
	`author_role` text,
	`published_at` integer,
	`status` text DEFAULT 'draft' NOT NULL,
	`attachments` text DEFAULT '[]' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `posts_slug_unique` ON `posts` (`slug`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`window_start` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `registrations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`company` text,
	`role` text,
	`how_heard` text,
	`photo_consent` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'registered' NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`checked_in_at` integer,
	`reminder_sent_at` integer,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `registrations_token_unique` ON `registrations` (`token`);--> statement-breakpoint
CREATE UNIQUE INDEX `registrations_event_email` ON `registrations` (`event_id`,`email`);--> statement-breakpoint
CREATE INDEX `registrations_event_status` ON `registrations` (`event_id`,`status`);--> statement-breakpoint
CREATE TABLE `reminders_sent` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`org_id` integer NOT NULL,
	`kind` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reminders_org_kind` ON `reminders_sent` (`org_id`,`kind`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`handled` integer DEFAULT false NOT NULL
);
