"""Rebuild publication latest pointers from dated handoff manifests."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from src.publication.handoff_manifest import (
    build_latest_pointer,
    rebuild_latest_pointers,
)


def _display_path(path: Path) -> str:
    for base in (Path.cwd(), ROOT.resolve()):
        try:
            return path.resolve().relative_to(base.resolve()).as_posix()
        except ValueError:
            continue
    return path.resolve().as_posix()


def _export_json(payload: dict, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Rebuild publication latest pointers from dated manifests")
    parser.add_argument("--output-dir", default="data/output")
    parser.add_argument("--kind", choices=["ranking", "compare", "publish_hold", "all"], default="all")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    rebuilt = rebuild_latest_pointers(output_dir=args.output_dir, kind=args.kind)
    for kind, (latest_path, manifest_path, manifest) in rebuilt.items():
        latest_pointer = build_latest_pointer(
            manifest=manifest,
            manifest_path=_display_path(manifest_path),
        )
        if args.verbose or args.dry_run:
            print(
                f"[REBUILD] kind={kind} week={manifest['week']} "
                f"generated_at={manifest['generated_at']} manifest={_display_path(manifest_path)}"
            )
        if not args.dry_run:
            _export_json(latest_pointer, latest_path)
            print(f"[LATEST] {_display_path(latest_path)}")


if __name__ == "__main__":
    try:
        main()
    except ValueError as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
