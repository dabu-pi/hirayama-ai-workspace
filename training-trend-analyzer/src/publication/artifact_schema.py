"""Contract helpers for publish-ready artifact schema handling."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

PUBLISH_READY_SCHEMA_VERSION = "publish-ready/v1"
SUPPORTED_PUBLISH_READY_SCHEMA_VERSIONS = (PUBLISH_READY_SCHEMA_VERSION,)


def build_publish_ready_schema_fields() -> dict[str, str]:
    return {"schema_version": PUBLISH_READY_SCHEMA_VERSION}


def validate_publish_ready_schema_version(payload: Mapping[str, Any]) -> str:
    supported_versions = ", ".join(SUPPORTED_PUBLISH_READY_SCHEMA_VERSIONS)
    schema_version = payload.get("schema_version")

    if schema_version is None:
        legacy_version = payload.get("artifact_version")
        legacy_hint = ""
        if legacy_version is not None:
            legacy_hint = f" Found legacy artifact_version={legacy_version!r}."
        raise ValueError(
            "Artifact schema_version is required. "
            "Legacy artifacts without schema_version are not supported."
            f"{legacy_hint} Supported schema_version(s): {supported_versions}"
        )

    if schema_version not in SUPPORTED_PUBLISH_READY_SCHEMA_VERSIONS:
        raise ValueError(
            f"Unsupported artifact schema_version: {schema_version!r}. "
            f"Supported schema_version(s): {supported_versions}"
        )

    return schema_version
