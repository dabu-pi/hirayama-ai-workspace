"""
Integration-style publish-ready artifact tests for run_batch.py.
"""

import io
import json
import sys
from pathlib import Path

import pytest

if sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts import run_batch
from src.collectors.mock import MockCollector

FIXTURES_DIR = Path(__file__).parent / "fixtures"
COMPARE_FIXTURE_PATH = FIXTURES_DIR / "compare_source_sets_cli_fixture.json"
REVIEW_ONLY_FIXTURE_PATH = FIXTURES_DIR / "publish_artifact_review_only_fixture.json"
BLOCKED_FIXTURE_PATH = FIXTURES_DIR / "publish_artifact_blocked_fixture.json"


def _run_cli_with_fixture(
    monkeypatch,
    capsys,
    tmp_path: Path,
    *,
    fixture_path: Path,
    week: str,
    extra_args: list[str] | None = None,
) -> str:
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(
        run_batch,
        "MockCollector",
        lambda: MockCollector(mock_path=fixture_path),
    )
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "run_batch.py",
            "--week",
            week,
            *(extra_args or []),
        ],
    )
    run_batch.main()
    captured = capsys.readouterr()
    return captured.out


def test_publish_artifact_is_generated_for_ok_compare_fixture(monkeypatch, capsys, tmp_path):
    output = _run_cli_with_fixture(
        monkeypatch,
        capsys,
        tmp_path,
        fixture_path=COMPARE_FIXTURE_PATH,
        week="2026-04-13",
        extra_args=["--compare-source-sets", "--output-publish-artifact"],
    )

    output_path = tmp_path / "data" / "output" / "publish_ready_compare_20260413.json"
    assert output_path.exists()
    assert f"[ARTIFACT] {output_path.resolve()}" in output

    payload = json.loads(output_path.read_text(encoding="utf-8"))
    assert payload["schema_version"] == "publish-ready/v1"
    assert "artifact_version" not in payload
    assert payload["week"] == "2026-04-13"
    assert payload["publish_ready"] is True
    assert payload["health"]["overall_status"] == "ok"
    assert payload["public_summary"]["headline"].startswith("Concept2 SkiErg")
    assert payload["public_summary"]["top_categories"][0]["category"] == "treadmill"
    assert [item["model"] for item in payload["public_summary"]["featured_models"]] == [
        "SkiErg",
        "Run",
        "T75",
    ]
    compare_summary = payload["public_summary"]["compare_summary"]
    assert compare_summary is not None
    assert compare_summary["rank_shift_count"] == 2
    assert compare_summary["top_drivers"] == "GS boost x3, GS downweight x3"
    assert compare_summary["largest_impact_model"] == "Concept2 SkiErg"
    assert compare_summary["highlights"][0]["model"] == "B-Two"


def test_publish_artifact_is_generated_but_not_publish_ready_for_review_only_health(monkeypatch, capsys, tmp_path):
    output = _run_cli_with_fixture(
        monkeypatch,
        capsys,
        tmp_path,
        fixture_path=REVIEW_ONLY_FIXTURE_PATH,
        week="2026-04-20",
        extra_args=["--output-publish-artifact"],
    )

    output_path = tmp_path / "data" / "output" / "publish_ready_20260420.json"
    assert output_path.exists()
    assert f"[ARTIFACT] {output_path.resolve()}" in output

    payload = json.loads(output_path.read_text(encoding="utf-8"))
    assert payload["schema_version"] == "publish-ready/v1"
    assert "artifact_version" not in payload
    assert payload["publish_ready"] is False
    assert payload["health"]["overall_status"] == "review_only"
    assert payload["health"]["reasons"] == [
        "source coverage is incomplete; ranking and compare are advisory only",
    ]
    assert payload["public_notice"].startswith("Internal review only:")
    assert payload["public_summary"]["compare_summary"] is None
    assert payload["internal_reference"]["compare_enabled"] is False


def test_publish_artifact_is_skipped_when_run_is_blocked(monkeypatch, capsys, tmp_path):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(
        run_batch,
        "MockCollector",
        lambda: MockCollector(mock_path=BLOCKED_FIXTURE_PATH),
    )
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "run_batch.py",
            "--week",
            "2026-04-27",
            "--output-publish-artifact",
        ],
    )

    with pytest.raises(SystemExit) as exc_info:
        run_batch.main()

    captured = capsys.readouterr()
    assert exc_info.value.code == 1
    assert "[HEALTH] overall=blocked publish_ready=no" in captured.out
    assert "[ARTIFACT] skipped: blocked by source health" in captured.out
    assert not (tmp_path / "data" / "output" / "publish_ready_20260427.json").exists()
