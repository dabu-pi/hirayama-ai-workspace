# 現行商品マスタ → v0 商品マスタ変換 試作メモ

## 今回作ったもの

- `scripts/transform_current_to_v0.py`
- サンプル入力: `data/samples/current_product_master_input_sample.csv`
- サンプル出力: `data/samples/product_master_v0_sample.csv`
- 変換ログ: `data/output/transform_current_to_v0.log`
- エラー/警告一覧: `data/output/transform_current_to_v0_errors.csv`
- warningのみ抽出: `data/output/transform_warnings.csv`
- 未登録マスタ集計: `data/output/unknown_master_values.csv`
- 商品コード旧例外集計: `data/output/legacy_code_exceptions.csv`
- 画像枚数分布: `data/output/image_count_distribution.csv`
- 画像0件レポート: `data/output/image_zero_count_report.md`
- 未変換項目一覧: `data/output/transform_current_to_v0_unmapped.json`

## 変換方針

| 現行 | v0 | 備考 |
|---|---|---|
| `新規自動生成商品コード` | `sd_product_code` | 既存コードを保持し、別途検証ステータスを付与 |
| `画像1〜3` | `source_image_urls_json` | 空欄を除外し、順序を維持したJSON配列へ変換 |
| `画像1〜3` | `source_image_count`, `main_image_index`, `main_source_image_url` | 代表画像は先頭画像を初期値にする |
| `公開状態` + `状態` | `publish_status`, `inquiry_enabled`, `sold_out_flag` | 売却済みは `sold_visible`、非公開は `private` に正規化 |
| `メーカー名` / `店舗` / `鍛える部位` / `状態` / `トレーニングマシンの種類` | 各 `*_code` + `*_label` | seed マスタ照合。未登録値は fallback code を残して警告 |
| `定価（税抜き）` / `値引き後の価格（税抜き）` / `原価` / `送料` / `売却価格` | 価格・原価系数値列 | 数値化できない場合は空欄 |
| WordPress列 | `legacy_wp_*` | 現行由来情報として隔離保持 |

## 画像ゼロ件行の扱い

- 行自体は除外しない
- `source_image_urls_json = []`, `source_image_count = 0`, `main_image_index = ""`
- `image_missing` warning をログに出す

## フェーズ5Bで補正した変換ルール

- `メーカー名`, `状態`, `店舗`, `カテゴリ` などは seed を現行 `ルール` タブに合わせて拡張した
- `鍛える部位` が空欄の行は、現行ルールに合わせて `AT=その他` として扱い、空欄警告を出さない
- `画像1〜3` は `http://` / `https://` で始まる値だけを `source_image_urls_json` に採用し、それ以外は `image_url_suspicious` warning に分離する
- 商品名・メーカー・状態・店舗・部位・カテゴリ・説明・画像・商品コードがすべて空のプレースホルダ行は、`通し番号` だけ残っていても変換対象から除外する
- `internal_id` は変換後の有効行順で採番し、プレースホルダ行除外後に欠番だらけにならないようにした

## 実データ全量での結果

- 入力 `data/input/current_product_master.full.csv`: 993行取得
- 出力 `data/output/product_master_v0.full.csv`: 924商品行
- issue数: 4,953件 → seed/変換補正後 1,126件

残っている主な issue は `image_missing` 924件、`sd_product_code_validation` 149件、未登録メーカー23件、非URL画像欄15件、未登録カテゴリ11件、未登録店舗4件。

## 検証ログの読み方

- `maker_unregistered`: seedマスタにメーカーがない
- `image_missing`: 元画像URLが0件
- `sd_product_code_validation`: 商品コードの分解・照合結果

今回のサンプルでは、`HYIC24909AT` は「部位列=肩」だが商品コード末尾が `AT` のため、部位不一致のエラー確認用データとして残している。

## 実行コマンド

```powershell
$env:UV_CACHE_DIR='C:\hirayama-ai-workspace\workspace\.uv-cache'
& 'C:\Users\pinsh\.local\bin\uv.exe' run python -m scripts.transform_current_to_v0
```

実CSV全量での実行例:

```powershell
$env:UV_CACHE_DIR='C:\hirayama-ai-workspace\workspace\.uv-cache'
& 'C:\Users\pinsh\.local\bin\uv.exe' run python -m scripts.transform_current_to_v0 --input data\input\current_product_master.full.csv --output data\output\product_master_v0.full.csv --log data\output\transform_current_to_v0.full.log --error-csv data\output\transform_current_to_v0.full_errors.csv --warnings-csv data\output\transform_warnings.csv --unknown-master-csv data\output\unknown_master_values.csv --legacy-code-exceptions-csv data\output\legacy_code_exceptions.csv --image-count-distribution-csv data\output\image_count_distribution.csv --image-zero-report data\output\image_zero_count_report.md --unmapped-json data\output\transform_current_to_v0.full_unmapped.json
```

## まだ仮の部分

- `internal_id` は行順ベースの仮採番
- `description_html` は一旦 `description_text` をそのまま転記
- `legacy_wp_post_id` が空欄のときの補完規則は暫定
- 実データ全列の廃止/継続判定は、サンプル外の列確認がまだ必要
