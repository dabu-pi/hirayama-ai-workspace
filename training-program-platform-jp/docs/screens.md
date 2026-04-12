# screens

最終更新: 2026-04-12

## 文書言語

- `README.md` と既存 docs の流れに合わせて、このファイルと `PROJECT_STATUS.md` は日本語ベースで維持する
- UI 文言は暫定的に英語を含むが、状態記録ドキュメントは日本語を正本とする

## 現在の route

### `/`

- 現在の MVP 用ホーム
- 第一導線は `/programs`
- 第二導線は `/train`
- Programs -> Program Detail -> Train -> Summary の流れを案内する

### `/programs`

- program 一覧の MVP route
- server-side helper: `lib/programs/program-list.ts`
- 現在のデータソースは `lib/programs/program-catalog.ts` の `mock_catalog`
- `loading` / `empty` / `error` を表示
- 各 card は `/programs/[programSlug]` へ遷移する
- card の表示項目:
  - title
  - level
  - goal
  - frequency
  - duration

### `/programs/[programSlug]`

- program detail の MVP route
- server-side helper: `lib/programs/program-detail.ts`
- 現在のデータソースは `lib/programs/program-catalog.ts` の `mock_catalog`
- 表示項目:
  - title
  - level
  - goal
  - frequency
  - duration
  - overview
- 導線:
  - `Back to Programs`
  - `Go to Train`
- state:
  - `loading`
  - `ready`
  - `not_found`
  - `error`

### `/train`

- 現在の workout session を表示
- logging / set editing / add exercise / swap exercise を扱う
- Finish 成功後は `/workout-summary/[sessionId]` へ遷移
- Supabase 未設定時は mock fallback が残る

### `/exercise-history/[exerciseSlug]`

- 対象 exercise の completed set 履歴を表示
- Supabase 実読込
- `loading` / `empty` / `error` を表示
- 並び順は新しい順

### `/workout-summary/[sessionId]`

- 完了済み workout session の summary 画面
- signed-in user に属する session のみ表示
- server-side helper で組み立てる
- `unauthenticated` / `not_found` / `not_completed` / `error` を表示
- 下部導線は `Back to Programs`

## Program Detail MVP 項目

- title
- level
- goal
- frequency
- duration
- overview
- Train への導線
- Programs 一覧へ戻る導線

## データソースメモ

- Programs list / detail はどちらも `mock_catalog` を正本としている
- 将来 Supabase へ差し替える前提で、一覧と詳細の両方を server-side helper 経由にしている
- Exercise History は Supabase 実読込
- Workout Summary は Supabase 実読込
- Train は Supabase 未設定時の mock fallback をまだ保持している
