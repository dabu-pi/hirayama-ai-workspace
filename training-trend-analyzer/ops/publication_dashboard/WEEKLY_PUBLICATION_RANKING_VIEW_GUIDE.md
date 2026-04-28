# Weekly Publication Ranking View Guide

このガイドは、週次 publication 運用ビューのうち、ランキング結果とその根拠を読むための説明です。

## この運用ビューで見えること

- 2026-04-06 週の publication gate が通ったか
- GT / GS / YT のソース充足が揃っているか
- ranking / compare の review、release、verify が完了しているか
- その週のランキング上位候補と、元ソースの値
- ランキングを読むときの注意点

## 正本と運用ビューの違い

このスプレッドシートは正本ではありません。

正本は引き続き repo / Markdown / `data/output/` / release ledger / `PROJECT_STATUS.md` です。Drive 上の Google Sheets と、このフォルダの CSV / xlsx は、ユーザーや運用担当者が状態を見やすくするための運用ビューです。

## ランキング結果シートの目的

`ランキング結果` は、対象週の ranking 結果を順位順に見るためのシートです。

1行 = 1機種です。順位、機種名、カテゴリ、総合スコア、GT / GS / YT の値、傾向コメント、公開向けひとこと、注意メモを並べます。

将来 Web 公開する場合は、このシートを下書きとして使い、上位数件を本文やカード表示に展開する想定です。

## 使っているソース

- GT: Google Trends
- GS: Google Suggest
- YT: YouTube Suggest

2026-04-06 週は commercial 対象 11モデルすべてで GT / GS / YT が揃い、coverage gate は通過しています。ただし、coverage gate 通過は「必要なソースが揃った」という意味であり、そのまま品質保証ではありません。

## 順位の考え方

このランキングは、複数の検索系シグナルをまとめて見た週次の参考指標です。

- 単一ソースだけの人気順位ではありません。
- 販売実績順位ではありません。
- 週ごとの動きや、上位候補の確認に向いています。
- 総合スコアが近い機種は、順位の差を強く言い切らない方が安全です。

## どう読むべきか

まず `ランキング結果` で上位候補を見ます。次に `ソース一覧` で、GT / GS / YT が揃っているか、低値や0値がないかを確認します。最後に `ランキングの見方` で、公開時に添える注意書きを確認します。

公開向けの表現では、上位機種を「参考指標で上位」「今週の候補」として扱い、販売実績や市場シェアの断定は避けます。

## 注意点

- coverage gate 通過 = そのまま品質保証ではありません。
- GTの低値 / 0値は signal quality に注意します。
- サジェスト系の値は検索語、表記ゆれ、一時的な話題性の影響を受けます。
- 変化率が N/A の場合は、前週データのサポート条件により抑制されています。
- 公開時には editorial review で、数値の弱さや0値を踏まえて表現を調整します。

## Web公開を意識した見せ方

Webで公開するなら、次の順で見せるのが自然です。

1. 今週の上位候補
2. 対象週
3. 使用ソース
4. 参考指標であり販売実績順位ではないこと
5. 低値 / 0値 / 一時的な話題性への注意

公開時の注記例:

- 本ランキングは、複数の検索系シグナルをもとに週次で整理した参考指標です。
- 販売実績順位ではありません。
- 公開時点のデータに基づくため、今後変動する可能性があります。

## 再開時に見る場所

1. `PROJECT_STATUS.md`
2. `ops/publication_dashboard/Weekly_Overview.csv`
3. `ops/publication_dashboard/Ranking_Result.csv`
4. `ops/publication_dashboard/Source_List.csv`
5. `data/output/publish_ready_YYYYMMDD.json`
6. `data/output/publication_handoff_*.json`

正本の状態判断は `PROJECT_STATUS.md` と `data/output/` の artifact に戻して確認します。
