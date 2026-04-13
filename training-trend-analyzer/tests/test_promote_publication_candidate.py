"""Tests for latest-candidate promotion CLI."""

from __future__ import annotations

import io
import json
import sys
from pathlib import Path

import pytest

if sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts import promote_publication_candidate
from src.publication.candidate_promotion import check_promotion_eligibility
from src.publication.release_ledger import load_release_ledger_records


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
    schema_version: str = "publication-handoff/v1",
    extra: dict | None = None,
) -> Path:
    week_token = week.replace("-", "")
    if content_kind == "compare":
        filename = f"publication_handoff_compare_{week_token}.json"
        artifact = f"data/output/publish_ready_compare_{week_token}.json"
        markdown = f"data/output/publish_ready_compare_{week_token}.md"
    elif content_kind == "publish_hold":
        filename = f"publication_handoff_hold_{week_token}.json"
        artifact = f"data/output/publish_ready_hold_{week_token}.json"
        markdown = f"data/output/publish_ready_hold_{week_token}.md"
    else:
        filename = f"publication_handoff_{week_token}.json"
        artifact = f"data/output/publish_ready_{week_token}.json"
        markdown = f"data/output/publish_ready_{week_token}.md"

    payload: dict = {
        "schema_version": schema_version,
        "artifact_schema_version": "publish-ready/v1",
        "content_kind": content_kind,
        "week": week,
        "generated_at": generated_at,
        "publish_ready": publish_ready,
        "artifact_path": artifact,
        "markdown_path": markdown,
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

    # Also create the markdown source file (required for --copy-markdown)
    md_path = output_dir.parent.parent / markdown
    md_path.parent.mkdir(parents=True, exist_ok=True)
    md_path.write_text(f"# Trend Update: {week}\n", encoding="utf-8")

    return path


def _write_candidate_pointer(
    output_dir: Path,
    *,
    content_kind: str,
    week: str,
    manifest_path: str,
    publish_ready: bool = True,
) -> Path:
    if content_kind == "compare":
        filename = "publication_handoff_compare_latest.json"
    else:
        filename = "publication_handoff_latest.json"

    payload = {
        "schema_version": "publication-handoff-pointer/v1",
        "content_kind": content_kind,
        "week": week,
        "publish_ready": publish_ready,
        "manifest_path": manifest_path,
        "updated_at": "2026-04-10T09:00:00",
    }
    path = output_dir / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return path


def _write_release_pointer(
    output_dir: Path,
    *,
    content_kind: str,
    week: str,
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
        "promoted_at": "2026-04-09T10:00:00",
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


def _run_cli(monkeypatch, capsys, tmp_path: Path, *args: str) -> tuple[str, str]:
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(sys, "argv", ["promote_publication_candidate.py", *args])
    promote_publication_candidate.main()
    captured = capsys.readouterr()
    return captured.out, captured.err


def _setup_ranking_candidate(tmp_path: Path, *, candidate_week: str, candidate_generated_at: str) -> Path:
    output_dir = tmp_path / "data" / "output"
    manifest = _write_dated_manifest(
        output_dir,
        content_kind="ranking",
        week=candidate_week,
        generated_at=candidate_generated_at,
    )
    _write_candidate_pointer(
        output_dir,
        content_kind="ranking",
        week=candidate_week,
        manifest_path=str(manifest.relative_to(tmp_path)),
    )
    return output_dir


# ---------------------------------------------------------------------------
# Tests: default-promotable cases
# ---------------------------------------------------------------------------


def test_promote_ranking_no_release(monkeypatch, capsys, tmp_path):
    """no_release → promote without any override flag."""
    output_dir = _setup_ranking_candidate(
        tmp_path, candidate_week="2026-04-13", candidate_generated_at="2026-04-12T08:00:00"
    )

    out, err = _run_cli(monkeypatch, capsys, tmp_path, "--kind", "ranking")

    pointer_path = output_dir / "publication_release_latest.json"
    ledger_path = output_dir / "publication_release_ledger.jsonl"
    pointer = json.loads(pointer_path.read_text(encoding="utf-8"))
    records = load_release_ledger_records(ledger_path)

    assert pointer["week"] == "2026-04-13"
    assert pointer["content_kind"] == "ranking"
    assert len(records) == 1
    assert records[0]["action"] == "promote"
    assert "no_release" in out
    assert "[RELEASE]" in out


def test_promote_ranking_candidate_newer(monkeypatch, capsys, tmp_path):
    """candidate_newer_than_release → promote without any override flag."""
    output_dir = tmp_path / "data" / "output"
    manifest = _write_dated_manifest(
        output_dir, content_kind="ranking", week="2026-04-13", generated_at="2026-04-12T08:00:00"
    )
    _write_candidate_pointer(
        output_dir,
        content_kind="ranking",
        week="2026-04-13",
        manifest_path=str(manifest.relative_to(tmp_path)),
    )
    _write_release_pointer(
        output_dir, content_kind="ranking", week="2026-04-06", source_generated_at="2026-04-05T08:00:00"
    )

    out, err = _run_cli(monkeypatch, capsys, tmp_path, "--kind", "ranking")

    pointer = json.loads((output_dir / "publication_release_latest.json").read_text(encoding="utf-8"))
    records = load_release_ledger_records(output_dir / "publication_release_ledger.jsonl")

    assert pointer["week"] == "2026-04-13"
    assert records[0]["action"] == "promote"
    assert "candidate_newer_than_release" in out
    assert "[RELEASE]" in out


def test_promote_compare_candidate_newer(monkeypatch, capsys, tmp_path):
    """compare candidate_newer_than_release → promote."""
    output_dir = tmp_path / "data" / "output"
    manifest = _write_dated_manifest(
        output_dir, content_kind="compare", week="2026-04-13", generated_at="2026-04-12T08:00:00"
    )
    _write_candidate_pointer(
        output_dir,
        content_kind="compare",
        week="2026-04-13",
        manifest_path=str(manifest.relative_to(tmp_path)),
    )
    _write_release_pointer(
        output_dir, content_kind="compare", week="2026-04-06", source_generated_at="2026-04-05T08:00:00"
    )

    out, err = _run_cli(monkeypatch, capsys, tmp_path, "--kind", "compare")

    pointer = json.loads((output_dir / "publication_release_compare_latest.json").read_text(encoding="utf-8"))
    assert pointer["content_kind"] == "compare"
    assert pointer["week"] == "2026-04-13"
    assert pointer["compare_mode"] is True


# ---------------------------------------------------------------------------
# Tests: always-rejected cases
# ---------------------------------------------------------------------------


def test_reject_same_manifest(monkeypatch, capsys, tmp_path):
    """same_manifest → always rejected."""
    output_dir = tmp_path / "data" / "output"
    manifest = _write_dated_manifest(
        output_dir, content_kind="ranking", week="2026-04-06", generated_at="2026-04-05T08:00:00"
    )
    rel_path = str(manifest.relative_to(tmp_path))
    _write_candidate_pointer(
        output_dir, content_kind="ranking", week="2026-04-06", manifest_path=rel_path
    )
    _write_release_pointer(
        output_dir,
        content_kind="ranking",
        week="2026-04-06",
        manifest_path=rel_path,
        source_generated_at="2026-04-05T08:00:00",
    )

    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(sys, "argv", ["promote_publication_candidate.py", "--kind", "ranking"])
    with pytest.raises(SystemExit) as exc_info:
        promote_publication_candidate.main()
    assert exc_info.value.code == 1

    assert not (output_dir / "publication_release_ledger.jsonl").exists() or \
        len(load_release_ledger_records(output_dir / "publication_release_ledger.jsonl")) == 0


def test_reject_candidate_not_publish_ready(monkeypatch, capsys, tmp_path):
    """candidate_not_publish_ready → always rejected."""
    output_dir = tmp_path / "data" / "output"
    manifest = _write_dated_manifest(
        output_dir,
        content_kind="publish_hold",
        week="2026-04-13",
        publish_ready=False,
        hold_reason="no data",
    )
    _write_candidate_pointer(
        output_dir,
        content_kind="ranking",
        week="2026-04-13",
        manifest_path=str(manifest.relative_to(tmp_path)),
        publish_ready=False,
    )
    _write_release_pointer(output_dir, content_kind="ranking", week="2026-04-06")

    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(sys, "argv", ["promote_publication_candidate.py", "--kind", "ranking"])
    with pytest.raises(SystemExit) as exc_info:
        promote_publication_candidate.main()
    assert exc_info.value.code == 1


def test_reject_no_candidate(monkeypatch, capsys, tmp_path):
    """no_candidate → always rejected."""
    output_dir = tmp_path / "data" / "output"
    _write_release_pointer(output_dir, content_kind="ranking", week="2026-04-06")
    # No candidate pointer

    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(sys, "argv", ["promote_publication_candidate.py", "--kind", "ranking"])
    with pytest.raises(SystemExit) as exc_info:
        promote_publication_candidate.main()
    assert exc_info.value.code == 1


# ---------------------------------------------------------------------------
# Tests: conditional cases
# ---------------------------------------------------------------------------


def test_reject_candidate_differs_same_week_without_flag(monkeypatch, capsys, tmp_path):
    """candidate_differs_same_week without --allow-same-week → rejected."""
    output_dir = tmp_path / "data" / "output"
    # Candidate generated_at > release source_generated_at, same week
    manifest = _write_dated_manifest(
        output_dir, content_kind="ranking", week="2026-04-06", generated_at="2026-04-08T12:00:00"
    )
    _write_candidate_pointer(
        output_dir,
        content_kind="ranking",
        week="2026-04-06",
        manifest_path=str(manifest.relative_to(tmp_path)),
    )
    _write_release_pointer(
        output_dir,
        content_kind="ranking",
        week="2026-04-06",
        manifest_path="data/output/publication_handoff_OLD.json",
        source_generated_at="2026-04-06T08:00:00",
    )

    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(sys, "argv", ["promote_publication_candidate.py", "--kind", "ranking"])
    with pytest.raises(SystemExit) as exc_info:
        promote_publication_candidate.main()
    assert exc_info.value.code == 1


def test_allow_candidate_differs_same_week_with_flag(monkeypatch, capsys, tmp_path):
    """candidate_differs_same_week with --allow-same-week → promoted."""
    output_dir = tmp_path / "data" / "output"
    manifest = _write_dated_manifest(
        output_dir, content_kind="ranking", week="2026-04-06", generated_at="2026-04-08T12:00:00"
    )
    _write_candidate_pointer(
        output_dir,
        content_kind="ranking",
        week="2026-04-06",
        manifest_path=str(manifest.relative_to(tmp_path)),
    )
    _write_release_pointer(
        output_dir,
        content_kind="ranking",
        week="2026-04-06",
        manifest_path="data/output/publication_handoff_OLD.json",
        source_generated_at="2026-04-06T08:00:00",
    )

    out, err = _run_cli(
        monkeypatch, capsys, tmp_path, "--kind", "ranking", "--allow-same-week"
    )

    pointer = json.loads((output_dir / "publication_release_latest.json").read_text(encoding="utf-8"))
    assert pointer["week"] == "2026-04-06"
    assert "[RELEASE]" in out


def test_reject_candidate_older_without_rollback(monkeypatch, capsys, tmp_path):
    """candidate_older_than_release without --allow-rollback → rejected."""
    output_dir = tmp_path / "data" / "output"
    manifest = _write_dated_manifest(
        output_dir, content_kind="ranking", week="2026-03-30", generated_at="2026-03-29T08:00:00"
    )
    _write_candidate_pointer(
        output_dir,
        content_kind="ranking",
        week="2026-03-30",
        manifest_path=str(manifest.relative_to(tmp_path)),
    )
    _write_release_pointer(
        output_dir, content_kind="ranking", week="2026-04-06", source_generated_at="2026-04-05T08:00:00"
    )

    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(sys, "argv", ["promote_publication_candidate.py", "--kind", "ranking"])
    with pytest.raises(SystemExit) as exc_info:
        promote_publication_candidate.main()
    assert exc_info.value.code == 1


def test_allow_candidate_older_with_rollback(monkeypatch, capsys, tmp_path):
    """candidate_older_than_release with --allow-rollback → rollback_promote."""
    output_dir = tmp_path / "data" / "output"
    manifest = _write_dated_manifest(
        output_dir, content_kind="ranking", week="2026-03-30", generated_at="2026-03-29T08:00:00"
    )
    _write_candidate_pointer(
        output_dir,
        content_kind="ranking",
        week="2026-03-30",
        manifest_path=str(manifest.relative_to(tmp_path)),
    )
    _write_release_pointer(
        output_dir, content_kind="ranking", week="2026-04-06", source_generated_at="2026-04-05T08:00:00"
    )

    out, err = _run_cli(
        monkeypatch, capsys, tmp_path, "--kind", "ranking", "--allow-rollback"
    )

    records = load_release_ledger_records(output_dir / "publication_release_ledger.jsonl")
    assert len(records) == 1
    assert records[0]["action"] == "rollback_promote"
    assert "[RELEASE]" in out


# ---------------------------------------------------------------------------
# Tests: dry-run
# ---------------------------------------------------------------------------


def test_dry_run_does_not_write_files(monkeypatch, capsys, tmp_path):
    output_dir = _setup_ranking_candidate(
        tmp_path, candidate_week="2026-04-13", candidate_generated_at="2026-04-12T08:00:00"
    )

    out, err = _run_cli(monkeypatch, capsys, tmp_path, "--kind", "ranking", "--dry-run")

    assert not (output_dir / "publication_release_latest.json").exists()
    assert not (output_dir / "publication_release_ledger.jsonl").exists()
    assert "[DRY-RUN] no files written" in out
    assert "[PROMOTE]" in out  # promote_from_manifest_path prints [PROMOTE] in dry-run mode


# ---------------------------------------------------------------------------
# Tests: --json output
# ---------------------------------------------------------------------------


def test_json_success_output(monkeypatch, capsys, tmp_path):
    output_dir = _setup_ranking_candidate(
        tmp_path, candidate_week="2026-04-13", candidate_generated_at="2026-04-12T08:00:00"
    )

    out, err = _run_cli(monkeypatch, capsys, tmp_path, "--kind", "ranking", "--json")
    payload = json.loads(out)

    assert payload["kind"] == "ranking"
    assert payload["review_status"] == "no_release"
    assert payload["promotable"] is True
    assert payload["action"] == "promote"
    assert "release_pointer_path" in payload
    assert "ledger_path" in payload
    assert payload["dry_run"] is False


def test_json_dry_run_output(monkeypatch, capsys, tmp_path):
    output_dir = _setup_ranking_candidate(
        tmp_path, candidate_week="2026-04-13", candidate_generated_at="2026-04-12T08:00:00"
    )

    out, err = _run_cli(monkeypatch, capsys, tmp_path, "--kind", "ranking", "--json", "--dry-run")
    payload = json.loads(out)

    assert payload["dry_run"] is True
    assert payload["action"] == "promote"
    assert not (output_dir / "publication_release_latest.json").exists()


def test_json_rejection_output(monkeypatch, capsys, tmp_path):
    """Rejection is emitted to stdout as JSON (for scripted workflows)."""
    output_dir = tmp_path / "data" / "output"
    _write_release_pointer(output_dir, content_kind="ranking", week="2026-04-06")
    # No candidate pointer

    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(
        sys, "argv", ["promote_publication_candidate.py", "--kind", "ranking", "--json"]
    )
    with pytest.raises(SystemExit) as exc_info:
        promote_publication_candidate.main()

    assert exc_info.value.code == 1
    out = capsys.readouterr().out
    payload = json.loads(out)
    assert payload["promotable"] is False
    assert payload["action"] == "no_action"
    assert "reject_reason" in payload


# ---------------------------------------------------------------------------
# Tests: --copy-markdown
# ---------------------------------------------------------------------------


def test_copy_markdown_creates_stable_file(monkeypatch, capsys, tmp_path):
    output_dir = _setup_ranking_candidate(
        tmp_path, candidate_week="2026-04-13", candidate_generated_at="2026-04-12T08:00:00"
    )

    out, err = _run_cli(monkeypatch, capsys, tmp_path, "--kind", "ranking", "--copy-markdown")

    stable_md = output_dir / "publication_release_latest.md"
    assert stable_md.exists()
    assert "[RELEASE-MARKDOWN]" in out
    records = load_release_ledger_records(output_dir / "publication_release_ledger.jsonl")
    assert records[0]["stable_markdown_updated"] is True


# ---------------------------------------------------------------------------
# Tests: schema validation failure
# ---------------------------------------------------------------------------


def test_invalid_manifest_schema_fails(monkeypatch, capsys, tmp_path):
    output_dir = tmp_path / "data" / "output"
    manifest = _write_dated_manifest(
        output_dir,
        content_kind="ranking",
        week="2026-04-13",
        schema_version="publication-handoff/v2",  # invalid
    )
    _write_candidate_pointer(
        output_dir,
        content_kind="ranking",
        week="2026-04-13",
        manifest_path=str(manifest.relative_to(tmp_path)),
    )

    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(sys, "argv", ["promote_publication_candidate.py", "--kind", "ranking"])
    with pytest.raises((ValueError, SystemExit)):
        promote_publication_candidate.main()

    assert not (output_dir / "publication_release_ledger.jsonl").exists()


# ---------------------------------------------------------------------------
# Unit tests: check_promotion_eligibility
# ---------------------------------------------------------------------------


def test_eligibility_no_release_promotable():
    review = {"status": "no_release", "promotable": True, "notes": []}
    ok, reason = check_promotion_eligibility(review)
    assert ok is True
    assert reason == ""


def test_eligibility_same_manifest_rejected():
    review = {"status": "same_manifest", "promotable": False, "notes": []}
    ok, reason = check_promotion_eligibility(review)
    assert ok is False
    assert "same manifest" in reason.lower()


def test_eligibility_differs_same_week_requires_flag():
    review = {"status": "candidate_differs_same_week", "promotable": True, "notes": []}
    ok, reason = check_promotion_eligibility(review, allow_same_week=False)
    assert ok is False
    assert "--allow-same-week" in reason

    ok2, _ = check_promotion_eligibility(review, allow_same_week=True)
    assert ok2 is True


def test_eligibility_candidate_older_requires_rollback():
    review = {"status": "candidate_older_than_release", "promotable": False, "notes": []}
    ok, reason = check_promotion_eligibility(review, allow_rollback=False)
    assert ok is False
    assert "--allow-rollback" in reason

    ok2, _ = check_promotion_eligibility(review, allow_rollback=True)
    assert ok2 is True
