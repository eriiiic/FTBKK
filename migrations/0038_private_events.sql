-- Private events: registration only through an invitation link (invite_token). Unlisted events
-- (listed = 0) keep their page, reachable by direct link, but stay off lists, home and sitemap.
ALTER TABLE `events` ADD `invite_only` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `invite_token` text;--> statement-breakpoint
ALTER TABLE `events` ADD `listed` integer DEFAULT true NOT NULL;
