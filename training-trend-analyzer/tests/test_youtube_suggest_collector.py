"""
YouTube Suggest collector tests.
"""

import io
import sys
from pathlib import Path

if sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.collectors.suggest_common import extract_suggestion_texts
from src.collectors.youtube_suggest import YouTubeSuggestCollector


ROOT = Path(__file__).parent.parent
SEED_CONFIG = ROOT / "config" / "trends" / "seed_queries.json"
FIXTURE = ROOT / "data" / "mock" / "youtube_suggest" / "jp_seed_fixture.json"


def get_collector() -> YouTubeSuggestCollector:
    return YouTubeSuggestCollector(seed_config_path=SEED_CONFIG, mock_fixture_path=FIXTURE)


def test_extract_suggestion_texts_handles_nested_rows():
    payload = ["query", [["alpha review", 0], ["beta setup", 0]]]
    assert extract_suggestion_texts(payload) == ["alpha review", "beta setup"]


def test_mock_bundle_has_observations():
    collector = get_collector()
    batch = collector.collect_bundle(mode="mock")
    assert not batch.errors
    assert batch.observations
    assert any(obs.suggestion_rank == 1 for obs in batch.observations)


def test_import_rows_emit_count_and_presence():
    collector = get_collector()
    batch = collector.collect_bundle(mode="mock")
    metric_types = {row["metric_type"] for row in batch.import_rows}
    assert "youtube_suggest_count" in metric_types
    assert "youtube_suggest_presence" in metric_types
    assert all(row["seed_type"] == "model" for row in batch.import_rows)


def test_collect_returns_count_metric_only():
    collector = get_collector()
    result = collector.collect(keywords=["concept2_skierg_model"], week_start="2026-04-06")
    assert not result.errors
    assert len(result.metrics) == 1
    assert result.metrics[0].metric_type == "youtube_suggest_count"
