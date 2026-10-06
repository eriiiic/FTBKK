-- Members > To review: a light marker for new members the team has looked at (never blocks them).
ALTER TABLE `members` ADD `reviewed_at` integer;--> statement-breakpoint
ALTER TABLE `members` ADD `reviewed_by` text;