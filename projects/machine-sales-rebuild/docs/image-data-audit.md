# 画像データ監査結果

## 対象

- 現行CSV: `data/raw/current_product_master.full.csv`（ローカル専用・Git管理外）
- v0変換出力: `data/output/product_master_v0.full.csv`（ローカル専用・Git管理外）
- 集計CSV: `data/output/image_count_distribution.csv`
- 画像0件レポート: `data/output/image_zero_count_report.md`

## 画像枚数分布

| source_image_count | 商品数 |
|---|---:|
| 0 | 924 |
| 1 | 0 |
| 2 | 0 |
| 3 | 0 |

## 現行 `画像1〜3` の実態

`画像1〜3` は、今回の values API エクスポートではURLとして取得できなかった。  
`transform_current_to_v0.py` は `http://` / `https://` で始まる値だけを元画像URLとして採用し、それ以外は `image_url_suspicious` warning に分離する。

`data/output/transform_warnings.csv` では、非URLの画像欄値が15件見つかった。代表例は次の通り。

| 商品コード | 画像欄値 |
|---|---|
| `OOB116001AT` | `中村様`, `見積中` |
| `OONT15094AM` | `池田`, `見積中` |
| `OONT16118AB` | `ミッキー`, `見積中` |
| `HYTG20502AT` | `池田` |
| `HYNT20562AT` | `栗本`, `見積中` |

## hyperlink / formula 切り分け

`scripts/inspect_sheet_cells.mjs` で `'ネットショップ商品一覧'!P1:R8` を gridData 取得したところ、`画像1〜3` セルには `hyperlink` や `formulaValue` が付いておらず、`formattedValue` / `userEnteredValue` も文字列そのものだった。  
少なくとも確認範囲では、URLがセル属性に隠れているわけではなかった。

## 現時点の判断

- `ネットショップ商品一覧` の `画像1〜3` は、次フェーズの700x700派生生成の入力URLとしてそのまま使えない
- 画像ソースは WordPress メディア、旧 `generate.php` が参照している別ストア、または手動管理フォルダから回収する必要がある可能性が高い
- `products.full.sample.json` は画像なしでも破綻なく生成できるが、現状は `images=[]` が全件になっているため、画像フェーズ着手前に元画像URLの所在確定が必須

## 次の確認

- `generate.php` / WordPress 側で商品コード→画像URLをどこから引いているか
- 現行サイト上の商品画像URLを商品コード単位で逆引きできるか
- 商品シート外に画像管理台帳や Drive フォルダ命名規則があるか
## 2026-04-05 phase5B 再実行結果

### 件数

| 指標 | 件数 |
|---|---:|
| 変換対象商品 | 924 |
| `source_image_count=0` | 924 |
| `source_image_count=1` | 0 |
| `source_image_count=2` | 0 |
| `source_image_count=3` | 0 |
| `画像1` 非空 | 9 |
| `画像2` 非空 | 0 |
| `画像3` 非空 | 6 |
| 非URL値 warning | 15 |

### 確認したこと

- `画像1〜3` から URL は1件も取得できなかった
- 非URL値として `中村様`、`見積中`、`池田`、`ミッキー`、`栗本` などが入っていた
- `inspect_sheet_cells.mjs` で live sheet の `P:R` 列を確認したところ、少なくとも確認範囲では `userEnteredValue.stringValue` の plain text で、hyperlink や formula は見えなかった

### 判断

- 現行 `ネットショップ商品一覧` の `画像1〜3` は元画像URLの正本とはみなせない
- 次に調べるべき候補は、WordPress側メディア参照、別シートの画像管理列、または旧出力CSV/バックアップ
