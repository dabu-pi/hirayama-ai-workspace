# SPEC.md

最終更新: 2026-04-08

## 概要

このプロジェクトは、トレーニング機器の trend signal を複数ソースから収集し、過敏に振れにくいランキングへ接続することを目的とします。

Phase 4 入口時点では、手動 CSV に加えて次を扱います。

- Google Trends
- Google Suggest
- YouTube Suggest
- review / unresolved を使った alias 保守フロー

## 機能要件

### F-01 収集

| ID | 要件 | 状態 |
|---|---|---|
| F-01-1 | 手動 CSV を `source_metrics` に取り込める | 完了 |
| F-01-2 | collector は raw artifact を保持する | 完了 |
| F-01-3 | Google Trends collector を提供する | 完了 |
| F-01-4 | Google Suggest collector を提供する | 完了 |
| F-01-5 | YouTube Suggest collector を提供する | 完了 |
| F-01-6 | live 実行できない環境でも mock fixture で再確認できる | 完了 |
| F-01-7 | `auto` モードで live 失敗時に fallback できる | Google Trends / YouTube Suggest は完了、Google Suggest は将来拡張余地あり |

### F-02 正規化

| ID | 要件 | 状態 |
|---|---|---|
| F-02-1 | brand / model / category を canonical に寄せる | 完了 |
| F-02-2 | brand hint 付き model 解決を維持する | 完了 |
| F-02-3 | review / unresolved を記録する | 完了 |
| F-02-4 | review から alias 候補を保守的に抽出する | 完了 |
| F-02-5 | 低信頼 alias を別管理する | 完了 |
| F-02-6 | alias 追加根拠を Markdown / review summary に残す | 完了 |

### F-03 取り込み

| ID | 要件 | 状態 |
|---|---|---|
| F-03-1 | `source_metrics` を import batch 単位で追跡できる | 完了 |
| F-03-2 | raw JSON / observation CSV / import-ready CSV を残す | 完了 |
| F-03-3 | duplicate を避けやすい再投入手段を持つ | 完了 |
| F-03-4 | 取得失敗時も artifact を残す | 完了 |
| F-03-5 | category / compare seed の raw と model import を分離する | 完了 |

### F-04 scoring / ranking

| ID | 要件 | 状態 |
|---|---|---|
| F-04-1 | `run_batch.py` で DB 由来ランキングを生成できる | 完了 |
| F-04-2 | `google_trends_interest` を安定化しながら使える | 完了 |
| F-04-3 | `search_suggest_count` を補助指標として使える | 完了 |
| F-04-4 | `youtube_suggest_count` を補助指標として使える | 完了 |
| F-04-5 | commercial / discontinued フィルタと整合する | 検証済み |
| F-04-6 | metric を含める / 除く比較ができる | 完了 |
| F-04-7 | source / metric ごとの寄与を後から追える | 完了 |
| F-04-8 | `GT only / GT + GS / GT + GS + YT` の 3 パターン比較を 1 コマンドで見られる | 完了 |
| F-04-9 | 3 パターン比較で `GS:+x.x / YT:+y.y` の短い差分要約を表示し、`0.0` 差分は省略、console の raw delta 列も丸め後ゼロは `-` 表示にする | 完了 |

## 非機能要件

| ID | 要件 |
|---|---|
| NF-01 | 他プロジェクトや共通ディレクトリと混在しない |
| NF-02 | 少数 seed で安全に回し、大量 query は後回しにする |
| NF-03 | network / rate limit / endpoint 変更で全体が壊れない |
| NF-04 | raw を残し、再投入と再計算の再現性を持つ |
| NF-05 | alias は増やしすぎず、曖昧語は review / 保留へ送る |
| NF-06 | Google Trends / Google Suggest / YouTube Suggest を絶対需要の代理値として扱わない |

## ソース仕様

### Google Trends

- metric: `google_trends_interest`
- 性質: 相対指数
- live 前提: `pytrends==4.9.2`, `urllib3<2`
- 取り扱い:
  - model seed のみ import-ready に流す
  - category / compare seed は raw 保持まで
  - ranking では低ウェイト、最小観測条件、平滑化、cap、change suppression を適用

### Google Suggest

- metric:
  - `search_suggest_count`
  - `search_suggest_presence`
- 性質: query に対して suggestion が返るかと、その件数の軽量信号
- live 前提:
  - 少数 query のみ
  - unofficial endpoint 依存
  - mock fixture を常に維持
- 取り扱い:
  - 初版は model seed のみ import-ready に流す
  - ranking には `search_suggest_count` だけを低ウェイトで使用
  - `search_suggest_presence` は raw / import 保持のみ
  - query 文字列と完全一致する suggestion は count しない

### YouTube Suggest

- metric:
  - `youtube_suggest_count`
  - `youtube_suggest_presence`
- 性質: YouTube 検索補完から得る軽量な動画文脈 signal
- live 前提:
  - 少数 query のみ
  - unofficial endpoint 依存
  - `ds=yt` + `client=firefox`
  - mock fixture を常に維持
- 取り扱い:
  - 初版は model seed のみ import-ready に流す
  - ranking には `youtube_suggest_count` だけをさらに低ウェイトで使用
  - `youtube_suggest_presence` は raw / import 保持のみ
  - query 文字列と完全一致する suggestion は count しない

## metric 安定化方針

### `google_trends_interest`

- base weight を軽めにする
- `min_models`, `min_observation_weeks`, `min_query_terms` を要求する
- 直近値を前週値と平滑化する
- normalized contribution に cap をかける
- 前週支持が軽量検索系だけなら `change_rate` を抑止する

### `search_suggest_count`

- Google Trends よりさらに軽い補助指標として扱う
- `min_query_terms` と `min_value` を要求する
- normalized contribution に低い cap をかける
- weight を小さくして、GT 単独の揺れを少し補正する程度に留める

### `youtube_suggest_count`

- Google Suggest よりさらに軽い第 3 補助指標として扱う
- `min_query_terms` と `min_value` を要求する
- `contribution_scale` と `norm_cap` を Google Suggest より低くする
- 動画レビュー文脈を少し拾う程度に留め、順位の大きな押し上げには使わない

## 今回の制約

- 大量 seed 展開はしない
- compare seed の本格利用は後回し
- 非公式 endpoint に強く依存しすぎない
- Google / YouTube Suggest を単体の人気スコアとして扱わない

## 次アクション

1. 検索系 3 ソースの寄与差分を見やすくする
2. seed 設計を source ごとに見直し、0 件が続きやすい query を減らす
3. compare seed の raw 解釈レイヤを別途設計する
