# PROJECT_STATUS

最終更新: 2026-04-05

## 現在地

- phase5B の実データ検証まで完了
- 画像派生生成にはまだ進まず、`machine-group.net` を対象に WordPress 画像小規模回収テストまで実施
- 案件フォルダ `projects/machine-sales-rebuild/` を正本として運用中

## 直近でやったこと

- 実CSV全量を `transform_current_to_v0` に流して seed / validator / warnings を補正
- `sd_product_code` の全量監査結果を整理
- `products.full.sample.json` を実データで再出力
- `画像1〜3` が画像URL列ではなく plain text 混入列であることを再確認
- 自社画像 / 競合画像の正本候補と保存先候補を整理
- `machine-group.net` の公開商品ページで、商品コードと WordPress 画像URLの対応パターンを確認
- 6商品の小規模回収テストで 15画像の保存に成功し、本文ギャラリー抽出ルールを確認

## 完了済み

- v0 雛形CSV
- 現行 -> v0 変換スクリプト
- v0 -> `products.json` 出力スクリプト
- `sd_product_code` ライブラリとテスト
- settings seed
- phase5B 実データ監査
- 画像正本探索メモ

## 次の一手

1. 非公開商品や売却済み商品の画像を公開側だけで拾えるか確認する
2. `strongdepot-product-manager` の PHP / WordPress 側資産を回収する
3. Google Drive に自社商品画像フォルダがあるか確認する
4. 条件が揃ったら 700x700 派生画像生成フェーズへ進む

## 保留事項

- 自社商品画像の正本保管先
- 競合画像を同一設計に載せるかどうか
- `KT` / `US` / 年コード `AT` の恒久扱い
- 売却済み商品の公開方針

## テスト状況

- `uv run python -m unittest discover -s tests -v`
- 現在は 16 tests OK

## 実行コマンド

```powershell
Set-Location C:\hirayama-ai-workspace\workspace\projects\machine-sales-rebuild
$env:UV_CACHE_DIR='C:\hirayama-ai-workspace\workspace\.uv-cache'

uv run python -m scripts.generate_integrated_sheet_v0
uv run python -m scripts.transform_current_to_v0
uv run python -m scripts.audit_sd_product_code
uv run python -m scripts.export_products_json
uv run python -m unittest discover -s tests -v
```

実CSV再取得:

```powershell
Set-Location C:\hirayama-ai-workspace\workspace\projects\machine-sales-rebuild
$env:AIOS_SERVICE_ACCOUNT_PATH='C:\hirayama-ai-workspace\workspace\secrets\credentials.json'
node scripts\export_sheet_to_csv.mjs --sheet-name "ネットショップ商品一覧" --output data\raw\current_product_master.full.csv
```

## 参照すべき主要 docs

- `docs/implementation-phase5-notes.md`
- `docs/image-source-discovery.md`
- `docs/wordpress-image-source-investigation.md`
- `docs/image-file-naming-hypothesis.md`
- `docs/image-storage-options.md`
- `docs/image-data-audit.md`
- `docs/image-generation-phase-plan.md`
- `docs/sd-product-code-audit.md`
