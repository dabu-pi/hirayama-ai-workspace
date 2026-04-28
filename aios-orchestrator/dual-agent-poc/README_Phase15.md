# README_Phase15 — artifact-export 統合E2Eテスト（完成仕様固定）

実施日: 2026-04-16
ステータス: **CLOSED（統合E2E 121/121 PASS）**

---

## 目的

Phase 11〜14 で確立した `artifact-export` + manifest の完成仕様を、
1 本の統合E2Eテストとして資産化し、回帰しにくい状態にする。

新機能の追加ではなく「現在の正しい挙動」をテストとして固定することが主目的。

---

## 統合シナリオ一覧

| シナリオ | テスト手法 | 確認内容 |
|---|---|---|
| S01 フルエクスポート | CLI (subprocess) | 8 artifact: explicit/inferred/default/collision/content-inference/skipped + manifest |
| S02 dry-run | CLI (subprocess) | 実ファイル未生成・manifest 生成・dry_run=true・planned path 記録 |
| S03 --artifact-id 単体 | CLI (subprocess) | 1 件のみ export・manifest 1 件 |
| S04 --no-manifest | CLI (subprocess) | export 成功・manifest 非生成 |
| S05 filename 優先順位 | 関数レベル | explicit > inferred > default・unsafe explicit → default fallback |
| S06 safe filename 制約 | 関数レベル | 安全ケース 4 件・危険ケース 7 件 |
| S07 collision 回避 | 関数レベル | 3 件衝突 → _2, _3 命名・collision_resolved=True |
| S08 content inference | 関数レベル | lang='' + 各コンテンツ → .md/.txt/.py/.sh |
| S09 manifest フィールド完全性 | 関数レベル | ヘッダー 9 項目・エントリ 10 項目の存在と値 |
| S10 zero artifact | CLI (subprocess) | エラーなし・ファイル未生成 |
| S11 dry-run + no-manifest | CLI (subprocess) | 何も生成されない |
| S12 manifest × ファイル対応整合 | CLI (subprocess) | final_path が全件存在・skipped は null・ファイル名が完全一致 |

---

## fixture 構成

```
Turn 1 (T01):
  art1: explicit  'calculator.py'   language='python'  (normal explicit)
  art2: inferred  'utils.py'        language='python'  (normal inferred)
  art3: explicit  'schema.sql'      language='sql'     (non-python explicit)
  art4: explicit  'config.yaml'     language='yaml'    (non-python explicit)

Turn 2 (T02):
  art5: explicit  'calculator.py'   language='python'  (collision → calculator_2.py)
  art6: none      lang=''           content=Markdown   (→ .md via content inference)
  art7: none      lang=''           content=log/test   (→ .txt via content inference)
  art8: none      (empty content)                      (→ skipped)
```

計: 8 artifact / 7 exported / 1 skipped / 1 collision

---

## 完成仕様として固定した不変条件

以下は今後の機能追加・リファクタ前に必ず守るべき不変条件。

### 1. filename 優先順位（Phase 11）

```
explicit (is_safe) > inferred (is_safe) > default
```

- unsafe な explicit/inferred は default にフォールバックする
- default の命名: `artifact_t<turn>_<index><ext>`

### 2. collision 回避（Phase 11）

- 同名が衝突した場合: `<stem>_2<ext>`, `<stem>_3<ext>`, ... と連番で回避
- 上書きは絶対に行わない
- manifest に `collision_resolved: true` / `requested_filename` を記録

### 3. safe filename 制約（Phase 11）

拒否条件: 空文字列 / `..` を含む / `/` or `\\` を含む / 制御文字 / 256 文字以上

### 4. lang='' の content ベース拡張子推定（Phase 13）

優先順位（先にマッチした方が採用）:
1. Markdown テーブル行 3+ → `.md`
2. 見出し + 箇条書き/テーブル → `.md`
3. `... ok`/`... FAIL` パターン → `.txt`
4. `Ran N tests` → `.txt`
5. def/class + インデント 2+ → `.py`
6. shebang または shell コマンド → `.sh`
7. デフォルト → `.txt`

### 5. normalize_lang（Phase 13）

- 記号のみタグ (`'.....'`, `'---'`) → `''`
- 30 文字超 → `''`
- エイリアス変換: `py→python`, `sh→bash`, `md→markdown`, `js→javascript`, `ts→typescript`, `c++→cpp`

### 6. manifest の不変条件（Phase 14）

**常に生成（`--no-manifest` で抑止可能）:**
```
artifact_export_manifest.json → output_dir 配下
```

**dry_run 時: manifest を生成する（`dry_run: true` 付与）**
- 実ファイルは生成しない
- manifest の `final_path` には「書き出される予定だったパス」を記録

**必須ヘッダーフィールド:**
`conv_id`, `export_timestamp`, `output_dir`, `dry_run`, `total`, `exported`, `skipped`, `errors`, `artifacts`

**必須エントリフィールド:**
`artifact_id`, `turn_no`, `artifact_index`, `language`, `filename_source`, `requested_filename`, `final_filename`, `final_path`, `collision_resolved`, `status`

**path はすべて絶対パス。**

### 7. manifest × export ファイルの対応整合（Phase 15 で確認）

- exported エントリの `final_path` は実ファイルとして必ず存在する
- skipped エントリの `final_path` は必ず `null`
- manifest の `final_filename` 集合 = 実 export ファイル名集合

---

## テスト結果

### `test_phase15_artifact_export_e2e.py`（新規・12 シナリオ / 121 ケース）

| シナリオ | checks | 結果 |
|---|---|---|
| S01 フルエクスポート | 32 | PASS |
| S02 dry-run | 10 | PASS |
| S03 --artifact-id | 8 | PASS |
| S04 --no-manifest | 3 | PASS |
| S05 filename 優先順位 | 8 | PASS |
| S06 safe filename | 11 | PASS |
| S07 collision 回避 | 9 | PASS |
| S08 content inference | 4 | PASS |
| S09 manifest フィールド完全性 | 27 | PASS |
| S10 zero artifact | 3 | PASS |
| S11 dry-run + no-manifest | 3 | PASS |
| S12 manifest × ファイル対応整合 | 4 | PASS |
| **合計** | **121** | **PASS** |

### 既存テストの regression

| テストファイル | 結果 |
|---|---|
| `test_phase11_artifact_export.py` | 56/56 PASS |
| `test_phase13_lang_normalize.py` | 56/56 PASS |
| `test_phase14_manifest.py` | 63/63 PASS |

**Phase 11〜15 累計: 317 テストケース PASS / 0 FAIL**

---

## テスト手法の選択基準

| 手法 | 用途 |
|---|---|
| CLI (subprocess) | export コマンド全体の動作確認。ユーザー視点に近い。エラーコード/出力も検証 |
| 関数レベル (直接呼び出し) | 細粒度のロジック確認（is_safe_filename / collision / content inference）|

---

## 既存コードへの変更

なし。テストファイル `test_phase15_artifact_export_e2e.py` のみ新規追加。

---

## 新規ファイル

| ファイル | 内容 |
|---|---|
| `test_phase15_artifact_export_e2e.py` | 統合E2Eテスト（新規・12 シナリオ / 121 ケース）|
| `README_Phase15.md` | 本ドキュメント（新規）|

---

## 今後の機能追加前に守るべきこと

1. **テストを壊さない**: `python test_phase15_artifact_export_e2e.py` が全パスすること
2. **不変条件リストを更新**: 仕様変更時は本ファイルの「完成仕様として固定した不変条件」を更新すること
3. **manifest の後方互換**: フィールドの削除・リネームは既存 manifest を壊すため原則禁止。追加は可
4. **filename 優先順位の不変性**: explicit > inferred > default の順序は変更しない
