# products.json 仕様 正式ドラフト

## 目的

新サイトが商品一覧/商品詳細を描画するための中間データ契約を定義する。  
WordPress の post / taxonomy 前提ではなく、商品ドメインとして自然な構造にし、将来 DB/API へ移行しやすい形を優先する。

## JSON全体構造

```json
{
  "schemaVersion": "1.0.0",
  "generatedAt": "2026-04-04T10:00:00+09:00",
  "source": {
    "sheetName": "サイト出力ビュー",
    "system": "integrated-sheet-v0"
  },
  "products": []
}
```

| キー | 型 | 必須 | 内容 |
|---|---|---|---|
| `schemaVersion` | string | 必須 | JSON仕様バージョン |
| `generatedAt` | string(datetime) | 必須 | JSON生成時刻 |
| `source` | object | 任意 | 生成元メタデータ |
| `products` | array<object> | 必須 | 商品オブジェクト配列 |

---

## 1商品オブジェクト構造

| キー | 型 | 必須 | 内容 |
|---|---|---|---|
| `id` | string | 必須 | `internal_id` |
| `sdProductCode` | string | 必須 | 既存互換の商品コード |
| `slug` | string | 必須 | 商品詳細URL用 slug |
| `name` | string | 必須 | 商品名 |
| `description` | object | 任意 | 本文 |
| `maker` | object | 必須 | メーカーの code/label |
| `store` | object | 必須 | 店舗の code/label |
| `condition` | object | 必須 | 状態の code/label と売却済み判定 |
| `category` | object | 必須 | カテゴリの code/label |
| `part` | object | 必須 | 部位の code/label |
| `price` | object | 必須 | 表示価格情報 |
| `images` | array<object> | 必須 | 画像配列。最低1件、最大10件。元画像URLと表示用700x700画像URLの役割を分けて持つ |
| `visibility` | object | 必須 | 公開状態/トップ掲載/問い合わせ可否 |
| `seo` | object | 任意 | SEOメタ情報 |
| `searchText` | string | 任意 | サイト内検索用まとめ文字列 |
| `updatedAt` | string(datetime) | 必須 | 商品更新時刻 |

### `description`

| キー | 型 | 必須 | 内容 |
|---|---|---|---|
| `text` | string | 任意 | テキスト本文 |
| `html` | string | 任意 | HTML本文 |
| `summary` | string | 任意 | 一覧用短文 |

### `maker` / `store` / `category` / `part`

```json
{
  "code": "CYBEX",
  "label": "CYBEX"
}
```

| キー | 型 | 必須 | 内容 |
|---|---|---|---|
| `code` | string | 必須 | 設定マスタの内部コード |
| `label` | string | 必須 | 表示名 |

### `condition`

| キー | 型 | 必須 | 内容 |
|---|---|---|---|
| `code` | string | 必須 | `used`, `brandnew`, `sold` など |
| `label` | string | 必須 | 表示名 |
| `isSoldOut` | boolean | 必須 | 売却済み表示か |

### `price`

| キー | 型 | 必須 | 内容 |
|---|---|---|---|
| `currency` | string | 必須 | 原則 `JPY` |
| `taxMode` | string | 必須 | 原則 `EX_TAX` |
| `basePrice` | number/null | 任意 | 値引き前価格 |
| `salePrice` | number/null | 必須 | 現在表示価格。非公開でも管理JSONに残すなら null 許容 |
| `discountPrice` | number/null | 任意 | 値引き後価格。`salePrice` と同値でも保持可 |
| `shippingFee` | number/null | 任意 | 送料目安 |
| `priceLabel` | string/null | 任意 | 「売却済み」「お問い合わせください」等の補助表示 |

### `images`

```json
[
  {
    "sourceUrl": "https://example.com/source-images/OOCY16003LG-1-original.jpg",
    "displayUrl": "https://example.com/display-images/OOCY16003LG-1-700.jpg",
    "width": 700,
    "height": 700,
    "alt": "CYBEX レッグプレス OOCY16003LG",
    "isMain": true,
    "sortOrder": 1
  }
]
```

| キー | 型 | 必須 | 内容 |
|---|---|---|---|
| `sourceUrl` | string | 必須 | 元画像URL。アップロード時の縦横比を残した原本参照 |
| `displayUrl` | string | 必須 | サイト表示用の700x700正方形画像URL。元画像とは別生成物 |
| `width` | number | 必須 | 表示用画像の幅px。v0は原則700 |
| `height` | number | 必須 | 表示用画像の高さpx。v0は原則700 |
| `alt` | string | 任意 | 画像alt |
| `isMain` | boolean | 必須 | 代表画像か |
| `sortOrder` | number | 必須 | 並び順。1始まり |

画像生成時は元画像の縦横比を問わず、商品全体の収まりを優先して700x700へ整形する。過度な自動トリミングは避け、余白は背景で埋める。共通ルールは `docs/image-spec-v0.md` を参照する。

### `visibility`

| キー | 型 | 必須 | 内容 |
|---|---|---|---|
| `status` | string | 必須 | `public`, `private`, `draft`, `sold_visible` |
| `isPublished` | boolean | 必須 | サイト公開対象か |
| `isFeatured` | boolean | 必須 | トップ掲載か |
| `inquiryEnabled` | boolean | 必須 | 問い合わせボタンを出すか |

### `seo`

| キー | 型 | 必須 | 内容 |
|---|---|---|---|
| `title` | string | 任意 | meta title |
| `description` | string | 任意 | meta description |
| `canonicalPath` | string | 任意 | `/products/{slug}` など |

---

## 商品1件の完全例

```json
{
  "id": "P0000001",
  "sdProductCode": "OOCY16003LG",
  "slug": "oocy16003lg",
  "name": "CYBEX レッグプレス",
  "description": {
    "text": "業務用のレッグプレスです。動作確認済み。",
    "html": "<p>業務用のレッグプレスです。動作確認済み。</p>",
    "summary": "業務用レッグプレス。動作確認済み。"
  },
  "maker": {
    "code": "CYBEX",
    "label": "CYBEX"
  },
  "store": {
    "code": "OO",
    "label": "大阪本部"
  },
  "condition": {
    "code": "used",
    "label": "中古",
    "isSoldOut": false
  },
  "category": {
    "code": "strength_machine",
    "label": "ストレングスマシン"
  },
  "part": {
    "code": "LG",
    "label": "脚"
  },
  "price": {
    "currency": "JPY",
    "taxMode": "EX_TAX",
    "basePrice": 300000,
    "salePrice": 250000,
    "discountPrice": 250000,
    "shippingFee": 30000,
    "priceLabel": null
  },
  "images": [
    {
      "sourceUrl": "https://example.com/source-images/OOCY16003LG-1-original.jpg",
      "displayUrl": "https://example.com/display-images/OOCY16003LG-1-700.jpg",
      "width": 700,
      "height": 700,
      "alt": "CYBEX レッグプレス OOCY16003LG",
      "isMain": true,
      "sortOrder": 1
    },
    {
      "sourceUrl": "https://example.com/source-images/OOCY16003LG-2-original.jpg",
      "displayUrl": "https://example.com/display-images/OOCY16003LG-2-700.jpg",
      "width": 700,
      "height": 700,
      "alt": "CYBEX レッグプレス OOCY16003LG 画像2",
      "isMain": false,
      "sortOrder": 2
    }
  ],
  "visibility": {
    "status": "public",
    "isPublished": true,
    "isFeatured": true,
    "inquiryEnabled": true
  },
  "seo": {
    "title": "CYBEX レッグプレス | STRONG DEPOT",
    "description": "中古のCYBEX レッグプレス。大阪本部在庫。お問い合わせは商品コード OOCY16003LG。",
    "canonicalPath": "/products/oocy16003lg"
  },
  "searchText": "CYBEX レッグプレス 中古 脚 ストレングスマシン OOCY16003LG 大阪本部",
  "updatedAt": "2026-04-04T10:00:00+09:00"
}
```

## サンプルJSON 3〜5件

```json
{
  "schemaVersion": "1.0.0",
  "generatedAt": "2026-04-04T10:00:00+09:00",
  "source": {
    "sheetName": "サイト出力ビュー",
    "system": "integrated-sheet-v0"
  },
  "products": [
    {
      "id": "P0000001",
      "sdProductCode": "OOCY16003LG",
      "slug": "oocy16003lg",
      "name": "CYBEX レッグプレス",
      "maker": {
        "code": "CYBEX",
        "label": "CYBEX"
      },
      "store": {
        "code": "OO",
        "label": "大阪本部"
      },
      "condition": {
        "code": "used",
        "label": "中古",
        "isSoldOut": false
      },
      "category": {
        "code": "strength_machine",
        "label": "ストレングスマシン"
      },
      "part": {
        "code": "LG",
        "label": "脚"
      },
      "price": {
        "currency": "JPY",
        "taxMode": "EX_TAX",
        "basePrice": 300000,
        "salePrice": 250000,
        "discountPrice": 250000,
        "shippingFee": 30000,
        "priceLabel": null
      },
      "images": [
        {
          "sourceUrl": "https://example.com/source-images/OOCY16003LG-1-original.jpg",
          "displayUrl": "https://example.com/display-images/OOCY16003LG-1-700.jpg",
          "width": 700,
          "height": 700,
          "alt": "CYBEX レッグプレス OOCY16003LG",
          "isMain": true,
          "sortOrder": 1
        }
      ],
      "visibility": {
        "status": "public",
        "isPublished": true,
        "isFeatured": true,
        "inquiryEnabled": true
      },
      "seo": {
        "title": "CYBEX レッグプレス | STRONG DEPOT",
        "description": "中古のCYBEX レッグプレス。お問い合わせは商品コード OOCY16003LG。",
        "canonicalPath": "/products/oocy16003lg"
      },
      "searchText": "CYBEX レッグプレス 中古 脚 ストレングスマシン OOCY16003LG",
      "updatedAt": "2026-04-04T10:00:00+09:00"
    },
    {
      "id": "P0000002",
      "sdProductCode": "HYIC24909AT",
      "slug": "hyic24909at",
      "name": "ICARIAN ショルダープレス",
      "maker": {
        "code": "ICARIAN",
        "label": "ICARIAN"
      },
      "store": {
        "code": "HY",
        "label": "兵庫"
      },
      "condition": {
        "code": "used",
        "label": "中古",
        "isSoldOut": false
      },
      "category": {
        "code": "strength_machine",
        "label": "ストレングスマシン"
      },
      "part": {
        "code": "SH",
        "label": "肩"
      },
      "price": {
        "currency": "JPY",
        "taxMode": "EX_TAX",
        "basePrice": 180000,
        "salePrice": 150000,
        "discountPrice": 150000,
        "shippingFee": 20000,
        "priceLabel": null
      },
      "images": [
        {
          "sourceUrl": "https://example.com/source-images/HYIC24909AT-1-original.jpg",
          "displayUrl": "https://example.com/display-images/HYIC24909AT-1-700.jpg",
          "width": 700,
          "height": 700,
          "alt": "ICARIAN ショルダープレス HYIC24909AT",
          "isMain": true,
          "sortOrder": 1
        }
      ],
      "visibility": {
        "status": "public",
        "isPublished": true,
        "isFeatured": false,
        "inquiryEnabled": true
      },
      "seo": {
        "title": "ICARIAN ショルダープレス | STRONG DEPOT",
        "description": "ICARIAN ショルダープレスの中古在庫。商品コード HYIC24909AT。",
        "canonicalPath": "/products/hyic24909at"
      },
      "searchText": "ICARIAN ショルダープレス 中古 肩 ストレングスマシン HYIC24909AT",
      "updatedAt": "2026-04-04T10:00:00+09:00"
    },
    {
      "id": "P0000003",
      "sdProductCode": "OOB116001AT",
      "slug": "oob116001at",
      "name": "B1 マルチラック",
      "maker": {
        "code": "B1",
        "label": "B1"
      },
      "store": {
        "code": "OO",
        "label": "大阪本部"
      },
      "condition": {
        "code": "sold",
        "label": "売却済み",
        "isSoldOut": true
      },
      "category": {
        "code": "free_weight",
        "label": "フリーウェイト"
      },
      "part": {
        "code": "AT",
        "label": "その他"
      },
      "price": {
        "currency": "JPY",
        "taxMode": "EX_TAX",
        "basePrice": 120000,
        "salePrice": 120000,
        "discountPrice": null,
        "shippingFee": null,
        "priceLabel": "売却済み"
      },
      "images": [
        {
          "sourceUrl": "https://example.com/source-images/OOB116001AT-1-original.jpg",
          "displayUrl": "https://example.com/display-images/OOB116001AT-1-700.jpg",
          "width": 700,
          "height": 700,
          "alt": "B1 マルチラック OOB116001AT",
          "isMain": true,
          "sortOrder": 1
        }
      ],
      "visibility": {
        "status": "sold_visible",
        "isPublished": true,
        "isFeatured": false,
        "inquiryEnabled": false
      },
      "searchText": "B1 マルチラック 売却済み その他 フリーウェイト OOB116001AT",
      "updatedAt": "2026-04-04T10:00:00+09:00"
    },
    {
      "id": "P0000004",
      "sdProductCode": "SAOT25007CH",
      "slug": "saot25007ch",
      "name": "テスト登録 ベンチプレス",
      "maker": {
        "code": "UNKNOWN_MAKER",
        "label": "未設定"
      },
      "store": {
        "code": "SA",
        "label": "埼玉"
      },
      "condition": {
        "code": "used",
        "label": "中古",
        "isSoldOut": false
      },
      "category": {
        "code": "strength_machine",
        "label": "ストレングスマシン"
      },
      "part": {
        "code": "CH",
        "label": "胸"
      },
      "price": {
        "currency": "JPY",
        "taxMode": "EX_TAX",
        "basePrice": 100000,
        "salePrice": 100000,
        "discountPrice": null,
        "shippingFee": null,
        "priceLabel": null
      },
      "images": [
        {
          "sourceUrl": "https://example.com/source-images/SAOT25007CH-1-original.jpg",
          "displayUrl": "https://example.com/display-images/SAOT25007CH-1-700.jpg",
          "width": 700,
          "height": 700,
          "alt": "テスト登録 ベンチプレス SAOT25007CH",
          "isMain": true,
          "sortOrder": 1
        }
      ],
      "visibility": {
        "status": "private",
        "isPublished": false,
        "isFeatured": false,
        "inquiryEnabled": false
      },
      "searchText": "テスト登録 ベンチプレス 中古 胸 ストレングスマシン SAOT25007CH",
      "updatedAt": "2026-04-04T10:00:00+09:00"
    }
  ]
}
```

## 現行列 → JSONキー マッピング概要

| 現行列 | JSONキー | 変換ルール |
|---|---|---|
| `新規自動生成商品コード` | `sdProductCode`, `slug`, `seo.canonicalPath`, `searchText` | `sdProductCode` はそのまま。`slug` は小文字化など安全なURL文字列へ変換 |
| `商品名` | `name`, `seo.title`, `images[].alt`, `searchText` | `seo.title` 未入力時は商品名 + サイト名で補完。`images[].alt` も商品名/メーカー/商品コードから生成可 |
| `商品説明` | `description.text`, `description.html`, `description.summary`, `seo.description` | HTML有無を分離し、summary/description は短縮生成可 |
| `メーカー名` | `maker.code`, `maker.label`, `searchText` | 設定マスタで `code` 正規化し、表示名を `label` に入れる |
| `店舗` | `store.code`, `store.label`, `searchText` | 大阪一括丸め込みではなく店舗コード正規化 |
| `状態` | `condition.code`, `condition.label`, `condition.isSoldOut`, `visibility.inquiryEnabled`, `price.priceLabel`, `searchText` | `売却済み` 判定と公開可否を分けて変換 |
| `トレーニングマシンの種類` | `category.code`, `category.label`, `searchText` | WordPress taxonomy ではなく設定マスタコードへ変換 |
| `鍛える部位` | `part.code`, `part.label`, `searchText` | `首` 空コード例外を設定マスタで補正 |
| `定価（税抜き）` | `price.basePrice`, `price.salePrice` | 値引後価格が空欄なら `salePrice = basePrice` |
| `値引き後の価格（税抜き）` | `price.discountPrice`, `price.salePrice` | 入力ありなら `salePrice = discountPrice` |
| `送料` | `price.shippingFee` | 数値化。空欄は `null` |
| `公開状態` | `visibility.status`, `visibility.isPublished` | WordPress `private/publish` を新システム状態へマップ |
| `トップページ掲載` | `visibility.isFeatured` | `トップページ掲載` 入力有無を boolean 化 |
| `画像1〜3` | `images[].sourceUrl`, `images[].displayUrl`, `images[].width`, `images[].height`, `images[].isMain`, `images[].sortOrder` | 初回移行では画像1〜3を順序維持で `sourceUrl` に移し、派生生成した700x700正方形URLを `displayUrl` に入れる。将来4〜10枚目を追加可能。先頭または代表指定画像を `isMain=true` |
| `検索キーワード` | `searchText` | 商品名/分類ラベルと結合して検索用文字列化 |
| `通し番号` | `id` には使わない | 初回移行の照合や `legacy_wp_post_id` には使えるが、JSONの正本IDは `internal_id` |

## 旧WordPress依存項目を入れないルール

| 入れない項目 | 代替 |
|---|---|
| `post_id` | `id` = `internal_id` |
| `post_name` | `slug` |
| `post_title` | `name` |
| `post_type` | 不要 |
| `post_status` | `visibility.status`, `visibility.isPublished` |
| `tax_products-category` | `maker`, `store`, `condition`, `category`, `part` の code/label |

## 未確定だが設計上の保留にできる点

| 論点 | 現時点の扱い |
|---|---|
| 非公開商品を `products.json` に含めるか | v0 では `visibility.isPublished=false` の行もサンプルに含め、公開APIで除外するか静的生成時に除外するかは実装方式比較で決める |
| HTML説明を残すか | 現行互換のため `description.html` を許容するが、将来は安全なHTMLホワイトリストか Markdown 化を検討する |
| 画像URLの保管先 | v0 では `sourceUrl` / `displayUrl` をURL文字列で保持する。Drive派生画像、オブジェクトストレージ、CDN のどこへ置くかは実装フェーズで決める |
| サムネイルURL | v0 では `displayUrl` を基本表示画像として使い、専用 `thumbnailUrl` はまだ持たない。必要になったら後方互換で追加する |
| 税込価格をJSONに持つか | v0 は税抜基準 `EX_TAX` を正本にし、税込表示はフロントまたは派生生成で対応する |
