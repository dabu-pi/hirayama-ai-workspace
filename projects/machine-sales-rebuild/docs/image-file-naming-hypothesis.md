# 画像ファイル命名ルール仮説

最終更新: 2026-04-05

## 目的

過去に「商品コードベースで画像保存していた」前提から、探索時に当たりを付ける命名パターンを整理する。

## 探索優先順

1. 商品ページ slug の商品コード一致
2. 画像ファイル名の大文字商品コード + 枝番
3. 拡張子違い
4. 商品コード完全一致
5. フォルダ分けされた商品コード保存
6. WordPress の日付フォルダ配下に商品コードを含むファイル

補足:

- `machine-group.net` の公開HTMLでは、`/products/{商品コード小文字}/` と `wp-content/uploads/{商品コード大文字}_{枝番}.{ext}` が最も強いパターンだった
- 今回見た範囲では `uploads/yyyy/mm/` の日付フォルダは確認できなかった
- `og:image` は補助情報に留め、本文ギャラリーの `img src` を優先する

## 想定パターン

### そのまま一致

- `{sd_product_code}.jpg`
- `{sd_product_code}.jpeg`
- `{sd_product_code}.png`
- `{sd_product_code}.webp`

### アンダースコア枝番

- `{sd_product_code}_1.jpg`
- `{sd_product_code}_2.jpg`
- `{sd_product_code}_3.jpg`
- `{SD_PRODUCT_CODE_UPPER}_1.png`
- `{SD_PRODUCT_CODE_UPPER}_2.png`

### ハイフン枝番

- `{sd_product_code}-1.jpg`
- `{sd_product_code}-2.jpg`
- `{sd_product_code}-3.jpg`

### ゼロ埋め枝番

- `{sd_product_code}-01.jpg`
- `{sd_product_code}-02.jpg`
- `{sd_product_code}-03.jpg`

### 大文字 / 小文字違い

- `oocy16003lg.jpg`
- `OOCY16003LG.jpg`
- `OOCY16003LG_1.JPG`

### フォルダ分けの可能性

- `year/store/maker/{sd_product_code}_1.jpg`
- `maker/{sd_product_code}/1.jpg`
- `uploads/yyyy/mm/{sd_product_code}-1.jpg`
- `wp-content/uploads/{SD_PRODUCT_CODE_UPPER}_1.jpg`
- `wp-content/uploads/{SD_PRODUCT_CODE_UPPER}_2.png`

## 自社画像と競合画像の違い

### 自社画像

- 商品コードそのものをファイル名に含めている可能性が高い
- 公開サイトでは `wp-content/uploads/` 直下に商品コードベース画像が見えた
- slug は小文字、画像ファイル名は大文字 + `_枝番` が有力
- 拡張子は `jpg` と `png` が混在しうる

### 競合画像

- docs 上は `商品ID_画像枝番` のルールが見えている
- 自社商品コードと同じ命名規則を前提にしない方がよい

## 将来の正式命名ルール案

### 元画像

```text
{sd_product_code}-{seq:02d}-source.{ext}
```

例:

```text
OOCY16003LG-01-source.jpg
OOCY16003LG-02-source.jpg
```

### 派生画像

```text
{sd_product_code}-{seq:02d}-700x700.jpg
```

例:

```text
OOCY16003LG-01-700x700.jpg
OOCY16003LG-02-700x700.jpg
```

## メモ

- 探索時は `sd_product_code` を中心に、`slug -> hidden product-code -> gallery img src` の順で照合する
- 見つからない場合だけ `_1` / `-1` / 拡張子違い / 日付フォルダを広げる
- 競合画像は別ルールで管理している前提で、探索ロジックを分ける

## 商品との紐付けキー優先順

1. `sd_product_code` 完全一致
2. 商品ページ slug
3. hidden `product-code`
4. 画像ファイル名中の識別子
5. 商品名の正規化一致
6. メーカー + 型番

## 誤紐付けリスク

- `og:image` のみを見ると拡張子違いで誤検知する可能性がある
- 商品名一致だけで結ぶと同型番・類似名の誤結合が起こりうる
- 競合画像の `商品ID_画像枝番` ルールを自社商品へ流用しないこと
