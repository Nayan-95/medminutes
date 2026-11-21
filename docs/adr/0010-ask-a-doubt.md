# ADR 0010: Ask a doubt, built to spend few tokens

- **Status:** Accepted
- **Date:** 2026-11-21

## Context
The owner asked for a small AI chat about the current question, with the explicit constraint that it must **not waste tokens**. It runs on the same Gemini free tier as "Why was I wrong?" (ADR 0009) and shares its global daily cap.

## Decision

### When it's available
After a question's answer has been revealed: in the practice feedback panel for any result, and in a submitted mock's answer review. The server checks this with `hasSeenAnswer()` (`src/lib/seen.ts`, shared with reports), so the chat can't be used to get the answer early.

### Token savers (measured on 21 Nov with `gemini-3.8-flash`)
| Lever | Setting |
|---|---|
| Short replies | System prompt: at most 80 words of plain text. Hard `maxOutputTokens` of 320. |
| Cheap reasoning | `thinkingLevel: LOW` (MINIMAL is rejected by this model with a 400). Measured: 0 thinking tokens on real doubts, 53 on an off-topic refusal. |
| No format overhead | Plain text, no JSON schema. Markdown is stripped and the reply clipped to 900 characters on our side. |
| Small context | One compact user message: question, options, key, explanation **trimmed to 900 characters**, the doubt. A follow-up resends only the **last** exchange, not the whole chat. |
| Off-topic guard | Anything unrelated gets "Please ask about this question." (measured at about 6 output tokens). |
| Shared answers | Four one-tap doubts (Explain simply, Why are the other options wrong?, Memory trick, High-yield facts) are cached per **question × chip × prompt version** in `ai_doubt_cache` and shared by every student. They don't depend on the student's chat, so they are generated once. |
| Hard limits | Doubts of at most 300 characters. **3 doubts per question** per student in 24 h. **20 new model calls** per student in 24 h (cached chips don't count). The global cap (`AI_DAILY_CAP`, default 400 calls in 24 h) is shared with "Why was I wrong?". |

Measured cost per doubt: **about 250–300 tokens in total** (about 190 in, about 100 out), in about 3 s.

### Privacy
- Typed doubts and chats are **not stored**. Only a count goes to `ai_usage` (`kind = 'doubt'`).
- Chip answers contain no student data and are stored.
- The UI says "Don't share personal details. Chats aren't saved." The privacy page explains that typed doubts go to Gemini under free-tier terms.

### Data (migration 0009, additive)
- `ai_usage.kind` (`'explain' | 'doubt'`, default `'explain'`, so old rows and the deployed code keep working). Per-user limits are now counted per kind, so doubts don't use up the "Why was I wrong?" allowance. The global cap counts both.
- New table `ai_doubt_cache`.

## Consequences
- A student can't hold a long conversation: three doubts per question, each answered briefly. This is deliberate. Raise `DOUBT_LIMITS` in `src/lib/ai-doubt.ts` if it proves too tight.
- Answers are not grounded in a textbook beyond the dataset explanation and may be wrong. They're labelled "AI · may contain errors", and the report button sits next to them.
