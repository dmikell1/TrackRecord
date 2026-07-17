CREATE INDEX IF NOT EXISTS "training_sessions_team_type_idx" ON "training_sessions" USING btree ("team_id","type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "videos_team_athlete_event_idx" ON "videos" USING btree ("team_id","athlete_id","event");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "video_performances_team_athlete_event_idx" ON "video_performances" USING btree ("team_id","athlete_id","event");
