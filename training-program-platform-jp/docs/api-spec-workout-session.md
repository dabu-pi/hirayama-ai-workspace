# api-spec-workout-session

最終更新: 2026-04-12

## 対象

この文書は Train 画面まわりの現行 API / server-side read の実装メモです。
MVP 時点では Route Handler と App Router の server helper が混在します。

## 使用テーブル

- `workout_sessions`
- `workout_session_exercises`
- `workout_sets`
- `program_days`
- `program_weeks`
- `programs`
- `exercises`

## 現行エンドポイント

| Method | Path | 用途 |
|---|---|---|
| `POST` | `/api/workout-sessions/{id}/exercises` | Add Exercise |
| `PATCH` | `/api/workout-sessions/{id}/exercises/{exerciseId}` | Swap Exercise |
| `POST` | `/api/workout-session-exercises/{id}/sets` | Add Set |
| `PATCH` | `/api/workout-sets/{id}` | Kg / Reps 更新 |
| `POST` | `/api/workout-sets/{id}/complete` | Set 完了 |
| `POST` | `/api/workout-sets/{id}/unlock` | Set ロック解除 |
| `POST` | `/api/workout-sets/{id}/delete` | logical delete |
| `GET` | `/api/exercises` | Add / Swap modal 用の種目一覧 |
| `POST` | `/api/workout-sessions/{id}/finish` | workout session 完了 |

## Server-side read

### `/train`

- loader: `lib/workout/train-session.ts`
- `workout_sessions` から current session を選択
- `program_days` -> `program_weeks` -> `programs` を辿って title / week/day label を組み立てる
- `workout_session_exercises` と `workout_sets` を読み、visible set は `deleted_at IS NULL`
- Previous は同一 user の過去 completed set から算出

### `/exercise-history/[exerciseSlug]`

- loader: `lib/workout/exercise-history.ts`
- 対象ユーザーは `auth.getUser()` の `user_id`
- 対象種目は `exercises.slug`
- 対象データは `workout_sessions` / `workout_session_exercises` / `workout_sets`
- 表示対象 set は `is_completed = true` かつ `deleted_at IS NULL`
- セッション順は `started_at desc`

### `/workout-summary/[sessionId]`

- loader: `lib/workout/workout-summary.ts`
- 対象ユーザーは `auth.getUser()` の `user_id`
- 表示対象はその user に属する `workout_sessions.id = [sessionId]`
- 対象データは `workout_sessions` / `workout_session_exercises` / `workout_sets` / `program_days` / `program_weeks` / `programs` / `exercises`
- `completed set 数` と `total visible set 数` は server 側で算出
- visible set の条件は `deleted_at IS NULL`
- `status !== completed` の場合は summary 本文ではなく `not_completed` state を返す

## Finish API

### `POST /api/workout-sessions/{id}/finish`

session を完了し、成功時は summary route への遷移先を返します。

### Request

```json
{
  "forceFinish": false
}
```

- `forceFinish = false`
  - 未完了 set が残っている場合は `409` と `requiresConfirmation: true`
- `forceFinish = true`
  - 未完了 set があってもそのまま完了

### Success Response

```json
{
  "id": "uuid-session-001",
  "status": "completed",
  "finishedAt": "2026-04-12T10:05:00Z",
  "incompleteSetCount": 0,
  "summaryPath": "/workout-summary/uuid-session-001"
}
```

### Confirmation Response

```json
{
  "id": "uuid-session-001",
  "status": "in_progress",
  "finishedAt": null,
  "incompleteSetCount": 3,
  "summaryPath": "/workout-summary/uuid-session-001",
  "requiresConfirmation": true,
  "message": "3 sets are still incomplete."
}
```

### 既に completed の場合

- `status = completed` の session へ再度 `POST` しても 200 を返す
- `summaryPath` は同じ `/workout-summary/[sessionId]`
- client はそのまま summary へ遷移してよい

## Delete / Complete / Unlock の実装メモ

### Delete

- endpoint: `POST /api/workout-sets/{id}/delete`
- `deleted_at` を更新する logical delete
- Train 画面の active set は `deleted_at IS NULL` だけを表示

### Complete

- endpoint: `POST /api/workout-sets/{id}/complete`
- `is_completed = true`
- `is_locked = true`
- `completed_at = now()`

### Unlock

- endpoint: `POST /api/workout-sets/{id}/unlock`
- `is_completed = false`
- `is_locked = false`
- `completed_at = null`

## 重要な判断

- Exercise History と Workout Summary は新規 read API route を増やさず、App Router の server-side helper で Supabase を読む
- Train は Supabase 未設定時に mock fallback が残る
- Exercise History / Workout Summary は実データ前提で、未認証や未設定時は state を返して UI で案内する
