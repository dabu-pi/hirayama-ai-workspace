# 新統合シート v0 雛形実装メモ

## 今回作ったもの

- `data/templates/integrated-sheet-v0/` 配下のCSV雛形
- `scripts/generate_integrated_sheet_v0.py`
- 雛形列定義の共通化: `scripts/lib/product_v0.py`

## 画像列の実装判断

`product_master.csv` の画像正本は、次の3列で保持する方針にした。

| 列名 | 役割 |
|---|---|
| `source_image_urls_json` | 元画像URL配列をJSON文字列で保持する正本列 |
| `source_image_count` | 元画像枚数の確認用。最低1枚/最大10枚の運用チェックに使う |
| `main_image_index` | 代表画像の位置。1始まりで管理し、未設定時は空欄を許容 |
| `main_source_image_url` | シート上で代表画像を目視確認しやすくする補助列 |

## この形を選んだ理由

- 画像1〜10を個別列にすると列数が増えすぎ、将来拡張時にシートとスクリプトの両方が重くなるため
- JSON 1列なら画像配列の順序を維持しやすく、`products.json` への変換もしやすいため
- 一方でシート運用上の見やすさも残したいので、枚数と代表画像URLだけ補助列として分離したため

## 雛形生成コマンド

```powershell
Set-Location C:\hirayama-ai-workspace\workspace\projects\machine-sales-rebuild
$env:UV_CACHE_DIR='C:\hirayama-ai-workspace\workspace\.uv-cache'
uv run python -m scripts.generate_integrated_sheet_v0
```

## 注意

- この雛形はローカル試作用であり、既存Google Sheets本体はまだ変更しない
- 表示用700x700画像URLは `site_output_view` / `products.json` 側の派生項目として扱い、`product_master` の正本には持たせない
