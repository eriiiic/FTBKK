-- Event registrations can bring 0 to 5 anonymous guests, each taking a seat. pending_guests: the
-- guests asked for while joining as a member from an event page, used when the email is confirmed.
ALTER TABLE `registrations` ADD `guests` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `members` ADD `pending_guests` integer DEFAULT 0 NOT NULL;
