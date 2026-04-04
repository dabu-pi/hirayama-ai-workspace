# 設定マスタ v0 設計

## 目的

現行で `ルール` シート、商品一覧GASの配列、PHP `Settings.php` に分散している分類・コード定義を、新システムでは設定マスタへ集約する。  
商品マスタには表示名ではなく内部コードを保存し、表示ラベルや旧値互換は設定マスタ側で管理する。

## 基本列

| 列名 | 型 | 必須 | 内容 |
|---|---|---|---|
| `master_type` | string | 必須 | マスタ種別。例: `store`, `maker`, `part`, `condition`, `category`, `publish_status` |
| `code` | string | 必須 | 新システム内部コード。商品マスタが参照する正本コード |
| `display_name` | string | 必須 | 管理画面・サイト・見積で表示する標準ラベル |
| `legacy_value` | string | 任意 | 現行シート入力値や旧コードの互換値。例: `大阪本部`, `OO`, `中古`, `is_used` |
| `legacy_code` | string | 任意 | 現行 `sd_product_code` 生成で使われる旧コード片。新旧コードを分けたい場合に保持 |
| `canonical_key` | string | 任意 | slug/検索/内部統合用の安定キー。例: `osaka-hq`, `cybex`, `leg` |
| `site_label` | string | 任意 | サイト表示で `display_name` と別名にしたい場合のラベル |
| `aliases` | string | 任意 | 旧表記ゆれ。カンマ区切りまたはJSON配列文字列 |
| `validation_rule` | string | 任意 | 許容長、正規表現、コード生成可否などの補助ルール |
| `sort_order` | number | 必須 | プルダウンやサイト表示順 |
| `is_active` | boolean | 必須 | 新規入力で選択可能かどうか |
| `remarks` | string | 任意 | 補足、旧データ例外、統合メモ |

## マスタ種別一覧

| マスタ種別 | 主な用途 | 現行の由来 | 新システムでの用途 | 備考 |
|---|---|---|---|---|
| 店舗マスタ | `store_code`, 店舗表示, 商品コード生成 | `ルール` シート `店舗`, GAS `shops` | 商品マスタ入力、サイト表示、商品コード検証 | 現行 `大阪` 丸め込みをやめ、店舗コードで正規化する |
| メーカーマスタ | `maker_code`, メーカー表示, 商品コード生成 | `ルール` シート `メーカー名`, GAS `makers` | 商品マスタ入力、サイト検索、競合突合、商品コード検証 | `MC` 衝突や長さ例外を明示管理する |
| 部位マスタ | `part_code`, 部位表示, 商品コード生成 | `ルール` シート `鍛える部位`, GAS `bodyParts` | 商品マスタ入力、サイト絞り込み、商品コード検証 | `首` の旧コード空欄例外を互換値として保持する |
| 状態マスタ | `condition_code`, 売却済み判定 | `ルール` シート `状態`, GAS `productStatus` | 商品マスタ入力、公開判定補助、サイトバッジ表示 | `売却済み` と `非公開` を別概念として扱う |
| カテゴリマスタ | `category_code`, サイト分類 | `ルール` シート `トレーニングマシンの種類`, GAS `machines`, PHP categories（未回収） | 商品マスタ入力、サイトナビ/絞り込み、JSONカテゴリ | WordPress taxonomy 名ではなく独立コードで定義する |
| 公開状態マスタ | `publish_status` の許容値 | `公開状態`, GAS `postStatus` | 商品の公開/非公開/下書き/売却済み掲載方針を統一 | WordPress `private/publish` をそのまま正本にしない |

---

## 1. 店舗マスタ

| code | display_name | legacy_value | legacy_code | site_label | remarks |
|---|---|---|---|---|---|
| `OO` | 大阪本部 | 大阪本部 | `OO` | 大阪 | 現行GASは `店舗` に大阪を含むと `大阪` へ丸めるため、表示名と検索ラベルを分離する |
| `OK` | 大阪粉浜 | 大阪粉浜 | `OK` | 大阪粉浜 |  |
| `OI` | 大阪今里 | 大阪今里 | `OI` | 大阪今里 |  |
| `OY` | 大阪山下 | 大阪山下 | `OY` | 大阪山下 |  |
| `SA` | 埼玉 | 埼玉 | `SA` | 埼玉 |  |
| `MI` | 三重 | 三重 | `MI` | 三重 |  |
| `HY` | 兵庫 | 兵庫 | `HY` | 兵庫 |  |
| `HN` | 兵庫西脇 | 兵庫西脇 | `HN` | 兵庫西脇 |  |
| `YA` | 山口 | 山口 | `YA` | 山口 |  |
| `EH` | 愛媛 | 愛媛 | `EH` | 愛媛 |  |
| `KU` | 熊本 | 熊本 | `KU` | 熊本 |  |
| `MD` | メーカー直送 | メーカー直送 | `MD` | メーカー直送 | 仕入年コード `MD` と同名なので、型ごとに区別する |
| `AT` | 未設定 | 空欄 | `AT` | 未設定 | 旧データ互換用。新規入力では原則選ばせない |

---

## 2. メーカーマスタ

## 基本方針

| 論点 | 方針 |
|---|---|
| 内部コード | 新規には短すぎる2文字固定へこだわらず、衝突しない `canonical_key` を併用する |
| 旧コード互換 | `sd_product_code` 維持のため `legacy_code` に現行メーカーコード片を保持する |
| 表記ゆれ | `aliases` に `HAMMER`, `HAMMER STRENGTH`, `HAMMER ST` など旧入力値を寄せる |
| 衝突例外 | 現行 `MAXICAM` と `MUSCLE CLAMP` の `MC` 衝突は、`legacy_code` 衝突として明示し、新規商品コード採番時は追加ルールが必要 |
| 長さ例外 | `HOISUT`, `KOMATSU` など2文字超の旧コードを許容するが、分解パーサは固定長前提にしない |

## サンプル行

| code | display_name | legacy_value | legacy_code | canonical_key | aliases | remarks |
|---|---|---|---|---|---|---|
| `CYBEX` | CYBEX | CYBEX | `CY` | `cybex` |  |  |
| `ICARIAN` | ICARIAN | ICARIAN | `IC` | `icarian` |  |  |
| `HAMMER_STRENGTH` | HAMMER STRENGTH | HAMMER STRENGTH | `HS` | `hammer-strength` | HAMMER,HAMMER ST | 旧表記ゆれを吸収 |
| `MAXICAM` | MAXICAM | MAXICAM | `MC` | `maxicam` |  | `MC` 衝突あり |
| `MUSCLE_CLAMP` | MUSCLE CLAMP | MUSCLE CLAMP | `MC` | `muscle-clamp` |  | `MC` 衝突あり。新規採番では要注意 |
| `UNKNOWN_MAKER` | 未設定 | 空欄 | `OT` | `unknown-maker` |  | 旧データ互換用。新規入力では原則禁止 |

---

## 3. 部位マスタ

| code | display_name | legacy_value | legacy_code | canonical_key | remarks |
|---|---|---|---|---|---|
| `NECK` | 首 | 首 | `` | `neck` | 現行 `sd_product_code` では空コード例外。新規内部コードは必ず非空にする |
| `CH` | 胸 | 胸 | `CH` | `chest` |  |
| `BK` | 背中 | 背中 | `BK` | `back` |  |
| `AM` | 腕 | 腕 | `AM` | `arm` |  |
| `SH` | 肩 | 肩 | `SH` | `shoulder` |  |
| `AB` | 腹 | 腹 | `AB` | `abdominal` |  |
| `LG` | 脚 | 脚 | `LG` | `leg` |  |
| `HP` | 尻 | 尻 | `HP` | `hip` |  |
| `AT` | その他 | その他 | `AT` | `other` | マルチ/有酸素運動も旧コード `AT` へ寄っているため、カテゴリ側との併用が必要 |
| `BI` | 備品 | 備品 | `BI` | `item` |  |

---

## 4. 状態マスタ

| code | display_name | legacy_value | legacy_code | site_label | remarks |
|---|---|---|---|---|---|
| `brandnew` | 新品 | 新品 | `is_brandnew` | 新品 | 現行 WordPress カテゴリ文字列は `status,brandnew` |
| `used` | 中古 | 中古 | `is_used` | 中古 |  |
| `exhibit` | 展示品 | 展示品,展示 | `is_exhibit` | 展示品 |  |
| `unused` | 未使用品 | 未使用,未使用品 | `is_unused` | 未使用品 |  |
| `refurbish` | リファービッシュ品 | リファービッシュ品,リファービッシュ |  | リファービッシュ品 | 現行 `product_status` が空欄になる例外あり |
| `prevmodel` | 旧モデル品 | 旧モデル品,旧モデル | `is_prevmodel` | 旧モデル品 |  |
| `sold` | 売却済み | 売却,売却済み,売却済 | `is_sold` | 売却済み | 公開状態とは別概念として扱う |
| `unknown` | 未設定 | 空欄 |  | 未設定 | 旧データ互換用 |

---

## 5. カテゴリマスタ

| code | display_name | legacy_value | legacy_code | canonical_key | remarks |
|---|---|---|---|---|---|
| `strength_machine` | ストレングスマシン | ストレングスマシン | 現行 `machines` の分類値 | `strength-machine` | 現行 `tax_products-category` の `trainingmachine,*` を置換する分類 |
| `free_weight` | フリーウェイト | フリーウェイト | 現行 `machines` の分類値 | `free-weight` |  |
| `cardio` | 有酸素マシン | 有酸素マシン | 現行 `machines` の分類値 | `cardio` |  |
| `accessory` | 備品/アクセサリ | 備品 | 現行 `machines` の分類値 | `accessory` |  |
| `other_category` | その他 | その他 | 現行 `machines` の分類値 | `other` | 旧分類が曖昧な行の受け皿 |

注意: 現行 `ルール` シートと GAS `machines` 配列の完全一覧は、未回収の PHP `Settings.php` と突合した後で確定版へ更新する。上表は v0 設計上の型と責務を示すサンプルであり、値の最終一覧は追記対象。

---

## 6. 公開状態マスタ

| code | display_name | legacy_value | legacy_code | remarks |
|---|---|---|---|---|
| `public` | 公開 | 空欄 | `publish` | 現行GASでは空欄が publish 扱い |
| `private` | 非公開 | 非公開 | `private` | 現行 WordPress `private` の置換 |
| `draft` | 下書き |  |  | 新システム側で追加する運用状態 |
| `sold_visible` | 売却済み掲載 | 売却済み |  | 売却済みでも実績として掲載したい場合に使う。`condition_code=sold` と併用 |

---

## 設定マスタ運用ルール

| ルール | 内容 |
|---|---|
| 新規商品入力 | 商品マスタでは表示名の自由入力ではなく、設定マスタの `code` を選ばせる |
| 旧データ移行 | 現行列の値は `legacy_value` / `legacy_code` で突合し、該当がなければ `要確認` として止める |
| 非アクティブ化 | 過去互換のため行は残し、`is_active=false` で新規選択だけ止める |
| 衝突対応 | 同じ `legacy_code` が複数マスタ行に割り当たる場合は、採番ルール側で曖昧性をエラーにする |
| 表示名変更 | 表示名を変えても `code` は原則変更しない |
| WordPress依存隔離 | `legacy_wp_slug` のような旧サイト都合の値が必要でも、商品マスタではなく設定マスタまたは `legacy_*` 列に閉じ込める |
