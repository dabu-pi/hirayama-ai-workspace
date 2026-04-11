# data-model

最終更新: 2026-04-11（is_locked を is_completed と分離して保存する方針に補正）

## 基本方針

- 初期は単一管理者運用でも、将来の複数ユーザー化で破綻しない構造を先に置く
- ライブラリ（プログラム定義）・実行（セッション）・記録（セット）を分けて考える
- 1 テーブルに役割を詰め込みすぎない
- UIプロトタイプで確定した操作（Previous表示・ロック・自動反映・履歴遷移）を保存設計に反映する

---

## テーブル一覧

| テーブル | 役割 | 実装優先度 |
|---|---|---|
| `users` | 利用者・管理者の主体 | MVP |
| `exercises` | 種目マスタ（正規化・名前管理） | MVP |
| `programs` | プログラム基本情報 | MVP |
| `program_weeks` | 週構成 | MVP |
| `program_days` | 日単位構成（当日ワークアウト生成の単位） | MVP |
| `program_day_exercises` | 日×種目の定義（何をやるか・目標） | MVP |
| `workout_sessions` | 1回のトレーニング全体の記録 | MVP |
| `workout_session_exercises` | セッション内の種目ブロック単位（中間層）| MVP |
| `workout_sets` | セット行の記録（重量・回数・完了状態） | MVP |
| `program_enrollments` | ユーザーとプログラムの参加関係 | MVP |
| `creators` | プログラム作成者情報 | MVP後 |

---

## 3層構造の考え方

画面構造とDB設計を直接対応させるため、実行記録を 3 層で整理する。

```
workout_sessions           ← 1回のワークアウト全体（日付・プログラム文脈）
  └── workout_session_exercises  ← 種目ブロック（Bench Press / Squat など）
          └── workout_sets       ← 各セット行（Kg・Reps・完了チェック）
```

この構造が「今日のワークアウト」画面と「種目単体履歴」画面の両方を自然に表現できる。

---

## 各テーブル詳細

---

### `users`

**役割:** 利用者・管理者の主体。記録データの所有者。

| カラム | 型 | 説明 | 画面用途 |
|---|---|---|---|
| `id` | UUID | 主キー | 全テーブルの user_id 参照元 |
| `role` | ENUM('admin','user') | 権限区分 | 管理画面アクセス制御 |
| `display_name` | TEXT | 表示名 | 将来のマイページ |
| `created_at` | TIMESTAMP | 登録日時 | — |

**関係:** `workout_sessions`, `program_enrollments` から参照される。

---

### `exercises`

**役割:** 種目マスタ。名前の正規化・表記ゆれ管理。

| カラム | 型 | 説明 | 画面用途 |
|---|---|---|---|
| `id` | UUID | 主キー | — |
| `name_ja` | TEXT | 日本語名（例: スクワット）| 種目名表示 |
| `name_en` | TEXT | 英語名（例: Squat）| 種目名表示 |
| `category` | TEXT | 種目カテゴリ（例: 下半身 / Compound）| フィルタ・整理 |
| `created_at` | TIMESTAMP | 登録日時 | — |

**関係:** `program_day_exercises`, `workout_session_exercises` から参照される。

---

### `programs`

**役割:** プログラムライブラリの核。名前・概要・公開状態の管理。

| カラム | 型 | 説明 | 画面用途 |
|---|---|---|---|
| `id` | UUID | 主キー | — |
| `creator_id` | UUID | 作成者 → `creators.id` | プログラム詳細 |
| `title` | TEXT | プログラム名（例: 5/3/1 Beginner）| 一覧・実行画面ヘッダー |
| `description` | TEXT | 概要説明 | プログラム詳細 |
| `duration_weeks` | INT | 総週数 | プログラム詳細 |
| `days_per_week` | INT | 週あたり日数 | 詳細・フィルタ |
| `level` | TEXT | 難易度（例: beginner / intermediate）| フィルタ |
| `is_public` | BOOLEAN | 公開状態 | 管理画面 |
| `created_at` | TIMESTAMP | 登録日時 | — |

---

### `program_weeks`

**役割:** プログラム内の週構成。何週目かを表現する。

| カラム | 型 | 説明 | 画面用途 |
|---|---|---|---|
| `id` | UUID | 主キー | — |
| `program_id` | UUID | → `programs.id` | — |
| `week_number` | INT | 週番号（1始まり）| 実行画面の「Week N」表示 |
| `label` | TEXT | 補足ラベル（例: Deload）| 実行画面補足 |

---

### `program_days`

**役割:** 週の中の日単位構成。当日ワークアウト生成の単位。

| カラム | 型 | 説明 | 画面用途 |
|---|---|---|---|
| `id` | UUID | 主キー | — |
| `program_week_id` | UUID | → `program_weeks.id` | — |
| `day_number` | INT | 日番号（1始まり）| 実行画面の「Day N」表示 |
| `progression_guide` | TEXT | 進め方の指示（例: main setは前回超えを狙う）| 実行画面プログラム情報エリア |
| `notes` | TEXT | 補足（例: last setは無理のない範囲で）| 実行画面プログラム情報エリア |

---

### `program_day_exercises`

**役割:** その日にやる種目の定義。何をやるか・目標セット数・Target表記を持つ。

| カラム | 型 | 説明 | 画面用途 |
|---|---|---|---|
| `id` | UUID | 主キー | — |
| `program_day_id` | UUID | → `program_days.id` | — |
| `exercise_id` | UUID | → `exercises.id` | 種目名表示 |
| `exercise_type` | TEXT | 種目タイプ（例: T1 / T2 / T3）| 種目ブロックのバッジ表示 |
| `set_count` | INT | 予定セット数 | セット行の初期生成数 |
| `target_reps_text` | TEXT | 目標回数テキスト（例: `5` / `3+ reps`）| セット行の Target 列 |
| `order_index` | INT | 種目の表示順 | 種目ブロックの並び順 |

**補足:** `target_reps_text` は固定回数だけでなく AMRAP（最大回数挑戦）表記（`3+ reps`）も保持する。

---

### `workout_sessions`

**役割:** 1回のトレーニング全体の記録単位。履歴一覧と当日記録の親。

| カラム | 型 | 説明 | 画面用途 |
|---|---|---|---|
| `id` | UUID | 主キー | — |
| `user_id` | UUID | → `users.id` | 記録の所有者 |
| `program_enrollment_id` | UUID | → `program_enrollments.id` | プログラム文脈の特定 |
| `program_day_id` | UUID | → `program_days.id` | どの日のワークアウトか |
| `started_at` | TIMESTAMP | 開始日時 | 履歴一覧の日付表示 |
| `finished_at` | TIMESTAMP | 終了日時（Finish押下時）| 所要時間の計算 |
| `status` | ENUM('in_progress','completed','cancelled') | セッション状態 | Finish後の状態管理 |

**3層の頂点。** `started_at::date` が履歴カードの日付表示（例: 2026-04-01）になる。

---

### `workout_session_exercises`

**役割:** セッション内の種目ブロック単位。「今日のワークアウト」の1種目ブロックに対応する。

| カラム | 型 | 説明 | 画面用途 |
|---|---|---|---|
| `id` | UUID | 主キー | — |
| `workout_session_id` | UUID | → `workout_sessions.id` | セッションとの紐付け |
| `exercise_id` | UUID | → `exercises.id` | 種目名・履歴取得のキー |
| `exercise_type` | TEXT | 当日の種目タイプ（T1/T2/T3）| バッジ表示 |
| `order_index` | INT | この日の種目順 | 種目ブロックの並び順 |
| `was_swapped` | BOOLEAN | Swap（置き換え）が使われたか | 履歴での注記 |
| `was_added` | BOOLEAN | Add Exercise で追加された種目か | 履歴での注記 |

**このテーブルが「種目単体履歴」取得の結合キー。**
`exercise_id` を条件に `workout_session_exercises` → `workout_sessions` を辿ることで、特定種目の全セッション履歴が取得できる。

---

### `workout_sets`

**役割:** セット行1行の記録単位。重量・回数・完了状態・ロック・自動反映フラグを保持する。

| カラム | 型 | 説明 | 画面用途 | 保存推奨 |
|---|---|---|---|---|
| `id` | UUID | 主キー | — | ✓ |
| `workout_session_exercise_id` | UUID | → `workout_session_exercises.id` | 種目ブロックとの紐付け | ✓ |
| `set_number` | INT | セット番号（1始まり）| セット行の「#」列 | ✓ |
| `target_reps_text` | TEXT | 当日の目標回数テキスト（例: `5` / `3+ reps`）| Target 列 | ✓ |
| `weight_kg` | DECIMAL | 入力された重量（Kg） | Kg 列 | ✓ |
| `reps_done` | INT | 実施した回数（Reps）| Reps 列 | ✓ |
| `is_completed` | BOOLEAN | ユーザーが「完了した」と宣言した状態（セマンティクス）| 完了チェック列・履歴クエリのフィルタ | ✓ |
| `is_locked` | BOOLEAN | Kg/Reps 欄を編集不可にするUI制御状態（is_completedとは独立）| 行のロック表示・入力可否制御 | ✓ |
| `is_auto_filled` | BOOLEAN | 1セット目から自動反映された値か | デバッグ・将来参照 | ✓（軽量フラグ） |
| `completed_at` | TIMESTAMP | 完了チェックを入れた日時 | 将来の分析用 | ✓ |
| `rpe` | INT | RPE（自覚的運動強度、0〜10）| 将来の入力欄 | MVP後 |
| `note` | TEXT | セット単位のメモ | メモ欄 | ✓ |

---

### `program_enrollments`

**役割:** ユーザーとプログラムの参加関係。どのプログラムを開始したか。

| カラム | 型 | 説明 | 画面用途 |
|---|---|---|---|
| `id` | UUID | 主キー | — |
| `user_id` | UUID | → `users.id` | — |
| `program_id` | UUID | → `programs.id` | — |
| `current_week` | INT | 現在の週番号 | 実行画面の「Week N」 |
| `current_day` | INT | 現在の日番号 | 実行画面の「Day N」 |
| `started_at` | TIMESTAMP | 開始日 | — |
| `status` | ENUM('active','paused','completed')| 参加状態 | — |

---

## Previous（前回記録）の扱い

### 問題
「今日のワークアウト」のセット行には Previous（前回記録）を表示する必要がある。
この値をどう取得・保存するかを整理する。

### 選択肢

| 方式 | 内容 | メリット | デメリット |
|---|---|---|---|
| **A: 都度計算（推奨）** | 表示時に過去データから取得する | 正確・データ整合性が高い | クエリが必要 |
| B: スナップショット保存 | `previous_display_text` に保存しておく | 高速・シンプル | データ変更時に不整合が起きる |

### 推奨: A（都度計算）

```sql
-- 例: exercise_id=X のユーザーY の直近セット記録を取得
SELECT
  ws.set_number,
  ws.weight_kg,
  ws.reps_done
FROM workout_sets ws
JOIN workout_session_exercises wse ON ws.workout_session_exercise_id = wse.id
JOIN workout_sessions s ON wse.workout_session_id = s.id
WHERE wse.exercise_id = :exercise_id
  AND s.user_id = :user_id
  AND ws.is_completed = true
  AND s.id != :current_session_id   -- 今回のセッションを除く
ORDER BY s.started_at DESC, ws.set_number ASC
LIMIT :set_count
```

表示文字列への整形（例: `80kg×5`）はアプリケーション層で行う。

### `previous_display_text` の扱い

保存**しない**ことを推奨する。
ただし、パフォーマンス上の理由でキャッシュが必要になった場合は `previous_display_text` カラムを追加して対応する。

---

## ロック状態（is_locked）と完了状態（is_completed）の扱い

### 2つのカラムを分けて保存する（推奨）

`is_completed`（完了状態）と `is_locked`（編集ロック状態）は**意味が異なる**ため、独立したカラムとして保存する。

| カラム | 意味 | 主な用途 |
|---|---|---|
| `is_completed` | ユーザーがこのセットを「完了した」と宣言した状態（セマンティクス）| 履歴クエリのフィルタ・Previous の取得条件 |
| `is_locked` | Kg/Reps 欄を編集不可にするUI制御状態（編集可否）| 画面再読み込み時のロック復元・入力欄の有効/無効制御 |

### 状態遷移

| 操作 | is_completed | is_locked | UI上の状態 |
|---|---|---|---|
| セット入力中（未チェック）| false | false | Kg/Reps 編集可能 |
| 完了チェックを入れた | **true** | **true** | 行ロック・入力不可 |
| ロック解除操作を行った | **false** | **false** | 編集可能に戻る |
| 再チェックを入れた | **true** | **true** | 行ロック・入力不可 |

### 推奨: 完了チェック時と解除時は常に2カラムを同時更新する

- 完了チェック時: `is_completed=true, is_locked=true`（同時に更新）
- ロック解除時: `is_completed=false, is_locked=false`（同時に更新）

「ロック中だが完了状態は保持する」「ロックなしだが完了扱いにする」という中間状態は **MVP では持たない。**

### 分けて持つ理由

- **履歴クエリ**: Previous の取得は `is_completed=true` のセットだけを対象にする。`is_locked` はクエリに使わない
- **UI復元**: `is_locked` を DB に保存することで、ページを離れて戻ったときにロック状態を自動的に再現できる
- **API の対称性**: `POST /workout-sets/{id}/complete` と `POST /workout-sets/{id}/unlock` が明確に対になる
- **将来拡張**: 「ロック中でも一時的に編集許可する（is_locked=false のまま is_completed=true）」ような UX 変更にも対応できる土台になる

---

## 1セット目入力 → 後続セット自動反映の扱い

### 問題
1セット目の Kg を入力したとき、後続セットの空欄に同値を反映する（UI挙動）。
この「自動反映された値」を DB にどう保存するかを整理する。

### 推奨: 各セットに明示値を保存 + `is_auto_filled` フラグを持つ

| セット | weight_kg | is_auto_filled | 説明 |
|---|---|---|---|
| Set 1 | 80 | false | ユーザーが入力 |
| Set 2 | 80 | true | 自動反映 |
| Set 3 | 80 | true | 自動反映 |
| Set 3（上書き後）| 77.5 | false | ユーザーが上書き |

- 保存時は「自動反映か否か」に関わらず、各セットの実際の値をそのまま保存する
- `is_auto_filled` は参照・デバッグ用の軽量フラグとして保持する
- UI での「手入力済み判定」は `is_auto_filled` を参照することで実現できる

---

## 種目単体履歴画面の取得クエリ設計

「今日のワークアウト」で種目名をタップしたとき、以下の条件で履歴を取得する。

```
条件:
  - 同一ユーザー（user_id）
  - 同一種目（exercise_id）
  - 完了セッションのみ（status = 'completed'）または全セッション（暫定）
  - 新しい順（started_at DESC）

取得粒度:
  - セッション単位でカードを作る
  - 各カード内にセット明細（set_number / weight_kg / reps_done / note）を展開

結合パス:
  workout_sets
    → workout_session_exercises  (exercise_id で絞り込み)
    → workout_sessions           (user_id, started_at でソート)
```

これにより、「Bench Press の 2026-04-01 のセッションで Set1: 80kg×3, Set2: 80kg×3, Set3: 80kg×7」を表示できる。

---

## テーブル関係図（テキスト）

```
users
  ├── program_enrollments ──→ programs ──→ program_weeks ──→ program_days
  │                                                              └── program_day_exercises ──→ exercises
  └── workout_sessions ──→ program_enrollments
                       ──→ program_days
          └── workout_session_exercises ──→ exercises
                    └── workout_sets
```

---

## 実装前に決めるべきこと

| 項目 | 内容 |
|---|---|
| `program_days` の進行ロジック | 固定日付ベースか順送り（前の日が完了したら次へ）か |
| セッション中断時の扱い | `in_progress` のセッションを次回起動時にどう扱うか |
| Swap/Add Set 時の `workout_set` テンプレート生成方法 | `program_day_exercises` を参照するか、空行を追加するか |

## 今の段階では未確定でよいこと

| 項目 | 内容 |
|---|---|
| `rpe` の入力UI | MVP以降で追加してよい |
| `creators` テーブルの詳細 | 初期はシンプルで十分 |
| グラフ用の集計テーブル | MVP以降で考える |
| Previous の参照単位の最終決定 | セット番号一致優先 / 種目内最新完了優先 |

## 推奨テーブル構成の要約

```
[ ライブラリ層 ]
programs → program_weeks → program_days → program_day_exercises → exercises

[ 実行・記録層（3層） ]
workout_sessions
  → workout_session_exercises  （種目ブロック単位）
      → workout_sets           （セット行単位）

[ ユーザー関係 ]
users → program_enrollments → programs
users → workout_sessions
```

MVP で必要な 10 テーブル:
`users` / `exercises` / `programs` / `program_weeks` / `program_days` /
`program_day_exercises` / `workout_sessions` / `workout_session_exercises` /
`workout_sets` / `program_enrollments`
