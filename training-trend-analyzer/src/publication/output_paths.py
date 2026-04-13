"""Shared output path helpers for publication steps."""

from __future__ import annotations

from pathlib import Path


DEFAULT_OUTPUT_DIR = Path("data/output")


def normalize_output_dir(output_dir: str | Path | None = None) -> Path:
    if output_dir is None:
        return DEFAULT_OUTPUT_DIR
    return Path(output_dir)


def publish_artifact_output_path(
    week: str,
    *,
    compare_enabled: bool = False,
    output_dir: str | Path | None = None,
) -> Path:
    week_token = week.replace("-", "")
    suffix = "_compare" if compare_enabled else ""
    return normalize_output_dir(output_dir) / f"publish_ready{suffix}_{week_token}.json"


def publish_markdown_output_path(
    artifact_path: str | Path,
    *,
    output_dir: str | Path | None = None,
) -> Path:
    artifact_path = Path(artifact_path)
    return normalize_output_dir(output_dir) / f"{artifact_path.stem}.md"


def publication_release_pointer_output_path(
    content_kind: str,
    *,
    output_dir: str | Path | None = None,
) -> Path:
    base_dir = normalize_output_dir(output_dir)
    if content_kind == "ranking":
        return base_dir / "publication_release_latest.json"
    if content_kind == "compare":
        return base_dir / "publication_release_compare_latest.json"
    raise ValueError(f"Unsupported release content kind: {content_kind!r}")


def publication_release_markdown_output_path(
    content_kind: str,
    *,
    output_dir: str | Path | None = None,
) -> Path:
    base_dir = normalize_output_dir(output_dir)
    if content_kind == "ranking":
        return base_dir / "publication_release_latest.md"
    if content_kind == "compare":
        return base_dir / "publication_release_compare_latest.md"
    raise ValueError(f"Unsupported release content kind: {content_kind!r}")
