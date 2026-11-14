# ADR 0006: Leaderboard and practice heatmap

- **Status:** Accepted
- **Date:** 2026-11-14

## Context
The owner wants healthy competition: a leaderboard by total score (overall and per subject), a relative view so everyone has something to chase, and a GitHub-style calendar of practice days.

## Decision

### Leaderboard (`/leaderboard`, signed-in users only)
- **Score:** NEET PG marks (+4 / −1 / 0) from `attempts`, computed live in one grouped query (`src/lib/leaderboard-data.ts`). The rules are pure functions (`src/lib/leaderboard.ts`), unit-tested.
- **Windows:** "This week" is the default. It runs from Monday 00:00 IST, so newcomers can compete. There is also "All time". A subject filter (`?subject=`) limits everything to that subject's questions.
- **Ranking:** higher score first, then more correct answers, then fewer answers. Equal scores share a rank (1, 2, 2, 4).
- **Relative views:**
  - your rank and percentile ("ahead of X% of other aspirants")
  - points needed to pass the next person
  - "Around you": the 2 people above and below you
  - "Most accurate", with at least 50 answers (20 within a subject), so careful practice wins and not just volume
  - "Most improved this week": accuracy this week versus all earlier answers, with at least 20 answers in each
- **Identity, by the owner's decision:** first name and last initial ("Priya S."), plus the **full email address** in dim text, visible to every signed-in user. No photo.
  - **Opt-out:** `users.leaderboard_hidden` (migration 0005), toggled from the page. Hidden users don't appear for anyone else but still see their own rank.
  - The privacy policy says this explicitly.
  - The owner was told about the privacy risks of full emails (harvesting, consent under the DPDP Act) and chose them over a masked email.
- **Test account:** the e2e account is always created hidden, so real users never see it.

### Practice heatmap (on `/progress`)
- It covers 53 Monday-first weeks of IST days, with each square shaded by questions answered that day: 1–9, 10–24, 25–49 and 50+.
  - The thresholds are fixed, so a shade means the same thing every month.
  - Phones show the last 22 weeks so squares stay tappable without scrolling sideways.
- **Colours:** one teal hue, light to dark for more questions. The ramps (`--heat-1..4`) were validated with the dataviz palette checker as ordinal ramps against the card surface, for light (`#14b8a6 → #134e4a`) and dark (`#115e59 → #5eead4`) separately.
- Hovering a square shows its date and count. Screen readers get a one-line summary. The current and longest streaks sit beside the grid.

## Consequences
- The leaderboard is one aggregate query over `attempts`, plus a per-user day list for streaks. That is fine for hundreds of users. At thousands, precompute daily totals (a summary table refreshed when answers are saved, or by a nightly job) before Neon compute becomes a problem.
- Rows exist only for users who have answered something in the chosen window and subject.
- Showing emails makes MedMinutes responsible for that data. If complaints come in, switch to masked emails (a one-line change in the `Person` component in `src/app/leaderboard/page.tsx`).
