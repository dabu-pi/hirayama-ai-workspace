"""
Summarize review CSV files into conservative alias candidate buckets.

Usage:
    python scripts/review_alias_candidates.py
    python scripts/review_alias_candidates.py --review-dir data/review --output data/review/alias_candidates_summary.csv
"""

import argparse
import csv
import io
import sys
from collections import defaultdict
from pathlib import Path

if sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

ROOT = Path(__file__).parent.parent
DEFAULT_REVIEW_DIR = ROOT / "data" / "review"
DEFAULT_OUTPUT = DEFAULT_REVIEW_DIR / "alias_candidates_summary.csv"


def classify_action(raw_brand: str, raw_name: str, raw_category: str, review_reason: str) -> str:
    reason_upper = (review_reason or "").upper()
    raw_brand = (raw_brand or "").strip()
    raw_name = (raw_name or "").strip()
    raw_category = (raw_category or "").strip()

    if "廃番モデル" in review_reason:
        return "keep_review_discontinued"
    if not raw_name and raw_category:
        return "hold_category_only"
    if "NO MATCH FOUND" in reason_upper:
        if raw_brand and raw_name:
            return "inspect_alias_candidate"
        return "hold_unresolved"
    if "UNKNOWN" in reason_upper:
        if raw_brand and raw_name:
            return "recheck_normalizer"
        return "hold_unresolved"
    return "manual_review"


def build_reason_note(action: str) -> str:
    notes = {
        "keep_review_discontinued": "Model matched but should remain review/discontinued.",
        "hold_category_only": "Category-only input is not a safe model alias candidate.",
        "inspect_alias_candidate": "Possible alias candidate if brand-scoped and seen repeatedly.",
        "recheck_normalizer": "Likely near-match; inspect hints and alias coverage before adding.",
        "hold_unresolved": "Keep unresolved until stronger evidence appears.",
        "manual_review": "No safe automated classification.",
    }
    return notes.get(action, "")


def summarize(review_dir: Path) -> list[dict]:
    grouped: dict[tuple, dict] = defaultdict(lambda: {"count": 0, "files": set()})

    for csv_path in sorted(review_dir.glob("*_review.csv")):
        with open(csv_path, encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                key = (
                    row.get("raw_brand", "").strip(),
                    row.get("raw_name", "").strip(),
                    row.get("raw_category", "").strip(),
                    row.get("review_reason", "").strip(),
                )
                grouped[key]["count"] += 1
                grouped[key]["files"].add(csv_path.name)

    rows = []
    for (raw_brand, raw_name, raw_category, review_reason), state in grouped.items():
        action = classify_action(raw_brand, raw_name, raw_category, review_reason)
        rows.append(
            {
                "occurrences": state["count"],
                "suggested_action": action,
                "reason_note": build_reason_note(action),
                "raw_brand": raw_brand,
                "raw_name": raw_name,
                "raw_category": raw_category,
                "review_reason": review_reason,
                "source_files": "|".join(sorted(state["files"])),
            }
        )

    rows.sort(
        key=lambda row: (
            row["suggested_action"],
            -int(row["occurrences"]),
            row["raw_brand"],
            row["raw_name"],
            row["raw_category"],
        )
    )
    return rows


def write_summary(rows: list[dict], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "occurrences",
        "suggested_action",
        "reason_note",
        "raw_brand",
        "raw_name",
        "raw_category",
        "review_reason",
        "source_files",
    ]
    with open(output_path, "w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description="Review CSV to alias candidate summary")
    parser.add_argument("--review-dir", default=str(DEFAULT_REVIEW_DIR))
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT))
    args = parser.parse_args()

    rows = summarize(Path(args.review_dir))
    write_summary(rows, Path(args.output))
    print(f"[SUMMARY] rows={len(rows)} output={Path(args.output).resolve()}")


if __name__ == "__main__":
    main()
