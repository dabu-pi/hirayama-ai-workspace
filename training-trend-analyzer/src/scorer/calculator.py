"""
Score calculator with conservative metric-specific stabilization hooks.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

DEFAULT_WEIGHTS_PATH = Path(__file__).parent.parent.parent / "config" / "score_weights.json"


@dataclass
class ModelScore:
    brand_name: str
    model_name: str
    category_name: str
    week_start: str
    score: Optional[float]
    score_prev: Optional[float]
    change_rate: Optional[float]
    rank_label: str
    metrics_used: dict = field(default_factory=dict)
    missing_metrics: list = field(default_factory=list)
    metric_contributions: dict = field(default_factory=dict)
    eligibility_notes: list[str] = field(default_factory=list)


class ScoreCalculator:
    def __init__(
        self,
        weights_path: Path = DEFAULT_WEIGHTS_PATH,
        excluded_metrics: set[str] | None = None,
    ):
        self.weights_path = weights_path
        self.excluded_metrics = set(excluded_metrics or set())
        self._load_weights()

    def _load_weights(self) -> None:
        if self.weights_path.exists():
            with open(self.weights_path, encoding="utf-8") as handle:
                config = json.load(handle)
            self.weights = config["weights"]
            self.rank_thresholds = config["rank_labels"]
            self.change_rules = config.get("change_rules", {})
            self.metric_rules = config.get("metric_rules", {})
            self.version = config.get("version", "1.0")
            return

        self.weights = {
            "search_volume": 0.20,
            "mention_count": 0.20,
            "review_count": 0.20,
            "media_count": 0.20,
            "inquiry_count": 0.20,
        }
        self.rank_thresholds = {
            "rising_fast": 30,
            "rising": 10,
            "stable_upper": 0,
            "falling": -10,
            "falling_fast": -30,
        }
        self.change_rules = {}
        self.metric_rules = {}
        self.version = "1.0"

    def calculate(self, metrics_by_model: dict) -> list[ModelScore]:
        cohort_counts = {metric: 0 for metric in self.weights}
        for entry in metrics_by_model.values():
            for metric, data in entry.get("metrics", {}).items():
                if metric in self.weights and data.get("value") is not None:
                    cohort_counts[metric] += 1

        prepared_by_model = {}
        all_values = {metric: [] for metric in self.weights}
        all_prev = {metric: [] for metric in self.weights}

        for key, entry in metrics_by_model.items():
            prepared_metrics = {}
            eligibility_notes = []

            for metric, data in entry.get("metrics", {}).items():
                prepared = self._prepare_metric(metric, data, cohort_counts.get(metric, 0))
                if prepared is None:
                    note = self._metric_note(metric, data, cohort_counts.get(metric, 0))
                    if note:
                        eligibility_notes.append(note)
                    continue
                prepared_metrics[metric] = prepared
                if prepared["value"] is not None:
                    all_values[metric].append(prepared["value"])
                if prepared.get("value_prev") is not None:
                    all_prev[metric].append(prepared["value_prev"])

            prepared_by_model[key] = {
                **entry,
                "metrics": prepared_metrics,
                "eligibility_notes": eligibility_notes,
            }

        results = []
        for entry in prepared_by_model.values():
            score, score_prev, missing, contributions, prev_metrics_used = self._compute_score(
                entry.get("metrics", {}),
                all_values,
                all_prev,
            )
            change_rate = None
            if self._allow_change_rate(prev_metrics_used):
                if score is not None and score_prev is not None and score_prev > 0:
                    change_rate = (score - score_prev) / score_prev * 100
            elif score_prev is not None:
                entry.setdefault("eligibility_notes", []).append("change_rate: suppressed by prev support rule")

            results.append(
                ModelScore(
                    brand_name=entry.get("brand", ""),
                    model_name=entry.get("model", ""),
                    category_name=entry.get("category", ""),
                    week_start=entry.get("week_start", ""),
                    score=round(score, 2) if score is not None else None,
                    score_prev=round(score_prev, 2) if score_prev is not None else None,
                    change_rate=round(change_rate, 1) if change_rate is not None else None,
                    rank_label=self._label(change_rate),
                    metrics_used=entry.get("metrics", {}),
                    missing_metrics=missing,
                    metric_contributions=contributions,
                    eligibility_notes=entry.get("eligibility_notes", []),
                )
            )

        results.sort(key=lambda row: row.score or 0, reverse=True)
        return results

    def _prepare_metric(self, metric: str, data: dict, cohort_count: int) -> dict | None:
        if metric not in self.weights:
            return None
        if metric in self.excluded_metrics:
            return None
        if data.get("value") is None:
            return None

        rules = self.metric_rules.get(metric, {})
        metadata = data.get("metadata", {})
        sample_size = data.get("sample_size")

        min_models = int(rules.get("min_models", 0) or 0)
        if min_models and cohort_count < min_models:
            return None

        min_observation_weeks = int(rules.get("min_observation_weeks", 0) or 0)
        if min_observation_weeks and int(metadata.get("observation_weeks", 0) or 0) < min_observation_weeks:
            return None

        min_query_terms = int(rules.get("min_query_terms", 0) or 0)
        if min_query_terms and int(sample_size or 0) < min_query_terms:
            return None

        min_value = float(rules.get("min_value", 0) or 0)
        if min_value and float(data["value"]) < min_value:
            return None

        value = float(data["value"])
        value_prev = data.get("value_prev")
        smoothing_prev_weight = float(rules.get("smoothing_prev_weight", 0.0) or 0.0)
        if value_prev is not None and smoothing_prev_weight > 0:
            value = round((value * (1.0 - smoothing_prev_weight)) + (float(value_prev) * smoothing_prev_weight), 6)

        return {
            "value": value,
            "value_prev": float(value_prev) if value_prev is not None else None,
            "raw_value": data.get("value"),
            "raw_value_prev": data.get("value_prev"),
            "sample_size": sample_size,
            "metadata": metadata,
            "source_name": data.get("source_name"),
        }

    def _metric_note(self, metric: str, data: dict, cohort_count: int) -> str | None:
        if metric not in self.weights:
            return None
        if metric in self.excluded_metrics:
            return f"{metric}: manually excluded"

        rules = self.metric_rules.get(metric, {})
        metadata = data.get("metadata", {})
        sample_size = int(data.get("sample_size") or 0)

        min_models = int(rules.get("min_models", 0) or 0)
        if min_models and cohort_count < min_models:
            return f"{metric}: skipped by cohort<{min_models}"

        min_observation_weeks = int(rules.get("min_observation_weeks", 0) or 0)
        observation_weeks = int(metadata.get("observation_weeks", 0) or 0)
        if min_observation_weeks and observation_weeks < min_observation_weeks:
            return f"{metric}: skipped by weeks<{min_observation_weeks}"

        min_query_terms = int(rules.get("min_query_terms", 0) or 0)
        if min_query_terms and sample_size < min_query_terms:
            return f"{metric}: skipped by query_terms<{min_query_terms}"

        min_value = float(rules.get("min_value", 0) or 0)
        if min_value and float(data.get("value") or 0) < min_value:
            return f"{metric}: skipped by value<{min_value:g}"

        return None

    def _compute_score(self, metrics: dict, all_values: dict, all_prev: dict):
        score_sum = 0.0
        prev_sum = 0.0
        weight_sum = 0.0
        prev_weight_sum = 0.0
        missing = []
        contributions = {}
        prev_metrics_used = []

        for metric, base_weight in self.weights.items():
            data = metrics.get(metric)
            if data is None or data.get("value") is None:
                missing.append(metric)
                continue

            rules = self.metric_rules.get(metric, {})
            effective_weight = base_weight * float(rules.get("contribution_scale", 1.0) or 1.0)
            norm_cap = float(rules.get("norm_cap", 1.0) or 1.0)

            vals = all_values.get(metric, [])
            min_v = min(vals) if vals else 0
            max_v = max(vals) if vals else 1
            rng = max_v - min_v if max_v != min_v else 1

            norm = (data["value"] - min_v) / rng
            norm = max(0.0, min(norm, norm_cap))
            score_sum += norm * effective_weight
            weight_sum += effective_weight
            contributions[metric] = {
                "normalized": round(norm, 4),
                "effective_weight": round(effective_weight, 4),
                "raw_value": data.get("raw_value", data.get("value")),
                "used_value": data.get("value"),
            }

            if data.get("value_prev") is not None:
                prevs = all_prev.get(metric, [])
                min_p = min(prevs) if prevs else 0
                max_p = max(prevs) if prevs else 1
                rng_p = max_p - min_p if max_p != min_p else 1
                norm_p = (data["value_prev"] - min_p) / rng_p
                norm_p = max(0.0, min(norm_p, norm_cap))
                prev_sum += norm_p * effective_weight
                prev_weight_sum += effective_weight
                prev_metrics_used.append(metric)

        if weight_sum == 0:
            return None, None, missing, contributions, prev_metrics_used

        score = (score_sum / weight_sum) * 100
        score_prev = (prev_sum / prev_weight_sum) * 100 if prev_weight_sum > 0 else None
        return score, score_prev, missing, contributions, prev_metrics_used

    def _allow_change_rate(self, prev_metrics_used: list[str]) -> bool:
        if not prev_metrics_used:
            return False

        min_prev_metrics = int(self.change_rules.get("min_prev_metrics", 1) or 1)
        if len(prev_metrics_used) < min_prev_metrics:
            return False

        ignore_if_only = set(self.change_rules.get("ignore_if_only_metrics", []))
        if ignore_if_only and set(prev_metrics_used).issubset(ignore_if_only):
            return False

        return True

    def _label(self, change_rate: Optional[float]) -> str:
        if change_rate is None:
            return "unknown"
        t = self.rank_thresholds
        if change_rate > t["rising_fast"]:
            return "rising_fast"
        if change_rate > t["rising"]:
            return "rising"
        if change_rate >= t["stable_upper"]:
            return "stable"
        if change_rate >= t["falling"]:
            return "falling"
        return "falling_fast"
