# ADR 0001: Free-tier stack

- **Status:** Accepted
- **Date:** 2026-11-13

## Context
The product must run at ₹0 while it is being built, yet use the same tools and practices you'd find in a professional team.

## Decision
| Layer | Choice |
|---|---|
| App | Next.js 16 (App Router), React 19, TypeScript strict |
| UI | Tailwind CSS 4, shadcn/ui (Base UI primitives), lucide icons |
| Database | PostgreSQL on Neon (free tier) |
| ORM / migrations | Drizzle ORM + drizzle-kit, with versioned SQL migrations in `drizzle/` |
| Validation | Zod |
| Auth | Auth.js v5 with Google sign-in, JWT sessions |
| Data loading | Python script run with `uv` (`scripts/import_medmcqa.py`) |
| Tests | Vitest (unit), Playwright (end-to-end) |
| CI | GitHub Actions (free and unlimited on a public repo) |
| Hosting | Vercel Hobby; only `main` deploys (`vercel.json`) |
| Errors | Sentry free tier (planned) |

## Consequences
- **Vercel Hobby doesn't allow commercial use.** If the app ever charges money, move hosting to Cloudflare (free, commercial use allowed) or a paid plan.
- **Neon Free: 1 GB storage per project, 100 CU-hours of compute per month** (raised from 0.5 GB in Oct 2026). After importing 173,702 questions the database is 148 MB. If compute hours run out, the database refuses connections until the next month.
- **Vercel Hobby: 1M function invocations, 4 Active-CPU hours and 100 GB transfer per month.** Exceeding a limit pauses that feature for 30 days; there are no charges.
- **Google sign-in** only requests name, email and profile (non-sensitive scopes), so there is no 100-user cap for unverified apps.
- Supabase was the alternative; its free projects pause after a period of inactivity.
