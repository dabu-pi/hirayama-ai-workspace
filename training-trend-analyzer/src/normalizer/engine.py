"""
engine.py — 正規化エンジン本体

aliases / brands / categories / models のマスタを読み込み、
raw テキストから canonical 名を解決する。

設計方針:
- 曖昧なものを無理に確定しない（UNRESOLVED で返す）
- alias 経由で canonical に寄せる
- マッチの根拠（matched_alias / match_type / confidence）を常に返す
- 未解決データを unclassified_queue に蓄積できる構造

使い方:
    engine = NormalizerEngine.from_master_dir(Path("data/master"))
    result = engine.normalize("テクノジム ランニングマシン")
    print(result.canonical_brand)   # "TECHNOGYM"
    print(result.canonical_category)  # "treadmill"
"""

import json
import sqlite3
from pathlib import Path
from typing import Optional

from .rules import normalize_text, split_brand_model
from .types import MatchType, NormalizeResult, CertaintyLabel, confidence_to_label


class NormalizerEngine:
    """正規化エンジン"""

    def __init__(
        self,
        brand_aliases:    dict[str, tuple[str, float]],  # {alias_upper: (canonical, confidence)}
        category_aliases: dict[str, tuple[str, float]],
        model_aliases:    dict[str, tuple[str, float, str | None]],  # (canonical, confidence, brand_hint)
        canonical_brands:    set[str],
        canonical_categories: set[str],
        canonical_models:     dict[str, str],  # {canonical_model_upper: canonical_model}
        model_use_types:      dict[str, str],  # {brand::model -> use_type}
        brand_use_types:      dict[str, str],  # {brand_canonical -> market_type}
    ):
        self._brand_aliases    = brand_aliases
        self._cat_aliases      = category_aliases
        self._model_aliases    = model_aliases
        self._canonical_brands    = {b.upper(): b for b in canonical_brands}
        self._canonical_cats      = {c.upper(): c for c in canonical_categories}
        self._canonical_models    = canonical_models
        self._model_use_types     = model_use_types
        self._brand_use_types     = brand_use_types

    # -------------------------------------------------------------------------
    # ファクトリメソッド
    # -------------------------------------------------------------------------

    @classmethod
    def from_master_dir(cls, master_dir: Path) -> "NormalizerEngine":
        """data/master/ の JSON ファイルからエンジンを構築する"""
        brand_aliases:    dict[str, tuple[str, float]]        = {}
        cat_aliases:      dict[str, tuple[str, float]]        = {}
        model_aliases:    dict[str, tuple[str, float, str | None]] = {}
        canonical_brands: set[str] = set()
        canonical_cats:   set[str] = set()
        canonical_models: dict[str, str] = {}
        model_use_types:  dict[str, str] = {}
        brand_use_types:  dict[str, str] = {}

        # brands.json
        brands_path = master_dir / "brands.json"
        if brands_path.exists():
            for row in _load_master_json(brands_path):
                name = row["canonical_name"]
                canonical_brands.add(name)
                brand_use_types[name] = row.get("market_type", "commercial")
                # canonical 名自体も alias として登録
                brand_aliases[name.upper()] = (name, 1.0)
                if row.get("name_ja"):
                    brand_aliases[row["name_ja"]] = (name, 1.0)

        # categories.json
        cats_path = master_dir / "categories.json"
        if cats_path.exists():
            for row in _load_master_json(cats_path):
                name = row["canonical_name"]
                canonical_cats.add(name)
                cat_aliases[name.upper()] = (name, 1.0)
                if row.get("name_ja"):
                    cat_aliases[row["name_ja"]] = (name, 1.0)

        # models.json
        models_path = master_dir / "models.json"
        if models_path.exists():
            for row in _load_master_json(models_path):
                name = row["canonical_name"]
                brand = row.get("brand")
                use_t = row.get("use_type", "commercial")
                canonical_models[name.upper()] = name
                if brand:
                    model_use_types[f"{brand}::{name}"] = use_t
                # canonical 名 itself
                model_aliases[name.upper()] = (name, 0.8, brand)
                if brand:
                    model_aliases[f"{brand.upper()} {name.upper()}"] = (name, 1.0, brand)

        # aliases.json
        aliases_path = master_dir / "aliases.json"
        if aliases_path.exists():
            raw = _load_master_json(aliases_path)
            for row in raw:
                alias = row.get("alias_text", "").strip()
                entity_type = row.get("entity_type")
                canonical   = row.get("canonical", "")
                confidence  = float(row.get("confidence", 1.0))
                brand_hint  = row.get("brand")

                if not alias or not entity_type or not canonical:
                    continue

                normalized_alias, _ = normalize_text(alias)

                if entity_type == "brand":
                    # 上書きは confidence が高い場合のみ
                    existing = brand_aliases.get(normalized_alias)
                    if existing is None or existing[1] < confidence:
                        brand_aliases[normalized_alias] = (canonical, confidence)

                elif entity_type == "category":
                    existing = cat_aliases.get(normalized_alias)
                    if existing is None or existing[1] < confidence:
                        cat_aliases[normalized_alias] = (canonical, confidence)

                elif entity_type == "model":
                    existing = model_aliases.get(normalized_alias)
                    if existing is None or existing[1] < confidence:
                        model_aliases[normalized_alias] = (canonical, confidence, brand_hint)

        return cls(
            brand_aliases, cat_aliases, model_aliases,
            canonical_brands, canonical_cats, canonical_models,
            model_use_types, brand_use_types,
        )

    @classmethod
    def from_db(cls, db_path: Path) -> "NormalizerEngine":
        """DB の aliases テーブルからエンジンを構築する"""
        brand_aliases:    dict[str, tuple[str, float]] = {}
        cat_aliases:      dict[str, tuple[str, float]] = {}
        model_aliases:    dict[str, tuple[str, float, str | None]] = {}
        canonical_brands: set[str] = set()
        canonical_cats:   set[str] = set()
        canonical_models: dict[str, str] = {}
        model_use_types:  dict[str, str] = {}
        brand_use_types:  dict[str, str] = {}

        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        try:
            for row in conn.execute("SELECT name, market_type FROM brands"):
                canonical_brands.add(row["name"])
                brand_use_types[row["name"]] = row["market_type"]
                brand_aliases[row["name"].upper()] = (row["name"], 1.0)

            for row in conn.execute("SELECT name FROM categories"):
                canonical_cats.add(row["name"])
                cat_aliases[row["name"].upper()] = (row["name"], 1.0)

            for row in conn.execute(
                "SELECT m.name, b.name as brand, m.use_type FROM models m JOIN brands b ON m.brand_id = b.id"
            ):
                canonical_models[row["name"].upper()] = row["name"]
                model_use_types[f"{row['brand']}::{row['name']}"] = row["use_type"]
                model_aliases[row["name"].upper()] = (row["name"], 0.8, row["brand"])

            for row in conn.execute("""
                SELECT a.alias_text, a.entity_type, a.confidence, a.source,
                       b.name as brand_name, m.name as model_name,
                       CASE a.entity_type WHEN 'brand' THEN b.name WHEN 'model' THEN m.name ELSE NULL END as canonical
                FROM aliases a
                LEFT JOIN brands b ON a.brand_id = b.id
                LEFT JOIN models m ON a.model_id = m.id
            """):
                alias_text = row["alias_text"]
                normalized_alias, _ = normalize_text(alias_text)
                entity_type = row["entity_type"]
                canonical   = row["canonical"]
                confidence  = row["confidence"] or 1.0

                if not canonical:
                    continue

                if entity_type == "brand":
                    existing = brand_aliases.get(normalized_alias)
                    if existing is None or existing[1] < confidence:
                        brand_aliases[normalized_alias] = (canonical, confidence)
                elif entity_type == "category":
                    existing = cat_aliases.get(normalized_alias)
                    if existing is None or existing[1] < confidence:
                        cat_aliases[normalized_alias] = (canonical, canonical, confidence)
                elif entity_type == "model":
                    brand_hint = row["brand_name"]
                    existing = model_aliases.get(normalized_alias)
                    if existing is None or existing[1] < confidence:
                        model_aliases[normalized_alias] = (canonical, confidence, brand_hint)
        finally:
            conn.close()

        return cls(
            brand_aliases, cat_aliases, model_aliases,
            canonical_brands, canonical_cats, canonical_models,
            model_use_types, brand_use_types,
        )

    # -------------------------------------------------------------------------
    # メイン: 正規化
    # -------------------------------------------------------------------------

    def normalize(self, raw_text: str, hint_brand: str | None = None) -> NormalizeResult:
        """
        raw_text からブランド / カテゴリ / モデルを解決する。

        hint_brand: 呼び出し元がブランドを特定している場合に渡す。
                    モデル解決の精度が上がる。
        """
        result = NormalizeResult(raw_text=raw_text)

        norm, steps = normalize_text(raw_text)
        result.preprocessing_steps = steps

        # --- ブランド解決 ---
        brand_match = self._resolve_brand(norm)
        matched_brand_alias = None
        if brand_match:
            result.canonical_brand  = brand_match[0]
            result.brand_confidence = brand_match[1]
            result.brand_match_type = brand_match[2]
            matched_brand_alias     = brand_match[3]  # マッチしたaliasテキスト
        elif hint_brand:
            # raw_text からブランドが解決できない場合、hint_brand で補完する
            # 例: raw_name="TRM445" raw_brand="Precor" → Precor をヒントとして解決
            hint_norm, _ = normalize_text(hint_brand)
            hint_match = self._resolve_brand(hint_norm)
            if hint_match:
                result.canonical_brand  = hint_match[0]
                result.brand_confidence = hint_match[1] * 0.9  # hint 経由なので信頼度を微減
                result.brand_match_type = hint_match[2]
                matched_brand_alias     = hint_match[3]

        # ブランドが分かったら、マッチしたaliasテキストをプレフィックスとして除去
        effective_brand = result.canonical_brand or hint_brand
        remaining = norm
        if matched_brand_alias:
            # マッチしたaliasテキスト（例: "ライフフィットネス"）を除去
            alias_upper = matched_brand_alias.upper()
            norm_upper  = norm.upper()
            if norm_upper.startswith(alias_upper + " "):
                remaining = norm[len(matched_brand_alias):].strip()
            elif norm_upper == alias_upper:
                remaining = ""
        elif effective_brand:
            # フォールバック: canonical brand 名（英語）で除去
            brand_norm, _ = normalize_text(effective_brand)
            if remaining.upper().startswith(brand_norm.upper() + " "):
                remaining = remaining[len(brand_norm):].strip()

        # --- カテゴリ解決 ---
        cat_match = self._resolve_category(norm)
        if cat_match:
            result.canonical_category = cat_match[0]
            result.cat_confidence     = cat_match[1]
            result.cat_match_type     = cat_match[2]

        # --- モデル解決 ---
        model_match = self._resolve_model(norm, remaining, effective_brand)
        if model_match:
            result.canonical_model  = model_match[0]
            result.model_confidence = model_match[1]
            result.model_match_type = model_match[2]
            result.matched_alias    = model_match[3]

        # --- use_type 解決 ---
        result.use_type = self._resolve_use_type(
            result.canonical_brand, result.canonical_model
        )

        # --- 総合信頼度 ---
        confidences = [
            c for c in [result.brand_confidence, result.model_confidence]
            if c is not None
        ]
        if confidences:
            result.confidence = min(confidences)
            result.certainty_label = confidence_to_label(result.confidence)

        # --- 総合 match_type ---
        result.match_type = result.model_match_type or result.brand_match_type

        # --- 未解決判定 ---
        if result.canonical_brand is None and result.canonical_model is None and result.canonical_category is None:
            result.is_unresolved = True
            result.unresolved_reason = f"No match found for: '{raw_text}'"
            result.match_type = MatchType.UNRESOLVED
            result.certainty_label = CertaintyLabel.UNKNOWN

        return result

    def normalize_brand(self, raw_text: str) -> NormalizeResult:
        """ブランド名だけを解決する（軽量版）"""
        result = NormalizeResult(raw_text=raw_text)
        norm, steps = normalize_text(raw_text)
        result.preprocessing_steps = steps
        match = self._resolve_brand(norm)
        if match:
            result.canonical_brand  = match[0]
            result.brand_confidence = match[1]
            result.brand_match_type = match[2]
            # match[3] は matched_alias_text (normalize_brand では不要)
            result.confidence       = match[1]
            result.certainty_label  = confidence_to_label(match[1])
            result.match_type       = match[2]
        else:
            result.is_unresolved   = True
            result.unresolved_reason = f"Brand not found: '{raw_text}'"
            result.match_type      = MatchType.UNRESOLVED
        return result

    # -------------------------------------------------------------------------
    # 内部: 解決ロジック
    # -------------------------------------------------------------------------

    def _resolve_brand(self, norm: str) -> tuple[str, float, MatchType, str] | None:
        """
        正規化済みテキストからブランドを解決する。
        返り値: (canonical, confidence, MatchType, matched_alias_text)
        matched_alias_text はブランド名プレフィックスの除去に使う。
        """
        # 完全一致
        entry = self._brand_aliases.get(norm)
        if entry:
            return entry[0], entry[1], MatchType.EXACT_ALIAS, norm

        # canonical 名直接マッチ
        upper = norm.upper()
        if upper in self._canonical_brands:
            return self._canonical_brands[upper], 1.0, MatchType.EXACT_CANONICAL, norm

        # 先頭ブランド名マッチ — alias テキストそのものを返す
        # 長いaliasを優先して誤マッチを防ぐため降順ソート
        for alias_text in sorted(self._brand_aliases, key=len, reverse=True):
            canonical, confidence = self._brand_aliases[alias_text]
            alias_upper = alias_text.upper()
            if upper.startswith(alias_upper + " "):
                return canonical, confidence, MatchType.PARTIAL, alias_text

        return None

    def _resolve_category(self, norm: str) -> tuple[str, float, MatchType] | None:
        """正規化済みテキストからカテゴリを解決する"""
        entry = self._cat_aliases.get(norm)
        if entry:
            return entry[0], entry[1], MatchType.EXACT_ALIAS

        upper = norm.upper()
        if upper in self._canonical_cats:
            return self._canonical_cats[upper], 1.0, MatchType.EXACT_CANONICAL

        # テキスト内にカテゴリキーワードが含まれるか（部分一致）
        for alias_text, (canonical, confidence) in self._cat_aliases.items():
            if alias_text.upper() in upper and confidence >= 0.85:
                return canonical, confidence * 0.8, MatchType.PARTIAL

        return None

    def _resolve_model(
        self, norm: str, remaining: str, brand_hint: str | None
    ) -> tuple[str, float, MatchType, str] | None:
        """正規化済みテキスト・残余テキスト・ブランドヒントからモデルを解決する"""

        candidates = []

        # full text で alias 検索
        for text in (norm, remaining):
            if not text:
                continue
            upper = text.upper()
            entry = self._model_aliases.get(upper)
            if entry:
                canonical, confidence, b_hint = entry
                # ブランドヒントが一致する場合は confidence 補正
                if brand_hint and b_hint and brand_hint.upper() == b_hint.upper():
                    confidence = min(1.0, confidence + 0.1)
                elif brand_hint and b_hint and brand_hint.upper() != b_hint.upper():
                    confidence = confidence * 0.5  # ブランド不一致はペナルティ
                candidates.append((canonical, confidence, MatchType.EXACT_ALIAS, upper))

            # canonical 名直接
            if upper in self._canonical_models:
                candidates.append((
                    self._canonical_models[upper], 0.85,
                    MatchType.EXACT_CANONICAL, upper
                ))

        if not candidates:
            return None

        # 最も confidence が高いものを返す
        best = max(candidates, key=lambda x: x[1])
        return best[0], best[1], best[2], best[3]

    def _resolve_use_type(self, brand: str | None, model: str | None) -> str:
        if brand and model:
            key = f"{brand}::{model}"
            if key in self._model_use_types:
                return self._model_use_types[key]
        if brand and brand in self._brand_use_types:
            bt = self._brand_use_types[brand]
            if bt == "commercial":
                return "commercial"
            if bt == "consumer":
                return "consumer"
        return "unknown"


# -------------------------------------------------------------------------
# ヘルパー
# -------------------------------------------------------------------------

def _load_master_json(path: Path) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    return [row for row in data if not any(k.startswith("_") for k in row.keys())]
