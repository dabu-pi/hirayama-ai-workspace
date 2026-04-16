# README_Phase16 — real API 実データ artifact-export 運用E2E確認

実施日: 2026-04-16
ステータス: **CLOSED（実運用E2E 全確認 OK / 問題なし）**

---

## 目的

Phase 11〜15 で固めた `artifact-export` + manifest の仕様が、
real API で生成した実際の Executor 出力に対しても問題なく動くことを最終確認する。

---

## 使用した conv_id

| 項目 | 内容 |
|---|---|
| conv_id | `8982d82f-e701-4311-b5a5-f7fb3d45dae7` |
| title | calculator.py（加減乗除の関数）と test_calculator.py（unittestのテストコード）の2ファイルをPythonで作成 |
| 作成フェーズ | Phase 12（Executor prompt に filename 記法追加 E2E）|
| status | completed |
| turn_count | 3 |
| artifact 数 | 5 件 |

---

## 実行コマンドと結果

### 1. フル export（manifest あり）

```bash
python orchestrator.py artifact-export \
  --conv-id 8982d82f-e701-4311-b5a5-f7fb3d45dae7 \
  --output ./data/export_phase16_live/
```

#### 出力

```
Artifact Export: calculator.py（加減乗除の関数）と test_calculator.py（...）
  artifacts  : 5 件
  [OK]   T01  91d8c077...  → calculator.py  [E]
  [OK]   T01  fcf3ea7e...  → test_calculator.py  [E]
  [OK]   T01  fa068d71...  → artifact_2.sh  [I]
  [OK]   T02  6cce09f4...  → artifact.sh  [I]
  [OK]   T02  4381c862...  → artifact_t02_04.txt  [D]
  成功: 5 件  /  スキップ: 0 件  /  エラー: 0 件
  manifest   : data\export_phase16_live\artifact_export_manifest.json
```

---

## manifest 確認結果

### サマリー

| 項目 | 値 |
|---|---|
| total | 5 |
| exported | 5 |
| skipped | 0 |
| errors | 0 |
| dry_run | false |

### 各 artifact の詳細

| artifact_id (8桁) | turn | language | filename_source | requested_filename | final_filename | collision |
|---|---|---|---|---|---|---|
| 91d8c077 | T01 | python | **explicit** [E] | calculator.py | calculator.py | false |
| fcf3ea7e | T01 | python | **explicit** [E] | test_calculator.py | test_calculator.py | false |
| fa068d71 | T01 | bash | inferred [I] | artifact_2.sh | artifact_2.sh | false |
| 6cce09f4 | T02 | bash | inferred [I] | artifact.sh | artifact.sh | false |
| 4381c862 | T02 | ..... | default [D] | artifact_t02_04.txt | artifact_t02_04.txt | false |

### filename_source 内訳

| source | 件数 | 割合 |
|---|---|---|
| explicit [E] | 2 | 40% |
| inferred [I] | 2 | 40% |
| default [D] | 1 | 20% |

---

## 実ファイルとの整合確認

| 確認項目 | 結果 |
|---|---|
| export ファイル数（manifest 除く）| 5 件（= exported 件数と一致）|
| final_filename = 実ファイル名 | 全 5 件 一致 |
| final_path の実ファイルが存在する | 全 5 件 存在確認 |
| collision_resolved | 全 5 件 false（衝突なし）|
| calculator.py の内容 | Executor が出力した Python コードと一致 |
| test_calculator.py の内容 | unittest 5 テスト含む完全な内容と一致 |
| artifact_t02_04.txt の内容 | `Ran 5 tests in 0.001s\n\nOK` のテスト結果テキスト（lang='.....' → content inference → .txt）|

---

## --artifact-id 単体 export 確認

```bash
python orchestrator.py artifact-export \
  --conv-id 8982d82f-e701-4311-b5a5-f7fb3d45dae7 \
  --artifact-id 91d8c077 \
  --output ./data/export_phase16_single/
```

| 確認項目 | 結果 |
|---|---|
| 書き出しファイル数 | 1 件（calculator.py のみ）|
| manifest: total | 1 |
| manifest: artifact_id | 91d8c077-...（一致）|
| manifest: filename_source | explicit |
| manifest: final_filename | calculator.py |
| 他 artifact は書き出されない | OK（test_calculator.py 等は未生成）|

---

## --no-manifest 確認

```bash
python orchestrator.py artifact-export \
  --conv-id 8982d82f-e701-4311-b5a5-f7fb3d45dae7 \
  --output ./data/export_phase16_nomanifest/ \
  --no-manifest
```

| 確認項目 | 結果 |
|---|---|
| export 成功 | OK（5 件）|
| artifact_export_manifest.json | 未生成（OK）|
| 書き出しファイル | calculator.py / test_calculator.py / artifact.sh / artifact_2.sh / artifact_t02_04.txt |

---

## 観察事項

### artifact_t02_04 の language='.....'

`lang='.....'` は Phase 12 時点（Phase 13 正規化前）に DB に保存されたもの。
manifest の `language` フィールドは DB の実値を正確に反映しており仕様通り。
Phase 13 の `normalize_lang()` は parse 時にのみ適用されるため、
既存 DB 値は変更されない（意図通り）。

content inference により `'.....'` → `''` ではなく、
`_safe_default_filename` の `_LANG_TO_EXT.get('.....')` が `None` を返すため、
`_infer_ext_from_content()` が呼ばれてテスト結果テキスト → `.txt` となる（正常）。

### artifact_2.sh の命名

T01 の bash artifact が `artifact_2.sh`（`_2` 付き）になっているのは Phase 12 E2E 時点で
inferred filename が `artifact_2.sh` として DB に保存済みだったため。
export 時の collision 回避は発生していない（`collision_resolved: false`）。

---

## 問題の有無

**なし。** Phase 11〜15 で確立した全仕様が実データに対して正常に動作。

---

## コード変更

なし（`README_Phase16.md` の追加のみ）。

---

## 新規ファイル

| ファイル | 内容 |
|---|---|
| `README_Phase16.md` | 本ドキュメント（新規）|
| `data/export_phase16_live/` | export 結果（gitignore 対象）|
| `data/export_phase16_single/` | 単体 export 結果（gitignore 対象）|
| `data/export_phase16_nomanifest/` | no-manifest export 結果（gitignore 対象）|
