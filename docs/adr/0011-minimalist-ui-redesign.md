# ADR 0011: Site-wide visual refresh with the minimalist-ui skill

- **Status:** Accepted
- **Date:** 2026-11-22

## Context
The owner asked for a minimalist-ui audit of the home screen (installed in `.claude/skills/minimalist-ui`), then asked for every finding to be applied across the whole site, with freedom to improve the UI as long as features keep working. The audit found rounded corners up to 22px, shadows up to 18% opacity, a 18% teal glow, cool blue-grey neutrals, no editorial typography, a generic three-equal-cards feature row, and a keyboard hint that broke across lines on phones.

Project rules take priority over the skill (CLAUDE.md): Lucide icons, the validated teal and red answer colours, shadcn on Base UI, dark mode, ₹0 budget.

## Decision

### Tokens (`src/app/globals.css`), so every page changes together
| | Before | After |
|---|---|---|
| Canvas (light / dark) | `#f7f7f8` / `#0c0c0e` | warm `#fbfbfa` / `#121211` |
| Text | `#0b0b0f` | charcoal `#111111` (dark: `#edecea`) |
| Muted text | `#63636e` | warm `#6f6e69` (5.1:1 on white). The skill's `#787774` fails AA at 4.48:1, so we don't use it. |
| Borders | `#e6e6ea` | `#eaeaea` |
| `--radius` | 0.75rem | 0.5rem. Cards use `rounded-xl` (~11px, never above 12px); nested items use `rounded-lg` (8px). |
| Shadows | up to 0.18 opacity | at most 0.05. Borders carry structure. |
| Pastel tags | none | `tag-{red,blue,green,yellow}` with dark-mode pairs, all AA. For tags and icon backgrounds only. |

Teal and red answer colours and the heatmap ramp are unchanged.

### Typography
- **Newsreader** (Google Fonts via `next/font`, free) for page titles, the home hero and big score numbers (`font-display` utility). Body and UI text stay Geist; MCQ question text stays sans-serif for readability.
- `eyebrow` utility: Geist Mono, uppercase, wide tracking, for stat labels and section labels.

### Components
- `PageHeader` (`src/components/page-header.tsx`): one title block for Practice, Mock test, Progress, Leaderboard and Question reports.
- `MainNav` (`src/components/main-nav.tsx`): header links now mark the current page (`aria-current`, underline on the header rule).
- `Reveal` (`src/components/reveal.tsx`): content below the fold fades up once, 600 ms, staggered 80 ms. Server HTML is always visible; only content still off-screen after hydration is hidden, and `prefers-reduced-motion` turns it off.
- Buttons press with `scale(0.98)`; `Kbd` uses the mono font with a hairline border.

### Home page
Serif hero; the sample question sits in a minimal window frame; stats strip with mono labels; an uneven bento grid covering every shipped feature (marking, shortcuts, explanations and AI, FSRS reviews, mocks, progress); a borderless FAQ using native `<details>` (works without JS); a closing band whose shortcut hint stays on one line and is hidden on phones.

## Consequences
- Neutrals and radius change on every page at once. Rolling back is one revert of `globals.css`.
- One more web font (Newsreader, normal and italic) adds roughly 30–60 KB on first load, served from our own domain by `next/font`.
- Future UI work should use the tokens, `font-display`, `eyebrow` and `PageHeader` rather than one-off sizes and shadows.
