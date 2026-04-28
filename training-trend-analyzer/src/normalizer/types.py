"""
types.py — 正規化エンジンの共通型定義

正規化エンジンが返すすべての型をここに集約する。
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class MatchType(str, Enum):
    """マッチの種類"""
    EXACT_ALIAS     = "exact_alias"      # aliases テーブルで完全一致
    EXACT_CANONICAL = "exact_canonical"  # canonical 名で完全一致
    NORMALIZED      = "normalized"       # 前処理後に一致（全角半角・大文字変換後）
    PARTIAL         = "partial"          # 部分一致（先頭 or 末尾一致）
    UNRESOLVED      = "unresolved"       # 解決不能


class CertaintyLabel(str, Enum):
    """信頼性ラベル（スコアより人間が読みやすい形式）"""
    HIGH    = "high"     # confidence >= 0.9
    MEDIUM  = "medium"   # 0.7 <= confidence < 0.9
    LOW     = "low"      # 0.5 <= confidence < 0.7
    UNKNOWN = "unknown"  # unresolved または信頼度なし


def confidence_to_label(confidence: Optional[float]) -> CertaintyLabel:
    if confidence is None:
        return CertaintyLabel.UNKNOWN
    if confidence >= 0.9:
        return CertaintyLabel.HIGH
    if confidence >= 0.7:
        return CertaintyLabel.MEDIUM
    if confidence >= 0.5:
        return CertaintyLabel.LOW
    return CertaintyLabel.UNKNOWN


@dataclass
class NormalizeResult:
    """正規化エンジンの返り値"""

    # 入力
    raw_text: str

    # ブランド
    canonical_brand:    Optional[str]   = None
    brand_match_type:   Optional[MatchType] = None
    brand_confidence:   Optional[float] = None

    # カテゴリ
    canonical_category: Optional[str]   = None
    cat_match_type:     Optional[MatchType] = None
    cat_confidence:     Optional[float] = None

    # モデル
    canonical_model:    Optional[str]   = None
    model_match_type:   Optional[MatchType] = None
    model_confidence:   Optional[float] = None

    # マッチ詳細
    matched_alias:      Optional[str]   = None  # どの alias テキストで一致したか
    match_type:         Optional[MatchType] = None  # 総合マッチ種別

    # 信頼性
    confidence:         Optional[float] = None  # 総合信頼度 0〜1
    certainty_label:    CertaintyLabel  = CertaintyLabel.UNKNOWN

    # use_type: commercial / consumer / unknown
    use_type:           str = "unknown"

    # 未解決
    is_unresolved:      bool = False
    unresolved_reason:  Optional[str] = None

    # デバッグ用
    preprocessing_steps: list = field(default_factory=list)

    def __post_init__(self):
        self.certainty_label = confidence_to_label(self.confidence)
