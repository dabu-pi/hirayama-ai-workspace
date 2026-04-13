"""Read-only helpers for comparing candidate latest with current release."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from src.publication.handoff_manifest import (
    _path_for_latest_pointer,  # noqa: PLC2701 — sibling module usage
    handoff_manifest_recency_key,
    load_validated_handoff_manifest,
)
from src.publication.output_paths import normalize_output_dir
from src.publication.release_pointer import (
    RELEASEABLE_CONTENT_KINDS,
    load_existing_release_pointer,
    resolve_release_reference,
)

# Review status constants
REVIEW_NO_CANDIDATE = "no_candidate"
REVIEW_NO_RELEASE = "no_release"
REVIEW_SAME_MANIFEST = "same_manifest"
REVIEW_CANDIDATE_NEWER = "candidate_newer_than_release"
REVIEW_CANDIDATE_OLDER = "candidate_older_than_release"
REVIEW_CANDIDATE_DIFFERS_SAME_WEEK = "candidate_differs_same_week"
REVIEW_CANDIDATE_NOT_PUBLISH_READY = "candidate_not_publish_ready"


def _load_candidate_latest_pointer(
    kind: str,
    *,
    output_dir: Path,
) -> dict[str, Any] | None:
    """Load the handoff latest pointer file for the given kind. Returns None if absent."""
    pointer_path = _path_for_latest_pointer(kind, output_dir=output_dir)
    if not pointer_path.exists():
        return None
    with open(pointer_path, encoding="utf-8") as handle:
        return json.load(handle)


def _load_candidate_manifest(
    pointer: dict[str, Any],
) -> dict[str, Any] | None:
    """Resolve and load the handoff manifest referenced by a candidate latest pointer."""
    manifest_path_str = pointer.get("manifest_path", "")
    if not manifest_path_str:
        return None
    try:
        resolved = resolve_release_reference(manifest_path_str)
        return load_validated_handoff_manifest(resolved)
    except (FileNotFoundError, OSError, ValueError):
        return None


def _candidate_view(
    pointer: dict[str, Any],
    manifest: dict[str, Any],
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "content_kind": manifest["content_kind"],
        "week": manifest["week"],
        "title": manifest["title"],
        "slug": manifest["slug"],
        "manifest_path": pointer["manifest_path"],
        "markdown_path": manifest["markdown_path"],
        "generated_at": manifest["generated_at"],
        "publish_ready": manifest["publish_ready"],
    }
    if manifest.get("compare_mode") is not None:
        payload["compare_mode"] = manifest["compare_mode"]
    if manifest.get("hold_reason"):
        payload["hold_reason"] = manifest["hold_reason"]
    return payload


def _current_release_view(pointer: dict[str, Any] | None) -> dict[str, Any] | None:
    if pointer is None:
        return None
    payload: dict[str, Any] = {
        "content_kind": pointer["content_kind"],
        "week": pointer["week"],
        "title": pointer["title"],
        "slug": pointer["slug"],
        "manifest_path": pointer["manifest_path"],
        "markdown_path": pointer["markdown_path"],
        "promoted_at": pointer["promoted_at"],
        "source_generated_at": pointer["source_generated_at"],
        "publish_ready": pointer["publish_ready"],
    }
    if pointer.get("compare_mode") is not None:
        payload["compare_mode"] = pointer["compare_mode"]
    return payload


def _build_review(
    *,
    candidate_pointer: dict[str, Any] | None,
    candidate_manifest: dict[str, Any] | None,
    current_release: dict[str, Any] | None,
) -> dict[str, Any]:
    notes: list[str] = []

    if candidate_pointer is None:
        if current_release is None:
            notes.append("No candidate and no current release found for this kind.")
        else:
            notes.append(
                "No candidate latest pointer found. Run pipeline to generate a candidate."
            )
        return {"status": REVIEW_NO_CANDIDATE, "promotable": False, "notes": notes}

    if candidate_manifest is None:
        return {
            "status": REVIEW_NO_CANDIDATE,
            "promotable": False,
            "notes": [
                f"Candidate latest pointer found but manifest could not be loaded: "
                f"{candidate_pointer.get('manifest_path', '(missing)')}"
            ],
        }

    if not candidate_manifest["publish_ready"]:
        note = (
            f"Candidate is not publish_ready "
            f"(content_kind={candidate_manifest['content_kind']!r})"
        )
        hold_reason = candidate_manifest.get("hold_reason", "")
        if hold_reason:
            note += f", hold_reason={hold_reason!r}"
        return {
            "status": REVIEW_CANDIDATE_NOT_PUBLISH_READY,
            "promotable": False,
            "notes": [note],
        }

    if current_release is None:
        return {
            "status": REVIEW_NO_RELEASE,
            "promotable": True,
            "notes": [
                "No current release found. This candidate is eligible for initial promotion.",
                f"Candidate: week={candidate_manifest['week']!r}, slug={candidate_manifest['slug']!r}",
            ],
        }

    candidate_manifest_path = str(candidate_pointer["manifest_path"])
    release_manifest_path = str(current_release["manifest_path"])

    if candidate_manifest_path == release_manifest_path:
        return {
            "status": REVIEW_SAME_MANIFEST,
            "promotable": False,
            "notes": [
                "Candidate and current release point to the same manifest. No action needed."
            ],
        }

    candidate_recency = handoff_manifest_recency_key(candidate_manifest)
    release_recency = handoff_manifest_recency_key(
        {
            "week": current_release["week"],
            "generated_at": current_release["source_generated_at"],
        }
    )

    candidate_week = candidate_manifest["week"]
    release_week = current_release["week"]

    if candidate_recency > release_recency:
        if candidate_week == release_week:
            status = REVIEW_CANDIDATE_DIFFERS_SAME_WEEK
            notes.append(
                f"Candidate and release are the same week ({candidate_week}) "
                "but differ — candidate was generated later. Consider re-promoting."
            )
        else:
            status = REVIEW_CANDIDATE_NEWER
            notes.append(
                f"Candidate week={candidate_week!r} is newer than release week={release_week!r}. "
                "Promotion review recommended."
            )
        for field in ("title", "slug", "markdown_path"):
            c_val = candidate_manifest.get(field)
            r_val = current_release.get(field)
            if c_val != r_val:
                notes.append(
                    f"Field diff [{field}]: candidate={c_val!r}, release={r_val!r}"
                )
        return {"status": status, "promotable": True, "notes": notes}

    notes.append(
        f"Candidate (week={candidate_week!r}, generated_at={candidate_manifest['generated_at']!r}) "
        f"is older than or equal to the current release "
        f"(week={release_week!r}, source_generated_at={current_release['source_generated_at']!r}). "
        "Not a promotion candidate unless rollback is intended (use --allow-rollback)."
    )
    return {"status": REVIEW_CANDIDATE_OLDER, "promotable": False, "notes": notes}


def get_candidate_review_for_kind(
    *,
    kind: str,
    output_dir: str | Path | None = None,
) -> dict[str, Any]:
    """Build the candidate review result for a single releaseable kind."""
    if kind not in RELEASEABLE_CONTENT_KINDS:
        raise ValueError(f"Unsupported candidate review kind: {kind!r}")

    base_dir = normalize_output_dir(output_dir)

    candidate_pointer = _load_candidate_latest_pointer(kind, output_dir=base_dir)
    candidate_manifest: dict[str, Any] | None = None
    if candidate_pointer is not None:
        candidate_manifest = _load_candidate_manifest(candidate_pointer)

    current_release = load_existing_release_pointer(kind, output_dir=base_dir)

    review = _build_review(
        candidate_pointer=candidate_pointer,
        candidate_manifest=candidate_manifest,
        current_release=current_release,
    )

    return {
        "kind": kind,
        "current_release": _current_release_view(current_release),
        "latest_candidate": (
            _candidate_view(candidate_pointer, candidate_manifest)
            if candidate_pointer is not None and candidate_manifest is not None
            else None
        ),
        "review": review,
    }


def get_candidate_review(
    *,
    kind: str = "all",
    output_dir: str | Path | None = None,
) -> dict[str, Any]:
    """Build candidate review for one or all releaseable kinds."""
    if kind == "all":
        kinds = list(RELEASEABLE_CONTENT_KINDS)
    else:
        kinds = [kind]
    return {
        "kinds": {
            k: get_candidate_review_for_kind(kind=k, output_dir=output_dir)
            for k in kinds
        }
    }
