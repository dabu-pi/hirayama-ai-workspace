# workspace NEXT_ACTIONS.md

> workspace 配下 12 repo の「次にやること」を 1 ファイルで見るためのインデックス。
> 各 repo の詳細は当該 repo 内の `PROJECT_STATUS.md` / `NEXT_ACTIONS.md` / `ROADMAP.md` を参照。
>
> 初版: 2026-05-16（プロジェクト可視化 監査の結果として作成 / `docs/PROJECT_VISIBILITY_AUDIT_2026-05-16.md`）

---

## 凡例

| マーク | 意味 |
|---|---|
| 🔥 | 最優先 / 即対応 |
| ⚡ | 高優先 / 今週中 |
| 📋 | 中優先 / 月内 |
| ⏸ | 待機 / 状態不明（要レビュー）|
| 🧊 | 低優先 / 待つ |
| 👤 | 人間アクション必要 |

---

## 経営アクション（人間 / 院長）

| 優先度 | 項目 | 期限 | 参照 |
|---|---|---|---|
| 🔥👤 | **6 月 1 日 月次レビュー実施**（`?view=chronicpain` 1 画面 + 設計済 doc 参照）| 2026-06-01 | `hirayama-jyusei-strategy/docs/MONTHLY_REVIEW_PREP_2026-06.md` |
| ⚡👤 | **machine-yasan 試験案件削除（`removeTestDeals()` 実行）→ 手入力運用開始** | 6 月初 | `machine-yasan-management/PROJECT_STATUS.md` |
| ⚡👤 | 「継続しない理由」聞き取り運用開始（5 月初診患者の recall）| 6 月運用 | `hirayama-jyusei-strategy/NEXT_ACTIONS.md` |
| 📋👤 | 西尾真吾 初回インタビュー実施 | 日程調整中 | `life-design-project/PROJECT_STATUS.md` |

---

## システム実装

### JREC-SF01（自費カルテ + 問診票）

| 優先度 | 項目 | 補足 |
|---|---|---|
| 📋 | Q-5 AI 評価補助連動（painScale 推移 / gym 候補 KPI）| 設計のみ着手 OK |
| 📋 | auth.json 再取得後に QB / QC / QA フル live-check 再走 | DOC tests は通過済 |
| 🧊 | 旧 @48 deployment archive | 稼働に支障なし |

### JBIZ Portal（hirayama-jyusei-strategy）

| 優先度 | 項目 | 補足 |
|---|---|---|
| ✅ | ~~NEXT_ACTIONS.md に @67〜@70 / machine-yasan Phase 1 進展を追記~~ | **CLOSED 2026-05-16** — JBIZ NEXT_ACTIONS / PROJECT_STATUS に Markdown 反映済み |
| ✅ | ~~machine-yasan を Business_Links に追加 + Portal Hub 入口（実書き込み）~~ | **CLOSED 2026-05-16 (コード反映 + @29 deploy 完了)** — `setupPortal7b()` 実装 / JBIZ @29 deploy / `setupPortal7b` 実行は院長手動依頼（auth.json 期限切れ）|
| 🔥👤 | **`setupPortal7b` 実行**（院長手動）| `https://script.google.com/macros/s/AKfycbw20tW.../exec?action=setupPortal7b` をブラウザで開く / または GAS editor から実行 |
| 📋 | Portal-15-C-v2: Billing 結合で `first_visit_sales` / `repeat_visit_sales` 実値化 | 現状 "未計測" |
| 📋 | Portal-15-B-i: 月初自動 snapshot（`ScriptApp.newTrigger`）| 現状手動 |
| 📋 | Portal-18-E/F: home view 軽量化 / 表示時間計測 spec | A/C 完了済 |
| 🧊 | Portal-18-B v2: fetchAll 再設計（cache 別 namespace + 計測 spec 先行）| 撤回後 |
| 🧊 | Dashboard formula `#ERROR!` / `#NAME?` root fix | Phase 1-D 課題 |

### JYU-GAS（柔整保険申請書 Ver3.1）

| 優先度 | 項目 | 補足 |
|---|---|---|
| 📋👤 | TC01〜TC10 実機テスト（W-9）| 院長アクション必要 |
| 🧊 | B-2 fixture 強化 | 通常運用に支障なし |

### Wildboar（会員管理）

| 優先度 | 項目 | 補足 |
|---|---|---|
| 📋 | Phase 14-4E（新規入会・申込承認時の会員番号発番ルール調査・設計のみ）| `docs/PHASE14_4E_RESTART_MEMO_2026-05-15.md` |
| 🧊 | Phase 10（Next.js フロントエンド構築）| GAS 版と並行 |
| 🧊 | feature ブランチ → main マージタイミング検討 | 現 feature/wildboar-member-phase4 |

### machine-yasan-management（マシン屋さん）

| 優先度 | 項目 | 補足 |
|---|---|---|
| ⚡👤 | 試験案件削除 + 手入力運用開始 | 上の経営アクション参照 |
| ⚡ | feature/phase1-google-sheet → main マージ | Phase 1 完了済 |
| 📋 | JBIZ Business_Links 登録準備 | Phase 4 を待たず meta 登録は可能 |
| 🧊 | Phase 2 以降（買取案件 / freee 連携 / Drive / HP 問い合わせ / 過去データ）| ROADMAP 順次 |

### machine-yasan を git-health-check 監査輪に入れる ✅ CLOSED 2026-05-16

| 優先度 | 項目 | 補足 |
|---|---|---|
| ✅ | ~~`tools/git-health-check.ps1` を拡張して parent gitignore 対象の独立 repo も監査~~ | **CLOSED 2026-05-16** — `$repos` 配列に `machine-yasan-management` 追加、12 repo 監査化、health check で clean 確認 |

---

## 状態棚卸し（PAUSED / NEEDS_REVIEW / 状態不明）

以下の repo は 2026-05-05〜13 で停滞中。状態（PAUSED / ACTIVE / NEEDS_REVIEW / CLOSED）を明示する。

| 優先度 | repo | 最終更新 | 必要なアクション |
|---|---|---|---|
| ⏸ | subsidy-grants-projects | 2026-05-05 | 期限のある助成金案件があれば洗い出し |
| ⏸ | waste-report-system | 2026-05-05 | 月次運用が回っているか確認 |
| ⏸ | training-program-platform-jp | 2026-05-13（dirty 復旧後）| 「プログラム追加」(ROADMAP) の着手判断 |
| ⏸ | training-trend-analyzer | 2026-05-13（dirty 復旧後）| 第 3 ソース追加 / 公開サイトの判断 |

---

## ハードウェア・実物検討中

| 優先度 | repo | 状態 |
|---|---|---|
| 🧊 | treadmill-motor-crusher-project | Phase 1-B 駆動方式確定・プーリー選定中 |
| 🧊 | desktop-work-status-overlay | Phase 3-Z-2/3-Z-3 DONE / 次方針未定 |

---

## 監査・整理タスク

| 優先度 | 項目 | 補足 |
|---|---|---|
| 📋 | `PROJECTS.md` (4/17 stale) と `ROADMAP.md` (5/8 stale) を 6 月時点でリセット | quarterly review として |
| 🧊 | 各 repo NEXT_ACTIONS.md を自動収集する script | 手動更新が回らないことが見えてから |

---

## このファイルの更新ルール

- 各 repo 内の詳細は触らず、本ファイルは「インデックス」として 1 行ずつ集約する
- 完了したら該当行を削除（履歴は git log で追える）
- 新しい優先度は 🔥 → ⚡ → 📋 → ⏸ → 🧊 の順
- 平山が見て「次に何をやるか」を 30 秒で判断できる粒度を維持する
- 月初に quarterly review として全行を再評価
