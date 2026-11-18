# Where we are and what's next

_Last updated: 18 Nov 2026._

**Owner's chosen order (18 Nov):** report a question → daily reminders → weekly Grand Test. Checklist in `docs/TODO.md`.

## Shipped (live on `main`)
Phase 0 foundation · Phase 1 MCQ practice + Google sign-in · UI redesign · Phase 2 progress dashboard · Phase 3 FSRS spaced repetition · Smart mix · Leaderboard and heatmap · Mock tests. Privacy and terms pages are live.

## Report a question (ADR 0008), on `Release/Release_Dev`, not yet merged
- "Report a problem" appears after an answer is revealed (practice feedback, mock answer review). Reason + optional note (≤ 500 chars). One report per user × question; reporting again reopens it.
- `/admin/reports` (owner only): reports grouped by question, anonymous, with Mark fixed / Dismiss / Reopen. Admins come from the **`ADMIN_EMAILS`** env var; empty means nobody, so CI stays locked.
- Migration 0007 (`question_reports` and two enums) has been applied to the shared DB. Additive; no `srs:rebuild`.
- **Before merging:** the owner adds `ADMIN_EMAILS` to `.env.local` and to Vercel (Production).
- Fixing an answer key doesn't re-mark old attempts (ADR 0002). Decide later whether to re-mark.

## Mock tests (ADR 0007), live
- `/mock`: **Full mock** (NEET PG 2026: 180 questions, 5 sections × 36 questions × 42 min) and **Mini mock** (45 questions, 5 × 9 × 10.5 min, same 70 s pace).
- Real exam rules: sections mix subjects, each section has its own timer, closed sections lock, no moving ahead early. Mark for review; marked-and-answered counts.
- Answers autosave; the server refuses changes outside the open section (15 s grace). One running mock at a time. If time runs out while away, the mock is submitted the next time `/mock` or the exam page is opened.
- On submit, opened questions become `attempts` (unanswered = skipped), so mocks count for the score, leaderboard, heatmap and FSRS. Never-opened questions are not recorded.
- Result page: score, percentile among other mocks of the same format (shown from 10 others), negative-marking cost, changed answers (right → wrong etc.), marked-for-review accuracy, pace, by section, by subject (weakest first), filtered answer review.
- Migration 0006 (`session_kind` gains `mock`; tables `mock_exams`, `mock_responses`) has been applied to the shared DB. Additive; no `srs:rebuild` needed.
- Follow-ups: verify the 2027 NBEMS bulletin when it is out and update `MOCK_FORMATS`; consider a fixed weekly "Grand Test" (same questions for everyone, so percentiles compare like with like).

## Leaderboard and heatmap (ADR 0006)
- `/leaderboard`:
  - this week (from Monday IST) and all time, with a subject filter
  - rank, percentile and points to pass the next person
  - people around you, most accurate (50+ answers) and most improved this week
  - names shown as "First L." with the full email (owner's choice); opt-out button
- The progress page has a GitHub-style practice heatmap with current and longest streak.
- Migration 0005 (`users.leaderboard_hidden`) has been applied to the shared DB.

## Smart mix (live)
- **Smart mix (ADR 0005, research/03-recommendation-engine.md).** Practice sessions steer silently toward weak topics:
  - 30% due reviews, or 50% when the backlog is 30 or more
  - weak topics picked by Thompson sampling
  - 20% unseen topics, 10% random
  - new questions aimed at 75% predicted success
  - interleaved, with at most 2 likely-wrong questions in a row
  - reviews ordered lowest recall first
  - each session logs `policy` and `question_slots`
  - the dashboard's "Weak topics" list uses the same estimate
- Migration 0004 has been applied to the shared DB. It is additive and needs no `srs:rebuild`.

## Smart mix follow-ups (from the research, in order)
1. After about 2 weeks of real use, check the logs: accuracy by slot (`weak` vs `random`), and whether weak-topic accuracy rises. Tune `SMART_MIX` and bump `policy`.
2. **Exam date** per user: cap intervals at the days left and raise retention near the exam. This needs an ADR and `srs:rebuild`.
3. Optional **"sure / guessed"** tap after answering, where a guessed-correct answer counts as weak.
4. **Elo** ability and difficulty, once questions have about 100 answers each.
5. **Near-duplicate grouping** of MedMCQA stems (`pg_trgm` or a nightly job).
6. **Fit FSRS parameters** on pooled data in a free GitHub Action. Adopt only if it beats the defaults on a held-out set.
7. A/B test of the smart mix against random selection, split by user ID hash.

## Open decisions (ask the owner)
1. **AI integration, decided before more add-on features** (see `research/02-ai-features.md`):
   - **Budget:** strictly ₹0 with free LLM tiers (fragile), or a small capped monthly spend (e.g. ₹200–500) for reliable quality?
   - **Provider/model:** free tier vs Claude (Opus 5.5 default, Haiku 5.5 much cheaper; measure quality on a sample first).
   - **First feature:** recommended **"Why was I wrong?"** (grounded in the question's explanation, cached per question × chosen option), then the **one-time question-bank cleanup**.
2. **Phase 4 reminders.** Proposed: installable PWA + opt-in **Web Push**, one daily reminder ~8 AM IST via Vercel Cron (Hobby = once a day, ±59 min), only to users with reviews due who haven't practised that day. Email via Resend needs a custom domain (paid), so it's deferred. Waiting on "start phase 4" and a reminder time.
3. **Publish Google sign-in** (Google Auth Platform → Branding: home `https://medminutes.vercel.app`, privacy `/privacy`, terms `/terms`, authorized domain `medminutes.vercel.app`, no logo; then Audience → Publish). Optional for now: non-test users can already sign in (only basic scopes). Do it before wide sharing.

## Smaller backlog
- Neon compute (100 CU-h/month) is the first free-tier limit to watch; check Neon Monitoring and Vercel Usage weekly.
- Optional later: custom domain, which would enable email reminders and look more professional.
