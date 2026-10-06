-- Members-only registration (pending_event_id/pending_note: joined while registering), yearly
-- reminders (renewal_reminder), "claim your membership" invitations and Email the community.
CREATE TABLE `community_emails` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`audience` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`action_label` text,
	`action_url` text,
	`recipients` integer NOT NULL,
	`sent_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `contacts` ADD `member_invited_at` integer;--> statement-breakpoint
ALTER TABLE `members` ADD `renewal_reminder` text;--> statement-breakpoint
ALTER TABLE `members` ADD `pending_event_id` integer REFERENCES events(id) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `members` ADD `pending_note` text;