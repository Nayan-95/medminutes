# ADR 0002: The attempts log is the source of truth for scores

- **Status:** Accepted
- **Date:** 2026-11-13

## Context
Scores, accuracy per subject, weak-area dashboards (Phase 2) and FSRS review scheduling (Phase 3) all depend on what the user answered. Storing a running total separately risks it drifting from the actual answers.

## Decision
- Every answer is one row in the append-only `attempts` table: user, session, question, selected option (null when skipped), result, points and time taken.
- NEET PG marking (+4 correct / −1 wrong / 0 skipped) is enforced by a **database check constraint** (`attempts_scoring_ck`), as well as in application code.
- Totals and accuracy are **calculated from** `attempts`, never stored as a separate number. Totals can be negative.
- One answer per question per session (`attempts_session_question_uq`).

## Consequences
- Score history can always be recalculated, and no stored total can go out of sync with it.
- FSRS state in Phase 3 can be rebuilt by replaying `attempts`.
- If calculating totals becomes slow, add a cached summary that is rebuilt from `attempts`. The log stays the source of truth.
