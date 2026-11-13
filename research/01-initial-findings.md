# NEET PG Recall — Initial Research Findings

Goal: a NEET PG flashcard + spaced-repetition reminder web app.

## 1. Scheduling engine
- **FSRS** (Open Spaced Repetition), the algorithm now used in Anki. It's backed by academic literature.
- **ts-fsrs** is the web choice. It needs Node 20+. `scheduler.repeat()` previews all 4 outcomes, and `get_retrievability` shows recall probability.
- **py-fsrs** (MIT) is the option if the backend is FastAPI or Django.
- The project's own benchmark has FSRS v4.5 well ahead of SM-2 on 1.7B reviews from 20K users.

## 2. Open-source apps to fork
| Repo | Notes |
|---|---|
| ts-fsrs-demo (ishiko732) | Next.js + Prisma full-stack demo |
| zsh-eng/spaced | Next.js, tRPC, Turso, Drizzle, ts-fsrs, swipe gestures. Clean, small starter |
| kirill-markin/flashcards-open-source-app | MIT, offline-first, iOS/Android/web, FSRS, self-hostable |
| Cognify (chaosweasl) | Next.js + Supabase, AI cards with your own API key, reminders. Roadmap unfinished |
| Scholarsome | AGPL-3.0. Check the licence before monetising |
| Anki | Open SQLite format, so an `.apkg` importer is possible |

## 3. Content and data
- **MedMCQA**: 194k+ AIIMS/NEET PG MCQs, 2.4k topics, 21 subjects. The card lists Apache 2.0. It's on Hugging Face as Parquet, with `subject_name`, `topic_name` and `exp` fields.
  - Caveat: one mirror says the licence "Needs More Information", and the questions were scraped from the web and mock tests. Get legal advice before commercial use.
- Community decks (MangoMedic, Sparrow-based or Preeti Sharma-based decks) have no clear redistribution licence. Let users **import their own `.apkg`** rather than bundling them.

## 4. Competitors
- **Oncourse**: 50k+ SRS cards (NEET-PG/USMLE/UKMLA), paid app.
- **CogniGuide**: flashcards from PDFs, with exam-date prioritisation (worth copying).
- r/MedSchoolAnkiIndia shows demand for a tagged, subject-wise PYQ deck and a free PYQ app.

## Suggested path (draft)
1. Fork zsh-eng/spaced or ts-fsrs-demo and use ts-fsrs.
2. Seed with MedMCQA, tagged by subject/topic, with `exp` on the card back.
3. Add an `.apkg` importer.
4. Differentiate with an exam-date countdown, weak-area dashboards and email/WhatsApp reminders.
5. Later: AI card generation with your own key.

## Open research questions
- [ ] MedQA/USMLE, PubMedQA and other datasets (not yet verified)
- [ ] NEET PG syllabus and subject/topic weightage data
- [ ] MedMCQA licensing for commercial use
- [ ] Pick a starter repo (spaced vs ts-fsrs-demo) after reviewing both
- [ ] Reminder channels: WhatsApp Business API cost and email providers
