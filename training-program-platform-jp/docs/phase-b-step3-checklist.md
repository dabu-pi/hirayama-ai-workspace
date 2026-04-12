# Phase B Step 3 — live 適用前チェックリスト

作成: 2026-04-13

---

## 概要

Phase B Step 3 は以下の 3 Migration + コード変更で構成される。

| 順序 | Migration ファイル | 内容 |
|---|---|---|
| 1 | `20260413_000006_cleanup_null_user_id.sql` | null user_id 行を削除 |
| 2 | `20260413_000007_not_null_user_id.sql` | NOT NULL 制約を復元 |
| 3 | `20260413_000008_rls_policies.sql` | RLS 有効化 + ポリシー適用 |

コード変更（`lib/workout/`）:
- `session-access.ts` / `enrollment.ts` / `start-session.ts` の `createWorkoutQueryClient` / `createQueryClient` を常に server client へ統一
- 理由: admin client は RLS を無視するため、RLS 有効化後は server client でなければポリシーが効かない

---

## Step 3 適用手順

```
1. git pull して最新コードを取得
2. Migration 000006 を Supabase dashboard SQL Editor で実行（または supabase db push）
3. Migration 000007 を実行
4. Migration 000008 を実行
5. アプリの typecheck / build が通ることを確認
6. 以下のチェックリストを上から実施
```

---

## live 適用前チェックリスト

### A. Migration 000006 実行後の確認

- [ ] `SELECT COUNT(*) FROM workout_sessions WHERE user_id IS NULL;` → 0 件
- [ ] `SELECT COUNT(*) FROM program_enrollments WHERE user_id IS NULL;` → 0 件
- [ ] `SELECT COUNT(*) FROM workout_session_exercises wse JOIN workout_sessions ws ON ws.id = wse.workout_session_id WHERE ws.user_id IS NULL;` → 0 件
- [ ] `SELECT COUNT(*) FROM workout_sets wsets JOIN workout_session_exercises wse ON wse.id = wsets.workout_session_exercise_id JOIN workout_sessions ws ON ws.id = wse.workout_session_id WHERE ws.user_id IS NULL;` → 0 件

### B. Migration 000007 実行後の確認

- [ ] Migration が error なく完了する（null 行が残っていれば NOT NULL constraint violation が出る → 000006 を再確認）
- [ ] `\d workout_sessions` で `user_id` が `NOT NULL` になっていることを確認
- [ ] `\d program_enrollments` で `user_id` が `NOT NULL` になっていることを確認
- [ ] `\d program_enrollments` で `idx_program_enrollments_active_user_program` の WHERE 句が `status = 'active'`（`AND user_id IS NOT NULL` なし）になっていることを確認

### C. Migration 000008 実行後の確認

- [ ] Migration が error なく完了する
- [ ] Supabase dashboard > Authentication > Policies でポリシーが各テーブルに表示されること
- [ ] `workout_sessions`, `program_enrollments`, `workout_session_exercises`, `workout_sets`, `programs`, `exercises`, `users` に RLS: enabled と表示されること

### D. 動作確認（ブラウザ + ログイン済みユーザー）

**公開導線（壊してはいけない）:**
- [ ] `/programs` — 未ログインでもプログラム一覧が表示される
- [ ] `/programs/gzclp-base` — 未ログインでも詳細が表示される

**セッション開始（ログイン必須）:**
- [ ] `/programs/gzclp-base` → Go to Train → Start Workout で session が POST 201 を返す
- [ ] `/train?program=gzclp-base` に遷移し、ワークアウト画面が表示される

**セット操作（本人のみ）:**
- [ ] セット記録（weight / reps の PATCH）が正常に動作する
- [ ] Complete / Unlock / Delete が正常に動作する
- [ ] Add Set が正常に動作する

**Add Exercise / Swap Exercise（live 補完確認 — B-5）:**
- [ ] Add Exercise モーダルから種目追加後、セッションに反映される
- [ ] Swap Exercise モーダルから種目変更後、反映される

**Finish / Summary:**
- [ ] Finish が正常に動作し `/workout-summary/[sessionId]` に遷移する
- [ ] Summary 画面に完了内容が表示される
- [ ] 未ログインで `/workout-summary/[sessionId]` を直接開くと `/login` にリダイレクトされる

**他人のデータにアクセスできないこと（owner guard + RLS 二重チェック）:**
- [ ] User A でログインし、User B の session_id で `GET /workout-summary/[B_session_id]` → `Workout summary not found`
- [ ] User A から User B の set に対して PATCH → 404

**sign up（B-6 — 外部レート制限解消後に確認）:**
- [ ] `/login` から新規ユーザー登録 → `/programs` にリダイレクトされる
- [ ] `public.users` に行が自動作成されている（auth user profile trigger）

---

## 注意点

### admin client を使っているが今回スコープ外の箇所

以下は今回 B-3/B-4 スコープ外。将来 Phase C で対応する。

| ファイル | 現状 | 備考 |
|---|---|---|
| `lib/programs/program-library.ts` | admin client で public programs 読込 | programs は public ポリシーが適用済みなので server client でも動作するが、変更は次フェーズ |
| `lib/programs/program-detail.ts` | admin client で public programs 読込 | 同上 |
| `lib/workout/train-session.ts` | 要確認（admin client の可能性） | RLS 適用後に動作確認すること |
| `lib/workout/workout-summary.ts` | 要確認 | 同上 |
| `lib/workout/exercise-history.ts` | 要確認 | 同上 |

### RLS と admin client の関係

- `createSupabaseAdminClient()` は service role key を使用 → RLS を無視して全データにアクセスできる
- RLS を有効化しても admin client を使っている箇所では RLS が効かない
- ただし、該当箇所には既に app-side owner guard（`eq("user_id", userId)` チェック）が実装されているため、RLS なしでも他人のデータは触れない
- RLS は「アプリバグやバイパス攻撃に対する DB 層の最終防衛線」として機能する

### workout_sets の insert RLS ポリシーの前提

`startSessionForDay` でセッション作成時に exercises → sets を順次 INSERT する。
この順序が正しく守られていれば、各 INSERT の RLS チェックは「既に作成済みの上位テーブル」を参照して通過できる。

```
1. workout_sessions INSERT  → user_id = auth.uid() ✓
2. workout_session_exercises INSERT → session.user_id = auth.uid() ✓ (1が存在するため)
3. workout_sets INSERT → exercise → session → user_id = auth.uid() ✓ (1,2が存在するため)
```

順序が崩れると RLS でブロックされる（意図した動作）。

---

## ロールバック手順

RLS を無効化して前の状態に戻す場合:

```sql
-- RLS を無効化（ポリシーは残る）
alter table public.workout_sessions disable row level security;
alter table public.program_enrollments disable row level security;
alter table public.workout_session_exercises disable row level security;
alter table public.workout_sets disable row level security;
alter table public.programs disable row level security;
alter table public.exercises disable row level security;
alter table public.program_weeks disable row level security;
alter table public.program_days disable row level security;
alter table public.program_day_exercises disable row level security;
alter table public.users disable row level security;
```

コードは git revert で `createWorkoutQueryClient` を元の条件分岐に戻す。

NOT NULL 制約のロールバックは null 行の再挿入が必要なため原則不要。問題が発生した場合は個別対応。
