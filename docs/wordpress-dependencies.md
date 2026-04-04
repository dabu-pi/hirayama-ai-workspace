# WordPress依存一覧（新サイト非WordPress化のための切り離し台帳）

最終更新: 2026-04-04

## 目的

現行の商品マスタ・GAS・サイト反映処理のうち、WordPress の投稿構造、taxonomy、公開状態、PHP受け口、カテゴリslug前提に依存している箇所を洗い出し、新システムで何に置き換えるかを整理する。

## WordPress依存一覧

| 依存箇所 | 現行用途 | 新システムでの置き換え候補 | 優先度 | 備考 |
|---|---|---|---|---|
| `Wordpress用csv` シート | WordPress 商品投入用の中間出力 | `site_products` / `site_product_categories` など、サイト表示用ビューまたは `products.json` 生成結果へ置き換え | A | 新商品マスタ本体に戻し入れず、チャネル出力専用ビューとして分離する |
| `Wordpress用csv.post_id` | WP投稿IDまたは投入用ID | 新システム内部ID `product_id` と、必要なら `legacy_wp_post_id` を別列で保持 | A | 現行GASは `通し番号 + 2000` を `post_id` にしている |
| `Wordpress用csv.product_code` | 商品コードをWP側の商品メタ/投稿識別に渡す | `sd_product_code` として商品データ本体に保持 | A | これは業務上も重要なので残す |
| `Wordpress用csv.post_name` | WP slug 相当 | 新サイト用 `slug` を別規則で生成。初期は `sd_product_code` ベースでもよいがWP前提では持たない | B | 現行GASは `post_name = product_code` |
| `Wordpress用csv.post_title` | WP投稿タイトル | 商品名 `product_name` として保持 | A | CMS投稿タイトルというより商品名として再定義する |
| `Wordpress用csv.product_price` / `product_discounted_price` | WP側の商品価格メタ | `list_price_ex_tax`、`sale_price_ex_tax`、`display_price_tax_mode` など商品価格列に分離 | A | 税抜/税込方針を新サイトで明示する |
| `Wordpress用csv.shopname` | 店舗名をWPメタとして渡す | `location_name` / `location_code` として商品マスタに保持 | A | サイト側表示・絞り込みに使うなら業務属性として残す |
| `Wordpress用csv.product_size` / `product_weight` | WP商品メタ | `size_text`、`weight_text` または数値列に保持 | B | 検索/比較用途があるなら構造化する |
| `Wordpress用csv.tax_products-category` | WP taxonomy 文字列をカンマ連結で渡す | `site_categories`、`body_part_codes`、`maker_id`、`location_code`、`status_code` を独立列または配列で保持 | A | 現行は taxonomy slug を1列文字列に押し込んでいる |
| `Wordpress用csv.yahooshop_link` | 商品コードを別チャネルリンク列として渡す | `channel_links` またはチャネル別URL列へ分離 | C | 現行GASは product_code をそのまま入れており、実用途は要確認 |
| `Wordpress用csv.product_description` | WP本文/商品説明 | `description_html` または `description_text` として保持 | A | HTML許容範囲とサニタイズ方針は別途決める |
| `Wordpress用csv.product_keyword` | WP側キーワード/カテゴリ補助 | 検索用 `search_keywords` 配列、または全文検索インデックス | B | 現行GASでは元列を使わず固定値 `products` を入れており、実質用途が弱い |
| `Wordpress用csv.post_type` | WPカスタム投稿タイプ | 新システムでは不要。サイト側ルーティングやAPIエンドポイントで表現 | A | 現行GASは `products` 固定 |
| `Wordpress用csv.product_status` | WP側商品状態メタ | `condition_status`、`inventory_status`、`sale_status` など業務状態として再定義 | A | `is_sold` 等のWP依存値を内部状態コードへ直結させない |
| `Wordpress用csv.post_status` | WP投稿公開状態 | `is_published`、`published_at`、`visibility_status` などへ置換 | A | 現行は空欄→`publish`、`非公開`→`private` |
| GAS配列 `shops[*][2]` | `shops,honbu` などWP taxonomy slug生成 | `location_master` に `site_category_slug` を別列として持つか、非WPカテゴリ体系へ再設計 | A | `ルール` シートとは別にGASへハードコードされている |
| GAS配列 `makers[*][2]` | `maker,cybex` などWP taxonomy slug生成 | `maker_master` と `site_category_map` へ分離 | A | 表記ゆれ吸収とコード生成が同じ配列に混在している |
| GAS配列 `machines[*][1]` | `trainingmachine,bike` などWP taxonomy slug生成 | `category_master` + `site_category_map` | A | 商品カテゴリとサイトtaxonomy slugを分離する |
| GAS配列 `bodyParts[*][2]` | `trainingparts,leg` などWP taxonomy slug生成 | `body_part_master` + `site_category_map` | A | 商品コード用部位コードとWPカテゴリslugが同配列に混在 |
| GAS配列 `productStatus[*][1]` | `is_used` / `is_sold` などWP向け状態コード | `product_status_master` を業務状態中心に再設計 | A | `リファービッシュ` はステータスコード空文字でtaxonomyだけあるなど不整合あり |
| GAS配列 `productStatus[*][2]` | `status,used` などWP taxonomy slug | `condition_tags` などサイト側表示タグへ置き換え | A | taxonomy前提を切る |
| GAS配列 `postStatus` | `非公開 → private`、空欄→`publish` | `visibility_status` / `is_published` | A | WordPress投稿状態の文字列をそのまま新システムに持ち込まない |
| GAS配列 `topPages` | トップページ掲載を `toppage` taxonomy/フラグへ変換 | `is_featured`、`featured_rank` などへ置換 | B | サイトトップ露出は業務要件として残せるが、WPカテゴリ扱いは不要 |
| GAS `formatCategoryText(text)` | taxonomy文字列の余分なカンマ除去 | 配列/リレーションでカテゴリを保持すれば不要 | B | 1列カンマ文字列へ押し込む副作用処理 |
| GAS `sendHttpPost()` | 商品JSONを `generate.php` へPOSTしてサイト反映 | 新サイト向け同期API、静的JSON生成、またはDB更新ジョブ | A | 反映先PHP内部が未回収のため、切替前に必ず棚卸しが必要 |
| `https://machine-group.net/strongdepot-product-manager/generate.php` | サイト反映の受け口PHP | 新システムの ingest API / 管理バッチ / 静的ビルド処理 | A | WordPress依存の本体がここにある可能性が高い |
| `Settings.php` | コメント上、カテゴリ設定の更新先 | 新システムの単一マスタ管理 | A | GASコメントに `kohakuwebdesign/strongdepot-product-manager` の `Settings.php` 更新が必要とある |
| `https://strongdepot.com/wp-login.php` | WordPress管理画面への運用導線 | 新管理画面URLへ置換 | B | `Wordpress用csv` 先頭行にURLがある |
| `shops,xxx` / `maker,xxx` / `trainingmachine,xxx` / `trainingparts,xxx` / `status,xxx` | taxonomy名前空間付きslug | 非WPカテゴリモデル `location_categories` / `maker_tags` / `product_categories` / `condition_tags` | A | 現行カテゴリ体系の業務意味だけ抽出し、WP namespaceは捨てる |

## 旧WordPress依存として優先的に切るべきもの

| 優先度 | 切り離し対象 | 理由 |
|---|---|---|
| A | `sendHttpPost()` → `generate.php` → WordPress 反映経路 | 新サイト非WordPress化の中心論点で、切替境界そのもの |
| A | `tax_products-category` の taxonomy文字列連結 | 商品分類をWordPress slugに閉じ込めているため |
| A | `post_type` / `post_status` / `product_status` のWP前提値 | 新システムの公開制御・商品状態モデルと混同しやすい |
| A | GAS内 taxonomy ハードコード配列 + `Settings.php` 手更新 | マスタ三重管理を生み、運用ミスを誘発する |
| B | `post_id = 通し番号 + 2000` | WordPress ID都合と業務IDが混ざっている |
| B | `post_name = product_code` | slug生成をWP前提で固定している |
| C | `product_keyword = 'products'` 固定 | 実質的な商品検索仕様として意味が薄い |

## 新システムでの置き換え方針

| 現行WordPress概念 | 新システム候補 | 補足 |
|---|---|---|
| 投稿ID `post_id` | `product_id` + `legacy_wp_post_id` | 内部主キーと旧WP識別子を分ける |
| 投稿slug `post_name` | `slug` | 生成規則を商品コードから独立させる余地を残す |
| 投稿タイプ `post_type=products` | 商品API/ページルーティング | CMS投稿種別ではなく商品リソースとして扱う |
| 投稿公開状態 `post_status` | `visibility_status` / `is_published` | 予約公開が必要なら `published_at` も持つ |
| 商品状態 `product_status` | `condition_status` + `sales_status` | `中古/新品/売却済み` の意味を業務状態として分ける |
| taxonomy カンマ文字列 | `categories[]` / `location_code` / `maker_id` / `tags[]` | 配列またはマスタ参照にする |
| `Settings.php` カテゴリ設定 | `category_master` / `site_category_map` | 単一マスタからサイト出力を生成する |
| `Wordpress用csv` | `site_product_view` または `products.json` | 出力ビューに限定し、商品マスタ本体から分離 |

## 現時点で確認できていないWordPress側実体

| 項目 | 未確認内容 | 次アクション |
|---|---|---|
| `generate.php` | POSTされた商品JSONをどう保存し、WordPress投稿/DBへどう反映するか | PHPファイルを回収して処理フローを読解する |
| `Settings.php` | カテゴリ定義や投稿タイプ設定の実体 | GitHub `kohakuwebdesign/strongdepot-product-manager` またはサーバー上のPHPを回収する |
| WordPress 管理画面運用 | `Wordpress用csv` 手動インポートと GAS POST の使い分け | 現場手順を確認する |
| 既存URL仕様 | 商品詳細URLやslugの現行ルール | strongdepot.com の現行URLパターンと `generate.php` を突き合わせる |

## 今回新たに確定したこと

- WordPress依存は `Wordpress用csv` だけでなく、GAS内カテゴリ配列、`sendHttpPost()`、`generate.php`、`Settings.php` 更新前提まで広がっている。
- 現行の taxonomy slug は `shops,` / `maker,` / `trainingmachine,` / `trainingparts,` / `status,` という名前空間付き文字列で生成されている。

## まだ未確定のこと

- `generate.php` / `Settings.php` のPHP実装
- `Wordpress用csv` を今も手動運用しているか、実際は `sendHttpPost()` が主経路か
- 現行商品詳細URL/slugの確定仕様

## 設計に進めるようになった項目

- `channel_settings` / `site_product_view` / `site_categories` を WordPress 非依存で設計する論点整理
- `products.json` に taxonomy文字列ではなく配列やマスタ参照を持たせる方針

## 次の一手

1. `generate.php` / `Settings.php` のコードを回収して、WordPress投稿更新・taxonomy設定・画像反映の流れを確定する。
2. 現行 taxonomy slug と業務カテゴリの対応表を作る。
3. `products.json` と新統合シートv0では WP列を出力ビューへ隔離する。

## すぐ実装着手できる候補

- `site_category_map` の列定義
- `legacy_wp_*` 列と新商品列の分離ルール作成
- `products.json` の `categories` / `visibility` / `legacy` セクション設計
