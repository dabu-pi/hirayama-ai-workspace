# PROJECT_STATUS

最終更新: 2026-04-12（Phase B Step 1 ログイン基盤実装）

## 現在地

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

1. live Supabase に `20260412_000005_auth_user_profile_trigger.sql` を適用する
   - 現ターンでは CLI access token / DB 接続情報がなく、直接 apply は未完了
   - 適用後に `auth.users -> public.users` 自動作成を再確認する
2. sign up の live 再確認
   - `over_email_send_rate_limit` 解消後に browser で再試行する
3. Step 2: session / set / enrollment 系を auth 必須へ戻し、user-scoped API を `server client + owner 制約` に寄せる
4. Step 3: `workout_sessions.user_id` / `program_enrollments.user_id` を NOT NULL に戻し、RLS を適用する
5. helper 旧形式 slug から DB slug への redirect 方針が必要かを判断する

## 保留事項

- Supabase 読込失敗時のみ `mock_catalog` fallback が残る
- `workout_sessions.user_id` / `program_enrollments.user_id` は nullable（MVP、auth 整備後に戻す）
- program_enrollments の user_id が null のとき unique 制約が効かないため、同一 day の enrollment が複数作られる可能性あり（auth 整備後に解消）
- Step 1 では `POST /api/workout-sessions` だけ auth 必須化した。finish / set 更新など他の user-scoped API は Step 2 で揃える
- user-scoped API が `admin client` を使う前提のままだと owner 制約を見落としやすい。Phase B で `server client + RLS` へ寄せる
- service role は通常ユーザーフローでは原則不要にする方針。管理処理専用に限定する
- Delete undo は MVP スコープ外

## テスト状況

- `npm run typecheck`
  - pass
- `npm run build`
  - pass
- **Phase B Step 1 live 手動確認（2026-04-12）**
  - `/programs`
    - 未ログインでも表示可
  - `/programs/gzclp-base`
    - 未ログインでも表示可
  - `/workout-summary/[sessionId]`
    - 未ログイン時は `/login?next=...` へ redirect されることを確認
  - Program Detail -> StartSession（未ログイン）
    - `Start Workout` 実行で 401 相当の画面メッセージ「ログインするとワークアウトを開始できます。」を確認
    - `/login` 導線表示を確認
  - sign in
    - **pass**
    - 確認用の verified test user で `/login` -> `/programs` redirect を確認
  - StartSession（ログイン済み）
    - **pass**
    - `/programs/gzclp-base` -> `Go to Train` -> `Start Workout` で `/train?program=gzclp-base` の WorkoutScreen 表示を確認
  - sign up
    - **fail / blocker**
    - live Supabase Auth が `429 over_email_send_rate_limit` を返し、browser 上で `email rate limit exceeded` 表示
  - `public.users` 自動作成
    - **fail / blocker**
    - admin 作成の verified test user で `public.users` 行の自動作成は確認できず
    - live には `20260412_000005_auth_user_profile_trigger.sql` が未適用、または同等 trigger が未反映の可能性が高い
    - 残りの flow 確認のため、検証中のみ `public.users` 行を手動 insert して sign in / StartSession を継続確認
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
- **Step 1 live 確認は部分完了（2026-04-12）**
  - sign in / protected route / StartSession auth gate / StartSession logged-in success は確認できた
  - ただし live 側の sign up は `over_email_send_rate_limit`、`public.users` 自動作成 trigger は未反映の疑いがあり、Step 1 全体の完了判定は保留
- **Next.js 14 の fetch cache 問題を修正（2026-04-12）**
  - `createSupabaseAdminClient` / `createSupabaseServerClient` に `global.fetch` で `cache: 'no-store'` を設定
  - Server Component から Supabase を呼ぶとき Next.js が fetch 結果をキャッシュしていた
  - API Route は影響を受けないが Server Component（page.tsx）は同じ fetch URL をキャッシュする
  - `force-dynamic` はページのキャッシュを無効化するが fetch キャッシュは別途対処が必要
