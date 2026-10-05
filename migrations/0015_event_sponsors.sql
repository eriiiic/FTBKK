CREATE TABLE `event_sponsors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`role` text NOT NULL,
	`organisation_id` integer,
	`name` text NOT NULL,
	`logo_key` text,
	`url` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `event_sponsors_event` ON `event_sponsors` (`event_id`);--> statement-breakpoint
CREATE INDEX `event_sponsors_org` ON `event_sponsors` (`organisation_id`);