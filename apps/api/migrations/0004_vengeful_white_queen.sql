ALTER TABLE `invoices` ADD `share_token` text;--> statement-breakpoint
UPDATE `invoices` SET `share_token` = lower(hex(randomblob(24))) WHERE `share_token` IS NULL;