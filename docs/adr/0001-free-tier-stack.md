# ADR 0001: Free-tier stack

- **Status:** Accepted
- **Date:** 2026-11-13

## Context
The product must run at ₹0 while it is being built, yet use the same tools and practices you'd find in a professional team.

## Decision
| Layer | Choice |
|---|---|
| App | Next.js 16 (App Router), React 19, TypeScript strict |
| UI | Tailwind CSS 4 (shadcn/ui to be added in Phase 1) |
| Database | PostgreSQL on Neon (free tier) |
| ORM / migrations | Drizzle ORM + drizzle-kit, with versioned SQL migrations in `drizzle/` |
| Validation | Zod |
| Auth | Auth.js with Google sign-in (Phase 1) |
| Data loading | Python script run with `uv` (`scripts/import_medmcqa.py`) |
| Tests | Vitest (unit), Playwright (end-to-end, Phase 1) |
| CI | GitHub Actions (free and unlimited on a public repo) |
| Hosting | Vercel Hobby |
| Errors | Sentry free tier (Phase 1) |

## Consequences
- **Vercel Hobby doesn't allow commercial use.** If the app ever charges money, move hosting to Cloudflare (free, commercial use allowed) or a paid plan.
- **Neon's free storage is about 0.5 GB.** MedMCQA is about 113 MB of raw text, so check the database size after the full import.
- Supabase was the alternative; its free projects pause after a period of inactivity.
