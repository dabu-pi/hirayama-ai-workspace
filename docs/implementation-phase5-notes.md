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

## 実行コマンド

この環境では `python` ではなく `uv run python` を使う。`uv` の既定キャッシュ場所が衝突したため、`UV_CACHE_DIR` をワークスペース配下に寄せる。

```powershell
$env:UV_CACHE_DIR='C:\hirayama-ai-workspace\workspace\.uv-cache'
& 'C:\Users\pinsh\.local\bin\uv.exe' run python -m scripts.generate_integrated_sheet_v0
& 'C:\Users\pinsh\.local\bin\uv.exe' run python -m scripts.transform_current_to_v0
& 'C:\Users\pinsh\.local\bin\uv.exe' run python -m scripts.export_products_json
& 'C:\Users\pinsh\.local\bin\uv.exe' run python -m unittest discover -s tests -v
```
