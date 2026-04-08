"""
calculator.py — トレンドスコア計算

複数指標を正規化して合成スコアを算出し、変化率・ランクラベルを付与する。

使い方:
    from src.scorer.calculator import ScoreCalculator
    calc = ScoreCalculator()
    results = calc.calculate(metrics_by_model)
"""

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

DEFAULT_WEIGHTS_PATH = Path(__file__).parent.parent.parent / "config" / "score_weights.json"


@dataclass
class ModelScore:
    """1機種のスコア計算結果"""
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


class ScoreCalculator:
    """合成トレンドスコア計算クラス"""

    def __init__(self, weights_path: Path = DEFAULT_WEIGHTS_PATH):
        self.weights_path = weights_path
        self._load_weights()

    def _load_weights(self) -> None:
        if self.weights_path.exists():
            with open(self.weights_path, encoding="utf-8") as f:
                config = json.load(f)
            self.weights = config["weights"]
            self.rank_thresholds = config["rank_labels"]
            self.version = config.get("version", "1.0")
        else:
            # デフォルト設定（均等重み）
            self.weights = {
                "search_volume": 0.20,
                "mention_count": 0.20,
                "review_count":  0.20,
                "media_count":   0.20,
                "inquiry_count": 0.20,
            }
            self.rank_thresholds = {
                "rising_fast": 30, "rising": 10,
                "stable_upper": 0, "falling": -10, "falling_fast": -30
            }
            self.version = "1.0"

    def calculate(self, metrics_by_model: dict) -> list[ModelScore]:
        """
        機種別指標辞書からスコアを計算する。

        Args:
            metrics_by_model: {
                "TECHNOGYM::Run::treadmill": {
                    "brand": "TECHNOGYM", "model": "Run", "category": "treadmill",
                    "week_start": "2026-03-30",
                    "metrics": {"search_volume": {"value": 72, "value_prev": 60}, ...}
                }
            }

        Returns:
            List[ModelScore]
        """
        # 指標ごとに全機種の値を集めて min/max を求める
        all_values: dict[str, list[float]] = {k: [] for k in self.weights}
        all_prev: dict[str, list[float]] = {k: [] for k in self.weights}

        for entry in metrics_by_model.values():
            for metric, data in entry.get("metrics", {}).items():
                if metric in self.weights:
                    if data.get("value") is not None:
                        all_values[metric].append(data["value"])
                    if data.get("value_prev") is not None:
                        all_prev[metric].append(data["value_prev"])

        results = []
        for key, entry in metrics_by_model.items():
            score, score_prev, missing = self._compute_score(
                entry.get("metrics", {}), all_values, all_prev
            )
            change_rate = None
            if score is not None and score_prev is not None and score_prev > 0:
                change_rate = (score - score_prev) / score_prev * 100

            results.append(ModelScore(
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
            ))

        # スコア降順でソート
        results.sort(key=lambda x: x.score or 0, reverse=True)
        return results

    def _compute_score(self, metrics: dict, all_values: dict, all_prev: dict):
        score_sum = 0.0
        prev_sum = 0.0
        weight_sum = 0.0
        prev_weight_sum = 0.0
        missing = []

        for metric, weight in self.weights.items():
            data = metrics.get(metric)
            if data is None or data.get("value") is None:
                missing.append(metric)
                continue

            vals = all_values[metric]
            min_v = min(vals) if vals else 0
            max_v = max(vals) if vals else 1
            rng = max_v - min_v if max_v != min_v else 1

            norm = (data["value"] - min_v) / rng
            score_sum += norm * weight
            weight_sum += weight

            if data.get("value_prev") is not None:
                prevs = all_prev[metric]
                min_p = min(prevs) if prevs else 0
                max_p = max(prevs) if prevs else 1
                rng_p = max_p - min_p if max_p != min_p else 1
                norm_p = (data["value_prev"] - min_p) / rng_p
                prev_sum += norm_p * weight
                prev_weight_sum += weight

        if weight_sum == 0:
            return None, None, missing

        score = (score_sum / weight_sum) * 100
        score_prev = (prev_sum / prev_weight_sum) * 100 if prev_weight_sum > 0 else None
        return score, score_prev, missing

    def _label(self, change_rate: Optional[float]) -> str:
        if change_rate is None:
            return "unknown"
        t = self.rank_thresholds
        if change_rate > t["rising_fast"]:
            return "rising_fast"
        elif change_rate > t["rising"]:
            return "rising"
        elif change_rate >= t["stable_upper"]:
            return "stable"
        elif change_rate >= t["falling"]:
            return "falling"
        else:
            return "falling_fast"
