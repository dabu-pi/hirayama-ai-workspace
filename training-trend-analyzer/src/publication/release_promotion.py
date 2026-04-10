"""Core promotion logic shared by manifest-based and candidate-based promotion CLIs."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

from src.publication.release_ledger import (
    append_release_ledger_record,
    build_release_ledger_record,
    release_ledger_output_path,
)
from src.publication.release_pointer import (
    build_release_pointer,
    copy_release_markdown,
    detect_rollback,
    export_release_pointer,
    load_existing_release_pointer,
    load_validated_release_target_manifest,
    release_output_paths,
    resolve_release_reference,
)

# Project root for display_path() resolution (src/publication/ -> src/ -> project root)
_PROJECT_ROOT = Path(__file__).resolve().parents[2]


def display_path(path: Path) -> str:
    """Return a display-friendly relative path string, falling back to absolute."""
    for base in (Path.cwd(), _PROJECT_ROOT):
        try:
            return path.resolve().relative_to(base.resolve()).as_posix()
        except ValueError:
            continue
    return path.resolve().as_posix()


@dataclass
class PromoteResult:
    action: str  # "promote" | "rollback_promote"
    kind: str
    week: str
    manifest_path_display: str
    pointer_path: Path
    pointer_payload: dict
    stable_markdown_path: Path | None
    ledger_path: Path
    stable_markdown_updated: bool
    dry_run: bool


def promote_from_manifest_path(
    manifest_path: str | Path,
    *,
    output_dir: str | Path | None = None,
    copy_markdown: bool = False,
    dry_run: bool = False,
    verbose: bool = False,
    allow_rollback: bool = False,
) -> PromoteResult:
    """Promote a dated handoff manifest to the release layer.

    All side effects (file writes) are skipped when dry_run=True.
    Raises ValueError for invalid manifests, rollback without --allow-rollback,
    and missing markdown source when copy_markdown=True.
    """
    manifest_path = Path(manifest_path)
    manifest = load_validated_release_target_manifest(manifest_path)
    display_manifest_path = display_path(manifest_path)

    pointer_path, stable_markdown_path = release_output_paths(
        manifest["content_kind"],
        output_dir=output_dir,
        copy_markdown=copy_markdown,
    )
    ledger_path = release_ledger_output_path(output_dir=output_dir)

    current_pointer = load_existing_release_pointer(manifest["content_kind"], output_dir=output_dir)
    is_rollback = detect_rollback(
        manifest=manifest,
        manifest_path=display_manifest_path,
        current_pointer=current_pointer,
    )
    if is_rollback and not allow_rollback:
        raise ValueError(
            "Release promotion would move this content kind backward to an older manifest. "
            "Re-run with --allow-rollback to confirm."
        )

    promoted_at = datetime.now().isoformat(timespec="seconds")
    pointer_payload = build_release_pointer(
        manifest=manifest,
        manifest_path=display_manifest_path,
        promoted_at=promoted_at,
    )
    action = "rollback_promote" if is_rollback else "promote"

    dated_markdown_path = None
    if stable_markdown_path is not None:
        dated_markdown_path = resolve_release_reference(manifest["markdown_path"])
        if not dated_markdown_path.exists():
            raise ValueError(f"Release markdown source not found: {dated_markdown_path}")

    if verbose or dry_run:
        print(
            f"[PROMOTE] kind={manifest['content_kind']} week={manifest['week']} "
            f"manifest={display_manifest_path}"
        )
        print(f"[PROMOTE] action={action}")
        if current_pointer is not None:
            print(
                f"[PROMOTE] current_release week={current_pointer['week']} "
                f"source_generated_at={current_pointer['source_generated_at']}"
            )
        print(f"[PROMOTE] release_pointer={display_path(pointer_path)}")
        print(f"[PROMOTE] ledger={display_path(ledger_path)}")
        if stable_markdown_path is not None:
            print(f"[PROMOTE] stable_markdown={display_path(stable_markdown_path)}")

    if dry_run:
        return PromoteResult(
            action=action,
            kind=manifest["content_kind"],
            week=manifest["week"],
            manifest_path_display=display_manifest_path,
            pointer_path=pointer_path,
            pointer_payload=pointer_payload,
            stable_markdown_path=stable_markdown_path,
            ledger_path=ledger_path,
            stable_markdown_updated=False,
            dry_run=True,
        )

    export_release_pointer(pointer_payload, pointer_path)
    print(f"[RELEASE] {display_path(pointer_path)}")

    if stable_markdown_path is not None:
        assert dated_markdown_path is not None
        copy_release_markdown(dated_markdown_path, stable_markdown_path)
        print(f"[RELEASE-MARKDOWN] {display_path(stable_markdown_path)}")

    ledger_record = build_release_ledger_record(
        manifest=manifest,
        manifest_path=display_manifest_path,
        promoted_at=promoted_at,
        action=action,
        previous_release_pointer=current_pointer,
        stable_markdown_updated=stable_markdown_path is not None,
    )
    append_release_ledger_record(ledger_record, ledger_path)
    print(f"[RELEASE-LEDGER] {display_path(ledger_path)}")

    return PromoteResult(
        action=action,
        kind=manifest["content_kind"],
        week=manifest["week"],
        manifest_path_display=display_manifest_path,
        pointer_path=pointer_path,
        pointer_payload=pointer_payload,
        stable_markdown_path=stable_markdown_path,
        ledger_path=ledger_path,
        stable_markdown_updated=stable_markdown_path is not None,
        dry_run=False,
    )
