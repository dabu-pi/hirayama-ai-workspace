# workout-screen-interaction-spec

最終更新: 2026-04-12

## 対象

`/train` の MVP interaction spec。
Boostcamp 風の操作感をベースにしつつ、現行実装で有効な挙動だけを記載する。

## 現在の操作

### Set 操作

- Kg / Reps
  - `onBlur` で `PATCH /api/workout-sets/{id}`
- Complete
  - `POST /api/workout-sets/{id}/complete`
  - `is_completed=true` と `is_locked=true`
- Unlock
  - `POST /api/workout-sets/{id}/unlock`
  - `is_completed=false` と `is_locked=false`
- Delete
  - スワイプで `Delete` を表示
  - `POST /api/workout-sets/{id}/delete`
  - `deleted_at` を使う logical delete
- Add Set
  - `POST /api/workout-session-exercises/{id}/sets`

### Exercise 操作

- Add Exercise
  - modal から選択
  - `POST /api/workout-sessions/{id}/exercises`
- Swap Exercise
  - modal から選択
  - `PATCH /api/workout-sessions/{id}/exercises/{exerciseId}`
  - blocking set がある場合は 409

### History 遷移

- 種目名タップで `/exercise-history/[exerciseSlug]`
- completed set の履歴を新しい順で表示

## Finish の仕様

### 通常 finish

- Finish ボタン押下
- `POST /api/workout-sessions/{id}/finish`
- 成功時は `summaryPath` を受け取り、`/workout-summary/[sessionId]` へ遷移

### 未完了 set がある場合

- API は `409` と `requiresConfirmation: true` を返す
- client は confirm を表示
- OK の場合は `forceFinish=true` で再送
- 成功後の遷移先は通常 finish と同じ

### 既に completed の session

- `/train` 上では Finish ボタンは disabled
- ただし API へ再度 finish を送っても `summaryPath` を返す設計
- completed 済み session の要約確認は `/workout-summary/[sessionId]` で行う

## Workout Summary の仕様

### route

- `/workout-summary/[sessionId]`

### 表示項目

- 完了メッセージ
- `program title`
- `week / day label`
- 完了時刻
- 実施した種目一覧
- 各種目の `completed set 数 / total visible set 数`
- 戻り導線
  - `Back to Train`
  - `Back to Home`

### データ取得

- server-side helper: `lib/workout/workout-summary.ts`
- 読み取り対象:
  - `workout_sessions`
  - `workout_session_exercises`
  - `workout_sets`
  - `program_days`
  - `program_weeks`
  - `programs`
  - `exercises`
- visible set は `deleted_at IS NULL`
- counts は server 側で算出

### state

- `ready`
  - completed session を表示
- `not_completed`
  - session は存在するが未完了
- `not_found`
  - session 不存在、または認証ユーザー所有ではない
- `unauthenticated`
  - サインイン必須
- `error`
  - 読込失敗
- `loading`
  - route loading 中

## 未対応

- Programs 専用 route
- Finish 後の分析グラフ
- Delete Undo
- Rest / Calc の本実装
