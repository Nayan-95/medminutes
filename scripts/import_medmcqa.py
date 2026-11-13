# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "pyarrow>=17",
#   "psycopg[binary]>=3.2",
#   "python-dotenv>=1.0",
# ]
# ///
"""Load MedMCQA (train + validation) from Hugging Face into Postgres.

The test split is skipped: it ships without answers (cop = -1) or explanations.

Usage:
    uv run scripts/import_medmcqa.py --dry-run              # download + validate, no DB
    uv run scripts/import_medmcqa.py                        # import everything
    uv run scripts/import_medmcqa.py --limit 5000           # import a subset

Reads DATABASE_URL from the environment or .env.local. Safe to re-run: rows are
keyed on (source, source_id) and existing ones are left untouched.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.request
from collections import Counter
from pathlib import Path

import pyarrow.parquet as pq

DATASET = "openlifescienceai/medmcqa"
SOURCE = "medmcqa"
SPLITS = ("train", "validation")
OPTIONS = ("A", "B", "C", "D")
ROOT = Path(__file__).resolve().parent.parent
CACHE_DIR = ROOT / "data" / "raw" / "medmcqa"


def parquet_urls() -> dict[str, list[str]]:
    """Ask the Hugging Face datasets server for the Parquet file URLs of each split."""
    api = f"https://datasets-server.huggingface.co/parquet?dataset={DATASET}"
    with urllib.request.urlopen(api, timeout=30) as resp:
        files = json.load(resp)["parquet_files"]
    urls: dict[str, list[str]] = {s: [] for s in SPLITS}
    for f in files:
        if f["config"] == "default" and f["split"] in urls:
            urls[f["split"]].append(f["url"])
    for split, found in urls.items():
        if not found:
            sys.exit(f"No Parquet files found for split '{split}'.")
    return urls


def download(url: str) -> Path:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    # URLs look like .../default/train/0000.parquet; keep split in the name.
    parts = url.rstrip("/").split("/")
    target = CACHE_DIR / f"{parts[-2]}-{parts[-1]}"
    if not target.exists():
        print(f"  downloading {parts[-2]}/{parts[-1]} ...")
        tmp = target.with_suffix(".part")
        urllib.request.urlretrieve(url, tmp)
        tmp.rename(target)
    return target


def clean(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def load_rows(limit: int | None) -> tuple[list[dict], Counter]:
    rows: list[dict] = []
    skipped: Counter = Counter()
    seen: set[str] = set()
    for split, urls in parquet_urls().items():
        for url in urls:
            table = pq.read_table(download(url))
            for r in table.to_pylist():
                cop = r.get("cop")
                options = [clean(r.get(k)) for k in ("opa", "opb", "opc", "opd")]
                question = clean(r.get("question"))
                subject = clean(r.get("subject_name"))
                source_id = clean(r.get("id"))
                if cop not in (0, 1, 2, 3):
                    skipped["no answer"] += 1
                    continue
                if not question or not all(options) or not subject or not source_id:
                    skipped["missing field"] += 1
                    continue
                if source_id in seen:
                    skipped["duplicate id"] += 1
                    continue
                seen.add(source_id)
                rows.append(
                    {
                        "source_id": source_id,
                        "question": question,
                        "options": options,
                        "correct": OPTIONS[cop],
                        "explanation": clean(r.get("exp")),
                        "subject": subject,
                        "topic": clean(r.get("topic_name")),
                        "split": split,
                    }
                )
                if limit and len(rows) >= limit:
                    return rows, skipped
    return rows, skipped


def report(rows: list[dict], skipped: Counter) -> None:
    by_split = Counter(r["split"] for r in rows)
    subjects = Counter(r["subject"] for r in rows)
    topics = {(r["subject"], r["topic"]) for r in rows if r["topic"]}
    with_exp = sum(1 for r in rows if r["explanation"])
    text_bytes = sum(
        len(r["question"]) + sum(map(len, r["options"])) + len(r["explanation"] or "") for r in rows
    )
    print(f"\nUsable questions: {len(rows):,}  {dict(by_split)}")
    print(f"Skipped: {dict(skipped) or 'none'}")
    print(f"Subjects: {len(subjects)}  Topics: {len(topics):,}")
    print(f"With explanation: {with_exp:,} ({with_exp / max(len(rows), 1):.0%})")
    print(f"Approx. text size: {text_bytes / 1_000_000:.0f} MB (before indexes/overhead)")
    print("Top subjects:")
    for name, n in subjects.most_common(21):
        print(f"  {n:>7,}  {name}")


def import_rows(rows: list[dict]) -> None:
    import psycopg
    from dotenv import load_dotenv

    load_dotenv(ROOT / ".env.local")
    url = os.environ.get("DATABASE_URL")
    if not url:
        sys.exit("DATABASE_URL is not set (put it in .env.local).")

    with psycopg.connect(url) as conn, conn.cursor() as cur:
        # Subjects
        for name in sorted({r["subject"] for r in rows}):
            cur.execute("insert into subjects (name) values (%s) on conflict (name) do nothing", (name,))
        cur.execute("select id, name from subjects")
        subject_ids = {name: sid for sid, name in cur.fetchall()}

        # Topics
        for subject, topic in sorted({(r["subject"], r["topic"]) for r in rows if r["topic"]}):
            cur.execute(
                "insert into topics (subject_id, name) values (%s, %s) "
                "on conflict (subject_id, name) do nothing",
                (subject_ids[subject], topic),
            )
        cur.execute("select id, subject_id, name from topics")
        topic_ids = {(sid, name): tid for tid, sid, name in cur.fetchall()}

        # Questions: COPY into a temp table, then insert the new ones.
        cols = (
            "source, source_id, question, option_a, option_b, option_c, option_d, "
            "correct_option, explanation, subject_id, topic_id"
        )
        # Same column types as `questions`, but no defaults (so no sequence ids are burned).
        cur.execute(
            f"create temp table staging_questions on commit drop as "
            f"select {cols} from questions with no data"
        )
        with cur.copy(f"copy staging_questions ({cols}) from stdin") as copy:
            for r in rows:
                sid = subject_ids[r["subject"]]
                copy.write_row(
                    (
                        SOURCE,
                        r["source_id"],
                        r["question"],
                        *r["options"],
                        r["correct"],
                        r["explanation"],
                        sid,
                        topic_ids.get((sid, r["topic"])) if r["topic"] else None,
                    )
                )
        cur.execute(
            f"insert into questions ({cols}) select {cols} from staging_questions "
            "on conflict (source, source_id) do nothing"
        )
        inserted = cur.rowcount
        conn.commit()

        cur.execute("select pg_size_pretty(pg_database_size(current_database()))")
        size = cur.fetchone()[0]
    print(f"\nInserted {inserted:,} new questions ({len(rows) - inserted:,} already present).")
    print(f"Database size now: {size}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true", help="download and validate only")
    parser.add_argument("--limit", type=int, help="import at most N questions")
    args = parser.parse_args()

    print(f"Loading {DATASET} ({', '.join(SPLITS)}) ...")
    rows, skipped = load_rows(args.limit)
    report(rows, skipped)
    if args.dry_run:
        print("\nDry run: nothing written.")
        return
    import_rows(rows)


if __name__ == "__main__":
    main()
