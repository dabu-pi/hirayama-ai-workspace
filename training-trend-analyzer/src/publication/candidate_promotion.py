"""Eligibility check and promotion helper for latest candidate promotion."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from src.publication.candidate_review import (
    REVIEW_CANDIDATE_DIFFERS_SAME_WEEK,
    REVIEW_CANDIDATE_NEWER,
    REVIEW_CANDIDATE_NOT_PUBLISH_READY,
    REVIEW_CANDIDATE_OLDER,
    REVIEW_NO_CANDIDATE,
    REVIEW_NO_RELEASE,
    REVIEW_SAME_MANIFEST,
    get_candidate_review_for_kind,
)
from src.publication.output_paths import normalize_output_dir
from src.publication.release_pointer import RELEASEABLE_CONTENT_KINDS, resolve_release_reference
from src.publication.release_promotion import PromoteResult, promote_from_manifest_path

# Statuses that are promotable without any override flag
_PROMOTABLE_BY_DEFAULT = frozenset({REVIEW_NO_RELEASE, REVIEW_CANDIDATE_NEWER})

# Statuses that need --allow-same-week
_PROMOTABLE_WITH_SAME_WEEK = frozenset({REVIEW_CANDIDATE_DIFFERS_SAME_WEEK})

# Statuses that need --allow-rollback
_PROMOTABLE_WITH_ROLLBACK = frozenset({REVIEW_CANDIDATE_OLDER})

# Statuses that are always rejected regardless of flags
_ALWAYS_REJECTED = frozenset(
    {REVIEW_NO_CANDIDATE, REVIEW_SAME_MANIFEST, REVIEW_CANDIDATE_NOT_PUBLISH_READY}
)

_REJECT_REASONS: dict[str, str] = {
    REVIEW_NO_CANDIDATE: (
        "No candidate latest pointer found for this kind. "
        "Run pipeline to generate a candidate."
    ),
    REVIEW_SAME_MANIFEST: (
        "Candidate and current release point to the same manifest. No promotion needed."
    ),
    REVIEW_CANDIDATE_NOT_PUBLISH_READY: (
        "Candidate is not publish_ready and cannot be promoted."
    ),
}


def check_promotion_eligibility(
    review: dict[str, Any],
    *,
    allow_same_week: bool = False,
    allow_rollback: bool = False,
) -> tuple[bool, str]:
    """Return (eligible, reject_reason). reject_reason is empty string when eligible."""
    status = review["status"]
    notes = review.get("notes", [])

    if status in _ALWAYS_REJECTED:
        base = _REJECT_REASONS.get(status, f"Promotion rejected: review_status={status!r}")
        detail = f" ({notes[0]})" if notes else ""
        return False, base + detail

    if status in _PROMOTABLE_BY_DEFAULT and review.get("promotable"):
        return True, ""

    if status in _PROMOTABLE_WITH_SAME_WEEK:
        if allow_same_week:
            return True, ""
        return (
            False,
            f"Candidate is from the same week as the current release "
            f"(review_status={status!r}). Use --allow-same-week to promote.",
        )

    if status in _PROMOTABLE_WITH_ROLLBACK:
        if allow_rollback:
            return True, ""
        return (
            False,
            f"Candidate is older than or equal to the current release "
            f"(review_status={status!r}). Use --allow-rollback to promote.",
        )

    return False, f"Promotion rejected: review_status={status!r}"


def promote_candidate(
    kind: str,
    *,
    output_dir: str | Path | None = None,
    copy_markdown: bool = False,
    dry_run: bool = False,
    verbose: bool = False,
    allow_same_week: bool = False,
    allow_rollback: bool = False,
) -> PromoteResult:
    """Promote the latest candidate for the given kind after eligibility check.

    Raises ValueError when:
    - kind is not releaseable
    - review status is not eligible
    - override flags are missing for conditional statuses
    - underlying manifest/markdown validation fails
    """
    if kind not in RELEASEABLE_CONTENT_KINDS:
        raise ValueError(f"Unsupported promotion kind: {kind!r}")

    base_dir = normalize_output_dir(output_dir)
    review_result = get_candidate_review_for_kind(kind=kind, output_dir=base_dir)
    review = review_result["review"]

    eligible, reject_reason = check_promotion_eligibility(
        review,
        allow_same_week=allow_same_week,
        allow_rollback=allow_rollback,
    )
    if not eligible:
        raise ValueError(reject_reason)

    latest_candidate = review_result.get("latest_candidate")
    if latest_candidate is None:
        raise ValueError(f"No candidate manifest available for kind={kind!r}.")

    manifest_path = resolve_release_reference(latest_candidate["manifest_path"])

    return promote_from_manifest_path(
        manifest_path,
        output_dir=base_dir,
        copy_markdown=copy_markdown,
        dry_run=dry_run,
        verbose=verbose,
        allow_rollback=allow_rollback,
    )
