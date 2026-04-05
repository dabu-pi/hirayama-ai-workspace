# 公開商品フロント画像確認プラン

最終更新: 2026-04-05

## 今回の確認対象

- 入力JSON: `data/output/products.public.with-images.json`
- 元の確認対象抽出: `data/output/frontend_image_check_targets.csv`
- 派生画像: `data/derived-images/public-700x700/<sd_product_code>/...`
- placeholder 監視: `data/output/products_public_image_binding_report.csv`

対象は公開商品 66件のうち、代表ケース 6件と placeholder 商品 3件を加えた 9件。

## JSON を読む経路

この案件フォルダ内に、ローカル確認用の最小フロントを追加した。

- 画面: `frontend/public-preview/index.html`
- ロジック: `frontend/public-preview/app.js`
- スタイル: `frontend/public-preview/styles.css`

読込元:

- 商品JSON: `data/output/products.public.with-images.json`
- 画像ベース: `data/derived-images/`

`app.js` では次の設定を入り口にしている。

- `CONFIG.productsJsonUrl`
- `CONFIG.baseImageUrl`

現在は `frontend/public-preview/config.js` を設定ファイルとして使い、将来の `baseImageUrl` 差し替えはこの1ファイルだけで済む形にしている。

## 画像参照の前提

- `displayUrl` / `galleryUrls` は `public-700x700/<sd_product_code>/<file>.jpg`
- ローカル確認では `CONFIG.baseImageUrl = ../../data/derived-images/` として解決する
- 本番反映ではなく、あくまでローカル確認用の接続
- 本番第一候補は同一サイト配下の静的配信とし、`baseImageUrl` だけを本番URLへ差し替える

## 今回の確認方法

1. `uv run python -m http.server 8010` で project root を配信する
2. `http://127.0.0.1:8010/frontend/public-preview/index.html` を開く
3. `products.public.with-images.json` を読み込み、一覧カードを表示する
4. 通常商品は `displayUrl` / `galleryUrls`、placeholder 商品は `画像準備中` 分岐を確認する

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

1. 採用: フロントでは「画像準備中」表示に切り替える
2. 代替: placeholder を gallery から除外し、画像なし商品扱いにする
3. 非推奨: `NO IMAGE` を通常商品と同列にそのまま表示する

## フロント分岐ルール

判定条件:

- `imageStatus="placeholder"` または `hasRealImage=false`

一覧表示:

- 通常画像は出さない
- 「画像準備中」または同等文言へ切り替える

詳細表示:

- gallery は通常表示しない
- メイン画像領域は空状態UIまたは「画像準備中」表示へ切り替える

通常商品:

- `imageStatus="ready"` かつ `hasRealImage=true`
- 既存の `displayUrl` / `galleryUrls` 表示をそのまま使う

将来の戻り方:

- 実画像を回収して JSON を再出力すれば `ready` 側へ戻る
- フロントは同じ分岐条件のままで自然復帰できる

## 軽微な改善案

- 一覧カードの背景を淡いグレーにして白余白との差を和らげる
- placeholder 商品だけ「画像準備中」ラベルを出す
- 詳細で placeholder しかない商品は gallery UI を省略する

## 今回の判断

- 通常商品の表示品質は、次のフロント連携確認へ進めてよい
- 白余白は許容範囲
- 先に手を入れるべきなのは placeholder 3件への軽微な表示分岐だけ
- ローカル確認用の最小フロントで、通常商品 63件 / placeholder 3件の分岐を実装済み
- `baseImageUrl` 本番ルールは「同一サイト配下の静的配信」を第一候補とし、`config.js` 1箇所で差し替える
