# MedMinutes roadmap

**Constraint:** ₹0 running cost. Free tiers only, no card on file.
**Approach:** one feature at a time. Each one is built, tested and deployed before the next starts.

| Phase | Feature | Done when | Status |
|---|---|---|---|
| 0 | Foundation: repo, CI, schema, MedMCQA import, first deploy | Push to `main` deploys; questions are in the database | ✅ Live at medminutes.vercel.app |
| 1 | MCQ practice with NEET PG marking (+4 / −1 / 0) | A signed-in user can finish a session and see their score | ✅ Shipped |
| 2 | Progress dashboard | Total score, accuracy by subject and topic, history | ✅ Shipped |
| 3 | Spaced repetition (FSRS via `ts-fsrs`) | Wrong or skipped questions come back on a "due today" queue | ✅ Shipped |
| 3.5 | Smart mix: sessions steer silently toward weak topics (ADR 0005) | Weak topics, coverage and random picks, interleaved, aimed at 75% success | 🟡 On `Release/Release_Dev` |
| 4 | Reminders: installable PWA + Web Push (email needs a paid domain, so deferred) | Daily "X cards due" reminder | ⬜ Planned, see docs/NEXT.md |
| 5 | Exam-date countdown | Low-recall topics are prioritised as the exam nears | ⬜ |
| 6 | `.apkg` import, AI card generation (your own API key) | — | ⬜ |

WhatsApp reminders are out of scope because the WhatsApp Business API is paid.

**AI track** (decide before more add-ons): see `docs/NEXT.md` and `research/02-ai-features.md`.

## Phase 1 spec: MCQ practice

- Google sign-in (Auth.js v5, JWT sessions, users + linked accounts in Postgres).
- Pick a subject (and optionally a topic) and a question count (10 / 20 / 50).
- Each card shows the question with options A–D, plus **Submit** and **Skip**.
- **Answer reveal is instant:** after Submit, the correct option is green and a wrong pick is red, followed by the explanation.
- Marking: correct **+4**, wrong **−1**, skipped **0**. **The total score can go negative**, as in the real exam.
- End-of-session summary: score, correct / wrong / skipped, accuracy, time taken.
- Lifetime total shown in the header.
- Answers are checked **on the server**; the correct option is never sent to the browser before you submit.
- Keyboard: `1`–`4` pick an option, `S` skips, `Enter` submits.
- Tests: unit tests for the scoring rules; a Playwright test for a full session.
- A separate "Exam mode" (answers revealed at the end) comes later.
