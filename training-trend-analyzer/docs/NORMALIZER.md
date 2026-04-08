# NORMALIZER.md — 正規化エンジン仕様

最終更新: 2026-04-08

---

## 目的

raw テキスト（収集データ・手入力・スクレイピング結果）から、
DB に登録された canonical 名称（ブランド / カテゴリ / モデル）を解決する。

**基本方針: 曖昧なものを無理に確定しない**

---

## ファイル構成

```
src/normalizer/
├── __init__.py
├── types.py      # NormalizeResult・MatchType・CertaintyLabel の型定義
├── rules.py      # テキスト前処理ルール（normalize_text 等）
└── engine.py     # NormalizerEngine 本体
```

---

## 前処理パイプライン（rules.py）

raw テキストに対して以下を順番に適用する。

| ステップ | 内容 | 例 |
|---|---|---|
| 1. 全角→半角 | NFKC 正規化 | `ＴＥＣＨＮＯＧＹＭ` → `TECHNOGYM` |
| 2. ASCII大文字化 | ASCII文字のみ大文字 | `technogym` → `TECHNOGYM`（日本語は変換しない） |
| 3. 空白正規化 | 全角スペース・連続スペースを単一スペースに | `LIFE　FITNESS` → `LIFE FITNESS` |
| 4. 前後トリム | 先頭・末尾の空白を除去 | ` TECHNOGYM ` → `TECHNOGYM` |

### 意図的にやらないこと

| 非実施 | 理由 |
|---|---|
| 漢字・ひらがな変換 | 誤変換リスクが高い |
| 類似文字列の fuzzy マッチング | 誤分類のリスクが大きい |
| ハイフン・スラッシュの自動除去 | 型番の区切りと混在するため |
| 数字の全角半角変換以外の処理 | NFKC で対応済み |

---

## NormalizeResult の構造

```python
@dataclass
class NormalizeResult:
    raw_text:             str         # 入力テキスト
    canonical_brand:      str | None  # 解決されたブランド名
    brand_match_type:     MatchType   # マッチ種別
    brand_confidence:     float       # ブランドの信頼度 0〜1
    canonical_category:   str | None  # 解決されたカテゴリ名
    cat_match_type:       MatchType
    cat_confidence:       float
    canonical_model:      str | None  # 解決されたモデル名
    model_match_type:     MatchType
    model_confidence:     float
    matched_alias:        str | None  # どの alias テキストで一致したか
    match_type:           MatchType   # 総合マッチ種別
    confidence:           float       # 総合信頼度（最小値）
    certainty_label:      str         # HIGH / MEDIUM / LOW / UNKNOWN
    use_type:             str         # commercial / consumer / unknown
    is_unresolved:        bool        # True: 解決不能
    unresolved_reason:    str | None
    preprocessing_steps:  list[str]   # 適用した前処理ステップ
```

---

## MatchType

| 値 | 意味 |
|---|---|
| `exact_alias` | aliases テーブル（または aliases.json）で完全一致 |
| `exact_canonical` | canonical 名称で完全一致 |
| `normalized` | 前処理後に一致 |
| `partial` | 部分一致（先頭マッチ等） |
| `unresolved` | 解決不能 |

---

## CertaintyLabel と confidence の対応

| ラベル | confidence 範囲 | 運用方針 |
|---|---|---|
| HIGH | >= 0.9 | 自動確定 |
| MEDIUM | 0.7〜0.9 | 自動確定（モデル解決時は要注意） |
| LOW | 0.5〜0.7 | 未分類キューに入れて手動確認推奨 |
| UNKNOWN | < 0.5 または None | 自動確定禁止。手動確認 |

---

## 解決フロー

```
raw_text
    ↓ normalize_text()（前処理）
    ↓
1. ブランド解決
   - aliases で完全一致 → exact_alias
   - canonical 名で一致 → exact_canonical
   - 先頭ブランド名マッチ → partial
   - 不一致 → brand = None

2. カテゴリ解決
   - aliases で完全一致
   - テキスト内にカテゴリキーワード含む → partial（confidence 0.85以上のみ）

3. ブランド名を除去した残余テキストでモデル解決
   - "TECHNOGYM RUN" → ブランド "TECHNOGYM" 除去 → "RUN" でモデル検索
   - brand_hint が一致する場合 +0.1 補正
   - brand_hint が不一致の場合 ×0.5 ペナルティ

4. use_type 解決
   - モデルの use_type を優先
   - モデル不明の場合はブランドの market_type から推定

5. 総合信頼度 = min(brand_confidence, model_confidence)

6. 未解決判定
   - brand・model・category がすべて None → is_unresolved = True
```

---

## aliases.json の保守方法

`data/master/aliases.json` に追記するだけでよい。
DBへの反映は `load_master_data.py --only aliases` で行う。

```bash
# aliases のみ再投入
python scripts/load_master_data.py --only aliases
```

### alias 追記時のルール

| 項目 | ルール |
|---|---|
| `alias_text` | 前処理後のテキストで登録する（大文字・半角統一後） |
| `confidence` | 完全に確実なものだけ 1.0。略称・通称は 0.7〜0.9 |
| `brand` | model の alias には必ず元ブランドを明記する |
| `note` | 曖昧な理由・注意事項があれば記載 |
| 上書き禁止 | confidence が高い方が優先（低い方で上書きしない） |

---

## 未分類キューの運用

正規化エンジンで `is_unresolved = True` になったテキストは、
`unclassified_queue` テーブルに蓄積する（将来実装）。

**確認フロー:**
1. 週次で `unclassified_queue` を確認する
2. 正規化できる表記ゆれ → `aliases.json` に追加 → `load_master_data.py` で反映
3. 新規ブランド・機種 → `brands.json` / `models.json` に追加 → `init_db.py` または `load_master_data.py` で反映
4. 不要・ノイズ → `status = 'ignored'` にマーク

---

## 実務上の注意事項

| 注意 | 内容 |
|---|---|
| ブランドとカテゴリの混在 | 「StairMaster」はブランド名だが、カテゴリ名として使われる（aliases.json に brand_as_category で記録）|
| 型番の `(` `)` `[` `]` | 型番に括弧が含まれる場合は alias に括弧あり・なし両方登録 |
| 家庭用機種の混在 | `use_type` でフィルタリング。`market_type = consumer` ブランドは自動的に consumer 判定 |
| model confidence 0.8 以下 | モデル単体の aliases（例: "T5", "RUN"）はブランド情報なしでは 0.8 以下。ブランドとセットで判断する |
