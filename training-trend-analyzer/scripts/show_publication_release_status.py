"""Show current approved release state and recent release history."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from src.publication.release_status import get_release_status


def _print_current_release(kind: str, current_release: dict | None) -> None:
    print(f"== {kind} Current Release ==")
    if current_release is None:
        print("No current release pointer found.")
        return

    print(f"week: {current_release['week']}")
    print(f"title: {current_release['title']}")
    print(f"slug: {current_release['slug']}")
    print(f"manifest: {current_release['manifest_path']}")
    print(f"markdown: {current_release['markdown_path']}")
    print(f"promoted_at: {current_release['promoted_at']}")
    print(f"source_generated_at: {current_release['source_generated_at']}")
    if current_release.get("compare_mode") is not None:
        print(f"compare_mode: {current_release['compare_mode']}")


def _print_recent_history(kind: str, history: list[dict], *, limit: int) -> None:
    print(f"== {kind} Recent History (limit={limit}) ==")
    if not history:
        print("No release ledger entries found.")
        return

    for item in history:
        line = (
            f"{item['promoted_at']} | {item['action']} | week={item['week']} | "
            f"title={item['title']} | slug={item['slug']}"
        )
        if item.get("previous_release_week") is not None:
            line += f" | previous_week={item['previous_release_week']}"
        if item.get("stable_markdown_updated") is True:
            line += " | stable_markdown_updated=yes"
        print(line)


def _print_warnings(warnings: list[str], *, verbose: bool) -> None:
    if not warnings and not verbose:
        return
    if not warnings:
        print("Warnings: none")
        return
    print("Warnings:")
    for warning in warnings:
        print(f"- {warning}")


def _print_human(status: dict, *, limit: int, verbose: bool) -> None:
    first = True
    for kind, section in status["kinds"].items():
        if not first:
            print()
        first = False
        _print_current_release(kind, section["current_release"])
        print()
        _print_recent_history(kind, section["recent_history"], limit=limit)
        if verbose or section["warnings"]:
            print()
            _print_warnings(section["warnings"], verbose=verbose)
            if verbose:
                print(f"ledger_path: {section['ledger_path']}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Show current release pointer and recent release ledger history")
    parser.add_argument("--kind", choices=["ranking", "compare", "all"], default="all")
    parser.add_argument("--limit", type=int, default=10)
    parser.add_argument("--output-dir")
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    status = get_release_status(
        kind=args.kind,
        limit=args.limit,
        output_dir=args.output_dir,
    )
    if args.json:
        json.dump(status, sys.stdout, ensure_ascii=False, indent=2)
        sys.stdout.write("\n")
        return
    _print_human(status, limit=args.limit, verbose=args.verbose)


if __name__ == "__main__":
    try:
        main()
    except ValueError as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
