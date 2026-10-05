CREATE TABLE `event_speakers` (
	`event_id` integer NOT NULL,
	`person_id` integer NOT NULL,
	`talk_title` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`event_id`, `person_id`),
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `event_speakers_person` ON `event_speakers` (`person_id`);