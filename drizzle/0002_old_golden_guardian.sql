CREATE TABLE `restore_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`active_owner` text,
	`base_revision` integer NOT NULL,
	`manifest` text NOT NULL,
	`file_hash` text NOT NULL,
	`status` text NOT NULL,
	`validated` integer DEFAULT 0 NOT NULL,
	`expires_at` integer NOT NULL,
	`committed_revision` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `restore_jobs_active_owner` ON `restore_jobs` (`active_owner`);--> statement-breakpoint
CREATE INDEX `restore_jobs_owner` ON `restore_jobs` (`user_id`);--> statement-breakpoint
CREATE INDEX `restore_jobs_expiry` ON `restore_jobs` (`expires_at`);--> statement-breakpoint
CREATE TABLE `restore_parts` (
	`job_id` text NOT NULL,
	`part_index` integer NOT NULL,
	`kind` text NOT NULL,
	`hash` text NOT NULL,
	`document` text NOT NULL,
	PRIMARY KEY(`job_id`, `part_index`),
	FOREIGN KEY (`job_id`) REFERENCES `restore_jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
