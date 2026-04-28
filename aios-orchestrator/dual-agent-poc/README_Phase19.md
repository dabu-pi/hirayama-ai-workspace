# README_Phase19.md — export 差分レポート自動生成

## 目的

Phase 18 で実装した `manifest-diff` を CI パイプラインで使えるよう拡張する。

- `--report-output <path>` でレポートをファイルに保存（CI アーティファクト化）
- `--fail-on-diff` で差分があれば `exit 1`（CI ゲート）

## 追加したもの

| ファイル | 変更種別 | 内容 |
|---|---|---|
| `export_diff_reporter.py` | 新規 | `write_diff_report()` — ManifestDiffResult をファイルに書き出す |
| `orchestrator.py` | 変更 | `manifest-diff` に `--report-output` / `--fail-on-diff` を追加 |
| `test_phase19_export_diff_report.py` | 新規 | Phase 19 テスト（10ケース）|

## 使い方

```bash
cd dual-agent-poc/

# テキストレポートをファイルに保存
python orchestrator.py manifest-diff \
    --old-manifest ./data/v1/artifact_export_manifest.json \
    --new-manifest ./data/v2/artifact_export_manifest.json \
    --report-output ./reports/diff.txt

# JSON レポートをファイルに保存
python orchestrator.py manifest-diff \
    --old-manifest ./data/v1/artifact_export_manifest.json \
    --new-manifest ./data/v2/artifact_export_manifest.json \
    --json \
    --report-output ./reports/diff.json

# CI ゲート: 差分があれば exit 1
python orchestrator.py manifest-diff \
    --old-manifest ./data/v1/artifact_export_manifest.json \
    --new-manifest ./data/v2/artifact_export_manifest.json \
    --fail-on-diff

# 組み合わせ（ファイル保存 + CI ゲート）
python orchestrator.py manifest-diff \
    --old-manifest ./data/v1/artifact_export_manifest.json \
    --new-manifest ./data/v2/artifact_export_manifest.json \
    --report-output ./reports/diff.txt \
    --fail-on-diff
```

## exit code 仕様

| 状況 | exit code |
|---|---|
| 正常終了（差分あり、--fail-on-diff なし） | 0 |
| 正常終了（差分なし） | 0 |
| 差分あり + --fail-on-diff | 1 |
| manifest ファイルエラー | 1 |

## 設計方針

- レポート書き出しは `export_diff_reporter.py` に分離（単体テスト可能）
- `--report-output` 指定時も stdout への通常出力は変わらない
- `--report-output` のファイル保存失敗は WARN 扱い（exit code を変えない）
- JSON 形式（`--json`）と組み合わせると JSON ファイルが生成される
- `has_diff` フィールドを JSON 出力に追加（CI スクリプトから参照しやすい）
