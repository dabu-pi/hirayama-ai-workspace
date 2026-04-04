# 商品マスタ v0 列設計

## 目的

新システムにおける商品データの正本タブを定義する。  
現行の `ネットショップ商品一覧` を引き継ぎつつ、WordPress専用列や派生出力を切り離し、見積・サイト出力・競合突合から安定参照できる形へ整理する。

## 列一覧

| 列名 | 型 | 必須 | 入力者 | 由来（現行列/現行仕様） | 注意点 |
|---|---|---|---|---|---|
| `internal_id` | string | 必須 | GAS | 新規追加 | 新システム内部主キー。UUID または `P0000001` 形式を想定。行番号依存にしない |
| `sd_product_code` | string | 必須 | GAS + 人確認 | `新規自動生成商品コード` | 既存互換の業務コード。既存行は原則不変。新規行は商品コード仕様に従って採番 |
| `legacy_product_code` | string | 任意 | GAS | 旧コード退避用の新規列 | 将来コード体系を変える場合の退避先。通常は空欄でよい |
| `serial_no` | number | 必須 | 人 + GAS | `通し番号` | 既存コードの連番部と整合させる。`sd_product_code` 生成元として保持 |
| `product_name` | string | 必須 | 人 | `商品名` | 見積の商品名表示とサイト表示の基礎。価格を文字列埋め込みしない |
| `maker_code` | string | 必須 | 人 + バリデーションGAS | `メーカー名` + GAS `makers` 配列 | 表示名ではなく設定マスタの内部コードを保存する |
| `maker_name` | string | 必須 | GAS | `メーカー名` | 人が選んだ `maker_code` から設定マスタで補完する派生列として扱う |
| `condition_code` | string | 必須 | 人 + GAS | `状態` + GAS `productStatus` | 例: `used`, `brandnew`, `sold`, `refurbish`。表示文言と分離する |
| `condition_label` | string | 任意 | GAS | `状態` | サイト/見積の表示補助。正本判定は `condition_code` を使う |
| `store_code` | string | 必須 | 人 + GAS | `店舗` + GAS `shops` | 例: `OO`, `HY`, `MD`。現行の `大阪` 丸め込み問題を避けるため、名称ではなくコード正本化する |
| `store_name` | string | 任意 | GAS | `店舗` | 表示用ラベル。`store_code` から設定マスタで補完 |
| `purchase_year` | number/string | 必須 | 人 | `仕入れ年` | 西暦4桁 `2024` を推奨。現行コード用の2桁変換はバリデーション/採番時に行う |
| `purchase_year_code` | string | 任意 | GAS | GAS `buyYears` | `sd_product_code` の互換生成用。通常は `purchase_year` から派生 |
| `part_code` | string | 必須 | 人 + GAS | `鍛える部位` + GAS `bodyParts` | 例: `CH`, `BK`, `LG`, `AT`。現行の `首` 空コード例外は設定マスタで明示扱いする |
| `part_label` | string | 任意 | GAS | `鍛える部位` | 表示用。`part_code` から補完 |
| `category_code` | string | 必須 | 人 + GAS | `トレーニングマシンの種類` + GAS `machines` | サイト分類の正規化キー。WordPress taxonomy 名そのものは入れない |
| `category_label` | string | 任意 | GAS | `トレーニングマシンの種類` | 表示用 |
| `base_price_ex_tax` | number | 必須 | 人 | `定価（税抜き）` | 税抜数値で保持。文字列や税込混在を避ける |
| `discount_price_ex_tax` | number | 任意 | 人 | `値引き後の価格（税抜き）` | 空欄なら値引きなし。サイト表示や見積候補価格の元 |
| `sale_price_ex_tax` | number | 必須 | GAS | `定価（税抜き）`, `値引き後の価格（税抜き）` | 公開用の現在売価。原則 `discount_price_ex_tax` 優先、空欄なら `base_price_ex_tax` |
| `cost_ex_tax` | number | 任意 | 人 | `原価` | 内部管理用。サイト出力ビュー/JSON には原則出さない |
| `shipping_fee_ex_tax` | number | 任意 | 人 | `送料` | 見積や問い合わせ参考値。地域別送料ロジックを将来別マスタ化する余地あり |
| `stock_quantity` | number | 任意 | 人 + GAS | `数` | 中古単品が多いため通常 `1` 想定だが、複数在庫や備品で必要 |
| `publish_status` | string | 必須 | 人 + GAS | `公開状態` + GAS `postStatus` | `public`, `private`, `sold`, `draft` 等の新システム独自状態。WordPress `post_status` を直持ちしない |
| `featured_flag` | boolean | 任意 | 人 | `トップページ掲載` | トップ掲載ON/OFF。現行の `topPages` taxonomy 文字列ではなく boolean 化する |
| `inquiry_enabled` | boolean | 必須 | 人 + GAS | 新規追加 | 公開中でも問い合わせ停止したいケースを想定。売却済みなら原則 `false` |
| `sold_out_flag` | boolean | 必須 | GAS | `状態`, `公開状態` | サイトで「売却済み」を明示したい場合の派生判定。状態表示と公開可否を分ける |
| `description_text` | string | 任意 | 人 | `商品説明` | HTMLを含まない本文。`description_html` から自動抽出でもよい |
| `description_html` | string | 任意 | 人 | `商品説明` | 現行HTMLを一旦保持する場合の列。将来リッチテキスト方針を見直す |
| `search_keywords` | string | 任意 | 人 | `検索キーワード` | サイト検索用補助語。JSONでは配列化してもよい |
| `size_text` | string | 任意 | 人 | `サイズ` | 現行文字列をそのまま保持 |
| `weight_text` | string | 任意 | 人 | `重量` | 現行文字列をそのまま保持 |
| `source_image_urls` | string/JSON | 必須 | 人 + GAS | `画像1`, `画像2`, `画像3` | アップロード元の元画像URL配列。縦横比は問わない。v0では1〜10件を改行区切りまたはJSON配列文字列で保持し、順序を維持する |
| `image_count` | number | 必須 | GAS | `source_image_urls` | 元画像の有効件数。公開前チェックでは1〜10の範囲を原則とし、0件や11件以上は要修正として検出する |
| `main_image_index` | number | 任意 | 人 + GAS | 新規追加 | 代表画像の1始まり配列位置。未入力なら1枚目を代表画像として扱う。`source_image_urls` の範囲外なら補正または要確認 |
| `main_source_image_url` | string | 任意 | GAS | `source_image_urls`, `main_image_index` | 代表元画像URL。表示用正方形URLではなく、元画像の代表参照として保持する |
| `seo_slug` | string | 任意 | GAS + 人確認 | `新規自動生成商品コード` 派生 | 新サイトURL用。原則 `sd_product_code` の小文字化 + 必要なら名称スラッグ。WordPress `post_name` をそのまま正本にしない |
| `seo_title` | string | 任意 | 人 + GAS | 新規追加 | 未入力ならサイト出力時に商品名 + メーカー等で自動生成 |
| `seo_description` | string | 任意 | 人 + GAS | 新規追加 | 未入力なら `description_text` から短縮生成 |
| `purchase_date` | date | 任意 | 人 | `仕入年月日` | 日付型に正規化。文字列混在を避ける |
| `supplier_name` | string | 任意 | 人 | `仕入先` | 内部管理用。個人名が入る場合は公開ビューへ出さない |
| `sold_date` | date | 任意 | 人 | `販売年月日` | 売却済み商品の履歴保持用 |
| `sold_price_ex_tax` | number | 任意 | 人 | `売却価格` | 原価/利益分析用。サイト公開売価とは分ける |
| `sold_to` | string | 任意 | 人 | `販売先` | 個人情報が入り得るためサイト出力・JSONへ原則出さない |
| `legacy_wp_post_id` | number/string | 任意 | GAS | `通し番号 + 2000` による `post_id` 互換 | WordPress移行検証用の隔離列。新サイト正本IDにしない |
| `legacy_wp_category_text` | string | 任意 | GAS | `Wordpress用csv.tax_products-category` | 旧分類の追跡用。新サイト分類ロジックには使わない |
| `legacy_base_export_flag` | string/boolean | 任意 | 人 | `BASEで販売しない場合は「いいえ」を入力` | BASE継続要否が未確定のため隔離保持。v0中核ロジックからは外す |
| `source_sheet_name` | string | 任意 | GAS | 現行ブック名/タブ名 | 初回移行の監査用 |
| `source_row_no` | number | 任意 | GAS | 現行行番号 | 初回移行の照合用。永続業務キーにはしない |
| `remarks` | string | 任意 | 人 | 新規追加 | 内部メモ。サイト出力ビューには出さない |
| `created_at` | datetime | 必須 | GAS | 新規追加 | レコード作成日時 |
| `updated_at` | datetime | 必須 | GAS | 新規追加 | 最終更新日時。サイト出力ソートにも利用 |

## 入力/派生の分離ルール

| 区分 | 列 |
|---|---|
| 人が主に入力する列 | `product_name`, `maker_code`, `condition_code`, `store_code`, `purchase_year`, `part_code`, `category_code`, `base_price_ex_tax`, `discount_price_ex_tax`, `cost_ex_tax`, `shipping_fee_ex_tax`, `stock_quantity`, `publish_status`, `featured_flag`, `inquiry_enabled`, `description_text`, `description_html`, `search_keywords`, `size_text`, `weight_text`, `source_image_urls`, `main_image_index`, `purchase_date`, `supplier_name`, `sold_date`, `sold_price_ex_tax`, `sold_to`, `legacy_base_export_flag`, `remarks` |
| GASが主に生成/補完する列 | `internal_id`, `sd_product_code`, `maker_name`, `condition_label`, `store_name`, `purchase_year_code`, `part_label`, `category_label`, `sale_price_ex_tax`, `sold_out_flag`, `image_count`, `main_source_image_url`, `seo_slug`, `seo_title`, `seo_description`, `legacy_wp_post_id`, `source_sheet_name`, `source_row_no`, `created_at`, `updated_at` |

## 画像項目の考え方

| 論点 | 方針 |
|---|---|
| 正本画像 | 商品マスタでは元画像URL配列 `source_image_urls` を正本にする。元画像の縦横比や元サイズをこの段階で無理に正方形化しない |
| 代表画像 | `main_image_index` を優先し、未指定なら1枚目を代表画像とする。`main_source_image_url` はその派生参照であり、表示用700x700画像URLではない |
| 枚数制限 | v0運用では最低1枚、最大10枚。将来配列上限を広げる余地は残すが、初期の登録UI/バリデーションは10枚上限で実装する |
| 表示用画像 | 700x700正方形の表示用画像URL、サムネイルURL、リサイズ方式、余白背景などは商品マスタの正本列に持たず、サイト出力ビュー/JSON生成処理の派生責務とする |
| 中古品運用 | 写真の縦横比や撮影条件が完全でなくても登録できるよう、元画像をそのまま保持し、公開側の派生生成で「収まり優先」の整形を行う |
| 詳細ルール | 共通画像仕様は `docs/image-spec-v0.md` を参照する |

## WordPress 互換列の扱い

| 列 | 方針 |
|---|---|
| `legacy_wp_post_id` | 旧投稿との照合用途に限定。新サイトURLやAPIの正本キーにしない |
| `legacy_wp_category_text` | 旧カテゴリ文字列の監査用途のみ。新分類は `category_code` / `part_code` / `maker_code` を使う |
| `seo_slug` | WordPress `post_name` の置換先だが、新サイト仕様で再定義する。既存 `sd_product_code` から生成してもよい |

## v0 であえて商品マスタに入れないもの

| 入れないもの | 理由 |
|---|---|
| `post_type`, `post_status`, `tax_products-category` | WordPress固有概念のため |
| `BASE用csv` 専用の表示順/種類在庫/画像列 | チャネル出力の派生責務のため |
| 表示用700x700画像URL、サムネイルURL、派生画像の実保存先パス | 元画像正本と派生生成物の責務を分けるため |
| 見積小計/消費税/合計、値引き候補 N:AB 全列 | 見積ドメインの責務のため |
| 競合サイト生HTML、収集URL、レビュー状態 | 競合ドメインの責務のため |
| 顧客メール、請求書ID、Gmail Message-ID | 案件/見積履歴ドメインの責務のため |

## 現行互換で特に注意する点

| 論点 | 注意点 |
|---|---|
| `sd_product_code` | 既存値は上書きしない。再採番が必要な場合も `legacy_product_code` へ退避してから判断する |
| メーカーコード | 現行は `MC` 衝突や長さ例外があるため、表示名からの再推定ではなく設定マスタを正本にする |
| 部位コード | `首` が空コードになっている例外をそのまま放置しない。設定マスタで互換コードと新コードの両方を持つ |
| 公開状態 | `状態=売却済み` と `公開状態=非公開` を混同しない。公開可否と売却状態を別列で保持する |
| 価格 | `定価`, `値引後`, `売却価格`, `原価` を役割別に分け、サイト表示価格 `sale_price_ex_tax` を派生列として明示する |
| 画像 | 現行 `画像1〜3` のURLを壊さず `source_image_urls` 配列へ順序付きで移し、初回移行では1〜3枚をそのまま取り込む。4枚目以降を追加できる構造にしつつ、v0登録上限は10枚とする |
