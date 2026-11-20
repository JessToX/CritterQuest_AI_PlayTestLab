CREATE TABLE `lab_call_budgets` (
	`game_id` text PRIMARY KEY NOT NULL,
	`call_limit` integer NOT NULL,
	`used` integer NOT NULL
);
