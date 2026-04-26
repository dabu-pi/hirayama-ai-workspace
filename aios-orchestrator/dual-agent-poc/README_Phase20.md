# README_Phase20.md — artifact 内容 diff 比較

実施日: 2026-04-26
ステータス: **CLOSED（15/15 PASS）**

---

## 目的

Phase 19 で実装した export 差分レポートを一歩進め、
artifact ファイルの**内容レベルの差分**を unified diff として生成する。

- 2 つの export ディレクトリを比較し、内容が変わった artifact を検出する
- 変更されたファイルの unified diff をテキストレポートとして出力する
- `--report-output` でファイル保存、`--fail-on-diff` で CI ゲートとして使用できる

---

## 追加・変更ファイル

| ファイル | 変更種別 | 内容 |
|---|---|---|
| `artifact_content_diff.py` | 新規 | manifest 対応付け + 内容比較 + レポート生成 |
| `orchestrator.py` | 変更 | `content-diff` サブコマンド追加 |
| `test_phase20_artifact_content_diff.py` | 新規 | Phase 20 テスト（15 件）|
| `README_Phase20.md` | 新規 | 本ドキュメント |

---

## 機能概要

### artifact_content_diff.py

#### 比較単位

`artifact_id`（UUID）を主キーとして old / new export ディレクトリを突き合わせる。
manifest JSON から `final_filename` を取得して実ファイルを読み込む。

#### 比較方式

- `content_hash`（SHA-256）で変更を検出
- 変更があった場合のみ unified diff を生成（`difflib.unified_diff`）
- バイナリファイル（UTF-8 読み込み不可）は `binary` としてスキップ

#### 比較カテゴリ

| カテゴリ | 条件 |
|---|---|
| same | 両方に存在し、ハッシュが一致 |
| changed | 両方に存在し、ハッシュが異なる |
| added | 新 export にのみ存在 |
| removed | 旧 export にのみ存在 |
| binary | UTF-8 読み込み不可（スキップ）|

#### 主要 API

```python
# ディレクトリパスから比較（推奨）
result = compare_exports(old_dir, new_dir)

# manifest パスを明示する場合
result = compare_exports(old_dir, new_dir,
                         old_manifest=old_manifest_path,
                         new_manifest=new_manifest_path)

# human readable レポート生成
text = format_content_diff_report(result, verbose=False, show_diff=True)

# ファイルに保存
path = write_content_diff_report(result, output_path, json_output=False)
```

### orchestrator.py — content-diff サブコマンド

```bash
cd dual-agent-poc/

# 基本（テキストレポート）
python orchestrator.py content-diff \
    --old-dir ./data/export_v1 \
    --new-dir ./data/export_v2

# verbose（same エントリも表示）
python orchestrator.py content-diff \
    --old-dir ./data/export_v1 \
    --new-dir ./data/export_v2 \
    --verbose

# unified diff 本文を省略して統計のみ
python orchestrator.py content-diff \
    --old-dir ./data/export_v1 \
    --new-dir ./data/export_v2 \
    --no-diff

# JSON 出力
python orchestrator.py content-diff \
    --old-dir ./data/export_v1 \
    --new-dir ./data/export_v2 \
    --json

# レポートをファイルに保存
python orchestrator.py content-diff \
    --old-dir ./data/export_v1 \
    --new-dir ./data/export_v2 \
    --report-output ./reports/content_diff.txt

# CI ゲート（差分があれば exit 1）
python orchestrator.py content-diff \
    --old-dir ./data/export_v1 \
    --new-dir ./data/export_v2 \
    --fail-on-diff

# manifest パスを明示
python orchestrator.py content-diff \
    --old-dir ./data/export_v1 \
    --new-dir ./data/export_v2 \
    --old-manifest ./data/export_v1/artifact_export_manifest.json \
    --new-manifest ./data/export_v2/artifact_export_manifest.json \
    --context 5
```

---

## テスト結果

```
test_phase20_artifact_content_diff.py — 15 tests PASSED
```

| No | テスト | 内容 |
|---|---|---|
| T01 | test_hash_content | SHA-256 ハッシュ計算 |
| T02 | test_read_artifact_file | ファイル読み込み・バイナリ検出 |
| T03 | test_content_diff_and_stat | diff 生成・統計算出 |
| T04 | test_compare_same | 内容一致 → same |
| T05 | test_compare_changed | 内容変更 → changed + unified diff |
| T06 | test_compare_only | 片方のみ → added / removed |
| T07 | test_compare_missing | ファイルが export 内に存在しない場合 |
| T08 | test_format_report | テキストレポート生成 |
| T09 | test_result_to_json | JSON シリアライズ |
| T10 | test_write_content_diff_report | ファイル書き出し（テキスト / JSON）|
| T11 | test_cli_content_diff_with_diff | CLI 差分あり → テキスト出力確認 |
| T12 | test_cli_fail_on_diff | CLI --fail-on-diff → exit 1 |
| T13 | test_cli_no_diff_exit0 | CLI 差分なし → exit 0 |
| T14 | test_cli_json_output | CLI --json → JSON 構造確認 |
| T15 | test_cli_report_output | CLI --report-output → ファイル保存確認 |

---

## 次フェーズ候補

| 候補 | 内容 |
|---|---|
| Phase B | context 圧縮（古い messages を summary 化してトークン削減）|
| Phase C | Google Sheets（Run_Log シート）への run_log 書き込み連携 |
