# H-2 — Session Detail Spec

最終更新: 2026-04-14（H-2 実装完了）

## 目的

Session History 一覧（H-1）から各セッションをタップしたとき、
そのセッションの全エクササイズ・全セット（weight / reps / done）を確認できる詳細画面を提供する。

---

## ルート

```
/session-history/[sessionId]
```

- `force-dynamic`（SSR、常に最新データを取得）
- `sessionId` = `workout_sessions.id`（UUID）

---

## データフロー

```
1. GET /session-history/<sessionId>
   → params.sessionId を取得
   → getWorkoutSessionDetailView(sessionId)

2. getWorkoutSessionDetailView
   ① createSupabaseServerClient().auth.getUser() → userId
   ② SELECT workout_sessions WHERE id=sessionId AND user_id=userId (owner guard)
   ③ SELECT workout_session_exercises WHERE workout_session_id=sessionId ORDER BY order_index
   ④ SELECT exercises WHERE id IN (<exercise_ids>)
   ⑤ SELECT workout_sets WHERE workout_session_exercise_id IN (<ids>) AND deleted_at IS NULL ORDER BY set_number
   ⑥ SELECT program_days WHERE id=program_day_id (nullable)
   ⑦ SELECT program_weeks WHERE id=program_week_id (nullable)
   ⑧ SELECT programs WHERE id=program_id (nullable)
   → WorkoutSessionDetailView を構築して返す
```

---

## 型定義（`types/workout.ts`）

```typescript
export type WorkoutSessionDetailSet = {
  id: string;
  setNumber: number;
  weightKg: number | null;
  repsDone: number | null;
  isCompleted: boolean;
  note: string;
};

export type WorkoutSessionDetailExercise = {
  id: string;
  exerciseId: string;
  exerciseSlug: string;
  exerciseNameJa: string;
  exerciseNameEn: string;
  exerciseType: ExerciseType;
  orderIndex: number;
  wasAdded: boolean;
  wasSwapped: boolean;
  sets: WorkoutSessionDetailSet[];
};

export type WorkoutSessionDetailView = {
  sessionId: string;
  status: WorkoutSessionStatus;
  startedAt: string;
  finishedAt: string | null;
  programTitle: string | null;
  programWeekDayLabel: string | null;
  exercises: WorkoutSessionDetailExercise[];
};

export type SessionDetailResult = {
  detail: WorkoutSessionDetailView | null;
  errorMessage: string | null;
};
```

---

## UI

### SessionDetailScreen

| セクション | 内容 |
|---|---|
| ヘッダー | ← Session History リンク |
| Hero | セッション日付（ja-JP）/ プログラム名 — Week N / Day N / ステータスバッジ |
| Stats Grid | Started / Finished / Sets Done（completed/total） |
| Exercise List | エクササイズカード × N |

### エクササイズカード

| 要素 | 内容 |
|---|---|
| ヘッダー | T1/T2/T3 バッジ / 種目名 EN + JA / Swapped バッジ（wasSwapped） / Added バッジ（wasAdded） |
| セットテーブル | #, Kg, Reps, Done（✓/—）, Note（note があるエクササイズのみ列表示） |
| 完了行 | `color: --text-primary`、未完了行: `opacity: 0.5` |

### ステータスバッジ色

| 状態 | 色 |
|---|---|
| completed | 緑（`#86efac`） |
| in_progress | オレンジ（`#fdba74`） |
| cancelled | グレー（`--text-muted`） |

---

## 変更ファイル一覧

| ファイル | 変更内容 |
|---|---|
| `types/workout.ts` | `WorkoutSessionDetailSet`, `WorkoutSessionDetailExercise`, `WorkoutSessionDetailView`, `SessionDetailResult` を追加 |
| `lib/workout/session-detail.ts` | `getWorkoutSessionDetailView(sessionId)` 新規作成（8クエリ） |
| `app/session-history/[sessionId]/page.tsx` | 動的ルートページ 新規作成 |
| `components/history/SessionDetailScreen.tsx` | 詳細画面コンポーネント 新規作成 |
| `components/history/SessionDetailScreen.module.css` | 詳細画面スタイル 新規作成 |
| `components/history/SessionHistoryScreen.tsx` | "View summary →" リンクを `/session-history/<id>` へ変更（`View detail →`） |

---

## セキュリティ

- `selectSession` は `AND user_id=userId` を必須条件として含める — 他ユーザーのセッションは 404 扱い
- `auth.getUser()` を使用（session cookie 検証、サーバーサイド）

---

## スコープ外（今後の課題）

| ID | 内容 |
|---|---|
| H-2b | セット編集（詳細画面からのインライン修正） |
| H-2c | 種目別パフォーマンスグラフ（時系列 1RM / volume） |
| H-3 | セッション削除・アーカイブ |
