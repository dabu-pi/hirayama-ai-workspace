# 新統合スプレッドシート v0 設計

## 目的

現行の `ネットショップ商品一覧2018-10-22` を中核にしつつ、WordPress 前提の出力列や見積・競合収集の責務を分離し、次世代システム向けの「商品正本 + 派生ビュー + 設定マスタ + 業務ログ」構造へ整理する。

## v0 タブ構成

| タブ名 | 位置づけ | 更新主体 | 主キー候補 | 備考 |
|---|---|---|---|---|
| 商品マスタ | 商品データの正本 | 人 + GAS | `internal_id` | `sd_product_code` は互換維持の業務コードとして保持するが、内部主キーにはしない |
| 設定マスタ | 店舗/メーカー/部位/状態/カテゴリ等の統一マスタ | 人 + 管理GAS | `master_type + code` | 現行の `ルール` シート、GAS配列、PHP `Settings.php` 分散をここへ寄せる |
| サイト出力ビュー | 新サイト公開用の派生ビュー | GAS/出力処理 | `internal_id` | 商品マスタから生成する。WordPress taxonomy/post_status は持ち込まない |
| 競合価格データ | 競合収集結果とレビュー状態 | GAS + 人 | `competitor_record_id` | 自社商品への紐付け候補を保持し、価格判断に使う |
| 見積入力 | 見積作成の明細入力 | 人 + GAS | `quote_id + line_no` | 今回は概要のみ。現行 `mitsumori` の列依存をそのまま持ち込まない |
| 見積履歴 | 確定見積/案件の履歴管理 | GAS + 人 | `quote_id` | 今回は概要のみ。案件別コピー乱立の代替候補 |
| アーカイブ | 旧ブック/旧タブの退避台帳 | 人 | `archive_id` | すぐ削除しない前提で、置換先と保留理由を記録する |

---

## 1. 商品マスタ

| 項目 | 内容 |
|---|---|
| タブの目的 | 中古マシン商品データの業務正本。サイト表示、見積参照、競合突合の元データを持つ |
| 主キー候補 | `internal_id` |
| 必須列 | `internal_id`, `sd_product_code`, `product_name`, `maker_code`, `condition_code`, `store_code`, `purchase_year`, `part_code`, `category_code`, `base_price_ex_tax`, `sale_price_ex_tax`, `publish_status`, `inquiry_enabled`, `created_at`, `updated_at` |
| 任意列 | `legacy_product_code`, `discount_price_ex_tax`, `shipping_fee_ex_tax`, `description_text`, `description_html`, `image_urls`, `featured_flag`, `seo_slug`, `seo_title`, `seo_description`, `remarks`, `legacy_wp_post_id`, `legacy_wp_category_text`, `source_sheet_name`, `source_row_no` |
| 現行から引き継ぐ列 | `新規自動生成商品コード`, `商品名`, `メーカー名`, `状態`, `店舗`, `仕入れ年`, `鍛える部位`, `トレーニングマシンの種類`, `定価（税抜き）`, `値引き後の価格（税抜き）`, `送料`, `公開状態`, `トップページ掲載`, `商品説明`, `画像1〜3`, `通し番号` |
| 新しく追加する列 | `internal_id`, `legacy_product_code`, `inquiry_enabled`, `seo_slug`, `seo_title`, `seo_description`, `created_at`, `updated_at`, `legacy_wp_post_id`, `legacy_wp_category_text` |
| このタブに入れないもの | WordPress taxonomy/post_type/post_status を正本列として持たない。BASE専用CSV列、見積小計/消費税/合計、競合生HTML、顧客個人情報を入れない |
| 更新主体 | 人が商品属性を入力し、GASがコード検証・派生値補完・出力ビュー生成を担当する |
| 備考 | 詳細列定義は `docs/product-master-v0.md` に分離する |

---

## 2. 設定マスタ

| 項目 | 内容 |
|---|---|
| タブの目的 | 店舗・メーカー・部位・状態・カテゴリ・公開状態などのコード体系を一元管理する |
| 主キー候補 | `master_type + code` |
| 必須列 | `master_type`, `code`, `display_name`, `legacy_value`, `is_active`, `sort_order` |
| 任意列 | `canonical_key`, `aliases`, `validation_rule`, `site_label`, `remarks` |
| 現行から引き継ぐ列 | `ルール` シートのコード表、商品一覧GASの `shops/makers/bodyParts/productStatus/postStatus` 配列、PHP `Settings.php` の分類定義（未回収分は後で突合） |
| 新しく追加する列 | `master_type`, `canonical_key`, `is_active`, `sort_order`, `validation_rule`, `site_label` |
| このタブに入れないもの | 商品個別の価格、在庫、画像、見積明細、競合収集ログを持たない |
| 更新主体 | 人がマスタを保守し、GASが参照・整合性チェックに使う |
| 備考 | v0 は1タブ集約でもよいが、運用が重くなったら `店舗マスタ` 等へ分割する |

---

## 3. サイト出力ビュー

| 項目 | 内容 |
|---|---|
| タブの目的 | 新サイトが読むための公開向け派生データを、商品マスタから正規化して並べる |
| 主キー候補 | `internal_id` |
| 必須列 | `internal_id`, `sd_product_code`, `slug`, `title`, `display_price_ex_tax`, `publish_status`, `is_published`, `main_image_url`, `maker_code`, `maker_label`, `store_code`, `store_label`, `condition_code`, `condition_label`, `part_code`, `part_label`, `category_code`, `category_label`, `search_text`, `sort_updated_at` |
| 任意列 | `description_text`, `description_html`, `image_urls`, `featured_flag`, `seo_title`, `seo_description`, `inquiry_enabled`, `sold_out_flag`, `shipping_fee_ex_tax` |
| 現行から引き継ぐ列 | 商品マスタ由来の公開系列。特に `商品名`, `商品説明`, `画像`, `状態`, `公開状態`, `トップページ掲載`, `新規自動生成商品コード` |
| 新しく追加する列 | `slug`, `maker_label`, `store_label`, `condition_label`, `part_label`, `category_label`, `search_text`, `sort_updated_at`, `is_published`, `sold_out_flag` |
| このタブに入れないもの | `原価`, `仕入先`, `販売先`, `freee_*`, `legacy_wp_*`, WordPress taxonomy/post_type/post_status, 競合レビュー状態 |
| 更新主体 | 原則 GAS/変換処理が商品マスタから再生成する。手入力しない |
| 備考 | 詳細列定義は `docs/site-output-view-v0.md` に分離する |

---

## 4. 競合価格データ

| 項目 | 内容 |
|---|---|
| タブの目的 | 競合サイトから収集した商品情報と価格を、レビュー・自社商品候補紐付けつきで保管する |
| 主キー候補 | `competitor_record_id` |
| 必須列 | `competitor_record_id`, `source_site`, `fetched_at`, `source_url`, `product_name`, `maker_name`, `current_price_ex_tax`, `collect_status`, `review_status` |
| 任意列 | `maintenance_price_ex_tax`, `category_name`, `image_urls`, `linked_internal_id`, `match_confidence`, `memo` |
| 現行から引き継ぐ列 | `STRONGDEPOT 競合サイトデータ` の `収集日時`, `URL`, `商品名`, `メーカー`, `整備価格`, `現状価格`, `商品説明`, `画像1〜3`, `カテゴリ` |
| 新しく追加する列 | `competitor_record_id`, `collect_status`, `review_status`, `linked_internal_id`, `match_confidence`, `normalized_category_code` |
| このタブに入れないもの | 自社原価、見積明細、WordPress投稿情報、顧客情報 |
| 更新主体 | GAS が収集し、人がレビュー・紐付け判定を補完する |
| 備考 | 詳細列定義は `docs/competitor-data-v0.md` に分離する |

---

## 5. 見積入力（概要）

| 項目 | 内容 |
|---|---|
| タブの目的 | 商品コードやその他商品コードを入力し、見積明細を作る業務入力面 |
| 主キー候補 | `quote_id + line_no` |
| 必須列 | `quote_id`, `line_no`, `item_source_type`, `item_code`, `item_name`, `quantity`, `unit_price_ex_tax`, `discount_amount_ex_tax`, `line_amount_ex_tax` |
| 任意列 | `internal_id`, `sd_product_code`, `maker_name`, `cost_ex_tax`, `shipping_fee_ex_tax`, `installation_fee_ex_tax`, `tax_rate`, `line_note`, `validation_status`, `validation_message` |
| 現行から引き継ぐ列 | `mitsumori` の A/B/C/D/E/F/G/H/J/K/L/M 列相当、値引き候補列 N:AB |
| 新しく追加する列 | `quote_id`, `line_no`, `item_source_type`, `internal_id`, `validation_status`, `validation_message` |
| このタブに入れないもの | 画面整形用の帳票レイアウト、商品名文字列に価格を埋め込む運用、案件別タブ乱立を前提にした列 |
| 更新主体 | 人が行入力し、GASが商品補完・計算・検証を行う |
| 備考 | 今回は概要のみ。正本フロー確定後に別ドキュメントで詳細化する |

---

## 6. 見積履歴（概要）

| 項目 | 内容 |
|---|---|
| タブの目的 | 作成済み見積のヘッダ情報、合計、外部連携結果、元シート参照を集約する |
| 主キー候補 | `quote_id` |
| 必須列 | `quote_id`, `customer_name`, `quote_status`, `subtotal_ex_tax`, `tax_amount`, `total_in_tax`, `quoted_at` |
| 任意列 | `deal_id`, `source_spreadsheet_id`, `source_sheet_name`, `quote_sheet_url`, `freee_partner_id`, `freee_quotation_id`, `gmail_message_id`, `owner_name`, `memo` |
| 現行から引き継ぐ列 | `2024長谷川さん` の案件ヘッダ列、`見積`, `受注`, `請求書`, `入金確認`, `freee quotation_id`, `Gmail Message-ID` |
| 新しく追加する列 | `quote_id`, `source_spreadsheet_id`, `source_sheet_name`, `sync_status` |
| このタブに入れないもの | 明細全量を横持ちしない。WordPress出力項目、競合収集項目を混在させない |
| 更新主体 | GAS + 人 |
| 備考 | 現行正本が `2.3` / `2.3freee連携API` のどちらか最終確定後に粒度を詰める |

---

## 7. アーカイブ

| 項目 | 内容 |
|---|---|
| タブの目的 | 旧コピー、試作ブック、役割不明タブを即削除せず、安全に棚卸し・退避管理する |
| 主キー候補 | `archive_id` |
| 必須列 | `archive_id`, `spreadsheet_name`, `sheet_name`, `current_judgement`, `archive_reason`, `replacement_doc_or_sheet`, `checked_at` |
| 任意列 | `spreadsheet_id`, `sheet_gid`, `owner`, `last_seen_updated_at`, `risk_note`, `memo` |
| 現行から引き継ぐ列 | `docs/sheet-inventory.md` の `要確認` / `アーカイブ` 判定結果 |
| 新しく追加する列 | `archive_id`, `replacement_doc_or_sheet`, `checked_at`, `risk_note` |
| このタブに入れないもの | 現役業務データの正本行。アーカイブ台帳と実データを混ぜない |
| 更新主体 | 人 |
| 備考 | 「削除候補」でも即削除せず、根拠と依存関係の確認が終わるまで保持する |

---

## v0 設計方針

| 論点 | 方針 |
|---|---|
| 商品ID | 新規に `internal_id` を採番し、`sd_product_code` と分離する |
| 既存商品コード互換 | `sd_product_code` を維持し、新規採番・検証仕様は `docs/product-code-validation-spec.md` に分離する |
| 分類マスタ | 現行の三重管理をやめ、設定マスタを正本に寄せる |
| サイト公開 | 商品マスタを直接サイトに読ませず、サイト出力ビューまたは `products.json` を派生生成する |
| WordPress依存 | `legacy_wp_*` に隔離し、新サイトの中核設計へ taxonomy/post_type/post_status を混ぜない |
| 見積統合 | 今回は概要に留めるが、商品マスタ参照とその他商品参照を明示的に分離した入力モデルへ寄せる |
| 競合価格 | 新サイト本体と別責務として残し、価格判断用レビュー状態と自社商品紐付け候補を持つ |
