# workspace PROJECT_STATUS.md

最終更新: 2026-05-14（Portal-18-A / 18-C 実装 ✅ CLOSED / Portal-18-B 撤回）

## 2026-05-14: Portal-18-A / 18-C 実装 ✅ CLOSED / Portal-18-B 撤回（JBIZ `@25`）

平山ポータルの **view 別 lazy load**（18-A）と **navigation 2 段化 + 外部事業ポータル直リンク**（18-C）を JBIZ `@25` に deploy。

**Portal-18-B（chronicpain view 3 fetch を fetchAll 並列化）は @22/@23/@24 で「全 endpoint が gym data を返す」現象が再現し撤回**。個別 fetcher 直列 + cache key `_v3:` bump で正常応答に復旧。

| Portal-18 | 状態 |
|---|---|
| 18-A: `getPortalSummary_(view)` view 別 lazy load | ✅ CLOSED `@25` |
| 18-B: `fetchAll` 並列化 | ⚠️ 撤回 / 次フェーズで再設計 |
| 18-C: navigation 2 段化 + 外部事業ポータル直リンク | ✅ CLOSED `@25` |
| 18-D: 各事業 portal 側「戻る」追加 | ⏸ 別 single writer セッション |

**自動 verify**: JBIZ smoke 256 PASS / verify-portal15-deploy.ts setupPortal15 / setupPortal15B / `?view=chronicpain` (sec2 prev-month + sec3 connected) すべて PASS / `?action=fetchChronicPainKpi` symptom & ic 正常応答。

詳細: `hirayama-jyusei-strategy/docs/PORTAL_18_HUB_NAV_PERFORMANCE_IMPLEMENTATION_2026-05-14.md`

---

## 2026-05-14: 紙資料 Drive Upload + Portal Hub 改善 設計 ✅ CLOSED（docs-only）

院長がスタッフに紙で渡す 4 資料を Google Drive にアップロード + Portal 導線・速度改善 設計を docs 化。
**システム実装 / clasp deploy なし**。次フェーズ「Portal-18-A〜F」として実装候補に積む。

### Drive Upload

| フォルダ | URL |
|---|---|
| `2026-05_Portal15C後_運用資料` | https://drive.google.com/drive/folders/1ozjgIB9bgB2XADTv7KjSr4GdDrvWrY7Y |

4 ファイル（Google Doc 形式 / Markdown 正本は git 管理）:
1. スタッフ用 1 枚
2. 継続しない理由 チェック表
3. LINE/SMS リコール文 集
4. 10 分 読み合わせ台本

### Portal 改善 設計（実装は Portal-18 シリーズで次フェーズ）

| 改善 | 効果 |
|---|---|
| A: view 別 lazy load（11 sheet → 必要分のみ）| 1〜2 秒短縮 |
| B: chronicpain 3 fetch を `fetchAll` 並列化 | cold start 2 秒短縮 |
| C: navigation 2 段化（内部 + 外部事業ポータル）| UX 向上 |
| D: 各事業 portal に「平山へ戻る」追加 | UX 向上 |

→ 全部実施で cold start 6s → 2s 見込み。

### 詳細

- 紙資料記録: `hirayama-jyusei-strategy/docs/PRINT_MATERIALS_DRIVE_EXPORT_2026-05-14.md`
- 導線/速度設計: `hirayama-jyusei-strategy/docs/PORTAL_HUB_NAVIGATION_AND_PERFORMANCE_2026-05-14.md`

---

## 2026-05-14: JBIZ 継続化運用設計 ✅ CLOSED（docs-only / システム deploy なし）

Portal-15-C の数字（初診 1 / 再診 0 / 継続不足アラート active）を起点に、現場で使う言葉と導線を設計。

| 成果物 | 場所 |
|---|---|
| 運用設計 docs | `hirayama-jyusei-strategy/docs/CONTINUATION_DESIGN_AFTER_PORTAL15C_2026-05-14.md`（15 章 / 約 600 行 / 2 回目提案トーク + 症状別 + 施術計画 3 パターン + LINE-SMS リコール + 継続しない理由 + ジム誘導 + 運用フロー）|

設計思想を明文化: 「**数字（Portal-15-C） → 言葉（本書） → 運用 → 翌月数字で検証 → v1.1 微調整**」の順を Portal-15 全体の核として定義。

### システム実装なし

- clasp push / deploy なし
- JREC-SF01 触らず（並行 Claude active のため）
- Portal / Sheet 変更なし
- Dashboard 反映なし（運用が回り始めてから設計）

---

## 2026-05-14: JBIZ Portal-15-C ✅ CLOSED（自費 初回 / 継続 区分 connected / @21）

JREC-SF01 `selfpayInitialContinuationSummary` 新規 endpoint（@52）と JBIZ portal-gateway 接続（@21）。
Portal-15 `?view=chronicpain` § 2-B に「自費 初回 / 継続 区分」 6 カードを追加。

| 項目 | 値 |
|---|---|
| JREC deploy | `@52` on `AKfycbw0aWYY0...`（@51 上書き） |
| JBIZ deploy | `@21` on `AKfycbw20...`（@20 上書き、bookmark URL 維持） |
| JREC live-check | chronic-pain-kpi **13/13 PASS** + initial-continuation-kpi **14/14 PASS** |
| JBIZ smoke | **246 PASS / 0 FAIL / 2 skipped**（前 232、+14） |
| verify-portal15 | **PASS**（§2-B initial/continuation connected 確認）|

### 経営判断的観察（5月実データ）

```
1 自費来院 = 100% 初診 / 0 継続
継続不足アラート: active
推奨アクション: リコール声かけ / 施術プラン提案 / 通院動機 review
```

### Multi-Claude 競合 recovery

実装中に並行 Claude（PID 6968 / 3136）が JREC `Main.gs` を編集し、私の Portal-15-C コードを上書き / 削除する競合発生。WIP 保全 → 並行 Claude 停止 → repo 復旧 → GAS HEAD 同期で復旧完了。

詳細: `docs/MULTI_CLAUDE_PORTAL15C_CONFLICT_RECOVERY_2026-05-14.md`

WIP 保全 backup:
- `_handoff/jrec-conflict-20260514-134621/` — 停止した Claude の WIP
- `_handoff/portal15c-jbiz-workspace-20260514-134621/` — 本セッションの uncommitted 変更

### 再発防止候補（CLAUDE.md 補強案）

- JREC-SF01 編集前: ファイル mtime が 5 分以内なら active 判定（30 分前判定は危険）
- 重要 endpoint deploy 直後に local commit を入れる
- 競合検出時の WIP 保全 standard procedure を `tools/` に script 化

---

## 2026-05-14: JBIZ Portal-15-B ✅ CLOSED（月次履歴 / 前月比 enable / @20）

`?view=chronicpain` §2 に前月比カード 5 枚を追加。`JBIZ_ChronicPain_Monthly_History` シート（20 列）で月次 snapshot を upsert する仕組み。

| 項目 | 値 |
|---|---|
| JBIZ deploy | `@20` on `AKfycbw20...`（bookmark URL 維持）|
| JBIZ smoke | **232 PASS / 0 FAIL / 0 SKIP**（前 216、+16）|
| 新規シート | `JBIZ_ChronicPain_Monthly_History`（20 列）|
| 初回 snapshot | 2026-05 inserted（row 2）|
| `verify-portal15-deploy.ts` | **PASS**（setupPortal15 / setupPortal15B / ?view=chronicpain 前月比表示）|
| gas/ ↔ scripts/ SHA | `65A38D05E...` 一致（3263 行）|

詳細: `hirayama-jyusei-strategy/docs/PORTAL_15B_CHRONIC_PAIN_MONTHLY_HISTORY_2026-05-14.md`

### 経営判断的意義

Portal-15 は「今月の状態」だけでなく **「前月との比較で増えているか / 改善しているか」** が production で見えるようになった。
6 月以降の蓄積で慢性疼痛戦略の効果を時系列で判定可能。

---

## 2026-05-14: JBIZ Portal-16-D / 16-E ✅ CLOSED（Portal-15 §3 connected 化完了）

Portal-16-B（JREC-SF01 endpoint）の上に JBIZ portal-gateway を接続し、
Portal-15 `?view=chronicpain` の §3「症状別件数」を **unconnected → connected** へ切替。

| 項目 | 値 |
|---|---|
| JBIZ deploy | `@19` on `AKfycbw20...`（bookmark URL 維持）|
| JBIZ smoke | **216 PASS / 0 FAIL / 0 SKIP**（前 194、+22）|
| `verify-portal15-deploy.ts` | **PASS**（setupPortal15 + ?view=chronicpain §3 connected）|
| gas/ ↔ scripts/ SHA | `175A1648...` 一致 |
| Multi-Claude | 競合なし（JBIZ + workspace のみ書き込み、JREC は read-only 確認のみ）|

詳細: `hirayama-jyusei-strategy/docs/PORTAL_16D_JBIZ_CHRONIC_PAIN_CONNECTION_2026-05-14.md`

### Portal-16 シリーズ 全 Phase

| Phase | 内容 | 状態 |
|---|---|---|
| 16-A 設計 | ✅ CLOSED |
| 16-B JREC endpoint | ✅ CLOSED（`@51`）|
| 16-C JREC live-check | ✅ CLOSED |
| 16-D JBIZ 接続 | ✅ CLOSED（`@19`）|
| 16-E Portal-15 §3 connected 本番確認 | ✅ CLOSED |

経営導線「自費患者増加 → **腰痛・首こり・肩こり** 施術増 → 自費継続 → 再発予防 → ジム誘導 → 月+20万円」のうち、太字部分が **production で測定可能** になった。

---

## 2026-05-14: JBIZ Portal-16-B ✅ CLOSED（JREC-SF01 endpoint live + 自動 verify PASS）

並行 Claude（PID 3136）の Phase Q-1A 作業完了 + JREC-SF01 clean 状態を確認後、Portal-16-B 本実装に着手:

| 項目 | 値 |
|---|---|
| JREC-SF01 head | `b70f258 → 0a36ff8`（chronicPainKpi 実装 + Main route 追加）|
| JREC-SF01 deploy | **`@51`** on existing deploymentId `AKfycbw0aWYY0...`（Portal-12 と同じ ANYONE_ANONYMOUS）|
| 新規ファイル | `JREC_SF01_ChronicPainKpi.gs`（約 200 行 / `CHRONIC_PAIN_KEYWORDS` + `getChronicPainKpiSummary`）|
| `JREC_SF01_Main.gs` 変更 | doGet に route 1 ブロック（21 行）追加のみ |
| live-check (`npm run test:jrec:chronic-pain-kpi`) | **13 / 13 PASS / 0 FAIL / 37.4s** |
| 本番動作 | 2026-05 → ok=true / visit_count_in_month=1 / 3 症状すべて 0（当該主訴は腰痛・首こり・肩こり辞書に該当せず）/ data_quality_warnings.empty_chiefcomplaint_count=0 |
| PII 不在 | spec CP-7 PASS（14 PII keyword すべて grep で 0 hit）|
| regression | gymReferralKpiSummary 不変（selfpay_visit_count=1 維持）|

### 詳細

- 設計: `hirayama-jyusei-strategy/docs/PORTAL_16_CHRONIC_PAIN_KPI_SUMMARY_DESIGN_2026-05-14.md`
- 実装記録: `gas-projects/jrec-sf01-selfpay/docs/PORTAL_16_CHRONIC_PAIN_KPI_SUMMARY_IMPLEMENTATION_2026-05-14.md`

### 並行 Claude 競合回避（実績）

| 戦略 | 結果 |
|---|---|
| 新規ファイル `JREC_SF01_ChronicPainKpi.gs` に集計 logic を隔離 | ✅ 競合面ゼロ |
| `JREC_SF01_Main.gs` 編集は route 1 ブロックのみ | ✅ |
| 着手時に Phase Q-1A の最新 commit (`b70f258`) が landed していることを確認 | ✅ |
| 実装〜deploy〜verify 中に並行 Claude の新規編集発生なし | ✅ |

### 次タスク

Portal-16-D（JBIZ portal-gateway 接続）→ Portal-16-E（Portal-15 §3 connected 化動作確認）。
JBIZ 側で `fetchChronicPainSymptomSummary_` 追加 + `buildChronicPainSymptomSection_` 書き換え + JBIZ deploy `@19`。

---

## 2026-05-14: JBIZ Portal-16-B WAITING（workspace 側 prep のみ実施・上記により解消）

並行 Claude（PID 3136）が JREC-SF01 で Phase Q-1A 後続を active 編集中のため、JREC-SF01 への書き込みは見送り。
代わりに workspace 側で **next session が即座に着手できる準備** を完了。

| 成果物 | 場所 | 状態 |
|---|---|---|
| Portal-16-B live-check spec template | `tools/live-check-runner/projects/jrec-sf01/chronic-pain-kpi.spec.ts` | 新規 / 全 spec `test.skip()` / `PORTAL16B_NOT_YET_DEPLOYED = true` を `false` に変えれば ENABLE |
| npm script alias | `tools/live-check-runner/package.json` | `test:jrec:chronic-pain-kpi` 追加 |
| 実装手順チェックリスト + PII grep keyword + 完了条件 | JBIZ `docs/PORTAL_16_CHRONIC_PAIN_KPI_SUMMARY_DESIGN_2026-05-14.md` § 12-13 | 追記済 |

### Multi-Claude observation（本セッション中）

| PID | 起動 | 推定作業 | 影響 |
|---|---|---|---|
| 20472 | 06:28 | 本セッション（Portal-16-B prep）| — |
| 6968 | 09:22 | life-design-project（独立）| 範囲分離 |
| 3136 | 09:57 | JREC-SF01 Phase Q-1A 系の active 編集（`JREC_SF01_Main.gs` 10:34 modified, uncommitted）| **Portal-16-B 実装待機の直接理由** |

### user 指示で守った範囲

- **JREC-SF01 repo の編集なし**（read-only で構造確認のみ）
- **`JREC_SF01_Main.gs` への route 追加なし**
- **`JREC_SF01_ChronicPainKpi.gs` の作成なし**（次セッションで実装）
- **clasp push / deploy なし**
- **PID 3136 の停止なし**
- **PID 3136 の未 commit 作業への介入なし**

---

## 2026-05-14: JBIZ Portal-16-A design CLOSED（endpoint spec を JBIZ 側に確定）

JREC-SF01 への `chronicPainKpiSummary` endpoint 新設で Portal-15 § 3 を connected 化するための設計 docs を JBIZ 側に確定。
**実装は Phase Q-1A 完了待ち**（並行 Claude PID 3136 が JREC-SF01 で active）。

詳細: [`hirayama-jyusei-strategy/docs/PORTAL_16_CHRONIC_PAIN_KPI_SUMMARY_DESIGN_2026-05-14.md`](./hirayama-jyusei-strategy/docs/PORTAL_16_CHRONIC_PAIN_KPI_SUMMARY_DESIGN_2026-05-14.md)

### Portal-16 Phase 分割

| Phase | 状態 | 担当範囲 |
|---|---|---|
| 16-A 設計 docs | ✅ CLOSED | JBIZ docs のみ（本セッション） |
| 16-B endpoint 実装 | ⏳ | JREC-SF01（Phase Q-1A 後）|
| 16-C JREC deploy + verify | ⏳ | JREC-SF01 + workspace |
| 16-D JBIZ 接続 + deploy @19 | ⏳ | JBIZ + workspace |
| 16-E Portal-15 § 3 connected 確認 | ⏳ | JBIZ |

### Multi-Claude 観測

本セッション中も 3 つの Claude プロセスが共存（PID 20472=本セッション / 6968=life-design / 3136=JREC-SF01 Phase Q-1A）。
本セッションは **JBIZ 側 docs のみ**に scope を絞り single-writer 違反を回避。
JREC-SF01 / life-design-project には書き込んでいない。

---

## 2026-05-14: JBIZ Portal-15 ✅ CLOSED（deploy @18 + setup + view 自動 verify PASS）

JBIZ `gas/portal-gateway-v1.gs` を `clasp push --force` で push、既存 deploymentId に `@18 - Portal-15: chronic-pain self-pay conversion funnel KPI view` で deploy（bookmark URL 維持）。
その後、Chrome CDP 9222 + `.chrome-profile` 経由で auth.json を 14.2 KB に再取得し（既存 Google セッション生存・login 不要）、
`tools/live-check-runner/scripts/verify-portal15-deploy.ts` を実行して **setupPortal15 / ?view=chronicpain の両方を Playwright で自動 verify** → **両 PASS**。

| 項目 | 値 |
|---|---|
| version | `@18` |
| deploymentId | `AKfycbw20tWvhR5nnRzCiUAMybtfrebRg-BK-EgDamvZYt-clSwf4TK9FGTKNZRmsO3wj7QSiQ` |
| JBIZ head | （本セッション末で再 commit）|
| JBIZ smoke (post-deploy・静的) | 194 PASS / 4 skipped / 0 FAIL — regression なし |
| setupPortal15 自動 verify | ✅ PASS（status:ok / TASK-PORTAL-15-001 → done / Run_Log row 13 / probe.state=connected）|
| ?view=chronicpain 自動 verify | ✅ PASS（4 セクション / 全 8 keyword hit / navigation 🩺 慢性疼痛 active）|
| production data（May 2026）| selfpay=1 件 / 自費売上 ¥3,850 / 達成率 1.9% / 再発予防未対応 1 件 / 症状別 unconnected |

### tools/live-check-runner 側 追加

- `scripts/verify-portal15-deploy.ts`（前 commit 済）— **本日実行 PASS**。今後の Portal deploy 後に再利用可
- `projects/jbiz/config.json` の `currentPhaseDeployment` を `@18` に更新、`webAppPortal15SetupUrl` / `webAppChronicPainViewUrl` を追加（前 commit 済）

### auth 運用 note

- `.chrome-profile` 配下の Google セッションは（少なくとも今回）有効期限 19h を超えても **session refresh が効いており login 不要だった**
- 再取得手順: chrome 全停止 → `chrome --remote-debugging-port=9222 --user-data-dir=.chrome-profile <JBIZ exec URL>` で 1 個起動 → CDP 9222 ready 待機 → `npm run save-auth` の順
- 14.2 KB の auth.json で setup + view ともに verify 通過

### 別 Claude セッション handoff note

本セッション開始時に **別 Claude プロセス PID 2448（09:12 起動）** を検出した。
ユーザ判断（「その Claude を停めて進める」）に従って **`Stop-Process -Id 2448 -Force` で停止**。git index.lock なし → 安全停止。

停止前にその Claude が行った作業の痕跡:
- workspace に commit `d0fd6dd docs(workspace): record shadow copy cleanup for JREC-SF01` を push 済み（履歴に残存・無害）
- **`life-design-project`** に 4 ファイル未 commit の変更を残置:
  - `logs/check-log.md` / `logs/completed-tasks.md` / `logs/pending-items.md` / `logs/work-log.md`
  - 内容は Nishio 初回面談関連の log 追記（最新 commit `8be2f8d` 等と整合）
  - **私（本セッション）は触らず原状保存**（破棄回避）

→ 本セッションでは life-design-project の作業に介入していない。
→ 次セッションで人間が中身を確認し、必要なら commit / 破棄判断してください。

---



このファイルは workspace 全体の最新セッション状態を 1 ページで把握するためのもの。
各プロジェクトの詳細状態は配下 repo の `PROJECT_STATUS.md` を参照する。

---

## 2026-05-14: Git dirty 根本原因解消（緊急対応）

### 発生事象

workspace 11 repo の同期確認で、2 repo に **HEAD は tracked だが disk から欠損** している
ファイルが存在し、毎日のように `git status` で dirty として表示されていた。

| repo | 件数 | 状態 |
|---|---|---|
| `gas-projects/jyu-gas-ver3.1` | 6 | active production code（`Ver3_core.js` 等）が disk から消失。`clasp push` 実行で GAS 上の production を削除する危険状態 |
| `hirayama-jyusei-strategy` | 18 | 旧構造の経営戦略文書（pre-Portal phase）。新版に置き換え済みだが `git rm` 漏れ |

### 切り分け結果

| 仮説 | 結論 |
|---|---|
| Git index / cache の問題 | **無関係**（`update-index --refresh` 後も `D` 表示） |
| OneDrive / 仮想化 | **無関係**（workspace は OneDrive 配下ではない） |
| 旧構造ファイルの `git rm` 漏れ | **PRIMARY CAUSE（JBIZ）** |
| JYU-GAS 中核ファイルの disk 欠損 | **SECONDARY CAUSE（緊急度 HIGH）** |
| 監査手順の不備 | **PROCESS CAUSE**（`git status --short` だけで判定していた） |

### 対応

| repo | 対応 |
|---|---|
| `gas-projects/jyu-gas-ver3.1` | `git checkout --` で 6 ファイル復元 |
| `hirayama-jyusei-strategy` | `git checkout --` で復元 → `git mv` で `docs/legacy/pre-portal-strategy/` 配下へ退避 |
| workspace | `tools/git-health-check.ps1` を新規追加 / `docs/GIT_DIRTY_ROOT_CAUSE_2026-05-14.md` で根本原因と再発防止を記録 |

### 検証

全 11 repo を `tools/git-health-check.ps1` で確認 → missing tracked 0 件、porcelain clean を確認。

### 再発防止ルール

1. status 判定は 2 系統必須 — `git status --porcelain=v1` + `git ls-files -d`
2. ファイル削除は `git rm` + commit まで完結（disk 削除のみで放置しない）
3. clasp push / 任意 deploy 前に `git ls-files -d` が空であることを確認
4. 旧構造は legacy 配下へ `git mv` で保管（即 `git rm` しない）
5. branch 全 checkout 監査をやめ、現 branch の pull のみに限定
6. `tools/git-health-check.ps1` を sync 前後で実行

詳細:
- [`docs/GIT_DIRTY_ROOT_CAUSE_2026-05-14.md`](./docs/GIT_DIRTY_ROOT_CAUSE_2026-05-14.md)（workspace 全体）
- [`gas-projects/jyu-gas-ver3.1/docs/JYU_GAS_SOURCE_OF_TRUTH_2026-05-14.md`](./gas-projects/jyu-gas-ver3.1/docs/JYU_GAS_SOURCE_OF_TRUTH_2026-05-14.md)
- [`hirayama-jyusei-strategy/docs/JBIZ_LEGACY_STRUCTURE_RECONCILE_2026-05-14.md`](./hirayama-jyusei-strategy/docs/JBIZ_LEGACY_STRUCTURE_RECONCILE_2026-05-14.md)

---

## 11 repo 一覧（health-check 結果）

| repo | branch | status | 備考 |
|---|---|---|---|
| `workspace` | feature/auto-dev-phase3-loop | clean | + 本書 / `docs/GIT_DIRTY_ROOT_CAUSE_2026-05-14.md` / `tools/git-health-check.ps1` |
| `desktop-work-status-overlay` | master | clean | — |
| `gas-projects/jrec-sf01-selfpay` | main | clean | — |
| `gas-projects/jyu-gas-ver3.1` | main | clean | 6 ファイル復元・SOURCE_OF_TRUTH 文書追加 |
| `hirayama-jyusei-strategy` | main | clean | 18 ファイル legacy 移動・RECONCILE 文書追加 |
| `life-design-project` | feature/nishio-initial-interview | clean | — |
| `subsidy-grants-projects` | main | clean | — |
| `training-program-platform-jp` | main | clean | — |
| `training-trend-analyzer` | master | clean | — |
| `treadmill-motor-crusher-project` | main | clean | — |
| `wildboar-member-management` | feature/wildboar-member-phase4 | clean | — |

---

## 未対応として残すもの

| 項目 | 状態 | 対応方針 |
|---|---|---|
| workspace `master` branch | 未更新（feature/auto-dev-phase3-loop と作業ツリー競合） | 通常運用では触らない。整理が必要なら別途タスク化 |
| workspace `recovery/restore-training-platform-source` branch | 同上 | 同上 |
| workspace upstream なし branch（backup/* 等 4 件） | 通常運用対象外 | 整理は別タスク |
| remote-only branch（workspace: `origin/claude/objective-volhard` `origin/feature/auto-dev-phase3` / JYU-GAS: `origin/feat/dakkyu-validation-spec-update` `origin/master`）| ローカル未取得 | 必要なら `git checkout -t` で取得 |

これらの未対応 branch は通常の sync では触らない（`tools/git-health-check.ps1` も branch checkout を行わない設計）。

---

## 次の作業候補

1. Wildboar Phase 14-4A / import 後確認
2. JBIZ Portal-15 chronic low-back KPI
3. Dashboard formula `#ERROR!` / `#NAME?` root fix
4. workspace branch 整理（`master` / `recovery/*` / `backup/*` の扱い）
