ALTER TABLE `appointments` ADD `rescheduled_to_appointment_id` text REFERENCES appointments(id);--> statement-breakpoint
ALTER TABLE `patients` ADD `chief_complaint` text;--> statement-breakpoint
ALTER TABLE `patients` ADD `past_dental_history` text;--> statement-breakpoint
ALTER TABLE `patients` ADD `medications_using` text;--> statement-breakpoint
ALTER TABLE `treatment_records` ADD `completed_date` text;--> statement-breakpoint
ALTER TABLE `treatment_records` ADD `post_treatment_notes` text;--> statement-breakpoint
ALTER TABLE `treatment_records` ADD `before_treatment_file_ids` text;--> statement-breakpoint
ALTER TABLE `treatment_records` ADD `after_treatment_file_ids` text;