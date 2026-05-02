# D-4 — Program Re-enroll Spec

最終更新: 2026-04-14（D-4 実装完了）

## 目的

ユーザーが program を完走（最終 day 完了）した後、
- 同じ program を最初から再開する
- 別の program を選ぶ

の 2 択を Summary 画面から迷わず取れるようにする。

---

## 前提知識

### enrollment の lifecycle

```
INSERT (status='active') → 各 day 完了ごとに current_program_day_id を更新
                         → 最終 day 完了時に status='completed'（不変・履歴として保持）
```

### re-enroll = 新しい enrollment row を INSERT する

既存の `completed` enrollment は **上書きしない**。
`findOrCreateEnrollment` は `findActiveEnrollment` 経由で `status='active'` のみ参照するため、
completed enrollment が存在しても新しい active enrollment が INSERT される。

DB 制約: `UNIQUE INDEX` は `WHERE status = 'active'` のみに適用 → completed は複数残せる。

---

## データフロー

```
1. Summary 画面 (isProgramCompleted = true)
   → firstProgramDayId が渡される (Week 1 / Day 1 の UUID)
   → programSlug も渡される
   → restartUrl = /train?program=<slug>&programDayId=<firstDayId>

2. ユーザーが "Restart Program" をタップ
   → /train?program=<slug>&programDayId=<firstDayId> へ遷移

3. Train page (programDayId あり)
   → findWorkoutSessionByDayId(firstDayId) → null (新しい周回なので session なし)
   → StartSessionScreen を表示

4. ユーザーが "Start Session" をタップ
   → POST /api/workout-sessions { programDayId: firstDayId }
   → start-session.ts
     → findOrCreateEnrollment(programId, firstDayId, userId)
       → findActiveEnrollment → null (前回は completed)
       → INSERT program_enrollments (status='active', current_program_day_id=firstDayId)
   → 新しい active enrollment が作成される
   → 新しい session が start (enrollment_id = 新しい id)

5. 完走後の旧 enrollment (status='completed') は DB に残る → 履歴として保持
```

---

## Summary 画面の表示分岐

| 状態 | Primary CTA | Secondary CTA |
|---|---|---|
| 完走 + `firstProgramDayId` あり | **Restart Program** → `/train?program=<slug>&programDayId=<firstDayId>` | Choose Another Program → `/programs` |
| 完走 + `firstProgramDayId` なし（解決失敗） | Browse Programs → `/programs` | — |
| 通常完了（next day あり） | Go to Next Day → `/train?program=<slug>&programDayId=<nextDayId>` | Back to Train / Browse Programs |
| program なし | Back to Train | Browse Programs |

---

## `firstProgramDayId` の解決ロジック

`lib/workout/workout-summary.ts` — `getWorkoutSummaryView` 内、`isProgramCompleted = true` のときのみ実行:

```typescript
// Week 1 of the program
const week1 = await client.from("program_weeks")
  .select("id").eq("program_id", programId).eq("week_number", 1).maybeSingle();

// Day 1 of Week 1
const day1 = await client.from("program_days")
  .select("id").eq("program_week_id", week1.id).eq("day_number", 1).maybeSingle();

return day1?.id ?? null;
```

追加クエリ数: 2（`isProgramCompleted = true` の場合のみ）。

---

## 変更ファイル一覧

| ファイル | 変更内容 |
|---|---|
| `types/workout.ts` | `WorkoutSummaryView` に `firstProgramDayId: string \| null` を追加 |
| `lib/workout/workout-summary.ts` | `selectFirstProgramDayId` 関数追加。`isProgramCompleted` 時に呼び出し。`buildSummaryView` に渡す |
| `components/summary/WorkoutSummaryScreen.tsx` | `restartUrl` を組み立て。完走時の actions を "Restart Program" → "Choose Another Program" に変更 |

### 変更なし（既存で対応済み）

| 項目 | 内容 |
|---|---|
| `findOrCreateEnrollment` | completed 時に新 enrollment を INSERT する動作は実装済み |
| `UNIQUE INDEX` の設計 | `WHERE status = 'active'` のみ → completed は複数残せる |
| `advanceEnrollmentAfterSessionComplete` | 最終 day で `status='completed'` に設定し、旧 enrollment を保持 |
| `/train` の `StartSessionScreen` | programDayId を受け取って Start Session を表示する導線は実装済み |

---

## スコープ外（今後の課題）

| ID | 内容 |
|---|---|
| D-4b | 完走履歴の一覧表示（何周したか、いつ完走したか） |
| D-4c | 「周回 N 回目」の表示 |
| H-2 | session 詳細ドリルダウン（session history からセット記録へ） |
| S-2 | 恒久 swap（program day への書き戻し） |

---

## 注意事項

- re-enroll 時に作られる新しい enrollment は session history の `program_enrollment_id` でリンクされるため、旧履歴と新履歴は別 enrollment として区別される
- completed enrollment は DELETE / UPDATE しない — 消すと session history の enrollment_id FK が孤立する可能性がある
- `firstProgramDayId` の解決に失敗した場合（DB エラー等）は `null` を返し、CTA を "Browse Programs" に fallback する
