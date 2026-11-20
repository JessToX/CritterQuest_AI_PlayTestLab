CREATE TABLE `agent_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`provider_connection_id` text,
	`model` text DEFAULT '' NOT NULL,
	`custom_instructions` text DEFAULT '' NOT NULL,
	`memory_mode` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`provider_connection_id`) REFERENCES `provider_connections`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_agent_profiles_provider` ON `agent_profiles` (`provider_connection_id`);--> statement-breakpoint
CREATE TABLE `game_events` (
	`id` text PRIMARY KEY NOT NULL,
	`match_id` text NOT NULL,
	`turn` integer NOT NULL,
	`round` integer NOT NULL,
	`actor_agent_id` text,
	`event_type` text NOT NULL,
	`public_text` text NOT NULL,
	`payload_json` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_agent_id`) REFERENCES `agent_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_game_events_match_turn` ON `game_events` (`match_id`,`turn`);--> statement-breakpoint
CREATE TABLE `matches` (
	`id` text PRIMARY KEY NOT NULL,
	`rule_version_id` text NOT NULL,
	`seed` integer NOT NULL,
	`status` text NOT NULL,
	`winner_agent_id` text,
	`round_count` integer DEFAULT 0 NOT NULL,
	`turn_count` integer DEFAULT 0 NOT NULL,
	`config_json` text NOT NULL,
	`created_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`rule_version_id`) REFERENCES `rule_versions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`winner_agent_id`) REFERENCES `agent_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_matches_rule_created` ON `matches` (`rule_version_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_matches_status` ON `matches` (`status`);--> statement-breakpoint
CREATE TABLE `memory_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`rule_version_id` text NOT NULL,
	`kind` text NOT NULL,
	`content` text NOT NULL,
	`source_match_ids_json` text DEFAULT '[]' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `agent_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`rule_version_id`) REFERENCES `rule_versions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_memory_agent_rule_active` ON `memory_entries` (`agent_id`,`rule_version_id`,`active`);--> statement-breakpoint
CREATE TABLE `memory_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`label` text NOT NULL,
	`memory_entry_ids_json` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `agent_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_memory_snapshots_agent` ON `memory_snapshots` (`agent_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `provider_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`provider_kind` text NOT NULL,
	`base_url` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rule_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`source_filename` text NOT NULL,
	`source_hash` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`snapshot_json` text NOT NULL,
	`diff_json` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_rule_versions_source_hash` ON `rule_versions` (`source_hash`);--> statement-breakpoint
CREATE INDEX `idx_rule_versions_status` ON `rule_versions` (`status`);
--> statement-breakpoint
PRAGMA optimize;
