# D-1 — Day Progression Spec

最終更新: 2026-04-14（D-2 実装完了）

## 目的

ユーザーが 1 日のセッションを完了した後、次回アプリを開いたときに正しい次 day が提示される状態を作る。
また Summary ページで「次が何か」または「プログラム完走」を視覚的に示す。

---

## 実装方針

### 既存実装（変更なし）

| 関数 | ファイル | 役割 |
|---|---|---|
| `findNextProgramDayId(currentDayId)` | `lib/workout/enrollment.ts` | 現在の program_day_id から次 day の UUID を返す。最終 day なら `null` |
| `advanceEnrollmentAfterSessionComplete(sessionId, userId)` | `lib/workout/enrollment.ts` | Finish API から呼ばれる。次 day があれば `current_program_day_id` を更新、なければ `status='completed'` |
| `resolveStartProgramDayId(programId, firstDayId, userId)` | `lib/workout/enrollment.ts` | Detail ページで「Go to Train」の起点 day を決定。active enrollment の current_program_day_id を優先返却 |

**D-1 実装前の状態:** DB レベルの day advancement は既に動いていた。欠けていたのは Summary ページの UI のみ。

### D-1 で追加した実装

| 変更 | ファイル | 内容 |
|---|---|---|
| 型追加 | `types/workout.ts` | `WorkoutSummaryView` に `isProgramCompleted: boolean` / `nextProgramDayLabel: string \| null` を追加 |
| ロジック追加 | `lib/workout/workout-summary.ts` | `getWorkoutSummaryView` 内で `findNextProgramDayId` を呼び出し、next day の week/day 番号を解決して `buildSummaryView` に渡す |
| UI 追加 | `components/summary/WorkoutSummaryScreen.tsx` | `isProgramCompleted` / `nextProgramDayLabel` に応じて表示を分岐 |
| CSS 追加 | `components/summary/WorkoutSummaryScreen.module.css` | `.heroCompleted` / `.nextUpCard` / `.completedCard` を追加 |

---

## day advancement ロジック（findNextProgramDayId）

```
1. current_program_day_id から day_number / program_week_id を取得
2. 同じ week 内で day_number + 1 を検索 → 存在すれば返す
3. なければ program_id に紐づく week_number + 1 の week を検索
4. 次 week があれば、その week の day_number = 1 を返す
5. 次 week もなければ null → program 完了
```

**並び順の根拠:** `week_number ASC` / `day_number ASC` の論理順で進む。DB の UUID 順には依存しない。

---

## Summary ページの表示分岐

| 状態 | hero 色 | eyebrow | タイトル | 追加表示 | Back リンク |
|---|---|---|---|---|---|
| 通常完了（次 day あり） | 緑系 | Workout Complete | Workout complete | Up Next: Week N / Day N（青カード） | Back to Train |
| プログラム完走（最終 day） | 黄金系 | Program Complete | Program complete | 完走メッセージ（黄カード） | Back to Programs |
| session 未完了 / エラー | — | — | 各 state タイトル | state ごとのメッセージ | Back to Train |

---

## enrollment status 遷移

```
active（current_program_day_id = day X）
  ↓ Finish
  ↓ advanceEnrollmentAfterSessionComplete()
    next day あり → current_program_day_id = next day UUID（status = active 維持）
    next day なし → status = 'completed'（current_program_day_id = 最終 day のまま保持）
```

**設計注記:** 最終 day 完了時に `current_program_day_id` を null にしない。
理由: null にすると「どこで止まったか」の情報が失われる。
UI は `status='completed'` を参照して完走を判断する。

---

## edge case

| ケース | 挙動 |
|---|---|
| program_day_id が NULL のセッション（program なしで開始） | `findNextProgramDayId` を呼ばない。`isProgramCompleted = false`, `nextProgramDayLabel = null` のまま |
| findNextProgramDayId が例外 | `try/catch` なし（caller の `getWorkoutSummaryView` が全体を catch）。Summary は fallback 表示 |
| enrollment が既に completed だが summary を再閲覧 | Summary は session の program_day_id から独立して next day を計算するため、enrollment status に依存しない |
| week の間に day_number 欠番がある seed | `day_number + 1` で exact match するため、欠番があると「次 week の day 1 にジャンプ」する。seed の day_number は連番前提 |
| 同一 day で複数セッション（re-do） | Finish のたびに `advanceEnrollmentAfterSessionComplete` が呼ばれる。enrollment は毎回 advance する。re-do で意図せず 2 day 進む可能性あり（今後の課題） |

---

## D-3 — idempotency guard（2026-04-14 実装済み）

### 問題

`advanceEnrollmentAfterSessionComplete` は `session.program_day_id` から next day を計算して enrollment を更新する。
しかし enrollment の `current_program_day_id` が既に先に進んでいる場合（=その day は既に処理済み）でも advance が走っていた。

### 発生パターン

| # | 操作 | 実態（修正前） |
|---|---|---|
| 1 | Day 1 を完了 → enrollment が Day 2 に advance | 正常 |
| 2 | Day 2 を完了 → enrollment が Day 3 に advance | 正常 |
| 3 | Day 1 の session を再 Finish（同一 session ID） | Finish route が `session.status === 'completed'` を検出して early return → advance 呼ばれない ✅ |
| 4 | Day 1 の新規 session を開始して Finish | `session.program_day_id = Day 1`, `enrollment.current = Day 3` → `findNextProgramDayId(Day 1) = Day 2` → enrollment が Day 3 → Day 2 に**巻き戻る** ❌ |
| 5 | 同様に Day 2 の新規 session を Finish | enrollment が Day 3 → Day 3（上書き、変化なし）→ 偶然 no-op だが意図は不明確 △ |

### 修正

`advanceEnrollmentAfterSessionComplete` に idempotency guard を追加:

```typescript
// enrollment がすでに先の day を指している場合はスキップ
if (enrollment.current_program_day_id !== session.program_day_id) {
  return;
}
```

このガードにより:
- `enrollment.current_program_day_id === session.program_day_id` の場合のみ advance する
- それ以外（enrollment が既に先に進んでいる）は no-op になる

### 動作確認マトリクス（修正後）

| シナリオ | guard 評価 | 結果 |
|---|---|---|
| 通常の初回 Finish（current = session day） | `current === session.day` → pass | 正常に advance ✅ |
| 同一 session 再 Finish | Finish route が early return → guard に到達しない | advance なし ✅ |
| 古い day の新規 session を Finish | `current ≠ session.day` → skip | advance なし ✅ |
| 最終 day 完了後の再 Finish（同一 session） | Finish route が early return | enrollment 維持 ✅ |
| 最終 day 完了後の新規 session Finish | enrollment が `completed` → `eq("status","active")` で取得できない → return | advance なし ✅ |

### 修正ファイル

`lib/workout/enrollment.ts` — `advanceEnrollmentAfterSessionComplete` 内、enrollment 取得後・`findNextProgramDayId` 呼び出し前に guard を追加

---

## D-2 — Summary → 次 day 直接 CTA（2026-04-14 実装済み）

### 追加した実装

| 変更 | ファイル | 内容 |
|---|---|---|
| 型追加 | `types/workout.ts` | `WorkoutSummaryView` に `nextProgramDayId: string \| null` / `programSlug: string \| null` を追加 |
| データ追加 | `lib/workout/workout-summary.ts` | `ProgramRow` に `slug` フィールドを追加。`resolvedNextDayId` を outer scope に保持して view に渡す。`program?.slug` も view に渡す |
| CTA 追加 | `components/summary/WorkoutSummaryScreen.tsx` | `nextTrainUrl` を組み立て（`/train?program=<slug>&programDayId=<uuid>`）。通常完了時に「Go to Next Day」を primary action として表示。完了済みでない場合は「Back to Train」を secondary に格下げ |

### CTA 表示ロジック

| 状態 | Primary CTA | Secondary CTA |
|---|---|---|
| 通常完了（`nextProgramDayId` & `programSlug` あり） | **Go to Next Day** → `/train?program=<slug>&programDayId=<uuid>` | Back to Train / Browse Programs |
| program 完走（`isProgramCompleted = true`） | Back to Programs | Browse Programs |
| program なしセッション（`nextProgramDayId` が null） | Back to Train | Browse Programs |

### URL 組み立て

```typescript
const nextTrainUrl =
  !isProgramCompleted && nextProgramDayId && programSlug
    ? `/train?program=${programSlug}&programDayId=${nextProgramDayId}`
    : null;
```

`/train` ページは既存の `?program=<slug>&programDayId=<uuid>` パラメータを解釈して直接 day を開く（`resolveStartProgramDayId` / `findOrCreateEnrollment` 経由）。

---

## 未対応事項（今後の課題）

| 項目 | 概要 |
|---|---|
| program 完走後の re-enroll | status='completed' になった enrollment を active に戻す、または新規 enrollment を作るフローが未実装（D-4 候補） |
| completion 通知 UI | program 完走時の専用ページ / モーダルは未実装 |
