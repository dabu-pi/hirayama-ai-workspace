"""Tests for read-only candidate-vs-release review CLI."""

from __future__ import annotations

import io
import json
import sys
from pathlib import Path

import pytest

if sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts import review_publication_candidate


# ---------------------------------------------------------------------------
# Fixture helpers
# ---------------------------------------------------------------------------


def _write_dated_manifest(
    output_dir: Path,
    *,
    content_kind: str,
    week: str,
    generated_at: str = "2026-04-10T08:00:00",
    publish_ready: bool = True,
    hold_reason: str | None = None,
    extra: dict | None = None,
) -> Path:
    week_token = week.replace("-", "")
    if content_kind == "compare":
        filename = f"publication_handoff_compare_{week_token}.json"
    elif content_kind == "publish_hold":
        filename = f"publication_handoff_hold_{week_token}.json"
    else:
        filename = f"publication_handoff_{week_token}.json"

    payload: dict = {
        "schema_version": "publication-handoff/v1",
        "artifact_schema_version": "publish-ready/v1",
        "content_kind": content_kind,
        "week": week,
        "generated_at": generated_at,
        "publish_ready": publish_ready,
        "artifact_path": f"data/output/publish_ready_{week_token}.json",
        "markdown_path": f"data/output/publish_ready_{week_token}.md",
        "slug": f"training-trends-{week_token}",
        "title": f"Trend Update: {week}",
        "summary": "summary text",
        "internal_reference": {"collector_source": "db"},
    }
    if content_kind == "compare":
        payload["compare_mode"] = True
    if content_kind == "publish_hold":
        payload["hold_reason"] = hold_reason or "source data missing"
    if extra:
        payload.update(extra)

    path = output_dir / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return path


def _write_candidate_pointer(
    output_dir: Path,
    *,
    content_kind: str,
    week: str,
    manifest_path: str,
    publish_ready: bool = True,
    extra: dict | None = None,
) -> Path:
    if content_kind == "compare":
        filename = "publication_handoff_compare_latest.json"
    else:
        filename = "publication_handoff_latest.json"

    payload: dict = {
        "schema_version": "publication-handoff-pointer/v1",
        "content_kind": content_kind,
        "week": week,
        "publish_ready": publish_ready,
        "manifest_path": manifest_path,
        "updated_at": "2026-04-10T09:00:00",
    }
    if extra:
        payload.update(extra)

    path = output_dir / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return path


def _write_release_pointer(
    output_dir: Path,
    *,
    content_kind: str,
    week: str,
    promoted_at: str = "2026-04-09T10:00:00",
    source_generated_at: str = "2026-04-07T08:00:00",
    manifest_path: str | None = None,
    extra: dict | None = None,
) -> Path:
    week_token = week.replace("-", "")
    if content_kind == "compare":
        filename = "publication_release_compare_latest.json"
        default_manifest = f"data/output/publication_handoff_compare_{week_token}.json"
    else:
        filename = "publication_release_latest.json"
        default_manifest = f"data/output/publication_handoff_{week_token}.json"

    payload: dict = {
        "schema_version": "publication-release-pointer/v1",
        "content_kind": content_kind,
        "week": week,
        "publish_ready": True,
        "manifest_path": manifest_path or default_manifest,
        "artifact_path": f"data/output/publish_ready_{week_token}.json",
        "markdown_path": f"data/output/publish_ready_{week_token}.md",
        "title": f"Trend Update: {week}",
        "slug": f"training-trends-{week_token}",
        "summary": "summary text",
        "promoted_at": promoted_at,
        "source_generated_at": source_generated_at,
        "internal_reference": {"collector_source": "db"},
    }
    if content_kind == "compare":
        payload["compare_mode"] = True
    if extra:
        payload.update(extra)

    path = output_dir / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return path


def _run_cli(monkeypatch, capsys, tmp_path: Path, *args: str) -> str:
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(sys, "argv", ["review_publication_candidate.py", *args])
    review_publication_candidate.main()
    return capsys.readouterr().out


# ---------------------------------------------------------------------------
# Tests: ranking candidate newer than release
# ---------------------------------------------------------------------------


def test_ranking_candidate_newer_than_release(monkeypatch, capsys, tmp_path):
    output_dir = tmp_path / "data" / "output"
    manifest_path = _write_dated_manifest(
        output_dir, content_kind="ranking", week="2026-04-13", generated_at="2026-04-12T08:00:00"
    )
    _write_candidate_pointer(
        output_dir,
        content_kind="ranking",
        week="2026-04-13",
        manifest_path=str(manifest_path.relative_to(tmp_path)),
    )
    _write_release_pointer(
        output_dir,
        content_kind="ranking",
        week="2026-04-06",
        source_generated_at="2026-04-05T08:00:00",
    )

    output = _run_cli(monkeypatch, capsys, tmp_path, "--kind", "ranking")

    assert "candidate_newer_than_release" in output
    assert "PROMOTE READY" in output
    assert "promotable: True" in output
    assert "2026-04-13" in output  # candidate week
    assert "2026-04-06" in output  # release week


# ---------------------------------------------------------------------------
# Tests: compare candidate newer than release
# ---------------------------------------------------------------------------


def test_compare_candidate_newer_than_release(monkeypatch, capsys, tmp_path):
    output_dir = tmp_path / "data" / "output"
    manifest_path = _write_dated_manifest(
        output_dir, content_kind="compare", week="2026-04-13", generated_at="2026-04-12T08:00:00"
    )
    _write_candidate_pointer(
        output_dir,
        content_kind="compare",
        week="2026-04-13",
        manifest_path=str(manifest_path.relative_to(tmp_path)),
    )
    _write_release_pointer(
        output_dir,
        content_kind="compare",
        week="2026-04-06",
        source_generated_at="2026-04-05T08:00:00",
    )

    output = _run_cli(monkeypatch, capsys, tmp_path, "--kind", "compare")

    assert "candidate_newer_than_release" in output
    assert "PROMOTE READY" in output
    assert "compare_mode" in output


# ---------------------------------------------------------------------------
# Tests: no release / with candidate
# ---------------------------------------------------------------------------


def test_no_release_with_candidate(monkeypatch, capsys, tmp_path):
    output_dir = tmp_path / "data" / "output"
    manifest_path = _write_dated_manifest(
        output_dir, content_kind="ranking", week="2026-04-13"
    )
    _write_candidate_pointer(
        output_dir,
        content_kind="ranking",
        week="2026-04-13",
        manifest_path=str(manifest_path.relative_to(tmp_path)),
    )
    # No release pointer

    output = _run_cli(monkeypatch, capsys, tmp_path, "--kind", "ranking")

    assert "no_release" in output
    assert "PROMOTE READY" in output
    assert "initial promotion" in output
    assert "(no current release)" in output


# ---------------------------------------------------------------------------
# Tests: no candidate / with release
# ---------------------------------------------------------------------------


def test_no_candidate_with_release(monkeypatch, capsys, tmp_path):
    output_dir = tmp_path / "data" / "output"
    _write_release_pointer(
        output_dir, content_kind="ranking", week="2026-04-06"
    )
    # No candidate pointer

    output = _run_cli(monkeypatch, capsys, tmp_path, "--kind", "ranking")

    assert "no_candidate" in output
    assert "hold" in output
    assert "promotable: False" in output
    assert "(no candidate found)" in output
    assert "2026-04-06" in output  # release still shows


# ---------------------------------------------------------------------------
# Tests: same manifest
# ---------------------------------------------------------------------------


def test_same_manifest(monkeypatch, capsys, tmp_path):
    output_dir = tmp_path / "data" / "output"
    manifest_path = _write_dated_manifest(
        output_dir, content_kind="ranking", week="2026-04-06"
    )
    rel_path = str(manifest_path.relative_to(tmp_path))
    _write_candidate_pointer(
        output_dir,
        content_kind="ranking",
        week="2026-04-06",
        manifest_path=rel_path,
    )
    _write_release_pointer(
        output_dir,
        content_kind="ranking",
        week="2026-04-06",
        manifest_path=rel_path,
        source_generated_at="2026-04-05T08:00:00",
    )

    output = _run_cli(monkeypatch, capsys, tmp_path, "--kind", "ranking")

    assert "same_manifest" in output
    assert "no action needed" in output
    assert "promotable: False" in output


# ---------------------------------------------------------------------------
# Tests: candidate older than release
# ---------------------------------------------------------------------------


def test_candidate_older_than_release(monkeypatch, capsys, tmp_path):
    output_dir = tmp_path / "data" / "output"
    manifest_path = _write_dated_manifest(
        output_dir, content_kind="ranking", week="2026-03-30", generated_at="2026-03-29T08:00:00"
    )
    _write_candidate_pointer(
        output_dir,
        content_kind="ranking",
        week="2026-03-30",
        manifest_path=str(manifest_path.relative_to(tmp_path)),
    )
    _write_release_pointer(
        output_dir,
        content_kind="ranking",
        week="2026-04-06",
        source_generated_at="2026-04-05T08:00:00",
    )

    output = _run_cli(monkeypatch, capsys, tmp_path, "--kind", "ranking")

    assert "candidate_older_than_release" in output
    assert "hold" in output
    assert "promotable: False" in output
    assert "rollback" in output


# ---------------------------------------------------------------------------
# Tests: candidate not publish_ready (hold manifest scenario)
# ---------------------------------------------------------------------------


def test_candidate_not_publish_ready(monkeypatch, capsys, tmp_path):
    output_dir = tmp_path / "data" / "output"
    manifest_path = _write_dated_manifest(
        output_dir,
        content_kind="publish_hold",
        week="2026-04-13",
        publish_ready=False,
        hold_reason="insufficient source data",
    )
    # Point the ranking candidate pointer to a hold manifest (edge/corrupt case)
    _write_candidate_pointer(
        output_dir,
        content_kind="ranking",
        week="2026-04-13",
        manifest_path=str(manifest_path.relative_to(tmp_path)),
        publish_ready=False,
    )
    _write_release_pointer(
        output_dir, content_kind="ranking", week="2026-04-06"
    )

    output = _run_cli(monkeypatch, capsys, tmp_path, "--kind", "ranking")

    assert "candidate_not_publish_ready" in output
    assert "hold" in output
    assert "promotable: False" in output
    assert "insufficient source data" in output


# ---------------------------------------------------------------------------
# Tests: --json output
# ---------------------------------------------------------------------------


def test_json_output_structure(monkeypatch, capsys, tmp_path):
    output_dir = tmp_path / "data" / "output"
    manifest_path = _write_dated_manifest(
        output_dir, content_kind="ranking", week="2026-04-13", generated_at="2026-04-12T08:00:00"
    )
    _write_candidate_pointer(
        output_dir,
        content_kind="ranking",
        week="2026-04-13",
        manifest_path=str(manifest_path.relative_to(tmp_path)),
    )
    _write_release_pointer(
        output_dir,
        content_kind="ranking",
        week="2026-04-06",
        source_generated_at="2026-04-05T08:00:00",
    )

    output = _run_cli(monkeypatch, capsys, tmp_path, "--kind", "ranking", "--json")
    payload = json.loads(output)

    assert "kinds" in payload
    assert "ranking" in payload["kinds"]
    section = payload["kinds"]["ranking"]
    assert section["kind"] == "ranking"
    assert section["current_release"]["week"] == "2026-04-06"
    assert section["latest_candidate"]["week"] == "2026-04-13"
    assert section["review"]["status"] == "candidate_newer_than_release"
    assert section["review"]["promotable"] is True
    assert isinstance(section["review"]["notes"], list)


def test_json_output_no_candidate_no_release(monkeypatch, capsys, tmp_path):
    output = _run_cli(monkeypatch, capsys, tmp_path, "--kind", "ranking", "--json")
    payload = json.loads(output)

    assert payload["kinds"]["ranking"]["current_release"] is None
    assert payload["kinds"]["ranking"]["latest_candidate"] is None
    assert payload["kinds"]["ranking"]["review"]["status"] == "no_candidate"
    assert payload["kinds"]["ranking"]["review"]["promotable"] is False


def test_json_all_kinds(monkeypatch, capsys, tmp_path):
    output = _run_cli(monkeypatch, capsys, tmp_path, "--kind", "all", "--json")
    payload = json.loads(output)

    assert "ranking" in payload["kinds"]
    assert "compare" in payload["kinds"]


# ---------------------------------------------------------------------------
# Tests: schema validation failure
# ---------------------------------------------------------------------------


def test_invalid_release_pointer_schema_fails(monkeypatch, tmp_path):
    output_dir = tmp_path / "data" / "output"
    _write_release_pointer(
        output_dir,
        content_kind="ranking",
        week="2026-04-06",
        extra={"schema_version": "publication-release-pointer/v2"},
    )

    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(sys, "argv", ["review_publication_candidate.py", "--kind", "ranking"])
    with pytest.raises((ValueError, SystemExit)):
        review_publication_candidate.main()


# ---------------------------------------------------------------------------
# Tests: field diff notes are shown when candidate differs from release
# ---------------------------------------------------------------------------


def test_field_diff_notes_when_slug_changes(monkeypatch, capsys, tmp_path):
    output_dir = tmp_path / "data" / "output"
    week_token = "20260413"
    manifest_path = _write_dated_manifest(
        output_dir,
        content_kind="ranking",
        week="2026-04-13",
        generated_at="2026-04-12T08:00:00",
        extra={"slug": "new-slug-20260413", "title": "New Title 2026-04-13"},
    )
    _write_candidate_pointer(
        output_dir,
        content_kind="ranking",
        week="2026-04-13",
        manifest_path=str(manifest_path.relative_to(tmp_path)),
    )
    _write_release_pointer(
        output_dir,
        content_kind="ranking",
        week="2026-04-06",
        source_generated_at="2026-04-05T08:00:00",
    )

    output = _run_cli(monkeypatch, capsys, tmp_path, "--kind", "ranking")

    assert "Field diff [slug]" in output or "Field diff [title]" in output


# ---------------------------------------------------------------------------
# Tests: no write side effects
# ---------------------------------------------------------------------------


def test_review_is_read_only(monkeypatch, capsys, tmp_path):
    output_dir = tmp_path / "data" / "output"
    manifest_path = _write_dated_manifest(
        output_dir, content_kind="ranking", week="2026-04-13"
    )
    _write_candidate_pointer(
        output_dir,
        content_kind="ranking",
        week="2026-04-13",
        manifest_path=str(manifest_path.relative_to(tmp_path)),
    )
    _write_release_pointer(
        output_dir, content_kind="ranking", week="2026-04-06"
    )

    before = {
        p.relative_to(tmp_path): p.read_text(encoding="utf-8")
        for p in output_dir.rglob("*")
        if p.is_file()
    }

    _run_cli(monkeypatch, capsys, tmp_path, "--kind", "all", "--verbose")

    after = {
        p.relative_to(tmp_path): p.read_text(encoding="utf-8")
        for p in output_dir.rglob("*")
        if p.is_file()
    }

    assert before == after


# ---------------------------------------------------------------------------
# Tests: candidate_differs_same_week
# ---------------------------------------------------------------------------


def test_candidate_differs_same_week(monkeypatch, capsys, tmp_path):
    output_dir = tmp_path / "data" / "output"
    # Candidate was generated later on the same week
    manifest_path = _write_dated_manifest(
        output_dir, content_kind="ranking", week="2026-04-06", generated_at="2026-04-08T12:00:00"
    )
    _write_candidate_pointer(
        output_dir,
        content_kind="ranking",
        week="2026-04-06",
        manifest_path=str(manifest_path.relative_to(tmp_path)),
    )
    _write_release_pointer(
        output_dir,
        content_kind="ranking",
        week="2026-04-06",
        manifest_path="data/output/publication_handoff_20260406_old.json",
        source_generated_at="2026-04-06T08:00:00",
    )

    output = _run_cli(monkeypatch, capsys, tmp_path, "--kind", "ranking")

    assert "candidate_differs_same_week" in output
    assert "PROMOTE READY" in output


def test_candidate_differs_same_week_with_new_filename_format(monkeypatch, capsys, tmp_path):
    """Same-week re-run with new generated_at-stamped filenames produces candidate_differs_same_week.

    When the pipeline creates a second manifest for the same week with a newer
    generated_at (e.g. publication_handoff_20260406_20260410T090000.json) and
    the latest candidate pointer is updated to it, the review CLI must detect
    candidate_differs_same_week and mark it PROMOTE READY.
    """
    output_dir = tmp_path / "data" / "output"

    # New candidate manifest (re-run): same week, newer generated_at, new filename
    new_manifest_path = output_dir / "publication_handoff_20260406_20260410T090000.json"
    new_manifest_path.parent.mkdir(parents=True, exist_ok=True)
    new_manifest_payload = {
        "schema_version": "publication-handoff/v1",
        "artifact_schema_version": "publish-ready/v1",
        "content_kind": "ranking",
        "week": "2026-04-06",
        "generated_at": "2026-04-10T09:00:00",
        "publish_ready": True,
        "artifact_path": "data/output/publish_ready_20260406.json",
        "markdown_path": "data/output/ranking_rerun.md",
        "slug": "training-trends-20260406",
        "title": "Trend Update: 2026-04-06",
        "summary": "re-run summary",
        "internal_reference": {"collector_source": "db"},
    }
    new_manifest_path.write_text(
        __import__("json").dumps(new_manifest_payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    _write_candidate_pointer(
        output_dir,
        content_kind="ranking",
        week="2026-04-06",
        manifest_path="data/output/publication_handoff_20260406_20260410T090000.json",
    )
    # Release was promoted from the older manifest with a different path
    _write_release_pointer(
        output_dir,
        content_kind="ranking",
        week="2026-04-06",
        manifest_path="data/output/publication_handoff_20260406_20260410T001000.json",
        source_generated_at="2026-04-10T00:10:00",
    )

    output = _run_cli(monkeypatch, capsys, tmp_path, "--kind", "ranking")

    assert "candidate_differs_same_week" in output
    assert "PROMOTE READY" in output
