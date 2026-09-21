CREATE TABLE `learner_states` (
	`user_id` text PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`settings` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `study_sessions` (
	`user_id` text NOT NULL,
	`session_id` text NOT NULL,
	`document` text NOT NULL,
	PRIMARY KEY(`user_id`, `session_id`)
);
--> statement-breakpoint
CREATE TABLE `word_progress` (
	`user_id` text NOT NULL,
	`entry_id` text NOT NULL,
	`document` text NOT NULL,
	PRIMARY KEY(`user_id`, `entry_id`)
);
