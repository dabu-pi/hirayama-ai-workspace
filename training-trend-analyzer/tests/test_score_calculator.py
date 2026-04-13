"""
Score calculator stabilization tests.
"""

import io
import sys
from pathlib import Path

if sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.scorer.calculator import ScoreCalculator


def test_google_trends_metric_can_be_excluded():
    calc = ScoreCalculator(excluded_metrics={"google_trends_interest"})
    metrics_by_model = {
        "A::One::treadmill": {
            "brand": "A",
            "model": "One",
            "category": "treadmill",
            "week_start": "2026-04-06",
            "metrics": {
                "search_volume": {"value": 80, "value_prev": 70, "metadata": {}, "sample_size": None},
                "google_trends_interest": {
                    "value": 90,
                    "value_prev": 50,
                    "metadata": {"observation_weeks": 5},
                    "sample_size": 2,
                },
            },
        },
        "B::Two::treadmill": {
            "brand": "B",
            "model": "Two",
            "category": "treadmill",
            "week_start": "2026-04-06",
            "metrics": {
                "search_volume": {"value": 40, "value_prev": 45, "metadata": {}, "sample_size": None},
                "google_trends_interest": {
                    "value": 20,
                    "value_prev": 30,
                    "metadata": {"observation_weeks": 5},
                    "sample_size": 2,
                },
            },
        },
        "C::Three::treadmill": {
            "brand": "C",
            "model": "Three",
            "category": "treadmill",
            "week_start": "2026-04-06",
            "metrics": {
                "search_volume": {"value": 20, "value_prev": 25, "metadata": {}, "sample_size": None}
            },
        },
    }
    scores = calc.calculate(metrics_by_model)
    top = scores[0]
    assert "google_trends_interest: manually excluded" in top.eligibility_notes
    assert "google_trends_interest" not in top.metric_contributions


def test_google_trends_metric_requires_minimum_support():
    calc = ScoreCalculator()
    metrics_by_model = {
        "A::One::treadmill": {
            "brand": "A",
            "model": "One",
            "category": "treadmill",
            "week_start": "2026-04-06",
            "metrics": {
                "search_volume": {"value": 80, "value_prev": 70, "metadata": {}, "sample_size": None},
                "google_trends_interest": {
                    "value": 90,
                    "value_prev": 50,
                    "metadata": {"observation_weeks": 2},
                    "sample_size": 2,
                },
            },
        },
        "B::Two::treadmill": {
            "brand": "B",
            "model": "Two",
            "category": "treadmill",
            "week_start": "2026-04-06",
            "metrics": {
                "search_volume": {"value": 40, "value_prev": 45, "metadata": {}, "sample_size": None},
                "google_trends_interest": {
                    "value": 20,
                    "value_prev": 30,
                    "metadata": {"observation_weeks": 2},
                    "sample_size": 2,
                },
            },
        },
        "C::Three::treadmill": {
            "brand": "C",
            "model": "Three",
            "category": "treadmill",
            "week_start": "2026-04-06",
            "metrics": {
                "search_volume": {"value": 20, "value_prev": 25, "metadata": {}, "sample_size": None},
                "google_trends_interest": {
                    "value": 10,
                    "value_prev": 5,
                    "metadata": {"observation_weeks": 2},
                    "sample_size": 2,
                },
            },
        },
    }
    scores = calc.calculate(metrics_by_model)
    assert all("skipped by weeks<3" in " | ".join(score.eligibility_notes) for score in scores)
    assert all("google_trends_interest" not in score.metric_contributions for score in scores)


def test_search_suggest_count_skips_low_value():
    calc = ScoreCalculator()
    metrics_by_model = {
        "A::One::treadmill": {
            "brand": "A",
            "model": "One",
            "category": "treadmill",
            "week_start": "2026-04-06",
            "metrics": {
                "search_volume": {"value": 80, "value_prev": 70, "metadata": {}, "sample_size": None},
                "search_suggest_count": {"value": 1, "value_prev": None, "metadata": {}, "sample_size": 2},
            },
        },
        "B::Two::treadmill": {
            "brand": "B",
            "model": "Two",
            "category": "treadmill",
            "week_start": "2026-04-06",
            "metrics": {
                "search_volume": {"value": 40, "value_prev": 35, "metadata": {}, "sample_size": None},
                "search_suggest_count": {"value": 1.5, "value_prev": None, "metadata": {}, "sample_size": 2},
            },
        },
        "C::Three::treadmill": {
            "brand": "C",
            "model": "Three",
            "category": "treadmill",
            "week_start": "2026-04-06",
            "metrics": {
                "search_volume": {"value": 20, "value_prev": 25, "metadata": {}, "sample_size": None},
                "search_suggest_count": {"value": 0, "value_prev": None, "metadata": {}, "sample_size": 2},
            },
        },
    }
    scores = calc.calculate(metrics_by_model)
    assert all("search_suggest_count: skipped by value<2" in " | ".join(score.eligibility_notes) for score in scores)
    assert all("search_suggest_count" not in score.metric_contributions for score in scores)


def test_youtube_suggest_count_skips_low_value():
    calc = ScoreCalculator()
    metrics_by_model = {
        "A::One::treadmill": {
            "brand": "A",
            "model": "One",
            "category": "treadmill",
            "week_start": "2026-04-06",
            "metrics": {
                "search_volume": {"value": 80, "value_prev": 70, "metadata": {}, "sample_size": None},
                "youtube_suggest_count": {"value": 1, "value_prev": None, "metadata": {}, "sample_size": 2},
            },
        },
        "B::Two::treadmill": {
            "brand": "B",
            "model": "Two",
            "category": "treadmill",
            "week_start": "2026-04-06",
            "metrics": {
                "search_volume": {"value": 40, "value_prev": 35, "metadata": {}, "sample_size": None},
                "youtube_suggest_count": {"value": 1.5, "value_prev": None, "metadata": {}, "sample_size": 2},
            },
        },
        "C::Three::treadmill": {
            "brand": "C",
            "model": "Three",
            "category": "treadmill",
            "week_start": "2026-04-06",
            "metrics": {
                "search_volume": {"value": 20, "value_prev": 25, "metadata": {}, "sample_size": None},
                "youtube_suggest_count": {"value": 0, "value_prev": None, "metadata": {}, "sample_size": 2},
            },
        },
    }
    scores = calc.calculate(metrics_by_model)
    assert all("youtube_suggest_count: skipped by value<2" in " | ".join(score.eligibility_notes) for score in scores)
    assert all("youtube_suggest_count" not in score.metric_contributions for score in scores)
