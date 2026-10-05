ALTER TABLE `contacts` ADD `newsletter` text;--> statement-breakpoint
ALTER TABLE `contacts` ADD `newsletter_at` integer;--> statement-breakpoint
ALTER TABLE `registrations` ADD `newsletter_consent` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `registrations` ADD `newsletter_consent_at` integer;