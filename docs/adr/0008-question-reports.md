# ADR 0008: Students report bad questions

- **Status:** Accepted
- **Date:** 2026-11-18

## Context
MedMCQA was scraped from the web. Some questions have stray HTML, missing letters ("hypeension") or a wrong answer key, and code can't detect most of these. Students notice them while practising, so they are the cheapest way to find them. A report button is also the first step towards fixing the bank (`docs/NEXT.md`, smaller backlog).

## Decision

### What students see
- A **"Report a problem"** button appears only **after the answer is revealed**: in the practice feedback panel, and in a submitted mock's answer review. Reporting before answering would hint that something is off, and the answer key is the most common complaint.
- It opens an inline form, not a modal: one reason (wrong answer key, wrong or misleading explanation, typo or garbled text, unclear or missing information, something else) and an optional note of up to 500 characters. "Something else" requires a note.
- After sending, the button becomes "Reported. Thanks, we'll check this question." It stays that way on reload while the report is open.
- Page keyboard shortcuts (Enter, S, 1–4) are switched off inside the form (`data-no-shortcuts`).

### Data (`question_reports`, migration 0007, additive)
- One row per **user × question** (unique). Reporting again replaces the reason and note and reopens the report. This caps spam at one row per question per user without rate limiting.
- `status`: `open` → `fixed` or `dismissed` (and back to `open`). `note` is limited to 500 characters by a check constraint as well as by validation.
- The server only accepts a report on a question the user has **seen the answer to**: one they answered, or one in a session that has ended (e.g. a submitted mock with unvisited questions).
- Rows cascade-delete with the user, so a data deletion request removes them.

### What the owner sees (`/admin/reports`)
- Admins are the emails in the **`ADMIN_EMAILS`** env var (comma-separated, case-insensitive). If it is missing or empty, **nobody** is an admin, so builds and CI (no env vars) stay locked.
- For everyone else the page responds "not found" and the menu link is hidden. Server actions check admin status again.
- Reports are grouped by question, most-reported first (50 per page), with the full question, the answer key, the explanation, the reasons and notes. **Reporters are anonymous** on this page.
- Buttons: **Mark fixed**, **Dismiss**, and **Reopen** on closed tabs. Editing the question itself stays in Drizzle Studio (`npm run db:studio`) for now.

## Consequences
- Fixing a wrong answer key in `questions.correct_option` does **not** change old `attempts` (they are an append-only log, ADR 0002), so past scores keep the old marking. Re-marking history is a separate, deliberate decision.
- No email or push alert on new reports. The owner checks the page. This can be revisited with reminders (Phase 4).
- The privacy page lists reports among the data we collect.

## Alternatives considered
- **GitHub issue per report:** public, needs a token, and students would need GitHub accounts. Rejected.
- **Hard-coding the owner's email:** the repo is public, so it would publish the address. The env var keeps it out of git.
