# 競合価格データ v0 設計

## 目的

競合サイトから収集した商品情報・価格・画像・レビュー状態を、価格判断業務で使える形に整理する。  
新サイト本体の公開データとは別責務として扱い、自社商品マスタへの紐付け候補を持たせる。

## 対象範囲

| 対象 | 方針 |
|---|---|
| recyfit 収集データ | 現行 `STRONGDEPOT 競合サイトデータ` の主系統として v0 に取り込む |
| 競合分類まとめ | `競合サイトデータまとめ` / `他社競合データ` の用途が残るなら、後続で統合ビュー化する |
| 画像保存 | 現行Drive保存方式を尊重しつつ、v0 では画像URL配列として保持する |
| 自社商品紐付け | `linked_internal_id` と `match_confidence` で候補管理し、人がレビュー確定できるようにする |

## 列一覧

| 列名 | 型 | 必須 | 更新主体 | 内容/由来 |
|---|---|---|---|---|
| `competitor_record_id` | string | 必須 | GAS | 新規主キー。例: `CMP0000001` |
| `source_site` | string | 必須 | GAS | 競合サイト名。例: `recyfit` |
| `fetched_at` | datetime | 必須 | GAS | 収集日時。現行 `収集日時` |
| `source_url` | string | 必須 | GAS | 商品詳細URL。現行 `URL` |
| `product_name` | string | 必須 | GAS | 競合商品名。現行 `商品名` |
| `maker_name` | string | 任意 | GAS + 人補正 | 競合メーカー名。現行 `メーカー` |
| `maker_code_matched` | string | 任意 | GAS + 人 | 設定マスタ突合後の自社メーカーコード候補 |
| `maintenance_price_ex_tax` | number | 任意 | GAS | 整備価格。現行 `整備価格` |
| `current_price_ex_tax` | number | 任意 | GAS | 現状価格。現行 `現状価格` |
| `normalized_price_ex_tax` | number | 任意 | GAS | 比較用の代表価格。整備価格優先/現状価格優先などルールを明示して生成 |
| `category_name` | string | 任意 | GAS | 競合サイト上のカテゴリ名。現行 `カテゴリ` |
| `normalized_category_code` | string | 任意 | GAS + 人 | 自社カテゴリマスタへの変換候補 |
| `description_text` | string | 任意 | GAS | 競合商品説明。現行 `商品説明` |
| `image_urls` | string/JSON | 任意 | GAS | 画像1〜3のURL配列。現行 `画像1`, `画像2`, `画像3` |
| `collect_status` | string | 必須 | GAS | `new`, `duplicate`, `failed`, `skipped` |
| `review_status` | string | 必須 | 人 + GAS | `unreviewed`, `matched`, `ignored`, `needs_check` |
| `linked_internal_id` | string | 任意 | 人 + GAS候補 | 自社商品マスタ `internal_id` |
| `linked_sd_product_code` | string | 任意 | GAS | `linked_internal_id` に紐づく `sd_product_code` の表示補助 |
| `match_confidence` | number | 任意 | GAS | 自動マッチ信頼度 0.0〜1.0 |
| `price_gap_ex_tax` | number | 任意 | GAS | 自社表示価格との差額。自社商品確定後に算出 |
| `price_gap_ratio` | number | 任意 | GAS | 自社表示価格との差率 |
| `review_memo` | string | 任意 | 人 | 価格判断メモ、除外理由 |
| `raw_snapshot_ref` | string | 任意 | GAS | 生HTML/レスポンスを別保存する場合の参照先 |
| `created_at` | datetime | 必須 | GAS | 行作成日時 |
| `updated_at` | datetime | 必須 | GAS | 最終更新日時 |

## ステータス定義

### `collect_status`

| 値 | 意味 |
|---|---|
| `new` | 新規に収集できた |
| `duplicate` | URL重複などで既存行と判定した |
| `failed` | 取得失敗、HTML解析失敗、画像保存失敗など |
| `skipped` | 上限件数や除外条件でスキップした |

### `review_status`

| 値 | 意味 |
|---|---|
| `unreviewed` | 未レビュー |
| `matched` | 自社商品との紐付けを採用 |
| `ignored` | 比較対象外 |
| `needs_check` | 値や紐付け候補に疑義があり要確認 |

## 自社商品との紐付け方針

| 論点 | 方針 |
|---|---|
| 自動候補 | `product_name`, `maker_name`, `category_name`, 価格帯から候補抽出する |
| 確定キー | 最終的には `linked_internal_id` を人が確定する |
| 旧コード表示 | レビュー時に見やすいよう `linked_sd_product_code` を併記する |
| 信頼度 | 完全一致/部分一致/メーカー一致/価格近似などで `match_confidence` を算出するが、v0 では簡易スコアでもよい |
| 複数候補 | 1行1候補で足りない場合は、将来 `competitor_match_candidates` タブへ分離する |

## 現行 `STRONGDEPOT 競合サイトデータ` からの引き継ぎ

| 現行列 | v0列 | 変換ルール |
|---|---|---|
| `id` | `competitor_record_id` | 既存idを保持するか、新ID採番して旧idを `review_memo` に残すか要検討。v0 は新ID採番を推奨 |
| `収集日時` | `fetched_at` | 日時型へ正規化 |
| `URL` | `source_url` | そのまま |
| `商品名` | `product_name` | そのまま |
| `メーカー` | `maker_name`, `maker_code_matched` | 文字列保持 + 設定マスタ突合 |
| `整備価格` | `maintenance_price_ex_tax` | 数値化 |
| `現状価格` | `current_price_ex_tax` | 数値化 |
| `商品説明` | `description_text` | HTMLタグを落とすか保持するかは実装時に決める。v0 はテキスト列で保持 |
| `画像1〜3` | `image_urls` | 空欄除外して配列化 |
| `カテゴリ` | `category_name`, `normalized_category_code` | 元文字列保持 + 自社カテゴリ候補へ変換 |

## 画像保存方式

| 観点 | 方針 |
|---|---|
| 現行方式 | GAS `downloadImages()` が Drive フォルダ `1Q0vGVu2N8Ouq8us0JIMSaH1oCdHVLiZl` へ `productId_1..3` で保存 |
| v0データ | シートには `image_urls` としてURL配列を保持し、物理保存先の詳細を商品ビューへ混ぜない |
| 将来移行 | 新サイト表示画像と競合保存画像は別ストレージ/別命名へ分ける余地がある |
| リスク | 現行GASは外部 `rawgit.com` の `URI.js` を `eval` 読み込みしており、供給元停止/改変に弱い。新実装では依存を固定化する |

## このタブに入れないもの

| 入れないもの | 理由 |
|---|---|
| 自社 `cost_ex_tax`, `supplier_name`, `sold_to` | 競合収集結果と自社内部管理情報を混在させないため |
| WordPress `post_id`, taxonomy, `post_status` | 新サイト本体と別責務かつ旧CMS依存のため |
| 見積の値引き候補列、送料K2/K3、顧客情報 | 見積ドメインの責務のため |

## 未確定事項

| 論点 | 状態 |
|---|---|
| recyfit 以外の競合サイト追加 | 現行 `競合サイトデータまとめ` / `他社競合データ` の実運用度を確認後に追加 |
| 価格の税区分 | 現行競合価格が税込/税抜どちらとして扱われているか、サイト別に確認が必要 |
| 自動マッチ精度 | v0 は列だけ先に定義し、マッチロジックは後続実装で調整する |
| 競合レビューの正本運用 | 収集ブックに直接追記するか、新統合シートへ複製するかは移行ステップ設計で最終決定する |
