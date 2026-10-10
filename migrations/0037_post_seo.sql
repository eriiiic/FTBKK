-- Blog posts: SEO fields editable in the post editor. Empty means "use the automatic value".
ALTER TABLE `posts` ADD `seo_title` text;--> statement-breakpoint
ALTER TABLE `posts` ADD `seo_description` text;--> statement-breakpoint
ALTER TABLE `posts` ADD `seo_keywords` text;--> statement-breakpoint
ALTER TABLE `posts` ADD `seo_image_key` text;--> statement-breakpoint
ALTER TABLE `posts` ADD `noindex` integer DEFAULT false NOT NULL;
