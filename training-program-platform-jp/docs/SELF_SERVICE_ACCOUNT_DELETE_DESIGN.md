# 自己責任即時アカウント削除 設計ドキュメント

> 作成: 2026-05-02（Phase S-5 調査）  
> 更新: 2026-05-03（Phase S-8 物理削除方式 調査追加）  
> ステータス: **Phase S-8 設計完了・実装承認待ち**  
> 関連: `docs/ACCOUNT_DELETE_DESIGN.md`（申請方式の設計）

---

## Phase S-8: auth.users 物理削除方式 調査結果（2026-05-03）

### 背景と方針変更

S-7（ソフトデリート）では `app_deleted_at` をセットするのみで `auth.users` を残す方式を採用した。  
しかし以下の課題が発覚したため、**S-8 では auth.users を物理削除する方式**に移行する。

| S-7 方式の問題 | S-8 方式で解決 |
|--------------|-------------|
| 同じメールで再ログインできてしまう | auth.users 削除後は同メールアドレスで再登録可能になる |
| signup 時に ghost ユーザーが作られる可能性 | auth.users が存在しないため重複なし |
| /login ループが発生する | セッション自体が消える |
| 「アカウント削除したのにメールが残る」UX | 完全消去 |

---

### FK / CASCADE 完全マップ（deleteUser() 実行時）

```
supabase.auth.admin.deleteUser(userId) を呼ぶと:

auth.users (削除)
  │
  ├─ CASCADE ──→ public.users (削除)
  │               ├─ CASCADE ──→ program_enrollments    ✅ 全件削除
  │               │               └─ CASCADE ──→ t1_progression_states ✅
  │               ├─ CASCADE ──→ workout_sessions        ✅ 全件削除
  │               │               └─ CASCADE ──→ workout_session_exercises ✅
  │               │                               └─ CASCADE ──→ workout_sets ✅
  │               ├─ SET NULL ─→ programs.creator_user_id ✅ null 化
  │               │
  │               ├─ NO ACTION → account_deletion_requests.user_id     ⚠️ BLOCK
  │               ├─ NO ACTION → account_deletion_requests.reviewed_by ⚠️ BLOCK (adminが審査済み時)
  │               ├─ NO ACTION → membership_pause_requests.user_id     ⚠️ BLOCK
  │               ├─ NO ACTION → membership_pause_requests.reviewed_by ⚠️ BLOCK (adminが審査済み時)
  │               ├─ NO ACTION → billing_cutoff_records.confirmed_by   ⚠️ BLOCK (adminユーザーの場合)
  │               └─ SET NULL  → account_deletion_logs.user_id         ✅ null 化（監査ログ保持）
  │
  ├─ CASCADE ──→ user_exercises (削除)
  │               └─ RESTRICT ← workout_session_exercises.user_exercise_id ⚠️ BLOCK
  │                  (カスタム種目を使ったセッション行が存在する場合)
  │
  ├─ SET NULL ─→ gym_consultation_requests.user_id  ✅ null 化
  └─ SET NULL ─→ gym_announcements.created_by        ✅ null 化
```

### BLOCK 箇所の一覧と解消方法

| テーブル | カラム | 現状 | 解消方法 | 影響 |
|---------|--------|------|---------|------|
| account_deletion_requests | user_id | NO ACTION | ON DELETE SET NULL | 申請記録は残る（user_id が null になる） |
| account_deletion_requests | reviewed_by | NO ACTION | ON DELETE SET NULL | 審査者情報は null になる |
| membership_pause_requests | user_id | NO ACTION | ON DELETE SET NULL | 休会記録は残る |
| membership_pause_requests | reviewed_by | NO ACTION | ON DELETE SET NULL | 同上 |
| billing_cutoff_records | confirmed_by | NO ACTION | ON DELETE SET NULL | 確定者情報は null になる |
| workout_session_exercises | user_exercise_id | RESTRICT | ON DELETE CASCADE | カスタム種目使用セッション行も削除 |

---

### 削除されるデータ / 残るデータ

| テーブル | 結果 | 備考 |
|---------|------|------|
| auth.users | 物理削除 | |
| public.users | CASCADE 削除 | |
| program_enrollments | CASCADE 削除 | |
| workout_sessions | CASCADE 削除 | |
| workout_session_exercises | CASCADE 削除 | |
| workout_sets | CASCADE 削除 | |
| user_exercises | CASCADE 削除 | |
| t1_progression_states | CASCADE 削除 | |
| gym_consultation_requests.user_id | SET NULL | 相談記録は残る |
| gym_announcements.created_by | SET NULL | お知らせ記録は残る |
| account_deletion_requests | user_id = null | 申請記録は残る |
| membership_pause_requests | user_id = null | 休会記録は残る |
| billing_cutoff_records.confirmed_by | SET NULL | 請求記録は残る |
| **account_deletion_logs** | **user_id = null で保持** | **監査ログは永続保持** |

---

### 必要な migration（1ファイル）

```sql
-- Phase S-8: Fix NO ACTION FKs to allow auth.users physical deletion
-- Changes RESTRICT/NO ACTION to SET NULL or CASCADE

-- account_deletion_requests
ALTER TABLE public.account_deletion_requests
  DROP CONSTRAINT IF EXISTS account_deletion_requests_user_id_fkey;
ALTER TABLE public.account_deletion_requests
  ADD CONSTRAINT account_deletion_requests_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.account_deletion_requests
  DROP CONSTRAINT IF EXISTS account_deletion_requests_reviewed_by_fkey;
ALTER TABLE public.account_deletion_requests
  ADD CONSTRAINT account_deletion_requests_reviewed_by_fkey
  FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- membership_pause_requests
ALTER TABLE public.membership_pause_requests
  DROP CONSTRAINT IF EXISTS membership_pause_requests_user_id_fkey;
ALTER TABLE public.membership_pause_requests
  ADD CONSTRAINT membership_pause_requests_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.membership_pause_requests
  DROP CONSTRAINT IF EXISTS membership_pause_requests_reviewed_by_fkey;
ALTER TABLE public.membership_pause_requests
  ADD CONSTRAINT membership_pause_requests_reviewed_by_fkey
  FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- billing_cutoff_records
ALTER TABLE public.billing_cutoff_records
  DROP CONSTRAINT IF EXISTS billing_cutoff_records_confirmed_by_fkey;
ALTER TABLE public.billing_cutoff_records
  ADD CONSTRAINT billing_cutoff_records_confirmed_by_fkey
  FOREIGN KEY (confirmed_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- workout_session_exercises: user_exercise_id → CASCADE
-- When user_exercises is deleted (via auth.users CASCADE),
-- workout_session_exercises rows using that custom exercise are also deleted.
ALTER TABLE public.workout_session_exercises
  DROP CONSTRAINT IF EXISTS workout_session_exercises_user_exercise_id_fkey;
ALTER TABLE public.workout_session_exercises
  ADD CONSTRAINT workout_session_exercises_user_exercise_id_fkey
  FOREIGN KEY (user_exercise_id) REFERENCES public.user_exercises(id) ON DELETE CASCADE;
```

**migration 適用前の確認 SQL（SELECT のみ）:**
```sql
-- 既存の constraint 名を確認（DROP IF EXISTS のため事前確認は任意）
SELECT conname, contype, confdeltype
FROM pg_constraint
WHERE conrelid IN (
  'public.account_deletion_requests'::regclass,
  'public.membership_pause_requests'::regclass,
  'public.billing_cutoff_records'::regclass,
  'public.workout_session_exercises'::regclass
)
AND contype = 'f';
```

---

### S-8 Server Action の設計

```typescript
export async function selfDeleteAccount(input: {
  confirmText: string;
  reason?: string;
}): Promise<{ ok: boolean; error?: string }> {
  // 1. confirmText 検証（サーバー側）
  // 2. getUser() で認証確認
  // 3. 二重実行防止チェック
  
  // 4. 削除ログを先に作成（auth.users 削除後は account_deletion_logs.user_id が SET NULL になる）
  await admin.from("account_deletion_logs").insert({
    user_id: user.id,
    email_snapshot: user.email,
    display_name_snapshot: userRow.display_name,
    membership_status_snapshot: userRow.membership_status,
    deletion_method: "self_service",
    reason: input.reason,
  });

  // 5. auth.users を物理削除
  //    → CASCADE: public.users → 全トレーニングデータ
  //    → SET NULL: 監査ログ・請求記録のFK
  const { error } = await adminClient.auth.admin.deleteUser(user.id);
  
  if (error) return { ok: false, error: error.message };
  
  return { ok: true };
  // 呼び出し元: signOut() → window.location.href = "/account-deleted"
}
```

**注意: S-7 の app_deleted_at 更新は不要になる（auth.users が消えるため middleware でも検出不要）**

---

### JWT 残存問題への対応

- `deleteUser()` 後、Supabase サーバーはそのユーザーの JWT を即時無効化する
- middleware の `supabase.auth.getUser()` はサーバー側で検証するため、削除直後から正しく「未認証」として扱われる
- クライアント側: `selfDeleteAccount()` 呼び出し後に `supabase.auth.signOut()` を呼ぶことでローカル cookie を消去
- これで JWT 残存問題は実質的に解決される

---

### 再登録の扱い

| ケース | S-7 方式 | S-8 方式 |
|--------|---------|---------|
| 同じメールで再ログイン | セッションあり→/account-deleted ループ | ❌ Invalid credentials（auth.users なし） |
| 同じメールで新規登録 | ghost ユーザー重複リスク | ✅ 通常の新規登録フロー（新しい user_id） |
| 過去のデータ引き継ぎ | app_deleted_at で参照可能 | なし（CASCADE 削除のため） |

---

### S-8 実装可否判断

**実装してよい条件:**
1. ✅ migration を Supabase にて適用済み
2. ✅ constraint 名が確認できている（DROP CONSTRAINT が正確）
3. ✅ テスト用ユーザーで動作確認済み
4. ✅ app_deleted_at ベースの S-7 middleware ガードは削除不要（auth.users 削除後は middleware が自動的に未認証扱いにする）

**実装後に不要になるもの（段階的に整理）:**
- `public.users.app_deleted_at` チェック（middleware / app/page.tsx / login page） → auth.users が消えるため不要になる
- S-6 の middleware の app_deleted_at ロジック → 簡略化できる
- `/account-deleted` へのリダイレクト → `/login` への通常リダイレクトで代替可能

**リスク:**
- 全トレーニングデータが消える（不可逆）
- 管理者がテスト用ユーザーを誤削除した場合の復元不可
- `account_deletion_requests.user_id` が NOT NULL 制約を持つ場合は migration で nullable 化も必要（現状確認要）

---

### account_deletion_requests.user_id の NOT NULL 確認

migration 000027 を確認:
```sql
user_id uuid NOT NULL REFERENCES public.users(id),
```
`NOT NULL` が付いているため、ON DELETE SET NULL にする前に `DROP NOT NULL` も必要。

**正しい migration:**
```sql
-- user_id を nullable にしてから FK を SET NULL に変更
ALTER TABLE public.account_deletion_requests
  ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.account_deletion_requests
  DROP CONSTRAINT IF EXISTS account_deletion_requests_user_id_fkey;
ALTER TABLE public.account_deletion_requests
  ADD CONSTRAINT account_deletion_requests_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;
```

同様に membership_pause_requests.user_id も `NOT NULL` があるため同じ処理が必要。

---

### 推奨実装手順（Phase S-8 着手時）

```
Step 1: migration 作成
  - 20260503_000037_s8_fix_fk_for_auth_delete.sql
  - BLOCK FKs を SET NULL / CASCADE に変更
  - NOT NULL 制約を先に DROP

Step 2: Supabase Dashboard で migration 適用
  - 本番前にステージング環境でテスト

Step 3: selfDeleteAccount() を更新
  - admin.from("users").update({app_deleted_at}) → 削除
  - admin.auth.admin.deleteUser(userId) を追加
  - display_name/member_name null 化は不要（CASCADE 削除されるため）

Step 4: S-7 の app_deleted_at ガードを整理（省略可能、段階的に）
  - middleware の app_deleted_at チェックは残しておいても害なし
  - 将来的に簡略化してよい

Step 5: テスト用ユーザーで確認
  - T7': auth.users が削除されている
  - T7'': 同じメールで新規登録できる
  - T7''': account_deletion_logs が保持されている（user_id は null）
```

---

## 大前提：アプリ削除 ≠ ジム退会

| 操作 | 内容 |
|------|------|
| **トレーニングアプリのアカウント削除** | このアプリへのアクセスを即時停止する。**ジムの会員契約には影響しない** |
| ジムの退会・休会・会費停止 | 受付での手続きが必要。アプリ操作だけでは完了しない |

この原則はすべての画面文言・設計判断に優先する。

`membership_status` はアプリ削除では変更しない。`cancelled_at` もセットしない。  
ジム会員状態の変更は管理者が受付経由でのみ行う（既存設計と同じ）。

---

## 1. S-4 申請方式の扱い方針

### 現在の S-4 実装状態

- `account_deletion_requests` テーブル：適用済み
- ユーザー申請フォーム（`submitDeletionRequest` / `cancelDeletionRequest`）：実装済み
- 管理者レビュー画面（`/admin/account-deletion-requests`）：実装済み
- 実機確認：未完了

### 方針決定：**C（UI は S-7 で置き換え）＋ D（管理画面は維持）**

| 対象 | 方針 | 理由 |
|------|------|------|
| ユーザー向け申請フォーム（S-4 UI） | S-7 実装時に置き換える | 最終方式は申請ではなく即時削除のため |
| S-4 の実機確認・本番デプロイ | 保留（S-7 方向性確定後に判断） | 中途半端な申請フローを本番に出す必要はない |
| `/admin/account-deletion-requests` 管理画面 | 維持する | 管理側の削除履歴確認・強制キャンセルに使える |
| `account_deletion_requests` テーブル | 維持する（役割を変更） | S-7 の削除ログとして再利用できる |

**S-4 のコードは削除しない。** ただし `docs` に「S-7 実装時に UI を置き換える予定」を明記する。

---

## 2. 削除方式の比較

### 方式A：auth.users の物理削除

```
supabase.auth.admin.deleteUser(userId)
→ CASCADE: public.users → program_enrollments, workout_sessions, t1_progression_states
→ CASCADE: user_exercises
→ ⚠️ RESTRICT: workout_session_exercises.user_exercise_id → BLOCK
→ ⚠️ NO ACTION: account_deletion_requests.user_id → BLOCK（行が存在する場合）
→ ⚠️ NO ACTION: membership_pause_requests.user_id → BLOCK（行が存在する場合）
→ ⚠️ NO ACTION: billing_cutoff_records.confirmed_by → BLOCK（管理者の場合）
```

| 評価項目 | 内容 |
|---------|------|
| 実現性 | ❌ 現行スキーマで 5〜6 箇所の FK BLOCK あり |
| 必要な migration | 6 テーブルの FK 変更が必要 |
| データ消失 | 全トレーニング履歴が CASCADE 削除される |
| 可逆性 | ❌ 不可逆 |
| 結論 | Phase S-8 以降に検討。現時点では採用しない |

### 方式B：アプリレベル ソフトデリート（推奨）

```
public.users に app_deleted_at TIMESTAMPTZ を追加
→ Server Action: app_deleted_at = now() を設定
→ 削除ログを account_deletion_logs に記録
→ signOut() → /login または削除完了ページへ遷移
→ Middleware / Server Components が app_deleted_at を確認し、アクセスを遮断
```

| 評価項目 | 内容 |
|---------|------|
| 実現性 | ✅ カラム追加のみ（migration 1本） |
| データ消失 | なし（履歴は保持） |
| membership_status | 変更しない（ジム会員状態は維持） |
| 可逆性 | ✅ 管理者が `app_deleted_at = null` にすれば復元可能 |
| auth.users | 残る（ログイン可能だがアプリが遮断） |
| FK 変更 | 不要 |
| ユーザー体験 | 操作直後にアクセス不可になる（即時削除に近い） |
| 結論 | **Phase S-6/S-7 での採用確定** |

### 方式C：個人情報匿名化 → 物理削除

```
1. public.users.display_name = null, member_name = null
2. auth.users の email を仮アドレスに変更（admin API）
3. FK RESTRICT を解消する migration を適用
4. supabase.auth.admin.deleteUser(userId)
```

| 評価項目 | 内容 |
|---------|------|
| 実現性 | △ FK migration + 手動操作が複数必要 |
| 複雑度 | 高い（2〜3ステップ必要） |
| 適用タイミング | Phase S-8 以降・GDPR 対応等で必要になった場合 |
| 結論 | 将来検討。現時点では不採用 |

### 方式D：Supabase Auth の soft delete 相当

Supabase Auth には組み込みの soft delete 機能はない。  
`ban_duration` で一時的にブロックできるが永続的ではなく、再登録を防ぐ仕組みもない。  
→ 方式 B のアプリレベル管理が実質的に唯一の soft delete 手段。

---

## 3. FK / CASCADE 完全影響マップ（Phase S-5 確定版）

### auth.users 削除時の連鎖（方式A 実行時）

```
auth.users
 │
 ├─ CASCADE ──→ public.users
 │               ├─ CASCADE ──→ program_enrollments.user_id   ✅ 連鎖削除
 │               ├─ CASCADE ──→ workout_sessions.user_id       ✅ 連鎖削除
 │               │               └─ CASCADE ──→ workout_session_exercises  ✅
 │               │                               └─ CASCADE ──→ workout_sets  ✅
 │               ├─ SET NULL ─→ programs.creator_user_id       ✅ null 化
 │               ├─ NO ACTION → account_deletion_requests.user_id  ⚠️ BLOCK
 │               ├─ NO ACTION → account_deletion_requests.reviewed_by ⚠️ BLOCK (管理者が審査済み時)
 │               ├─ NO ACTION → membership_pause_requests.user_id   ⚠️ BLOCK
 │               ├─ NO ACTION → membership_pause_requests.reviewed_by ⚠️ BLOCK (管理者が審査済み時)
 │               └─ NO ACTION → billing_cutoff_records.confirmed_by  ⚠️ BLOCK (管理者の場合)
 │
 ├─ CASCADE ──→ user_exercises.user_id
 │               └─ RESTRICT ← workout_session_exercises.user_exercise_id ⚠️ BLOCK
 │                  (CASCADE で workout_session_exercises は先に削除されるが
 │                   PostgreSQL の実行順序依存で BLOCK になる可能性あり)
 │
 └─ SET NULL ─→ gym_consultation_requests.user_id             ✅ null 化
 └─ SET NULL ─→ gym_announcements.created_by                  ✅ null 化
```

### BLOCK 箇所の解消に必要な migration（Phase S-8 向け）

| テーブル | カラム | 現状 | 必要な変更 | データへの影響 |
|---------|--------|------|-----------|---------------|
| account_deletion_requests | user_id | NO ACTION | ON DELETE SET NULL | 削除申請ログは残る（user_id が null になる） |
| account_deletion_requests | reviewed_by | NO ACTION | ON DELETE SET NULL | 審査者情報は null になる |
| membership_pause_requests | user_id | NO ACTION | ON DELETE SET NULL | 休会申請ログは残る |
| membership_pause_requests | reviewed_by | NO ACTION | ON DELETE SET NULL | 審査者情報は null になる |
| billing_cutoff_records | confirmed_by | NO ACTION | ON DELETE SET NULL | 確定者情報は null になる |
| workout_session_exercises | user_exercise_id | RESTRICT | ON DELETE SET NULL | カスタム種目参照が null になる |

**注意:** account_deletion_requests と membership_pause_requests の user_id を SET NULL にすると、削除後はどのユーザーの申請かわからなくなる。`email_snapshot` / `display_name_snapshot` カラムを追加して削除前の個人情報を記録しておくことを推奨（Phase S-6 で対応）。

### 物理削除後の CASCADE による損失データ

| テーブル | 連鎖 | 失われるデータ |
|---------|------|--------------|
| program_enrollments | CASCADE | プログラム受講記録 |
| workout_sessions | CASCADE | セッション記録（完了・進行中・キャンセル） |
| workout_session_exercises | CASCADE（via sessions） | 種目記録 |
| workout_sets | CASCADE（via exercises） | セット記録（重量・レップ） |
| t1_progression_states | CASCADE（via enrollments） | T1 進行ステート |
| user_exercises | CASCADE（via auth.users） | カスタム種目定義 |

**全トレーニング履歴が削除される。** これを防ぎたい場合は、workout_sessions.user_id を ON DELETE SET NULL に変更する migration が別途必要（トレーニング履歴を匿名データとして残す）。

---

## 4. 削除後に残すべきデータ・消すべきデータ

### 分類表

| テーブル / カラム | 方式B（推奨） | 方式A（物理削除） | 備考 |
|-----------------|-------------|-----------------|------|
| public.users（行） | **残す**（app_deleted_at だけ設定） | CASCADE 削除 | 方式B はソフト削除 |
| users.display_name | **null 化** | 削除 | PII |
| users.member_name | **null 化** | 削除 | PII |
| users.email（auth.users） | そのまま（auth 側） | 削除（auth 削除で消える） | 方式B では残る |
| users.membership_status | **変更しない** | — | ジム会員状態は別管理 |
| users.cancelled_at | **変更しない** | — | ジム退会日。アプリ削除とは無関係 |
| workout_sessions | **残す（匿名化）** | CASCADE 削除 | 集計・実績確認のため |
| workout_sets | **残す（匿名化）** | CASCADE 削除 | 同上 |
| program_enrollments | **残す（匿名化）** | CASCADE 削除 | 受講記録 |
| user_exercises | **残す（匿名化）** | CASCADE 削除 | 種目定義は残す |
| account_deletion_requests | **残す** | user_id が null になる | 監査ログ |
| membership_pause_requests | **残す** | user_id が null になる | 監査ログ |
| billing_cutoff_records | **残す** | confirmed_by が null になる | 会計記録 |
| account_deletion_logs（新設） | **残す（永続）** | 残す | 削除の監査証跡 |

### 匿名化する個人識別情報（方式Bでの削除時）

```
削除実行時（Server Action）:
  public.users.display_name = null
  public.users.member_name = null
  public.users.app_deleted_at = now()
  → account_deletion_logs に email_snapshot, display_name_snapshot を記録してから null 化
```

---

## 5. 再登録の扱い

### 方式B（ソフトデリート）での再登録

| ケース | 挙動 |
|--------|------|
| アプリ削除後に同じメールでサインイン | `app_deleted_at` がセットされているため、アプリ側でアクセスをブロック |
| 管理者が `app_deleted_at = null` に戻す | アカウント復元。以前のデータに再アクセス可能 |
| 本人が「再登録したい」と申し出た場合 | 受付経由で管理者がアカウント復元 |

**「削除後は復元できません」は方式Bでは厳密に正しくない。**  
管理者は復元できるため、文言は「削除後は通常ご自身では復元できません。再開を希望する場合は受付までお問い合わせください。」とする。

### 方式A（物理削除）での再登録

| ケース | 挙動 |
|--------|------|
| 同じメールで新規サインアップ | 可能。新しい user_id が採番される |
| 過去のトレーニング履歴 | 復元不可（CASCADE 削除されたため） |
| 同一人物の照合 | メールアドレスのみ（履歴なし） |

---

## 6. 画面文言 設計（Phase S-7 向け）

### 常時表示の注意カード

```
【重要：この操作について】
この操作は、トレーニングアプリのアカウント削除です。
ジムの会員契約・会費・休会・退会手続きは、この操作だけでは完了しません。
退会・休会・会費に関する手続きは、受付までお申し出ください。
```

### 削除確認 UI

```
アカウント削除

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
この操作は取り消しが難しい場合があります。以下を確認してください。
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

□ アプリへのログインができなくなることを理解しています
□ トレーニング履歴などが閲覧できなくなることを理解しています
□ ジムの会員契約・会費は別途受付での手続きが必要なことを理解しています

確認のため「アカウントを削除します」と入力してください：
[テキスト入力フィールド]

[キャンセル]  [アカウントを削除する]  ← 全チェック + 入力完了後のみ有効
```

### 削除完了後の画面

```
アカウントを削除しました。

トレーニングアプリのアカウントは削除されました。
ご利用いただきありがとうございました。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ジムの会員契約・会費・休会・退会手続きはこの操作では完了していません。
必要な場合は受付までお申し出ください。
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[ログイン画面へ]
```

### ボタン文言の比較

| 案 | 文言 | 評価 |
|----|------|------|
| A | アカウントを削除する | ✅ 簡潔。「アカウント」の意味がアプリのものと明確 |
| B | トレーニングアプリのアカウントを削除する | △ 長い。画面の説明文で補完できる |
| C | 確認してアカウントを削除する | △ 冗長 |

**推奨: 案A「アカウントを削除する」**  
注意文・チェックボックス・確認テキストで文脈を補うため、ボタン自体は簡潔でよい。

### 確認テキストの比較

| 案 | 入力テキスト | 評価 |
|----|------------|------|
| A | 「アカウントを削除します」 | ✅ 即時削除の意図が明確。S-4 の「申請する」と混同しない |
| B | 「削除する」 | △ 短すぎる。誤入力リスク |
| C | メールアドレス入力 | ✅ GDPR 的に強い確認。UX は若干悪い |

**推奨: 案A「アカウントを削除します」**

---

## 7. 管理者側の扱い

### 即時削除方式での管理者向け変更

| 項目 | 変更内容 |
|------|---------|
| account_deletion_requests | 役割変更：ユーザー申請ログ → 管理操作ログとしても使用 |
| account_deletion_logs（新設） | 自己削除イベントの監査ログ。永続保持 |
| `/admin/account-deletion-requests` | そのまま維持。削除ログ一覧として機能 |
| `/admin/members` | `app_deleted_at IS NOT NULL` のユーザーを「削除済み」バッジで表示 |
| membership_status | **変更しない**（ジム会員状態は別管理） |
| cancelled_at | **変更しない**（ジム退会日とは無関係） |

### account_deletion_logs（新設テーブル案）

```sql
CREATE TABLE public.account_deletion_logs (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID REFERENCES public.users(id) ON DELETE SET NULL,
  email_snapshot       TEXT,           -- 削除時点の email（audit 用）
  display_name_snapshot TEXT,          -- 削除時点の display_name（audit 用）
  deletion_method      TEXT NOT NULL
    CHECK (deletion_method IN ('self_service', 'admin_forced')),
  deleted_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  note                 TEXT            -- 管理者メモ（強制削除時など）
);
```

**このテーブルは Phase S-6 で作成する。**

---

## 8. Phase S-6 で必要な DB 変更まとめ

| 変更 | 内容 | 優先度 |
|------|------|--------|
| `public.users.app_deleted_at` カラム追加 | アプリレベルソフト削除の主体 | **必須** |
| `account_deletion_logs` テーブル新設 | 削除イベントの監査ログ | **必須** |
| middleware: `app_deleted_at` チェック追加 | 削除済みユーザーのアクセス遮断 | **必須** |
| account_deletion_requests.user_id → ON DELETE SET NULL | S-8 向け準備 | 任意（S-8 時に実施）|
| membership_pause_requests FK 変更 | S-8 向け準備 | 任意（S-8 時に実施）|
| workout_session_exercises FK 変更 | S-8 向け準備 | 任意（S-8 時に実施）|

### Phase S-6 migration 案（参考 SQL・実行不可）

```sql
-- 1. public.users にアプリ削除カラム追加
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS app_deleted_at TIMESTAMPTZ;

COMMENT ON COLUMN public.users.app_deleted_at IS
  'Timestamp when the user self-deleted their app account. '
  'NOT related to gym membership. membership_status is unchanged. '
  'App blocks access when this is non-null.';

-- 2. account_deletion_logs テーブル新設
CREATE TABLE IF NOT EXISTS public.account_deletion_logs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID REFERENCES public.users(id) ON DELETE SET NULL,
  email_snapshot        TEXT,
  display_name_snapshot TEXT,
  deletion_method       TEXT NOT NULL
    CHECK (deletion_method IN ('self_service', 'admin_forced')),
  deleted_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  note                  TEXT
);

ALTER TABLE public.account_deletion_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can select deletion logs"
  ON public.account_deletion_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  ));
```

---

## 9. Phase S-7 Server Action 設計

### `selfDeleteAccount()` の設計

```typescript
// app/profile/actions.ts に追加予定（Phase S-7 実装時）
"use server";

export async function selfDeleteAccount(): Promise<{
  ok: boolean;
  error?: string;
}> {
  const client = createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();

  // 1. 削除ログを記録（PII を先にスナップショット）
  await admin.from("account_deletion_logs").insert({
    user_id: user.id,
    email_snapshot: user.email ?? null,
    deletion_method: "self_service",
    deleted_at: now,
  });

  // 2. public.users を匿名化 + app_deleted_at をセット
  //    membership_status は変更しない（ジム会員状態は独立）
  await admin.from("users").update({
    app_deleted_at: now,
    display_name: null,
    member_name: null,
  }).eq("id", user.id);

  // 3. auth.users の email も匿名化（オプション）
  //    → Phase S-8 で検討。S-7 では auth.users を変更しない

  return { ok: true };
  // 呼び出し元が signOut() + リダイレクトを行う
}
```

---

## 10. Phase S-8：物理削除への道（将来）

Phase S-8 は以下がすべて揃った場合にのみ着手する：

1. ✅ Phase S-6/S-7 が本番で安定動作している
2. ✅ 以下 FK を ON DELETE SET NULL に変更する migration を適用済み：
   - account_deletion_requests.user_id
   - account_deletion_requests.reviewed_by
   - membership_pause_requests.user_id
   - membership_pause_requests.reviewed_by
   - billing_cutoff_records.confirmed_by
   - workout_session_exercises.user_exercise_id
3. ✅ トレーニング履歴を匿名データとして残す場合は workout_sessions.user_id も SET NULL に変更
4. ✅ Supabase admin API 経由で auth.users.deleteUser() を安全に呼べる Server Action を実装

**物理削除が必要なケース（参考）:**
- GDPR 等の法的要件で「データの完全削除」が求められる場合
- ユーザーから「auth.users ごと完全に消してほしい」という要求がある場合

**現時点の結論: Phase S-8 は「見送り可能」。方式B（ソフトデリート）で十分。**

---

---

## Phase S-6 実装記録（2026-05-02）

### 実装済み

| 項目 | 実装内容 |
|------|---------|
| S-4 申請 UI 撤去 | ProfileScreen から申請フォームを削除。管理者画面は維持 |
| app_deleted_at | migration 000035: `public.users.app_deleted_at TIMESTAMPTZ` |
| account_deletion_logs | migration 000036: 削除監査ログテーブル新設 |
| middleware | app_deleted_at 非 null → `/account-deleted` リダイレクト |
| matcher 拡張 | /train・/session-history・/profile・/gym・/my-exercises |
| /account-deleted | 削除済みユーザー向け案内ページ |
| admin/members | app_deleted_at をクエリ・型に追加（UI バッジは S-7） |

### admin ユーザーの app_deleted_at リスク

admin ロールのユーザーが app_deleted_at を持つ場合、現在の設計では `/admin` へのアクセスが可能。  
これは意図的な設計（管理者が自分のアカウントを削除してもシステム管理できる）だが、  
将来的に管理者の app 削除を禁止する制御を追加することを検討する。

### S-7 向け残作業

- `selfDeleteAccount()` Server Action 実装（app_deleted_at セット + ログ記録）
- 削除確認 UI（チェックボックス + 「アカウントを削除します」入力）
- 削除完了後: signOut → /account-deleted 遷移
- admin/members に「アプリ削除済み」バッジ追加

---

---

## Phase S-7 実装記録（2026-05-02）

### selfDeleteAccount() 処理フロー

```
1. hasSupabasePublicEnv() チェック
2. confirmText === "アカウントを削除します" の検証（サーバー側）
3. auth.getUser() で認証確認
4. public.users から display_name / member_name / membership_status / app_deleted_at を取得
5. app_deleted_at が非 null なら "already_deleted" を返す（二重実行防止）
6. account_deletion_logs に INSERT（email_snapshot / display_name_snapshot /
   membership_status_snapshot / deletion_method='self_service' / reason / deleted_at）
7. public.users を UPDATE（app_deleted_at = now() / display_name = null / member_name = null）
8. membership_status / cancelled_at / auth.users は変更しない
```

### UI の確認フロー

```
チェックボックス3個 + 「アカウントを削除します」入力
  → 全条件一致でボタン有効化
  → 削除実行
  → ok: true → signOut() → window.location.href = "/account-deleted"
  → ok: false → エラー表示・ボタン再有効化
```

### 削除後に変更されるもの

| 項目 | 変更 |
|------|------|
| public.users.app_deleted_at | now() に設定 |
| public.users.display_name | null に設定（匿名化） |
| public.users.member_name | null に設定（匿名化） |
| account_deletion_logs | 新規行を INSERT（スナップショット記録） |

### 削除後に変更されないもの

| 項目 | 変更しない理由 |
|------|--------------|
| membership_status | ジム会員状態。アプリ削除とは別管理 |
| cancelled_at | ジム退会日。アプリ削除では設定しない |
| auth.users | Phase S-8 以降で検討 |
| workout_sessions / sets | トレーニング履歴。匿名データとして保持 |
| program_enrollments | 受講記録。保持 |

---

## 更新履歴

| 日付 | 内容 |
|------|------|
| 2026-05-02 | Phase S-5: 新規作成（自己責任即時削除の調査・設計） |
| 2026-05-02 | Phase S-6: 実装記録を追記 |
| 2026-05-02 | Phase S-7: 実装記録を追記 |
