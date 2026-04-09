# ROADMAP.md

最終更新: 2026-04-09

## 1. このプロジェクトの意図

`training-trend-analyzer` は、トレーニング機器の trend signal を複数ソースから収集し、過敏に振れにくい ranking / compare / review 補助へ接続するための基盤です。

このプロジェクトは、次の 2 層目的を持つものとして進めます。

- 内部向け目的:
  AI が複数ソースから週次トレンド候補を自動収集・比較し、中古トレーニングマシン等の仕入れ判断に使える参考情報を、継続的かつ安定的に出力すること
- 外部向け目的:
  ジムオーナー、トレーニー、業界関係者が市場トレンドや注目マシン動向を把握できるよう、Web で継続発信できる情報基盤を作ること

重要なのは、外部向け目的を「宣伝」ではなく「継続的にトレンドを発信できる品質基盤」として扱うことです。公開レイヤは、内部の ranking / compare / review / source health が安定していることを前提に構築します。

## 2. 何を作るプロジェクトか

このプロジェクトで作るものは、次の 7 層です。

1. 収集層
   手動 CSV、Google Trends、Google Suggest、YouTube Suggest から raw / observation / import-ready を残しながら収集する
2. 正規化層
   brand / model / category を保守的に canonical 化し、review / unresolved / alias を育てる
3. scoring / ranking 層
   複数 metric を conservative に score 化し、内部 review 向けランキングを出す
4. compare 層
   `GT only / GT + GS / GT + GS + YT` を横並びで比較し、差分や rank path を見られるようにする
5. review 補助層
   significant-only summary、Hint、Impact、source health、review-only 判定を使って人の判断を助ける
6. regression 層
   helper pytest、CLI fixture pytest、実 DB 確認で、表示と挙動の再現性を担保する
7. 公開接続層
   review 済みで health 判定を通った週次結果だけを、Web 向け公開情報に変換できるようにする

## 3. 成功条件

### 最終到達点

次を満たした状態を、このプロジェクトの最終到達点とみなします。

- 内部向けには、AI が複数ソースの週次変化を継続的に収集・比較し、仕入れ判断の参考に使える ranking / compare / review 補助を安定出力できる
- 外部向けには、review 済みで source health が確認された結果だけを使って、Web で継続的にトレンド情報を発信できる
- 内部向け出力と外部向け出力の境界が明確で、degraded な状態を通常品質として扱わない

### 内部向け成功条件

- collector が live / mock / fallback を含めて週次運用できる
- ranking / compare が CLI で安定して読める
- compare summary と CSV の責務が明確に分かれている
- fixture と実 DB の役割分担が明確で、回帰確認が再現できる
- source 欠落時に `ok / review_only / blocked` を判定できる

### 外部向け成功条件

- ジムオーナー、トレーニー、業界関係者向けに、週次の注目カテゴリや変化要因を継続発信できる
- 公開内容が raw data 直出しではなく、review 済みの要約情報になっている
- source health と fallback 状態を踏まえ、公開可否や注意表示を制御できる
- degraded / review-only の結果を、通常品質の公開情報として扱わない
- 内部 CLI / artifact から公開用レイヤへ再生成可能な形で接続できる

### 当面の主目的

いま優先するのは、内部向け判断支援の自動化です。具体的には、CLI 中心で ranking / compare / source health / review 補助を安定化し、将来の公開基盤へ渡せる品質の内部出力を作ることを主目的にします。

## 4. 非ゴール

現時点では次をこのロードマップの主目的にしません。

- AI が無人で仕入れを確定すること
- 生の collector 出力や raw data をそのまま一般公開すること
- fallback 状態や欠損状態でも通常通りの公開品質を装うこと
- 公開サイトや課金機能の早期実装そのもの
- 多数の外部ソース追加そのもの
- ML による高度な正規化やリアルタイム収集

## 5. 現在地（2026-04-09）

現在は「Phase 1 完了、Phase 2 入口」とみなします。

完了済みの中核:

- manual CSV import
- normalizer / review / unresolved / alias フロー
- Google Trends collector
- Google Suggest collector
- YouTube Suggest collector
- `run_batch.py` による ranking
- 3 ソース compare
- significant-only compare
- review summary 3 行固定
- compare helper 分離
- compare CLI fixture
- helper pytest と integration 寄り pytest
- `docs/COLLECTOR_FALLBACK_PLAN.md` による Phase 2 の方針固定

まだ未完了の中核:

- source health の実装
- review-only / blocked 判定の実装
- seed / weight / threshold / support の改善
- 公開向け出力レイヤの設計
- 定期運用と公開接続の runbook 整備

補足:
現在地はまだ内部基盤整備が中心です。外部向け Web 公開は将来フェーズの対象であり、いまは「公開に耐える内部品質を整える段階」です。

## 6. 主要機能の関係

### collectors / ranking / compare / review / regression / publication の関係

- collectors:
  raw signal を集めて `source_metrics` に接続する
- ranking:
  複数 metric を conservative に score 化する内部基盤
- compare:
  source set ごとの差分と rank path を見せる内部 review 用レイヤ
- review 補助:
  Hint、Impact、summary、source health で人の見始めを速くする層
- fixture / regression:
  compare 表示や failure pattern の再現性を担保する層
- publication:
  review 済み、health 確認済みの結果だけを外部向け要約へ変換する層

### 実 DB と fixture の役割分担

- 実 DB:
  実運用に近いデータで ranking / compare がどう見えるかを確認する
- fixture:
  rank shift、tie-break、summary 3 行固定、fallback 時の表示など、毎回は出ないケースを再現する

原則:

- 実 DB は妥当性確認
- fixture は回帰確認
- どちらか片方だけでは不十分

### 公開品質との関係

将来の Web 公開では、次がそのまま品質ゲートになります。

- ranking の安定性:
  公開する注目機種やカテゴリの土台
- compare / review 補助:
  週次の変化要因や比較トレンドの説明材料
- source health / fallback:
  公開可否、注意表示、暫定扱いの判断材料
- fixture / regression:
  同じ週次結果を再生成できる再現性の根拠

### 公開対象と公開内容

公開対象:

- ジムオーナー
- トレーニー
- 業界関係者

公開する想定の内容:

- 注目カテゴリ
- 伸びているマシン系統
- 比較トレンドの要約
- 週次の変化要因

公開しないもの:

- raw data や生の collector 出力
- source health 未確認の暫定値
- 内部仕入れ判断ロジックの全文

### CLI 中心の現状から Web 公開への接続

現状の主役は CLI です。将来の Web 公開は、次の流れで接続します。

1. collectors が raw / observation / import-ready を残す
2. ranking / compare / review 補助が内部向けの判断材料を作る
3. source health / fallback 判定で run の品質を判定する
4. reviewed / health-checked な結果だけを publish-ready artifact に変換する
5. Web 公開レイヤは publish-ready artifact だけを使う

## 7. 残課題の整理

### A. 収集の安定性

- Google Suggest / YouTube Suggest は非公式 endpoint 依存
- source failure の共通 health 表現が未実装
- 0 件が出やすい seed が残っている

### B. ranking 品質

- `search_suggest_count` / `youtube_suggest_count` の weight と cap の改善余地
- compare seed / category seed の扱い整理
- threshold `0.5` の妥当性検証

### C. review / 公開準備

- compare の見え方は改善したが、公開向けにどこまで要約するかは未設計
- source weighting 改善をどの evidence で説明するかが未整理
- internal output と public output の変換レイヤが未設計

### D. 運用

- source health を踏まえた run 単位判定が未実装
- 定期実行コマンド、artifact、runbook が未整備
- Web 公開に渡す publish-ready artifact の形が未確定

## 8. フェーズ構成

### Phase 1: compare / CLI 表示の安定化と回帰担保

目的:
CLI compare の見え方と再現性を固定する。

完了済み:

- compare helper 分離
- significant-only summary 3 行固定
- compare helper pytest
- compare CLI fixture
- integration 寄り pytest
- CSV 無汚染確認

Definition of Done:

- compare 表の主要出力が fixture で回帰確認できる
- rank shift が実 DB に無くても fixture で確認できる
- compare CSV に summary 行が混ざらない

### Phase 2: データ取得の安定性向上と fallback 設計

目的:
非公式 endpoint 依存の collector を、失敗しても壊れにくい運用へ寄せる。

入口文書:
`docs/COLLECTOR_FALLBACK_PLAN.md`

やること:

- Google Suggest / YouTube Suggest の fallback 方針整理
- live / mock / auto の責務統一
- source health の最小データ構造設計
- error / raw artifact / retry 方針の明文化

Definition of Done:

- 失敗時の fallback 動作が collector ごとに文書化されている
- mock で再現できる failure pattern がある
- ranking / compare を `ok / review_only / blocked` で整理できる

### Phase 3: ranking 品質改善

目的:
seed / weight / threshold / support を compare evidence に基づいて改善する。

やること:

- seed 設計見直し
- `search_suggest_count` / `youtube_suggest_count` の weight 調整
- threshold と significant 判定の見直し
- compare seed / category seed の扱い整理

Definition of Done:

- 何を見て weight を動かすかが compare evidence に基づいて説明できる
- 0 件が続く seed を減らせている
- tuning 前後を compare で比較しやすい

### Phase 4: review 運用・公開前提の出力設計

目的:
内部 review と将来の公開用要約を混同しない出力設計にする。

やること:

- compare summary と metric detail の接続強化
- review 補助の粒度整理
- internal output と publish-ready output の責務分離
- 公開向けに出してよい項目と出してはいけない項目の整理

Definition of Done:

- compare を見た人が「どの model をどう見直すか」を判断しやすい
- publish-ready に渡す出力が raw data 直出しではない
- compare と ranking と公開用要約の責務が混線していない

### Phase 5: 自動実行と Web 公開基盤への接続準備

目的:
手元 CLI 中心から、週次実行と Web 発信へ接続できる運用基盤へ移す。

やること:

- 定期実行コマンドの確定
- ログ / artifact / 再実行手順の整理
- source health / review-only に応じた公開可否ルール整理
- Web 公開に渡す publish-ready artifact の形式整理

Definition of Done:

- 週次実行の標準コマンドが定まっている
- 失敗時に何を確認するか決まっている
- reviewed / health-checked な週次結果を Web 公開レイヤへ渡せる
- degraded / review-only 結果を通常公開しないルールが固定されている

## 9. 開発優先順位

1. Phase 2
   collector fallback と source health
2. Phase 3
   seed / weight / threshold / support の改善
3. Phase 4
   review 補助と publish-ready 出力設計
4. Phase 5
   定期実行と Web 公開基盤接続

理由:
外部向け Web 公開を急ぐより先に、内部向けの基盤が「壊れず回ること」と「判断根拠が残ること」を優先します。公開品質は内部品質の上に乗るので、下位層を飛ばして進めない方針にします。

## 10. 自動開発で進める際のルール

- まず `docs/ROADMAP.md`、次に `PROJECT_STATUS.md`、必要なら `SPEC.md` を読む
- 変更が internal layer なのか publication layer なのかを最初に明示する
- compare / ranking / collectors / regression のどこを触る変更かを最初に明確にする
- compare 表示を変える変更では helper pytest と CLI fixture pytest の両方を確認する
- collector を変える変更では live / mock / fallback / raw artifact の責務を書き残す
- CSV と console の責務を混ぜない
- 実 DB の確認結果と fixture 回帰結果を分けて記録する
- public output は reviewed / health-checked な内部結果からのみ派生させる
- degraded / review-only の結果を通常品質の公開情報として扱わない
- 途中でも再開価値があるなら `PROJECT_STATUS.md` を更新する

## 11. リスク / 不確実性 / 後回し論点

### 高リスク

- 非公式 endpoint の仕様変更
- source ごとの観測偏り
- support 情報不足による過信

### 中リスク

- compare の見え方は良くても ranking 品質が追いつかない可能性
- fixture は回帰用であり、公開妥当性そのものは保証しない
- publish-ready 出力の粒度を詰める前に Web 実装へ進んでしまうこと

### 後回しでよい論点

- 公開 UI / API の実装
- ユーザー課金やメディア機能
- 高度な季節調整や ML ベース正規化

## 12. 次の具体アクション

1. `docs/COLLECTOR_FALLBACK_PLAN.md` に沿って `source health` の最小データ構造を決める
2. GS / YT の source-wide failure と partial failure を再現する fixture / pytest 方針を固める
3. `search_suggest_count` / `youtube_suggest_count` の tuning 候補を、fixture と実 DB の両方で比較できるようにする
4. publish-ready output の最小要件を `docs/WEB_PUBLICATION_PLAN.md` に整理する

## 13. 文書の役割分担

- `docs/ROADMAP.md`
  優先順位、フェーズ、DoD、内部向けと外部向けの全体構造の正本
- `docs/COLLECTOR_FALLBACK_PLAN.md`
  collector 障害時の hard fail / soft fail / review-only 判断の正本
- `docs/WEB_PUBLICATION_PLAN.md`
  公開対象、公開内容、非公開内容、公開品質ゲートの正本
- `docs/SPEC.md`
  実装済み / 実装予定の仕様要件の正本
- `PROJECT_STATUS.md`
  直近作業、テスト結果、残課題、次アクションの正本
- `README.md`
  再開導線と使い方の入口
