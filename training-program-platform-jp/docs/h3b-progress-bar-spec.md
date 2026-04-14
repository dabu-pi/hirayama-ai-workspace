# H-3b — Progress Bar Spec

最終更新: 2026-04-14（H-3b 実装完了）

## 目的

Home の My Program カードに、現在の program をどこまで進めたかを示す
progress bar を追加する。`completedDays / totalDays`（%）を一目で把握できる状態を作る。

---

## 算出ルール

| 項目 | 算出方法 |
|---|---|
| `totalDays` | program に紐づく全 `program_days` の数 |
| `completedDays` | `current_program_day_id` の 0-based index（= その前に完了した日数） |
| `progressPercent` | `Math.round(completedDays / totalDays * 100)`（0〜100） |

### 並び順

`week_number ASC` → `day_number ASC` でソート後にインデックスを決定。
欠番があってもこの順序で詰めてカウントする。

### `current_program_day_id` の意味

`current_program_day_id` = **次にやる day**（= 未着手）。
そのインデックス（0-based）= それより前に完了した day 数。

例:
- index = 0 → 0 days done (0%)
- index = 4 → 4 days done (4/12 = 33%)
- index = 11 → 11 days done (11/12 = 91%)

active enrollment では最終 day を終えると `status='completed'` に変わり、
dashboard には表示されなくなるため、100% は通常表示されない。

---

## エッジケース

| 状況 | 動作 |
|---|---|
| `current_program_day_id = null` | `completedDays = 0`、`progressPercent = 0` |
| `current_program_day_id` が day 一覧に見つからない | 同上（安全 fallback） |
| `totalDays = 0`（DB 異常） | progress bar 非表示（`totalDays > 0` ガードで制御） |
| active enrollment なし | My Program カード自体非表示 → progress も非表示 |

---

## クエリ追加（`lib/workout/active-program.ts`）

```typescript
// selectAllProgramWeeks(client, programId)
SELECT id, week_number FROM program_weeks
WHERE program_id = ? ORDER BY week_number ASC

// selectAllProgramDays(client, weekIds[])
SELECT id, day_number, program_week_id FROM program_days
WHERE program_week_id IN (...)
```

これらは既存の第 1 バッチ `Promise.all` に `selectAllProgramWeeks` を追加し、
第 2 バッチで `selectAllProgramDays` を並列実行することで、
シリアル追加クエリをゼロに抑える。

---

## UI（`ActiveProgramCard.tsx`）

配置: meta 行（frequency · duration）の直下、Up Next 行の直上

```
4 days / week · 12 weeks
──────────────────────────────
4 / 12 days complete        33%
█████░░░░░░░░░░░░░░░░░░░░░░
──────────────────────────────
Up next   Week 2 / Day 1
```

- progress bar: 高さ 6px、角丸 pill、グラデーション塗り（#fb923c → `--accent`）
- progress text: left = "N / M days complete"、right = "N%"
- `role="progressbar"` + `aria-valuenow` + `aria-label` で a11y 対応

---

## 変更ファイル一覧

| ファイル | 変更内容 |
|---|---|
| `types/workout.ts` | `ActiveProgramView` に `completedDays`, `totalDays`, `progressPercent` を追加 |
| `lib/workout/active-program.ts` | `selectAllProgramWeeks` / `selectAllProgramDays` 追加、`computeProgress` 追加、`Promise.all` 再編（第1バッチに weeks 追加、第2バッチに days 追加） |
| `components/home/ActiveProgramCard.tsx` | progress bar セクション追加（meta 直下、positionRow 直上） |
| `components/home/ActiveProgramCard.module.css` | `.progressSection` / `.progressHeader` / `.progressText` / `.progressPct` / `.progressBar` / `.progressFill` 追加 |

---

## スコープ外（今後の課題）

| ID | 内容 |
|---|---|
| H-3c | 複数 active enrollment のサポート（現在 LIMIT 1） |
| H-3d | 週単位のセグメント表示（week ごとに色分け） |
| H-4 | パフォーマンストレンド（体積・1RM 推定の時系列） |
