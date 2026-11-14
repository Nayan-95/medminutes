# ADR 0005: Smart-mix question selection

- **Status:** Accepted
- **Date:** 2026-11-14
- **Research:** `research/03-recommendation-engine.md`

## Context
New practice questions were drawn with `ORDER BY random()` inside the chosen subject or topic, and review sessions showed due cards most-overdue first. Nothing steered practice toward a user's weak topics. Competitors in India leave this to manual filters ("incorrect", "unattempted"). The research found strong evidence for spacing, retrieval practice with feedback and interleaving similar topics. It found weaker evidence for any exact ratio or target. At our scale (about 174k questions, few users), simple explainable statistics beat deep "knowledge tracing" models, and they cost nothing to run.

## Decision
Every practice session is built by `drawSmartMix` (`src/lib/smart-mix.ts`). The pure rules are in `src/lib/recommend.ts`, which is unit-tested.

1. **Units.** A unit is a topic, or a subject's untagged questions (about half of MedMCQA has no topic).
2. **Weakness estimate.** This uses the user's **first** answer to each question only. Later answers are FSRS reviews and would double-count mistakes. Skips count as wrong. Accuracy is shrunk with 8 pseudo-answers: the overall figure toward 60%, each subject toward the overall, and each unit toward its subject. One unlucky answer therefore cannot flag a topic. Each unit gets a Beta(α, β) belief.
3. **Slots per session.**
   - **Reviews:** 30% of the session from due cards in scope. This rises to **50% when 30 or more cards are due**, so fewer new questions arrive when reviews pile up.
   - **Random:** 10%, with at least 1 when 5 or more new questions are served. This keeps exploring and keeps the data fair for evaluating the policy later.
   - **Coverage:** 20% from the least-practised units, with larger units weighted up (√size).
   - **Weak:** the rest. Units are picked by **Thompson sampling** over practised units. After each pick the unit is assumed answered correctly, so a session spreads across weak topics.
4. **Difficulty targeting.** Each weak or coverage pick fetches 4 random unseen candidates and keeps the one with predicted success nearest **75%**. The prediction is the unit estimate, shifted by the question's shrunk % correct across all users.
5. **Order.** Questions are interleaved so the same unit doesn't come twice in a row where possible. There are at most **2 likely-wrong questions (predicted under 60%) in a row**.
6. **Review sessions and review slots** take due cards with **lowest retrievability first** (FSRS-6 forgetting curve computed in SQL), replacing most-overdue first.
7. **Logging.** `practice_sessions.policy` (`smart-v1`, `review-v1`) and `question_slots` (`review` / `weak` / `coverage` / `random` / `fill`, aligned with `question_ids`) record why each question was served. This is migration 0004, which is additive.
8. **Fallback.** If a small topic runs out of unseen questions, previously answered ones fill the session (`fill`).

All numbers live in `SMART_MIX` and can be tuned. Bump `policy` whenever the rules change.

## Rejected or deferred
- **Shuffling answer options.** Rejected: about 89% of MedMCQA explanations name the answer letter ("Ans. b.", "B i.e. …"), so a shuffled order would contradict the explanation.
- **Re-asking a missed question later in the same session.** Not done: FSRS already brings wrong answers back the next day, and in-session repeats would need a schema change (one attempt per session × question).
- **Deep knowledge tracing (DKT/SAKT).** Rejected: it loses to logistic or Elo models at our data scale and would need paid compute.
- **Deferred (see docs/NEXT.md):**
  - an Elo-style ability and difficulty model, once questions have about 100 answers each
  - exam-date-aware intervals
  - a "sure / guessed" tap
  - grouping near-duplicate questions
  - fitting FSRS parameters to our data
  - an A/B test of the smart mix against random selection

## Consequences
- Starting a practice session costs about 3 to 4 database round trips: unit stats, due cards and the due count in parallel, then candidates, then random picks. The unit list is cached for a day.
- The selection is invisible during practice. The dashboard's "Weak topics" list uses the same estimate, so what users see there matches what the mix targets.
- `attempts(question_id)` gained an index for the per-question % correct lookup.
- Nothing changed in FSRS scheduling, so **no `srs:rebuild` is needed**. Every answered question already had a review card (ADR 0004).
