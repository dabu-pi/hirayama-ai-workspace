# H-3 — Active Program Progress Spec

最終更新: 2026-04-14（H-3 実装完了）

## 目的

ユーザーがアプリを開いたとき（home `/`）に、現在地・次にやること・直近履歴を1画面で把握できる。
「どこから再開するか」を迷わせない。

---

## 配置

ホームページ（`/`）を SSR dashboard に変換し、`ActiveProgramCard` を最上部セクションに配置する。

```
/ (force-dynamic, SSR)
├─ hero: タイトル + 説明
├─ ActiveProgramCard (動的, SSR)
│   ├─ active enrollment あり → My Program カード
│   ├─ authenticated + enrollment なし → empty state (Browse Programs)
│   ├─ 未認証 → Sign In 導線
│   └─ エラー → エラーカード
└─ nav grid: Programs / Train / History
```

---

## データフロー

```
1. GET /
   → getActiveProgramView()

2. getActiveProgramView
   ① auth.getUser() → userId
   ② SELECT program_enrollments WHERE user_id=userId AND status='active' LIMIT 1
   ③ (enrollment あり) Promise.all:
       - SELECT programs WHERE id=enrollment.program_id
       - SELECT program_days WHERE id=current_program_day_id
       - SELECT workout_sessions LIMIT 3 ORDER BY started_at DESC
   ④ SELECT program_weeks WHERE id=day.program_week_id
   ⑤ Batch: program_days / program_weeks for session labels
   → ActiveProgramView を構築
```

---

## 型定義（`types/workout.ts`）

```typescript
export type ActiveProgramSession = {
  sessionId: string;
  startedAt: string;           // YYYY-MM-DD
  status: WorkoutSessionStatus;
  programWeekDayLabel: string | null;
};

export type ActiveProgramView = {
  enrollmentId: string;
  programId: string;
  programSlug: string;
  programTitle: string;
  level: string | null;
  frequencyLabel: string;       // "4 days / week"
  durationLabel: string;        // "12 weeks"
  currentProgramDayId: string | null;
  currentWeekDayLabel: string | null;  // "Week 2 / Day 1"
  continueUrl: string;
  enrollmentStartedAt: string;
  recentSessions: ActiveProgramSession[];
};

export type ActiveProgramResult = {
  view: ActiveProgramView | null;
  isAuthenticated: boolean;    // false = 未認証
  errorMessage: string | null;
};
```

---

## `continueUrl` 生成ロジック

| 条件 | URL |
|---|---|
| `current_program_day_id` あり | `/train?program=<slug>&programDayId=<uuid>` |
| `current_program_day_id` なし | `/train?program=<slug>` |

---

## UI — `ActiveProgramCard`

### active enrollment あり

| 要素 | 内容 |
|---|---|
| ヘッダー | "My Program" ラベル + level バッジ（Beginner / Intermediate / Advanced） |
| プログラム名 | `programTitle`（大きなフォント） |
| メタ | `frequencyLabel` · `durationLabel` |
| Up Next | `currentWeekDayLabel`（オレンジ背景の行） |
| CTA | **Continue Training** → `continueUrl`（グラデーションボタン） |
| 直近セッション | 最大3件（日付 / Week N / Day M / Done|Active|Cancelled）→ `/session-history/<id>` |
| フッター | "View all sessions →" → `/session-history` |

### empty states

| 状態 | 表示 |
|---|---|
| 未認証 | "Sign in to track your progress" + **Sign In** → `/login` |
| 認証済み + enrollment なし | "No active program" + **Browse Programs** → `/programs` |
| エラー | エラーメッセージ |

---

## 変更ファイル一覧

| ファイル | 変更内容 |
|---|---|
| `types/workout.ts` | `ActiveProgramSession`, `ActiveProgramView`, `ActiveProgramResult` を追加 |
| `lib/workout/active-program.ts` | `getActiveProgramView()` 新規作成 |
| `app/page.tsx` | SSR 化（`force-dynamic`）、`ActiveProgramCard` + nav grid を組み込み |
| `app/page.module.css` | nav grid スタイル追加（旧 card / list スタイルは削除） |
| `components/home/ActiveProgramCard.tsx` | Active Program dashboard カード 新規作成 |
| `components/home/ActiveProgramCard.module.css` | カードスタイル 新規作成 |

---

## スコープ外（今後の課題）

| ID | 内容 |
|---|---|
| H-3b | 全体進捗バー（完了 day 数 / 総 day 数） |
| H-3c | 複数 active enrollment のサポート（現在は LIMIT 1） |
| D-4b | 完走履歴一覧（何周したか） |
| H-4 | パフォーマンストレンド（体積・1RM推定の時系列） |
