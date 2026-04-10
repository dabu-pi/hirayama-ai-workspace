"""Tests for publication release verify / repair CLI."""

from __future__ import annotations

import io
import json
import sys
from pathlib import Path

import pytest

if sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts import verify_publication_release_state
from src.publication.release_ledger import load_release_ledger_records


def _write_manifest(
    output_dir: Path,
    *,
    kind: str,
    week: str,
    generated_at: str = "2026-04-10T08:00:00",
    publish_ready: bool = True,
    schema_version: str = "publication-handoff/v1",
) -> Path:
    prefix = "publication_handoff_compare_" if kind == "compare" else "publication_handoff_"
    slug_prefix = "compare" if kind == "compare" else "ranking"
    payload = {
        "schema_version": schema_version,
        "artifact_schema_version": "publish-ready/v1",
        "content_kind": kind,
        "week": week,
        "generated_at": generated_at,
        "publish_ready": publish_ready,
        "artifact_path": f"data/output/publish_ready{'_compare' if kind == 'compare' else ''}_{week.replace('-', '')}.json",
        "markdown_path": f"data/output/publish_ready{'_compare' if kind == 'compare' else ''}_{week.replace('-', '')}.md",
        "slug": f"{slug_prefix}-{week}",
        "title": f"{kind} title {week}",
        "summary": "summary",
        "internal_reference": {"collector_source": "db"},
    }
    if kind == "compare":
        payload["compare_mode"] = True
    path = output_dir / f"{prefix}{week.replace('-', '')}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    artifact_path = output_dir.parent.parent / payload["artifact_path"]
    artifact_path.parent.mkdir(parents=True, exist_ok=True)
    artifact_path.write_text("{}", encoding="utf-8")

    markdown_path = output_dir.parent.parent / payload["markdown_path"]
    markdown_path.parent.mkdir(parents=True, exist_ok=True)
    markdown_path.write_text(f"# {payload['title']}\n", encoding="utf-8")
    return path


def _write_pointer(
    output_dir: Path,
    *,
    kind: str,
    manifest_path: str,
    week: str,
    title: str,
    slug: str,
    markdown_path: str,
    artifact_path: str,
    promoted_at: str = "2026-04-11T09:00:00",
    source_generated_at: str = "2026-04-10T08:00:00",
    schema_version: str = "publication-release-pointer/v1",
) -> Path:
    filename = "publication_release_compare_latest.json" if kind == "compare" else "publication_release_latest.json"
    payload = {
        "schema_version": schema_version,
        "content_kind": kind,
        "week": week,
        "publish_ready": True,
        "manifest_path": manifest_path,
        "artifact_path": artifact_path,
        "markdown_path": markdown_path,
        "title": title,
        "slug": slug,
        "summary": "summary",
        "promoted_at": promoted_at,
        "source_generated_at": source_generated_at,
        "internal_reference": {"collector_source": "db"},
    }
    if kind == "compare":
        payload["compare_mode"] = True
    path = output_dir / filename
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return path


def _append_ledger(
    output_dir: Path,
    *,
    kind: str,
    manifest_path: str,
    markdown_path: str,
    artifact_path: str,
    week: str,
    title: str,
    slug: str,
    action: str = "promote",
    promoted_at: str = "2026-04-11T09:00:00",
    source_generated_at: str = "2026-04-10T08:00:00",
    schema_version: str = "publication-release-ledger/v1",
    extra: dict | None = None,
) -> None:
    payload = {
        "schema_version": schema_version,
        "content_kind": kind,
        "action": action,
        "week": week,
        "manifest_path": manifest_path,
        "artifact_path": artifact_path,
        "markdown_path": markdown_path,
        "slug": slug,
        "title": title,
        "summary": "summary",
        "publish_ready": True,
        "promoted_at": promoted_at,
        "source_generated_at": source_generated_at,
        "internal_reference": {"collector_source": "db"},
    }
    if kind == "compare":
        payload["compare_mode"] = True
    if extra:
        payload.update(extra)
    ledger_path = output_dir / "publication_release_ledger.jsonl"
    ledger_path.parent.mkdir(parents=True, exist_ok=True)
    with open(ledger_path, "a", encoding="utf-8") as handle:
        handle.write(json.dumps(payload, ensure_ascii=False))
        handle.write("\n")


def _stable_markdown_path(output_dir: Path, kind: str) -> Path:
    return output_dir / ("publication_release_compare_latest.md" if kind == "compare" else "publication_release_latest.md")


def _run_cli(monkeypatch, capsys, tmp_path: Path, *args: str) -> str:
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(sys, "argv", ["verify_publication_release_state.py", *args])
    verify_publication_release_state.main()
    return capsys.readouterr().out


def _seed_release_state(tmp_path: Path, *, kind: str = "ranking") -> tuple[Path, Path, Path, Path]:
    output_dir = tmp_path / "data" / "output"
    manifest_path = _write_manifest(output_dir, kind=kind, week="2026-04-06")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    _write_pointer(
        output_dir,
        kind=kind,
        manifest_path=manifest_path.relative_to(tmp_path).as_posix(),
        week=manifest["week"],
        title=manifest["title"],
        slug=manifest["slug"],
        markdown_path=manifest["markdown_path"],
        artifact_path=manifest["artifact_path"],
        source_generated_at=manifest["generated_at"],
    )
    _append_ledger(
        output_dir,
        kind=kind,
        manifest_path=manifest_path.relative_to(tmp_path).as_posix(),
        markdown_path=manifest["markdown_path"],
        artifact_path=manifest["artifact_path"],
        week=manifest["week"],
        title=manifest["title"],
        slug=manifest["slug"],
        source_generated_at=manifest["generated_at"],
    )
    source_markdown = tmp_path / manifest["markdown_path"]
    stable_markdown = _stable_markdown_path(output_dir, kind)
    stable_markdown.write_text(source_markdown.read_text(encoding="utf-8"), encoding="utf-8")
    return output_dir, manifest_path, source_markdown, stable_markdown


def test_verify_release_state_succeeds_for_ranking(monkeypatch, capsys, tmp_path):
    _seed_release_state(tmp_path, kind="ranking")

    output = _run_cli(monkeypatch, capsys, tmp_path, "--kind", "ranking")

    assert "overall_status: OK" in output
    assert "== ranking Release Verify ==" in output
    assert "issues: none" in output


def test_verify_release_state_succeeds_for_compare(monkeypatch, capsys, tmp_path):
    _seed_release_state(tmp_path, kind="compare")

    output = _run_cli(monkeypatch, capsys, tmp_path, "--kind", "compare")

    assert "overall_status: OK" in output
    assert "== compare Release Verify ==" in output
    assert "issues: none" in output


def test_verify_detects_pointer_ledger_mismatch(monkeypatch, capsys, tmp_path):
    output_dir, manifest_path, _source_markdown, stable_markdown = _seed_release_state(tmp_path, kind="ranking")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    _append_ledger(
        output_dir,
        kind="ranking",
        manifest_path="data/output/publication_handoff_20260413.json",
        markdown_path="data/output/publish_ready_20260413.md",
        artifact_path="data/output/publish_ready_20260413.json",
        week="2026-04-13",
        title="ranking title 2026-04-13",
        slug="ranking-2026-04-13",
        promoted_at="2026-04-11T09:05:00",
        source_generated_at="2026-04-10T08:05:00",
    )
    stable_markdown.write_text((tmp_path / manifest["markdown_path"]).read_text(encoding="utf-8"), encoding="utf-8")

    output = _run_cli(monkeypatch, capsys, tmp_path, "--kind", "ranking")

    assert "overall_status: ERROR" in output
    assert "pointer_ledger_manifest_mismatch" in output


def test_verify_detects_manifest_path_missing(monkeypatch, capsys, tmp_path):
    output_dir, manifest_path, source_markdown, stable_markdown = _seed_release_state(tmp_path, kind="ranking")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest_path.unlink()
    stable_markdown.write_text(source_markdown.read_text(encoding="utf-8"), encoding="utf-8")

    output = _run_cli(monkeypatch, capsys, tmp_path, "--kind", "ranking")
    assert "manifest_missing" in output
    assert "overall_status: ERROR" in output


def test_verify_detects_markdown_path_missing(monkeypatch, capsys, tmp_path):
    _output_dir, manifest_path, source_markdown, _stable_markdown = _seed_release_state(tmp_path, kind="ranking")
    source_markdown.unlink()

    output = _run_cli(monkeypatch, capsys, tmp_path, "--kind", "ranking")
    assert "markdown_missing" in output
    assert "overall_status: ERROR" in output


def test_verify_detects_stable_markdown_mismatch(monkeypatch, capsys, tmp_path):
    _output_dir, _manifest_path, _source_markdown, stable_markdown = _seed_release_state(tmp_path, kind="ranking")
    stable_markdown.write_text("# changed\n", encoding="utf-8")

    output = _run_cli(monkeypatch, capsys, tmp_path, "--kind", "ranking")
    assert "stable_markdown_mismatch" in output
    assert "overall_status: ERROR" in output


def test_verify_json_output(monkeypatch, capsys, tmp_path):
    _seed_release_state(tmp_path, kind="ranking")

    output = _run_cli(monkeypatch, capsys, tmp_path, "--kind", "ranking", "--json")
    payload = json.loads(output)

    assert payload["verify"]["status"] == "OK"
    assert payload["verify"]["kinds"]["ranking"]["status"] == "OK"
    assert payload["verify"]["kinds"]["ranking"]["current_release"]["week"] == "2026-04-06"


def test_repair_rebuilds_pointer_and_stable_markdown(monkeypatch, capsys, tmp_path):
    output_dir, manifest_path, source_markdown, stable_markdown = _seed_release_state(tmp_path, kind="ranking")
    pointer_path = output_dir / "publication_release_latest.json"
    pointer_path.unlink()
    stable_markdown.unlink()
    ledger_before = len(load_release_ledger_records(output_dir / "publication_release_ledger.jsonl"))

    output = _run_cli(monkeypatch, capsys, tmp_path, "--kind", "ranking", "--repair")

    assert "== ranking Release Repair ==" in output
    assert pointer_path.exists()
    assert stable_markdown.exists()
    assert stable_markdown.read_text(encoding="utf-8") == source_markdown.read_text(encoding="utf-8")
    assert len(load_release_ledger_records(output_dir / "publication_release_ledger.jsonl")) == ledger_before


def test_repair_dry_run_does_not_write(monkeypatch, capsys, tmp_path):
    output_dir, _manifest_path, _source_markdown, stable_markdown = _seed_release_state(tmp_path, kind="ranking")
    pointer_path = output_dir / "publication_release_latest.json"
    pointer_path.unlink()
    stable_markdown.unlink()
    ledger_before = (output_dir / "publication_release_ledger.jsonl").read_text(encoding="utf-8")

    output = _run_cli(monkeypatch, capsys, tmp_path, "--kind", "ranking", "--repair", "--dry-run")

    assert "dry_run: True" in output
    assert not pointer_path.exists()
    assert not stable_markdown.exists()
    assert (output_dir / "publication_release_ledger.jsonl").read_text(encoding="utf-8") == ledger_before


def test_repair_does_not_release_not_ready_manifest(monkeypatch, tmp_path):
    output_dir = tmp_path / "data" / "output"
    manifest_path = _write_manifest(output_dir, kind="ranking", week="2026-04-06", publish_ready=False)
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    _append_ledger(
        output_dir,
        kind="ranking",
        manifest_path=manifest_path.relative_to(tmp_path).as_posix(),
        markdown_path=manifest["markdown_path"],
        artifact_path=manifest["artifact_path"],
        week=manifest["week"],
        title=manifest["title"],
        slug=manifest["slug"],
        source_generated_at=manifest["generated_at"],
    )

    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(sys, "argv", ["verify_publication_release_state.py", "--kind", "ranking", "--repair"])
    with pytest.raises(ValueError, match="must have publish_ready=true"):
        verify_publication_release_state.main()


def test_verify_fails_for_invalid_pointer_schema(monkeypatch, tmp_path):
    output_dir, manifest_path, _source_markdown, stable_markdown = _seed_release_state(tmp_path, kind="ranking")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    _write_pointer(
        output_dir,
        kind="ranking",
        manifest_path=manifest_path.relative_to(tmp_path).as_posix(),
        week=manifest["week"],
        title=manifest["title"],
        slug=manifest["slug"],
        markdown_path=manifest["markdown_path"],
        artifact_path=manifest["artifact_path"],
        source_generated_at=manifest["generated_at"],
        schema_version="publication-release-pointer/v2",
    )
    stable_markdown.write_text((tmp_path / manifest["markdown_path"]).read_text(encoding="utf-8"), encoding="utf-8")

    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(sys, "argv", ["verify_publication_release_state.py", "--kind", "ranking"])
    with pytest.raises(ValueError, match="Unsupported release pointer schema_version"):
        verify_publication_release_state.main()
