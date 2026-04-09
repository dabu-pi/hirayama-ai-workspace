# ROADMAP.md

最終更新: 2026-04-09

## 1. このプロジェクトの意図

`training-trend-analyzer` は、トレーニング機器の trend signal を複数ソースから集め、少数ソースでも過敏に振れにくい ranking と review 補助を CLI で回せるようにするための分析基盤です。

狙いは「派手な公開サイトを先に作ること」ではなく、まず次を安定させることです。

- 手動 CSV と collector の両方から `source_metrics` へ安全に投入できる
- normalizer で brand / model / category を保守的に canonical 化できる
- `run_batch.py` で ranking と compare を人が判断しやすい形で見られる
- fixture と実 DB の両方で回帰確認できる

## 2. 何を作るプロジェクトか

このプロジェクトで作るものは、次の 5 層です。

1. 収集層
   手動 CSV、Google Trends、Google Suggest、YouTube Suggest を raw / observation / import-ready に落とす。
2. 正規化層
   brand / model / category の canonical 化、review / unresolved / alias 候補管理を行う。
3. scoring / ranking 層
   `ScoreCalculator` と `run_batch.py` で score / compare / review summary を生成する。
4. review 補助層
   compare 表、significant-only、`top drivers`、`largest impact`、rank shift の見え方を整える。
5. regression 層
   helper pytest、CLI fixture pytest、実 DB CLI 確認で「壊れていない」を担保する。

## 3. 成功条件

### 最終到達点

次を満たした状態を、このプロジェクトの実務上の成功とみなします。

- collector が live / mock / fallback を含めて週次運用できる
- ranking / compare が CLI で安定して読める
- compare の人間向け summary と CSV の責務が明確に分かれている
- 実 DB 確認と fixture 回帰確認の両方で、主要な壊れ方を検知できる
- seed / weight / threshold の改善が、場当たりではなく compare evidence に基づいて進められる
- 将来的な定期実行に必要なログ、失敗時方針、確認手順が整理されている

### CLI 運用の完成ライン

少なくとも次が安定していることを、CLI 運用の完成ラインとします。

- `run_batch.py --use-db --week ...` で ranking を出せる
- `run_batch.py --compare-source-sets` で 3 ソース比較を出せる
- `--compare-only-significant` で tuning 対象だけを絞れる
- compare summary は常に 3 行固定で出る
- compare CSV に summary 行が混ざらない
- fixture と実 DB の両方で回帰確認できる

## 4. 非ゴール

現時点では次をこのロードマップの主目的にしません。

- 公開サイトや課金機能の早期実装
- 多数の外部ソース追加そのもの
- ML による高機能な正規化
- リアルタイム収集
- source 単独の人気スコア化

これらは将来候補としては残しますが、いまの優先順位ではありません。

## 5. 現在地（2026-04-09）

現在は「Phase 1 完了、Phase 2 入口」とみなします。

完了済みの中核:

- manual CSV import
- normalizer / review / unresolved / alias 候補整理
- Google Trends collector
- Google Suggest collector
- YouTube Suggest collector
- `run_batch.py` による ranking と 3 ソース compare
- significant-only compare
- review summary 3 行固定
- compare helper 分離
- compare CLI fixture
- helper pytest + integration 寄り pytest

まだ未完了の中核:

- 非公式 endpoint 依存に対する fallback 設計
- seed 設計の見直し
- weight / threshold / support 条件の改善
- compare での寄与明細の読みやすさ強化
- 定期実行前提の運用設計

## 6. 主要機能の関係

### collectors / ranking / compare / review / regression の関係

- collectors:
  raw signal を集めて `source_metrics` に流す入口
- ranking:
  各 metric を conservative に score 化する本体
- compare:
  source set を切り替えて score 差分と rank path を横並び比較する層
- review 補助:
  `Impact`、`Hint`、`top drivers`、`largest impact` で tuning 対象を素早く絞る層
- fixture / regression:
  compare の見え方と抽出意図を、実 DB に依存せず固定する層

### 実 DB と fixture の役割分担

- 実 DB 確認:
  現在の運用データで ranking / compare が成立しているかを見る
- fixture 確認:
  rank shift、tie-break、summary 3 行固定、CSV 無汚染のような「出てほしい表示」を毎回再現する

原則:

- 実 DB は実運用妥当性の確認
- fixture は CLI 出力回帰の確認
- どちらか片方だけでは不十分

## 7. 残課題の整理

### A. 収集の安定性

- Google Suggest / YouTube Suggest は非公式 endpoint 依存
- fallback 設計がまだ弱い
- seed によって 0 件や偏りが出やすい

### B. ranking 品質

- `search_suggest_count` / `youtube_suggest_count` の重みと cap はまだ初期値
- compare seed / category seed の活用ルールが未整理
- threshold `0.5` の妥当性はまだ暫定

### C. review 補助

- compare は見やすくなったが、metric detail との接続はまだ薄い
- source weighting の改善をどの evidence で判断するか整理が必要

### D. 運用

- 定期実行の前提となる監視、ログ、再実行手順が未整理
- 「週次で何を見て、どの条件で調整するか」がまだ文書化不足

## 8. フェーズ構成

### Phase 1: compare / CLI 表示の安定化と回帰担保

目的:
CLI compare の見え方と抽出意図を固定する。

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

Phase 2 の入口文書:
`docs/COLLECTOR_FALLBACK_PLAN.md` を collector 障害時の degrade / fallback / review-only 判断の正本とする。

やること:

- Google Suggest fallback 方針の整理
- YouTube Suggest fallback 方針の整理
- live / mock / auto の責務統一
- error / raw artifact / retry 方針の明文化

Definition of Done:

- 失敗時の fallback 動作が collector ごとに文書化されている
- mock で再現できる failure pattern がある
- live 失敗でも ranking / compare 全体が止まりにくい

### Phase 3: ranking 品質改善

目的:
seed / weight / threshold / support 条件を compare evidence で改善する。

やること:

- seed 設計の見直し
- `search_suggest_count` / `youtube_suggest_count` の weight 調整
- threshold と significant 判定の見直し
- compare seed / category seed の扱い整理

Definition of Done:

- 何を見て weight を動かすかが compare evidence に基づいて説明できる
- 0 件が続く seed を減らせている
- tuning 前後を compare で比較しやすい

### Phase 4: review 運用・出力設計の強化

目的:
週次 review を人が迷わず回せるようにする。

やること:

- compare summary と metric detail の接続強化
- review 補助の出力粒度整理
- review 手順の定型化
- downstream 用 CSV / 人間向け console の責務をさらに明確化

Definition of Done:

- compare を見た人が「どの model をどう見直すか」を判断しやすい
- review 手順が Markdown で再開可能
- compare と ranking の出力責務が混線していない

### Phase 5: 自動実行前提の運用整備

目的:
手元実行中心から、週次バッチ前提の運用へ移す。

やること:

- 定期実行コマンドの確定
- ログ / artifact / 再実行手順の整理
- runbook 的な確認手順整備
- failure 時の停止条件と継続条件の整理

Definition of Done:

- 週次実行の標準コマンドが定まっている
- 失敗時に何を確認するか決まっている
- 別 PC / 別セッションでも運用再開できる

## 9. 開発優先順位

1. Phase 2
   collector fallback と failure handling
2. Phase 3
   seed / weight / threshold / support の改善
3. Phase 4
   review 補助と出力設計の強化
4. Phase 5
   定期実行と runbook 整備

理由:
compare の見え方はすでにかなり固まっているため、次は「壊れず回ること」と「改善判断ができること」を優先します。

## 10. 自動開発で進める際のルール

- まず `docs/ROADMAP.md`、次に `PROJECT_STATUS.md`、必要なら `SPEC.md` を読む
- compare / ranking / collectors / regression のどこを触る変更かを最初に明確にする
- compare 表示を変える変更では、helper pytest と CLI fixture pytest の両方を確認する
- collector を変える変更では、live / mock / fallback / raw artifact の責務を書き残す
- CSV と console の責務を混ぜない
- 実 DB の確認結果と fixture 回帰結果を分けて記録する
- weight / threshold を動かす場合は、変更理由を compare evidence と一緒に残す
- 途中でも再開価値があるなら `PROJECT_STATUS.md` を更新する

## 11. リスク / 不確実性 / 後回し論点

### 高リスク

- 非公式 endpoint の仕様変更
- source ごとの観測偏り
- support 条件不足での過大評価

### 中リスク

- compare の見え方が良くても ranking 品質が十分とは限らない
- fixture が CLI 回帰には強くても実運用妥当性は代替しない

### 後回しでよい論点

- 公開 UI / API 化
- 課金やユーザー機能
- 高度な季節調整や ML ベース正規化

## 12. 次の具体アクション

1. Google Suggest / YouTube Suggest の fallback 方針を文書化し、collector 側の失敗時挙動を整理する
2. `source health` の最小データ構造を決め、ranking / compare の `review only` 判定に接続する
3. `search_suggest_count` / `youtube_suggest_count` の tuning 候補を、fixture と実 DB の両方で比較できるようにする
4. 定期実行を見据えた最小 runbook を docs 化する

## 13. 文書の役割分担

- `docs/ROADMAP.md`
  開発順序、フェーズ、優先順位、DoD の正本
- `docs/COLLECTOR_FALLBACK_PLAN.md`
  collector 障害時の hard fail / soft fail / review-only 判断の正本
- `docs/SPEC.md`
  実装済み / 実装予定の仕様要件の正本
- `PROJECT_STATUS.md`
  直近作業、テスト結果、残課題、次アクションの正本
- `README.md`
  再開導線と使い方の入口
