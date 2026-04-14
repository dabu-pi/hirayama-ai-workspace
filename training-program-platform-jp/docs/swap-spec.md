# S-1 — Exercise Swap MVP Spec

最終更新: 2026-04-14（S-1 実装完了）

## 目的

Train 画面でトレーニング中に 1 種目を別の種目へ差し替えられる最小導線。
器具の都合・混雑・体調による実運用上の変更に対応する。

---

## スコープ

### ✅ S-1 MVP で対応する

| 項目 | 内容 |
|---|---|
| 適用単位 | **session 単位**（当日の session のみ） |
| 差し替えモデル | 1 対 1 の単純差し替え |
| プログラム本体 | **変更しない**。次回以降は元の seed 構成が維持される |
| 履歴・Summary | 実際に行った種目（差し替え後）を表示 |
| 視覚フィードバック | 差し替え済み種目に「Swapped」バッジを表示 |

### ❌ S-1 で対応しない（今後の課題）

| 項目 | 理由 |
|---|---|
| 恒久 swap（program day への書き戻し） | scope 外（別フェーズで設計） |
| 自動代替推薦（筋群・器具マッチング） | 複雑な推薦ロジックは後回し |
| 複数種目の一括差し替え | MVP では 1 種目ずつ |
| `original_exercise_id` の保持 | DB に列なし。`was_swapped: true` で区別可能 |

---

## データモデル

### `workout_session_exercises`（既存）

| 列 | 型 | 説明 |
|---|---|---|
| `exercise_id` | uuid | swap 後は新しい exercise_id で上書きされる |
| `was_swapped` | boolean | swap 済みの場合 `true`（初期値 `false`） |
| `exercise_type` | text | swap 時に `"T3"` に強制される |

> `original_exercise_id` 列は未追加。`was_swapped = true` かつ `exercise_type = T3` で区別する。
> 元の exercise を追跡する要件が生じた場合は DB migration を追加すること。

---

## API

### `PATCH /api/workout-sessions/[sessionId]/exercises/[sessionExerciseId]`

**リクエスト:**
```json
{ "exercise_id": "<新しい exercise の UUID>" }
```

**ブロック条件（409 を返す）:**

| 条件 | コード |
|---|---|
| session が `completed` | `session_completed` |
| いずれかの set が completed / locked / weight_kg 入力済み / reps_done 入力済み | `swap_blocked_by_input` |

**成功レスポンス:**
```json
{
  "noOp": false,
  "sessionExercise": {
    "id": "...",
    "exerciseId": "<新しい exercise UUID>",
    "exerciseSlug": "...",
    "exerciseNameJa": "...",
    "exerciseNameEn": "...",
    "exerciseType": "T3",
    "wasSwapped": true
  }
}
```

**同一種目を選択した場合（no-op）:**
```json
{ "noOp": true, "sessionExercise": { ... } }
```

---

## UI フロー

```
Train 画面
  └─ 各 exercise card の下部アクション行に「Swap」ボタン
       └─ タップ
            └─ Exercise 選択モーダルが開く（Add Exercise と共有）
                 ├─ タイトル: "Swap Exercise"
                 ├─ サブタイトル: "置換対象: <現在の種目名>"
                 ├─ 検索ボックス（日本語・英語名でフィルタ）
                 └─ 種目を選択
                      ├─ ブロック条件に引っかかる → エラーメッセージ表示
                      └─ 成功 → exercise card の表示が即座に切り替わる
                                 ヘッダーに「Swapped」バッジ（紫）が表示される
```

---

## 視覚フィードバック

### Train 画面（`WorkoutScreen.tsx`）

- `wasSwapped === true` の場合、exercise ヘッダー右端に「Swapped」バッジを表示
- `wasSwapped === false` の場合、従来通り「履歴へ」ヒントを表示
- バッジ配色: 紫系（`rgba(167,139,250,0.14)` / `#c4b5fd`）

### Summary 画面（`WorkoutSummaryScreen.tsx`）

- `wasSwapped === true` の場合、種目名の下に「Swapped this session」バッジを表示

---

## 変更ファイル一覧

| ファイル | 変更内容 |
|---|---|
| `components/workout/WorkoutScreen.tsx` | exercise ヘッダーに `swappedBadge` 追加（`wasSwapped` 条件） |
| `components/workout/WorkoutScreen.module.css` | `.swappedBadge` スタイル追加 |
| `components/summary/WorkoutSummaryScreen.tsx` | `exerciseTitleWrap` 内に `swappedBadge` 追加 |
| `components/summary/WorkoutSummaryScreen.module.css` | `.swappedBadge` スタイル追加 |

### 既存実装（変更なし）

以下は S-1 以前から実装済みのため、今回変更不要:

| ファイル | 内容 |
|---|---|
| `app/api/workout-sessions/[id]/exercises/[exerciseId]/route.ts` | PATCH swap API（完全実装済み） |
| `components/workout/WorkoutScreen.tsx` の `openSwapModal` / `handleSwapExercise` | swap ハンドラ（実装済み） |
| `components/workout/WorkoutScreen.tsx` の modal UI | Add/Swap 共有モーダル（実装済み） |
| `types/workout.ts` の `SwapExerciseResponse` / `wasSwapped` | 型定義（実装済み） |
| `supabase/migrations/` の `was_swapped` 列 | DB 列（実装済み） |

---

## 実装の注意事項

### swap blocker について

セットに一度でも入力があると swap できない（API が 409 を返す）。
ユーザーへのエラーメッセージ: 「Cannot swap: one or more sets have been completed or have input. Remove inputs and unlock all sets before swapping.」

→ 運用上は「セット入力前に swap する」のが前提。
→ 将来的に「入力済みでも swap できるモード」が必要になれば API の blocking 条件を緩和する。

### exercise_type 強制 T3 について

swap 後は `exercise_type` が `T3` に固定される。
元の T1 / T2 が差し替え後に T3 になるため、weight/reps の target display が変わる可能性がある。
将来的に「T1 → T1 swap」を許容する場合は API の update 処理を修正する。

---

## 今後の拡張候補

| ID | 内容 |
|---|---|
| S-2 | 恒久 swap（program day への書き戻し） |
| S-3 | 代替種目の自動推薦（器具・筋群マッチング） |
| S-4 | `original_exercise_id` を DB に追加して元種目を追跡 |
