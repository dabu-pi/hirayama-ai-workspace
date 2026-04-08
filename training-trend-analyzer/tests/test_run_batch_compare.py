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
    DEFAULT_COMPARE_THRESHOLD,
    COMPARE_SOURCE_SET_DEFS,
    _calculate_impact_score,
    _build_delta_summary,
    _combine_delta_summaries,
    _derive_driver_direction,
    _derive_driver_source,
    _derive_review_hint,
    _fmt_compare_delta,
    _format_driver_mix,
    _has_rank_change,
    _is_significant_row,
    annotate_significance,
    build_comparison_rows,
    calculate_scores_for_sets,
    filter_significant_rows,
    sort_significant_rows,
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


def test_annotate_significance_marks_non_zero_rows():
    score_sets = calculate_scores_for_sets(_sample_metrics_by_model(), COMPARE_SOURCE_SET_DEFS)
    rows = annotate_significance(build_comparison_rows(score_sets), threshold=DEFAULT_COMPARE_THRESHOLD)
    run_row = next(row for row in rows if row["model"] == "Run")
    precor_row = next(row for row in rows if row["model"] == "TRM 445")
    assert run_row["is_significant"] is True
    assert run_row["has_rank_change"] is False
    assert precor_row["is_significant"] is False
    assert precor_row["has_rank_change"] is False


def test_filter_significant_rows_drops_zero_delta_row():
    score_sets = calculate_scores_for_sets(_sample_metrics_by_model(), COMPARE_SOURCE_SET_DEFS)
    rows = annotate_significance(build_comparison_rows(score_sets), threshold=DEFAULT_COMPARE_THRESHOLD)
    filtered = filter_significant_rows(rows)
    assert len(filtered) == 2
    assert {row["model"] for row in filtered} == {"Run", "T5"}


def test_rank_change_is_significant_even_below_threshold():
    row = {
        "delta_gt_to_gs": 0.1,
        "delta_gs_to_all": 0.1,
        "gt_only_rank": 1,
        "gt_plus_gs_rank": 2,
        "all_three_rank": 2,
    }
    assert _has_rank_change(row) is True
    assert _is_significant_row(row, threshold=0.5) is True


def test_impact_score_uses_max_abs_delta():
    row = {"delta_gt_to_gs": -11.19, "delta_gs_to_all": -2.72}
    assert _calculate_impact_score(row) == 11.19


def test_sort_significant_rows_prioritizes_rank_change_then_impact():
    rows = [
        {"model": "LowImpactRankChange", "impact_score": 0.1, "has_rank_change": True, "_compare_order": 2},
        {"model": "HighImpactNoRankChange", "impact_score": 10.0, "has_rank_change": False, "_compare_order": 0},
        {"model": "MidImpactNoRankChange", "impact_score": 4.6, "has_rank_change": False, "_compare_order": 1},
    ]
    sorted_rows = sort_significant_rows(rows)
    assert [row["model"] for row in sorted_rows] == [
        "LowImpactRankChange",
        "HighImpactNoRankChange",
        "MidImpactNoRankChange",
    ]


def test_driver_hint_prefers_gs_when_gs_delta_is_larger():
    row = {"delta_gt_to_gs": -11.19, "delta_gs_to_all": -2.72, "has_rank_change": False}
    assert _derive_driver_source(row) == "GS"
    assert _derive_driver_direction({**row, "driver_source": "GS"}) == "DOWN"
    assert _derive_review_hint({"driver_source": "GS", "driver_direction": "DOWN"}) == "review GS downweight"


def test_driver_hint_prefers_yt_when_yt_delta_is_larger():
    row = {"delta_gt_to_gs": 0.2, "delta_gs_to_all": 1.1, "has_rank_change": False}
    assert _derive_driver_source(row) == "YT"
    assert _derive_driver_direction({**row, "driver_source": "YT"}) == "UP"
    assert _derive_review_hint({"driver_source": "YT", "driver_direction": "UP"}) == "review YT boost"


def test_driver_hint_uses_both_for_close_deltas():
    row = {"delta_gt_to_gs": 0.55, "delta_gs_to_all": 0.49, "has_rank_change": False}
    driver_source = _derive_driver_source(row)
    driver_direction = _derive_driver_direction({**row, "driver_source": driver_source})
    assert driver_source == "BOTH"
    assert driver_direction == "UP"
    assert _derive_review_hint({"driver_source": driver_source, "driver_direction": driver_direction}) == "review mixed signals"


def test_driver_hint_uses_rank_for_rank_change_led_row():
    row = {"delta_gt_to_gs": 0.04, "delta_gs_to_all": 0.03, "has_rank_change": True}
    driver_source = _derive_driver_source(row)
    driver_direction = _derive_driver_direction({**row, "driver_source": driver_source})
    assert driver_source == "RANK"
    assert driver_direction == "RANK"
    assert _derive_review_hint({"driver_source": driver_source, "driver_direction": driver_direction}) == "review rank shift"


def test_driver_mix_summary_counts_driver_sources():
    rows = [
        {"driver_source": "GS"},
        {"driver_source": "GS"},
        {"driver_source": "YT"},
        {"driver_source": "BOTH"},
    ]
    assert _format_driver_mix(rows) == "GS=2, YT=1, BOTH=1, RANK=0"
