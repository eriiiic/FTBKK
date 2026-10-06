-- Removes Team and roles, event checklists, message assignment and the new-member review step:
-- anyone with admin access does everything. Hand-edited: drizzle-kit's snapshot did not know the
-- members table (created by hand in 0022), so it wanted to create it again.
DROP TABLE `event_tasks`;--> statement-breakpoint
DROP TABLE `team_members`;--> statement-breakpoint
ALTER TABLE `submissions` DROP COLUMN `assignee`;--> statement-breakpoint
ALTER TABLE `members` DROP COLUMN `reviewed_at`;--> statement-breakpoint
ALTER TABLE `members` DROP COLUMN `reviewed_by`;--> statement-breakpoint
DELETE FROM `email_templates` WHERE `key` IN ('team.weekly-digest', 'admin.new-members');
