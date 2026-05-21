# workspace PROJECT_STATUS.md

最終更新: 2026-05-21（JREC-SF01 R-2R / R-2S live-check **全 PASS**: RR-1〜RR-8 8/8・RS-1〜RS-13 13/13 / auth.json 更新後 Playwright 実機検証完了）

## ✅ 2026-05-21: JREC-SF01 R-2R / R-2S live-check 全 PASS（auth 更新後 Playwright 実機検証）

| spec | テスト数 | PASS | FAIL | SKIP |
|---|---|---|---|---|
| R-2R `calendar-event-recovery-r2r.spec.ts` | 8 | **8** | 0 | 0 |
| R-2S `public-reservation-guidance-r2s.spec.ts` | 13 | **13** | 0 | 0 |

auth.json を 2026-05-21 22:04 に更新（Chrome CDP 経由）。全 21 テスト PASS。
R-2R @98 / R-2S @99 の実装が Playwright 実機検証で確認済みになった。

---

## ✅ 2026-05-16: Portal-7b machine-yasan 実 UI 確認 PASS（院長確認）

JBIZ @29 deploy 後、院長が `setupPortal7b` を手動実行し、`?view=businesses` で「マシン販売管理」カード表示を確認。既存 7 事業カードは不変。Portal-7b は **完了扱い**。コード変更なし、deploy 追加なし。

詳細: `hirayama-jyusei-strategy/PROJECT_STATUS.md`

---

## 2026-05-16: Portal-7b: machine-yasan を Business_Links + Portal Hub に追加 ✅ JBIZ @29 deploy

平山ビジネスポータルの事業ハブに `machine_yasan`（マシン販売管理）カードを追加。`gas/portal-gateway-v1.gs` で `seedBusinessLinks_` に 1 行追加 + 新規 `setupPortal7b()` + `appendPortal7bToRunLog()` + `doGet` action 分岐追加。既存 7 事業カードは不変。

### Deploy

| target | deploymentId | version |
|---|---|---|
| JBIZ Portal | `AKfycbw20tW...` | **@29**（URL 維持） |

### 追加内容（sort_order=25 / category=sales / status=building）

| 項目 | 値 |
|---|---|
| business_id | `machine_yasan` |
| 表示名 | マシン販売管理 |
| primary_url | Phase 1 Sheet `1Jj5D6su...` |

### setupPortal7b 実行（⚠️ 院長手動）

auth.json 期限切れで自動実行は FAIL。`hirayama-jyusei-strategy/PROJECT_STATUS.md` の手動実行手順（A: ブラウザ / B: GAS editor / C: auth 再取得 + verify script）を参照。

### Multi-Claude single writer rule 準拠

- 並行 Claude / node / clasp / playwright プロセスなし確認
- 3 repo git status clean 確認
- gas/ ↔ scripts/ SHA256 一致確認（`1593A9F7...`）
- clasp deployments で既存 @28 deploymentId 確認 → 同一 ID に @29 で URL 維持

詳細: `hirayama-jyusei-strategy/PROJECT_STATUS.md` および `hirayama-jyusei-strategy/docs/PORTAL_BUSINESS_LINKS_REVIEW_2026-05-16.md`

---

## 2026-05-16: JBIZ / 平山ビジネスポータル 可視化更新（Markdown 反映） ✅

可視化監査 (2026-05-16) で発見した「JBIZ NEXT_ACTIONS が @28 / Portal-17 で停止、@67〜@70 と machine-yasan Phase 1 未反映」を Markdown レベルで解消。

### 反映内容（JBIZ 側）

- `hirayama-jyusei-strategy/NEXT_ACTIONS.md`: 平山ビジネスポータル 可視化伝播ルール（7 チェック）追加 + JREC @67〜@70 / machine-yasan Phase 1 完了の進捗反映 + 反映保留項目を理由付きで記録
- `hirayama-jyusei-strategy/PROJECT_STATUS.md`: 冒頭セクション追加（反映済 / 反映保留 / 7 チェック適用結果）
- `hirayama-jyusei-strategy/docs/PORTAL_BUSINESS_LINKS_REVIEW_2026-05-16.md` 新規: machine-yasan を `Business_Links` に追加する設計メモ（business_id / category / sort_order / 反映タイミング案 / 次セッション user 確認事項）

### 反映保留 / 別タスク扱い（理由付き）

| 項目 | 保留理由 |
|---|---|
| `Business_Links` シート 8 行目 seed | `setupPortalN` 実行は deploy 同等のリスク。設計合意後に別タスクで実施 |
| Portal Hub UI で machine-yasan カード表示 | `gas/portal-gateway-v1.gs` 編集 + clasp deploy。今回 deploy なし |
| `Run_Log` への JREC @63〜@70 一括追記 | 経営判断 KPI に影響なし。次回 `setupPortalN` 系を回すタイミングで判断 |
| `Dashboard` への machine-yasan KPI | Phase 1 完了直後で KPI 集計未確立。Phase 2 以降の販売案件データが出てから |
| `Task_Queue` への新規タスク登録 | 妥当だが別タスク扱い |

### 永続運用ルールとして memory 保存

「workspace で棚卸し → JBIZ (平山ビジネスポータル) で平山が見える形に反映」を永続運用ルールとして memory に保存（`feedback_jbiz_visibility_propagation.md`）。各作業完了時に 7 チェックを習慣化する。

詳細: `hirayama-jyusei-strategy/docs/PORTAL_BUSINESS_LINKS_REVIEW_2026-05-16.md`

---

## 2026-05-16: git-health-check 監査輪に machine-yasan-management 追加 ✅ CLOSED

可視化監査 2026-05-16 で発見した重大事項 (3) を解消。

### 変更内容

- `tools/git-health-check.ps1` の `$repos` 配列に `machine-yasan-management` を追加（life-design と subsidy の間 / アルファ順）
- コメントで「parent gitignore 対象だが独立 repo として明示的に対象に含める」理由を追記

### 拡張後 health check 実行結果

| 項目 | 値 |
|---|---|
| 監査対象 repo 数 | **11 → 12** |
| 新規追加 | `machine-yasan-management` (branch: `feature/phase1-google-sheet` / HEAD `52e5246` / clean / 0-0 / missing 0) |
| unexpected dirty | なし |
| 既知 scope-out | `gas-projects/jrec-sf01-selfpay/.claude/` untracked のみ |
| missing tracked files (全 12 repo) | 0 |

### 副次発見

- `treadmill-motor-crusher-project` の HEAD が 22e8998 → d272c9a に進行（別セッション or 個別作業で更新）。本作業の対象外。

### 影響

- workspace 親 `.gitignore` で除外されている独立 repo も「ヘルスチェック対象」として明示できる仕組みが整った
- 将来 machine-yasan-management 系で missing tracked / dirty が発生したら、`tools/git-health-check.ps1` 1 回で検知できる

詳細: [`docs/PROJECT_VISIBILITY_AUDIT_2026-05-16.md`](./docs/PROJECT_VISIBILITY_AUDIT_2026-05-16.md) §「監査後フォローアップ」

---

## 2026-05-16: プロジェクト可視化 監査 ✅ docs-only

workspace 配下 12 repo の進捗・成果物・次アクションが「平山が見て分かる状態」かを棚卸し。実装・deploy なし。

### 主な発見

- 11 repo すべて **clean / 0-0 / missing tracked 0**（既知 scope-out: jrec-sf01 の `.claude/` のみ）
- workspace 親の **`PROJECT_STATUS.md` / `PROJECTS.md` / `ROADMAP.md` が 5/8〜5/14 で停滞**、@66〜@70 反映なし
- workspace に **`NEXT_ACTIONS.md` が存在しない**（一元管理ゼロ）
- **machine-yasan-management** が parent gitignore 対象で `tools/git-health-check.ps1` の監査輪から外れている（Phase 1 Sheet 完了済みにもかかわらず可視化漏れ）
- JBIZ NEXT_ACTIONS.md は @28 / Portal-17 で停止、JREC-SF01 @67〜@70 と machine-yasan Phase 1 完了が未反映

### 直近の動向（5/14〜5/16 で起きたこと）

| repo | 最新動向 |
|---|---|
| JREC-SF01 | @66/@67/@68/@69/@70 deploy + 院長実 UI 通し動作 PASS（説明同意削除 / 既存来院候補ボタン化 / 次回方針移動 / 受付待ちバッジ）|
| JBIZ | Portal-15/16/17 + 18-A/C/D CLOSED, 6 月レビュー準備 docs 完成, JREC fallback URL @28 正本化 |
| Wildboar | Phase 14-4D CLOSED @49（Members 65 名 4 桁ゼロ埋め統一）|
| machine-yasan | Phase 1 Google Sheet 正本作成完了（7 シート / 54 メーカー / 44 ドロップダウンルール / 試験 3 件投入）|
| JYU-GAS | Git dirty 緊急復元（6 中核ファイル）|

### 次にやるべき優先順位（抜粋）

1. workspace `NEXT_ACTIONS.md` 新規作成 → 本セッションで実施
2. machine-yasan を git-health-check 監査輪に入れる
3. JBIZ NEXT_ACTIONS.md に @67〜@70 + machine-yasan Phase 1 完了を追記
4. **6 月 1 日 月次レビュー実施**（経営アクション・最優先）
5. machine-yasan 試験案件削除 → 手入力運用開始（人間アクション）

詳細レポート: [`docs/PROJECT_VISIBILITY_AUDIT_2026-05-16.md`](./docs/PROJECT_VISIBILITY_AUDIT_2026-05-16.md)

---

## 2026-05-14: 問診票ライフサイクル完成 ✅ CLOSED（JREC-SF01 + JBIZ）

## 2026-05-14: 問診票ライフサイクル完成 ✅ CLOSED（JREC-SF01 + JBIZ）

本日で JREC-SF01 問診票機能 Q-1A〜Q-2C + Q-4 がすべて CLOSED。JBIZ Portal-17 で問診票由来 KPI 接続も完了。

```text
token 発行（QR / LINE テンプレ）
  → Google ログイン不要の公開問診票（@57）
  → SelfPayQuestionnaires 保存
  → 患者登録転記（Q-1B）
  → 来院カルテ転記（Q-1C）
  → JBIZ Portal 慢性痛 KPI に painLocation 接続（Portal-17 / @27）
```

| Phase | commit | live-check |
|---|---|---|
| Q-1A〜Q-1C | jrec-sf01 main | 39/39 PASS |
| Q-2A/Q-2B + Portal-17 | db1e6a7 / 5e8791c | 16/16 PASS |
| Q-2C + Q-4 | c6a2f70 | 14/14 + 11/11 PASS |

次候補: 実患者想定の通し運用確認 → Q-5 AI評価補助連動

---

## 2026-05-14: 6月初 月次レビュー準備 ✅ CLOSED（docs-only）

Drive 印刷物 4 ファイルは院長確認 OK。6月 1 日のレビューを `?view=chronicpain` 1 画面 + 本 doc で完結できる状態に整備。

- 5月 KPI snapshot: 自費 3,850 円 / 1.9% 達成 / 継続 0 件 / continuation_shortage_alert=TRUE / 慢性疼痛 3 症状 0 件
- 6月最低ライン: 継続自費 1 件以上 / alert FALSE / recall 記録 / 非継続理由記録 / 慢性疼痛 1 件以上
- live-check: chronic pain KPI fetch 正常応答（debug-fetch-chronic-pain-action.ts）

詳細: `hirayama-jyusei-strategy/docs/MONTHLY_REVIEW_PREP_2026-06.md`

---

## 2026-05-14: Portal-18-D 各事業ポータル「平山ポータルへ戻る」リンク ✅ CLOSED

3 事業 portal（JREC-SF01 `@53` / JYU-GAS `@16` / Wildboar PROD `@42`）の home に戻りリンクを追加。JBIZ Portal-18-C の JYU-GAS / Wildboar URL fallback default も設定（JBIZ `@26`）。

| 検証 | 結果 |
|---|---|
| verify-portal18d-return-links.ts | 3/3 PASS（visible + correctHref）|
| JREC-SF01 smoke | 16 PASS |
| JYU-GAS smoke | 28 PASS |
| Wildboar smoke | 64 PASS |
| JBIZ smoke | 256 PASS |

詳細: `hirayama-jyusei-strategy/docs/PORTAL_18_D_RETURN_LINKS_IMPLEMENTATION_2026-05-14.md`

---

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
