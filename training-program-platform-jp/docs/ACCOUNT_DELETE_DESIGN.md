# アカウント削除機能 設計ドキュメント

> 作成: 2026-05-02 / 更新: 2026-05-02（Phase S-3 調査完了）  
> ステータス: **Phase S-3 設計完了**（実装は Phase S-4）  
> 前提: `docs/ACCOUNT_SETTINGS_ROADMAP.md` と合わせて読むこと

---

## 重要前提

**アカウント削除 ≠ ジム退会**

| 操作 | 内容 |
|------|------|
| アプリのアカウント削除申請 | トレーニングアプリ上のアカウント削除を申請する。管理者が審査する |
| ジムの退会・休会・会費停止 | 受付での手続きが必要。**アプリ操作だけでは完了しない** |

**確認文言（ユーザー画面に必ず表示）:**

```
この操作は、トレーニングアプリのアカウント削除申請です。
ジムの会員契約・会費・休会・退会手続きは、この操作だけでは完了しません。
退会・休会・会費に関するお手続きは、受付までお申し出ください。
```

---

## Phase S-3 調査結果サマリー

| 確認項目 | 結果 |
|---------|------|
| account_deletion_requests テーブル | ✅ migration 000027 + 000031 で適用済み |
| 管理者側 UI・Server Actions | ✅ 完全実装済み |
| ユーザー側申請 UI | ❌ 未実装（Phase S-4 で実装） |
| 推奨方式 | ✅ 方式C（申請フロー）で確定 |
| auth.users 物理削除の実現性 | ❌ 複数の RESTRICT FK で阻止される |
| Phase S-4 に新規 DB migration が必要か | ❌ 不要（テーブル・RLS・インデックスはすべて適用済み） |

---

## 1. account_deletion_requests 実スキーマ（調査確定版）

### テーブル定義（migration 000027 + 000031 を合算）

```sql
CREATE TABLE IF NOT EXISTS account_deletion_requests (
  -- 基本
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES public.users(id),  -- ON DELETE 句なし = RESTRICT
  reason        text        NULL,
  status        text        NOT NULL DEFAULT 'pending',

  -- タイムスタンプ
  requested_at  timestamptz NOT NULL DEFAULT now(),
  reviewed_at   timestamptz NULL,
  reviewed_by   uuid        NULL REFERENCES public.users(id),      -- ON DELETE 句なし = RESTRICT
  admin_note    text        NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  -- ジム退会業務フィールド（migration 000031）
  effective_date               date,        -- 退会適用日（当月末 or 翌月末）
  next_month_billing_confirmed boolean,     -- 申請時の口座振替確定状況スナップショット
  key_returned_at              timestamptz, -- 鍵返却記録
  refund_500_paid_at           timestamptz  -- 500円返金完了記録
);

-- ステータス制約
-- 'pending'           : 申請中（ユーザーが送信した状態）
-- 'approved'          : 管理者が承認 → membership_status='cancelled' に変更済み
-- 'rejected'          : 管理者が却下
-- 'cancelled_by_user' : ユーザー自身が申請を取り消し
CONSTRAINT account_deletion_requests_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled_by_user'));

-- 同時に pending は 1件のみ
UNIQUE INDEX account_deletion_requests_one_pending_per_user
  ON account_deletion_requests (user_id)
  WHERE status = 'pending';
```

### RLS ポリシー（migration 000027 に定義済み）

| ロール | SELECT | INSERT | UPDATE |
|--------|--------|--------|--------|
| ユーザー（自分の行のみ） | ✅ | ✅ | ❌ なし |
| 管理者 | ✅ 全件 | — | ✅ 全件 |

**重要: ユーザーの UPDATE RLS が存在しない。**  
申請の取り消し（`status = 'cancelled_by_user'`）はユーザーが直接 UPDATE できない。  
→ Server Action（`createSupabaseAdminClient()` + auth 確認）が必要。これは正しい設計。

---

## 2. FK / CASCADE 完全マップ

### auth.users を起点とした影響連鎖

```
auth.users (Supabase 内部)
  │
  ├─ ON DELETE CASCADE ──→ public.users
  │                           │
  │                           ├─ CASCADE ──→ program_enrollments.user_id    ✅ 連鎖削除
  │                           ├─ CASCADE ──→ workout_sessions.user_id        ✅ 連鎖削除
  │                           ├─ SET NULL ─→ programs.creator_user_id        ✅ null 化
  │                           │
  │                           ├─ RESTRICT ─→ account_deletion_requests.user_id     ⚠️ 削除ブロック
  │                           ├─ RESTRICT ─→ account_deletion_requests.reviewed_by ⚠️ 削除ブロック
  │                           ├─ RESTRICT ─→ billing_cutoff_records.confirmed_by   ⚠️ 削除ブロック
  │                           ├─ RESTRICT ─→ membership_pause_requests.user_id     ⚠️ 削除ブロック
  │                           └─ RESTRICT ─→ membership_pause_requests.reviewed_by ⚠️ 削除ブロック
  │
  ├─ ON DELETE CASCADE ──→ user_exercises.user_id
  │                           │
  │                           └─ RESTRICT ─→ workout_session_exercises.user_exercise_id ⚠️ 削除ブロック
  │
  └─ ON DELETE SET NULL ─→ gym_consultation_requests.user_id                ✅ null 化
```

### RESTRICT FK の一覧

| テーブル | カラム | 条件 |
|---------|--------|------|
| account_deletion_requests | user_id | 申請を出したことがある場合 |
| account_deletion_requests | reviewed_by | 管理者が誰かの申請を審査した場合 |
| billing_cutoff_records | confirmed_by | 管理者が口座振替確定操作をした場合 |
| membership_pause_requests | user_id | 休会申請を出したことがある場合 |
| membership_pause_requests | reviewed_by | 管理者が休会申請を審査した場合 |
| workout_session_exercises | user_exercise_id（→ user_exercises） | カスタム種目を使ったセッションがある場合 |

**結論: auth.users の物理削除は、実際の会員ほぼ全員に対してブロックされる。**  
削除申請を出したことがあれば account_deletion_requests で RESTRICT がかかる。  
カスタム種目を使ったことがあれば user_exercises → workout_session_exercises で RESTRICT がかかる。  
管理者アカウントを削除しようとすると billing_cutoff_records 等でもブロックされる。

---

## 3. 削除方式の確定比較

### 方式A: 物理削除（auth.users ごと削除）

```
supabase.auth.admin.deleteUser(userId)
→ CASCADE: public.users, program_enrollments, workout_sessions が削除される
→ ただし上記 6箇所の RESTRICT FK がある限り実行不可
```

| 評価 | 内容 |
|------|------|
| 実現性 | ❌ 現行スキーマでは複数 RESTRICT FK により不可能 |
| 対応コスト | FK の ON DELETE 句を変更する migration が必要（多テーブル影響） |
| リスク | 会計・履歴・管理ログが連鎖削除される |
| 結論 | **採用しない** |

### 方式B: ソフトデリート（deleted_at カラム追加）

| 評価 | 内容 |
|------|------|
| 実現性 | △ 新規カラム追加の migration が必要 |
| 問題 | auth.users が残るためログインは引き続き可能（auth 側の無効化が別途必要） |
| 結論 | **採用しない** |

### 方式C: 申請フロー（現行設計）← 確定採用

```
ユーザー申請（/profile）
  → account_deletion_requests INSERT (status='pending')
  → 管理者が /admin/account-deletion-requests でレビュー
  → 承認: membership_status='cancelled', cancelled_at=now()
  → auth.users の物理削除は別途判断（1年後・管理者手動）
```

| 評価 | 内容 |
|------|------|
| 実現性 | ✅ テーブル・RLS・管理者 UI がすでに存在する |
| 安全性 | ✅ 誤操作防止・管理者確認あり |
| DB 変更 | ✅ 不要（Phase S-4 で migration なし） |
| ビジネス適合性 | ✅ 小規模ジムの運用に合う（管理者が都度確認） |
| 結論 | **採用確定** |

---

## 4. 管理者側の既存実装確認

### `/admin/account-deletion-requests` ページ（実装済み）

`app/admin/account-deletion-requests/page.tsx` の動作:

1. admin client で `account_deletion_requests` を全件取得（最新100件）
2. 関連する `public.users`（member_name, display_name, membership_status）を取得
3. `admin.auth.admin.listUsers()` でメールアドレスを取得
4. 3つをマージして `DeletionRequestsScreen` コンポーネントに渡す

### `approveDeletionRequest()` の動作（実装済み）

```typescript
// app/admin/account-deletion-requests/actions.ts
// 1. requireAdminUserId() で管理者確認
// 2. account_deletion_requests.status → 'approved'
// 3. public.users.membership_status → 'cancelled'
// 4. public.users.cancelled_at → now()
// NOTE: auth.users は削除しない。トレーニングデータも削除しない。
```

### DeletionRequestsScreen の表示（実装済み）

- 未処理・処理済みを分けて表示
- 既に cancelled のユーザーには「すでに退会済み」を表示し承認ボタンを無効化
- 管理メモ（任意）入力欄あり
- 免責事項: 「ログイン情報・トレーニング履歴はこの処理では削除されません」

### 既存実装の軽微な課題（Phase S-4 では対応不要）

- `status='cancelled_by_user'` の表示が「却下済み」と同じ扱いになっている
  → Phase S-4 後に `/admin/account-deletion-requests` 側で表示を改善できる（任意）

---

## 5. Phase S-4 実装スコープ（確定版）

### 追加するもの

| 種別 | 内容 |
|------|------|
| Server Action | `submitDeletionRequest(reason)` — ユーザーが申請を送信 |
| Server Action | `cancelDeletionRequest(requestId)` — ユーザーが申請を取り消し |
| UI | `/profile` 内の「アカウント削除申請」セクション |

### 追加しないもの

| 種別 | 理由 |
|------|------|
| DB migration | テーブル・RLS・インデックスはすべて適用済み |
| auth.users 物理削除 | FK RESTRICT で現状不可。Phase S-4 スコープ外 |
| 管理者通知（メール等） | Phase S-4 スコープ外 |

### Server Actions の設計

#### `submitDeletionRequest(reason)`

```typescript
"use server";

export async function submitDeletionRequest(
  reason: string
): Promise<{ ok: boolean; requestId?: string; error?: string }> {
  const client = createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  // RLS INSERT ポリシー（user_id = auth.uid()）が機能する
  // UNIQUE インデックスにより pending が2件以上になることはない（DB 側で保護）
  const { data, error } = await client
    .from("account_deletion_requests")
    .insert({
      user_id: user.id,
      reason: reason.trim() || null,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    // UNIQUE 制約違反: pending 申請が既に存在する
    if (error.code === "23505") {
      return { ok: false, error: "pending_exists" };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true, requestId: data.id };
}
```

#### `cancelDeletionRequest(requestId)`

```typescript
"use server";

export async function cancelDeletionRequest(
  requestId: string
): Promise<{ ok: boolean; error?: string }> {
  const client = createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  // ユーザーの UPDATE RLS がないため admin client を使う
  // ただし user_id = user.id で自分の申請に限定する（自己制限）
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("account_deletion_requests")
    .update({
      status: "cancelled_by_user",
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("user_id", user.id)   // 自分の申請のみ
    .eq("status", "pending");  // pending のみキャンセル可

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
```

### ユーザー側 UI の状態分岐

```
/profile の「アカウント削除申請」セクション

状態1: pending 申請なし
  → 説明文 + 確認テキスト入力 + 「申請する」ボタン

状態2: pending 申請あり
  → 「申請中: YYYY-MM-DD に申請しました」表示
  → 「申請を取り消す」ボタン

状態3: approved（承認済み）
  → 「退会処理が完了しました。アカウントは引き続きログイン可能ですが、
     会員機能はご利用いただけません。」
  → (ログアウトボタンへ誘導)

状態4: rejected（却下済み）
  → 「申請は却下されました。ご不明な点は受付までお問い合わせください。」
  → (再申請できる)
```

### 確認 UI（申請フォーム）

```
アカウント削除申請

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【重要】この操作はトレーニングアプリのアカウント削除申請です。
ジムの会員契約・会費・休会・退会手続きは、この操作だけでは完了しません。
退会・休会・会費に関するお手続きは、受付までお申し出ください。
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

申請後、管理者が確認してアカウント削除を処理します。
ログイン情報・トレーニング履歴は申請後も一定期間保管されます。

申請理由（任意）:
[テキストエリア]

確認のため「申請する」と入力してください:
[テキスト入力]

[キャンセル]  [削除を申請する] ← "申請する" と入力されたときのみ有効
```

---

## 6. データ保持方針

| テーブル | 保持期間 | 理由 |
|---------|---------|------|
| `auth.users` | 退会後1年 | ログイン機能のため |
| `public.users` | 退会後1年 | 会計・問い合わせ対応 |
| `workout_sessions` / `workout_sets` | 退会後1年 | 実績証跡・返金対応 |
| `program_enrollments` | 退会後1年 | 受講記録 |
| `account_deletion_requests` | 永続 | 削除申請の監査ログ |
| `membership_pause_requests` | 退会後1年 | 休会履歴 |

### 1年経過後の匿名化手順（管理者が手動実施・Phase S-4 スコープ外）

```
1. public.users.display_name → null
2. public.users.member_name → null
3. auth.users の email を仮メールに変更（admin API）
4. FK RESTRICT を解消後に auth.users 物理削除を検討
   （必要な場合のみ・別フェーズで設計）
```

---

## 7. 再登録の扱い

| ケース | 対応 |
|--------|------|
| pending 申請を取り消したい | `cancelDeletionRequest()` で `cancelled_by_user` に変更。再申請可能 |
| rejected（却下）後に再申請 | 再申請フォームから新規送信可（UNIQUE インデックスは pending のみ制約） |
| 退会済みで再登録したい | auth.users が残っていれば既存メールでログイン可。管理者が membership_status を active に戻す |
| auth.users 物理削除後に再登録 | 同じメールで新規サインアップ可能（user_id は新規採番） |

---

## 8. Phase S-4 実装チェックリスト

### 実装前確認（設計確定済み ✅）

- [x] account_deletion_requests テーブル・RLS・インデックスを確認 → 適用済み
- [x] FK/CASCADE の全影響を確認 → 6箇所の RESTRICT を特定
- [x] 管理者側 UI・Server Actions を確認 → 完全実装済み
- [x] 削除確認文言を確定
- [x] 推奨方式（方式C）を確定
- [x] Phase S-4 に新規 migration が不要であることを確認

### 実装項目

- [ ] `app/profile/actions.ts` に `submitDeletionRequest()` 追加
- [ ] `app/profile/actions.ts` に `cancelDeletionRequest()` 追加
- [ ] `app/profile/page.tsx` で pending 申請状態を取得して props に渡す
- [ ] `components/profile/ProfileScreen.tsx` に削除申請セクションを追加
- [ ] `components/profile/ProfileScreen.module.css` にスタイル追加
- [ ] typecheck + build 確認
- [ ] Vercel デプロイ・実機確認

### テスト項目（Phase S-4 実機確認用）

| # | テスト | 期待結果 |
|---|--------|---------|
| T1 | 申請フォームを開く | 確認文言が表示される |
| T2 | 「申請する」未入力でボタンが無効 | 送信できない |
| T3 | 「申請する」入力でボタンが有効化 | 送信できる |
| T4 | 申請送信後の画面 | 「申請中」ステータスに切り替わる |
| T5 | 申請を取り消す | ステータスが cancelled_by_user に変更される |
| T6 | 再申請できる | 新規 pending が登録できる |
| T7 | 二重申請できない | 「pending 申請が既にあります」エラー |
| T8 | 管理者画面で申請が表示される | /admin/account-deletion-requests に表示 |
| T9 | 管理者が承認 | membership_status='cancelled' / ユーザー画面に反映 |
| T10 | 「退会・削除」とジム退会を混同する文言がない | 確認テキストで明確に分離されている |

---

## 9. 未解決事項（Phase S-4 着手前に判断）

| 項目 | 内容 | 優先度 |
|------|------|--------|
| 管理者通知 | 申請があったとき管理者に通知する手段（メール・Slack等）| 中 |
| admin 画面での cancelled_by_user 表示改善 | 現在「却下済み」と同じ表示になっている | 低 |
| 1年後の物理削除フロー | FK RESTRICT 解消 + auth.users 削除の手順書 | 低（将来フェーズ） |

**Phase S-4 実装は上記3項目を完全に解決する前に着手してよい。**  
UI と Server Actions の実装は独立して進められる。

---

## 更新履歴

| 日付 | 内容 |
|------|------|
| 2026-05-02 | Phase S-1: 初版作成（設計案） |
| 2026-05-02 | Phase S-3: migration 全調査に基づき実スキーマ確定・FK 全マップ作成・設計確定 |
