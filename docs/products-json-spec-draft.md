# products.json 変換仕様 初稿

最終更新: 2026-04-04

## 目的

新統合スプレッドシートv0の商品データから、新サイト表示層へ渡すための中間JSON仕様を定義する。WordPress の post / taxonomy 前提ではなく、商品データとして自然で、将来DB/APIへ載せ替えやすい形を優先する。

## 基本方針

- 1商品 = 1 JSON object
- 商品の業務ID、表示名、価格、状態、カテゴリ、画像、公開制御、問い合わせ導線を明示的な構造で持つ
- 商品分類はカンマ連結文字列ではなく、配列またはコード+表示名のペアで持つ
- WordPress固有の `post_id` / `post_type` / `taxonomy` を正規項目として持たない
- 旧システム互換情報が必要なら `legacy` セクションに隔離する

## 1商品あたりのJSON構造案

```json
{
  "productId": "P-000123",
  "sdProductCode": "OOCY16003LG",
  "slug": "oocy16003lg",
  "name": "レッグプレス",
  "description": {
    "text": "商品説明テキスト",
    "html": "<p>商品説明HTML</p>"
  },
  "maker": {
    "makerId": "M-CYBEX",
    "name": "CYBEX",
    "code": "CY"
  },
  "location": {
    "code": "OO",
    "name": "大阪本部"
  },
  "condition": {
    "code": "used",
    "label": "中古"
  },
  "salesStatus": {
    "code": "for_sale",
    "label": "販売中"
  },
  "categories": {
    "machineTypes": [
      {
        "code": "weightstack-leg",
        "label": "ウェイトスタック 脚"
      }
    ],
    "bodyParts": [
      {
        "code": "LG",
        "label": "脚"
      }
    ],
    "tags": [
      "特価",
      "トップ掲載"
    ]
  },
  "spec": {
    "sizeText": "W1000×D1500×H1600",
    "weightText": "120kg"
  },
  "price": {
    "currency": "JPY",
    "taxMode": "ex_tax",
    "listPrice": 450000,
    "salePrice": 400000,
    "shippingCost": 30000,
    "showPrice": true
  },
  "images": [
    {
      "url": "https://drive.google.com/...",
      "alt": "レッグプレス 正面",
      "sortOrder": 1,
      "isMain": true
    }
  ],
  "visibility": {
    "isPublished": true,
    "isFeatured": false,
    "publishedAt": "2026-04-04T00:00:00+09:00"
  },
  "inquiry": {
    "enabled": true,
    "type": "product_quote",
    "prefillProductCode": "OOCY16003LG"
  },
  "seo": {
    "title": "レッグプレス | STRONG DEPOT",
    "description": "中古レッグプレスの商品詳細",
    "canonicalPath": "/products/oocy16003lg"
  },
  "legacy": {
    "sourceSpreadsheetId": "1KqOnN5eGh0i_DNRnpMHg9fqnR0DdVNeLEgui7lku3qk",
    "sourceSheetName": "ネットショップ商品一覧",
    "sourceRowNo": 123,
    "wpPostId": 2123,
    "wpCategoryText": "shops,honbu,trainingmachine,weightstackleg,maker,cybex"
  },
  "updatedAt": "2026-04-04T12:00:00+09:00"
}
```

## 項目定義

| 項目 | 必須/任意 | 型 | 説明 | 現行引継ぎ元 |
|---|---|---|---|---|
| `productId` | 必須 | string | 新システム内部の商品ID | 新規追加 |
| `sdProductCode` | 必須 | string | 現行互換の商品コード | `新規自動生成商品コード` |
| `slug` | 必須 | string | 新サイト商品詳細URL用slug | 初期は `sdProductCode` から生成 |
| `name` | 必須 | string | 商品名 | `商品名` |
| `description.text` | 任意 | string | プレーンテキスト説明 | `商品説明` からHTML除去可能 |
| `description.html` | 任意 | string | HTML説明 | `商品説明` |
| `maker.makerId` | 必須 | string | メーカー内部ID | 新規追加 |
| `maker.name` | 必須 | string | メーカー表示名 | `メーカー名` |
| `maker.code` | 任意 | string | 現行メーカーコード | 商品コード構成要素またはGAS配列 |
| `location.code` | 必須 | string | 店舗コード | `店舗` + GAS `shops` |
| `location.name` | 必須 | string | 店舗名 | `店舗` |
| `condition.code` | 必須 | string | `used` / `brand_new` / `exhibit` / `unused` / `refurbished` / `previous_model` など | `状態` を再マッピング |
| `condition.label` | 必須 | string | 状態表示名 | `状態` |
| `salesStatus.code` | 必須 | string | `for_sale` / `sold` / `hidden` など | `状態` + `公開状態` から再定義 |
| `salesStatus.label` | 必須 | string | 販売状態表示名 | `状態` + `公開状態` |
| `categories.machineTypes[]` | 任意 | array | 商品カテゴリ | `トレーニングマシンの種類` |
| `categories.bodyParts[]` | 任意 | array | 部位カテゴリ | `鍛える部位` |
| `categories.tags[]` | 任意 | array[string] | トップ掲載、特価などの追加タグ | `トップページ掲載`、値引き有無などから生成 |
| `spec.sizeText` | 任意 | string | サイズ表示 | `サイズ` |
| `spec.weightText` | 任意 | string | 重量表示 | `重量` |
| `price.currency` | 必須 | string | 通貨。初期は `JPY` 固定 | 新規追加 |
| `price.taxMode` | 必須 | string | `ex_tax` / `in_tax` | 新規追加 |
| `price.listPrice` | 必須 | number | 定価または基準価格 | `定価（税抜き）` |
| `price.salePrice` | 任意 | number | 値引き後価格 | `値引き後の価格（税抜き）` |
| `price.shippingCost` | 任意 | number | 標準送料 | `送料` |
| `price.showPrice` | 必須 | boolean | 価格をサイトに表示するか | 新規追加 |
| `images[]` | 任意 | array | 商品画像一覧 | `画像1`〜`画像3`、将来 `product_media` |
| `visibility.isPublished` | 必須 | boolean | 公開可否 | `公開状態` |
| `visibility.isFeatured` | 任意 | boolean | トップ掲載 | `トップページ掲載` |
| `visibility.publishedAt` | 任意 | string | 公開日時 | 新規追加 |
| `inquiry.enabled` | 必須 | boolean | この商品への問い合わせ導線を出すか | 新規追加 |
| `inquiry.type` | 任意 | string | 問い合わせ種別 | 新規追加 |
| `inquiry.prefillProductCode` | 任意 | string | 問い合わせフォームに渡す商品コード | `sdProductCode` |
| `seo.title` | 任意 | string | SEOタイトル | 新規追加または商品名から生成 |
| `seo.description` | 任意 | string | SEO説明文 | 商品説明から生成 |
| `seo.canonicalPath` | 任意 | string | 正規URLパス | `slug` から生成 |
| `legacy.sourceSpreadsheetId` | 任意 | string | 移行元ブックID | 新規追加 |
| `legacy.sourceSheetName` | 任意 | string | 移行元タブ名 | 新規追加 |
| `legacy.sourceRowNo` | 任意 | number | 移行元行番号 | 新規追加 |
| `legacy.wpPostId` | 任意 | number | 旧WordPress投稿ID互換 | `通し番号 + 2000` |
| `legacy.wpCategoryText` | 任意 | string | 旧WordPress taxonomy文字列 | `Wordpress用csv.tax_products-category` |
| `updatedAt` | 必須 | string | 商品データ更新日時 | 新規追加 |

## 画像の持ち方

| 項目 | 方針 |
|---|---|
| 複数画像 | `images` 配列で持つ |
| メイン画像 | `isMain=true` または配列先頭をメインとして扱う |
| alt | 画像ごとに `alt` を持てるようにする |
| 並び順 | `sortOrder` を持つ |
| 画像URL | 初期は Drive URL を許容するが、新サイト公開向けには配信用URLへ変換できるよう `sourceUrl` と `publicUrl` を分ける余地を残す |
| 現行移行 | 当面は `画像1`〜`画像3` を順に `images[]` へ変換する |

## 状態・カテゴリの持ち方

| 領域 | 方針 |
|---|---|
| 状態 | `condition` と `salesStatus` を分ける。例: 中古だが販売中、展示品だが非公開、売却済みなど |
| 店舗 | `location.code` + `location.name` を持つ |
| メーカー | `maker.makerId` + `maker.name` + `maker.code` を持つ |
| 商品カテゴリ | `categories.machineTypes[]` と `categories.bodyParts[]` に分ける |
| WordPress taxonomy | `shops,honbu` のような文字列は正規項目にしない。旧互換が必要なら `legacy.wpCategoryText` に隔離 |

## 公開制御の持ち方

| 項目 | 方針 |
|---|---|
| 公開/非公開 | `visibility.isPublished` を正とする |
| トップ掲載 | `visibility.isFeatured` で持つ。将来並び順が必要なら `featuredRank` を追加 |
| 売却済み | `salesStatus.code = sold` で表現し、公開継続するか非公開化するかは別ルールで制御 |
| 価格非表示 | `price.showPrice = false` を許容し、「お問い合わせください」表示に切り替えられるようにする |

## 価格の持ち方

| 項目 | 方針 |
|---|---|
| 税区分 | `price.taxMode` を明示する |
| 定価/販売価格 | `listPrice` と `salePrice` を分ける |
| 送料 | 商品単位の標準送料を `shippingCost` に持てるようにする。ただし最終見積送料は別ロジックで再計算する |
| 原価 | サイト公開JSONには原則含めない。必要なら社内API限定で別出力にする |
| 値引き率 | 公開JSONには必須ではない。必要なら `discountRate` を追加するが、まずは価格差から表現できる |

## SEO向け項目の要否

| 項目 | 初期要否 | 理由 |
|---|---|---|
| `seo.title` | 任意 | 商品名から自動生成できるが、個別調整余地を残す |
| `seo.description` | 任意 | 商品説明から生成できるが、一覧カードとSEO文面を分けたい場合に必要 |
| `seo.canonicalPath` | 任意 | ルーティングが固まるまで `slug` から自動生成でもよい |

## 問い合わせ導線用項目の要否

| 項目 | 初期要否 | 理由 |
|---|---|---|
| `inquiry.enabled` | 必須 | 売却済み/非公開/参考掲載など、問い合わせ導線を出さない商品があり得る |
| `inquiry.type` | 任意 | 商品見積、在庫確認、買取相談など導線種別を分けたい場合に使う |
| `inquiry.prefillProductCode` | 任意 | フォームへ商品コードを引き継ぐのに便利 |

## 変換ルール初稿

| 現行列 | JSON項目 | 変換ルール |
|---|---|---|
| `新規自動生成商品コード` | `sdProductCode`、`slug`、`inquiry.prefillProductCode` | `sdProductCode` はそのまま。`slug` は小文字化したコードを初期値にする案 |
| `商品名` | `name` | そのまま |
| `商品説明` | `description.html` / `description.text` | HTMLを許容するなら `html` にそのまま、検索用にタグ除去した `text` も生成 |
| `メーカー名` | `maker.name` / `maker.makerId` / `maker.code` | `設定マスタ` のメーカー定義と突合してID/コード化。未一致は変換エラー |
| `店舗` | `location.name` / `location.code` | `設定マスタ` の店舗定義と突合 |
| `状態` | `condition` / `salesStatus` | `中古/新品/展示品...` を `condition`、`売却済み` を `salesStatus` に再マップ |
| `トレーニングマシンの種類` | `categories.machineTypes[]` | 表示名 + category_code へ変換 |
| `鍛える部位` | `categories.bodyParts[]` | 表示名 + body_part_code へ変換 |
| `サイズ` | `spec.sizeText` | そのまま |
| `重量` | `spec.weightText` | そのまま |
| `定価（税抜き）` | `price.listPrice` | 数値化 |
| `値引き後の価格（税抜き）` | `price.salePrice` | 空欄なら `null` |
| `送料` | `price.shippingCost` | 数値化。最終見積送料とは別物として扱う |
| `公開状態` | `visibility.isPublished` / `salesStatus.code` | `非公開` なら false、空欄なら true。`売却済み` は状態側とも突合 |
| `トップページ掲載` | `visibility.isFeatured` | `1` なら true |
| `画像1`〜`画像3` | `images[]` | URLがあるものだけ配列化 |
| `通し番号` | `legacy.wpPostId` | 初期互換として `通し番号 + 2000` を再計算するか、既存WP IDを別取得できればそれを使う |

## このJSONに持たせないもの

- 仕入原価、仕入先、利益、社内メモ
- freee partner_id / quotation_id / Gmail Message-ID
- WordPress `post_type` / `post_status` / taxonomy 文字列を正規項目としてそのまま持つこと
- 見積テンプレートのN〜AB列の割引候補一覧
- 競合サイトの取得生HTMLや分類エラーログ

## 今回新たに確定したこと

- 新サイト向けJSONでは `sdProductCode` を残しつつ、状態、カテゴリ、画像、公開制御、問い合わせ導線をWordPress非依存の構造として定義できる。
- 現行 `Wordpress用csv` の列はそのまま商品JSON正規項目にせず、`legacy` または変換処理の入力として扱う方針が明確になった。

## まだ未確定のこと

- 商品詳細URLの最終slug規則
- Drive画像URLをそのまま公開に使うか、別の配信URLへ変換するか
- `condition` と `salesStatus` のコード体系をどこまで細分化するか
- 問い合わせフォーム側が必要とする `inquiry` 項目の最小セット

## 設計に進めるようになった項目

- `サイト出力ビュー` タブと `products.json` の列/項目対応
- 新サイト商品一覧/詳細PoCのデータ契約

## 次の一手

1. このJSON仕様と `integrated-sheet-v0.md` の列名を突き合わせ、1対1で変換できない項目を洗い出す。
2. 公開商品サンプル3〜5件を現行シートから手変換し、表示要件の不足項目を確認する。
3. 画像URL配信方式とslug規則を決める。

## すぐ実装着手できる候補

- `商品マスタ` → `products.json` の変換マッピング表
- サンプル `products.json` 生成スクリプトの入出力仕様
- 新サイト商品カード/商品詳細で必要な最小フィールドレビュー
