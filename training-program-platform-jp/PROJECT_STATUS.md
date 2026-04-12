# PROJECT_STATUS

最終更新: 2026-04-12

## 現在地

- `training-program-platform-jp` は **Next.js App Router + React + TypeScript + Route Handlers + Supabase PostgreSQL + Supabase Auth + Vercel** 構成で実装中
- `/train` は `workout_sessions` / `workout_session_exercises` / `workout_sets` を Supabase から読み出して表示
- Exercise History は `/exercise-history/[exerciseSlug]` で実データ読込済み
- Finish 後は `/workout-summary/[sessionId]` に遷移し、完了サマリーを server-side で表示する

## 完了済み

- Train 画面の基本操作
  - Delete / Complete / Unlock
  - Kg / Reps PATCH 保存
  - Previous 表示
  - Add Set
- Add Exercise
  - `POST /api/workout-sessions/{id}/exercises`
  - modal UI から追加
- Swap Exercise
  - `PATCH /api/workout-sessions/{id}/exercises/{exerciseId}`
  - Add / Swap modal 共有化
  - blocking set がある場合は 409
- Exercise History 実データ化
  - `lib/workout/exercise-history.ts`
  - 対象ユーザーは `auth.getUser()` の `user_id`
  - 対象種目は `exercises.slug`
  - `is_completed = true` かつ `deleted_at IS NULL` の set のみ表示
  - `loading` / `empty` / `error` state 実装済み
- Finish summary 実装
  - route: `/workout-summary/[sessionId]`
  - loader: `lib/workout/workout-summary.ts`
  - UI: `components/summary/WorkoutSummaryScreen.tsx`
  - `workout_sessions` / `workout_session_exercises` / `workout_sets` / `program_days` / `program_weeks` / `programs` / `exercises` から組み立て
  - 対象ユーザーは `auth.getUser()` の `user_id` に属する session のみ
  - `deleted_at IS NULL` の visible set を母数にして completed / total を server 側で算出
  - `not_completed` / `not_found` / `unauthenticated` / `error` を画面で扱う
- Finish API / Train 接続
  - `POST /api/workout-sessions/{id}/finish`
  - 正常 finish / `forceFinish=true` finish / 既に completed の再 finish いずれも `summaryPath` を返す
  - `WorkoutScreen` は finish 成功後に `router.push(summaryPath)` で summary へ遷移

## 次アクション

1. Programs 相当の route を実装して、summary の戻り先を `/` から置き換える
2. Supabase 実環境に schema を適用して実データ確認する
3. Auth / RLS を本番前提で整理する

## 保留事項

- Programs 一覧 route は未実装
- service role key 未設定環境での動作確認
- RLS 方針
- Delete の Undo は MVP 外

## テスト状況

- `npm run typecheck`
  - pass
- `npm run build`
  - pass

## 直近の重要判断

- Exercise History は新規 API route を増やさず、App Router の server-side helper で Supabase を読む
- Workout Summary も同じ方針に寄せ、`/workout-summary/[sessionId]` は server-side helper で構成する
- summary 表示対象は認証ユーザーの `user_id` に属する session のみとする
- 存在しない session や他ユーザー session は `not_found` 扱いにする
- 未完了 session は `not_completed` として summary 画面内で案内する
- Programs route 未実装のため、summary の戻り先は MVP では `Home (/)` を使う
- `/train` は Supabase 未設定時に mock fallback が残るが、Exercise History / Workout Summary は実データ前提の画面として error state を返す
