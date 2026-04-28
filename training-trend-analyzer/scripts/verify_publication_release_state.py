"""Verify and optionally repair publication release state."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from src.publication.release_state_verify import repair_release_state, verify_release_state


def _print_verify_section(kind: str, section: dict, *, verbose: bool) -> None:
    print(f"== {kind} Release Verify ==")
    print(f"status: {section['status']}")
    if section["current_release"] is None:
        print("current_release: none")
    else:
        current = section["current_release"]
        print(f"current_week: {current['week']}")
        print(f"current_title: {current['title']}")
        print(f"current_manifest: {current['manifest_path']}")
        print(f"current_markdown: {current['markdown_path']}")
    if section["latest_ledger_entry"] is None:
        print("latest_ledger_entry: none")
    else:
        latest = section["latest_ledger_entry"]
        print(f"latest_ledger_action: {latest['action']}")
        print(f"latest_ledger_week: {latest['week']}")
        print(f"latest_ledger_manifest: {latest['manifest_path']}")
    if section["issues"]:
        print("issues:")
        for item in section["issues"]:
            print(f"- [{item['level']}] {item['code']}: {item['message']}")
    else:
        print("issues: none")
    if verbose:
        print(f"pointer_path: {section['paths']['pointer_path']}")
        print(f"ledger_path: {section['paths']['ledger_path']}")
        print(f"stable_markdown_path: {section['paths']['stable_markdown_path']}")


def _print_repair_section(kind: str, section: dict) -> None:
    print(f"== {kind} Release Repair ==")
    print(f"dry_run: {section['dry_run']}")
    print(f"repaired: {section['repaired']}")
    print(f"manifest: {section['manifest_path']}")
    print(f"ledger_action: {section['action']}")
    print(f"pointer_path: {section['pointer_path']}")
    print(f"stable_markdown_path: {section['stable_markdown_path']}")


def _print_human(
    verify_result: dict,
    *,
    verbose: bool,
    repair_result: dict | None = None,
    pre_repair_verify_error: str | None = None,
) -> None:
    if pre_repair_verify_error is not None:
        print(f"pre_repair_verify_error: {pre_repair_verify_error}")
        print()
    print(f"overall_status: {verify_result['status']}")
    first = True
    for kind, section in verify_result["kinds"].items():
        if not first:
            print()
        first = False
        _print_verify_section(kind, section, verbose=verbose)
        if repair_result is not None:
            print()
            _print_repair_section(kind, repair_result["kinds"][kind])


def main() -> None:
    parser = argparse.ArgumentParser(description="Verify and optionally repair publication release state")
    parser.add_argument("--kind", choices=["ranking", "compare", "all"], default="all")
    parser.add_argument("--output-dir")
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--verbose", action="store_true")
    parser.add_argument("--repair", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--strict-stable-markdown", action="store_true")
    args = parser.parse_args()

    pre_repair_verify_error = None
    try:
        verify_result = verify_release_state(
            kind=args.kind,
            output_dir=args.output_dir,
            strict_stable_markdown=args.strict_stable_markdown,
        )
    except ValueError as exc:
        if not args.repair:
            raise
        pre_repair_verify_error = str(exc)
        verify_result = {
            "status": "ERROR",
            "kinds": {},
        }
    repair_result = None
    if args.repair:
        repair_result = repair_release_state(
            kind=args.kind,
            output_dir=args.output_dir,
            dry_run=args.dry_run,
        )
        verify_result = verify_release_state(
            kind=args.kind,
            output_dir=args.output_dir,
            strict_stable_markdown=args.strict_stable_markdown,
        )

    payload = {"verify": verify_result}
    if pre_repair_verify_error is not None:
        payload["pre_repair_verify_error"] = pre_repair_verify_error
    if repair_result is not None:
        payload["repair"] = repair_result

    if args.json:
        json.dump(payload, sys.stdout, ensure_ascii=False, indent=2)
        sys.stdout.write("\n")
        return
    _print_human(
        verify_result,
        verbose=args.verbose,
        repair_result=repair_result,
        pre_repair_verify_error=pre_repair_verify_error,
    )


if __name__ == "__main__":
    try:
        main()
    except ValueError as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
