"""Append-only release ledger helpers for publication release promotion."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any

from src.publication.output_paths import normalize_output_dir

RELEASE_LEDGER_SCHEMA_VERSION = "publication-release-ledger/v1"
RELEASE_LEDGER_ACTIONS = ("promote", "rollback_promote")
RELEASE_LEDGER_CONTENT_KINDS = ("ranking", "compare")


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


def _require_record_field(payload: dict[str, Any], key: str) -> Any:
    if key not in payload:
        raise ValueError(f"Missing required release ledger key: {key}")
    return payload[key]


def _parse_promoted_at_key(promoted_at: str) -> tuple[int, int, int, int, int, int]:
    try:
        normalized = promoted_at.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(normalized)
    except ValueError as exc:
        raise ValueError(f"Invalid release ledger promoted_at: {promoted_at!r}") from exc
    return (
        parsed.year,
        parsed.month,
        parsed.day,
        parsed.hour,
        parsed.minute,
        parsed.second,
    )


def validate_release_ledger_record(payload: dict[str, Any], *, expected_kind: str | None = None) -> dict[str, Any]:
    schema_version = _require_record_field(payload, "schema_version")
    if schema_version != RELEASE_LEDGER_SCHEMA_VERSION:
        raise ValueError(
            f"Unsupported release ledger schema_version: {schema_version!r}. "
            f"Supported schema_version(s): {RELEASE_LEDGER_SCHEMA_VERSION}"
        )

    content_kind = _require_record_field(payload, "content_kind")
    if content_kind not in RELEASE_LEDGER_CONTENT_KINDS:
        raise ValueError(f"Unsupported release ledger content_kind: {content_kind!r}")
    if expected_kind is not None and content_kind != expected_kind:
        raise ValueError(
            f"Release ledger content_kind mismatch: expected {expected_kind!r}, got {content_kind!r}"
        )

    action = _require_record_field(payload, "action")
    if action not in RELEASE_LEDGER_ACTIONS:
        raise ValueError(f"Unsupported release ledger action: {action!r}")

    publish_ready = _require_record_field(payload, "publish_ready")
    if publish_ready is not True:
        raise ValueError("Release ledger publish_ready must be true")

    _require_record_field(payload, "week")
    _require_record_field(payload, "manifest_path")
    _require_record_field(payload, "artifact_path")
    _require_record_field(payload, "markdown_path")
    _require_record_field(payload, "slug")
    _require_record_field(payload, "title")
    _require_record_field(payload, "summary")
    _require_record_field(payload, "promoted_at")
    _require_record_field(payload, "source_generated_at")
    _require_record_field(payload, "internal_reference")

    if content_kind == "compare" and payload.get("compare_mode") is not True:
        raise ValueError("Compare release ledger record must include compare_mode=true")

    _parse_promoted_at_key(payload["promoted_at"])
    return payload


def load_release_ledger_records(
    path: str | Path,
    *,
    expected_kind: str | None = None,
    validate: bool = False,
) -> list[dict[str, Any]]:
    path = Path(path)
    if not path.exists():
        return []
    records: list[dict[str, Any]] = []
    with open(path, encoding="utf-8") as handle:
        for line in handle:
            stripped = line.strip()
            if not stripped:
                continue
            payload = json.loads(stripped)
            if validate:
                payload = validate_release_ledger_record(payload, expected_kind=expected_kind)
            records.append(payload)
    return records


def release_ledger_sort_key(record: dict[str, Any]) -> tuple[tuple[int, int, int, int, int, int], str, str]:
    return (
        _parse_promoted_at_key(record["promoted_at"]),
        record["manifest_path"],
        record["slug"],
    )


def recent_release_ledger_records(
    path: str | Path,
    *,
    kind: str | None = None,
    limit: int | None = None,
) -> list[dict[str, Any]]:
    records = load_release_ledger_records(path, validate=True)
    if kind is not None:
        records = [record for record in records if record["content_kind"] == kind]
    records = sorted(records, key=release_ledger_sort_key, reverse=True)
    if limit is not None:
        return records[:limit]
    return records
