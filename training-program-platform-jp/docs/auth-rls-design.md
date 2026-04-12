# Auth / RLS 設計メモ — Phase B

作成: 2026-04-12

---

## 1. 用語（短い定義）

| 用語 | 意味 |
|---|---|
| Auth | 「この人は誰か」をサーバーが確認する仕組み。今回は Supabase Auth（メール/パスワードログイン）を使う |
| RLS | Row Level Security。DB テーブルの行単位で「この行を見てよいのは誰か」をルールとして設定する Supabase の機能。アプリ側のバグで他人のデータが見えることを DB 層で防ぐ |
| anon key | ブラウザや Server Component が使う Supabase 接続キー。RLS の制約を受ける |
| service role key | サーバーだけが使う特権キー。RLS を無視して全データにアクセスできる。`createSupabaseAdminClient()` で使用 |
| `public.users` | `auth.users` と 1:1 で紐付く公開側のテーブル。`role` や `display_name` を持つ |
| middleware.ts | Next.js がリクエストを受けたとき最初に動く処理。ここでログイン状態を確認し、未ログインなら `/login` にリダイレクトできる |

---

## 2. 現状整理 — auth が関係する箇所

### 2-A. auth.getUser() を呼んでいる箇所（7箇所）

```
呼び出し場所                                    種別              userId が null のとき
────────────────────────────────────────────────────────────────────────────────
lib/programs/program-detail.ts  getCurrentUserId    Server Component  null を返す → enrollment なしとして進む
lib/workout/start-session.ts    startSessionForDay  Library           null → user_id なしで session/enrollment を作る
lib/workout/train-session.ts    getWorkoutSessionView  Library        null → user_id フィルタなしで session 取得
lib/workout/train-session.ts    findWorkoutSessionByDayId  Library    null → user_id フィルタなしで lookup
lib/workout/exercise-history.ts getExerciseHistoryView  Library       null → エラー返却（唯一の auth 必須箇所）
lib/workout/workout-summary.ts  getWorkoutSummaryView   Library      null → sessionId のみで取得（MVP workaround）
app/api/.../finish/route.ts     POST handler        API Route         null → user_id フィルタなしで finish
```

### 2-B. admin client（RLS バイパス）を使っている箇所

| 箇所 | 理由 |
|---|---|
| `lib/workout/enrollment.ts` | enrollment の find-or-create は auth なしでも動く必要があった（MVP） |
| `lib/workout/start-session.ts` | session insert + 重複チェック |
| `lib/workout/train-session.ts` | session view ロード |
| `lib/workout/workout-summary.ts` | summary ロード（MVP: userId null でも見える） |
| `lib/workout/exercise-history.ts` | 履歴クエリ |
| `app/api/workout-sets/*/` | set の complete/delete/unlock/update |
| `app/api/workout-sessions/*/` | session finish, add exercise, swap exercise |
| `app/api/workout-session-exercises/*/` | add set |
| `app/api/exercises/route.ts` | exercise 一覧 |

**方針:** RLS 有効化後、API Route はサーバーから呼ぶので admin client を使い続ける。Server Component 内では可能な限り server client（anon key + cookie）に切り替え、RLS でデータを絞り込む。

### 2-C. middleware.ts

**現状: なし。** Phase B で新規作成する。

---

## 3. サインイン方式 — 最小案

### 採用: Supabase Email/Password（マジックリンクなし）

| 項目 | 内容 |
|---|---|
| 方式 | メールアドレス + パスワードでサインアップ/サインイン |
| 理由 | Supabase Dashboard で最小設定。OAuth（Google/GitHub）は後で追加可能 |
| UI | `/login` ページに Email + Password フォームを 1 枚作る |
| 初回ユーザー | サインアップ時に `public.users` に行を作る trigger を用意（既に `auth.users` → `public.users` の FK がある） |
| セッション管理 | Supabase SSR（`@supabase/ssr`）が cookie を管理。Server Component / API Route は `createSupabaseServerClient()` 経由で `auth.getUser()` を呼ぶ |

### 画面フロー

```
未ログイン → middleware.ts がリダイレクト → /login
   ↓ ログイン成功
/programs → /programs/[slug] → /train → /workout-summary
```

### /login ページの構成

- Client Component（useState でフォーム管理）
- `supabase.auth.signInWithPassword({ email, password })` を呼ぶ
- 成功時: `router.push('/programs')` または `router.refresh()`
- 失敗時: エラーメッセージ表示
- サインアップリンク（最小: 同じフォーム + `supabase.auth.signUp()` トグル）

---

## 4. user_id 必須化の変更点

### 4-A. DB（migration）

```sql
-- public.users に auth.users のコピー行を作る trigger
-- サインアップ時に自動で insert される
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.users (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- user_id を NOT NULL に戻す（既存の null 行を先にクリーンアップ）
-- ★注意: 実行前に null 行を削除 or テスト用ユーザーに紐付ける必要あり
alter table public.workout_sessions
  alter column user_id set not null;

alter table public.program_enrollments
  alter column user_id set not null;
```

### 4-B. Server-side（lib 変更 7箇所）

| ファイル | 変更内容 |
|---|---|
| `lib/workout/start-session.ts` | `userId` が null → `{ ok: false, reason: "unauthenticated" }` を返す。`if (userId)` ガードを外し、必ず `user_id` を insert する |
| `lib/workout/enrollment.ts` | `userId: string \| null` → `userId: string` に変更。null チェック不要に |
| `lib/workout/train-session.ts` | `getWorkoutSessionView`: userId が null → mock fallback 返却。`.eq("user_id", userId)` を常に適用 |
| `lib/workout/train-session.ts` | `findWorkoutSessionByDayId`: userId が null → null 返却。`.eq("user_id", userId)` を常に適用 |
| `lib/workout/workout-summary.ts` | `getWorkoutSummaryView`: userId が null → `unauthenticated` state を返す（元に戻す）。`.eq("user_id", userId)` を常に適用 |
| `lib/programs/program-detail.ts` | `getCurrentUserId`: 変更なし（null を返すのは正常。enrollment が見つからなければ firstDay を使う） |
| `app/api/.../finish/route.ts` | userId が null → `401 Unauthorized` を返す。`.eq("user_id", userId)` を常に適用 |

### 4-C. API Route（全エンドポイント）

Phase B では API Route にも userId チェックを入れる:

```typescript
// 共通パターン
const serverClient = createSupabaseServerClient();
const { data: { user } } = await serverClient.auth.getUser();
if (!user) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

対象（auth チェックを追加する API Route）:
- `POST /api/workout-sessions`
- `POST /api/workout-sessions/[id]/finish`
- `PATCH /api/workout-sets/[id]`
- `POST /api/workout-sets/[id]/complete`
- `POST /api/workout-sets/[id]/delete`
- `POST /api/workout-sets/[id]/unlock`
- `POST /api/workout-session-exercises/[id]/sets`
- `POST /api/workout-sessions/[id]/exercises`
- `PATCH /api/workout-sessions/[id]/exercises/[exerciseId]`

**GET /api/exercises は auth 不要**（公開データ）

### 4-D. Client Component

`StartSessionScreen` の `fetch('/api/workout-sessions', ...)` が 401 を返したとき:
- エラーメッセージ「ログインしてください」を表示
- `/login` への誘導リンクを出す

---

## 5. RLS 最小設計案

### 方針

```
テーブル           RLS      SELECT               INSERT/UPDATE/DELETE
─────────────────────────────────────────────────────────────────────
programs           ON       全員（is_public=true）  admin のみ（将来）
program_weeks      ON       全員                   admin のみ
program_days       ON       全員                   admin のみ
program_day_exercises ON    全員                   admin のみ
exercises          ON       全員                   admin のみ
program_enrollments ON      自分の行のみ            自分の行のみ
workout_sessions   ON       自分の行のみ            自分の行のみ
workout_session_exercises ON 自分の session に属する行  自分の session に属する行
workout_sets       ON       自分の session に属する行  自分の session に属する行
users              ON       自分の行のみ            自分の行のみ
```

### SQL 例

```sql
-- ─── programs 系: 公開読み取り ──────────────
alter table public.programs enable row level security;

create policy "Public programs are readable by everyone"
  on public.programs for select
  using (is_public = true);

-- program_weeks / program_days / program_day_exercises / exercises も同様
-- using (true) で全行読み取り可

-- ─── enrollment: 自分のデータのみ ───────────
alter table public.program_enrollments enable row level security;

create policy "Users can read own enrollments"
  on public.program_enrollments for select
  using (auth.uid() = user_id);

create policy "Users can insert own enrollments"
  on public.program_enrollments for insert
  with check (auth.uid() = user_id);

create policy "Users can update own enrollments"
  on public.program_enrollments for update
  using (auth.uid() = user_id);

-- ─── workout_sessions: 自分のデータのみ ─────
alter table public.workout_sessions enable row level security;

create policy "Users can read own sessions"
  on public.workout_sessions for select
  using (auth.uid() = user_id);

create policy "Users can insert own sessions"
  on public.workout_sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own sessions"
  on public.workout_sessions for update
  using (auth.uid() = user_id);

-- ─── workout_session_exercises: session 経由で自分のみ ────
alter table public.workout_session_exercises enable row level security;

create policy "Users can manage own session exercises"
  on public.workout_session_exercises for all
  using (
    exists (
      select 1 from public.workout_sessions ws
      where ws.id = workout_session_id
        and ws.user_id = auth.uid()
    )
  );

-- ─── workout_sets: session_exercise 経由で自分のみ ────
alter table public.workout_sets enable row level security;

create policy "Users can manage own sets"
  on public.workout_sets for all
  using (
    exists (
      select 1 from public.workout_session_exercises wse
      join public.workout_sessions ws on ws.id = wse.workout_session_id
      where wse.id = workout_session_exercise_id
        and ws.user_id = auth.uid()
    )
  );
```

### service role が必要な箇所

| 処理 | 理由 |
|---|---|
| enrollment 進行（`advanceEnrollmentAfterSessionComplete`） | Finish API 内で enrollment を update するが、Finish 時の user は session owner なので RLS は通る。ただし安全のため admin client を維持する |
| seed データ投入 | SQL Editor / CLI 経由のため影響なし |

**結論:** Phase B 後も API Route では admin client（service role）を使い続ける。admin client は RLS を無視するため、アプリ側の auth チェック（`if (!user) return 401`）が最終防御線になる。Server Component では server client + RLS が第一防御線。

---

## 6. Workout Summary 暫定対応を戻す条件

### 現状の暫定対応

```typescript
// lib/workout/workout-summary.ts
// MVP: userId が null でも admin client で sessionId のみで取得
if (userId !== null) {
  query = query.eq("user_id", userId);
}
```

### 元に戻す条件

以下の **3つすべて** が満たされたとき:

1. `/login` ページが動作し、ログイン後のセッション cookie が保持される
2. `middleware.ts` が未ログイン状態の `/workout-summary/*` アクセスを `/login` にリダイレクトする
3. `workout_sessions.user_id` が NOT NULL に戻っている

### 戻す変更

```typescript
// 戻した後のコード
if (!userId) {
  return {
    summary: null,
    state: "unauthenticated",
    errorMessage: "Sign in is required to view this workout summary."
  };
}
// 常に user_id フィルタを適用
query = query.eq("user_id", userId);
```

---

## 7. 壊れやすい箇所と注意点

| 箇所 | リスク | 対策 |
|---|---|---|
| `public.users` に行がない状態で user_id NOT NULL にすると FK 違反 | auth.users に行があっても public.users に行がないと insert が失敗する | trigger `on_auth_user_created` を**先に**作る |
| 既存の user_id=null の workout_sessions / enrollments が NOT NULL 制約で弾かれる | ALTER TABLE が失敗する | 既存 null 行を先に DELETE するか、テスト用ユーザーに紐付ける |
| middleware.ts 導入時に `/api/*` も保護してしまうと API が動かなくなる | API Route は server 側の auth チェックで守るべき | middleware の matcher で `/api/*` を除外する |
| RLS ON にしたあと admin client を使わない API Route があると 0 行返る | MVP で使っていた query が突然空になる | RLS ON は **ステップ 3 の最後**、コードの auth チェック追加完了後に行う |

---

## 8. 推奨する実装順

### ステップ 1: ログイン基盤（auth の入口）

**変更範囲が小さく、既存動作を壊さない。**

1. migration: `handle_new_user` trigger を作る（auth.users → public.users 自動コピー）
2. `/app/login/page.tsx` を作成（Email/Password フォーム）
3. `lib/supabase/client.ts` を作成（クライアントサイド用 Supabase client）
4. `middleware.ts` を作成（未ログイン → `/login` リダイレクト。`/login` と `/api/*` は除外）
5. Supabase Dashboard でテストユーザーを作成して動作確認

**完了条件:** ログイン→ Programs 一覧 が見える。ログアウト状態で `/programs` にアクセスすると `/login` に飛ぶ。

### ステップ 2: userId 必須化（コード側）

**ログインが動く前提で、userId null ガードを auth 必須ガードに切り替える。**

1. `StartSessionResult` に `"unauthenticated"` reason を追加
2. `startSessionForDay`: userId null → `{ ok: false, reason: "unauthenticated" }` を返す
3. `getWorkoutSummaryView`: userId null → `unauthenticated` state を返す（元に戻す）
4. 全 API Route に `if (!user) return 401` ガードを追加
5. enrollment.ts の `userId: string | null` を `userId: string` に変更
6. `types/workout.ts` の `WorkoutSummaryView.userId` を `string` に戻す

**完了条件:** ログイン状態でフルフロー通過。未ログイン状態で API を叩くと 401。

### ステップ 3: DB 整備（NOT NULL + RLS）

**コード側の auth チェックが完了した後、DB 層で制約を追加。**

1. 既存の user_id=null 行をクリーンアップ（DELETE or テストユーザーに紐付け）
2. migration: `user_id SET NOT NULL` を workout_sessions と program_enrollments に適用
3. migration: 全テーブルに RLS ポリシーを適用
4. **テスト:** ログイン状態でフルフロー通過。DB レベルで他人のデータが見えないことを確認

**完了条件:** NOT NULL 制約 + RLS ON + フルフロー E2E 成功。

---

## 9. 全体見積り

| ステップ | 新規ファイル | 変更ファイル | migration | 所要時間（目安） |
|---|---|---|---|---|
| 1. ログイン基盤 | 3（login page, client.ts, middleware.ts） | 0 | 1 | 1セッション |
| 2. userId 必須化 | 0 | ~12 | 0 | 1セッション |
| 3. DB 整備 | 0 | 0 | 2 | 0.5セッション |

---

## 10. 次にそのまま着手できるプロンプト（ステップ 1）

> training-program-platform-jp のステップ 1（ログイン基盤）を実装してください。
>
> 前提:
> - `docs/auth-rls-design.md` に設計メモがある
> - 既存のフェーズA動作は壊さない
>
> 実装内容:
> 1. migration: `handle_new_user` trigger（auth.users 行作成時に public.users へ自動 insert）
> 2. `lib/supabase/client.ts`: クライアントサイド用 Supabase client（`createBrowserClient`）
> 3. `app/login/page.tsx`: Email/Password ログインフォーム（Client Component）
>    - signIn / signUp トグル
>    - エラー表示
>    - 成功時 → `/programs` にリダイレクト
> 4. `middleware.ts`: 未ログイン → `/login` リダイレクト
>    - `/login`, `/api/*`, `/_next/*`, `/favicon.ico` は除外
> 5. typecheck + build 確認
> 6. commit & push
>
> 完了条件:
> - ログイン → `/programs` が見える
> - 未ログイン → `/login` にリダイレクトされる
> - フェーズAの live E2E 動作が壊れていない
