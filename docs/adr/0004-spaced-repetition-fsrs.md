# ADR 0004: Spaced repetition with FSRS

- **Status:** Accepted
- **Date:** 2026-11-13

## Context
Questions answered once are forgotten. Spaced repetition schedules each question to come back just before the user would forget it. FSRS is the open, benchmarked scheduler (the one Anki uses).

## Decision
- **Library: `ts-fsrs` 5.4.2 (FSRS-6), pinned exactly.** ts-fsrs 6.0.0 (released 2026-10-28) is a rewrite with an async API and FSRS-7, and requires Node 24. We run Node 22 everywhere (local, CI, Vercel). 5.x is mature and runs the model behind the published benchmark. Upgrading later is cheap (see "Rebuildable" below).
- **Grading an MCQ:** correct → **Good**; wrong or skipped → **Again**. MCQs give no reliable "hard" vs "easy" signal, so we don't invent one.
- **Scheduler settings:** desired retention 0.9, maximum interval 365 days, fuzz on, **short-term (minute-level) steps off**. Re-showing an MCQ minutes later tests memory of the answer, not learning. In practice: wrong → back tomorrow; correct → 3, 14, 57… days.
- **Storage:** `review_cards` (one row per user × question) holds the FSRS state. It is **derived** from `attempts`.
- **Consistency:** each answer inserts its `attempts` row and updates its card **in one transaction**. A repeat submission (double click) doesn't reschedule twice.
- **Rebuildable:** `npm run srs:rebuild` replays all attempts in order and recreates every card. Unit tests check replay produces exactly the same card as answering step by step. Use it after changing scheduler settings or upgrading ts-fsrs.
- **Review sessions:** `practice_sessions.kind = 'review'` draws due cards (most overdue first, up to 20). Marking is the same as practice, and review answers count toward the lifetime score like any other attempt.

## Consequences
- Every answered question joins the user's review deck; the deck grows with practice.
- Review answers are still `attempts`, so dashboards and scores include them.
- Latency: an answer is now ~6 database round trips (one pre-check, then a transaction). Fine in production (Vercel `iad1` ↔ Neon `us-east-2` are close); slow from a laptop in India talking to the US database (~330 ms per round trip).
