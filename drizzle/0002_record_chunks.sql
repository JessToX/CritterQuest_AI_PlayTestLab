CREATE TABLE `lab_record_chunks` (
	`record_id` text NOT NULL,
	`revision` text NOT NULL,
	`part` integer NOT NULL,
	`value` text NOT NULL,
	PRIMARY KEY(`record_id`, `revision`, `part`)
);
