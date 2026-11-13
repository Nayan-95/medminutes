# AI features: research summary (13 Nov 2026)

## Findings
- **Competitors ship grounded AI tutors.** AMBOSS "AI Mode" (Feb 2026) gives explanations and targeted practice grounded in its own content; UWorld "UAsk" expands its explanations on demand; Indian apps (Oncourse AI, Achieve StudyPal) market AI doubt-solving and adaptive revision. "Explain my mistake" and "ask a doubt" are now expected.
- **Grounding matters.** Strong tools anchor AI output to reviewed content instead of free generation.
- **AI-written medical MCQs are unreliable without expert review.** 2025–26 studies show widely varying error rates (one model: 41/60 questions flawed), weaker item discrimination, and hallucinated details. Generating new questions is last priority.
- **Free LLM tiers exist but are volatile:** Gemini free quotas reportedly cut in Dec 2025; Groq/OpenRouter/Cerebras free tiers are for prototyping; Cloudflare Workers AI gives 10k neurons/day. Verify at signup.

## Ranked feature ideas
1. **"Why was I wrong?"** after a wrong answer: contrast the chosen option with the correct one, grounded in the dataset explanation; **cache per (question, chosen option)** so each is generated once for all users.
2. **One-time question-bank cleanup** (batch): fix missing letters and junk, structure explanations (key point / why others are wrong / high-yield fact). Keep originals; review changes.
3. **Fill missing explanations** (~13% of questions), labelled "AI-generated".
4. **Ask a doubt** chat per question, with daily per-user limits.
5. **Memory hooks** for questions forgotten 2+ times (FSRS lapses).
6. **Weekly AI study coach** from the user's own stats (cheap, low risk).
7. **Similar questions and semantic search** via embeddings (pgvector works on Neon Free).
8. **Answer-key checker** (admin): AI flags suspect keys; a human decides; pairs with "Report this question".
9. Hints before answering (conflicts with exam marking; optional, later).
10. AI-generated new questions: **not recommended now**.

## Guardrails for every AI feature
Grounded in the question's own text · visible "AI · may contain errors" label + report button · no personal data sent (question and chosen option only) · per-user daily limits · monthly spend cap · cache results in the DB.

## Cost notes (estimates; measure on a sample before committing)
~1.5k input + 400 output tokens per explanation: Claude Opus 5.5 ≈ ₹1.2/call, Claude Haiku 5.5 ≈ ₹0.03/call (published per-token prices). Caching per question × option means each is paid for once. Run the cleanup only on flagged questions, using the Batch API discount.
