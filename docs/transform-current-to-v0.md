# 現行商品マスタ → v0 商品マスタ変換 試作メモ

## 今回作ったもの

- `scripts/transform_current_to_v0.py`
- サンプル入力: `data/samples/current_product_master_input_sample.csv`
- サンプル出力: `data/samples/product_master_v0_sample.csv`
- 変換ログ: `data/output/transform_current_to_v0.log`
- エラー/警告一覧: `data/output/transform_current_to_v0_errors.csv`
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

## まだ仮の部分

- `internal_id` は行順ベースの仮採番
- `description_html` は一旦 `description_text` をそのまま転記
- `legacy_wp_post_id` が空欄のときの補完規則は暫定
- 実データ全列の廃止/継続判定は、サンプル外の列確認がまだ必要
