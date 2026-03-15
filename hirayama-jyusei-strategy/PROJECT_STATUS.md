# PROJECT_STATUS.md

最終更新: 2026-03-15

## 現在地

- JBIZ-04 の KPI シート群の役割分離と入力設計の整合まで完了
- 毎日記録ver3.1 から JBIZ-04 へ渡す月次7項目の転記先と月末運用手順の文書整理まで完了
- live 本体への反映と warning-only 保護の適用まで完了
- live 手入力値を local へ pull 同期する仕組みまで完了
- live 各シート右側へ「このシートの役割」説明と、保険売上参照整理メモを反映完了
- 今後のシート説明追記は、個別スクリプト追加ではなく共通方式 + config を優先する方針に整理
- 3案比較結果を反映し、基準仮説を案C・到達目標を案Aに更新
- 次は未確定数値を埋めて月次運用に入る段階

## 完了済み

- `価格設定` に `主力手技フラグ` を追加し、列位置を `K/L/M/N` に整理
- `KPI逆算` と `KPI目標` の役割分離をローカル定義へ反映
- `月次総保険売上` へ用語統一
- `IMPLEMENTATION_LINK.md` に月次7項目の `集計元 / 計算ルール / 手入力or将来自動化 / JBIZ-04転記先` と月末運用手順を追記
- `主力手技価格` を主力手技フラグ参照へ変更
- `保険・来院前提` シートを追加し、`数値前提` と役割分離
- `KPI実績履歴` と `KPI逆算履歴` の定義を追加
- `全体ダッシュボード` の優先表示項目を `KPI逆算` 基準へ整理
- live 反映用スクリプト `scripts/apply-hirayama-kpi-live-update.mjs` を追加
- 入力セル / 自動計算セル / 固定説明 / 仮値 / 警告 の色分け方針を追加
- live 本体へ入力セル色分け、短い入力メモ、主要セルの warning-only 保護を反映
- live 追記:
  `全体ダッシュボード!I2:I5`
  `ロードマップ進捗!K2:K5`
  `保険・来院前提!I2:I5`
  `保険・来院前提!I8:I15`
  `数値前提!I2:I5`
  `価格設定!P2:P5`
  `KPI目標!I2:I5`
  `未確定項目!L2:L5`
- `scripts/apply-hirayama-input-design.mjs` を追加
- `scripts/sync-hirayama-inputs.mjs` と `scripts/hirayama-input-sync-config.mjs` を追加
- live の手入力値を `hirayama-jyusei-strategy/data/inputs_snapshot.json` へ保存する pull 同期方針を追加
- dry-run と通常実行で live 手入力値の snapshot 保存を確認
- live 仮値入力:
  `総保険売上単価=1,200円`
  `慢性候補率=40%`
  `慢性患者移行率=50%`
  `手技患者1人あたり月平均来院回数=3.5回`
  `手技自費再来率=50%`
  `ジム体験誘導率=10%`
  `主力手技50分=5,500円`
- 基準仮説 / 到達目標:
  `基準仮説=案C（50% / 3.5回 / 5,500円）`
  `到達目標=案A（50% / 4.0回 / 5,000円）`
- 仮値入力後の主要KPI:
  `月次総保険売上=150,000円`
  `慢性候補人数=20人`
  `手技患者数=10人`
  `手技回数=35回`
  `見込み自費売上=192,500円`
  `必要手技回数=37回`
  `必要手技回数/日=1.5回`
  `目標差額=7,500円`
  `ジム体験人数=1.0人`

## 検証状況

- `node --check hirayama-jyusei-strategy/gas_spreadsheet_setup.js` 実施済み
- `node --check scripts/apply-hirayama-kpi-live-update.mjs` 実施済み
- `node --check scripts/apply-hirayama-input-design.mjs` 実施済み
- `node --check scripts/sync-hirayama-inputs.mjs` 実施済み
- live 本体 ID `1FnJdALwFSv48WiD6NWr0DzG78kwB692R2pFeiTcZlCc` から `hirayama-jyusei-strategy/data/inputs_snapshot.json` への同期を確認
- 検証用シート ID `1gRo1RZgcWpUS4bLFdfTAVKzAzkaI6T1UzNZhl5_2rho` で以下を確認済み
- `TRUE 1件`: `価格設定` 警告 = `OK` / `KPI逆算` 警告 = `OK`
- `TRUE 0件`: 両シートで警告表示
- `TRUE 複数件`: 両シートで警告表示
- 再構築後の主要シート一覧:
  `全体ダッシュボード / ロードマップ進捗 / 保険・来院前提 / 数値前提 / 価格設定 / KPI逆算 / KPI目標 / KPI実績履歴 / KPI逆算履歴 / 未確定項目`
- live 本体 ID `1FnJdALwFSv48WiD6NWr0DzG78kwB692R2pFeiTcZlCc` で入力設計を反映済み
- live 本体で役割説明と保険売上参照整理メモの表示を確認済み
- live 確認:
  `価格設定!B18 = OK`
  `KPI逆算!C7 = OK`
  `保険・来院前提!B10 = 黄`
  `価格設定!G12 = 青`
  `KPI逆算!C20 = 黄`
  `KPI目標!D5 = 青`

## live 反映状況

- live 本体 `平山接骨院 慢性疼痛強化プロジェクト 管理表`
  ID: `1FnJdALwFSv48WiD6NWr0DzG78kwB692R2pFeiTcZlCc`
- 書き込みに使用したアカウント:
  `sheets-api-access@gym-appointment-app.iam.gserviceaccount.com`
- 更新前バックアップ:
  `1oaAuqdNIHT00xj5GxoSAcVNqpp8LH_aNn4bBGhRfS0A`

## 次アクション

1. `主力手技価格 / 慢性患者移行率 / 手技患者1人あたり月平均来院回数` を正式確定する
2. `総保険売上単価` を入力して `月次総保険売上` を実値に寄せる
3. `KPI目標` の実績入力を 1 か月回して、`手技自費患者数 / 手技回数 / 次回予約あり件数` の固定転記セルを増やすべきか判断する

## 保留事項

- 主力手技50分の正式価格
- 慢性患者移行率
- 手技患者1人あたり月平均来院回数
- 慢性候補率
- 手技自費再来率
- ジム体験誘導率
- ジム会員価格

## 直近の重要判断

- `KPI逆算` は設計用、`KPI目標` は当月管理用、`KPI実績履歴` は月次保存用、`KPI逆算履歴` は前提変更履歴用に固定
- 主力手技価格参照は行固定ではなく `主力手技フラグ` 参照を維持
- 基準仮説は案C（50% / 3.5回 / 5,500円）、到達目標は案A（50% / 4.0回 / 5,000円）に固定
- 案Cと目標差額 7,500円 は `手技回数 +2回/月 / 月平均来院回数微増 / 移行率微増` で埋める候補を残す
- 高額機器前提の自費メニューは将来検討扱いのまま維持
