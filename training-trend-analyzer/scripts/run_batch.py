"""
Run trend ranking from mock or DB metrics.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path

if sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
if sys.stderr.encoding != "utf-8":
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.collectors.db import DbCollector
from src.collectors.mock import MockCollector
from src.scorer.calculator import ScoreCalculator

ROOT = Path(__file__).parent.parent
DEFAULT_DB = ROOT / "data" / "db" / "trend.db"

try:
    from tabulate import tabulate

    HAS_TABULATE = True
except ImportError:
    HAS_TABULATE = False


def _parse_raw_data(raw_data: str | None) -> tuple[dict, dict]:
    if not raw_data:
        return {}, {}
    try:
        payload = json.loads(raw_data)
    except json.JSONDecodeError:
        return {}, {}

    metadata = {}
    metadata_json = payload.get("metadata_json")
    if metadata_json:
        try:
            metadata = json.loads(metadata_json)
        except json.JSONDecodeError:
            metadata = {}
    return payload, metadata


def build_metrics_by_model(raw_metrics: list) -> dict:
    by_model = defaultdict(lambda: {"brand": "", "model": "", "category": "", "week_start": "", "metrics": {}})

    for metric in raw_metrics:
        key = f"{metric.brand_name}::{metric.model_name}::{metric.category_name}"
        entry = by_model[key]
        entry["brand"] = metric.brand_name
        entry["model"] = metric.model_name
        entry["category"] = metric.category_name
        entry["week_start"] = metric.week_start

        raw_input, metadata = _parse_raw_data(metric.raw_data)
        metric_entry = {
            "value": metric.value,
            "value_prev": metric.value_prev,
            "source_name": metric.source_name,
            "sample_size": raw_input.get("sample_size"),
            "metadata": metadata,
        }
        entry["metrics"][metric.metric_type] = metric_entry

    return dict(by_model)


def print_ranking(scores: list, category_filter: str | None = None) -> None:
    filtered = scores
    if category_filter:
        filtered = [score for score in scores if score.category_name == category_filter]

    if not filtered:
        print(f"\n=== Trend Ranking {scores[0].week_start if scores else ''} ===")
        print("No data")
        return

    show_notes = any(score.eligibility_notes for score in filtered)
    rows = []
    for index, score in enumerate(filtered, 1):
        label_icon = {
            "rising_fast": "++",
            "rising": "+",
            "stable": "=",
            "falling": "-",
            "falling_fast": "--",
            "unknown": "?",
        }.get(score.rank_label, "")
        change_str = f"{score.change_rate:+.1f}%" if score.change_rate is not None else "N/A"
        row = [
            index,
            label_icon,
            score.brand_name,
            score.model_name,
            score.category_name,
            f"{score.score:.1f}" if score.score is not None else "N/A",
            f"{score.score_prev:.1f}" if score.score_prev is not None else "N/A",
            change_str,
            score.rank_label,
        ]
        if show_notes:
            row.append(" | ".join(score.eligibility_notes[:2]))
        rows.append(row)

    headers = ["#", "", "Brand", "Model", "Category", "Score", "Prev", "Change", "Label"]
    if show_notes:
        headers.append("Notes")

    print(f"\n=== Trend Ranking {filtered[0].week_start} ===")
    if category_filter:
        print(f"Category: {category_filter}")
    print()

    if HAS_TABULATE:
        print(tabulate(rows, headers=headers, tablefmt="simple"))
    else:
        print("\t".join(headers))
        for row in rows:
            print("\t".join(str(cell) for cell in row))

    print(f"\nTotal {len(filtered)} models")


def print_metric_details(scores: list, limit: int = 10) -> None:
    print("\n=== Metric Details ===")
    for score in scores[:limit]:
        label = f"{score.brand_name} / {score.model_name}".strip(" /")
        print(f"- {label} [{score.rank_label}]")
        if score.eligibility_notes:
            print(f"  notes: {' | '.join(score.eligibility_notes)}")
        for metric, detail in sorted(score.metric_contributions.items()):
            print(
                f"  {metric}: raw={detail.get('raw_value')} used={detail.get('used_value')} "
                f"norm={detail.get('normalized')} weight={detail.get('effective_weight')}"
            )


def export_csv(scores: list, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.writer(handle)
        writer.writerow(
            [
                "rank",
                "brand",
                "model",
                "category",
                "week_start",
                "score",
                "score_prev",
                "change_rate",
                "rank_label",
                "eligibility_notes",
            ]
        )
        for index, score in enumerate(scores, 1):
            writer.writerow(
                [
                    index,
                    score.brand_name,
                    score.model_name,
                    score.category_name,
                    score.week_start,
                    score.score,
                    score.score_prev,
                    score.change_rate,
                    score.rank_label,
                    " | ".join(score.eligibility_notes),
                ]
            )
    print(f"\n[CSV] {output_path.resolve()}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Run trend ranking batch")
    parser.add_argument("--week", default="2026-03-30")
    parser.add_argument("--category")
    parser.add_argument("--output-csv", action="store_true")
    parser.add_argument("--use-db", action="store_true")
    parser.add_argument("--db-path", default=str(DEFAULT_DB))
    parser.add_argument("--no-discontinued", action="store_true")
    parser.add_argument("--only-commercial", action="store_true")
    parser.add_argument("--exclude-metric", action="append", default=[])
    parser.add_argument("--show-metric-details", action="store_true")
    args = parser.parse_args()

    print(f"[START] {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} week={args.week}")

    if args.use_db:
        collector = DbCollector(
            db_path=Path(args.db_path),
            no_discontinued=args.no_discontinued,
            only_commercial=args.only_commercial,
        )
    else:
        collector = MockCollector()

    result = collector.collect(keywords=[], week_start=args.week)
    if result.errors:
        for error in result.errors:
            print(f"[ERROR] {error}", file=sys.stderr)
        if not result.metrics:
            raise SystemExit(1)

    print(f"[COLLECT] {len(result.metrics)} metrics loaded from '{result.source_name}'")

    metrics_by_model = build_metrics_by_model(result.metrics)
    print(f"[NORMALIZE] {len(metrics_by_model)} models")

    calculator = ScoreCalculator(excluded_metrics=set(args.exclude_metric))
    scores = calculator.calculate(metrics_by_model)
    print(f"[SCORE] {len(scores)} models scored")
    if args.exclude_metric:
        print(f"[SCORE] excluded_metrics={','.join(args.exclude_metric)}")

    print_ranking(scores, category_filter=args.category)

    if args.show_metric_details:
        print_metric_details(scores)

    if args.output_csv:
        timestamp = args.week.replace("-", "")
        export_csv(scores, Path(f"data/output/ranking_{timestamp}.csv"))

    print(f"\n[END] {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


if __name__ == "__main__":
    main()
