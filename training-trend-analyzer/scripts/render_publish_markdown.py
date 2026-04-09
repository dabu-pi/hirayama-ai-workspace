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

    lines = [
        f"# Weekly Training Trend Update: {payload['week']}",
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

    lines = [
        f"# Publish Hold: {payload['week']}",
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
        return build_publish_markdown(payload, artifact_path)
    return build_hold_markdown(payload, artifact_path)


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
