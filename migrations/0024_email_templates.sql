-- Edited wording of the site's emails (/admin/emails, lib/email-templates.ts). No row = the
-- built-in default text. (drizzle-kit also listed team_members, event_tasks and
-- submissions.assignee here: those come from the hand-written 0021_team_tasks.sql.)
CREATE TABLE `email_templates` (
	`key` text PRIMARY KEY NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`button_label` text,
	`updated_by` text,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
