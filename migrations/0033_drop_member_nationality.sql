-- Removes the members' nationality (Eric, Oct 10): no longer asked in the membership form, shown in
-- the admin or counted in reports. Also drops it from the privacy notice, edited or not.
ALTER TABLE `members` DROP COLUMN `nationality`;--> statement-breakpoint
UPDATE settings SET value = replace(value, ', your nationality if you give it', '') WHERE key = 'privacyNotice';
