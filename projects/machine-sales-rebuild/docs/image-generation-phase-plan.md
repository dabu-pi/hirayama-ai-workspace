# 画像生成フェーズ計画

最終更新: 2026-04-05

## 現在の判断

700x700 派生画像生成は、**公開商品の範囲で実行完了** した。

ただし、

- 非公開商品
- 売却済み商品
- 下書き相当

は今回対象外のため、全商品一律の生成フローとしてはまだ未完。

理由:

- 現行 `画像1〜3` は正本URLとして使えない
- `source_image_count=0` が 924件すべて
- 自社商品画像の正本保管先が未確定
- `machine-group.net` の公開 WordPress メディアから、公開商品 66 件・163 画像の回収に成功した
- 回収済み 163 画像に対して 700x700 派生画像 163 枚の生成に成功した

## 進行条件

| 条件 | 現状 | 判定 |
|---|---|---|
| 元画像の正本が分かる | WordPress 公開メディアが回収元候補として浮上、将来正本は未確定 | 未達 |
| 元画像の取得方法が再現できる | 公開商品 66 件・163 画像で公開HTMLからの回収に成功 | 公開商品は達成 |
| 1商品に対して画像群を結びつけられる | `slug` / hidden `product-code` / 画像ファイル名で 66 商品は整合 | 公開商品は達成 |
| 画像0件商品をどう扱うか決まっている | 公開商品は 0件、非公開系は未対応 | 公開商品は達成 |
| 派生画像の保存先候補が整理されている | ローカル派生画像生成と manifest まで完了。正本は Drive 候補 | 公開商品は達成 |

## 再開時の入力

- 自社商品画像の正本一式
- 商品コードと画像ファイル名の対応ルール
- `product_master_v0.full.csv`
- 今後の保存先ルール

## 再開時の出力

- `data/derived-images/` 配下の 700x700 表示用画像
- 画像生成ログ
- `products.json.images[].displayUrl`

## 今回の生成結果

- 対象画像総数: 163
- 生成成功枚数: 163
- 生成失敗枚数: 0
- 商品単位成功数: 66
- 商品単位失敗数: 0
- 出力形式: JPEG 統一
- 白余白付与: 28枚
- 余白なし: 135枚

目視所感:

- 明らかな歪みは見られなかった
- 横長 / 縦長画像では白余白がはっきり見える
- 透過PNGの白背景合成も実用上は大きな違和感なし

## products.json 連携状況

- `products.public.with-images.json` を生成済み
- 対象は公開商品 66件
- `displayUrl` あり: 66件
- `galleryUrls` あり: 66件
- `displayUrl` / `galleryUrls` は `public-700x700/<sd_product_code>/<file>.jpg` 形式の相対パスで保持
- 公開商品 3件は `sourceUrl=noimage.jpg` のため、派生画像は使えるが元画像正本としては要再確認

## 想定構造

- 元画像置き場: `data/raw-images/`
- 派生画像置き場: `data/derived-images/`
- 将来の表示用命名案: `{sd_product_code}-{sortOrder:02d}-700x700.jpg`

## 正本候補の現時点整理

- 自社商品画像:
  - `machine-group.net` の公開 WordPress メディアが回収元候補として最有力
  - `/products/<小文字商品コード>/` と `wp-content/uploads/<大文字商品コード>_枝番.<拡張子>` の対応が見えている
  - 公開商品では 66商品・163画像の保存に成功した
  - `public_image_manifest.csv` まで生成できており、公開商品に限れば生成入力が揃った
  - `public_derived_image_manifest.csv` まで生成できており、公開商品に限れば表示用画像入力も揃った
  - ただし、非公開商品まで拾えるか、公開HTMLだけで全件回収できるかは未確認
  - 今後の正式な正本保存先は引き続き Google Drive を第一候補とする
- 競合画像:
  - 既存 docs から Google Drive フォルダ `1Q0vGVu2N8Ouq8us0JIMSaH1oCdHVLiZl` に `商品ID_画像枝番` 形式で保存していた痕跡あり
  - 自社画像とは保管系統を分けて扱う前提が妥当

## 次に必要な調査

1. フロント表示で白余白の見え方を確認する
2. `products.json` の画像パスに base URL をどう前置するか決める
3. `sourceUrl=noimage.jpg` の 3商品をどう扱うか決める
4. `strongdepot-product-manager` の PHP / WordPress 側実装を回収する
5. Google Drive に自社商品画像フォルダが存在するか確認する
6. 非公開商品・売却済み商品の画像回収経路を別途確認する
7. 競合画像と自社画像の正本を同じ設計に載せるか、別管理にするか決める

## 進める / 止める判断基準

進める:

- 公開または回収済み WordPress 画像の実体が取得できる
- 商品コード単位で画像群を拾える
- 試験的に 5〜10商品で原本と派生画像を対応付けできる
- 公開側だけでは足りない商品群の扱い方が決まる

公開商品については、上のうち前半 3 条件を満たした。
派生画像生成についても、公開商品範囲では完了した。

止める:

- WordPress 公開側では一部しか拾えず、非公開商品の回収経路も見つからない
- 商品コードと画像ファイルの対応が曖昧
- URLだけではなくログイン必須・手作業必須で再現不能

## 次フェーズ入力として使うファイル

- `data/output/public_image_manifest.csv`
- `data/output/wordpress_recovery_public_results.csv`
- `data/raw-images/wordpress-public/`
- `data/output/public_derived_image_manifest.csv`
- `data/output/public_derived_image_results.csv`
- `data/derived-images/public-700x700/`
- `data/output/products.public.with-images.json`
- `data/output/products_public_image_binding_report.csv`
- `data/output/frontend_image_check_targets.csv`

## Drive 正本化へ向けた最低限の整理項目

- 回収済み画像を Drive へ移す際のフォルダ命名規則
- `sd_product_code` ごとのサブフォルダ維持可否
- 元URLと Drive 側ファイルIDの対応表
- Drive 側へ移した後も、派生画像生成は manifest 経由で流せる形にすること

## 今回まだ決めないこと

- 背景余白色の最終固定
- JPEG / PNG / WebP の最終形式
- CDN / 公開URLの最終構成
- 再生成トリガーの最終方式
