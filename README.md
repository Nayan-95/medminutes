# MedMinutes

NEET PG MCQ practice with real exam marking: **+4 correct, −1 wrong, 0 skipped**. Spaced repetition (FSRS) comes next.

> Status: Phase 0 (foundation). See [docs/ROADMAP.md](docs/ROADMAP.md).

## Stack
Next.js 16 · React 19 · TypeScript (strict) · Tailwind CSS 4 · PostgreSQL (Neon) · Drizzle ORM · Zod · Vitest · GitHub Actions · Vercel.
Everything runs on free tiers. See [ADR 0001](docs/adr/0001-free-tier-stack.md).

## Architecture
```
Browser ──► Next.js (Vercel) ──► Postgres (Neon)
                                   ▲
            scripts/import_medmcqa.py (uv) ── Hugging Face: MedMCQA
```
- `attempts` is an append-only log and the single source of truth for scores ([ADR 0002](docs/adr/0002-attempts-log-source-of-truth.md)).
- Marking rules are enforced in both application code and a database check constraint.

## Getting started
Prerequisites: Node 22 (`.nvmrc`), [uv](https://docs.astral.sh/uv/), a free [Neon](https://neon.tech) database.

```bash
npm install
neon env pull                     # writes DATABASE_URL(_UNPOOLED) to .env.local
# then add AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET (see .env.example)
npm run db:migrate                # create tables
npm run db:import -- --dry-run    # download + validate MedMCQA
npm run db:import                 # load ~187k questions
npm run dev
```

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

## Project layout
```
src/app/        Next.js routes
src/db/         Drizzle schema + client
drizzle/        Generated SQL migrations (committed)
scripts/        Data import (Python, run with uv)
docs/           Roadmap and architecture decision records
research/       Early research notes
```

## Data and licence
Questions come from [MedMCQA](https://huggingface.co/datasets/openlifescienceai/medmcqa). See [ADR 0003](docs/adr/0003-medmcqa-content.md) for licensing caveats.
