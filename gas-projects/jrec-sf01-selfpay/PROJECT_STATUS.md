# PROJECT_STATUS.md — JREC-SF01 自費カルテ・会計システム

## 現在ステータス

**初期設計開始**（2026-04-27）

---

## 今回の作業内容（2026-04-27）

| 作業 | 内容 |
|---|---|
| フォルダー作成 | `gas-projects/jrec-sf01-selfpay/` を新規作成 |
| README.md 作成 | プロジェクト概要・JREC本体との違い・将来展開を記録 |
| PROJECT_STATUS.md 作成 | 本ファイル。進捗管理の起点 |
| 設計ドキュメント作成 | `docs/JREC-SF01_selfpay_chart_accounting_system_design_2026-04-27.md` |

---

## コード実装状態

- **現時点ではコード実装なし**
- GASコード（`.js`）は未作成
- `.clasp.json` は未作成
- スプレッドシートは未作成
- GASプロジェクトは未作成

---

## JREC本体への影響

- **影響なし**
- `jyu-gas-ver3.1/` には一切変更を加えていない
- 既存JRECの clasp 設定・push・保険請求ロジックへの変更はない

---

## Dashboard反映

- **Dashboard反映対象外**（JREC-SF01 専用の Dashboard は未作成）
- 将来フェーズで自費売上ダッシュボードを作成予定

---

## フェーズ別ロードマップ

| Phase | 内容 | ステータス |
|---|---|---|
| Phase 0 | 初期設計ドキュメント作成 | **完了（2026-04-27）** |
| Phase 1 | スプレッドシート設計 | 未着手 |
| Phase 2 | GAS Webアプリ最小入力画面 | 未着手 |
| Phase 3 | 自費カルテ保存 | 未着手 |
| Phase 4 | 自費会計・領収書 | 未着手 |
| Phase 5 | 自費売上集計 | 未着手 |
| Phase 6 | Next.js / Supabase 化検討 | 未着手 |
| Phase 7 | 外販モデル化 | 未着手 |

---

## 次フェーズ候補（Phase 1）

Phase 1 着手前に以下を確認・決定する。

- [ ] 自費スプレッドシートを新規作成する（保険JRECとは別）
- [ ] スプレッドシートIDを `docs/` または `Settings` シートで管理する方針を決める
- [ ] `hirayama-jyusei-strategy` の自費メニュー・価格設計を参照し `MenuMaster` シートの初期データを作る
- [ ] シート構成（Settings / Patients / SelfPayVisits / SelfPayChart / SelfPayItems / Payments / Receipts / MenuMaster / DailySales / Run_Log）を確定する
- [ ] 患者IDの採番方針を決める（`P0001` 形式、既存保険患者との関係）

---

## 変更履歴

| 日付 | 内容 |
|---|---|
| 2026-04-27 | プロジェクト初期設計ドキュメントを作成。コード実装なし。 |
