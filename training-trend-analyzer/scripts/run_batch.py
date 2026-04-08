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
DEFAULT_COMPARE_THRESHOLD = 0.5

try:
    from tabulate import tabulate

    HAS_TABULATE = True
except ImportError:
    HAS_TABULATE = False

LABEL_ICONS = {
    "rising_fast": "++",
    "rising": "+",
    "stable": "=",
    "falling": "-",
    "falling_fast": "--",
    "unknown": "?",
}

COMPARE_SOURCE_SET_DEFS = [
    ("gt_only", "GT only", {"search_suggest_count", "youtube_suggest_count"}),
    ("gt_plus_gs", "GT + GS", {"youtube_suggest_count"}),
    ("all_three", "GT + GS + YT", set()),
]

COMPARE_DELTA_LABELS = {
    "delta_gt_to_gs": "GS",
    "delta_gs_to_all": "YT",
}


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
        label_icon = LABEL_ICONS.get(score.rank_label, "")
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


def calculate_scores_for_sets(metrics_by_model: dict, set_defs: list[tuple[str, str, set[str]]]) -> dict[str, dict]:
    result = {}
    for key, label, excluded_metrics in set_defs:
        calculator = ScoreCalculator(excluded_metrics=excluded_metrics)
        scores = calculator.calculate(metrics_by_model)
        indexed_scores = {
            f"{score.brand_name}::{score.model_name}::{score.category_name}": {
                "brand": score.brand_name,
                "model": score.model_name,
                "category": score.category_name,
                "score": score.score,
                "score_prev": score.score_prev,
                "change_rate": score.change_rate,
                "rank_label": score.rank_label,
                "rank": rank,
                "eligibility_notes": list(score.eligibility_notes),
            }
            for rank, score in enumerate(scores, 1)
        }
        result[key] = {"label": label, "scores": scores, "indexed": indexed_scores}
    return result


def build_comparison_rows(
    score_sets: dict[str, dict],
    category_filter: str | None = None,
) -> list[dict]:
    ordered_keys = [key for key, _, _ in COMPARE_SOURCE_SET_DEFS]
    all_models = set()
    for key in ordered_keys:
        all_models.update(score_sets[key]["indexed"].keys())

    rows = []
    for model_key in sorted(
        all_models,
        key=lambda item: (
            -(score_sets["all_three"]["indexed"].get(item, {}).get("score") or -1),
            item,
        ),
    ):
        final_entry = score_sets["all_three"]["indexed"].get(model_key)
        sample_entry = final_entry
        if sample_entry is None:
            for key in ordered_keys:
                sample_entry = score_sets[key]["indexed"].get(model_key)
                if sample_entry:
                    break
        if sample_entry is None:
            continue

        if category_filter and sample_entry["category"] != category_filter:
            continue

        gt_only = score_sets["gt_only"]["indexed"].get(model_key)
        gt_plus_gs = score_sets["gt_plus_gs"]["indexed"].get(model_key)
        all_three = score_sets["all_three"]["indexed"].get(model_key)

        gt_only_score = gt_only.get("score") if gt_only else None
        gt_plus_gs_score = gt_plus_gs.get("score") if gt_plus_gs else None
        all_three_score = all_three.get("score") if all_three else None
        delta_gt_to_gs = _safe_delta(gt_only_score, gt_plus_gs_score)
        delta_gs_to_all = _safe_delta(gt_plus_gs_score, all_three_score)
        gt_to_gs_summary = _build_delta_summary(COMPARE_DELTA_LABELS["delta_gt_to_gs"], delta_gt_to_gs)
        gs_to_all_summary = _build_delta_summary(COMPARE_DELTA_LABELS["delta_gs_to_all"], delta_gs_to_all)

        rows.append(
            {
                "brand": sample_entry["brand"],
                "model": sample_entry["model"],
                "category": sample_entry["category"],
                "gt_only_score": gt_only_score,
                "gt_plus_gs_score": gt_plus_gs_score,
                "all_three_score": all_three_score,
                "delta_gt_to_gs": delta_gt_to_gs,
                "delta_gs_to_all": delta_gs_to_all,
                "gt_to_gs_summary": gt_to_gs_summary,
                "gs_to_all_summary": gs_to_all_summary,
                "delta_summary": _combine_delta_summaries(gt_to_gs_summary, gs_to_all_summary),
                "gt_only_rank": gt_only.get("rank") if gt_only else None,
                "gt_plus_gs_rank": gt_plus_gs.get("rank") if gt_plus_gs else None,
                "all_three_rank": all_three.get("rank") if all_three else None,
                "rank_path": _rank_path(gt_only, gt_plus_gs, all_three),
            }
        )
    return rows


def annotate_significance(rows: list[dict], threshold: float) -> list[dict]:
    annotated = []
    for row in rows:
        annotated_row = dict(row)
        annotated_row["has_rank_change"] = _has_rank_change(row)
        annotated_row["is_significant"] = _is_significant_row(row, threshold)
        annotated.append(annotated_row)
    return annotated


def filter_significant_rows(rows: list[dict]) -> list[dict]:
    return [row for row in rows if row.get("is_significant")]


def print_comparison_summary(rows: list[dict], week_start: str, category_filter: str | None = None) -> None:
    print(f"\n=== Source Set Comparison {week_start} ===")
    if category_filter:
        print(f"Category: {category_filter}")

    if not rows:
        print("No data")
        return

    table_rows = []
    for index, row in enumerate(rows, 1):
        table_rows.append(
            [
                index,
                row["brand"],
                row["model"],
                row["category"],
                _fmt_score(row["gt_only_score"]),
                _fmt_score(row["gt_plus_gs_score"]),
                _fmt_score(row["all_three_score"]),
                _fmt_compare_delta(row["delta_gt_to_gs"]),
                _fmt_compare_delta(row["delta_gs_to_all"]),
                row["delta_summary"],
                row["rank_path"],
            ]
        )

    headers = [
        "#",
        "Brand",
        "Model",
        "Category",
        "GT only",
        "GT + GS",
        "GT + GS + YT",
        "d(GT->GS)",
        "d(GS->3)",
        "Why",
        "Rank path",
    ]

    print()
    if HAS_TABULATE:
        print(tabulate(table_rows, headers=headers, tablefmt="simple"))
    else:
        print("\t".join(headers))
        for row in table_rows:
            print("\t".join(str(cell) for cell in row))

    print(f"\nTotal {len(rows)} models")


def export_comparison_csv(rows: list[dict], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.writer(handle)
        writer.writerow(
            [
                "brand",
                "model",
                "category",
                "gt_only_score",
                "gt_plus_gs_score",
                "all_three_score",
                "delta_gt_to_gs",
                "delta_gs_to_all",
                "gt_to_gs_summary",
                "gs_to_all_summary",
                "delta_summary",
                "is_significant",
                "has_rank_change",
                "gt_only_rank",
                "gt_plus_gs_rank",
                "all_three_rank",
                "rank_path",
            ]
        )
        for row in rows:
            writer.writerow(
                [
                    row["brand"],
                    row["model"],
                    row["category"],
                    row["gt_only_score"],
                    row["gt_plus_gs_score"],
                    row["all_three_score"],
                    row["delta_gt_to_gs"],
                    row["delta_gs_to_all"],
                    row["gt_to_gs_summary"],
                    row["gs_to_all_summary"],
                    row["delta_summary"],
                    row.get("is_significant", False),
                    row.get("has_rank_change", False),
                    row["gt_only_rank"],
                    row["gt_plus_gs_rank"],
                    row["all_three_rank"],
                    row["rank_path"],
                ]
            )
    print(f"\n[CSV] {output_path.resolve()}")


def _safe_delta(left: float | None, right: float | None) -> float | None:
    if left is None or right is None:
        return None
    return round(right - left, 2)


def _fmt_score(value: float | None) -> str:
    return f"{value:.1f}" if value is not None else "N/A"


def _fmt_delta(value: float | None) -> str:
    return f"{value:+.1f}" if value is not None else "N/A"


def _fmt_compare_delta(value: float | None) -> str:
    if value is None:
        return "N/A"
    if _is_display_zero_delta(value):
        return "-"
    return _fmt_delta(value)


def _is_delta_significant(value: float | None, threshold: float) -> bool:
    return value is not None and abs(value) >= threshold


def _has_rank_change(row: dict) -> bool:
    return row.get("gt_only_rank") != row.get("gt_plus_gs_rank") or row.get("gt_plus_gs_rank") != row.get("all_three_rank")


def _is_significant_row(row: dict, threshold: float) -> bool:
    return (
        _is_delta_significant(row.get("delta_gt_to_gs"), threshold)
        or _is_delta_significant(row.get("delta_gs_to_all"), threshold)
        or _has_rank_change(row)
    )


def _build_delta_summary(label: str, value: float | None) -> str:
    if value is None:
        return "N/A"
    if _is_display_zero_delta(value):
        return "-"
    return f"{label}:{_fmt_delta(value)}"


def _combine_delta_summaries(*parts: str) -> str:
    visible = [part for part in parts if part and part not in {"N/A", "-"}]
    return " / ".join(visible) if visible else "-"


def _is_display_zero_delta(value: float | None) -> bool:
    if value is None:
        return False
    return _fmt_delta(value) in {"+0.0", "-0.0"}


def _rank_path(*entries: dict | None) -> str:
    parts = []
    for entry in entries:
        if not entry:
            parts.append("N/A")
            continue
        parts.append(str(entry["rank"]))
    return " -> ".join(parts)


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
    parser.add_argument("--compare-source-sets", action="store_true")
    parser.add_argument("--compare-threshold", type=float, default=DEFAULT_COMPARE_THRESHOLD)
    parser.add_argument("--compare-only-significant", action="store_true")
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

    if args.compare_source_sets:
        score_sets = calculate_scores_for_sets(metrics_by_model, COMPARE_SOURCE_SET_DEFS)
        comparison_rows = build_comparison_rows(score_sets, category_filter=args.category)
        comparison_rows = annotate_significance(comparison_rows, threshold=args.compare_threshold)
        display_rows = filter_significant_rows(comparison_rows) if args.compare_only_significant else comparison_rows
        print("[COMPARE] source_sets=GT only / GT + GS / GT + GS + YT")
        print(
            f"[COMPARE] threshold={args.compare_threshold:.1f} "
            f"only_significant={'yes' if args.compare_only_significant else 'no'} "
            f"rank_change_included=yes"
        )
        print_comparison_summary(display_rows, args.week, category_filter=args.category)
        if args.output_csv:
            timestamp = args.week.replace("-", "")
            export_comparison_csv(display_rows, Path(f"data/output/ranking_compare_{timestamp}.csv"))
    else:
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
