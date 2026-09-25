CREATE TABLE `appointments` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`staff_id` text NOT NULL,
	`start_at` text NOT NULL,
	`end_at` text NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`reason_note` text,
	`created_by` text,
	`deleted_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `appointments_staff_start_idx` ON `appointments` (`staff_id`,`start_at`);--> statement-breakpoint
CREATE INDEX `appointments_patient_idx` ON `appointments` (`patient_id`);--> statement-breakpoint
CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`type` text NOT NULL,
	`file_name` text NOT NULL,
	`r2_key` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`notes` text,
	`uploaded_by` text NOT NULL,
	`uploaded_at` text NOT NULL,
	`deleted_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`uploaded_by`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `files_patient_idx` ON `files` (`patient_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `files_r2_key_unique` ON `files` (`r2_key`);--> statement-breakpoint
CREATE TABLE `invoice_items` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`treatment_record_id` text,
	`description` text NOT NULL,
	`amount` real NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`treatment_record_id`) REFERENCES `treatment_records`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `invoice_items_invoice_idx` ON `invoice_items` (`invoice_id`);--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`status` text DEFAULT 'unpaid' NOT NULL,
	`date` text NOT NULL,
	`total_amount` real DEFAULT 0 NOT NULL,
	`amount_paid` real DEFAULT 0 NOT NULL,
	`notes` text,
	`created_by` text,
	`deleted_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `invoices_patient_idx` ON `invoices` (`patient_id`);--> statement-breakpoint
CREATE INDEX `invoices_status_idx` ON `invoices` (`status`);--> statement-breakpoint
CREATE TABLE `patients` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`email` text,
	`date_of_birth` text,
	`sex` text DEFAULT 'unspecified' NOT NULL,
	`address` text,
	`medical_history_notes` text,
	`created_by` text,
	`deleted_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `patients_name_idx` ON `patients` (`name`);--> statement-breakpoint
CREATE INDEX `patients_phone_idx` ON `patients` (`phone`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`amount` real NOT NULL,
	`method` text NOT NULL,
	`paid_at` text NOT NULL,
	`note` text,
	`recorded_by` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recorded_by`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `payments_invoice_idx` ON `payments` (`invoice_id`);--> statement-breakpoint
CREATE TABLE `reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`appointment_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`channel` text DEFAULT 'whatsapp' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`message` text NOT NULL,
	`scheduled_for` text NOT NULL,
	`sent_at` text,
	`sent_by` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sent_by`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `reminders_appointment_idx` ON `reminders` (`appointment_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`staff_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sessions_staff_idx` ON `sessions` (`staff_id`);--> statement-breakpoint
CREATE TABLE `staff` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`phone` text,
	`password_hash` text NOT NULL,
	`password_salt` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `staff_username_unique` ON `staff` (`username`);--> statement-breakpoint
CREATE TABLE `treatment_records` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`appointment_id` text,
	`tooth_number` text,
	`condition` text,
	`procedure` text NOT NULL,
	`notes` text,
	`prescription` text,
	`status` text DEFAULT 'completed' NOT NULL,
	`date` text NOT NULL,
	`staff_id` text NOT NULL,
	`deleted_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `treatment_patient_tooth_idx` ON `treatment_records` (`patient_id`,`tooth_number`);--> statement-breakpoint
CREATE INDEX `treatment_patient_date_idx` ON `treatment_records` (`patient_id`,`date`);