ALTER TYPE "public"."session_kind" ADD VALUE 'mock';--> statement-breakpoint
CREATE TABLE "mock_exams" (
	"session_id" uuid PRIMARY KEY NOT NULL,
	"format" text NOT NULL,
	"section_count" smallint NOT NULL,
	"section_size" smallint NOT NULL,
	"section_seconds" integer NOT NULL,
	CONSTRAINT "mock_exams_shape_ck" CHECK ("mock_exams"."section_count" > 0 and "mock_exams"."section_size" > 0 and "mock_exams"."section_seconds" > 0)
);
--> statement-breakpoint
CREATE TABLE "mock_responses" (
	"session_id" uuid NOT NULL,
	"question_id" integer NOT NULL,
	"selected_option" "option",
	"first_option" "option",
	"marked_for_review" boolean DEFAULT false NOT NULL,
	"time_spent_ms" integer DEFAULT 0 NOT NULL,
	"visited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mock_responses_session_id_question_id_pk" PRIMARY KEY("session_id","question_id")
);
--> statement-breakpoint
ALTER TABLE "mock_exams" ADD CONSTRAINT "mock_exams_session_id_practice_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."practice_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mock_responses" ADD CONSTRAINT "mock_responses_session_id_practice_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."practice_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mock_responses" ADD CONSTRAINT "mock_responses_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;