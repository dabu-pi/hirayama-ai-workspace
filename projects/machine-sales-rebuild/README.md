# 中古マシン販売システム再構築

## 目的

STRONG DEPOT 系の現行中古マシン販売運用を整理し、商品マスタ・設定マスタ・サイト出力・`products.json`・画像派生生成を、WordPress依存を減らした新構造へ段階移行する。

## 現在地

- 設計フェーズ4完了
- 画像仕様反映完了
- 実装フェーズ5Aの試作完了
- 実装フェーズ5Bで実CSV全量監査、seed補正、`sd_product_code` 監査、画像入力監査まで完了
- 次は「元画像URLの正本特定」と「700x700派生画像生成試作」

## 主なフォルダ

- `docs/`
  この案件専用の調査・設計・実装メモ
- `data/raw/`
  実CSVエクスポートなどのローカル専用入力
- `data/templates/`
  v0 雛形CSV
- `data/seeds/`
  設定マスタ seed
- `data/samples/`
  サンプル入出力
- `data/output/`
  変換結果、監査CSV、`products.json` 試作
- `scripts/`
  変換・監査・出力スクリプト
- `tests/`
  unittest
- `references/`
  legacy-gas / php-notes / source-memos の保管場所
- `config/`
  将来の設定ファイル置き場
- `tmp/`
  一時作業用

## 実行方針

この案件は **project root に移動してから** 実行する。

```powershell
Set-Location C:\hirayama-ai-workspace\workspace\projects\machine-sales-rebuild
```

Python は `uv run python -m ...` に統一する。

## 主な実行コマンド

```powershell
$env:UV_CACHE_DIR='C:\hirayama-ai-workspace\workspace\.uv-cache'
uv run python -m scripts.generate_integrated_sheet_v0
uv run python -m scripts.transform_current_to_v0
uv run python -m scripts.export_products_json
uv run python -m scripts.audit_sd_product_code
uv run python -m unittest discover -s tests -v
```

Google Sheets の読み取り専用エクスポート:

```powershell
$env:AIOS_SERVICE_ACCOUNT_PATH='C:\hirayama-ai-workspace\workspace\secrets\credentials.json'
node scripts\export_sheet_to_csv.mjs --sheet-name "ネットショップ商品一覧" --output data\raw\current_product_master.full.csv
node scripts\export_sheet_to_csv.mjs --sheet-name "ルール" --output data\raw\current_rules.full.csv
```

## 注意事項

- 既存のスプレッドシート / GAS / PHP は変更しない
- `data/raw/*.full.csv` と `data/output/product_master_v0.full.csv` は実データを含み得るため Git 管理外
- `data/output/*.full.log` もローカルログとして Git 管理外
- root の `docs/PROJECT_STATUS.md` は全体の入口として残し、詳細進捗はこの案件フォルダ側へ寄せる

## 今後の予定

1. 商品コードごとの元画像URL正本を特定する
2. 700x700 正方形派生画像の生成試作を追加する
3. 画像反映済み `products.json` / site output view を再検証する
