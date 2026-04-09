"""Helpers for publication handoff manifests and latest pointers."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any

from src.publication.output_paths import normalize_output_dir

HANDOFF_MANIFEST_SCHEMA_VERSION = "publication-handoff/v1"
HANDOFF_POINTER_SCHEMA_VERSION = "publication-handoff-pointer/v1"
HANDOFF_CONTENT_KINDS = ("ranking", "compare", "publish_hold")


def _kind_file_prefix(content_kind: str) -> str:
    if content_kind == "compare":
        return "publication_handoff_compare_"
    if content_kind == "publish_hold":
        return "publication_handoff_hold_"
    if content_kind == "ranking":
        return "publication_handoff_"
    raise ValueError(f"Unsupported handoff content kind: {content_kind!r}")


def _path_for_manifest(content_kind: str, week: str, *, output_dir: str | Path | None = None) -> Path:
    base_dir = normalize_output_dir(output_dir)
    week_token = week.replace("-", "")
    if content_kind == "compare":
        return base_dir / f"publication_handoff_compare_{week_token}.json"
    if content_kind == "publish_hold":
        return base_dir / f"publication_handoff_hold_{week_token}.json"
    return base_dir / f"publication_handoff_{week_token}.json"


def _path_for_latest_pointer(content_kind: str, *, output_dir: str | Path | None = None) -> Path:
    base_dir = normalize_output_dir(output_dir)
    if content_kind == "compare":
        return base_dir / "publication_handoff_compare_latest.json"
    if content_kind == "publish_hold":
        return base_dir / "publication_handoff_hold_latest.json"
    return base_dir / "publication_handoff_latest.json"


def handoff_output_paths(
    content_kind: str,
    week: str,
    *,
    output_dir: str | Path | None = None,
) -> tuple[Path, Path]:
    return (
        _path_for_manifest(content_kind, week, output_dir=output_dir),
        _path_for_latest_pointer(content_kind, output_dir=output_dir),
    )


def build_handoff_manifest(
    *,
    artifact_payload: dict,
    markdown_metadata: dict,
    artifact_path: str,
    markdown_path: str,
) -> dict:
    manifest = {
        "schema_version": HANDOFF_MANIFEST_SCHEMA_VERSION,
        "artifact_schema_version": artifact_payload["schema_version"],
        "content_kind": markdown_metadata["content_kind"],
        "week": artifact_payload["week"],
        "generated_at": artifact_payload["generated_at"],
        "publish_ready": artifact_payload["publish_ready"],
        "artifact_path": artifact_path,
        "markdown_path": markdown_path,
        "slug": markdown_metadata["slug"],
        "title": markdown_metadata["title"],
        "summary": markdown_metadata["summary"],
        "internal_reference": markdown_metadata["internal_reference"],
    }
    if markdown_metadata.get("compare_mode") is not None:
        manifest["compare_mode"] = markdown_metadata["compare_mode"]
    if markdown_metadata.get("hold_reason"):
        manifest["hold_reason"] = markdown_metadata["hold_reason"]
    if markdown_metadata.get("publication_notice"):
        manifest["publication_notice"] = markdown_metadata["publication_notice"]
    return manifest


def build_latest_pointer(*, manifest: dict, manifest_path: str) -> dict:
    return {
        "schema_version": HANDOFF_POINTER_SCHEMA_VERSION,
        "content_kind": manifest["content_kind"],
        "week": manifest["week"],
        "publish_ready": manifest["publish_ready"],
        "manifest_path": manifest_path,
        "updated_at": datetime.now().isoformat(timespec="seconds"),
    }


def _parse_week_key(week: str) -> tuple[int, int, int]:
    try:
        parsed = datetime.strptime(week, "%Y-%m-%d")
    except ValueError as exc:
        raise ValueError(f"Invalid handoff manifest week: {week!r}") from exc
    return parsed.year, parsed.month, parsed.day


def _parse_generated_at_key(generated_at: str) -> tuple[int, int, int, int, int, int]:
    try:
        normalized = generated_at.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(normalized)
    except ValueError as exc:
        raise ValueError(f"Invalid handoff manifest generated_at: {generated_at!r}") from exc
    return (
        parsed.year,
        parsed.month,
        parsed.day,
        parsed.hour,
        parsed.minute,
        parsed.second,
    )


def _require_manifest_field(payload: dict[str, Any], key: str) -> Any:
    if key not in payload:
        raise ValueError(f"Missing required handoff manifest key: {key}")
    return payload[key]


def validate_handoff_manifest(payload: dict[str, Any], *, expected_kind: str | None = None) -> dict[str, Any]:
    schema_version = _require_manifest_field(payload, "schema_version")
    if schema_version != HANDOFF_MANIFEST_SCHEMA_VERSION:
        raise ValueError(
            f"Unsupported handoff manifest schema_version: {schema_version!r}. "
            f"Supported schema_version(s): {HANDOFF_MANIFEST_SCHEMA_VERSION}"
        )

    content_kind = _require_manifest_field(payload, "content_kind")
    if content_kind not in HANDOFF_CONTENT_KINDS:
        raise ValueError(f"Unsupported handoff manifest content_kind: {content_kind!r}")
    if expected_kind is not None and content_kind != expected_kind:
        raise ValueError(
            f"Handoff manifest content_kind mismatch: expected {expected_kind!r}, got {content_kind!r}"
        )

    publish_ready = _require_manifest_field(payload, "publish_ready")
    if not isinstance(publish_ready, bool):
        raise ValueError("Handoff manifest publish_ready must be boolean")

    if content_kind in {"ranking", "compare"} and publish_ready is not True:
        raise ValueError(f"Handoff manifest {content_kind!r} must have publish_ready=true")
    if content_kind == "publish_hold" and publish_ready is not False:
        raise ValueError("Handoff manifest 'publish_hold' must have publish_ready=false")

    _require_manifest_field(payload, "week")
    _require_manifest_field(payload, "generated_at")
    _require_manifest_field(payload, "artifact_path")
    _require_manifest_field(payload, "markdown_path")
    _require_manifest_field(payload, "slug")
    _require_manifest_field(payload, "title")
    _require_manifest_field(payload, "summary")
    _require_manifest_field(payload, "internal_reference")

    if content_kind == "compare" and payload.get("compare_mode") is not True:
        raise ValueError("Compare handoff manifest must include compare_mode=true")
    if content_kind == "publish_hold" and not payload.get("hold_reason"):
        raise ValueError("Publish hold handoff manifest must include hold_reason")

    _parse_week_key(payload["week"])
    _parse_generated_at_key(payload["generated_at"])
    return payload


def iter_dated_manifest_paths(
    *,
    output_dir: str | Path | None = None,
    kind: str = "all",
) -> list[Path]:
    base_dir = normalize_output_dir(output_dir)
    if kind == "all":
        paths = []
        for concrete_kind in HANDOFF_CONTENT_KINDS:
            paths.extend(iter_dated_manifest_paths(output_dir=base_dir, kind=concrete_kind))
        return sorted(set(paths))

    prefix = _kind_file_prefix(kind)
    paths = []
    for path in sorted(base_dir.glob(f"{prefix}*.json")):
        if path.name.endswith("_latest.json"):
            continue
        if kind == "ranking" and (
            path.name.startswith(_kind_file_prefix("compare"))
            or path.name.startswith(_kind_file_prefix("publish_hold"))
        ):
            continue
        paths.append(path)
    return paths


def load_validated_handoff_manifests(
    *,
    output_dir: str | Path | None = None,
    kind: str = "all",
) -> list[tuple[Path, dict[str, Any]]]:
    manifests: list[tuple[Path, dict[str, Any]]] = []
    if kind == "all":
        for concrete_kind in HANDOFF_CONTENT_KINDS:
            manifests.extend(load_validated_handoff_manifests(output_dir=output_dir, kind=concrete_kind))
        return manifests

    for path in iter_dated_manifest_paths(output_dir=output_dir, kind=kind):
        with open(path, encoding="utf-8") as handle:
            payload = validate_handoff_manifest(json_load(handle), expected_kind=kind)
        manifests.append((path, payload))
    return manifests


def json_load(handle) -> dict[str, Any]:
    import json

    return json.load(handle)


def select_latest_manifest(manifests: list[tuple[Path, dict[str, Any]]]) -> tuple[Path, dict[str, Any]]:
    if not manifests:
        raise ValueError("No dated handoff manifests found for latest rebuild")

    def sort_key(item: tuple[Path, dict[str, Any]]):
        path, manifest = item
        return (
            _parse_week_key(manifest["week"]),
            _parse_generated_at_key(manifest["generated_at"]),
            path.name,
        )

    return max(manifests, key=sort_key)


def rebuild_latest_pointer_for_kind(
    *,
    kind: str,
    output_dir: str | Path | None = None,
) -> tuple[Path, Path, dict[str, Any]]:
    manifests = load_validated_handoff_manifests(output_dir=output_dir, kind=kind)
    manifest_path, manifest = select_latest_manifest(manifests)
    latest_pointer_path = _path_for_latest_pointer(kind, output_dir=output_dir)
    return latest_pointer_path, manifest_path, manifest


def rebuild_latest_pointers(
    *,
    output_dir: str | Path | None = None,
    kind: str = "all",
) -> dict[str, tuple[Path, Path, dict[str, Any]]]:
    if kind == "all":
        return {
            concrete_kind: rebuild_latest_pointer_for_kind(output_dir=output_dir, kind=concrete_kind)
            for concrete_kind in HANDOFF_CONTENT_KINDS
        }
    return {kind: rebuild_latest_pointer_for_kind(output_dir=output_dir, kind=kind)}
