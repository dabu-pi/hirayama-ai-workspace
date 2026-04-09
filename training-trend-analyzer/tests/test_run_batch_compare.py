"""
Comparison summary helpers for run_batch.py.
"""

import csv
import io
import sys
from pathlib import Path

import pytest

if sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts.run_batch import (
    DEFAULT_COMPARE_THRESHOLD,
    COMPARE_SOURCE_SET_DEFS,
    _calculate_impact_score,
    _build_delta_summary,
    _compact_review_hint,
    _combine_delta_summaries,
    _derive_driver_direction,
    _derive_driver_source,
    _derive_review_hint,
    _fmt_compare_delta,
    _format_driver_mix,
    _has_rank_change,
    _is_significant_row,
    _summarize_review_hints,
    annotate_significance,
    build_annotated_comparison_rows,
    build_review_summary,
    build_review_summary_lines,
    build_comparison_rows,
    calculate_scores_for_sets,
    export_comparison_csv,
    filter_significant_rows,
    select_comparison_rows,
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


def _sample_rank_shift_score_sets() -> dict:
    return {
        "gt_only": {
            "indexed": {
                "Alpha::A-One::treadmill": {
                    "brand": "Alpha",
                    "model": "A-One",
                    "category": "treadmill",
                    "score": 20.0,
                    "rank": 1,
                },
                "Bravo::B-Two::treadmill": {
                    "brand": "Bravo",
                    "model": "B-Two",
                    "category": "treadmill",
                    "score": 19.95,
                    "rank": 2,
                },
            }
        },
        "gt_plus_gs": {
            "indexed": {
                "Alpha::A-One::treadmill": {
                    "brand": "Alpha",
                    "model": "A-One",
                    "category": "treadmill",
                    "score": 19.96,
                    "rank": 2,
                },
                "Bravo::B-Two::treadmill": {
                    "brand": "Bravo",
                    "model": "B-Two",
                    "category": "treadmill",
                    "score": 19.98,
                    "rank": 1,
                },
            }
        },
        "all_three": {
            "indexed": {
                "Alpha::A-One::treadmill": {
                    "brand": "Alpha",
                    "model": "A-One",
                    "category": "treadmill",
                    "score": 19.94,
                    "rank": 2,
                },
                "Bravo::B-Two::treadmill": {
                    "brand": "Bravo",
                    "model": "B-Two",
                    "category": "treadmill",
                    "score": 20.01,
                    "rank": 1,
                },
            }
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


def test_build_annotated_comparison_rows_applies_category_filter_and_threshold():
    score_sets = calculate_scores_for_sets(_sample_metrics_by_model(), COMPARE_SOURCE_SET_DEFS)
    rows = build_annotated_comparison_rows(
        score_sets,
        category_filter="treadmill",
        threshold=DEFAULT_COMPARE_THRESHOLD,
    )
    assert len(rows) == 3
    assert all("is_significant" in row for row in rows)


def test_select_comparison_rows_returns_rank_sorted_significant_rows():
    score_sets = calculate_scores_for_sets(_sample_metrics_by_model(), COMPARE_SOURCE_SET_DEFS)
    comparison_rows = build_annotated_comparison_rows(score_sets, threshold=DEFAULT_COMPARE_THRESHOLD)
    display_rows = select_comparison_rows(comparison_rows, significant_only=True)
    assert [row["model"] for row in display_rows] == ["Run", "T5"]


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


def test_compact_review_hint_drops_prefix():
    assert _compact_review_hint("review GS boost") == "GS boost"
    assert _compact_review_hint(None) == "none"


def test_summarize_review_hints_counts_top_labels():
    rows = [
        {"review_hint": "review GS downweight"},
        {"review_hint": "review GS downweight"},
        {"review_hint": "review GS boost"},
    ]
    assert _summarize_review_hints(rows) == "GS downweight x2, GS boost x1"


def test_summarize_review_hints_breaks_ties_by_display_order():
    rows = [
        {"review_hint": "review rank shift"},
        {"review_hint": "review GS boost"},
        {"review_hint": "review GS boost"},
        {"review_hint": "review rank shift"},
    ]
    assert _summarize_review_hints(rows) == "rank shift x2, GS boost x2"


@pytest.mark.parametrize(
    ("rows", "total_rows", "expected_lines"),
    [
        (
            [],
            4,
            [
                "[COMPARE] significant rows: 0 / 4 | rank shifts: 0",
                "[COMPARE] top drivers: none",
                "[COMPARE] largest impact: none",
            ],
        ),
        (
            [
                {
                    "brand": "Concept2",
                    "model": "SkiErg",
                    "impact_score": 12.73,
                    "has_rank_change": False,
                    "review_hint": "review GS downweight",
                }
            ],
            4,
            [
                "[COMPARE] significant rows: 1 / 4 | rank shifts: 0",
                "[COMPARE] top drivers: GS downweight x1",
                "[COMPARE] largest impact: Concept2 SkiErg (GS downweight, 12.7)",
            ],
        ),
        (
            [
                {
                    "brand": "Alpha",
                    "model": "A-One",
                    "impact_score": 0.04,
                    "has_rank_change": True,
                    "review_hint": "review rank shift",
                },
                {
                    "brand": "Bravo",
                    "model": "B-Two",
                    "impact_score": 0.03,
                    "has_rank_change": True,
                    "review_hint": "review rank shift",
                },
                {
                    "brand": "Concept2",
                    "model": "SkiErg",
                    "impact_score": 12.73,
                    "has_rank_change": False,
                    "review_hint": "review GS downweight",
                },
            ],
            5,
            [
                "[COMPARE] significant rows: 3 / 5 | rank shifts: 2",
                "[COMPARE] top drivers: rank shift x2, GS downweight x1",
                "[COMPARE] largest impact: Concept2 SkiErg (GS downweight, 12.7)",
            ],
        ),
    ],
)
def test_build_review_summary_lines_handles_zero_one_and_many_rows(rows, total_rows, expected_lines):
    assert build_review_summary_lines(rows, total_rows=total_rows) == expected_lines


def test_build_review_summary_returns_structured_fields():
    rows = [
        {
            "brand": "Concept2",
            "model": "SkiErg",
            "impact_score": 12.73,
            "has_rank_change": False,
            "review_hint": "review GS downweight",
        }
    ]
    summary = build_review_summary(rows, total_rows=4)
    assert summary == {
        "significant_count": 1,
        "total_rows": 4,
        "rank_shift_count": 0,
        "top_drivers": "GS downweight x1",
        "largest_impact_label": "Concept2 SkiErg",
        "largest_impact_hint": "GS downweight",
        "largest_impact_score": 12.73,
    }


def test_rank_shift_rows_are_selected_and_summarized_even_below_threshold():
    rows = build_annotated_comparison_rows(_sample_rank_shift_score_sets(), threshold=DEFAULT_COMPARE_THRESHOLD)
    display_rows = select_comparison_rows(rows, significant_only=True)
    assert [row["model"] for row in display_rows] == ["A-One", "B-Two"]
    assert all(row["driver_source"] == "RANK" for row in display_rows)
    assert build_review_summary_lines(display_rows, total_rows=len(rows)) == [
        "[COMPARE] significant rows: 2 / 2 | rank shifts: 2",
        "[COMPARE] top drivers: rank shift x2",
        "[COMPARE] largest impact: Alpha A-One (rank shift, 0.0)",
    ]


def test_export_comparison_csv_keeps_row_data_only(tmp_path):
    score_sets = calculate_scores_for_sets(_sample_metrics_by_model(), COMPARE_SOURCE_SET_DEFS)
    rows = build_annotated_comparison_rows(score_sets, threshold=DEFAULT_COMPARE_THRESHOLD)
    display_rows = select_comparison_rows(rows, significant_only=True)
    output_path = tmp_path / "ranking_compare.csv"

    export_comparison_csv(display_rows, output_path)

    content = output_path.read_text(encoding="utf-8-sig")
    assert "[COMPARE]" not in content

    with output_path.open("r", encoding="utf-8-sig", newline="") as handle:
        exported_rows = list(csv.DictReader(handle))

    assert len(exported_rows) == 2
    assert [row["model"] for row in exported_rows] == ["Run", "T5"]
