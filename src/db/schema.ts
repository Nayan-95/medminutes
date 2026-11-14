import { sql } from "drizzle-orm";
import {
  check,
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const optionEnum = pgEnum("option", ["A", "B", "C", "D"]);
export const attemptResultEnum = pgEnum("attempt_result", ["correct", "wrong", "skipped"]);
export const sessionKindEnum = pgEnum("session_kind", ["practice", "review"]);

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
// Auth (Auth.js Drizzle adapter). Sessions are JWTs, so there is no sessions table.
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

/** Links a user to a sign-in provider account (e.g. their Google account). */
export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [
    primaryKey({ columns: [t.provider, t.providerAccountId] }),
    index("accounts_user_idx").on(t.userId),
  ],
);

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
    /** "practice" draws new random questions; "review" draws questions due for spaced repetition. */
    kind: sessionKindEnum("kind").notNull().default("practice"),
    /** Optional filters the user picked; null means "all". */
    subjectId: integer("subject_id").references(() => subjects.id),
    topicId: integer("topic_id").references(() => topics.id),
    questionCount: smallint("question_count").notNull(),
    /** The questions drawn for this session, in the order they are shown. */
    questionIds: integer("question_ids").array().notNull(),
    /** Which selection policy built the session (e.g. "smart-v1", "review-v1"); null for older sessions. */
    policy: text("policy"),
    /** Why each question was chosen ("review" | "weak" | "coverage" | "random" | "fill"), aligned with questionIds. */
    questionSlots: text("question_slots").array(),
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
    // Per-question % correct across all users (item difficulty for the smart mix).
    index("attempts_question_idx").on(t.questionId),
    check(
      "attempts_scoring_ck",
      sql`(${t.result} = 'correct' and ${t.points} = 4 and ${t.selectedOption} is not null)
       or (${t.result} = 'wrong' and ${t.points} = -1 and ${t.selectedOption} is not null)
       or (${t.result} = 'skipped' and ${t.points} = 0 and ${t.selectedOption} is null)`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Spaced repetition (FSRS). Derived from `attempts`; rebuildable by replaying
// them (scripts/rebuild-review-cards.ts). See docs/adr/0004.
// ---------------------------------------------------------------------------

export const reviewCards = pgTable(
  "review_cards",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    questionId: integer("question_id")
      .notNull()
      .references(() => questions.id),
    due: timestamp("due", { withTimezone: true }).notNull(),
    stability: doublePrecision("stability").notNull(),
    difficulty: doublePrecision("difficulty").notNull(),
    elapsedDays: integer("elapsed_days").notNull().default(0),
    scheduledDays: integer("scheduled_days").notNull(),
    learningSteps: integer("learning_steps").notNull().default(0),
    reps: integer("reps").notNull(),
    lapses: integer("lapses").notNull(),
    /** ts-fsrs State: 0 New, 1 Learning, 2 Review, 3 Relearning. */
    state: smallint("state").notNull(),
    lastReview: timestamp("last_review", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.questionId] }),
    // "What's due for this user?" is the hot query.
    index("review_cards_user_due_idx").on(t.userId, t.due),
  ],
);
