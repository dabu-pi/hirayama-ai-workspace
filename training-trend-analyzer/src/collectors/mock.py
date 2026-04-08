"""
mock.py — モックデータコレクター

data/mock/source_metrics.json を読み込んで RawMetric を返す。
外部API不要でロジックのテストができる。

使い方:
    from src.collectors.mock import MockCollector
    collector = MockCollector()
    result = collector.collect(keywords=[], week_start="2026-03-30")
"""

import json
from pathlib import Path

from .base import BaseCollector, CollectResult, RawMetric

DEFAULT_MOCK_PATH = Path(__file__).parent.parent.parent / "data" / "mock" / "source_metrics.json"


class MockCollector(BaseCollector):
    """モックデータコレクター"""

    def __init__(self, mock_path: Path = DEFAULT_MOCK_PATH):
        super().__init__("mock")
        self.mock_path = mock_path

    def collect(self, keywords: list[str], week_start: str) -> CollectResult:
        result = CollectResult(source_name=self.source_name)

        if not self.mock_path.exists():
            result.errors.append(f"Mock file not found: {self.mock_path}")
            return result

        try:
            with open(self.mock_path, encoding="utf-8") as f:
                data = json.load(f)

            for block in data:
                if block.get("source") != "mock":
                    continue
                # week_start フィルタ（空なら全件）
                if week_start and block.get("_week") != week_start:
                    continue

                metric_type = block.get("metric_type", "unknown")
                for entry in block.get("entries", []):
                    # keywords フィルタ（空なら全件）
                    if keywords and entry.get("brand") not in keywords and entry.get("model") not in keywords:
                        continue

                    result.metrics.append(RawMetric(
                        source_name=self.source_name,
                        brand_name=entry.get("brand", ""),
                        model_name=entry.get("model", ""),
                        category_name=entry.get("category", ""),
                        week_start=block.get("_week", week_start),
                        metric_type=metric_type,
                        value=entry.get("value"),
                        value_prev=entry.get("value_prev"),
                    ))

        except (json.JSONDecodeError, KeyError) as e:
            result.errors.append(f"Mock parse error: {e}")

        return result
