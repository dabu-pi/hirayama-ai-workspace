# PROJECT_STATUS

最終更新: 2026-04-11

## 現在地

- `training-program-platform-jp` は **Next.js App Router + React + TypeScript + Route Handlers + Supabase PostgreSQL + Supabase Auth + Vercel** 方針で初期実装中
- `/train` は Supabase PostgreSQL（DB）から `workout_sessions` / `workout_session_exercises` / `workout_sets` を読み出して表示する構成
- セット行の基本操作は Delete / Complete / Unlock / Kg・Reps 保存 / Previous / Add Set まで実データ経路に接続済み
- 今回、**Finish（セッション終了）** を `workout_sessions` update（更新）へ接続し、現在セッションを正式に完了できる状態にした

## 完了済み

- Next.js 基本構成を追加
  - `app/`
  - `components/`
  - `lib/`
  - `styles/`
  - `types/`
  - `supabase/`
- `/train` 画面の本実装側 UI 骨組みを追加
- `/exercise-history/[exerciseSlug]` の導線を追加
- Supabase helper を追加
  - `lib/supabase/client.ts`
  - `lib/supabase/server.ts`
- 初期 schema（DB定義）を追加
  - `supabase/migrations/20260411_000001_initial_schema.sql`
- `workout_sets.deleted_at` ベースの logical delete（見えなくする削除）を実装
  - `POST /api/workout-sets/{id}/delete`
- Complete / Unlock を実装
  - `POST /api/workout-sets/{id}/complete`
  - `POST /api/workout-sets/{id}/unlock`
- Kg / Reps 保存を実装
  - `PATCH /api/workout-sets/{id}`
  - `onBlur`（入力欄から離れた時）で保存
  - Kg / Reps は空欄を許容
- Previous（前回記録）を実データ化
  - 同一ユーザー
  - 同一種目
  - 同一 `set_number`
  - `deleted_at IS NULL`
  - `is_completed = true`
  - 現在セッション除外
  - 直近 1 件
- Add Set を実装
  - `POST /api/workout-session-exercises/{id}/sets`
  - `set_number = 既存最大値 + 1`
  - 表示番号は `displaySetNumber` で画面だけ再採番
- Finish を実装
  - `POST /api/workout-sessions/{id}/finish`
  - `status = completed`
  - `finished_at = now()`
  - 未完了セットがある場合は確認要求レスポンスを返す
  - `forceFinish=true` で完了確定できる
  - 完了後の `/train` は read-only（編集不可）表示に切り替える

## 今回の実装要点

- Finish API で未完了セット数を server（サーバー側処理）で集計するようにした
  - 集計対象は `deleted_at IS NULL` かつ `is_completed = false`
- `workout_sessions.status` と `workout_sessions.finished_at` を `/train` の UI 型へ渡すようにした
- Finish 後は以下を編集不可にした
  - Kg / Reps 入力
  - Complete / Unlock
  - Delete
  - Add Set
  - Add Exercise
- 完了済みセッションでは完了バナーを表示し、完了時刻と未完了残数を見られるようにした
- すでに completed の session に再度 Finish しても成功扱いにしている

## まだダミーの部分

- Add Exercise の実DB化
- Swap の実DB化
- Exercise History の本実データ化
- Finish 後のサマリー画面
- Train 一覧画面への本格遷移
- 自動で次セッションを作る処理
- Auth（認証）画面
- RLS（行単位アクセス制御）

## 次アクション

1. Add Exercise を `workout_session_exercises` insert（追加保存）へ接続する
2. Swap の仕様を決めて DB 更新へつなぐ
3. Exercise History を Supabase 読み出しへ寄せる
4. Finish 後の遷移先を決める
5. Supabase 実環境へ schema を適用して動作確認する

## 保留事項

- service role key（管理用キー）を本番運用でどう扱うか
- RLS をどの段階で入れるか
- Delete の Undo（取り消し）を MVP に入れるか
- complete 前の未入力警告をどこまで強く出すか
- Previous の fallback（代替候補）を後で入れるか

## テスト状況

- `npm run typecheck` 通過
- `npm run build` 通過

## 直近の重要判断

- フロントとバックは最初から分けず、Next.js App Router 内で進める
- Delete Set は logical delete を採用し、`deleted_at` で扱う
- Delete 後の Set 番号は DB 値を変えず、画面だけ再採番する
- Unlock 時は `completed_at = NULL` を採用する
- Previous はまず「同一ユーザー・同一種目・同一 `set_number` の直近完了済みセット」で固定する
- Add Set の保存上の `set_number` は削除済みを含む最大値 + 1 にする
- Finish は未完了セットが残っていても、確認後なら完了可能にする
