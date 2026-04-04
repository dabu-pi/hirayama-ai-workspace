# 新統合スプレッドシート v0 列定義たたき台

最終更新: 2026-04-04

## 目的

現行の複数ブック・複数タブ・GAS/WordPress混在構造を、新システム用の別スプレッドシートv0として再設計するための初期列定義を整理する。

## 設計方針

- 現行正本は壊さず、新統合シートv0は別ブックとして作る
- 商品マスタ本体、設定マスタ、サイト出力ビュー、見積、競合、アーカイブを明確に分ける
- WordPress固有列は商品マスタ本体に直接入れず、サイト出力ビューまたは `legacy_*` 列に隔離する
- 見積・案件・競合・画像は ID で関連付け、タブ名や固定セル参照に依存しない
- 最初から完璧なDB正規化を狙わず、スプレッドシートで運用しやすい最小構造を優先する

## タブ構成案

| タブ名案 | タブの目的 | 主キー候補 | 必須列 | 任意列 | 現行のどの列を引き継ぐか | 新しく追加すべき列 | このタブに持たせないもの |
|---|---|---|---|---|---|---|---|
| `商品マスタ` | 商品1件ごとの正本データを管理する | `product_id`、`sd_product_code` | `product_id`、`sd_product_code`、`product_name`、`maker_id`、`location_code`、`purchase_year_code`、`body_part_code`、`category_code`、`condition_status`、`sales_status`、`list_price_ex_tax`、`current_price_ex_tax`、`is_published` | `description_html`、`description_text`、`size_text`、`weight_text`、`search_keywords`、`cost_ex_tax`、`shipping_cost_ex_tax`、`supplier_name`、`purchased_at`、`sold_at`、`sold_to`、`notes` | `ネットショップ商品一覧` の商品名、説明、状態、店舗、仕入れ年、鍛える部位、トレーニングマシンの種類、サイズ、重量、検索キーワード、公開状態、商品コード、値引き後価格、仕入年月日、仕入先、原価、送料、販売年月日、売却価格、販売先 | `product_id`、`maker_id`、`category_code`、`sales_status`、`created_at`、`updated_at`、`source_sheet_name`、`source_row_no`、`legacy_wp_post_id` | WordPress taxonomy文字列、`post_type`、`post_status`、見積の小計/税/合計、競合価格の生ログ |
| `設定マスタ` | 店舗/メーカー/年/部位/カテゴリ/状態/チャネル変換などの共通マスタを一元化する | `master_type + master_key` | `master_type`、`master_key`、`display_name`、`is_active`、`sort_order` | `code_value`、`legacy_wp_slug`、`aliases`、`notes` | `ルール` シート、GAS配列 `shops` / `makers` / `machines` / `bodyParts` / `productStatus` / `postStatus` / `topPages` | `master_id`、`normalized_name`、`effective_from`、`effective_to`、`validation_rule` | 個別商品の価格・在庫、見積案件ごとの値引き結果、競合商品ごとの取得ログ |
| `サイト出力ビュー` | 新サイト/BASE等へ渡す公開用商品ビューを生成・確認する | `product_id + channel_code` | `product_id`、`channel_code`、`slug`、`title`、`description`、`price_ex_tax`、`price_in_tax`、`visibility_status`、`main_image_url` | `category_paths`、`maker_label`、`location_label`、`condition_label`、`seo_title`、`seo_description`、`canonical_url`、`legacy_wp_category_text` | `Wordpress用csv`、`BASE用csv` のうち商品表示に必要な列 | `channel_code`、`export_status`、`exported_at`、`export_error`、`json_payload_preview` | 原価、仕入先、社内メモ、顧客個人情報、freee partner_id |
| `見積入力` | 作成中の見積ヘッダと明細を行ベースで管理し、旧 `mitsumori` の役割を置き換える | `quote_id + line_no` | `quote_id`、`line_no`、`line_type`、`item_source_type`、`item_code`、`item_name`、`quantity`、`unit_price_ex_tax`、`line_amount_ex_tax` | `maker_name`、`sd_product_code`、`product_id`、`discount_amount_ex_tax`、`cost_ex_tax`、`shipping_cost_ex_tax`、`installation_fee_ex_tax`、`tax_rate`、`line_note` | `mitsumori` のA〜M列、N〜AB列の割引候補、K2/K3、`その他の商品一覧` の品番/商品名/定価/仕入値/メーカー名 | `quote_id`、`line_no`、`item_source_type`、`product_id`、`calculation_status`、`validation_message` | 顧客提出用帳票レイアウトそのもの、`商品名（現状価格xxx円）` の文字列埋め込み前提 |
| `見積履歴` | 見積ヘッダ、案件状態、freee/Gmail連携状態、提出版帳票URLを管理する | `quote_id` | `quote_id`、`deal_id`、`customer_name`、`quote_subject`、`quote_status`、`subtotal_ex_tax`、`tax_amount`、`total_in_tax`、`quoted_at` | `customer_email`、`owner_name`、`quote_sheet_url`、`freee_partner_id`、`freee_quotation_id`、`gmail_message_id`、`draft_created_at`、`check_required_reason`、`source_quote_tab` | `2024長谷川さん`、`【見積】長谷川様ご依頼分` 顧客別タブ、`見積書テンプレート` | `quote_id`、`deal_id`、`source_spreadsheet_id`、`source_sheet_name`、`source_total_cell`、`sync_status` | 商品マスタの全属性、競合HTML、WordPress taxonomy文字列 |
| `競合価格データ` | 競合サイトから取得した商品スナップショットと分類/比較状態を管理する | `competitor_product_id` | `competitor_product_id`、`source_site`、`source_url`、`fetched_at`、`product_name_raw`、`maker_name_raw`、`maintenance_price`、`current_price` | `description_html`、`image_urls`、`category_raw`、`maker_id_matched`、`category_code_matched`、`linked_product_id`、`price_gap_note`、`review_status` | `STRONGDEPOT 競合サイトデータ` / `リサイフィット`、`競合サイトデータまとめ`、`他社競合データ` | `review_status`、`matched_confidence`、`normalized_price_ex_tax`、`source_html_version` | 自社商品の仕入原価、見積合計、顧客個人情報 |
| `アーカイブ` | 旧コピー・旧テンプレ・要確認タブの凍結参照リストを管理する | `archive_id` | `archive_id`、`source_type`、`spreadsheet_name`、`spreadsheet_id`、`sheet_name`、`archive_reason`、`status` | `last_known_updated_at`、`owner`、`replacement_link`、`notes` | `ネットショップ商品一覧2024`、`ネットショップ商品一覧3.24bk`、`旧見積もりシート`、`シート10`、`リンク` の旧IDなど | `archive_id`、`replacement_sheet_or_doc`、`review_due_at` | 現役商品の更新データ、実行中GAS設定 |

## タブ別の補足設計

### 1. 商品マスタ

- `sd_product_code` は現行互換の外部業務コードとして必ず保持する。
- ただし、メーカー・店舗・年・部位は `sd_product_code` から毎回復元せず、独立列を正として持つ。
- 画像はこのタブに `Photo1`〜`Photo5` のような横持ち列で埋め続けず、必要なら別途 `商品画像` 補助タブを切る。v0では `main_image_url` と `sub_image_urls_json` の併用でもよい。

### 2. 設定マスタ

- まずは1タブで `master_type` に `location` / `maker` / `purchase_year` / `body_part` / `category` / `condition_status` / `sales_status` / `channel` を入れる方式でもよい。
- 現行の `ルール` シートと GAS配列と `Settings.php` の差分を吸収する場所として設計する。
- 表記ゆれは `aliases` に寄せ、商品コード生成用の `code_value` とサイト出力用の `legacy_wp_slug` を分ける。

### 3. サイト出力ビュー

- 商品マスタ本体とは別に、公開対象・表示名・価格・カテゴリ・画像・SEO・エクスポート状態だけを持つビューとして作る。
- ここから `products.json` を生成する前提にすると、WordPress列を中核商品マスタへ戻さずに済む。

### 4. 見積入力 / 見積履歴

- 現行 `mitsumori` の「商品入力と金額計算」と、`長谷川様ご依頼分` の「顧客提出版帳票保存」と、`2024長谷川さん` の「案件台帳/freee状態」を分けて、`見積入力` と `見積履歴` に寄せる。
- `見積入力` は明細行ベース、`見積履歴` はヘッダ/案件ベースにする。
- 旧GASの `現状価格` 文字列split依存は引き継がず、金額は数値列を正にする。

### 5. 競合価格データ

- `リサイフィット` のスクレイピング生データと、メーカー/カテゴリ正規化結果、レビュー状態を同居させる。
- `競合サイトデータまとめ` の `メーカー分類` エラーをそのまま持ち込まず、`review_status` と `matched_confidence` を入れて人手確認できるようにする。

### 6. アーカイブ

- 旧ブック/旧タブを消さず、どれが旧運用か、何に置き換えたか、いつ再確認するかを管理する。
- `削除候補` を急いで作るのではなく、まず `旧運用` / `要確認` / `凍結` を明示する。

## 最初に決めるべきID設計

| ID | 用途 | 方針 |
|---|---|---|
| `product_id` | 新システム内部の商品主キー | `P-000001` など現行商品コードと独立したID |
| `sd_product_code` | 現行互換の商品コード | 既存値を保持し、生成要素も別列で保存 |
| `quote_id` | 見積ヘッダ主キー | `Q-YYYYMMDD-001` など案件と独立して管理 |
| `deal_id` | 案件主キー | `D-YYYYMMDD-001` など |
| `competitor_product_id` | 競合商品スナップショット主キー | ソースサイト + 収集日時 + 通番、または連番ID |
| `archive_id` | 旧資産参照リスト主キー | `A-0001` など |

## 今回新たに確定したこと

- 新統合シートv0では、現行の `ネットショップ商品一覧`、`ルール`、`Wordpress用csv`、`mitsumori`、`2024長谷川さん`、`リサイフィット` をそれぞれ別責務のタブに分けて設計するのが自然。
- `見積入力` は A列/B列の二系統商品参照を吸収できるよう、`item_source_type` と `item_code` を必須列にした方がよい。

## まだ未確定のこと

- `商品画像` をv0で別タブ化するか、まず `商品マスタ` にJSON文字列列として持つか
- `設定マスタ` を1タブ汎用型で始めるか、`maker_master` 等に分割して始めるか
- `見積履歴` に案件管理を全部寄せるか、別途 `案件マスタ` を切るか

## 設計に進めるようになった項目

- `商品マスタ` / `設定マスタ` / `サイト出力ビュー` / `見積入力` / `見積履歴` / `競合価格データ` / `アーカイブ` のv0スキーマレビュー
- 現行列から新列へのマッピング表作成

## 次の一手

1. この列定義案をもとに、必須列だけに絞った最小v0シート定義へ削る。
2. `products.json` の項目名と `サイト出力ビュー` の列名を揃える。
3. 見積正本フロー確定後に `見積入力` / `見積履歴` の分割粒度を調整する。

## すぐ実装着手できる候補

- 新統合スプレッドシートv0の雛形CSV/Markdown列定義
- 現行 `ネットショップ商品一覧` → `商品マスタ` の列マッピング表
- 現行 `mitsumori` → `見積入力` の列マッピング表
