# Where we are and what's next

_Last updated: 14 Nov 2026._

## Shipped (live on `main`)
Phase 0 foundation · Phase 1 MCQ practice + Google sign-in · UI redesign · Phase 2 progress dashboard · Phase 3 FSRS spaced repetition. Privacy and terms pages are live.

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
- "Report this question" button (bad MedMCQA text or answer keys).
- Neon compute (100 CU-h/month) is the first free-tier limit to watch; check Neon Monitoring and Vercel Usage weekly.
- Optional later: custom domain, which would enable email reminders and look more professional.
