# MedMinutes: notes for Claude Code

NEET PG MCQ practice with real exam marking (+4 / −1 / 0), Google sign-in, a progress dashboard and FSRS spaced repetition.
- Live: https://medminutes.vercel.app · Repo: github.com/Nayan-95/medminutes
- **Start of every session:** read `docs/NEXT.md` (status, open decisions, what to build next), then `docs/ROADMAP.md`. Design decisions are in `docs/adr/`. Next.js 16 agent rules are in `AGENTS.md`.

## Working agreements (from the owner)
- **₹0 budget.** Free tiers only (Vercel Hobby, Neon Free, GitHub Actions, Google OAuth). Never add a paid service or API without asking. Verify free-tier limits on official pages; they change.
- **Branches:** develop and push on `Release/Release_Dev` (CI runs on every push). **Merging into `main` deploys production.** Merge only when the owner says "merge" (fast-forward), then smoke-test https://medminutes.vercel.app.
- The owner is learning. Explain in plain words, give step-by-step instructions for anything they must click, and never ask them to paste secrets into chat (they go in `.env.local` or Vercel env vars).
- Ask before destructive or outward-facing actions: deleting data, pushing to `main`, changing Google/Vercel/Neon settings.
- Resume-grade quality: tests, docs and ADRs with each feature; review UI with screenshots (light and dark, desktop and mobile).

## Gotchas
- **Local dev and production share the same Neon database** (branch `production`). Migrations must be additive or backward compatible with the deployed code; apply with `npm run db:migrate` (uses `DATABASE_URL_UNPOOLED`).
- After deploying anything that changes FSRS scheduling, run `npm run srs:rebuild` (`--dry-run` first). `review_cards` is derived from `attempts` (ADR 0002, 0004).
- **Next 16 Cache Components:** anything reading the session, cookies, the DB, `Date`/random must run at request time inside `<Suspense>` (`await connection()`); `getCurrentUser()` already calls it. Builds must pass **without** any env vars (CI has none): `env DATABASE_URL= DATABASE_URL_UNPOOLED= AUTH_SECRET= AUTH_GOOGLE_ID= AUTH_GOOGLE_SECRET= npm run build`.
- Node 22 via fnm (`eval "$(fnm env)"` in non-interactive shells). `ts-fsrs` is pinned to 5.4.2 (v6 needs Node 24; see ADR 0004).
- DB round trips from the owner's machine (India → Neon us-east-2) are ~330 ms, so local pages and e2e are slow. Production (Vercel iad1) is close to the DB.
- e2e tests sign in as `e2e-test-user` with a session cookie minted from `AUTH_SECRET` (`e2e/global-setup.ts`) and delete that user afterwards. They run against the shared DB, so never touch other users' rows.
- MedMCQA text has stray HTML (cleaned at display by `src/lib/text.ts`) and missing letters ("hypeension") that code can't fix.
- Answer colours: teal `#0d9488` (correct) and red `#ef4444` (wrong), validated for colour-blind separation in both themes. Always pair with an icon and label.
- UI kit: shadcn/ui on **Base UI** (not Radix): use `render={<Link/>}`, not `asChild`. `cn` comes from the `cn` package.

## Commands
| | |
|---|---|
| `npm run dev` | dev server on :3000 |
| `npm run lint` · `npm run typecheck` · `npm test` | checks (all in CI) |
| `npm run test:e2e` | Playwright (needs dev server + `.env.local`) |
| `npm run db:generate` / `db:migrate` / `db:studio` | Drizzle migrations / DB browser |
| `npm run db:import` | MedMCQA import (excludes Dental and Unknown) |
| `npm run srs:rebuild` | rebuild FSRS cards from attempts |
| `neon env pull` · `vercel env ls production` | env management (CLIs are logged in on the owner's Mac) |
