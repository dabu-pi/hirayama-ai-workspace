# Program Detail — Week Preview Spec

最終更新: 2026-04-14（C-6 MVP 実装完了）

## 目的

Program Detail ページで「各 week の構成がひと目で分かる preview」を提供する。

## 表示内容（今回実装）

| 表示項目 | 内容 |
|---|---|
| セクション見出し | `PROGRAM STRUCTURE` |
| 週見出し | `Week {n}` + week.label がある場合は `— {label}` |
| 日行 | `DAY {n}` + その日の exercise を `·` 区切りで並べる |
| exercise 名 | `exercises.name_en`（英語名）を使用 |

## 表示しないもの（今回スコープ外）

- セット数・レップ数・重量
- exercise_type（T1/T2/T3）のラベル表示
- 進行ロジック・リセット条件の説明
- 補助種目の詳細説明
- week ごとの diff / 変化点のハイライト

## データフロー

```
getProgramDetailView(slug)
  └─ getProgramWeekPreviews(programId)          ← 追加
       ├─ program_weeks  (week_number / label)
       ├─ program_days   (day_number)
       └─ program_day_exercises JOIN exercises  (name_en / exercise_type)
```

- PostgREST many-to-one join は単一オブジェクトを返す（配列ではない）
- `weekPreviews: []` が返った場合は `WeekPreviewSection` を非表示にする（graceful fallback）

## 実装ファイル

| ファイル | 変更内容 |
|---|---|
| `types/programs.ts` | `ExercisePreview` / `DayPreview` / `WeekPreview` 型追加。`ProgramDetailView` に `weekPreviews` 追加 |
| `lib/programs/program-library.ts` | `getProgramWeekPreviews(programId)` を追加 |
| `lib/programs/program-detail.ts` | `getProgramWeekPreviews` を並列呼び出し。全フォールバックパスに `weekPreviews: []` を追加 |
| `components/programs/ProgramDetailScreen.tsx` | `WeekPreviewSection` コンポーネント追加。Overview 直後に配置 |
| `components/programs/ProgramDetailScreen.module.css` | `.weekPreview` / `.weekList` / `.weekBlock` / `.weekHeading` / `.dayList` / `.dayRow` / `.dayLabel` / `.exerciseNames` を追加 |
| `app/programs/[programSlug]/loading.tsx` | loading state の view に `weekPreviews: []` を追加 |

## ローカル確認結果（2026-04-14）

| プログラム | week 構成 | exercise 名 | 表示 |
|---|---|---|---|
| `gzclp-base` | 4 weeks × 3 days | Squat / Bench Press / Overhead Press / Deadlift / Lat Pulldown / Dumbbell Row | ✅ |
| `starting-strength-base` | 3 weeks × 3 days | Squat / Bench Press / Overhead Press / Deadlift / Power Clean | ✅ |
| `upper-lower-base` | 4 weeks × 4 days | Bench Press / Overhead Press / Barbell Row / Squat / Deadlift | ✅ |

## 次段階の拡張候補

1. exercise_type（T1/T2/T3）を day 行に小さく表示する
2. week ラベルに意味を持たせる（例: "Deload Week"）
3. セット数・レップ数を折りたたみ表示で追加する
4. week 間で同じ構成が繰り返される場合に "Same as Week 1" と簡略表示する
