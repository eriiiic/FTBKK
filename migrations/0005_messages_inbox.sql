CREATE TABLE `blocked_senders` (
	`pattern` text PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`created_by` text
);
--> statement-breakpoint
ALTER TABLE `submissions` ADD `status` text DEFAULT 'new' NOT NULL;--> statement-breakpoint
ALTER TABLE `submissions` ADD `status_at` integer;--> statement-breakpoint
ALTER TABLE `submissions` ADD `status_by` text;--> statement-breakpoint
UPDATE `submissions` SET `status` = 'handled' WHERE `handled` = 1;
