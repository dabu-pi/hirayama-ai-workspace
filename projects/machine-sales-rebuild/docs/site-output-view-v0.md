# サイト出力ビュー v0 設計

## 目的

新サイトがそのまま読みやすい公開用商品ビューを定義する。  
商品マスタを正本とし、このタブは派生生成物として扱う。WordPress 固有の taxonomy/post_type/post_status は持ち込まず、サイト表示・検索・絞り込み・SEO・問い合わせ導線に必要な項目だけを持つ。

## 基本方針

| 論点 | 方針 |
|---|---|
| 正本 | `商品マスタ` |
| 生成方式 | GAS または変換スクリプトが `商品マスタ` + `設定マスタ` から再生成する |
| 手入力 | 原則禁止。例外的なSEO補正を許可する場合も、正本は商品マスタ側に持つ |
| 公開制御 | `publish_status`, `is_published`, `sold_out_flag`, `inquiry_enabled` を分けて持つ |
| 分類 | メーカー/店舗/状態/部位/カテゴリは code と label を両方持ち、サイト側で再JOINしなくても表示できるようにする |
| URL | `slug` をビューに持つ。WordPress `post_name` をそのまま正本にしない |
| 画像 | 一覧代表画像と詳細画像配列は、元画像から生成した700x700正方形の表示用画像URLを使う。商品全体の収まりを優先し、過度な自動トリミングではなく余白背景で整える |

## 列一覧

| 列名 | 型 | 必須 | 用途 | 由来/生成元 |
|---|---|---|---|---|
| `internal_id` | string | 必須 | 商品の内部参照キー | 商品マスタ `internal_id` |
| `sd_product_code` | string | 必須 | 問い合わせ・旧運用互換表示 | 商品マスタ `sd_product_code` |
| `slug` | string | 必須 | 商品詳細URL | 商品マスタ `seo_slug` または `sd_product_code` から生成 |
| `title` | string | 必須 | 商品名表示 | 商品マスタ `product_name` |
| `summary_text` | string | 任意 | 一覧カードの短い説明 | `description_text` を短縮生成、または商品マスタ手入力 |
| `description_text` | string | 任意 | 詳細ページ本文 | 商品マスタ `description_text` |
| `description_html` | string | 任意 | 詳細ページHTML本文 | 商品マスタ `description_html` |
| `maker_code` | string | 必須 | フィルタ/検索 | 商品マスタ `maker_code` |
| `maker_label` | string | 必須 | 表示 | 設定マスタ `maker.display_name` |
| `store_code` | string | 必須 | 店舗フィルタ/在庫拠点表示 | 商品マスタ `store_code` |
| `store_label` | string | 必須 | 表示 | 設定マスタ `store.display_name` または `site_label` |
| `condition_code` | string | 必須 | 状態フィルタ | 商品マスタ `condition_code` |
| `condition_label` | string | 必須 | 表示バッジ | 設定マスタ `condition.display_name` |
| `part_code` | string | 必須 | 部位フィルタ | 商品マスタ `part_code` |
| `part_label` | string | 必須 | 表示 | 設定マスタ `part.display_name` |
| `category_code` | string | 必須 | カテゴリフィルタ/ナビ | 商品マスタ `category_code` |
| `category_label` | string | 必須 | 表示 | 設定マスタ `category.display_name` |
| `display_price_ex_tax` | number | 必須 | サイト表示価格 | 商品マスタ `sale_price_ex_tax` |
| `base_price_ex_tax` | number | 任意 | 値引き前価格表示 | 商品マスタ `base_price_ex_tax` |
| `discount_price_ex_tax` | number | 任意 | 値引き価格表示 | 商品マスタ `discount_price_ex_tax` |
| `shipping_fee_ex_tax` | number | 任意 | 送料目安表示 | 商品マスタ `shipping_fee_ex_tax` |
| `price_label` | string | 任意 | 「お問い合わせください」等の価格表示補助 | `display_price_ex_tax` や公開状態から生成 |
| `display_image_urls` | string/JSON | 必須 | 詳細ページ画像一覧。700x700正方形の表示用画像URL配列 | 商品マスタ `source_image_urls` から画像生成処理で派生 |
| `main_display_image_url` | string | 必須 | 一覧代表画像。`display_image_urls` の代表画像URL | 商品マスタ `main_image_index`, `source_image_urls` から派生 |
| `source_image_urls` | string/JSON | 任意 | 元画像URL配列の参照保持。サイト描画では原則 `display_image_urls` を使う | 商品マスタ `source_image_urls` |
| `display_image_size` | string | 任意 | 表示用画像の基本サイズ。v0は原則 `700x700` | 画像生成処理の固定仕様 |
| `image_alt` | string | 任意 | 画像alt補助 | `title + maker_label + category_label` などから生成 |
| `publish_status` | string | 必須 | 公開状態の業務値 | 商品マスタ `publish_status` |
| `is_published` | boolean | 必須 | サイト配信対象判定 | `publish_status` + `condition_code` から生成 |
| `featured_flag` | boolean | 任意 | トップ掲載 | 商品マスタ `featured_flag` |
| `sold_out_flag` | boolean | 必須 | 売却済み表示 | 商品マスタ `sold_out_flag` |
| `inquiry_enabled` | boolean | 必須 | 問い合わせボタン表示可否 | 商品マスタ `inquiry_enabled` |
| `search_text` | string | 必須 | サイト内検索のまとめ文字列 | 商品名/メーカー/カテゴリ/部位/状態/検索キーワードを連結 |
| `sort_updated_at` | datetime | 必須 | 新着順ソート | 商品マスタ `updated_at` |
| `sort_price_ex_tax` | number | 任意 | 価格順ソート | `display_price_ex_tax` |
| `seo_title` | string | 任意 | titleタグ | 商品マスタ `seo_title` または自動生成 |
| `seo_description` | string | 任意 | meta description | 商品マスタ `seo_description` または自動生成 |
| `canonical_path` | string | 任意 | canonical URL path | `/products/{slug}` など新サイト側ルールで生成 |
| `updated_at` | datetime | 必須 | ビュー生成時刻または商品更新時刻 | 商品マスタ `updated_at` |

## 一覧表示に必要な項目

| 用途 | 列 |
|---|---|
| カード表示 | `title`, `main_display_image_url`, `maker_label`, `category_label`, `condition_label`, `display_price_ex_tax`, `price_label`, `sold_out_flag` |
| バッジ表示 | `condition_label`, `sold_out_flag`, `featured_flag` |
| リンク | `slug`, `internal_id`, `sd_product_code` |
| 並び順 | `sort_updated_at`, `sort_price_ex_tax`, `featured_flag` |

## 詳細表示に必要な項目

| 用途 | 列 |
|---|---|
| 基本情報 | `title`, `maker_label`, `store_label`, `condition_label`, `part_label`, `category_label`, `sd_product_code` |
| 本文 | `description_text`, `description_html` |
| 価格 | `display_price_ex_tax`, `base_price_ex_tax`, `discount_price_ex_tax`, `shipping_fee_ex_tax`, `price_label` |
| 画像 | `main_display_image_url`, `display_image_urls`, `source_image_urls`, `display_image_size`, `image_alt` |
| 問い合わせ | `inquiry_enabled`, `sd_product_code`, `title` |
| SEO | `slug`, `seo_title`, `seo_description`, `canonical_path` |

## 画像生成ルール

| 論点 | 方針 |
|---|---|
| 元画像と表示用画像 | `source_image_urls` は元画像参照、`display_image_urls` と `main_display_image_url` はサイト表示用の派生画像として別管理する |
| 枚数 | `display_image_urls` は `source_image_urls` の順序を引き継ぎ、最低1件・最大10件を原則とする |
| 一覧代表画像 | `main_display_image_url` は `main_image_index` で選んだ画像、未指定なら1枚目を使う |
| 詳細画像配列 | 詳細ページでは `display_image_urls` の順序をそのまま表示順とする |
| 画像サイズ | v0の表示用画像は 700x700 正方形を基本とする |
| 整形方式 | 元画像の縦横比は問わず、商品全体ができるだけ収まるようにリサイズし、不足余白を背景で埋める。自動中央クロップ前提にはしない |
| 生成責務 | 正方形化やリサイズは `商品マスタ` ではなく、このビュー生成または `products.json` 生成の派生処理で行う |
| 詳細ルール | 共通画像仕様は `docs/image-spec-v0.md` を参照する |

## フィルタ/検索/ソート設計

| 機能 | 使用列 | 備考 |
|---|---|---|
| メーカー絞り込み | `maker_code`, `maker_label` | 表示ラベルだけでなく code で絞る |
| カテゴリ絞り込み | `category_code`, `category_label` | WordPress taxonomy 名は使わない |
| 部位絞り込み | `part_code`, `part_label` | 現行 `首` 空コード例外はビュー生成前に正規化する |
| 状態絞り込み | `condition_code`, `condition_label`, `sold_out_flag` | 売却済みを在庫あり/なしと分けて扱う |
| 店舗絞り込み | `store_code`, `store_label` | 大阪丸め込みをしない |
| キーワード検索 | `search_text` | 商品名・メーカー名・カテゴリ名・部位名・補助キーワードを連結 |
| 新着順 | `sort_updated_at` | 商品更新時刻ベース |
| 価格順 | `sort_price_ex_tax` | `display_price_ex_tax` を数値として保持 |
| トップ掲載優先 | `featured_flag` | ホーム表示で使用 |

## 公開判定ルール案

| publish_status | condition_code | inquiry_enabled | is_published | sold_out_flag | 表示方針 |
|---|---|---|---|---|---|
| `public` | `used` / `brandnew` / `exhibit` / `unused` / `refurbish` / `prevmodel` | `true` | `true` | `false` | 通常公開。問い合わせ可能 |
| `public` | `sold` | `false` | `true` | `true` | 売却済みとして実績掲載 |
| `sold_visible` | `sold` | `false` | `true` | `true` | 売却済み専用公開 |
| `private` | 任意 | 任意 | `false` | `condition_code == sold` | 一覧/詳細に出さない |
| `draft` | 任意 | 任意 | `false` | `false` | 下書き扱い |

注意: 上表は v0 の設計案。現行運用で「売却済みでもサイト掲載したい/隠したい」の実ルールが確定したら `publish_status` マスタと合わせて更新する。

## `products.json` との関係

| 観点 | 方針 |
|---|---|
| 生成元 | `サイト出力ビュー` をそのまま JSON 化するか、商品マスタから直接 JSON 生成するかはどちらでもよいが、v0 では画像URLも含めて項目整形済みの `サイト出力ビュー` を中間確認面として置く |
| JSONキー | `site-output-view-v0.md` の code/label/slug/SEO/公開判定列が `products.json` の元になる |
| 非公開行 | `is_published=false` を JSON 出力対象から除外するか、管理用途で残すかはAPI設計時に最終決定する |

## このビューに入れないもの

| 入れないもの | 理由 |
|---|---|
| `cost_ex_tax`, `supplier_name`, `sold_to` | 内部管理/個人情報をサイト出力に混ぜないため |
| `legacy_wp_post_id`, `legacy_wp_category_text`, `post_type`, `post_status` | WordPress依存を新サイト中核へ持ち込まないため |
| 見積の割引候補列、送料セルK2/K3のような入力補助 | 見積ドメインの責務のため |
| 競合 `review_status`, `source_html`, `matched_confidence` | 競合価格レビューの責務のため |

## 現行からの主な置き換え

| 現行 | 新ビュー |
|---|---|
| `Wordpress用csv.post_name` | `slug` |
| `Wordpress用csv.post_title` | `title` |
| `Wordpress用csv.product_price` / `product_discounted_price` | `display_price_ex_tax`, `base_price_ex_tax`, `discount_price_ex_tax` |
| `Wordpress用csv.tax_products-category` | `maker_code/label`, `store_code/label`, `condition_code/label`, `part_code/label`, `category_code/label` |
| `Wordpress用csv.post_status` | `publish_status`, `is_published` |
| `Wordpress用csv.product_keyword` + 現行検索語 | `search_text` |
| `画像1〜3` | `source_image_urls`, `display_image_urls`, `main_display_image_url` |
