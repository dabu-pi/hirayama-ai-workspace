# products.json 生成 試作メモ

## 今回作ったもの

- `scripts/export_products_json.py`
- サンプル出力: `data/output/products.sample.json`

## 出力構造

トップレベルは次の構造で出力する。

| 項目 | 内容 |
|---|---|
| `schemaVersion` | JSON仕様バージョン |
| `generatedAt` | 生成時刻（JST ISO8601） |
| `source` | 元CSV名と生成元システム識別子 |
| `products[]` | 商品配列 |

商品要素には `sdProductCode`, `slug`, `name`, `maker`, `store`, `condition`, `category`, `part`, `price`, `images`, `visibility`, `seo`, `searchText` を含める。

## 画像オブジェクト

`images[]` は最大10件の配列として扱う。今回の試作では実画像生成を行わないため、`displayUrl` は `null` を許容する。

| 項目 | 内容 |
|---|---|
| `sourceUrl` | 元画像URL |
| `displayUrl` | 700x700正方形の表示用画像URL。試作段階では未生成なら `null` |
| `width` / `height` | 表示用生成物の契約サイズ。v0では 700 / 700 |
| `alt` | 商品名・メーカー・商品コード・画像順から生成 |
| `isMain` | 代表画像かどうか |
| `sortOrder` | 1始まりの表示順 |

## visibility 変換

- 公開商品: `status=public`, `isPublished=true`
- トップ掲載商品: `isFeatured=true`
- 売却済み商品: `status=sold_visible`, `condition.isSoldOut=true`, `price.priceLabel="売却済み"`
- 非公開商品: `status=private`, `isPublished=false`, `inquiryEnabled=false`
- 画像なし商品: `images=[]` のまま出力し、生成処理側で未整備を検知できるようにする

## 実行コマンド

```powershell
$env:UV_CACHE_DIR='C:\hirayama-ai-workspace\workspace\.uv-cache'
& 'C:\Users\pinsh\.local\bin\uv.exe' run python -m scripts.export_products_json
```

## まだ仮の部分

- `displayUrl` の実URL生成ルール
- サムネイル専用URLを別項目で持つかどうか
- 画像0枚商品のサイト側フォールバック表示
- SEO title / description の確定生成ルール
