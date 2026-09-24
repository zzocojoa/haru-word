CREATE TABLE `grammar_progress` (
	`user_id` text NOT NULL,
	`lesson_id` text NOT NULL,
	`document` text NOT NULL,
	PRIMARY KEY(`user_id`, `lesson_id`)
);
