"""Build dated publication handoff manifests and latest pointers."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from scripts.render_publish_markdown import load_publish_artifact
from src.publication.handoff_manifest import (
    build_handoff_manifest,
    build_latest_pointer,
    handoff_output_paths,
)
from src.publication.markdown_output import build_front_matter_data, parse_front_matter


def _display_path(path: Path) -> str:
    for base in (Path.cwd(), ROOT.resolve()):
        try:
            return path.resolve().relative_to(base.resolve()).as_posix()
        except ValueError:
            continue
    try:
        return path.resolve().as_posix()
    except OSError:
        return str(path)


def _load_markdown(markdown_path: Path) -> str:
    with open(markdown_path, encoding="utf-8") as handle:
        return handle.read()


def _validate_markdown_metadata(*, artifact_payload: dict, artifact_path: Path, markdown_metadata: dict) -> None:
    expected_metadata = build_front_matter_data(artifact_payload, artifact_path)
    comparable_keys = [
        "schema_version",
        "content_kind",
        "week",
        "generated_at",
        "publish_ready",
        "title",
        "slug",
        "summary",
        "internal_reference",
    ]
    optional_keys = ["compare_mode", "hold_reason", "publication_notice"]

    for key in comparable_keys:
        if markdown_metadata.get(key) != expected_metadata.get(key):
            raise ValueError(
                f"Markdown front matter mismatch for {key}: "
                f"expected {expected_metadata.get(key)!r}, got {markdown_metadata.get(key)!r}"
            )

    for key in optional_keys:
        if markdown_metadata.get(key) != expected_metadata.get(key):
            raise ValueError(
                f"Markdown front matter mismatch for {key}: "
                f"expected {expected_metadata.get(key)!r}, got {markdown_metadata.get(key)!r}"
            )


def export_json(payload: dict, output_path: Path, label: str) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    print(f"[{label}] {output_path.resolve()}")


def build_publication_handoff_files(
    artifact_path: Path,
    markdown_path: Path,
    *,
    output_dir: str | Path | None = None,
) -> tuple[Path, Path, dict, dict]:
    artifact_payload = load_publish_artifact(artifact_path)
    markdown_text = _load_markdown(markdown_path)
    markdown_metadata = parse_front_matter(markdown_text)
    _validate_markdown_metadata(
        artifact_payload=artifact_payload,
        artifact_path=artifact_path,
        markdown_metadata=markdown_metadata,
    )

    dated_manifest_path, latest_pointer_path = handoff_output_paths(
        markdown_metadata["content_kind"],
        artifact_payload["week"],
        output_dir=output_dir,
    )
    manifest = build_handoff_manifest(
        artifact_payload=artifact_payload,
        markdown_metadata=markdown_metadata,
        artifact_path=_display_path(artifact_path),
        markdown_path=_display_path(markdown_path),
    )
    latest_pointer = build_latest_pointer(
        manifest=manifest,
        manifest_path=_display_path(dated_manifest_path),
    )

    export_json(manifest, dated_manifest_path, "HANDOFF")
    export_json(latest_pointer, latest_pointer_path, "LATEST")
    return dated_manifest_path, latest_pointer_path, manifest, latest_pointer


def main() -> None:
    parser = argparse.ArgumentParser(description="Build publication handoff manifest from artifact and Markdown")
    parser.add_argument("--artifact", required=True)
    parser.add_argument("--markdown", required=True)
    args = parser.parse_args()

    artifact_path = Path(args.artifact)
    markdown_path = Path(args.markdown)
    build_publication_handoff_files(artifact_path, markdown_path)


if __name__ == "__main__":
    try:
        main()
    except ValueError as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
