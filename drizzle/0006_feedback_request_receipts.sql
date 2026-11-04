CREATE TABLE `feedback_requests` (
	`user_id` text NOT NULL,
	`request_id` text NOT NULL,
	`fingerprint` text NOT NULL,
	`domain` text NOT NULL,
	`target_id` text NOT NULL,
	`status` text NOT NULL,
	`started_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`response_expires_at` integer NOT NULL,
	`response_status` integer,
	`response` text,
	PRIMARY KEY(`user_id`, `request_id`),
	FOREIGN KEY (`user_id`) REFERENCES `learner_states`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `feedback_requests_expiry` ON `feedback_requests` (`expires_at`);
--> statement-breakpoint
CREATE TRIGGER feedback_requests_word_deleted AFTER DELETE ON study_sessions BEGIN
  UPDATE feedback_requests SET status='invalidated',response=NULL,response_status=NULL
  WHERE user_id=OLD.user_id AND domain='word' AND target_id=OLD.session_id;
END;
--> statement-breakpoint
CREATE TRIGGER feedback_requests_grammar_deleted AFTER DELETE ON grammar_progress BEGIN
  UPDATE feedback_requests SET status='invalidated',response=NULL,response_status=NULL
  WHERE user_id=OLD.user_id AND domain='grammar' AND target_id=OLD.lesson_id;
END;
