# ADR 0003: Seed content from MedMCQA

- **Status:** Accepted for personal / portfolio use. **Commercial use needs a licence review.**
- **Date:** 2026-11-13

## Context
We need a large, tagged bank of NEET PG–style MCQs with explanations.

## Decision
- Import `openlifescienceai/medmcqa` from Hugging Face using `scripts/import_medmcqa.py`.
- Use the **train and validation** splits only. The test split has no answers (`cop = -1`) and no explanations.
- Imports are idempotent: each row is keyed on `(source, source_id)`.

Dry run (2026-11-13): **187,005** usable questions (182,822 train + 4,183 validation), 21 subjects, 2,877 topics, 87% with explanations, about 113 MB of text.

## Open questions
- **Dental** (10,256 questions) belongs to NEET MDS, not NEET PG. Keep it or drop it?
- **Unknown** subject (3,047 questions). Keep it, drop it, or reclassify it?
- The dataset card says Apache 2.0, but one mirror says the licence "Needs More Information", and the questions were scraped from the web and mock tests. Get legal advice before any commercial use.
