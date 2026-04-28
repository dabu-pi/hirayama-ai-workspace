# README_Phase14 — artifact-export manifest 出力

実施日: 2026-04-16
ステータス: **CLOSED（テスト 63/63 PASS）**

---

## 目的

`artifact-export` 実行後に **何がどの名前で書き出され、どの artifact 由来か** を
後から追跡できる状態を作る。

主な用途:
- 書き出し結果の監査（explicit/inferred/default の内訳確認）
- collision 回避が発生した artifact の特定
- 別 PC や別セッションでの再開時の参照
- dry-run による事前確認（実ファイルを書かずに書き出し計画を記録）

---

## manifest ファイル仕様

### 配置

`artifact_export_manifest.json` として `--output` で指定したディレクトリに保存する。

### 構造

```json
{
  "conv_id": "<conversation_id>",
  "export_timestamp": "2026-04-16T02:16:46Z",
  "output_dir": "<絶対パス>",
  "dry_run": false,
  "total": 5,
  "exported": 4,
  "skipped": 1,
  "errors": 0,
  "artifacts": [
    {
      "artifact_id":        "<UUID>",
      "turn_no":            1,
      "artifact_index":     0,
      "language":           "python",
      "filename_source":    "explicit",
      "requested_filename": "calculator.py",
      "final_filename":     "calculator.py",
      "final_path":         "<output_dir>/calculator.py",
      "collision_resolved": false,
      "status":             "exported"
    },
    {
      "artifact_id":        "<UUID>",
      "turn_no":            2,
      "artifact_index":     1,
      "language":           "",
      "filename_source":    "default",
      "requested_filename": null,
      "final_filename":     null,
      "final_path":         null,
      "collision_resolved": false,
      "status":             "skipped",
      "skipped_reason":     "empty_content"
    }
  ]
}
```

### ヘッダー項目

| フィールド | 型 | 内容 |
|---|---|---|
| `conv_id` | string | 対象 conversation_id |
| `export_timestamp` | string | UTC ISO 8601 形式（秒精度）|
| `output_dir` | string | export 先の絶対パス |
| `dry_run` | bool | dry_run フラグ |
| `total` | int | 処理件数合計 |
| `exported` | int | 書き出し成功件数（dry_run 時も含む）|
| `skipped` | int | スキップ件数 |
| `errors` | int | エラー件数 |

### 各 artifact エントリ

| フィールド | 型 | 内容 |
|---|---|---|
| `artifact_id` | string | artifact の UUID |
| `turn_no` | int | 発生ターン番号（turn_id）|
| `artifact_index` | int | この export 内でのループインデックス（0 始まり）|
| `language` | string | DB に保存されている language タグ（正規化済みの場合はそのまま）|
| `filename_source` | string | `'explicit'` / `'inferred'` / `'default'` / `'none'`（スキップ時）|
| `requested_filename` | string \| null | 衝突回避前のファイル名（空コンテンツスキップ時は null）|
| `final_filename` | string \| null | 確定ファイル名（スキップ時は null）|
| `final_path` | string \| null | 書き出し先の絶対パス（スキップ/エラー時は null）|
| `collision_resolved` | bool | 衝突回避が発生したか（`requested_filename != final_filename`）|
| `status` | string | `'exported'` / `'skipped'` / `'error'` |
| `skipped_reason` | string | status='skipped' 時のみ付与（`'empty_content'` / `'unsafe_path'`）|
| `error_reason` | string | status='error' 時のみ付与（OSError のメッセージ）|

---

## CLI 仕様

### デフォルト動作

```bash
python orchestrator.py artifact-export \
  --conv-id <id> \
  --output ./output/
```

→ `./output/artifact_export_manifest.json` が自動生成される。

### manifest を抑止する

```bash
python orchestrator.py artifact-export \
  --conv-id <id> \
  --output ./output/ \
  --no-manifest
```

→ manifest ファイルは生成しない。export 本体は通常通り動作する。

### dry-run

```bash
python orchestrator.py artifact-export \
  --conv-id <id> \
  --output ./output/ \
  --dry-run
```

→ 実 artifact ファイルは書き出されない。manifest は生成される（`dry_run: true` 付き）。
  出力ディレクトリが存在しない場合も、manifest のために自動作成する。

---

## dry_run 時の manifest の扱い

**dry_run 時も manifest を生成する。** 理由:

- 書き出し計画（filename 決定・collision 回避・filename_source 内訳）を記録することに価値がある
- 本番 export 前に manifest だけ先に確認できる
- `dry_run: true` を manifest に含めることで、実ファイルが存在しないことを明示する

実ファイルは生成されないが、manifest の `final_path` には「書き出される予定だったパス」を記録する。

---

## path の記録方式

| フィールド | 形式 |
|---|---|
| `output_dir` | 絶対パス（`Path.resolve()` 適用）|
| `final_path` | 絶対パス（`Path.resolve()` 適用）|

相対パスは manifest が別ディレクトリから参照された場合に意味を失うため、すべて絶対パスで記録する。

---

## language フィールドについて

manifest の `language` は **DB に保存されている値をそのまま記録する**。

- Phase 13 以降に保存された artifact: `normalize_lang()` 適用済みの値（例: `'python'`、`''`）
- Phase 13 以前に保存された artifact: 生の値がそのまま保存されている（例: `'.....'`）

manifest は DB の正確な状態を反映する。正規化は parse 時に行われるため、既存 DB の値は変更されない。

---

## テスト結果

### `test_phase14_manifest.py`（新規・63 ケース）

| テスト | 内容 | 結果 |
|---|---|---|
| T01 | manifest ファイルが生成される | PASS (11 checks) |
| T02 | exported 件数と manifest 件数が一致する | PASS (3) |
| T03 | skipped 情報が manifest に含まれる | PASS (5) |
| T04 | filename_source が正しく記録される | PASS (3) |
| T05 | collision 回避時に collision_resolved=True が記録される | PASS (4) |
| T06 | 単体 artifact export でも manifest が正しく出る | PASS (4) |
| T07 | dry_run 時に manifest に dry_run=true が含まれる | PASS (5) |
| T08 | write_manifest を呼ばない時はファイルが生成されない | PASS (2) |
| T09 | language / turn_no / artifact_index が記録される | PASS (6) |
| T10 | requested_filename と final_filename が区別される | PASS (4) |
| T11 | final_path が絶対パスで記録される | PASS (2) |
| T12 | zero artifact 時も manifest が生成される | PASS (3) |
| T13 | Phase 11 regression | PASS (6) |
| T14 | Phase 13 regression（lang=''+Markdown → .md の記録）| PASS (5) |
| **合計** | | **63 PASS / 0 FAIL** |

### 既存テストの regression

| テストファイル | 結果 |
|---|---|
| `test_phase11_artifact_export.py` | 56/56 PASS |
| `test_phase13_lang_normalize.py` | 56/56 PASS |

---

## 実データ確認

Phase 12 conv_id `8982d82f-e701-4311-b5a5-f7fb3d45dae7` で dry-run を実行した結果:

```
Artifact Export [DRY-RUN]: calculator.py（加減乗除の関数）と test_calculator.py（...）
  conv_id    : 8982d82f-e701-4311-b5a5-f7fb3d45dae7
  artifacts  : 5 件
  成功: 5 件  /  スキップ: 0 件  /  エラー: 0 件
  manifest   : data\export_phase14_dryrun\artifact_export_manifest.json
```

manifest 内容（抜粋）:

| artifact_id (8桁) | language | filename_source | requested | final | collision |
|---|---|---|---|---|---|
| 91d8c077 | python | explicit | calculator.py | calculator.py | false |
| fcf3ea7e | python | explicit | test_calculator.py | test_calculator.py | false |
| fa068d71 | bash | inferred | artifact_2.sh | artifact_2.sh | false |
| 6cce09f4 | bash | inferred | artifact.sh | artifact.sh | false |
| 4381c862 | ..... | default | artifact_t02_04.txt | artifact_t02_04.txt | false |

> `language: "....."` は Phase 12 時点（Phase 13 正規化前）に DB に保存されたため。manifest は DB の実値を反映する。

---

## 既知の限界

| 項目 | 内容 |
|---|---|
| manifest の上書き | 同一 output_dir に再度 export すると manifest が上書きされる（履歴保持なし）|
| language の正規化 | Phase 13 以前の DB 値は生の値がそのまま記録される |
| manifest 自体の衝突回避なし | MANIFEST_FILENAME は固定名（`artifact_export_manifest.json`）で衝突回避しない |

---

## 新規・変更ファイル

| ファイル | 内容 |
|---|---|
| `artifact_exporter.py` | `write_manifest()` 追加 / `ExportResult` に `artifact_index` / `language` / `requested_filename` / `collision_resolved` を追加 / `MANIFEST_FILENAME` 定数追加 |
| `orchestrator.py` | `write_manifest` import 追加 / `command_artifact_export()` に manifest 呼び出し追加 / argparse に `--no-manifest` 追加 |
| `test_phase14_manifest.py` | Phase 14 テスト（新規・63 ケース）|
| `README_Phase14.md` | 本ドキュメント（新規）|
