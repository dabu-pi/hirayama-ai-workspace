"""Promote a dated publication handoff manifest to the manual release layer."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from src.publication.release_promotion import promote_from_manifest_path


def promote_publication_release(
    manifest_path: str | Path,
    *,
    output_dir: str | Path | None = None,
    copy_markdown: bool = False,
    dry_run: bool = False,
    verbose: bool = False,
    allow_rollback: bool = False,
) -> tuple[Path, dict, Path | None, Path]:
    result = promote_from_manifest_path(
        manifest_path,
        output_dir=output_dir,
        copy_markdown=copy_markdown,
        dry_run=dry_run,
        verbose=verbose,
        allow_rollback=allow_rollback,
    )
    return result.pointer_path, result.pointer_payload, result.stable_markdown_path, result.ledger_path


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
