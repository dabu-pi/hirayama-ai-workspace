# README_Phase10 — Artifact Filename 明示指定

実施日: 2026-04-15
ステータス: **CLOSED**

---

## 目的

Executor 出力内に明示されたファイル名を artifact 保存時に正確に反映する。
これにより artifact-diff のグルーピング精度が上がり、export 時に正確なファイル名で書き出せるようになる。

---

## filename 指定ルール

### 認識する記法

コードブロック直前の行（最大 3 行）またはブロック先頭行に以下の記法を書く。

```
// filename: main.py         JS / TS / Java スタイル
# filename: setup.sh         Python / bash スタイル
-- filename: schema.sql      SQL スタイル
filename: config.yaml        プレーン（コメントプレフィックスなし）
```

### 優先順位

| 優先度 | ルール | 例 |
|---|---|---|
| 1 (高) | コードブロック直前行での明示 | `# filename: main.py` → ブロック直前 |
| 2 | コードブロック先頭行での明示 | ブロック 1 行目に `# filename: utils.py` |
| 3 (低) | 言語ベースの自動推定（既存） | python → `artifact.py`、bash → `artifact.sh` |

### 不正 filename の扱い

以下のケースは unsafe として拒否し、推定 filename にフォールバックする。

| 条件 | 例 | 結果 |
|---|---|---|
| 空文字 / 空白のみ | `filename: ` | 推定にフォールバック |
| `..` を含む（パストラバーサル） | `../etc/passwd` | 拒否 |
| `/` または `\\` を含む | `subdir/file.py` | 拒否 |
| 制御文字を含む | `foo\x00.py` | 拒否 |
| 255 文字超 | 256 文字以上の名前 | 拒否 |
| 拡張子なし | `Dockerfile`, `Makefile` | **許可**（正当なファイル名） |

---

## DB スキーマ変更（v5）

`artifacts` テーブルに `filename_source` 列を追加。

```sql
filename_source TEXT NOT NULL DEFAULT 'inferred'
-- 'explicit' | 'inferred' | 'none'
```

既存 DB でも `init_db()` が自動でマイグレーションを実行する（冪等）。

| 値 | 意味 |
|---|---|
| `explicit` | コードブロック付近の `# filename:` 等の記法から取得 |
| `inferred` | 言語タグから自動推定（従来動作） |
| `none` | 言語不明で推定もできなかった |

---

## 実測結果

### Part A: 直接注入（API コール不要）

ゴール:
- `# filename: main.py` → python コードブロック直前に記述
- `# filename: requirements.txt` → text ブロック直前
- `# filename: config.yaml` → yaml ブロック直前

| artifact | filename | filename_source |
|---|---|---|
| python コード | main.py | **explicit** |
| テキスト | requirements.txt | **explicit** |
| yaml 設定 | config.yaml | **explicit** |

### Part B: real API（gpt-4o Planner + claude-sonnet-4-6 Executor）

Executor が `# filename: get_request_script.py` を使用し、explicit で保存された。

| artifact | filename | filename_source |
|---|---|---|
| python コード | get_request_script.py | **explicit** |
| bash | artifact_1.sh | inferred（LLM が記法を使わなかった） |

- unsafe filename: **0 件**
- lang=数字のみ: **0 件**

---

## 実施した変更ファイル

| ファイル | 変更内容 |
|---|---|
| `artifact_parser.py` | `_FILENAME_ANNOTATION_RE` / `_UNSAFE_FILENAME_RE` / `_extract_explicit_filename()` / `_sanitize_filename()` 追加 / `parse_artifacts()` に filename 解決ロジック組み込み / `filename_source` フィールドを出力に追加 |
| `schema.sql` | v5 コメント追加 / artifacts に `filename_source TEXT NOT NULL DEFAULT 'inferred'` 追加 |
| `store.py` | `init_db()` に filename_source マイグレーション追加 / `append_artifact()` に `filename_source` パラメータ追加 / `get_artifacts()` / `get_artifacts_by_conv()` の SELECT に `filename_source` を追加 |
| `orchestrator.py` | `_save_artifacts_safely()` で `filename_source` を `_store_artifact()` に渡す / verbose ログに `[E]` フラグ追加 |
| `test_phase10_explicit_filename.py` | **新規**。11 テスト（4記法・フォールバック・複数ブロック・不正 filename・後方互換・diff グルーピング） |
| `test_phase10_real_api.py` | **新規**。Part A（直接注入 3 件 explicit 確認）+ Part B（real API 安全性確認） |
| `README_Phase10.md` | **新規**（このファイル） |

---

## 検証結果

| # | テスト | 結果 |
|---|---|---|
| 1 | `// filename:` 記法 | OK |
| 2 | `# filename:` 記法 | OK |
| 3 | `-- filename:` 記法 | OK |
| 4 | `filename:` 記法（プレーン） | OK |
| 5 | ブロック先頭行での指定 | OK |
| 6 | 明示なし → 推定にフォールバック | OK |
| 7 | 複数ブロック: 各ブロック独立解決 | OK |
| 8 | 不正 filename（パストラバーサル / パス含む / 空 / 長過ぎ）→ フォールバック | OK |
| 9 | `filename_source` フィールド（explicit / inferred / none） | OK |
| 10 | Phase 6 後方互換（artifact_type / language / body 維持） | OK |
| 11 | artifact-diff グルーピングに explicit filename が効く | OK |
| Part A | 直接注入: explicit 3 件（main.py / requirements.txt / config.yaml） | OK |
| Part B | real API: explicit 1 件 / unsafe 0 件 / digit-lang 0 件 | OK |

Phase 6 / 7 / 9 既存テストの regression なし。

---

## 既知の制限

| 項目 | 内容 |
|---|---|
| LLM 依存 | LLM が `# filename:` 記法を使うかは non-deterministic。指示しても使わない場合は推定にフォールバックする |
| 複数候補 | 同一ブロックの直前 3 行に複数の `filename:` がある場合、直前の行が優先される |
| `/* filename: */` 記法 | C スタイルブロックコメントは現状未対応（正規表現に `/*` を追加で対応可能） |
| filename の拡張子 | 指定したファイル名の拡張子と言語タグが一致しない場合でも拒否しない |

---

## 今後の拡張候補

| 候補 | 内容 |
|---|---|
| artifact export | `--export ./output/` で explicit filename を使ってファイル書き出し |
| `/* filename: */` 対応 | C スタイルブロックコメントへの対応追加 |
| filename 一致チェック | 言語タグと拡張子が合っているか警告する |
