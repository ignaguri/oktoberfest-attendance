CREATE TABLE `achievements` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`icon` text NOT NULL,
	`category` text NOT NULL,
	`rarity` text DEFAULT 'common',
	`points` integer DEFAULT 0,
	`conditions` text DEFAULT '{}',
	`is_active` integer DEFAULT 1,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`_synced_at` text,
	`_deleted` integer DEFAULT 0 NOT NULL,
	`_dirty` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_achievements` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`achievement_id` text NOT NULL,
	`festival_id` text NOT NULL,
	`unlocked_at` text NOT NULL,
	`progress` text,
	`_synced_at` text,
	`_deleted` integer DEFAULT 0 NOT NULL,
	`_dirty` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`achievement_id`) REFERENCES `achievements`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`festival_id`) REFERENCES `festivals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_user_achievements_user` ON `user_achievements` (`user_id`,`festival_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_achievements_user_achievement_festival` ON `user_achievements` (`user_id`,`achievement_id`,`festival_id`);--> statement-breakpoint
CREATE TABLE `attendances` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`festival_id` text NOT NULL,
	`date` text NOT NULL,
	`beer_count` integer DEFAULT 0 NOT NULL,
	`created_at` text,
	`updated_at` text,
	`_synced_at` text,
	`_deleted` integer DEFAULT 0 NOT NULL,
	`_dirty` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`festival_id`) REFERENCES `festivals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_attendances_user_festival` ON `attendances` (`user_id`,`festival_id`);--> statement-breakpoint
CREATE INDEX `idx_attendances_date` ON `attendances` (`date`);--> statement-breakpoint
CREATE INDEX `idx_attendances_dirty` ON `attendances` (`_dirty`) WHERE "attendances"."_dirty" = 1;--> statement-breakpoint
CREATE UNIQUE INDEX `attendances_user_festival_date` ON `attendances` (`user_id`,`festival_id`,`date`);--> statement-breakpoint
CREATE TABLE `beer_pictures` (
	`id` text PRIMARY KEY NOT NULL,
	`attendance_id` text NOT NULL,
	`user_id` text NOT NULL,
	`picture_url` text,
	`visibility` text DEFAULT 'public',
	`created_at` text NOT NULL,
	`_synced_at` text,
	`_deleted` integer DEFAULT 0 NOT NULL,
	`_dirty` integer DEFAULT 0 NOT NULL,
	`_pending_upload` integer DEFAULT 0 NOT NULL,
	`_local_uri` text,
	FOREIGN KEY (`attendance_id`) REFERENCES `attendances`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_beer_pictures_attendance` ON `beer_pictures` (`attendance_id`);--> statement-breakpoint
CREATE INDEX `idx_beer_pictures_pending` ON `beer_pictures` (`_pending_upload`) WHERE "beer_pictures"."_pending_upload" = 1;--> statement-breakpoint
CREATE TABLE `consumptions` (
	`id` text PRIMARY KEY NOT NULL,
	`attendance_id` text NOT NULL,
	`drink_type` text DEFAULT 'beer',
	`drink_name` text,
	`volume_ml` integer,
	`price_paid_cents` integer NOT NULL,
	`base_price_cents` integer NOT NULL,
	`tip_cents` integer,
	`tent_id` text,
	`recorded_at` text NOT NULL,
	`idempotency_key` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`_synced_at` text,
	`_deleted` integer DEFAULT 0 NOT NULL,
	`_dirty` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`attendance_id`) REFERENCES `attendances`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tent_id`) REFERENCES `tents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_consumptions_attendance` ON `consumptions` (`attendance_id`);--> statement-breakpoint
CREATE INDEX `idx_consumptions_idempotency` ON `consumptions` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_consumptions_dirty` ON `consumptions` (`_dirty`) WHERE "consumptions"."_dirty" = 1;--> statement-breakpoint
CREATE TABLE `festivals` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`short_name` text NOT NULL,
	`description` text,
	`location` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`festival_type` text NOT NULL,
	`status` text NOT NULL,
	`is_active` integer DEFAULT 1,
	`beer_cost` real,
	`default_beer_price_cents` integer,
	`timezone` text DEFAULT 'Europe/Berlin',
	`map_url` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`_synced_at` text,
	`_deleted` integer DEFAULT 0 NOT NULL,
	`_dirty` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `group_members` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`user_id` text NOT NULL,
	`joined_at` text,
	`_synced_at` text,
	`_deleted` integer DEFAULT 0 NOT NULL,
	`_dirty` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_group_members_user` ON `group_members` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_group_members_group` ON `group_members` (`group_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `group_members_group_user` ON `group_members` (`group_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`festival_id` text NOT NULL,
	`created_by` text,
	`password` text NOT NULL,
	`invite_token` text,
	`token_expiration` text,
	`winning_criteria_id` integer NOT NULL,
	`created_at` text,
	`_synced_at` text,
	`_deleted` integer DEFAULT 0 NOT NULL,
	`_dirty` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`festival_id`) REFERENCES `festivals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text,
	`full_name` text,
	`avatar_url` text,
	`website` text,
	`preferred_language` text,
	`tutorial_completed` integer,
	`tutorial_completed_at` text,
	`is_super_admin` integer,
	`updated_at` text,
	`_synced_at` text,
	`_deleted` integer DEFAULT 0 NOT NULL,
	`_dirty` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `_sync_metadata` (
	`table_name` text PRIMARY KEY NOT NULL,
	`last_sync_at` text,
	`last_pull_cursor` text,
	`schema_version` integer DEFAULT 1
);
--> statement-breakpoint
CREATE TABLE `_sync_queue` (
	`id` text PRIMARY KEY NOT NULL,
	`operation` text NOT NULL,
	`table_name` text NOT NULL,
	`record_id` text NOT NULL,
	`payload` text NOT NULL,
	`idempotency_key` text,
	`depends_on` text,
	`status` text DEFAULT 'pending',
	`retry_count` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_sync_queue_status` ON `_sync_queue` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_sync_queue_depends` ON `_sync_queue` (`depends_on`);--> statement-breakpoint
CREATE TABLE `drink_type_prices` (
	`id` text PRIMARY KEY NOT NULL,
	`drink_type` text NOT NULL,
	`price_cents` integer NOT NULL,
	`festival_id` text,
	`festival_tent_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`_synced_at` text,
	`_deleted` integer DEFAULT 0 NOT NULL,
	`_dirty` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`festival_id`) REFERENCES `festivals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`festival_tent_id`) REFERENCES `festival_tents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `festival_tents` (
	`id` text PRIMARY KEY NOT NULL,
	`festival_id` text NOT NULL,
	`tent_id` text NOT NULL,
	`beer_price` real,
	`beer_price_cents` integer,
	`created_at` text,
	`updated_at` text,
	`_synced_at` text,
	`_deleted` integer DEFAULT 0 NOT NULL,
	`_dirty` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`festival_id`) REFERENCES `festivals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tent_id`) REFERENCES `tents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_festival_tents_festival` ON `festival_tents` (`festival_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `festival_tents_festival_tent` ON `festival_tents` (`festival_id`,`tent_id`);--> statement-breakpoint
CREATE TABLE `tent_visits` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`tent_id` text NOT NULL,
	`festival_id` text NOT NULL,
	`visit_date` text,
	`_synced_at` text,
	`_deleted` integer DEFAULT 0 NOT NULL,
	`_dirty` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`tent_id`) REFERENCES `tents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`festival_id`) REFERENCES `festivals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_tent_visits_user_festival` ON `tent_visits` (`user_id`,`festival_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `tent_visits_user_tent_festival_date` ON `tent_visits` (`user_id`,`tent_id`,`festival_id`,`visit_date`);--> statement-breakpoint
CREATE TABLE `tents` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text,
	`_synced_at` text,
	`_deleted` integer DEFAULT 0 NOT NULL,
	`_dirty` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `winning_criteria` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`_synced_at` text,
	`_deleted` integer DEFAULT 0 NOT NULL,
	`_dirty` integer DEFAULT 0 NOT NULL
);
