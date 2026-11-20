CREATE TABLE `lab_records` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_lab_records_kind_updated` ON `lab_records` (`kind`,`updated_at`);
--> statement-breakpoint
PRAGMA optimize;
