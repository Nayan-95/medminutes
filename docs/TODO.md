# To-do

Features the owner chose on 18 Nov 2026, in build order. Details and open decisions live in `docs/NEXT.md`.

- [x] **1. Report a question** (live 18 Nov; owner still sets `ADMIN_EMAILS`). After answering, a student can flag a bad question (wrong answer, wrong explanation, typo, unclear, other) with an optional note. The owner reviews reports on a private `/admin/reports` page and marks them fixed or dismissed. See ADR 0008.
- [x] **AI: "Why was I wrong?"** (live 21 Nov). Gemini free tier, cached per question × picked option. See ADR 0009. Next AI ideas: answer-key checker for reports, question-bank cleanup.
- [ ] **AI: Ask a doubt** (owner asked 21 Nov: "use less tokens"; built, awaiting merge). See ADR 0010.
- [ ] **2. Daily reminders (Phase 4).** Make the site installable on phones (PWA) and send one opt-in Web Push a day (about 8 AM IST, Vercel Cron) to users who have reviews due and haven't practised yet. Free; email needs a paid domain, so it's deferred.
- [ ] **3. Weekly Grand Test.** One fixed mock per week with the same questions for everyone, so ranks and percentiles compare like with like. Reuses the mock exam screens (ADR 0007).

## Parked
- **Year-wise PYQs.** MedMCQA has no year labels. Its validation split (~4,200 questions) is reported to be real NEET PG questions (check the paper before labelling). Third-party PYQ PDFs (e.g. Collegedunia) are memory-based recalls owned by others, so they need written permission before import.
