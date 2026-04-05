# baseImageUrl 切替メモ

最終更新: 2026-04-05

## 変更箇所

- `frontend/public-preview/config.js`
  - `baseImageUrl`
  - 必要なら `productsJsonUrl`

## 変更不要箇所

- `products.public.with-images.json`
  - 相対パス `public-700x700/...` は維持
- `displayUrl` / `galleryUrls` の構造
- placeholder 判定:
  - `imageStatus`
  - `hasRealImage`

## 本番前チェック項目

1. 配信先ディレクトリに `public-700x700/` 配下を配置できること
2. `baseImageUrl` の末尾 `/` を含めて join しても二重スラッシュにならないこと
3. 通常商品 63件で `displayUrl` / `galleryUrls` が 200 応答になること
4. placeholder 3件が通常画像表示されないこと
5. gallery の順序が変わっていないこと

## リスク

- 画像配置先のパスが JSON 相対パスとずれると一括で 404 になる
- Drive 正本化と配信先設計を混同すると、責務が曖昧になる
- 本番側に置く静的ディレクトリの権限設計が未確定

## 後回しでよいこと

- Drive 正本化の実作業
- CDN 化
- 非公開商品画像の配信
- placeholder 3件の実画像回収

## 推奨手順

1. 同一サイト配下の静的ディレクトリを確保する
2. `public-700x700/` 一式をその配信先へ置く
3. `config.js` の `baseImageUrl` を本番URLへ変更する
4. 通常商品と placeholder 商品を代表ケースで確認する
5. 問題なければ preview 実装を本番寄り配置へ移す
