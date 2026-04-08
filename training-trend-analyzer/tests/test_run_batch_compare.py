"""
Comparison summary helpers for run_batch.py.
"""

import io
import sys
from pathlib import Path

if sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts.run_batch import (
    COMPARE_SOURCE_SET_DEFS,
    _build_delta_summary,
    _combine_delta_summaries,
    _fmt_compare_delta,
    build_comparison_rows,
    calculate_scores_for_sets,
)


def _sample_metrics_by_model() -> dict:
    return {
        "TECHNOGYM::Run::treadmill": {
            "brand": "TECHNOGYM",
            "model": "Run",
            "category": "treadmill",
            "week_start": "2026-04-06",
            "metrics": {
                "google_trends_interest": {"value": 58.0, "value_prev": 53.0, "metadata": {"observation_weeks": 4}, "sample_size": 2},
                "search_suggest_count": {"value": 3.5, "value_prev": None, "metadata": {}, "sample_size": 2},
                "youtube_suggest_count": {"value": 2.5, "value_prev": None, "metadata": {}, "sample_size": 2},
            },
        },
        "Life Fitness::T5::treadmill": {
            "brand": "Life Fitness",
            "model": "T5",
            "category": "treadmill",
            "week_start": "2026-04-06",
            "metrics": {
                "google_trends_interest": {"value": 35.0, "value_prev": 33.0, "metadata": {"observation_weeks": 4}, "sample_size": 2},
                "search_suggest_count": {"value": 4.0, "value_prev": None, "metadata": {}, "sample_size": 2},
                "youtube_suggest_count": {"value": 3.0, "value_prev": None, "metadata": {}, "sample_size": 2},
            },
        },
        "Precor::TRM 445::treadmill": {
            "brand": "Precor",
            "model": "TRM 445",
            "category": "treadmill",
            "week_start": "2026-04-06",
            "metrics": {
                "google_trends_interest": {"value": 26.0, "value_prev": 23.5, "metadata": {"observation_weeks": 4}, "sample_size": 2},
                "search_suggest_count": {"value": 1.5, "value_prev": None, "metadata": {}, "sample_size": 2},
                "youtube_suggest_count": {"value": 2.0, "value_prev": None, "metadata": {}, "sample_size": 2},
            },
        },
    }


def test_compare_source_sets_builds_three_score_views():
    score_sets = calculate_scores_for_sets(_sample_metrics_by_model(), COMPARE_SOURCE_SET_DEFS)
    assert set(score_sets.keys()) == {"gt_only", "gt_plus_gs", "all_three"}
    assert len(score_sets["gt_only"]["scores"]) == 3
    assert len(score_sets["all_three"]["scores"]) == 3


def test_comparison_rows_include_deltas_and_rank_path():
    score_sets = calculate_scores_for_sets(_sample_metrics_by_model(), COMPARE_SOURCE_SET_DEFS)
    rows = build_comparison_rows(score_sets)
    assert len(rows) == 3

    run_row = next(row for row in rows if row["model"] == "Run")
    assert run_row["gt_only_score"] is not None
    assert run_row["gt_plus_gs_score"] is not None
    assert run_row["all_three_score"] is not None
    assert run_row["delta_gt_to_gs"] is not None
    assert run_row["delta_gs_to_all"] is not None
    assert run_row["gt_to_gs_summary"].startswith("GS:")
    assert run_row["gs_to_all_summary"].startswith("YT:")
    assert " / " in run_row["delta_summary"]
    assert "->" in run_row["rank_path"]
    assert "?" not in run_row["rank_path"]


def test_comparison_rows_allow_category_filter():
    score_sets = calculate_scores_for_sets(_sample_metrics_by_model(), COMPARE_SOURCE_SET_DEFS)
    rows = build_comparison_rows(score_sets, category_filter="rower")
    assert rows == []


def test_zero_delta_summaries_are_hidden():
    assert _build_delta_summary("GS", 0.04) == "-"
    assert _build_delta_summary("YT", 0.0) == "-"
    assert _combine_delta_summaries("GS:+4.6", "-") == "GS:+4.6"
    assert _combine_delta_summaries("-", "YT:-0.9") == "YT:-0.9"
    assert _combine_delta_summaries("-", "-") == "-"


def test_compare_delta_formatter_hides_display_zero():
    assert _fmt_compare_delta(0.0) == "-"
    assert _fmt_compare_delta(0.04) == "-"
    assert _fmt_compare_delta(4.59) == "+4.6"
    assert _fmt_compare_delta(-0.87) == "-0.9"
    assert _fmt_compare_delta(-11.19) == "-11.2"


def test_zero_delta_row_shows_dash_in_why():
    score_sets = calculate_scores_for_sets(_sample_metrics_by_model(), COMPARE_SOURCE_SET_DEFS)
    rows = build_comparison_rows(score_sets)
    precor_row = next(row for row in rows if row["model"] == "TRM 445")
    assert precor_row["gt_to_gs_summary"] == "-"
    assert precor_row["gs_to_all_summary"] == "-"
    assert precor_row["delta_summary"] == "-"
