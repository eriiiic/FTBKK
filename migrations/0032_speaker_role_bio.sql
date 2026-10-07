-- Event speakers: role on stage (speaker, keynote, moderator, panelist, host) and a short bio.
ALTER TABLE `event_speakers` ADD `role` text;--> statement-breakpoint
ALTER TABLE `event_speakers` ADD `bio` text;
