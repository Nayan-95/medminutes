CREATE TYPE "public"."report_reason" AS ENUM('wrong_answer', 'wrong_explanation', 'typo', 'unclear', 'other');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'fixed', 'dismissed');--> statement-breakpoint
CREATE TABLE "question_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"question_id" integer NOT NULL,
	"reason" "report_reason" NOT NULL,
	"note" text,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "question_reports_user_question_uq" UNIQUE("user_id","question_id"),
	CONSTRAINT "question_reports_note_ck" CHECK ("question_reports"."note" is null or char_length("question_reports"."note") <= 500)
);
--> statement-breakpoint
ALTER TABLE "question_reports" ADD CONSTRAINT "question_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_reports" ADD CONSTRAINT "question_reports_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "question_reports_status_question_idx" ON "question_reports" USING btree ("status","question_id");