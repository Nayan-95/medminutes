import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const optionEnum = pgEnum("option", ["A", "B", "C", "D"]);
export const attemptResultEnum = pgEnum("attempt_result", ["correct", "wrong", "skipped"]);

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

export const subjects = pgTable("subjects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
});

export const topics = pgTable(
  "topics",
  {
    id: serial("id").primaryKey(),
    subjectId: integer("subject_id")
      .notNull()
      .references(() => subjects.id),
    name: text("name").notNull(),
  },
  (t) => [unique("topics_subject_name_uq").on(t.subjectId, t.name)],
);

export const questions = pgTable(
  "questions",
  {
    id: serial("id").primaryKey(),
    /** Dataset the question came from, e.g. "medmcqa". */
    source: text("source").notNull(),
    /** The question's id inside that dataset; (source, sourceId) makes imports idempotent. */
    sourceId: text("source_id").notNull(),
    question: text("question").notNull(),
    optionA: text("option_a").notNull(),
    optionB: text("option_b").notNull(),
    optionC: text("option_c").notNull(),
    optionD: text("option_d").notNull(),
    correctOption: optionEnum("correct_option").notNull(),
    explanation: text("explanation"),
    subjectId: integer("subject_id")
      .notNull()
      .references(() => subjects.id),
    topicId: integer("topic_id").references(() => topics.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("questions_source_uq").on(t.source, t.sourceId),
    index("questions_subject_idx").on(t.subjectId),
    index("questions_topic_idx").on(t.topicId),
  ],
);

// ---------------------------------------------------------------------------
// Users (shape matches the Auth.js Drizzle adapter; auth tables arrive in Phase 1)
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified", { mode: "date", withTimezone: true }),
  image: text("image"),
});

// ---------------------------------------------------------------------------
// Practice
// ---------------------------------------------------------------------------

export const practiceSessions = pgTable(
  "practice_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Optional filters the user picked; null means "all". */
    subjectId: integer("subject_id").references(() => subjects.id),
    topicId: integer("topic_id").references(() => topics.id),
    questionCount: smallint("question_count").notNull(),
    /** The questions drawn for this session, in the order they are shown. */
    questionIds: integer("question_ids").array().notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (t) => [
    index("practice_sessions_user_idx").on(t.userId, t.startedAt),
    check("practice_sessions_count_ck", sql`${t.questionCount} between 1 and 200`),
  ],
);

/**
 * Append-only log of every answer. This is the single source of truth:
 * scores, accuracy and (later) FSRS review state are all derived from it.
 */
export const attempts = pgTable(
  "attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => practiceSessions.id, { onDelete: "cascade" }),
    questionId: integer("question_id")
      .notNull()
      .references(() => questions.id),
    /** Null when the user skipped. */
    selectedOption: optionEnum("selected_option"),
    result: attemptResultEnum("result").notNull(),
    /** NEET PG marking: +4 correct, -1 wrong, 0 skipped. Enforced by the check below. */
    points: smallint("points").notNull(),
    timeTakenMs: integer("time_taken_ms"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("attempts_session_question_uq").on(t.sessionId, t.questionId),
    index("attempts_user_created_idx").on(t.userId, t.createdAt),
    index("attempts_user_question_idx").on(t.userId, t.questionId),
    check(
      "attempts_scoring_ck",
      sql`(${t.result} = 'correct' and ${t.points} = 4 and ${t.selectedOption} is not null)
       or (${t.result} = 'wrong' and ${t.points} = -1 and ${t.selectedOption} is not null)
       or (${t.result} = 'skipped' and ${t.points} = 0 and ${t.selectedOption} is null)`,
    ),
  ],
);
