"""Promote the latest candidate to the release layer after eligibility check."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from src.publication.candidate_promotion import check_promotion_eligibility, promote_candidate
from src.publication.candidate_review import get_candidate_review_for_kind
from src.publication.output_paths import normalize_output_dir
from src.publication.release_promotion import display_path


def _emit_json(payload: dict) -> None:
    json.dump(payload, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")


def _print_rejection(kind: str, review: dict, reason: str, *, json_mode: bool) -> None:
    if json_mode:
        _emit_json(
            {
                "kind": kind,
                "review_status": review.get("status", ""),
                "promotable": False,
                "action": "no_action",
                "reject_reason": reason,
            }
        )
    else:
        print(f"[REJECT] kind={kind} status={review.get('status', '')}", file=sys.stderr)
        print(f"[REJECT] {reason}", file=sys.stderr)


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Promote the latest candidate to the release layer. "
            "Runs review eligibility check before promoting."
        )
    )
    parser.add_argument(
        "--kind",
        choices=["ranking", "compare"],
        required=True,
        help="Which kind to promote",
    )
    parser.add_argument(
        "--output-dir",
        help="Directory containing publication output files (default: data/output)",
    )
    parser.add_argument("--copy-markdown", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--verbose", action="store_true")
    parser.add_argument(
        "--allow-same-week",
        action="store_true",
        help=(
            "Allow promotion when candidate is from the same week as the release "
            "(candidate_differs_same_week)"
        ),
    )
    parser.add_argument(
        "--allow-rollback",
        action="store_true",
        help="Allow promotion of an older candidate (explicit rollback)",
    )
    parser.add_argument("--json", action="store_true", help="Emit machine-readable JSON")
    args = parser.parse_args()

    base_dir = normalize_output_dir(args.output_dir)

    # Load review for eligibility check and header display
    review_result = get_candidate_review_for_kind(kind=args.kind, output_dir=base_dir)
    review = review_result["review"]
    latest_candidate = review_result.get("latest_candidate")
    manifest_path_display = latest_candidate["manifest_path"] if latest_candidate else "(none)"

    # Eligibility check
    eligible, reject_reason = check_promotion_eligibility(
        review,
        allow_same_week=args.allow_same_week,
        allow_rollback=args.allow_rollback,
    )
    if not eligible:
        _print_rejection(args.kind, review, reject_reason, json_mode=args.json)
        raise SystemExit(1)

    # Print candidate header (human mode only)
    if not args.json:
        print(f"[CANDIDATE-PROMOTE] kind={args.kind} review_status={review['status']}")
        print(f"[CANDIDATE-PROMOTE] manifest={manifest_path_display}")

    # Promote (promote_candidate re-runs the review internally; acceptable for CLI)
    # In --json mode, redirect stdout to suppress [RELEASE]/[PROMOTE] human-readable lines
    import io as _io
    if args.json:
        _sink = _io.StringIO()
        _old_stdout = sys.stdout
        sys.stdout = _sink
        try:
            result = promote_candidate(
                args.kind,
                output_dir=args.output_dir,
                copy_markdown=args.copy_markdown,
                dry_run=args.dry_run,
                verbose=False,
                allow_same_week=args.allow_same_week,
                allow_rollback=args.allow_rollback,
            )
        finally:
            sys.stdout = _old_stdout
        _emit_json(
            {
                "kind": args.kind,
                "review_status": review["status"],
                "promotable": True,
                "selected_candidate_manifest": result.manifest_path_display,
                "action": result.action,
                "release_pointer_path": display_path(result.pointer_path),
                "ledger_path": display_path(result.ledger_path),
                "stable_markdown_updated": result.stable_markdown_updated,
                "dry_run": result.dry_run,
            }
        )
    else:
        result = promote_candidate(
            args.kind,
            output_dir=args.output_dir,
            copy_markdown=args.copy_markdown,
            dry_run=args.dry_run,
            verbose=args.verbose,
            allow_same_week=args.allow_same_week,
            allow_rollback=args.allow_rollback,
        )
        if result.dry_run:
            print("[DRY-RUN] no files written")


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except ValueError as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
