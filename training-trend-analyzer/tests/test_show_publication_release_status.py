"""Tests for read-only publication release status CLI."""

from __future__ import annotations

import io
import json
import sys
from pathlib import Path

import pytest

if sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts import show_publication_release_status


def _write_release_pointer(
    output_dir: Path,
    filename: str,
    *,
    content_kind: str,
    week: str,
    promoted_at: str = "2026-04-11T09:00:00",
    source_generated_at: str = "2026-04-10T08:00:00",
    schema_version: str = "publication-release-pointer/v1",
    extra: dict | None = None,
) -> Path:
    payload = {
        "schema_version": schema_version,
        "content_kind": content_kind,
        "week": week,
        "publish_ready": True,
        "manifest_path": f"data/output/publication_handoff{'_compare' if content_kind == 'compare' else ''}_{week.replace('-', '')}.json",
        "artifact_path": f"data/output/publish_ready{'_compare' if content_kind == 'compare' else ''}_{week.replace('-', '')}.json",
        "markdown_path": f"data/output/publish_ready{'_compare' if content_kind == 'compare' else ''}_{week.replace('-', '')}.md",
        "title": f"{content_kind} title {week}",
        "slug": f"{content_kind}-{week}",
        "summary": "summary",
        "promoted_at": promoted_at,
        "source_generated_at": source_generated_at,
        "internal_reference": {"collector_source": "db"},
    }
    if extra:
        payload.update(extra)
    path = output_dir / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return path


def _append_ledger_record(
    output_dir: Path,
    *,
    content_kind: str,
    action: str,
    week: str,
    promoted_at: str,
    schema_version: str = "publication-release-ledger/v1",
    extra: dict | None = None,
) -> None:
    payload = {
        "schema_version": schema_version,
        "content_kind": content_kind,
        "action": action,
        "week": week,
        "manifest_path": f"data/output/publication_handoff{'_compare' if content_kind == 'compare' else ''}_{week.replace('-', '')}.json",
        "artifact_path": f"data/output/publish_ready{'_compare' if content_kind == 'compare' else ''}_{week.replace('-', '')}.json",
        "markdown_path": f"data/output/publish_ready{'_compare' if content_kind == 'compare' else ''}_{week.replace('-', '')}.md",
        "slug": f"{content_kind}-{week}",
        "title": f"{content_kind} title {week}",
        "summary": "summary",
        "publish_ready": True,
        "promoted_at": promoted_at,
        "source_generated_at": "2026-04-10T08:00:00",
        "internal_reference": {"collector_source": "db"},
    }
    if extra:
        payload.update(extra)
    path = output_dir / "publication_release_ledger.jsonl"
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "a", encoding="utf-8") as handle:
        handle.write(json.dumps(payload, ensure_ascii=False))
        handle.write("\n")


def _run_cli(monkeypatch, capsys, tmp_path: Path, *args: str) -> str:
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(sys, "argv", ["show_publication_release_status.py", *args])
    show_publication_release_status.main()
    return capsys.readouterr().out


def test_show_status_displays_ranking_current_release(monkeypatch, capsys, tmp_path):
    output_dir = tmp_path / "data" / "output"
    _write_release_pointer(output_dir, "publication_release_latest.json", content_kind="ranking", week="2026-04-06")
    _append_ledger_record(
        output_dir,
        content_kind="ranking",
        action="promote",
        week="2026-04-06",
        promoted_at="2026-04-11T09:00:00",
    )

    output = _run_cli(monkeypatch, capsys, tmp_path, "--kind", "ranking")

    assert "== ranking Current Release ==" in output
    assert "week: 2026-04-06" in output
    assert "title: ranking title 2026-04-06" in output
    assert "manifest: data/output/publication_handoff_20260406.json" in output
    assert "== ranking Recent History (limit=10) ==" in output


def test_show_status_displays_compare_current_release(monkeypatch, capsys, tmp_path):
    output_dir = tmp_path / "data" / "output"
    _write_release_pointer(
        output_dir,
        "publication_release_compare_latest.json",
        content_kind="compare",
        week="2026-04-06",
        extra={"compare_mode": True},
    )
    _append_ledger_record(
        output_dir,
        content_kind="compare",
        action="promote",
        week="2026-04-06",
        promoted_at="2026-04-11T09:00:00",
        extra={"compare_mode": True},
    )

    output = _run_cli(monkeypatch, capsys, tmp_path, "--kind", "compare")

    assert "== compare Current Release ==" in output
    assert "compare_mode: True" in output
    assert "== compare Recent History (limit=10) ==" in output


def test_show_status_history_limit_and_rollback_are_visible(monkeypatch, capsys, tmp_path):
    output_dir = tmp_path / "data" / "output"
    _write_release_pointer(output_dir, "publication_release_latest.json", content_kind="ranking", week="2026-04-06")
    _append_ledger_record(
        output_dir,
        content_kind="ranking",
        action="promote",
        week="2026-04-13",
        promoted_at="2026-04-11T09:00:00",
    )
    _append_ledger_record(
        output_dir,
        content_kind="ranking",
        action="rollback_promote",
        week="2026-04-06",
        promoted_at="2026-04-11T09:05:00",
        extra={
            "previous_release_manifest_path": "data/output/publication_handoff_20260413.json",
            "previous_release_week": "2026-04-13",
            "stable_markdown_updated": True,
        },
    )
    _append_ledger_record(
        output_dir,
        content_kind="ranking",
        action="promote",
        week="2026-03-30",
        promoted_at="2026-04-11T08:00:00",
    )

    output = _run_cli(monkeypatch, capsys, tmp_path, "--kind", "ranking", "--limit", "2")

    assert "rollback_promote | week=2026-04-06" in output
    assert "previous_week=2026-04-13" in output
    assert "stable_markdown_updated=yes" in output
    assert "2026-03-30" not in output


def test_show_status_reports_missing_pointer_and_empty_ledger(monkeypatch, capsys, tmp_path):
    output = _run_cli(monkeypatch, capsys, tmp_path, "--kind", "ranking")

    assert "No current release pointer found." in output
    assert "No release ledger entries found." in output


def test_show_status_json_output(monkeypatch, capsys, tmp_path):
    output_dir = tmp_path / "data" / "output"
    _write_release_pointer(output_dir, "publication_release_latest.json", content_kind="ranking", week="2026-04-06")
    _append_ledger_record(
        output_dir,
        content_kind="ranking",
        action="promote",
        week="2026-04-06",
        promoted_at="2026-04-11T09:00:00",
    )

    output = _run_cli(monkeypatch, capsys, tmp_path, "--kind", "ranking", "--json")
    payload = json.loads(output)

    assert "kinds" in payload
    assert "ranking" in payload["kinds"]
    assert payload["kinds"]["ranking"]["current_release"]["week"] == "2026-04-06"
    assert payload["kinds"]["ranking"]["recent_history"][0]["action"] == "promote"


def test_show_status_fails_for_invalid_release_pointer_schema(monkeypatch, tmp_path):
    output_dir = tmp_path / "data" / "output"
    _write_release_pointer(
        output_dir,
        "publication_release_latest.json",
        content_kind="ranking",
        week="2026-04-06",
        schema_version="publication-release-pointer/v2",
    )

    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(sys, "argv", ["show_publication_release_status.py", "--kind", "ranking"])
    with pytest.raises(ValueError, match="Unsupported release pointer schema_version"):
        show_publication_release_status.main()


def test_show_status_fails_for_invalid_release_ledger_schema(monkeypatch, tmp_path):
    output_dir = tmp_path / "data" / "output"
    _append_ledger_record(
        output_dir,
        content_kind="ranking",
        action="promote",
        week="2026-04-06",
        promoted_at="2026-04-11T09:00:00",
        schema_version="publication-release-ledger/v2",
    )

    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(sys, "argv", ["show_publication_release_status.py", "--kind", "ranking"])
    with pytest.raises(ValueError, match="Unsupported release ledger schema_version"):
        show_publication_release_status.main()


def test_show_status_is_read_only(monkeypatch, capsys, tmp_path):
    output_dir = tmp_path / "data" / "output"
    _write_release_pointer(output_dir, "publication_release_latest.json", content_kind="ranking", week="2026-04-06")
    _append_ledger_record(
        output_dir,
        content_kind="ranking",
        action="promote",
        week="2026-04-06",
        promoted_at="2026-04-11T09:00:00",
    )
    before = {path.relative_to(tmp_path): path.read_text(encoding="utf-8") for path in output_dir.rglob("*") if path.is_file()}

    _run_cli(monkeypatch, capsys, tmp_path, "--kind", "all", "--limit", "5", "--verbose")

    after = {path.relative_to(tmp_path): path.read_text(encoding="utf-8") for path in output_dir.rglob("*") if path.is_file()}
    assert before == after
