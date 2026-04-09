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
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

if sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
if sys.stderr.encoding != "utf-8":
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.collectors.db import DbCollector
from src.collectors.mock import MockCollector
from src.publication.artifact_schema import build_publish_ready_schema_fields
from src.scorer.calculator import ScoreCalculator

ROOT = Path(__file__).parent.parent
DEFAULT_DB = ROOT / "data" / "db" / "trend.db"
DEFAULT_COMPARE_THRESHOLD = 0.5
DRIVER_TIE_EPSILON = 0.1

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

HEALTH_SOURCE_DEFS = [
    {
        "key": "gt",
        "label": "GT",
        "metric_type": "google_trends_interest",
        "required": True,
    },
    {
        "key": "gs",
        "label": "GS",
        "metric_type": "search_suggest_count",
        "required": False,
    },
    {
        "key": "yt",
        "label": "YT",
        "metric_type": "youtube_suggest_count",
        "required": False,
    },
]


@dataclass
class SourceHealth:
    key: str
    label: str
    metric_type: str
    status: str
    present_models: int
    expected_models: int
    reasons: list[str] = field(default_factory=list)
    affects_review: bool = False
    blocking: bool = False


@dataclass
class RunHealth:
    overall_status: str
    publish_ready: bool
    source_statuses: dict[str, SourceHealth]
    reasons: list[str] = field(default_factory=list)


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
            "sample_size": raw_input.get("sample_size", metric.sample_size),
            "metadata": metadata,
        }
        entry["metrics"][metric.metric_type] = metric_entry

    return dict(by_model)


def _classify_health_error(error: str) -> str | None:
    normalized = error.lower()
    if "youtube_suggest" in normalized or "youtube suggest" in normalized:
        return "yt"
    if (
        "google_suggest" in normalized
        or "google suggest" in normalized
        or "search_suggest" in normalized
    ):
        return "gs"
    if "google_trends" in normalized or "google trends" in normalized or "pytrends" in normalized:
        return "gt"
    return None


def _group_health_errors(errors: list[str]) -> tuple[dict[str, list[str]], list[str]]:
    grouped = defaultdict(list)
    global_errors = []
    for error in errors:
        source_key = _classify_health_error(error)
        if source_key is None:
            global_errors.append(error)
            continue
        grouped[source_key].append(error)
    return dict(grouped), global_errors


def _evaluate_source_health(
    source_def: dict,
    metrics_by_model: dict,
    source_errors: list[str],
) -> SourceHealth:
    metric_type = source_def["metric_type"]
    expected_models = len(metrics_by_model)
    present_metrics = []

    for entry in metrics_by_model.values():
        metric = entry["metrics"].get(metric_type)
        if metric is not None:
            present_metrics.append(metric)

    present_models = len(present_metrics)
    reasons = []
    status = "ok"
    affects_review = False
    blocking = False

    if present_models == 0:
        status = "failed" if source_errors else "missing"
        if expected_models:
            reasons.append(f"{source_def['label']} metrics unavailable ({present_models}/{expected_models} models)")
        else:
            reasons.append(f"{source_def['label']} metrics unavailable")
    elif present_models < expected_models:
        status = "warning"
        affects_review = True
        reasons.append(f"{source_def['label']} partial coverage {present_models}/{expected_models} models")

    missing_sample_size = sum(1 for metric in present_metrics if metric.get("sample_size") is None)
    if missing_sample_size:
        if status == "ok":
            status = "warning"
        reasons.append(
            f"{source_def['label']} sample_size missing {missing_sample_size}/{present_models}"
        )

    if metric_type == "google_trends_interest":
        missing_metadata = sum(1 for metric in present_metrics if not metric.get("metadata"))
        if missing_metadata:
            if status == "ok":
                status = "warning"
            reasons.append(
                f"{source_def['label']} metadata missing {missing_metadata}/{present_models}"
            )

    if source_errors:
        if status == "missing":
            status = "failed"
        elif status == "ok":
            status = "warning"
        affects_review = True
        reasons.extend(f"{source_def['label']} error: {error}" for error in source_errors)

    if source_def["required"] and status in {"missing", "failed"}:
        blocking = True

    return SourceHealth(
        key=source_def["key"],
        label=source_def["label"],
        metric_type=metric_type,
        status=status,
        present_models=present_models,
        expected_models=expected_models,
        reasons=reasons,
        affects_review=affects_review,
        blocking=blocking,
    )


def build_run_health(metrics_by_model: dict, collector_errors: list[str]) -> RunHealth:
    grouped_errors, global_errors = _group_health_errors(collector_errors)
    source_statuses = {
        source_def["key"]: _evaluate_source_health(
            source_def,
            metrics_by_model,
            grouped_errors.get(source_def["key"], []),
        )
        for source_def in HEALTH_SOURCE_DEFS
    }

    reasons = []
    if not metrics_by_model:
        reasons.append("no models available for ranking")

    gt_health = source_statuses["gt"]
    if gt_health.status in {"missing", "failed"}:
        reasons.append("GT metrics are unavailable; ranking and compare are blocked")

    core_present = sum(source.present_models for source in source_statuses.values())
    if core_present == 0:
        reasons.append("all core source metrics are unavailable")

    for error in global_errors:
        reasons.append(f"collector error: {error}")

    blocked = (
        not metrics_by_model
        or gt_health.blocking
        or core_present == 0
    )

    review_only = (
        not blocked
        and (
            any(source.affects_review for source in source_statuses.values())
            or bool(global_errors)
        )
    )

    if review_only:
        reasons.insert(0, "source coverage is incomplete; ranking and compare are advisory only")

    overall_status = "blocked" if blocked else "review_only" if review_only else "ok"
    return RunHealth(
        overall_status=overall_status,
        publish_ready=overall_status == "ok",
        source_statuses=source_statuses,
        reasons=reasons,
    )


def build_health_summary_lines(run_health: RunHealth) -> list[str]:
    source_summary = " ".join(
        f"{source.label}={source.status}({source.present_models}/{source.expected_models})"
        for source in run_health.source_statuses.values()
    )
    lines = [
        f"[HEALTH] overall={run_health.overall_status} publish_ready={'yes' if run_health.publish_ready else 'no'}",
        f"[HEALTH] {source_summary}",
    ]
    for reason in run_health.reasons:
        lines.append(f"[HEALTH] reason={reason}")
    return lines


def print_health_summary(run_health: RunHealth) -> None:
    for line in build_health_summary_lines(run_health):
        print(line)


def _build_health_payload(run_health: RunHealth) -> dict:
    return {
        "overall_status": run_health.overall_status,
        "publish_ready": run_health.publish_ready,
        "reasons": list(run_health.reasons),
        "source_summary": [
            {
                "key": source.key,
                "label": source.label,
                "metric_type": source.metric_type,
                "status": source.status,
                "present_models": source.present_models,
                "expected_models": source.expected_models,
                "reasons": list(source.reasons),
            }
            for source in run_health.source_statuses.values()
        ],
    }


def _build_public_model_note(rank_label: str, category_name: str) -> str:
    if rank_label == "rising_fast":
        return f"Strong weekly attention in {category_name}."
    if rank_label == "rising":
        return f"Weekly attention is building in {category_name}."
    if rank_label == "stable":
        return f"Attention remains steady in {category_name}."
    if rank_label == "falling":
        return f"Attention cooled relative to the previous week in {category_name}."
    if rank_label == "falling_fast":
        return f"Attention fell sharply relative to the previous week in {category_name}."
    return f"Trend direction needs review for {category_name}."


def _summarize_categories_for_public(scores: list, limit: int = 3) -> list[dict]:
    category_buckets = defaultdict(lambda: {"count": 0, "top_models": []})
    for score in scores[:5]:
        bucket = category_buckets[score.category_name]
        bucket["count"] += 1
        if len(bucket["top_models"]) < 2:
            bucket["top_models"].append(f"{score.brand_name} {score.model_name}".strip())

    ranked = sorted(
        category_buckets.items(),
        key=lambda item: (-item[1]["count"], item[0]),
    )
    return [
        {
            "category": category_name,
            "featured_model_count": bucket["count"],
            "example_models": bucket["top_models"],
        }
        for category_name, bucket in ranked[:limit]
    ]


def _build_featured_models_for_public(scores: list, limit: int = 3) -> list[dict]:
    featured = []
    for rank, score in enumerate(scores[:limit], 1):
        featured.append(
            {
                "rank": rank,
                "brand": score.brand_name,
                "model": score.model_name,
                "category": score.category_name,
                "trend_label": score.rank_label,
                "summary": _build_public_model_note(score.rank_label, score.category_name),
            }
        )
    return featured


def _build_public_headline(scores: list) -> str:
    if not scores:
        return "No weekly trend candidates are available."
    top_score = scores[0]
    return (
        f"{top_score.brand_name} {top_score.model_name} leads this week's "
        f"{top_score.category_name} trend candidates."
    ).strip()


def _build_public_notice(run_health: RunHealth) -> str:
    if run_health.overall_status == "ok":
        return "Ready for publication after editorial review."
    if run_health.overall_status == "review_only":
        return "Internal review only: source coverage is incomplete, so this summary should not be published as a normal weekly update."
    return "Blocked: core source coverage is unavailable for this week."


def _build_public_compare_summary(rows: list[dict], total_rows: int) -> dict:
    significant_rows = select_comparison_rows(rows, significant_only=True)
    summary = build_review_summary(significant_rows, total_rows=total_rows)
    highlights = []
    for row in significant_rows[:3]:
        highlights.append(
            {
                "brand": row["brand"],
                "model": row["model"],
                "category": row["category"],
                "reason": _compact_review_hint(row.get("review_hint")),
                "rank_change": row.get("has_rank_change", False),
            }
        )

    return {
        "included": True,
        "significant_count": summary["significant_count"],
        "rank_shift_count": summary["rank_shift_count"],
        "top_drivers": summary["top_drivers"],
        "largest_impact_model": summary["largest_impact_label"] if summary["largest_impact_score"] is not None else None,
        "highlights": highlights,
    }


def build_publish_ready_artifact(
    *,
    week_start: str,
    generated_at: str,
    result_source_name: str,
    run_health: RunHealth,
    scores: list,
    metrics_by_model: dict,
    args,
    comparison_rows: list[dict] | None = None,
) -> dict:
    public_scores = scores
    if args.category:
        public_scores = [score for score in scores if score.category_name == args.category]

    artifact = {
        **build_publish_ready_schema_fields(),
        "week": week_start,
        "generated_at": generated_at,
        "publish_ready": run_health.publish_ready,
        "health": _build_health_payload(run_health),
        "public_summary": {
            "headline": _build_public_headline(public_scores),
            "top_categories": _summarize_categories_for_public(public_scores),
            "featured_models": _build_featured_models_for_public(public_scores),
            "compare_summary": None,
        },
        "public_notice": _build_public_notice(run_health),
        "internal_reference": {
            "collector_source": result_source_name,
            "normalized_models": len(metrics_by_model),
            "compare_enabled": args.compare_source_sets,
            "compare_threshold": args.compare_threshold if args.compare_source_sets else None,
            "category_filter": args.category,
            "only_commercial": args.only_commercial,
            "no_discontinued": args.no_discontinued,
        },
    }

    if comparison_rows is not None:
        artifact["public_summary"]["compare_summary"] = _build_public_compare_summary(
            comparison_rows,
            total_rows=len(comparison_rows),
        )

    return artifact


def export_publish_ready_artifact(payload: dict, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    print(f"\n[ARTIFACT] {output_path.resolve()}")


def _artifact_output_path(week_start: str, *, compare_enabled: bool = False) -> Path:
    timestamp = week_start.replace("-", "")
    suffix = "_compare" if compare_enabled else ""
    return Path(f"data/output/publish_ready{suffix}_{timestamp}.json")


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
    for index, row in enumerate(rows):
        annotated_row = dict(row)
        annotated_row["impact_score"] = _calculate_impact_score(row)
        annotated_row["has_rank_change"] = _has_rank_change(row)
        annotated_row["is_significant"] = _is_significant_row(row, threshold)
        annotated_row["driver_source"] = _derive_driver_source(annotated_row)
        annotated_row["driver_direction"] = _derive_driver_direction(annotated_row)
        annotated_row["review_hint"] = _derive_review_hint(annotated_row)
        annotated_row["_compare_order"] = index
        annotated.append(annotated_row)
    return annotated


def build_annotated_comparison_rows(
    score_sets: dict[str, dict],
    category_filter: str | None = None,
    threshold: float = DEFAULT_COMPARE_THRESHOLD,
) -> list[dict]:
    return annotate_significance(
        build_comparison_rows(score_sets, category_filter=category_filter),
        threshold=threshold,
    )


def filter_significant_rows(rows: list[dict]) -> list[dict]:
    return [row for row in rows if row.get("is_significant")]


def sort_significant_rows(rows: list[dict]) -> list[dict]:
    return sorted(
        rows,
        key=lambda row: (
            not row.get("has_rank_change", False),
            -(row.get("impact_score") or 0.0),
            row.get("_compare_order", 0),
        ),
    )


def select_comparison_rows(rows: list[dict], significant_only: bool = False) -> list[dict]:
    if not significant_only:
        return rows
    return sort_significant_rows(filter_significant_rows(rows))


def print_significant_summary(display_rows: list[dict], total_rows: int) -> None:
    for line in build_review_summary_lines(display_rows, total_rows=total_rows):
        print(line)


def print_comparison_summary(
    rows: list[dict],
    week_start: str,
    category_filter: str | None = None,
    show_impact: bool = False,
    show_hint: bool = False,
) -> None:
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
            ]
        )
        if show_impact:
            table_rows[-1].append(_fmt_impact(row.get("impact_score")))
        if show_hint:
            table_rows[-1].append(row.get("review_hint", "-"))
        table_rows[-1].append(row["rank_path"])

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
    ]
    if show_impact:
        headers.append("Impact")
    if show_hint:
        headers.append("Hint")
    headers.append("Rank path")

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
                "impact_score",
                "is_significant",
                "has_rank_change",
                "driver_source",
                "driver_direction",
                "review_hint",
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
                    row.get("impact_score"),
                    row.get("is_significant", False),
                    row.get("has_rank_change", False),
                    row.get("driver_source"),
                    row.get("driver_direction"),
                    row.get("review_hint"),
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


def _fmt_impact(value: float | None) -> str:
    return f"{value:.1f}" if value is not None else "N/A"


def _is_delta_significant(value: float | None, threshold: float) -> bool:
    return value is not None and abs(value) >= threshold


def _calculate_impact_score(row: dict) -> float:
    delta_gt_to_gs = abs(row.get("delta_gt_to_gs") or 0.0)
    delta_gs_to_all = abs(row.get("delta_gs_to_all") or 0.0)
    return round(max(delta_gt_to_gs, delta_gs_to_all), 2)


def _derive_driver_source(row: dict) -> str:
    delta_gt_to_gs = abs(row.get("delta_gt_to_gs") or 0.0)
    delta_gs_to_all = abs(row.get("delta_gs_to_all") or 0.0)
    has_rank_change = row.get("has_rank_change", False)

    if has_rank_change and max(delta_gt_to_gs, delta_gs_to_all) < DRIVER_TIE_EPSILON:
        return "RANK"
    if abs(delta_gt_to_gs - delta_gs_to_all) < DRIVER_TIE_EPSILON:
        return "BOTH"
    if delta_gt_to_gs > delta_gs_to_all:
        return "GS"
    return "YT"


def _derive_driver_direction(row: dict) -> str:
    driver_source = row.get("driver_source")
    if driver_source == "RANK":
        return "RANK"
    if driver_source == "GS":
        return "UP" if (row.get("delta_gt_to_gs") or 0.0) > 0 else "DOWN"
    if driver_source == "YT":
        return "UP" if (row.get("delta_gs_to_all") or 0.0) > 0 else "DOWN"

    delta_gt_to_gs = row.get("delta_gt_to_gs") or 0.0
    delta_gs_to_all = row.get("delta_gs_to_all") or 0.0
    if delta_gt_to_gs > 0 and delta_gs_to_all > 0:
        return "UP"
    if delta_gt_to_gs < 0 and delta_gs_to_all < 0:
        return "DOWN"
    return "MIXED"


def _derive_review_hint(row: dict) -> str:
    driver_source = row.get("driver_source")
    driver_direction = row.get("driver_direction")
    if driver_source == "RANK":
        return "review rank shift"
    if driver_source == "BOTH":
        return "review mixed signals"
    if driver_source == "GS" and driver_direction == "UP":
        return "review GS boost"
    if driver_source == "GS" and driver_direction == "DOWN":
        return "review GS downweight"
    if driver_source == "YT" and driver_direction == "UP":
        return "review YT boost"
    if driver_source == "YT" and driver_direction == "DOWN":
        return "review YT downweight"
    return "review mixed signals"


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


def _format_driver_mix(rows: list[dict]) -> str:
    counts = {"GS": 0, "YT": 0, "BOTH": 0, "RANK": 0}
    for row in rows:
        driver_source = row.get("driver_source")
        if driver_source in counts:
            counts[driver_source] += 1
    return ", ".join(f"{key}={value}" for key, value in counts.items())


def _compact_review_hint(review_hint: str | None) -> str:
    if not review_hint:
        return "none"
    return review_hint.replace("review ", "", 1)


def _summarize_review_hints(rows: list[dict], max_items: int = 2) -> str:
    counts = {}
    order = {}
    for index, row in enumerate(rows):
        label = _compact_review_hint(row.get("review_hint"))
        counts[label] = counts.get(label, 0) + 1
        order.setdefault(label, index)

    if not counts:
        return "none"

    ranked = sorted(counts.items(), key=lambda item: (-item[1], order[item[0]]))
    return ", ".join(f"{label} x{count}" for label, count in ranked[:max_items])


def build_review_summary(rows: list[dict], total_rows: int) -> dict:
    rank_shift_count = sum(1 for row in rows if row.get("has_rank_change"))
    summary = {
        "significant_count": len(rows),
        "total_rows": total_rows,
        "rank_shift_count": rank_shift_count,
        "top_drivers": "none",
        "largest_impact_label": "none",
        "largest_impact_hint": "none",
        "largest_impact_score": None,
    }
    if not rows:
        return summary

    summary["top_drivers"] = _summarize_review_hints(rows)
    largest_impact_row = max(rows, key=lambda row: row.get("impact_score") or 0.0)
    summary["largest_impact_label"] = f"{largest_impact_row['brand']} {largest_impact_row['model']}".strip()
    summary["largest_impact_hint"] = _compact_review_hint(largest_impact_row.get("review_hint"))
    summary["largest_impact_score"] = largest_impact_row.get("impact_score")
    return summary


def build_review_summary_lines(rows: list[dict], total_rows: int) -> list[str]:
    summary = build_review_summary(rows, total_rows=total_rows)
    lines = [
        "[COMPARE] significant rows: "
        f"{summary['significant_count']} / {summary['total_rows']} | rank shifts: {summary['rank_shift_count']}",
        f"[COMPARE] top drivers: {summary['top_drivers']}",
    ]
    if summary["largest_impact_score"] is None:
        lines.append("[COMPARE] largest impact: none")
        return lines

    lines.append(
        f"[COMPARE] largest impact: {summary['largest_impact_label']} "
        f"({summary['largest_impact_hint']}, {_fmt_impact(summary['largest_impact_score'])})"
    )
    return lines


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
    parser.add_argument("--output-publish-artifact", action="store_true")
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

    print(f"[COLLECT] {len(result.metrics)} metrics loaded from '{result.source_name}'")

    metrics_by_model = build_metrics_by_model(result.metrics)
    generated_at = datetime.now().isoformat(timespec="seconds")
    print(f"[NORMALIZE] {len(metrics_by_model)} models")
    run_health = build_run_health(metrics_by_model, result.errors)
    print_health_summary(run_health)

    if run_health.overall_status == "blocked":
        if args.output_publish_artifact:
            print("[ARTIFACT] skipped: blocked by source health")
        raise SystemExit(1)

    if args.compare_source_sets:
        score_sets = calculate_scores_for_sets(metrics_by_model, COMPARE_SOURCE_SET_DEFS)
        final_scores = score_sets["all_three"]["scores"]
        comparison_rows = build_annotated_comparison_rows(
            score_sets,
            category_filter=args.category,
            threshold=args.compare_threshold,
        )
        display_rows = select_comparison_rows(
            comparison_rows,
            significant_only=args.compare_only_significant,
        )
        print("[COMPARE] source_sets=GT only / GT + GS / GT + GS + YT")
        print(
            f"[COMPARE] threshold={args.compare_threshold:.1f} "
            f"only_significant={'yes' if args.compare_only_significant else 'no'} "
            f"rank_change_included=yes"
        )
        if args.compare_only_significant:
            print_significant_summary(display_rows, total_rows=len(comparison_rows))
        print_comparison_summary(
            display_rows,
            args.week,
            category_filter=args.category,
            show_impact=args.compare_only_significant,
            show_hint=args.compare_only_significant,
        )
        if args.output_csv:
            timestamp = args.week.replace("-", "")
            export_comparison_csv(display_rows, Path(f"data/output/ranking_compare_{timestamp}.csv"))
        if args.output_publish_artifact:
            artifact_payload = build_publish_ready_artifact(
                week_start=args.week,
                generated_at=generated_at,
                result_source_name=result.source_name,
                run_health=run_health,
                scores=final_scores,
                metrics_by_model=metrics_by_model,
                args=args,
                comparison_rows=comparison_rows,
            )
            export_publish_ready_artifact(
                artifact_payload,
                _artifact_output_path(args.week, compare_enabled=True),
            )
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
        if args.output_publish_artifact:
            artifact_payload = build_publish_ready_artifact(
                week_start=args.week,
                generated_at=generated_at,
                result_source_name=result.source_name,
                run_health=run_health,
                scores=scores,
                metrics_by_model=metrics_by_model,
                args=args,
            )
            export_publish_ready_artifact(
                artifact_payload,
                _artifact_output_path(args.week, compare_enabled=False),
            )

    print(f"\n[END] {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


if __name__ == "__main__":
    main()
