# PROJECT_STATUS.md

最終更新: 2026-04-08

## 現在地

Phase 4 の入口として、Google Trends / Google Suggest / YouTube Suggest の 3 ソース比較を見やすく出す差分サマリを追加しました。

直近で完了している主要項目:

- alias 拡充の保守フロー整備
- Google Trends collector の live / mock / auto 運用
- `google_trends_interest` の初期安定化
- Google Suggest collector 初版
- YouTube Suggest collector 初版
- `source_metrics` と `run_batch.py` への接続確認
- `run_batch.py` で 3 パターン比較を 1 コマンド表示できるようにした

## プロジェクト境界

今回の作業対象は `C:\hirayama-ai-workspace\workspace\training-trend-analyzer` 配下のみです。

今回変更した領域:

- `config/`
- `data/mock/google_suggest/`
- `data/mock/youtube_suggest/`
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

### YouTube Suggest

- `src/collectors/youtube_suggest.py` を追加
- `src/collectors/suggest_common.py` を追加
- `scripts/run_youtube_suggest.py` を追加
- `data/mock/youtube_suggest/jp_seed_fixture.json` を追加
- live / mock 両対応で raw / observation / import-ready を出力
- `youtube_suggest_count` と `youtube_suggest_presence` を import 可能化
- `youtube_suggest_count` を Google Suggest よりさらに低ウェイトで ranking に接続

### scoring / ranking

- `config/score_weights.json` に `search_suggest_count` を追加
- `config/score_weights.json` に `youtube_suggest_count` を追加
- `calculator.py` に `min_value` 対応を追加
- 軽量検索系 metric だけで前週比較を作らない change suppression を維持
- `run_batch.py` で metric 除外比較と寄与明細確認を継続利用
- `run_batch.py --compare-source-sets` を追加し、`GT only / GT + GS / GT + GS + YT` の score / delta / rank path を横並び表示
- 比較表に `GS:+x.x / YT:+y.y` の短い差分要約を追加し、`0.0` 差分は省略して source 差分の当たりを一目で追えるようにした
- console compare 表の raw delta 列も、丸め後ゼロなら `-` 表示にして視認性をそろえた

## 直近の重要判断

- Google Suggest は Google Trends の代替ではなく、低ウェイト補助指標として扱う
- YouTube Suggest も同様に補助寄与のみとし、Google Suggest よりさらに軽く扱う
- 初版は model seed のみ import-ready に流し、category / compare は ranking に入れない
- query と完全一致する suggestion は count しない
- `search_suggest_presence` は import しても score には使わない
- `youtube_suggest_presence` も import しても score には使わない
- `search_suggest_count` は `min_value=2` と低 weight で過大評価を抑える
- `youtube_suggest_count` は `weight=0.02`, `contribution_scale=0.35`, `norm_cap=0.35` でさらに抑制する
- YouTube Suggest は `ds=yt` を使うが、live JSON 取得のため `client=firefox` を採用する
- Suggest 系 endpoint は軽量利用に留め、仕様変更前提で mock fixture を維持する

## テスト状況

実行済み:

- `python -m py_compile src/collectors/suggest_common.py src/collectors/google_suggest.py src/collectors/youtube_suggest.py scripts/run_google_suggest.py scripts/run_youtube_suggest.py scripts/import_csv.py`
  - 結果: PASS
- pytest は利用中 interpreter に未導入だったため、collector / scorer のテスト関数を Python から直接呼び出して確認
  - 結果: `manual-tests-ok`
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
- `python scripts/run_youtube_suggest.py --mode live --seed-id concept2_skierg_model --seed-id technogym_run_model --max-seeds 2`
  - 結果: `mode_used=live`, `observations=31`, `import_rows=4`, error 0
- `python scripts/run_youtube_suggest.py --mode mock --max-seeds 4 --import-db --dry-run-import --replace-existing`
  - 結果: `observations=24`, `import_rows=8`, dry-run import 8 行 OK / rollback 済み
- `python scripts/run_youtube_suggest.py --mode mock --max-seeds 4 --import-db --replace-existing`
  - 結果: `observations=24`, `import_rows=8`, `source_metrics` へ 8 行 import
- `python scripts/check_source_metrics.py --source-name youtube_suggest --week 2026-04-06`
  - 結果: 8 行確認
- `python scripts/run_batch.py --use-db --week 2026-04-06 --only-commercial --show-metric-details --exclude-metric search_suggest_count --exclude-metric youtube_suggest_count`
  - 結果: GT 単独比較を確認
- `python scripts/run_batch.py --use-db --week 2026-04-06 --only-commercial --show-metric-details`
  - 結果: 3ソース比較を確認
- `python scripts/run_batch.py --use-db --week 2026-04-06 --only-commercial --compare-source-sets`
  - 結果: 3 パターン比較を 1 表で確認。`Why` 列の `0.0` 差分省略に加え、`d(GT->GS)` / `d(GS->3)` も丸め後ゼロは `-` で表示

## 残課題

- Google Suggest は非公式 endpoint 依存なので、仕様変更時の fallback 設計が今後必要
- YouTube Suggest も非公式 endpoint 依存なので、応答形式変更時の fallback 設計が必要
- live seed によって suggestion 0 件や偏りが出やすく、seed 設計の見直し余地がある
- `search_suggest_presence` の活用はまだ raw / import 保持段階で、score 反映は未実施
- `youtube_suggest_presence` の活用もまだ raw / import 保持段階で、score 反映は未実施
- compare seed / category seed の raw 活用ルールは今後整理が必要

## 次アクション

1. 比較表に寄与上位 metric の短い要約を添える
2. Google / YouTube Suggest seed を 0 件が続きにくい model 中心に整理する
3. 第 4 ソースを増やす前に、Suggest 系 fallback と監視の扱いを整理する
