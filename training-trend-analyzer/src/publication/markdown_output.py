"""Helpers for publish Markdown metadata and front matter."""

from __future__ import annotations

from pathlib import Path


def artifact_kind(payload: dict, artifact_path: Path) -> str:
    compare_summary = payload["public_summary"].get("compare_summary")
    if compare_summary is not None:
        return "compare"
    if artifact_path.stem.startswith("publish_ready_compare_"):
        return "compare"
    return "ranking"


def content_kind(payload: dict, artifact_path: Path) -> str:
    if not payload["publish_ready"]:
        return "publish_hold"
    return artifact_kind(payload, artifact_path)


def week_compact(week: str) -> str:
    return week.replace("-", "")


def document_title(payload: dict, artifact_path: Path) -> str:
    week = payload["week"]
    kind = artifact_kind(payload, artifact_path)
    if not payload["publish_ready"]:
        return f"Publish Hold: {week}"
    if kind == "compare":
        return f"Weekly Training Trend Source Set Comparison: {week}"
    return f"Weekly Training Trend Update: {week}"


def document_slug(payload: dict, artifact_path: Path) -> str:
    week_token = week_compact(payload["week"])
    kind = artifact_kind(payload, artifact_path)
    if not payload["publish_ready"]:
        return f"training-trends-hold-{week_token}"
    if kind == "compare":
        return f"training-trends-compare-{week_token}"
    return f"training-trends-{week_token}"


def document_summary(payload: dict) -> str:
    if payload["publish_ready"]:
        return payload["public_summary"]["headline"]

    reasons = payload["health"].get("reasons") or []
    if reasons:
        return reasons[0]
    return payload.get("public_notice") or "Publication is on hold."


def hold_reason(payload: dict) -> str:
    reasons = payload["health"].get("reasons") or []
    if reasons:
        return " | ".join(reasons)
    return payload.get("public_notice") or "Publication is on hold."


def build_front_matter_data(payload: dict, artifact_path: Path) -> dict:
    kind = artifact_kind(payload, artifact_path)
    metadata = {
        "schema_version": payload["schema_version"],
        "content_kind": content_kind(payload, artifact_path),
        "week": payload["week"],
        "generated_at": payload["generated_at"],
        "publish_ready": payload["publish_ready"],
        "title": document_title(payload, artifact_path),
        "slug": document_slug(payload, artifact_path),
        "summary": document_summary(payload),
        "internal_reference": payload["internal_reference"],
    }
    if payload.get("public_notice"):
        metadata["publication_notice"] = payload["public_notice"]
    if kind == "compare":
        metadata["compare_mode"] = True
    if not payload["publish_ready"]:
        metadata["hold_reason"] = hold_reason(payload)
    return metadata


def yaml_scalar(value) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if value is None:
        return "null"
    if isinstance(value, (int, float)):
        return str(value)
    text = str(value).replace("'", "''")
    return f"'{text}'"


def yaml_lines(value, *, indent: int = 0) -> list[str]:
    prefix = " " * indent
    if isinstance(value, dict):
        lines = []
        for key, child in value.items():
            if isinstance(child, (dict, list)):
                lines.append(f"{prefix}{key}:")
                lines.extend(yaml_lines(child, indent=indent + 2))
            else:
                lines.append(f"{prefix}{key}: {yaml_scalar(child)}")
        return lines
    if isinstance(value, list):
        lines = []
        for child in value:
            if isinstance(child, (dict, list)):
                lines.append(f"{prefix}-")
                lines.extend(yaml_lines(child, indent=indent + 2))
            else:
                lines.append(f"{prefix}- {yaml_scalar(child)}")
        return lines
    return [f"{prefix}{yaml_scalar(value)}"]


def render_front_matter(payload: dict, artifact_path: Path) -> str:
    metadata = build_front_matter_data(payload, artifact_path)
    lines = ["---", *yaml_lines(metadata), "---", ""]
    return "\n".join(lines)


def parse_front_matter(markdown_text: str) -> dict:
    if not markdown_text.startswith("---\n"):
        raise ValueError("Markdown front matter is required at the top of the document")

    _open, _sep, remainder = markdown_text.partition("---\n")
    front_matter_block, separator, _body = remainder.partition("\n---\n")
    if separator != "\n---\n":
        raise ValueError("Markdown front matter closing delimiter is missing")

    lines = [line for line in front_matter_block.splitlines() if line.strip()]
    root: dict = {}
    stack: list[tuple[int, dict]] = [(-1, root)]

    for line in lines:
        indent = len(line) - len(line.lstrip(" "))
        stripped = line.strip()
        if stripped.startswith("-"):
            raise ValueError("Unsupported front matter list syntax in Markdown metadata")
        key, separator, raw_value = stripped.partition(":")
        if separator != ":":
            raise ValueError(f"Invalid front matter line: {line}")

        while len(stack) > 1 and indent <= stack[-1][0]:
            stack.pop()

        current = stack[-1][1]
        value = raw_value.strip()
        if value == "":
            child: dict = {}
            current[key] = child
            stack.append((indent, child))
            continue

        current[key] = _parse_yaml_scalar(value)

    return root


def _parse_yaml_scalar(raw_value: str):
    if raw_value == "true":
        return True
    if raw_value == "false":
        return False
    if raw_value == "null":
        return None
    if raw_value.startswith("'") and raw_value.endswith("'"):
        return raw_value[1:-1].replace("''", "'")
    try:
        if "." in raw_value:
            return float(raw_value)
        return int(raw_value)
    except ValueError:
        return raw_value
