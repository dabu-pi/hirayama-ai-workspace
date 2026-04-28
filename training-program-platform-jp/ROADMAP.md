# ROADMAP

最終更新: 2026-04-28（Phase 2.5〜G-6a 完了 — 次回 Phase 2.7 PWA化から再開）

---

## 現在地（2026-04-26）棚卸しサマリー

### 完了済みエリア

| エリア | 状態 |
|---|---|
| トレーニング基本フロー（Programs→Train→Summary） | ✅ live 確認済み |
| セッション記録（重量・回数・完了チェック・ロック） | ✅ |
| Add Set / Swap / Add Exercise | ✅ |
| 休憩タイマー（手動起動 1:30 固定） | ✅ |
| ワークアウト経過タイマー（U-1） | ✅ |
| Reps 初期値（U-2）/ Target→Reps（U-3）/ Unlock楽観的更新（U-4） | ✅ |
| Day progression・re-enroll・idempotency guard | ✅ |
| Session History / Detail | ✅ |
| Home dashboard（Progress / Volume / e1RM Trend） | ✅ |
| IA redesign（BottomTabBar） | ✅ |
| Programs 4本（GZCLP / SS / UL / Dumbbell） + metadata + filter | ✅ |
| Auth（Email/Password + RLS + membership guard） | ✅ |
| **会員管理 Phase 1**（member_name / display_name /profile / admin集計） | **✅ 2026-04-26** |
| 限定公開（Vercel live） | ✅ |

### スタブのみ・未動作

| 項目 | 状態 | 場所 |
|---|---|---|
| 計算ボタン（1RM/Calc） | UIボタンあり・onClick未実装 | `WorkoutScreen.tsx:1348` |
| 休憩タイマー自動起動（セット完了後） | 手動起動のみ | `WorkoutScreen.tsx` |

### 確認待ち

| 項目 | 状態 |
|---|---|
| S-7: Restart Program ユーザー E2E | 静的検証済み・実ユーザー E2E 未確認 |
| B-6: sign up 429 | 外部レート制限（低優先） |

---

## 次フェーズ候補と優先度（2026-04-26 棚卸し）

### 高優先

| ID | タスク | 理由 | 影響範囲 | リスク |
|---|---|---|---|---|
| V-1 | S-7 Restart Program E2E確認 | 静的検証 PASS。LIVE E2E は完走 or Supabase 直接設定が必要 | Summary画面のみ | 低（コードは静的pass済み） |
| V-2 | 計算ボタン機能化（基本1RM） | ✅ 完了・LIVE確認済み（2026-04-26）Epley式モーダル。DB保存なし | WorkoutScreen上部ツールバー | — |

### 中優先

| ID | タスク | 理由 | 影響範囲 | リスク |
|---|---|---|---|---|
| C-8 | 5本目プログラム seed 追加 | ✅ 本番反映済み（2026-04-26）barbell-2day-base 一覧表示 PASS / detail/start/train は未確認 | seed SQL | — |
| U-5 | 休憩タイマー自動起動 | ✅ 完了（2026-04-26）既実装確認 + save失敗時キャンセル追加 | WorkoutScreen | — |
| A-1 | Admin プログラム登録UI | 現状SQLのみで管理者が新プログラムを追加できない | /admin 配下に新ページ | 中 |

### 低優先

| ID | タスク | 理由 |
|---|---|---|
| M-2 | /admin/members スマホカードUI | Phase 2 持ち越し |
| M-3 | ログイン回数（user_login_events） | Phase 2 持ち越し |
| M-4 | PC横スクロール改善 | Phase 2 持ち越し |
| M-5 | DB view / RPC 化 | 会員数増加時に検討 |
| C-9 | Week preview 拡張 | T1/T2/T3折りたたみ |
| P-1 | PWA 最適化 | 継続利用者増加後 |

---

## フェーズ構成提案（2026-04-26 版）

### Phase 2: トレーニング実行UX 完成（✅ 全タスク実機確認完了 2026-04-27）

- V-1: S-7 Restart E2E 確認 ✅ 静的検証済み
- V-2: 計算ボタン 1RM 実装 ✅ LIVE確認済み
- U-5: 休憩タイマー自動起動 ✅ 既実装確認 + save失敗修正
- C-8: 5本目プログラム seed ✅ 本番反映済み（detail/start/train 未確認）
- **H-1: 履歴カレンダー表示** ✅ LIVE確認済み（2026-04-26）
- **H-1b: 履歴カレンダー専用クエリ（SESSION_LIST_LIMIT 依存解消）** ✅ CLOSED (2026-04-28) スマホ実機確認PASS
- **H-1c: 月移動時カレンダーAPI取得（前月/次月 dot 更新）** ✅ CLOSED (2026-04-28) スマホ実機確認PASS
- **H-1d: 選択日詳細パネルのAPI化（SESSION_LIST_LIMIT 完全排除）** ✅ CLOSED (2026-04-28) スマホ実機確認PASS
- **M-1: 非activeユーザー向け表示整理（paused/cancelled ステータス別文言）** ✅ CLOSED (2026-04-28) スマホ実機確認PASS
- **D-1: 退会・アカウント削除申請と管理者退会処理** ✅ CLOSED (2026-04-28) typecheck/build OK — DB migration 手動適用待ち
- **D-1b: 管理者退会申請一覧 email JOIN バグ修正** ✅ CLOSED (2026-04-28) スマホ実機確認PASS（承認フロー確認は後日）
- **D-1c: 退会後データ保持方針の明文化・文言追加（1年保管方針）** ✅ CLOSED (2026-04-28) typecheck/build OK
- **D-1d: 退会済みユーザーの再申請防止・表示整理** ✅ CLOSED (2026-04-28) スマホ実機確認PASS（pending警告・承認フローは後日確認）
- D-6: 再入会処理（管理者が cancelled→active に戻す・退会後1年以内は既存データ保持） — 将来フェーズ
- **D-2: 退会承認時に cancelled_at を記録する** ✅ CLOSED (2026-04-28) DB migration 本番適用済み — 動作確認は次 PC へ持ち越し
- D-3: 退会後1年経過ユーザーを削除対象として管理画面に表示する — 将来フェーズ
- D-4: 管理者が最終確認して完全削除または匿名化できるようにする — 将来フェーズ
- D-5: Vercel Cron / Supabase Cron による自動処理検討 — 将来フェーズ
- **G-1: ジムタブ基本ダッシュボード** ✅ LIVE確認済み（2026-04-26）
- **G-2: gym_announcements テーブル + 管理者投稿** ✅ CLOSED (2026-04-27) DB migration 適用済み
- **G-3: お知らせ未読バッジ（localStorage 軽量版）** ✅ CLOSED (2026-04-27) 実機確認済み
- G-3-DB: お知らせ未読バッジ DB-backed 版（`gym_announcement_reads` テーブル、サーバーサイド read tracking）— 将来フェーズ
- **G-4: スポンサー・協力店のDB化** ✅ CLOSED (2026-04-27) DB migration 適用済み / 実機確認済み
- **G-5: トレーナー相談・パーソナルトレーニング申込フォーム** ✅ CLOSED (2026-04-27) DB migration 適用済み / 実機確認済み
- **Admin Hub: 管理トップページ `/admin`** ✅ CLOSED (2026-04-27) 実機確認済み
- **U-1: 個人カスタム種目ライブラリ** ✅ CLOSED (2026-04-27) DB migration 適用済み / 実機確認済み
- **U-2: ユーザー種目管理画面（編集/アーカイブ）** ✅ CLOSED (2026-04-27) 実機確認済み
- U-3: 自由トレーニングテンプレート保存 — 将来フェーズ
- U-4: ユーザー種目の前回セット表示・統計 — 将来フェーズ
- Googleカレンダー連携: Phase 3 以降

### Phase 2.5〜2.6 追加対応（✅ 完了 2026-04-28）

- **Phase 2.5 I18N: 利用者向け画面の全面日本語化** ✅ CLOSED / 実機確認PASS
- **Phase 2.5b: タグ・種目名の日本語化** ✅ CLOSED / 種目名実機確認PASS
- **Phase 2.5c: /programs タグ表示の日本語化（UIフォールバック追加）** ✅ CLOSED / 実機確認PASS
- **Phase 2.5d: プログラム名・目標・概要・週ラベルの日本語化** ✅ CLOSED / 実機確認PASS
- **Phase 2.6: 表示速度改善（loading.tsx 5ページ追加）** ✅ CLOSED / 実機確認PASS
- **D-2: cancelled_at 記録** ✅ コードレビューPASS / 管理者直接変更実機PASS / 退会申請フロー実機未確認
- **G-6a: /gym 前回トレーニング経過日数メッセージ** ✅ CLOSED / 実機確認PASS

### Phase 2.7: PWA化 / ホーム画面追加対応

- **PWA manifest 追加（アプリ名・アイコン・カラー設定）** ✅ 実装済み (2026-04-29)
- **service worker 最小構成（キャッシュなし）** ✅ 実装済み (2026-04-29)
- **iOS/Android ホーム画面追加確認** — Android ✅ PASS / iOS ⚠️ deferred（iPhone 未所持）
- **Phase 2.7: CONDITIONAL CLOSED (2026-04-29)** — iOS は後日確認
- **G-6b: PWA起動時の再開メッセージ強調** ✅ CLOSED (2026-04-29) — Android PASS / iOS deferred

### Phase M: 会員ライフサイクル管理（休会・退会ロジック）設計確定 (2026-04-29)

**ビジネスルール（ワイルドボア）:**
- 休会: 翌月1日開始 / 翌月振替確定後は翌々月1日（翌月分は再開時充当）
- 退会: 振替未確定→当月末 / 確定後→翌月末 / 鍵返却で500円返金
- 判定: 「翌月分口座振替データ確定済みか」フラグで制御

**実装タスク（優先順）:**
- **Phase M-A**: `billing_cutoff_records` migration + `/admin/billing` ページ ✅ CLOSED / LIVE_CHECK PASS (2026-04-29)
- **Phase M-B**: `membership_pause_requests` migration + `/profile` 休会申請 + `/admin/pause-requests` ✅ MAIN FLOW PASS (2026-04-29) — 一般会員テスト deferred
- Phase M-C: `account_deletion_requests` 拡張（effective_date / 鍵返却 / 500円返金）+ `/admin` 更新
- Phase M-D: `/profile`・`/gym` ユーザー表示更新

### Phase 3: コンテンツ・管理拡張

- A-1: Admin プログラム登録UI（SQLレス化）
- C-9: Week preview 拡張
- Program recommendation UI（level/tag ベース推奨）

### Phase 4: 会員管理強化

- M-2: /admin/members スマホカードUI
- M-3: ログイン回数（user_login_events + Auth Webhook）
- M-4: PC横スクロール改善
- M-5: DB view / RPC 化

### Phase 5: 成長・PWA

- PWA 最適化（オフライン耐性・起動速度）
- Analytics 拡張
- 一般ユーザー招待フロー

---

## 2026-04-13 Program Source Audit

### 固定した方針

- 有名プログラムは原典準拠版を正本にする
- 派生版は分離し、`source_fidelity = adapted` で扱う
- 原典がない internal template は `source_fidelity = custom` にする
- C-4 live 反映は監査後に判断する

### 今回の反映

- `gzclp-base`
  - original GZCLP base month へ修正
- `starting-strength-base`
  - `Starting Strength Phase 2 Base` として整理
- `upper-lower-base`
  - `custom` 扱いへ固定
- `programs` に source metadata を追加

### 次の live 反映方針（確定）

1. `gzclp-base-live-correction.sql` STEP 0（pre-check）
2. `gzclp-base-live-correction.sql` STEP 1（correction、transaction で slug 維持 + 構造置換）
3. `gzclp-base-live-correction.sql` STEP 2（post-check）
4. `program-metadata.sql`（tags / assignments upsert、3 programs 対象）
5. `upper-lower-base.sql`（upper-lower-base 未作成の場合のみ）

詳細は `docs/live-runbook-gzclp-correction.md` を参照。

### 参照

- `docs/program-source-audit.md`
- `docs/live-runbook-gzclp-correction.md`

最終更新: 2026-04-13（C-4 seed 追加 / Upper Lower Base — live 反映は手動 SQL 実行待ち）

---

## 現在地（2026-04-13）

### Phase A〜B 完了状態

| 項目 | 状態 |
|---|---|
| MVP ワークアウトフロー | Programs → Detail → StartSession → Train → Finish → Summary ✅ |
| Auth 基盤（Supabase Email/Password） | sign in / sign up + session cookie ✅ |
| RLS 全テーブル適用 | user-scoped テーブルに auth.uid() ポリシー ✅ |
| Exercise History 認可強化 | 未ログイン遮断 / server client 統一 ✅ |
| **限定公開判断** | **Go ✅（2026-04-13）** |
| **限定公開実施** | **開始済み ✅（2026-04-13）** |
| **本番 URL** | **`https://training-program-platform-jp.vercel.app`** |

### 直近タスク

| タスク | 状態 |
|---|---|
| 限定公開準備（デプロイガイド・チェックリスト作成） | ✅ 完了（2026-04-13） |
| 限定公開実施（Vercel デプロイ + live 確認） | ✅ 完了（2026-04-13） |
| C-1: seed 運用ルール docs 化 | ✅ 完了（2026-04-13） |
| **C-2: 2本目プログラム seed 追加** | **✅ 完了（2026-04-13, Starting Strength Base live 反映）** |
| **C-2b: seed 原本整合回復** | **✅ 完了（2026-04-13）** |
| **C-3: プログラム難易度・タグ管理（仕様固定）** | **✅ 設計完了（2026-04-13）** |
| **C-3a: metadata 基盤実装** | **✅ 完了（2026-04-13）** |
| **C-3a-live: metadata live 反映** | **✅ 完了（2026-04-13）** |
| **C-3b: `/programs` metadata 表示** | **✅ 完了 + live 修正済み（2026-04-13）** |
| **C-3c: Program Detail metadata 表示** | **✅ 完了 + live pass（2026-04-13）** |
| **C-3b/C-3c live 確認** | **✅ pass（2026-04-13）** |
| **Vercel Production Branch 統一** | **✅ `feature/auto-dev-phase3-loop` に変更済み** |
| **Programs 一覧 CTA UX 修正** | **✅ 完了（2026-04-13）** |
| **C-3d: Programs filter UI** | **✅ 完了（2026-04-13）** |
| **C-4: 3本目プログラム seed（Upper Lower Base）** | **✅ fully closed（2026-04-14）** |
| **C-5: gzclp-base live correction SQL + runbook** | **✅ fully closed（2026-04-14）** |
| **upper-lower-base tags live fix** | **✅ 完了（2026-04-14、live-only 補修）** |
| **C-6: Program Detail week preview** | **✅ 完了（2026-04-14）** |
| **C-7: 4本目 seed — Dumbbell Full Body Base** | **✅ fully closed（2026-04-14）** |
| **D-1: day progression — Summary Up Next / Program Complete UI** | **✅ 完了（2026-04-14）** |
| **D-3: idempotency guard — 同一 day 再実行で enrollment が 2 回進む問題修正** | **✅ 完了（2026-04-14）** |
| **D-2: Summary → 次 day 直接 CTA（Go to Next Day）** | **✅ 完了（2026-04-14）** |
| **H-1: Session History — 直近セッション一覧** | **✅ 完了（2026-04-14）** |
| **S-1: Exercise Swap MVP — 当日 session 限定の種目差し替え** | **✅ 完了（2026-04-14）** |
| **D-4: program 完走後 re-enroll フロー** | **✅ 完了（2026-04-14）** |
| **H-2: Session Detail — per-set weight/reps 詳細画面** | **✅ 完了（2026-04-14）** |
| **H-3: Active Program Progress — home dashboard** | **✅ 完了（2026-04-14）** |
| **H-3b: Progress Bar — completedDays / totalDays / %** | **✅ 完了（2026-04-14）** |
| **H-3c: Multi-enrollment — 複数 active enrollment の Home 表示** | **✅ 完了（2026-04-14）** |
| **H-4: Volume Trend first slice — enrollment ごとの session volume 推移** | **✅ 完了（2026-04-14）** |
| **H-4b: e1RM Trend — primary T1 lift の Epley e1RM 推移** | **✅ 完了（2026-04-14）** |
| **S-2: Home Resume/Start CTA — in-progress 判定で Resume/Start を切り替え** | **✅ 完了（2026-04-14）** |
| **S-3: /train entry resolution — blocked state で別 day 起動を防止** | **✅ 完了（2026-04-14）** |
| **S-4: session completion → enrollment advancement deterministic 化** | **✅ 完了（2026-04-14）** |
| **S-5: Cancel workout — in_progress session の明示的破棄導線** | **✅ 完了（2026-04-14）** |
| **S-6: Workout Summary 改善 — volume stat / cancelled 表示 / CTA 整理** | **✅ 完了（2026-04-14）** |
| **S-7: Restart Program フロー — completed summary からの再受講（新 enrollment INSERT）** | **✅ 完了（2026-04-15）/ 静的検証 + API smoke + DB unique index 確認 pass / live auto-deploy 済 / ユーザー E2E 待ち** |
| **Auth blocker fix — Home ErrorCard に Sign In 導線追加 / catch は unauth にフォールバック** | **✅ 完了（2026-04-15）/ S-7 E2E 再開可能化のための最小修正** |
| **H-4: IA redesign — BottomTabBar / smart redirect / enrollment guard** | **✅ 完了（2026-04-15）/ Programs・Train・History 責務整理 + 永続ナビ導入** |
| **H-4-E2E: IA E2E 検証 & 仕上げ** | **✅ 完了（2026-04-15）/ BackToHome リンク修正 / History→Summary 導線追加 / dev server E2E pass** |
| **U-1: Workout Timer — session.startedAt から経過秒数を 1 秒ごとに更新** | **✅ 完了（2026-04-16）** |
| **U-2: Reps 初期値 — target_reps_text を parse して repsDone draft を pre-fill** | **✅ 完了（2026-04-16）** |
| **U-3: Target セルをボタン化 — タップで Reps に反映（GZCL "3+" / "10" / "15+" 対応）** | **✅ 完了（2026-04-16）** |
| **U-4: Unlock 楽観的更新 — 即時 UI 反映 + エラー時ロールバック** | **✅ 完了（2026-04-16）** |
| B-6: sign up 429 再確認 | 低優先（外部レート制限） |

### 限定公開完了の確認結果

| 条件 | 状態 |
|---|---|
| 公開ルートが未ログインで表示される | ✅ live 確認済み |
| ワークアウトフローが通しで動く | ✅ live 確認済み |
| 他人のデータに触れない（owner guard + RLS） | ✅ 確認済み |
| 未ログインで保護ルートがリダイレクトされる | ✅ 確認済み |
| sign up 429 | ⚠️ 外部レート制限（blockerとしない） |

### 次フェーズの優先タスク（C-4 以降）

1. C-6 live push: Vercel へのデプロイ（push で自動）
2. 次候補: week preview の拡張（T1/T2/T3 表示 / セット数・レップ数折りたたみ）
3. 次候補: 4本目プログラム seed ← **C-7 として実装済み（live SQL 実行待ち）**
4. 次候補: ユーザー向けプログラム選択補助 UI（level/tag での推奨表示など）

### S-5 完了メモ（2026-04-14）

- **新規ファイル:** `app/api/workout-sessions/[id]/cancel/route.ts`
  - `in_progress` → `status = 'cancelled'`（`finished_at` は更新しない）
  - `cancelled` → 200 idempotent return
  - `completed` → 409（完了済みは取り消し不可）
  - `advanceEnrollmentAfterSessionComplete` は**呼ばない** — `current_program_day_id` 保持、次回 Start next workout 可能
  - `revalidatePath("/")` + `revalidatePath("/train")` で Home / Train を即時更新
- **型追加:** `types/workout.ts` に `WorkoutSessionCancelResponse` 追加
- **`WorkoutScreen.tsx` 変更:**
  - `isSessionCancelled` / `isSessionEnded` 変数を追加
  - `postCancelSession()` API 呼び出し関数を追加
  - `isCancelling` state を追加
  - `handleCancel()` — completedSetCount に応じた confirm dialog → cancel API → `router.push("/")`
  - topBar を `topBarActions` div で再構成: Cancel ボタン + Finish ボタン（`isSessionEnded` で Cancel を隠す）
  - Finish ボタンテキスト: Completed / Cancelled / Finishing... / Finish を分岐
  - `cancelledBanner` セクション追加
  - すべての mutation guard を `isSessionCompleted` → `isSessionEnded` に統一
- **`WorkoutScreen.module.css` 変更:** `.topBarActions` / `.cancelButton` / `.cancelledBanner` / `.finishButtonCancelled` を追加
- TypeScript エラーなし / tsc pass 確認済み

### S-4 完了メモ（2026-04-14）

- **発見した問題（recovery gap）:** `/api/workout-sessions/[id]/finish` の early-return パス（`session.status === 'completed'` 分岐）が `advanceEnrollmentAfterSessionComplete` を呼ばなかった。session 更新は成功したが enrollment advance がネットワークエラー等で失敗した場合、再試行してもこの分岐に入り enrollment が永続的にスタックする問題があった。
- **修正:** 早期リターン前にも `advanceEnrollmentAfterSessionComplete` を呼ぶ。`advanceEnrollmentAfterSessionComplete` 内の idempotency guard（D-3: `current_program_day_id !== session.program_day_id` で skip）により、enrollment がすでに進んでいれば no-op になる。
- **追加:** `revalidatePath("/")` を finish route に追加し、Home の progress / CTA が session 完了後に確実にリフレッシュされるようにした。
- **D-1〜D-4 で実装済みだった部分:**
  - `advanceEnrollmentAfterSessionComplete()` — enrollment 進行 + 最終 day 完了時の `status='completed'` への遷移
  - `findNextProgramDayId()` — week_number/day_number 順で次 day を解決
  - Finish ボタン UI（`WorkoutScreen.handleFinish()`）と不完了 set 確認ダイアログ
  - D-3 idempotency guard（`current_program_day_id === session.program_day_id` チェック）
  - Summary 画面の `isProgramCompleted` / Up Next / Restart Program CTA（D-1/D-2/D-4）
- **最終 day の設計:**
  - `findNextProgramDayId` が null → `enrollment.status = 'completed'`、`current_program_day_id` は最後の day のまま保持（情報損失を防ぐため null にしない）
  - Home の active-program クエリは `status = 'active'` のみを対象とするため、完了済み enrollment は自動的に非表示になる
- **変更ファイル:** `app/api/workout-sessions/[id]/finish/route.ts` のみ（2箇所）
- TypeScript エラーなし / tsc pass 確認済み

### S-3 完了メモ（2026-04-14）

- **解決した問題:** 同一 enrollment の別 day に in_progress session がある状態で新 session を開始しようとすると、idempotency guard をすり抜けて 2 つ目の in_progress session が INSERT されていた
- **解決アプローチ:** `/train` page への entry 前に `resolveTrainingEntry()` を呼び出し、enrollment 単位で in_progress 状態を確認してから処理を分岐
- **新ファイル:**
  - `lib/workout/train-entry.ts`: `resolveTrainingEntry(programDayId)` — enrollment を特定し in_progress sessions を確認。`mode: 'resume' | 'start' | 'blocked' | 'invalid'` を返す
  - `components/train/BlockedSessionScreen.tsx` / `.module.css`: blocked 時の警告 UI。"Resume [day label]" CTA のみ、"Start anyway" なし
- **変更ファイル:**
  - `types/workout.ts`: `TrainEntryResolution` 型を追加
  - `app/train/page.tsx`: `resolveTrainingEntry()` を呼び出し、blocked の場合は `BlockedSessionScreen` を返す。resume / start / invalid は既存 `findWorkoutSessionByDayId` フローへ通過
- **クエリ予算:** 最大 5 クエリ（program_days × 1 + program_weeks × 1 + program_enrollments × 1 + workout_sessions × 1 + day label × 1）— N+1 なし
- **"start anyway" は意図的に非実装:** blocked のまま強制起動するユースケースは現フェーズでは不要
- TypeScript エラーなし / tsc pass 確認済み

### C-7 / D-1 完了後の方針（2026-04-14 確定）

- program creation フェーズをいったん終了（C-7 fully closed）
- D-1 にて day progression の実態調査と Summary UI を完成
- **DB レベルの day advancement は C-7 以前から既に実装済みだった**
  - `advanceEnrollmentAfterSessionComplete` / `findNextProgramDayId` / `resolveStartProgramDayId` が稼働中
  - 欠けていたのは Summary ページへの "Up Next" / "Program Complete" の表示のみ → D-1 で補完済み

### D-1 完了メモ（2026-04-14）

- `types/workout.ts`: `WorkoutSummaryView` に `isProgramCompleted` / `nextProgramDayLabel` を追加
- `lib/workout/workout-summary.ts`: `findNextProgramDayId` を呼び出し next day ラベルを解決
- `WorkoutSummaryScreen.tsx`: Up Next カード（青）/ Program Complete カード（黄金）/ hero 色分岐を追加
- `WorkoutSummaryScreen.module.css`: `.heroCompleted` / `.nextUpCard` / `.completedCard` を追加
- `docs/day-progression-spec.md`: 仕様・edge case・未対応事項を記録
- TypeScript エラーなし / `/programs` 4 本表示・新 filter chip 確認済み

### D-2 完了メモ（2026-04-14）

- `types/workout.ts`: `WorkoutSummaryView` に `nextProgramDayId: string | null` / `programSlug: string | null` を追加
- `lib/workout/workout-summary.ts`:
  - `ProgramRow` に `slug` フィールドを追加、`selectProgram` で `slug` を取得
  - 次 day 解決時に `nextProgramDayId`（UUID）も保持し view に渡す
  - `program?.slug` を view に渡す
- `WorkoutSummaryScreen.tsx`:
  - `nextTrainUrl` を組み立て（`/train?program=<slug>&programDayId=<uuid>`）
  - 通常完了時 → Primary: **Go to Next Day**、Secondary: Back to Train
  - program 完走時 → Primary: Back to Programs
  - program なし → Primary: Back to Train
- TypeScript エラーなし

### 利用完遂モード — 次フェーズ候補

| 優先 | タスク | 概要 | 状態 |
|---|---|---|---|
| D-2 | Summary → 次 day への直接リンク | Back to Train の迂回を解消。current enrollment day に直接飛ぶ CTA | **✅ 完了** |
| D-3 | re-do 防止（同一 day 2 回 Finish 問題） | session.program_day_id と enrollment.current_program_day_id を比較して advance を skip | **✅ 完了** |
| H-1 | Session History — 直近セッション一覧 | `/session-history` ページ。実施日・prog・week/day・status・種目数 | **✅ 完了** |
| S-1 | Exercise Swap MVP | Train 画面で当日 session 限定の種目差し替え。Swapped バッジ表示 | **✅ 完了** |
| D-4 | program 完走後 re-enroll | Summary に "Restart Program" CTA。新 enrollment INSERT、旧は履歴保持 | **✅ 完了** |

### D-4 完了メモ（2026-04-14）

- DISCOVERY: `findOrCreateEnrollment` は completed enrollment を無視して新 enrollment を INSERT する — re-enroll のコアロジックは実装済みだった。UNIQUE INDEX は `WHERE status='active'` のみに適用されるため completed は複数残る
- 追加実装: Summary 画面に "Restart Program" CTA を追加
  - `types/workout.ts`: `WorkoutSummaryView` に `firstProgramDayId: string | null` を追加
  - `lib/workout/workout-summary.ts`: `selectFirstProgramDayId` (2クエリ: week_number=1 → day_number=1) を追加、`isProgramCompleted` 時にのみ呼び出し
  - `WorkoutSummaryScreen.tsx`: `restartUrl` を組み立て（`/train?program=<slug>&programDayId=<firstDayId>`）、完走時の actions を "Restart Program" → "Choose Another Program" に変更
- TypeScript エラーなし / tsc pass 確認済み
- `docs/d4-reenroll-spec.md` 作成

### S-1 完了メモ（2026-04-14）

- DISCOVERY: API（PATCH）・クライアント関数（postSwapExercise）・UI ハンドラ・モーダル・型定義・DB 列はすべて S-1 以前から実装済みだった
- 追加実装: Swapped バッジ（紫）を Train / Summary の exercise card ヘッダーに追加
  - `WorkoutScreen.tsx`: `wasSwapped === true` のとき「履歴へ」ヒントを「Swapped」バッジに差し替え
  - `WorkoutSummaryScreen.tsx`: `wasSwapped === true` のとき種目名の下に「Swapped this session」バッジを追加
  - 各 CSS module に `.swappedBadge` スタイル追加（`rgba(167,139,250,0.14)` / `#c4b5fd`）
- TypeScript エラーなし / modal 開閉・置換対象表示を preview で確認済み
- `docs/swap-spec.md` 作成（API 仕様・UI フロー・ブロック条件・スコープ外）

### H-1 完了メモ（2026-04-14）

- `types/workout.ts`: `WorkoutSessionListItem` / `SessionHistoryResult` 型を追加
- `lib/workout/session-list.ts`: `getSessionHistoryView()` を新規作成（5クエリ構成 — sessions → exercise counts → program_days → program_weeks → programs）
- `app/session-history/page.tsx`: Server Component（`force-dynamic`）を新規作成
- `components/history/SessionHistoryScreen.tsx` / `.module.css`: カードリスト UI を新規作成
  - 実施日・ステータスバッジ（Completed / In Progress / Cancelled）・プログラム名・Week/Day・種目数
  - completed セッションは "View summary →" リンクを表示
  - empty state / auth guard / error state あり
- `app/page.tsx`: "Session History" ボタン追加
- `docs/session-history-spec.md`: 仕様書を新規作成
- TypeScript エラーなし / preview snapshot で auth guard 動作確認済み

### C-2 完了メモ

- 2本目候補は `Starting Strength Base` を採用
- `GZCLP Base` との軽い差分確認:
  - 共通点: どちらも初心者向けのバーベル中心プログラム
  - 差分: `Starting Strength Base` はスクワット毎回 + A/B 交互 + Power Clean を含むクラシック novice 構成
- `seed/programs/starting-strength-base.sql` を live Supabase へ反映済み
- SQL 確認: `starting-strength-base` program 存在、3 weeks / 9 days / 27 day_exercises、`power-clean` 参照成立
- live 確認: `/programs` と `/programs/starting-strength-base` 表示成功、`Go to Train` の入口も確認済み

### C-2b 完了メモ

- live DB で手修正した日本語文言を `seed/programs/starting-strength-base.sql` へ戻し込み済み
- 日本語の実データ文字列は Unicode escape 形式へ変更し、別環境再投入時の文字化け耐性を上げた
- `docs/seed-program-guide.md` に UTF-8 保存と貼り付け時の注意を追記
- 「正本は repo、live はその反映結果」という前提を回復済み

### C-3 設計完了メモ

- `docs/program-metadata-design.md` を追加し、比較用 metadata の仕様を固定
- level 方針
  - `programs.level` は `beginner / intermediate / advanced` の 3 段階を正本とする
  - UI 表示は `Beginner / Intermediate / Advanced`
  - `novice` は現時点では不採用
- tag 方針
  - required: `goal`, `equipment`, `split`
  - optional: `focus`
  - `days_per_week` / `duration_weeks` / `level` は既存 structured field を使い、tag に重複させない
- 仮比較表
  - `gzclp-base` = `strength`, `barbell`, `full-body`
  - `starting-strength-base` = `strength`, `barbell`, `full-body`, `squat-focus`, `explosive`
- metadata の正本は code ではなく DB で持つ方針を採用

### C-3a 完了メモ

- `supabase/migrations/20260413_000009_program_metadata_foundation.sql`
  - `programs.level` canonical constraint を追加
  - `program_tags` / `program_tag_assignments` を追加
  - axis 制限と single-select axis 制約を追加
  - public 読み取り用 RLS policy を追加
- `seed/programs/program-metadata.sql`
  - `gzclp-base` と `starting-strength-base` へ metadata を付与する seed を追加
- read path
  - `types/programs.ts` に `ProgramLevel` / `ProgramTag` / `levelKey` / `tags`
  - `program-library.ts` で program ごとの metadata 読込を追加
  - metadata table 未適用環境では tags を空にして既存導線を維持
- 次は C-3b として `/programs` UI 表示へ進む

### C-3a-live 完了メモ

- live Supabase に migration / seed を反映済み
  - `program_tags_count = 5`
  - `program_tag_assignments_count = 8`
- `gzclp-base` は required 3 軸が各 1
- `starting-strength-base` は required 3 軸が各 1、`focus = 2`
- live `/programs` / `/programs/gzclp-base` / `/programs/starting-strength-base` で `Source: Supabase` の正常表示を確認

### C-3b 完了メモ

- `/programs` list card に metadata を追加
  - `level`
  - required tags: `goal / equipment / split`
  - optional `focus`: 最大 1 件
- `gzclp-base` と `starting-strength-base` の差分が一覧で見える状態に更新
  - 共通: `Strength / Barbell / Full Body`
  - 差分: `starting-strength-base` に `Squat Focus`

### C-3b live 修正メモ（2026-04-13）

- **症状:** 本番 `/programs` で `Beginner` / `3 days / week` / `3 weeks` は表示されるが metadata badge (`Strength / Barbell / Full Body / Squat Focus`) が未表示
- **原因:** `listProgramTagsByProgramId` が `program_tag_assignments` → `program_tags` の PostgREST 複合 FK 埋め込み (`!inner`) でサイレントエラーを起こし、空配列で fallback していた
  - FK は `(tag_id, axis) → program_tags(id, axis)` という複合構成で、PostgREST の関係解決が失敗していた可能性が高い
- **修正:** `lib/programs/program-library.ts` の `listProgramTagsByProgramId` を2本の単純クエリ + メモリ結合に変更（複合 FK join を廃止）
  1. `program_tag_assignments` から `(program_id, tag_id, axis)` を取得
  2. `program_tags` から tag 詳細を取得
  3. メモリ上で結合
### C-3c 完了メモ（2026-04-13）

- `components/programs/ProgramDetailScreen.tsx` に required tags + optional focus タグ行を追加
  - metaGrid（Level / Frequency / Duration）の直下に `tagRow` を追加
  - required: `goal / equipment / split`（tagBadge: ニュートラル）
  - optional: `focus`（focusBadge: 黄色）
  - tags が空の場合は tagRow を非表示
- `ProgramDetailScreen.module.css` に `.tagRow` / `.tagBadge` / `.focusBadge` を追加
  - ProgramsScreen と同じ badge スタイルを踏襲
- 一覧と詳細で badge の見た目・意味を統一済み

### Vercel Production Branch 運用メモ（2026-04-13）

- **発生した問題:** Vercel Production Branch = `master` に対し、開発は `feature/auto-dev-phase3-loop` で継続していたため `74b2718` 以降が production に反映されなかった
- **今回の対応:** `feature/auto-dev-phase3-loop` を `master` にマージ（`7883c1b`）して production 反映
- **今後の方針:**
  - Vercel Dashboard → Settings → Git → Production Branch を `feature/auto-dev-phase3-loop` に変更する
  - 変更後は push するたびに自動デプロイされる
  - `master` へのマージは不要になる
  - **この設定変更はダッシュボードで手動操作が必要（未実施）**
- **参照:** CLAUDE.md 「常用ブランチ: `feature/auto-dev-phase3-loop`」

### C-3d 完了メモ（2026-04-13）

- `/programs` に client-side filter bar を追加
  - Level チップ（一覧の programs から一意の level を自動導出）
  - Tag チップ（一覧の全 tags を sort_order 順に自動導出）
  - 選択チップは accent 色で activated 状態を明示
  - Level と Tag は AND 結合で絞り込み
  - filter active 時のみ `Clear ×` ボタンを表示
  - 0 件時は "No programs match the current filter." + Clear filters リンクを表示
- `ProgramsScreen` に `"use client"` + `useState` / `useMemo` を追加
- URL query 同期は今回見送り（programs 数が少ない間は不要）
- `ProgramsScreen.module.css` に `.filterBar` / `.chipGroup` / `.chip` / `.chipActive` / `.clearBtn` / `.clearLink` を追加
- local preview で動作確認済み（Squat Focus 選択 → 1件 / Clear → 2件復帰）

### C-4 完了メモ（2026-04-13）

- 3本目プログラム `Upper Lower Base` を追加
  - `seed/programs/upper-lower-base.sql` を新規作成（4 weeks × 4 days / week = 16 days）
  - 構成: Upper days（D1/D3）= Bench T1 4×5 + Press T2 3×6 + Row T2 3×8 / Lower days（D2/D4）= Squat T1 4×5 + Deadlift T1 1×5
  - `level = intermediate`, `days_per_week = 4`, `duration_weeks = 4`
  - 種目は `bench-press` / `overhead-press` / `barbell-row` / `squat` / `deadlift`（upsert で重複安全）
- `seed/programs/program-metadata.sql` を更新
  - `upper-lower` タグ（split 軸、sort_order 20）を追加
  - `upper-lower-base` の metadata を追加: `strength (goal)` / `barbell (equipment)` / `upper-lower (split)`
  - 3プログラム（gzclp-base / starting-strength-base / upper-lower-base）の正本として管理
- `lib/programs/program-catalog.ts` の mock エントリを `upper-lower-base` へ更新（slug / title / level / frequency / duration を整合）
- filter 効果:
  - Level フィルター: Beginner（2件）/ Intermediate（1件）で絞り込み可能に
  - Split タグ: `Full Body`（GZCLP / Starting Strength）vs `Upper / Lower`（Upper Lower）で差分が明確
- **live 反映は手動 SQL 実行待ち**（下記の順で Supabase Dashboard SQL Editor に貼り付けて実行）
  1. `seed/programs/upper-lower-base.sql`
  2. `seed/programs/program-metadata.sql`

---

## Phase 0: 企画固定

- 企画の本質を「日本語のプログラム配布型トレーニングアプリ」として固定する
- MVP の対象ユーザー、初期収録方針、管理運用前提を整理する
- 必須機能と後回し機能を切り分ける
- 用語、画面、データモデルの初期文書を整備する

## Phase 1: 土台作成

- Web 寄りのプロジェクト構成を作る
- 利用 UI / 管理 UI / seed データの置き場を分ける
- 初期データモデルと seed 方針を整える
- 単一管理者前提でも将来の複数ユーザー対応に耐える ID 設計を置く

## Phase 2: UI プロトタイプ

- スマホ優先の画面導線を固める
- ホーム、ライブラリ、プログラム詳細、今日のワークアウトの試作を作る
- 記録入力体験を最小構成で検証する
- PC 管理画面の最低限の導線を作る

## Phase 3: ワークアウト実行

- プログラム開始から当日メニュー生成までをつなぐ
- セット / 回数 / 重量 / RPE / メモを保存できるようにする
- 前回記録参照と履歴表示を実装する
- 実行中に迷わない UI と入力速度を優先する

## Phase 4: 管理画面

- 管理者ログインを整える
- プログラム登録 / 編集を実装する
- 種目マスタと作成者マスタを整備する
- 公開 / 非公開管理を実装する

## Phase 5: 複数ユーザー対応の土台整理

- ユーザー、ロール、参加中プログラムの境界を見直す
- 単一管理者前提の仮実装が複数ユーザー化で破綻しないか確認する
- 認証、権限、履歴所有の責務を整理する
- 将来のマイページ、継続記録、ユーザー別進捗に備える

## Phase 6: PWA 最適化

- ホーム追加しやすい UI を整える
- 起動速度、キャッシュ、オフライン耐性を強化する
- モバイルでの継続利用前提の UX を調整する
- 通知や再開導線など、PWA 的な改善余地を評価する
