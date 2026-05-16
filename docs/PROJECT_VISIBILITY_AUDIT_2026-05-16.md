# プロジェクト可視化 監査レポート 2026-05-16

> 目的: workspace 配下の全プロジェクトについて、進捗・成果物・次アクションが平山にとって見える状態か棚卸しする。
> 今回は調査・記録のみ。実装・deploy・clasp push は実施していない。

---

## 全体サマリ

- 監査対象 **12 リポジトリ**（git-health-check 対象 11 + parent gitignore 対象 machine-yasan 1）
- 実質 **すべての repo が clean / 0-0 / missing tracked 0**
- ただし **workspace 親の集約 docs (PROJECT_STATUS / PROJECTS / ROADMAP) が 2026-05-08〜2026-05-14 で stale**
- workspace に **`NEXT_ACTIONS.md` が存在しない**（一元管理ゼロ）
- JBIZ NEXT_ACTIONS.md は @28 / Portal-17 までで、JREC-SF01 @67〜@70 の続き UX 改善は未反映
- `machine-yasan-management` は **2026-05-16 に Phase 1 Sheet 初期化完了したばかり**（最新動向）にもかかわらず親 gitignore で git-health-check の監査輪から外れている

総合判定: **可視化できているが「集約点」が不在で、最新動向を 1 画面で追えない状態**。各 repo は丁寧に PROJECT_STATUS を書いており健全だが、平山が「今どれが優先か」を 1 ファイルで把握する手段がない。

---

## git health 結果 (2026-05-16 11:05)

| repo | branch | HEAD | porcelain | missing | ahead/behind | 状態 |
|---|---|---|---|---|---|---|
| workspace (.) | feature/auto-dev-phase3-loop | def81f8 | 0 | 0 | 0/0 | clean |
| desktop-work-status-overlay | master | a81b0ef | 0 | 0 | 0/0 | clean |
| gas-projects/jrec-sf01-selfpay | main | 1506131 | 1 | 0 | 0/0 | `.claude/` untracked のみ（既知 scope-out）|
| gas-projects/jyu-gas-ver3.1 | main | 7004511 | 0 | 0 | 0/0 | clean |
| hirayama-jyusei-strategy | main | f9b2b50 | 0 | 0 | 0/0 | clean |
| life-design-project | feature/nishio-initial-interview | da850a0 | 0 | 0 | 0/0 | clean |
| subsidy-grants-projects | main | 35a44b9 | 0 | 0 | 0/0 | clean |
| training-program-platform-jp | main | 6eaf557 | 0 | 0 | 0/0 | clean |
| training-trend-analyzer | master | d103353 | 0 | 0 | 0/0 | clean |
| treadmill-motor-crusher-project | main | 22e8998 | 0 | 0 | 0/0 | clean |
| wildboar-member-management | feature/wildboar-member-phase4 | 7fb6551 | 0 | 0 | 0/0 | clean |
| machine-yasan-management ⚠️ | feature/phase1-google-sheet | 318ec7d | — | — | — | clean（独立 repo / parent gitignore） |

⚠️ `machine-yasan-management` は親 gitignore 対象のため `tools/git-health-check.ps1` の輪に入らない。手動で確認する必要がある。

---

## プロジェクト別一覧

### 1. JREC-SF01（自費カルテ + 問診票）

| 項目 | 内容 |
|---|---|
| repo path | `gas-projects/jrec-sf01-selfpay` |
| branch | `main` |
| latest commit | `1506131` (@70 受付待ちバッジ 院長 PASS 記録) |
| 状態 | **ACTIVE / 院長実 UI PASS @70** |
| 直近成果物 | @66 注記 + @28 fallback / @67 紐づけ DOM 更新 / @68 説明同意削除 + 既存来院候補ボタン + 次回方針移動 / @69 public form / @70 受付待ち N 件バッジ |
| 次アクション | (1) Q-5 AI 評価補助連動 (2) JBIZ Portal-17 / Run_Log 反映 (3) auth.json 再取得後 QB/QC/QA フル live-check |
| 可視化 | PROJECT_STATUS ✅（最新）/ NEXT_ACTIONS ❌ / ROADMAP ✅（古い）|
| 埋もれリスク | workspace 親 PROJECT_STATUS が `@66 まで` で止まっている。@67/@68/@69/@70 の進展が JBIZ NEXT_ACTIONS / Run_Log / Dashboard にも反映されていない |

### 2. JBIZ Portal（hirayama-jyusei-strategy）

| 項目 | 内容 |
|---|---|
| repo path | `hirayama-jyusei-strategy/`（nested 独立 repo）|
| branch | `main` |
| latest commit | `f9b2b50` |
| 状態 | **ACTIVE / Portal-18-D まで CLOSED** |
| 直近成果物 | Portal-15/16/17 + 18-A/C/D 完了 / `MONTHLY_REVIEW_PREP_2026-06.md` / @28 deploy / Drive 印刷物 4 ファイル院長確認 |
| 次アクション | (1) 6 月 1 日月次レビュー実施（最優先・経営アクション）(2) Portal-15-C-v2（Billing 接続で実値化）(3) Portal-18-B v2 再設計 (4) Portal-18-E/F (5) Wildboar / machine-yasan 等の Business_Links 追加 |
| 可視化 | PROJECT_STATUS ✅ / NEXT_ACTIONS ✅ / ROADMAP ✅ / Portal Hub ✅ |
| 埋もれリスク | NEXT_ACTIONS.md は 2026-05-14 で停止。@67〜@70 の JREC-SF01 UX 改善 と machine-yasan Phase 1 完了が未反映 |

### 3. JYU-GAS（柔整保険申請書 Ver3.1）

| 項目 | 内容 |
|---|---|
| repo path | `gas-projects/jyu-gas-ver3.1` |
| branch | `main` |
| latest commit | `7004511` |
| 状態 | **ACTIVE（本番稼働中）/ WEB-1〜4D 完了 / @13 deploy** |
| 直近成果物 | Web UI WEB-1〜4D / B案 Cloud Run Excel / 共通ナビタブ @13 / Git dirty 緊急復元（2026-05-14）|
| 次アクション | TC01〜TC10 実機テスト（W-9 待機）/ B-2 fixture 強化 |
| 可視化 | PROJECT_STATUS ✅（5/14 で停滞）/ NEXT_ACTIONS ❌ / ROADMAP ❌ |
| 埋もれリスク | スプレッドシート実機テストが「待機」のまま。次の保険業務改善判断が見えない |

### 4. Wildboar（会員管理）

| 項目 | 内容 |
|---|---|
| repo path | `wildboar-member-management` |
| branch | `feature/wildboar-member-phase4` |
| latest commit | `7fb6551` |
| 状態 | **ACTIVE（本番稼働）/ Phase 14-4D CLOSED @49** |
| 直近成果物 | Members 65 名（active 51 / paused 14）全件 4 桁ゼロ埋め統一完了 / `BMID-20260515-001` / 失敗 0 |
| 次アクション | Phase 14-4E（新規入会・申込承認時の会員番号発番ルール調査・設計のみ）/ Phase 10（Next.js フロントエンド）|
| 可視化 | PROJECT_STATUS ✅（最新）/ NEXT_ACTIONS ❌ / ROADMAP ✅ |
| 埋もれリスク | feature ブランチ作業中。main へのマージ・PROD 同期タイミングが不明 |

### 5. machine-yasan-management（マシン屋さん）

| 項目 | 内容 |
|---|---|
| repo path | `machine-yasan-management/`（独立 repo / parent gitignore）|
| branch | `feature/phase1-google-sheet` |
| latest commit | `318ec7d` |
| 状態 | **ACTIVE / Phase 1 Google Sheet 正本作成完了（2026-05-16）** |
| 直近成果物 | 7 シート初期化 / ヘッダー投入 / メーカー・カテゴリ 54 行 / ドロップダウン 44 ルール / 試験案件 3 件投入 |
| 次アクション | (1) 試験案件削除（`removeTestDeals()` 実行待ち）(2) 手入力運用開始 (3) feature ブランチ → main マージ (4) JBIZ Business_Links 登録準備 |
| 可視化 | PROJECT_STATUS ✅（最新）/ NEXT_ACTIONS ❌ / ROADMAP ✅ |
| 埋もれリスク ⚠️ | **`tools/git-health-check.ps1` の監査輪から外れている**。parent .gitignore で除外されているため、workspace のヘルスチェックで状態が見えない。独立 repo として個別 status 確認が必要 |

### 6. subsidy-grants-projects（助成金・補助金）

| 項目 | 内容 |
|---|---|
| repo path | `subsidy-grants-projects` |
| branch | `main` |
| latest commit | `35a44b9` |
| 状態 | **PAUSED / 状態 stale (2026-05-05)** |
| 直近成果物 | GitHub 管理体制確認 / .gitignore 強化 / PRIVATE_DATA_POLICY.md 作成 |
| 次アクション | **不明** / 何の案件が active か / 申請期限のあるものはあるか |
| 可視化 | PROJECT_STATUS ✅ stale / NEXT_ACTIONS ❌ / ROADMAP ✅ |
| 埋もれリスク | 11 日間進展なし。期限のある助成金案件が埋もれていないか要レビュー |

### 7. waste-report-system（HAIKI-05 廃棄物日報）

| 項目 | 内容 |
|---|---|
| repo path | `waste-report-system` |
| branch | （独立 repo or workspace 内ディレクトリ要確認 — git-health-check に含まれない）|
| 状態 | **ACTIVE（本番稼働）/ ローカル正本化完了 (2026-05-05)** |
| 直近成果物 | clasp clone 済み / 旧名称ハードコード除去確認 / J16 名称変更（あさご暮らしサポート）|
| 次アクション | **不明** / 月報運用が回っているか / 次の改善はあるか |
| 可視化 | PROJECT_STATUS ✅ stale / NEXT_ACTIONS ❌ / ROADMAP ❌ |
| 埋もれリスク | 11 日間進展なし。月次運用の状態が見えない |

### 8. desktop-work-status-overlay

| 項目 | 内容 |
|---|---|
| repo path | `desktop-work-status-overlay` |
| branch | `master` |
| latest commit | `a81b0ef` |
| 状態 | **ACTIVE / Phase 3-Z-2 / 3-Z-3 DONE (2026-05-11)** |
| 直近成果物 | アクティブ Desktop 緑強調 / `slim_vertical` レイアウト追加（5 つ目）|
| 次アクション | **不明** / 次の Phase ターゲットがない |
| 可視化 | PROJECT_STATUS ✅ / NEXT_ACTIONS ❌ / ROADMAP ✅ |
| 埋もれリスク | 5/11 で停滞。完成度高そうだが次の改善方針が見えない |

### 9. training-program-platform-jp

| 項目 | 内容 |
|---|---|
| repo path | `training-program-platform-jp` |
| branch | `main` |
| latest commit | `6eaf557` |
| 状態 | **UNKNOWN / 2026-05-13 ローカル dirty 復旧後 stale** |
| 直近成果物 | 112 ファイル ` D` 復旧 / `npm run typecheck` PASS |
| 次アクション | **不明** / プログラム追加 (ROADMAP) / 限定公開後の運用 |
| 可視化 | PROJECT_STATUS ⚠️ 復旧メモのみ / NEXT_ACTIONS ❌ / ROADMAP ✅ |
| 埋もれリスク | 復旧後 5/13 で停止。ロードマップでは「プログラム追加」が次だが、誰が手をつけるかタイミング不明 |

### 10. training-trend-analyzer

| 項目 | 内容 |
|---|---|
| repo path | `training-trend-analyzer` |
| branch | `master` |
| latest commit | `d103353` |
| 状態 | **UNKNOWN / 2026-05-13 ローカル dirty 復旧後 stale** |
| 直近成果物 | 121 ファイル ` D` 復旧 / pytest 164 tests PASS |
| 次アクション | **不明** / 第3ソース追加 / 公開サイト |
| 可視化 | PROJECT_STATUS ⚠️ 復旧メモのみ / NEXT_ACTIONS ❌ / ROADMAP ❌（前回 4/10）|
| 埋もれリスク | 5/13 で停止。次の収集ターゲットや公開判断が見えない |

### 11. treadmill-motor-crusher-project（廃トレッドミルモーター粉砕機）

| 項目 | 内容 |
|---|---|
| repo path | `treadmill-motor-crusher-project` |
| branch | `main` |
| latest commit | `22e8998` |
| 状態 | **ACTIVE / Phase 1-B 駆動方式確定・相手側プーリー選定中 (2026-05-14)** |
| 直近成果物 | 駆動方式判断 |
| 次アクション | プーリー選定継続（ハードウェア検討段階）|
| 可視化 | PROJECT_STATUS ✅ / NEXT_ACTIONS ❌ / ROADMAP ✅ |
| 埋もれリスク | 低（ハードウェア検討段階で進行中、ITシステム外）|

### 12. life-design-project

| 項目 | 内容 |
|---|---|
| repo path | `life-design-project` |
| branch | `feature/nishio-initial-interview` |
| latest commit | `da850a0` |
| 状態 | **ACTIVE / 西尾真吾 初回インタビュー準備整備 (2026-05-08)** |
| 直近成果物 | 当日進行表 / 質問集 / 記録シート整備 |
| 次アクション | 西尾真吾 初回インタビュー実施（人間アクション）|
| 可視化 | PROJECT_STATUS ✅ / NEXT_ACTIONS ❌ / ROADMAP ❌ |
| 埋もれリスク | 5/8 から実施待ち。インタビュー日程が見えない |

---

## 可視化できているもの

| 項目 | 状況 |
|---|---|
| 各 repo の PROJECT_STATUS.md | 8/12 で最新（5/14 以降）|
| JBIZ Portal Business Hub（事業入口）| ✅ Portal-7 で構築済み |
| JBIZ NEXT_ACTIONS.md / ROADMAP.md | ✅ 揃い（ただし 5/14 で停滞）|
| 6 月レビュー準備 | ✅ `hirayama-jyusei-strategy/docs/MONTHLY_REVIEW_PREP_2026-06.md` |
| Portal-18-D「平山ポータルへ戻る」リンク | ✅ JREC / JYU-GAS / Wildboar 各 home に配置 |
| Multi-Claude single writer rule | ✅ JBIZ CLAUDE.md / workspace CLAUDE.md |
| Git dirty 防止ルール | ✅ workspace CLAUDE.md / `tools/git-health-check.ps1` |
| 11 repo の git-health-check 自動化 | ✅ 11 repo を 1 スクリプトで監査 |

---

## 埋もれているもの

### 重大（即対応推奨）

1. **workspace 親 PROJECT_STATUS.md が 2026-05-14 で停止** — JREC-SF01 @67〜@70 / machine-yasan Phase 1 完了 / 6 月レビュー準備 / @28 JBIZ deploy 等が未反映
2. **workspace に `NEXT_ACTIONS.md` が存在しない** — 平山が 1 ファイルで「次にやることは何か」を見る手段がない
3. **machine-yasan-management が `tools/git-health-check.ps1` の監査輪から外れている** — parent .gitignore 対象だが独立 repo。clean/dirty が workspace 全体のヘルスチェックで見えない

### 中（早めに対応推奨）

4. **JBIZ NEXT_ACTIONS.md に @67〜@70 の進展未反映** — JREC-SF01 / Portal-17 接続後の continued UX 改善が見えない
5. **JREC-SF01 / JYU-GAS / Wildboar に NEXT_ACTIONS.md がない** — 各 repo 内の次アクションが PROJECT_STATUS.md 末尾に埋もれる
6. **subsidy-grants-projects / waste-report-system / training-program-platform-jp / training-trend-analyzer の 4 repo が 2026-05-05〜13 で停滞** — 次に何をするのか不明

### 低（参考）

7. **PROJECTS.md (2026-04-17 stale) と ROADMAP.md (2026-05-08 stale)** — 戦略文書として参照されてはいるが、最新動向と乖離
8. **desktop-work-status-overlay / treadmill-motor-crusher-project / life-design-project の次アクションが個別ファイル内に閉じている**

---

## Dashboard / Portal / Task_Queue に上げるべき候補

### Run_Log に追加すべき完了作業

- `2026-05-15` JREC-SF01 @63〜@65 deploy（紐づけ DOM / 説明同意 / 候補ボタン / 受付待ちラベル整理）
- `2026-05-16` JREC-SF01 @66 / @67 / @68 / @69 / @70 deploy
- `2026-05-16` machine-yasan Phase 1 Google Sheet 正本作成完了

### Task_Queue に登録すべき未着手タスク

- `TASK-JBIZ-MONTHLY-REVIEW-2026-06-01` 6 月 1 日月次レビュー実施（既登録だが priority 確認）
- `TASK-MASY-PHASE1-FINALIZE` machine-yasan 試験案件削除 + 手入力運用開始
- `TASK-MASY-BUSINESS-LINKS` machine-yasan を JBIZ Business_Links に登録
- `TASK-JREC-Q5` AI 評価補助連動の着手判断
- `TASK-AUDIT-FOLLOWUP-2026-05-16` 本監査での埋もれ docs 整理（subsidy / waste / training-* の状態棚卸し）

### Business_Links に追加すべき事業

- machine-yasan-management（独立 repo として正本化済み、Phase 1 Sheet 稼働可能）

---

## 次にやるべき優先順位

| 順位 | 項目 | 理由 | 工数目安 |
|---|---|---|---|
| 1 | **workspace `NEXT_ACTIONS.md` 新規作成 + `PROJECT_STATUS.md` 5/16 まで最新化** | 平山が「次にやること」を 1 画面で見る基盤がない | 30 分 |
| 2 | **machine-yasan を git-health-check の輪に入れる**（gitignore exception or 監査スクリプト拡張）| 独立 repo の clean/dirty が監査外で埋もれる | 15 分 |
| 3 | **JBIZ NEXT_ACTIONS.md に @67〜@70 進展 + machine-yasan Phase 1 完了を追記** | Portal を経営判断の「集約点」として維持するため | 20 分 |
| 4 | **6 月 1 日 月次レビュー実施**（経営アクション・人間） | `?view=chronicpain` 1 画面 + `MONTHLY_REVIEW_PREP_2026-06.md` で完結する設計済み | 30 分 |
| 5 | **machine-yasan 試験案件削除 → 手入力運用開始**（人間アクション） | `removeTestDeals()` 実行で本番稼働可能 | 5 分 |
| 6 | **JBIZ Business_Links に machine-yasan 登録 + Portal Hub に入口追加** | 事業ハブとしての機能を継続強化 | 30 分 |
| 7 | **subsidy / waste / training-* の状態棚卸し**（PAUSED か NEEDS_REVIEW か CLOSED か明示）| 4 repo が 5/5〜5/13 で停滞、優先度・期限を 1 行で書く | 20 分 |
| 8 | JREC-SF01 Q-5 AI 評価補助の着手判断 | 設計のみ着手して期限不要 | 1 h（設計） |
| 9 | JYU-GAS TC01〜TC10 実機テスト | 院長アクション必要、優先度低 | 2 h（実機）|

---

## すぐ対応不要なもの

- **treadmill-motor-crusher-project** Phase 1-B プーリー選定（ハードウェア段階、IT 系列外）
- **life-design-project** nishio 初回インタビュー（人間アクション・日程調整待ち）
- **Portal-18-B v2** 再設計（撤回後、優先度低）
- **JREC-SF01 旧 @48 deployment archive**（稼働に支障なし）
- **JYU-GAS 旧 master / recovery/* ブランチ整理**（通常運用では touch しない）

---

## 提案する改善方針

### 短期（今週中）

1. **workspace `NEXT_ACTIONS.md` を新規作成**して、各 repo の次アクションを 1 行ずつ集約する。既存 repo の NEXT_ACTIONS.md / PROJECT_STATUS.md は触らず、workspace に「インデックス」を作るだけで十分
2. **workspace `PROJECT_STATUS.md` の冒頭にリンク表を追加**して、各 repo の最新 PROJECT_STATUS.md（@N 版数）に飛べるようにする
3. **`tools/git-health-check.ps1` を拡張**して machine-yasan のような「parent gitignore 対象の独立 repo」も監査対象に含める

### 中期（6 月中）

4. **JBIZ Portal の事業ハブに machine-yasan を追加**
5. **subsidy / waste / training-* の各 repo に「現状」1 ブロックを追記**して `PAUSED` / `ACTIVE` / `NEEDS_REVIEW` を明示
6. **PROJECTS.md / ROADMAP.md を quarterly review として 6 月時点でリセット**

### 長期（必要に応じて）

7. **`workspace/NEXT_ACTIONS.md` から各 repo NEXT_ACTIONS.md を自動収集する script** を整備（手動更新が回らないことが見えてからで OK）
8. **Dashboard / Run_Log に「workspace 全体の audit ログ」を 1 枚作成**

---

## 監査メタ情報

- 実施者: Claude Code (Opus 4.7) on session 2026-05-16
- 実施範囲: 12 リポジトリ
- 実装変更: なし
- clasp push / deploy: なし
- 触ったファイル: このレポート 1 ファイル + workspace 側 STATUS / NEXT_ACTIONS 追記（commit 時）
