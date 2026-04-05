# 公開商品フロント画像確認プラン

最終更新: 2026-04-05

## 今回の確認対象

- 入力JSON: `data/output/products.public.with-images.json`
- 元の確認対象抽出: `data/output/frontend_image_check_targets.csv`
- 派生画像: `data/derived-images/public-700x700/<sd_product_code>/...`
- placeholder 監視: `data/output/products_public_image_binding_report.csv`

対象は公開商品 66件のうち、代表ケース 6件と placeholder 商品 3件を加えた 9件。

## JSON を読む経路

この案件フォルダ内には、現時点で本番相当のフロント実装やルーティング実装は存在しない。
そのため今回は、`products.public.with-images.json` を直接読み込むローカル確認用スクリプトを使い、一覧相当・詳細相当の表示を再現した。

- 実行スクリプト: `scripts/generate_frontend_image_review.py`
- ローカル確認HTML: `data/output/frontend_image_check_preview.html`
- 一覧プレビュー画像: `data/output/frontend_list_preview.png`
- 詳細プレビュー画像: `data/output/frontend_detail_preview.png`

## 画像参照の前提

- `displayUrl` / `galleryUrls` は `public-700x700/<sd_product_code>/<file>.jpg`
- ローカル確認では `data/derived-images/` を基点に解決する
- 本番反映ではなく、あくまでローカル確認用の接続

## 今回の確認方法

1. `products.public.with-images.json` を読み込む
2. `displayUrl` で一覧カード相当のプレビューを出す
3. `galleryUrls` を `image_seq` 順に詳細ギャラリー相当へ並べる
4. `sourceUrl=noimage.jpg` の 3商品を別扱いで確認する

## 一覧表示の評価

- 通常商品の primary 画像は概ね自然
- 白余白ありの横長・縦長商品も、商品全体を見せる目的には合っている
- カード崩れは見られない
- 白余白は「大きな違和感」までは出ていない
- ただし placeholder 商品 3件は `NO IMAGE` がそのまま出るため、一覧では目立つ

## 詳細表示の評価

- `galleryUrls` は `image_seq` 順で自然
- 1枚目 primary の選定も通常商品では大きな違和感なし
- 複数画像商品の並びも、全体像→角度違い→寄り の流れで見られるケースが多い
- placeholder 商品 3件は単画像かつ `NO IMAGE` 固定のため、詳細では不自然

## `noimage.jpg` 3商品の現状

- `HYEL15009AT`
- `OOEL15011AT`
- `HYKT16087AT`

現状:

- `sourceUrl` は placeholder
- `displayUrl` も placeholder 由来の 700x700
- gallery は 1件のみ

現実的な扱い案:

1. 第一候補: フロントでは「画像準備中」表示に切り替える
2. 第二候補: placeholder を gallery から除外し、画像なし商品扱いにする
3. 非推奨: `NO IMAGE` を通常商品と同列にそのまま表示する

## 軽微な改善案

- 一覧カードの背景を淡いグレーにして白余白との差を和らげる
- placeholder 商品だけ「画像準備中」ラベルを出す
- 詳細で placeholder しかない商品は gallery UI を省略する

## 今回の判断

- 通常商品の表示品質は、次のフロント連携確認へ進めてよい
- 白余白は許容範囲
- 先に手を入れるべきなのは placeholder 3件への軽微な表示分岐
