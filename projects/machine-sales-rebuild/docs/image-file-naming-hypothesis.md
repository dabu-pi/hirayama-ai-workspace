# 画像ファイル命名ルール仮説

最終更新: 2026-04-05

## 目的

過去に「商品コードベースで画像保存していた」前提から、探索時に当たりを付ける命名パターンを整理する。

## 探索優先順

1. 商品コード完全一致
2. 商品コード + 枝番
3. 商品コードの大小文字違い
4. 拡張子違い
5. フォルダ分けされた商品コード保存
6. WordPress の日付フォルダ配下に商品コードを含むファイル

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

## 自社画像と競合画像の違い

### 自社画像

- 商品コードそのものをファイル名に含めている可能性が高い
- WordPress メディア由来なら `uploads/yyyy/mm/` 配下の可能性もある

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

- 探索時は `sd_product_code` 完全一致を最優先にする
- 見つからない場合だけ `_1` / `-1` / 日付フォルダを広げる
- 競合画像は別ルールで管理している前提で、探索ロジックを分ける
