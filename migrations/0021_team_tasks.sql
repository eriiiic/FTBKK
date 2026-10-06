-- The organising team and who owns each step of an event (lib/ownership.ts), plus an owner on
-- contact-form messages.
CREATE TABLE `team_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`roles` text DEFAULT '[]' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_members_email_unique` ON `team_members` (`email`);
--> statement-breakpoint
CREATE TABLE `event_tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`step` text NOT NULL,
	`owner` text,
	`done_at` integer,
	`done_by` text,
	`note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `event_tasks_event_step` ON `event_tasks` (`event_id`,`step`);
--> statement-breakpoint
CREATE INDEX `event_tasks_owner` ON `event_tasks` (`owner`);
--> statement-breakpoint
ALTER TABLE `submissions` ADD `assignee` text;
