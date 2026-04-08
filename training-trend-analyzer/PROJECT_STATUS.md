# PROJECT_STATUS.md

最終更新: 2026-04-08

## 現在地

Phase 4 の入口として、Google Trends を補完する軽量ソース `google_suggest` の初版を追加しました。

直近で完了している主要項目:

- alias 拡充の保守フロー整備
- Google Trends collector の live / mock / auto 運用
- `google_trends_interest` の初期安定化
- Google Suggest collector 初版
- `source_metrics` と `run_batch.py` への接続確認

## プロジェクト境界

今回の作業対象は `C:\hirayama-ai-workspace\workspace\training-trend-analyzer` 配下のみです。

今回変更した領域:

- `config/`
- `data/mock/google_suggest/`
- `docs/`
- `scripts/`
- `src/collectors/`
- `src/scorer/`
- `tests/`
- `README.md`
- `PROJECT_STATUS.md`

触っていない領域:

- `C:\hirayama-ai-workspace\workspace\scripts`
- `C:\hirayama-ai-workspace\workspace\docs`
- `C:\hirayama-ai-workspace\workspace\config`
- 他プロジェクト配下すべて

混在していない根拠:

- collector / fixture / score / docs / tests をすべて当該プロジェクト配下に配置
- import 先 DB も `training-trend-analyzer/data/db/trend.db` のみを使用

## 完了済み

### Google Trends

- `pytrends==4.9.2` と `urllib3<2` を requirements へ整理
- live / mock / auto の挙動を CLI と docs に反映
- live 成功と fail-safe artifact を確認
- `google_trends_interest` に軽量補助指標としての安定化を追加

### Google Suggest

- `src/collectors/google_suggest.py` を追加
- `scripts/run_google_suggest.py` を追加
- `data/mock/google_suggest/jp_seed_fixture.json` を追加
- live / mock 両対応で raw / observation / import-ready を出力
- `search_suggest_count` と `search_suggest_presence` を import 可能化
- `search_suggest_count` を低ウェイトで ranking に接続

### scoring / ranking

- `config/score_weights.json` に `search_suggest_count` を追加
- `calculator.py` に `min_value` 対応を追加
- 軽量検索系 metric だけで前週比較を作らない change suppression を維持
- `run_batch.py` で metric 除外比較と寄与明細確認を継続利用

## 直近の重要判断

- Google Suggest は Google Trends の代替ではなく、低ウェイト補助指標として扱う
- 初版は model seed のみ import-ready に流し、category / compare は ranking に入れない
- query と完全一致する suggestion は count しない
- `search_suggest_presence` は import しても score には使わない
- `search_suggest_count` は `min_value=2` と低 weight で過大評価を抑える
- Google Suggest endpoint は軽量利用に留め、仕様変更前提で mock fixture を維持する

## テスト状況

実行済み:

- `python -m pytest tests/test_normalizer.py tests/test_google_trends_collector.py tests/test_google_suggest_collector.py tests/test_score_calculator.py -q`
  - 結果: `26 passed`
- `python scripts/run_google_suggest.py --mode live --seed-id concept2_skierg_model --seed-id technogym_run_model --max-seeds 2`
  - 結果: `mode_used=live`, `observations=39`, `import_rows=4`, error 0
- `python scripts/run_google_suggest.py --mode mock --max-seeds 4`
  - 結果: `observations=28`, `import_rows=8`, error 0
- `python scripts/run_google_suggest.py --mode mock --max-seeds 4 --import-db --replace-existing`
  - 結果: 8 行 import
- `python scripts/check_source_metrics.py --source-name google_suggest`
  - 結果: `source_metrics` に 8 行を確認
- `python scripts/run_batch.py --use-db --week 2026-04-06 --only-commercial --show-metric-details`
  - 結果: Google Suggest を含む ranking を確認
- `python scripts/run_batch.py --use-db --week 2026-04-06 --only-commercial --exclude-metric search_suggest_count`
  - 結果: Suggest 除外時の比較を確認

## 残課題

- Google Suggest は非公式 endpoint 依存なので、仕様変更時の fallback 設計が今後必要
- live seed によって suggestion 0 件や偏りが出やすく、seed 設計の見直し余地がある
- `search_suggest_presence` の活用はまだ raw / import 保持段階で、score 反映は未実施
- compare seed / category seed の raw 活用ルールは今後整理が必要

## 次アクション

1. Google Suggest と相性の良い第 3 ソースを 1 本選び、同じ seed 群で小さく接続する
2. Google Suggest seed を 0 件が続きにくい model 中心に整理する
3. 検索系軽量ソースの複合寄与を score detail に見やすく出す
