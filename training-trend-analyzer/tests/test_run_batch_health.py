"""
Health summary helpers for run_batch.py.
"""

import io
import sys
from pathlib import Path

if sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts.run_batch import build_health_summary_lines, build_run_health


def _metrics_by_model(
    *,
    gt_models: tuple[str, ...] = ("Run", "T75"),
    gs_models: tuple[str, ...] = ("Run", "T75"),
    yt_models: tuple[str, ...] = ("Run", "T75"),
    gt_sample_size_missing: tuple[str, ...] = (),
    gt_metadata_missing: tuple[str, ...] = (),
) -> dict:
    models = {}
    for model in {"Run", "T75"}:
        metrics = {}
        if model in gt_models:
            metrics["google_trends_interest"] = {
                "value": 50.0,
                "value_prev": 48.0,
                "sample_size": None if model in gt_sample_size_missing else 2,
                "metadata": {} if model in gt_metadata_missing else {"observation_weeks": 4},
            }
        if model in gs_models:
            metrics["search_suggest_count"] = {
                "value": 3.0,
                "value_prev": None,
                "sample_size": 2,
                "metadata": {},
            }
        if model in yt_models:
            metrics["youtube_suggest_count"] = {
                "value": 2.0,
                "value_prev": None,
                "sample_size": 2,
                "metadata": {},
            }
        models[f"Brand::{model}::treadmill"] = {
            "brand": "Brand",
            "model": model,
            "category": "treadmill",
            "week_start": "2026-04-06",
            "metrics": metrics,
        }
    return models


def test_build_run_health_is_ok_when_all_core_sources_are_present():
    run_health = build_run_health(_metrics_by_model(), collector_errors=[])

    assert run_health.overall_status == "ok"
    assert run_health.publish_ready is True
    assert run_health.source_statuses["gt"].status == "ok"
    assert run_health.source_statuses["gs"].status == "ok"
    assert run_health.source_statuses["yt"].status == "ok"
    assert build_health_summary_lines(run_health) == [
        "[HEALTH] overall=ok publish_ready=yes",
        "[HEALTH] GT=ok(2/2) GS=ok(2/2) YT=ok(2/2)",
    ]


def test_build_run_health_keeps_ok_for_minor_support_warnings():
    run_health = build_run_health(
        _metrics_by_model(
            gt_sample_size_missing=("Run",),
            gt_metadata_missing=("Run",),
        ),
        collector_errors=[],
    )

    assert run_health.overall_status == "ok"
    assert run_health.publish_ready is True
    assert run_health.source_statuses["gt"].status == "warning"
    assert run_health.source_statuses["gt"].affects_review is False
    assert run_health.source_statuses["gt"].reasons == [
        "GT sample_size missing 1/2",
        "GT metadata missing 1/2",
    ]


def test_build_run_health_marks_review_only_for_partial_secondary_source_failure():
    run_health = build_run_health(
        _metrics_by_model(gs_models=("Run",)),
        collector_errors=[],
    )

    assert run_health.overall_status == "review_only"
    assert run_health.publish_ready is False
    assert run_health.source_statuses["gs"].status == "warning"
    assert run_health.source_statuses["gs"].affects_review is True
    assert run_health.source_statuses["gs"].reasons == [
        "GS partial coverage 1/2 models",
    ]
    assert build_health_summary_lines(run_health)[:3] == [
        "[HEALTH] overall=review_only publish_ready=no",
        "[HEALTH] GT=ok(2/2) GS=warning(1/2) YT=ok(2/2)",
        "[HEALTH] reason=source coverage is incomplete; ranking and compare are advisory only",
    ]


def test_build_run_health_blocks_when_gt_is_missing():
    run_health = build_run_health(
        _metrics_by_model(gt_models=(), gs_models=("Run", "T75"), yt_models=("Run", "T75")),
        collector_errors=[],
    )

    assert run_health.overall_status == "blocked"
    assert run_health.publish_ready is False
    assert run_health.source_statuses["gt"].status == "missing"
    assert run_health.source_statuses["gt"].blocking is True
    assert build_health_summary_lines(run_health)[:3] == [
        "[HEALTH] overall=blocked publish_ready=no",
        "[HEALTH] GT=missing(0/2) GS=ok(2/2) YT=ok(2/2)",
        "[HEALTH] reason=GT metrics are unavailable; ranking and compare are blocked",
    ]
