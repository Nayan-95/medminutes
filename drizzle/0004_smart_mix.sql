ALTER TABLE "practice_sessions" ADD COLUMN "policy" text;--> statement-breakpoint
ALTER TABLE "practice_sessions" ADD COLUMN "question_slots" text[];--> statement-breakpoint
CREATE INDEX "attempts_question_idx" ON "attempts" USING btree ("question_id");