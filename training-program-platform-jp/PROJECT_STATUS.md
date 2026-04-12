# PROJECT_STATUS

最終更新: 2026-04-12

## 現在地

- `training-program-platform-jp` は **Next.js App Router + React + TypeScript + Route Handlers + Supabase PostgreSQL + Supabase Auth** で MVP 実装を継続中
- `/train` は workout session の記録画面として動作中
- Exercise History は `/exercise-history/[exerciseSlug]` で Supabase 実読込済み
- Finish 後は `/workout-summary/[sessionId]` へ遷移する
- Programs 一覧は `/programs`
- Program Detail MVP は `/programs/[programSlug]`
- Program Detail から Train へは暫定的に `programSlug` query を渡せる

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
  - source: `lib/programs/program-catalog.ts` の `mock_catalog`
  - card は title / level / goal / frequency / duration を表示
  - `loading` / `empty` / `error` 実装済み
  - summary の戻り先を `/programs` に変更済み
- Program Detail MVP
  - route: `/programs/[programSlug]`
  - loader: `lib/programs/program-detail.ts`
  - source: `lib/programs/program-catalog.ts` の `mock_catalog`
  - title / level / goal / frequency / duration / overview を表示
  - `loading` / `ready` / `not_found` / `error` を実装
  - `/programs` の card から detail route へ遷移可能
  - detail から `/train` と `/programs` へ戻れる
- Program Detail -> Train の暫定連携
  - detail の `Go to Train` は `/train?program=[programSlug]`
  - train 側 helper は `lib/workout/train-selection.ts`
  - `program` query 一致時は selected program title / source を表示
  - `program` query 不一致時は warning を表示しつつ current session を継続
  - query なしは従来動作
- Home 導線
  - `/` は Programs を第一導線、Train を第二導線に整理済み

## 次アクション

1. `programSlug` query の暫定連携を、将来 `program_day_id` / `enrollment_id` ベースへ置き換える設計を決める
2. Program Detail から Train へ渡した選択状態を、session 作成や day 選択と結びつける
3. Programs list / detail / train selection を Supabase 読込へ差し替えるための schema / loader 方針を固める
4. live Supabase 環境で Programs / Detail / Train / Summary の導線を確認する
5. Auth / RLS の本番向け整理を進める

## 保留事項

- Programs のデータソースはまだ mock catalog
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

- Programs list / detail / train selection はどれも mock catalog を正本とし、将来 Supabase 差し替えやすいよう helper を挟む
- Program Detail から Train への受け渡しは、最小 MVP として `programSlug` query を使う
- `program` query 不一致は 404 ではなく Train 内 warning で扱い、既存 session 表示を壊さない
- Workout Summary の戻り先は `/` ではなく `/programs`
- `screens.md` と `PROJECT_STATUS.md` は日本語ベースで維持する
