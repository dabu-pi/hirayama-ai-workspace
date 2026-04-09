"""Tests for publication handoff manifest generation."""

from __future__ import annotations

import io
import json
import sys
from pathlib import Path

import pytest

if sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts import build_publication_handoff, render_publish_markdown

FIXTURES_DIR = Path(__file__).parent / "fixtures"


def _render_fixture_markdown(tmp_path: Path, artifact_name: str, output_name: str | None = None) -> tuple[Path, Path]:
    artifact_path = FIXTURES_DIR / artifact_name
    payload = render_publish_markdown.load_publish_artifact(artifact_path)
    markdown_text = render_publish_markdown.render_publish_markdown(payload, artifact_path)
    markdown_path = tmp_path / "data" / "output" / (output_name or f"{artifact_path.stem}.md")
    markdown_path.parent.mkdir(parents=True, exist_ok=True)
    markdown_path.write_text(markdown_text, encoding="utf-8")
    return artifact_path, markdown_path


def _run_handoff(monkeypatch, capsys, tmp_path: Path, artifact_path: Path, markdown_path: Path) -> str:
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "build_publication_handoff.py",
            "--artifact",
            str(artifact_path),
            "--markdown",
            str(markdown_path),
        ],
    )
    build_publication_handoff.main()
    return capsys.readouterr().out


def test_build_publication_handoff_for_ranking(monkeypatch, capsys, tmp_path):
    artifact_path, markdown_path = _render_fixture_markdown(tmp_path, "publish_ready_ranking_artifact.json")
    output = _run_handoff(monkeypatch, capsys, tmp_path, artifact_path, markdown_path)

    manifest_path = tmp_path / "data" / "output" / "publication_handoff_20260406.json"
    latest_path = tmp_path / "data" / "output" / "publication_handoff_latest.json"

    assert manifest_path.exists()
    assert latest_path.exists()
    assert f"[HANDOFF] {manifest_path.resolve()}" in output
    assert f"[LATEST] {latest_path.resolve()}" in output

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    latest = json.loads(latest_path.read_text(encoding="utf-8"))

    assert manifest["schema_version"] == "publication-handoff/v1"
    assert manifest["artifact_schema_version"] == "publish-ready/v1"
    assert manifest["content_kind"] == "ranking"
    assert manifest["publish_ready"] is True
    assert manifest["artifact_path"] == "tests/fixtures/publish_ready_ranking_artifact.json"
    assert manifest["markdown_path"] == "data/output/publish_ready_ranking_artifact.md"
    assert manifest["slug"] == "training-trends-20260406"
    assert latest["schema_version"] == "publication-handoff-pointer/v1"
    assert latest["content_kind"] == "ranking"
    assert latest["manifest_path"] == "data/output/publication_handoff_20260406.json"


def test_build_publication_handoff_for_compare(monkeypatch, capsys, tmp_path):
    artifact_path, markdown_path = _render_fixture_markdown(tmp_path, "publish_ready_compare_artifact.json")
    _run_handoff(monkeypatch, capsys, tmp_path, artifact_path, markdown_path)

    manifest_path = tmp_path / "data" / "output" / "publication_handoff_compare_20260406.json"
    latest_path = tmp_path / "data" / "output" / "publication_handoff_compare_latest.json"

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    latest = json.loads(latest_path.read_text(encoding="utf-8"))

    assert manifest["content_kind"] == "compare"
    assert manifest["compare_mode"] is True
    assert manifest["slug"] == "training-trends-compare-20260406"
    assert "hold_reason" not in manifest
    assert latest["content_kind"] == "compare"
    assert latest["manifest_path"] == "data/output/publication_handoff_compare_20260406.json"


def test_build_publication_handoff_for_hold(monkeypatch, capsys, tmp_path):
    artifact_path, markdown_path = _render_fixture_markdown(tmp_path, "publish_ready_hold_artifact.json")
    _run_handoff(monkeypatch, capsys, tmp_path, artifact_path, markdown_path)

    manifest_path = tmp_path / "data" / "output" / "publication_handoff_hold_20260420.json"
    latest_path = tmp_path / "data" / "output" / "publication_handoff_hold_latest.json"

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    latest = json.loads(latest_path.read_text(encoding="utf-8"))

    assert manifest["content_kind"] == "publish_hold"
    assert manifest["publish_ready"] is False
    assert manifest["hold_reason"] == "source coverage is incomplete; ranking and compare are advisory only"
    assert "compare_mode" not in manifest
    assert latest["content_kind"] == "publish_hold"
    assert latest["manifest_path"] == "data/output/publication_handoff_hold_20260420.json"


def test_build_publication_handoff_fails_on_content_kind_mismatch(monkeypatch, capsys, tmp_path):
    artifact_path, markdown_path = _render_fixture_markdown(
        tmp_path,
        "publish_ready_ranking_artifact.json",
        output_name="publish_ready_ranking_artifact_mismatch.md",
    )
    broken = markdown_path.read_text(encoding="utf-8").replace("content_kind: 'ranking'", "content_kind: 'compare'", 1)
    markdown_path.write_text(broken, encoding="utf-8")

    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "build_publication_handoff.py",
            "--artifact",
            str(artifact_path),
            "--markdown",
            str(markdown_path),
        ],
    )

    with pytest.raises(ValueError, match="Markdown front matter mismatch for content_kind"):
        build_publication_handoff.main()


def test_build_publication_handoff_fails_for_unsupported_artifact_schema(monkeypatch, capsys, tmp_path):
    artifact_path, markdown_path = _render_fixture_markdown(tmp_path, "publish_ready_ranking_artifact.json")
    unsupported_artifact = FIXTURES_DIR / "publish_ready_unsupported_schema_artifact.json"

    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "build_publication_handoff.py",
            "--artifact",
            str(unsupported_artifact),
            "--markdown",
            str(markdown_path),
        ],
    )

    with pytest.raises(ValueError, match="Unsupported artifact schema_version"):
        build_publication_handoff.main()
