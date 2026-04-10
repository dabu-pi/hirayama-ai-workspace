"""Tests for manual publication release promotion."""

from __future__ import annotations

import io
import json
import sys
from pathlib import Path

import pytest

if sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts import promote_publication_release
from src.publication.release_ledger import load_release_ledger_records


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

    markdown_path = output_dir.parent.parent / payload["markdown_path"]
    markdown_path.parent.mkdir(parents=True, exist_ok=True)
    markdown_path.write_text(f"# {payload['title']}\n", encoding="utf-8")
    return path


def _run_promote(monkeypatch, capsys, tmp_path: Path, *args: str) -> str:
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "promote_publication_release.py",
            *args,
        ],
    )
    promote_publication_release.main()
    return capsys.readouterr().out


def test_promote_release_succeeds_for_ranking_and_copies_stable_markdown(monkeypatch, capsys, tmp_path):
    output_dir = tmp_path / "data" / "output"
    manifest_path = _write_manifest(
        output_dir,
        "publication_handoff_20260406.json",
        content_kind="ranking",
        week="2026-04-06",
        generated_at="2026-04-10T06:00:00",
        publish_ready=True,
    )

    output = _run_promote(
        monkeypatch,
        capsys,
        tmp_path,
        "--manifest",
        str(manifest_path),
        "--copy-markdown",
        "--verbose",
    )

    pointer_path = output_dir / "publication_release_latest.json"
    stable_markdown_path = output_dir / "publication_release_latest.md"
    ledger_path = output_dir / "publication_release_ledger.jsonl"
    pointer = json.loads(pointer_path.read_text(encoding="utf-8"))
    records = load_release_ledger_records(ledger_path)

    assert "[RELEASE] data/output/publication_release_latest.json" in output
    assert "[RELEASE-MARKDOWN] data/output/publication_release_latest.md" in output
    assert "[RELEASE-LEDGER] data/output/publication_release_ledger.jsonl" in output
    assert pointer["schema_version"] == "publication-release-pointer/v1"
    assert pointer["content_kind"] == "ranking"
    assert pointer["manifest_path"] == "data/output/publication_handoff_20260406.json"
    assert pointer["artifact_path"] == "data/output/publish_ready_20260406.json"
    assert pointer["markdown_path"] == "data/output/publish_ready_20260406.md"
    assert pointer["source_generated_at"] == "2026-04-10T06:00:00"
    assert stable_markdown_path.read_text(encoding="utf-8") == "# publication_handoff_20260406\n"
    assert len(records) == 1
    assert records[0]["schema_version"] == "publication-release-ledger/v1"
    assert records[0]["action"] == "promote"
    assert records[0]["content_kind"] == "ranking"
    assert records[0]["manifest_path"] == "data/output/publication_handoff_20260406.json"
    assert records[0]["stable_markdown_updated"] is True
    assert "previous_release_manifest_path" not in records[0]


def test_promote_release_succeeds_for_compare(monkeypatch, capsys, tmp_path):
    output_dir = tmp_path / "data" / "output"
    manifest_path = _write_manifest(
        output_dir,
        "publication_handoff_compare_20260406.json",
        content_kind="compare",
        week="2026-04-06",
        generated_at="2026-04-10T06:00:00",
        publish_ready=True,
        extra={"compare_mode": True},
    )

    _run_promote(monkeypatch, capsys, tmp_path, "--manifest", str(manifest_path))
    pointer = json.loads((output_dir / "publication_release_compare_latest.json").read_text(encoding="utf-8"))
    records = load_release_ledger_records(output_dir / "publication_release_ledger.jsonl")

    assert pointer["content_kind"] == "compare"
    assert pointer["compare_mode"] is True
    assert pointer["manifest_path"] == "data/output/publication_handoff_compare_20260406.json"
    assert len(records) == 1
    assert records[0]["content_kind"] == "compare"
    assert records[0]["compare_mode"] is True
    assert records[0]["action"] == "promote"


def test_promote_release_rejects_hold_manifest(monkeypatch, tmp_path):
    output_dir = tmp_path / "data" / "output"
    manifest_path = _write_manifest(
        output_dir,
        "publication_handoff_hold_20260420.json",
        content_kind="publish_hold",
        week="2026-04-20",
        generated_at="2026-04-10T06:00:00",
        publish_ready=False,
        extra={"hold_reason": "hold"},
    )

    monkeypatch.chdir(tmp_path)
    with pytest.raises(ValueError, match="supports only content_kind"):
        promote_publication_release.promote_publication_release(
            manifest_path,
        )
    assert not (output_dir / "publication_release_ledger.jsonl").exists()


def test_promote_release_rejects_not_ready_manifest(monkeypatch, tmp_path):
    output_dir = tmp_path / "data" / "output"
    manifest_path = _write_manifest(
        output_dir,
        "publication_handoff_20260406.json",
        content_kind="ranking",
        week="2026-04-06",
        generated_at="2026-04-10T06:00:00",
        publish_ready=False,
    )

    monkeypatch.chdir(tmp_path)
    with pytest.raises(ValueError, match="must have publish_ready=true"):
        promote_publication_release.promote_publication_release(manifest_path)
    assert not (output_dir / "publication_release_ledger.jsonl").exists()


def test_promote_release_rejects_unsupported_manifest_schema(monkeypatch, tmp_path):
    output_dir = tmp_path / "data" / "output"
    manifest_path = _write_manifest(
        output_dir,
        "publication_handoff_20260406.json",
        content_kind="ranking",
        week="2026-04-06",
        generated_at="2026-04-10T06:00:00",
        publish_ready=True,
        schema_version="publication-handoff/v2",
    )

    monkeypatch.chdir(tmp_path)
    with pytest.raises(ValueError, match="Unsupported handoff manifest schema_version"):
        promote_publication_release.promote_publication_release(manifest_path)
    assert not (output_dir / "publication_release_ledger.jsonl").exists()


def test_promote_release_requires_allow_rollback_for_older_manifest(monkeypatch, tmp_path):
    output_dir = tmp_path / "data" / "output"
    newer_manifest = _write_manifest(
        output_dir,
        "publication_handoff_20260413.json",
        content_kind="ranking",
        week="2026-04-13",
        generated_at="2026-04-10T08:00:00",
        publish_ready=True,
    )
    older_manifest = _write_manifest(
        output_dir,
        "publication_handoff_20260406.json",
        content_kind="ranking",
        week="2026-04-06",
        generated_at="2026-04-10T06:00:00",
        publish_ready=True,
    )

    monkeypatch.chdir(tmp_path)
    promote_publication_release.promote_publication_release(newer_manifest)

    with pytest.raises(ValueError, match="--allow-rollback"):
        promote_publication_release.promote_publication_release(older_manifest)

    records = load_release_ledger_records(output_dir / "publication_release_ledger.jsonl")
    assert len(records) == 1
    assert records[0]["action"] == "promote"


def test_promote_release_allows_explicit_rollback_and_keeps_candidate_latest_independent(monkeypatch, tmp_path):
    output_dir = tmp_path / "data" / "output"
    newer_manifest = _write_manifest(
        output_dir,
        "publication_handoff_20260413.json",
        content_kind="ranking",
        week="2026-04-13",
        generated_at="2026-04-10T08:00:00",
        publish_ready=True,
    )
    older_manifest = _write_manifest(
        output_dir,
        "publication_handoff_20260406.json",
        content_kind="ranking",
        week="2026-04-06",
        generated_at="2026-04-10T06:00:00",
        publish_ready=True,
    )
    candidate_latest_path = output_dir / "publication_handoff_latest.json"
    candidate_latest_path.write_text(
        json.dumps(
            {
                "schema_version": "publication-handoff-pointer/v1",
                "content_kind": "ranking",
                "week": "2026-04-13",
                "publish_ready": True,
                "manifest_path": "data/output/publication_handoff_20260413.json",
                "updated_at": "2026-04-10T08:05:00",
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    monkeypatch.chdir(tmp_path)
    promote_publication_release.promote_publication_release(newer_manifest)
    promote_publication_release.promote_publication_release(older_manifest, allow_rollback=True)

    release_pointer = json.loads((output_dir / "publication_release_latest.json").read_text(encoding="utf-8"))
    candidate_latest = json.loads(candidate_latest_path.read_text(encoding="utf-8"))
    records = load_release_ledger_records(output_dir / "publication_release_ledger.jsonl")

    assert release_pointer["manifest_path"] == "data/output/publication_handoff_20260406.json"
    assert candidate_latest["manifest_path"] == "data/output/publication_handoff_20260413.json"
    assert len(records) == 2
    assert records[0]["action"] == "promote"
    assert records[1]["action"] == "rollback_promote"
    assert records[1]["manifest_path"] == "data/output/publication_handoff_20260406.json"
    assert records[1]["previous_release_manifest_path"] == "data/output/publication_handoff_20260413.json"
    assert records[1]["previous_release_week"] == "2026-04-13"


def test_promote_release_dry_run_does_not_write_files(monkeypatch, capsys, tmp_path):
    output_dir = tmp_path / "data" / "output"
    manifest_path = _write_manifest(
        output_dir,
        "publication_handoff_20260406.json",
        content_kind="ranking",
        week="2026-04-06",
        generated_at="2026-04-10T06:00:00",
        publish_ready=True,
    )

    output = _run_promote(monkeypatch, capsys, tmp_path, "--manifest", str(manifest_path), "--dry-run", "--verbose")

    assert "[PROMOTE] kind=ranking week=2026-04-06" in output
    assert "[PROMOTE] ledger=data/output/publication_release_ledger.jsonl" in output
    assert not (output_dir / "publication_release_latest.json").exists()
    assert not (output_dir / "publication_release_ledger.jsonl").exists()
