ALTER TABLE `invoices` ADD `discount_percent` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `discount_amount` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `treatment_records` ADD `condition_other` text;