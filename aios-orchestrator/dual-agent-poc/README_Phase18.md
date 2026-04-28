# README_Phase18 — manifest diff 機能追加

実施日: 2026-04-16
ステータス: **CLOSED（manifest diff 実装・テスト全通過・実データ確認済み / 問題なし）**

---

## 目的

同一 conv_id（または異なる conv_id）の artifact_export_manifest.json を 2 つ比較し、
artifact ごとの **added / removed / changed / unchanged** を判定する機能を追加する。

再 export 前後の差分確認や、export 結果のデグレ検知を自動化することを目的とする。

---

## 追加・変更ファイル

| ファイル | 種別 | 内容 |
|---|---|---|
| `artifact_manifest_diff.py` | 新規 | manifest 比較コアモジュール |
| `orchestrator.py` | 変更 | `manifest-diff` サブコマンド追加 |
| `test_phase18_manifest_diff.py` | 新規 | Phase 18 テスト（88件） |
| `README_Phase18.md` | 新規 | 本ドキュメント |

---

## 機能概要

### artifact_manifest_diff.py

#### 比較単位

`artifact_id`（UUID）を主キーとして old / new manifest を突き合わせる。

#### 比較対象フィールド（DIFF_FIELDS）

```python
DIFF_FIELDS = (
    "final_filename",
    "filename_source",
    "collision_resolved",
    "requested_filename",
    "language",
    "status",
)
```

#### 比較カテゴリ

| カテゴリ | 条件 |
|---|---|
| unchanged | 両方に存在し、DIFF_FIELDS が全て同一 |
| changed | 両方に存在し、DIFF_FIELDS の 1 項目以上が異なる |
| added | 新 manifest にのみ存在（前回にない） |
| removed | 旧 manifest にのみ存在（今回にない） |

#### 主要 API

```python
# ファイルパスから直接比較（推奨）
result = diff_manifests(old_path, new_path)

# dict から比較（テスト・組み込み用）
result = compare_manifests(old_dict, new_dict)

# human readable レポート生成
text = format_diff_report(result, verbose=False)

# stdout 出力
print_diff_report(result, verbose=True)
```

### orchestrator.py — manifest-diff サブコマンド

```bash
# 基本（human readable）
python orchestrator.py manifest-diff \
    --old-manifest ./data/export_v1/artifact_export_manifest.json \
    --new-manifest ./data/export_v2/artifact_export_manifest.json

# verbose（unchanged も表示）
python orchestrator.py manifest-diff \
    --old-manifest ./data/v1/artifact_export_manifest.json \
    --new-manifest ./data/v2/artifact_export_manifest.json \
    --verbose

# JSON 出力（機械処理用）
python orchestrator.py manifest-diff \
    --old-manifest ./data/v1/artifact_export_manifest.json \
    --new-manifest ./data/v2/artifact_export_manifest.json \
    --json
```

#### --json 出力フォーマット

```json
{
  "summary": {
    "added": 0,
    "removed": 0,
    "changed": 0,
    "unchanged": 3
  },
  "added": [],
  "removed": [],
  "changed": [],
  "unchanged": [
    {
      "artifact_id": "08f275e5-...",
      "old_filename": "utils_3.py",
      "new_filename": "utils_3.py"
    }
  ]
}
```

---

## テスト結果

```
test_phase18_manifest_diff.py — 88 tests PASSED
```

### テストケース一覧

| No | テストグループ | 内容 |
|---|---|---|
| T01 | basic diff categories | unchanged のみ（差分なし）|
| T02 | basic diff categories | added のみ（新規1件）|
| T03 | basic diff categories | removed のみ（削除1件）|
| T04 | basic diff categories | changed（final_filename 変更）|
| T05 | basic diff categories | 複合（added + removed + changed + unchanged）|
| T06 | basic diff categories | 空 manifest 同士 → unchanged=0 / has_diff=False |
| T07 | basic diff categories | 重複 artifact_id → 最後の entry が使われる |
| T08 | ManifestLoadError | ファイルなし |
| T09 | ManifestLoadError | JSON 不正 |
| T10 | ManifestLoadError | 必須キー欠落 |
| T11 | ManifestLoadError | artifacts[i] に artifact_id なし |
| T12 | format_diff_report | 差分なし → "差分なし" メッセージ |
| T13 | format_diff_report | changed フィールド名・値が出力に含まれる |
| T14 | diff_manifests (file) | ファイルパスから正しくロード・比較 |
| T15 | CLI subprocess | manifest-diff コマンドが正常終了 |
| T16 | CLI subprocess | --json フラグが JSON を返す |
| T17 | CLI subprocess | 不在ファイル → exit code 1 |
| T18 | different conv_id | conv_id が異なる → WARN が出力される |
| T19 | DIFF_FIELDS all detected | 6フィールド全て changed として検出 |
| T20 | no-diff message | unchanged のみ → "差分なし" |

---

## 実データ確認

### ケース 1: 同一 conv_id の再 export（差分なし）

Phase 17 で export した collision conv_id（`3ad4ac80-9049-47ae-acee-392d753cbf65`）を
Phase 18 で再 export して比較。

```bash
# 再 export
python orchestrator.py artifact-export \
  --conv-id 3ad4ac80-9049-47ae-acee-392d753cbf65 \
  --output ./data/export_phase18_re/

# diff
python orchestrator.py manifest-diff \
  --old-manifest ./data/export_phase17_live_collision/artifact_export_manifest.json \
  --new-manifest ./data/export_phase18_re/artifact_export_manifest.json
```

#### 結果

```
──────────────────────────────────────────────────────────────────────────
Manifest Diff
  old: ...export_phase17_live_collision\artifact_export_manifest.json
  new: ...export_phase18_re\artifact_export_manifest.json
  conv_id   : 3ad4ac80-9049-47ae-acee-392d753cbf65
  old ts    : 2026-04-16T...Z
  new ts    : 2026-04-16T...Z
──────────────────────────────────────────────────────────────────────────
  added    :   0
  removed  :   0
  changed  :   0
  unchanged:   3
──────────────────────────────────────────────────────────────────────────
  差分なし — 前回から変化ありません。
──────────────────────────────────────────────────────────────────────────
```

**同一 conv_id の再 export では差分なし（正しい）。**

---

### ケース 2: 異なる conv_id の manifest 比較（WARN）

Phase 16 manifest（calc conv_id）vs Phase 17 manifest（utils conv_id）を比較。

```bash
python orchestrator.py manifest-diff \
  --old-manifest ./data/export_phase16_live/artifact_export_manifest.json \
  --new-manifest ./data/export_phase17_live_collision/artifact_export_manifest.json
```

#### 結果（抜粋）

```
  [WARN] conv_id が異なります: '8982d82f-...' → '3ad4ac80-...'
  added    :   3
  removed  :   5
  changed  :   0
  unchanged:   0
```

**conv_id が違えば全件 added / removed になる（正しい）。**

---

### ケース 3: --json 出力確認

```bash
python orchestrator.py manifest-diff \
  --old-manifest ./data/export_phase17_live_collision/artifact_export_manifest.json \
  --new-manifest ./data/export_phase18_re/artifact_export_manifest.json \
  --json
```

#### 結果

```json
{
  "summary": {
    "added": 0,
    "removed": 0,
    "changed": 0,
    "unchanged": 3
  },
  "added": [],
  "removed": [],
  "changed": [],
  "unchanged": [
    {"artifact_id": "08f275e5-...", "old_filename": "utils_3.py", "new_filename": "utils_3.py"},
    {"artifact_id": "782a9af0-...", "old_filename": "utils.py",   "new_filename": "utils.py"},
    {"artifact_id": "f4302e87-...", "old_filename": "utils_2.py", "new_filename": "utils_2.py"}
  ]
}
```

---

## 設計メモ

### _path の取り扱い

`diff_manifests()` はファイルロード時に `_path` キーを manifest dict に付与する。
`compare_manifests()` は `_path` を読み取って `ManifestDiffResult.old_path / new_path` に格納する。
`_path` は manifest スキーマには含まれず、write_manifest() では出力されない。

### collision_resolved の diff 検出

同一 artifact_id でも export バッチによって `collision_resolved` が変わる場合（例: 単体 → フル export）に `changed` として正しく検出される。

### conv_id が異なる場合の WARN

異なる conv_id の manifest を比較することはまれだが、移行・コピー系ユースケースでは有用。
WARN を出しつつ比較継続するのが利便性上の最適解。

---

## 問題の有無

**なし。** 88件テスト全通過・実データ3ケース確認済み。

---

## 次フェーズ候補

| 候補 | 内容 |
|---|---|
| Phase 19 | manifest diff を使った export 差分レポートの自動生成（CI 連携想定）|
| Phase 20 | artifact 内容（コードテキスト）の diff 比較 |
