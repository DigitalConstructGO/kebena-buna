CREATE TABLE `bundle` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(100) NOT NULL,
	`name` json NOT NULL,
	`summary` json,
	`image` varchar(255),
	`pricing` varchar(24) NOT NULL DEFAULT 'percent_off',
	`value` decimal(14,2) NOT NULL DEFAULT 0,
	`currency` char(3) NOT NULL DEFAULT 'ETB',
	`stacks_with_discounts` boolean NOT NULL DEFAULT false,
	`starts_at` datetime,
	`ends_at` datetime,
	`max_per_order` smallint,
	`is_member_only` boolean NOT NULL DEFAULT false,
	`publish_status` varchar(24) NOT NULL DEFAULT 'draft',
	`sort_order` smallint NOT NULL DEFAULT 0,
	`extra` json,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `bundle_id` PRIMARY KEY(`id`),
	CONSTRAINT `bundle_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `bundle_item` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bundle_id` int NOT NULL,
	`variant_id` int,
	`bag_size_id` int,
	`category_id` int,
	`quantity` smallint NOT NULL DEFAULT 1,
	`sort_order` smallint NOT NULL DEFAULT 0,
	`status` boolean NOT NULL DEFAULT true,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `bundle_item_id` PRIMARY KEY(`id`),
	CONSTRAINT `bundle_item_qty_chk` CHECK(`bundle_item`.`quantity` > 0),
	CONSTRAINT `bundle_item_kind_chk` CHECK((`bundle_item`.`variant_id` is null) <> (`bundle_item`.`bag_size_id` is null))
);
--> statement-breakpoint
ALTER TABLE `order_line` ADD `bundle_id` int;--> statement-breakpoint
ALTER TABLE `order_line` ADD `bundle_group` smallint;--> statement-breakpoint
ALTER TABLE `bundle` ADD CONSTRAINT `bundle_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bundle` ADD CONSTRAINT `bundle_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bundle` ADD CONSTRAINT `bundle_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bundle_item` ADD CONSTRAINT `bundle_item_bundle_id_bundle_id_fk` FOREIGN KEY (`bundle_id`) REFERENCES `bundle`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bundle_item` ADD CONSTRAINT `bundle_item_variant_id_product_variant_id_fk` FOREIGN KEY (`variant_id`) REFERENCES `product_variant`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bundle_item` ADD CONSTRAINT `bundle_item_bag_size_id_bag_size_id_fk` FOREIGN KEY (`bag_size_id`) REFERENCES `bag_size`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bundle_item` ADD CONSTRAINT `bundle_item_category_id_product_category_id_fk` FOREIGN KEY (`category_id`) REFERENCES `product_category`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bundle_item` ADD CONSTRAINT `bundle_item_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `bundle_publish_idx` ON `bundle` (`publish_status`,`sort_order`);--> statement-breakpoint
CREATE INDEX `bundle_item_bundle_idx` ON `bundle_item` (`bundle_id`);--> statement-breakpoint
CREATE INDEX `bundle_item_variant_idx` ON `bundle_item` (`variant_id`);--> statement-breakpoint
ALTER TABLE `order_line` ADD CONSTRAINT `order_line_bundle_id_bundle_id_fk` FOREIGN KEY (`bundle_id`) REFERENCES `bundle`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `order_line_bundle_idx` ON `order_line` (`bundle_id`);