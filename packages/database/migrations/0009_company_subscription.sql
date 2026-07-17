ALTER TABLE "companies" ADD COLUMN "subscription_plan" varchar(50);
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "subscription_status" varchar(50) DEFAULT 'trial' NOT NULL;
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "trial_ends_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "subscription_expires_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "revenue_cat_app_user_id" varchar(255);
--> statement-breakpoint
-- Existing companies get a 14-day trial from migration time
UPDATE "companies"
SET
	"subscription_status" = 'trial',
	"trial_ends_at" = NOW() + INTERVAL '14 days'
WHERE "trial_ends_at" IS NULL;
