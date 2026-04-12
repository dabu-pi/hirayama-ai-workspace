# screens

最終更新: 2026-04-12

## 文書言語

- `README.md` と既存 docs に合わせて、このファイルと `PROJECT_STATUS.md` は日本語ベースで維持する
- UI 文言には英語を含むが、状態管理ドキュメントは日本語を正本とする

## 現在の route

### `/`

- 現在の MVP 用ホーム
- 第一導線は `/programs`
- 第二導線は `/train`
- Programs -> Program Detail -> Train -> Summary の流れを案内する

### `/programs`

- program 一覧の MVP route
- server-side helper: `lib/programs/program-list.ts`
- 正本データは Supabase `programs` テーブル
- 使用列:
  - `id`
  - `title`
  - `description`
  - `duration_weeks`
  - `days_per_week`
  - `level`
  - `is_public`
- 現在の route 用 slug は DB 列ではなく helper で `title + id` から導出する
- Supabase 読込に失敗した場合のみ `mock_catalog` へ fallback
- query 成功で 0 件なら empty を表示し、mock には戻さない
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
- 一覧と同じ Supabase `programs` 読込を使う
- route param の `programSlug` は helper で導出した slug を使う
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
- 暫定仕様として `Go to Train` は `/train?program=[programSlug]` へ遷移する
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
- `program` query がある場合:
  - helper: `lib/workout/train-selection.ts`
  - Programs と同じ Supabase `programs` 読込を使う
  - 一致時は selected program title / source を表示
  - 不一致時は warning を表示しつつ current session を継続する
- `program` query がない場合は従来動作
- この query 方式は将来 `program_day_id` / `enrollment_id` ベースへ差し替える前提の暫定仕様

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

## Train の program 選択表示

- selected program title
- selected source
- invalid selection warning

## データソースメモ

- Programs list / detail / train selection の正本は Supabase `programs`
- route 用 slug は schema 未整備のため helper で導出している
- Supabase 読込失敗時のみ `mock_catalog` に fallback する
- Supabase 読込成功でデータが空のときは empty / not_found / invalid をそのまま表示する
- Exercise History は Supabase 実読込
- Workout Summary は Supabase 実読込
- Train 本体は Supabase 未設定時の mock fallback をまだ保持している
