CREATE UNIQUE INDEX "athletes_team_email_active_idx" ON "athletes" USING btree ("team_id", lower("email")) WHERE "deleted_at" IS NULL;
