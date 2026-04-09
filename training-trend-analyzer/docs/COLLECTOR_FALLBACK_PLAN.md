# COLLECTOR_FALLBACK_PLAN.md

最終更新: 2026-04-09

## 1. この文書の目的

この文書は、`training-trend-analyzer` の Phase 2 入口として、collector 障害時の degrade 方針を実装判断に使える形で固定するための正本です。

このプロジェクトの最終到達点は、次の 2 層で成り立ちます。

- 内部向け:
  AI が複数ソースから週次トレンド候補を自動収集・集計・比較し、中古トレーニングマシン等の仕入れ判断に使える参考材料を継続的に出せる状態
- 外部向け:
  review 済みで source health が確認された結果だけを使って、ジムオーナー、トレーニー、業界関係者向けに Web で継続発信できる状態

ただし現段階の主目的は、AI が無人で仕入れを確定することではありません。優先するのは、次の 4 点です。

- 人が仕入れ判断しやすい ranking / compare / 注意点 / 変化要因を安定出力すること
- source 障害が起きても、何が欠けていて何がまだ参考になるかを明示できること
- fixture と実 DB の両方で、CLI 出力の再現性と実運用妥当性を分担して確認できること
- degraded な内部状態を、そのまま通常品質の公開情報へ流さないこと

## 2. なぜ fallback 設計が必要か

- Google Suggest / YouTube Suggest は非公式 endpoint 依存で、仕様変更や応答形式変更の影響を受けやすい
- Google Trends も `pytrends` と upstream 挙動に依存し、rate limit / empty response / import 失敗が起こりうる
- ranking / compare は source 欠落を「需要ゼロ」や「変化なし」と誤認すると、人の review を誤誘導する
- 将来の Web 公開では、degraded な結果を通常品質として見せると、外部向け品質そのものが崩れる

fallback 設計の目的は、障害を隠すことではなく、障害時でも誤解しにくい参考情報を出し、公開に回してよい状態かどうかを判定できるようにすることです。

## 3. 最終到達点と非ゴール

### 最終到達点

AI が複数ソースから週次トレンド候補を自動収集・集計・比較し、

- 内部向けには仕入れ判断の参考材料を継続的に出せる
- 外部向けには health 確認済みのトレンド情報を継続発信できる

状態。

### 当面の主目的

人が仕入れ判断しやすい compare / ranking / 注意点 / 変化要因を、CLI で継続的かつ安定的に出力すること。

### 非ゴール

- AI が無人で仕入れを確定すること
- source 障害を黙って補完し、正常時と同じ意味に見せること
- 生の collector 出力や raw data をそのまま一般公開すること
- fallback 状態や欠損状態でも通常通りの公開品質を装うこと
- CSV に人間向け incident summary を大量に混ぜ込むこと

## 4. 対象 source / collector 一覧

| source | 役割 | 主依存 | 現在の位置づけ | 障害時の基本方針 |
|---|---|---|---|---|
| manual CSV | ベースデータ / 補完 | 手動投入、review 済みデータ | 安定した土台 | 取り込み失敗は import 側で止める |
| Google Trends | 基本の補助トレンド | `pytrends`, upstream response | ranking の基準寄り source | 欠落時は batch 全体に強く影響 |
| Google Suggest | 軽量な検索補助 signal | unofficial endpoint, JSON parse | compare / review 補助 | 欠落時は soft fail 寄り |
| YouTube Suggest | 第 3 の軽量補助 signal | unofficial endpoint, JSON parse | compare / review 補助 | 欠落時は soft fail 寄り |
| mock fixture | 回帰確認 / fallback 再現 | ローカル fixture | 再現性担保 | 実運用代替ではない |
| DB (`source_metrics`) | ranking / compare の入力 | import 完了済み metrics | 実行正本 | source 欠落の検知点でもある |

## 5. collector ごとの依存性と失敗パターン

### Google Trends

- 依存:
  `pytrends`, `urllib3<2`, Google Trends 側のレスポンス仕様
- 現在の挙動:
  `auto` では live を優先し、空結果や例外時に mock へ fallback する
- 想定失敗:
  - `pytrends` import 失敗
  - rate limit / timeout
  - seed 単位の no data
  - frame empty
  - week 集計結果が target 週に無い

### Google Suggest

- 依存:
  unofficial endpoint, `requests`, response JSON 形式
- 現在の挙動:
  `auto` では live を優先し、例外時や observation 0 件時に mock へ fallback する
- 想定失敗:
  - HTTP 失敗
  - JSON parse 不可
  - suggestion 配列の構造変更
  - query ごとの 0 件多発
  - seed ごとの partial failure

### YouTube Suggest

- 依存:
  unofficial endpoint, `ds=yt`, `client=firefox`, `requests`, response JSON 形式
- 現在の挙動:
  `auto` では live を優先し、例外時や observation 0 件時に mock へ fallback する
- 想定失敗:
  - HTTP 失敗
  - JSON parse 不可
  - YouTube 向け応答形式の変化
  - query ごとの 0 件多発
  - seed ごとの partial failure

## 6. 想定障害の分類

### A. 一時的失敗

例:
timeout, rate limit, transient network error

扱い:

- source 単位では soft fail
- collector は raw artifact と error を残す
- `auto` なら mock fallback を許可する

### B. 空データ

例:
live は成功したが observation 0 件、seed ごとに suggestion 0 件

扱い:

- seed 単位なら skip + warn
- source 全体で 0 件なら soft fail
- compare / ranking では「ゼロ需要」と同義に扱わない

### C. 仕様変更で parse 不可

例:
JSON 構造変更、field 欠落、payload 型変更

扱い:

- source 単位では soft fail 以上
- Suggest 系は mock fallback 候補
- GT が parse 不可なら batch 全体を止める寄り

### D. 一部 source のみ失敗

例:
GT はあるが GS が欠落、GS はあるが YT が欠落

扱い:

- ranking は継続可能
- compare は `review only`
- public layer には通常品質として渡さない

### E. 全体失敗

例:
DB 空、GT 欠落、全 source 0 件、collector artifact 自体が残らない

扱い:

- hard fail
- ranking / compare を通常出力しない
- public layer へは渡さない

## 7. system 全体としてどう振る舞うべきか

### 7.1 collector 層

collector は次を守る。

- raw artifact を極力残す
- `mode_requested`, `mode_used`, `errors`, `raw_payloads` を残す
- source 障害を silence しない
- seed / query 単位の失敗は、できるだけ source 全停止にしない

collector で止めるべきなのは、mock も live も使えず source artifact を再現できない場合です。

### 7.2 import / DB 層

import 時点では、source ごとの target 週 availability を後から判定できる状態を残す。

最低限必要な観点:

- target 週に source_metrics が入ったか
- sample_size があるか
- metadata / raw_input から provenance を追えるか
- source ごとに row 数が極端に落ちていないか

### 7.3 ranking 層

ranking は source 欠落時でも機械的に止めるのではなく、次の 3 段階で扱う。

| 状態 | 条件 | ranking 扱い | public への扱い |
|---|---|---|---|
| `ok` | GT が target 週にあり、補助 source も概ね利用可能 | 通常出力してよい | review 後に公開候補 |
| `review_only` | GT はあるが、GS / YT 欠落や metadata 欠損がある | 出力はしてよいが参考情報扱いに落とす | 通常公開しない |
| `blocked` | GT 欠落、全 source 欠落、DB 読み出し不能 | batch 全体を止める | 公開不可 |

初期運用の暫定判断基準:

- `参考可`:
  GT が target 週に存在し、少なくとも 1 本の補助 source が生きている
- `要注意`:
  GT はあるが、GS または YT のどちらかが source 単位で欠落している
- `review only`:
  GT はあるが、補助 source が両方欠落、または metadata / sample_size 欠損が目立つ
- `参考不可`:
  GT が無い、または全 source が target 週で欠落している

補足:
この閾値は Phase 2 の運用ルールであり、Phase 3 以降に coverage 実測に合わせて調整する。

### 7.4 compare 層

`--compare-source-sets` は source availability に敏感なので、ranking より厳しく扱う。

原則:

- GT 欠落時:
  compare は hard fail
- GS または YT が source 単位で欠落:
  compare 表は必要なら出してよいが `review only` 表示に落とす
- GS と YT が両方欠落:
  compare summary は出さない、または「比較不能」として skip する

重要な解釈ルール:

- source 欠落を `+0.0` や `変化なし` と同義に見せない
- compare significant summary 3 行契約は維持するが、health / degraded 情報は別行で出す
- source 欠落時の compare は「review 補助」までで、公開用比較トレンドの根拠には使わない

### 7.5 publication 層

将来の Web 公開では、internal layer の結果をそのまま出さず、次のルールを守る。

- `ok` かつ review 済みの run だけを通常公開候補にする
- `review_only` は内部 review 向けに留め、通常の公開記事や週報には使わない
- `blocked` は公開しない
- fallback が使われた週は、公開するなら注意表示か保留判断を付ける

公開対象、公開内容、公開品質ゲートの詳細は `docs/WEB_PUBLICATION_PLAN.md` を参照する。

## 8. hard fail / soft fail / skip / warn の判断基準

| 判定 | 代表例 | batch の扱い | console | CSV | public |
|---|---|---|---|---|---|
| hard fail | DB 読み出し不能、GT 欠落、全 source 欠落 | 停止 | `[ERROR]` を出す | 通常 CSV は出さない | 公開不可 |
| soft fail | GS 全欠落、YT 全欠落、source parse 失敗、mock fallback | 継続可だが `review only` | `[WARN]` と health 行を出す | row data は出してよいが summary 行は入れない | 通常公開しない |
| skip | seed 無し、query ごと 0 件、non-model seed | 一部行だけ除外 | 必要なら seed warn | CSV は通常どおり | 直接影響しない |
| warn | sample_size 欠損、metadata 欠損、partial source failure | 継続 | `[WARN]` を出す | 事故説明は sidecar 優先 | 注意表示または保留 |

## 9. source 欠落時の具体判断

### 9.1 どの失敗は batch 全体を止めるべきか

- `run_batch.py --use-db` で DB 自体が読めない
- target 週に `google_trends_interest` が 0 行
- target 週に全 source の usable metric が無い
- compare 実行時に GT が無い

### 9.2 どの失敗は source 単位 warning で継続すべきか

- Google Suggest のみ欠落
- YouTube Suggest のみ欠落
- seed / query 単位の partial failure
- mock fallback が使われた
- sample_size / metadata の一部欠損

### 9.3 source 欠落時に ranking を出してよいか

- GT あり + GS/YT の片方欠落:
  ranking は出してよいが `review only`
- GT あり + GS/YT 両方欠落:
  GT ベース ranking は出してよいが、compare / tuning 根拠としては弱いので `review only`
- GT 欠落:
  ranking を通常出力しない

### 9.4 compare-source-sets 時に source 欠落がある場合

- GS 欠落:
  `GT only` と `GT + GS` の差分は解釈を誤りやすいので、compare は `review only`
- YT 欠落:
  `GT + GS + YT` の差分は実質 unavailable なので、compare は `review only`
- GS/YT 両方欠落:
  compare summary を通常 evidence として出さない

将来実装では、compare の先頭に source health 行を出し、degraded state を明示する。

## 10. support / sample_size / metadata の最低限の扱い

このプロジェクトでは、value だけでなく provenance が重要である。

初期方針:

- `sample_size` 欠損:
  hard fail にはしないが confidence 低下として warn する
- `metadata` 欠損:
  hard fail にはしないが source health 上は不完全として扱う
- GT で `sample_size` / `metadata` 欠損が広範囲:
  `review only`
- GS / YT で `sample_size` / `metadata` 欠損:
  ranking は継続可、compare は `review only` 寄り

将来実装では、source health 判定用に次の集計を持つ。

- `metric_rows`
- `missing_sample_size_rows`
- `missing_metadata_rows`
- `mode_used`
- `error_count`
- `fallback_used`

## 11. console 出力 / CSV 出力 / 公開品質のルール

### console に載せるべきもの

- source health 要約
- `ok / review_only / blocked` の実行判定
- fallback の有無
- compare 実行時は source 欠落による解釈制限

想定イメージ:

```text
[HEALTH] GT=ok GS=missing YT=ok
[HEALTH] ranking_status=review_only compare_status=review_only
[HEALTH] note=google_suggest missing for target week; compare deltas are advisory only
```

既存の compare review summary 3 行は維持し、その前段に health 行を出す。

### CSV に載せるべきもの

- 行データ中心を維持する
- summary 行や長文 incident 説明は混ぜない
- 障害情報は sidecar JSON / Markdown / console で持つのを優先する

許容される最小追加情報:

- `is_review_only`
- `data_health`
- `source_availability`

ただし Phase 2 では、まず console / artifact で持ち、CSV の肥大化は避ける。

### 公開品質で守るべきこと

- `review_only` や fallback 多発の週は、通常の公開品質と見せない
- 注意表示が必要な run は、その情報を publish-ready artifact に引き継げるようにする
- public layer は raw CSV ではなく、review と source health を通した要約レイヤを使う

## 12. review 時に人が誤解しないための表示ルール

- source 欠落を「人気が落ちた」「変化が無い」と読める形で出さない
- compare の `+0.0 / -0.0` 表示抑制は維持するが、欠落 source まで neutral に見せない
- `review only` 状態では、仕入れ判断の根拠ではなく追加確認の入口として扱う
- public layer には `review only` を通常品質として流さない
- console summary は人間向け、CSV は downstream 用という責務分離を崩さない

## 13. fixture / regression と実 DB 確認の役割分担

### fixture / regression で担保するもの

- source 全欠落時の degrade 表示
- partial failure 時の warning-only 継続
- compare summary 3 行固定を崩さないこと
- source 欠落時でも CSV に summary 行が混ざらないこと
- rank shift / tie-break / compare review 表示の再現

### 実 DB で見るもの

- target 週に source ごとの row 数がどう変化したか
- source 欠落や偏りが本当に起きているか
- ranking / compare の解釈が実運用で妥当か
- endpoint 変更や rate limit が collector artifact にどう現れるか

原則:

- fixture は CLI 回帰と failure pattern の再現用
- 実 DB は運用妥当性確認用
- どちらか片方だけでは不十分

## 14. 今後実装すべき fallback 優先順位

1. source health の共通スキーマを決める
   collector artifact / import 後 / run_batch / publication layer で同じ語彙を使えるようにする
2. collector failure fixture を追加する
   GS 全欠落、YT 全欠落、partial failure、metadata 欠損を再現する
3. `run_batch.py` に health summary の表示フックを入れる
   compare summary の外側に health 行を出す
4. `review only` / `blocked` 判定を run 単位で持つ
   ranking / compare が source 欠落を黙って neutral に見せないようにする
5. CSV とは別に sidecar status artifact を追加する
   障害情報を CSV 本体に混ぜず、publication layer にも引き継げるようにする

## 15. 次の具体アクション

1. collector / import / run_batch をまたぐ `source health` の最小データ構造を設計する
2. GS / YT の source-wide failure と partial failure を再現する fixture / pytest を足す
3. `run_batch.py` の console に health 行を入れる最小改修案を作る
4. 実 DB の target 週で source row 数と metadata 欠損率を確認し、`review only` 判定の暫定閾値を見直す
5. `docs/WEB_PUBLICATION_PLAN.md` に publish-ready artifact の最小要件を接続する
