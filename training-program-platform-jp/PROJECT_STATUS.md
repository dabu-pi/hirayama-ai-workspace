# PROJECT_STATUS

最終更新: 2026-04-12

## 現在地

- `training-program-platform-jp` は **Next.js App Router + React + TypeScript + Route Handlers + Supabase PostgreSQL + Supabase Auth** で MVP 実装を継続中
- `/train` は workout session の記録画面として動作中
- Exercise History は `/exercise-history/[exerciseSlug]` で Supabase 実読込済み
- Finish 後は `/workout-summary/[sessionId]` へ遷移する
- Programs 一覧は `/programs`
- Program Detail MVP は `/programs/[programSlug]`
- Programs list / detail / train selection は Supabase `programs` 読込を優先する状態になった

## 完了済み

- Train 画面の基本操作
  - Delete / Complete / Unlock
  - Kg / Reps PATCH 更新
  - Previous history 表示
  - Add Set
- Add Exercise
  - `POST /api/workout-sessions/{id}/exercises`
  - modal UI 接続済み
- Swap Exercise
  - `PATCH /api/workout-sessions/{id}/exercises/{exerciseId}`
  - Add / Swap modal 共通化
  - blocking set がある場合は 409
- Exercise History 実データ化
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
  - `unauthenticated` / `not_found` / `not_completed` / `error` を画面で扱う
- Programs 一覧 MVP
  - route: `/programs`
  - loader: `lib/programs/program-list.ts`
  - 正本は Supabase `programs`
  - 使用列は `id` / `title` / `description` / `duration_weeks` / `days_per_week` / `level` / `is_public`
  - card は title / level / goal / frequency / duration を表示
  - `loading` / `empty` / `error` 実装済み
  - summary の戻り先を `/programs` に変更済み
- Program Detail MVP
  - route: `/programs/[programSlug]`
  - loader: `lib/programs/program-detail.ts`
  - 一覧と同じ Supabase `programs` 読込を使用
  - title / level / goal / frequency / duration / overview を表示
  - `loading` / `ready` / `not_found` / `error` を実装
  - `/programs` の card から detail route へ遷移可能
  - detail から `/train` と `/programs` へ戻れる
- Program Detail -> Train の暫定連携
  - detail の `Go to Train` は `/train?program=[programSlug]`
  - train 側 helper は `lib/workout/train-selection.ts`
  - Programs と同じ Supabase `programs` 読込を使用
  - `program` query 一致時は selected program title / source を表示
  - `program` query 不一致時は warning を表示しつつ current session を継続
  - query なしは従来動作
- Programs 系 read path の Supabase 寄せ
  - 共通 helper: `lib/programs/program-library.ts`
  - Supabase 優先、読込失敗時のみ `mock_catalog` fallback
  - 読込成功で 0 件のときは empty / not_found / invalid をそのまま表示
  - schema に slug 列がないため、route 用 slug は helper で `title + id` から導出
- Home 導線
  - `/` は Programs を第一導線、Train を第二導線に整理済み

## 次アクション

1. `programs.slug` もしくは同等の安定識別子を schema 側に持つか決める
2. `programSlug` 暫定仕様を、将来 `program_day_id` / `enrollment_id` ベースへ置き換える設計を決める
3. Program Detail / Train selection の program 選択状態を、session 作成や day 選択と結びつける
4. live Supabase 環境で Programs / Detail / Train / Summary の導線を確認する
5. Auth / RLS の本番向け整理を進める

## 保留事項

- Programs の正式 schema に `slug` 列はまだない
- Supabase 読込失敗時のみ `mock_catalog` fallback が残る
- `program` query は暫定仕様で、session / enrollment / day の実選択にはまだ結び付いていない
- service role / production auth 設定は未整理
- RLS 方針は未確定
- Delete undo は MVP スコープ外

## テスト状況

- `npm run typecheck`
  - pass
- `npm run build`
  - pass

## 直近の重要判断

- Programs list / detail / train selection の正本は Supabase `programs` とする
- schema に `slug` 列が未整備のため、route 用 slug は helper で導出する
- fallback は Supabase 読込失敗時のみ `mock_catalog` を使い、空データはそのまま empty / not_found / invalid として扱う
- Workout Summary の戻り先は `/` ではなく `/programs`
- `screens.md` と `PROJECT_STATUS.md` は日本語ベースで維持する
