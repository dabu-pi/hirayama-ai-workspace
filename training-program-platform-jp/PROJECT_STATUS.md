# PROJECT_STATUS

## 2026-04-19 S-12 — Go to Train navigation fix

### STATUS: fixed round-2 (2026-04-19, commit b17022f)

### ROOT_CAUSE (Round 1 — commit 5c0b430)

Naked `/train` (no `programDayId`) falls through to `getCurrentWorkoutSessionView()`, then `getActiveProgramView()`.
Train page only handled `actionType === "start"` explicitly; `actionType === "resume"` fell through to `redirect("/programs")`.

Additionally, `selectCurrentInProgressSession` and `selectSessionByDayId` in `train-session.ts` lacked `.is("archived_at", null)`,
allowing C-10-archived in-progress sessions to surface incorrectly when using the naked `/train` path.

### ROOT_CAUSE (Round 2 — commit b17022f)

Two additional issues remained after Round 1:

1. **`programSlug = ""` silently blocks `actionType === "start"`**: `selectProgramsBatch` (used inside
   `getActiveProgramView`) returns `[]` when RLS fails (`is_public = false` or query error), making
   `programSlug = program?.slug ?? ""` an empty string. The `start` condition had `primaryView.programSlug`
   as a truthy guard → empty string → condition fails → redirect to `/programs`.
   Fix: removed `programSlug` from the condition. `StartSessionScreen` still works with empty slug;
   only the "Back to Program" link degrades (links to `/programs` generically).

2. **Infinite redirect loop when `programSlug = ""` + `actionType === "resume"`**: Round 1's
   `redirect(primaryView.continueUrl)` builds `continueUrl = "/train?program=&programDayId=uuid"`.
   `getTrainProgramSelection("")` → empty string → `null` → `state: "none"` → naked path →
   `getCurrentWorkoutSessionView()` may return null → `getActiveProgramView()` → `resume` again → loop.
   Fix: added `primaryView.programSlug` guard before `redirect(continueUrl)` — falls through to
   `redirect("/programs")` instead of looping.

3. **Debug overlay**: Added `/train?debug=train` for authenticated users to see resolved state
   in-browser without Vercel log access.

### CHANGES

**Round 1** (`lib/workout/train-session.ts`, `app/train/page.tsx`):
- `train-session.ts`: Added `.is("archived_at", null)` to `selectCurrentInProgressSession` and `selectSessionByDayId`.
- `train/page.tsx`: Added `actionType === "resume"` → `redirect(continueUrl)` handler.

**Round 2** (`app/train/page.tsx`):
- `actionType === "start"`: removed `primaryView.programSlug` truthy guard.
- `actionType === "resume"`: added `primaryView.programSlug` guard before redirect (loop prevention).
- Added `start_missing_slug` `RedirectCause` for log correlation.
- Added `/train?debug=train` in-browser diagnostic overlay.

### MANUAL_CHECK

1. `/programs` → "続ける →" → verify WorkoutScreen loads (existing in-progress session)
2. `/programs` → "Go to Train" → verify StartSessionScreen or WorkoutScreen (not redirect to /programs)
3. Finish a session → from Summary → "Go to Train" → verify StartSessionScreen for next day
4. No active enrollment → "Go to Train" → redirect to /programs is still expected
5. Use `/train?debug=train` to inspect resolved state if still failing — check `redirectCause` and `primaryViewProgramSlug`

---

## 2026-04-18 C-11 — GZCLP T1 Progression (Phase 1): state management + live hint

### STATUS: implementation complete — Finish bug fixed (2026-04-18) — pending live migration + manual smoke test

### FINISH_BUG_FIX (2026-04-18)

**症状**: C-11 デプロイ後、/train の Finish ボタンが失敗。Cancel は成功。

**根本原因**: `countIncompleteSets` が Supabase クエリエラー時に `throw new Error(...)` していた。
これがフィニッシュルートの外側 try-catch に伝播し 500 を返していた可能性が高い。
- Cancel は `countIncompleteSets` を呼ばないため成功
- `updateT1ProgressionAfterSession` は内部 try-catch でサイレント処理済みだが、
  `countIncompleteSets` のみ非サイレント (throw) 設計だった
- C-11 デプロイ後に migration 未適用の状態でクエリが失敗すると、この throw が露出した

**修正**: `countIncompleteSets` のエラー時挙動を throw → `return 0` + console.warn に変更。
  - `sessionExercisesError` → warn + return 0
  - `incompleteCountError` → warn + return 0
  - フィニッシュルート全体の「エラーはサイレント処理、リクエストを止めない」方針に統一

**変更ファイル**: `app/api/workout-sessions/[id]/finish/route.ts`

### DESIGN_DECISION

New table `t1_progression_states` (not a column on `program_enrollments`) because:
- Each enrollment can have up to 4 T1 exercises (Squat / Bench / OHP / Deadlift —
  different exercises are T1 on different rotation days).
- A single-column JSONB approach would be opaque and unqueryable.
- Separate table gives FK integrity, per-exercise indexability, and easy extension to T2/T3.
- Follows the same "separate state table per concern" pattern as `exercise_swap_groups`.

`current_weight_kg` = recommendation for the NEXT session (already advanced after each finish).

Writes: admin client in `finish/route.ts` (bypasses RLS). Silent on any error.
Reads:  cookie client in `train-session.ts` (RLS select policy). Non-blocking.

### STATE_MODEL

```
t1_progression_states (
  enrollment_id, exercise_id   -- PK pair (unique constraint)
  phase                        -- '5x3' | '6x2' | '10x1' | 'retest_required'
  current_weight_kg            -- recommendation for next session
  last_result                  -- 'success' | 'fail'
  updated_at
)
```

Phase transitions:
- success → same phase, weight += 2.5kg
- fail:  5x3 → 6x2 → 10x1 → retest_required

AMRAP success = last visible set is_completed=true AND reps_done >= phase minimum
  (min parsed from target_reps_text "3+" → 3; fallback to phase constant)

### LOGIC

`lib/workout/t1-progression.ts` exports:
- `determineAmrapResult(lastSet, phase)` — pure, testable
- `computeNextState(current, result)` — pure, testable
- `phaseBadgeLabel(phase)` — "5x3" → "5×3+"
- `selectT1ProgressionHints(client, enrollmentId, exerciseIds)` — DB read
- `updateT1ProgressionAfterSession(sessionId, userId, dbClient)` — DB write hook

Bootstrap (first session, no existing state):
- Phase inferred from set count: 5 sets→5x3, 6→6x2, ≥9→10x1
- Weight seeded from session's first set weight

Idempotency: called only on primary completion path in finish/route.ts,
NOT on S-4 idempotent re-finish, to prevent double-advancing weight.

### UI

T1 exercise cards in WorkoutScreen show (from 2nd session onward):
```
[ Next: 82.5kg · 5×3+ ]
```
Displayed as an orange-tinted hint bar between exerciseHeader and swipeHint.
No hint on first session (state created on finish, visible next open).

### CHANGED_FILES

**New:**
- `supabase/migrations/20260418_000014_t1_progression_states.sql`
- `lib/workout/t1-progression.ts`

**Modified:**
- `types/workout.ts` — `T1ProgressionHint` type + `WorkoutExerciseBlock.t1ProgressionHint`
- `lib/workout/train-session.ts` — load hints via `selectT1ProgressionHints`, pass to `buildExerciseBlocks`
- `app/api/workout-sessions/[id]/finish/route.ts` — call `updateT1ProgressionAfterSession` on primary path
- `components/workout/WorkoutScreen.tsx` — hint bar in T1 card
- `components/workout/WorkoutScreen.module.css` — `.t1ProgressionHintBar` + label/value styles

### MANUAL_CHECK (after live migration)

1. Apply migration `20260418_000014_t1_progression_states.sql` in Supabase SQL editor
2. Complete a session with a T1 exercise (Squat, Bench, etc.)
   → Verify `t1_progression_states` row created: `SELECT * FROM t1_progression_states;`
   → Check `phase='5x3'`, `current_weight_kg = session_weight + 2.5` (if AMRAP passed)
3. Open `/train` for next session
   → T1 card should show orange hint bar: "Next: 82.5kg · 5×3+"
4. Complete that session with AMRAP fail (enter fewer reps than minimum)
   → Verify state updated: `phase='6x2'`, weight unchanged
5. No hint on T2/T3 cards (only T1 shows the bar)
6. No regression on existing sessions without progression state (no hint displayed)

### OPEN_POINTS

- Weight increment is fixed at 2.5kg for all T1 exercises.
  Typically Squat/DL should be +5kg; Bench/OHP +2.5kg. Configurable increment per
  exercise category is a natural next step (P-1 or C-12).
- `retest_required` state has no UI guidance yet — hint shows "Retest" badge.
  Deload flow (reduce weight by 10%, reset to 5x3) is a future iteration.
- T2/T3 progression: table is exercise-agnostic — extending is a matter of
  removing the `exercise_type = 'T1'` filter and adding separate logic per tier.

---

## 2026-04-18 C-10 - Training History Cleanup: soft-archive for sessions and enrollments

### STATUS: fully closed（2026-04-18 live 実機確認済み）

### DESIGN_DECISION

Soft-archive (not physical delete) for both `program_enrollments` and `workout_sessions`.
Pattern mirrors `workout_sets.deleted_at`: `archived_at IS NULL` = visible, non-null = hidden.

**What gets archived:**
- `workout_sessions`: test/abandoned sessions, in-progress sessions that blocked new starts
- `program_enrollments`: wrong-start programs, abandoned enrollments

**Archiving an in-progress session** is allowed and safe — after archiving, `train-entry`'s
in-progress check (now filtered by `archived_at IS NULL`) no longer sees it as blocking.

**Enrollment archiving cascades visually** — archived enrollment is excluded from
`selectActiveEnrollments`, so all related sessions also disappear from the active-program view
(without needing to archive them individually).

### CHANGED_FILES

**New migrations:**
- `supabase/migrations/20260418_000013_archived_at_columns.sql`
  - `archived_at timestamptz null` on both `program_enrollments` and `workout_sessions`
  - Partial indexes: `idx_program_enrollments_active_not_archived`, `idx_workout_sessions_history_not_archived`

**New API routes:**
- `app/api/workout-sessions/[id]/archive/route.ts` — POST, idempotent, ownership check
- `app/api/enrollments/[enrollmentId]/archive/route.ts` — POST, idempotent, ownership check

**Query filter additions (`.is("archived_at", null)`):**
- `lib/workout/enrollment.ts` — `findActiveEnrollment`, `advanceEnrollmentAfterSessionComplete`
- `lib/workout/active-program.ts` — `selectActiveEnrollments`, `selectInProgressSessionsForEnrollments`, `selectRecentSessionsForEnrollments`, `selectTrendSessions`
- `lib/workout/train-entry.ts` — enrollment lookup, in-progress session check
- `lib/workout/session-list.ts` — `selectSessions`

**New UI components:**
- `components/history/ArchiveSessionButton.tsx` — client component, confirm dialog + POST + router.refresh()
- `components/history/ArchiveSessionButton.module.css`

**Modified UI:**
- `components/history/SessionHistoryScreen.tsx` — ArchiveSessionButton per card
- `components/programs/ProgramsScreen.tsx` — enrollmentId added to ActiveEnrollmentInfo, Archive button in enrollment banner
- `components/programs/ProgramsScreen.module.css` — enrollmentBannerActions + enrollmentArchiveBtn styles
- `app/programs/page.tsx` — passes enrollmentId to ProgramsScreen

### LIVE_CONFIRMATION（2026-04-18）

- archived_at migration 適用済み
- Programs 画面で進行中 enrollment を archive → 正常に解除・非表示確認
- History 画面で session を 3 件 archive → 一覧から除外確認
- active program 判定・train フロー問題なし
- 既存データへの影響なし

---

## 2026-04-18 C-9 - gzclp-base-v2 Swap Pool (S-2): role-restricted accessory swap

### STATUS: fully closed（2026-04-18 live 実機確認済み）

### DESIGN_DECISION

T3 アクセサリースロット（order_index 4・5）に対して、role に紐づいたスワップ候補プールを追加。
pull スロット（order_index 3）は固定のまま。

データ設計: `exercise_swap_groups` + `exercise_swap_group_members` の 2 新テーブル。
`program_day_exercises.swap_group_slug` と `workout_session_exercises.swap_group_slug`（nullable）で連携。
NULL = 制限なし（Add Exercise と同じ全量リスト）— 既存プログラムへの影響ゼロ。

### POOL_DEFINITIONS

| group_slug | label | メンバー（spec + 現在のデフォルト） |
|---|---|---|
| `squat-aux` | Squat Assistance | Leg Press / Hack Squat / Bulgarian Split Squat / Leg Extension |
| `bench-aux` | Bench Press Assistance | Chest Press / DB Bench Press / Dips / Triceps Pushdown / Incline DB Press |
| `deadlift-aux` | Deadlift Assistance | Leg Curl / Good Morning / Hip Thrust / Back Extension / Romanian Deadlift |
| `ohp-aux` | OHP Assistance | Lateral Raise / Rear Delt Fly / DB Shoulder Press (soft) |

### POOL_ASSIGNMENT (gzclp-base-v2)

| Workout | order 4 (T1-sup) | pool | order 5 (T2-sup) | pool |
|---|---|---|---|---|
| A1 | Leg Curl | deadlift-aux | Triceps Pushdown | bench-aux |
| B1 | Lateral Raise | ohp-aux | Back Extension | deadlift-aux |
| A2 | Incline DB Press | bench-aux | Leg Extension | squat-aux |
| B2 | Romanian Deadlift | deadlift-aux | Lateral Raise | ohp-aux |

### CHANGES

| ファイル | 変更内容 |
|---|---|
| `supabase/migrations/20260418_000011_exercise_swap_groups.sql` | 新規: `exercise_swap_groups` + `exercise_swap_group_members` テーブル + RLS |
| `supabase/migrations/20260418_000012_swap_group_slug_columns.sql` | 新規: `program_day_exercises` + `workout_session_exercises` に `swap_group_slug` 追加 |
| `seed/programs/gzclp-base-v2-swap-groups.sql` | 新規: 8 新種目 upsert + 4 グループ作成 + メンバー追加 + gzclp-base-v2 への assignment |
| `types/workout.ts` | `WorkoutExerciseBlock` に `swapGroupSlug` 追加 |
| `lib/workout/start-session.ts` | `swap_group_slug` を `program_day_exercises` から `workout_session_exercises` へコピー |
| `lib/workout/train-session.ts` | `WorkoutSessionExerciseRow` + select + return に `swap_group_slug` 追加 |
| `components/workout/WorkoutScreen.tsx` | `openSwapModal(blockId, groupSlug?)` + `loadExercises(groupSlug?)` + swap_group param 連携 |
| `app/api/exercises/route.ts` | `?swap_group=<slug>` パラメータで候補を絞り込む |
| `components/workout/WorkoutScreen.module.css` | `.swapGroupHint` スタイル追加 |

### NEW_EXERCISES (8種目 — pool-only)

| slug | name_en | category |
|---|---|---|
| `chest-press` | Chest Press | chest |
| `dips` | Dips | chest |
| `leg-press` | Leg Press | legs |
| `hack-squat` | Hack Squat | legs |
| `bulgarian-split-squat` | Bulgarian Split Squat | legs |
| `good-morning` | Good Morning | back |
| `hip-thrust` | Hip Thrust | legs |
| `rear-delt-fly` | Rear Delt Fly | shoulders |

### LIVE_APPLY

Supabase Dashboard > SQL Editor で以下の順に実行:
1. `supabase/migrations/20260418_000011_exercise_swap_groups.sql`
2. `supabase/migrations/20260418_000012_swap_group_slug_columns.sql`
3. `seed/programs/gzclp-base-v2-swap-groups.sql`

### MANUAL_CHECK (live 実機 — 確認済み 2026-04-18)

| 確認項目 | 結果 |
|---|---|
| seed 適用後 24/24 rows に swap_group_slug 設定 | ✅ PASS |
| A1 の Leg Curl Swap → deadlift-aux 5 種目のみ（Good Morning / Back Extension / Hip Thrust / Romanian DL / Leg Curl） | ✅ PASS |
| 候補制限が正常動作 | ✅ PASS |
| swap 実行後 T3 バッジ維持 | ✅ PASS |
| order 3（pull 枠）は制限なし（仕様通り） | ✅ PASS |
| 既存プログラムへの影響なし | ✅ PASS |

---

## 2026-04-18 C-8 - GZCLP 5-Exercise Base (gzclp-base-v2) seed 追加

### STATUS: seed 実装完了 — live SQL 実行待ち

### DESIGN_DECISION

既存 `gzclp-base` への上書きではなく、新 slug `gzclp-base-v2` として追加。
理由: live DB に active enrollment が存在する可能性があり、構造変更は mid-program ユーザーに
予期しない変更をもたらす。既存プログラムは保持し、v2 は新規 enrollment の選択肢として追加する。

### CHANGES

| ファイル | 変更内容 |
|---|---|
| `seed/programs/gzclp-base-v2.sql` | 新規作成。7 種目追加 + プログラム全構造（4 weeks × 3 days × 5 exercises = 60 rows） |
| `seed/programs/program-metadata.sql` | gzclp-base-v2 を soft 追加（not null check 付き、既存 seeds が v2 なしで動作するよう互換維持） |
| `lib/programs/program-catalog.ts` | mock fallback カタログに gzclp-base-v2 エントリ追加 |
| `docs/program-source-audit.md` | gzclp-base-v2 監査エントリ追加（adapted / DESIGN_DECISION 記録） |
| `docs/week-preview-spec.md` | gzclp-base-v2 の確認計画を追記 |

### NEW_EXERCISES (7種目)

| slug | name_en | category |
|---|---|---|
| `leg-curl` | Leg Curl | legs |
| `triceps-pushdown` | Triceps Pushdown | arms |
| `lateral-raise` | Lateral Raise | shoulders |
| `back-extension` | Back Extension | back |
| `incline-dumbbell-press` | Incline Dumbbell Press | chest |
| `leg-extension` | Leg Extension | legs |
| `romanian-deadlift` | Romanian Deadlift | back |

### PROGRAM_STRUCTURE

```
A1: Squat(T1) / Bench(T2) / Lat Pulldown(T3) / Leg Curl(T3) / Triceps Pushdown(T3)
B1: OHP(T1)   / Deadlift(T2) / DB Row(T3)    / Lateral Raise(T3) / Back Extension(T3)
A2: Bench(T1) / Squat(T2)   / Lat Pulldown(T3) / Incline DB Press(T3) / Leg Extension(T3)
B2: Deadlift(T1) / OHP(T2)  / DB Row(T3)     / Romanian Deadlift(T3) / Lateral Raise(T3)

Week 1: A1 / B1 / A2  |  Week 2: B2 / A1 / B1
Week 3: A2 / B2 / A1  |  Week 4: B1 / A2 / B2
```

### CODE_CHANGES

なし。start-session.ts / WorkoutScreen.tsx / train-session.ts はすべてデータ駆動で
order_index 順に任意件数の種目を処理するため、コード変更不要。

### LIVE_APPLY

Supabase Dashboard > SQL Editor で以下の順に実行:
1. `seed/programs/gzclp-base-v2.sql` (新 program + exercises + tag assignments)
2. `seed/programs/program-metadata.sql` (任意 — タグ情報の再確認・再適用)

Post-check: 60 rows が返ること確認 (seed ファイル末尾の確認クエリを実行)

### MANUAL_CHECK (live 反映後)

- [ ] `/programs` に `GZCLP 5-Exercise Base` が表示される
- [ ] `/programs/gzclp-base-v2` の week preview に 5 種目が `·` 区切りで表示される
- [ ] `/train?program=gzclp-base-v2&programDayId=...` で 5 種目記録できる
- [ ] T1/T2/T3 バッジが正しく色分けされる（T3 が 3 種目並ぶ）
- [ ] gzclp-base（既存）が壊れていないこと

## 2026-04-17 U-19 - Cancel lookup failure: explicit-token client で cookie re-read 問題を根本修正

### STATUS: fully closed（2026-04-18 live 実機確認済み）

### DEPLOYMENT_CHECK

commit 541a27a (admin client fallback) がデプロイ済みでも live で失敗している。
→ `SUPABASE_SERVICE_ROLE_KEY` が Vercel 本番環境に未設定の場合、
  `hasSupabaseServiceRoleEnv()` が false → server client (cookie ベース) にフォールバック → 同じ JWT 問題が継続。

### VERCEL_ENV_CHECK

`SUPABASE_SERVICE_ROLE_KEY` が Vercel に設定されているか確認が必要。
未設定の場合: 今回の修正（explicit-token client）が根本対処になる。
設定済みの場合: admin client が使われるはずだが、それでも失敗するなら別の問題がある。

### ROOT_CAUSE (確定)

`@supabase/ssr` の `createServerClient` は DB クエリのたびに `getAll()`（= リクエスト Cookie）から
access token を再読み込みする可能性がある。
`auth.getUser()` がトークンをリフレッシュしてもリクエスト Cookie は変わらない（Set-Cookie ヘッダは
レスポンス側に書かれ、同一リクエスト内では古い Cookie が読まれ続ける）。
→ PostgREST が失効済み JWT を受け取り `PGRST301` を返す → `findOwnedWorkoutSession` が throw →
"Workout session lookup failed."

### CHANGES (U-19)

| ファイル | 変更内容 |
|---|---|
| `lib/supabase/server.ts` | `createSupabaseTokenClient(accessToken)` を追加: Bearer トークンを Authorization ヘッダに直接セットするクライアント生成関数 |
| `lib/workout/session-access.ts` | `getAuthenticatedWorkoutContext()` を修正: auth.getUser() 後に auth.getSession() でトークンを取得し、explicit-token client を DB クライアントとして返す。Cookie 再読み込みを完全に回避 |

### 修正後の認証フロー

```
auth.getUser()  → Cookie から JWT を取得してネットワーク検証 → 必要に応じてリフレッシュ
auth.getSession() → in-memory から最新 access_token を取得（ネットワーク不要）
createSupabaseTokenClient(token) → Authorization: Bearer <token> を全リクエストに付与
DB クエリ → 常に検証済み・最新トークンを使用（Cookie 再読み込みなし）
```

admin client 優先順位（cancel/finish route）:
1. `SUPABASE_SERVICE_ROLE_KEY` あり → admin client（RLS バイパス）
2. なし → explicit-token client（getSession() からの JWT）
3. session なし（稀）→ cookie client（従来と同じ、フォールバック）

### TESTS: typecheck ✅ / build ✅

### MANUAL_CHECK (live 実機 — 確認済み 2026-04-18)

| 確認項目 | 結果 |
|---|---|
| Cancel → "Workout session lookup failed." が出ない | ✅ PASS |
| Finish → /workout-summary/{id} が表示される | ✅ PASS |

## 2026-04-17 U-18 - Cancel / Finish: session lookup failure 根本原因特定 + admin client 修正

### STATUS: 修正実装完了 — live 実機手動確認待ち

### ROOT_CAUSE

`auth.getUser()` は Supabase Auth API へのネットワーク呼び出しでトークンを検証・リフレッシュするが、
その後の PostgREST クエリには JWT を Authorization ヘッダーとして直接渡す。
Route Handler 内で JWT が期限切れになっていた場合、`auth.getUser()` はリフレッシュ成功・userId 取得できるが、
PostgREST 側で同 JWT の期限切れを検出し `PGRST301` エラーを返す可能性がある。
この場合 `maybeSingle()` が `{ data: null, error: { ... } }` を返し → `findOwnedWorkoutSession` が throw →
内側の catch が "Workout session lookup failed." (500) を返していた。

補足: `eb7ab3e` で cancel/finish が admin client → server client に変更されたが、
ワークアウト中に JWT が期限切れになるとこの問題が顕在化する。

### LOOKUP_FAILURE_TYPE

`findOwnedWorkoutSession` が throw する = Supabase query error (error != null)。
RLS や "no row" ではなく、JWT/PostgREST レベルのエラー。

### CHANGES

| ファイル | 変更内容 |
|---|---|
| `lib/workout/session-access.ts` | `findOwnedWorkoutSession`: Supabase error 発生時に errorCode/errorMessage/errorHint/errorDetails を構造化ログ出力してから throw |
| `app/api/workout-sessions/[id]/cancel/route.ts` | admin client 導入: `SUPABASE_SERVICE_ROLE_KEY` がある場合は `createSupabaseAdminClient()`、なければ server client にフォールバック。lookup と update 両方を `dbClient` に切り替え。catch の Error シリアライズも修正 |
| `app/api/workout-sessions/[id]/finish/route.ts` | 同上 (cancel と同じパターン) |

セキュリティ維持: userId は引き続き `auth.getUser()` (server client) から取得し、
DB クエリには `.eq("user_id", userId)` を明示的に付けている。admin client は RLS をバイパスするが
アプリレベルのオーナーチェックで同等の保証を維持する。

### MANUAL_CHECK (live 実機 — 要確認)

- ログイン済みセッションで Cancel ボタン押下 → "Workout session lookup failed." が出ない
- Cancel 成功後 `/` → `/train` に戻り StartSession 画面が出ること
- Finish ボタン押下 → `/workout-summary/{id}` に遷移すること
- Vercel ログで `dbClientType: "admin"` が出ていること（admin client が使われていることの確認）

### TESTS

- `npm run typecheck` ✅
- `npm run build` ✅

## 2026-04-17 U-17 - Cancel / Finish write path コード検証 + build 確認

### STATUS: 完了（コード解析 + typecheck + build pass）

live 実機テスト（認証済みセッション）は credentials がないため local preview では未実施。
コード解析・静的検証で正常を確認。

### 検証結果

| 確認項目 | 結果 |
|---|---|
| `getAuthenticatedWorkoutContext()` が auth エラー時に throw しない（U-14 fix） | ✅ 適用済み |
| cancel route: 401/404/409/500 各パスの分岐 | ✅ 正常 |
| finish route: 401/404/409(requiresConfirmation)/409(conflict)/500 各パスの分岐 | ✅ 正常 |
| `postCancelSession`: `!response.ok` で throw → `handleCancel` の catch で `errorMessage` セット | ✅ 正常 |
| `postFinishSession`: 409 + requiresConfirmation は throw せず confirm ダイアログへ | ✅ 正常 |
| Cancel 成功後 `router.push("/")` → authenticated user は `/login` に飛ばない | ✅ `HomePage` は `isAuthenticated` が true の場合 `/login` に遷移しない |
| Finish 成功後 `router.push(payload.summaryPath)` = `/workout-summary/${id}` | ✅ 正常 |
| `npm run typecheck` | ✅ pass |
| `npm run build` | ✅ pass |

### 残確認項目（ユーザー手動 live 実機）

- ログイン済みセッションで Cancel → `/` → `/train` に戻り StartSession 画面が出ること
- ログイン済みセッションで Finish → `/workout-summary/{id}` が表示されること

### 追加修正なし

コード・ルート・クライアント側いずれも期待通り。追加修正は不要と判断。

## 2026-04-17 U-16 - 未認証導線 live 手動確認（0cd5545 検証）

### STATUS: 完了（未認証フロー全シナリオ ✅）

| シナリオ | 結果 | 備考 |
|---|---|---|
| Cookie クリア後 `/` → `/login` へ遷移 | ✅ PASS | pathname = /login 確認 |
| 未ログインで `/train` → `TrainAuthRequired` 表示 | ✅ PASS | 「LOGIN REQUIRED」「ログインが必要です」表示 |
| `ログインへ` ボタン → `/login` 遷移 | ✅ PASS | click 後 pathname = /login 確認 |
| `プログラム一覧へ戻る` → `/programs` 遷移 | ✅ PASS | click 後 pathname = /programs 確認 |
| ログイン後 `/train` 正常表示 | 🔲 要手動確認 | credentials 不要で代替確認不可 |
| 既存ログイン済み導線（Go to Train等）正常 | 🔲 要手動確認 | 同上 |

### スクリーンショット確認

`TrainAuthRequired` 画面が正しいスタイルで表示された（オレンジバッジ + ログインへボタン + プログラム一覧リンク）。
BottomTabBar の Train タブもハイライトされている（正常）。

### 残確認項目（ユーザー手動）

認証済み状態での確認（live または local .env.local ログイン後）:
- ログイン → `/` → `/train` へ正常リダイレクトされること
- `/train` でワークアウト画面が表示されること
- Cancel / Finish が正常に動作すること（U-14 の修正効果確認）

### Changes / 修正なし

今回確認のみ。routing は期待通りに動作しているため追加修正なし。

## 2026-04-17 U-15 - 未認証ユーザーの /train ルーティング正常化・ログイン導線追加

### STATUS

| Item | Result |
|---|---|
| root cause 特定: 未認証時に `/train` が mock WorkoutScreen を表示 | **confirmed** |
| `app/page.tsx`: 未認証 → `/login` リダイレクト | **implemented** |
| `app/train/page.tsx`: 早期認証チェック → `TrainAuthRequired` 表示 | **implemented** |
| `components/train/TrainAuthRequired.tsx` 作成 | **implemented** |
| `lib/workout/train-session.ts`: 未認証時 null 返却に修正 | **implemented** |
| TypeScript / build | **pass** |

### Root Cause

複数の問題が重なっていた。

**① `getCurrentWorkoutSessionView()` が未認証時に mock セッションを返していた**
```typescript
if (!userId) {
  return getMockWorkoutSession();  // ← 未認証でも workout 画面が出た
}
```
`train/page.tsx` は `session` が truthy なら `WorkoutScreen` を表示するため、
未認証ユーザーが `/train` に直接アクセスすると mock exercises が見えていた。
その後のボタン操作で API が 401 → "ログインが必要です。" が出るが、ログインへのリンクがない。

**② `app/train/page.tsx` に認証ガードがなかった**
`!userId` のフォールスルーパスが最終的に `WorkoutScreen(getMockWorkoutSession())` に落ちていた。

**③ `app/page.tsx` が未認証ユーザーを `/programs` に送っていた**
`/programs` は public なので正しいが、ユーザー体験として「ワークアウト開始 → /train → 詰む」の導線が残っていた。

### Fix

1. `app/page.tsx`: `!isAuthenticated → redirect("/login")` に変更。未ログインはまず認証を促す。
2. `app/train/page.tsx`: ページ先頭で `getAuthenticatedWorkoutUserId()` を呼び、未認証なら即 `<TrainAuthRequired />` を返す。
3. `components/train/TrainAuthRequired.tsx`: ログインへのボタン + プログラム一覧へのリンクを持つシンプルなエラー画面。
4. `lib/workout/train-session.ts`: `getCurrentWorkoutSessionView()` の未認証時 `getMockWorkoutSession()` → `null` に変更。エラーキャッチ時も同様。

### Routing Table (after fix)

| 状態 | `/` 遷移先 | `/train` 直アクセス |
|---|---|---|
| 未認証 | `/login` | `TrainAuthRequired`（ログインボタン + Programs リンク） |
| 認証済み + enrollment あり | `/train` | workout or StartSession |
| 認証済み + enrollment なし | `/programs` | StartSession or mock fallback |

### Manual Check

- Cookie クリア後に `/` → `/login` へ飛ぶことを確認
- Cookie クリア後に `/train` 直アクセス → "ログインが必要です" 画面とボタンが出ることを確認
- 認証済みで `/` → `/train` への正常ルーティングが変わっていないことを確認

## 2026-04-17 U-14 - Cancel route: auth error throw が outer catch に伝播する問題を修正

### STATUS

| Item | Result |
|---|---|
| root cause 特定: `getAuthenticatedWorkoutContext()` が auth エラー時に throw | **confirmed** |
| `session-access.ts`: auth エラーを throw せず `{ client, userId: null }` で返すよう変更 | **implemented** |
| `cancel/route.ts`: outer catch ログに name / message / stack を追加 | **implemented** |
| TypeScript / build | **pass** |

### Root Cause

`eb7ab3e` で導入した `getAuthenticatedWorkoutContext()` が `auth.getUser()` エラー時に `throw` するが、
cancel route ではこの呼び出しが内側の try-catch（lookup を囲む部分）より前に位置するため、
例外が outer catch まで伝播して "Unexpected error occurred while cancelling workout session." になっていた。

```
POST /cancel
  try {                                      ← outer try
    await getAuthenticatedWorkoutContext()   ← ここで throw → outer catch に直行
    try {
      findOwnedWorkoutSession(...)           ← inner try-catch (lookup 専用)
    } catch (lookupError) { ... }           ← auth エラーはここでは捕まらない
    ...
  } catch (error) {
    // "Unexpected error occurred while cancelling workout session."  ← ここへ落ちる
  }
```

### Fix

`getAuthenticatedWorkoutContext()` の auth エラー処理を throw から `console.warn + return { client, userId: null }` に変更。
- `userId === null` のケースは各 route が既に `!userId → 401` で正しく処理済み
- expired token / missing session / network error はすべて「未認証」として 401 で応答する（500 ではなく）
- 再発デバッグのため outer catch も `err.name / message / stack` をログに含めるよう強化

### Reproduction Pattern

live 環境で token が期限切れ・refresh 失敗・cookie 破損のいずれかが起きると `auth.getUser()` がエラーを返す。
旧 `getAuthenticatedWorkoutUserId()` はエラーを無視して null を返していたため 401 になっていたが、
`getAuthenticatedWorkoutContext()` への置き換え後は throw するようになり 500 に変わった。

### 再発防止観点

`getAuthenticatedWorkoutContext()` を呼ぶ全 route が恩恵を受ける（cancel 以外の finish / unlock / complete も同様に修正済み）。
auth エラーは原則 throw せず `userId: null` → 401 で処理する。予期しない例外だけ outer catch が 500 を返す設計に統一。

## 2026-04-17 U-13 - Live mutation auth/query client unification
### STATUS

| Item | Result |
|---|---|
| `/train` write path の共通 auth/query 差分を調査 | **implemented** |
| complete / unlock / cancel / finish の構造化ログ追加 | **implemented** |
| `/train` mutation route を単一 Supabase client 化 | **implemented** |
| TypeScript / build | **pass** |

### Notes

- root cause は、`/train` mutation route 群だけが「`auth.getUser()` 用 client」と「lookup / update 用 client」を別々に作っていたことだと判断しました。
- `startSessionForDay()` は 1 request 内で単一の Supabase server client を使っており live でも動いていた一方、壊れていた mutation 群は `getAuthenticatedWorkoutUserId()` と `createWorkoutQueryClient()` を別呼びしていました。
- live で token refresh や cookie 更新が必要なタイミングだと、最初の client では user を解決できても、2 個目の client が同一 request 内で同じ auth state を見られず、lookup / update だけが失敗する構造になっていました。
- 今回は `getAuthenticatedWorkoutContext()` を追加して、同じ Supabase client で `auth.getUser()` とその後の select / update を実行する形に統一しました。
- あわせて `complete / unlock / cancel / finish` には `route name / userId / setId or sessionId / lookup result / update result / error` の構造化ログを追加し、live 再発時にどの段階で落ちたかを追いやすくしました。
- 同じ根を踏む `/train` 配下の `PATCH workout-set`、`delete workout-set`、`add set`、`add exercise`、`swap exercise` も単一 client 化しています。
- update 系 route では `.select(...).maybeSingle()` を返して、`updateError` だけでなく「0 rows 更新」の conflict も区別できるようにしました。
- Manual check: このセッションでは認証済み live E2E までは未実施です。次回は production で `complete -> undo -> cancel -> finish` を 1 回通し、追加した route logs と結果を合わせて確認すると完了確定しやすいです。

## 2026-04-17 U-12 - Cancel failure escape hatch
### STATUS

| Item | Result |
|---|---|
| Cancel 失敗時の `/train` 退避導線追加 | **implemented** |
| Cancel failure 後の retry / Home / History 導線保証 | **implemented** |
| TypeScript / build | **pass** |

### Notes

- live 環境では `Workout session lookup failed.` がまだ起こり得るため、今回は root cause の完全解消よりも「失敗しても `/train` に閉じ込められない」ことを優先しました。
- `WorkoutScreen` に `failedAction = "cancel"` を持たせ、Cancel failure のときだけ recovery actions を赤バナー内へ表示するようにしました。
- recovery actions は `Leave to Home` / `Session History` / `Retry Cancel` の 3 つです。Home / History は通常の `href` 遷移なので、client router state に依存せず退避できます。
- Cancel failure 時は `isCancelling` を finally で解除しつつ、`revealedSetId` を閉じて swipe 状態だけを cleanup するようにしました。workout 自体は継続中なので rest timer や入力 state は壊さない方針です。
- 他の編集操作や session 更新時には `failedAction` を clear して、Cancel failure 用の退避 UI が残留しないようにしています。
- Manual check: 今回は local で JSX / CSS と disabled 条件を確認する範囲までです。認証済み live での `Cancel failure -> Leave to Home` は次回 1 回見るとより安心です。

## 2026-04-17 U-11 - Cancel session lookup hardening
### STATUS

| Item | Result |
|---|---|
| `/train` Cancel の `Workout session lookup failed.` 修正 | **implemented** |
| cancel route の ownership lookup を共通 helper に統一 | **implemented** |
| TypeScript / build | **pass** |

### Notes

- Cancel route だけが `workout_sessions` を直接 lookup しており、他の session mutation route と実装がずれていました。
- 今回は `findOwnedWorkoutSession()` に統一し、Cancel 前の session 解決を他 route と同じ ownership check に揃えました。
- lookup が失敗した場合は `sessionId` / `userId` / `lookupError` を server log に残すようにして、再発時に stale id か query failure かを切り分けやすくしました。
- `update(...).eq("user_id", userId).eq("status", "in_progress")` に寄せ、Cancel mutation も lookup と同じ user scope で閉じるようにしました。
- `components/workout/WorkoutScreen.tsx` 側の cleanup / redirect は既存実装を維持しているため、今回の修正範囲は cancel API の session 解決に限定しています。
- Manual check: このセッションでは認証済みブラウザの Cancel E2E までは未実施です。次回は production 実データで `Cancel -> Home -> Go to Train` を 1 回確認すれば今回の修正を閉じられます。

## 2026-04-17 U-10 - Train top bar Boostcamp pass
### STATUS

| Item | Result |
|---|---|
| Rest / Calc を補助操作として整理 | **implemented** |
| Session timer を中央の主表示に整理 | **implemented** |
| Finish / Cancel の主従を明確化 | **implemented** |

### Notes

- Top bar は既存の 4 列構成を維持しつつ、`Rest` / `Calc` を二段ラベルの小さな補助ボタンに変更しました。
- タイマーは中央の panel にまとめ、セッション経過時間を最も読み取りやすい要素として強調しました。
- `Finish` は Boostcamp 寄せの強い黄系 CTA、`Cancel` は控えめな赤の secondary action として差を明確化しました。
- Mobile check at `390 x 844`: top bar height was `61px`, all controls stayed on one row, and the button widths remained usable (`Rest 48px`, `Calc 48px`, `Finish 64px`).

## 2026-04-17 U-9 - DONE action reliability and mobile fit
### STATUS

| Item | Result |
|---|---|
| `Complete target lookup failed.` root cause hardening | **implemented** |
| DONE complete color switches immediately and clearly | **implemented** |
| Mobile row width adjusted so DONE stays inside viewport | **implemented** |

### Notes

- `findOwnedWorkoutSessionExercise()` now selects only `id` and `workout_session_id`, which are the only fields needed for set ownership checks.
- DONE completion now updates optimistically so the right-side check turns accented immediately, then rolls back if the API fails.
- `router.refresh()` right after DONE / undo DONE was snapping the row back to stale server data in mock or lagging states, so DONE now stays on local confirmed state instead of flashing back.
- Mobile width was recovered by shrinking `# / Previous / Target / Done` slightly and trimming row padding/gap while keeping `Kg / Reps` usable.
- Added server-side logging for complete/unlock lookup failures so future regressions are diagnosable without changing API responses.
- Manual check: headless Chrome at `390 x 844` confirmed the DONE button turns green, no red error banner appeared during the mocked complete flow, and the DONE button bounding box stayed inside the viewport.
- E2E check on 2026-04-17: authenticated production session was verified in Chrome. A real `Dumbbell Full Body Base / Week 1 / Day 1` session was started from `/api/workout-sessions`, the first DONE action completed without any red banner, the button stayed green after reload, unlock returned it to the incomplete state, and the DONE column remained inside the narrow window width used for the check.

## 2026-04-17 U-8 - DONE button 視認性改善

### STATUS

| 項目 | 状態 |
|---|---|
| 未完了 / 完了の DONE ボタン差分を強化 | **完了 ✅** |
| 完了後も Kg / Reps 編集可の挙動維持 | **完了 ✅** |
| TypeScript / build 検証 | **完了 ✅** |

### 変更内容

- `components/workout/WorkoutScreen.module.css`
  - 未完了ボタンをダークで控えめな見た目に整理
  - 完了時は緑の塗り + 明るいチェック + 軽いシャドウで一瞬で認識できる見た目へ変更
  - row 全体の演出は増やさず、DONE ボタン単体の視認性を最優先
- `components/workout/WorkoutScreen.tsx`
  - DONE ボタン内を `checkIcon` span に整理し、未完了でも薄いチェックを見せて操作対象を分かりやすくした

### 判断理由

- 現状は完了・未完了の差が弱く、スマホ幅でどこまで終わったかを一目で追いづらかった
- Boostcamp 寄せとして、まずは DONE ボタン自体の色差で進行状況が分かることを優先した
- Kg / Reps 編集可の仕様は維持したいので、row 全体のロック風演出は強めず、右端ボタンだけで状態差を作った

## 2026-04-17 U-7 - /train cancelled session fallback 修正

### STATUS

| 項目 | 状態 |
|---|---|
| `/train` の primary session 選択から `cancelled` / `completed` を除外 | **完了 ✅** |
| active enrollment の current day を start 画面へ優先接続 | **完了 ✅** |
| cancel 後の rest / swipe UI 残留 cleanup | **完了 ✅** |
| TypeScript / build 検証 | **完了 ✅** |

### 原因

- `/train` のクエリなし表示が `getCurrentWorkoutSessionView()` を通じて「最新 session」をそのまま返していた
- そのため `in_progress` が存在しないタイミングでは、最新が `cancelled` の場合でも `WorkoutScreen` にそのまま表示されていた
- `Go to Train` / `Back to Train` のように `/train` へ素で戻る導線では、この fallback が active enrollment の current day より優先されてしまっていた

### 修正内容

- `lib/workout/train-session.ts`
  - current session 解決を `in_progress` 限定に変更し、`cancelled` / `completed` を primary display 対象から除外
- `app/train/page.tsx`
  - 優先順位を `in_progress -> active enrollment current day の StartSessionScreen -> mock fallback` に整理
- `components/workout/WorkoutScreen.tsx`
  - cancel 成功後に rest timer と swipe reveal state を明示 cleanup してから遷移

### 再発防止メモ

- `/train` の primary display は「編集可能な現在セッション」だけを対象にし、履歴状態は session-history / summary 側へ限定する
- `cancelled` / `completed` を見せたい場合は明示的に履歴導線から遷移した時だけ扱う

## 2026-04-17 U-6c - Workout row Boostcamp寄せ 手動確認

### STATUS

| 項目 | 状態 |
|---|---|
| スマホ幅で Kg / Reps 入力欄が押しやすいか | **pass** |
| Delete が通常時に見えず、左スワイプ時のみ表示されるか | **pass** |
| チェック完了後も Kg / Reps 編集が可能か | **pass** |
| 何セット目をやっているか視認しやすいか | **pass** |
| complete / update / delete API が今回 UI 変更と矛盾しないか | **pass（コード確認 + ローカル補助確認）** |
| Rest Timer が row UX 変更で崩れていないか | **pass** |

### 確認結果

- Headless Chrome を 390 x 844 のスマホ幅で起動し、`/train` を確認
- 初期表示では row の横スクロールは発生せず、Kg / Reps は各 `48px` 幅で確保されていた
- 左スワイプ後だけ Delete lane が表示され、通常時 opacity は `0`、reveal 時は `1` を確認
- check 完了後も Kg / Reps は disabled にならず、そのまま編集・blur 保存できることを確認
- Rest Timer は `Rest -> 1:29` へ遷移し、active 表示クラスも維持されていた

### 補足

- ローカル未認証の `/train` は mock session fallback になるため、complete / update / delete の UI 操作確認は一時的な API スタブで実施
- 実 API 自体は `app/api/workout-sets/[id]/route.ts` / `complete/route.ts` / `delete/route.ts` を再確認し、完了後編集可・完了済み削除可・`is_locked: false` 正規化の方針と矛盾がないことを確認
- 今回はコード修正不要。状態記録のみ更新

## 2026-04-17 U-6b - Workout row Boostcamp寄せ 検証完了

### STATUS

| 項目 | 状態 |
|---|---|
| Delete を通常非表示にして、左スワイプ時のみ表示 | **完了 ✅** |
| モバイルで Kg / Reps 入力欄を拡張 | **完了 ✅** |
| lock / unlock 操作をやめ、check ベースの完了操作に統一 | **完了 ✅** |
| 完了後も Kg / Reps をそのまま編集可能に変更 | **完了 ✅** |
| TypeScript / build 検証 | **完了 ✅** |

### 変更内容

- `components/workout/WorkoutScreen.tsx`
  - Delete lane を通常非表示にし、左スワイプ時だけ表示する挙動へ変更
  - 完了操作を check ボタン 1つに統一し、完了後も Kg / Reps を編集可能に変更
  - 補助文言を Boostcamp 寄せの操作説明へ更新
- `components/workout/WorkoutScreen.module.css`
  - モバイル時の row grid を調整して Kg / Reps 入力欄を拡張
  - delete lane の reveal 表示と completed row の見た目を調整
- `app/api/workout-sets/[id]/route.ts`
  - PATCH 時の `is_locked` 制約を外し、旧データも `is_locked: false` に正規化
- `app/api/workout-sets/[id]/complete/route.ts`
  - complete 後も編集できるよう `is_locked: false` を返す実装へ変更
- `app/api/workout-sets/[id]/delete/route.ts`
  - 完了済みセットでも削除できるよう制約を整理

### 検証

- `npm run typecheck` : pass
- `npm run build` : pass

### NEXT

- ローカル画面で swipe reveal / check toggle / 完了後編集の見た目を最終確認

## 2026-04-17 U-6 — Workout row Boostcamp 寄せ

### STATUS

| 項目 | 状態 |
|---|---|
| Delete を通常時は隠し、左スワイプ時のみ表示 | **完了 ✅** |
| 完了後も Kg / Reps を編集可能に変更 | **完了 ✅** |
| lock / unlock ボタン分岐をやめ、check ベース操作に統一 | **完了 ✅** |
| モバイルで Kg / Reps 入力幅を拡張 | **完了 ✅** |
| TypeScript / build 検証 | **確認予定** |

### 変更内容

- `components/workout/WorkoutScreen.tsx`
  - 完了済みセットでも Kg / Reps を編集できるよう UI ガードを緩和
  - Done 列を常時 check ボタンに統一し、完了済みは再タップで未完了へ戻せる形に変更
  - Delete lane は `revealedSetId` のときだけ可視化
  - 補助文言を `左スワイプで Delete ・ 完了後も Kg / Reps はそのまま編集できます` に更新
- `components/workout/WorkoutScreen.module.css`
  - set row の列幅を見直し、Done 列を圧縮して Kg / Reps を広げた
  - delete lane を非表示→表示のトランジションに変更
  - completed row の軽いハイライトを追加
- `app/api/workout-sets/[id]/route.ts`
  - `is_locked` による PATCH ブロックを撤去し、保存時は `is_locked: false` に正規化
- `app/api/workout-sets/[id]/complete/route.ts`
  - complete 時に `is_locked: false` を返すよう変更
- `app/api/workout-sets/[id]/delete/route.ts`
  - delete 時の `Unlock first` 制約を撤去

### 修正理由

- 現状 UI は Delete が常時透けて見え、Boostcamp のような「左スワイプ時だけ Delete」が再現できていなかった。
- また complete 後に lock されるため重量・回数の微修正がしにくく、何セット目まで終わったかを check だけで追える Boostcamp の操作感とずれていた。

### NEXT

- `npm run typecheck` / `npm run build` を実行して静的検証
- ローカル画面で swipe reveal / check toggle / complete 後編集を目視確認

## 2026-04-17 U-5 — Rest Timer 安定化

### STATUS

| 項目 | 状態 |
|---|---|
| WorkoutScreen の Rest ボタンから 90 秒カウントダウン開始 | **完了 ✅** |
| カウント完了後に `Done!` を一時表示 | **完了 ✅** |
| `Done!` 表示中に再スタートしても旧 timeout が新タイマーを消さない | **完了 ✅** |
| セッション切替 / unmount 時の rest timer 後始末 | **完了 ✅** |
| TypeScript `tsc --noEmit` | **完了 ✅** |

### 変更内容

- `components/workout/WorkoutScreen.tsx`
  - `restDoneTimeoutRef` を追加し、`Done!` 表示を消す timeout を明示管理
  - 新しいレスト開始時に旧 timeout を必ず `clearTimeout` するよう修正
  - `session` 切替時に rest timer state / ref をリセット
  - rest timer interval cleanup 時にも timeout を後始末

### 修正理由

- 2026-04-16 時点の Rest Timer 実装は UI 上ほぼ完成していたが、`Done!` 表示を消す `setTimeout` が次のレスト開始後も残るため、短時間で再スタートすると新しいカウントダウン表示が途中で消えるレース条件があった。
- 今回は仕様追加ではなく、既存 UX を壊さずに安定化する最小修正だけを入れた。

### NEXT

- ローカル画面で Rest → Done! → 即再スタートの挙動を目視確認
- 必要なら `Done!` 表示時間（現状 2.5 秒）を UX 観点で微調整

最終更新: 2026-04-15（H-4 IA redesign E2E 検証完了 / BottomTabBar・smart redirect・enrollment guard 実装 pass）

## 2026-04-15 H-4 — IA redesign E2E 検証完了

### STATUS

| 確認項目 | 状態 |
|---|---|
| `/` → smart redirect（未ログイン → `/programs`） | **pass ✅** |
| `/login` で BottomTabBar 非表示 | **pass ✅** |
| `/programs` で BottomTabBar 表示 / Programs タブ active | **pass ✅** |
| `/train` で BottomTabBar 表示 / Train タブ active | **pass ✅** |
| `/session-history` で BottomTabBar 表示 / History タブ active | **pass ✅** |
| SessionHistoryScreen の "← Home" 削除済み | **pass ✅** |
| Program Detail（enrollment なし）→ "Start Program" CTA | **pass ✅** |
| スクロールスペーサーで CTA がタブに隠れない | **pass ✅** |
| コンソールエラー・警告 | **なし ✅** |
| TypeScript `tsc --noEmit` | **pass ✅** |
| WorkoutSummaryScreen — "Back to Home" → "Back to Train" 修正 | **完了 ✅** |
| History → completed session に "Summary →" リンク追加 | **完了 ✅** |
| active enrollment あり分岐（Programs バナー / Detail 警告）| **実装済み / Supabase 接続環境で E2E 要確認** |
| Restart Program → `/` → `/train` smart redirect | **設計上 pass（`/` が active enrollment → /train へ振る）** |

### 実装サマリー（H-4）

**新規ファイル:**
- `components/navigation/BottomTabBar.tsx` — Programs / Train / History の 3 タブ固定ナビ（SVG アイコン / active 状態 / safe-area 対応）
- `components/navigation/AppNav.tsx` — pathname ベースの表示制御 + スクロールスペーサー（`/login` は非表示）

**変更ファイル:**
- `app/layout.tsx` — AppNav を root layout に注入
- `app/page.tsx` — Home → smart router（enrollment → `/train`、それ以外 → `/programs`）
- `app/login/page.tsx` — ログイン後 `/` へ redirect（Home がルーターとして機能）
- `app/programs/page.tsx` — enrollment バナーデータを並列取得して ProgramsScreen へ渡す
- `ProgramsScreen.tsx` + CSS — 進行中プログラムバナー追加（「続ける →」CTA）
- `app/programs/[slug]/page.tsx` — anyActiveEnrollment を取得して Detail へ渡す
- `ProgramDetailScreen.tsx` + CSS — enrollment 3 パターン分岐（Resume / 警告+切り替え / Start）

**E2E 仕上げ（H-4-E2E）:**
- `WorkoutSummaryScreen.tsx` — `href="/"` + "Back to Home" → `href="/train"` + "Back to Train"（全 4 箇所）
- `SessionHistoryScreen.tsx` — "← Home" バックリンク削除
- `SessionHistoryScreen.tsx` + CSS — completed セッションに `/workout-summary/[id]` "Summary →" リンク追加

### 導線整合マップ（H-4 後）

| ユーザー状態 | 着地点 |
|---|---|
| 未ログイン → `/` | `/programs`（ゲスト閲覧） |
| ログイン + enrollment あり → `/` | `/train`（ワークアウト継続） |
| ログイン + enrollment なし → `/` | `/programs` |
| ログイン後 `/login` redirect | `/` → 上記分岐 |
| Restart Program → API → redirect | `/` → `/train`（新 enrollment active） |
| History → completed session | "Summary →" で `/workout-summary/[id]` へ直接 |

### NEXT

- Vercel auto-deploy 確認（push 済み）
- active enrollment あり状態での E2E（Programs バナー / ProgramDetail 警告バナー）はログイン環境で確認
- 次フェーズ: 入力 UI 改善（weight/reps 入力体験）または Analytics 準備

---

## 2026-04-15 Auth blocker fix — ErrorCard の sign-in 導線復旧

### STATUS

| 項目 | 状態 |
|---|---|
| `ActiveProgramCard` の `ErrorCard` に Sign In リンク追加 | **完了 ✅** |
| `getActiveProgramView` — 認証未確定で throw した場合は `isAuthenticated: false` を返す | **完了 ✅** |
| TypeScript 型エラー | **なし ✅** |
| localhost での unauth home 再確認（Sign In card 表示）| **pass ✅** |
| localhost での stale cookie シミュレーション（`sb-*` ダミー値）→ Sign In card 表示 | **pass ✅** |

### 現象（Vercel production）

- Home (`/`) を開くと "Could not load your active program. Please try again." の赤い error card が表示
- Home にも他ページにも header / nav に Sign In リンクが存在せず、error card の中にも Sign In なし
- ユーザーは `/login` へたどり着けず **E2E 検証が blocker で停止**

### ROOT CAUSE

1. **`getActiveProgramView` の catch 節が誤って `isAuthenticated: true` を返していた**
   - `auth.getUser()` 自体が throw する経路（expired / broken session cookie 等）でも catch が発火
   - catch 節では auth が確認できたかに関わらず `isAuthenticated: true` + errorMessage をセット
   - localhost では常に fresh state で throw しないため顕在化せず、実ユーザー環境（cookie が蓄積）でのみ再現

2. **`ErrorCard` が escape link を持たなかった**
   - `ActiveProgramCard` の優先順位は `errorMessage → !isAuthenticated → NoProgramCard`
   - errorMessage が立つと Sign In card が描画されず、sign in 導線を完全に失う
   - layout にも global header がなく、error card の外側に login 導線が存在しない

**localhost で通る理由:** fresh dev session では `auth.getUser()` が throw しない → userId=null 経路 → `isAuthenticated:false, errorMessage:null` → NotSignedIn 描画。Vercel 側でも fresh cookie では同じく正常。**"以前 sign in したことがあるブラウザ" の残存 cookie 経由でのみ誤った catch に入る。**

### 変更内容

**components/home/ActiveProgramCard.tsx**
- `ErrorCard` に `/login` への Sign In リンクを追加。どんな error path でも sign in 導線を保つ

**lib/workout/active-program.ts**
- `authConfirmed: boolean` フラグを追加。`auth.getUser()` で `userId` が確定した直後に true にセット
- catch 節で `authConfirmed === false` の場合は `isAuthenticated: false` で返す（stale cookie → fresh "Sign in" card にフォールバック）
- auth 確定後の DB failure のみ従来どおり errorMessage を設定（実害のある error のみ表示）

### 環境変数・設定変更

- **なし**。Vercel 側の env / middleware / Supabase 設定は変更していない
- middleware の matcher は変更せず（`/workout-summary/*` と `/exercise-history/*` のみ保護。Home は public のまま）
- auth callback URL / site URL / cookie 設定は既定のまま

### CHECKS

**localhost（dev server）:**
- 未ログイン GET `/` → "Sign in to track your progress" + "Sign In" link（errCard=false, signIn=true, loginLink=1）
- 破損 cookie 付き GET `/` → "Sign in to track your progress" + "Sign In" link（errCard=false, signIn=true, loginLink=1）
- `tsc --noEmit` → pass

**Vercel（deploy 後に確認するポイント）:**
- 未ログイン `/` → Sign In card が表示される
- stale cookie で `/` → 正常に Sign In card へフォールバック（または errorCard に Sign In link が見える）
- `/login` でサインイン → `/programs` 遷移 → Home で active program card が正常表示

### NEXT

- Vercel 反映後、ユーザーは `https://training-program-platform-jp.vercel.app` で以下を確認:
  1. `/` を開き Sign In card が出ること
  2. "Sign In" リンクから `/login` に遷移できること
  3. sign up / sign in 後に `/programs` → Home に戻り、active program card が progress 表示で出ること
- その後 S-7 E2E（Restart Program ボタン → Home の新 active card）を継続

---

## 2026-04-15 S-7 — Restart Program フロー

### STATUS

| 項目 | 状態 |
|---|---|
| `lib/workout/restart-program.ts`（`restartProgramEnrollment`）新規作成 | **完了 ✅** |
| `app/api/programs/[programId]/restart/route.ts` POST 新規作成 | **完了 ✅** |
| `components/summary/RestartProgramButton.tsx` 新規作成（client） | **完了 ✅** |
| `WorkoutSummaryView` に `programId: string \| null` 追加 | **完了 ✅** |
| `RestartProgramResponse` 型追加 | **完了 ✅** |
| `workout-summary.ts` — `programId` を view に渡す | **完了 ✅** |
| `WorkoutSummaryScreen` — 完走時 CTA を dedicated button に差し替え（Link fallback 残す） | **完了 ✅** |
| idempotency — 既存 active enrollment があれば reuse | **完了 ✅** |
| first day 不在 / broken program は 422 で safe fail | **完了 ✅** |
| TypeScript 型エラー | **なし ✅**（`tsc --noEmit` pass）|

### 設計方針

**再開ではなく再受講:**
- completed enrollment は履歴として保持（update しない）
- 新しい enrollment を INSERT（status='active', current_program_day_id = week 1 / day 1）
- DB の UNIQUE INDEX は `WHERE status='active'` のみに適用されるため、completed は何件でも残る

**restart 条件:**

| 条件 | 動作 | レスポンス |
|---|---|---|
| signed-in + program 存在 + first day 解決可 + 既存 active なし | 新 enrollment INSERT | 201, `reused: false` |
| signed-in + program 存在 + first day 解決可 + 既存 active あり | 既存を返す | 200, `reused: true` |
| program 不存在 | 作成しない | 404 `program_not_found` |
| Week 1 / Day 1 が存在しない（broken program）| 作成しない | 422 `first_day_not_found` |
| 未ログイン | 作成しない | 401 `unauthenticated` |
| Supabase 未設定 | 作成しない | 503 `supabase_unavailable` |

**first day 解決ルール:**

```
1. program_weeks を week_number = 1 で lookup
2. 該当 week の program_days を day_number = 1 で lookup
3. 見つからなければ null → 422 safe fail
```

（`lib/workout/workout-summary.ts` の `selectFirstProgramDayId` と同一仕様 — summary 内部に依存せず独立実装）

**既存 active enrollment がある場合:**
- 新規作成しない（idempotent）
- 既存の id と current_program_day_id を返す（current_program_day_id が null の場合のみ first day に fallback）
- 二重クリック耐性: client 側で `isBusy` flag で連打ブロック + server 側で findActiveEnrollment による reuse

**遷移先:**
- 成功時は `redirectUrl: "/"`（Home）
- Home の active-program card で新 enrollment を progress = 0 として表示
- 直接 /train に飛ばさないことで「新しい active enrollment ができた」ことを明示

### 変更内容

#### types/workout.ts
- `WorkoutSummaryView` に `programId: string | null` を追加（restart API 呼び出しに必要）
- `RestartProgramResponse` 型を新規追加（`enrollmentId` / `programDayId` / `reused` / `redirectUrl`）

#### lib/workout/restart-program.ts（新規）
- `restartProgramEnrollment(programId, userId)` server function
- `resolveFirstProgramDayId(client, programId)` private helper（2 queries）
- `RestartProgramResult` discriminated union を export
- 認証失敗 / program 不在 / first day 不在 / insert 失敗 を明示的に分岐

#### app/api/programs/[programId]/restart/route.ts（新規）
- POST endpoint — auth check → `restartProgramEnrollment` 呼び出し → revalidatePath("/")
- 成功時は 201（新規）or 200（reuse）で `RestartProgramResponse` を返す
- `first_day_not_found` は 422（broken data の明示）

#### lib/workout/workout-summary.ts
- `buildSummaryView` のシグネチャに `programId: string | null` を追加
- `getWorkoutSummaryView` から `program?.id ?? null` を view に渡す

#### components/summary/RestartProgramButton.tsx（新規）
- `"use client"` + `useRouter` + `useTransition`
- POST `/api/programs/:programId/restart` → 成功時は redirectUrl（既定 /）へ navigate + `router.refresh()`
- `isBusy`（local state + transition）で連打ブロック
- エラー時はボタン下に赤文字で表示

#### components/summary/WorkoutSummaryScreen.tsx
- `RestartProgramButton` を import
- `programId` を summary から取り出し、`canRestartViaApi` を導出
- 完走時 primary CTA を 3 パターンで分岐:
  1. `canRestartViaApi` → `RestartProgramButton`（推奨経路）
  2. fallback: `restartFallbackUrl`（旧 payload との互換用リンク → `/train?...`）
  3. どちらも不可 → `Browse Programs` リンク
- completedCard 文言分岐を `hasRestartCta` に変更

### 今回やらないこと（スコープ外）

- completed enrollment の上書き reset
- restart reason / cycle number の保存
- completed runs の比較 UI
- multi-cycle analytics（N 周目表示・前周との比較）
- paused enrollment からの再開
- 同一 program の複数 active enrollment を正式サポートする設計変更

### OPEN ISSUES

- **completed runs の比較表示:** 現状 completed enrollment は history として残るだけで UI 導線なし。session-history からたどる必要がある。将来 "N 周目" 表示をする場合は enrollment 単位のグルーピング UI が必要
- **multi-cycle analytics:** volume/e1RM trend は現状 enrollment 単位で集計（H-4 / H-4b）。複数周回をまたいだ長期推移を見せる場合は user × program 単位での集計が必要になる

### Verification（2026-04-15）

**静的検証（AI 実施）:**

| 項目 | 結果 |
|---|---|
| `tsc --noEmit` | ✅ exit 0（型エラーなし）|
| `next build` | ✅ success — `/api/programs/[programId]/restart` が route table に登録 |
| API smoke（未ログイン POST）| ✅ 401 `unauthenticated` / 日本語メッセージ `ログインが必要です。` を返却 |
| API smoke（不正 UUID POST）| ✅ 401（auth gate が UUID 検証より先に発火、情報漏洩なし）|

**DB 一意性保証:**

```sql
-- supabase/migrations/20260413_000007_not_null_user_id.sql
create unique index idx_program_enrollments_active_user_program
  on public.program_enrollments (user_id, program_id)
  where status = 'active';
```

- `(user_id, program_id) WHERE status='active'` の **partial UNIQUE INDEX 確認済み**
- `findActiveEnrollment` → INSERT が非アトミックでも、DB レイヤで同一 (user, program) の 2 件目 active INSERT を拒否
- client の `isBusy` flag と組み合わせて 2 段構えで冪等性を担保

**Production 反映:**

- commit `0e21dfb` は `feature/auto-dev-phase3-loop` に push 済み
- Vercel の production branch が `feature/auto-dev-phase3-loop` のため **push 時点で自動デプロイ実行**
- live endpoint: `https://training-program-platform-jp.vercel.app/api/programs/[programId]/restart`
- 未ログイン POST で 401 レスポンス live 確認済み

**AI で未実施の E2E（ユーザー検証項目）:**

localhost / preview の両方で、以下はサインイン済みブラウザでの実機確認が必要:

1. プログラム完走 → Summary の "Restart Program" ボタンクリック → Home に遷移
2. Home の active program card に新 enrollment が progress=0 で表示される
3. 同じプログラムをもう一度 Restart（2 重クリック含む）→ 409 等のエラーにならず 200 reuse される
4. Restart 連打中にボタンが "Restarting…" に変わり二重 POST が飛ばない
5. broken program（Week 1/Day 1 が無いシード）での Restart → 422 で safe fail
6. cancelled enrollment は履歴として残り、新 active の進行を妨げない

**preview URL:**

Vercel production branch = `feature/auto-dev-phase3-loop` のため、専用 preview deploy は作成せず production URL を preview として共有する運用。

→ **ユーザー確認 URL: `https://training-program-platform-jp.vercel.app`**

---

## 2026-04-14 S-6 — Workout Summary 改善

### STATUS

| 項目 | 状態 |
|---|---|
| `WorkoutSummaryState` に `"cancelled"` 追加 | **完了 ✅** |
| `WorkoutSummaryView` に `sessionVolume: number \| null` 追加 | **完了 ✅** |
| `workout-summary.ts` — sets に `weight_kg` / `reps_done` を SELECT、volume 計算 | **完了 ✅** |
| `workout-summary.ts` — cancelled session → `state: "cancelled"` + summary データ返却 | **完了 ✅** |
| `WorkoutSummaryScreen` — cancelled 専用ヒーロー・バナー表示 | **完了 ✅** |
| `WorkoutSummaryScreen` — `sessionVolume` stat card 追加 | **完了 ✅** |
| `WorkoutSummaryScreen` — "Back to Home" / "View all sessions" CTA 追加 | **完了 ✅** |
| `WorkoutSummaryScreen` — back link を `/train` → `/` に修正 | **完了 ✅** |
| TypeScript 型エラー | **なし ✅** |

### 変更内容

#### types/workout.ts
- `WorkoutSummaryState` に `"cancelled"` を追加
- `WorkoutSummaryView` に `sessionVolume: number | null` を追加（totalVisibleSets の直後）

#### lib/workout/workout-summary.ts
- `WorkoutSetRow` に `weight_kg: number | null` / `reps_done: number | null` を追加
- `selectVisibleWorkoutSets` SELECT に `weight_kg, reps_done` を追加
- `buildSummaryView` — `visibleSets` ループ内で volume 累計（H-4 と同定義: completed + non-null weight）→ `sessionVolume` 算出
- `getWorkoutSummaryView` の最終 return を修正:
  - `completed` → `state: "ready"`
  - `cancelled` → `state: "cancelled"`（summary データも返す — UI でキャンセル済みセッションの実績を表示可能）
  - `in_progress` → `state: "not_completed"`

#### components/summary/WorkoutSummaryScreen.tsx
- `resolveStateTitle` / `resolveStateBody` に `"cancelled"` 分岐追加
- `isCancelled` フラグ追加、`showMetadata` / `showExercises` を `isReady || isCancelled` で拡張
- キャンセル済みセッション: `heroCancelled` スタイル + `cancelledBanner` を表示
- stats grid に `sessionVolume` カード追加（null 時は非表示）
- "Completed At" → キャンセル時は "Started At" へ切り替え
- CTA 構造を再設計:
  - cancelled: "Back to Home"（primary）/ "View all sessions"（secondary）
  - isProgramCompleted: "Restart Program" / "Browse Programs"（primary）+ "Back to Home" / "View all sessions" / "Choose Another Program"（secondary）
  - nextTrainUrl あり: "Go to Next Day"（primary）+ "Back to Home" / "View all sessions"（secondary）
  - fallback: "Back to Home"（primary）/ "View all sessions" / "Browse Programs"（secondary）
- back link: `isProgramCompleted ? "/programs" : "/"`（旧: `/train`）

#### components/summary/WorkoutSummaryScreen.module.css
- `.heroCancelled` — 赤系グラジェント hero
- `.cancelledBanner` — キャンセル通知バナー

### session volume 定義（H-4 と同一）

```
sessionVolume = Math.round(Σ weight_kg × reps_done)
  where: is_completed = true AND deleted_at IS NULL AND weight_kg IS NOT NULL AND reps_done IS NOT NULL
null when no qualifying sets (bodyweight-only session 等)
```

---

## 2026-04-14 S-5 — Cancel Workout (in_progress session discard)

### STATUS

| 項目 | 状態 |
|---|---|
| `POST /api/workout-sessions/[id]/cancel` 新規作成 | **完了 ✅** |
| `WorkoutSessionCancelResponse` 型追加 | **完了 ✅** |
| `WorkoutScreen` — Cancel ボタン + `handleCancel` + `isSessionCancelled` / `isSessionEnded` | **完了 ✅** |
| mutation guard を `isSessionEnded` に統一 | **完了 ✅** |
| CSS — `.cancelButton` / `.cancelledBanner` / `.topBarActions` / `.finishButtonCancelled` | **完了 ✅** |
| TypeScript 型エラー | **なし ✅** |

### 状態遷移ルール

| 条件 | Cancel API 挙動 | enrollment |
|---|---|---|
| `in_progress` | `status = 'cancelled'` | 変更なし（`current_program_day_id` 保持） |
| `cancelled` | 200 no-op（idempotent） | 変更なし |
| `completed` | 409 エラー | 変更なし |
| session not found | 404 | — |

### Cancel 後の各画面の見え方

| 画面 | 挙動 |
|---|---|
| Cancel 直後 | `router.push("/")` でホームへ遷移 |
| Home CTA | `actionType = 'start'`（in_progress session がなくなるため）→ "Start next workout" |
| `/train?program=slug&programDayId=sameDay` | `resolveTrainingEntry` = `mode='start'`（in_progress がないため）→ StartSessionScreen |
| session-history | 一覧に `status='cancelled'` で表示（既存リスト実装より） |
| trend / e1RM / volume | `status='completed'` のみ集計のため影響なし |

### UI 詳細

- topBar に `topBarActions` div を追加: `[Cancel] [Finish]` 横並び
- Cancel ボタンは `isSessionEnded` のとき非表示（completed / cancelled 後は不要）
- Finish ボタンラベル: `Completed` / `Cancelled` / `Finishing...` / `Finish`
- confirm dialog 文言:
  - completedSetCount = 0: `"Discard this workout? No completed sets will be lost."`
  - completedSetCount ≥ 1: `"Discard this workout? N completed set(s) will be kept in history but this session will be marked as cancelled."`
- Cancel 成功後は `router.push("/")` — WorkoutScreen を離れる

### データ保持方針

- `workout_sets` / `workout_session_exercises` は**物理削除しない**
- `status = 'cancelled'` による論理無効化のみ
- 理由: audit / future analytics / 誤 cancel からの recovery 余地を残す
- 集計クエリ（trend / e1RM）は `status='completed'` のみを対象にしているため汚染なし

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `app/api/workout-sessions/[id]/cancel/route.ts` | **新規作成** |
| `types/workout.ts` | `WorkoutSessionCancelResponse` 追加 |
| `components/workout/WorkoutScreen.tsx` | Cancel ボタン / `handleCancel` / `isCancelling` / `isSessionCancelled` / `isSessionEnded` / mutation guard 統一 / cancelled banner |
| `components/workout/WorkoutScreen.module.css` | `.topBarActions` / `.cancelButton` / `.cancelledBanner` / `.finishButtonCancelled` 追加 |

---

## 2026-04-14 S-4 — Session Completion → Enrollment Advancement

### STATUS

| 項目 | 状態 |
|---|---|
| session finish → `advanceEnrollmentAfterSessionComplete` 呼び出し（新規 path） | **完了 ✅** |
| 既存 completed session の early-return で enrollment advance が skip される recovery gap を修正 | **完了 ✅** |
| `revalidatePath("/")` 追加（Home progress 即時反映） | **完了 ✅** |
| TypeScript 型エラー | **なし ✅** |

### 実装概要

S-4 の大部分（finish ボタン / API / enrollment 進行 / idempotency guard / summary 画面）は D-1〜D-4 で実装済みだった。
今回修正したのは 1 箇所のみ: `POST /api/workout-sessions/[id]/finish` の `session.status === 'completed'` early-return パス。

#### 修正前の問題（recovery gap）

```
first POST:
  1. UPDATE workout_sessions SET status='completed' ✅
  2. advanceEnrollmentAfterSessionComplete()         ← 失敗 (silent)
     → enrollment がスタックしたまま

retry POST (session already completed):
  session.status === 'completed' → early return     ← advance は呼ばれない
  → enrollment が永続的にスタック
```

#### 修正後

```
retry POST (session already completed):
  session.status === 'completed'
  → advanceEnrollmentAfterSessionComplete() を呼ぶ  ← 追加
    - enrollment 進んでいれば idempotency guard で no-op
    - enrollment スタックなら advance を実行して回復
  → 200 return
```

### 状態遷移ルール（完全版）

| 条件 | 挙動 |
|---|---|
| in_progress session → finish | `status='completed'`, `finished_at=now()`, enrollment 進行 |
| 既に completed session → retry finish | session 更新なし、enrollment advance を retry して return 200 |
| 中間 day 完了 | `enrollment.current_program_day_id` = 次の day UUID |
| 最終 day 完了 | `enrollment.status = 'completed'`、`current_program_day_id` は最終 day のまま保持 |
| enrollment.current_program_day_id ≠ session.program_day_id（idempotency guard） | advance を skip（D-3: 二重進行防止） |
| incomplete sets > 0, forceFinish = false | 409 + `requiresConfirmation: true` → ブラウザ確認 dialog |
| broken data (program_day_id null, no enrollment) | silent skip、session のみ完了扱い |

### 最終 day の設計判断

`findNextProgramDayId` が null（プログラム完走）のとき:
- `enrollment.status = 'completed'` に更新
- `current_program_day_id` は**最後の day のまま保持**（null にしない）
- 理由: どこまでやったかの情報を保持するため。Home は `status='active'` のみを対象とするため完了 enrollment は自動的に非表示になる

### S-3 との整合

| ケース | 挙動 |
|---|---|
| completed session の `program_day_id` で `/train` 再入場 | `resolveTrainingEntry` は `status='in_progress'` のみを検索 → in_progress なし → `mode='start'` → StartSessionScreen（re-session 可能） |
| Home に戻ると | `force-dynamic` で毎回再取得 + `revalidatePath("/")` で即時反映 |

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `app/api/workout-sessions/[id]/finish/route.ts` | `session.status === 'completed'` 分岐内に `advanceEnrollmentAfterSessionComplete` 呼び出しを追加。`revalidatePath("/")` を追加 |

### 既存実装（D-1〜D-4）の再確認

| 機能 | 場所 | 状態 |
|---|---|---|
| `findNextProgramDayId()` — 次 day 解決 | `lib/workout/enrollment.ts` | ✅ 実装済み |
| `advanceEnrollmentAfterSessionComplete()` — enrollment 進行 | `lib/workout/enrollment.ts` | ✅ 実装済み |
| D-3 idempotency guard | `lib/workout/enrollment.ts` | ✅ 実装済み |
| Finish ボタン + 確認 dialog | `components/workout/WorkoutScreen.tsx` | ✅ 実装済み |
| Summary (isProgramCompleted / Up Next / Restart) | `lib/workout/workout-summary.ts` + `WorkoutSummaryScreen.tsx` | ✅ 実装済み |

---

## 2026-04-14 S-3 — /train Entry Resolution (blocked state)

### STATUS

| 項目 | 状態 |
|---|---|
| `TrainEntryResolution` 型を `types/workout.ts` に追加 | **完了 ✅** |
| `lib/workout/train-entry.ts` — `resolveTrainingEntry()` 新規作成 | **完了 ✅** |
| `components/train/BlockedSessionScreen.tsx` / `.module.css` 新規作成 | **完了 ✅** |
| `app/train/page.tsx` — blocked 分岐を追加 | **完了 ✅** |
| TypeScript 型エラー | **なし ✅** |

### Resolution モード

| mode | 条件 | 挙動 |
|---|---|---|
| `resume` | 同 day の `in_progress` session が存在する | 既存フロー通過 → WorkoutScreen |
| `start` | `in_progress` session なし、または enrollment 未作成 | 既存フロー通過 → StartSessionScreen |
| `blocked` | 同 enrollment の**別 day** に `in_progress` session あり | `BlockedSessionScreen` を返す（新 session 作成をブロック） |
| `invalid` | unauthenticated / supabase 不達 | 既存フロー通過（graceful degradation） |

### BlockedSessionScreen

- エラーカード（赤テーマ）で blocking session の day label を表示
- CTA: "Resume [day label]" → `/train?program=<slug>&programDayId=<blockedByProgramDayId>`
- "Start anyway" は意図的に非実装（現フェーズ外）
- 副アクション: "Go to Home"

### クエリ予算（resolveTrainingEntry — 最大 5 クエリ、N+1 なし）

| ステップ | クエリ | 条件 |
|---|---|---|
| 1a | `program_days` で `program_week_id` を解決 | 常時 |
| 1b | `program_weeks` で `program_id` を解決 | 常時 |
| 2 | `program_enrollments` で active enrollment を検索 | `program_id` 解決済みの場合 |
| 3 | `workout_sessions` で in_progress sessions を検索 | enrollment あり |
| 4 | `getProgramDayLabel` で blocking day ラベルを取得 | mode = `blocked` のみ |

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `types/workout.ts` | `TrainEntryResolution` 型を追加 |
| `lib/workout/train-entry.ts` | **新規作成** — `resolveTrainingEntry(programDayId)` |
| `components/train/BlockedSessionScreen.tsx` | **新規作成** |
| `components/train/BlockedSessionScreen.module.css` | **新規作成** |
| `app/train/page.tsx` | `resolveTrainingEntry()` を呼び出し、blocked 時に `BlockedSessionScreen` を返す |

---

## 2026-04-14 S-2 — Home Resume/Start CTA

### STATUS

| 項目 | 状態 |
|---|---|
| `ActiveProgramView` に `actionType` / `activeSessionId` 追加 | **完了 ✅** |
| `InProgressSessionRow` 型 / `selectInProgressSessionsForEnrollments` 追加 | **完了 ✅** |
| Batch 1 に `inProgressSessions` を追加（13クエリ固定） | **完了 ✅** |
| `inProgressByEnrollmentId` マップ構築 + `actionType` / `continueUrl` 算出 | **完了 ✅** |
| `ActiveProgramCard.tsx` — CTA ラベルを actionType で切り替え | **完了 ✅** |
| TypeScript 型エラー | **なし ✅** |

### actionType 判定ルール

| 条件 | actionType | CTA ラベル |
|---|---|---|
| `in_progress` session あり | `'resume'` | **Resume workout** |
| `in_progress` なし + `current_program_day_id` あり | `'start'` | **Start next workout** |
| `current_program_day_id` なし（edge case） | `'none'` | Continue Training (fallback) |

### 遷移先（continueUrl）

| ケース | URL |
|---|---|
| resume | `/train?program=${slug}&programDayId=${in_progress_session.program_day_id}` |
| start | `/train?program=${slug}&programDayId=${enrollment.current_program_day_id}` |
| none | `/train?program=${slug}` |

- train ページが `programDayId` を受け取り、in-progress session の存在を自動検出して resume/start を切り替える（既存ロジックをそのまま再利用）
- 二重作成防止も `startSessionForDay()` の既存 idempotency guard が担う

### クエリ追加

- `selectInProgressSessionsForEnrollments`: 1クエリ追加（Batch 1 に同時並列）
- 合計 **13クエリ固定**（enrollment 数に依存しない）

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `types/workout.ts` | `actionType: 'start'|'resume'|'none'` / `activeSessionId: string|null` を `ActiveProgramView` に追加 |
| `lib/workout/active-program.ts` | `InProgressSessionRow` 型、`selectInProgressSessionsForEnrollments`、`inProgressByEnrollmentId` マップ、`actionType` + resume-aware `continueUrl` 算出を追加 |
| `components/home/ActiveProgramCard.tsx` | CTA ラベルを actionType で三分岐 |

### Defensive handling

| ケース | 対処 |
|---|---|
| enrollment 0件 | 既存 empty state 維持（変化なし） |
| `current_program_day_id = null` | `actionType = 'none'` → "Continue Training" fallback |
| in-progress session が複数（異常系） | DESC order で最新1件を `inProgressByEnrollmentId` に格納（先着）|
| in-progress session の `program_day_id = null` | `enrollment.current_program_day_id` にフォールバック |
| `selectInProgressSessionsForEnrollments` エラー | `[]` を返す（card 全体は維持） |

---

## 2026-04-14 H-4b — e1RM Trend (T1 primary lift)

### STATUS

| 項目 | 状態 |
|---|---|
| `E1RMTrend` 型を `types/workout.ts` に追加 | **完了 ✅** |
| `ActiveProgramView` に `e1rmTrend: E1RMTrend` フィールドを追加 | **完了 ✅** |
| `TrendExerciseRow` に `exercise_type` / `exercise_id` を追加（クエリ拡張） | **完了 ✅** |
| `buildE1RMTrend` — primary T1 lift 選定 + Epley e1RM 算出 | **完了 ✅** |
| `getActiveProgramView` — `e1rmTrend` を各 enrollment view に追加 | **完了 ✅** |
| `E1RMSection` コンポーネント追加（sparkline + 数値比較） | **完了 ✅** |
| TypeScript 型エラー | **なし ✅** |
| 追加クエリ数 | **0（12クエリ固定維持）** |

### T1 判定ルール

| 項目 | ルール |
|---|---|
| T1 判定 | `workout_session_exercises.exercise_type = 'T1'`（DB カラム、NOT NULL） |
| fallback | 不要（カラムが存在するため） |
| Primary T1 lift | T1 exercise_id の中で最多 session 数のもの（tie は Map 挿入順で先勝ち） |
| スコープ | enrollment 単位で独立選定（enrollment ごとに主役 lift が異なってよい） |

### e1RM 定義

| 項目 | 定義 |
|---|---|
| 計算式 | Epley: `e1RM = weight_kg × (1 + reps_done / 30)` |
| Session 代表値 | その session 内の primary T1 completed sets のうち **e1RM 最大値** |
| 除外条件 | `weight_kg = null / ≤ 0`（自重種目等）/ `reps_done = null / ≤ 0` |
| 丸め | `Math.round(e1rm × 10) / 10`（1 decimal）。表示は `.toFixed(1)` |
| sparkline | T1 データが存在する session のみ（データなし session はバー非表示） |

### クエリ変更

- `selectTrendExercises` の select に `exercise_type, exercise_id` を追加のみ
- 新規クエリ追加なし → **12クエリ固定を維持**

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `types/workout.ts` | `E1RMTrend` 型追加、`ActiveProgramView.e1rmTrend` フィールド追加 |
| `lib/workout/active-program.ts` | `TrendExerciseRow` に `exercise_type` / `exercise_id` 追加、`selectTrendExercises` 拡張、`buildE1RMTrend` 追加、view 構築に `e1rmTrend` 追加 |
| `components/home/ActiveProgramCard.tsx` | `E1RMSection` コンポーネント追加、`ProgramCard` に配置 |

### 表示ルール

| recentE1RMs 数 | 表示 |
|---|---|
| 0（T1データなし） | e1RM section 非表示 |
| 1 | sparkline 1本 + `X.X kg` + "Not enough data" |
| 2+ | sparkline + `prev → latest (+X.X%)` |

### Defensive handling

| ケース | 対処 |
|---|---|
| T1 exercises 0件 | `empty` を返す（section 非表示） |
| primary T1 が複数 session に均等分布 | Map 挿入順で先勝ち（安全、deterministic） |
| `weight_kg = null` / `reps_done = null` | continue でスキップ |
| `previousE1RM = 0` | `e1rmChangePercent = null`（0除算防止） |
| 異種 T1 混在（Upper/Lower 等） | primary lift 1本に絞る → 比較不能を防ぐ |

---

## 2026-04-14 H-4 — Volume Trend (first slice)

### STATUS

| 項目 | 状態 |
|---|---|
| `VolumeTrend` 型を `types/workout.ts` に追加 | **完了 ✅** |
| `ActiveProgramView` に `trend: VolumeTrend` フィールドを追加 | **完了 ✅** |
| `selectTrendSessions` / `selectTrendExercises` / `selectTrendSets` バッチクエリ追加 | **完了 ✅** |
| `aggregateSessionVolumes` — session ごとの volume 集計 | **完了 ✅** |
| `buildVolumeTrend` — enrollment ごとの trend 算出 | **完了 ✅** |
| `getActiveProgramView` — 12クエリ固定で trend データをバッチ取得に組み込み | **完了 ✅** |
| `TrendSection` コンポーネント追加（sparkline + 数値比較） | **完了 ✅** |
| `ActiveProgramCard.module.css` — trend section スタイル追加 | **完了 ✅** |
| TypeScript 型エラー | **なし ✅** |

### Volume 定義

| 項目 | 定義 |
|---|---|
| 対象セッション | `status = 'completed'` かつ `program_enrollment_id IN (enrollment_ids)` |
| 対象セット | `is_completed = true` かつ `deleted_at IS NULL` |
| Volume 計算式 | `SUM(weight_kg × reps_done)` |
| 除外条件 | `weight_kg IS NULL or ≤ 0`（自重種目等）/ `reps_done IS NULL or ≤ 0` |
| セッション volume | 上記セットの合計（自重種目のみのセッションは volume = 0 だが sessions 数に計上） |
| 集計対象件数 | 直近最大 6 セッション（`TREND_SESSION_LIMIT`）/ enrollment ごと |

### クエリ構成（12クエリ固定、N+1なし）

| バッチ | クエリ | 依存 |
|---|---|---|
| 1 (parallel×5) | programs / currentDays / allWeeks / recentSessions / **trendSessions** | enrollmentIds のみ |
| 2 (parallel×4) | currentWeeks / allDays / sessionDays / **trendExercises** | trendSessions.ids |
| 3 (parallel×2) | sessionWeeks / **trendSets** | trendExercises.ids |

### 表示ルール

| sessions 数 | 表示 |
|---|---|
| 0 | trend section 非表示 |
| 1 | sparkline 1本 + latest volume (kg) + "Not enough data" |
| 2+ | sparkline + `previous → latest (+X.X%)` |

### Defensive handling

- `weight_kg = null` → 0 扱い（volume に加算しない、session は count される）
- `volumeChangePercent = null` when `previousVolume = 0`（0除算防止）
- `recentVolumes = []` → `TrendSection` が null を返す（crash なし）
- `latestVolume = null` → trend section 非表示（null チェック明示）
- `sessionVolumeMap.get(...)` が `undefined` → 0 に fallback（`?? 0`）

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `types/workout.ts` | `VolumeTrend` 型追加、`ActiveProgramView` に `trend` フィールド追加 |
| `lib/workout/active-program.ts` | `TrendSessionRow` / `TrendExerciseRow` / `TrendSetRow` 追加、3クエリ関数追加、`aggregateSessionVolumes` / `buildVolumeTrend` 追加、`getActiveProgramView` をバッチ拡張 |
| `components/home/ActiveProgramCard.tsx` | `TrendSection` コンポーネント追加、`ProgramCard` 内の最下部に配置 |
| `components/home/ActiveProgramCard.module.css` | trend section 用スタイル追加（sparkline / trendValues / trendUp / trendDown 等） |

### OPEN ISSUES（次段階: e1RM）

- **exercise 選定:** T1 種目（Squat / Bench / Deadlift 等）に絞る必要あり。全種目 e1RM 表示は意味が薄い
- **算出式:** Epley（`w × (1 + r/30)`）か Brzycki か選定が必要
- **top set の定義:** セッション内で最重量のセット（重量優先）or 最高 RPE セットか要決定
- **表示粒度:** enrollment 全体の top set e1RM か、最新セッションのみか
- **実装タイミング:** volume trend の動作と表示設計が固まってから着手推奨

---

## 2026-04-14 H-3c — Multi-enrollment Home

### STATUS

| 項目 | 状態 |
|---|---|
| `ActiveProgramResult.view` → `views: ActiveProgramView[]` に変更 | **完了 ✅** |
| `selectActiveEnrollments` — LIMIT 1 撤去、updated_at / created_at desc 順 | **完了 ✅** |
| `selectProgramsBatch` / `selectCurrentDaysBatch` バッチ取得に置換 | **完了 ✅** |
| `selectAllProgramWeeksByProgramIds` — program_ids バッチ取得 | **完了 ✅** |
| `selectRecentSessionsForEnrollments` — enrollment_ids バッチ取得 + in-memory 分配 | **完了 ✅** |
| `computeProgress` を enrollment ごとに独立呼び出し | **完了 ✅** |
| `ActiveProgramCard.tsx` — `ProgramCard` 抽出 / 0-1-N 表示分岐 | **完了 ✅** |
| `app/page.tsx` — `views` 配列を渡すよう変更 | **完了 ✅** |
| TypeScript 型エラー | **なし ✅** |

### クエリ方針（N+1 なし）

- total 9 クエリ固定（enrollment 数に比例しない）
  1. `selectActiveEnrollments`
  2–5. parallel: `selectProgramsBatch` / `selectProgramDaysBatch`(currentDays) / `selectAllProgramWeeksByProgramIds` / `selectRecentSessionsForEnrollments`
  6–8. parallel: `selectProgramWeeksBatch`(currentWeeks) / `selectAllProgramDays` / `selectProgramDaysBatch`(sessionDays)
  9. `selectProgramWeeksBatch`(sessionWeeks)

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `types/workout.ts` | `ActiveProgramResult.view → views: ActiveProgramView[]` |
| `lib/workout/active-program.ts` | 全 query 関数をバッチ対応に置換、`getActiveProgramView` を N-enrollment 対応に書き直し |
| `components/home/ActiveProgramCard.tsx` | `ProgramCard` サブコンポーネント抽出、props を `views[]` に変更、0/1/N 表示分岐 |
| `app/page.tsx` | `views` 配列を渡すよう変更 |

### 表示分岐

| enrollments 数 | 表示 |
|---|---|
| 0 | 既存 empty state（変化なし） |
| 1 | 既存 ProgramCard と同一の外見 |
| 2+ | ProgramCard を縦に複数枚 |

### Defensive handling

- `current_program_day_id = null` → `completedDays = 0`（progress 0%）
- `current_program_day_id` が day 一覧に存在しない → `completedDays = 0`（crash しない）
- `totalDays = 0` → progress bar 非表示（既存挙動を維持）
- inactive / archived program が program_id に対応しない → title "Current Program" でフォールバック
- enrollment に program_enrollment_id のない sessions → in-memory 分配で自動スキップ

---

## 2026-04-14 H-3b — Progress Bar

### STATUS

| 項目 | 状態 |
|---|---|
| `completedDays` / `totalDays` / `progressPercent` を `ActiveProgramView` に追加 | **完了 ✅** |
| `selectAllProgramWeeks` / `selectAllProgramDays` / `computeProgress` 追加 | **完了 ✅** |
| `Promise.all` 再編（第1バッチに allWeeks、第2バッチに allDays + currentWeek + sessionDays）| **完了 ✅** |
| `ActiveProgramCard.tsx` — progress bar セクション追加 | **完了 ✅** |
| `ActiveProgramCard.module.css` — progress bar スタイル追加 | **完了 ✅** |
| TypeScript 型エラー | **なし ✅** |
| `docs/h3b-progress-bar-spec.md` 作成 | **完了 ✅** |

### 算出ロジック

- `totalDays` = program の全 program_days 数
- `completedDays` = `current_program_day_id` の sorted index（week_number ASC → day_number ASC）
- `progressPercent` = `Math.round(completedDays / totalDays * 100)`
- `current_program_day_id = null` → completedDays = 0（safe fallback）
- `totalDays = 0` → progress bar 非表示

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `types/workout.ts` | `ActiveProgramView` に `completedDays` / `totalDays` / `progressPercent` 追加 |
| `lib/workout/active-program.ts` | `selectAllProgramWeeks` / `selectAllProgramDays` / `computeProgress` 追加、Promise.all 再編 |
| `components/home/ActiveProgramCard.tsx` | progress bar セクション（meta 直下、positionRow 直上） |
| `components/home/ActiveProgramCard.module.css` | progress bar スタイル群追加 |
| `docs/h3b-progress-bar-spec.md` | 新規作成 |

---

## 2026-04-14 H-3 — Active Program Dashboard

### STATUS

| 項目 | 状態 |
|---|---|
| `ActiveProgramSession` / `ActiveProgramView` / `ActiveProgramResult` 型追加 | **完了 ✅** |
| `lib/workout/active-program.ts` — `getActiveProgramView` 実装 | **完了 ✅** |
| `app/page.tsx` — SSR 化（force-dynamic）+ ActiveProgramCard 組み込み | **完了 ✅** |
| `components/home/ActiveProgramCard.tsx` + `.module.css` 新規作成 | **完了 ✅** |
| TypeScript 型エラー | **なし ✅** |
| `docs/h3-active-program-spec.md` 作成 | **完了 ✅** |

### DISCOVERY

- `program_enrollments.program_id` は直接カラムとして存在 → program join に program_day → program_week 経由の traversal 不要
- `current_program_day_id` から Continue Training URL を直接生成できる
- 既存の `/login` がサインイン入口（`/auth/signin` は存在しない）

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `types/workout.ts` | `ActiveProgramSession` / `ActiveProgramView` / `ActiveProgramResult` を追加 |
| `lib/workout/active-program.ts` | 新規作成。`getActiveProgramView()` — active enrollment → program → day/week → recent 3 sessions |
| `app/page.tsx` | SSR 化、`ActiveProgramCard` + nav grid（Programs / Train / History）を配置 |
| `app/page.module.css` | nav grid スタイル追加、旧 card/list スタイル削除 |
| `components/home/ActiveProgramCard.tsx` | My Program カード（active / empty / 未認証 / エラー 4状態） |
| `components/home/ActiveProgramCard.module.css` | カードスタイル |
| `docs/h3-active-program-spec.md` | 新規作成 |

### 表示分岐

| 状態 | 表示 |
|---|---|
| active enrollment あり | My Program カード（タイトル・level・頻度・期間・Up Next・Continue Training・直近3セッション） |
| 認証済み + enrollment なし | "No active program" + Browse Programs |
| 未認証 | "Sign in to track your progress" + Sign In → `/login` |
| エラー | エラーメッセージ |

### OPEN ISSUES

| ID | 内容 |
|---|---|
| H-3b | 全体進捗バー（完了 day 数 / 総 day 数） |
| H-3c | 複数 active enrollment のサポート（現在 LIMIT 1） |

---

## 2026-04-14 H-2 — Session Detail

### STATUS

| 項目 | 状態 |
|---|---|
| `WorkoutSessionDetailSet` / `WorkoutSessionDetailExercise` / `WorkoutSessionDetailView` / `SessionDetailResult` 型追加 | **完了 ✅** |
| `lib/workout/session-detail.ts` — `getWorkoutSessionDetailView` 実装 | **完了 ✅** |
| `app/session-history/[sessionId]/page.tsx` — 動的ルートページ作成 | **完了 ✅** |
| `SessionDetailScreen.tsx` + `.module.css` — 詳細画面コンポーネント作成 | **完了 ✅** |
| `SessionHistoryScreen.tsx` — "View summary" → "View detail" リンク先を `/session-history/<id>` に変更 | **完了 ✅** |
| TypeScript 型エラー | **なし ✅** |
| `docs/h2-session-detail-spec.md` 作成 | **完了 ✅** |

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `types/workout.ts` | `WorkoutSessionDetailSet` / `WorkoutSessionDetailExercise` / `WorkoutSessionDetailView` / `SessionDetailResult` を追加 |
| `lib/workout/session-detail.ts` | 新規作成。`getWorkoutSessionDetailView(sessionId)` — 8クエリ（session owner guard → exercises → sets → program day/week/program） |
| `app/session-history/[sessionId]/page.tsx` | 動的ルートページ 新規作成（force-dynamic） |
| `components/history/SessionDetailScreen.tsx` | 詳細画面コンポーネント 新規作成 |
| `components/history/SessionDetailScreen.module.css` | 詳細画面スタイル 新規作成 |
| `components/history/SessionHistoryScreen.tsx` | "View summary →" → "View detail →"、リンク先を `/session-history/<id>` へ変更 |
| `docs/h2-session-detail-spec.md` | 新規作成 |

### 画面構成

- Hero: 日付 / プログラム名 — Week N / Day N / ステータスバッジ
- Stats Grid: Started / Finished / Sets Done（completed/total）
- Exercise List: エクササイズカード × N（T1/T2/T3 バッジ / Swapped バッジ / Added バッジ / セットテーブル）
- セットテーブル: # / Kg / Reps / Done（✓/—）/ Note（note があるエクササイズのみ列表示）
- 完了行: `color: --text-primary`、未完了行: `opacity: 0.5`

### OPEN ISSUES

| ID | 内容 |
|---|---|
| H-2b | セット編集（詳細画面からのインライン修正） |
| H-2c | 種目別パフォーマンスグラフ |
| H-3 | セッション削除・アーカイブ |

---

## 2026-04-14 D-4 — Program Re-enroll

### STATUS

| 項目 | 状態 |
|---|---|
| `firstProgramDayId` 型追加（`WorkoutSummaryView`） | **完了 ✅** |
| `selectFirstProgramDayId` 実装（`workout-summary.ts`） | **完了 ✅** |
| "Restart Program" CTA（`WorkoutSummaryScreen.tsx`） | **完了 ✅** |
| TypeScript 型エラー | **なし ✅** |
| `docs/d4-reenroll-spec.md` 作成 | **完了 ✅** |

### DISCOVERY

- `findOrCreateEnrollment` は completed enrollment を無視し、**新 enrollment を INSERT** — re-enroll コアロジックは既実装
- `UNIQUE INDEX` が `WHERE status='active'` のみに適用 → completed は複数保持可能
- 欠けていたのは「Summary から firstProgramDayId を受け取り、Restart Program CTA を出す」UIだけ

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `types/workout.ts` | `WorkoutSummaryView` に `firstProgramDayId: string \| null` を追加 |
| `lib/workout/workout-summary.ts` | `selectFirstProgramDayId` 追加。`isProgramCompleted` 時のみ呼び出し（+2クエリ） |
| `components/summary/WorkoutSummaryScreen.tsx` | `restartUrl` 生成、完走時 actions を "Restart Program" + "Choose Another Program" に変更 |
| `docs/d4-reenroll-spec.md` | 新規作成 |

### 完走後の CTA 分岐

| 状態 | Primary | Secondary |
|---|---|---|
| 完走 + firstDayId あり | **Restart Program** → `/train?program=<slug>&programDayId=<firstDayId>` | Choose Another Program → `/programs` |
| 完走 + firstDayId なし | Browse Programs → `/programs` | — |

---

## 2026-04-14 S-1 — Exercise Swap MVP

### STATUS

| 項目 | 状態 |
|---|---|
| API（PATCH swap endpoint） | **実装済み ✅**（S-1 以前から） |
| `postSwapExercise` クライアント関数 | **実装済み ✅**（S-1 以前から） |
| UI modal（Add/Swap 共有） | **実装済み ✅**（S-1 以前から） |
| `was_swapped` DB 列 | **実装済み ✅**（S-1 以前から） |
| Train「Swapped」バッジ追加 | **完了 ✅** |
| Summary「Swapped this session」バッジ追加 | **完了 ✅** |
| TypeScript 型エラー | **なし ✅** |
| `docs/swap-spec.md` 作成 | **完了 ✅** |

### DISCOVERY

S-1 のコア機能（API・クライアント・モーダル・型・DB）は実装済みだった。
今回追加したのは視覚フィードバック（Swapped バッジ）のみ。

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `components/workout/WorkoutScreen.tsx` | `wasSwapped` 時に Swapped バッジ表示（`headerHint` を差し替え） |
| `components/workout/WorkoutScreen.module.css` | `.swappedBadge` スタイル追加 |
| `components/summary/WorkoutSummaryScreen.tsx` | `wasSwapped` 時に「Swapped this session」バッジ追加 |
| `components/summary/WorkoutSummaryScreen.module.css` | `.swappedBadge` スタイル追加 |
| `docs/swap-spec.md` | 新規作成（API仕様・UIフロー・blocker条件・スコープ外） |

### OPEN ISSUES

| ID | 内容 |
|---|---|
| S-2 | 恒久 swap（program day への書き戻し） |
| S-3 | 代替種目の自動推薦 |
| S-4 | `original_exercise_id` DB 列追加（元種目追跡） |

---

## 2026-04-14 H-1 — Session History（直近セッション一覧）

### STATUS

| 項目 | 状態 |
|---|---|
| `WorkoutSessionListItem` / `SessionHistoryResult` 型追加 | **完了 ✅** |
| `lib/workout/session-list.ts` 新規作成 | **完了 ✅** |
| `app/session-history/page.tsx` 新規作成 | **完了 ✅** |
| `components/history/SessionHistoryScreen.tsx` 新規作成 | **完了 ✅** |
| Home ページに Session History リンク追加 | **完了 ✅** |
| TypeScript 型エラー | **なし ✅** |
| `docs/session-history-spec.md` 作成 | **完了 ✅** |

### 変更ファイル

| ファイル | 内容 |
|---|---|
| `types/workout.ts` | `WorkoutSessionListItem` / `SessionHistoryResult` 型追加 |
| `lib/workout/session-list.ts` | 新規 — `getSessionHistoryView()` / 5クエリで session リストを構築 |
| `app/session-history/page.tsx` | 新規 — Server Component（`force-dynamic`） |
| `components/history/SessionHistoryScreen.tsx` | 新規 — カードリスト UI / auth guard / empty state |
| `components/history/SessionHistoryScreen.module.css` | 新規 |
| `app/page.tsx` | "Session History" ボタン追加 |
| `docs/session-history-spec.md` | 新規 — 仕様書 |

### 表示分岐

| 状態 | 表示 |
|---|---|
| 未ログイン | "Sign in is required to view session history." |
| 0 件 | Empty state + Train へのリンク |
| 1 件以上 | カード一覧（実施日・ステータス・プログラム名・種目数） |
| completed | "View summary →" リンク表示 |

---

## 2026-04-14 D-2 — Summary → 次 day 直接 CTA

### STATUS

| 項目 | 状態 |
|---|---|
| `WorkoutSummaryView` に `nextProgramDayId` / `programSlug` 追加 | **完了 ✅** |
| `workout-summary.ts` で UUID と slug を解決・返却 | **完了 ✅** |
| `WorkoutSummaryScreen.tsx` に Go to Next Day CTA 追加 | **完了 ✅** |
| TypeScript 型エラー | **なし ✅** |
| `docs/day-progression-spec.md` 更新（D-2 セクション追加） | **完了 ✅** |

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `types/workout.ts` | `WorkoutSummaryView` に `nextProgramDayId: string \| null` / `programSlug: string \| null` を追加 |
| `lib/workout/workout-summary.ts` | `ProgramRow` に `slug` を追加、`nextProgramDayId` を outer scope に保持して view に渡す |
| `components/summary/WorkoutSummaryScreen.tsx` | `nextTrainUrl` 生成ロジック追加、actions に "Go to Next Day" CTA 追加 |
| `docs/day-progression-spec.md` | D-2 セクション追加（CTA ロジック・URL 組み立て・表示分岐） |

### CTA 表示分岐

| 状態 | Primary | Secondary |
|---|---|---|
| 通常完了（next day あり） | **Go to Next Day** → `/train?program=<slug>&programDayId=<uuid>` | Back to Train / Browse Programs |
| program 完走 | Back to Programs | Browse Programs |
| program なしセッション | Back to Train | Browse Programs |

---

## 2026-04-14 D-3 — idempotency guard（同一 day 再実行対策）

### STATUS

| 項目 | 状態 |
|---|---|
| root cause 特定 | **完了 ✅** |
| `advanceEnrollmentAfterSessionComplete` に guard 追加 | **完了 ✅** |
| TypeScript 型エラー | **なし ✅** |
| `docs/day-progression-spec.md` 更新 | **完了 ✅** |

### ROOT CAUSE

`advanceEnrollmentAfterSessionComplete` が `session.program_day_id` から next day を計算して enrollment を更新する際、`enrollment.current_program_day_id` がすでに先に進んでいるかを確認していなかった。

古い day の新規セッションを Finish すると enrollment が巻き戻る（regression）可能性があった。

### FIX

`enrollment.current_program_day_id !== session.program_day_id` の場合に早期 return を追加。

```typescript
if (enrollment.current_program_day_id !== session.program_day_id) {
  return;  // 既に advance 済み — no-op
}
```

### 動作マトリクス

| シナリオ | 修正後 |
|---|---|
| 通常の初回 Finish | 正常に advance ✅ |
| 同一 session 再 Finish | Finish route が early return → guard 未到達 ✅ |
| 古い day の新規 session を Finish | guard で skip → regression なし ✅ |
| 最終 day 完了後の新規 session Finish | enrollment が completed → active 検索で取得不可 → return ✅ |

---

## 2026-04-14 D-1 — day progression（Summary Up Next / Program Complete）

### STATUS

| 項目 | 状態 |
|---|---|
| DB の day advancement | **既存実装が稼働中**（`advanceEnrollmentAfterSessionComplete` / `findNextProgramDayId`） |
| `WorkoutSummaryView` 型拡張 | **完了 ✅** |
| `getWorkoutSummaryView` に next day 解決追加 | **完了 ✅** |
| Summary UI — Up Next / Program Complete | **完了 ✅** |
| TypeScript 型エラー | **なし ✅** |
| ローカル確認（`/programs` 4 本・filter・認証ガード） | **pass ✅** |

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `types/workout.ts` | `WorkoutSummaryView` に `isProgramCompleted` / `nextProgramDayLabel` 追加 |
| `lib/workout/workout-summary.ts` | `findNextProgramDayId` を呼び出し next day ラベルを解決。`buildSummaryView` に渡す |
| `components/summary/WorkoutSummaryScreen.tsx` | Up Next カード・Program Complete カード・hero 色・back リンク先を分岐 |
| `components/summary/WorkoutSummaryScreen.module.css` | `.heroCompleted` / `.nextUpCard` / `.completedCard` を追加 |
| `docs/day-progression-spec.md` | 仕様・edge case・未対応事項を新規作成 |

### Summary の表示分岐

| 状態 | 表示 |
|---|---|
| 通常完了（次 day あり） | Up Next: Week N / Day N（青カード）/ Back to Train |
| プログラム完走（最終 day） | 完走メッセージ（黄金カード）/ Back to Programs |
| session 未完了 / エラー | state ごとのメッセージ |

### 未対応（今後の課題）

- 同一 day 再実行で enrollment が 2 day 進む問題（D-3 候補）
- Summary → 次 day 直接リンク（D-2 候補）
- program 完走後の re-enroll フロー（D-4 候補）

---

## 2026-04-14 C-7 — Dumbbell Full Body Base（4本目 seed）

### STATUS

| 項目 | 状態 |
|---|---|
| seed SQL（dumbbell-full-body-base.sql） | **実装完了・commit 3551def ✅** |
| program-metadata.sql（general-fitness / dumbbell タグ追加） | **更新完了・commit 3551def ✅** |
| mock catalog エントリ（program-catalog.ts） | **追加済み ✅** |
| live Supabase 反映 | **fully closed ✅（2026-04-14）** |
| program creation フェーズ | **一時終了 ✅** |

### seed 構成

| 項目 | 内容 |
|---|---|
| slug | `dumbbell-full-body-base` |
| title | `Dumbbell Full Body Base` |
| level | `beginner` |
| frequency | `3 days / week` |
| duration | `4 weeks` |
| source_fidelity | `custom` |
| split | A/B 交互（W1: A/B/A → W2: B/A/B → W3: A/B/A → W4: B/A/B） |
| Day A | Goblet Squat T1 3×12 / DB Bench Press T1 3×10 / DB Row T2 3×10 |
| Day B | Romanian Deadlift T1 3×12 / DB Shoulder Press T1 3×10 / DB Curl T2 3×12 |

### 追加 tags

| slug | label | axis |
|---|---|---|
| `general-fitness` | General Fitness | goal |
| `dumbbell` | Dumbbell | equipment |

### live 反映手順（手動実行 2 本）

```
1. seed/programs/dumbbell-full-body-base.sql
2. seed/programs/program-metadata.sql
```

### live 確認項目（SQL 実行後）

| 確認項目 | 期待値 |
|---|---|
| `/programs` に 4本目が追加される | Dumbbell Full Body Base が表示される |
| filter chip に Dumbbell が追加される | equipment 軸 |
| filter chip に General Fitness が追加される | goal 軸 |
| `/programs/dumbbell-full-body-base` detail が表示される | 4 weeks × 3 days の week preview |
| 既存 3本（GZCLP / Starting Strength / Upper Lower）の表示が壊れない | 変化なし |

---

## 2026-04-14 C-4 / C-5 fully closed

### STATUS

| 項目 | 状態 |
|---|---|
| C-4 live（Upper Lower Base） | **fully closed ✅** |
| C-5 live（gzclp-base correction） | **fully closed ✅** |
| 原典準拠ルール | **live 反映済み ✅** |
| live SQL hold | **解除 ✅** |
| upper-lower-base tags | **live fix 完了 ✅** |

### live 確認結果（2026-04-14）

| ページ | 確認項目 | 結果 |
|---|---|---|
| `/programs` | 3本表示（GZCLP Base / Starting Strength Phase 2 Base / Upper Lower Base） | ✅ |
| `/programs` | Level filter（Beginner 2件 / Intermediate 1件）が成立 | ✅ |
| `/programs` | filter chips（Beginner / Intermediate / Barbell / Full Body / Strength / Upper / Lower / Squat Focus / Explosive） | ✅ |
| `/programs` | Upper Lower Base カード tags（Strength / Barbell / Upper / Lower） | ✅ |
| `/programs/starting-strength-base` | title = `Starting Strength Phase 2 Base` | ✅ |
| `/programs/starting-strength-base` | Level=Beginner / 3 days/week / 3 weeks | ✅ |
| `/programs/starting-strength-base` | tags = Strength / Barbell / Full Body / Squat Focus | ✅ |
| `/programs/gzclp-base` | title = `GZCLP Base` | ✅ |
| `/programs/gzclp-base` | Level=Beginner / 3 days/week / 4 weeks | ✅ |
| `/programs/gzclp-base` | tags = Strength / Barbell / Full Body | ✅ |

### upper-lower-base tags live fix メモ

- **symptom:** `/programs` 一覧で Upper Lower Base の tag badge が非表示。filter chips に `Upper / Lower` も未表示
- **root cause:** `program-metadata.sql` の upper-lower-base 分はローカル定義済みだったが、live DB に未適用だった（C-3a-live 時点では upper-lower-base が未存在のため反映できなかった可能性が高い）
- **fix scope:** live DB のみ。`upper-lower-base` の `program_tag_assignments` 3件を補修（strength/goal, barbell/equipment, upper-lower/split）。`upper-lower` tag master も必要に応じて補完
- **repo 変更:** なし（ローカル seed 定義に不足はなかった）
- **verification:** `/programs` 一覧で Upper Lower Base カードに tags 表示、filter chips に `Upper / Lower` 追加を確認 ✅

### 確定した原典準拠ルール

- `gzclp-base`: `source_fidelity = original`（Cody Lefever GZCLP base month 準拠）
- `starting-strength-base`: `source_fidelity = original`（Starting Strength Novice Program Phase 2 切り出し）
- `upper-lower-base`: `source_fidelity = custom`（単一原典なしの internal template）

---

## 2026-04-13 Program Source Audit

### STATUS

| 項目 | 状態 |
|---|---|
| audit | 完了 |
| seed correction | 完了 |
| live SQL hold | **解除（2026-04-14）** |

### この更新で固定した原則

- 有名プログラムは、まず原典準拠版を正本にする
- 派生版は別 slug / 別 title / 別 metadata で管理する
- 元ネタがある場合、期間・頻度・日割り・種目順・セット回数・進行ロジック・リセット条件を勝手に変えない
- live Supabase への手動 SQL 実行は、監査後の反映順が固まるまで保留する

### 今回の整理内容

- `seed/programs/gzclp-base.sql`
  - original GZCLP base month に合わせて 3 days / 4 weeks / A1-B1-A2-B2 / T1-T2-T3 構成へ修正
- `seed/programs/starting-strength-base.sql`
  - `Starting Strength Phase 2 Base` として整理
  - slug は route 互換のため `starting-strength-base` を維持
- `seed/programs/upper-lower-base.sql`
  - 単一原典なしの internal custom template と明示
- `supabase/migrations/20260413_000010_program_source_metadata.sql`
  - `source_program_name`
  - `source_fidelity` (`original` / `adapted` / `custom`)
  - `source_notes`
- `seed/programs/program-metadata.sql`
  - 3 program の source metadata を正本化

### 現在の分類

| slug | title | source_program_name | source_fidelity | live 反映 |
|---|---|---|---|---|
| `gzclp-base` | `GZCLP Base` | `GZCLP` | `original` | **live pass ✅** |
| `starting-strength-base` | `Starting Strength Phase 2 Base` | `Starting Strength Novice Program - Phase 2` | `original` | **live pass ✅** |
| `upper-lower-base` | `Upper Lower Base` | `null` | `custom` | **live pass ✅**（tags 要確認） |

### 参照

- `docs/program-source-audit.md`

## 2026-04-13 C-5 — live 反映直前段階

### STATUS

| 項目 | 状態 |
|---|---|
| gzclp-base correction SQL | 完了 |
| live runbook | 完了 |
| live Supabase 反映 | **手動実行待ち** |

### 作成・更新ファイル

| ファイル | 種別 | 内容 |
|---|---|---|
| `seed/programs/gzclp-base-live-correction.sql` | NEW | 既存 gzclp-base を原典準拠構成へ安全に更新する SQL（transaction + pre/post-check 付き） |
| `docs/live-runbook-gzclp-correction.md` | NEW | live 反映の実行手順書（確認チェックリスト・ロールバック観点・実行順まとめ） |

### gzclp-base-live-correction.sql の設計

| 観点 | 内容 |
|---|---|
| slug | 維持（`gzclp-base`）— route / enrollment FK 継続性を保つ |
| program.id | 維持 — `workout_sessions.program_enrollment_id` FK を壊さない |
| transaction | `begin; ... commit;` で囲む。エラー時は自動ロールバック |
| 構造更新方式 | `program_weeks` を DELETE → CASCADE（days / exercises も消える）→ 再 INSERT |
| enrollment 安全性 | `program_enrollments.current_week/day` は integer 型 — FK なし。削除後も壊れない |
| `workout_sessions.program_day_id` | `SET NULL` FK のため、旧 day_id は NULL になる（許容範囲） |
| 事前ガード | `gzclp-base` slug が存在しない場合は EXCEPTION で即 ABORT |
| enrollment NOTICE | active enrollment がある場合は RAISE NOTICE で警告（ブロックしない） |

### live 反映 SQL 実行順

```
1. gzclp-base-live-correction.sql  STEP 0（pre-check）
2. gzclp-base-live-correction.sql  STEP 1（correction、transaction）
3. gzclp-base-live-correction.sql  STEP 2（post-check）
4. program-metadata.sql            （tags / assignments upsert）
5. upper-lower-base.sql            （upper-lower-base が未作成の場合のみ）
```

詳細は `docs/live-runbook-gzclp-correction.md` を参照。

最終更新: 2026-04-13（C-4 完了 / Upper Lower Base seed 追加 — live 反映は手動 SQL 実行待ち）

## 現在地

### 限定公開到達点（2026-04-13 時点）

| 項目 | 状態 |
|---|---|
| public programs 閲覧 | `/programs` / `/programs/[slug]` は未ログインで表示可 ✅ |
| auth 基盤 | Supabase Email/Password sign in / sign up + session cookie ✅ |
| アプリ側 owner guard | finish / summary / set mutation / add exercise / swap exercise = 本人のみ ✅ |
| DB 側制限 | user_id NOT NULL 復元 + RLS 全テーブル適用済み ✅ |
| live workout flow | Program Detail → StartSession → Train → Add/Swap → Finish → Summary 通し確認済み ✅ |
| Exercise History auth 強化 | admin client → server client 統一 / middleware で `/exercise-history/*` 保護 ✅ |
| B-7 live 確認 | 未ログイン redirect（2 slug）/ ログイン済み表示（2 slug）/ 公開ルート非影響 ✅ |
| **C-3b live 確認** | **✅ pass（2026-04-13）— badge 表示確認済み** |
| **C-3c live 確認** | **✅ pass（2026-04-13）— detail metadata 行確認済み** |
| **Phase B 限定公開判断** | **Go ✅（2026-04-13）** |
| **Phase C-1 seed 運用 docs 化** | **完了 ✅（2026-04-13）** |
| **限定公開準備（デプロイガイド）** | **完了 ✅（2026-04-13）** |
| **限定公開実施** | **開始済み ✅（2026-04-13）** |
| **本番 URL** | **`https://training-program-platform-jp.vercel.app`** |
| **Vercel Production Branch** | **✅ `feature/auto-dev-phase3-loop` に変更済み（2026-04-13）** |

- `training-program-platform-jp` は **Next.js App Router + React + TypeScript + Route Handlers + Supabase PostgreSQL + Supabase Auth** で MVP 実装を継続中
- `/train` は workout session の実行画面として利用中
- Exercise History は `/exercise-history/[exerciseSlug]` で Supabase 読込済み
- Finish 後は `/workout-summary/[sessionId]` へ遷移する
- Programs 一覧は `/programs`
- Program Detail MVP は `/programs/[programSlug]`
- Programs list / detail / train selection は Supabase `programs` 読込を土台にしている
- route 用 slug の正本は `programs.slug` に移行済み
- **Program Detail → StartSessionScreen → session 開始** の最小 MVP が完成した
- **限定公開を開始（2026-04-13）**
  - 本番 URL: `https://training-program-platform-jp.vercel.app`
  - Supabase Authentication → URL Configuration 設定済み
  - 招待制運用で live 導線確認を完了
- **Phase B の設計固定（Auth / user_id 必須化 / RLS / 移行順）が完了**
  - 設計メモ: `docs/auth-rls-design.md`
  - 方針: `programs` は public のまま、session / enrollment / summary / history は auth 必須へ戻す
  - 安全方針: user-scoped API は service role 前提にせず、`server client + RLS` を優先する
- **Phase B Step 1 ログイン基盤を実装**
  - `/programs` と `/programs/[programSlug]` は public 維持
  - `/login` を追加
  - middleware は `/workout-summary/*` のみ保護
  - session 開始 API は未ログイン時 401 を返す
- **Phase B Step 1 の live 再確認を実施**
  - `auth.users -> public.users` 自動作成 trigger の live 反映を確認
  - `/login` -> `/programs` の sign in 導線を再確認
  - `/workout-summary/*` の未ログイン保護を再確認
  - Program Detail -> StartSession の未ログイン 401 / ログイン後 201 を再確認
- **Phase B Step 2 を実装**
  - finish / workout summary / workout_sets / workout_session_exercises / session exercise mutation を本人限定へ変更
  - 未ログイン時は user-scoped API が 401 を返す
  - 他人の session / set / summary は 404 で触れない
  - `train-session.ts` / `workout-summary.ts` / `enrollment.ts` の `user_id null` 依存を縮小
- **Phase B Step 3 実装完了（2026-04-13）**
  - migration 000006: `workout_sessions` / `program_enrollments` の null user_id 行を削除（live Supabase 適用済み）
  - migration 000007: 両テーブルの `user_id` を NOT NULL に復元。`idx_program_enrollments_active_user_program` の WHERE 句から `user_id IS NOT NULL` を除去（live Supabase 適用済み）
  - migration 000008: 全テーブルに RLS を有効化 + ポリシー適用（live Supabase 適用済み）
    - public テーブル（programs/exercises/program_weeks/program_days/program_day_exercises）: anon + authenticated が SELECT 可
    - user テーブル（users/enrollments/sessions/session_exercises/sets）: `auth.uid() = user_id` に一致する行のみ操作可
  - コード変更: `session-access.ts` / `enrollment.ts` / `start-session.ts` の client 生成を常に server client へ統一（admin client は RLS を無視するため除去）
  - typecheck: pass / build: pass 確認済み（commit 07cf8c1）
- **Phase B Step 3 ローカル動作確認（2026-04-13）**
  - `/programs` — 未ログインで表示される（server error なし、console error なし）✅
  - `/programs/gzclp-base` — 未ログインで表示される ✅
  - `/workout-summary/*` — ローカル dev 環境（Supabase 未設定）では "Supabase is not configured" を表示（live では `/login` へリダイレクト期待）
  - サーバーログ: error なし ✅
  - コンソールログ: error なし ✅
  - 注: ローカル dev 環境では Supabase 接続なしのため mock catalog fallback が動作。live Supabase への full flow 確認は手動チェック待ち
- **Phase B B-5: Add Exercise / Swap Exercise コードレビュー完了（2026-04-13）**
  - Add Exercise (`POST /api/workout-sessions/[id]/exercises`)
    - 未認証 → `getAuthenticatedWorkoutUserId()` が null → 401 を返す（live 環境で動作）
    - 他人 session_id → `findOwnedWorkoutSession` が null → 404（Step 2 と同じ owner guard パターン）
    - 本人 session → INSERT `workout_session_exercises` + `workout_sets` → RLS INSERT ポリシーを通過する構造を確認
      - exercise INSERT: `workout_session_id = session.id`（検証済み session）→ `session.user_id = auth.uid()` ✅
      - set INSERT: 直前の exercise INSERT 後に実行 → チェーン (set→exercise→session→auth.uid()) が成立 ✅
  - Swap Exercise (`PATCH /api/workout-sessions/[id]/exercises/[exerciseId]`)
    - 未認証 → 401（同上）
    - 他人 session_id → 404（同上）
    - exercise lookup: `.eq("workout_session_id", session.id)` で自分のセッションのみ対象 ✅
    - blocking set check: RLS で自分の session の sets のみ可視 ✅
    - UPDATE `workout_session_exercises` → RLS UPDATE ポリシー通過 ✅
  - ローカル dev テスト（Supabase 未設定）: 500 を返す（env vars なしで `createSupabaseServerClient()` が throw するため。live 環境では 401 → 404 → 成功の期待動作を実装通り確認）
  - **live ブラウザ clickthrough（StartSession → Add Exercise → Swap Exercise → Finish → Summary）完了（2026-04-13）**
    - Program Detail → StartSession → Train → Add Exercise → Swap Exercise → Finish → Summary の通し確認済み ✅

## 完了済み

- Train 画面の基本機能
  - Delete / Complete / Unlock
  - Kg / Reps PATCH 更新
  - Previous history 表示
  - Add Set
- Add Exercise
  - `POST /api/workout-sessions/{id}/exercises`
  - modal UI 実装済み
- Swap Exercise
  - `PATCH /api/workout-sessions/{id}/exercises/{exerciseId}`
  - Add / Swap modal 共通化
  - blocking set がある場合は 409
- Exercise History
  - route: `/exercise-history/[exerciseSlug]`
  - loader: `lib/workout/exercise-history.ts`
  - `auth.getUser()` の `user_id` と `exercises.slug` で絞り込み
  - completed set のみ表示
  - `loading` / `empty` / `error` 実装済み
- Finish summary
  - route: `/workout-summary/[sessionId]`
  - loader: `lib/workout/workout-summary.ts`
  - finish API は `summaryPath` を返す
  - normal finish / `forceFinish=true` のどちらでも summary へ遷移
  - `unauthenticated` / `not_found` / `not_completed` / `error` を画面で分岐
- Programs 一覧 MVP
  - route: `/programs`
  - loader: `lib/programs/program-list.ts`
  - 正本は Supabase `programs`
  - 利用項目は `id` / `slug` / `title` / `description` / `duration_weeks` / `days_per_week` / `level` / `is_public`
  - card は title / level / goal / frequency / duration を表示
  - C-3b で metadata 表示を追加
    - required tags: `goal / equipment / split`
    - optional tag: `focus` は最大 1 件だけ表示
    - `starting-strength-base` は `Squat Focus` badge で `gzclp-base` と差が見える状態に更新
  - C-3b live 修正（2026-04-13）
    - 症状: badge が本番で表示されなかった（`program.tags` が `[]`）
    - 原因: `program_tag_assignments` → `program_tags` の PostgREST 複合 FK join がサイレントエラー
    - 修正: 2クエリ + メモリ結合に変更（`lib/programs/program-library.ts`）
- Program Detail metadata 表示（C-3c）
  - `/programs/[slug]` detail 画面に required tags + optional focus タグ行を追加
  - `ProgramDetailScreen.tsx` / `ProgramDetailScreen.module.css` を変更
  - 一覧と詳細で badge 見た目・意味を統一済み
- Programs filter UI（C-3d）
  - Level / Tag チップ型フィルターを `/programs` に追加
  - client-side AND 結合、Clear ×、0件時 empty state
  - `ProgramsScreen.tsx` に `"use client"` + `useState` / `useMemo`
  - local preview で動作確認済み
- 3本目プログラム seed（C-4）
  - `seed/programs/upper-lower-base.sql` 新規作成（4 weeks × 4 days / week、intermediate）
  - `seed/programs/program-metadata.sql` 更新（upper-lower タグ追加、3プログラム正本化）
  - `lib/programs/program-catalog.ts` mock エントリを `upper-lower-base` へ整合
  - filter の Level 絞り込み（Beginner / Intermediate）と Split タグ（Full Body vs Upper / Lower）が意味ある差分を持つ状態に
  - **live 反映は手動 SQL 実行待ち**: Supabase Dashboard で `upper-lower-base.sql` → `program-metadata.sql` の順で実行
  - `loading` / `empty` / `error` 実装済み
  - summary の戻り先を `/programs` に統一済み
- Program Detail MVP
  - route: `/programs/[programSlug]`
  - loader: `lib/programs/program-detail.ts`
  - 一覧と同じ Supabase `programs` 読込を使用
  - route param は `programs.slug` を使用
  - title / level / goal / frequency / duration / overview を表示
  - `loading` / `ready` / `not_found` / `error` を分岐
  - `/programs` の card から detail route へ遷移可能
  - detail から `/programs` へ戻れる
- Program Detail -> Train の選択連携
  - detail の `Go to Train` は `/train?program=[programSlug]&programDayId=[firstProgramDayId]`
  - `firstProgramDayId`: week 1 / day 1 の UUID を Supabase から解決
  - `firstProgramDayId` が null の場合は `programDayId` なしで遷移し、従来導線を維持
  - train 側 helper は `lib/workout/train-selection.ts`
  - `program` query 一致時のみ selected program title / source を表示
  - `program` query 不一致時のみ warning を表示しつつ current session を継続
  - query なしは従来どおり
- Programs 系 read path の DB slug 化
  - 共通 helper: `lib/programs/program-library.ts`
  - migration で `programs.slug` を追加し、backfill 後に `NOT NULL + UNIQUE` を付与
  - slug ルールは title を slugify し、重複時は `-2`, `-3` suffix で安定採番
  - insert / update で slug が未指定または空なら DB trigger で採番
  - Supabase 読込時は DB の `programs.slug` を使い、読込失敗時のみ `mock_catalog` fallback
  - `mock_catalog` fallback は mock 側の `slug` を維持
  - 読込成功で 0 件のときは empty / not_found / invalid をそのまま表示
- Home 導線
  - `/` は Programs を第一導線、Train を第二導線に整理済み
- **enrollment 最小実装**
  - helper: `lib/workout/enrollment.ts`
    - `findActiveEnrollment(programId, userId)` — active enrollment を検索
    - `findOrCreateEnrollment(programId, firstProgramDayId, userId)` — なければ作成
    - `resolveStartProgramDayId(programId, firstProgramDayId, userId)` — enrollment current day > first day の優先解決
    - `findNextProgramDayId(currentDayId)` — 同 week 次 day → 次 week day 1 → null（完了）の順で解決
    - `advanceEnrollmentAfterSessionComplete(sessionId)` — Finish 後に enrollment を進める
  - migration: `20260412_000004_enrollment_current_day_id.sql`
    - `program_enrollments.current_week/current_day` を削除
    - `program_enrollments.current_program_day_id uuid` を追加（day UUID 直接保持）
    - `program_enrollments.updated_at` を追加
    - `program_enrollments.user_id` を nullable 化（MVP、auth 整備後に戻す）
    - partial unique index: `(user_id, program_id) WHERE status='active' AND user_id IS NOT NULL`
  - Program Detail → `startProgramDayId` を enrollment ベースで解決（enrollment > firstProgramDayId > null）
  - `ProgramDetailView` に `startProgramDayId` / `hasActiveEnrollment` を追加
  - Finish 後に `advanceEnrollmentAfterSessionComplete` を呼び enrollment を次 day へ進める
  - 最終 day 完了時: `enrollment.status = 'completed'`、`current_program_day_id` は最後の day のまま維持（ゼロ化しない）
- **session 開始 MVP（program_day_id ベース）**
  - 開始単位: `program_day_id`（Week 1 / Day 1 の UUID）
  - `enrollment_id` は今回スコープ外（未使用）
  - helper: `lib/workout/start-session.ts::startSessionForDay()`
    - 重複防止: 同一 `program_day_id` の `in_progress` セッションが存在すれば即 `reused=true` を返す
    - `program_day_exercises` を読み込み `workout_session_exercises` + `workout_sets` を seed
    - `user_id` は auth があれば設定、なければ null（migration 3 で nullable 化）
  - helper: `lib/workout/start-session.ts::getProgramDayLabel(programDayId)`
    - `program_days.day_number` + `program_weeks.week_number` を JOIN して `"Week N / Day N"` を返す
    - Supabase 未接続時は `"Week 1 / Day 1"` にフォールバック
  - API: `POST /api/workout-sessions { program_day_id }` → `{ sessionId, reused }` を返す
  - 画面: `StartSessionScreen`（`components/workout/StartSessionScreen.tsx`）
    - Program タイトル / 動的 day ラベル（DB から取得）を表示
    - Start Workout ボタン → API 呼び出し → `/train?program=[slug]` へ遷移
    - Cancel → `/programs/[slug]` へ戻る
  - `/train` ルーティング:
    - `programDayId` あり + `in_progress` セッション存在 → `WorkoutScreen`
    - `programDayId` あり + セッションなし → `StartSessionScreen`
    - `programDayId` なし → 従来どおり `getCurrentWorkoutSessionView()`
- migration: `20260412_000003_nullable_session_user.sql`
- **Phase B 設計メモ更新（2026-04-12）**
  - auth 依存箇所の洗い出しを完了
  - `user_id` 必須化の DB / API / server / client 変更点を整理
  - RLS 最小設計案を整理
  - Workout Summary の auth なし暫定対応を戻す条件を明文化
  - 実装順を `1. login基盤 -> 2. user_id必須化 -> 3. NOT NULL + RLS` で固定
- **Phase B Step 1 実装（2026-04-12）**
  - migration: `20260412_000005_auth_user_profile_trigger.sql`
    - `auth.users -> public.users` 自動 insert trigger を追加
    - 既存 `auth.users` の backfill insert を追加
  - browser client: `lib/supabase/client.ts`
  - login page: `app/login/page.tsx`
    - Email / Password の sign in / sign up トグルを追加
    - 成功時は `/programs` に遷移
    - env 未設定 / auth エラーの表示あり
  - middleware: `middleware.ts`
    - `/workout-summary/*` だけを保護
    - `/programs` と `/programs/[programSlug]` は保護しない
  - session 開始の入口だけ先行保護
    - `lib/workout/start-session.ts`: 未ログイン時 `unauthenticated`
    - `POST /api/workout-sessions`: 401 を返す
    - `StartSessionScreen`: 401 時に `/login` 導線を表示

## 次アクション

1. **C-3c: Program Detail metadata 表示**
   - 一覧で使い始めた metadata を `/programs/[slug]` にも載せる
   - required / optional tag の見せ分けを detail で整理する
   - filter UI を入れる前に detail 側の情報密度を整える
2. **B-6: sign up 429 の再確認（低優先）**
   - live Supabase Auth の `over_email_send_rate_limit` により未通過（外部レート制限、実装不備ではない）
   - 時間経過後に再試行する
3. helper 旧形式 slug から DB slug への redirect 方針が必要かを判断する

## 保留事項

- Supabase 読込失敗時のみ `mock_catalog` fallback が残る
- `lib/programs/program-library.ts` / `lib/programs/program-detail.ts` は admin client のまま（programs は public RLS ポリシーがあるため実害なし。Phase C で server client 統一を検討）
- user-scoped な通常ユーザーフロー（train/summary/history）は server client + RLS に統一済み
- service role は通常ユーザーフローでは使用しない方針。管理処理専用に限定する
- Delete undo は MVP スコープ外
- live sign up は `over_email_send_rate_limit` が解消するまで再試行待ち（外部レート制限、実装不備ではない）
- 招待制運用のため、案内先 URL と配布アカウントの棚卸しを継続する

## Phase C 進捗

### 限定公開開始（完了 2026-04-13）

- Vercel 本番 URL: `https://training-program-platform-jp.vercel.app`
- Supabase URL Configuration を本番 URL に更新済み
- live 確認結果
  - `/programs` 表示成功
  - 未ログインで保護ページは `/login` へ redirect
  - ログイン後 `/exercise-history/squat` 表示成功
  - `/train` → Finish → `/workout-summary` 成功
  - `/exercise-history/overhead-press` に 5 セット履歴反映成功
- 判定: 限定公開は成功。次フェーズは C-2 に戻る

### 限定公開準備（完了 2026-04-13）

- `docs/limited-release-guide.md` — Vercel + Supabase 限定公開の全手順
  - 役割分担（Vercel / Supabase / GitHub）
  - 環境変数 3 つの用途・設定手順
  - Supabase Site URL / Redirect URL 設定
  - デプロイ手順（Vercel プロジェクト作成 → env 設定 → デプロイ → URL 設定）
  - 招待制ユーザー管理手順
  - スモークテスト（公開ルート / 認証フロー / ワークアウトフロー）
  - よくある失敗点
- `docs/limited-release-checklist.md` — 限定公開前チェックリスト（7セクション）
- `.env.example` — 環境変数テンプレートにコメント追加（用途・注意点を明記）

### C-1: seed 運用ルール docs 化（完了 2026-04-13）

- `docs/seed-program-guide.md` — プログラム追加の完全ガイド
  - 追加順序（exercises → programs → weeks → days → day_exercises）
  - 各テーブルの制約（slug 一意・order_index 一意・exercise_type 制約等）
  - UUID ハードコード禁止 / `do $$ ... $$` + `SELECT INTO` パターンを規定
  - idempotent 設計（同一 slug なら全体スキップ）
  - ローカル反映手順・確認クエリ・失敗しやすい点
  - 既存プログラムを壊さない更新方針
- `seed/programs/_template.sql` — 新規追加用テンプレート
  - 全プレースホルダーにコメント付き
  - 週 / 日 / 種目の構造を拡張しやすい形で記述
  - 確認クエリをコメントで同梱

### C-2 以降（更新 2026-04-13）

- C-2: 2本目のプログラム追加（Starting Strength Base を live 反映済み）
- C-3: プログラム難易度・タグ管理
- C-4: ユーザー進捗ダッシュボード

### C-2: 2本目プログラム追加（完了 2026-04-13）

- 候補: `Starting Strength Base`
- 判断理由
  - `GZCLP Base` と同じ初心者向けバーベル軸だが、`Starting Strength Base` は「スクワット毎回」「A/B 交互」「Power Clean を含む」構成で役割を分けやすい
  - 既存 seed の `squat / bench-press / overhead-press / deadlift` を再利用でき、追加種目は `power-clean` の 1 つだけで済む
- 適用結果
  - `seed/programs/starting-strength-base.sql`
  - service role 経由で live Supabase に反映済み（CLI / `psql` 未導入のため）
  - `starting-strength-base` program 作成済み
  - 3 weeks x 3 days、27 件の `program_day_exercises` を確認済み
  - `power-clean` を含む exercise 参照成立済み
- live 確認結果
  - `/programs` に `Starting Strength Base` 表示成功
  - `/programs/starting-strength-base` 表示成功
  - detail の `Go to Train` が `/train?program=starting-strength-base&programDayId=...` を指すことを確認
  - `/train` 入口で `Starting Strength Base` / `Week 1 / Day 1` / `Start Workout` を確認
- 補足
  - 初回適用時に Power Clean の日本語名と description が `?` で入ったため、live DB 上で日本語文字列を修正済み
  - 既存 `GZCLP Base` は `slug / title / level / is_public / duration_weeks / days_per_week` に変更なし

### C-2b: seed 原本整合（完了 2026-04-13）

- `seed/programs/starting-strength-base.sql` の日本語文字列を live 修正内容に合わせて更新
  - `power-clean.name_ja`
  - `program.description`
  - `program_days.progression_guide`
  - `program_days.notes`
- seed 内の実データ文字列は `U&'...'` の Unicode escape 形式へ変更し、文字コード差分の影響を受けにくくした
- `docs/seed-program-guide.md` に UTF-8 保存と SQL Editor 貼り付け時の注意を追記
- 正本方針を回復
  - repo の seed 原本 = live DB へ反映したい状態
  - live DB の手修正内容は seed 原本へ戻し込み済み

### C-3: プログラム metadata 設計（完了 2026-04-13）

- `docs/program-metadata-design.md` を追加し、`/programs` 比較用 metadata の仕様を固定
- level 方針
  - DB canonical value は `beginner / intermediate / advanced`
  - UI は `Beginner / Intermediate / Advanced` 表示
  - `novice` は現時点では採用しない
- tag 方針
  - required: `goal`, `equipment`, `split`
  - optional: `focus`
  - `level / days_per_week / duration_weeks` は tag に重複させない
- 既存 2 本への仮割り当て
  - `gzclp-base`: `strength`, `barbell`, `full-body`
  - `starting-strength-base`: `strength`, `barbell`, `full-body`, `squat-focus`, `explosive`
- 次は C-3 実装として schema / seed / `/programs` 表示反映へ進む

### C-3a: metadata 基盤実装（完了 2026-04-13）

- migration を追加
  - `supabase/migrations/20260413_000009_program_metadata_foundation.sql`
  - `programs.level` を `beginner / intermediate / advanced` の canonical value に正規化
  - `program_tags` / `program_tag_assignments` を追加
  - axis は `goal / equipment / split / focus` のみに制限
  - `goal / equipment / split` は `program_id + axis` の unique index で single-select 制御
  - public reference data として RLS の read policy を追加
- seed を追加
  - `seed/programs/program-metadata.sql`
  - `gzclp-base` と `starting-strength-base` に metadata を付与する idempotent seed
- read path を追加
  - `types/programs.ts`: `ProgramLevel`, `ProgramTag`, `levelKey`, `tags`
  - `lib/programs/program-library.ts`: program ごとに metadata tags を取得する土台を追加
  - metadata table 未適用時は warning を出しつつ tags を空配列にして既存 `/programs` を壊さない
  - `lib/programs/program-catalog.ts`: mock catalog は fallback 維持、metadata tags は空配列で非正本扱い
- 次は C-3b として `/programs` list / detail の metadata 表示を実装する

### C-3a-live: metadata live 反映（完了 2026-04-13）

- live Supabase へ反映済み
  - migration: `20260413_000009_program_metadata_foundation.sql`
  - seed: `seed/programs/program-metadata.sql`
- SQL 確認結果
  - `program_tags_count = 5`
  - `program_tag_assignments_count = 8`
  - `gzclp-base`: required `goal / equipment / split` が各 1
  - `starting-strength-base`: required `goal / equipment / split` が各 1、optional `focus = 2`
- live route 確認
  - `/programs`
  - `/programs/gzclp-base`
  - `/programs/starting-strength-base`
  - いずれも `Source: Supabase` で正常表示を確認

### C-3b: `/programs` metadata 表示（完了 2026-04-13）

- `components/programs/ProgramsScreen.tsx`
  - list card に `level` badge を維持
  - required tags を `goal -> equipment -> split` の順で表示
  - optional `focus` は最大 1 件だけ補助 badge として表示
- `components/programs/ProgramsScreen.module.css`
  - 既存 card デザインに合わせた最小 pill / badge を追加
- 表示差分
  - `gzclp-base`: `Strength / Barbell / Full Body`
  - `starting-strength-base`: `Strength / Barbell / Full Body + Squat Focus`
- local / live とも `/programs` 一覧で表示崩れなく比較性が上がった

---

## テスト状況

- `npm run typecheck`
  - pass
- `npm run build`
  - pass
- **限定公開 live 実施確認（2026-04-13 完了）**
  - 本番 URL: `https://training-program-platform-jp.vercel.app`
  - `/programs` 表示成功 ✅
  - 未ログインで保護ページは `/login` に redirect ✅
  - ログイン後 `/exercise-history/squat` 表示成功 ✅
  - `/train` → Finish → `/workout-summary` 成功 ✅
  - `/exercise-history/overhead-press` に 5 セット履歴反映成功 ✅
- **Phase B B-7: Exercise History auth 強化 + live 確認（2026-04-13 完了）**
  - 未ログイン `/exercise-history/squat` → `/login?next=%2Fexercise-history%2Fsquat` redirect ✅
  - 未ログイン `/exercise-history/overhead-press` → `/login?next=%2Fexercise-history%2Foverhead-press` redirect ✅（slug 変更でも `next` 正確）
  - ログイン済み `/exercise-history/squat` → T1 / Squat 表示（Supabase DB 取得）✅
  - ログイン済み `/exercise-history/bench-press` → T3 / Bench Press 表示（Supabase DB 取得）✅
  - 未ログイン `/programs` → redirect なし・一覧表示 ✅（middleware の公開ルート通過を確認）
  - 未ログイン `/programs/gzclp-base` → redirect なし・詳細表示 ✅
  - 画面崩れ・500 エラーなし ✅
- **Phase B B-7: Exercise History auth 強化 実装詳細（2026-04-13）**
  - `lib/workout/exercise-history.ts`: admin client 条件分岐を削除し、常に server client を使用
    - 変更前: `hasSupabaseServiceRoleEnv() ? createSupabaseAdminClient() : serverClient`
    - 変更後: `const queryClient = serverClient`
    - 不要になった `createSupabaseAdminClient` / `hasSupabaseServiceRoleEnv` import を削除
  - `middleware.ts`: matcher に `/exercise-history/:path*` を追加
    - 未ログイン時は `/login?next=/exercise-history/[slug]` へ redirect
    - 変更前: `matcher: ["/workout-summary/:path*"]`
    - 変更後: `matcher: ["/workout-summary/:path*", "/exercise-history/:path*"]`
  - `train-session.ts` / `workout-summary.ts`: B-3 で `createWorkoutQueryClient()` → server client 統一済み。追加変更なし
  - typecheck: pass / build: pass 確認済み（commit 後 live 確認推奨）
  - 認可境界の担保:
    - middleware で未ログイン遮断（redirect to `/login`）
    - `getExerciseHistoryView` 内で `auth.getUser()` による userId チェック（二重防衛）
    - `selectRecentUserSessions` で `.eq("user_id", userId)` — 本人セッションのみ取得
    - RLS: `workout_sessions` の SELECT ポリシー `auth.uid() = user_id` がクエリを本人に限定
    - 後続の `session_exercises` / `sets` クエリは本人セッション IDs を起点とするため他ユーザーデータ混入なし
- **Phase B B-3/B-4/B-5 live 手動確認（2026-04-13 完了）**
  - Program Detail → StartSession → Train → Add Exercise → Swap Exercise → Finish → Summary 通し確認 ✅
  - Supabase dashboard: null user_id = 0 件 / NOT NULL 制約 / RLS ポリシー適用済み ✅
  - 未ログイン時の 401 保護・他ユーザー session → 404 の動作確認 ✅
- **Phase B Step 3 ローカル dev 確認（2026-04-13）**
  - `/programs` — 未ログイン・Supabase 未設定環境で表示確認 ✅（mock fallback 動作）
  - `/programs/gzclp-base` — 未ログインで表示確認 ✅
  - `/workout-summary/test-session-id` — "Supabase is not configured" 表示（Supabase 未設定のため。live では `/login` リダイレクト期待）
  - server error: なし ✅ / console error: なし ✅
- **Phase B Step 2 local browser + live Supabase 確認（2026-04-12）**
  - sign in 相当
    - auth cookie を使った browser context で `/programs` 表示を確認
  - StartSession（本人）
    - user A / user B とも `POST /api/workout-sessions` が `201`
  - workout summary（未ログイン）
    - `/workout-summary/[sessionId]` は `/login?next=...` へ redirect
  - Finish（未ログイン）
    - `POST /api/workout-sessions/[id]/finish` が `401`
  - Finish（他人 session）
    - user A から user B の session finish は `404`
  - workout set complete（他人 set）
    - user A から user B の set complete は `404`
  - Finish（本人 session）
    - user A の session finish は `200`
    - `summaryPath` を返し、本人 summary を表示
  - workout summary（他人 session）
    - user A で user B の summary を開くと `Workout summary not found`
- **Phase B Step 1 live 手動確認（2026-04-12 再確認済み）**
  - `/programs`
    - 未ログインでも表示可
  - `/programs/gzclp-base`
    - 未ログインでも表示可
  - `/workout-summary/[sessionId]`
    - 未ログイン時は `/login?next=...` へ redirect されることを再確認
  - Program Detail -> StartSession（未ログイン）
    - `POST /api/workout-sessions` が `401` を返すことを確認
    - メッセージ「ログインするとワークアウトを開始できます。」と `/login` 導線表示を再確認
  - sign in
    - **pass**
    - fresh verified test user で `/login` -> `/programs` redirect を再確認
  - StartSession（ログイン済み）
    - **pass**
    - `POST /api/workout-sessions` が `201` を返し、`sessionId` を受け取れることを確認
    - `/programs/gzclp-base` -> `Go to Train` -> `Start Workout` 後に `/train?program=gzclp-base` へ遷移し、WorkoutScreen 表示を再確認
  - `public.users` 自動作成
    - **pass**
    - live Supabase で fresh verified test user 作成直後に `public.users(id)` 行が自動作成されることを確認
    - `20260412_000005_auth_user_profile_trigger.sql` の live 反映前提で再確認完了
  - sign up
    - **pending / external**
    - live Supabase Auth が引き続き `429 over_email_send_rate_limit` を返し、browser 上で `email rate limit exceeded` 表示
    - auth user は作成されず、外部レート制限継続中と判断
- **live Supabase E2E（2026-04-12 完了）**
  - Programs → GZCLP Base → StartSession → Train → Finish → Summary まで通し確認済み
  - DB: `workout_sessions.status = completed`, `program_enrollment_id` 紐付き確認済み
  - enrollment `current_program_day_id` は Day 2 に進行（SQL Editor で確認）

## 直近の重要判断

- Programs list / detail / train selection の正本は Supabase `programs` とする
- route 用 slug は helper 導出を廃止し、Supabase `programs.slug` を正本にする
- slug は title を base に slugify し、重複時は `-2`, `-3` suffix で安定採番する
- 既存 row は migration の backfill で埋め、今後の insert / update は DB trigger で補完する
- fallback は Supabase 読込失敗時のみ `mock_catalog` を使う。空データはそのまま empty / not_found / invalid として扱う
- Workout Summary の戻り先は `/` ではなく `/programs`
- `screens.md` と `PROJECT_STATUS.md` は日本語ベースで継続する
- **開始単位は `program_day_id`、enrollment_id は今回スコープ外とした**
  - 理由: enrollment フローを先に作ると scope が大きくなりすぎる。まず「選んだ day を開始できる」を優先した
- **`workout_sessions.user_id` を nullable にした（migration 3）**
  - 理由: 未認証 MVP では `public.users` FK を満たせないため。auth 整備後に戻す方針
- **Phase B の通常ユーザーフローでは service role を使わない方針に修正（2026-04-12）**
  - 理由: admin client は RLS を無視するため、`ログイン済み` チェックだけだと他人の session / set を触れる危険がある
  - user-scoped API / loader は `server client + cookie + RLS` を第一選択にする
- **Step 1 では public 導線を維持する判断（2026-04-12）**
  - `/programs` と `/programs/[programSlug]` は保護しない
  - まず `/workout-summary/*` と session 開始だけに auth を入れ、Phase A の閲覧導線を壊さない
- **Step 1 は完了扱いに更新（2026-04-12）**
  - `auth.users -> public.users` 自動作成 trigger の live 反映を確認
  - sign in / protected route / StartSession auth gate / StartSession logged-in success を再確認
  - browser sign up は `over_email_send_rate_limit` 継続中だが、外部レート制限による pending と判断し Step 1 の blocker から外す
- **Step 2 はアプリ側 owner guard を優先して実装（2026-04-12）**
  - RLS 前でも、finish / summary / set mutation / session exercise mutation は `user_id` と関連 session を必ず照合する
  - 未ログインは `401`、他人データは `404`、完了済み session への mutation は `409` で止める
- **Next.js 14 の fetch cache 問題を修正（2026-04-12）**
  - `createSupabaseAdminClient` / `createSupabaseServerClient` に `global.fetch` で `cache: 'no-store'` を設定
  - Server Component から Supabase を呼ぶとき Next.js が fetch 結果をキャッシュしていた
  - API Route は影響を受けないが Server Component（page.tsx）は同じ fetch URL をキャッシュする
  - `force-dynamic` はページのキャッシュを無効化するが fetch キャッシュは別途対処が必要
