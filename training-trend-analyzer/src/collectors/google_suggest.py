"""
Google Suggest collector for lightweight autocomplete support signals.

This collector reuses the project seed config and stores:
1. raw per-query suggestion payloads
2. observation rows per suggestion rank
3. import-ready aggregated metrics for model seeds only
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from datetime import date, datetime, timezone
from pathlib import Path
from statistics import mean
from typing import Any
from urllib.parse import urlencode

import requests

from .base import BaseCollector, CollectResult, RawMetric

DEFAULT_SEED_CONFIG = Path(__file__).parent.parent.parent / "config" / "trends" / "seed_queries.json"
DEFAULT_MOCK_FIXTURE = Path(__file__).parent.parent.parent / "data" / "mock" / "google_suggest" / "jp_seed_fixture.json"
GOOGLE_SUGGEST_COUNT_METRIC = "search_suggest_count"
GOOGLE_SUGGEST_PRESENCE_METRIC = "search_suggest_presence"
GOOGLE_SUGGEST_OBSERVATION_METRIC = "search_suggest_rank"
GOOGLE_SUGGEST_ENDPOINT = "https://suggestqueries.google.com/complete/search"


@dataclass
class GoogleSuggestSeed:
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
    collection_mode: str = "auto"


@dataclass
class GoogleSuggestObservation:
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
class GoogleSuggestBatch:
    source_name: str
    collected_at: str
    mode_requested: str
    mode_used: str
    observations: list[GoogleSuggestObservation] = field(default_factory=list)
    import_rows: list[dict[str, Any]] = field(default_factory=list)
    raw_payloads: list[dict[str, Any]] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


class GoogleSuggestCollector(BaseCollector):
    def __init__(
        self,
        seed_config_path: Path = DEFAULT_SEED_CONFIG,
        mock_fixture_path: Path = DEFAULT_MOCK_FIXTURE,
        timeout_sec: int = 15,
    ):
        super().__init__("google_suggest")
        self.seed_config_path = seed_config_path
        self.mock_fixture_path = mock_fixture_path
        self.timeout_sec = timeout_sec

    def load_seeds(self) -> list[GoogleSuggestSeed]:
        with open(self.seed_config_path, encoding="utf-8") as handle:
            payload = json.load(handle)

        defaults = payload.get("defaults", {})
        seeds = []
        for row in payload.get("seeds", []):
            seeds.append(
                GoogleSuggestSeed(
                    seed_id=row["seed_id"],
                    label=row["label"],
                    seed_type=row["seed_type"],
                    queries=list(row.get("queries", [])),
                    canonical_target=row.get("canonical_target"),
                    query_group=row.get("query_group"),
                    emit_to_source_metrics=bool(row.get("emit_to_source_metrics", False)),
                    hl=row.get("hl", defaults.get("hl", "ja")),
                    gl=row.get("gl", defaults.get("region", "jp")),
                    client=row.get("client", "firefox"),
                    collection_mode=row.get("collection_mode", defaults.get("collection_mode", "auto")),
                )
            )
        return seeds

    def collect_bundle(
        self,
        mode: str = "auto",
        seed_ids: list[str] | None = None,
        max_seeds: int | None = None,
    ) -> GoogleSuggestBatch:
        seeds = self.load_seeds()
        if seed_ids:
            wanted = set(seed_ids)
            seeds = [seed for seed in seeds if seed.seed_id in wanted]
        if max_seeds is not None:
            seeds = seeds[:max_seeds]

        batch = GoogleSuggestBatch(
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
            if row["week_start"] != week_start or row["metric_type"] != GOOGLE_SUGGEST_COUNT_METRIC:
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

    def _collect_mock(self, seeds: list[GoogleSuggestSeed], batch: GoogleSuggestBatch) -> None:
        batch.mode_used = "mock"
        if not self.mock_fixture_path.exists():
            batch.errors.append(f"mock fixture not found: {self.mock_fixture_path}")
            return

        with open(self.mock_fixture_path, encoding="utf-8") as handle:
            payload = json.load(handle)

        series_map = {row["seed_id"]: row.get("queries", []) for row in payload.get("series", [])}
        collected_date = datetime.now().date().isoformat()
        week_start = self._to_week_start(date.fromisoformat(collected_date))

        for seed in seeds:
            query_rows = series_map.get(seed.seed_id)
            if not query_rows:
                continue
            batch.raw_payloads.append({"seed_id": seed.seed_id, "mode": "mock", "queries": query_rows})
            for query_row in query_rows:
                query_term = query_row["query_term"]
                suggestions = query_row.get("suggestions", [])
                if not suggestions:
                    batch.observations.append(
                        GoogleSuggestObservation(
                            collected_date=collected_date,
                            week_start=week_start,
                            source_name=self.source_name,
                            raw_name=seed.canonical_target or seed.label,
                            query_term=query_term,
                            suggestion_text="",
                            suggestion_rank=0,
                            metric_type=GOOGLE_SUGGEST_OBSERVATION_METRIC,
                            metric_value=0.0,
                            language=seed.hl,
                            country=seed.gl.upper(),
                            collection_mode="mock",
                            source_url=self._build_source_url(seed, query_term),
                            note=f"mock fixture seed={seed.seed_id} no suggestions",
                            seed_id=seed.seed_id,
                            seed_label=seed.label,
                            seed_type=seed.seed_type,
                            query_group=seed.query_group or "",
                            canonical_target=seed.canonical_target,
                            metadata={"suggestion_count_for_query": 0},
                        )
                    )
                for index, suggestion_text in enumerate(suggestions, start=1):
                    batch.observations.append(
                        GoogleSuggestObservation(
                            collected_date=collected_date,
                            week_start=week_start,
                            source_name=self.source_name,
                            raw_name=seed.canonical_target or seed.label,
                            query_term=query_term,
                            suggestion_text=suggestion_text,
                            suggestion_rank=index,
                            metric_type=GOOGLE_SUGGEST_OBSERVATION_METRIC,
                            metric_value=float(index),
                            language=seed.hl,
                            country=seed.gl.upper(),
                            collection_mode="mock",
                            source_url=self._build_source_url(seed, query_term),
                            note=f"mock fixture seed={seed.seed_id}",
                            seed_id=seed.seed_id,
                            seed_label=seed.label,
                            seed_type=seed.seed_type,
                            query_group=seed.query_group or "",
                            canonical_target=seed.canonical_target,
                            metadata={"suggestion_count_for_query": len(suggestions)},
                        )
                    )

    def _collect_live(self, seeds: list[GoogleSuggestSeed], batch: GoogleSuggestBatch) -> None:
        batch.mode_used = "live"
        collected_date = datetime.now().date().isoformat()
        week_start = self._to_week_start(date.fromisoformat(collected_date))
        session = requests.Session()
        session.headers.update({"User-Agent": "Mozilla/5.0"})

        for seed in seeds:
            query_payloads = []
            for query_term in seed.queries:
                try:
                    response = session.get(
                        GOOGLE_SUGGEST_ENDPOINT,
                        params={"client": seed.client, "hl": seed.hl, "gl": seed.gl, "q": query_term},
                        timeout=self.timeout_sec,
                    )
                    response.raise_for_status()
                    payload = response.json()
                except Exception as exc:
                    batch.errors.append(f"live query failed: {seed.seed_id}/{query_term}: {exc}")
                    continue

                suggestions = payload[1] if isinstance(payload, list) and len(payload) > 1 else []
                query_payloads.append({"query_term": query_term, "suggestions": suggestions})
                if not suggestions:
                    batch.observations.append(
                        GoogleSuggestObservation(
                            collected_date=collected_date,
                            week_start=week_start,
                            source_name=self.source_name,
                            raw_name=seed.canonical_target or seed.label,
                            query_term=query_term,
                            suggestion_text="",
                            suggestion_rank=0,
                            metric_type=GOOGLE_SUGGEST_OBSERVATION_METRIC,
                            metric_value=0.0,
                            language=seed.hl,
                            country=seed.gl.upper(),
                            collection_mode="live",
                            source_url=self._build_source_url(seed, query_term),
                            note=f"live google suggest seed={seed.seed_id} no suggestions",
                            seed_id=seed.seed_id,
                            seed_label=seed.label,
                            seed_type=seed.seed_type,
                            query_group=seed.query_group or "",
                            canonical_target=seed.canonical_target,
                            metadata={"suggestion_count_for_query": 0},
                        )
                    )
                for index, suggestion_text in enumerate(suggestions, start=1):
                    batch.observations.append(
                        GoogleSuggestObservation(
                            collected_date=collected_date,
                            week_start=week_start,
                            source_name=self.source_name,
                            raw_name=seed.canonical_target or seed.label,
                            query_term=query_term,
                            suggestion_text=suggestion_text,
                            suggestion_rank=index,
                            metric_type=GOOGLE_SUGGEST_OBSERVATION_METRIC,
                            metric_value=float(index),
                            language=seed.hl,
                            country=seed.gl.upper(),
                            collection_mode="live",
                            source_url=self._build_source_url(seed, query_term),
                            note=f"live google suggest seed={seed.seed_id}",
                            seed_id=seed.seed_id,
                            seed_label=seed.label,
                            seed_type=seed.seed_type,
                            query_group=seed.query_group or "",
                            canonical_target=seed.canonical_target,
                            metadata={"suggestion_count_for_query": len(suggestions)},
                        )
                    )
            batch.raw_payloads.append({"seed_id": seed.seed_id, "mode": "live", "queries": query_payloads})

    def _aggregate_import_rows(self, observations: list[GoogleSuggestObservation]) -> list[dict[str, Any]]:
        grouped: dict[tuple[str, str], list[GoogleSuggestObservation]] = {}
        for obs in observations:
            if obs.seed_type != "model" or not obs.canonical_target:
                continue
            grouped.setdefault((obs.seed_id, obs.week_start), []).append(obs)

        rows: list[dict[str, Any]] = []
        for (seed_id, week_start), items in sorted(grouped.items()):
            seed = items[0]
            brand, model, category = self._target_fields(seed.canonical_target)
            query_terms = sorted({item.query_term for item in items})
            suggestion_count_by_query = {}
            for query_term in query_terms:
                effective_suggestions = [
                    item.suggestion_text
                    for item in items
                    if item.query_term == query_term and self._is_effective_suggestion(query_term, item.suggestion_text)
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
            }

            rows.append(
                self._build_import_row(
                    seed=seed,
                    week_start=week_start,
                    brand=brand,
                    model=model,
                    category=category,
                    metric_type=GOOGLE_SUGGEST_COUNT_METRIC,
                    metric_value=avg_count,
                    sample_size=len(query_terms),
                    note=f"average suggestion count across {len(query_terms)} queries",
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
                    metric_type=GOOGLE_SUGGEST_PRESENCE_METRIC,
                    metric_value=presence,
                    sample_size=len(query_terms),
                    note=f"presence flag from {len(query_terms)} queries",
                    metadata=base_metadata,
                )
            )
        return rows

    def _build_import_row(
        self,
        seed: GoogleSuggestObservation,
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
    def _target_fields(canonical_target: str | None) -> tuple[str, str, str]:
        if not canonical_target:
            return "", "", ""
        if "::" in canonical_target:
            brand, model = canonical_target.split("::", 1)
            return brand, model, ""
        return "", "", canonical_target

    @staticmethod
    def _to_week_start(day: date) -> str:
        return date.fromordinal(day.toordinal() - day.weekday()).isoformat()

    @staticmethod
    def _build_source_url(seed: GoogleSuggestSeed, query_term: str) -> str:
        query = urlencode({"client": seed.client, "hl": seed.hl, "gl": seed.gl, "q": query_term})
        return f"{GOOGLE_SUGGEST_ENDPOINT}?{query}"

    @staticmethod
    def _is_effective_suggestion(query_term: str, suggestion_text: str) -> bool:
        if not suggestion_text.strip():
            return False
        return suggestion_text.strip().lower() != query_term.strip().lower()
