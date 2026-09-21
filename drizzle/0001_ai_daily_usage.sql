CREATE TABLE `ai_daily_usage` (
	`user_id` text NOT NULL,
	`day` text NOT NULL,
	`request_count` integer NOT NULL,
	`last_request_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `day`)
);
