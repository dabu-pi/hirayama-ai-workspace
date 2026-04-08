"""
Shared helpers for autocomplete-style collectors.
"""

from __future__ import annotations

from datetime import date
from typing import Any
from urllib.parse import urlencode


def to_week_start(day: date) -> str:
    return date.fromordinal(day.toordinal() - day.weekday()).isoformat()


def target_fields(canonical_target: str | None) -> tuple[str, str, str]:
    if not canonical_target:
        return "", "", ""
    if "::" in canonical_target:
        brand, model = canonical_target.split("::", 1)
        return brand, model, ""
    return "", "", canonical_target


def is_effective_suggestion(query_term: str, suggestion_text: str) -> bool:
    if not suggestion_text.strip():
        return False
    return suggestion_text.strip().lower() != query_term.strip().lower()


def build_source_url(endpoint: str, **params: Any) -> str:
    return f"{endpoint}?{urlencode(params)}"


def extract_suggestion_texts(payload: Any) -> list[str]:
    candidates = payload[1] if isinstance(payload, list) and len(payload) > 1 else []
    if not isinstance(candidates, list):
        return []

    texts: list[str] = []
    for candidate in candidates:
        text = _extract_candidate_text(candidate)
        if text:
            texts.append(text)
    return texts


def _extract_candidate_text(candidate: Any) -> str | None:
    if isinstance(candidate, str):
        text = candidate.strip()
        return text or None

    if isinstance(candidate, dict):
        for key in ("suggestion", "text", "query", "value"):
            value = candidate.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        return None

    if isinstance(candidate, list) and candidate:
        first = candidate[0]
        if isinstance(first, str) and first.strip():
            return first.strip()
        if isinstance(first, dict):
            return _extract_candidate_text(first)
        if isinstance(first, list):
            return _extract_candidate_text(first)

    return None
