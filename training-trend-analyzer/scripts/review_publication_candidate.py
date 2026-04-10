"""Compare candidate latest with current release for promotion judgment."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from src.publication.candidate_review import (
    REVIEW_NO_CANDIDATE,
    REVIEW_NO_RELEASE,
    REVIEW_SAME_MANIFEST,
    REVIEW_CANDIDATE_NEWER,
    REVIEW_CANDIDATE_DIFFERS_SAME_WEEK,
    get_candidate_review,
)

_PROMOTABLE_LABEL = "PROMOTE READY"
_SAME_LABEL = "no action needed"
_HOLD_LABEL = "hold"


def _promotion_label(review: dict) -> str:
    if review["promotable"]:
        return _PROMOTABLE_LABEL
    if review["status"] == REVIEW_SAME_MANIFEST:
        return _SAME_LABEL
    return _HOLD_LABEL


def _print_current_release(kind: str, current_release: dict | None) -> None:
    print(f"-- {kind} | Current Release --")
    if current_release is None:
        print("  (no current release)")
        return
    print(f"  week:                {current_release['week']}")
    print(f"  title:               {current_release['title']}")
    print(f"  slug:                {current_release['slug']}")
    print(f"  manifest_path:       {current_release['manifest_path']}")
    print(f"  markdown_path:       {current_release['markdown_path']}")
    print(f"  promoted_at:         {current_release['promoted_at']}")
    print(f"  source_generated_at: {current_release['source_generated_at']}")
    if current_release.get("compare_mode") is not None:
        print(f"  compare_mode:        {current_release['compare_mode']}")


def _print_latest_candidate(kind: str, latest_candidate: dict | None) -> None:
    print(f"-- {kind} | Latest Candidate --")
    if latest_candidate is None:
        print("  (no candidate found)")
        return
    print(f"  week:          {latest_candidate['week']}")
    print(f"  title:         {latest_candidate['title']}")
    print(f"  slug:          {latest_candidate['slug']}")
    print(f"  manifest_path: {latest_candidate['manifest_path']}")
    print(f"  markdown_path: {latest_candidate['markdown_path']}")
    print(f"  generated_at:  {latest_candidate['generated_at']}")
    print(f"  publish_ready: {latest_candidate['publish_ready']}")
    if latest_candidate.get("compare_mode") is not None:
        print(f"  compare_mode:  {latest_candidate['compare_mode']}")
    if latest_candidate.get("hold_reason"):
        print(f"  hold_reason:   {latest_candidate['hold_reason']}")


def _print_review_summary(kind: str, review: dict) -> None:
    label = _promotion_label(review)
    print(f"-- {kind} | Review Summary --")
    print(f"  status:     {review['status']}")
    print(f"  promotable: {review['promotable']}  [{label}]")
    notes = review.get("notes", [])
    if notes:
        print("  notes:")
        for note in notes:
            print(f"    - {note}")


def _print_human(result: dict, *, verbose: bool) -> None:
    first = True
    for kind, section in result["kinds"].items():
        if not first:
            print()
        first = False
        _print_current_release(kind, section["current_release"])
        print()
        _print_latest_candidate(kind, section["latest_candidate"])
        print()
        _print_review_summary(kind, section["review"])
        if verbose:
            print()
            print(f"  output_dir: {section.get('output_dir', '(default)')}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Compare candidate latest with current release "
            "and show a promotion judgment summary."
        )
    )
    parser.add_argument(
        "--kind",
        choices=["ranking", "compare", "all"],
        default="all",
        help="Which kind(s) to review (default: all)",
    )
    parser.add_argument(
        "--output-dir",
        help="Directory containing publication output files (default: data/output)",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Emit machine-readable JSON",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Show additional context",
    )
    args = parser.parse_args()

    result = get_candidate_review(
        kind=args.kind,
        output_dir=args.output_dir,
    )

    if args.json:
        json.dump(result, sys.stdout, ensure_ascii=False, indent=2)
        sys.stdout.write("\n")
        return

    _print_human(result, verbose=args.verbose)


if __name__ == "__main__":
    try:
        main()
    except ValueError as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
