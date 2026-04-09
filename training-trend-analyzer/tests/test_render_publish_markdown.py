"""
Tests for artifact-only publish Markdown rendering.
"""

from __future__ import annotations

import io
import sys
from pathlib import Path

import pytest

if sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts import render_publish_markdown

FIXTURES_DIR = Path(__file__).parent / "fixtures"


def _run_renderer(monkeypatch, capsys, tmp_path: Path, artifact_name: str) -> tuple[str, Path]:
    artifact_path = FIXTURES_DIR / artifact_name
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "render_publish_markdown.py",
            "--artifact",
            str(artifact_path),
        ],
    )
    render_publish_markdown.main()
    captured = capsys.readouterr()
    output_path = tmp_path / "data" / "output" / f"{artifact_path.stem}.md"
    return captured.out, output_path


def test_render_publish_markdown_for_ranking_artifact(monkeypatch, capsys, tmp_path):
    output, output_path = _run_renderer(
        monkeypatch,
        capsys,
        tmp_path,
        "publish_ready_ranking_artifact.json",
    )

    assert output_path.exists()
    assert f"[MARKDOWN] {output_path.resolve()}" in output
    content = output_path.read_text(encoding="utf-8")
    assert "# Weekly Training Trend Update: 2026-04-06" in content
    assert "TECHNOGYM Run leads this week's treadmill trend candidates." in content
    assert "## Featured Categories" in content
    assert "**treadmill**" in content
    assert "## Featured Models" in content
    assert "**TECHNOGYM Run**" in content
    assert "## Compare Highlights" not in content


def test_render_publish_markdown_for_compare_artifact(monkeypatch, capsys, tmp_path):
    output, output_path = _run_renderer(
        monkeypatch,
        capsys,
        tmp_path,
        "publish_ready_compare_artifact.json",
    )

    assert output_path.exists()
    assert f"[MARKDOWN] {output_path.resolve()}" in output
    content = output_path.read_text(encoding="utf-8")
    assert "# Weekly Training Trend Update: 2026-04-06" in content
    assert "## Compare Highlights" in content
    assert "Significant shifts: 3 | Rank shifts: 0" in content
    assert "Top drivers: GS downweight x2, GS boost x1" in content
    assert "Largest impact: Concept2 SkiErg" in content
    assert "**Concept2 SkiErg** (ski_erg): GS downweight." in content


def test_render_publish_markdown_creates_hold_document_for_review_only(monkeypatch, capsys, tmp_path):
    output, output_path = _run_renderer(
        monkeypatch,
        capsys,
        tmp_path,
        "publish_ready_hold_artifact.json",
    )

    assert output_path.exists()
    assert f"[MARKDOWN] {output_path.resolve()}" in output
    content = output_path.read_text(encoding="utf-8")
    assert "# Publish Hold: 2026-04-20" in content
    assert "This weekly summary is not publish-ready and should stay in internal review." in content
    assert "## Hold Reasons" in content
    assert "source coverage is incomplete; ranking and compare are advisory only" in content
    assert "## Featured Models" not in content
    assert "## Compare Highlights" not in content


def test_render_publish_markdown_fails_when_required_keys_are_missing():
    artifact_path = FIXTURES_DIR / "publish_ready_invalid_artifact.json"

    with pytest.raises(ValueError, match="Missing required artifact key: public_summary.headline"):
        render_publish_markdown.load_publish_artifact(artifact_path)


def test_render_publish_markdown_fails_for_legacy_artifact_without_schema_version():
    artifact_path = FIXTURES_DIR / "publish_ready_legacy_artifact.json"

    with pytest.raises(
        ValueError,
        match="Artifact schema_version is required. Legacy artifacts without schema_version are not supported.",
    ):
        render_publish_markdown.load_publish_artifact(artifact_path)


def test_render_publish_markdown_fails_for_unsupported_schema_version():
    artifact_path = FIXTURES_DIR / "publish_ready_unsupported_schema_artifact.json"

    with pytest.raises(
        ValueError,
        match="Unsupported artifact schema_version: 'publish-ready/v2'. Supported schema_version\\(s\\): publish-ready/v1",
    ):
        render_publish_markdown.load_publish_artifact(artifact_path)
