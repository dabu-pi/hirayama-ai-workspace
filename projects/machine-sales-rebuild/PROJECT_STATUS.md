# PROJECT_STATUS

## 現在地

- 実装フェーズ5B完了直後
- 現行 `ネットショップ商品一覧2018-10-22` を実CSV化して v0 変換・監査済み
- この案件専用ファイルは `projects/machine-sales-rebuild/` 配下へ再編済み

## 直近でやったこと

- docs / data / scripts / tests を案件フォルダへ移動
- seed を現行 `ルール` タブベースで拡張
- `sd_product_code` 全件監査と画像入力監査を追加
- `products.full.sample.json` を実データベースで再出力
- 実行コマンドを project root 基準へ統一

## 次の一手

1. `docs/image-data-audit.md` を起点に元画像URLの正本ソースを確定する
2. `docs/sd-product-code-audit.md` の `KT` / `US` / 年 `AT` / メーカー不一致行を現場確認する
3. `docs/image-generation-phase-plan.md` を元に 700x700 派生画像生成フェーズへ進む

## 保留事項

- `KOMATSU=KT`, `UESAKA=US`, 年コード `AT` の扱い
- `EVERLAST`, `LEGENDFITNESS`, `PT` を seed に追加するか
- 売却済み商品の `sold_visible` 運用条件
- 元画像URLが現行 `画像1〜3` に存在しない問題

## 実行コマンド

```powershell
Set-Location C:\hirayama-ai-workspace\workspace\projects\machine-sales-rebuild
$env:UV_CACHE_DIR='C:\hirayama-ai-workspace\workspace\.uv-cache'

uv run python -m scripts.generate_integrated_sheet_v0
uv run python -m scripts.transform_current_to_v0
uv run python -m scripts.export_products_json
uv run python -m scripts.audit_sd_product_code
uv run python -m unittest discover -s tests -v
```

実CSV取得:

```powershell
$env:AIOS_SERVICE_ACCOUNT_PATH='C:\hirayama-ai-workspace\workspace\secrets\credentials.json'
node scripts\export_sheet_to_csv.mjs --sheet-name "ネットショップ商品一覧" --output data\raw\current_product_master.full.csv
node scripts\export_sheet_to_csv.mjs --sheet-name "ルール" --output data\raw\current_rules.full.csv
```

## 参照すべき主要 docs

- `docs/implementation-phase5-notes.md`
- `docs/transform-current-to-v0.md`
- `docs/products-json-generation.md`
- `docs/sd-product-code-audit.md`
- `docs/image-data-audit.md`
- `docs/image-generation-phase-plan.md`
