"""
Google Trends collector mock-path tests.
"""

import io
import sys
from pathlib import Path

if sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.collectors.google_trends import GoogleTrendsCollector


ROOT = Path(__file__).parent.parent
SEED_CONFIG = ROOT / "config" / "trends" / "seed_queries.json"
FIXTURE = ROOT / "data" / "mock" / "google_trends" / "jp_seed_fixture.json"


def get_collector() -> GoogleTrendsCollector:
    return GoogleTrendsCollector(seed_config_path=SEED_CONFIG, mock_fixture_path=FIXTURE)


def test_mock_bundle_has_observations():
    collector = get_collector()
    batch = collector.collect_bundle(mode="mock")
    assert not batch.errors
    assert batch.observations
    assert any(obs.week_start == "2026-04-06" for obs in batch.observations)


def test_import_rows_only_for_model_seeds():
    collector = get_collector()
    batch = collector.collect_bundle(mode="mock")
    assert batch.import_rows
    assert all(row["seed_type"] == "model" for row in batch.import_rows)
    assert all(row["raw_name"] for row in batch.import_rows)
    assert not any(row["seed_id"] == "leg_press_category" for row in batch.import_rows)
    skierg_rows = [row for row in batch.import_rows if row["seed_id"] == "concept2_skierg_model"]
    assert skierg_rows
    assert all(row["sample_size"] == 3 for row in skierg_rows)
    assert all('"observation_weeks": 3' in row["metadata_json"] for row in skierg_rows)


def test_collect_returns_week_metrics():
    collector = get_collector()
    result = collector.collect(keywords=["concept2_skierg_model"], week_start="2026-04-06")
    assert not result.errors
    assert len(result.metrics) == 1
    metric = result.metrics[0]
    assert metric.brand_name == "Concept2"
    assert metric.model_name == "SkiErg"
    assert metric.metric_type == "google_trends_interest"
