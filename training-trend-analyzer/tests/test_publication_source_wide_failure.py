"""Source-wide GS/YT failure regression tests for publication hold behavior."""

from __future__ import annotations

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
from src.publication import pipeline as publication_pipeline

FIXTURES_DIR = Path(__file__).parent / "fixtures"


SOURCE_WIDE_FAILURE_CASES = [
    pytest.param(
        "gs",
        "GS",
        "2026-05-04",
        FIXTURES_DIR / "publish_artifact_gs_source_wide_failure_fixture.json",
        id="gs-source-wide-failure",
    ),
    pytest.param(
        "yt",
        "YT",
        "2026-05-11",
        FIXTURES_DIR / "publish_artifact_youtube_source_wide_failure_fixture.json",
        id="yt-source-wide-failure",
    ),
]


def _run_batch_from_fixture(
    monkeypatch,
    capsys,
    tmp_path: Path,
    *,
    fixture_path: Path,
    week: str,
) -> tuple[str, Path, dict]:
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
            "--output-publish-artifact",
        ],
    )

    run_batch.main()
    output = capsys.readouterr().out
    artifact_path = tmp_path / "data" / "output" / f"publish_ready_{week.replace('-', '')}.json"
    artifact = json.loads(artifact_path.read_text(encoding="utf-8"))
    return output, artifact_path, artifact


def _source_summary(payload: dict, source_key: str) -> dict:
    return next(
        source
        for source in payload["health"]["source_summary"]
        if source["key"] == source_key
    )


@pytest.mark.parametrize(
    ("source_key", "source_label", "week", "fixture_path"),
    SOURCE_WIDE_FAILURE_CASES,
)
def test_source_wide_failure_generates_publish_hold_pipeline_outputs(
    monkeypatch,
    capsys,
    tmp_path,
    source_key: str,
    source_label: str,
    week: str,
    fixture_path: Path,
):
    output, artifact_path, artifact = _run_batch_from_fixture(
        monkeypatch,
        capsys,
        tmp_path,
        fixture_path=fixture_path,
        week=week,
    )

    assert "[HEALTH] overall=review_only publish_ready=no" in output
    assert f"{source_label}=missing(0/2)" in output
    assert artifact["schema_version"] == "publish-ready/v1"
    assert artifact["publish_ready"] is False
    assert artifact["health"]["overall_status"] == "review_only"
    assert artifact["health"]["publish_ready"] is False
    assert artifact["health"]["reasons"] == [
        "source coverage is incomplete; ranking and compare are advisory only",
    ]

    failed_source = _source_summary(artifact, source_key)
    assert failed_source["status"] == "missing"
    assert failed_source["present_models"] == 0
    assert failed_source["expected_models"] == 2
    assert failed_source["reasons"] == [
        f"{source_label} metrics unavailable (0/2 models)",
    ]

    pipeline_result = publication_pipeline.run_publication_pipeline(from_artifact=artifact_path)
    markdown_path = pipeline_result["markdown_path"]
    manifest_path = pipeline_result["dated_manifest_path"]
    latest_pointer_path = pipeline_result["latest_pointer_path"]

    assert pipeline_result["content_kind"] == "publish_hold"
    assert pipeline_result["publish_ready"] is False
    assert markdown_path is not None and markdown_path.exists()
    assert manifest_path is not None and manifest_path.exists()
    assert latest_pointer_path is not None and latest_pointer_path.exists()

    markdown = markdown_path.read_text(encoding="utf-8")
    assert "content_kind: 'publish_hold'" in markdown
    assert "publish_ready: false" in markdown
    assert "hold_reason: 'source coverage is incomplete; ranking and compare are advisory only'" in markdown
    assert "This weekly summary is not publish-ready and should stay in internal review." in markdown

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    latest_pointer = json.loads(latest_pointer_path.read_text(encoding="utf-8"))
    assert manifest["content_kind"] == "publish_hold"
    assert manifest["publish_ready"] is False
    assert manifest["hold_reason"] == "source coverage is incomplete; ranking and compare are advisory only"
    assert latest_pointer["content_kind"] == "publish_hold"
    assert latest_pointer["publish_ready"] is False
    assert latest_pointer["manifest_path"].endswith(manifest_path.name)
