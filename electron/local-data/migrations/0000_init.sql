CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`currency` text NOT NULL,
	`bank` text,
	`last_four` text,
	`credit_limit` real,
	`billing_day` integer,
	`payment_day` integer,
	`interest_rate` real,
	`is_default` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`icon` text NOT NULL,
	`type` text NOT NULL,
	`translations` text,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `operations` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`date` text NOT NULL,
	`description` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `loans` (
	`id` text PRIMARY KEY NOT NULL,
	`description` text NOT NULL,
	`party` text,
	`purpose` text,
	`direction` text DEFAULT 'Taken' NOT NULL,
	`principal` real NOT NULL,
	`currency` text NOT NULL,
	`trm_applied` real DEFAULT 1 NOT NULL,
	`interest_rate_annual` real NOT NULL,
	`term_months` integer NOT NULL,
	`start_date` text NOT NULL,
	`loan_type` text DEFAULT 'French' NOT NULL,
	`account_id` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_loans_active` ON `loans` (`is_active`);--> statement-breakpoint
CREATE TABLE `installment_purchases` (
	`id` text PRIMARY KEY NOT NULL,
	`description` text NOT NULL,
	`account_id` text,
	`purchase_movement_id` text,
	`interest_rate_percent` real,
	`total_amount` real NOT NULL,
	`currency` text NOT NULL,
	`trm_applied` real DEFAULT 1 NOT NULL,
	`installments_count` integer NOT NULL,
	`start_date` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_installments_active` ON `installment_purchases` (`is_active`);--> statement-breakpoint
CREATE TABLE `recurring_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`recurring_type` text,
	`amount` real NOT NULL,
	`currency` text NOT NULL,
	`trm_applied` real DEFAULT 1 NOT NULL,
	`category_id` text,
	`account_id` text,
	`description` text,
	`frequency` text NOT NULL,
	`interval` integer DEFAULT 1 NOT NULL,
	`day_of_month` integer,
	`day_of_week` integer,
	`start_date` text NOT NULL,
	`end_date` text,
	`is_active` integer DEFAULT true NOT NULL,
	`last_run_at` text,
	`next_run_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_recurring_next` ON `recurring_transactions` (`is_active`,`next_run_at`);--> statement-breakpoint
CREATE TABLE `instrument_types` (
	`code` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `portfolio_entities` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`type` text NOT NULL,
	`instrument_type` text,
	`symbol` text,
	`risk_level` text,
	`name` text NOT NULL,
	`currency` text NOT NULL,
	`institution` text,
	`account_id` text,
	`loan_id` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`instrument_type`) REFERENCES `instrument_types`(`code`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`loan_id`) REFERENCES `loans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_portfolio_kind` ON `portfolio_entities` (`kind`,`is_active`);--> statement-breakpoint
CREATE TABLE `portfolio_valuations` (
	`id` text PRIMARY KEY NOT NULL,
	`portfolio_entity_id` text NOT NULL,
	`date` text NOT NULL,
	`amount` real NOT NULL,
	`currency` text NOT NULL,
	`trm_applied` real DEFAULT 1 NOT NULL,
	`amount_base` real NOT NULL,
	`source` text NOT NULL,
	`external_reference` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`portfolio_entity_id`) REFERENCES `portfolio_entities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_valuations_entity_date` ON `portfolio_valuations` (`portfolio_entity_id`,`date`);--> statement-breakpoint
CREATE TABLE `credit_card_terms` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`purchase_apr` real,
	`cash_advance_apr` real,
	`intl_purchase_apr` real,
	`min_payment_pct` real,
	`grace_period_days` integer,
	`deferred_default_apr` real,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `movements` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`type` text NOT NULL,
	`kind` text NOT NULL,
	`source_type` text,
	`operation_type` text,
	`sub_type` text,
	`investment_transaction_type` text,
	`amount` real NOT NULL,
	`currency` text NOT NULL,
	`trm_applied` real DEFAULT 1 NOT NULL,
	`amount_base` real NOT NULL,
	`description` text,
	`category_id` text,
	`account_id` text,
	`operation_id` text,
	`loan_id` text,
	`installment_purchase_id` text,
	`installment_number` integer,
	`principal_component` real,
	`interest_component` real,
	`recurring_transaction_id` text,
	`portfolio_entity_id` text,
	`loan_party` text,
	`loan_installments` integer,
	`loan_interest_rate` real,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`operation_id`) REFERENCES `operations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`loan_id`) REFERENCES `loans`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`installment_purchase_id`) REFERENCES `installment_purchases`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recurring_transaction_id`) REFERENCES `recurring_transactions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`portfolio_entity_id`) REFERENCES `portfolio_entities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_movements_date` ON `movements` (`date`);--> statement-breakpoint
CREATE INDEX `ix_movements_kind` ON `movements` (`kind`);--> statement-breakpoint
CREATE INDEX `ix_movements_account` ON `movements` (`account_id`);--> statement-breakpoint
CREATE INDEX `ix_movements_category` ON `movements` (`category_id`);--> statement-breakpoint
CREATE INDEX `ix_movements_operation` ON `movements` (`operation_id`);--> statement-breakpoint
CREATE INDEX `ix_movements_loan` ON `movements` (`loan_id`);--> statement-breakpoint
CREATE INDEX `ix_movements_installment` ON `movements` (`installment_purchase_id`);--> statement-breakpoint
CREATE INDEX `ix_movements_portfolio` ON `movements` (`portfolio_entity_id`);--> statement-breakpoint
CREATE TABLE `investment_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`portfolio_entity_id` text NOT NULL,
	`movement_id` text,
	`type` text NOT NULL,
	`quantity` real,
	`unit_price` real,
	`fee_amount_base` real DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`portfolio_entity_id`) REFERENCES `portfolio_entities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`movement_id`) REFERENCES `movements`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_investxn_entity` ON `investment_transactions` (`portfolio_entity_id`);