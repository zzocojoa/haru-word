CREATE TABLE `card_automation_nonces` (
	`nonce` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `card_automation_nonce_expiry` ON `card_automation_nonces` (`expires_at`);