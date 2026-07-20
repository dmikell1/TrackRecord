ALTER TABLE "athletes" ADD COLUMN IF NOT EXISTS "date_of_birth" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "athletes" ADD COLUMN IF NOT EXISTS "parental_consent_status" varchar(50) DEFAULT 'NotRequired' NOT NULL;
--> statement-breakpoint
ALTER TABLE "athletes" ADD COLUMN IF NOT EXISTS "parent_email" varchar(255);
--> statement-breakpoint
ALTER TABLE "athletes" ADD COLUMN IF NOT EXISTS "parental_consent_token" varchar(255);
--> statement-breakpoint
ALTER TABLE "athletes" ADD COLUMN IF NOT EXISTS "parental_consent_at" timestamp with time zone;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "athletes_parental_consent_token_unique" ON "athletes" ("parental_consent_token");
