CREATE TYPE "public"."session_kind" AS ENUM('practice', 'review');--> statement-breakpoint
CREATE TABLE "review_cards" (
	"user_id" text NOT NULL,
	"question_id" integer NOT NULL,
	"due" timestamp with time zone NOT NULL,
	"stability" double precision NOT NULL,
	"difficulty" double precision NOT NULL,
	"elapsed_days" integer DEFAULT 0 NOT NULL,
	"scheduled_days" integer NOT NULL,
	"learning_steps" integer DEFAULT 0 NOT NULL,
	"reps" integer NOT NULL,
	"lapses" integer NOT NULL,
	"state" smallint NOT NULL,
	"last_review" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_cards_user_id_question_id_pk" PRIMARY KEY("user_id","question_id")
);
--> statement-breakpoint
ALTER TABLE "practice_sessions" ADD COLUMN "kind" "session_kind" DEFAULT 'practice' NOT NULL;--> statement-breakpoint
ALTER TABLE "review_cards" ADD CONSTRAINT "review_cards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_cards" ADD CONSTRAINT "review_cards_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "review_cards_user_due_idx" ON "review_cards" USING btree ("user_id","due");