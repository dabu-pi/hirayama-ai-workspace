# 現行商品マスタ → 新構造 v0 マッピング

## 目的

現行 `ネットショップ商品一覧` の列を、新しい `商品マスタ` / `サイト出力ビュー` / `products.json` へどう移すかを一覧化する。  
「そのまま移行」「加工して移行」「廃止」「隔離保持」を明確にし、初回変換スクリプト実装の入力にする。

## マッピング表

| 現行列名 | 現行用途 | 新商品マスタ列 | 新サイト出力列 | `products.json` キー | 変換ルール | 判定 | 備考 |
|---|---|---|---|---|---|---|---|
| `通し番号` | 行/商品通番、WordPress `post_id` の元 | `serial_no`, `legacy_wp_post_id` | なし | なし | `serial_no` は数値のまま保持。`legacy_wp_post_id = 通し番号 + 2000` は必要なら隔離列に保存 | 加工 | JSONの `id` には使わず `internal_id` を新規採番する |
| `メーカー名` | 商品メーカー表示、コード生成元、カテゴリ生成元 | `maker_code`, `maker_name` | `maker_code`, `maker_label` | `maker.code`, `maker.label` | 設定マスタで表示名→内部コードへ正規化し、表示名は label として保持 | 加工 | 現行 `MC` 衝突や表記ゆれは `要確認` で止める |
| `商品名` | 商品名、サイトタイトル、見積表示名 | `product_name` | `title`, `search_text`, `image_alt` | `name`, `searchText`, `images[].alt`, `seo.title` | 文字列をそのまま移行。SEO title 未入力時は自動補完 | そのまま移行 | 見積のように価格を商品名へ埋め込まない |
| `定価（税抜き）` | 元売価 | `base_price_ex_tax`, `sale_price_ex_tax` | `base_price_ex_tax`, `display_price_ex_tax`, `sort_price_ex_tax` | `price.basePrice`, `price.salePrice` | 数値化。値引後価格が空なら `sale_price_ex_tax = base_price_ex_tax` | 加工 | 税抜を正本に統一 |
| `商品説明` | サイト本文HTML/説明文 | `description_html`, `description_text` | `description_html`, `description_text`, `summary_text` | `description.html`, `description.text`, `description.summary`, `seo.description` | HTMLを保持しつつ、テキスト抽出列を追加。summary は短縮生成 | 加工 | 危険HTMLの扱いはフロント実装前に別途検討 |
| `状態` | 新品/中古/売却済み等、カテゴリ生成元 | `condition_code`, `condition_label`, `sold_out_flag`, `publish_status` 補助 | `condition_code`, `condition_label`, `sold_out_flag`, `is_published` | `condition.code`, `condition.label`, `condition.isSoldOut`, `visibility.status`, `visibility.isPublished` | 設定マスタで状態コード化。`売却済み` は `sold_out_flag=true`。公開可否とは分離 | 加工 | `リファービッシュ品` など現行空コード例外は設定マスタで吸収 |
| `店舗` | 在庫拠点、コード生成元、カテゴリ生成元 | `store_code`, `store_name` | `store_code`, `store_label` | `store.code`, `store.label` | 店舗名を設定マスタへ突合し、内部コード化 | 加工 | 現行 `大阪` 丸め込みはやめる |
| `仕入れ年` | 商品コード年コード生成元 | `purchase_year`, `purchase_year_code` | なし | なし | 西暦/旧2桁コードを分離。現行2桁や `MD` は `purchase_year_code` に保持 | 加工 | サイト表示不要ならビュー/JSONへ出さない |
| `鍛える部位` | 部位分類、コード生成元、カテゴリ生成元 | `part_code`, `part_label` | `part_code`, `part_label` | `part.code`, `part.label` | 設定マスタで内部コード化 | 加工 | 現行 `首` 空コード例外を明示補正 |
| `トレーニングマシンの種類` | 商品カテゴリ、WordPress taxonomy生成元 | `category_code`, `category_label` | `category_code`, `category_label` | `category.code`, `category.label` | WordPress taxonomy 名ではなく独自カテゴリコードへ変換 | 加工 | PHP `Settings.php` 未回収分は後でカテゴリ一覧を追補 |
| `サイズ` | 商品サイズ表示 | `size_text` | `description_text` 補助または詳細表示項目 | 必要なら将来 `spec.sizeText` | 現行文字列を保持。JSONへ出すかはフロント要件で判断 | そのまま移行 | v0 JSON正式ドラフトでは必須外 |
| `重量` | 商品重量表示 | `weight_text` | `description_text` 補助または詳細表示項目 | 必要なら将来 `spec.weightText` | 現行文字列を保持 | そのまま移行 | v0 JSON正式ドラフトでは必須外 |
| `検索キーワード` | WP CSV `product_keyword` 補助/サイト検索語 | `search_keywords` | `search_text` | `searchText` | 商品名/分類/メーカーと結合し検索文字列化 | 加工 | 現行 `Wordpress用csv.product_keyword='products'` は廃止 |
| `公開状態` | WordPress `post_status` 生成元 | `publish_status` | `publish_status`, `is_published` | `visibility.status`, `visibility.isPublished` | 空欄=`public`、`非公開`=`private` など設定マスタで変換 | 加工 | WordPress `publish/private` を正本値にしない |
| `新規自動生成商品コード` | SD商品コード、slug、見積参照キー | `sd_product_code`, `seo_slug` | `sd_product_code`, `slug`, `search_text` | `sdProductCode`, `slug`, `seo.canonicalPath`, `searchText` | 既存値は原則維持。`seo_slug` は小文字化などURL安全化して生成 | 加工 | 再採番禁止。生成/検証仕様は別ドキュメント参照 |
| `画像1` | 代表画像 | `source_image_urls`, `image_count`, `main_image_index`, `main_source_image_url` | `source_image_urls`, `display_image_urls`, `main_display_image_url`, `image_alt` | `images[0].sourceUrl`, `images[0].displayUrl`, `images[0].width`, `images[0].height`, `images[0].isMain=true`, `images[0].alt` | 初回移行では `http://` / `https://` で始まる値だけを `source_image_urls[0]` に入れ、`main_image_index=1` として代表画像扱いにする。非URL文字列は `image_url_suspicious` warning に分離する。表示用700x700正方形画像は派生生成して `displayUrl` に入れる | 加工 | 実データ監査では `画像1〜3` からURLが取れず `images=[]` が全件になった。元画像URLの回収元は別途要確認 |
| `画像2` | 追加画像 | `source_image_urls`, `image_count` | `source_image_urls`, `display_image_urls` | `images[1].sourceUrl`, `images[1].displayUrl` | URL値だけを2枚目として配列化し、非URL文字列は警告ログへ分離する | 加工 | 4枚目以降は将来追加可能 |
| `画像3` | 追加画像 | `source_image_urls`, `image_count` | `source_image_urls`, `display_image_urls` | `images[2].sourceUrl`, `images[2].displayUrl` | URL値だけを3枚目として配列化し、非URL文字列は警告ログへ分離する | 加工 | v0運用の登録上限は10枚 |
| `BASEで販売しない場合は「いいえ」を入力` | BASE出力対象制御 | `legacy_base_export_flag` | なし | なし | 現行値を隔離列へ保持。新サイト中核ロジックからは除外 | 隔離保持 | BASE継続要否が未確定のため、今は廃止確定にしない |
| `トップページ掲載` | トップカテゴリ付与/表示優先 | `featured_flag` | `featured_flag` | `visibility.isFeatured` | 入力値を boolean 化 | 加工 | 現行 `topPages` taxonomy 文字列ではなくフラグ化 |
| `値引き後の価格（税抜き）` | 値引後売価 | `discount_price_ex_tax`, `sale_price_ex_tax` | `discount_price_ex_tax`, `display_price_ex_tax` | `price.discountPrice`, `price.salePrice` | 数値化。空欄なら null。`sale_price_ex_tax` は値引後優先で計算 | 加工 | 見積値引き候補列とは別物 |
| `仕入年月日` | 仕入日 | `purchase_date` | なし | なし | 日付型に正規化 | そのまま移行 | 内部管理列。サイト公開しない |
| `仕入先` | 仕入先メモ | `supplier_name` | なし | なし | 文字列保持 | そのまま移行 | 個人/取引先情報をサイト出力しない |
| `原価` | 原価 | `cost_ex_tax` | なし | なし | 数値化 | そのまま移行 | 見積/利益分析用。サイトJSONへ出さない |
| `送料` | 送料目安、見積補助 | `shipping_fee_ex_tax` | `shipping_fee_ex_tax` | `price.shippingFee` | 数値化。空欄は null | 加工 | 地域別送料ロジックは将来別設計 |
| `売値計算式` | 原価×倍率の計算メモ | `remarks` または廃止 | なし | なし | 実計算をコード化できるなら列は参考情報として `remarks` へ退避 | 要確認 | 現行式の業務利用度が不明 |
| `数` | 在庫数/数量 | `stock_quantity` | 必要なら将来 `stock_quantity` | 必要なら将来追加 | 数値化。空欄は 1 扱いか null か要設計 | 加工 | 中古単品中心なら初期値1を検討 |
| `原価×数` | 原価合計の派生値 | なし | なし | なし | 再計算可能なので正本列としては持たない | 廃止 | 必要なら分析ビューで再生成 |
| `販売年月日` | 売却日 | `sold_date` | `sold_out_flag` 判定補助 | なし | 日付型に正規化 | そのまま移行 | サイトでは原則非表示 |
| `売却価格` | 実売価格 | `sold_price_ex_tax` | なし | なし | 数値化 | そのまま移行 | 公開価格と混ぜない |
| `販売先` | 販売先 | `sold_to` | なし | なし | 文字列保持 | そのまま移行 | 個人情報を含み得るため公開ビューに出さない |

---

## WordPress用CSV列の扱い

| 現行列/概念 | 新商品マスタ列 | 新サイト出力列 | `products.json` キー | 判定 | 備考 |
|---|---|---|---|---|---|
| `Wordpress用csv.post_id` | `legacy_wp_post_id` | なし | なし | 隔離保持 | 旧投稿照合用に限定 |
| `Wordpress用csv.product_code` | `sd_product_code` | `sd_product_code` | `sdProductCode` | 加工 | 商品正本コードとして継続 |
| `Wordpress用csv.post_name` | `seo_slug` | `slug` | `slug`, `seo.canonicalPath` | 加工 | 新サイトURL仕様で再定義 |
| `Wordpress用csv.post_title` | `product_name` | `title` | `name` | そのまま移行 |  |
| `Wordpress用csv.product_price` | `base_price_ex_tax` | `base_price_ex_tax` | `price.basePrice` | 加工 | 税抜数値として保持 |
| `Wordpress用csv.product_discounted_price` | `discount_price_ex_tax` | `discount_price_ex_tax`, `display_price_ex_tax` | `price.discountPrice`, `price.salePrice` | 加工 |  |
| `Wordpress用csv.shopname` | `store_name`, `store_code` | `store_label`, `store_code` | `store.label`, `store.code` | 加工 | 大阪丸め込みをやめる |
| `Wordpress用csv.product_size` | `size_text` | 必要なら詳細表示項目 | 将来 `spec.sizeText` | そのまま移行 |  |
| `Wordpress用csv.product_weight` | `weight_text` | 必要なら詳細表示項目 | 将来 `spec.weightText` | そのまま移行 |  |
| `Wordpress用csv.tax_products-category` | `legacy_wp_category_text` + 正規化済み `maker_code/store_code/category_code/part_code/condition_code` | code/label 各列 | `maker`, `store`, `category`, `part`, `condition` | 加工 | WP taxonomy 文字列は隔離保持し、新サイト正規分類へ変換 |
| `Wordpress用csv.yahooshop_link` | なし | なし | なし | 廃止候補 | 現行GASでは `product_code` を入れているだけ。実用途要確認 |
| `Wordpress用csv.product_description` | `description_html`, `description_text` | `description_html`, `description_text` | `description.html`, `description.text` | 加工 |  |
| `Wordpress用csv.product_keyword` | `search_keywords` | `search_text` | `searchText` | 廃止/加工 | 現行固定値 `products` は廃止。自然な検索語へ再構成 |
| `Wordpress用csv.post_type` | なし | なし | なし | 廃止 | WordPress固有 |
| `Wordpress用csv.product_status` | `condition_code`, `legacy_wp_category_text` | `condition_code`, `sold_out_flag` | `condition.code`, `condition.isSoldOut` | 加工 | WPカテゴリ文字列は隔離 |
| `Wordpress用csv.post_status` | `publish_status` | `publish_status`, `is_published` | `visibility.status`, `visibility.isPublished` | 加工 | 新公開状態へマップ |

## BASE用CSV列の扱い

| 現行列/概念 | 新商品マスタ列 | 新サイト出力列 | `products.json` キー | 判定 | 備考 |
|---|---|---|---|---|---|
| `BASE用csv.商品名` | `product_name` | `title` | `name` | そのまま移行 |  |
| `BASE用csv.説明` | `description_text/html` | `description_text/html` | `description.*` | 加工 | BASE継続するなら別チャネル出力ビューへ分離 |
| `BASE用csv.価格` | `sale_price_ex_tax` | `display_price_ex_tax` | `price.salePrice` | 加工 | 現行GASは税込化しているため税モードを明示して再設計 |
| `BASE用csv.在庫数` | `stock_quantity` | 将来必要なら追加 | 将来必要なら追加 | 加工 |  |
| `BASE用csv.公開状態` | `legacy_base_export_flag`, `publish_status` | `is_published` | `visibility.isPublished` | 要確認 | BASE販売停止フラグとサイト公開状態は別管理 |
| `BASE用csv.表示順` | なし | `featured_flag`, `sort_updated_at` | なし | 廃止候補 | 新サイト並び順は別仕様で再定義 |
| `BASE用csv.種類名` | `category_code/category_label` | `category_code/category_label` | `category.*` | 加工 |  |
| `BASE用csv.種類在庫数` | なし | なし | なし | 廃止候補 | 現行運用要否未確認 |
| `BASE用csv.カテゴリ` | `category_code/category_label` | `category_code/category_label` | `category.*` | 加工 |  |
| `BASE用csv.画像1〜5` | `source_image_urls`, `image_count`, `main_image_index` | `display_image_urls`, `main_display_image_url`, `source_image_urls` | `images[].sourceUrl`, `images[].displayUrl`, `images[].isMain`, `images[].sortOrder` | 加工 | 現行商品マスタは画像1〜3中心だが、新構造は最大10枚まで保持できる。初回移行は画像1〜3を正本とし、4〜5枚目以降は必要になった時点で追加する |

---

## 初回変換スクリプトでの処理順案

| 順番 | 処理 |
|---|---|
| 1 | 現行行を読み込み、`通し番号` と `新規自動生成商品コード` を保持したまま `internal_id` を新規採番 |
| 2 | `メーカー名`, `店舗`, `鍛える部位`, `トレーニングマシンの種類`, `状態`, `公開状態` を設定マスタへ突合。現行ルール上の部位空欄は `AT=その他` に寄せる |
| 3 | 未登録マスタ、`MC` 衝突、`首` 空コード、商品コード構造不一致などを `要確認` として検出 |
| 4 | 価格/送料/在庫/日付/元画像URLを型変換し、`source_image_urls`, `image_count`, `main_image_index`, `main_source_image_url` を含めて商品マスタ列へ格納 |
| 5 | `sale_price_ex_tax`, `sold_out_flag`, `seo_slug`, 表示ラベル列、`display_image_urls`, `main_display_image_url` を派生生成 |
| 6 | サイト出力ビュー行を生成 |
| 7 | `products.json` を生成し、サンプル数件で目視確認 |

## 現時点の保留

| 論点 | 状態 |
|---|---|
| `売値計算式` の継続要否 | 現行運用で参照されているか未確認のため `要確認` |
| BASE出力の継続要否 | 未確定。中核設計からは分離するが、隔離列として現行フラグは残す |
| 画像4枚目以降の移行範囲 | 初回移行では現行商品マスタ主系統の `画像1〜3` をそのまま移す。4枚目以降は新構造で最大10枚まで追加可能だが、どの既存チャネル列を取り込むかは実装時に確認する |
| `Settings.php` のカテゴリ一覧 | 未回収。現行GAS/ルールシートとの差分があれば、設定マスタ値の最終調整が必要 |
| 元画像URLの取得元 | 実データ監査では `画像1〜3` からURLを取れなかったため、WordPress側または別画像台帳の所在確認が必要 |
