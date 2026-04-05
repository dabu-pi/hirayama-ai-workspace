# PROJECT_STATUS

最終更新: 2026-04-05

## 現在地

- phase5B の実データ検証まで完了
- `machine-group.net` の公開商品 66件について、WordPress 公開側から画像全件回収・700x700 派生画像生成・`products.json` 画像パス反映まで完了
- 案件フォルダ `projects/machine-sales-rebuild/` を正本として運用中

## 直近でやったこと

- 実CSV全量を `transform_current_to_v0` に流して seed / validator / warnings を補正
- `sd_product_code` の全量監査結果を整理
- `products.full.sample.json` を実データで再出力
- `画像1〜3` が画像URL列ではなく plain text 混入列であることを再確認
- 自社画像 / 競合画像の正本候補と保存先候補を整理
- `machine-group.net` の公開商品ページで、商品コードと WordPress 画像URLの対応パターンを確認
- 6商品の小規模回収テストで 15画像の保存に成功し、本文ギャラリー抽出ルールを確認
- 公開商品 66件・163画像の全件回収に成功し、`public_image_manifest.csv` を生成
- 公開商品 66件・163枚の 700x700 派生画像生成に成功し、`public_derived_image_manifest.csv` を生成
- 公開商品 66件の `products.public.with-images.json` を生成し、`displayUrl` / `galleryUrls` を反映
- 画像パス紐付け検証で `displayUrl` 欠損 0件、`galleryUrls` 0件商品 0件を確認
- `sourceUrl=noimage.jpg` の placeholder 商品が 3件あることを binding report に記録
- 代表9商品でフロント相当の表示確認を行い、通常商品の白余白・primary・gallery順は許容範囲と判断
- `imageStatus` / `hasRealImage` を JSON に追加し、placeholder 3件だけ「画像準備中」へ分岐できる状態にした

## 完了済み

- v0 雛形CSV
- 現行 -> v0 変換スクリプト
- v0 -> `products.json` 出力スクリプト
- `sd_product_code` ライブラリとテスト
- settings seed
- phase5B 実データ監査
- 画像正本探索メモ

## 次の一手

1. 通常商品 63件のフロント実装組み込みへ進める
2. placeholder 3件に「画像準備中」表示を入れる軽微 UI 分岐を実装する
3. Google Drive URL 置換規則と `baseImageUrl` 前置ルールを決める
4. 非公開商品や売却済み商品の画像を公開側だけで拾えるか確認する
5. `strongdepot-product-manager` の PHP / WordPress 側資産を回収する

## 保留事項

- 自社商品画像の正本保管先
- 競合画像を同一設計に載せるかどうか
- `KT` / `US` / 年コード `AT` の恒久扱い
- 売却済み商品の公開方針

## テスト状況

- `uv run python -m unittest discover -s tests -v`
- 現在は 21 tests OK
- 画像系 3 tests は `uv run --with pillow python -m unittest tests.test_image_derivation -v` で確認

## 実行コマンド

```powershell
Set-Location C:\hirayama-ai-workspace\workspace\projects\machine-sales-rebuild
$env:UV_CACHE_DIR='C:\hirayama-ai-workspace\workspace\.uv-cache'

uv run python -m scripts.prepare_wordpress_public_targets --input data\output\product_master_v0.full.csv --output data\output\wordpress_recovery_public_targets.csv
uv run python -m scripts.recover_wordpress_images --input data\output\wordpress_recovery_public_targets.csv --output-dir data\raw-images\wordpress-public --results-csv data\output\wordpress_recovery_public_results.csv --failures-csv data\output\wordpress_recovery_public_failures.csv --request-interval-seconds 0.25
uv run python -m scripts.summarize_wordpress_recovery --targets data\output\wordpress_recovery_public_targets.csv --results data\output\wordpress_recovery_public_results.csv --failures data\output\wordpress_recovery_public_failures.csv --manifest data\output\public_image_manifest.csv --summary-csv data\output\wordpress_public_recovery_summary.csv --summary-md data\output\wordpress_public_recovery_summary.md
uv run --with pillow python -m scripts.generate_derived_images --input data\output\public_image_manifest.csv --output-dir data\derived-images\public-700x700 --results-csv data\output\public_derived_image_results.csv --failures-csv data\output\public_derived_image_failures.csv --manifest-csv data\output\public_derived_image_manifest.csv --summary-csv data\output\public_derived_image_summary.csv --summary-md data\output\public_derived_image_summary.md --visual-check-csv data\output\public_derived_image_visual_check.csv
uv run python -m scripts.export_products_json --input data\output\product_master_v0.full.csv --seed-dir data\seeds --output data\output\products.public.with-images.json --source-manifest data\output\public_image_manifest.csv --derived-manifest data\output\public_derived_image_manifest.csv --image-path-prefix public-700x700 --public-only --binding-report data\output\products_public_image_binding_report.csv --binding-summary-csv data\output\products_public_image_binding_summary.csv --binding-summary-md data\output\products_public_image_binding_summary.md --frontend-check-targets data\output\frontend_image_check_targets.csv --derived-results data\output\public_derived_image_results.csv
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
- `docs/image-derivation-spec.md`
- `docs/products-json-generation.md`
- `docs/frontend-image-check-plan.md`
- `docs/sd-product-code-audit.md`
- `data/output/public_image_manifest.csv`
- `data/output/public_derived_image_manifest.csv`
- `data/output/products_public_image_binding_report.csv`
- `data/output/products_public_placeholder_report.csv`
- `data/output/frontend_image_check_targets.csv`
- `data/output/frontend_placeholder_check.csv`
