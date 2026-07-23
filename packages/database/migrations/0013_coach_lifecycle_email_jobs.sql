CREATE TABLE IF NOT EXISTS "coach_lifecycle_email_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"step" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"skipped_at" timestamp with time zone,
	"skip_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "coach_lifecycle_email_jobs" ADD CONSTRAINT "coach_lifecycle_email_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "coach_lifecycle_email_jobs" ADD CONSTRAINT "coach_lifecycle_email_jobs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "coach_lifecycle_email_jobs" ADD CONSTRAINT "coach_lifecycle_email_jobs_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "coach_lifecycle_email_jobs_user_step_unique" ON "coach_lifecycle_email_jobs" ("user_id","step");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coach_lifecycle_email_jobs_due_idx" ON "coach_lifecycle_email_jobs" ("status","scheduled_for");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coach_lifecycle_email_jobs_company_id_idx" ON "coach_lifecycle_email_jobs" ("company_id");
