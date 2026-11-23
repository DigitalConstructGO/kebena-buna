CREATE TABLE `account` (
	`id` varchar(255) NOT NULL,
	`account_id` varchar(255) NOT NULL,
	`provider_id` varchar(255) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` timestamp(3),
	`refresh_token_expires_at` timestamp(3),
	`scope` text,
	`password` text,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL,
	CONSTRAINT `account_id` PRIMARY KEY(`id`),
	CONSTRAINT `account_provider_account_idx` UNIQUE(`provider_id`,`account_id`)
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(32) NOT NULL,
	`description` varchar(255),
	`is_active` boolean NOT NULL DEFAULT true,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `roles_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` varchar(255) NOT NULL,
	`expires_at` timestamp(3) NOT NULL,
	`token` varchar(255) NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` varchar(255) NOT NULL,
	CONSTRAINT `session_id` PRIMARY KEY(`id`),
	CONSTRAINT `session_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `two_factor` (
	`id` varchar(255) NOT NULL,
	`secret` text NOT NULL,
	`backup_codes` text NOT NULL,
	`user_id` varchar(255) NOT NULL,
	CONSTRAINT `two_factor_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`email_verified` boolean NOT NULL DEFAULT false,
	`image` text,
	`kind` varchar(16) NOT NULL DEFAULT 'customer',
	`role_id` int,
	`phone_number` varchar(20),
	`phone_number_verified` boolean NOT NULL DEFAULT false,
	`two_factor_enabled` boolean NOT NULL DEFAULT false,
	`locale` varchar(8) NOT NULL DEFAULT 'am',
	`telegram_id` varchar(20),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `user_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_email_unique` UNIQUE(`email`),
	CONSTRAINT `user_phone_number_unique` UNIQUE(`phone_number`)
);
--> statement-breakpoint
CREATE TABLE `verification` (
	`id` varchar(255) NOT NULL,
	`identifier` varchar(255) NOT NULL,
	`value` text NOT NULL,
	`expires_at` timestamp(3) NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `verification_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `permissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(50) NOT NULL,
	`description` varchar(255),
	CONSTRAINT `permissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `permissions_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `role_permissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`role_id` int NOT NULL,
	`permission_id` int NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `role_permissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audience` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(20) NOT NULL,
	`name` json NOT NULL,
	`colour` varchar(9),
	`requires_id_check` boolean NOT NULL DEFAULT false,
	`declaration` json,
	`is_default` boolean NOT NULL DEFAULT false,
	`sort_order` smallint NOT NULL DEFAULT 0,
	`status` boolean NOT NULL DEFAULT true,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `audience_id` PRIMARY KEY(`id`),
	CONSTRAINT `audience_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` varchar(255),
	`action` varchar(20) NOT NULL,
	`table_name` varchar(64) NOT NULL,
	`record_id` varchar(64) NOT NULL,
	`changes` json,
	`ip_address` varchar(45),
	`branch_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `calendar_exception` (
	`id` int AUTO_INCREMENT NOT NULL,
	`date` date NOT NULL,
	`location_id` int,
	`name` json NOT NULL,
	`is_holiday` boolean NOT NULL DEFAULT false,
	`is_closed` boolean NOT NULL DEFAULT true,
	`opens_at` time,
	`closes_at` time,
	`blocks_roasting` boolean NOT NULL DEFAULT false,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `calendar_exception_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `document_sequence` (
	`key` varchar(64) NOT NULL,
	`next_value` int NOT NULL DEFAULT 1,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	CONSTRAINT `document_sequence_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE TABLE `language` (
	`code` varchar(8) NOT NULL,
	`name` varchar(50) NOT NULL,
	`native_name` varchar(50) NOT NULL,
	`is_required` boolean NOT NULL DEFAULT true,
	`is_default` boolean NOT NULL DEFAULT false,
	`sort_order` smallint NOT NULL DEFAULT 0,
	`status` boolean NOT NULL DEFAULT true,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `language_code` PRIMARY KEY(`code`)
);
--> statement-breakpoint
CREATE TABLE `location` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(20) NOT NULL,
	`name` json NOT NULL,
	`type` varchar(24) NOT NULL,
	`parent_id` int,
	`address` varchar(255),
	`latitude` decimal(9,6),
	`longitude` decimal(9,6),
	`phone` varchar(20),
	`holds_stock` boolean NOT NULL DEFAULT false,
	`sells_at_desk` boolean NOT NULL DEFAULT false,
	`fulfils_online` boolean NOT NULL DEFAULT false,
	`is_pickup_point` boolean NOT NULL DEFAULT false,
	`controls_capacity` boolean NOT NULL DEFAULT false,
	`admits_visitors` boolean NOT NULL DEFAULT false,
	`sort_order` smallint NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `location_id` PRIMARY KEY(`id`),
	CONSTRAINT `location_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `media` (
	`id` int AUTO_INCREMENT NOT NULL,
	`file_name` varchar(255) NOT NULL,
	`mime_type` varchar(100) NOT NULL,
	`size_bytes` int NOT NULL,
	`width` int,
	`height` int,
	`alt` json,
	`caption` json,
	`folder` varchar(100),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `media_id` PRIMARY KEY(`id`),
	CONSTRAINT `media_file_name_unique` UNIQUE(`file_name`)
);
--> statement-breakpoint
CREATE TABLE `notification` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`channel` varchar(24) NOT NULL,
	`template_key` varchar(64) NOT NULL,
	`locale` varchar(8) NOT NULL,
	`recipient` varchar(255) NOT NULL,
	`customer_id` int,
	`user_id` varchar(255),
	`payload` json,
	`is_marketing` boolean NOT NULL DEFAULT false,
	`status` varchar(24) NOT NULL DEFAULT 'queued',
	`attempts` tinyint NOT NULL DEFAULT 0,
	`last_error` varchar(500),
	`provider_ref` varchar(100),
	`dedupe_key` varchar(150),
	`ref_type` varchar(32),
	`ref_id` varchar(64),
	`scheduled_for` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`sent_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notification_id` PRIMARY KEY(`id`),
	CONSTRAINT `notification_dedupe_key_unique` UNIQUE(`dedupe_key`)
);
--> statement-breakpoint
CREATE TABLE `notification_template` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(64) NOT NULL,
	`channel` varchar(24) NOT NULL,
	`locale` varchar(8) NOT NULL,
	`subject` varchar(255),
	`body` text NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `notification_template_id` PRIMARY KEY(`id`),
	CONSTRAINT `notification_template_uq` UNIQUE(`key`,`channel`,`locale`)
);
--> statement-breakpoint
CREATE TABLE `opening_hours` (
	`id` int AUTO_INCREMENT NOT NULL,
	`location_id` int NOT NULL,
	`weekday` tinyint NOT NULL,
	`is_closed` boolean NOT NULL DEFAULT false,
	`opens_at` time,
	`closes_at` time,
	`last_entry_at` time,
	CONSTRAINT `opening_hours_id` PRIMARY KEY(`id`),
	CONSTRAINT `opening_hours_location_day_uq` UNIQUE(`location_id`,`weekday`)
);
--> statement-breakpoint
CREATE TABLE `setting` (
	`key` varchar(100) NOT NULL,
	`value` json NOT NULL,
	`description` varchar(255),
	`updated_by` varchar(255),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	CONSTRAINT `setting_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE TABLE `tax_rate` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(20) NOT NULL,
	`name` json NOT NULL,
	`rate` decimal(5,2) NOT NULL DEFAULT 0,
	`is_inclusive` boolean NOT NULL DEFAULT true,
	`is_default` boolean NOT NULL DEFAULT false,
	`status` boolean NOT NULL DEFAULT true,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `tax_rate_id` PRIMARY KEY(`id`),
	CONSTRAINT `tax_rate_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `webhook_event` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`provider` varchar(32) NOT NULL,
	`event_id` varchar(128) NOT NULL,
	`event_type` varchar(64),
	`payload` json NOT NULL,
	`signature_valid` boolean NOT NULL,
	`processed_at` datetime,
	`error` varchar(500),
	`received_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `webhook_event_id` PRIMARY KEY(`id`),
	CONSTRAINT `webhook_event_uq` UNIQUE(`provider`,`event_id`)
);
--> statement-breakpoint
CREATE TABLE `certification` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(20) NOT NULL,
	`name` json NOT NULL,
	`logo` varchar(255),
	`url` varchar(255),
	`status` boolean NOT NULL DEFAULT true,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `certification_id` PRIMARY KEY(`id`),
	CONSTRAINT `certification_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `lot` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(32) NOT NULL,
	`external_ref` varchar(64),
	`station_id` int NOT NULL,
	`region_id` int NOT NULL,
	`process` varchar(24) NOT NULL,
	`crop_year` smallint NOT NULL,
	`grade` smallint,
	`altitude_m` smallint,
	`farmer_count` int,
	`cupping_score` decimal(5,2),
	`tasting_notes` json,
	`story` json,
	`photo` varchar(255),
	`low_stock_kg` decimal(12,3),
	`extra` json,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `lot_id` PRIMARY KEY(`id`),
	CONSTRAINT `lot_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `lot_certification` (
	`lot_id` int NOT NULL,
	`certification_id` int NOT NULL,
	`certificate_number` varchar(64),
	CONSTRAINT `lot_certification_lot_id_certification_id_pk` PRIMARY KEY(`lot_id`,`certification_id`),
	CONSTRAINT `lot_certification_number_uq` UNIQUE(`certificate_number`)
);
--> statement-breakpoint
CREATE TABLE `lot_variety` (
	`lot_id` int NOT NULL,
	`variety_id` int NOT NULL,
	CONSTRAINT `lot_variety_lot_id_variety_id_pk` PRIMARY KEY(`lot_id`,`variety_id`)
);
--> statement-breakpoint
CREATE TABLE `region` (
	`id` int AUTO_INCREMENT NOT NULL,
	`parent_id` int,
	`level` varchar(20) NOT NULL,
	`name` json NOT NULL,
	`story` json,
	`status` boolean NOT NULL DEFAULT true,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `region_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `station` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(8) NOT NULL,
	`name` json NOT NULL,
	`type` varchar(24) NOT NULL,
	`region_id` int NOT NULL,
	`altitude_min_m` smallint,
	`altitude_max_m` smallint,
	`latitude` decimal(9,6),
	`longitude` decimal(9,6),
	`farmer_count` int,
	`story` json,
	`photo` varchar(255),
	`extra` json,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `station_id` PRIMARY KEY(`id`),
	CONSTRAINT `station_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `station_certification` (
	`station_id` int NOT NULL,
	`certification_id` int NOT NULL,
	CONSTRAINT `station_certification_station_id_certification_id_pk` PRIMARY KEY(`station_id`,`certification_id`)
);
--> statement-breakpoint
CREATE TABLE `variety` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` json,
	`status` boolean NOT NULL DEFAULT true,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `variety_id` PRIMARY KEY(`id`),
	CONSTRAINT `variety_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `bag_size` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(16) NOT NULL,
	`name` json NOT NULL,
	`grams` int NOT NULL,
	`sort_order` smallint NOT NULL DEFAULT 0,
	`status` boolean NOT NULL DEFAULT true,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `bag_size_id` PRIMARY KEY(`id`),
	CONSTRAINT `bag_size_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `grind` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(16) NOT NULL,
	`name` json NOT NULL,
	`sort_order` smallint NOT NULL DEFAULT 0,
	`status` boolean NOT NULL DEFAULT true,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `grind_id` PRIMARY KEY(`id`),
	CONSTRAINT `grind_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `packaging` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(16) NOT NULL,
	`name` json NOT NULL,
	`surcharge` decimal(14,2) NOT NULL DEFAULT 0,
	`sort_order` smallint NOT NULL DEFAULT 0,
	`status` boolean NOT NULL DEFAULT true,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `packaging_id` PRIMARY KEY(`id`),
	CONSTRAINT `packaging_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `product` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(100) NOT NULL,
	`kind` varchar(24) NOT NULL DEFAULT 'coffee',
	`category_id` int,
	`name` json NOT NULL,
	`summary` json,
	`description` json,
	`origin_story` json,
	`tasting_notes` json,
	`image` varchar(255),
	`fulfilment` varchar(24) NOT NULL DEFAULT 'from_stock',
	`dispatch_days` tinyint NOT NULL DEFAULT 1,
	`tax_rate_id` int,
	`low_stock_roasted_kg` decimal(12,3),
	`is_member_only` boolean NOT NULL DEFAULT false,
	`is_subscribable` boolean NOT NULL DEFAULT true,
	`is_wholesale` boolean NOT NULL DEFAULT false,
	`publish_status` varchar(24) NOT NULL DEFAULT 'draft',
	`sort_order` smallint NOT NULL DEFAULT 0,
	`seo_title` json,
	`seo_description` json,
	`extra` json,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `product_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `product_category` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(64) NOT NULL,
	`name` json NOT NULL,
	`description` json,
	`sort_order` smallint NOT NULL DEFAULT 0,
	`status` boolean NOT NULL DEFAULT true,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `product_category_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_category_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `product_grind` (
	`product_id` int NOT NULL,
	`grind_id` int NOT NULL,
	`is_default` boolean NOT NULL DEFAULT false,
	CONSTRAINT `product_grind_product_id_grind_id_pk` PRIMARY KEY(`product_id`,`grind_id`)
);
--> statement-breakpoint
CREATE TABLE `product_image` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product_id` int NOT NULL,
	`file_name` varchar(255) NOT NULL,
	`alt` json,
	`sort_order` smallint NOT NULL DEFAULT 0,
	CONSTRAINT `product_image_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_origin` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product_id` int NOT NULL,
	`station_id` int,
	`lot_id` int,
	`share_percent` tinyint,
	`sort_order` smallint NOT NULL DEFAULT 0,
	CONSTRAINT `product_origin_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_packaging` (
	`product_id` int NOT NULL,
	`packaging_id` int NOT NULL,
	`is_default` boolean NOT NULL DEFAULT false,
	CONSTRAINT `product_packaging_product_id_packaging_id_pk` PRIMARY KEY(`product_id`,`packaging_id`)
);
--> statement-breakpoint
CREATE TABLE `product_roast_level` (
	`product_id` int NOT NULL,
	`roast_level_id` int NOT NULL,
	`is_default` boolean NOT NULL DEFAULT false,
	CONSTRAINT `product_roast_level_product_id_roast_level_id_pk` PRIMARY KEY(`product_id`,`roast_level_id`)
);
--> statement-breakpoint
CREATE TABLE `product_variant` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product_id` int NOT NULL,
	`sku` varchar(40) NOT NULL,
	`bag_size_id` int,
	`name` json,
	`price` decimal(14,2) NOT NULL DEFAULT 0,
	`compare_at_price` decimal(14,2) NOT NULL DEFAULT 0,
	`currency` char(3) NOT NULL DEFAULT 'ETB',
	`low_stock_units` int,
	`barcode` varchar(40),
	`sort_order` smallint NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `product_variant_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_variant_sku_unique` UNIQUE(`sku`),
	CONSTRAINT `product_variant_size_uq` UNIQUE(`product_id`,`bag_size_id`)
);
--> statement-breakpoint
CREATE TABLE `roast_level` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(16) NOT NULL,
	`name` json NOT NULL,
	`description` json,
	`sort_order` smallint NOT NULL DEFAULT 0,
	`status` boolean NOT NULL DEFAULT true,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `roast_level_id` PRIMARY KEY(`id`),
	CONSTRAINT `roast_level_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `green_stock` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lot_id` int NOT NULL,
	`location_id` int NOT NULL,
	`kg` decimal(12,3) NOT NULL DEFAULT 0,
	`cost_per_kg` decimal(14,2) NOT NULL DEFAULT 0,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `green_stock_id` PRIMARY KEY(`id`),
	CONSTRAINT `green_stock_uq` UNIQUE(`lot_id`,`location_id`)
);
--> statement-breakpoint
CREATE TABLE `packed_stock` (
	`id` int AUTO_INCREMENT NOT NULL,
	`packing_run_id` int NOT NULL,
	`location_id` int NOT NULL,
	`variant_id` int NOT NULL,
	`roast_level_id` int NOT NULL,
	`units` int NOT NULL DEFAULT 0,
	`reserved_units` int NOT NULL DEFAULT 0,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `packed_stock_id` PRIMARY KEY(`id`),
	CONSTRAINT `packed_stock_uq` UNIQUE(`packing_run_id`,`location_id`),
	CONSTRAINT `packed_stock_units_chk` CHECK(`packed_stock`.`units` >= 0 and `packed_stock`.`reserved_units` >= 0)
);
--> statement-breakpoint
CREATE TABLE `packing_run` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(20) NOT NULL,
	`packed_at` datetime NOT NULL,
	`packed_by` varchar(255),
	`location_id` int NOT NULL,
	`variant_id` int NOT NULL,
	`roast_level_id` int NOT NULL,
	`grind_id` int,
	`units` int NOT NULL,
	`best_before` date,
	`label_printed_at` datetime,
	`is_to_order` boolean NOT NULL DEFAULT false,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `packing_run_id` PRIMARY KEY(`id`),
	CONSTRAINT `packing_run_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `packing_run_source` (
	`id` int AUTO_INCREMENT NOT NULL,
	`packing_run_id` int NOT NULL,
	`roast_batch_id` int NOT NULL,
	`roasted_kg` decimal(12,3) NOT NULL DEFAULT 0,
	CONSTRAINT `packing_run_source_id` PRIMARY KEY(`id`),
	CONSTRAINT `packing_run_source_uq` UNIQUE(`packing_run_id`,`roast_batch_id`)
);
--> statement-breakpoint
CREATE TABLE `roast_batch` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(20) NOT NULL,
	`roasted_at` datetime NOT NULL,
	`roaster_id` varchar(255),
	`machine_id` int,
	`location_id` int NOT NULL,
	`product_id` int,
	`roast_level_id` int NOT NULL,
	`green_kg_in` decimal(12,3) NOT NULL DEFAULT 0,
	`roasted_kg_out` decimal(12,3) NOT NULL DEFAULT 0,
	`weight_loss_pct` decimal(5,2) GENERATED ALWAYS AS (round((green_kg_in - roasted_kg_out) / nullif(green_kg_in, 0) * 100, 2)) STORED,
	`duration_min` decimal(5,2),
	`drop_temp_c` decimal(5,1),
	`cupping_score` decimal(5,2),
	`notes` text,
	`is_to_order` boolean NOT NULL DEFAULT false,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `roast_batch_id` PRIMARY KEY(`id`),
	CONSTRAINT `roast_batch_code_unique` UNIQUE(`code`),
	CONSTRAINT `roast_batch_weights_chk` CHECK(`roast_batch`.`roasted_kg_out` <= `roast_batch`.`green_kg_in`)
);
--> statement-breakpoint
CREATE TABLE `roast_batch_input` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roast_batch_id` int NOT NULL,
	`lot_id` int NOT NULL,
	`green_kg` decimal(12,3) NOT NULL DEFAULT 0,
	CONSTRAINT `roast_batch_input_id` PRIMARY KEY(`id`),
	CONSTRAINT `roast_batch_input_uq` UNIQUE(`roast_batch_id`,`lot_id`),
	CONSTRAINT `roast_batch_input_kg_chk` CHECK(`roast_batch_input`.`green_kg` > 0)
);
--> statement-breakpoint
CREATE TABLE `roast_machine` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(64) NOT NULL,
	`location_id` int,
	`capacity_kg` decimal(12,3) NOT NULL DEFAULT 0,
	`status` boolean NOT NULL DEFAULT true,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `roast_machine_id` PRIMARY KEY(`id`),
	CONSTRAINT `roast_machine_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `roasted_stock` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roast_batch_id` int NOT NULL,
	`location_id` int NOT NULL,
	`kg` decimal(12,3) NOT NULL DEFAULT 0,
	`reserved_kg` decimal(12,3) NOT NULL DEFAULT 0,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `roasted_stock_id` PRIMARY KEY(`id`),
	CONSTRAINT `roasted_stock_uq` UNIQUE(`roast_batch_id`,`location_id`)
);
--> statement-breakpoint
CREATE TABLE `stock_count` (
	`id` int AUTO_INCREMENT NOT NULL,
	`location_id` int NOT NULL,
	`stage` varchar(24) NOT NULL,
	`counted_at` datetime NOT NULL,
	`is_opening` boolean NOT NULL DEFAULT false,
	`posted_at` datetime,
	`note` varchar(255),
	`line_count` smallint NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `stock_count_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stock_movement` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`stage` varchar(24) NOT NULL,
	`reason` varchar(24) NOT NULL,
	`location_id` int NOT NULL,
	`lot_id` int,
	`roast_batch_id` int,
	`packing_run_id` int,
	`variant_id` int,
	`roast_level_id` int,
	`quantity` decimal(12,3) NOT NULL,
	`unit_cost` decimal(14,2) NOT NULL DEFAULT 0,
	`ref_type` varchar(32),
	`ref_id` varchar(64),
	`transfer_key` varchar(36),
	`note` varchar(255),
	`occurred_at` datetime NOT NULL,
	`created_by` varchar(255),
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `stock_movement_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `courier` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(64) NOT NULL,
	`phone` varchar(20),
	`tracking_url_template` varchar(255),
	`status` boolean NOT NULL DEFAULT true,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `courier_id` PRIMARY KEY(`id`),
	CONSTRAINT `courier_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `customer` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` varchar(255),
	`name` varchar(150),
	`phone` varchar(20),
	`email` varchar(255),
	`locale` varchar(8) NOT NULL DEFAULT 'am',
	`tin` varchar(20),
	`business_name` varchar(150),
	`telegram_chat_id` varchar(32),
	`source` varchar(32),
	`notes` varchar(500),
	`last_activity_at` datetime,
	`anonymized_at` datetime,
	`extra` json,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `customer_id` PRIMARY KEY(`id`),
	CONSTRAINT `customer_user_id_unique` UNIQUE(`user_id`),
	CONSTRAINT `customer_phone_unique` UNIQUE(`phone`)
);
--> statement-breakpoint
CREATE TABLE `customer_address` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customer_id` int NOT NULL,
	`label` varchar(50),
	`recipient_name` varchar(150),
	`phone` varchar(20),
	`area_id` int,
	`city` varchar(64) NOT NULL DEFAULT 'Addis Ababa',
	`woreda` varchar(64),
	`line1` varchar(255) NOT NULL,
	`landmark` varchar(255),
	`latitude` decimal(9,6),
	`longitude` decimal(9,6),
	`is_default` boolean NOT NULL DEFAULT false,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `customer_address_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `delivery_area` (
	`id` int AUTO_INCREMENT NOT NULL,
	`zone_id` int NOT NULL,
	`name` json NOT NULL,
	`sort_order` smallint NOT NULL DEFAULT 0,
	`status` boolean NOT NULL DEFAULT true,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `delivery_area_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `delivery_zone` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(20) NOT NULL,
	`name` json NOT NULL,
	`fee` decimal(14,2) NOT NULL DEFAULT 0,
	`currency` char(3) NOT NULL DEFAULT 'ETB',
	`free_above` decimal(14,2),
	`free_for_members` boolean NOT NULL DEFAULT true,
	`is_pickup` boolean NOT NULL DEFAULT false,
	`uses_courier` boolean NOT NULL DEFAULT false,
	`transit_days` smallint NOT NULL DEFAULT 0,
	`sort_order` smallint NOT NULL DEFAULT 0,
	`status` boolean NOT NULL DEFAULT true,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `delivery_zone_id` PRIMARY KEY(`id`),
	CONSTRAINT `delivery_zone_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `marketing_consent` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`customer_id` int NOT NULL,
	`channel` varchar(24) NOT NULL,
	`granted` boolean NOT NULL,
	`source` varchar(32) NOT NULL,
	`ip_address` varchar(45),
	`recorded_by` varchar(255),
	`recorded_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `marketing_consent_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `store_credit` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customer_id` int NOT NULL,
	`amount` decimal(14,2) NOT NULL DEFAULT 0,
	`currency` char(3) NOT NULL DEFAULT 'ETB',
	`reason` varchar(24) NOT NULL,
	`ref_type` varchar(32),
	`ref_id` varchar(64),
	`expires_at` datetime,
	`note` varchar(255),
	`created_by` varchar(255),
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `store_credit_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `business_account` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(150) NOT NULL,
	`type` varchar(24) NOT NULL,
	`trade_licence_number` varchar(64) NOT NULL,
	`trade_licence_file` varchar(255),
	`tin` varchar(20) NOT NULL,
	`vat_number` varchar(32),
	`contact_name` varchar(150) NOT NULL,
	`contact_phone` varchar(20) NOT NULL,
	`contact_email` varchar(255),
	`expected_monthly_kg` decimal(12,3),
	`discount_pct` decimal(5,2) NOT NULL DEFAULT 0,
	`credit_approved` boolean NOT NULL DEFAULT false,
	`credit_limit` decimal(14,2) NOT NULL DEFAULT 0,
	`currency` char(3) NOT NULL DEFAULT 'ETB',
	`payment_terms_days` smallint NOT NULL DEFAULT 0,
	`min_order_kg` decimal(12,3),
	`notes` varchar(500),
	`extra` json,
	`approval_status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`requested_by` varchar(255),
	`approved_by` varchar(255),
	`approved_at` datetime,
	`rejected_by` varchar(255),
	`rejected_at` datetime,
	`rejection_reason` varchar(255),
	`approval_overridden` boolean NOT NULL DEFAULT false,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `business_account_id` PRIMARY KEY(`id`),
	CONSTRAINT `business_account_tin_unique` UNIQUE(`tin`)
);
--> statement-breakpoint
CREATE TABLE `business_address` (
	`id` int AUTO_INCREMENT NOT NULL,
	`business_account_id` int NOT NULL,
	`label` varchar(50),
	`area_id` int,
	`city` varchar(64) NOT NULL DEFAULT 'Addis Ababa',
	`line1` varchar(255) NOT NULL,
	`landmark` varchar(255),
	`latitude` decimal(9,6),
	`longitude` decimal(9,6),
	`is_billing` boolean NOT NULL DEFAULT false,
	`is_default_delivery` boolean NOT NULL DEFAULT false,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `business_address_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `business_member` (
	`id` int AUTO_INCREMENT NOT NULL,
	`business_account_id` int NOT NULL,
	`customer_id` int NOT NULL,
	`is_admin` boolean NOT NULL DEFAULT false,
	`status` boolean NOT NULL DEFAULT true,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `business_member_id` PRIMARY KEY(`id`),
	CONSTRAINT `business_member_uq` UNIQUE(`business_account_id`,`customer_id`)
);
--> statement-breakpoint
CREATE TABLE `wholesale_tier` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` json NOT NULL,
	`min_kg` decimal(12,3) NOT NULL DEFAULT 0,
	`max_kg` decimal(12,3),
	`discount_pct` decimal(5,2) NOT NULL DEFAULT 0,
	`sort_order` smallint NOT NULL DEFAULT 0,
	`status` boolean NOT NULL DEFAULT true,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `wholesale_tier_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `discount_code` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(32) NOT NULL,
	`description` varchar(255),
	`kind` varchar(24) NOT NULL,
	`value` decimal(14,2) NOT NULL,
	`currency` char(3) NOT NULL DEFAULT 'ETB',
	`min_order_amount` decimal(14,2) NOT NULL DEFAULT 0,
	`max_discount_amount` decimal(14,2),
	`applies_to` json,
	`starts_at` datetime,
	`expires_at` datetime,
	`usage_limit` int,
	`per_customer_limit` smallint,
	`used_count` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `discount_code_id` PRIMARY KEY(`id`),
	CONSTRAINT `discount_code_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `discount_redemption` (
	`id` int AUTO_INCREMENT NOT NULL,
	`discount_code_id` int NOT NULL,
	`order_id` int NOT NULL,
	`customer_id` int NOT NULL,
	`amount` decimal(14,2) NOT NULL DEFAULT 0,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `discount_redemption_id` PRIMARY KEY(`id`),
	CONSTRAINT `discount_redemption_uq` UNIQUE(`discount_code_id`,`order_id`)
);
--> statement-breakpoint
CREATE TABLE `invoice` (
	`id` int AUTO_INCREMENT NOT NULL,
	`number` varchar(24) NOT NULL,
	`customer_id` int NOT NULL,
	`business_account_id` int,
	`order_id` int,
	`status` varchar(24) NOT NULL DEFAULT 'draft',
	`billing_name` varchar(150) NOT NULL,
	`billing_tin` varchar(20),
	`billing_address` varchar(255),
	`currency` char(3) NOT NULL DEFAULT 'ETB',
	`subtotal` decimal(14,2) NOT NULL DEFAULT 0,
	`tax_total` decimal(14,2) NOT NULL DEFAULT 0,
	`total` decimal(14,2) NOT NULL DEFAULT 0,
	`amount_paid` decimal(14,2) NOT NULL DEFAULT 0,
	`issued_at` datetime,
	`due_on` date,
	`paid_at` datetime,
	`notes` text,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `invoice_id` PRIMARY KEY(`id`),
	CONSTRAINT `invoice_number_unique` UNIQUE(`number`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`number` varchar(20) NOT NULL,
	`channel` varchar(24) NOT NULL DEFAULT 'web',
	`customer_id` int NOT NULL,
	`business_account_id` int,
	`location_id` int,
	`status` varchar(24) NOT NULL DEFAULT 'pending_payment',
	`payment_state` varchar(24) NOT NULL DEFAULT 'unpaid',
	`locale` varchar(8) NOT NULL DEFAULT 'am',
	`contact_name` varchar(150),
	`contact_phone` varchar(20),
	`contact_email` varchar(255),
	`customer_tin` varchar(20),
	`customer_business_name` varchar(150),
	`residency_declared` boolean NOT NULL DEFAULT false,
	`delivery_method` varchar(24) NOT NULL DEFAULT 'none',
	`delivery_zone_id` int,
	`address_id` int,
	`delivery_address` json,
	`pickup_location_id` int,
	`pickup_code` varchar(16),
	`rider_id` varchar(255),
	`courier_id` int,
	`tracking_number` varchar(64),
	`expected_dispatch_on` date,
	`currency` char(3) NOT NULL DEFAULT 'ETB',
	`subtotal` decimal(14,2) NOT NULL DEFAULT 0,
	`discount_total` decimal(14,2) NOT NULL DEFAULT 0,
	`delivery_fee` decimal(14,2) NOT NULL DEFAULT 0,
	`tax_total` decimal(14,2) NOT NULL DEFAULT 0,
	`total` decimal(14,2) NOT NULL DEFAULT 0,
	`amount_paid` decimal(14,2) NOT NULL DEFAULT 0,
	`amount_refunded` decimal(14,2) NOT NULL DEFAULT 0,
	`discount_code_id` int,
	`membership_id` int,
	`receipt_number` varchar(24),
	`pay_token` varchar(64),
	`pay_token_expires_at` datetime,
	`idempotency_key` varchar(64),
	`customer_note` varchar(500),
	`staff_note` varchar(500),
	`placed_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`paid_at` datetime,
	`dispatched_at` datetime,
	`completed_at` datetime,
	`cancelled_at` datetime,
	`cancel_reason` varchar(255),
	`ip_address` varchar(45),
	`extra` json,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_number_unique` UNIQUE(`number`),
	CONSTRAINT `orders_pickup_code_unique` UNIQUE(`pickup_code`),
	CONSTRAINT `orders_receipt_number_unique` UNIQUE(`receipt_number`),
	CONSTRAINT `orders_pay_token_unique` UNIQUE(`pay_token`),
	CONSTRAINT `orders_idempotency_key_unique` UNIQUE(`idempotency_key`)
);
--> statement-breakpoint
CREATE TABLE `order_line` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` int NOT NULL,
	`item_type` varchar(24) NOT NULL,
	`description` json NOT NULL,
	`sku` varchar(40),
	`variant_id` int,
	`roast_level_id` int,
	`grind_id` int,
	`packaging_id` int,
	`fulfilment` varchar(24),
	`roast_batch_id` int,
	`roast_on` date,
	`ticket_type_id` int,
	`audience_id` int,
	`visit_slot_id` int,
	`event_id` int,
	`bookable_id` int,
	`booking_session_id` int,
	`membership_plan_id` int,
	`subscription_plan_id` int,
	`subscription_id` int,
	`quantity` smallint NOT NULL DEFAULT 1,
	`unit_price` decimal(14,2) NOT NULL DEFAULT 0,
	`discount_amount` decimal(14,2) NOT NULL DEFAULT 0,
	`tax_rate_id` int,
	`tax_rate` decimal(5,2) NOT NULL DEFAULT 0,
	`tax_amount` decimal(14,2) NOT NULL DEFAULT 0,
	`line_total` decimal(14,2) NOT NULL DEFAULT 0,
	`refunded_quantity` smallint NOT NULL DEFAULT 0,
	`refunded_amount` decimal(14,2) NOT NULL DEFAULT 0,
	`extra` json,
	CONSTRAINT `order_line_id` PRIMARY KEY(`id`),
	CONSTRAINT `order_line_qty_chk` CHECK(`order_line`.`quantity` > 0),
	CONSTRAINT `order_line_refund_chk` CHECK(`order_line`.`refunded_quantity` <= `order_line`.`quantity`)
);
--> statement-breakpoint
CREATE TABLE `order_status_history` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`order_id` int NOT NULL,
	`from_status` varchar(24),
	`to_status` varchar(24) NOT NULL,
	`note` varchar(255),
	`changed_by` varchar(255),
	`notified` boolean NOT NULL DEFAULT false,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `order_status_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payment` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` int,
	`invoice_id` int,
	`provider` varchar(24) NOT NULL,
	`method` varchar(32),
	`status` varchar(24) NOT NULL DEFAULT 'initiated',
	`amount` decimal(14,2) NOT NULL DEFAULT 0,
	`currency` char(3) NOT NULL DEFAULT 'ETB',
	`fee` decimal(14,2) NOT NULL DEFAULT 0,
	`tx_ref` varchar(64) NOT NULL,
	`provider_ref` varchar(128),
	`checkout_url` varchar(500),
	`failure_reason` varchar(255),
	`response` json,
	`reference` varchar(64),
	`recorded_by` varchar(255),
	`paid_at` datetime,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `payment_id` PRIMARY KEY(`id`),
	CONSTRAINT `payment_tx_ref_unique` UNIQUE(`tx_ref`),
	CONSTRAINT `payment_provider_ref_uq` UNIQUE(`provider`,`provider_ref`)
);
--> statement-breakpoint
CREATE TABLE `refund` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` int NOT NULL,
	`payment_id` int,
	`status` varchar(24) NOT NULL DEFAULT 'requested',
	`amount` decimal(14,2) NOT NULL DEFAULT 0,
	`currency` char(3) NOT NULL DEFAULT 'ETB',
	`fee_retained` decimal(14,2) NOT NULL DEFAULT 0,
	`to_store_credit` boolean NOT NULL DEFAULT false,
	`reason` varchar(255) NOT NULL,
	`is_automatic` boolean NOT NULL DEFAULT false,
	`provider_ref` varchar(128),
	`requested_by` varchar(255),
	`approved_by` varchar(255),
	`processed_at` datetime,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `refund_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `refund_line` (
	`id` int AUTO_INCREMENT NOT NULL,
	`refund_id` int NOT NULL,
	`order_line_id` int NOT NULL,
	`quantity` smallint NOT NULL,
	`amount` decimal(14,2) NOT NULL DEFAULT 0,
	`restock` boolean NOT NULL DEFAULT false,
	CONSTRAINT `refund_line_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `event` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(120) NOT NULL,
	`title` json NOT NULL,
	`summary` json,
	`description` json,
	`image` varchar(255),
	`location_id` int NOT NULL,
	`starts_at` datetime NOT NULL,
	`ends_at` datetime NOT NULL,
	`capacity` smallint NOT NULL,
	`registered` smallint NOT NULL DEFAULT 0,
	`visibility` varchar(24) NOT NULL DEFAULT 'public',
	`is_free` boolean NOT NULL DEFAULT true,
	`includes_entry` boolean NOT NULL DEFAULT false,
	`registration_closes_at` datetime,
	`publish_status` varchar(24) NOT NULL DEFAULT 'draft',
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `event_id` PRIMARY KEY(`id`),
	CONSTRAINT `event_slug_unique` UNIQUE(`slug`),
	CONSTRAINT `event_capacity_chk` CHECK(`event`.`registered` <= `event`.`capacity`)
);
--> statement-breakpoint
CREATE TABLE `scanner_device` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(64) NOT NULL,
	`location_id` int,
	`token_hash` varchar(128) NOT NULL,
	`last_sync_at` datetime,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `scanner_device_id` PRIMARY KEY(`id`),
	CONSTRAINT `scanner_device_token_hash_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `slot_template` (
	`id` int AUTO_INCREMENT NOT NULL,
	`location_id` int NOT NULL,
	`weekday` tinyint NOT NULL,
	`starts_at` time NOT NULL,
	`ends_at` time NOT NULL,
	`capacity` smallint NOT NULL,
	`status` boolean NOT NULL DEFAULT true,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `slot_template_id` PRIMARY KEY(`id`),
	CONSTRAINT `slot_template_uq` UNIQUE(`location_id`,`weekday`,`starts_at`)
);
--> statement-breakpoint
CREATE TABLE `ticket` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(16) NOT NULL,
	`order_id` int,
	`order_line_id` int,
	`customer_id` int,
	`ticket_type_id` int NOT NULL,
	`audience_id` int NOT NULL,
	`visit_slot_id` int,
	`event_id` int,
	`membership_id` int,
	`visit_date` date NOT NULL,
	`holder_name` varchar(150),
	`admits` smallint NOT NULL DEFAULT 1,
	`checked_in` smallint NOT NULL DEFAULT 0,
	`status` varchar(24) NOT NULL DEFAULT 'valid',
	`first_checked_in_at` datetime,
	`locale` varchar(8) NOT NULL DEFAULT 'am',
	`issued_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`cancelled_at` datetime,
	CONSTRAINT `ticket_id` PRIMARY KEY(`id`),
	CONSTRAINT `ticket_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `ticket_change` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticket_id` int NOT NULL,
	`kind` varchar(24) NOT NULL,
	`from_slot_id` int,
	`to_slot_id` int,
	`from_ticket_type_id` int,
	`to_ticket_type_id` int,
	`from_audience_id` int,
	`to_audience_id` int,
	`amount` decimal(14,2) NOT NULL DEFAULT 0,
	`order_id` int,
	`reason` varchar(255),
	`changed_by` varchar(255),
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `ticket_change_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ticket_price` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticket_type_id` int NOT NULL,
	`audience_id` int NOT NULL,
	`price` decimal(14,2) NOT NULL DEFAULT 0,
	`currency` char(3) NOT NULL DEFAULT 'ETB',
	`status` boolean NOT NULL DEFAULT true,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `ticket_price_id` PRIMARY KEY(`id`),
	CONSTRAINT `ticket_price_uq` UNIQUE(`ticket_type_id`,`audience_id`,`currency`)
);
--> statement-breakpoint
CREATE TABLE `ticket_scan` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`client_scan_id` varchar(36) NOT NULL,
	`scanned_code` varchar(64) NOT NULL,
	`ticket_id` int,
	`membership_member_id` int,
	`device_id` int,
	`location_id` int,
	`scanned_by` varchar(255),
	`result` varchar(24) NOT NULL,
	`headcount` smallint NOT NULL DEFAULT 1,
	`was_offline` boolean NOT NULL DEFAULT false,
	`scanned_at` datetime NOT NULL,
	`synced_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `ticket_scan_id` PRIMARY KEY(`id`),
	CONSTRAINT `ticket_scan_client_scan_id_unique` UNIQUE(`client_scan_id`)
);
--> statement-breakpoint
CREATE TABLE `ticket_type` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(24) NOT NULL,
	`name` json NOT NULL,
	`description` json,
	`event_id` int,
	`requires_proof` json,
	`min_quantity` smallint NOT NULL DEFAULT 1,
	`max_quantity` smallint,
	`admits_per_ticket` smallint NOT NULL DEFAULT 1,
	`counts_toward_capacity` boolean NOT NULL DEFAULT true,
	`is_staff_only` boolean NOT NULL DEFAULT false,
	`is_member_only` boolean NOT NULL DEFAULT false,
	`tax_rate_id` int,
	`sort_order` smallint NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `ticket_type_id` PRIMARY KEY(`id`),
	CONSTRAINT `ticket_type_code_uq` UNIQUE(`code`,`event_id`)
);
--> statement-breakpoint
CREATE TABLE `visit_day` (
	`id` int AUTO_INCREMENT NOT NULL,
	`location_id` int NOT NULL,
	`date` date NOT NULL,
	`capacity` smallint NOT NULL,
	`sold` smallint NOT NULL DEFAULT 0,
	`held` smallint NOT NULL DEFAULT 0,
	`is_closed` boolean NOT NULL DEFAULT false,
	`closed_reason` json,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `visit_day_id` PRIMARY KEY(`id`),
	CONSTRAINT `visit_day_uq` UNIQUE(`location_id`,`date`),
	CONSTRAINT `visit_day_capacity_chk` CHECK(`visit_day`.`sold` + `visit_day`.`held` <= `visit_day`.`capacity`)
);
--> statement-breakpoint
CREATE TABLE `visit_slot` (
	`id` int AUTO_INCREMENT NOT NULL,
	`visit_day_id` int NOT NULL,
	`starts_at` datetime NOT NULL,
	`ends_at` datetime NOT NULL,
	`capacity` smallint NOT NULL,
	`sold` smallint NOT NULL DEFAULT 0,
	`held` smallint NOT NULL DEFAULT 0,
	`is_closed` boolean NOT NULL DEFAULT false,
	CONSTRAINT `visit_slot_id` PRIMARY KEY(`id`),
	CONSTRAINT `visit_slot_uq` UNIQUE(`visit_day_id`,`starts_at`),
	CONSTRAINT `visit_slot_capacity_chk` CHECK(`visit_slot`.`sold` + `visit_slot`.`held` <= `visit_slot`.`capacity`)
);
--> statement-breakpoint
CREATE TABLE `membership` (
	`id` int AUTO_INCREMENT NOT NULL,
	`number` varchar(20) NOT NULL,
	`customer_id` int NOT NULL,
	`plan_id` int NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'pending_payment',
	`starts_on` date,
	`ends_on` date,
	`grace_ends_on` date,
	`renewal_method` varchar(24) NOT NULL DEFAULT 'manual_link',
	`renews_membership_id` int,
	`order_line_id` int,
	`cancelled_at` datetime,
	`cancel_reason` varchar(255),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `membership_id` PRIMARY KEY(`id`),
	CONSTRAINT `membership_number_unique` UNIQUE(`number`)
);
--> statement-breakpoint
CREATE TABLE `membership_member` (
	`id` int AUTO_INCREMENT NOT NULL,
	`membership_id` int NOT NULL,
	`name` varchar(150) NOT NULL,
	`is_child` boolean NOT NULL DEFAULT false,
	`birth_year` smallint,
	`card_code` varchar(16) NOT NULL,
	`photo` varchar(255),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `membership_member_id` PRIMARY KEY(`id`),
	CONSTRAINT `membership_member_card_code_unique` UNIQUE(`card_code`)
);
--> statement-breakpoint
CREATE TABLE `membership_plan` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(24) NOT NULL,
	`name` json NOT NULL,
	`description` json,
	`benefits` json,
	`price` decimal(14,2) NOT NULL DEFAULT 0,
	`currency` char(3) NOT NULL DEFAULT 'ETB',
	`tax_rate_id` int,
	`duration_months` tinyint NOT NULL DEFAULT 12,
	`grace_days` tinyint NOT NULL DEFAULT 7,
	`max_adults` tinyint NOT NULL DEFAULT 1,
	`max_children` tinyint NOT NULL DEFAULT 0,
	`shared_card_admits` tinyint,
	`requires_proof` json,
	`free_entry` boolean NOT NULL DEFAULT true,
	`shop_discount_pct` decimal(5,2) NOT NULL DEFAULT 0,
	`free_delivery` boolean NOT NULL DEFAULT true,
	`members_only_events` boolean NOT NULL DEFAULT true,
	`monthly_coffee_variant_id` int,
	`image` varchar(255),
	`publish_status` varchar(24) NOT NULL DEFAULT 'draft',
	`sort_order` smallint NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `membership_plan_id` PRIMARY KEY(`id`),
	CONSTRAINT `membership_plan_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `subscription` (
	`id` int AUTO_INCREMENT NOT NULL,
	`number` varchar(20) NOT NULL,
	`customer_id` int NOT NULL,
	`membership_id` int,
	`status` varchar(24) NOT NULL DEFAULT 'pending_payment',
	`frequency` varchar(24) NOT NULL,
	`variant_id` int NOT NULL,
	`roast_level_id` int NOT NULL,
	`grind_id` int,
	`quantity` tinyint NOT NULL DEFAULT 1,
	`address_id` int,
	`delivery_zone_id` int,
	`deliveries_purchased` smallint NOT NULL DEFAULT 0,
	`deliveries_used` smallint NOT NULL DEFAULT 0,
	`next_roast_date` date,
	`paused_until` date,
	`cancelled_at` datetime,
	`unused_settlement` varchar(16),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `subscription_id` PRIMARY KEY(`id`),
	CONSTRAINT `subscription_number_unique` UNIQUE(`number`)
);
--> statement-breakpoint
CREATE TABLE `subscription_bundle` (
	`id` int AUTO_INCREMENT NOT NULL,
	`subscription_id` int NOT NULL,
	`plan_id` int,
	`order_line_id` int,
	`deliveries` tinyint NOT NULL,
	`discount_pct` decimal(5,2) NOT NULL DEFAULT 0,
	`price_per_delivery` decimal(14,2) NOT NULL DEFAULT 0,
	`purchased_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `subscription_bundle_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subscription_delivery` (
	`id` int AUTO_INCREMENT NOT NULL,
	`subscription_id` int NOT NULL,
	`sequence` smallint NOT NULL,
	`roast_date` date NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'scheduled',
	`order_id` int,
	`skipped_at` datetime,
	`skipped_by` varchar(255),
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `subscription_delivery_id` PRIMARY KEY(`id`),
	CONSTRAINT `subscription_delivery_seq_uq` UNIQUE(`subscription_id`,`sequence`)
);
--> statement-breakpoint
CREATE TABLE `subscription_plan` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` json NOT NULL,
	`deliveries` tinyint NOT NULL,
	`discount_pct` decimal(5,2) NOT NULL DEFAULT 0,
	`sort_order` smallint NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `subscription_plan_id` PRIMARY KEY(`id`),
	CONSTRAINT `subscription_plan_deliveries_uq` UNIQUE(`deliveries`)
);
--> statement-breakpoint
CREATE TABLE `bookable` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(100) NOT NULL,
	`kind` varchar(24) NOT NULL,
	`name` json NOT NULL,
	`description` json,
	`image` varchar(255),
	`location_id` int,
	`duration_min` smallint NOT NULL DEFAULT 60,
	`min_party` smallint NOT NULL DEFAULT 1,
	`max_party` smallint,
	`pricing` varchar(24) NOT NULL DEFAULT 'per_person',
	`requires_prepayment` boolean NOT NULL DEFAULT true,
	`uses_visit_capacity` boolean NOT NULL DEFAULT false,
	`requires_staff` boolean NOT NULL DEFAULT true,
	`is_enquiry_only` boolean NOT NULL DEFAULT false,
	`languages` json,
	`hold_days` tinyint,
	`tax_rate_id` int,
	`publish_status` varchar(24) NOT NULL DEFAULT 'draft',
	`sort_order` smallint NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `bookable_id` PRIMARY KEY(`id`),
	CONSTRAINT `bookable_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `bookable_price` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookable_id` int NOT NULL,
	`audience_id` int NOT NULL,
	`price` decimal(14,2) NOT NULL DEFAULT 0,
	`currency` char(3) NOT NULL DEFAULT 'ETB',
	`status` boolean NOT NULL DEFAULT true,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `bookable_price_id` PRIMARY KEY(`id`),
	CONSTRAINT `bookable_price_uq` UNIQUE(`bookable_id`,`audience_id`,`currency`)
);
--> statement-breakpoint
CREATE TABLE `bookable_schedule` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookable_id` int NOT NULL,
	`weekday` tinyint NOT NULL,
	`starts_at` time NOT NULL,
	`capacity` smallint NOT NULL,
	`language` varchar(8),
	`status` boolean NOT NULL DEFAULT true,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `bookable_schedule_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `booking` (
	`id` int AUTO_INCREMENT NOT NULL,
	`number` varchar(20) NOT NULL,
	`bookable_id` int NOT NULL,
	`session_id` int,
	`visit_slot_id` int,
	`customer_id` int,
	`submission_id` int,
	`status` varchar(24) NOT NULL DEFAULT 'new',
	`contact_name` varchar(150) NOT NULL,
	`contact_phone` varchar(20) NOT NULL,
	`contact_email` varchar(255),
	`organisation_name` varchar(150),
	`tin` varchar(20),
	`party_size` smallint NOT NULL,
	`audience_id` int,
	`language` varchar(8),
	`age_range` varchar(32),
	`event_type` varchar(64),
	`preferred_dates` json,
	`confirmed_starts_at` datetime,
	`special_requests` text,
	`accessibility_needs` varchar(500),
	`held_places` smallint NOT NULL DEFAULT 0,
	`hold_expires_at` datetime,
	`quoted_amount` decimal(14,2) NOT NULL DEFAULT 0,
	`deposit_amount` decimal(14,2) NOT NULL DEFAULT 0,
	`currency` char(3) NOT NULL DEFAULT 'ETB',
	`order_id` int,
	`invoice_id` int,
	`group_ticket_id` int,
	`event_id` int,
	`assigned_to` varchar(255),
	`confirmed_at` datetime,
	`cancelled_at` datetime,
	`cancel_reason` varchar(255),
	`extra` json,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `booking_id` PRIMARY KEY(`id`),
	CONSTRAINT `booking_number_unique` UNIQUE(`number`)
);
--> statement-breakpoint
CREATE TABLE `booking_session` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookable_id` int NOT NULL,
	`starts_at` datetime NOT NULL,
	`ends_at` datetime NOT NULL,
	`language` varchar(8),
	`capacity` smallint NOT NULL,
	`booked` smallint NOT NULL DEFAULT 0,
	`is_cancelled` boolean NOT NULL DEFAULT false,
	`notes` varchar(255),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `booking_session_id` PRIMARY KEY(`id`),
	CONSTRAINT `booking_session_capacity_chk` CHECK(`booking_session`.`booked` <= `booking_session`.`capacity`)
);
--> statement-breakpoint
CREATE TABLE `form_submission` (
	`id` int AUTO_INCREMENT NOT NULL,
	`form_type` varchar(24) NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'new',
	`customer_id` int,
	`name` varchar(150),
	`phone` varchar(20),
	`email` varchar(255),
	`subject` varchar(255),
	`message` text,
	`rating` tinyint,
	`visit_date` date,
	`data` json,
	`locale` varchar(8) NOT NULL DEFAULT 'am',
	`marketing_consent` boolean NOT NULL DEFAULT false,
	`assigned_to` varchar(255),
	`spam_score` tinyint,
	`ip_address` varchar(45),
	`user_agent` varchar(255),
	`first_handled_at` datetime,
	`submitted_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `form_submission_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `staff_assignment` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`session_id` int,
	`booking_id` int,
	`event_id` int,
	`role` varchar(32) NOT NULL DEFAULT 'guide',
	`starts_at` datetime NOT NULL,
	`ends_at` datetime NOT NULL,
	`assigned_by` varchar(255),
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `staff_assignment_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workflow_history` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`submission_id` int,
	`booking_id` int,
	`from_status` varchar(24),
	`to_status` varchar(24) NOT NULL,
	`note` varchar(500),
	`changed_by` varchar(255),
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `workflow_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_conversation` (
	`id` int AUTO_INCREMENT NOT NULL,
	`channel` varchar(24) NOT NULL,
	`external_id` varchar(64) NOT NULL,
	`customer_id` int,
	`locale` varchar(8) NOT NULL DEFAULT 'am',
	`handed_off_to` varchar(255),
	`started_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`last_message_at` datetime,
	CONSTRAINT `ai_conversation_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_message` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`conversation_id` int NOT NULL,
	`role` varchar(16) NOT NULL,
	`content` text NOT NULL,
	`tool_calls` json,
	`model` varchar(64),
	`input_tokens` int,
	`output_tokens` int,
	`rating` smallint,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `ai_message_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `knowledge_entry` (
	`id` int AUTO_INCREMENT NOT NULL,
	`topic` varchar(64) NOT NULL,
	`question` json NOT NULL,
	`answer` json NOT NULL,
	`tags` json,
	`is_public_faq` boolean NOT NULL DEFAULT false,
	`sort_order` smallint NOT NULL DEFAULT 0,
	`embedding_updated_at` datetime,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `knowledge_entry_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `page` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(120) NOT NULL,
	`parent_id` int,
	`template` varchar(32) NOT NULL DEFAULT 'default',
	`title` json NOT NULL,
	`body` json,
	`hero_image` varchar(255),
	`seo_title` json,
	`seo_description` json,
	`show_in_menu` boolean NOT NULL DEFAULT false,
	`sort_order` smallint NOT NULL DEFAULT 0,
	`publish_status` varchar(24) NOT NULL DEFAULT 'draft',
	`published_at` datetime,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `page_id` PRIMARY KEY(`id`),
	CONSTRAINT `page_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `post` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(150) NOT NULL,
	`category_id` int,
	`title` json NOT NULL,
	`excerpt` json,
	`body` json,
	`cover_image` varchar(255),
	`author_id` varchar(255),
	`seo_title` json,
	`seo_description` json,
	`publish_status` varchar(24) NOT NULL DEFAULT 'draft',
	`published_at` datetime,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `post_id` PRIMARY KEY(`id`),
	CONSTRAINT `post_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `post_category` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(64) NOT NULL,
	`name` json NOT NULL,
	`status` boolean NOT NULL DEFAULT true,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `post_category_id` PRIMARY KEY(`id`),
	CONSTRAINT `post_category_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `tour_hotspot` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scene_id` int NOT NULL,
	`kind` varchar(24) NOT NULL,
	`yaw` decimal(7,3) NOT NULL,
	`pitch` decimal(7,3) NOT NULL,
	`title` json NOT NULL,
	`body` json,
	`media` varchar(255),
	`video_url` varchar(255),
	`product_id` int,
	`lot_id` int,
	`station_id` int,
	`bookable_id` int,
	`event_id` int,
	`target_scene_id` int,
	`url` varchar(255),
	`sort_order` smallint NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `tour_hotspot_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tour_scene` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(64) NOT NULL,
	`location_id` int NOT NULL,
	`title` json NOT NULL,
	`description` json,
	`panorama` varchar(255) NOT NULL,
	`preview` varchar(255),
	`initial_yaw` decimal(7,3),
	`initial_pitch` decimal(7,3),
	`is_start` boolean NOT NULL DEFAULT false,
	`sort_order` smallint NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `tour_scene_id` PRIMARY KEY(`id`),
	CONSTRAINT `tour_scene_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `account` ADD CONSTRAINT `account_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `roles` ADD CONSTRAINT `roles_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `session` ADD CONSTRAINT `session_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `two_factor` ADD CONSTRAINT `two_factor_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user` ADD CONSTRAINT `user_role_id_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_role_id_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_permission_id_permissions_id_fk` FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audience` ADD CONSTRAINT `audience_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_log` ADD CONSTRAINT `audit_log_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `calendar_exception` ADD CONSTRAINT `calendar_exception_location_id_location_id_fk` FOREIGN KEY (`location_id`) REFERENCES `location`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `calendar_exception` ADD CONSTRAINT `calendar_exception_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `calendar_exception` ADD CONSTRAINT `calendar_exception_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `calendar_exception` ADD CONSTRAINT `calendar_exception_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `language` ADD CONSTRAINT `language_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `location` ADD CONSTRAINT `location_parent_id_location_id_fk` FOREIGN KEY (`parent_id`) REFERENCES `location`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `location` ADD CONSTRAINT `location_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `location` ADD CONSTRAINT `location_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `location` ADD CONSTRAINT `location_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `media` ADD CONSTRAINT `media_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `media` ADD CONSTRAINT `media_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `media` ADD CONSTRAINT `media_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notification` ADD CONSTRAINT `notification_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notification_template` ADD CONSTRAINT `notification_template_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notification_template` ADD CONSTRAINT `notification_template_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notification_template` ADD CONSTRAINT `notification_template_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `opening_hours` ADD CONSTRAINT `opening_hours_location_id_location_id_fk` FOREIGN KEY (`location_id`) REFERENCES `location`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `setting` ADD CONSTRAINT `setting_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tax_rate` ADD CONSTRAINT `tax_rate_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `certification` ADD CONSTRAINT `certification_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lot` ADD CONSTRAINT `lot_station_id_station_id_fk` FOREIGN KEY (`station_id`) REFERENCES `station`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lot` ADD CONSTRAINT `lot_region_id_region_id_fk` FOREIGN KEY (`region_id`) REFERENCES `region`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lot` ADD CONSTRAINT `lot_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lot` ADD CONSTRAINT `lot_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lot` ADD CONSTRAINT `lot_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lot_certification` ADD CONSTRAINT `lot_certification_lot_id_lot_id_fk` FOREIGN KEY (`lot_id`) REFERENCES `lot`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lot_certification` ADD CONSTRAINT `lot_certification_certification_id_certification_id_fk` FOREIGN KEY (`certification_id`) REFERENCES `certification`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lot_variety` ADD CONSTRAINT `lot_variety_lot_id_lot_id_fk` FOREIGN KEY (`lot_id`) REFERENCES `lot`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lot_variety` ADD CONSTRAINT `lot_variety_variety_id_variety_id_fk` FOREIGN KEY (`variety_id`) REFERENCES `variety`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `region` ADD CONSTRAINT `region_parent_id_region_id_fk` FOREIGN KEY (`parent_id`) REFERENCES `region`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `region` ADD CONSTRAINT `region_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `station` ADD CONSTRAINT `station_region_id_region_id_fk` FOREIGN KEY (`region_id`) REFERENCES `region`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `station` ADD CONSTRAINT `station_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `station` ADD CONSTRAINT `station_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `station` ADD CONSTRAINT `station_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `station_certification` ADD CONSTRAINT `station_certification_station_id_station_id_fk` FOREIGN KEY (`station_id`) REFERENCES `station`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `station_certification` ADD CONSTRAINT `station_certification_certification_id_certification_id_fk` FOREIGN KEY (`certification_id`) REFERENCES `certification`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `variety` ADD CONSTRAINT `variety_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bag_size` ADD CONSTRAINT `bag_size_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `grind` ADD CONSTRAINT `grind_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `packaging` ADD CONSTRAINT `packaging_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product` ADD CONSTRAINT `product_category_id_product_category_id_fk` FOREIGN KEY (`category_id`) REFERENCES `product_category`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product` ADD CONSTRAINT `product_tax_rate_id_tax_rate_id_fk` FOREIGN KEY (`tax_rate_id`) REFERENCES `tax_rate`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product` ADD CONSTRAINT `product_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product` ADD CONSTRAINT `product_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product` ADD CONSTRAINT `product_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_category` ADD CONSTRAINT `product_category_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_grind` ADD CONSTRAINT `product_grind_product_id_product_id_fk` FOREIGN KEY (`product_id`) REFERENCES `product`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_grind` ADD CONSTRAINT `product_grind_grind_id_grind_id_fk` FOREIGN KEY (`grind_id`) REFERENCES `grind`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_image` ADD CONSTRAINT `product_image_product_id_product_id_fk` FOREIGN KEY (`product_id`) REFERENCES `product`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_origin` ADD CONSTRAINT `product_origin_product_id_product_id_fk` FOREIGN KEY (`product_id`) REFERENCES `product`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_origin` ADD CONSTRAINT `product_origin_station_id_station_id_fk` FOREIGN KEY (`station_id`) REFERENCES `station`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_origin` ADD CONSTRAINT `product_origin_lot_id_lot_id_fk` FOREIGN KEY (`lot_id`) REFERENCES `lot`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_packaging` ADD CONSTRAINT `product_packaging_product_id_product_id_fk` FOREIGN KEY (`product_id`) REFERENCES `product`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_packaging` ADD CONSTRAINT `product_packaging_packaging_id_packaging_id_fk` FOREIGN KEY (`packaging_id`) REFERENCES `packaging`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_roast_level` ADD CONSTRAINT `product_roast_level_product_id_product_id_fk` FOREIGN KEY (`product_id`) REFERENCES `product`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_roast_level` ADD CONSTRAINT `product_roast_level_roast_level_id_roast_level_id_fk` FOREIGN KEY (`roast_level_id`) REFERENCES `roast_level`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_variant` ADD CONSTRAINT `product_variant_product_id_product_id_fk` FOREIGN KEY (`product_id`) REFERENCES `product`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_variant` ADD CONSTRAINT `product_variant_bag_size_id_bag_size_id_fk` FOREIGN KEY (`bag_size_id`) REFERENCES `bag_size`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_variant` ADD CONSTRAINT `product_variant_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_variant` ADD CONSTRAINT `product_variant_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_variant` ADD CONSTRAINT `product_variant_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `roast_level` ADD CONSTRAINT `roast_level_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `green_stock` ADD CONSTRAINT `green_stock_lot_id_lot_id_fk` FOREIGN KEY (`lot_id`) REFERENCES `lot`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `green_stock` ADD CONSTRAINT `green_stock_location_id_location_id_fk` FOREIGN KEY (`location_id`) REFERENCES `location`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `packed_stock` ADD CONSTRAINT `packed_stock_packing_run_id_packing_run_id_fk` FOREIGN KEY (`packing_run_id`) REFERENCES `packing_run`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `packed_stock` ADD CONSTRAINT `packed_stock_location_id_location_id_fk` FOREIGN KEY (`location_id`) REFERENCES `location`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `packed_stock` ADD CONSTRAINT `packed_stock_variant_id_product_variant_id_fk` FOREIGN KEY (`variant_id`) REFERENCES `product_variant`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `packed_stock` ADD CONSTRAINT `packed_stock_roast_level_id_roast_level_id_fk` FOREIGN KEY (`roast_level_id`) REFERENCES `roast_level`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `packing_run` ADD CONSTRAINT `packing_run_packed_by_user_id_fk` FOREIGN KEY (`packed_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `packing_run` ADD CONSTRAINT `packing_run_location_id_location_id_fk` FOREIGN KEY (`location_id`) REFERENCES `location`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `packing_run` ADD CONSTRAINT `packing_run_variant_id_product_variant_id_fk` FOREIGN KEY (`variant_id`) REFERENCES `product_variant`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `packing_run` ADD CONSTRAINT `packing_run_roast_level_id_roast_level_id_fk` FOREIGN KEY (`roast_level_id`) REFERENCES `roast_level`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `packing_run` ADD CONSTRAINT `packing_run_grind_id_grind_id_fk` FOREIGN KEY (`grind_id`) REFERENCES `grind`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `packing_run` ADD CONSTRAINT `packing_run_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `packing_run` ADD CONSTRAINT `packing_run_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `packing_run` ADD CONSTRAINT `packing_run_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `packing_run_source` ADD CONSTRAINT `packing_run_source_packing_run_id_packing_run_id_fk` FOREIGN KEY (`packing_run_id`) REFERENCES `packing_run`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `packing_run_source` ADD CONSTRAINT `packing_run_source_roast_batch_id_roast_batch_id_fk` FOREIGN KEY (`roast_batch_id`) REFERENCES `roast_batch`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `roast_batch` ADD CONSTRAINT `roast_batch_roaster_id_user_id_fk` FOREIGN KEY (`roaster_id`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `roast_batch` ADD CONSTRAINT `roast_batch_machine_id_roast_machine_id_fk` FOREIGN KEY (`machine_id`) REFERENCES `roast_machine`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `roast_batch` ADD CONSTRAINT `roast_batch_location_id_location_id_fk` FOREIGN KEY (`location_id`) REFERENCES `location`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `roast_batch` ADD CONSTRAINT `roast_batch_product_id_product_id_fk` FOREIGN KEY (`product_id`) REFERENCES `product`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `roast_batch` ADD CONSTRAINT `roast_batch_roast_level_id_roast_level_id_fk` FOREIGN KEY (`roast_level_id`) REFERENCES `roast_level`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `roast_batch` ADD CONSTRAINT `roast_batch_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `roast_batch` ADD CONSTRAINT `roast_batch_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `roast_batch` ADD CONSTRAINT `roast_batch_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `roast_batch_input` ADD CONSTRAINT `roast_batch_input_roast_batch_id_roast_batch_id_fk` FOREIGN KEY (`roast_batch_id`) REFERENCES `roast_batch`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `roast_batch_input` ADD CONSTRAINT `roast_batch_input_lot_id_lot_id_fk` FOREIGN KEY (`lot_id`) REFERENCES `lot`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `roast_machine` ADD CONSTRAINT `roast_machine_location_id_location_id_fk` FOREIGN KEY (`location_id`) REFERENCES `location`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `roast_machine` ADD CONSTRAINT `roast_machine_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `roasted_stock` ADD CONSTRAINT `roasted_stock_roast_batch_id_roast_batch_id_fk` FOREIGN KEY (`roast_batch_id`) REFERENCES `roast_batch`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `roasted_stock` ADD CONSTRAINT `roasted_stock_location_id_location_id_fk` FOREIGN KEY (`location_id`) REFERENCES `location`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_count` ADD CONSTRAINT `stock_count_location_id_location_id_fk` FOREIGN KEY (`location_id`) REFERENCES `location`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_count` ADD CONSTRAINT `stock_count_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_count` ADD CONSTRAINT `stock_count_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_count` ADD CONSTRAINT `stock_count_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_movement` ADD CONSTRAINT `stock_movement_location_id_location_id_fk` FOREIGN KEY (`location_id`) REFERENCES `location`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_movement` ADD CONSTRAINT `stock_movement_lot_id_lot_id_fk` FOREIGN KEY (`lot_id`) REFERENCES `lot`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_movement` ADD CONSTRAINT `stock_movement_roast_batch_id_roast_batch_id_fk` FOREIGN KEY (`roast_batch_id`) REFERENCES `roast_batch`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_movement` ADD CONSTRAINT `stock_movement_packing_run_id_packing_run_id_fk` FOREIGN KEY (`packing_run_id`) REFERENCES `packing_run`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_movement` ADD CONSTRAINT `stock_movement_variant_id_product_variant_id_fk` FOREIGN KEY (`variant_id`) REFERENCES `product_variant`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_movement` ADD CONSTRAINT `stock_movement_roast_level_id_roast_level_id_fk` FOREIGN KEY (`roast_level_id`) REFERENCES `roast_level`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_movement` ADD CONSTRAINT `stock_movement_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `courier` ADD CONSTRAINT `courier_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer` ADD CONSTRAINT `customer_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer` ADD CONSTRAINT `customer_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer` ADD CONSTRAINT `customer_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer` ADD CONSTRAINT `customer_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_address` ADD CONSTRAINT `customer_address_customer_id_customer_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customer`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_address` ADD CONSTRAINT `customer_address_area_id_delivery_area_id_fk` FOREIGN KEY (`area_id`) REFERENCES `delivery_area`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_address` ADD CONSTRAINT `customer_address_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_address` ADD CONSTRAINT `customer_address_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_address` ADD CONSTRAINT `customer_address_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `delivery_area` ADD CONSTRAINT `delivery_area_zone_id_delivery_zone_id_fk` FOREIGN KEY (`zone_id`) REFERENCES `delivery_zone`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `delivery_area` ADD CONSTRAINT `delivery_area_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `delivery_zone` ADD CONSTRAINT `delivery_zone_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `marketing_consent` ADD CONSTRAINT `marketing_consent_customer_id_customer_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customer`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `marketing_consent` ADD CONSTRAINT `marketing_consent_recorded_by_user_id_fk` FOREIGN KEY (`recorded_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `store_credit` ADD CONSTRAINT `store_credit_customer_id_customer_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customer`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `store_credit` ADD CONSTRAINT `store_credit_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `business_account` ADD CONSTRAINT `business_account_requested_by_user_id_fk` FOREIGN KEY (`requested_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `business_account` ADD CONSTRAINT `business_account_approved_by_user_id_fk` FOREIGN KEY (`approved_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `business_account` ADD CONSTRAINT `business_account_rejected_by_user_id_fk` FOREIGN KEY (`rejected_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `business_account` ADD CONSTRAINT `business_account_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `business_account` ADD CONSTRAINT `business_account_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `business_account` ADD CONSTRAINT `business_account_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `business_address` ADD CONSTRAINT `business_address_business_account_id_business_account_id_fk` FOREIGN KEY (`business_account_id`) REFERENCES `business_account`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `business_address` ADD CONSTRAINT `business_address_area_id_delivery_area_id_fk` FOREIGN KEY (`area_id`) REFERENCES `delivery_area`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `business_address` ADD CONSTRAINT `business_address_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `business_address` ADD CONSTRAINT `business_address_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `business_address` ADD CONSTRAINT `business_address_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `business_member` ADD CONSTRAINT `business_member_business_account_id_business_account_id_fk` FOREIGN KEY (`business_account_id`) REFERENCES `business_account`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `business_member` ADD CONSTRAINT `business_member_customer_id_customer_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customer`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `business_member` ADD CONSTRAINT `business_member_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `wholesale_tier` ADD CONSTRAINT `wholesale_tier_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `discount_code` ADD CONSTRAINT `discount_code_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `discount_code` ADD CONSTRAINT `discount_code_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `discount_code` ADD CONSTRAINT `discount_code_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `discount_redemption` ADD CONSTRAINT `discount_redemption_discount_code_id_discount_code_id_fk` FOREIGN KEY (`discount_code_id`) REFERENCES `discount_code`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `discount_redemption` ADD CONSTRAINT `discount_redemption_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `discount_redemption` ADD CONSTRAINT `discount_redemption_customer_id_customer_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customer`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoice` ADD CONSTRAINT `invoice_customer_id_customer_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customer`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoice` ADD CONSTRAINT `invoice_business_account_id_business_account_id_fk` FOREIGN KEY (`business_account_id`) REFERENCES `business_account`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoice` ADD CONSTRAINT `invoice_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoice` ADD CONSTRAINT `invoice_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoice` ADD CONSTRAINT `invoice_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoice` ADD CONSTRAINT `invoice_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_customer_id_customer_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customer`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_business_account_id_business_account_id_fk` FOREIGN KEY (`business_account_id`) REFERENCES `business_account`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_location_id_location_id_fk` FOREIGN KEY (`location_id`) REFERENCES `location`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_delivery_zone_id_delivery_zone_id_fk` FOREIGN KEY (`delivery_zone_id`) REFERENCES `delivery_zone`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_address_id_customer_address_id_fk` FOREIGN KEY (`address_id`) REFERENCES `customer_address`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_pickup_location_id_location_id_fk` FOREIGN KEY (`pickup_location_id`) REFERENCES `location`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_rider_id_user_id_fk` FOREIGN KEY (`rider_id`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_courier_id_courier_id_fk` FOREIGN KEY (`courier_id`) REFERENCES `courier`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_discount_code_id_discount_code_id_fk` FOREIGN KEY (`discount_code_id`) REFERENCES `discount_code`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_membership_id_membership_id_fk` FOREIGN KEY (`membership_id`) REFERENCES `membership`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_line` ADD CONSTRAINT `order_line_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_line` ADD CONSTRAINT `order_line_variant_id_product_variant_id_fk` FOREIGN KEY (`variant_id`) REFERENCES `product_variant`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_line` ADD CONSTRAINT `order_line_roast_level_id_roast_level_id_fk` FOREIGN KEY (`roast_level_id`) REFERENCES `roast_level`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_line` ADD CONSTRAINT `order_line_grind_id_grind_id_fk` FOREIGN KEY (`grind_id`) REFERENCES `grind`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_line` ADD CONSTRAINT `order_line_packaging_id_packaging_id_fk` FOREIGN KEY (`packaging_id`) REFERENCES `packaging`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_line` ADD CONSTRAINT `order_line_roast_batch_id_roast_batch_id_fk` FOREIGN KEY (`roast_batch_id`) REFERENCES `roast_batch`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_line` ADD CONSTRAINT `order_line_ticket_type_id_ticket_type_id_fk` FOREIGN KEY (`ticket_type_id`) REFERENCES `ticket_type`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_line` ADD CONSTRAINT `order_line_audience_id_audience_id_fk` FOREIGN KEY (`audience_id`) REFERENCES `audience`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_line` ADD CONSTRAINT `order_line_visit_slot_id_visit_slot_id_fk` FOREIGN KEY (`visit_slot_id`) REFERENCES `visit_slot`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_line` ADD CONSTRAINT `order_line_event_id_event_id_fk` FOREIGN KEY (`event_id`) REFERENCES `event`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_line` ADD CONSTRAINT `order_line_bookable_id_bookable_id_fk` FOREIGN KEY (`bookable_id`) REFERENCES `bookable`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_line` ADD CONSTRAINT `order_line_booking_session_id_booking_session_id_fk` FOREIGN KEY (`booking_session_id`) REFERENCES `booking_session`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_line` ADD CONSTRAINT `order_line_membership_plan_id_membership_plan_id_fk` FOREIGN KEY (`membership_plan_id`) REFERENCES `membership_plan`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_line` ADD CONSTRAINT `order_line_subscription_plan_id_subscription_plan_id_fk` FOREIGN KEY (`subscription_plan_id`) REFERENCES `subscription_plan`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_line` ADD CONSTRAINT `order_line_subscription_id_subscription_id_fk` FOREIGN KEY (`subscription_id`) REFERENCES `subscription`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_line` ADD CONSTRAINT `order_line_tax_rate_id_tax_rate_id_fk` FOREIGN KEY (`tax_rate_id`) REFERENCES `tax_rate`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_status_history` ADD CONSTRAINT `order_status_history_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_status_history` ADD CONSTRAINT `order_status_history_changed_by_user_id_fk` FOREIGN KEY (`changed_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment` ADD CONSTRAINT `payment_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment` ADD CONSTRAINT `payment_invoice_id_invoice_id_fk` FOREIGN KEY (`invoice_id`) REFERENCES `invoice`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment` ADD CONSTRAINT `payment_recorded_by_user_id_fk` FOREIGN KEY (`recorded_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `refund` ADD CONSTRAINT `refund_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `refund` ADD CONSTRAINT `refund_payment_id_payment_id_fk` FOREIGN KEY (`payment_id`) REFERENCES `payment`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `refund` ADD CONSTRAINT `refund_requested_by_user_id_fk` FOREIGN KEY (`requested_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `refund` ADD CONSTRAINT `refund_approved_by_user_id_fk` FOREIGN KEY (`approved_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `refund_line` ADD CONSTRAINT `refund_line_refund_id_refund_id_fk` FOREIGN KEY (`refund_id`) REFERENCES `refund`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `refund_line` ADD CONSTRAINT `refund_line_order_line_id_order_line_id_fk` FOREIGN KEY (`order_line_id`) REFERENCES `order_line`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `event` ADD CONSTRAINT `event_location_id_location_id_fk` FOREIGN KEY (`location_id`) REFERENCES `location`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `event` ADD CONSTRAINT `event_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `event` ADD CONSTRAINT `event_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `event` ADD CONSTRAINT `event_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `scanner_device` ADD CONSTRAINT `scanner_device_location_id_location_id_fk` FOREIGN KEY (`location_id`) REFERENCES `location`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `scanner_device` ADD CONSTRAINT `scanner_device_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `scanner_device` ADD CONSTRAINT `scanner_device_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `scanner_device` ADD CONSTRAINT `scanner_device_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `slot_template` ADD CONSTRAINT `slot_template_location_id_location_id_fk` FOREIGN KEY (`location_id`) REFERENCES `location`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `slot_template` ADD CONSTRAINT `slot_template_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticket` ADD CONSTRAINT `ticket_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticket` ADD CONSTRAINT `ticket_order_line_id_order_line_id_fk` FOREIGN KEY (`order_line_id`) REFERENCES `order_line`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticket` ADD CONSTRAINT `ticket_customer_id_customer_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customer`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticket` ADD CONSTRAINT `ticket_ticket_type_id_ticket_type_id_fk` FOREIGN KEY (`ticket_type_id`) REFERENCES `ticket_type`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticket` ADD CONSTRAINT `ticket_audience_id_audience_id_fk` FOREIGN KEY (`audience_id`) REFERENCES `audience`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticket` ADD CONSTRAINT `ticket_visit_slot_id_visit_slot_id_fk` FOREIGN KEY (`visit_slot_id`) REFERENCES `visit_slot`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticket` ADD CONSTRAINT `ticket_event_id_event_id_fk` FOREIGN KEY (`event_id`) REFERENCES `event`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticket` ADD CONSTRAINT `ticket_membership_id_membership_id_fk` FOREIGN KEY (`membership_id`) REFERENCES `membership`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticket_change` ADD CONSTRAINT `ticket_change_ticket_id_ticket_id_fk` FOREIGN KEY (`ticket_id`) REFERENCES `ticket`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticket_change` ADD CONSTRAINT `ticket_change_from_slot_id_visit_slot_id_fk` FOREIGN KEY (`from_slot_id`) REFERENCES `visit_slot`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticket_change` ADD CONSTRAINT `ticket_change_to_slot_id_visit_slot_id_fk` FOREIGN KEY (`to_slot_id`) REFERENCES `visit_slot`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticket_change` ADD CONSTRAINT `ticket_change_from_ticket_type_id_ticket_type_id_fk` FOREIGN KEY (`from_ticket_type_id`) REFERENCES `ticket_type`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticket_change` ADD CONSTRAINT `ticket_change_to_ticket_type_id_ticket_type_id_fk` FOREIGN KEY (`to_ticket_type_id`) REFERENCES `ticket_type`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticket_change` ADD CONSTRAINT `ticket_change_from_audience_id_audience_id_fk` FOREIGN KEY (`from_audience_id`) REFERENCES `audience`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticket_change` ADD CONSTRAINT `ticket_change_to_audience_id_audience_id_fk` FOREIGN KEY (`to_audience_id`) REFERENCES `audience`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticket_change` ADD CONSTRAINT `ticket_change_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticket_change` ADD CONSTRAINT `ticket_change_changed_by_user_id_fk` FOREIGN KEY (`changed_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticket_price` ADD CONSTRAINT `ticket_price_ticket_type_id_ticket_type_id_fk` FOREIGN KEY (`ticket_type_id`) REFERENCES `ticket_type`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticket_price` ADD CONSTRAINT `ticket_price_audience_id_audience_id_fk` FOREIGN KEY (`audience_id`) REFERENCES `audience`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticket_price` ADD CONSTRAINT `ticket_price_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticket_scan` ADD CONSTRAINT `ticket_scan_ticket_id_ticket_id_fk` FOREIGN KEY (`ticket_id`) REFERENCES `ticket`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticket_scan` ADD CONSTRAINT `ticket_scan_membership_member_id_membership_member_id_fk` FOREIGN KEY (`membership_member_id`) REFERENCES `membership_member`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticket_scan` ADD CONSTRAINT `ticket_scan_device_id_scanner_device_id_fk` FOREIGN KEY (`device_id`) REFERENCES `scanner_device`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticket_scan` ADD CONSTRAINT `ticket_scan_location_id_location_id_fk` FOREIGN KEY (`location_id`) REFERENCES `location`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticket_scan` ADD CONSTRAINT `ticket_scan_scanned_by_user_id_fk` FOREIGN KEY (`scanned_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticket_type` ADD CONSTRAINT `ticket_type_event_id_event_id_fk` FOREIGN KEY (`event_id`) REFERENCES `event`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticket_type` ADD CONSTRAINT `ticket_type_tax_rate_id_tax_rate_id_fk` FOREIGN KEY (`tax_rate_id`) REFERENCES `tax_rate`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticket_type` ADD CONSTRAINT `ticket_type_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticket_type` ADD CONSTRAINT `ticket_type_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticket_type` ADD CONSTRAINT `ticket_type_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `visit_day` ADD CONSTRAINT `visit_day_location_id_location_id_fk` FOREIGN KEY (`location_id`) REFERENCES `location`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `visit_day` ADD CONSTRAINT `visit_day_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `visit_day` ADD CONSTRAINT `visit_day_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `visit_day` ADD CONSTRAINT `visit_day_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `visit_slot` ADD CONSTRAINT `visit_slot_visit_day_id_visit_day_id_fk` FOREIGN KEY (`visit_day_id`) REFERENCES `visit_day`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `membership` ADD CONSTRAINT `membership_customer_id_customer_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customer`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `membership` ADD CONSTRAINT `membership_plan_id_membership_plan_id_fk` FOREIGN KEY (`plan_id`) REFERENCES `membership_plan`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `membership` ADD CONSTRAINT `membership_renews_membership_id_membership_id_fk` FOREIGN KEY (`renews_membership_id`) REFERENCES `membership`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `membership` ADD CONSTRAINT `membership_order_line_id_order_line_id_fk` FOREIGN KEY (`order_line_id`) REFERENCES `order_line`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `membership` ADD CONSTRAINT `membership_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `membership` ADD CONSTRAINT `membership_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `membership` ADD CONSTRAINT `membership_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `membership_member` ADD CONSTRAINT `membership_member_membership_id_membership_id_fk` FOREIGN KEY (`membership_id`) REFERENCES `membership`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `membership_member` ADD CONSTRAINT `membership_member_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `membership_member` ADD CONSTRAINT `membership_member_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `membership_member` ADD CONSTRAINT `membership_member_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `membership_plan` ADD CONSTRAINT `membership_plan_tax_rate_id_tax_rate_id_fk` FOREIGN KEY (`tax_rate_id`) REFERENCES `tax_rate`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `membership_plan` ADD CONSTRAINT `membership_plan_monthly_coffee_variant_id_product_variant_id_fk` FOREIGN KEY (`monthly_coffee_variant_id`) REFERENCES `product_variant`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `membership_plan` ADD CONSTRAINT `membership_plan_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `membership_plan` ADD CONSTRAINT `membership_plan_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `membership_plan` ADD CONSTRAINT `membership_plan_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscription` ADD CONSTRAINT `subscription_customer_id_customer_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customer`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscription` ADD CONSTRAINT `subscription_membership_id_membership_id_fk` FOREIGN KEY (`membership_id`) REFERENCES `membership`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscription` ADD CONSTRAINT `subscription_variant_id_product_variant_id_fk` FOREIGN KEY (`variant_id`) REFERENCES `product_variant`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscription` ADD CONSTRAINT `subscription_roast_level_id_roast_level_id_fk` FOREIGN KEY (`roast_level_id`) REFERENCES `roast_level`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscription` ADD CONSTRAINT `subscription_grind_id_grind_id_fk` FOREIGN KEY (`grind_id`) REFERENCES `grind`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscription` ADD CONSTRAINT `subscription_address_id_customer_address_id_fk` FOREIGN KEY (`address_id`) REFERENCES `customer_address`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscription` ADD CONSTRAINT `subscription_delivery_zone_id_delivery_zone_id_fk` FOREIGN KEY (`delivery_zone_id`) REFERENCES `delivery_zone`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscription` ADD CONSTRAINT `subscription_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscription` ADD CONSTRAINT `subscription_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscription` ADD CONSTRAINT `subscription_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscription_bundle` ADD CONSTRAINT `subscription_bundle_subscription_id_subscription_id_fk` FOREIGN KEY (`subscription_id`) REFERENCES `subscription`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscription_bundle` ADD CONSTRAINT `subscription_bundle_plan_id_subscription_plan_id_fk` FOREIGN KEY (`plan_id`) REFERENCES `subscription_plan`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscription_bundle` ADD CONSTRAINT `subscription_bundle_order_line_id_order_line_id_fk` FOREIGN KEY (`order_line_id`) REFERENCES `order_line`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscription_delivery` ADD CONSTRAINT `subscription_delivery_subscription_id_subscription_id_fk` FOREIGN KEY (`subscription_id`) REFERENCES `subscription`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscription_delivery` ADD CONSTRAINT `subscription_delivery_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscription_delivery` ADD CONSTRAINT `subscription_delivery_skipped_by_user_id_fk` FOREIGN KEY (`skipped_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscription_plan` ADD CONSTRAINT `subscription_plan_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscription_plan` ADD CONSTRAINT `subscription_plan_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscription_plan` ADD CONSTRAINT `subscription_plan_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bookable` ADD CONSTRAINT `bookable_location_id_location_id_fk` FOREIGN KEY (`location_id`) REFERENCES `location`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bookable` ADD CONSTRAINT `bookable_tax_rate_id_tax_rate_id_fk` FOREIGN KEY (`tax_rate_id`) REFERENCES `tax_rate`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bookable` ADD CONSTRAINT `bookable_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bookable` ADD CONSTRAINT `bookable_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bookable` ADD CONSTRAINT `bookable_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bookable_price` ADD CONSTRAINT `bookable_price_bookable_id_bookable_id_fk` FOREIGN KEY (`bookable_id`) REFERENCES `bookable`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bookable_price` ADD CONSTRAINT `bookable_price_audience_id_audience_id_fk` FOREIGN KEY (`audience_id`) REFERENCES `audience`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bookable_price` ADD CONSTRAINT `bookable_price_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bookable_schedule` ADD CONSTRAINT `bookable_schedule_bookable_id_bookable_id_fk` FOREIGN KEY (`bookable_id`) REFERENCES `bookable`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bookable_schedule` ADD CONSTRAINT `bookable_schedule_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking` ADD CONSTRAINT `booking_bookable_id_bookable_id_fk` FOREIGN KEY (`bookable_id`) REFERENCES `bookable`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking` ADD CONSTRAINT `booking_session_id_booking_session_id_fk` FOREIGN KEY (`session_id`) REFERENCES `booking_session`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking` ADD CONSTRAINT `booking_visit_slot_id_visit_slot_id_fk` FOREIGN KEY (`visit_slot_id`) REFERENCES `visit_slot`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking` ADD CONSTRAINT `booking_customer_id_customer_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customer`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking` ADD CONSTRAINT `booking_submission_id_form_submission_id_fk` FOREIGN KEY (`submission_id`) REFERENCES `form_submission`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking` ADD CONSTRAINT `booking_audience_id_audience_id_fk` FOREIGN KEY (`audience_id`) REFERENCES `audience`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking` ADD CONSTRAINT `booking_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking` ADD CONSTRAINT `booking_invoice_id_invoice_id_fk` FOREIGN KEY (`invoice_id`) REFERENCES `invoice`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking` ADD CONSTRAINT `booking_group_ticket_id_ticket_id_fk` FOREIGN KEY (`group_ticket_id`) REFERENCES `ticket`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking` ADD CONSTRAINT `booking_event_id_event_id_fk` FOREIGN KEY (`event_id`) REFERENCES `event`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking` ADD CONSTRAINT `booking_assigned_to_user_id_fk` FOREIGN KEY (`assigned_to`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking` ADD CONSTRAINT `booking_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking` ADD CONSTRAINT `booking_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking` ADD CONSTRAINT `booking_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking_session` ADD CONSTRAINT `booking_session_bookable_id_bookable_id_fk` FOREIGN KEY (`bookable_id`) REFERENCES `bookable`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking_session` ADD CONSTRAINT `booking_session_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking_session` ADD CONSTRAINT `booking_session_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking_session` ADD CONSTRAINT `booking_session_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `form_submission` ADD CONSTRAINT `form_submission_customer_id_customer_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customer`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `form_submission` ADD CONSTRAINT `form_submission_assigned_to_user_id_fk` FOREIGN KEY (`assigned_to`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `form_submission` ADD CONSTRAINT `form_submission_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `form_submission` ADD CONSTRAINT `form_submission_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `form_submission` ADD CONSTRAINT `form_submission_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staff_assignment` ADD CONSTRAINT `staff_assignment_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staff_assignment` ADD CONSTRAINT `staff_assignment_session_id_booking_session_id_fk` FOREIGN KEY (`session_id`) REFERENCES `booking_session`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staff_assignment` ADD CONSTRAINT `staff_assignment_booking_id_booking_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `booking`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staff_assignment` ADD CONSTRAINT `staff_assignment_event_id_event_id_fk` FOREIGN KEY (`event_id`) REFERENCES `event`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staff_assignment` ADD CONSTRAINT `staff_assignment_assigned_by_user_id_fk` FOREIGN KEY (`assigned_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workflow_history` ADD CONSTRAINT `workflow_history_submission_id_form_submission_id_fk` FOREIGN KEY (`submission_id`) REFERENCES `form_submission`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workflow_history` ADD CONSTRAINT `workflow_history_booking_id_booking_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `booking`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workflow_history` ADD CONSTRAINT `workflow_history_changed_by_user_id_fk` FOREIGN KEY (`changed_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ai_conversation` ADD CONSTRAINT `ai_conversation_customer_id_customer_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customer`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ai_conversation` ADD CONSTRAINT `ai_conversation_handed_off_to_user_id_fk` FOREIGN KEY (`handed_off_to`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ai_message` ADD CONSTRAINT `ai_message_conversation_id_ai_conversation_id_fk` FOREIGN KEY (`conversation_id`) REFERENCES `ai_conversation`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `knowledge_entry` ADD CONSTRAINT `knowledge_entry_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `knowledge_entry` ADD CONSTRAINT `knowledge_entry_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `knowledge_entry` ADD CONSTRAINT `knowledge_entry_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `page` ADD CONSTRAINT `page_parent_id_page_id_fk` FOREIGN KEY (`parent_id`) REFERENCES `page`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `page` ADD CONSTRAINT `page_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `page` ADD CONSTRAINT `page_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `page` ADD CONSTRAINT `page_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `post` ADD CONSTRAINT `post_category_id_post_category_id_fk` FOREIGN KEY (`category_id`) REFERENCES `post_category`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `post` ADD CONSTRAINT `post_author_id_user_id_fk` FOREIGN KEY (`author_id`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `post` ADD CONSTRAINT `post_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `post` ADD CONSTRAINT `post_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `post` ADD CONSTRAINT `post_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `post_category` ADD CONSTRAINT `post_category_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tour_hotspot` ADD CONSTRAINT `tour_hotspot_scene_id_tour_scene_id_fk` FOREIGN KEY (`scene_id`) REFERENCES `tour_scene`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tour_hotspot` ADD CONSTRAINT `tour_hotspot_product_id_product_id_fk` FOREIGN KEY (`product_id`) REFERENCES `product`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tour_hotspot` ADD CONSTRAINT `tour_hotspot_lot_id_lot_id_fk` FOREIGN KEY (`lot_id`) REFERENCES `lot`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tour_hotspot` ADD CONSTRAINT `tour_hotspot_station_id_station_id_fk` FOREIGN KEY (`station_id`) REFERENCES `station`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tour_hotspot` ADD CONSTRAINT `tour_hotspot_bookable_id_bookable_id_fk` FOREIGN KEY (`bookable_id`) REFERENCES `bookable`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tour_hotspot` ADD CONSTRAINT `tour_hotspot_event_id_event_id_fk` FOREIGN KEY (`event_id`) REFERENCES `event`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tour_hotspot` ADD CONSTRAINT `tour_hotspot_target_scene_id_tour_scene_id_fk` FOREIGN KEY (`target_scene_id`) REFERENCES `tour_scene`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tour_hotspot` ADD CONSTRAINT `tour_hotspot_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tour_hotspot` ADD CONSTRAINT `tour_hotspot_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tour_hotspot` ADD CONSTRAINT `tour_hotspot_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tour_scene` ADD CONSTRAINT `tour_scene_location_id_location_id_fk` FOREIGN KEY (`location_id`) REFERENCES `location`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tour_scene` ADD CONSTRAINT `tour_scene_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tour_scene` ADD CONSTRAINT `tour_scene_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tour_scene` ADD CONSTRAINT `tour_scene_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE INDEX `two_factor_userId_idx` ON `two_factor` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_kind_idx` ON `user` (`kind`);--> statement-breakpoint
CREATE INDEX `user_role_idx` ON `user` (`role_id`);--> statement-breakpoint
CREATE INDEX `user_telegram_idx` ON `user` (`telegram_id`);--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
CREATE INDEX `role_permissions_role_idx` ON `role_permissions` (`role_id`,`permission_id`);--> statement-breakpoint
CREATE INDEX `audit_log_record_idx` ON `audit_log` (`table_name`,`record_id`,`id`);--> statement-breakpoint
CREATE INDEX `audit_log_created_idx` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `calendar_exception_date_idx` ON `calendar_exception` (`date`,`location_id`);--> statement-breakpoint
CREATE INDEX `location_type_idx` ON `location` (`type`);--> statement-breakpoint
CREATE INDEX `media_folder_idx` ON `media` (`folder`);--> statement-breakpoint
CREATE INDEX `notification_queue_idx` ON `notification` (`status`,`scheduled_for`);--> statement-breakpoint
CREATE INDEX `notification_ref_idx` ON `notification` (`ref_type`,`ref_id`);--> statement-breakpoint
CREATE INDEX `notification_customer_idx` ON `notification` (`customer_id`);--> statement-breakpoint
CREATE INDEX `lot_station_idx` ON `lot` (`station_id`,`crop_year`);--> statement-breakpoint
CREATE INDEX `lot_process_idx` ON `lot` (`process`);--> statement-breakpoint
CREATE INDEX `region_parent_idx` ON `region` (`parent_id`);--> statement-breakpoint
CREATE INDEX `station_region_idx` ON `station` (`region_id`);--> statement-breakpoint
CREATE INDEX `product_category_idx` ON `product` (`category_id`);--> statement-breakpoint
CREATE INDEX `product_publish_idx` ON `product` (`publish_status`,`sort_order`);--> statement-breakpoint
CREATE INDEX `product_image_product_idx` ON `product_image` (`product_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `product_origin_product_idx` ON `product_origin` (`product_id`);--> statement-breakpoint
CREATE INDEX `product_variant_product_idx` ON `product_variant` (`product_id`);--> statement-breakpoint
CREATE INDEX `packed_stock_lookup_idx` ON `packed_stock` (`variant_id`,`roast_level_id`,`location_id`);--> statement-breakpoint
CREATE INDEX `packing_run_variant_idx` ON `packing_run` (`variant_id`,`roast_level_id`);--> statement-breakpoint
CREATE INDEX `packing_run_packed_idx` ON `packing_run` (`packed_at`);--> statement-breakpoint
CREATE INDEX `packing_run_source_batch_idx` ON `packing_run_source` (`roast_batch_id`);--> statement-breakpoint
CREATE INDEX `roast_batch_roasted_idx` ON `roast_batch` (`roasted_at`);--> statement-breakpoint
CREATE INDEX `roast_batch_product_idx` ON `roast_batch` (`product_id`);--> statement-breakpoint
CREATE INDEX `roast_batch_input_lot_idx` ON `roast_batch_input` (`lot_id`);--> statement-breakpoint
CREATE INDEX `stock_movement_stage_idx` ON `stock_movement` (`stage`,`location_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `stock_movement_lot_idx` ON `stock_movement` (`lot_id`);--> statement-breakpoint
CREATE INDEX `stock_movement_batch_idx` ON `stock_movement` (`roast_batch_id`);--> statement-breakpoint
CREATE INDEX `stock_movement_run_idx` ON `stock_movement` (`packing_run_id`);--> statement-breakpoint
CREATE INDEX `stock_movement_ref_idx` ON `stock_movement` (`ref_type`,`ref_id`);--> statement-breakpoint
CREATE INDEX `customer_email_idx` ON `customer` (`email`);--> statement-breakpoint
CREATE INDEX `customer_name_idx` ON `customer` (`name`);--> statement-breakpoint
CREATE INDEX `customer_activity_idx` ON `customer` (`last_activity_at`);--> statement-breakpoint
CREATE INDEX `customer_address_customer_idx` ON `customer_address` (`customer_id`);--> statement-breakpoint
CREATE INDEX `delivery_area_zone_idx` ON `delivery_area` (`zone_id`);--> statement-breakpoint
CREATE INDEX `marketing_consent_latest_idx` ON `marketing_consent` (`customer_id`,`channel`,`id`);--> statement-breakpoint
CREATE INDEX `store_credit_customer_idx` ON `store_credit` (`customer_id`);--> statement-breakpoint
CREATE INDEX `business_account_approval_idx` ON `business_account` (`approval_status`);--> statement-breakpoint
CREATE INDEX `business_address_account_idx` ON `business_address` (`business_account_id`);--> statement-breakpoint
CREATE INDEX `business_member_customer_idx` ON `business_member` (`customer_id`);--> statement-breakpoint
CREATE INDEX `discount_redemption_customer_idx` ON `discount_redemption` (`discount_code_id`,`customer_id`);--> statement-breakpoint
CREATE INDEX `invoice_status_idx` ON `invoice` (`status`,`due_on`);--> statement-breakpoint
CREATE INDEX `invoice_business_idx` ON `invoice` (`business_account_id`);--> statement-breakpoint
CREATE INDEX `order_customer_idx` ON `orders` (`customer_id`,`placed_at`);--> statement-breakpoint
CREATE INDEX `order_status_idx` ON `orders` (`status`,`placed_at`);--> statement-breakpoint
CREATE INDEX `order_paid_idx` ON `orders` (`paid_at`);--> statement-breakpoint
CREATE INDEX `order_dispatch_idx` ON `orders` (`expected_dispatch_on`,`status`);--> statement-breakpoint
CREATE INDEX `order_business_idx` ON `orders` (`business_account_id`);--> statement-breakpoint
CREATE INDEX `order_line_order_idx` ON `order_line` (`order_id`);--> statement-breakpoint
CREATE INDEX `order_line_variant_idx` ON `order_line` (`variant_id`);--> statement-breakpoint
CREATE INDEX `order_line_roast_queue_idx` ON `order_line` (`roast_on`,`roast_batch_id`);--> statement-breakpoint
CREATE INDEX `order_line_slot_idx` ON `order_line` (`visit_slot_id`);--> statement-breakpoint
CREATE INDEX `order_status_history_order_idx` ON `order_status_history` (`order_id`);--> statement-breakpoint
CREATE INDEX `payment_order_idx` ON `payment` (`order_id`);--> statement-breakpoint
CREATE INDEX `payment_invoice_idx` ON `payment` (`invoice_id`);--> statement-breakpoint
CREATE INDEX `payment_status_idx` ON `payment` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `refund_order_idx` ON `refund` (`order_id`);--> statement-breakpoint
CREATE INDEX `refund_line_refund_idx` ON `refund_line` (`refund_id`);--> statement-breakpoint
CREATE INDEX `event_starts_idx` ON `event` (`starts_at`);--> statement-breakpoint
CREATE INDEX `ticket_day_idx` ON `ticket` (`visit_date`,`status`);--> statement-breakpoint
CREATE INDEX `ticket_slot_idx` ON `ticket` (`visit_slot_id`);--> statement-breakpoint
CREATE INDEX `ticket_event_idx` ON `ticket` (`event_id`);--> statement-breakpoint
CREATE INDEX `ticket_order_idx` ON `ticket` (`order_id`);--> statement-breakpoint
CREATE INDEX `ticket_customer_idx` ON `ticket` (`customer_id`);--> statement-breakpoint
CREATE INDEX `ticket_change_ticket_idx` ON `ticket_change` (`ticket_id`);--> statement-breakpoint
CREATE INDEX `ticket_scan_ticket_idx` ON `ticket_scan` (`ticket_id`);--> statement-breakpoint
CREATE INDEX `ticket_scan_time_idx` ON `ticket_scan` (`scanned_at`);--> statement-breakpoint
CREATE INDEX `visit_slot_starts_idx` ON `visit_slot` (`starts_at`);--> statement-breakpoint
CREATE INDEX `membership_customer_idx` ON `membership` (`customer_id`);--> statement-breakpoint
CREATE INDEX `membership_expiry_idx` ON `membership` (`status`,`ends_on`);--> statement-breakpoint
CREATE INDEX `membership_member_membership_idx` ON `membership_member` (`membership_id`);--> statement-breakpoint
CREATE INDEX `subscription_customer_idx` ON `subscription` (`customer_id`);--> statement-breakpoint
CREATE INDEX `subscription_next_idx` ON `subscription` (`status`,`next_roast_date`);--> statement-breakpoint
CREATE INDEX `subscription_bundle_sub_idx` ON `subscription_bundle` (`subscription_id`);--> statement-breakpoint
CREATE INDEX `subscription_delivery_roast_idx` ON `subscription_delivery` (`roast_date`,`status`);--> statement-breakpoint
CREATE INDEX `bookable_schedule_idx` ON `bookable_schedule` (`bookable_id`,`weekday`);--> statement-breakpoint
CREATE INDEX `booking_status_idx` ON `booking` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `booking_session_idx` ON `booking` (`session_id`);--> statement-breakpoint
CREATE INDEX `booking_slot_idx` ON `booking` (`visit_slot_id`);--> statement-breakpoint
CREATE INDEX `booking_customer_idx` ON `booking` (`customer_id`);--> statement-breakpoint
CREATE INDEX `booking_hold_idx` ON `booking` (`hold_expires_at`);--> statement-breakpoint
CREATE INDEX `booking_session_starts_idx` ON `booking_session` (`bookable_id`,`starts_at`);--> statement-breakpoint
CREATE INDEX `form_submission_inbox_idx` ON `form_submission` (`status`,`submitted_at`);--> statement-breakpoint
CREATE INDEX `form_submission_type_idx` ON `form_submission` (`form_type`,`submitted_at`);--> statement-breakpoint
CREATE INDEX `form_submission_customer_idx` ON `form_submission` (`customer_id`);--> statement-breakpoint
CREATE INDEX `staff_assignment_user_idx` ON `staff_assignment` (`user_id`,`starts_at`);--> statement-breakpoint
CREATE INDEX `staff_assignment_session_idx` ON `staff_assignment` (`session_id`);--> statement-breakpoint
CREATE INDEX `staff_assignment_booking_idx` ON `staff_assignment` (`booking_id`);--> statement-breakpoint
CREATE INDEX `workflow_history_submission_idx` ON `workflow_history` (`submission_id`);--> statement-breakpoint
CREATE INDEX `workflow_history_booking_idx` ON `workflow_history` (`booking_id`);--> statement-breakpoint
CREATE INDEX `ai_conversation_external_idx` ON `ai_conversation` (`channel`,`external_id`);--> statement-breakpoint
CREATE INDEX `ai_conversation_customer_idx` ON `ai_conversation` (`customer_id`);--> statement-breakpoint
CREATE INDEX `ai_message_conversation_idx` ON `ai_message` (`conversation_id`,`id`);--> statement-breakpoint
CREATE INDEX `knowledge_entry_topic_idx` ON `knowledge_entry` (`topic`);--> statement-breakpoint
CREATE INDEX `page_parent_idx` ON `page` (`parent_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `post_published_idx` ON `post` (`publish_status`,`published_at`);--> statement-breakpoint
CREATE INDEX `tour_hotspot_scene_idx` ON `tour_hotspot` (`scene_id`);--> statement-breakpoint
CREATE INDEX `tour_scene_location_idx` ON `tour_scene` (`location_id`,`sort_order`);