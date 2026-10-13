-- Contacts as a small CRM: tags the team creates (the five fixed tags become editable rows) and
-- groups of contacts, usable as an audience in Email the community. The privacy notice (edited or
-- not) now says the team may also put people in groups.
CREATE TABLE `contact_tags` (
	`key` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);--> statement-breakpoint
INSERT INTO `contact_tags` (`key`, `name`) VALUES
	('speaker', 'Speaker'),
	('sponsor', 'Sponsor'),
	('volunteer', 'Volunteer'),
	('board', 'Board'),
	('press', 'Press');--> statement-breakpoint
CREATE TABLE `contact_groups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);--> statement-breakpoint
ALTER TABLE `contacts` ADD `groups` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `community_emails` ADD `audience_detail` text;
--> statement-breakpoint
UPDATE settings SET value = replace(value, 'Notes and tags the organising team adds', 'Notes, tags and groups the organising team adds') WHERE key = 'privacyNotice';
