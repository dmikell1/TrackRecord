CREATE TABLE "video_performances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"athlete_id" uuid NOT NULL,
	"event" varchar(50) NOT NULL,
	"result" jsonb,
	"is_pr" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "video_performances" ADD CONSTRAINT "video_performances_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "video_performances" ADD CONSTRAINT "video_performances_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "video_performances" ADD CONSTRAINT "video_performances_athlete_id_athletes_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "video_performances_video_athlete_idx" ON "video_performances" USING btree ("video_id","athlete_id");
