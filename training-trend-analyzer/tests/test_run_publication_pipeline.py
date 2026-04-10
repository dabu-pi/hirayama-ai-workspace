"""Tests for publication pipeline orchestration."""

from __future__ import annotations

import io
import json
import sys
from pathlib import Path

import pytest

if sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts import run_publication_pipeline
from src.publication import pipeline as publication_pipeline

FIXTURES_DIR = Path(__file__).parent / "fixtures"


def _run_pipeline_cli(monkeypatch, capsys, tmp_path: Path, *args: str) -> str:
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "run_publication_pipeline.py",
            *args,
        ],
    )
    run_publication_pipeline.main()
    return capsys.readouterr().out


def test_publication_pipeline_succeeds_for_ranking_from_artifact(monkeypatch, capsys, tmp_path):
    # fixture: week=2026-04-06, generated_at=2026-04-10T00:10:00 -> token=20260410T001000
    artifact_path = FIXTURES_DIR / "publish_ready_ranking_artifact.json"
    output = _run_pipeline_cli(monkeypatch, capsys, tmp_path, "--from-artifact", str(artifact_path))

    markdown_path = tmp_path / "data" / "output" / "publish_ready_ranking_artifact.md"
    manifest_path = tmp_path / "data" / "output" / "publication_handoff_20260406_20260410T001000.json"
    latest_path = tmp_path / "data" / "output" / "publication_handoff_latest.json"

    assert markdown_path.exists()
    assert manifest_path.exists()
    assert latest_path.exists()
    assert "[PIPELINE] content_kind=ranking" in output
    assert "[PIPELINE] publish_ready=yes" in output


def test_publication_pipeline_succeeds_for_compare_from_artifact(monkeypatch, capsys, tmp_path):
    # fixture: week=2026-04-06, generated_at=2026-04-10T00:12:00 -> token=20260410T001200
    artifact_path = FIXTURES_DIR / "publish_ready_compare_artifact.json"
    _run_pipeline_cli(monkeypatch, capsys, tmp_path, "--from-artifact", str(artifact_path))

    manifest = json.loads(
        (tmp_path / "data" / "output" / "publication_handoff_compare_20260406_20260410T001200.json").read_text(encoding="utf-8")
    )
    latest = json.loads(
        (tmp_path / "data" / "output" / "publication_handoff_compare_latest.json").read_text(encoding="utf-8")
    )

    assert manifest["content_kind"] == "compare"
    assert manifest["compare_mode"] is True
    assert latest["manifest_path"] == "data/output/publication_handoff_compare_20260406_20260410T001200.json"


def test_publication_pipeline_succeeds_for_hold_from_artifact(monkeypatch, capsys, tmp_path):
    # fixture: week=2026-04-20, generated_at=2026-04-10T00:15:00 -> token=20260410T001500
    artifact_path = FIXTURES_DIR / "publish_ready_hold_artifact.json"
    _run_pipeline_cli(monkeypatch, capsys, tmp_path, "--from-artifact", str(artifact_path))

    manifest = json.loads(
        (tmp_path / "data" / "output" / "publication_handoff_hold_20260420_20260410T001500.json").read_text(encoding="utf-8")
    )
    latest = json.loads(
        (tmp_path / "data" / "output" / "publication_handoff_hold_latest.json").read_text(encoding="utf-8")
    )

    assert manifest["content_kind"] == "publish_hold"
    assert manifest["hold_reason"] == "source coverage is incomplete; ranking and compare are advisory only"
    assert latest["manifest_path"] == "data/output/publication_handoff_hold_20260420_20260410T001500.json"


def test_publication_pipeline_keeps_ranking_latest_separate_from_hold(monkeypatch, capsys, tmp_path):
    ranking_artifact = FIXTURES_DIR / "publish_ready_ranking_artifact.json"
    hold_artifact = FIXTURES_DIR / "publish_ready_hold_artifact.json"

    _run_pipeline_cli(monkeypatch, capsys, tmp_path, "--from-artifact", str(ranking_artifact))
    _run_pipeline_cli(monkeypatch, capsys, tmp_path, "--from-artifact", str(hold_artifact))

    ranking_latest = json.loads(
        (tmp_path / "data" / "output" / "publication_handoff_latest.json").read_text(encoding="utf-8")
    )
    hold_latest = json.loads(
        (tmp_path / "data" / "output" / "publication_handoff_hold_latest.json").read_text(encoding="utf-8")
    )

    assert ranking_latest["manifest_path"] == "data/output/publication_handoff_20260406_20260410T001000.json"
    assert hold_latest["manifest_path"] == "data/output/publication_handoff_hold_20260420_20260410T001500.json"


def test_publication_pipeline_keeps_compare_latest_separate_from_hold(monkeypatch, capsys, tmp_path):
    compare_artifact = FIXTURES_DIR / "publish_ready_compare_artifact.json"
    hold_artifact = FIXTURES_DIR / "publish_ready_hold_artifact.json"

    _run_pipeline_cli(monkeypatch, capsys, tmp_path, "--from-artifact", str(compare_artifact))
    _run_pipeline_cli(monkeypatch, capsys, tmp_path, "--from-artifact", str(hold_artifact))

    compare_latest = json.loads(
        (tmp_path / "data" / "output" / "publication_handoff_compare_latest.json").read_text(encoding="utf-8")
    )
    hold_latest = json.loads(
        (tmp_path / "data" / "output" / "publication_handoff_hold_latest.json").read_text(encoding="utf-8")
    )

    assert compare_latest["manifest_path"] == "data/output/publication_handoff_compare_20260406_20260410T001200.json"
    assert hold_latest["manifest_path"] == "data/output/publication_handoff_hold_20260420_20260410T001500.json"


def test_publication_pipeline_rebuilds_latest_from_manifest_group_not_execution_order(monkeypatch, capsys, tmp_path):
    # newer_artifact: week=2026-04-13, generated_at=2026-04-10T08:00:00 -> token=20260410T080000
    # older_artifact: week=2026-04-06, generated_at=2026-04-10T00:10:00 -> token=20260410T001000
    # Even though older_artifact is run second, latest must point to week=2026-04-13 (newer week).
    older_artifact = FIXTURES_DIR / "publish_ready_ranking_artifact.json"
    newer_artifact = tmp_path / "publish_ready_ranking_artifact_newer.json"
    payload = json.loads(older_artifact.read_text(encoding="utf-8"))
    payload["week"] = "2026-04-13"
    payload["generated_at"] = "2026-04-10T08:00:00"
    newer_artifact.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    _run_pipeline_cli(monkeypatch, capsys, tmp_path, "--from-artifact", str(newer_artifact))
    _run_pipeline_cli(monkeypatch, capsys, tmp_path, "--from-artifact", str(older_artifact))

    ranking_latest = json.loads(
        (tmp_path / "data" / "output" / "publication_handoff_latest.json").read_text(encoding="utf-8")
    )
    assert ranking_latest["manifest_path"] == "data/output/publication_handoff_20260413_20260410T080000.json"


def test_publication_pipeline_stops_before_handoff_when_markdown_stage_fails(monkeypatch, tmp_path):
    # fixture: week=2026-04-06, generated_at=2026-04-10T00:10:00 -> token=20260410T001000
    artifact_path = FIXTURES_DIR / "publish_ready_ranking_artifact.json"
    monkeypatch.chdir(tmp_path)

    def _boom(*args, **kwargs):
        raise publication_pipeline.PublicationPipelineError("markdown", "boom")

    monkeypatch.setattr(publication_pipeline, "render_publication_markdown", _boom)

    with pytest.raises(publication_pipeline.PublicationPipelineError, match=r"\[markdown\] boom"):
        publication_pipeline.run_publication_pipeline(from_artifact=artifact_path)

    assert not (tmp_path / "data" / "output" / "publication_handoff_20260406_20260410T001000.json").exists()
    assert not (tmp_path / "data" / "output" / "publication_handoff_latest.json").exists()


def test_publication_pipeline_same_week_rerun_creates_new_manifest_and_latest_points_to_newer(
    monkeypatch, capsys, tmp_path
):
    """Same-week re-run must create a NEW manifest file (different generated_at token) and
    update latest to point at the newer manifest.  The older manifest must still exist."""
    # first run: week=2026-04-06, generated_at=2026-04-10T00:10:00 -> token=20260410T001000
    older_artifact = FIXTURES_DIR / "publish_ready_ranking_artifact.json"

    # second run: same week, later generated_at=2026-04-10T09:00:00 -> token=20260410T090000
    newer_artifact = tmp_path / "ranking_rerun.json"
    payload = json.loads(older_artifact.read_text(encoding="utf-8"))
    payload["generated_at"] = "2026-04-10T09:00:00"
    newer_artifact.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    _run_pipeline_cli(monkeypatch, capsys, tmp_path, "--from-artifact", str(older_artifact))
    _run_pipeline_cli(monkeypatch, capsys, tmp_path, "--from-artifact", str(newer_artifact))

    output_dir = tmp_path / "data" / "output"
    older_manifest = output_dir / "publication_handoff_20260406_20260410T001000.json"
    newer_manifest = output_dir / "publication_handoff_20260406_20260410T090000.json"
    latest_path = output_dir / "publication_handoff_latest.json"

    # Both manifests coexist — the older one was NOT overwritten.
    assert older_manifest.exists(), "older manifest must still exist after same-week re-run"
    assert newer_manifest.exists(), "newer manifest must be created by re-run"

    latest = json.loads(latest_path.read_text(encoding="utf-8"))
    assert latest["manifest_path"] == "data/output/publication_handoff_20260406_20260410T090000.json"


def test_publication_pipeline_fails_for_unsupported_schema_and_does_not_continue(monkeypatch, capsys, tmp_path):
    artifact_path = FIXTURES_DIR / "publish_ready_unsupported_schema_artifact.json"
    monkeypatch.chdir(tmp_path)
    with pytest.raises(
        publication_pipeline.PublicationPipelineError,
        match=r"\[artifact\] Unsupported artifact schema_version",
    ):
        publication_pipeline.run_publication_pipeline(from_artifact=artifact_path)

    assert not (tmp_path / "data" / "output" / "publish_ready_unsupported_schema_artifact.md").exists()
