# api-spec-workout-session

最終更新: 2026-04-11

## このAPI群の目的

「今日のワークアウト」画面と「種目単体履歴」画面が必要とする操作を提供するAPI群。
セッション開始から終了まで、セット単位の Kg/Reps 入力・完了チェック・ロック解除・削除・履歴取得を担う。

---

## 対象リソース（管理対象）

| リソース | テーブル | 説明 |
|---|---|---|
| ワークアウトセッション | `workout_sessions` | 1回のトレーニング全体 |
| セッション内種目ブロック | `workout_session_exercises` | セッション内の種目単位 |
| セット行 | `workout_sets` | Kg・Reps・完了・ロック状態 |

---

## エンドポイント一覧

| メソッド | パス | 説明 | 使用画面 |
|---|---|---|---|
| POST | `/workout-sessions` | セッション開始 | 今日のワークアウト（起動時）|
| GET | `/workout-sessions/{id}` | セッション詳細取得 | 今日のワークアウト（再読み込み・中断再開）|
| POST | `/workout-sessions/{id}/exercises` | 種目ブロック追加 | 今日のワークアウト（Add Exercise）|
| POST | `/workout-session-exercises/{id}/sets` | セット追加 | 今日のワークアウト（Add Set）|
| PATCH | `/workout-sets/{id}` | Kg / Reps 更新 | 今日のワークアウト（入力欄）|
| POST | `/workout-sets/{id}/complete` | 完了チェック | 今日のワークアウト（完了チェック）|
| POST | `/workout-sets/{id}/unlock` | ロック解除 | 今日のワークアウト（ロック解除ボタン）|
| POST | `/workout-sets/{id}/delete` | セット論理削除 | 今日のワークアウト（左スワイプ Delete）|
| GET | `/exercises/{id}/history` | 種目単体履歴取得 | 種目単体履歴 |
| POST | `/workout-sessions/{id}/finish` | セッション終了 | 今日のワークアウト（Finish ボタン）|

---

## 各エンドポイント詳細

---

### POST /workout-sessions

**目的:** ワークアウトセッションを開始する。プログラムの当日内容から種目ブロック・セット行を初期生成する。

**リクエスト:**
```json
{
  "user_id": "uuid-user-001",
  "program_enrollment_id": "uuid-enrollment-001",
  "program_day_id": "uuid-day-001"
}
```

**レスポンス (201 Created):**
```json
{
  "id": "uuid-session-001",
  "user_id": "uuid-user-001",
  "program_day_id": "uuid-day-001",
  "started_at": "2026-04-11T09:00:00Z",
  "status": "in_progress",
  "exercises": [
    {
      "id": "uuid-wse-001",
      "exercise_id": "uuid-ex-bench",
      "exercise_name_ja": "ベンチプレス",
      "exercise_name_en": "Bench Press",
      "exercise_type": "T1",
      "order_index": 1,
      "previous_sets": [
        { "set_number": 1, "weight_kg": 80.0, "reps_done": 3 },
        { "set_number": 2, "weight_kg": 80.0, "reps_done": 3 },
        { "set_number": 3, "weight_kg": 80.0, "reps_done": 7 }
      ],
      "sets": [
        {
          "id": "uuid-set-001",
          "set_number": 1,
          "target_reps_text": "5",
          "weight_kg": null,
          "reps_done": null,
          "is_completed": false,
          "is_locked": false,
          "is_auto_filled": false
        }
      ]
    }
  ]
}
```

**補足:**
- `previous_sets`: この種目の直近完了セッションのセット記録。DB保存値ではなく、レスポンス生成時に計算する（`is_completed=true` のセットのみ）
- `program_day_id` を省略した場合の挙動（フリーセッション）は未確定

---

### GET /workout-sessions/{id}

**目的:** セッション詳細を取得する。ページ再読み込み・中断再開時に使う。

**レスポンス (200 OK):** `POST /workout-sessions` のレスポンスと同じ構造。

**補足:**
- `is_locked=true` のセットは画面側でロック表示を復元する（`is_locked` はDBに保存済み）
- `previous_sets` はこのリクエスト時点でも計算して返す

---

### POST /workout-sessions/{id}/exercises

**目的:** セッションに種目ブロックを追加する（Add Exercise 操作）。

**リクエスト:**
```json
{
  "exercise_id": "uuid-ex-rdl",
  "exercise_type": "T3"
}
```

**レスポンス (201 Created):**
```json
{
  "id": "uuid-wse-005",
  "exercise_id": "uuid-ex-rdl",
  "exercise_name_ja": "ルーマニアン・デッドリフト",
  "exercise_name_en": "Romanian Deadlift",
  "exercise_type": "T3",
  "order_index": 5,
  "was_added": true,
  "previous_sets": [],
  "sets": [
    {
      "id": "uuid-set-new-001",
      "set_number": 1,
      "target_reps_text": null,
      "weight_kg": null,
      "reps_done": null,
      "is_completed": false,
      "is_locked": false,
      "is_auto_filled": false
    }
  ]
}
```

**補足:**
- 初回追加のため `previous_sets` は空配列
- デフォルトで1セット行を生成して返す（暫定）

---

### POST /workout-session-exercises/{id}/sets

**目的:** 種目ブロックにセット行を追加する（Add Set 操作）。

**リクエスト:**
```json
{
  "target_reps_text": "5"
}
```

`target_reps_text` は省略可能。省略時は直前セットの値を引き継ぐ（推奨。→ 論点参照）。

**レスポンス (201 Created):**
```json
{
  "id": "uuid-set-new-004",
  "set_number": 4,
  "target_reps_text": "5",
  "weight_kg": null,
  "reps_done": null,
  "is_completed": false,
  "is_locked": false,
  "is_auto_filled": false
}
```

**補足:**
- `set_number` はサーバー側で既存セット数 +1 で採番する

---

### PATCH /workout-sets/{id}

**目的:** セット行の Kg / Reps を更新する。

**リクエスト:**
```json
{
  "weight_kg": 80.0,
  "reps_done": 5,
  "is_auto_filled": false
}
```

全フィールド省略可能（PATCH セマンティクス（指定したフィールドだけ上書き））。

**レスポンス (200 OK):**
```json
{
  "id": "uuid-set-001",
  "set_number": 1,
  "weight_kg": 80.0,
  "reps_done": 5,
  "is_completed": false,
  "is_locked": false,
  "is_auto_filled": false
}
```

**エラー:**
- `is_locked=true` のセットに対する PATCH は `423 Locked` を返す

**補足:**
- Kg 自動反映（1セット目 → 後続セットへの同値コピー）は **UI側で処理**し、各セットに個別に PATCH を送る
- `is_auto_filled=true` は自動反映された値であることをサーバーに伝えるフラグ

---

### POST /workout-sets/{id}/complete

**目的:** 完了チェックを入れる。`is_completed` と `is_locked` を同時に true にする（→ 論点2参照）。

**リクエスト:** なし（空ボディ）

**レスポンス (200 OK):**
```json
{
  "id": "uuid-set-001",
  "is_completed": true,
  "is_locked": true,
  "completed_at": "2026-04-11T09:15:30Z"
}
```

**エラー:**
- 既に `is_completed=true` のセットに呼ぶと `409 Conflict` を返す（推奨）
- `weight_kg` または `reps_done` が null のまま complete を呼んだ場合: 200 + `"warnings": ["weight_kg is empty"]` を返す（推奨。未確定）

---

### POST /workout-sets/{id}/unlock

**目的:** ロックを解除する。`is_completed` と `is_locked` を同時に false に戻す（→ 論点3参照）。

**リクエスト:** なし（空ボディ）

**レスポンス (200 OK):**
```json
{
  "id": "uuid-set-001",
  "is_completed": false,
  "is_locked": false,
  "completed_at": null
}
```

**エラー:**
- 既に `is_locked=false` のセットに呼ぶと `409 Conflict` を返す（推奨）

**補足:**
- 解除後は `PATCH` で再編集 → `POST /complete` で再チェックの流れになる

---

### POST /workout-sets/{id}/delete

**目的:** セット行を論理削除（非表示扱いの削除）する。MVP では `deleted_at` を埋める方式を推奨する。

**リクエスト:** なし（空ボディ）

**レスポンス (200 OK):**
```json
{
  "id": "uuid-set-001",
  "deleted_at": "2026-04-11T09:18:40Z",
  "renumbered_sets": [
    { "id": "uuid-set-002", "set_number": 1 },
    { "id": "uuid-set-003", "set_number": 2 }
  ]
}
```

**エラー:**
- `is_locked=true` のセットに対しては `409 Conflict` を返す（推奨）
- 既に `deleted_at IS NOT NULL` のセットに呼ぶと `409 Conflict` を返す（推奨）

**補足:**
- 削除対象は追加セットだけでなく通常セットも含む
- API 側でも locked（ロック済み）のままなら削除不可にする
- 削除後は active（有効）セットの `set_number` を詰め直すレスポンスを返す方針を推奨する
- MVP では確認ダイアログは UI 側で出し、API は削除実行のみを担う

---

### GET /exercises/{id}/history

**目的:** 種目単体の過去セット記録を新しい順で取得する。

**2026-04-12 implementation note:**
- 現在の Exercise History 画面は Route Handler ではなく `lib/workout/exercise-history.ts` の server-side helper で同等の取得を実装している
- 画面側の対象ユーザーは `auth.getUser()` の `user_id` で絞り込み、他ユーザーの履歴へはフォールバックしない
- 初期表示上限は 10 セッション、探索上限は直近 100 セッション

**クエリパラメータ:**

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| `user_id` | UUID | ✓ | 記録の所有者 |
| `limit` | INT | — | 取得セッション件数の上限（デフォルト: 10）|

**レスポンス (200 OK):**
```json
{
  "exercise_id": "uuid-ex-bench",
  "exercise_name_ja": "ベンチプレス",
  "exercise_name_en": "Bench Press",
  "sessions": [
    {
      "session_id": "uuid-session-090",
      "session_date": "2026-04-01",
      "program_label": "GZCLP Week 8 Day 1",
      "sets": [
        { "set_number": 1, "weight_kg": 80.0, "reps_done": 3, "note": "" },
        { "set_number": 2, "weight_kg": 80.0, "reps_done": 3, "note": "" },
        { "set_number": 3, "weight_kg": 80.0, "reps_done": 7, "note": "AMRAP" }
      ]
    },
    {
      "session_id": "uuid-session-085",
      "session_date": "2026-03-28",
      "program_label": "GZCLP Week 7 Day 3",
      "sets": [
        { "set_number": 1, "weight_kg": 77.5, "reps_done": 3, "note": "" },
        { "set_number": 2, "weight_kg": 77.5, "reps_done": 3, "note": "" },
        { "set_number": 3, "weight_kg": 77.5, "reps_done": 3, "note": "" }
      ]
    }
  ]
}
```

**補足:**
- `is_completed=true` のセットのみ返す（暫定）
- `deleted_at IS NULL` のセットのみ返す
- `program_label` はサーバー側で `programs.title + " Week N Day N"` を結合して生成する
- Previous の算出は `GET /workout-sessions/{id}` のレスポンス側で行う。このAPIからは算出しない（→ 論点4参照）
- セッション件数が 0 件の場合: `"sessions": []`
- 現在の画面実装も同じ条件で `workout_sessions` / `workout_session_exercises` / `workout_sets` を server-side に読んでいる

---

### POST /workout-sessions/{id}/finish

**目的:** セッションを終了する。`finished_at` をセットし `status=completed` にする。

**リクエスト:**
```json
{
  "force": false
}
```

- `force=false`（デフォルト）: 未完了セットがある場合は 422 を返す
- `force=true`: 未完了セットがあっても完了扱いにする

**レスポンス (200 OK):**
```json
{
  "id": "uuid-session-001",
  "status": "completed",
  "started_at": "2026-04-11T09:00:00Z",
  "finished_at": "2026-04-11T10:05:00Z",
  "elapsed_seconds": 3900,
  "total_sets": 12,
  "completed_sets": 12
}
```

**422 レスポンス（force=false かつ未完了セットあり）:**
```json
{
  "error": "incomplete_sets",
  "message": "未完了のセットが 3 つあります。force=true で再送すると完了扱いにできます。",
  "incomplete_count": 3,
  "total_count": 12
}
```

**補足:**
- `force=true` で完了した場合、未チェックのセットは `is_completed=false` のまま保存される（スキップ扱い）

---

## 設計上の論点と推奨案

---

### 論点1: Kg 自動反映はAPIではなくUI側で処理するか

**推奨: UI側で処理する。**

- 1セット目 Kg 確定後、UIが後続の空欄セットに同値をセットし、各セットに個別で `PATCH` を送る
- APIは「まとめて自動反映する」専用エンドポイントを持たない
- 理由: 「手入力済み判定（上書きしない条件）」はUI側のロジックに依存するため、APIに持たせると複雑になる

---

### 論点2: 完了チェック時に is_completed と is_locked を同時更新するか

**推奨: 同時更新する。`POST /complete` で両方を true にする。**

- 理由: UIプロトタイプで「チェック → 即ロック」の挙動が確定しており、中間状態（完了だが編集可能）はMVPでは不要

---

### 論点3: ロック解除時に is_locked だけ戻すか、is_completed も戻すか

**推奨: is_completed も同時に false に戻す。`POST /unlock` で両方を false にする。**

- 理由: UIプロトタイプでロック解除時にチェックボックスも外れる挙動が確定しているため。「完了状態だが編集可能」は現仕様にない

---

### 論点4: Previous の取得は専用APIか、セッション取得APIの中か

**推奨: `GET /workout-sessions/{id}` のレスポンスに `previous_sets` を含めて返す。**

- 種目ブロックごとに `previous_sets` フィールドを持たせる
- 専用の `GET /previous` エンドポイントは作らない
- 理由: 画面表示に必要な情報を1回のリクエストで揃えられる方が実装しやすい

---

### 論点5: target_display_text（目標回数）をどこで返すか

**推奨: `workout_sets.target_reps_text` に保存し、セッション詳細レスポンスに含めて返す。**

- `POST /workout-sessions` 生成時に `program_day_exercises.target_reps_text` の値を各セットに転記して保存する
- セッション開始後にプログラム定義が変わっても、当日のセットのターゲットが変わらない
- 理由: 後からプログラムを編集した場合に当日記録が変わってしまう事故を防ぐ

---

### 論点6: Delete API は `DELETE /workout-sets/{id}` か `POST /workout-sets/{id}/delete` か

**推奨: `POST /workout-sets/{id}/delete`**

- 今回は物理削除（本当に消す）ではなく、論理削除（非表示扱いの削除）が前提
- `deleted_at` を更新し、さらに active セットの再採番も伴うため、単純な `DELETE` より動作を明示しやすい
- 理由: 「レコード削除」ではなく「削除アクションを実行する」ことを API 名で表現しやすいから

`DELETE /workout-sets/{id}` も候補ではあるが、MVP の論理削除方針とは少し意味がずれるため、初期方針としては採用しない。

---

## 未確定事項

| 項目 | 内容 | 推奨 |
|---|---|---|
| フリーセッション（プログラムなし）| `program_day_id` 省略時の動作 | 空セッション生成のみで対応（後回し）|
| 空欄チェック時の警告 | Kg/Reps が null のまま complete を呼んだとき | 200 + `"warnings": ["weight_kg is empty"]` を返す |
| Add Set の `target_reps_text` デフォルト | 省略時に直前セット引き継ぎか空欄か | 直前セット引き継ぎを推奨 |
| Delete 後の Undo | 直後の取り消しを入れるか | MVP では後回し |
| 履歴の `limit` デフォルト値 | 初回はいくつ返すか | 10件を推奨 |
| 中断セッションの扱い | `in_progress` のセッションを次回起動時にどう扱うか | `GET /workout-sessions?status=in_progress&user_id=xxx` で検索可能にしておく |
| 認証方式 | JWT・セッションベースなど | MVP では `user_id` をリクエストに含める方式で仮置き |
| Previous の参照単位 | セット番号一致優先か、種目内最新完了優先か | セット番号一致を推奨（例: 前回 Set1 の記録を今回 Set1 の Previous に表示）|

---

## 関連文書

- [data-model.md](./data-model.md)
- [workout-screen-interaction-spec.md](./workout-screen-interaction-spec.md)
- [exercise-history-wireframe.md](./exercise-history-wireframe.md)
- [screens.md](./screens.md)
