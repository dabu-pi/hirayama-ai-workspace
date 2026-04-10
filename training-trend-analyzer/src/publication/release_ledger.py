"""Append-only release ledger helpers for publication release promotion."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from src.publication.output_paths import normalize_output_dir

RELEASE_LEDGER_SCHEMA_VERSION = "publication-release-ledger/v1"
RELEASE_LEDGER_ACTIONS = ("promote", "rollback_promote")


def release_ledger_output_path(*, output_dir: str | Path | None = None) -> Path:
    return normalize_output_dir(output_dir) / "publication_release_ledger.jsonl"


def build_release_ledger_record(
    *,
    manifest: dict[str, Any],
    manifest_path: str,
    promoted_at: str,
    action: str,
    previous_release_pointer: dict[str, Any] | None = None,
    stable_markdown_updated: bool = False,
) -> dict[str, Any]:
    if action not in RELEASE_LEDGER_ACTIONS:
        raise ValueError(f"Unsupported release ledger action: {action!r}")

    payload = {
        "schema_version": RELEASE_LEDGER_SCHEMA_VERSION,
        "content_kind": manifest["content_kind"],
        "action": action,
        "week": manifest["week"],
        "manifest_path": manifest_path,
        "artifact_path": manifest["artifact_path"],
        "markdown_path": manifest["markdown_path"],
        "slug": manifest["slug"],
        "title": manifest["title"],
        "summary": manifest["summary"],
        "publish_ready": manifest["publish_ready"],
        "promoted_at": promoted_at,
        "source_generated_at": manifest["generated_at"],
        "internal_reference": manifest["internal_reference"],
    }
    if manifest.get("compare_mode") is not None:
        payload["compare_mode"] = manifest["compare_mode"]
    if previous_release_pointer is not None:
        payload["previous_release_manifest_path"] = previous_release_pointer["manifest_path"]
        payload["previous_release_week"] = previous_release_pointer["week"]
    if stable_markdown_updated:
        payload["stable_markdown_updated"] = True
    return payload


def append_release_ledger_record(record: dict[str, Any], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "a", encoding="utf-8") as handle:
        handle.write(json.dumps(record, ensure_ascii=False))
        handle.write("\n")


def load_release_ledger_records(path: str | Path) -> list[dict[str, Any]]:
    path = Path(path)
    if not path.exists():
        return []
    records: list[dict[str, Any]] = []
    with open(path, encoding="utf-8") as handle:
        for line in handle:
            stripped = line.strip()
            if not stripped:
                continue
            records.append(json.loads(stripped))
    return records
