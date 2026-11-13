# MedMinutes

NEET PG MCQ practice with real exam marking: **+4 correct, −1 wrong, 0 skipped**. Spaced repetition (FSRS) comes next.

**Live:** https://medminutes.vercel.app · Status: Phase 1 shipped (practice + Google sign-in). See [docs/ROADMAP.md](docs/ROADMAP.md).

## Stack
Next.js 16 · React 19 · TypeScript (strict) · Tailwind CSS 4 · shadcn/ui · Auth.js (Google) · PostgreSQL (Neon) · Drizzle ORM · Zod · Vitest · Playwright · GitHub Actions · Vercel.
Everything runs on free tiers. See [ADR 0001](docs/adr/0001-free-tier-stack.md).

## Architecture
```
Browser ──► Next.js (Vercel) ──► Postgres (Neon)
                                   ▲
            scripts/import_medmcqa.py (uv) ── Hugging Face: MedMCQA
```
- `attempts` is an append-only log and the single source of truth for scores ([ADR 0002](docs/adr/0002-attempts-log-source-of-truth.md)).
- Marking rules are enforced in both application code and a database check constraint.
- Spaced repetition: FSRS (`ts-fsrs`) schedules every answered question; `review_cards` is derived from `attempts` and rebuildable ([ADR 0004](docs/adr/0004-spaced-repetition-fsrs.md)).

## Getting started
Prerequisites: Node 22 (`.nvmrc`), [uv](https://docs.astral.sh/uv/), a free [Neon](https://neon.tech) database.

```bash
npm install
neon env pull                     # writes DATABASE_URL(_UNPOOLED) to .env.local
# then add AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET (see .env.example)
npm run db:migrate                # create tables
npm run db:import -- --dry-run    # download + validate MedMCQA
npm run db:import                 # load ~174k questions (Dental/Unknown excluded)
npm run dev
```

## Branches and deploys
```
Release/Release_Dev ──(develop here; CI on every push)──► merge ──► main ──► Vercel production
```
- Only `main` deploys (see `vercel.json` → `git.deploymentEnabled`); other branches don't create previews.
- Production secrets (`DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`) live in Vercel's encrypted environment variables.

## Scripts
| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run lint` / `typecheck` / `test` | Quality checks (all run in CI) |
| `npm run test:e2e` | Browser tests (Playwright) against the local dev server, as a throwaway test user |
| `npm run db:generate` | Create a migration after changing `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations |
| `npm run db:studio` | Browse the database |
| `npm run db:import` | Import MedMCQA (`--dry-run`, `--limit N`) |
| `npm run srs:rebuild` | Rebuild FSRS review cards from the attempts log (`--dry-run`) |

## Project layout
```
src/app/        Next.js routes
src/components/ UI components (shadcn/ui in components/ui)
src/lib/        Scoring, data access, auth helpers
src/db/         Drizzle schema + client
e2e/            Playwright tests
drizzle/        Generated SQL migrations (committed)
scripts/        Data import (Python, run with uv)
docs/           Roadmap and architecture decision records
research/       Early research notes
```

## Data and licence
Questions come from [MedMCQA](https://huggingface.co/datasets/openlifescienceai/medmcqa). See [ADR 0003](docs/adr/0003-medmcqa-content.md) for licensing caveats.
