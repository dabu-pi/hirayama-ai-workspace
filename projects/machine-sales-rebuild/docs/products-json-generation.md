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

## 2026-04-05 採用した画像フィールド構造

公開商品向けの `products.public.with-images.json` では、次の構造を採用した。

- `displayUrl`
  - 一覧や詳細の primary 表示に使う代表画像
- `galleryUrls`
  - 表示用 700x700 画像の配列
- `images[]`
  - `sourceUrl` / `displayUrl` / `isMain` / `sortOrder` を持つ詳細オブジェクト

今回の判断:

- フロントで扱いやすい `displayUrl` と `galleryUrls` を前面に出す
- 既存契約との整合のため `images[]` も維持する
- primary は `image_seq=1` を原則にする
- gallery の並び順は `image_seq` 順に固定する

## 採用したパス表現

今回の `displayUrl` / `galleryUrls` には、将来差し替えしやすい相対パス表現を使う。

```text
public-700x700/<sd_product_code>/<file>.jpg
```

例:

```text
public-700x700/HYEL15009AT/HYEL15009AT-01-700x700.jpg
```

この形にしておくと、将来は

```text
<baseImageUrl> + '/' + displayUrl
```

で公開URLへ置換しやすい。

## visibility 変換

- 公開商品: `status=public`, `isPublished=true`
- トップ掲載商品: `isFeatured=true`
- 非公開商品: `status=private`, `isPublished=false`, `inquiryEnabled=false`
- 売却済み商品: `condition.isSoldOut=true`, `price.priceLabel="売却済み"`。ただし `公開状態=非公開` が優先なので、現行データでは `status=private` の売却済み行が多い。`sold_visible` は「売却済みを公開する」運用が確定した行だけに使う
- 画像なし商品: `images=[]` のまま出力し、生成処理側で未整備を検知できるようにする

## 実行コマンド

```powershell
Set-Location C:\hirayama-ai-workspace\workspace\projects\machine-sales-rebuild
$env:UV_CACHE_DIR='C:\hirayama-ai-workspace\workspace\.uv-cache'
uv run python -m scripts.export_products_json
```

## 実データ全量での再出力結果

- 入力: `data/output/product_master_v0.full.csv`
- 出力: `data/output/products.full.sample.json`
- 件数: 924商品
- `visibility.status` 内訳: `private` 858件、`public` 66件
- `images[]` 内訳: 924件すべて空配列

### 補足

現行フルデータでは `状態=売却済み` でも `公開状態=非公開` の行が多く、変換ロジックは `private` を優先している。
`sold_visible` は「売却済み商品を実績として公開したい」業務ルールが確定した段階で、条件を見直す。

## まだ仮の部分

- `displayUrl` の実URL生成ルール
- サムネイル専用URLを別項目で持つかどうか
- 画像0枚商品のサイト側フォールバック表示
- SEO title / description の確定生成ルール
- 元画像URLの回収元。現行 `ネットショップ商品一覧` の `画像1〜3` からはURLが取れていない
## 2026-04-05 phase5B 再実行結果

- 入力: `data/output/product_master_v0.full.csv`
- 出力: `data/output/products.full.sample.json`
- 商品件数: 924
- `visibility.status=public`: 66件
- `visibility.status=private`: 858件
- `featured_flag=true`: 14件
- `sold_visible`: 0件
- `images[]`: 全件空配列

## 補足

- `displayUrl` は未生成のまま
- 今回の実CSVでは `source_image_urls_json` が全件空なので、`products.full.sample.json` でも `images` は空になる
- まず元画像URLの正本を別経路で確定しないと、画像派生生成フェーズへは進めない

## 2026-04-05 公開商品画像パス反映結果

- 出力: `data/output/products.public.with-images.json`
- 対象商品: 66件
- `displayUrl` あり: 66件
- `displayUrl` なし: 0件
- `galleryUrls` あり: 66件
- `galleryUrls` 0件: 0件
- gallery 件数分布:
  - 1枚: 21商品
  - 2枚: 16商品
  - 3枚: 16商品
  - 4枚: 7商品
  - 5枚: 3商品
  - 6枚: 2商品
  - 7枚: 1商品

関連出力:

- `data/output/products_public_image_binding_report.csv`
- `data/output/products_public_image_binding_summary.csv`
- `data/output/products_public_image_binding_summary.md`
- `data/output/frontend_image_check_targets.csv`

### 注意点

- `sourceUrl` が WordPress テーマの `noimage.jpg` になっている公開商品が 3件ある
- 該当:
  - `HYEL15009AT`
  - `OOEL15011AT`
  - `HYKT16087AT`
- これらは `displayUrl` 自体は埋まるが、元画像としては要再確認

## 2026-04-05 公開商品派生画像生成後の次ステップ

- 公開商品 66件・163枚については `public_derived_image_manifest.csv` まで生成済み
- 今回の `products.public.with-images.json` では、`public_image_manifest.csv` と `public_derived_image_manifest.csv` を使って `displayUrl` / `galleryUrls` / `images[].sourceUrl` / `images[].displayUrl` を埋めた
- ただし今回の派生画像は公開商品のみで、非公開・売却済み・下書き相当は未対応
- 画像パスはローカル相対パスとして保持し、将来 `baseImageUrl` を前置するだけで公開URLへ差し替えられる前提にした

## 2026-04-05 フロント表示確認メモ

- 代表9商品で一覧相当・詳細相当のローカル確認を実施
- 通常商品の `displayUrl` は概ね自然で、白余白も許容範囲
- `galleryUrls` は `image_seq` 順で自然
- 問題が残るのは `sourceUrl=noimage.jpg` の 3商品だけ
- この 3商品は通常画像として出すより、フロントで「画像準備中」扱いに寄せる方が自然

次フェーズで最低限やること:

1. フロント表示で白余白と primary 画像の見え方を確認する
2. `sourceUrl=noimage.jpg` の 3商品をどう扱うか決める
3. `displayUrl` の base URL 差し替え規則を決める
