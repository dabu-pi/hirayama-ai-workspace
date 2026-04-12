# PROJECT_STATUS

最終更新: 2026-04-12

## 現在地

- `training-program-platform-jp` は **Next.js App Router + React + TypeScript + Route Handlers + Supabase PostgreSQL + Supabase Auth + Vercel** 前提で実装中
- `/train` は `workout_sessions` / `workout_session_exercises` / `workout_sets` を Supabase から読み出して表示
- セット行の基本操作は Delete / Complete / Unlock / Kg・Reps 保存 / Previous / Add Set まで実データ経路に接続済み
- Finish は `workout_sessions` 更新に接続済み
- Add Exercise / Swap Exercise は共有 modal + 実 DB 更新まで接続済み
- 今回、`/exercise-history/[exerciseSlug]` を mock から外し、認証ユーザー + 対象種目の completed set 履歴を Supabase から新しい順で読める状態にした

## 完了済み

- 基本構成を配置
  - `app/`
  - `components/`
  - `lib/`
  - `styles/`
  - `types/`
  - `supabase/`
- `/train` 画面の本実装を配置
- Supabase helper を配置
  - `lib/supabase/client.ts`
  - `lib/supabase/server.ts`
- 初期 schema を配置
  - `supabase/migrations/20260411_000001_initial_schema.sql`
- Delete Set
  - `POST /api/workout-sets/{id}/delete`
  - `deleted_at` による logical delete
- Complete / Unlock
  - `POST /api/workout-sets/{id}/complete`
  - `POST /api/workout-sets/{id}/unlock`
- Kg / Reps 保存
  - `PATCH /api/workout-sets/{id}`
  - `onBlur` 保存
- Previous
  - 直近完了セッション
  - 同一種目
  - 同一 `set_number`
  - `deleted_at IS NULL`
  - `is_completed = true`
- Add Set
  - `POST /api/workout-session-exercises/{id}/sets`
  - `set_number = 既存最大 + 1`
  - 画面表示用の `displaySetNumber` は active set を再採番
- Finish
  - `POST /api/workout-sessions/{id}/finish`
  - `status = completed`
  - `finished_at = now()`
  - `forceFinish=true` 対応
  - 完了後の `/train` は read-only 表示
- Add Exercise
  - `GET /api/exercises?q=`
  - `POST /api/workout-sessions/{id}/exercises`
  - `was_added = true`
  - `exercise_type = T3`
  - 初回 set を 1 行自動生成
  - Add Exercise modal を `/train` に接続
- Swap Exercise
  - `PATCH /api/workout-sessions/{id}/exercises/{exerciseId}`
  - 同一 `exercise_id` は no-op success
  - blocking set がある場合は 409
  - `was_swapped = true`
  - Add / Swap modal を共有化
- Exercise History
  - `app/exercise-history/[exerciseSlug]/page.tsx` を mock 依存から外した
  - `lib/workout/exercise-history.ts` を追加
  - 対象ユーザーは `auth.getUser()` の `user_id`
  - 対象種目は `exercises.slug = [exerciseSlug]`
  - 対象データは `workout_sessions` / `workout_session_exercises` / `workout_sets`
  - 対象 set は `is_completed = true` かつ `deleted_at IS NULL`
  - セッション順は `started_at desc`
  - セット順は `order_index asc` + `set_number asc`
  - `loading.tsx` と empty / error state を追加
  - UI は既存レイアウトを大きく変えず最小差分で接続

## 今回の重要判断

- Exercise History は新規 API route を増やさず、Train と同じ server-side helper 方式で Supabase を読む
- 認証ユーザーが取れない場合は他ユーザーの履歴へフォールバックせず、error state を返す
- 履歴表示は completed set のみを対象にし、削除済み set は除外する
- 初期表示件数は 10 セッション、探索上限は直近 100 セッションとした

## まだ未対応の部分

- Finish 後のサマリー画面
- Train 一覧画面への本格遷移
- 自動で次セッションを作る処理
- Auth 画面
- RLS

## 次アクション

1. Finish 後の遷移先を決める
2. Supabase 実環境へ schema を適用して動作確認する
3. Auth / RLS を実運用前提で整理する

## テスト状況

- `npm run typecheck`
  - 今回実装後に再実行予定
- `npm run build`
  - 今回実装後に再実行予定

## 保留事項

- service role key を本番運用でどう扱うか
- RLS をどの粒度で入れるか
- Delete の Undo を MVP に入れるか
- Finish 後の UX を summary 画面にするか即遷移にするか

## 直近の重要判断メモ

- Front と server helper の責務は分け、Next.js App Router 上で server-side read を維持する
- Delete Set は logical delete を採用
- Previous は同一種目・同一 set_number 優先で計算
- Exercise History も completed set ベースで整合を取る
