# DASHBOARD_RESTART_CUE.md — ダッシュボード作業 再開キュー

> このファイルは「次回のAIセッションがここから**迷わず再開できる**」ことを唯一の目的とする。
> セッションをまたぐたびに更新する。
>
> 最終更新: 2026-03-08（Phase 1 構造タスク全完了・Run_Log 習慣化フェーズへ）

---

## 現在の完成度

| 観点 | 完成度 | 根拠 |
|---|---|---|
| 設計 | **95%** | 7ファイル整備済み・設計書と実体の整合確認済み。Dashboard 完全自動参照の詳細確認のみ残る |
| 実装 | **95%** | Phase 1 構造タスク全完了（7/7）。ドロップダウン検証・KPIヘッダー・Lists 整合すべて完了 |
| 自動化 | **10%** | Metrics の数式集計のみ。GAS 未接続（Phase 2 で対応） |
| 運用準備 | **75%** | Run_Log 記録開始（習慣化中・2026-03-08〜）。手動更新フロー稼働中 |
| **総合** | **約85%** | Phase 1 残り: Run_Log 2週間継続（〜2026-03-22）→ 完了宣言のみ |

---

## 今わかっていること（確認済みの事実）

| カテゴリ | 内容 |
|---|---|
| スプレッドシート | 「Hirayama_AI_OS_Dashboard」として実体あり。7シート全て確認済み |
| Dashboard | KPI表示（Total:6・InProgress:2・AvgProgress: 更新済み・OpenTasks:10）動作中。参照方式は確認済み（詳細は未確認として残す） |
| Lists | 列ヘッダー整合済み（2026-03-08）。A=status / B=phase / C=type / D=system / E=assigned_to / F=task_status / G=task_type / H=priority / I=idea_status |
| Projects | **6件** 入力済み（freee / 柔整GAS / 患者Webアプリ / 接骨院戦略 / 廃棄物 / AIOS-06）。**ドロップダウン検証（Type/Status/Phase）設定済み（2026-03-08）** |
| Ideas | 7件入力済み（Planned 3件 / Idea 3件 / Parked 1件） |
| Task_Queue | 10件（Pending 7件 / Waiting 2件 / In Progress 1件）。**ドロップダウン検証（Project/Type/Priority/Status/Assigned To）設定済み（2026-03-08）** |
| Run_Log | **2026-03-08 記録追加済み（Phase 1 手修正内容）**。習慣化開始。自動書き込みなし（GAS 未接続） |
| Metrics | 「200%」誤り修正済み。**業績KPI 行ヘッダー追加済み（A13:Business KPI〜A19:Profit）**（2026-03-08）。数値入力は 4月以降 |
| ローカルファイル | ai-os/ 配下の7ファイル整備済み |

---

## 未解決事項

| # | 項目 | 確認方法 |
|---|---|---|
| ❓ 1 | Dashboard の各表示が**完全自動参照か、一部手入力か** | Dashboard シートの各セルを選択して数式バーを確認 |

> ドロップダウン検証（❓ 2）は **2026-03-08 に解消済み**。Projects・Task_Queue ともに設定完了。

---

## 次にやるべき 5手（Phase 1 終盤 → Phase 2 入口）

> Phase 1 構造タスク（1-1〜1-7）は全て完了（2026-03-08）。
> 残りは Run_Log 継続習慣化のみ。2週間後 Phase 1 完了宣言 → Phase 2 へ。

| 順 | 作業 | 場所 | 所要時間 | 担当 |
|---|---|---|---|---|
| **1** | Run_Log を 2週間継続（毎セッション 1行・〜2026-03-22） | スプレッドシート | 毎セッション5分 | 人間 |
| **2** | 2週間継続後 Phase 1 完了宣言 → PROJECT_STATUS.md・ROADMAP を更新 | ローカルファイル | 15分 | Claude |
| **3** | Phase 2 入口: GAS スクリプト設計草案（Run_Log 自動追記仕様）を作成 | ローカルファイル | 30分 | Claude |
| **4** | Dashboard シートの数式参照（QUERY/FILTER）動作確認 — 余裕があれば | スプレッドシート | 10分 | 人間（任意） |
| **5** | Phase 2 GAS 実装・単体テスト（設計承認後） | ローカル + スプレッドシート | 数時間 | Claude + 人間 |

---

## 関連ファイル一覧

| ファイル | 場所 | 役割 |
|---|---|---|
| `DASHBOARD_MASTER_PLAN.md` | `ai-os/` | 全体設計・役割分担・完成条件（マスタードキュメント） |
| `DASHBOARD_ROADMAP.md` | `ai-os/` | フェーズ別ロードマップ・今週やること・STOP条件 |
| `DASHBOARD_RESTART_CUE.md` | `ai-os/`（このファイル） | 再開キュー・現在地・次の5手 |
| `PROJECT_STATUS.md` | `ai-os/` | AI OS 全体の進捗トラッキング（AIセッション引き継ぎ用） |
| `dashboard-schema.md` | `ai-os/` | 7シートの詳細スキーマ定義 |
| `spec.md` | `ai-os/` | Hirayama AI OS システム仕様 |
| `README.md` | `ai-os/` | 概要・ナビゲーション |
| スプレッドシート | Google Drive | ダッシュボード実体（Dashboard シート: gid=409389399） |

---

## 再開合図

```
「ダッシュボード Phase 1 終盤 / Run_Log 習慣化フェーズ」

現在地: Hirayama AI OS / Phase 1 構造タスク全完了・Run_Log 習慣化中
完成度: 約85%（総合）

Phase 1 完了済み構造タスク（全7項目）:
  ✅ 1-1 Metrics 200%誤り修正
  ✅ 1-2 Lists 列ヘッダー整合（A=status〜I=idea_status）
  ✅ 1-3 AIOS-06 を Projects に追加（6件体制）
  ✅ 1-4 Dashboard 参照方式確認
  ✅ 1-5 Projects / Task_Queue ドロップダウン検証設定
  ✅ 1-6 Run_Log 記録開始（2026-03-08〜）
  ✅ 1-7 Metrics 業績KPI 行ヘッダー追加（A13〜A19）

残る一手:
  🔄 Run_Log 2週間継続（〜2026-03-22）→ Phase 1 完了宣言
  ❓ Dashboard 完全自動参照かどうか（詳細未確認・任意）

次の節目: 2026-03-22 頃 Phase 1 完了宣言 → Phase 2 GAS 設計着手

関連ファイル: workspace/ai-os/ 配下の7ファイルを参照
```

---

## 次回 Claude への指示テンプレ

```
C:\hirayama-ai-workspace\workspace を前提に作業を再開してください。

【現在地】
Hirayama AI OS ダッシュボード / Phase 1 終盤・Run_Log 習慣化フェーズ（完成度 約85%）

DASHBOARD_RESTART_CUE.md（workspace/ai-os/）に現在地・未解決事項・次の5手が記録されています。

【前提】
- スプレッドシートは実体あり。7シート全て整備済み（ドロップダウン検証・Metrics KPIヘッダー含む）
- ローカル設計書は ai-os/ 配下の7ファイル
- Phase 1 構造タスク（1-1〜1-7）は全て完了済み。再確認不要
- Run_Log 継続習慣化中（2026-03-08〜。2週間継続後 Phase 1 完了宣言へ）
- 作業開始前に必ず DASHBOARD_RESTART_CUE.md を読む

【前提として残る未確認事項】
- Dashboard の各表示が完全自動参照か、一部手入力か（任意確認）
- GAS 連携は未実装（Phase 2 で対応）

【今回やってほしいこと】
（ここに具体的な作業内容を入力）

【重要ルール】
- ai-os/ 外のソースコードは変更しない
- スプレッドシート本体の大幅修正は事前承認を得てから
- 変更は最小限・ログ重視・再現性重視
- 未確認事項は断定せず「未確認」と書く
- 作業完了後は DASHBOARD_RESTART_CUE.md の「次にやるべき5手」を更新する
```
