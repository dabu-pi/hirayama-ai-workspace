# アカウント削除機能 設計メモ

> 作成: 2026-05-02  
> ステータス: 設計中（実装は Phase S-4）  
> 前提: `docs/ACCOUNT_SETTINGS_ROADMAP.md` と合わせて読むこと

---

## 重要前提

**アカウント削除 ≠ ジム退会**

| 操作 | 内容 |
|------|------|
| アプリのアカウント削除 | このアプリ上のアカウントを削除する。ジムの会員契約は変わらない |
| ジムの退会・休会・会費停止 | 受付で手続きが必要。アプリ操作だけでは完了しない |

この前提をユーザー画面に必ず明示すること。

**確認文言（必須表示）:**
```
この操作は、トレーニングアプリのアカウント削除です。
ジムの会員契約・会費・休会・退会手続きは、この操作だけでは完了しません。
退会・休会・会費に関する手続きは、受付までお申し出ください。
```

---

## 既存の実装状況

### 管理者側はすでに実装済み

`/admin/account-deletion-requests` ページで、管理者が削除リクエストを審査できる。

```typescript
// app/admin/account-deletion-requests/actions.ts

approveDeletionRequest(requestId, targetUserId, adminNote)
  // → account_deletion_requests.status = 'approved'
  // → public.users.membership_status = 'cancelled'
  // → cancelled_at = now()
  // NOTE: auth.users は削除しない。データも削除しない。

rejectDeletionRequest(requestId, adminNote)
  // → account_deletion_requests.status = 'rejected'
  // → membership_status は変更しない
```

### account_deletion_requests テーブルは存在している

ただし正確なスキーマはマイグレーションファイルで確認が必要（migration 000031 が保留中）。

**欠けているのはユーザー側の申請 UI。**

---

## 削除方式の比較

### 方式A: 物理削除（auth.users ごと削除）

```
ユーザー操作 → Server Action → supabase.auth.admin.deleteUser(userId)
→ auth.users が削除される
→ ON DELETE CASCADE で public.users も削除
→ workout_sessions 等は FK 次第
```

| メリット | デメリット |
|----------|------------|
| GDPR 的に完全消去 | トレーニング履歴が消える |
| シンプルな実装 | 誰が削除したか不明 |
| | cascade の影響範囲が大きい |
| | service_role key をアプリで直接扱う |
| | 誤操作のリスクが高い |

### 方式B: ソフトデリート（`deleted_at` カラム追加）

```
ユーザー操作 → Server Action → users.deleted_at = now()
→ auth.users はそのまま（ログインはできてしまう）
→ アプリ側でガードが必要
```

| メリット | デメリット |
|----------|------------|
| 復元可能 | ログイン自体は可能なまま |
| データ保持 | auth.users の無効化が別途必要 |
| | RLS の設計が複雑になる |

### 方式C: 申請フロー（現状の設計に沿った方式）

```
ユーザー → 削除申請フォーム送信
→ account_deletion_requests に INSERT (status='pending')
→ 管理者が /admin/account-deletion-requests でレビュー
→ 承認 → membership_status = 'cancelled', cancelled_at = now()
→ (将来) auth.users の無効化または削除を管理者が手動で実施
```

| メリット | デメリット |
|----------|------------|
| 管理者が確認できる | ユーザーが即時削除できない |
| 誤操作を防げる | 申請から完了まで時間がかかる |
| 既存の管理 UI が使える | |
| auth.users を直接操作しない | |
| データを保持できる（会計・履歴） | |

**推奨方式: 方式C（申請フロー）**

理由:
- 管理者側のレビュー UI がすでに存在する
- 個人事業・小規模ジムの運用に適している（管理者が確認できることが重要）
- `auth.users` の物理削除は後から管理者が判断・実施できる
- ユーザーが誤操作しても申請の取り消しが可能

---

## service_role key の安全な扱い

### 原則

- service_role key はブラウザ側に出さない
- `SUPABASE_SERVICE_ROLE_KEY` は `.env.local`（server-side 専用）に保持
- ユーザーが直接 auth.users を操作できる経路を作らない

### 申請フロー（方式C）での実装

```typescript
// Server Action (use server) でのみ DB 操作
// ブラウザには account_deletion_requests.id のみ返す

export async function submitDeletionRequest(
  reason: string
): Promise<{ ok: boolean; requestId?: string; error?: string }> {
  "use server";
  
  const client = createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };
  
  // service_role は使わない。anon client + RLS で INSERT
  const { data, error } = await client
    .from("account_deletion_requests")
    .insert({
      user_id: user.id,
      reason: reason.trim() || null,
      status: "pending",
    })
    .select("id")
    .single();
  
  if (error) return { ok: false, error: error.message };
  return { ok: true, requestId: data.id };
}
```

管理者側の承認（物理削除を伴う場合）は `createSupabaseAdminClient()` を使うが、  
それは Server Action + `requireAdminUserId()` でガードする（既存パターンと同じ）。

---

## 削除前に残すべき履歴

### 保持が必要なデータ（会計・トラブル対応のため）

| テーブル | 保持期間 | 理由 |
|---------|---------|------|
| `workout_sessions` | 1年以上 | トレーニング実績の証跡 |
| `workout_sets` | 1年以上 | 同上 |
| `enrollments` | 1年以上 | プログラム受講記録 |
| `public.users` | 退会後1年 | 会計・問い合わせ対応 |
| `account_deletion_requests` | 永続 | 削除申請の記録 |

### 削除してよいデータ（PII最小化のため）

削除申請承認後、管理者判断で以下を匿名化できる:
- `users.display_name` → null
- `users.member_name` → null
- `auth.users.email` → 変更（Supabase admin API）

### account_deletion_requests テーブル推奨スキーマ

```sql
CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE SET NULL,
  
  -- ユーザーが削除時点で持っていた情報（個人情報最小化）
  email_snapshot  TEXT,        -- auth.users.email のスナップショット（審査用）
  display_name_snapshot TEXT,  -- 審査・問い合わせ対応用
  
  -- ステータス
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reason          TEXT,        -- ユーザーが任意で入力
  
  -- 管理者審査情報
  reviewed_at     TIMESTAMPTZ,
  reviewed_by     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  admin_note      TEXT,
  
  -- タイムスタンプ
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
```

**個人情報を残しすぎないポイント:**
- email_snapshot と display_name_snapshot は審査完了後に null 化を検討
- `user_id` に `ON DELETE SET NULL` を使うことで、auth.users 削除後もログが残る
- 住所・電話番号等はそもそも保持していないため問題なし

---

## 削除方式の推奨: ソフトキャンセル + 申請ログ

Phase S-4 で実装する内容:

```
1. ユーザーが /profile で削除申請フォームを送信
   → account_deletion_requests に INSERT (status='pending')
   → email_snapshot, display_name_snapshot を記録

2. 管理者が /admin/account-deletion-requests で確認
   → 承認: membership_status = 'cancelled', cancelled_at = now()
   → 通知: （今後実装する場合はメール等）

3. 完全削除は管理者が手動で判断（小規模ジムなので都度判断）
   → Supabase Dashboard または admin API 経由
```

**完全な auth.users 削除は Phase S-4 スコープ外。**  
将来的に必要と判断された場合に別フェーズで追加する。

---

## 既存データへの影響（FK・RLS・Cascade）

### 現在の CASCADE 設定

```sql
-- public.users
id UUID REFERENCES auth.users(id) ON DELETE CASCADE

-- つまり auth.users を削除すると public.users も自動削除される
-- → workout_sessions 等は public.users.id を参照しているため要確認
```

Phase S-4 実装前に以下を確認すること:

```sql
-- workout_sessions の FK 確認
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'users';
```

Phase S-4 実装前にこの確認を必ず行い、CASCADE の範囲を明確にすること。

---

## 誤操作防止の確認 UI

### 推奨: テキスト入力確認

```
アカウントを削除しますか？

この操作は取り消せません（申請後に管理者が審査します）。
ジムの会員契約・会費・休会・退会手続きは、この操作だけでは完了しません。
退会・休会・会費に関する手続きは、受付までお申し出ください。

確認のため、「削除する」と入力してください:
[テキスト入力フィールド]

[キャンセル]  [削除を申請する（無効：入力待ち）]
```

「削除する」と正確に入力されたときのみ申請ボタンを有効にする。

---

## 管理者画面での削除済みユーザーの扱い

現在 `/admin/members` では全会員が表示される。  
`membership_status = 'cancelled'` のユーザーは:

- 一覧に表示される（ステータスバッジ: 退会済み）
- 操作は制限（再アクティブ化 or 削除のみ）
- `account_deletion_requests` で申請の追跡が可能

削除申請があるユーザーは `/admin/account-deletion-requests` で個別に審査。

---

## 再登録の扱い

| ケース | 対応 |
|--------|------|
| アカウント削除申請後に取り消したい | status='cancelled' のうちは再申請可能（申請を cancel に変更） |
| 退会済み（`membership_status=cancelled`）で再登録 | 既存 `auth.users` が残っていればログイン可能。`membership_status` を active に戻す |
| auth.users ごと削除後の再登録 | 同じメールで新規サインアップが可能（新しい user_id になる） |

---

## 実装時の注意事項（Phase S-4 向け）

1. **Server Action で処理すること** — ブラウザ側に service_role key を出さない
2. **申請の重複防止** — pending な申請が既にある場合は再申請させない（DB UNIQUE 制約 or チェック）
3. **RLS の設定** — ユーザーは自分の申請のみ INSERT/SELECT 可能にする
4. **ユーザーへのフィードバック** — 申請後に「受け付けました」を明示する
5. **管理者通知** — 申請があったことを管理者に知らせる仕組みが必要（今後検討）

---

## 次アクション

Phase S-3 完了条件:
- [ ] account_deletion_requests の正確なスキーマをマイグレーションで確認
- [ ] FK / CASCADE 影響調査（上記 SQL を実行）
- [ ] 削除確認文言の最終決定
- [ ] 管理者通知手段の検討（メール / Slack 等）

**Phase S-4 実装は Phase S-3 が完全に固まってから別プロンプトで着手する。**
