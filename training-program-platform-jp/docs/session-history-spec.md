# H-1 — Session History Spec

最終更新: 2026-04-14（H-1 実装完了）

## 目的

ユーザーが過去のワークアウトセッションを一覧で振り返れる画面を提供する。
「進める」導線（D-1〜D-3）に続き、「振り返る」導線を追加して"使っている感"を出す。

---

## ルート

`/session-history`

| 項目 | 内容 |
|---|---|
| ページファイル | `app/session-history/page.tsx` |
| レンダリング | Server Component（`force-dynamic`） |
| 認証 | 未ログイン時は "Sign in is required to view session history." を表示（ハードリダイレクトしない） |
| アクセス経路 | Home ページ（`/`）の "Session History" ボタン |

---

## 表示項目（1 セッション = 1 カード）

| 項目 | 取得元 | 備考 |
|---|---|---|
| 実施日 | `workout_sessions.started_at`（YYYY-MM-DD に変換） | |
| ステータスバッジ | `workout_sessions.status` | Completed / In Progress / Cancelled |
| プログラム名 | `programs.title` | null の場合は "Free session" と表示 |
| Week/Day ラベル | `program_weeks.week_number` + `program_days.day_number` | "Week N / Day N"、program がない場合は非表示 |
| 種目数 | `workout_session_exercises` 件数（session 単位で集計） | |
| サマリーリンク | `status = 'completed'` の場合のみ "View summary →" を表示 | `/workout-summary/[sessionId]` へリンク |

**表示件数:** 直近 20 件（`started_at DESC`）

---

## データ取得フロー（`lib/workout/session-list.ts`）

```
1. auth.getUser() → userId 取得（未ログインは early return）
2. workout_sessions SELECT → limit 20, ORDER BY started_at DESC
3. workout_session_exercises SELECT IN (session IDs) → 件数集計（client-side）
4. program_days SELECT IN (program_day_ids)
5. program_weeks SELECT IN (program_week_ids)
6. programs SELECT IN (program_ids)
7. WorkoutSessionListItem[] を組み立てて返す
```

計 5〜6 クエリ（セッションがある場合）。Supabase index `idx_workout_sessions_user_id_started_at` を利用。

---

## 型

```typescript
// types/workout.ts に追加
type WorkoutSessionListItem = {
  sessionId: string;
  status: WorkoutSessionStatus;
  startedAt: string;          // YYYY-MM-DD
  finishedAt: string | null;  // YYYY-MM-DD or null
  programTitle: string | null;
  programWeekDayLabel: string | null;  // "Week N / Day N" or null
  exerciseCount: number;
};

type SessionHistoryResult = {
  sessions: WorkoutSessionListItem[];
  errorMessage: string | null;
};
```

---

## 表示分岐

| 状態 | 表示 |
|---|---|
| 未ログイン | エラーメッセージ（認証要求） |
| セッション 0 件 | "No sessions yet" empty state + Train へのリンク |
| セッションあり | カード一覧（直近 20 件） |
| DB エラー | エラーメッセージ |

---

## ステータスバッジ配色

| status | 色 |
|---|---|
| `completed` | 緑系（`rgba(34,197,94,0.12)` / `#86efac`） |
| `in_progress` | 橙系（`rgba(251,146,60,0.12)` / `#fdba74`） |
| `cancelled` | グレー（`rgba(113,113,122,0.12)` / `text-muted`） |

---

## 変更ファイル一覧

| ファイル | 変更内容 |
|---|---|
| `types/workout.ts` | `WorkoutSessionListItem` / `SessionHistoryResult` 型を追加 |
| `lib/workout/session-list.ts` | 新規作成 — `getSessionHistoryView()` |
| `app/session-history/page.tsx` | 新規作成 — Server Component |
| `components/history/SessionHistoryScreen.tsx` | 新規作成 |
| `components/history/SessionHistoryScreen.module.css` | 新規作成 |
| `app/page.tsx` | "Session History" リンクを追加 |

---

## 今後の拡張候補

| 項目 | 概要 |
|---|---|
| ページネーション | 20 件超のセッションを遡れるようにする |
| セッション詳細ドリルダウン | 各カードから個別のセット詳細へ |
| プログラム進捗バー | enrollment の current day / total day を可視化 |
| フィルタ | completed only、プログラム別など |
