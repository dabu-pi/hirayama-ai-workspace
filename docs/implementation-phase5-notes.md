# 実装フェーズ5A メモ

## 今回作ったファイル

### 雛形

- `data/templates/integrated-sheet-v0/*.csv`
- `scripts/generate_integrated_sheet_v0.py`
- `docs/integrated-sheet-v0-implementation.md`

### 変換

- `scripts/transform_current_to_v0.py`
- `data/samples/current_product_master_input_sample.csv`
- `data/samples/product_master_v0_sample.csv`
- `docs/transform-current-to-v0.md`

### JSON出力

- `scripts/export_products_json.py`
- `data/output/products.sample.json`
- `docs/products-json-generation.md`

### 商品コード検証

- `scripts/lib/sd_product_code.py`
- `docs/sd-product-code-library.md`

### 共通部品・seed・テスト

- `scripts/lib/product_v0.py`
- `data/seeds/settings_*.csv`
- `docs/settings-master-seed-notes.md`
- `tests/test_sd_product_code.py`
- `tests/test_transform_current_to_v0.py`
- `tests/test_export_products_json.py`

## まだ仮実装の部分

- `internal_id` の正式採番ルール
- `description_html` のHTML整形
- `displayUrl` の生成と保存先
- 画像0枚商品のサイト側フォールバック
- WordPress由来列の最終的な残し方/捨て方
- `sd_product_code` の新規採番生成

## 実データが必要な部分

- 現行 `ネットショップ商品一覧` の全列名と表記ゆれ
- メーカー・部位・店舗・カテゴリの未知値一覧
- 画像0枚商品の実数と許容運用
- `sd_product_code` の旧例外コード一覧
- 売却済み/非公開/トップ掲載の現行値バリエーション

## 変換で迷った列

- `Wordpress用csv.tax_products-category`: v0 の正規マスタとは別に `legacy_wp_category_text` として隔離保持
- `BASEで販売しない場合は「いいえ」を入力`: v0 の公開制御へ直接混ぜず、当面 `legacy_base_export_flag` に保持
- `売値計算式`: 数式仕様が未確定なので `remarks` に退避
- `Wordpress用csv.post_id`: 現行参照用に保持。空欄補完は暫定

## 画像設計でまだ保留の部分

- 700x700表示用画像のファイル命名・配置先・再生成タイミング
- 余白背景色や透過の扱い
- 一覧用サムネイルを `displayUrl` と分けるかどうか
- 代表画像未指定時の自動補完ルールをどこまで固定するか

## 次にGoogle Sheets実体作成へ進める状態か

ローカル雛形CSV、現行→v0変換、v0→`products.json` 出力、`sd_product_code` 検証、seed、最小テストの土台は揃った。

ただし、Google Sheets 実体作成へ進む前に、実データエクスポートを1回流して未登録マスタ・旧コード例外・画像0件の件数を確認し、seed と変換ルールの補正を入れるのが安全。

## 2026-04-05 フェーズ5Bで補正したこと

- `scripts/export_sheet_to_csv.mjs` を追加し、現行ブックをサービスアカウントで読み取り専用CSV化できるようにした
- `scripts/inspect_sheet_cells.mjs` を追加し、画像列セルの hyperlink / formula 有無を gridData で確認できるようにした
- `scripts/audit_sd_product_code.py` を追加し、`sd_product_code` 監査CSVを全件出力できるようにした
- `data/seeds/settings_*.csv` を現行 `ルール` タブに合わせて大幅拡張した
- 部位空欄は現行ルールの `AT=その他` に寄せた
- `画像1〜3` はURL形式のみ採用し、非URLテキストは `image_url_suspicious` warning に分離した
- `sd_product_code` パース時に大文字化し、`Bm` / `Hs` / `Ig` などの小文字混在旧コードを吸収した
- 商品実体がないプレースホルダ行は変換対象から除外し、`internal_id` は有効行順で採番するようにした
- `data/input/*.full.csv` と `data/output/product_master_v0.full.csv` は仕入先/販売先の文字列を含み得るため、AGENTS.md に合わせて Git 管理外にした

## 2026-04-05 フェーズ5Bの実データ監査結果

- 現行 `ネットショップ商品一覧` CSVエクスポート: 993行取得
- v0変換後の有効商品行: 924件
- 変換issue: 4,953件 → 1,126件に減少
- `sd_product_code` 監査: 775 ok / 112 warning / 37 error
- `products.full.sample.json`: 924件生成
- 画像枚数分布: `source_image_count=0` が 924件、1〜3枚は 0件

## フェーズ5Bで新たに見つかった例外

- `KOMATSU` の実商品コードで `KT` が使われている行があるが、`ルール` タブは `KO`
- `UESAKA` の実商品コードで `US` が使われている行があるが、`ルール` タブは `UE`
- `OOISAT041AT` など、年コード位置が `AT` になっている旧例外候補が26件ある
- `SANT21651AT`, `ATNT18190AT` は、商品メーカー名と既存商品コードのメーカー部が一致していない疑いがある
- 現行 `画像1〜3` からURLが取れず、`中村様` / `池田` / `見積中` のような非URLテキストが入っている行がある

## 実行コマンド

この環境では `python` ではなく `uv run python` を使う。`uv` の既定キャッシュ場所が衝突したため、`UV_CACHE_DIR` をワークスペース配下に寄せる。

```powershell
$env:UV_CACHE_DIR='C:\hirayama-ai-workspace\workspace\.uv-cache'
& 'C:\Users\pinsh\.local\bin\uv.exe' run python -m scripts.generate_integrated_sheet_v0
& 'C:\Users\pinsh\.local\bin\uv.exe' run python -m scripts.transform_current_to_v0
& 'C:\Users\pinsh\.local\bin\uv.exe' run python -m scripts.export_products_json
& 'C:\Users\pinsh\.local\bin\uv.exe' run python -m unittest discover -s tests -v
```

### 実データ監査コマンド

```powershell
$env:AIOS_SERVICE_ACCOUNT_PATH='C:\hirayama-ai-workspace\workspace\secrets\credentials.json'
node scripts\export_sheet_to_csv.mjs --sheet-name "ネットショップ商品一覧" --output data\input\current_product_master.full.csv
node scripts\export_sheet_to_csv.mjs --sheet-name "ルール" --output data\input\current_rules.full.csv

$env:UV_CACHE_DIR='C:\hirayama-ai-workspace\workspace\.uv-cache'
& 'C:\Users\pinsh\.local\bin\uv.exe' run python -m scripts.transform_current_to_v0 --input data\input\current_product_master.full.csv --output data\output\product_master_v0.full.csv --log data\output\transform_current_to_v0.full.log --error-csv data\output\transform_current_to_v0.full_errors.csv --warnings-csv data\output\transform_warnings.csv --unknown-master-csv data\output\unknown_master_values.csv --legacy-code-exceptions-csv data\output\legacy_code_exceptions.csv --image-count-distribution-csv data\output\image_count_distribution.csv --image-zero-report data\output\image_zero_count_report.md --unmapped-json data\output\transform_current_to_v0.full_unmapped.json
& 'C:\Users\pinsh\.local\bin\uv.exe' run python -m scripts.audit_sd_product_code --input data\output\product_master_v0.full.csv --seed-dir data\seeds --output data\output\sd_product_code_audit.csv
& 'C:\Users\pinsh\.local\bin\uv.exe' run python -m scripts.export_products_json --input data\output\product_master_v0.full.csv --seed-dir data\seeds --output data\output\products.full.sample.json
```
