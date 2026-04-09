"""Helpers for publication handoff manifests and latest pointers."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

from src.publication.output_paths import normalize_output_dir

HANDOFF_MANIFEST_SCHEMA_VERSION = "publication-handoff/v1"
HANDOFF_POINTER_SCHEMA_VERSION = "publication-handoff-pointer/v1"


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
