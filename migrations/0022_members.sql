-- Free individual membership (lib/members.ts).
CREATE TABLE `members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`company` text,
	`job_title` text,
	`linkedin` text,
	`profile_type` text DEFAULT 'other' NOT NULL,
	`nationality` text,
	`interests` text DEFAULT '[]' NOT NULL,
	`how_heard` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`terms_accepted_at` integer NOT NULL,
	`newsletter_requested` integer DEFAULT false NOT NULL,
	`confirmed_at` integer,
	`member_since` integer,
	`renewal_due_at` integer,
	`reviewed_at` integer,
	`reviewed_by` text,
	`suspended_reason` text,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `members_email_unique` ON `members` (`email`);
--> statement-breakpoint
CREATE INDEX `members_status` ON `members` (`status`);
