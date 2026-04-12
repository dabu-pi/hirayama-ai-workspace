# screens

最終更新: 2026-04-12

## 前提

- `README.md` と `PROJECT_STATUS.md` を正本とし、このファイルは画面と route の整理に使う
- Programs まわりの route slug は helper 導出を廃止し、Supabase `programs.slug` を正本にする
- Supabase 読込に失敗した場合のみ `mock_catalog` に fallback し、mock 側では mock の `slug` をそのまま使う

## 現在の route

### `/`

- 現在の MVP ホーム
- 第一導線は `/programs`
- 第二導線は `/train`
- Programs -> Program Detail -> Train -> Summary の流れを案内する

### `/programs`

- program 一覧の MVP route
- server-side helper: `lib/programs/program-list.ts`
- 正本データは Supabase `programs`
- 利用項目:
  - `id`
  - `slug`
  - `title`
  - `description`
  - `duration_weeks`
  - `days_per_week`
  - `level`
  - `is_public`
- route 用 slug は Supabase `programs.slug` を使う
- Supabase 読込に失敗した場合のみ `mock_catalog` へ fallback
- Supabase 読込成功で 0 件なら empty を表示し、mock には戻さない
- `loading` / `empty` / `error` を表示
- 各 card は `/programs/[programSlug]` へ遷移する
- card 表示項目:
  - title
  - level
  - goal
  - frequency
  - duration

### `/programs/[programSlug]`

- program detail の MVP route
- server-side helper: `lib/programs/program-detail.ts`
- Programs 一覧と同じ Supabase `programs` 読込を使う
- route param の `programSlug` は Supabase `programs.slug`
- 表示項目:
  - title
  - level
  - goal
  - frequency
  - duration
  - overview
- 操作:
  - `Back to Programs`
  - `Go to Train`
- `Go to Train` のリンク生成ルール:
  - `programs.slug` が取れた場合: `/train?program=[slug]&programDayId=[firstProgramDayId]`
  - `firstProgramDayId` が null の場合（Supabase 未設定 / week 1 day 1 未登録）: `/train?program=[slug]`
  - state が ready でない場合: `/train`
- state:
  - `loading`
  - `ready`
  - `not_found`
  - `error`

### `/train`

- workout session の実行画面
- logging / set editing / add exercise / swap exercise を実装
- Finish 後は `/workout-summary/[sessionId]` へ遷移
- Supabase 未設定時は mock fallback が残る

#### `programDayId` あり（Program Detail から遷移）

- `programDayId` + `program` クエリが両方ある場合:
  - helper: `lib/workout/train-session.ts::findWorkoutSessionByDayId`
  - 対象 day の `in_progress` セッションが存在する → `WorkoutScreen` を表示
  - 存在しない → `StartSessionScreen`（開始確認画面）を表示

#### `StartSessionScreen` (`/train?program=...&programDayId=...` でセッションなし)

- component: `components/workout/StartSessionScreen.tsx`
- Program タイトルと対象 day（Week 1 / Day 1）を表示する
- 「Start Workout」ボタン:
  - `POST /api/workout-sessions { program_day_id }` を呼ぶ
  - 成功時: `/train?program=[slug]`（programDayId なし）へ router.push
  - 失敗時: エラーメッセージを表示し、ボタンを再有効化する
- 「Cancel」リンク: `/programs/[programSlug]` へ戻る

#### `programDayId` なし（クエリなし / invalid）

- helper: `lib/workout/train-selection.ts`
- Programs 一覧と同じ Supabase `programs.slug` 読込を使う
- 一致時のみ selected program title / source を表示
- 不一致時のみ warning を表示しつつ current session を継続する
- query なしは従来どおり

### `/exercise-history/[exerciseSlug]`

- 対象 exercise の completed set 履歴を表示
- Supabase 読込済み
- `loading` / `empty` / `error` を表示

### `/workout-summary/[sessionId]`

- 完了済み workout session の summary 画面
- signed-in user に紐づく session のみ表示
- server-side helper で読み込む
- `unauthenticated` / `not_found` / `not_completed` / `error` を表示
- 導線は `Back to Programs`

## Program Detail MVP 表示項目

- title
- level
- goal
- frequency
- duration
- overview
- Train への導線（`programDayId` 付き）
- Programs 一覧への戻り導線

## Train の program 選択表示

- selected program title
- selected source
- invalid selection warning

## session 開始フロー（program_day_id ベース）

```
/programs/[slug]
  ↓ Go to Train（?program=slug&programDayId=uuid）
/train
  ├── in_progress session が存在する → WorkoutScreen（直接）
  └── セッションなし → StartSessionScreen
        ↓ Start Workout ボタン
        POST /api/workout-sessions { program_day_id }
          └── startSessionForDay():
                1. program_day_exercises を取得
                2. workout_sessions を insert
                3. workout_session_exercises を insert
                4. workout_sets を insert（set_count 分）
        ↓ 成功
        /train?program=slug（WorkoutScreen が新セッションを表示）
```

## 開始ルール（採用した MVP 方針）

- 開始単位: `program_day_id`（program 内の 1 日分を識別する UUID）
- enrollment_id: 今回は不使用（enrollment フローはスコープ外）
- デフォルト開始 day: Program Detail の `firstProgramDayId`（week 1 / day 1）
- 開始 day の決定: Supabase `program_weeks.week_number=1` → `program_days.day_number=1` で解決
- `firstProgramDayId` が null のとき（Supabase 未接続 / week 1 day 1 未登録）:
  - `Go to Train` は `programDayId` なしで遷移し、従来の `WorkoutScreen` 表示を維持する

## データソースメモ

- Programs list / detail / train selection の正本は Supabase `programs`
- route 用 slug の正本は Supabase `programs.slug`
- slug ルールは title を slugify し、重複時は `-2`, `-3` の suffix で回避する
- Supabase 読込失敗時のみ `mock_catalog` に fallback する
- Supabase 読込成功でデータが空のときは empty / not_found / invalid をそのまま表示する
- helper 旧形式の `title--id8` slug は canonical route ではない
- Exercise History は Supabase 読込
- Workout Summary は Supabase 読込
- Train 本体は Supabase 未設定時の mock fallback をまだ維持している
- `workout_sessions.user_id` は MVP のため nullable（migration 3 で `NOT NULL` を drop）
