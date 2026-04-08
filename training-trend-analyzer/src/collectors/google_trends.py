"""
Google Trends collector for a small, reviewable Phase 3 starter flow.

The collector keeps three layers separate:
1. raw/observation level weekly values per query term
2. import-safe aggregated rows for model seeds only
3. optional live fetch with fallback to mock fixture
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from datetime import date, datetime, timezone
from pathlib import Path
from statistics import mean
from typing import Any
from urllib.parse import urlencode

from .base import BaseCollector, CollectResult, RawMetric

DEFAULT_SEED_CONFIG = Path(__file__).parent.parent.parent / "config" / "trends" / "seed_queries.json"
DEFAULT_MOCK_FIXTURE = Path(__file__).parent.parent.parent / "data" / "mock" / "google_trends" / "jp_seed_fixture.json"
GOOGLE_TRENDS_METRIC = "google_trends_interest"


@dataclass
class GoogleTrendsSeed:
    seed_id: str
    label: str
    seed_type: str
    queries: list[str]
    canonical_target: str | None = None
    query_group: str | None = None
    emit_to_source_metrics: bool = False
    geo: str = "JP"
    region: str = "jp"
    timeframe: str = "today 3-m"
    collection_mode: str = "auto"


@dataclass
class GoogleTrendsObservation:
    collected_date: str
    week_start: str
    source_name: str
    raw_name: str
    metric_type: str
    metric_value: float
    region: str
    country: str
    query_term: str
    source_url: str
    note: str
    seed_id: str
    seed_label: str
    seed_type: str
    query_group: str
    canonical_target: str | None
    timeframe: str
    geo: str
    collection_mode: str
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        row = asdict(self)
        row["metadata_json"] = json.dumps(row.pop("metadata"), ensure_ascii=False, sort_keys=True)
        return row


@dataclass
class GoogleTrendsBatch:
    source_name: str
    collected_at: str
    mode_requested: str
    mode_used: str
    observations: list[GoogleTrendsObservation] = field(default_factory=list)
    import_rows: list[dict[str, Any]] = field(default_factory=list)
    raw_payloads: list[dict[str, Any]] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)

    @property
    def success(self) -> bool:
        return not self.errors


class GoogleTrendsCollector(BaseCollector):
    def __init__(
        self,
        seed_config_path: Path = DEFAULT_SEED_CONFIG,
        mock_fixture_path: Path = DEFAULT_MOCK_FIXTURE,
    ):
        super().__init__("google_trends")
        self.seed_config_path = seed_config_path
        self.mock_fixture_path = mock_fixture_path

    def load_seeds(self) -> list[GoogleTrendsSeed]:
        with open(self.seed_config_path, encoding="utf-8") as handle:
            payload = json.load(handle)

        defaults = payload.get("defaults", {})
        seeds = []
        for row in payload.get("seeds", []):
            seeds.append(
                GoogleTrendsSeed(
                    seed_id=row["seed_id"],
                    label=row["label"],
                    seed_type=row["seed_type"],
                    queries=list(row.get("queries", [])),
                    canonical_target=row.get("canonical_target"),
                    query_group=row.get("query_group"),
                    emit_to_source_metrics=bool(row.get("emit_to_source_metrics", False)),
                    geo=row.get("geo", defaults.get("geo", "JP")),
                    region=row.get("region", defaults.get("region", "jp")),
                    timeframe=row.get("timeframe", defaults.get("timeframe", "today 3-m")),
                    collection_mode=row.get("collection_mode", defaults.get("collection_mode", "auto")),
                )
            )
        return seeds

    def collect_bundle(
        self,
        mode: str = "auto",
        seed_ids: list[str] | None = None,
        max_seeds: int | None = None,
    ) -> GoogleTrendsBatch:
        seeds = self.load_seeds()
        if seed_ids:
            wanted = set(seed_ids)
            seeds = [seed for seed in seeds if seed.seed_id in wanted]
        if max_seeds is not None:
            seeds = seeds[:max_seeds]

        batch = GoogleTrendsBatch(
            source_name=self.source_name,
            collected_at=datetime.now(timezone.utc).astimezone().isoformat(),
            mode_requested=mode,
            mode_used=mode,
        )

        if mode == "mock":
            self._collect_mock(seeds, batch)
        elif mode == "live":
            try:
                self._collect_live(seeds, batch)
            except Exception as exc:
                batch.errors.append(f"live failed: {exc}")
        else:
            try:
                self._collect_live(seeds, batch)
                if batch.observations:
                    batch.mode_used = "live"
                else:
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
            if row["week_start"] != week_start:
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
                    is_estimated=False,
                    raw_data=row.get("metadata_json"),
                )
            )
        result.errors.extend(batch.errors)
        return result

    def _collect_mock(self, seeds: list[GoogleTrendsSeed], batch: GoogleTrendsBatch) -> None:
        batch.mode_used = "mock"
        if not self.mock_fixture_path.exists():
            batch.errors.append(f"mock fixture not found: {self.mock_fixture_path}")
            return

        with open(self.mock_fixture_path, encoding="utf-8") as handle:
            payload = json.load(handle)

        series_map = {row["seed_id"]: row.get("points", []) for row in payload.get("series", [])}
        collected_date = datetime.now().date().isoformat()

        for seed in seeds:
            points = series_map.get(seed.seed_id)
            if not points:
                batch.errors.append(f"mock series missing: {seed.seed_id}")
                continue
            batch.raw_payloads.append({"seed_id": seed.seed_id, "mode": "mock", "points": points})
            for point in points:
                week_start = point["week_start"]
                for query_term, value in point.get("values", {}).items():
                    batch.observations.append(
                        GoogleTrendsObservation(
                            collected_date=collected_date,
                            week_start=week_start,
                            source_name=self.source_name,
                            raw_name=seed.canonical_target or seed.label,
                            metric_type=GOOGLE_TRENDS_METRIC,
                            metric_value=float(value),
                            region=seed.region,
                            country=seed.geo,
                            query_term=query_term,
                            source_url=self._build_explore_url(seed),
                            note=f"mock fixture seed={seed.seed_id}",
                            seed_id=seed.seed_id,
                            seed_label=seed.label,
                            seed_type=seed.seed_type,
                            query_group=seed.query_group or "",
                            canonical_target=seed.canonical_target,
                            timeframe=seed.timeframe,
                            geo=seed.geo,
                            collection_mode="mock",
                            metadata={
                                "seed_queries": seed.queries,
                                "point_values": point.get("values", {}),
                            },
                        )
                    )

    def _collect_live(self, seeds: list[GoogleTrendsSeed], batch: GoogleTrendsBatch) -> None:
        batch.mode_used = "live"
        try:
            from pytrends.request import TrendReq
        except ImportError as exc:
            raise RuntimeError("pytrends is not installed") from exc

        pytrends = TrendReq(hl="ja-JP", tz=540, retries=1, backoff_factor=0.5)
        collected_date = datetime.now().date().isoformat()

        for seed in seeds:
            if not seed.queries:
                batch.errors.append(f"seed has no queries: {seed.seed_id}")
                continue
            try:
                pytrends.build_payload(seed.queries, cat=0, timeframe=seed.timeframe, geo=seed.geo, gprop="")
                frame = pytrends.interest_over_time()
            except Exception as exc:
                batch.errors.append(f"live seed failed: {seed.seed_id}: {exc}")
                continue
            if frame is None or frame.empty:
                batch.errors.append(f"live no data: {seed.seed_id}")
                continue

            raw_rows = []
            weekly_buckets: dict[str, dict[str, list[float]]] = {}
            for stamp, row in frame.iterrows():
                week_start = self._to_week_start(stamp.date())
                values = {
                    term: float(row[term])
                    for term in seed.queries
                    if term in row and row[term] is not None
                }
                if not values:
                    continue
                raw_rows.append({"week_start": week_start, "values": values})
                weekly_buckets.setdefault(week_start, {})
                for query_term, value in values.items():
                    weekly_buckets[week_start].setdefault(query_term, []).append(float(value))

            for week_start, term_map in sorted(weekly_buckets.items()):
                averaged_values = {
                    query_term: round(mean(samples), 3)
                    for query_term, samples in term_map.items()
                    if samples
                }
                for query_term, value in averaged_values.items():
                    batch.observations.append(
                        GoogleTrendsObservation(
                            collected_date=collected_date,
                            week_start=week_start,
                            source_name=self.source_name,
                            raw_name=seed.canonical_target or seed.label,
                            metric_type=GOOGLE_TRENDS_METRIC,
                            metric_value=float(value),
                            region=seed.region,
                            country=seed.geo,
                            query_term=query_term,
                            source_url=self._build_explore_url(seed),
                            note=f"live pytrends weekly mean seed={seed.seed_id}",
                            seed_id=seed.seed_id,
                            seed_label=seed.label,
                            seed_type=seed.seed_type,
                            query_group=seed.query_group or "",
                            canonical_target=seed.canonical_target,
                            timeframe=seed.timeframe,
                            geo=seed.geo,
                            collection_mode="live",
                            metadata={
                                "seed_queries": seed.queries,
                                "daily_points_in_week": {term: len(samples) for term, samples in term_map.items()},
                            },
                        )
                    )
            batch.raw_payloads.append({"seed_id": seed.seed_id, "mode": "live", "points": raw_rows})

    def _aggregate_import_rows(self, observations: list[GoogleTrendsObservation]) -> list[dict[str, Any]]:
        grouped: dict[tuple[str, str], list[GoogleTrendsObservation]] = {}
        for obs in observations:
            if obs.seed_type != "model" or not obs.canonical_target:
                continue
            key = (obs.seed_id, obs.week_start)
            grouped.setdefault(key, []).append(obs)

        rows: list[dict[str, Any]] = []
        seed_week_counts: dict[str, int] = {}
        seed_nonzero_week_counts: dict[str, int] = {}
        for obs in observations:
            if obs.seed_type != "model":
                continue
            seed_week_counts.setdefault(obs.seed_id, set()).add(obs.week_start)
            if obs.metric_value > 0:
                seed_nonzero_week_counts.setdefault(obs.seed_id, set()).add(obs.week_start)

        for (seed_id, week_start), items in sorted(grouped.items()):
            seed = items[0]
            brand, model, category = self._target_fields(seed.canonical_target)
            unique_terms = sorted({item.query_term for item in items})
            avg_value = round(mean(item.metric_value for item in items), 3)
            observation_weeks = len(seed_week_counts.get(seed_id, set()))
            nonzero_weeks = len(seed_nonzero_week_counts.get(seed_id, set()))
            metadata = {
                "seed_id": seed_id,
                "canonical_target": seed.canonical_target,
                "query_terms": unique_terms,
                "query_values": {item.query_term: item.metric_value for item in items},
                "query_group": seed.query_group,
                "collection_mode": items[0].collection_mode,
                "observation_weeks": observation_weeks,
                "nonzero_weeks": nonzero_weeks,
                "query_term_count": len(unique_terms),
            }
            collection_mode = items[0].collection_mode
            rows.append(
                {
                    "collected_date": seed.collected_date,
                    "source_name": self.source_name,
                    "raw_brand": brand,
                    "raw_name": model,
                    "raw_category": category,
                    "metric_type": GOOGLE_TRENDS_METRIC,
                    "metric_value": avg_value,
                    "region": seed.region,
                    "country": seed.country,
                    "query_term": " | ".join(unique_terms),
                    "source_url": seed.source_url,
                    "note": f"aggregated from {len(unique_terms)} query terms",
                    "seed_id": seed.seed_id,
                    "seed_label": seed.seed_label,
                    "seed_type": seed.seed_type,
                    "query_group": seed.query_group,
                    "timeframe": seed.timeframe,
                    "geo": seed.geo,
                    "collection_mode": collection_mode,
                    "canonical_target": seed.canonical_target,
                    "sample_size": len(unique_terms),
                    "metadata_json": json.dumps(metadata, ensure_ascii=False, sort_keys=True),
                    "week_start": week_start,
                }
            )
        return rows

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
    def _build_explore_url(seed: GoogleTrendsSeed) -> str:
        query = urlencode({"geo": seed.geo, "date": seed.timeframe, "q": ",".join(seed.queries)})
        return f"https://trends.google.com/trends/explore?{query}"
