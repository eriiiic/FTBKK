-- Walk-ins: email becomes optional (people added at the door) and walk_in marks them.
-- SQLite cannot drop NOT NULL in place, so the table is rebuilt; nothing references registrations.
CREATE TABLE `__new_registrations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`company` text,
	`phone` text,
	`role` text,
	`how_heard` text,
	`photo_consent` integer DEFAULT false NOT NULL,
	`walk_in` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'registered' NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`checked_in_at` integer,
	`reminder_sent_at` integer,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_registrations`("id", "event_id", "name", "email", "company", "phone", "role", "how_heard", "photo_consent", "walk_in", "status", "token", "created_at", "checked_in_at", "reminder_sent_at") SELECT "id", "event_id", "name", "email", "company", "phone", "role", "how_heard", "photo_consent", 0, "status", "token", "created_at", "checked_in_at", "reminder_sent_at" FROM `registrations`;--> statement-breakpoint
DROP TABLE `registrations`;--> statement-breakpoint
ALTER TABLE `__new_registrations` RENAME TO `registrations`;--> statement-breakpoint
CREATE UNIQUE INDEX `registrations_token_unique` ON `registrations` (`token`);--> statement-breakpoint
CREATE UNIQUE INDEX `registrations_event_email` ON `registrations` (`event_id`,`email`);--> statement-breakpoint
CREATE INDEX `registrations_event_status` ON `registrations` (`event_id`,`status`);