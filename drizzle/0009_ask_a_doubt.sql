CREATE TABLE "ai_doubt_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"question_id" integer NOT NULL,
	"chip" text NOT NULL,
	"prompt_version" smallint NOT NULL,
	"model" text NOT NULL,
	"answer" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_doubt_cache_key_uq" UNIQUE("question_id","chip","prompt_version")
);
--> statement-breakpoint
ALTER TABLE "ai_usage" ADD COLUMN "kind" text DEFAULT 'explain' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_doubt_cache" ADD CONSTRAINT "ai_doubt_cache_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;