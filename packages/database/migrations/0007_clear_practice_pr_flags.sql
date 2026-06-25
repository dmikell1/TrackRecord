UPDATE "videos"
SET "is_pr" = false, "updated_at" = now()
WHERE "is_pr" = true
	AND "session_id" IN (
		SELECT "id" FROM "training_sessions" WHERE "type" = 'Practice'
	);
--> statement-breakpoint
UPDATE "video_performances"
SET "is_pr" = false, "updated_at" = now()
WHERE "is_pr" = true
	AND "video_id" IN (
		SELECT "id" FROM "videos"
		WHERE "session_id" IN (
			SELECT "id" FROM "training_sessions" WHERE "type" = 'Practice'
		)
	);
