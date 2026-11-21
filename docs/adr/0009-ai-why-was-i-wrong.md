# ADR 0009: AI "Why was I wrong?" with Gemini

- **Status:** Accepted
- **Date:** 2026-11-21

## Context
Students who pick a wrong option want to know why their choice was wrong, not just read the stock explanation. Competitors ship this (`research/02-ai-features.md`). The project has a ₹0 budget, so the owner chose **Google's Gemini API free tier** for now.

Checked on the official pages on 21 Nov 2026 (they change often; re-check before relying on them):
- `gemini-3.8-flash` is stable and free of charge on the free tier.
- Free-tier rate limits are per Google Cloud project and reset at midnight Pacific time. The per-model numbers live in AI Studio and "are not guaranteed".
- On the free tier, content sent **is used to improve Google's products**. It is not on the paid tier.
- `gemini-2.5-flash` and `-pro` are deprecated (rerouted on 1 Dec 2026), so they are not used.

## Decision

### Feature
- After a **wrong** answer (practice feedback, or a submitted mock's answer review), a "Why was I wrong?" button asks the AI for three short parts: why the picked option is wrong, why the key is right, and one fact to remember.
- The card is labelled **"AI · may contain errors"** and sits next to the existing "Report a problem" button (ADR 0008).

### Grounding and safety
- The prompt contains only question content: the stem, the options, the key, the picked option and the dataset explanation (`buildPrompt` in `src/lib/ai-explain.ts`). **No user data is sent.**
- The system prompt treats the answer key as correct and forbids invented statistics, doses and guideline years.
- The model must answer in a fixed JSON shape (`responseJsonSchema`), which is validated again with zod. Over-long or malformed answers are rejected, not shown.
- The picked option comes from the user's own `attempts` row, never from the browser, so the model can't be asked about arbitrary questions.

### Cost control (cache first)
- `ai_explanations` caches answers per **question × picked option × prompt version** and shares them across all users. Each one is generated once; bumping `PROMPT_VERSION` regenerates on demand.
- `ai_usage` logs every request (cached or not) and sets limits over a rolling 24 hours:
  - **15 new model calls** per user (cached answers are free)
  - **150 requests** per user, cached included, so the cache can't be scraped
  - **400 new model calls in total** (`AI_DAILY_CAP` overrides this), to stay inside the free tier
- A call is counted **before** it is made, so parallel clicks can't overshoot. The call times out after 25 s. A 429 from Gemini shows "busy, try again in a minute".

### Configuration
- `GEMINI_API_KEY` (secret, server only, set in `.env.local` and Vercel). Optional: `GEMINI_MODEL` (default `gemini-3.8-flash`) and `AI_DAILY_CAP`.
- Without a key, the app still serves saved explanations and otherwise says "not available right now". Builds and CI need no key.
- SDK: `@google/genai`, pinned to an exact version. `src/lib/ai-gemini.ts` and `src/lib/ai-data.ts` import `server-only`, so the key can never reach a client bundle.

## Consequences
- Question content (from MedMCQA, not user data) may be used by Google to improve its products while we're on the free tier. The privacy page says so.
- Free-tier limits can change without notice. If quality or limits become a problem, the provider can be swapped behind `generateExplanation()` (for example a paid Gemini tier or Claude Haiku 5.5, estimated at ₹0.03 per explanation). That needs the owner's approval of a budget.
- AI answers can still be wrong. Students can report them, and the owner can delete a bad row from `ai_explanations` (it regenerates on the next request).
- Migration 0008 is additive. No `srs:rebuild` needed.

## Not done yet
- An admin view of saved AI answers, and a "this AI answer was wrong" signal tied to reports.
- Pre-generating answers in bulk with the batch API.
