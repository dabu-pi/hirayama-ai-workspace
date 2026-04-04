# 画像データ監査

最終更新: 2026-04-05

## 対象

- 実CSV: `data/raw/current_product_master.full.csv`
- v0変換結果: `data/output/product_master_v0.full.csv`
- 集計: `data/output/image_count_distribution.csv`
- 0件レポート: `data/output/image_zero_count_report.md`
- live sheet spot check: `scripts/inspect_sheet_cells.mjs`

## 件数サマリ

| 項目 | 件数 |
|---|---:|
| 変換対象商品 | 924 |
| `source_image_count = 0` | 924 |
| `source_image_count = 1` | 0 |
| `source_image_count = 2` | 0 |
| `source_image_count = 3` | 0 |
| 現行 `画像1` 非空 | 9 |
| 現行 `画像2` 非空 | 0 |
| 現行 `画像3` 非空 | 6 |
| `image_url_suspicious` warning | 15 |

## 非URL値の代表例

- 人名らしき値: `中村様`, `池田`, `ミッキー`, `栗本`
- 状態メモらしき値: `見積中`
- 案件メモらしき値: `菅野様預かり`, `請求中`

## 分かったこと

- phase5B で確認した範囲では、現行 `画像1〜3` は URL 列として機能していない。
- `transform_current_to_v0.py` は `http://` / `https://` を画像URL候補として扱うが、実CSVでは該当値を確認できなかった。
- `scripts/inspect_sheet_cells.mjs` で `ネットショップ商品一覧` の `画像1〜3` を `gridData` で確認したところ、確認セルは plain text で、`hyperlink` と `formulaValue` は見つからなかった。
- そのため、現行シートの `画像1〜3` をそのまま `source_image_urls` に移す方針は成立しない。

## `画像1〜3` 列の意味の再整理

現時点では、`画像1〜3` は次のいずれかが混在している可能性が高い。

1. 画像URLを入れるつもりだったが、運用途中でメモ欄化した
2. 商品画像そのものではなく、案件担当者や進行状態の備忘欄として使われた
3. 一部時期だけ別システムのキーや手入力メモが入り、列用途が崩れた

少なくとも v0 移行で信頼できる画像正本として扱う列ではない。

## 今後の扱い案

- `画像1〜3` は画像正本としては移行しない
- 非URL値は `transform_warnings.csv` と監査ドキュメントで追跡する
- v0 の `source_image_urls_json` は、正本が確定するまで空配列のまま維持する
- 必要なら現行列は「旧運用メモ由来の監査対象」として別途保全し、画像設計とは切り離す

## 移行時の基本方針

- 画像正本が確定するまで `products.json.images` は空配列を許容する
- 700x700 派生画像生成には進まない
- 次フェーズでは、WordPress 側の過去画像資産と Google Drive 側の候補を探索し、商品コードと画像群を結びつけられるかを先に確認する

## 未解決

- `画像1〜3` がいつからメモ欄化したか
- 旧運用で実画像をどこから WordPress に渡していたか
- 自社商品画像の正本が WordPress メディア、ローカル控え、Google Drive のどこに残っているか
