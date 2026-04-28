"""
base.py — コレクター基底クラス

全コレクターはこのクラスを継承して実装する。
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class RawMetric:
    """収集した生指標値の共通データクラス"""
    source_name: str
    brand_name: str
    model_name: str
    category_name: str
    week_start: str          # ISO 8601 例: "2026-03-30"
    metric_type: str         # "search_volume", "mention_count" 等
    value: Optional[float]
    value_prev: Optional[float] = None
    sample_size: Optional[int] = None
    is_estimated: bool = False
    raw_data: Optional[str] = None  # JSON文字列（デバッグ用）


@dataclass
class CollectResult:
    """コレクター実行結果"""
    source_name: str
    metrics: list = field(default_factory=list)
    errors: list = field(default_factory=list)

    @property
    def success(self) -> bool:
        return len(self.errors) == 0

    @property
    def partial(self) -> bool:
        return len(self.metrics) > 0 and len(self.errors) > 0


class BaseCollector(ABC):
    """コレクター基底クラス"""

    def __init__(self, source_name: str):
        self.source_name = source_name

    @abstractmethod
    def collect(self, keywords: list[str], week_start: str) -> CollectResult:
        """
        指定キーワードと週の指標を収集する。

        Args:
            keywords: 収集対象のキーワードリスト（ブランド名・機種名等）
            week_start: ISO 8601 週初（例: "2026-03-30"）

        Returns:
            CollectResult（失敗しても例外を上げず errors に記録）
        """
        ...
