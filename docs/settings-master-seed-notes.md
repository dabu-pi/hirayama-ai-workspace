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
| `label` | サイト表示・シート表示に使う名称 |
| `legacy_code` | `sd_product_code` 分解/照合や現行値移行で使う旧コード |
| `legacy_label` | 現行シート側の表記 |
| `sort_order` | 表示順 |
| `is_active` | 今後の候補表示制御用 |
| `notes` | 表記ゆれや暫定判断のメモ |

## 今回の暫定判断

- メーカー旧コード `MC` は `MAXICAM` と `MUSCLE_CLAMP` の重複例として残し、lenient検証では warning にする
- 部位「その他」は `AT` に正規化
- 旧ネック空コード確認用に `settings_part.csv` へ `NECK` 行を残し、`legacy_code` を空欄許容にしている
- サンプル変換で未登録メーカーを残せるよう、`UNKNOWN_MAKER` の fallback を許容する

## まだ実データ確認が必要な点

- 店舗・メーカー・部位・カテゴリの全現行表記ゆれ
- `OT` など旧コード重複の実例と、strict運用へ切り替える境界
- `is_active=false` をどの画面/出力で除外するか
