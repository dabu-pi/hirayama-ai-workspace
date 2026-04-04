# 設定マスタ seed データ メモ

## 今回作ったもの

- `data/seeds/settings_store.csv`
- `data/seeds/settings_maker.csv`
- `data/seeds/settings_part.csv`
- `data/seeds/settings_condition.csv`
- `data/seeds/settings_category.csv`

## seed の役割

現行商品マスタの表記を、v0 の内部コード・表示名・旧コードへ正規化するための参照テーブルとして使う。

## 列の考え方

| 列 | 役割 |
|---|---|
| `code` | v0内部コード |
| `display_name` | シート表示に使う名称 |
| `site_label` | サイト表示名。空なら `display_name` を使う |
| `legacy_code` | `sd_product_code` 分解/照合や現行値移行で使う旧コード |
| `legacy_value` | 現行シート側の表記 |
| `aliases` | 表記ゆれの吸収候補。`|` 区切り |
| `sort_order` | 表示順 |
| `is_active` | 今後の候補表示制御用 |
| `remarks` | 表記ゆれや暫定判断のメモ |

## 今回の暫定判断

- `ルール` タブの現行値を seed に広げ、店舗/メーカー/部位/状態/カテゴリの大半は機械変換できる状態に寄せた
- メーカー旧コード `MC`, `OT`, `LF`, `HS`, `BM`, `IG`, `PB` は重複例として残し、lenient検証では warning にする
- 部位「その他」は `AT` に正規化
- 現行ルール上の「部位空欄」は `AT` 扱いなので、変換時は空欄を `AT=その他` に寄せる
- 旧ネック空コード確認用に `settings_part.csv` へ `NECK` 行を残し、`legacy_code` を空欄許容にしている
- サンプル変換で未登録メーカーを残せるよう、`UNKNOWN_MAKER` の fallback を許容する
- `HOIST=HT` は実データ監査で見つかったため seed に追加した

## まだ実データ確認が必要な点

- 空欄メーカー20件、空欄カテゴリ11件、空欄店舗3件を「許容欠損」と見るか「要補完」と見るか
- `EVERLAST`, `LEGENDFITNESS`, `PT` を seed に追加するか、旧例外のまま残すか
- `KOMATSU=KT`, `UESAKA=US` のように `ルール` 表と実商品コードがずれている旧コードを seed に昇格させるか
- `OT` など旧コード重複の実例と、strict運用へ切り替える境界
- `is_active=false` をどの画面/出力で除外するか
## 2026-04-05 phase5B 再実行での補正

- `settings_maker.csv` に `EVERLAST` を追加した
- `settings_maker.csv` に `LEGENDFITNESS` を追加した
- `settings_maker.csv` の `POWERTECH` に `PT` alias を付与し、raw値 `PT` を seed で吸収するようにした

## 2026-04-05 時点で seed に入れなかった値

- メーカー空欄 20件: 自動補完せず warning のまま残した
- 店舗空欄 3件: `UNREGISTERED_STORE` のまま残した
- 店舗値 `売却済み` 1件: 店舗seedへは入れず、入力誤り候補として保留
- カテゴリ空欄 11件: `uncategorized` fallback と warning のまま残した

## 旧コード互換の扱い

- `KT` / `US` は seed 追加ではなく、`sd_product_code` lenient で既存データ互換 warning として扱う
- `EVERLAST` の既存コード `EL`、`LEGENDFITNESS` の既存コード `IV` も、validator 側で expected maker に対する warning として扱う
