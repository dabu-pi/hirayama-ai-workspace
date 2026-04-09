"""
Render publication-oriented Markdown from a publish-ready artifact JSON.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from src.publication.artifact_schema import validate_publish_ready_schema_version


def load_publish_artifact(artifact_path: Path) -> dict:
    with open(artifact_path, encoding="utf-8") as handle:
        payload = json.load(handle)

    validate_publish_ready_schema_version(payload)
    _validate_publish_artifact(payload)
    return payload


def _require(payload: dict, dotted_key: str):
    current = payload
    for part in dotted_key.split("."):
        if not isinstance(current, dict) or part not in current:
            raise ValueError(f"Missing required artifact key: {dotted_key}")
        current = current[part]
    return current


def _validate_publish_artifact(payload: dict) -> None:
    required_keys = [
        "week",
        "generated_at",
        "publish_ready",
        "health.overall_status",
        "health.reasons",
        "public_summary.headline",
        "public_summary.top_categories",
        "public_summary.featured_models",
        "public_notice",
        "internal_reference",
    ]
    for dotted_key in required_keys:
        _require(payload, dotted_key)


def _artifact_kind(payload: dict, artifact_path: Path) -> str:
    compare_summary = payload["public_summary"].get("compare_summary")
    if compare_summary is not None:
        return "compare"
    if artifact_path.stem.startswith("publish_ready_compare_"):
        return "compare"
    return "ranking"


def _content_kind(payload: dict, artifact_path: Path) -> str:
    if not payload["publish_ready"]:
        return "publish_hold"
    return _artifact_kind(payload, artifact_path)


def _week_compact(week: str) -> str:
    return week.replace("-", "")


def _document_title(payload: dict, artifact_path: Path) -> str:
    week = payload["week"]
    artifact_kind = _artifact_kind(payload, artifact_path)
    if not payload["publish_ready"]:
        return f"Publish Hold: {week}"
    if artifact_kind == "compare":
        return f"Weekly Training Trend Source Set Comparison: {week}"
    return f"Weekly Training Trend Update: {week}"


def _document_slug(payload: dict, artifact_path: Path) -> str:
    week_token = _week_compact(payload["week"])
    artifact_kind = _artifact_kind(payload, artifact_path)
    if not payload["publish_ready"]:
        return f"training-trends-hold-{week_token}"
    if artifact_kind == "compare":
        return f"training-trends-compare-{week_token}"
    return f"training-trends-{week_token}"


def _document_summary(payload: dict) -> str:
    if payload["publish_ready"]:
        return payload["public_summary"]["headline"]

    reasons = payload["health"].get("reasons") or []
    if reasons:
        return reasons[0]
    return payload.get("public_notice") or "Publication is on hold."


def _hold_reason(payload: dict) -> str:
    reasons = payload["health"].get("reasons") or []
    if reasons:
        return " | ".join(reasons)
    return payload.get("public_notice") or "Publication is on hold."


def _build_front_matter_data(payload: dict, artifact_path: Path) -> dict:
    artifact_kind = _artifact_kind(payload, artifact_path)
    metadata = {
        "schema_version": payload["schema_version"],
        "content_kind": _content_kind(payload, artifact_path),
        "week": payload["week"],
        "generated_at": payload["generated_at"],
        "publish_ready": payload["publish_ready"],
        "title": _document_title(payload, artifact_path),
        "slug": _document_slug(payload, artifact_path),
        "summary": _document_summary(payload),
        "internal_reference": payload["internal_reference"],
    }
    if payload.get("public_notice"):
        metadata["publication_notice"] = payload["public_notice"]
    if artifact_kind == "compare":
        metadata["compare_mode"] = True
    if not payload["publish_ready"]:
        metadata["hold_reason"] = _hold_reason(payload)
    return metadata


def _yaml_scalar(value) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if value is None:
        return "null"
    if isinstance(value, (int, float)):
        return str(value)
    text = str(value).replace("'", "''")
    return f"'{text}'"


def _yaml_lines(value, *, indent: int = 0) -> list[str]:
    prefix = " " * indent
    if isinstance(value, dict):
        lines = []
        for key, child in value.items():
            if isinstance(child, (dict, list)):
                lines.append(f"{prefix}{key}:")
                lines.extend(_yaml_lines(child, indent=indent + 2))
            else:
                lines.append(f"{prefix}{key}: {_yaml_scalar(child)}")
        return lines
    if isinstance(value, list):
        lines = []
        for child in value:
            if isinstance(child, (dict, list)):
                lines.append(f"{prefix}-")
                lines.extend(_yaml_lines(child, indent=indent + 2))
            else:
                lines.append(f"{prefix}- {_yaml_scalar(child)}")
        return lines
    return [f"{prefix}{_yaml_scalar(value)}"]


def _render_front_matter(payload: dict, artifact_path: Path) -> str:
    metadata = _build_front_matter_data(payload, artifact_path)
    lines = ["---", *_yaml_lines(metadata), "---", ""]
    return "\n".join(lines)


def _format_category_line(category: dict) -> str:
    examples = ", ".join(category.get("example_models", []))
    if examples:
        return (
            f"- **{category['category']}**: {category['featured_model_count']} featured model(s). "
            f"Examples: {examples}."
        )
    return f"- **{category['category']}**: {category['featured_model_count']} featured model(s)."


def _format_featured_model_line(model: dict) -> str:
    return (
        f"{model['rank']}. **{model['brand']} {model['model']}** "
        f"({model['category']})"
        f"\n   {model['summary']}"
    )


def _build_compare_section(compare_summary: dict) -> list[str]:
    lines = [
        "## Compare Highlights",
        "",
        (
            f"- Significant shifts: {compare_summary['significant_count']}"
            f" | Rank shifts: {compare_summary['rank_shift_count']}"
        ),
        f"- Top drivers: {compare_summary['top_drivers']}",
    ]

    largest_impact_model = compare_summary.get("largest_impact_model")
    if largest_impact_model:
        lines.append(f"- Largest impact: {largest_impact_model}")

    highlights = compare_summary.get("highlights", [])
    if highlights:
        lines.extend(["", "### Notable Changes", ""])
        for item in highlights:
            rank_flag = " with a rank shift" if item.get("rank_change") else ""
            lines.append(
                f"- **{item['brand']} {item['model']}** ({item['category']}): "
                f"{item['reason']}{rank_flag}."
            )

    return lines


def build_publish_markdown(payload: dict, artifact_path: Path) -> str:
    artifact_kind = _artifact_kind(payload, artifact_path)
    public_summary = payload["public_summary"]
    internal_reference = payload["internal_reference"]
    title = _document_title(payload, artifact_path)

    lines = [
        f"# {title}",
        "",
        f"_Generated from artifact on {payload['generated_at']}_",
        "",
        public_summary["headline"],
        "",
        "## Featured Categories",
        "",
    ]

    for category in public_summary["top_categories"]:
        lines.append(_format_category_line(category))

    lines.extend(["", "## Featured Models", ""])
    for model in public_summary["featured_models"]:
        lines.append(_format_featured_model_line(model))

    compare_summary = public_summary.get("compare_summary")
    if artifact_kind == "compare" and compare_summary is not None:
        lines.extend(["", *_build_compare_section(compare_summary)])

    if payload.get("public_notice"):
        lines.extend(["", "## Publication Note", "", payload["public_notice"]])

    lines.extend(
        [
            "",
            "## Internal Reference",
            "",
            f"- Source: `{internal_reference.get('collector_source', 'unknown')}`",
            f"- Compare enabled: `{internal_reference.get('compare_enabled', False)}`",
            f"- Category filter: `{internal_reference.get('category_filter')}`",
        ]
    )
    return "\n".join(lines).strip() + "\n"


def build_hold_markdown(payload: dict, artifact_path: Path) -> str:
    artifact_kind = _artifact_kind(payload, artifact_path)
    health = payload["health"]
    internal_reference = payload["internal_reference"]
    reasons = health.get("reasons") or [payload.get("public_notice", "Publication is on hold.")]
    title = _document_title(payload, artifact_path)

    lines = [
        f"# {title}",
        "",
        f"_Artifact generated on {payload['generated_at']}_",
        "",
        "This weekly summary is not publish-ready and should stay in internal review.",
        "",
        f"- Artifact type: `{artifact_kind}`",
        f"- Health status: `{health['overall_status']}`",
        "",
        "## Hold Reasons",
        "",
    ]

    for reason in reasons:
        lines.append(f"- {reason}")

    if payload.get("public_notice"):
        lines.extend(["", "## Publication Notice", "", payload["public_notice"]])

    lines.extend(
        [
            "",
            "## Internal Reference",
            "",
            f"- Source: `{internal_reference.get('collector_source', 'unknown')}`",
            f"- Compare enabled: `{internal_reference.get('compare_enabled', False)}`",
            f"- Category filter: `{internal_reference.get('category_filter')}`",
            f"- Normalized models: `{internal_reference.get('normalized_models')}`",
        ]
    )
    return "\n".join(lines).strip() + "\n"


def render_publish_markdown(payload: dict, artifact_path: Path) -> str:
    if payload["publish_ready"]:
        body = build_publish_markdown(payload, artifact_path)
    else:
        body = build_hold_markdown(payload, artifact_path)
    return _render_front_matter(payload, artifact_path) + body


def markdown_output_path(artifact_path: Path) -> Path:
    return Path("data/output") / f"{artifact_path.stem}.md"


def export_markdown(markdown_text: str, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as handle:
        handle.write(markdown_text)
    print(f"[MARKDOWN] {output_path.resolve()}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Render publication Markdown from artifact JSON")
    parser.add_argument("--artifact", required=True)
    parser.add_argument("--output")
    args = parser.parse_args()

    artifact_path = Path(args.artifact)
    payload = load_publish_artifact(artifact_path)
    markdown_text = render_publish_markdown(payload, artifact_path)

    output_path = Path(args.output) if args.output else markdown_output_path(artifact_path)
    export_markdown(markdown_text, output_path)


if __name__ == "__main__":
    try:
        main()
    except ValueError as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
