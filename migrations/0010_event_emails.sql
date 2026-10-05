CREATE TABLE `event_emails` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`audience` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`action_label` text,
	`action_url` text,
	`recipients` integer NOT NULL,
	`sent_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `event_emails_event` ON `event_emails` (`event_id`);