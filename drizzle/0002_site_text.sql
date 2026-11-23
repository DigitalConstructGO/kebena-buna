CREATE TABLE `site_text` (
	`key` varchar(160) NOT NULL,
	`value` json NOT NULL,
	`updated_by` varchar(255),
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `site_text_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
ALTER TABLE `site_text` ADD CONSTRAINT `site_text_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;