ALTER TABLE "videos" ADD COLUMN "recorded_at" timestamp with time zone;--> statement-breakpoint
UPDATE "videos" SET "recorded_at" = "created_at" WHERE "recorded_at" IS NULL;--> statement-breakpoint
ALTER TABLE "videos" ALTER COLUMN "recorded_at" SET NOT NULL;
