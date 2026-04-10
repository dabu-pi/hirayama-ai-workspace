# Publication Dashboard View

このフォルダは、週次 publication 運用をユーザーが見てすぐ分かる形にするための運用ビューです。

重要: このスプレッドシートは正本ではありません。正本は repo 内の Markdown、コード、`data/output/` の生成物、release ledger です。このフォルダの CSV / xlsx は、Google Sheets や Excel で確認しやすくするための見える化ビューとして使います。

## ファイル

| ファイル | 用途 |
|---|---|
| `publication_weekly_view.xlsx` | 3シート入りのローカル確認用テンプレート |
| `Weekly_Overview.csv` | 週ごとの全体状態を1行で見るためのCSV |
| `Coverage_Check.csv` | GT / GS / YT の coverage と不足モデル確認用CSV |
| `Release_Log.csv` | review / promote / verify / status の運用履歴CSV |
| `generate_xlsx.py` | CSV 3種から xlsx を再生成するスクリプト |
| `sample_weekly_update.md` | 更新担当者向けの短い手順メモ |

## シート構成

### Weekly_Overview

週次 publication の全体状態を1行で確認するシートです。

| 列 | 意味 |
|---|---|
| 対象週 | publication 対象週 |
| ステータス | `Closed` / `In Progress` / `Hold` などの運用状態 |
| publish_ready | publication gate が通ったか |
| content_kind | ranking / compare の処理状態 |
| GT coverage | Google Trends の coverage |
| GS coverage | Google Suggest の coverage |
| YT coverage | YouTube Suggest の coverage |
| ranking review | ranking candidate review の状態 |
| ranking release | ranking release の状態 |
| compare review | compare candidate review の状態 |
| compare release | compare release の状態 |
| verify all | `verify_publication_release_state.py --kind all` の結果 |
| handoff | 対象 handoff manifest |
| 注意点 | editorial review や signal quality の注意 |
| 次アクション | 次に実行すること |
| 最終更新日 | このビューを更新した日 |

### Coverage_Check

source coverage を週単位で見るシートです。何が足りないかを先に確認したいときに使います。

| 列 | 意味 |
|---|---|
| 対象週 | coverage を確認した週 |
| 対象モデル数 | publication-health denominator のモデル数 |
| GT present / missing / coverage率 | Google Trends の対象モデル coverage |
| GS present / missing / coverage率 | Google Suggest の対象モデル coverage |
| YT present / missing / coverage率 | YouTube Suggest の対象モデル coverage |
| gate結果 | `OK` / `review_only` / `blocked` など |
| 不足モデルメモ | 足りないモデルのメモ |
| brand-only除外メモ | `model_id=NULL` など denominator 外の扱い |
| 備考 | coverage gate 以外の注意点 |

### Release_Log

operator が実行した review / promote / verify / status の履歴を残すシートです。

| 列 | 意味 |
|---|---|
| 実行日 | 操作を実行した日 |
| 対象週 | release 対象週 |
| kind | `ranking` または `compare` |
| candidate status | candidate review の status |
| promotable | promote 可能だったか |
| promotion実施 | promote を実行したか |
| release week | release pointer が指す週 |
| slug | publication slug |
| verify結果 | verify 結果 |
| status確認 | status viewer で確認したか |
| stable markdown updated | stable Markdown が更新されたか |
| issues | verify / status の問題 |
| 実行メモ | 短い運用メモ |

## 毎週金曜の更新手順

1. `run_batch.py` を実行し、publication gate と coverage を確認する。
2. `run_publication_pipeline.py` を実行し、artifact / Markdown / handoff candidate を生成する。
3. `review_publication_candidate.py` で ranking / compare candidate を確認する。
4. 問題がなければ `promote_publication_candidate.py` で ranking / compare を release する。
5. `verify_publication_release_state.py --kind all` を実行する。
6. `show_publication_release_status.py --kind all --limit 5 --verbose` を実行する。
7. `Weekly_Overview.csv`、`Coverage_Check.csv`、`Release_Log.csv` を更新する。
8. 必要なら `python ops/publication_dashboard/generate_xlsx.py` で `publication_weekly_view.xlsx` を再生成する。
9. 最後に `PROJECT_STATUS.md` へ重要結果を記録し、commit / push する。

## Google Sheets への貼り付け

- CSV をそのまま Google Sheets にインポートするか、各CSVを開いてシートごとに貼り付けます。
- xlsx を Google Drive にアップロードして Google Sheets で開いても構いません。
- ただし Sheets 側だけを更新しても正本更新にはなりません。重要結果は必ず repo 側の Markdown に戻してください。
