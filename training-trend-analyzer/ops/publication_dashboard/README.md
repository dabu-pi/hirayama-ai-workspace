# Publication Dashboard View

このフォルダは、週次 publication 運用をユーザーが見てすぐ分かる形にするための運用ビューです。

重要: このスプレッドシートは正本ではありません。正本は repo 内の Markdown、コード、`data/output/` の生成物、release ledger です。このフォルダの CSV / xlsx は、Google Sheets や Excel で確認しやすくするための見える化ビューとして使います。

## ファイル

| ファイル | 用途 |
|---|---|
| `publication_weekly_view.xlsx` | 6シート入りのローカル確認用テンプレート |
| `Weekly_Overview.csv` | 週ごとの全体状態を1行で見るためのCSV |
| `Coverage_Check.csv` | GT / GS / YT の充足状況と不足モデル確認用CSV |
| `Release_Log.csv` | 確認 / 公開反映 / 検証 / 状態確認の運用履歴CSV |
| `Ranking_Result.csv` | 週次 ranking 結果を順位順に見るためのCSV |
| `Ranking_Guide.csv` | ranking の見方、ソース、注意点を説明するCSV |
| `Source_List.csv` | ranking の元ソース有無と解釈注意を見るためのCSV |
| `generate_xlsx.py` | CSV から xlsx を再生成するスクリプト |
| `sample_weekly_update.md` | 更新担当者向けの短い手順メモ |
| `WEEKLY_PUBLICATION_RANKING_VIEW_GUIDE.md` | ranking view の読み方とWeb公開時の考え方 |

## シート構成

### 週次概要

週次 publication の全体状態を1行で確認するシートです。

| 列 | 意味 |
|---|---|
| 対象週 | publication 対象週 |
| ステータス | `完了` / `進行中` / `保留` などの運用状態 |
| 公開準備OK | publication gate が通ったか |
| 公開種別 | ランキング / 比較の処理状態 |
| GT充足 | Google Trends の充足状況 |
| GS充足 | Google Suggest の充足状況 |
| YT充足 | YouTube Suggest の充足状況 |
| ランキング確認 | ranking candidate review の状態 |
| ランキング公開 | ranking release の状態 |
| 比較確認 | compare candidate review の状態 |
| 比較公開 | compare release の状態 |
| 全体検証 | `verify_publication_release_state.py --kind all` の結果 |
| 引継ぎファイル | 対象 handoff manifest |
| 注意点 | editorial review や signal quality の注意 |
| 次アクション | 次に実行すること |
| 最終更新日 | このビューを更新した日 |

### 充足確認

source coverage を週単位で見るシートです。何が足りないかを先に確認したいときに使います。

| 列 | 意味 |
|---|---|
| 対象週 | 充足状況を確認した週 |
| 対象モデル数 | publication-health denominator のモデル数 |
| GT取得済み / GT不足 / GT充足率 | Google Trends の対象モデル充足状況 |
| GS取得済み / GS不足 / GS充足率 | Google Suggest の対象モデル充足状況 |
| YT取得済み / YT不足 / YT充足率 | YouTube Suggest の対象モデル充足状況 |
| gate結果 | `正常` / `review_only` / `blocked` など |
| 不足モデルメモ | 足りないモデルのメモ |
| ブランド行除外メモ | `model_id=NULL` など denominator 外の扱い |
| 備考 | 充足ゲート以外の注意点 |

### 公開履歴

operator が実行した確認 / 公開反映 / 検証 / 状態確認の履歴を残すシートです。

| 列 | 意味 |
|---|---|
| 実行日 | 操作を実行した日 |
| 対象週 | release 対象週 |
| 種別 | `ランキング` または `比較` |
| 候補状態 | candidate review の status |
| 公開可能 | promote 可能だったか |
| 公開反映 | promote を実行したか |
| 公開週 | release pointer が指す週 |
| slug | publication slug |
| verify結果 | verify 結果 |
| 状態確認 | status viewer で確認したか |
| 安定版本文更新 | stable Markdown が更新されたか |
| 問題 | verify / status の問題 |
| 実行メモ | 短い運用メモ |

### ランキング結果

対象週の ranking 結果を順位順に見るシートです。将来 Web 公開する場合の下書きにも使えるよう、数値だけでなく傾向コメントと公開向けひとことを入れます。

| 列 | 意味 |
|---|---|
| 対象週 | ranking 対象週 |
| 順位 | 総合スコア順の順位 |
| 機種名 | ブランド + モデル名 |
| カテゴリ | 機種カテゴリ |
| 総合スコア | GT / GS / YT をまとめて見た参考スコア |
| GT値 | Google Trends の値 |
| GS値 | Google Suggest の値 |
| YT値 | YouTube Suggest の値 |
| 傾向コメント | 運用担当者向けの読み取りメモ |
| 公開向けひとこと | Web掲載時の短い説明文の下書き |
| 注意メモ | 低値 / 0値 / 解釈注意 |

### ランキングの見方

このランキングが何を見ているか、どこまで信頼してよいか、公開時にどんな注意書きを添えるべきかを説明するシートです。

### ソース一覧

ランキング結果の裏側にある GT / GS / YT の元データ有無と、解釈注意を見るための補助シートです。順位だけで判断せず、根拠の強さを確認するために使います。

## 毎週金曜の更新手順

1. `run_batch.py` を実行し、publication gate と coverage を確認する。
2. `run_publication_pipeline.py` を実行し、artifact / Markdown / handoff candidate を生成する。
3. `review_publication_candidate.py` で ranking / compare candidate を確認する。
4. 問題がなければ `promote_publication_candidate.py` で ranking / compare を release する。
5. `verify_publication_release_state.py --kind all` を実行する。
6. `show_publication_release_status.py --kind all --limit 5 --verbose` を実行する。
7. `Weekly_Overview.csv`、`Coverage_Check.csv`、`Release_Log.csv` を更新する。
8. `Ranking_Result.csv` と `Source_List.csv` を更新し、公開向けひとことと注意メモを editorial review する。
9. 必要なら `Ranking_Guide.csv` の注記を更新する。
10. 必要なら `python ops/publication_dashboard/generate_xlsx.py` で `publication_weekly_view.xlsx` を再生成する。
11. 最後に `PROJECT_STATUS.md` へ重要結果を記録し、commit / push する。

## 表記ルール

- 見出しと状態値は日本語中心にします。
- `ranking` / `compare` / `slug` / handoff filename などの内部識別子は、意味が崩れない範囲で英字のまま残して構いません。
- `yes` / `no` / `true` / `false` は、運用ビュー上では原則 `はい` / `いいえ` に寄せます。
- `Closed` / `done` / `confirmed` / `none` は、運用ビュー上では `完了` / `確認済み` / `なし` などに寄せます。

## 信頼してよいこと / 信頼しすぎないこと

信頼してよいこと:

- 対象週、使用ソース、coverage gate の通過状況
- release / verify / status の運用完了状態
- ranking 結果がどのソース値をもとに並んでいるか

信頼しすぎないこと:

- 上位 = 販売実績や市場シェアの確定、という読み方
- coverage gate 通過 = signal quality 保証、という読み方
- GT低値 / 0値を含む候補への強い断定表現

Web公開へ転用する場合は、`ランキング結果` の上位候補と `ランキングの見方` の注意書きをセットで使います。

## Google Sheets への貼り付け

- CSV をそのまま Google Sheets にインポートするか、各CSVを開いてシートごとに貼り付けます。
- xlsx を Google Drive にアップロードして Google Sheets で開いても構いません。
- ただし Sheets 側だけを更新しても正本更新にはなりません。重要結果は必ず repo 側の Markdown に戻してください。
