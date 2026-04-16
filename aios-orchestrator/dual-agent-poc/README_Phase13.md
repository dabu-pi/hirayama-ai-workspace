# README_Phase13 — language tag 正規化 + 内容ベース拡張子推定

実施日: 2026-04-16
ステータス: **CLOSED（テスト 56/56 PASS）**

---

## 目的

Phase 11 E2E で観測された問題の修正:

- Executor が `lang='.....'`（記号のみ）を出力 → `normalize_lang()` で `''` に変換できていなかった
- `lang=''` の artifact（Markdown テーブル・テスト結果等）が `.py` 拡張子で export されていた

---

## 修正内容

### 1. `artifact_parser.py` — `normalize_lang()` 追加（Phase 13）

```python
_LANG_ALIASES: dict[str, str] = {
    "py":  "python",
    "js":  "javascript",
    "ts":  "typescript",
    "sh":  "bash",
    "md":  "markdown",
    "c++": "cpp",
}

def normalize_lang(raw: str) -> str:
    tag = raw.strip().lower()
    if not tag:
        return ""
    if len(tag) > 30:
        return ""
    if not re.search(r"[a-z0-9]", tag):   # 記号のみ → 無効タグ
        return ""
    return _LANG_ALIASES.get(tag, tag)
```

#### 正規化ルール（適用順）

| ルール | 例 | 結果 |
|---|---|---|
| 前後空白除去・小文字化 | `' PYTHON '` | `'python'` |
| 空文字 → `''` | `''` | `''` |
| 30 文字超 → `''` | `'a' * 31` | `''` |
| 英数字なし（記号のみ）→ `''` | `'.....'` / `'---'` / `'###'` | `''` |
| エイリアス変換 | `'py'` / `'sh'` / `'md'` | `'python'` / `'bash'` / `'markdown'` |
| その他 → そのまま | `'rust'` | `'rust'` |

#### 変更箇所

`parse_artifacts()` 内:

```python
# Before
lang = (match.group(2) or "").strip()

# After（Phase 13）
lang = normalize_lang(match.group(2) or "")
```

---

### 2. `artifact_exporter.py` — `_infer_ext_from_content()` 追加（Phase 13）

`lang=''` かつ `_LANG_TO_EXT` にエントリがない場合に呼び出す、軽量な内容ベース拡張子推定関数。

```python
def _infer_ext_from_content(content: str) -> str:
    """lang='' の artifact に対して内容から拡張子を推定する（Phase 13）。"""
    lines = content.splitlines()
    non_blank = [l for l in lines if l.strip()]
    if not non_blank:
        return ".txt"

    # Markdown 判定
    table_rows = sum(1 for l in non_blank if re.match(r"\s*\|.+\|", l))
    if table_rows >= 3:
        return ".md"
    has_heading = any(re.match(r"^#{1,6}\s", l) for l in non_blank)
    has_bullet  = any(re.match(r"^\s*[-*+]\s", l) for l in non_blank)
    has_numlist = any(re.match(r"^\s*\d+\.\s", l) for l in non_blank)
    if has_heading and (has_bullet or has_numlist or table_rows >= 1):
        return ".md"

    # ログ・テスト結果判定
    has_dotok   = any(re.search(r"\.\s*ok", l, re.I) for l in non_blank)
    has_ran     = any(re.match(r"Ran \d+ test", l) for l in non_blank)
    has_dashes  = any(re.match(r"-{20,}", l) for l in non_blank)
    if (has_dotok or has_ran) and has_dashes:
        return ".txt"
    if has_ran:
        return ".txt"

    # Python コード判定
    py_def    = sum(1 for l in non_blank if re.match(r"\s*(def|class)\s+\w+", l))
    py_indent = sum(1 for l in non_blank if re.match(r"    \S", l))
    if py_def >= 1 and py_indent >= 2:
        return ".py"
    py_import = sum(1 for l in non_blank if re.match(r"^(import|from)\s+\w+", l))
    if py_import >= 1 and (py_def >= 1 or py_indent >= 2):
        return ".py"

    # bash 判定
    has_shebang = non_blank[0].startswith("#!")
    sh_cmds     = sum(
        1 for l in non_blank
        if re.match(r"^\s*(echo|cd|ls|mkdir|cp|mv|rm|git|python|pip|npm|curl|wget)\s", l)
    )
    if has_shebang:
        return ".sh"
    if sh_cmds >= 1:
        return ".sh"

    return ".txt"
```

#### 推定優先順位

| 優先度 | 条件 | 結果 |
|---|---|---|
| 1 | Markdown テーブル行 3 行以上 | `.md` |
| 2 | 見出し（`#`）＋ 箇条書き / テーブル 1 行以上 | `.md` |
| 3 | `... ok` ＋ 区切り線（`---` 20文字以上）| `.txt` |
| 4 | `Ran N tests` を含む | `.txt` |
| 5 | `def` / `class` ＋ インデント 2 行以上 | `.py` |
| 6 | `import` ＋ `def` or インデント | `.py` |
| 7 | shebang（`#!`） | `.sh` |
| 8 | shell コマンド 1 行以上 | `.sh` |
| 9 | その他（デフォルト） | `.txt` |

#### 変更箇所

`_safe_default_filename()` 内:

```python
# Before
ext = _LANG_TO_EXT.get(lang) or _TYPE_TO_EXT.get(art_type, ".py")

# After（Phase 13）
ext = _LANG_TO_EXT.get(lang)
if ext is None:
    ext = _infer_ext_from_content(content)
```

---

## テスト結果

### `test_phase13_lang_normalize.py`（新規・42 ケース）

| テスト区分 | ケース数 | 結果 |
|---|---|---|
| `normalize_lang()` エッジケース（T01〜T17） | 18 | PASS |
| `_infer_ext_from_content()`（T18〜T29） | 13 | PASS |
| `parse_artifacts()` 統合（T30〜T35） | 12 | PASS |
| `export_artifacts()` 統合（T36〜T42） | 13 | PASS |
| **合計** | **56** | **PASS** |

### `test_phase11_artifact_export.py`（Phase 11 regression・56 ケース）

| 結果 | 件数 |
|---|---|
| PASS | 56 |
| FAIL | 0 |

---

## 実データ（Phase 12 conv_id）への影響

Phase 12 の `8982d82f-e701-4311-b5a5-f7fb3d45dae7` に対して dry-run を実行した結果:

| artifact_id | ファイル名（Phase 12） | ファイル名（Phase 13） | 変化 |
|---|---|---|---|
| 91d8c077 | `calculator.py` | `calculator.py` | 変化なし（explicit） |
| fcf3ea7e | `test_calculator.py` | `test_calculator.py` | 変化なし（explicit） |
| fa068d71 | `artifact_2.sh` | `artifact_2.sh` | 変化なし（inferred） |
| 6cce09f4 | `artifact.sh` | `artifact.sh` | 変化なし（inferred） |
| 4381c862 | `artifact_t02_04.py` | **`artifact_t02_04.txt`** | **修正** |

`lang='.....'`（記号のみ）のテスト結果テキストが `.py` から `.txt` に修正された。

---

## 既知の限界

| 項目 | 内容 |
|---|---|
| 内容推定の精度 | ヒューリスティクスベース。複雑な混在コンテンツは誤判定の可能性あり |
| 言語判定の網羅性 | Ruby / Go / Rust など未対応。デフォルト `.txt` にフォールバック |
| 多言語混在ブロック | 複数言語が混在するブロックは最初のパターンにマッチした言語で判定 |
| `normalize_lang` 非英語タグ | 日本語等の非 ASCII タグは英数字ありとして通過するが `_LANG_TO_TYPE` 未登録 → `'code'` 扱い |

---

## 新規・変更ファイル

| ファイル | 内容 |
|---|---|
| `artifact_parser.py` | `_LANG_ALIASES` dict 追加 / `normalize_lang()` 関数追加 / `parse_artifacts()` で呼び出し |
| `artifact_exporter.py` | `_infer_ext_from_content()` 関数追加 / `_safe_default_filename()` で `lang=''` 時に呼び出し |
| `test_phase13_lang_normalize.py` | Phase 13 テスト（新規・56 ケース） |
| `README_Phase13.md` | 本ドキュメント（新規） |
