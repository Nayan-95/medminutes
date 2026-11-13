# Where we are and what's next

_Last updated: 13 Nov 2026._

## Shipped (live on `main`)
Phase 0 foundation · Phase 1 MCQ practice + Google sign-in · UI redesign · Phase 2 progress dashboard · Phase 3 FSRS spaced repetition. Privacy and terms pages are live.

## Open decisions (ask the owner)
1. **AI integration, decided before more add-on features** (see `research/02-ai-features.md`):
   - **Budget:** strictly ₹0 with free LLM tiers (fragile), or a small capped monthly spend (e.g. ₹200–500) for reliable quality?
   - **Provider/model:** free tier vs Claude (Opus 5.5 default, Haiku 5.5 much cheaper; measure quality on a sample first).
   - **First feature:** recommended **"Why was I wrong?"** (grounded in the question's explanation, cached per question × chosen option), then the **one-time question-bank cleanup**.
2. **Phase 4 reminders.** Proposed: installable PWA + opt-in **Web Push**, one daily reminder ~8 AM IST via Vercel Cron (Hobby = once a day, ±59 min), only to users with reviews due who haven't practised that day. Email via Resend needs a custom domain (paid), so it's deferred. Waiting on "start phase 4" and a reminder time.
3. **Activity heatmap** (GitHub-style grid of practice days on /progress, IST days, sequential teal, tooltips). Proposed before or with Phase 4; order not decided.
4. **Publish Google sign-in** (Google Auth Platform → Branding: home `https://medminutes.vercel.app`, privacy `/privacy`, terms `/terms`, authorized domain `medminutes.vercel.app`, no logo; then Audience → Publish). Optional for now: non-test users can already sign in (only basic scopes). Do it before wide sharing.

## Smaller backlog
- "Report this question" button (bad MedMCQA text or answer keys).
- Neon compute (100 CU-h/month) is the first free-tier limit to watch; check Neon Monitoring and Vercel Usage weekly.
- Optional later: custom domain, which would enable email reminders and look more professional.
