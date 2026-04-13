"""
YouTube Suggest collector for lightweight autocomplete support signals.

This collector mirrors the Google Suggest pipeline while using YouTube-oriented
autocomplete suggestions as a third, low-weight support source.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from datetime import date, datetime, timezone
from pathlib import Path
from statistics import mean
from typing import Any

import requests

from .base import BaseCollector, CollectResult, RawMetric
from .suggest_common import (
    build_source_url,
    extract_suggestion_texts,
    is_effective_suggestion,
    target_fields,
    to_week_start,
)

DEFAULT_SEED_CONFIG = Path(__file__).parent.parent.parent / "config" / "trends" / "seed_queries.json"
DEFAULT_MOCK_FIXTURE = Path(__file__).parent.parent.parent / "data" / "mock" / "youtube_suggest" / "jp_seed_fixture.json"
YOUTUBE_SUGGEST_COUNT_METRIC = "youtube_suggest_count"
YOUTUBE_SUGGEST_PRESENCE_METRIC = "youtube_suggest_presence"
YOUTUBE_SUGGEST_OBSERVATION_METRIC = "youtube_suggest_rank"
YOUTUBE_SUGGEST_ENDPOINT = "https://suggestqueries.google.com/complete/search"


@dataclass
class YouTubeSuggestSeed:
    seed_id: str
    label: str
    seed_type: str
    queries: list[str]
    canonical_target: str | None = None
    query_group: str | None = None
    emit_to_source_metrics: bool = False
    hl: str = "ja"
    gl: str = "jp"
    client: str = "firefox"
    ds: str = "yt"
    collection_mode: str = "auto"


@dataclass
class YouTubeSuggestObservation:
    collected_date: str
    week_start: str
    source_name: str
    raw_name: str
    query_term: str
    suggestion_text: str
    suggestion_rank: int
    metric_type: str
    metric_value: float
    language: str
    country: str
    collection_mode: str
    source_url: str
    note: str
    seed_id: str
    seed_label: str
    seed_type: str
    query_group: str
    canonical_target: str | None
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        row = asdict(self)
        row["metadata_json"] = json.dumps(row.pop("metadata"), ensure_ascii=False, sort_keys=True)
        return row


@dataclass
class YouTubeSuggestBatch:
    source_name: str
    collected_at: str
    mode_requested: str
    mode_used: str
    observations: list[YouTubeSuggestObservation] = field(default_factory=list)
    import_rows: list[dict[str, Any]] = field(default_factory=list)
    raw_payloads: list[dict[str, Any]] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


class YouTubeSuggestCollector(BaseCollector):
    def __init__(
        self,
        seed_config_path: Path = DEFAULT_SEED_CONFIG,
        mock_fixture_path: Path = DEFAULT_MOCK_FIXTURE,
        timeout_sec: int = 15,
    ):
        super().__init__("youtube_suggest")
        self.seed_config_path = seed_config_path
        self.mock_fixture_path = mock_fixture_path
        self.timeout_sec = timeout_sec

    def load_seeds(self) -> list[YouTubeSuggestSeed]:
        with open(self.seed_config_path, encoding="utf-8") as handle:
            payload = json.load(handle)

        defaults = payload.get("defaults", {})
        seeds = []
        for row in payload.get("seeds", []):
            seeds.append(
                YouTubeSuggestSeed(
                    seed_id=row["seed_id"],
                    label=row["label"],
                    seed_type=row["seed_type"],
                    queries=list(row.get("queries", [])),
                    canonical_target=row.get("canonical_target"),
                    query_group=row.get("query_group"),
                    emit_to_source_metrics=bool(row.get("emit_to_source_metrics", False)),
                    hl=row.get("hl", defaults.get("hl", "ja")),
                    gl=row.get("gl", defaults.get("region", "jp")),
                    client=row.get("youtube_client", "firefox"),
                    ds=row.get("youtube_ds", "yt"),
                    collection_mode=row.get("collection_mode", defaults.get("collection_mode", "auto")),
                )
            )
        return seeds

    def collect_bundle(
        self,
        mode: str = "auto",
        seed_ids: list[str] | None = None,
        max_seeds: int | None = None,
    ) -> YouTubeSuggestBatch:
        seeds = self.load_seeds()
        if seed_ids:
            wanted = set(seed_ids)
            seeds = [seed for seed in seeds if seed.seed_id in wanted]
        if max_seeds is not None:
            seeds = seeds[:max_seeds]

        batch = YouTubeSuggestBatch(
            source_name=self.source_name,
            collected_at=datetime.now(timezone.utc).astimezone().isoformat(),
            mode_requested=mode,
            mode_used=mode,
        )

        if mode == "mock":
            self._collect_mock(seeds, batch)
        elif mode == "live":
            self._collect_live(seeds, batch)
        else:
            try:
                self._collect_live(seeds, batch)
                if not batch.observations:
                    batch.errors.append("auto fallback: live returned no observations")
                    batch.mode_used = "mock"
                    self._collect_mock(seeds, batch)
            except Exception as exc:
                batch.errors.append(f"live fallback: {exc}")
                batch.mode_used = "mock"
                self._collect_mock(seeds, batch)

        batch.import_rows = self._aggregate_import_rows(batch.observations)
        return batch

    def collect(self, keywords: list[str], week_start: str) -> CollectResult:
        batch = self.collect_bundle(mode="mock", seed_ids=keywords or None)
        result = CollectResult(source_name=self.source_name)
        for row in batch.import_rows:
            if row["week_start"] != week_start or row["metric_type"] != YOUTUBE_SUGGEST_COUNT_METRIC:
                continue
            result.metrics.append(
                RawMetric(
                    source_name=row["source_name"],
                    brand_name=row.get("raw_brand", ""),
                    model_name=row.get("raw_name", ""),
                    category_name=row.get("raw_category", ""),
                    week_start=row["week_start"],
                    metric_type=row["metric_type"],
                    value=row["metric_value"],
                    value_prev=None,
                    sample_size=row.get("sample_size"),
                    is_estimated=False,
                    raw_data=row.get("metadata_json"),
                )
            )
        result.errors.extend(batch.errors)
        return result

    def _collect_mock(self, seeds: list[YouTubeSuggestSeed], batch: YouTubeSuggestBatch) -> None:
        batch.mode_used = "mock"
        if not self.mock_fixture_path.exists():
            batch.errors.append(f"mock fixture not found: {self.mock_fixture_path}")
            return

        with open(self.mock_fixture_path, encoding="utf-8") as handle:
            payload = json.load(handle)

        series_map = {row["seed_id"]: row.get("queries", []) for row in payload.get("series", [])}
        collected_date = datetime.now().date().isoformat()
        week_start = to_week_start(date.fromisoformat(collected_date))

        for seed in seeds:
            query_rows = series_map.get(seed.seed_id)
            if not query_rows:
                continue
            batch.raw_payloads.append({"seed_id": seed.seed_id, "mode": "mock", "queries": query_rows})
            for query_row in query_rows:
                self._append_query_observations(
                    batch=batch,
                    seed=seed,
                    collected_date=collected_date,
                    week_start=week_start,
                    query_term=query_row["query_term"],
                    suggestions=list(query_row.get("suggestions", [])),
                    mode_used="mock",
                    note_prefix="mock youtube suggest",
                )

    def _collect_live(self, seeds: list[YouTubeSuggestSeed], batch: YouTubeSuggestBatch) -> None:
        batch.mode_used = "live"
        collected_date = datetime.now().date().isoformat()
        week_start = to_week_start(date.fromisoformat(collected_date))
        session = requests.Session()
        session.headers.update({"User-Agent": "Mozilla/5.0"})

        for seed in seeds:
            query_payloads = []
            for query_term in seed.queries:
                try:
                    response = session.get(
                        YOUTUBE_SUGGEST_ENDPOINT,
                        params={
                            "client": seed.client,
                            "ds": seed.ds,
                            "hl": seed.hl,
                            "gl": seed.gl,
                            "q": query_term,
                        },
                        timeout=self.timeout_sec,
                    )
                    response.raise_for_status()
                    payload = response.json()
                    suggestions = extract_suggestion_texts(payload)
                except Exception as exc:
                    batch.errors.append(f"live query failed: {seed.seed_id}/{query_term}: {exc}")
                    continue

                query_payloads.append({"query_term": query_term, "suggestions": suggestions, "payload": payload})
                self._append_query_observations(
                    batch=batch,
                    seed=seed,
                    collected_date=collected_date,
                    week_start=week_start,
                    query_term=query_term,
                    suggestions=suggestions,
                    mode_used="live",
                    note_prefix="live youtube suggest",
                )
            batch.raw_payloads.append({"seed_id": seed.seed_id, "mode": "live", "queries": query_payloads})

    def _append_query_observations(
        self,
        batch: YouTubeSuggestBatch,
        seed: YouTubeSuggestSeed,
        collected_date: str,
        week_start: str,
        query_term: str,
        suggestions: list[str],
        mode_used: str,
        note_prefix: str,
    ) -> None:
        if not suggestions:
            batch.observations.append(
                YouTubeSuggestObservation(
                    collected_date=collected_date,
                    week_start=week_start,
                    source_name=self.source_name,
                    raw_name=seed.canonical_target or seed.label,
                    query_term=query_term,
                    suggestion_text="",
                    suggestion_rank=0,
                    metric_type=YOUTUBE_SUGGEST_OBSERVATION_METRIC,
                    metric_value=0.0,
                    language=seed.hl,
                    country=seed.gl.upper(),
                    collection_mode=mode_used,
                    source_url=self._build_source_url(seed, query_term),
                    note=f"{note_prefix} seed={seed.seed_id} no suggestions",
                    seed_id=seed.seed_id,
                    seed_label=seed.label,
                    seed_type=seed.seed_type,
                    query_group=seed.query_group or "",
                    canonical_target=seed.canonical_target,
                    metadata={"suggestion_count_for_query": 0},
                )
            )
            return

        for index, suggestion_text in enumerate(suggestions, start=1):
            batch.observations.append(
                YouTubeSuggestObservation(
                    collected_date=collected_date,
                    week_start=week_start,
                    source_name=self.source_name,
                    raw_name=seed.canonical_target or seed.label,
                    query_term=query_term,
                    suggestion_text=suggestion_text,
                    suggestion_rank=index,
                    metric_type=YOUTUBE_SUGGEST_OBSERVATION_METRIC,
                    metric_value=float(index),
                    language=seed.hl,
                    country=seed.gl.upper(),
                    collection_mode=mode_used,
                    source_url=self._build_source_url(seed, query_term),
                    note=f"{note_prefix} seed={seed.seed_id}",
                    seed_id=seed.seed_id,
                    seed_label=seed.label,
                    seed_type=seed.seed_type,
                    query_group=seed.query_group or "",
                    canonical_target=seed.canonical_target,
                    metadata={"suggestion_count_for_query": len(suggestions)},
                )
            )

    def _aggregate_import_rows(self, observations: list[YouTubeSuggestObservation]) -> list[dict[str, Any]]:
        grouped: dict[tuple[str, str], list[YouTubeSuggestObservation]] = {}
        for obs in observations:
            if obs.seed_type != "model" or not obs.canonical_target:
                continue
            grouped.setdefault((obs.seed_id, obs.week_start), []).append(obs)

        rows: list[dict[str, Any]] = []
        for (seed_id, week_start), items in sorted(grouped.items()):
            seed = items[0]
            brand, model, category = target_fields(seed.canonical_target)
            query_terms = sorted({item.query_term for item in items})
            suggestion_count_by_query = {}
            for query_term in query_terms:
                effective_suggestions = [
                    item.suggestion_text
                    for item in items
                    if item.query_term == query_term and is_effective_suggestion(query_term, item.suggestion_text)
                ]
                suggestion_count_by_query[query_term] = len(
                    {suggestion.lower().strip() for suggestion in effective_suggestions if suggestion.strip()}
                )

            avg_count = round(mean(suggestion_count_by_query.values()), 3) if suggestion_count_by_query else 0.0
            presence = 1.0 if avg_count > 0 else 0.0
            base_metadata = {
                "seed_id": seed_id,
                "canonical_target": seed.canonical_target,
                "query_terms": query_terms,
                "suggestion_count_by_query": suggestion_count_by_query,
                "collection_mode": seed.collection_mode,
                "query_group": seed.query_group,
                "endpoint_family": "youtube_autocomplete",
            }

            rows.append(
                self._build_import_row(
                    seed=seed,
                    week_start=week_start,
                    brand=brand,
                    model=model,
                    category=category,
                    metric_type=YOUTUBE_SUGGEST_COUNT_METRIC,
                    metric_value=avg_count,
                    sample_size=len(query_terms),
                    note=f"average youtube suggestion count across {len(query_terms)} queries",
                    metadata=base_metadata,
                )
            )
            rows.append(
                self._build_import_row(
                    seed=seed,
                    week_start=week_start,
                    brand=brand,
                    model=model,
                    category=category,
                    metric_type=YOUTUBE_SUGGEST_PRESENCE_METRIC,
                    metric_value=presence,
                    sample_size=len(query_terms),
                    note=f"youtube suggestion presence flag from {len(query_terms)} queries",
                    metadata=base_metadata,
                )
            )
        return rows

    def _build_import_row(
        self,
        seed: YouTubeSuggestObservation,
        week_start: str,
        brand: str,
        model: str,
        category: str,
        metric_type: str,
        metric_value: float,
        sample_size: int,
        note: str,
        metadata: dict[str, Any],
    ) -> dict[str, Any]:
        return {
            "collected_date": seed.collected_date,
            "source_name": self.source_name,
            "raw_brand": brand,
            "raw_name": model,
            "raw_category": category,
            "metric_type": metric_type,
            "metric_value": metric_value,
            "region": seed.language,
            "country": seed.country,
            "language": seed.language,
            "query_term": " | ".join(metadata["query_terms"]),
            "source_url": seed.source_url,
            "note": note,
            "seed_id": seed.seed_id,
            "seed_label": seed.seed_label,
            "seed_type": seed.seed_type,
            "query_group": seed.query_group,
            "collection_mode": seed.collection_mode,
            "canonical_target": seed.canonical_target,
            "sample_size": sample_size,
            "metadata_json": json.dumps(metadata, ensure_ascii=False, sort_keys=True),
            "week_start": week_start,
        }

    @staticmethod
    def _build_source_url(seed: YouTubeSuggestSeed, query_term: str) -> str:
        return build_source_url(
            YOUTUBE_SUGGEST_ENDPOINT,
            client=seed.client,
            ds=seed.ds,
            hl=seed.hl,
            gl=seed.gl,
            q=query_term,
        )
