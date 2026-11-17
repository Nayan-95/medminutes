# ADR 0007: Mock exams in the NEET PG pattern

- **Status:** Accepted
- **Date:** 2026-11-17

## Context
Practice sessions show the answer after every question. NEET PG aspirants also need full-length, timed mocks ("Grand Tests") to rehearse the exam itself: stamina, pacing, section timers and negative-marking judgement. The roadmap listed "Exam mode" as later; the owner chose it as the next feature.

The NBEMS bulletin of July 2026 changed the paper: **180 MCQs** (was 200), **5 time-bound sections of 36 questions and 42 minutes each**, 3 h 30 min in total, +4 / −1 / 0. Sections mix subjects. A section closes when its time ends, the next cannot be started early, and a closed section cannot be reopened. Questions marked for review are evaluated if answered. Sources: NBEMS bulletin as reported by Careers360 and Medical Dialogues (the bulletin PDF itself was not reachable).

## Decision

### Formats (`src/lib/mock.ts`)
- **Full mock:** 180 questions, 5 × 36, 42 min per section.
- **Mini mock:** 45 questions, 5 × 9, 10.5 min per section. Same 70 s per question, for days without 3.5 hours free.
- The shape is stored per mock (`mock_exams`), so changing `MOCK_FORMATS` for a future bulletin doesn't alter past mocks.

### Question draw
- Subject quotas from approximate NEET PG weights (`SUBJECT_WEIGHTS`, from published paper analyses; NBEMS publishes no official split), split with the largest-remainder method. Unit-tested.
- Within a subject: questions the user has never answered first, then random. One SQL query (window function over the bank, ~0.3 s on Neon), then shuffled so sections mix subjects.

### Timing is enforced on the server
- The current section is a pure function of `started_at` and the format (`mockClock`), because sections can neither end early nor be reopened. No mutable "current section" state.
- `saveMockResponses` refuses changes to questions outside the open section, with a 15 s grace for network delay (`canSave`).
- The client clock is corrected by the server time returned with each save.
- The timer keeps running if the user leaves, as in the exam. An expired mock is submitted lazily the next time `/mock` or its exam page is opened. Its answers are dated at the exam's end, not when it was noticed.
- One running mock per user.

### Storage: `mock_responses`, then `attempts`
- During the exam, answers change, so they can't go into the append-only `attempts` log (ADR 0002). They live in `mock_responses`: one row per opened question with the current answer, the **first** answer (for the "changed right → wrong" analysis), the marked flag and time on screen. The client keeps the first answer too, so quick changes merged into one save don't lose it.
- On submit, in one transaction: close the session (only the caller that closes it continues, so double submits are safe), copy opened questions into `attempts` (unanswered = skipped, 0 marks), and reschedule each with FSRS.
- Never-opened questions get no attempt: the user never saw them, so they shouldn't enter the review queue or count as skips.
- So mocks count towards the lifetime score, leaderboard, heatmap, smart mix and review queue with no changes to those features. The progress page's score-per-session chart leaves mocks out (180 questions would dwarf 10-question sessions); they have their own history on `/mock`.

### Result page
- Score, counts (correct, wrong, not answered, not visited), accuracy.
- **Percentile** among other submitted mocks of the same format, ties counted as half, shown only once there are at least 10 to compare with. Mocks draw different questions, so this is a rough guide, not a predicted NEET PG rank. A predicted rank is deliberately not shown: there is no honest data to map MedMinutes scores onto NEET PG ranks.
- Insights: marks lost to negative marking, changed answers, accuracy on marked questions, pace against 70 s.
- By section and by subject (weakest first), and an answer review filtered by wrong / not answered / marked / changed.

### Exam screen
- Palette with NBEMS statuses (not visited, not answered, answered, marked, answered and marked). Status is shown by fill, border style and a flag icon, not colour alone. Teal and red stay reserved for correct and wrong, which are never shown during the exam.
- Keyboard: 1–4 / A–D choose, M mark, ← → move within the section.

## Consequences
- Percentile is one grouped query over all mocks of a format; fine for hundreds of mocks. At thousands, store each mock's score on submit.
- `session_kind` has a third value. Code that switches on `kind` must handle `mock`; practice routes redirect mock sessions to `/mock`.
- Different users get different questions. A fixed weekly Grand Test (same questions for everyone) would make percentiles fairer and is a natural follow-up.
- If NBEMS changes the pattern again, update `MOCK_FORMATS` and its tests. Old mocks keep their stored shape.
