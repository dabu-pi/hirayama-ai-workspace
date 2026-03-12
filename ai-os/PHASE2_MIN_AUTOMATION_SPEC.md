# PHASE2_MIN_AUTOMATION_SPEC.md — ai-os Phase 2 最小自動化仕様

最終更新: 2026-03-12

---

## 目的

Hirayama AI OS ダッシュボードの `Run_Log` を、手動で続けられない問題を解消するために、
まずは **作業終了時に貼り付け用の 1 行データを自動生成する** ところから始める。

この段階では、Google スプレッドシートへの直接書き込みは行わない。
認証情報や接続方式が未確定でも運用改善できる最小単位を優先する。

---

## Phase 2 初期スコープ

対象:

- `scripts/dev-end.ps1` 実行後に Run_Log 用のデータを自動生成する
- JSON と TSV の2形式で保存する
- 画面に貼り付け用の行を表示する

対象外:

- Google スプレッドシートへの自動書き込み
- `Task_Queue` / `Projects` への自動更新
- KPI 分析やサマリ生成

---

## 出力先

ローカルファイル:

- `logs/runlog/runlog_YYYYMMDD_HHmmss.json`
- `logs/runlog/runlog_YYYYMMDD_HHmmss.tsv`

用途:

- JSON は将来の自動連携用
- TSV は `Run_Log` シートへ手貼りするときの即用データ

---

## 生成項目

| 項目 | 内容 |
|---|---|
| `datetime` | 実行日時 |
| `project_id` | 対象プロジェクトID |
| `summary` | 作業要約（基本はコミットメッセージ） |
| `result` | `SUCCESS` / `STOP` / `ERROR` / `PARTIAL` |
| `commit_hash` | 直近コミット短縮ハッシュ |
| `next_action` | 次の作業 1 行 |
| `branch` | 現在ブランチ |
| `source` | `dev-end.ps1` 固定 |

---

## project_id の決め方

`dev-end.ps1` 実行位置から推定する。

| パス | project_id |
|---|---|
| `ai-os/` | `AIOS-06` |
| `freee-automation/` | `FREEE-02` |
| `gas-projects/jyu-gas-ver3.1/` | `GAS-01` |
| `patient-management/` | `WEB-03` |
| `hirayama-jyusei-strategy/` | `STR-04` |
| その他 | `COMMON` |

必要なら `-ProjectId` で明示指定できるようにする。

---

## 実行フロー

1. `dev-end.ps1` でコミット・push を実行
2. 成功時のみ Run_Log 用エントリを生成
3. `logs/runlog/` に JSON / TSV を保存
4. 画面に保存先と貼り付け用 1 行を表示する

---

## この方式を選ぶ理由

- スプレッドシート認証が未整備でもすぐ始められる
- `Run_Log` の記録漏れを減らせる
- 将来、GAS や API 連携に切り替えるときも JSON を再利用できる
- 初期自動化の書き込み先をローカルファイルに限定でき、安全性が高い

---

## 次の段階

この最小自動化が運用に乗ったら、次に検討する。

1. TSV をクリップボードへ自動コピー
2. スプレッドシート Web App / GAS への自動送信
3. `Task_Queue` / `Projects` の補助更新
