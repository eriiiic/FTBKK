-- Social share images (one per event and blog post) and scheduled social media posts.
ALTER TABLE `events` ADD `share_image_key` text;--> statement-breakpoint
ALTER TABLE `posts` ADD `share_image_key` text;--> statement-breakpoint
CREATE TABLE `social_posts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entity` text NOT NULL,
	`entity_id` integer NOT NULL,
	`kind` text NOT NULL,
	`networks` text DEFAULT '[]' NOT NULL,
	`text` text NOT NULL,
	`scheduled_at` integer NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`results` text DEFAULT '{}' NOT NULL,
	`note` text,
	`created_by` text NOT NULL,
	`sent_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);--> statement-breakpoint
CREATE INDEX `social_posts_due` ON `social_posts` (`status`,`scheduled_at`);--> statement-breakpoint
CREATE INDEX `social_posts_entity` ON `social_posts` (`entity`,`entity_id`);
