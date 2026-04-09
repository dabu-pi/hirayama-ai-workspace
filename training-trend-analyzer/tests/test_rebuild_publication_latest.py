"""Tests for deterministic publication latest rebuild."""

from __future__ import annotations

import io
import json
import sys
from pathlib import Path

import pytest

if sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts import rebuild_publication_latest


def _write_manifest(
    output_dir: Path,
    filename: str,
    *,
    content_kind: str,
    week: str,
    generated_at: str,
    publish_ready: bool,
    schema_version: str = "publication-handoff/v1",
    extra: dict | None = None,
) -> Path:
    payload = {
        "schema_version": schema_version,
        "artifact_schema_version": "publish-ready/v1",
        "content_kind": content_kind,
        "week": week,
        "generated_at": generated_at,
        "publish_ready": publish_ready,
        "artifact_path": f"data/output/{filename.replace('publication_handoff', 'publish_ready').replace('.json', '.json')}",
        "markdown_path": f"data/output/{filename.replace('publication_handoff', 'publish_ready').replace('.json', '.md')}",
        "slug": filename.replace(".json", ""),
        "title": filename.replace(".json", ""),
        "summary": "summary",
        "internal_reference": {"collector_source": "db"},
    }
    if extra:
        payload.update(extra)
    path = output_dir / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return path


def _run_rebuild(monkeypatch, capsys, output_dir: Path, *, kind: str = "all", dry_run: bool = False) -> str:
    monkeypatch.chdir(output_dir.parent.parent)
    argv = [
        "rebuild_publication_latest.py",
        "--output-dir",
        str(output_dir),
        "--kind",
        kind,
    ]
    if dry_run:
        argv.append("--dry-run")
    argv.append("--verbose")
    monkeypatch.setattr(sys, "argv", argv)
    rebuild_publication_latest.main()
    return capsys.readouterr().out


def test_rebuild_latest_selects_newest_ranking_week(monkeypatch, capsys, tmp_path):
    output_dir = tmp_path / "data" / "output"
    _write_manifest(
        output_dir,
        "publication_handoff_20260406.json",
        content_kind="ranking",
        week="2026-04-06",
        generated_at="2026-04-10T06:00:00",
        publish_ready=True,
    )
    _write_manifest(
        output_dir,
        "publication_handoff_20260413.json",
        content_kind="ranking",
        week="2026-04-13",
        generated_at="2026-04-10T07:00:00",
        publish_ready=True,
    )

    output = _run_rebuild(monkeypatch, capsys, output_dir, kind="ranking")
    latest = json.loads((output_dir / "publication_handoff_latest.json").read_text(encoding="utf-8"))

    assert "[REBUILD] kind=ranking week=2026-04-13" in output
    assert latest["manifest_path"] == "data/output/publication_handoff_20260413.json"


def test_rebuild_latest_selects_newest_compare_week(monkeypatch, capsys, tmp_path):
    output_dir = tmp_path / "data" / "output"
    _write_manifest(
        output_dir,
        "publication_handoff_compare_20260406.json",
        content_kind="compare",
        week="2026-04-06",
        generated_at="2026-04-10T06:00:00",
        publish_ready=True,
        extra={"compare_mode": True},
    )
    _write_manifest(
        output_dir,
        "publication_handoff_compare_20260413.json",
        content_kind="compare",
        week="2026-04-13",
        generated_at="2026-04-10T05:00:00",
        publish_ready=True,
        extra={"compare_mode": True},
    )

    _run_rebuild(monkeypatch, capsys, output_dir, kind="compare")
    latest = json.loads((output_dir / "publication_handoff_compare_latest.json").read_text(encoding="utf-8"))

    assert latest["manifest_path"] == "data/output/publication_handoff_compare_20260413.json"


def test_rebuild_latest_selects_newest_hold_week(monkeypatch, capsys, tmp_path):
    output_dir = tmp_path / "data" / "output"
    _write_manifest(
        output_dir,
        "publication_handoff_hold_20260413.json",
        content_kind="publish_hold",
        week="2026-04-13",
        generated_at="2026-04-10T06:00:00",
        publish_ready=False,
        extra={"hold_reason": "hold"},
    )
    _write_manifest(
        output_dir,
        "publication_handoff_hold_20260420.json",
        content_kind="publish_hold",
        week="2026-04-20",
        generated_at="2026-04-10T05:00:00",
        publish_ready=False,
        extra={"hold_reason": "hold"},
    )

    _run_rebuild(monkeypatch, capsys, output_dir, kind="publish_hold")
    latest = json.loads((output_dir / "publication_handoff_hold_latest.json").read_text(encoding="utf-8"))

    assert latest["manifest_path"] == "data/output/publication_handoff_hold_20260420.json"


def test_rebuild_latest_uses_generated_at_as_tiebreaker_within_same_week(monkeypatch, capsys, tmp_path):
    output_dir = tmp_path / "data" / "output"
    _write_manifest(
        output_dir,
        "publication_handoff_20260406_a.json",
        content_kind="ranking",
        week="2026-04-06",
        generated_at="2026-04-10T06:00:00",
        publish_ready=True,
    )
    _write_manifest(
        output_dir,
        "publication_handoff_20260406_b.json",
        content_kind="ranking",
        week="2026-04-06",
        generated_at="2026-04-10T07:00:00",
        publish_ready=True,
    )

    _run_rebuild(monkeypatch, capsys, output_dir, kind="ranking")
    latest = json.loads((output_dir / "publication_handoff_latest.json").read_text(encoding="utf-8"))

    assert latest["manifest_path"] == "data/output/publication_handoff_20260406_b.json"


def test_rebuild_latest_does_not_mix_hold_into_ranking_or_compare(monkeypatch, capsys, tmp_path):
    output_dir = tmp_path / "data" / "output"
    _write_manifest(
        output_dir,
        "publication_handoff_20260406.json",
        content_kind="ranking",
        week="2026-04-06",
        generated_at="2026-04-10T06:00:00",
        publish_ready=True,
    )
    _write_manifest(
        output_dir,
        "publication_handoff_compare_20260406.json",
        content_kind="compare",
        week="2026-04-06",
        generated_at="2026-04-10T06:00:00",
        publish_ready=True,
        extra={"compare_mode": True},
    )
    _write_manifest(
        output_dir,
        "publication_handoff_hold_20260420.json",
        content_kind="publish_hold",
        week="2026-04-20",
        generated_at="2026-04-10T07:00:00",
        publish_ready=False,
        extra={"hold_reason": "hold"},
    )

    _run_rebuild(monkeypatch, capsys, output_dir, kind="all")
    ranking_latest = json.loads((output_dir / "publication_handoff_latest.json").read_text(encoding="utf-8"))
    compare_latest = json.loads((output_dir / "publication_handoff_compare_latest.json").read_text(encoding="utf-8"))
    hold_latest = json.loads((output_dir / "publication_handoff_hold_latest.json").read_text(encoding="utf-8"))

    assert ranking_latest["manifest_path"] == "data/output/publication_handoff_20260406.json"
    assert compare_latest["manifest_path"] == "data/output/publication_handoff_compare_20260406.json"
    assert hold_latest["manifest_path"] == "data/output/publication_handoff_hold_20260420.json"


def test_rebuild_latest_fails_for_unsupported_manifest_schema_in_selected_kind(monkeypatch, capsys, tmp_path):
    output_dir = tmp_path / "data" / "output"
    _write_manifest(
        output_dir,
        "publication_handoff_20260406.json",
        content_kind="ranking",
        week="2026-04-06",
        generated_at="2026-04-10T06:00:00",
        publish_ready=True,
        schema_version="publication-handoff/v2",
    )

    monkeypatch.chdir(output_dir.parent.parent)
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "rebuild_publication_latest.py",
            "--output-dir",
            str(output_dir),
            "--kind",
            "ranking",
        ],
    )

    with pytest.raises(ValueError, match="Unsupported handoff manifest schema_version"):
        rebuild_publication_latest.main()
