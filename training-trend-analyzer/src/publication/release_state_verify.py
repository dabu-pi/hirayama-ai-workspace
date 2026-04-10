"""Verification and safe repair helpers for publication release state."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from src.publication.handoff_manifest import load_validated_handoff_manifest
from src.publication.output_paths import (
    publication_release_markdown_output_path,
    publication_release_pointer_output_path,
)
from src.publication.release_ledger import recent_release_ledger_records, release_ledger_output_path
from src.publication.release_pointer import (
    RELEASEABLE_CONTENT_KINDS,
    build_release_pointer,
    copy_release_markdown,
    export_release_pointer,
    load_existing_release_pointer,
    resolve_release_reference,
)


def _issue(level: str, code: str, message: str) -> dict[str, str]:
    return {"level": level, "code": code, "message": message}


def _status_from_issues(issues: list[dict[str, str]]) -> str:
    if any(item["level"] == "ERROR" for item in issues):
        return "ERROR"
    if any(item["level"] == "WARNING" for item in issues):
        return "WARNING"
    return "OK"


def _read_text_if_exists(path: Path) -> str | None:
    if not path.exists():
        return None
    return path.read_text(encoding="utf-8")


def _current_release_view(pointer: dict[str, Any] | None) -> dict[str, Any] | None:
    if pointer is None:
        return None
    payload = {
        "content_kind": pointer["content_kind"],
        "week": pointer["week"],
        "title": pointer["title"],
        "slug": pointer["slug"],
        "manifest_path": pointer["manifest_path"],
        "artifact_path": pointer["artifact_path"],
        "markdown_path": pointer["markdown_path"],
        "promoted_at": pointer["promoted_at"],
        "source_generated_at": pointer["source_generated_at"],
    }
    if pointer.get("compare_mode") is not None:
        payload["compare_mode"] = pointer["compare_mode"]
    return payload


def _ledger_view(record: dict[str, Any] | None) -> dict[str, Any] | None:
    if record is None:
        return None
    payload = {
        "promoted_at": record["promoted_at"],
        "action": record["action"],
        "content_kind": record["content_kind"],
        "week": record["week"],
        "title": record["title"],
        "slug": record["slug"],
        "manifest_path": record["manifest_path"],
        "markdown_path": record["markdown_path"],
        "source_generated_at": record["source_generated_at"],
    }
    if record.get("compare_mode") is not None:
        payload["compare_mode"] = record["compare_mode"]
    if record.get("previous_release_week") is not None:
        payload["previous_release_week"] = record["previous_release_week"]
    if record.get("stable_markdown_updated") is not None:
        payload["stable_markdown_updated"] = record["stable_markdown_updated"]
    return payload


def _compare_value(
    issues: list[dict[str, str]],
    *,
    code: str,
    label: str,
    left: Any,
    right: Any,
) -> None:
    if left != right:
        issues.append(_issue("ERROR", code, f"{label} mismatch: expected {right!r}, got {left!r}"))


def verify_release_state_for_kind(
    *,
    kind: str,
    output_dir: str | Path | None = None,
    strict_stable_markdown: bool = False,
) -> dict[str, Any]:
    if kind not in RELEASEABLE_CONTENT_KINDS:
        raise ValueError(f"Unsupported release verify kind: {kind!r}")

    pointer_path = publication_release_pointer_output_path(kind, output_dir=output_dir)
    stable_markdown_path = publication_release_markdown_output_path(kind, output_dir=output_dir)
    ledger_path = release_ledger_output_path(output_dir=output_dir)

    current_pointer = load_existing_release_pointer(kind, output_dir=output_dir)
    latest_history = None
    history = recent_release_ledger_records(ledger_path, kind=kind, limit=1)
    if history:
        latest_history = history[0]

    issues: list[dict[str, str]] = []
    manifest_payload = None
    pointer_manifest_path = None
    pointer_markdown_source_path = None

    if current_pointer is None:
        if latest_history is None:
            issues.append(_issue("WARNING", "release_missing", "No current release pointer and no release ledger entry found."))
        else:
            issues.append(_issue("ERROR", "pointer_missing", "Release ledger exists but current release pointer is missing."))
    else:
        pointer_manifest_path = resolve_release_reference(current_pointer["manifest_path"])
        if not pointer_manifest_path.exists():
            issues.append(
                _issue(
                    "ERROR",
                    "manifest_missing",
                    f"Pointer manifest_path does not exist: {pointer_manifest_path.as_posix()}",
                )
            )
        else:
            manifest_payload = load_validated_handoff_manifest(pointer_manifest_path, expected_kind=kind)

        pointer_artifact_path = resolve_release_reference(current_pointer["artifact_path"])
        if not pointer_artifact_path.exists():
            issues.append(
                _issue(
                    "ERROR",
                    "artifact_missing",
                    f"Pointer artifact_path does not exist: {pointer_artifact_path.as_posix()}",
                )
            )

        pointer_markdown_source_path = resolve_release_reference(current_pointer["markdown_path"])
        if not pointer_markdown_source_path.exists():
            issues.append(
                _issue(
                    "ERROR",
                    "markdown_missing",
                    f"Pointer markdown_path does not exist: {pointer_markdown_source_path.as_posix()}",
                )
            )

        if manifest_payload is not None:
            _compare_value(
                issues,
                code="pointer_manifest_kind_mismatch",
                label="content_kind",
                left=current_pointer["content_kind"],
                right=manifest_payload["content_kind"],
            )
            _compare_value(
                issues,
                code="pointer_manifest_week_mismatch",
                label="week",
                left=current_pointer["week"],
                right=manifest_payload["week"],
            )
            _compare_value(
                issues,
                code="pointer_manifest_title_mismatch",
                label="title",
                left=current_pointer["title"],
                right=manifest_payload["title"],
            )
            _compare_value(
                issues,
                code="pointer_manifest_slug_mismatch",
                label="slug",
                left=current_pointer["slug"],
                right=manifest_payload["slug"],
            )
            _compare_value(
                issues,
                code="pointer_manifest_summary_mismatch",
                label="summary",
                left=current_pointer["summary"],
                right=manifest_payload["summary"],
            )
            _compare_value(
                issues,
                code="pointer_manifest_artifact_path_mismatch",
                label="artifact_path",
                left=current_pointer["artifact_path"],
                right=manifest_payload["artifact_path"],
            )
            _compare_value(
                issues,
                code="pointer_manifest_markdown_path_mismatch",
                label="markdown_path",
                left=current_pointer["markdown_path"],
                right=manifest_payload["markdown_path"],
            )
            _compare_value(
                issues,
                code="pointer_manifest_generated_at_mismatch",
                label="source_generated_at",
                left=current_pointer["source_generated_at"],
                right=manifest_payload["generated_at"],
            )
            if kind == "compare":
                _compare_value(
                    issues,
                    code="pointer_manifest_compare_mode_mismatch",
                    label="compare_mode",
                    left=current_pointer.get("compare_mode"),
                    right=manifest_payload.get("compare_mode"),
                )

    if latest_history is None:
        if current_pointer is not None:
            issues.append(_issue("ERROR", "ledger_missing", "Current release pointer exists but release ledger is empty for this kind."))
    else:
        latest_manifest_path = resolve_release_reference(latest_history["manifest_path"])
        if not latest_manifest_path.exists():
            issues.append(
                _issue(
                    "ERROR",
                    "ledger_manifest_missing",
                    f"Latest ledger manifest_path does not exist: {latest_manifest_path.as_posix()}",
                )
            )
        else:
            latest_manifest = load_validated_handoff_manifest(latest_manifest_path, expected_kind=kind)
            _compare_value(
                issues,
                code="ledger_manifest_week_mismatch",
                label="ledger week",
                left=latest_history["week"],
                right=latest_manifest["week"],
            )
            _compare_value(
                issues,
                code="ledger_manifest_title_mismatch",
                label="ledger title",
                left=latest_history["title"],
                right=latest_manifest["title"],
            )
            _compare_value(
                issues,
                code="ledger_manifest_slug_mismatch",
                label="ledger slug",
                left=latest_history["slug"],
                right=latest_manifest["slug"],
            )
            _compare_value(
                issues,
                code="ledger_manifest_markdown_path_mismatch",
                label="ledger markdown_path",
                left=latest_history["markdown_path"],
                right=latest_manifest["markdown_path"],
            )
            _compare_value(
                issues,
                code="ledger_manifest_generated_at_mismatch",
                label="ledger source_generated_at",
                left=latest_history["source_generated_at"],
                right=latest_manifest["generated_at"],
            )
            if kind == "compare":
                _compare_value(
                    issues,
                    code="ledger_manifest_compare_mode_mismatch",
                    label="ledger compare_mode",
                    left=latest_history.get("compare_mode"),
                    right=latest_manifest.get("compare_mode"),
                )

        if current_pointer is not None:
            _compare_value(
                issues,
                code="pointer_ledger_manifest_mismatch",
                label="pointer vs ledger manifest_path",
                left=current_pointer["manifest_path"],
                right=latest_history["manifest_path"],
            )
            _compare_value(
                issues,
                code="pointer_ledger_week_mismatch",
                label="pointer vs ledger week",
                left=current_pointer["week"],
                right=latest_history["week"],
            )
            _compare_value(
                issues,
                code="pointer_ledger_title_mismatch",
                label="pointer vs ledger title",
                left=current_pointer["title"],
                right=latest_history["title"],
            )
            _compare_value(
                issues,
                code="pointer_ledger_slug_mismatch",
                label="pointer vs ledger slug",
                left=current_pointer["slug"],
                right=latest_history["slug"],
            )
            _compare_value(
                issues,
                code="pointer_ledger_generated_at_mismatch",
                label="pointer vs ledger source_generated_at",
                left=current_pointer["source_generated_at"],
                right=latest_history["source_generated_at"],
            )
            if kind == "compare":
                _compare_value(
                    issues,
                    code="pointer_ledger_compare_mode_mismatch",
                    label="pointer vs ledger compare_mode",
                    left=current_pointer.get("compare_mode"),
                    right=latest_history.get("compare_mode"),
                )

    stable_text = _read_text_if_exists(stable_markdown_path)
    if stable_text is None:
        level = "ERROR" if strict_stable_markdown else "WARNING"
        issues.append(
            _issue(
                level,
                "stable_markdown_missing",
                f"Stable markdown is missing: {stable_markdown_path.as_posix()}",
            )
        )
    elif pointer_markdown_source_path is not None and pointer_markdown_source_path.exists():
        pointer_markdown_text = _read_text_if_exists(pointer_markdown_source_path)
        if stable_text != pointer_markdown_text:
            issues.append(
                _issue(
                    "ERROR",
                    "stable_markdown_mismatch",
                    "Stable markdown content does not match the current release markdown.",
                )
            )

    return {
        "kind": kind,
        "status": _status_from_issues(issues),
        "issues": issues,
        "current_release": _current_release_view(current_pointer),
        "latest_ledger_entry": _ledger_view(latest_history),
        "paths": {
            "pointer_path": pointer_path.as_posix(),
            "ledger_path": ledger_path.as_posix(),
            "stable_markdown_path": stable_markdown_path.as_posix(),
        },
    }


def verify_release_state(
    *,
    kind: str = "all",
    output_dir: str | Path | None = None,
    strict_stable_markdown: bool = False,
) -> dict[str, Any]:
    kinds = list(RELEASEABLE_CONTENT_KINDS) if kind == "all" else [kind]
    result = {
        "kinds": {
            concrete_kind: verify_release_state_for_kind(
                kind=concrete_kind,
                output_dir=output_dir,
                strict_stable_markdown=strict_stable_markdown,
            )
            for concrete_kind in kinds
        }
    }
    statuses = [section["status"] for section in result["kinds"].values()]
    result["status"] = "ERROR" if "ERROR" in statuses else "WARNING" if "WARNING" in statuses else "OK"
    return result


def repair_release_state_for_kind(
    *,
    kind: str,
    output_dir: str | Path | None = None,
    dry_run: bool = False,
) -> dict[str, Any]:
    if kind not in RELEASEABLE_CONTENT_KINDS:
        raise ValueError(f"Unsupported release repair kind: {kind!r}")

    ledger_path = release_ledger_output_path(output_dir=output_dir)
    latest_history_list = recent_release_ledger_records(ledger_path, kind=kind, limit=1)
    if not latest_history_list:
        raise ValueError(f"No release ledger entry found for repair: kind={kind}")

    latest_history = latest_history_list[0]
    manifest_path = resolve_release_reference(latest_history["manifest_path"])
    if not manifest_path.exists():
        raise ValueError(f"Repair source manifest not found: {manifest_path}")
    manifest = load_validated_handoff_manifest(manifest_path, expected_kind=kind)

    _compare_value_checks: list[dict[str, str]] = []
    _compare_value(
        _compare_value_checks,
        code="repair_manifest_week_mismatch",
        label="ledger week",
        left=latest_history["week"],
        right=manifest["week"],
    )
    _compare_value(
        _compare_value_checks,
        code="repair_manifest_title_mismatch",
        label="ledger title",
        left=latest_history["title"],
        right=manifest["title"],
    )
    _compare_value(
        _compare_value_checks,
        code="repair_manifest_slug_mismatch",
        label="ledger slug",
        left=latest_history["slug"],
        right=manifest["slug"],
    )
    _compare_value(
        _compare_value_checks,
        code="repair_manifest_markdown_path_mismatch",
        label="ledger markdown_path",
        left=latest_history["markdown_path"],
        right=manifest["markdown_path"],
    )
    _compare_value(
        _compare_value_checks,
        code="repair_manifest_generated_at_mismatch",
        label="ledger source_generated_at",
        left=latest_history["source_generated_at"],
        right=manifest["generated_at"],
    )
    if _compare_value_checks:
        first = _compare_value_checks[0]
        raise ValueError(first["message"])

    source_markdown_path = resolve_release_reference(manifest["markdown_path"])
    if not source_markdown_path.exists():
        raise ValueError(f"Repair source markdown not found: {source_markdown_path}")

    pointer_path = publication_release_pointer_output_path(kind, output_dir=output_dir)
    stable_markdown_path = publication_release_markdown_output_path(kind, output_dir=output_dir)
    pointer_payload = build_release_pointer(
        manifest=manifest,
        manifest_path=latest_history["manifest_path"],
        promoted_at=latest_history["promoted_at"],
    )

    if not dry_run:
        export_release_pointer(pointer_payload, pointer_path)
        copy_release_markdown(source_markdown_path, stable_markdown_path)

    return {
        "kind": kind,
        "dry_run": dry_run,
        "repaired": not dry_run,
        "pointer_path": pointer_path.as_posix(),
        "stable_markdown_path": stable_markdown_path.as_posix(),
        "source_manifest_path": manifest_path.as_posix(),
        "source_markdown_path": source_markdown_path.as_posix(),
        "manifest_path": latest_history["manifest_path"],
        "action": latest_history["action"],
    }


def repair_release_state(
    *,
    kind: str = "all",
    output_dir: str | Path | None = None,
    dry_run: bool = False,
) -> dict[str, Any]:
    kinds = list(RELEASEABLE_CONTENT_KINDS) if kind == "all" else [kind]
    return {
        "kinds": {
            concrete_kind: repair_release_state_for_kind(
                kind=concrete_kind,
                output_dir=output_dir,
                dry_run=dry_run,
            )
            for concrete_kind in kinds
        }
    }
