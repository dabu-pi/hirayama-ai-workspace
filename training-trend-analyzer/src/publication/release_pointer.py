"""Helpers for manual promotion from candidate handoff manifests to release pointers."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any

from src.publication.handoff_manifest import (
    handoff_manifest_recency_key,
    load_validated_handoff_manifest,
    validate_handoff_manifest,
)
from src.publication.output_paths import (
    publication_release_markdown_output_path,
    publication_release_pointer_output_path,
)

RELEASE_POINTER_SCHEMA_VERSION = "publication-release-pointer/v1"
RELEASEABLE_CONTENT_KINDS = ("ranking", "compare")


def _require_pointer_field(payload: dict[str, Any], key: str) -> Any:
    if key not in payload:
        raise ValueError(f"Missing required release pointer key: {key}")
    return payload[key]


def validate_release_target_manifest(payload: dict[str, Any]) -> dict[str, Any]:
    validated = validate_handoff_manifest(payload)
    content_kind = validated["content_kind"]
    if content_kind not in RELEASEABLE_CONTENT_KINDS:
        raise ValueError(
            "Release promotion supports only content_kind in {'ranking', 'compare'}; "
            f"got {content_kind!r}"
        )
    if validated["publish_ready"] is not True:
        raise ValueError("Release promotion requires publish_ready=true")
    return validated


def load_validated_release_target_manifest(path: str | Path) -> dict[str, Any]:
    return validate_release_target_manifest(load_validated_handoff_manifest(path))


def validate_release_pointer(payload: dict[str, Any], *, expected_kind: str | None = None) -> dict[str, Any]:
    schema_version = _require_pointer_field(payload, "schema_version")
    if schema_version != RELEASE_POINTER_SCHEMA_VERSION:
        raise ValueError(
            f"Unsupported release pointer schema_version: {schema_version!r}. "
            f"Supported schema_version(s): {RELEASE_POINTER_SCHEMA_VERSION}"
        )

    content_kind = _require_pointer_field(payload, "content_kind")
    if content_kind not in RELEASEABLE_CONTENT_KINDS:
        raise ValueError(f"Unsupported release pointer content_kind: {content_kind!r}")
    if expected_kind is not None and content_kind != expected_kind:
        raise ValueError(
            f"Release pointer content_kind mismatch: expected {expected_kind!r}, got {content_kind!r}"
        )

    publish_ready = _require_pointer_field(payload, "publish_ready")
    if publish_ready is not True:
        raise ValueError("Release pointer publish_ready must be true")

    _require_pointer_field(payload, "week")
    _require_pointer_field(payload, "manifest_path")
    _require_pointer_field(payload, "artifact_path")
    _require_pointer_field(payload, "markdown_path")
    _require_pointer_field(payload, "title")
    _require_pointer_field(payload, "slug")
    _require_pointer_field(payload, "summary")
    _require_pointer_field(payload, "promoted_at")
    _require_pointer_field(payload, "source_generated_at")
    _require_pointer_field(payload, "internal_reference")

    if content_kind == "compare" and payload.get("compare_mode") is not True:
        raise ValueError("Compare release pointer must include compare_mode=true")
    return payload


def load_validated_release_pointer(path: str | Path, *, expected_kind: str | None = None) -> dict[str, Any]:
    import json

    with open(path, encoding="utf-8") as handle:
        return validate_release_pointer(json.load(handle), expected_kind=expected_kind)


def build_release_pointer(
    *,
    manifest: dict[str, Any],
    manifest_path: str,
    promoted_at: str | None = None,
) -> dict[str, Any]:
    payload = {
        "schema_version": RELEASE_POINTER_SCHEMA_VERSION,
        "content_kind": manifest["content_kind"],
        "week": manifest["week"],
        "publish_ready": manifest["publish_ready"],
        "manifest_path": manifest_path,
        "artifact_path": manifest["artifact_path"],
        "markdown_path": manifest["markdown_path"],
        "title": manifest["title"],
        "slug": manifest["slug"],
        "summary": manifest["summary"],
        "promoted_at": promoted_at or datetime.now().isoformat(timespec="seconds"),
        "source_generated_at": manifest["generated_at"],
        "internal_reference": manifest["internal_reference"],
    }
    if manifest.get("compare_mode") is not None:
        payload["compare_mode"] = manifest["compare_mode"]
    return payload


def release_output_paths(
    content_kind: str,
    *,
    output_dir: str | Path | None = None,
    copy_markdown: bool = False,
) -> tuple[Path, Path | None]:
    return (
        publication_release_pointer_output_path(content_kind, output_dir=output_dir),
        publication_release_markdown_output_path(content_kind, output_dir=output_dir) if copy_markdown else None,
    )


def resolve_release_reference(path_value: str | Path) -> Path:
    path = Path(path_value)
    if path.is_absolute():
        return path

    candidates = [
        Path.cwd() / path,
        Path(__file__).resolve().parents[2] / path,
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return candidates[0]


def load_existing_release_pointer(
    content_kind: str,
    *,
    output_dir: str | Path | None = None,
) -> dict[str, Any] | None:
    pointer_path = publication_release_pointer_output_path(content_kind, output_dir=output_dir)
    if not pointer_path.exists():
        return None
    return load_validated_release_pointer(pointer_path, expected_kind=content_kind)


def release_recency_key_from_pointer(pointer: dict[str, Any]) -> tuple[Any, Any, str]:
    return (
        handoff_manifest_recency_key(
            {
                "week": pointer["week"],
                "generated_at": pointer["source_generated_at"],
            }
        ),
        pointer["manifest_path"],
    )


def release_recency_key_from_manifest(
    manifest: dict[str, Any],
    *,
    manifest_path: str,
) -> tuple[Any, Any, str]:
    return (
        handoff_manifest_recency_key(manifest),
        manifest_path,
    )


def detect_rollback(
    *,
    manifest: dict[str, Any],
    manifest_path: str,
    current_pointer: dict[str, Any] | None,
) -> bool:
    if current_pointer is None:
        return False
    return release_recency_key_from_manifest(manifest, manifest_path=manifest_path) < release_recency_key_from_pointer(
        current_pointer
    )


def export_release_pointer(payload: dict[str, Any], output_path: Path) -> None:
    import json

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def copy_release_markdown(source_path: Path, destination_path: Path) -> None:
    import shutil

    destination_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source_path, destination_path)
