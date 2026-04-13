"""Read-only helpers for current release status and recent approval history."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from src.publication.release_ledger import recent_release_ledger_records, release_ledger_output_path
from src.publication.release_pointer import (
    RELEASEABLE_CONTENT_KINDS,
    load_existing_release_pointer,
)


def _history_record_view(record: dict[str, Any]) -> dict[str, Any]:
    payload = {
        "promoted_at": record["promoted_at"],
        "action": record["action"],
        "content_kind": record["content_kind"],
        "week": record["week"],
        "title": record["title"],
        "slug": record["slug"],
        "manifest_path": record["manifest_path"],
        "artifact_path": record["artifact_path"],
        "markdown_path": record["markdown_path"],
        "publish_ready": record["publish_ready"],
        "source_generated_at": record["source_generated_at"],
        "internal_reference": record["internal_reference"],
    }
    if record.get("compare_mode") is not None:
        payload["compare_mode"] = record["compare_mode"]
    if record.get("previous_release_manifest_path") is not None:
        payload["previous_release_manifest_path"] = record["previous_release_manifest_path"]
    if record.get("previous_release_week") is not None:
        payload["previous_release_week"] = record["previous_release_week"]
    if record.get("stable_markdown_updated") is not None:
        payload["stable_markdown_updated"] = record["stable_markdown_updated"]
    return payload


def _current_release_view(pointer: dict[str, Any] | None) -> dict[str, Any] | None:
    if pointer is None:
        return None
    payload = {
        "content_kind": pointer["content_kind"],
        "week": pointer["week"],
        "title": pointer["title"],
        "slug": pointer["slug"],
        "manifest_path": pointer["manifest_path"],
        "artifact_path": pointer["artifact_path"],
        "markdown_path": pointer["markdown_path"],
        "promoted_at": pointer["promoted_at"],
        "source_generated_at": pointer["source_generated_at"],
        "publish_ready": pointer["publish_ready"],
        "internal_reference": pointer["internal_reference"],
    }
    if pointer.get("compare_mode") is not None:
        payload["compare_mode"] = pointer["compare_mode"]
    return payload


def get_release_status_for_kind(
    *,
    kind: str,
    limit: int = 10,
    output_dir: str | Path | None = None,
) -> dict[str, Any]:
    if kind not in RELEASEABLE_CONTENT_KINDS:
        raise ValueError(f"Unsupported release status kind: {kind!r}")

    current_pointer = load_existing_release_pointer(kind, output_dir=output_dir)
    ledger_path = release_ledger_output_path(output_dir=output_dir)
    history = recent_release_ledger_records(ledger_path, kind=kind, limit=limit)

    warnings: list[str] = []
    if current_pointer is not None and history:
        latest_history = history[0]
        if latest_history["manifest_path"] != current_pointer["manifest_path"]:
            warnings.append(
                "Current release pointer does not match the most recent ledger entry for this kind."
            )
        if kind == "compare" and latest_history.get("compare_mode") is not True:
            warnings.append("Most recent compare ledger entry is missing compare_mode=true.")
    if current_pointer is not None and not history:
        warnings.append("Current release pointer exists but no ledger history was found for this kind.")

    return {
        "kind": kind,
        "current_release": _current_release_view(current_pointer),
        "recent_history": [_history_record_view(record) for record in history],
        "warnings": warnings,
        "ledger_path": str(ledger_path.as_posix()),
    }


def get_release_status(
    *,
    kind: str = "all",
    limit: int = 10,
    output_dir: str | Path | None = None,
) -> dict[str, Any]:
    if kind == "all":
        kinds = list(RELEASEABLE_CONTENT_KINDS)
    else:
        kinds = [kind]

    return {
        "kinds": {
            concrete_kind: get_release_status_for_kind(
                kind=concrete_kind,
                limit=limit,
                output_dir=output_dir,
            )
            for concrete_kind in kinds
        }
    }
