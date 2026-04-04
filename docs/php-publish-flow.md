# PHP側商品反映フロー調査

最終更新: 2026-04-04

## 目的

`ネットショップ商品一覧` からサイト側へ商品を反映するPHP受け口と、WordPress依存点、入力データ構造、現時点の未回収リスクを整理する。

## 今回の調査で試した回収経路

| 回収経路 | 結果 | 備考 |
|---|---|---|
| ワークスペース内の `.php` 検索 | `generate.php` / `Settings.php` / `strongdepot-product-manager` は見つからず | PowerShell で `workspace` 配下を再帰検索 |
| `C:\Users\pinsh\OneDrive` 配下検索 | `strongdepot-product-manager` ディレクトリ、`generate.php`、`Settings.php` は見つからず | デスクトップ上のGASテキスト3件は確認できたがPHP控えは無し |
| GitHubコネクタで `strongdepot-product-manager` 検索 | 該当リポジトリなし | 接続済みGitHub資産としては見えていない |
| `git ls-remote https://github.com/kohakuwebdesign/strongdepot-product-manager.git` | `Repository not found.` | 公開リポジトリではない、名前変更、または権限不足の可能性 |
| Web検索 | 有意な結果なし | 少なくとも公開Web上では直接見つかっていない |

## 現時点でGAS側から確定できる反映入口

| 項目 | 内容 | 参照元 |
|---|---|---|
| 入口URL | `https://machine-group.net/strongdepot-product-manager/generate.php` | `ネットショップ商品一覧GAS.txt` / `sendHttpPost()` |
| 呼び出し方式 | `UrlFetchApp.fetch(url, options)` による HTTP POST | `sendHttpPost()` |
| payload | `JSON.stringify(doGet(), null, 2)` | `sendHttpPost()` |
| 入力データ生成 | `doGet()` が `getData('ネットショップ商品一覧')` を返す | `doGet()` |
| データ構造 | `ネットショップ商品一覧` の1行目をキー、2行目以降を値にしたオブジェクト配列 | `getData()` |
| 大阪店舗名の正規化 | ヘッダーが `店舗` かつ値に `大阪` を含む場合、送信値を一律 `大阪` に置換 | `getData()` |
| 認証/署名 | GAS側コード上は認証ヘッダー、APIキー、署名、Basic認証などの付与なし | `sendHttpPost()` |
| 応答処理 | レスポンス本文を `Browser.msgBox(content)` で表示 | `sendHttpPost()` |

## 入力JSON構造

`getData(sheetName)` は、対象シートの1行目ヘッダーをオブジェクトキーとして、全データ行を配列化して返す。

### 送信payloadの概形

```json
[
  {
    "通し番号": "1",
    "メーカー名": "CYBEX",
    "商品名": "レッグプレス",
    "定価（税抜き）": "450000",
    "商品説明": "....",
    "状態": "中古",
    "店舗": "大阪",
    "仕入れ年": "16",
    "鍛える部位": "脚",
    "トレーニングマシンの種類": "ウェイトスタック 脚",
    "サイズ": "...",
    "重量": "...",
    "検索キーワード": "...",
    "公開状態": "",
    "新規自動生成商品コード": "OOCY16003LG",
    "画像1": "...",
    "画像2": "...",
    "画像3": "...",
    "BASEで販売しない場合は「いいえ」を入力": "1",
    "トップページ掲載": "1",
    "値引き後の価格（税抜き）": "400000",
    "仕入年月日": "...",
    "仕入先": "...",
    "原価": "200000",
    "送料": "30000",
    "売値計算式": "...",
    "数": "1",
    "原価×数": "200000",
    "販売年月日": "",
    "売却価格": "",
    "販売先": ""
  }
]
```

### 注意

- 送信しているのは `Wordpress用csv` ではなく、`ネットショップ商品一覧` の全行JSON。
- 値は `String(item)` で文字列化されるため、PHP側で数値/日付/空欄の再解釈をしている可能性がある。
- 店舗名に `大阪` を含む値はすべて `大阪` に丸められるため、`大阪本部` / `大阪粉浜` / `大阪今里` / `大阪山下` の区別がPOST先では失われる可能性がある。

## PHP側でやっているはずの処理

### 実際に確認できたこと

- `generate.php` が受信口であること。
- `Settings.php` にカテゴリ定義があり、GAS側コメントでカテゴリ変更時は `strongdepot-product-manager` の `Settings.php` も更新が必要とされていること。

### 推測

PHPソース未回収のため推測だが、`generate.php` は以下のような処理をしている可能性が高い。

1. POSTされた商品配列JSONを受信する。
2. `Settings.php` のカテゴリ定義やステータス定義を使い、商品データを WordPress 投稿/カスタム投稿/メタ情報/taxonomy へ変換する。
3. `新規自動生成商品コード` や `通し番号+2000` 相当のIDをキーに、既存投稿の更新または新規作成を行う。
4. 画像URL、公開状態、売却済み状態、トップページ掲載フラグをWordPress側へ反映する。
5. 実行結果をレスポンス本文として返し、GAS側が `Browser.msgBox()` で表示する。

## WordPress依存点

| 依存点 | 現時点で分かる内容 | 確度 |
|---|---|---|
| PHP受け口 `generate.php` | GASから商品JSONを受ける本番反映入口 | 確認済 |
| `Settings.php` の categories | GASコメント上、カテゴリ変更時に更新が必要 | 確認済 |
| taxonomy/category 構造 | GAS側は `shops,xxx` / `maker,xxx` / `trainingmachine,xxx` / `trainingparts,xxx` / `status,xxx` を生成 | 確認済 |
| `post_type=products` | `Wordpress用csv` と `createWordpressCsv()` に固定値あり | 確認済 |
| `publish/private` | `postStatus` 配列で `非公開→private`、空欄→`publish` | 確認済 |
| 商品識別子 | `Wordpress用csv.post_id = 通し番号 + 2000`、`post_name = product_code` | 確認済 |
| PHP内部のDB更新先 | WordPress投稿テーブル/カスタム投稿/メタ/ターム関係のどれを直接更新しているか | 未回収 |
| 認証/アクセス制限 | GAS側からは認証ヘッダー無しでPOSTしているように見える。PHP側でIP制限や秘密値検証があるか不明 | 推測/未回収 |

## 現行の危険箇所

| 危険箇所 | 内容 | 影響 |
|---|---|---|
| PHPソース未回収 | `generate.php` / `Settings.php` がまだ見えていない | 反映停止・切替・互換出力の設計で抜けが出る |
| 無認証POSTに見える | GAS側コードでは認証ヘッダーや署名を付けていない | PHP側も無検証なら、URLを知る第三者から誤更新されるリスク |
| 店舗名の大阪丸め | `大阪*` がすべて `大阪` へ変換される | 店舗粒度を新サイトへ正しく引き継げない可能性 |
| シート全行一括送信 | `ネットショップ商品一覧` の全データ行を毎回送る構造 | データ量増加時の処理時間/失敗時影響が大きい |
| 文字列化payload | すべて `String(item)` で送る | 日付/数値/空欄の型揺れをPHP側で吸収している可能性があり、互換再実装で事故りやすい |
| マスタ三重管理 | `ルール` シート、GAS配列、PHP `Settings.php` にカテゴリ/メーカー定義が分散 | どれか1箇所だけ更新するとサイト表示と商品コードがずれる |

## 新システムで置き換えるべき点

| 現行 | 新システム案 |
|---|---|
| `sendHttpPost()` → `generate.php` 一括POST | `products.json` 生成、または認証付き商品同期API |
| `Settings.php` 手更新カテゴリ | `設定マスタ` / `category_master` / `site_category_map` の単一管理 |
| WordPress投稿/taxonomy前提 | 非WordPressの商品API/静的JSON/DBモデル |
| 無認証に見える反映口 | OAuth/署名/APIキー/IP制限などを明示した管理API |
| 全行文字列payload | 差分同期 + 型付きJSONスキーマ |
| `大阪` 丸め | 店舗コード/拠点IDを正として保持し、表示名変換はフロント側で行う |

## 今回新たに確定したこと

- GAS側のサイト反映入口と送信データ構造は確定した。
- PHPソースは、この環境のGitHubコネクタ・公開GitHub URL・ローカルOneDrive控えからは回収できなかった。

## まだ未確定のこと

- `generate.php` / `Settings.php` の実コード
- PHP側の認証/アクセス制限、WordPress DB/投稿更新処理、カテゴリ設定構造
- `Wordpress用csv` と `sendHttpPost()` の運用上の主従関係

## 次に設計へ進める項目

- `products.json` や新商品同期APIの入力構造は、少なくとも現行GAS送信payloadを包摂できる形で設計できる。
- PHPソース未回収でも、WordPress依存を新出力層へ隔離する方針は進められる。

## 次の一手

1. サーバー上または別PCにある `strongdepot-product-manager` のPHPソース一式を回収する。
2. `generate.php` の入力/更新/レスポンス仕様と、`Settings.php` のカテゴリ配列を読み、`docs/wordpress-dependencies.md` を確定版へ寄せる。
3. PHP側が無認証なら、並行運用期間中の誤更新防止策を先に設計する。

## すぐ実装着手できる候補

- `generate.php` 入力payloadと `products.json` の差分マッピング表
- `Settings.php` 入手後のカテゴリ差分比較表テンプレート
