# PROJECT_STATUS

最終更新: 2026-04-12

## 現在地

- `training-program-platform-jp` は **Next.js App Router + React + TypeScript + Route Handlers + Supabase PostgreSQL + Supabase Auth + Vercel** 方針で初期実装中
- `/train` は Supabase PostgreSQL（DB）から `workout_sessions` / `workout_session_exercises` / `workout_sets` を読み出して表示する構成
- セット行の基本操作は Delete / Complete / Unlock / Kg・Reps 保存 / Previous / Add Set まで実データ経路に接続済み
- Finish（セッション終了）も `workout_sessions` update（更新）へ接続済み
- 今回、**Add Exercise** を `workout_session_exercises` insert（追加保存）へ接続し、`/train` 画面から新しい種目ブロックを実データとして追加できる状態にした

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
  - `status = completed` / `finished_at = now()`
  - 未完了セットがある場合は確認要求レスポンスを返す
  - `forceFinish=true` で完了確定できる
  - 完了後の `/train` は read-only（編集不可）表示に切り替える
- **Add Exercise を実装**（今回）
  - `GET /api/exercises?q=` — 種目一覧取得（簡易検索付き）
  - `POST /api/workout-sessions/{id}/exercises` — セッションに種目を末尾追加
    - `order_index = 削除済みを含む既存最大値 + 1`
    - `was_added = true` で手動追加を記録
    - `exercise_type` は `T3` をデフォルト適用
    - 追加直後に初期 `workout_set`（set_number=1）を 1 行自動作成
    - session が存在しない → 404 / completed → 409 / exercise が存在しない → 404
  - `/train` UI に種目選択 modal を追加（ダークテーマ、下からスライド）
    - タイトル / 検索欄（クライアント側フィルタ）/ 種目一覧 / 閉じる
    - 追加成功後、新規ブロックを末尾にローカル追加してスクロール + Kg 入力フォーカス
    - 追加中はボタン無効化（連打防止）
    - 失敗時は modal を閉じず、エラーメッセージ表示

## 今回の実装要点（Add Exercise 本実装化）

- `GET /api/exercises` を新規作成
  - `?q=` クエリで `name_ja` / `name_en` の ilike 検索を提供
  - `export const dynamic = "force-dynamic"` で静的生成ログを回避
- `POST /api/workout-sessions/[id]/exercises` を新規作成
  - order_index は削除済み行を含む既存最大値 + 1（固定方針）
  - was_added = true で手動追加を schema レベルで記録できる（was_added は既存 schema に存在）
  - 種目の exercise_type は T3 をデフォルト適用（exercises テーブルに type 列がないため）
  - 初期セットは set_number=1 の 1 行のみ
- WorkoutScreen に Add Exercise modal を追加
  - modal open → `/api/exercises` fetch → ローカルフィルタ方式
  - 追加成功後: ブロックをローカル append → スクロール → 最初の Kg 入力にフォーカス
  - `previousDisplay` は `-` 固定（新規追加種目に前回履歴はないため）
  - `displaySetNumber` は `withDisplaySetNumbers` で 1 から正しく採番される
- schema 追加なし: `was_added` は初期 schema 既存列

## まだダミーの部分

- Swap の実DB化
- Exercise History の本実データ化
- Finish 後のサマリー画面
- Train 一覧画面への本格遷移
- 自動で次セッションを作る処理
- Auth（認証）画面
- RLS（行単位アクセス制御）

## 次アクション

1. Swap を Add Exercise の modal／API を再利用して実DB化する
2. Exercise History を Supabase 読み出しへ寄せる
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
