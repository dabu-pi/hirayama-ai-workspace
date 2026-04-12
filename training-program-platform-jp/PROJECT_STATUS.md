# PROJECT_STATUS

最終更新: 2026-04-12

## 現在地

- `training-program-platform-jp` は **Next.js App Router + React + TypeScript + Route Handlers + Supabase PostgreSQL + Supabase Auth** で MVP 実装を継続中
- `/train` は workout session の実行画面として利用中
- Exercise History は `/exercise-history/[exerciseSlug]` で Supabase 読込済み
- Finish 後は `/workout-summary/[sessionId]` へ遷移する
- Programs 一覧は `/programs`
- Program Detail MVP は `/programs/[programSlug]`
- Programs list / detail / train selection は Supabase `programs` 読込を土台にしている
- route 用 slug の正本は `programs.slug` に移行した

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
  - detail から `/train` と `/programs` へ戻れる
- Program Detail -> Train の選択連携
  - detail の `Go to Train` は `/train?program=[programSlug]`
  - train 側 helper は `lib/workout/train-selection.ts`
  - Programs と同じ Supabase `programs.slug` 読込を使用
  - `program` query 一致時のみ selected program title / source を表示
  - `program` query 不一致時のみ warning を表示しつつ current session を継続
  - query なしは従来どおり
- Programs 系 read path の DB slug 化
  - 共通 helper: `lib/programs/program-library.ts`
  - migration で `programs.slug` を追加し、backfill 後に `NOT NULL + UNIQUE` を付与
  - slug ルールは title を slugify し、重複時は `-2`, `-3` suffix で回避
  - insert / update で slug が未指定または空なら DB trigger で採番
  - Supabase 読込時は DB の `programs.slug` を使い、読込失敗時のみ `mock_catalog` fallback
  - `mock_catalog` fallback は mock 側の `slug` を維持
  - 読込成功で 0 件のときは empty / not_found / invalid をそのまま表示
- Home 導線
  - `/` は Programs を第一導線、Train を第二導線に整理済み

## 次アクション

1. `programs.slug` 正本化を前提に、`program_day_id` / `enrollment_id` へ接続する route 設計を決める
2. Program Detail / Train selection の program 選択導線を、session 開始や day 選択と結びつける
3. live Supabase 環境で Programs / Detail / Train / Summary の導線を通し確認する
4. helper 旧形式 slug から DB slug への redirect 方針が必要かを判断する
5. Auth / RLS の本番向け整備を進める

## 保留事項

- Supabase 読込失敗時のみ `mock_catalog` fallback が残る
- `program` query は選択表示専用で、session / enrollment / day の開始にはまだ結びついていない
- service role / production auth 設計は未整理
- RLS 方針は未着手
- Delete undo は MVP スコープ外

## テスト状況

- `npm run typecheck`
  - pass
- `npm run build`
  - pass

## 直近の重要判断

- Programs list / detail / train selection の正本は Supabase `programs` とする
- route 用 slug は helper 導出を廃止し、Supabase `programs.slug` を正本にする
- slug は title を base に slugify し、重複時は `-2`, `-3` suffix で安定採番する
- 既存 row は migration の backfill で埋め、今後の insert / update は DB trigger で補完する
- fallback は Supabase 読込失敗時のみ `mock_catalog` を使う。空データはそのまま empty / not_found / invalid として扱う
- Workout Summary の戻り先は `/` ではなく `/programs`
- `screens.md` と `PROJECT_STATUS.md` は日本語ベースで継続する
