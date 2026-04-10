"""Promote a dated publication handoff manifest to the manual release layer."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

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


def _display_path(path: Path) -> str:
    for base in (Path.cwd(), ROOT.resolve()):
        try:
            return path.resolve().relative_to(base.resolve()).as_posix()
        except ValueError:
            continue
    return path.resolve().as_posix()


def promote_publication_release(
    manifest_path: str | Path,
    *,
    output_dir: str | Path | None = None,
    copy_markdown: bool = False,
    dry_run: bool = False,
    verbose: bool = False,
    allow_rollback: bool = False,
) -> tuple[Path, dict, Path | None, Path]:
    manifest_path = Path(manifest_path)
    manifest = load_validated_release_target_manifest(manifest_path)
    display_manifest_path = _display_path(manifest_path)
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
        print(f"[PROMOTE] release_pointer={_display_path(pointer_path)}")
        print(f"[PROMOTE] ledger={_display_path(ledger_path)}")
        if stable_markdown_path is not None:
            print(f"[PROMOTE] stable_markdown={_display_path(stable_markdown_path)}")

    if dry_run:
        return pointer_path, pointer_payload, stable_markdown_path, ledger_path

    export_release_pointer(pointer_payload, pointer_path)
    print(f"[RELEASE] {_display_path(pointer_path)}")

    if stable_markdown_path is not None:
        assert dated_markdown_path is not None
        copy_release_markdown(dated_markdown_path, stable_markdown_path)
        print(f"[RELEASE-MARKDOWN] {_display_path(stable_markdown_path)}")

    ledger_record = build_release_ledger_record(
        manifest=manifest,
        manifest_path=display_manifest_path,
        promoted_at=promoted_at,
        action=action,
        previous_release_pointer=current_pointer,
        stable_markdown_updated=stable_markdown_path is not None,
    )
    append_release_ledger_record(ledger_record, ledger_path)
    print(f"[RELEASE-LEDGER] {_display_path(ledger_path)}")

    return pointer_path, pointer_payload, stable_markdown_path, ledger_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Promote a dated handoff manifest to the manual release layer")
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--output-dir")
    parser.add_argument("--copy-markdown", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--verbose", action="store_true")
    parser.add_argument("--allow-rollback", action="store_true")
    args = parser.parse_args()

    promote_publication_release(
        args.manifest,
        output_dir=args.output_dir,
        copy_markdown=args.copy_markdown,
        dry_run=args.dry_run,
        verbose=args.verbose,
        allow_rollback=args.allow_rollback,
    )


if __name__ == "__main__":
    try:
        main()
    except ValueError as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
