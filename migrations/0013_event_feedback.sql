CREATE TABLE `event_feedback` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`registration_id` integer NOT NULL,
	`event_id` integer NOT NULL,
	`rating` integer NOT NULL,
	`comment` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`registration_id`) REFERENCES `registrations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `event_feedback_registration_id_unique` ON `event_feedback` (`registration_id`);--> statement-breakpoint
CREATE INDEX `event_feedback_event` ON `event_feedback` (`event_id`);--> statement-breakpoint
ALTER TABLE `registrations` ADD `feedback_sent_at` integer;