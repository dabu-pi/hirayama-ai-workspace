# PROJECT_STATUS

最終更新: 2026-04-13（B-7 Exercise History auth 強化完了 / server client 統一・middleware 保護追加）

## 現在地

### フェーズ B 到達点（2026-04-13 時点）

| 項目 | 状態 |
|---|---|
| public programs 閲覧 | `/programs` / `/programs/[slug]` は未ログインで表示可 ✅ |
| auth 基盤 | Supabase Email/Password sign in / sign up + session cookie ✅ |
| アプリ側 owner guard | finish / summary / set mutation / add exercise / swap exercise = 本人のみ ✅ |
| DB 側制限 | user_id NOT NULL 復元 + RLS 全テーブル適用済み ✅ |
| live workout flow | Program Detail → StartSession → Train → Add/Swap → Finish → Summary 通し確認済み ✅ |
| Exercise History auth 強化 | admin client → server client 統一 / middleware で `/exercise-history/*` 保護 ✅ |
| 次の課題 | sign up 429 再確認（B-6）/ 限定公開判断 |

- `training-program-platform-jp` は **Next.js App Router + React + TypeScript + Route Handlers + Supabase PostgreSQL + Supabase Auth** で MVP 実装を継続中
- `/train` は workout session の実行画面として利用中
- Exercise History は `/exercise-history/[exerciseSlug]` で Supabase 読込済み
- Finish 後は `/workout-summary/[sessionId]` へ遷移する
- Programs 一覧は `/programs`
- Program Detail MVP は `/programs/[programSlug]`
- Programs list / detail / train selection は Supabase `programs` 読込を土台にしている
- route 用 slug の正本は `programs.slug` に移行済み
- **Program Detail → StartSessionScreen → session 開始** の最小 MVP が完成した
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

1. **B-7 live 確認（推奨）**
   - 未ログイン状態で `/exercise-history/[slug]` へアクセス → `/login?next=...` redirect を確認
   - ログイン済み状態で `/exercise-history/[slug]` → 本人履歴のみ表示・他人データ混入なしを確認
   - 実装変更は完了済み（typecheck / build pass）。live 確認は手動チェック
2. **限定公開判断**
   - `docs/phase-b-step3-checklist.md` の公開条件（B-3/B-4/B-5/B-7）を確認し、限定公開の判断を行う
3. **B-6: sign up 429 の再確認（低優先）**
   - live Supabase Auth の `over_email_send_rate_limit` により未通過（外部レート制限、実装不備ではない）
   - 時間経過後に再試行する
4. helper 旧形式 slug から DB slug への redirect 方針が必要かを判断する

## 保留事項

- Supabase 読込失敗時のみ `mock_catalog` fallback が残る
- `lib/programs/program-library.ts` / `lib/programs/program-detail.ts` は admin client のまま（programs は public RLS ポリシーがあるため実害なし。Phase C で server client 統一を検討）
- user-scoped な通常ユーザーフロー（train/summary/history）は server client + RLS に統一済み
- service role は通常ユーザーフローでは使用しない方針。管理処理専用に限定する
- Delete undo は MVP スコープ外
- live sign up は `over_email_send_rate_limit` が解消するまで再試行待ち（外部レート制限、実装不備ではない）

## テスト状況

- `npm run typecheck`
  - pass
- `npm run build`
  - pass
- **Phase B B-7: Exercise History auth 強化（2026-04-13 実装完了）**
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
