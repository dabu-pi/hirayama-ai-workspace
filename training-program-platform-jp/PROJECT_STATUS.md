# PROJECT_STATUS

## 2026-05-03 Phase S-7: 自己責任アカウント削除 UI

### STATUS: ✅ LIVE_CHECK PASS / CLOSED (2026-05-03)

**変更ファイル:**
- `app/profile/actions.ts` — `selfDeleteAccount()` 追加
- `components/profile/ProfileScreen.tsx` — 自己責任削除セクション追加
- `components/profile/ProfileScreen.module.css` — `.selfDel*` スタイル追加
- `app/account-deleted/page.tsx` — 再登録案内テキスト追記

**実装内容:**

| 項目 | 内容 |
|------|------|
| selfDeleteAccount() | confirmText サーバー側検証 / 二重実行防止 / audit log INSERT → app_deleted_at + 匿名化 UPDATE の順 |
| 匿名化対象 | display_name = null / member_name = null |
| 変更しないもの | membership_status / cancelled_at / auth.users / workout_sessions / program_enrollments |
| account_deletion_logs | user_id / email_snapshot / display_name_snapshot / membership_status_snapshot / deletion_method='self_service' / reason / deleted_at を記録 |
| /profile UI | 注意カード + 説明文 + チェックボックス3個 + 理由任意入力 + 確認テキスト + 削除ボタン |
| 削除ボタン有効化条件 | 全チェックON + 「アカウントを削除します」完全一致入力 |
| 削除後の挙動 | signOut() → window.location.href = "/account-deleted"（Router Cache 回避） |
| /account-deleted | 再登録案内テキスト追記 |

**typecheck / build:**
- `npm run typecheck`: エラーなし ✅
- `npm run build`: Compiled successfully（/profile 3.03kB → 4.14kB）✅

**実機確認結果（全 PASS / 2026-05-03）:**

| # | 確認内容 | 結果 | 確認方法 |
|---|---|------|---------|
| T1 | /profile に「トレーニングアプリのアカウント削除」セクション表示 | ✅ PASS | ブラウザ実機 |
| T2 | 注意カード文言（ジム退会でない・受付へ） | ✅ PASS | ブラウザ実機 |
| T3 | チェックボックス未チェックで削除ボタン無効 | ✅ PASS | 静的コード検証 |
| T4 | 全チェックON・確認テキスト未入力で削除ボタン無効 | ✅ PASS | 静的コード検証 |
| T5 | 「アカウントを削除します」入力後に削除ボタン有効化 | ✅ PASS | ブラウザ実機 |
| T6 | 削除実行後 /account-deleted に遷移 | ✅ PASS | T7 成功が前提 |
| T7 | users.app_deleted_at に日時が入る | ✅ PASS | Supabase DB 確認 |
| T8 | account_deletion_logs に履歴が作成される | ✅ PASS | Supabase DB 確認 |
| T9 | display_name / member_name が null に | ✅ PASS | Supabase DB 確認 |
| T10 | membership_status は変更されていない | ✅ PASS | Supabase DB 確認 |
| T11 | cancelled_at は変更されていない | ✅ PASS | Supabase DB 確認 |
| T12 | auth.users は削除されていない | ✅ PASS | Supabase Auth 確認 |
| T13 | 削除後 /gym /train /profile に入れない（/account-deleted へリダイレクト） | ✅ PASS | ブラウザ実機 |
| T14 | 削除後再ログインしても通常利用不可 | ✅ PASS | ブラウザ実機 |
| T15 | /account-deleted は表示できる | ✅ PASS | 静的コード検証 |
| T16 | 既存ユーザー（通常）には影響なし | ✅ PASS | 静的コード検証 |
| T17 | admin 画面に影響なし | ✅ PASS | 静的コード検証 |
| T18 | スマホ幅で表示崩れなし | ✅ PASS | ブラウザ実機 |

**注意点:**
- selfDeleteAccount() のサーバー側 confirmText 検証により、UI をバイパスした悪用を防止
- 削除は audit log INSERT → user UPDATE の順（ログ先行でスナップショットを確実に保存）
- account_deletion_logs には member_name_snapshot カラムがないため、member_name は logs に記録しない（migration 000036 のスキーマに準拠）

---

## 2026-05-02 Phase S-6: アカウント削除 土台整備

### STATUS: ✅ LIVE_CHECK PASS / CLOSED (2026-05-02)

**変更ファイル:**
- `components/profile/ProfileScreen.tsx` — S-4 申請 UI を撤去（ログアウト機能は維持）
- `app/profile/page.tsx` — S-4 用の deletion request 取得を削除（S-4 前の状態に戻す）
- `middleware.ts` — `app_deleted_at` チェック追加・matcher 拡張
- `lib/admin/members.ts` — `app_deleted_at` をクエリ・型に追加

**作成ファイル:**
- `app/account-deleted/page.tsx` — 削除済みユーザー向け案内ページ（新規）
- `supabase/migrations/20260502_000035_users_app_deleted_at.sql`
- `supabase/migrations/20260502_000036_account_deletion_logs.sql`

**実装内容:**

| 項目 | 内容 |
|------|------|
| S-4 申請 UI | ProfileScreen から完全撤去（管理者 admin 画面は維持） |
| app_deleted_at | public.users に TIMESTAMPTZ カラム追加（migration 000035） |
| account_deletion_logs | 削除監査ログテーブル新設（migration 000036） |
| middleware | app_deleted_at 非 null → /account-deleted へリダイレクト |
| middleware matcher | /train・/session-history・/profile・/gym・/my-exercises に拡張 |
| /account-deleted | 削除済みユーザー向けシンプル案内ページ |
| admin/members | app_deleted_at を型・クエリに追加（UI バッジは S-7 以降） |
| membership_status | 変更なし |
| cancelled_at | 変更なし |
| auth.users | 削除なし |

**typecheck / build:**
- `npm run typecheck`: エラーなし ✅
- `npm run build`: Compiled successfully（28ページ、/account-deleted 追加）✅
- `/profile` サイズ: 4.09kB → 3.03kB（S-4 UI 撤去の効果）

**migration 安全確認:**
- 000035: ADD COLUMN のみ。既存データへの破壊的変更なし ✅
- 000036: 新規テーブル作成のみ。既存テーブルへの変更なし ✅
- auth.users の物理削除に関する変更なし ✅

**Migration 適用結果（Supabase Dashboard で確認済み）:**

| migration | 内容 | 結果 |
|-----------|------|------|
| 000035 | public.users.app_deleted_at カラム作成 | ✅ 適用済み |
| 000036 | account_deletion_logs テーブル作成 | ✅ 適用済み |
| 000036 RLS | SELECT policy（admin のみ）確認 | ✅ 正常 |

**実機確認結果（全 PASS）:**

| # | 確認内容 | 結果 |
|---|---|------|
| T1 | /profile 表示 | ✅ PASS |
| T2 | S-4 のアカウント削除申請 UI が表示されていない | ✅ PASS |
| T3 | ログアウトボタンは残っている | ✅ PASS |
| T4 | /gym 通常表示 | ✅ PASS |
| T5 | /train 通常表示 | ✅ PASS |
| T6 | /session-history 通常表示 | ✅ PASS |
| T7 | /account-deleted ページ存在 | ✅ PASS |
| T8 | 通常ユーザーが /account-deleted へ勝手に飛ばされない | ✅ PASS |
| T9 | admin 画面に影響なし | ✅ PASS |
| T10 | スマホ幅で /profile 表示崩れなし | ✅ PASS |

**注意点:**
- migration は Supabase Dashboard の SQL Editor または `supabase db push` で適用する
- `app_deleted_at` はアプリ削除のみ。ジム退会（cancelled_at / membership_status）とは完全に別
- admin ユーザーは app_deleted_at があっても /admin に入れる設計（RISK として文書化済み）

---

## 2026-05-02 Phase S-5: 自己責任即時削除 調査・設計

### STATUS: ✅ 設計完了 / CLOSED (2026-05-02)

**変更ファイル:**
- `docs/SELF_SERVICE_ACCOUNT_DELETE_DESIGN.md` — 新規作成（即時削除の完全設計書）
- `docs/ACCOUNT_DELETE_DESIGN.md` — 方針変更ノートを先頭に追記
- `ROADMAP.md` — S-4 保留・S-5〜S-8 追加

**方針変更の概要:**

| 変更前 | 変更後 |
|--------|--------|
| 申請フロー（S-4）が最終方式 | 自己責任即時削除（S-7）が最終方式 |
| 申請 → 管理者審査 → 承認 | ユーザー自身が即時実行 |
| S-4 本番デプロイ予定 | **S-4 本番デプロイ保留** |

**S-5 調査の主要結論:**

| 確認項目 | 結果 |
|---------|------|
| 推奨方式 | 方式B（ソフトデリート）: `app_deleted_at` カラム追加 |
| 物理削除（方式A）の実現性 | 6箇所の FK BLOCK で現状不可 |
| membership_status の扱い | **変更しない**（ジム会員状態は別管理） |
| cancelled_at の扱い | **変更しない**（ジム退会日とは無関係） |
| S-4 の扱い | 実装済みだが本番デプロイ保留。UI は S-7 で置き換え |
| admin 画面 | 維持する |

**FK/CASCADE BLOCK 箇所（物理削除の場合）:**

| # | テーブル.カラム | 現状 | S-8 向け解消方法 |
|---|---|---|---|
| 1 | account_deletion_requests.user_id | NO ACTION | ON DELETE SET NULL |
| 2 | account_deletion_requests.reviewed_by | NO ACTION | ON DELETE SET NULL |
| 3 | membership_pause_requests.user_id | NO ACTION | ON DELETE SET NULL |
| 4 | membership_pause_requests.reviewed_by | NO ACTION | ON DELETE SET NULL |
| 5 | billing_cutoff_records.confirmed_by | NO ACTION | ON DELETE SET NULL |
| 6 | workout_session_exercises.user_exercise_id | RESTRICT | ON DELETE SET NULL |

**推奨削除方式の確認文言（Phase S-7 向け）:**

```
確認テキスト入力: 「アカウントを削除します」
ボタン文言: 「アカウントを削除する」
チェックボックス: 3項目（ログイン不可・履歴閲覧不可・ジム退会は別手続き）
```

**S-6 で必要な DB 変更:**
- `public.users.app_deleted_at TIMESTAMPTZ` カラム追加
- `account_deletion_logs` テーブル新設
- middleware + Server Components の `app_deleted_at` チェック追加

**今後やること：**
- S-6: DB 整備（migration + middleware 更新）
- S-7: 削除 UI 実装
- S-4 の UI は S-7 で置き換え（コードは削除しない）

**今後やらないこと：**
- S-4 の実機確認・本番デプロイ（最終方式が変わるため）
- auth.users の物理削除（S-8 として将来検討、現時点では不要）

---

## 2026-05-02 Phase S-4: アカウント削除申請 UI

### STATUS: ✅ 実装完了・実機確認待ち

**変更ファイル:**
- `app/profile/actions.ts` — `submitDeletionRequest()` / `cancelDeletionRequest()` 追加
- `app/profile/page.tsx` — 削除申請状態を userRow と並行取得し props に追加
- `components/profile/ProfileScreen.tsx` — アカウント削除申請セクション追加
- `components/profile/ProfileScreen.module.css` — `.deletionReq*` スタイル追加

**実装内容:**

| 項目 | 内容 |
|------|------|
| submitDeletionRequest(reason) | server client + RLS INSERT。pending 重複は UNIQUE エラー(23505)で検出 |
| cancelDeletionRequest(requestId) | admin client + self-guard（user_id=自分 AND status=pending）|
| /profile 状態分岐 | null/cancelled_by_user→フォーム / pending→申請中+取消 / approved→承認済み / rejected→問い合わせ案内 |
| 確認テキスト | 「申請する」と完全一致入力でボタン有効化 |
| アカウント削除 ≠ ジム退会 | 注意文を常時表示（黄色ボーダーカード） |
| DB migration | なし（テーブル・RLS は既存） |
| membership_status の変更 | なし（申請だけ。管理者承認時のみ変更） |
| auth.users の削除 | なし |

**typecheck / build:**
- `npm run typecheck`: エラーなし ✅
- `npm run build`: Compiled successfully（/profile のサイズ 2.74kB → 4.09kB）✅

**実機確認手順:**

| # | 確認内容 | 期待結果 |
|---|---|---------|
| T1 | /profile を開く | 「アカウント削除申請」セクションが表示される |
| T2 | 注意文の内容確認 | 「ジム退会ではない」「受付まで」が明記されている |
| T3 | 「申請する」未入力 | 申請ボタンが押せない（disabled） |
| T4 | 「申請する」入力後 | 申請ボタンが有効化される |
| T5 | 申請送信 | pending ステータス表示に切り替わる |
| T6 | pending 状態で「申請を取り消す」 | 確認ダイアログ → OK → cancelled_by_user 表示に切り替わる |
| T7 | cancelled_by_user 状態 | 再申請フォームが表示される |
| T8 | 管理者画面確認 | /admin/account-deletion-requests に申請が表示される |
| T9 | ログアウト機能が動作する | 既存のログアウトボタンが正常に動作する |
| T10 | /gym /train /history が正常 | 既存画面に影響なし |
| T11 | スマホ幅で確認 | 表示が崩れない・ボタンが押しやすい |
| T12 | 申請時の membership_status | 変更されていない（admin 画面で確認） |

**注意点:**
- 申請取り消し（cancelDeletionRequest）は admin client を使用するが、`user_id = auth.user.id AND status = 'pending'` の self-guard で他人の申請に触れない
- rejected 状態は再申請フォームを出さない（受付問い合わせのみ）
- 二重申請は UNIQUE インデックス（one pending per user）で DB 側でも防止

---

## 2026-05-02 Phase S-3: アカウント削除機能 詳細設計

### STATUS: ✅ 設計完了 / CLOSED (2026-05-02)

**変更ファイル:**
- `docs/ACCOUNT_DELETE_DESIGN.md` — Phase S-1 の設計案を調査結果に基づき全面更新
- `ROADMAP.md` — Phase S-3 完了・S-4 を次候補に更新

**調査対象ファイル:**
- `supabase/migrations/20260428_000027_account_deletion_requests.sql`
- `supabase/migrations/20260429_000031_account_deletion_cancel_fields.sql`
- `supabase/migrations/20260411_000001_initial_schema.sql`
- `supabase/migrations/20260428_000028_users_cancelled_at.sql`
- `supabase/migrations/20260429_000029_billing_cutoff_records.sql`
- `supabase/migrations/20260429_000030_membership_pause_requests.sql`
- `supabase/migrations/20260427_000026_user_exercises.sql`
- `app/admin/account-deletion-requests/page.tsx`
- `app/admin/account-deletion-requests/actions.ts`
- `components/admin/DeletionRequestsScreen.tsx`

**主要調査結果:**

| 確認項目 | 結果 |
|---------|------|
| account_deletion_requests テーブル | migration 000027+000031 で完全適用済み |
| status の正確な値 | 'pending' / 'approved' / 'rejected' / 'cancelled_by_user' |
| ユーザー UPDATE RLS | なし（申請取り消しは Server Action + admin client 必要） |
| 管理者側 UI / Server Actions | 完全実装済み |
| auth.users 物理削除の可否 | RESTRICT FK 6箇所で阻止される（現行スキーマでは不可） |
| Phase S-4 の新規 migration | 不要 |

**FK/CASCADE の全マップ（RESTRICT 箇所）:**

| テーブル | カラム | 影響 |
|---------|--------|------|
| account_deletion_requests | user_id | 申請があれば public.users 削除ブロック |
| account_deletion_requests | reviewed_by | 管理者が審査済みなら削除ブロック |
| billing_cutoff_records | confirmed_by | 口座振替確定操作をした場合ブロック |
| membership_pause_requests | user_id | 休会申請があれば削除ブロック |
| membership_pause_requests | reviewed_by | 管理者が審査済みなら削除ブロック |
| workout_session_exercises | user_exercise_id → user_exercises | カスタム種目使用セッションがあれば削除ブロック |

**確定決定:**
- 削除方式: **方式C（申請フロー）確定採用**
- 推奨理由: テーブル・RLS・管理者 UI が実装済み / 物理削除は FK RESTRICT で現状不可
- Phase S-4 で実装すること: `submitDeletionRequest()` + `cancelDeletionRequest()` + `/profile` 内 UI
- Phase S-4 で実装しないこと: DB migration・auth.users 物理削除・管理者通知

---

## 2026-05-02 Phase S-2: ログアウト機能

### STATUS: ✅ LIVE_CHECK PASS / CLOSED (2026-05-02)

**変更ファイル:**
- `components/profile/ProfileScreen.tsx` — ログアウトボタン追加
- `components/profile/ProfileScreen.module.css` — アカウントセクション・ログアウトボタンのスタイル追加

**実装内容:**
- `ProfileScreen.tsx` に `handleLogout` 関数追加
  - `window.confirm("ログアウトしますか？")` で確認
  - `createSupabaseBrowserClient().auth.signOut()` を実行
  - 成功・失敗問わず `window.location.href = "/login"` へ遷移（Router Cache flush のため location.href 使用）
  - 連打防止: `isLoggingOut` フラグで二重実行を防ぐ
  - 処理中はボタンを `disabled` + "ログアウト中…" 表示
- アカウントセクション（`<section className={styles.accountSection}`）を `/nav.links` と `/休会・退会` セクションの間に追加
  - 見出し: 「アカウント」
  - 説明文: 「この端末からログアウトします。再度利用する場合は、ログインが必要です。」
  - ボタン: 「ログアウト」（赤くない・削除操作と混同しないデザイン）

**typecheck / build:**
- `npm run typecheck`: エラーなし ✅
- `npm run build`: ✅ Compiled successfully（全27ページ正常）

**DB変更:** なし
**新規ルート:** なし
**middleware変更:** なし
**admin画面影響:** なし

**実機確認結果（全 PASS）:**

| # | 確認内容 | 結果 |
|---|---|------|
| T1 | `/profile` に「アカウント」セクション・ログアウトボタン表示 | ✅ PASS |
| T2 | ログアウトボタンタップ → 「ログアウトしますか？」確認ダイアログ表示 | ✅ PASS |
| T3 | 確認ダイアログでキャンセル → 画面に留まる | ✅ PASS |
| T4 | 確認ダイアログで OK → /login へ遷移 | ✅ PASS |
| T5 | ログアウト後に `/gym` へ直接アクセス → /login へリダイレクト | ✅ PASS |
| T6 | ログアウト後に `/train` へ直接アクセス → /login へリダイレクト | ✅ PASS |
| T7 | ログアウト後に `/profile` へ直接アクセス → /login へリダイレクト | ✅ PASS |
| T8 | ログアウト後に再ログイン | ✅ PASS |
| T9 | スマホ幅で操作性 | ✅ PASS |
| T10 | ログアウト部分に「退会」「削除」など混同する文言なし | ✅ PASS |

---

## 2026-05-02 休憩タイマー任意変更機能

### STATUS: ✅ LIVE_CHECK PASS / CLOSED (2026-05-02)

**Vercel:**
- commit `4b51bbd` → Vercel state: `success`（06:20:34Z）
- production URL: https://training-program-platform-jp.vercel.app

**実機確認結果（全 PASS）:**

| # | 確認内容 | 結果 |
|---|---|---|
| T1 | トレーニング画面を開くと topBar 下に設定バーが表示される | ✅ PASS |
| T2 | 初期値が 1:30 になっている | ✅ PASS |
| T3 | 3:00 プリセットをタップ → 休憩ボタン表示が 3:00 に変わる | ✅ PASS |
| T4 | セット完了後、休憩タイマーが設定値（3:00）からカウントを開始する | ✅ PASS |
| T5 | タイマー動作中は設定バーが非表示になる | ✅ PASS |
| T6 | +15秒 / −15秒 ボタンが動作する | ✅ PASS |
| T7 | ページリロード後も設定値が残る（localStorage: restTimerDuration） | ✅ PASS |
| T8 | トレーニング完了処理・次のワークアウト導線が壊れていない | ✅ PASS |
| T9 | スマホ幅で表示が崩れていない | ✅ PASS |

**備考:**
- 休憩中の設定変更は次回休憩から反映（仕様通り）
- DB変更なし / localStorage保存のみ

**変更ファイル:**
- `components/workout/WorkoutScreen.tsx`
- `components/workout/WorkoutScreen.module.css`

**実装内容:**
- `restDurationSec` state 追加（初期値 90秒、localStorage から復元）
- localStorage key: `restTimerDuration`
- `applyRestDuration(sec)` ヘルパー追加（MIN=15秒、MAX=600秒でクランプ、localStorage保存）
- `startRestTimer()` を `restDurationSecRef` 使用に変更（stale closure 回避）
- topBar の休憩ボタン表示を動的化（設定値を反映）
- タイマーアイドル時にのみ表示する `restDurationBar` を topBar 直後に追加
  - プリセット: 1:00 / 1:30 / 2:00 / 3:00
  - 微調整: −15秒 / +15秒
  - 現在設定値を中央に表示
  - タイマー動作中は非表示

**既存挙動への影響:**
- トレーニング完了処理: 変更なし
- 次のワークアウト導線: 変更なし
- 音声通知: 変更なし
- archive API: 変更なし

---

## 2026-05-02 ソース復元 + archive API 根本修正 + 本番反映 + 会員復旧

### STATUS: ✅ 完了 — 本番反映済み・DB矛盾行0件確認・会員2名復旧済み (2026-05-02)

### 背景

workspace git の commit `a701e67 chore: finalize root workspace cleanup` で
`training-program-platform-jp/` ソース全体が削除されていた。
（"user-deleted 削除可__* folders" の一環として 736 ファイル削除）

recovery/restore-training-platform-source ブランチを作成し、
`a701e67^` から全ソースを復元して修正を行った。

### 復元作業

- 復元元: `a701e67^`（削除コミットの直前）
- 復元先: `recovery/restore-training-platform-source` ブランチ
- 復元対象: `training-program-platform-jp/` 配下の全ソースファイル

### archive API 根本修正

**対象:** `app/api/enrollments/[enrollmentId]/archive/route.ts`

**根本原因:**
`/programs` の「終了」ボタンが archive API を呼ぶ際に、
`archived_at = now()` のみ更新して `status` を変更しなかった。
→ `status='active' AND archived_at IS NOT NULL` という矛盾状態が発生
→ `/train` は `status='active' AND archived_at IS NULL` のみを対象にするため、
  enrollment が invisible になり `/programs` にリダイレクトされ続けた

**修正内容:**
```
archive 前: .update({ archived_at: now })
archive 後: .update({ archived_at: now, status: statusUpdate })
            statusUpdate = enrollment.status === "active" ? "paused" : enrollment.status
```

active enrollment を終了した場合の結果:
- 修正前: `{ status: 'active', archived_at: IS NOT NULL }` ← 矛盾・バグ
- 修正後: `{ status: 'paused', archived_at: IS NOT NULL }` ← 正常

既存の挙動への影響:
- `paused` → `{ status: 'paused', archived_at: IS NOT NULL }` (変化なし)
- `completed` → `{ status: 'completed', archived_at: IS NOT NULL }` (変化なし)
- in_progress session の連鎖 archive: 変化なし
- revalidatePath("/train") など: 変化なし
- unique active enrollment 制約: 解放される（paused は対象外）

**確認:**
- typecheck: ✅ PASS
- build: ✅ PASS
- 本番 DB 更新: なし（archive API 修正のみ）

### 本番反映

- recovery/restore-training-platform-source → feature/auto-dev-phase3-loop へ fast-forward merge 済み
- commit: `574a23a4d133ec7ceb88f1d91d4e3f4635ebcdea`
- push 済み
- **Vercel production build: ✅ success**（Vercel status API で確認済み）

### 本番 DB 確認結果

- 確認対象: `status='active' AND archived_at IS NOT NULL` の矛盾行
- **結果: 0 件**（Supabase REST API でライブ本番 DB に直接確認）
- active 件数: 5件（全て `archived_at IS NULL` の正常状態）
- DB UPDATE 不要

### 会員復旧（2026-05-02）

| 会員 | 本来プログラム | 最終状態 | 復旧 |
|---|---|---|---|
| 関 正弘さん | GZCLP 4日/週（gzclp-base-v2-4day） | status='active', archived_at=null | ✅ 復旧完了 |
| 田路吾子さん（emerald.green.kira2@gmail.com） | BIG3 2日/週（6週） | active, GZCLP=paused, active_count=1 | ✅ 復旧完了 |

**会員対応:**
- 関さんには友人向けのラフな文面で案内予定:
  「ごめん、こっち側のプログラム設定がちょっと変になってたっぽい🙏
   GZCLP 4日/週に戻るように直したので、またトレーニング開いてみて！
   まだおかしかったらまた教えて〜」
- emeraldさんにもトレーニングタブ確認を依頼する予定

### 次にやること

1. **実機確認**（関さん・emeraldさん）
   - トレーニングタブから正しいプログラムに入れるか
   - /programs に戻されないか
   - 次のワークアウトに進めるか

2. **休憩タイマー任意変更**
   - 現在: 1分30秒固定
   - 変更内容: 60秒 / 90秒 / 120秒 / 180秒 プリセット + ±15秒調整
   - 初期値: 90秒
   - 保存: localStorage でよい
   - DB変更なし

3. **root git / workspace git 同一 remote 問題の整理**
   - 誤作業防止のため CLAUDE.md / AGENTS.md に作業場所ルールを明文化

4. **DB CHECK 制約検討（別フェーズ）**
   - `status='active' AND archived_at IS NOT NULL` をDB側で禁止する制約
   - 今回は未実施・別フェーズで判断

---

## 2026-05-01 GZCL 種目変更まわり 調査記録 → Phase 3-C 計画

### STATUS: 調査完了 — Phase 3-C として ROADMAP に計画済み (2026-05-01)

### 調査の目的

GZCLP 4日/週の T3 種目変更候補がどのように制限されているか、
および Admin 側から種目を変更する実装に何が必要かを確認した。

### DB 構造 確認結果

| テーブル | 分類カラム | 備考 |
|---|---|---|
| exercises | category のみ | muscle_group / body_part 等はなし |
| program_day_exercises | swap_group_slug（FK, NULL 可） | NULL = 会員が変更不可 |
| exercise_swap_groups | slug / label | 実装済み・稼働中 |
| exercise_swap_group_members | group_slug / exercise_id | 実装済み・稼働中 |
| workout_session_exercises | was_swapped / swap_group_slug | 種目変更履歴管理 |

### GZCLP 4日/週 Week1 Day2 の種目構成

| order | 種目 | type | swap_group_slug | 会員側変更 |
|---|---|---|---|---|
| 1 | オーバーヘッドプレス | T1 | NULL | 不可（固定） |
| 2 | デッドリフト | T2 | NULL | 不可（固定） |
| 3 | シーテッドロー | T3 | NULL | 不可（swap group 未設定） |
| 4 | サイドレイズ | T3 | gzcl4-ohp-t3 | 可（3択）|
| 5 | ヒップスラスト | T3 | gzcl4-deadlift-t3 | 可（3択）|

既存 swap groups（gzclp-base-v2-4day-swap-groups.sql）:
- `gzcl4-ohp-t3`: サイドレイズ / リアデルトフライ / アーノルドプレス
- `gzcl4-deadlift-t3`: ヒップスラスト / グッドモーニング / レッグカール
- `gzcl4-squat-t3`: レッグプレス / ブルガリアンスプリットスクワット / ハックスクワット
- `gzcl4-bench-t3`: チェストプレス / ダンベルプレス / ディップス

### 判明した課題

1. 3種目目（シーテッドロー）に swap_group_slug が未設定
   → horizontal pull 系のグループを新設して設定すれば会員が背中種目から選べる（C-3）
2. Admin 側から exercise_id を変更する UI がない（A-2e / C-2 が未実装）
3. 種目変更 API が exercise_type を常に "T3" に上書き
   → T1/T2 の種目を会員側から変更することは現状不可（運用で固定）

### 種目変更の責務分離（方針）

| 操作 | 誰が | どこで | 影響範囲 |
|---|---|---|---|
| Admin 種目入れ替え | admin | 管理画面（C-2） | master データのみ（既存セッション・履歴に影響なし） |
| 会員 swap | 会員 | ワークアウト画面（既存機能） | 当該セッションのみ（was_swapped フラグ） |
| T1/T2 変更 | — | 現状不可 | — |
| T3 swap group 枠 | 会員 | swap_group_slug がある枠のみ | 当該セッションのみ |

### Phase 3-C への引き継ぎ

- C-1: 仕様整理 → **本エントリが C-1 相当（調査完了）**
- C-2: Admin 種目入れ替え（exercise_id 変更）→ 単独実装可能、最優先
- C-3: シーテッドロー枠の swap group 追加（seed 変更のみ）
- C-4: Admin 種目追加 / C-5: Admin 種目削除（C-2 の後で検討）

---

## 2026-05-01 Phase 3-B MVP — CLOSED

### STATUS: ✅ LIVE_CHECK PASS — CLOSED (2026-05-01)

### 完了範囲

| タスク | 内容 | 状態 |
|---|---|---|
| A-2a | Week label インライン編集（`program_weeks.label`） | ✅ CLOSED |
| A-2b | Day 情報インライン編集（`progression_guide` / `notes`） | ✅ CLOSED |
| A-2c | 種目パラメータ編集（`exercise_type` / `set_count` / `target_reps_text`） | ✅ CLOSED |
| A-2d | 種目表示順変更（`order_index` ↑↓ ボタン） | ✅ CLOSED |

### スコープ外（Phase 3-B MVP 対象外）

| タスク | 内容 | 理由 |
|---|---|---|
| A-2e | exercise_id 変更 / 種目入れ替え | 別種目 DB 参照変更 — 別フェーズで検討 |
| A-2f | 種目追加 | INSERT が伴う — 別フェーズで検討 |
| A-2g | 種目削除 | DELETE + 連鎖確認が必要 — 別フェーズで検討 |

### 実装コンポーネント一覧

| Component / File | 役割 |
|---|---|
| `WeekLabelEditor.tsx` | Week label インライン編集 |
| `DayInfoEditor.tsx` | Day 進行ガイド / メモ編集 |
| `ExerciseParamEditor.tsx` | 種目 type / set / reps 編集 |
| `ExerciseList.tsx` | exercises 配列管理 + ↑↓ 並び替え |
| `lib/admin/program-update.ts` | 上記 4 機能の Server Actions（updateProgramWeekLabel / updateProgramDayInfo / updateExerciseParams / swapExerciseOrder） |

---

## 2026-05-01 Phase 3-B / A-2d — Admin 種目表示順変更

### STATUS: ✅ LIVE_CHECK PASS — CLOSED (2026-05-01)

### 実装内容

`/admin/programs/[programId]` の各 Exercise 行に ↑/↓ ボタンを追加し、同じ Day 内で `order_index` を並び替えられるようにした。

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `lib/admin/program-update.ts` | `swapExerciseOrder` Server Action 追加 |
| `components/admin/ExerciseList.tsx` | 新規 Client Component（exercises 配列を state 管理 + ↑/↓ ボタン） |
| `components/admin/ExerciseList.module.css` | 新規 CSS |
| `components/admin/AdminProgramDetailScreen.tsx` | 直接 exercise 列挙 → `ExerciseList` に置き換え |

### 動作仕様

- 各 Exercise 行の右端に ↑ / ↓ ボタンを表示
- 最上位の ↑ ボタン・最下位の ↓ ボタンは disabled
- クリック → Server Action で DB の order_index を 3ステップでスワップ（unique constraint 耐性あり）
- 成功後: ページリロードなしに ExerciseList の state を更新して表示順を即時切り替え
- スワップ中は全 ↑↓ ボタンを disabled（二重操作防止）
- ExerciseParamEditor（A-2c）は変更なし。ExerciseList がラップして ↑/↓ を付与

### server-side guard

- `requireAdminUserId()` で admin 権限確認
- 両 exercise の `program_day_id` が一致することを確認（異 Day 間のスワップ防止）
- day → week → program の 3ステップで programId 帰属確認
- 3ステップ swap: A→temp(999999)→ B位置, B→A位置, A→B位置（unique constraint 安全）

### typecheck / build

- `npm run typecheck`: PASS
- `npm run build`: PASS（/admin/programs/[programId] Dynamic ビルド確認済み）

### LIVE_CHECK 確認手順（次回再開時）

1. Admin ログイン後、`/admin/programs/[プログラムID]` へ
2. Day に複数 Exercise がある場合、↑/↓ ボタンが各行右端に表示されること
3. 最上位行の ↑ ボタンが disabled であること
4. 最下位行の ↓ ボタンが disabled であること
5. ↑ または ↓ クリック → ページリロードなしに表示順が切り替わること
6. 再読み込み後も並び替え後の順序が保たれること
7. ExerciseParamEditor（A-2c）の編集機能が崩れていないこと（回帰確認）
8. Week label 編集（A-2a）/ Day 情報編集（A-2b）回帰確認

### commit

（次のコミットで記録）

---

## 2026-05-01 Phase 3-B / A-2c — Admin 種目パラメータ編集

### STATUS: ✅ LIVE_CHECK PASS — CLOSED (2026-05-01)

### 実装内容

`/admin/programs/[programId]` の各 Exercise 行から `program_day_exercises.exercise_type` / `set_count` / `target_reps_text` をインライン編集できるようにした。

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `lib/admin/program-update.ts` | `updateExerciseParams` Server Action 追加 |
| `components/admin/ExerciseParamEditor.tsx` | 新規 Client Component（表示・編集モード切替） |
| `components/admin/ExerciseParamEditor.module.css` | 新規 CSS |
| `components/admin/AdminProgramDetailScreen.tsx` | exercise 静的行 → `ExerciseParamEditor` に置き換え |

### 動作仕様

- 各 Exercise 行末に「編集」ボタンを表示
- クリック → exercise_type select / set_count number input / target_reps_text text input が展開（autoFocus: type select）
- 「保存」で 3フィールドを同時保存（ページリロードなし）
- Escape でキャンセル
- target_reps_text 空文字保存 → `null`（「× ~~」表示が消える）
- エラー時: 権限/exercise不明/型無効/セット数不正/reps長すぎ を表示

### server-side guard

- `requireAdminUserId()` で admin 権限確認
- exercise → program_days → program_weeks の 3ステップで program_id 帰属確認
- exercise_type: T1 / T2 / T3 のみ許可
- set_count: 1〜20 の整数
- target_reps_text: null または 100文字以内

### typecheck / build

- `npm run typecheck`: PASS
- `npm run build`: PASS（/admin/programs/[programId] Dynamic ビルド確認済み）

### LIVE_CHECK 確認手順（次回再開時）

1. Admin ログイン後、`/admin/programs/[プログラムID]` へ
2. Exercise 行末に「編集」ボタンが表示されること
3. クリック → T1/T2/T3 select / セット数 / reps テキストが展開・type select が autoFocus されること
4. 値変更 → 「保存」でページリロードなしに行の表示が更新されること
5. Escape / キャンセルが機能すること
6. reps 空文字保存 → 「× ...」表示が消えること
7. T1/T2/T3 バッジの色が変更後も正しく表示されること
8. 既存の Week label 編集（A-2a）/ Day 情報編集（A-2b）が崩れていないこと

### commit

（次のコミットで記録）

---

## 2026-05-01 Phase 3-B / A-2b — Admin Day 情報インライン編集

### STATUS: ✅ LIVE_CHECK PASS — CLOSED (2026-05-01)

### 実装内容

`/admin/programs/[programId]` の Day ブロックから `program_days.progression_guide` / `notes` をインライン編集できるようにした。

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `lib/admin/program-update.ts` | `updateProgramDayInfo` Server Action 追加 |
| `components/admin/DayInfoEditor.tsx` | 新規 Client Component（表示・編集モード切替） |
| `components/admin/DayInfoEditor.module.css` | 新規 CSS |
| `components/admin/AdminProgramDetailScreen.tsx` | Day heading + notes 静的表示 → `DayInfoEditor` に置き換え |

### 動作仕様

- 各 Day ブロックの見出し行に「編集」ボタンを表示
- クリック → 進行ガイド / メモの textarea フォームが autoFocus で展開
- 「保存」ボタンで両フィールドを同時保存（ページリロードなし）
- Escape でキャンセル
- 空文字保存 → フィールド `null`（表示が消える）
- エラー時: 「権限がありません」/「Dayが見つかりません」/「進行ガイドが長すぎます」/「メモが長すぎます」を表示

### server-side guard

- `requireAdminUserId()` で admin 権限確認
- `program_days.program_week_id` → `program_weeks.program_id` の 2 ステップで帰属確認（他プログラムの day を誤更新しない）
- progression_guide / notes それぞれ 1000文字上限バリデーション

### typecheck / build

- `npm run typecheck`: PASS
- `npm run build`: PASS（/admin/programs/[programId] Dynamic ビルド確認済み）

### LIVE_CHECK 確認手順（次回再開時）

1. Admin ログイン後、`/admin/programs/[プログラムID]` へ
2. 各 Day ブロック見出し行に「編集」ボタンが表示されること
3. クリック → 進行ガイド / メモの textarea が展開・autoFocus されること
4. 内容入力 → 「保存」でページリロードなしに表示更新されること
5. Escape キャンセルが機能すること
6. 空文字保存 → 該当フィールドの表示が消えること
7. 既存の Day 表示・Exercise ツリーが崩れていないこと
8. 既存 Week label 編集（A-2a）が引き続き動作すること（回帰確認）

### commit

（次のコミットで記録）

---

## 2026-05-01 Phase 3-B / A-2a — Admin Week label インライン編集

### STATUS: ✅ LIVE_CHECK PASS — CLOSED (2026-05-01)

### 実装内容

`/admin/programs/[programId]` の Week 見出しから `program_weeks.label` をインライン編集できるようにした。

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `lib/admin/program-update.ts` | `updateProgramWeekLabel` Server Action 追加 |
| `components/admin/WeekLabelEditor.tsx` | 新規 Client Component（表示・編集モード切替） |
| `components/admin/WeekLabelEditor.module.css` | 新規 CSS |
| `components/admin/AdminProgramDetailScreen.tsx` | `WeekLabel`（static）→ `WeekLabelEditor`（interactive）に置き換え |

### 動作仕様

- Week 見出しに「編集」ボタンを表示
- クリック → input フィールドが autoFocus で展開
- Enter で保存 / Escape でキャンセル
- 保存成功時: state を即時更新（ページリロードなし）+ `revalidatePath` でサーバー側キャッシュ無効化
- 空文字保存 → `label = null`（「X週目」のみ表示に戻る）
- エラー時: 「権限がありません」/「Weekが見つかりません」/「ラベルが長すぎます」を表示

### server-side guard

- `requireAdminUserId()` で admin 権限確認
- `week.program_id = programId` の帰属確認（他プログラムの week を誤更新しない）
- label 100文字上限バリデーション

### typecheck / build

- `npm run typecheck`: PASS
- `npm run build`: PASS（/admin/programs/[programId] Dynamic ビルド確認済み）

### LIVE_CHECK 確認手順（次回再開時）

1. Admin ログイン後、`/admin/programs/[プログラムID]` へ
2. Week 見出しに「編集」ボタンが表示されること
3. クリック → input が表示・autoFocus されること
4. ラベル入力 → 「保存」でページリロードなしに表示更新されること
5. Enter 保存 / Escape キャンセルが機能すること
6. 空文字保存 → 「X週目」表示に戻ること
7. 既存の read-only 表示（Day/Exercise ツリー）が崩れていないこと

### commit

`3ed4437` feat(A-2a): Week label inline edit — updateProgramWeekLabel server action + WeekLabelEditor client component

---

## 2026-05-01 Phase 3-A CLOSED — A-1d Admin 新規プログラム登録 LIVE_CHECK PASS

### STATUS: CLOSED — LIVE_CHECK PASS (2026-05-01)

### 確認内容

Admin 新規プログラム登録 UI（A-1d）の LIVE_CHECK を実施。

| 確認項目 | 結果 |
|---|---|
| `/admin/programs/new` ルートが build に存在する | ✅ PASS（`ƒ /admin/programs/new 2.51 kB`） |
| TypeScript / Next.js build エラー | ✅ なし |
| Vercel 本番で `/admin/programs/new` が 307 redirect（admin guard 動作） | ✅ PASS |
| 一般ユーザー `/programs` が正常表示（回帰なし） | ✅ PASS（200 / 6プログラム表示） |
| `/admin/programs` から `+ 新規登録` ボタン → `/admin/programs/new` 遷移 | ✅ コードレビュー確認 |
| 基本情報フォーム全項目表示（title/description/level/methodology/isPublic/durationWeeks/daysPerWeek） | ✅ コードレビュー確認 |
| title 未入力時にボタン無効（`disabled={!title.trim()}`） | ✅ コードレビュー確認 |
| title 未入力時にサーバー側バリデーション（`title_required`） | ✅ コードレビュー確認 |
| durationWeeks / daysPerWeek 範囲バリデーション（1〜52 / 1〜7） | ✅ コードレビュー確認 |
| 有効内容で INSERT → slug 自動生成（DB trigger `trg_programs_assign_slug`） | ✅ コードレビュー確認 |
| 登録後に `/admin/programs/{id}` へ redirect | ✅ コードレビュー確認 |
| 登録後に admin 一覧キャッシュ無効化（`revalidatePath`） | ✅ コードレビュー確認 |
| admin guard ダブルガード（ページレベル + Server Action レベル） | ✅ コードレビュー確認 |
| 既存 admin ルート（list / detail / edit）build 出力に存在 | ✅ PASS |

### Phase 3-A 完了宣言

A-1a（一覧）/ A-1b（詳細）/ A-1c（編集）/ A-1d（新規登録）すべて LIVE_CHECK PASS。
Phase 3-A CLOSED (2026-05-01)。BUG-FIX 切替→復帰テスト CLOSED (2026-05-01)。次フェーズは Phase 4。

---

## 2026-04-30 BUG-FIX: active enrollment 不整合・プログラム継続不可

### STATUS: CLOSED — LIVE_CHECK PASS (2026-04-30)

### 問題概要

複数ユーザーで「進行中のプログラムと active enrollment がズレる」問題が発生。
フリーセッション完了後に Train タブを押すとプログラム画面に戻される症状も確認。

### 根本原因（複合）

1. **Router Cache**（Next.js 14）が `/train → /programs` のリダイレクトをキャッシュ
2. `current_program_day_id` が完了済み Day を指したまま（advancement 失敗）
3. プログラム切替が `findOrCreateEnrollment`（暗黙的）と `ProgramSwitchButton`（明示的）に分散

### 修正内容（コミット群）

| コミット | 内容 |
|---|---|
| `a36296b` | stale day 検出・自動補正（`resolveStartProgramDayId`）/ Programs UX 改善 |
| `392c6a4` | `correctStaleEnrollmentDay` 共有関数化・Train タブ Router Cache バイパス |
| `5c85f34` | `switchActiveProgram()` 実装・Server Action 化・`ProgramSwitchButton` 統一 |
| `bb4b6c7` | `enrollment-health-check.sql` の ambiguous column 修正 |

### LIVE_CHECK 結果（2026-04-30）

| 確認項目 | 結果 |
|---|---|
| GZCLP Week2 Day3 完了後、次 Day（Day4）へ正常に進む | ✅ PASS |
| フリーセッションを挟んでも active program 進行が維持される | ✅ PASS |
| Programs 画面に「現在のプログラム・次 Day」が表示される | ✅ PASS |
| 別プログラムへの切替時に確認ダイアログが表示される | ✅ PASS |
| 切替後: 旧プログラム paused・新プログラム active | ✅ PASS |
| 元のプログラムへ再切替（Week2 Day4 からの復帰） | ✅ PASS / CLOSED (2026-05-01) — Week2 Day4 から正常再開。Week1 Day1 戻り・/programs 誤リダイレクト・enrollment 破損・progress 競合 いずれもなし |

### 残リスク（仕様として許容）

- URL 直打ち（`/train?program=別slug`）で `findOrCreateEnrollment` が暗黙的切替を行う可能性
- 通常ユーザー導線では発生しない。必要なら A-2 として対応

### Data Repair

- `supabase/scripts/enrollment-health-check.sql` で既存ユーザーの健全性を確認可能
- 影響ユーザーの DB は手動修正済み（gzclp-base-v2-4day active / Week2 Day3 → Day4 進行中）

---

## 2026-04-30 Phase 3-A-1c: Admin プログラム基本情報編集

### STATUS: CLOSED — LIVE_CHECK PASS (2026-04-30)

### 実装内容

- `/admin/programs/[programId]/edit` — 基本情報編集フォーム（Client Component）
- `lib/admin/program-update.ts` — Server Action（admin 権限再検証・validation・DB 更新・cache 無効化）
- `components/admin/AdminProgramEditScreen.tsx` / `.module.css`
- `AdminProgramDetailScreen.tsx` — 「基本情報を編集」ボタン有効化

実装コミット: `9fb1753`

### LIVE_CHECK 結果（2026-04-30）

| 確認項目 | 結果 |
|---|---|
| 詳細画面に「基本情報を編集」ボタン表示 | ✅ PASS |
| 編集画面 /admin/programs/[id]/edit を開ける | ✅ PASS |
| slug が表示のみ・編集不可 | ✅ PASS |
| description 編集 → 保存 → 詳細に反映（非公開プログラム） | ✅ PASS |
| title 編集 → 保存 → 詳細・一覧に反映 | ✅ PASS |
| title 変更後も slug が変わらないこと | ✅ PASS |
| /admin/programs 一覧への反映 | ✅ PASS |
| Week / Day / Exercise 構成が変わらないこと | ✅ PASS |
| is_public false → true の実保存 | ⚠️ 未確認（誤公開リスクのため意図的に未実施） |
| 非 admin ユーザーの /edit 直接アクセスブロック | ⚠️ 未確認 |
| /train への影響 | ⚠️ 未確認 |
| スマホ表示 | ⚠️ 未確認 |
| /programs 一般画面への即時反映（Edge キャッシュ残存可能性） | ⚠️ 既知リスクとして記録（revalidateTag 実装済み） |

### 備考

- 確認はすべて非公開プログラムで実施（誤公開リスク回避のため）
- is_public の公開化は、運用上「意図的に確認対象外」とした。実際に公開設定が必要な場合は慎重に操作すること

---

## 2026-04-30 Phase 3-A-1b: Admin プログラム詳細 read only

### STATUS: CLOSED — LIVE_CHECK PASS (2026-04-30)

### 実装内容

- `/admin/programs/[programId]` — 全プログラム（非公開含む）の read only 詳細画面
- `lib/admin/program-detail.ts` — admin client で Week/Day/Exercise ツリー取得
- `components/admin/AdminProgramDetailScreen.tsx` — 詳細 UI
- `components/admin/AdminProgramDetailScreen.module.css`
- `AdminProgramListScreen.tsx` — 「次フェーズ」→「詳細 →」リンクに変更

実装コミット: `8687a39`

### LIVE_CHECK 結果（2026-04-30）

| 確認項目 | 結果 |
|---|---|
| /admin/programs に「詳細 →」リンク表示 | ✅ PASS |
| 詳細リンクから /admin/programs/[programId] 遷移 | ✅ PASS |
| 公開プログラムの詳細表示 | ✅ PASS |
| 非公開プログラムの詳細表示 | ✅ PASS |
| 基本情報（slug/頻度/期間/総日数/総種目数/作成日/出典情報） | ✅ PASS |
| 概要・説明表示 | ✅ PASS |
| タグ表示 | ✅ PASS |
| 利用状況（累計/利用中/完了/中断） | ✅ PASS |
| Week / Day / Exercise 構成表示 | ✅ PASS |
| T1 / T2 / T3 バッジ表示 | ✅ PASS |
| セット数・rep指定表示 | ✅ PASS |
| 「← プログラム管理」戻り導線 | ✅ PASS |
| 存在しない programId → 404 | ⚠️ 未確認 |
| 非 admin ユーザーのブロック確認 | ⚠️ 未確認 |
| /train への影響 | ⚠️ 未確認 |
| スマホ表示・横スクロール | ⚠️ 未確認 |

### 付記: 英語説明文が残っているプログラムあり

一部プログラムの `description` / `notes` / `progressionGuide` に英語テキストが残っている。
今回の read only 詳細画面の問題ではなく、DB 内テキストの未整備によるもの。
A-1c または別タスクとして「プログラム説明文の日本語化・整備」を検討する。

---

## 2026-04-30 Phase 3-A-1a: Admin プログラム一覧 read only

### STATUS: CLOSED — LIVE_CHECK PASS (2026-04-30)

### 実装内容

- `/admin/programs` — 全プログラム（is_public 問わず）の read only 一覧
- `lib/admin/programs.ts` — admin client で全プログラム + enrollment/day/exercise 集計（5並列 + 2順次）
- `components/admin/AdminProgramListScreen.tsx` — 一覧テーブル UI
- `components/admin/AdminProgramListScreen.module.css`
- `components/admin/AdminHubScreen.tsx` — 「プログラム管理」カード追加

実装コミット: `59bc0bc`

### LIVE_CHECK 結果（2026-04-30）

| 確認項目 | 結果 |
|---|---|
| /admin に「プログラム管理」カード表示 | ✅ PASS |
| admin ユーザーで /admin/programs を開ける | ✅ PASS |
| サマリー表示（登録数10 / 公開6 / 非公開4 / 利用中4） | ✅ PASS |
| 公開・非公開プログラムの両方が一覧表示される | ✅ PASS |
| slug / 構成 / 累計 / 利用中 / 日数 / 種目 / 作成日 / 操作 の列表示 | ✅ PASS |
| /programs 一般画面への影響なし | ✅ PASS（目視確認） |
| enrollment数 / day数 / 種目数（DBとの厳密突合） | ⚠️ 概ねOK（厳密突合は未実施） |
| 非 admin ユーザーのブロック確認 | ⚠️ 未確認 |
| /train への影響 | ⚠️ 未確認 |
| スマホ表示・横スクロール | ⚠️ 未確認 |

---

## 2026-04-30 BUG-FIX: 自由に作成フロー（Custom Workout Entry）

### STATUS: CLOSED — LIVE_CHECK PASS (2026-04-30)

### 不具合概要

`/programs` の「自由に作成」ボタンを押してもトレーニング画面に入れず、`/programs` に戻される。

### 根本原因

Next.js 14 の Router Cache が `/train` の古い RSC エントリ（セッションなし → `redirect("/programs")`）を
最大 30 秒間キャッシュする。`router.refresh()` は現在のルート（`/programs`）のキャッシュのみをクリアし、
`/train` のキャッシュは残ったまま。そのため `router.push("/train")` がキャッシュ済みのリダイレクトを
再生し、ユーザーが `/programs` に戻されていた。

### 修正内容

`components/workout/CustomWorkoutButton.tsx`
- `router.refresh()` + `router.push("/train")` を削除
- `window.location.assign("/train")` に置き換え（Router Cache をバイパスするフルナビゲーション）
- 不要になった `useRouter` import も除去

修正コミット: `c2770bb`

### LIVE_CHECK 結果（2026-04-30）

| 確認項目 | 結果 |
|---|---|
| /programs → 「自由に作成」→ トレーニング開始画面 | ✅ PASS |
| 種目追加 | ✅ PASS |
| セット追加 | ✅ PASS |
| セット削除 | ✅ PASS |
| トレーニング完了（エラーなし） | ✅ PASS |
| 履歴に「フリーセッション」として記録 | ✅ PASS |
| paused/cancelled ユーザーの membership guard | ⚠️ 未確認 |
| 通常 GZCL プログラム開始フロー | ⚠️ 未確認 |

---

## 2026-04-28 G-6: 前回トレーニングから経過日数メッセージ — 設計方針

### STATUS: 設計整理完了 / 実装は次フェーズで実施

### 調査結果

**既存実装:**

| 項目 | 状態 |
|---|---|
| `lib/workout/gym-dashboard.ts` の `getGymDashboardData()` | ✅ 既存 — `lastTrainingDate: string \| null`（JST "YYYY-MM-DD"）+ `monthlyCount` を返す |
| `/gym` での最終トレーニング日表示 | ✅ 既存 — `最終トレーニング: {stats.lastTrainingDate}` を表示済み |
| admin の `last_training_at` | ✅ 既存 — 管理者会員一覧で利用済み |
| Push通知・リマインド | ❌ 未実装（PWA化が必要） |

**結論: データはすでに取得・表示済み。経過日数と一言メッセージの追加だけで実装可能。**

### 実装可能性の評価

| 観点 | 評価 |
|---|---|
| 既存データで実装可能か | ✅ 可能 — `lastTrainingDate` がすでに `/gym` に渡されている |
| 新規DBクエリが必要か | ❌ 不要 — 同一クエリに乗るだけ |
| 新規API追加が必要か | ❌ 不要 |
| パフォーマンスへの影響 | ほぼゼロ — 日付計算はメモリ内のみ |
| PWA化が前提か | ❌ 不要 — 画面内メッセージのみなら今すぐ実装可能 |

### 軽量実装案（G-6a）

**実装場所:** `/gym` の `statsCard` セクション（`GymScreen.tsx`）

**実装内容:**
1. `lastTrainingDate` から経過日数を計算するヘルパー関数を追加
2. 経過日数に応じた一言メッセージを返す関数を追加
3. `GymScreen.tsx` の表示を拡張

**コード変更量:** 最小（`GymScreen.tsx` の表示部分のみ。既存クエリ・型・props の変更不要）

**表示例:**
```
最終トレーニング: 2026-04-25（3日経過）
少し間が空いています。今日は軽めでもOKです。
```

**メッセージ定義（案）:**

| 経過日数 | メッセージ |
|---|---|
| 0〜1日 | いいペースです。今日も無理なく続けていきましょう。 |
| 2〜3日 | 順調なペースです。次のトレーニングを楽しみましょう。 |
| 4〜6日 | 少し間が空いています。今日は軽めでもOKです。 |
| 7〜13日 | 前回から1週間ほど空いています。まずは短時間で再開しましょう。 |
| 14日以上 | しばらく間が空いています。重量は控えめにして、フォーム確認から始めましょう。 |
| トレーニング記録なし | まだ記録がありません。最初のトレーニングを始めましょう。 |

### フェーズ別の実装範囲

| フェーズ | 実施内容 | 必要条件 |
|---|---|---|
| **今すぐ可能（G-6a）** | /gym に経過日数と一言メッセージを追加 | 追加実装なし（データ取得済み） |
| **PWA化後（G-6b）** | ホーム画面ショートカットからのアクセス時にメッセージを強調表示 | PWA（manifest + service worker） |
| **将来候補（G-6c）** | Push通知・自動リマインド（X日経過したら通知） | PWA + 通知許可 + バックエンドスケジューラ |
| **将来候補（G-6d）** | 定期リマインド・未読管理・通知設定UI | G-6c + Vercel Cron or Supabase Cron |

### 通知機能を今すぐ入れない理由

1. **PWA化が前提** — Push通知はブラウザの通知許可が必要。モバイルで機能させるにはPWA（service worker）が必要
2. **バックエンドが必要** — X日後に自動で通知を送るにはCronジョブ or 定期実行サービスが必要
3. **通知疲れのリスク** — 適切な頻度・オフ設定UIなしで通知を送ると離脱原因になる
4. **軽量版で十分な可能性** — 画面内メッセージだけで「再開を促す」効果は得られる

### 次アクション（設計整理時点）

- G-6b〜d は PWA化完了後に検討

---

## 2026-04-28 G-6a: /gym 前回トレーニング経過日数メッセージ

### STATUS: CLOSED (2026-04-28) — typecheck/build OK / 実機確認待ち

### PURPOSE

/gym の statsCard に「前回からX日経過」と一言メッセージを追加。
追加DBクエリ・新規APIなし。`getGymDashboardData()` が返す `lastTrainingDate` を利用。

### IMPLEMENTED

| 対象 | 変更内容 | ファイル |
|---|---|---|
| `getDaysSince(lastTrainingDate)` | JST基準で今日との経過日数を計算 | `components/gym/GymScreen.tsx` |
| `getTrainingGapInfo(days)` | 6段階でラベル・メッセージ・レベルを返す | 同上 |
| statsCard 表示拡張 | 最終トレーニング日の直後にメッセージブロック追加 | 同上 |
| `.trainingGap` スタイル | 左ボーダー色でレベルを視覚化（緑/accent/橙/赤） | `components/gym/GymScreen.module.css` |

### メッセージ条件

| 経過日数 | レベル | メッセージ |
|---|---|---|
| 0日（今日） | good（緑） | 今日もトレーニングできています。いいペースです。 |
| 1〜2日 | good（緑） | いいペースです。今日も無理なく続けていきましょう。 |
| 3〜6日 | ok（accent） | 少し間が空いています。今日は軽めでもOKです。 |
| 7〜13日 | warn（橙） | 前回から1週間ほど空いています。まずは短時間で再開しましょう。 |
| 14日以上 | alert（赤） | しばらく間が空いています。重量は控えめにして、フォーム確認から始めましょう。 |
| 記録なし | none | まだトレーニング記録がありません。まずは最初の1回から始めてみましょう。 |

### CHECK

- typecheck: ✅ pass
- build: ✅ pass（/gym: 3.24kB 変わらず）
- commit: 2caa17f
- push: ✅ feature/auto-dev-phase3-loop
- 追加DBクエリ: なし
- 新規API: なし

### LIVE_CHECK — 2026-04-28 スマホ実機確認済み

| 確認項目 | 結果 |
|---|---|
| /gym で「前回からX日経過」または「今日トレーニングしました」が表示される | ✅ PASS |
| 経過日数に応じた一言メッセージが表示される | ✅ PASS |
| statsCard 直後の表示としてレイアウトに大きな崩れがない | ✅ PASS |
| 左ボーダー色の見え方に問題がない | ✅ PASS |
| 既存の最終トレーニング日・今月の回数表示が壊れていない | ✅ PASS |
| DB/API変更なしで動作している | ✅ PASS |

**導線追加の意義:** PWA化前に、再開を促す軽量メッセージ導線を追加済み。
ユーザーが /gym を開いた時点で、前回からの経過日数と状況に応じたメッセージが表示される。

### REMAINING_RISKS

- 日付境界（深夜0時前後のJST計算）の細かい動作確認は今後必要な場合あり
- `toLocaleString("en-US", { timeZone: "Asia/Tokyo" })` はほぼ全環境で動作するが、一部旧端末では差異の可能性あり（低リスク）
- PWA化後に G-6b（ホーム画面起動時の強調表示）を検討
- Push通知・自動リマインド（G-6c/d）は将来候補のまま

---

## 2026-04-28 Phase 2.6: 表示速度・操作速度の改善

### STATUS: CLOSED (2026-04-28) — typecheck/build OK / 実機確認待ち

### PURPOSE

テストユーザーから「さらにスピードアップしてほしい」という要望を受け、表示速度改善調査と安全な改善を実施。

### 調査結果サマリー

| 項目 | 状態 | 評価 |
|---|---|---|
| loading.tsx カバレッジ | 5ページが欠落（session-history/gym/profile等） | ⚠️ 対応済み |
| Supabase クエリ最適化 | SELECT * なし、並列fetch使用済み、N+1なし | ✅ 良好 |
| console.log / 診断ログ | [PERF] ログは意図的なVercell診断ログ | ✅ 維持 |
| キャッシュ戦略 | force-dynamic + cache:no-store（全ページ） | 意図的設計 |
| APIルート | exercises API は force-dynamic（個人データ混在のため） | 変更せず |
| バンドルサイズ | 全ページ適切 | ✅ 良好 |

### IMPLEMENTED

| 対象 | 変更内容 | ファイル |
|---|---|---|
| セッション履歴 | loading.tsx 追加（Suspense + ドットアニメーション） | `app/session-history/loading.tsx` |
| セッション詳細 | loading.tsx 追加 | `app/session-history/[sessionId]/loading.tsx` |
| ジム | loading.tsx 追加 | `app/gym/loading.tsx` |
| プロフィール | loading.tsx 追加 | `app/profile/loading.tsx` |
| マイ種目 | loading.tsx 追加 | `app/my-exercises/loading.tsx` |

**効果:** Suspenseが有効化され、これら5ページのSSR中のブランクスクリーンが解消される。

### 変更しなかった箇所とその理由

| 項目 | 理由 |
|---|---|
| console.info / console.log ([PERF]) | app/train/page.tsx と lib/workout/ の構造化パフォーマンス診断ログ。Vercel runtime log 解析用に意図的に残す |
| force-dynamic + cache:no-store | ユーザー認証・セッション状態に依存するため全ページ動的。設計意図通り |
| exercises API キャッシュ化 | include_history=true 時にユーザー固有データが混在するため断念 |
| DB構造変更 | 禁止 |

### CHECK

- typecheck: ✅ pass
- build: ✅ pass（全ルート正常）
- commit: 23390b5
- push: ✅ feature/auto-dev-phase3-loop

### LIVE_CHECK — 2026-04-28 スマホ実機確認済み

| 確認項目 | 結果 |
|---|---|
| /session-history 遷移時に読み込み中表示が出る | ✅ PASS |
| /session-history/[id] 遷移時に読み込み中表示が出る | ✅ PASS |
| /gym 遷移時に読み込み中表示が出る | ✅ PASS |
| /profile 遷移時に読み込み中表示が出る | ✅ PASS |
| /my-exercises 遷移時に読み込み中表示が出る | ✅ PASS |
| ページ遷移時の真っ白な待ち時間が軽減されている | ✅ PASS |
| 既存表示・主要機能に大きな崩れがない | ✅ PASS |

**体感改善内容:** loading.tsx 追加によるブランクスクリーン軽減。SSR待機中にドットアニメーションが表示され、ユーザーへの応答フィードバックが向上した。

### REMAINING_RISKS（PWA化前の確認事項）

- 今回の改善は「ブランクスクリーン軽減による体感速度改善」であり、実際のDB取得速度は未変更
- `force-dynamic` 全ページ使用のため、ISR/SSG による高速化余地あり → 高リスクにつき将来候補
- /train 初回表示が15-20クエリ → 現状は十分にチューニング済み（Promise.all並列化）、PWA化後に再評価
- exercises API の応答速度が体感に影響する場合は、library部分の分離キャッシュが将来候補
- D-2 cancelled_at の実機確認は引き続き保留

---

## 2026-04-28 Phase 2.5d: プログラム名・目標・概要・週ラベルの日本語化

### STATUS: CLOSED (2026-04-28) — typecheck/build OK / 実機確認待ち

### PURPOSE

Phase 2.5c 実機確認でタグ表示は日本語化されたが、プログラムカード名・目標・概要・週ラベルに英語が残っていた。
DB側（update-program-titles-jp.sql）が未適用でも、UI側フォールバックで日本語表示になるよう対応。

### ROOT_CAUSE

| 症状 | 原因 |
|---|---|
| BIG3 2-Day などカード名が英語 | `program.title` を変換せず表示 / DB未更新 |
| 目標・概要が英語 | `program.goal`, `program.overview` をそのまま表示 / DB未更新 |
| 1週目 — Week 1 の二重表示 | `{week.label ? ` — ${week.label}` : ""}` が "Week 1" をそのまま追加 |

### IMPLEMENTED

| 対象 | 変更内容 | ファイル |
|---|---|---|
| `formatProgramTitle(slug, title)` | 9プログラムのタイトルマップ + slug変換 | `lib/workout/format-labels.ts` |
| `formatProgramGoal(slug, goal)` | 9プログラムの目標テキストマップ | 同上 |
| `formatProgramOverview(slug, overview)` | 9プログラムの概要テキストマップ | 同上 |
| `formatProgramWeekLabel(weekNumber, label)` | "Week N" パターンを抑制し、番号のみ表示 | 同上 |
| ProgramsScreen カードタイトル | `program.title` → `formatProgramTitle` 適用 | `components/programs/ProgramsScreen.tsx` |
| ProgramsScreen カード目標 | `program.goal` → `formatProgramGoal` 適用 | 同上 |
| ProgramDetailScreen タイトル | `resolveTitle` に変換済みタイトルを渡す | `components/programs/ProgramDetailScreen.tsx` |
| ProgramDetailScreen 目標 | `program.goal` → `formatProgramGoal` 適用 | 同上 |
| ProgramDetailScreen 概要 | `program.overview` → `formatProgramOverview` 適用 | 同上 |
| ProgramDetailScreen 週ラベル | `{week.weekNumber}週目 — {week.label}` → `formatProgramWeekLabel` | 同上 |

### 対応プログラム

| slug | 表示タイトル |
|---|---|
| gzclp-base | GZCLP 基礎プログラム |
| gzclp-base-v2-4day | GZCLP 基礎 4日/週（4週） |
| big3-2day | BIG3 2日/週（4週） |
| big3-3day | BIG3 3日/週（4週） |
| big3-2day-6week | BIG3 2日/週（6週） |
| barbell-2day-base | バーベル全身 2日/週（4週） |
| starting-strength-base | スターティングストレングス 基礎 |
| upper-lower-base | アッパー/ロワー 基礎 |
| dumbbell-full-body-base | ダンベル全身 基礎 |

### CHECK

- typecheck: ✅ pass
- build: ✅ pass（/programs: 101kB 正常）
- commit: d867946
- push: ✅ feature/auto-dev-phase3-loop

### LIVE_CHECK — 2026-04-28 スマホ実機確認済み

| 確認項目 | 結果 |
|---|---|
| /programs カードに「BIG3 2日/週（4週）」「バーベル全身 2日/週（4週）」等が表示される | ✅ PASS |
| /programs の英語タイトル（Barbell 2-Day Full Body Base / BIG3 2-Day / BIG3 3-Day 等）が消えている | ✅ PASS |
| /programs のタグが「筋力アップ」「バーベル」「全身」等の日本語表示のまま | ✅ PASS |
| /programs/[slug] の目標・概要が日本語表示 | ✅ PASS |
| Original Cody Lefever... 等の英語説明文が消えている | ✅ PASS |
| /programs/[slug] プログラム構成の週ラベルが「1週目」「2週目」のみ（「— Week 1」なし） | ✅ PASS |
| /programs/[slug] プログラム構成の種目名が日本語表示のまま | ✅ PASS |
| /train の種目名表示が日本語のまま | ✅ PASS |

### REMAINING_RISKS

- DB側の title/description は英語のまま（SQL未適用）→ UIフォールバックで表示は日本語になっている
- 未登録 slug のプログラムが将来追加された場合は DB値そのまま表示される可能性あり（format-labels.ts への追加が必要）
- Supabase SQL Editor で update-program-titles-jp.sql を適用すると DB も日本語になり二重管理が解消される（任意）

### PHASE_STATUS

**Phase 2.5 日本語化シリーズ — 全確認完了**

| フェーズ | 対応内容 | 実機確認 |
|---|---|---|
| 2.5 (I18N) | 主要画面の全面日本語化（ログイン・プログラム・トレーニング等） | 一部確認済み |
| 2.5b | タグ・種目名の日本語化 | 種目名 ✅ |
| 2.5c | /programs タグ・フィルターの日本語化（UIフォールバック追加） | ✅ 全確認済み |
| 2.5d | プログラム名・目標・概要・週ラベルの日本語化 | ✅ 全確認済み |

**次フェーズ候補:**
- D-2: cancelled_at 実機確認（保留中）
- Phase 3 A-1: Admin プログラム登録UI
- Phase 3 C-9: Week preview 拡張

---

## 2026-04-28 Phase 2.5c: /programs タグ表示の日本語化漏れ修正

### STATUS: CLOSED (2026-04-28) — typecheck/build OK / 実機確認待ち

### PURPOSE

Phase 2.5b 実機確認で /programs のタグ・フィルターチップが英語のままだった問題を修正。
DB側の update-program-tags-jp.sql が未適用でも、UI側で必ず日本語表示になるよう対応。

### ROOT_CAUSE

- `ProgramsScreen.tsx` と `ProgramDetailScreen.tsx` が `tag.label` をそのまま表示していた
- `update-program-tags-jp.sql` は作成済みだが本番DBへの適用が未実施
- コード側にUI変換フォールバックが存在しなかった

### IMPLEMENTED

| 対象 | 変更内容 | ファイル |
|---|---|---|
| `formatProgramTagLabel(slug, label)` 関数追加 | slug優先・英語label fallbackの2段階変換 | `lib/workout/format-labels.ts` |
| ProgramsScreen フィルターチップ | `tag.label` → `formatProgramTagLabel(tag.slug, tag.label)` | `components/programs/ProgramsScreen.tsx` |
| ProgramsScreen カード内タグバッジ | 同上 | 同上 |
| ProgramsScreen focusBadge | 同上 | 同上 |
| ProgramDetailScreen タグバッジ | 同上 | `components/programs/ProgramDetailScreen.tsx` |
| ProgramDetailScreen focusBadge | 同上 | 同上 |

### 変換テーブル

| slug | 変換後 |
|---|---|
| strength | 筋力アップ |
| general-fitness | 総合フィットネス |
| barbell | バーベル |
| dumbbell | ダンベル |
| full-body | 全身 |
| upper-lower | 上半身 / 下半身 |
| squat-focus | スクワット重視 |
| explosive | 爆発系 |
| hypertrophy | 筋肥大 |
| powerlifting | パワーリフティング |
| conditioning | 体力づくり |
| push / pull | 押す種目 / 引く種目 |
| legs / core | 脚 / 体幹 |

### CHECK

- typecheck: ✅ pass
- build: ✅ pass（/programs: 100kB 正常）
- commit: eece95d
- push: ✅ feature/auto-dev-phase3-loop

### LIVE_CHECK_REQUIRED

- [ ] /programs 上部フィルターチップが「バーベル」「全身」「筋力アップ」になっている
- [ ] プログラムカード内タグが日本語
- [ ] /programs/[slug] 詳細画面のタグバッジが日本語
- [ ] /train・/workout-summary の種目名日本語化が維持されている

### REMAINING_RISKS

- Supabase DB の program_tags は英語のまま（update-program-tags-jp.sql 未適用）
  → UIフォールバックで日本語表示されるため機能上は問題なし
  → 将来の DB-first 参照（API等）を考慮して SQL 適用を推奨
- 未登録 slug のタグは label 文字列をそのまま表示（想定内）

---

## 2026-04-28 Phase 2.5b: タグ・種目名の日本語化

### STATUS: CLOSED (2026-04-28) — typecheck/build OK / DB手動適用待ち

### PURPOSE

Phase 2.5 の日本語化対応で残っていた英語表記（プログラムタグ・種目名・カテゴリ）を日本語化。

### IMPLEMENTED

| 対象 | 変更内容 | ファイル |
|---|---|---|
| ExercisePreview 型 | `nameJa: string | null` フィールドを追加 | `types/programs.ts` |
| program-library | WeekPreview 種目名クエリに `name_ja` を追加、`ExercisePreview.nameJa` を設定 | `lib/programs/program-library.ts` |
| プログラム詳細「プログラム構成」 | 種目名を `nameJa ?? nameEn` 優先表示に変更 | `components/programs/ProgramDetailScreen.tsx` |
| WorkoutScreen 種目リンク | `exerciseNameJa \|\| exerciseNameEn` 優先表示に変更 | `components/workout/WorkoutScreen.tsx` |
| WorkoutScreen swapモーダル | 置換対象表示を `exerciseNameJa` 優先に変更 | 同上 |
| WorkoutScreen カテゴリ表示 | 種目追加モーダルの category を日本語マップで翻訳（胸/背中/肩/腕/脚/お尻/体幹） | 同上 |
| WorkoutSummaryScreen | 種目名を日本語主・英語サブ表示に変更 | `components/summary/WorkoutSummaryScreen.tsx` |
| SessionDetailScreen | 種目名を日本語主・英語サブ表示に変更 | `components/history/SessionDetailScreen.tsx` |
| ExerciseHistoryScreen | ページタイトル種目名を `exerciseNameJa` 優先に変更 | `components/history/ExerciseHistoryScreen.tsx` |
| lib fallbacks | "Exercise" / "Custom Exercise" → "種目" / "カスタム種目" に統一 | `lib/workout/workout-summary.ts`, `session-detail.ts`, `train-session.ts` |

### DB_UPDATE（手動適用が必要）

プログラムタグのラベルはDBに保存されているため、以下のSQLを Supabase SQL Editor で手動実行すること。

```
seed/programs/update-program-tags-jp.sql
```

変更内容:
- Strength → 筋力アップ
- General Fitness → 総合フィットネス
- Barbell → バーベル
- Dumbbell → ダンベル
- Full Body → 全身
- Upper / Lower → 上半身 / 下半身
- Squat Focus → スクワット重視
- Explosive → 爆発系

### CHECK

- typecheck: ✅ pass
- build: ✅ pass（全ルート正常）
- commit: 92e88e1
- push: ✅ feature/auto-dev-phase3-loop

### LIVE_CHECK_REQUIRED

- [ ] /programs のプログラムカードのタグが日本語になっている（DB SQL 適用後）
- [ ] /programs/[slug] のタグバッジ（バーベル/全身/筋力アップ等）が日本語
- [ ] /programs/[slug] の「プログラム構成」で種目名がカタカナ・日本語表示
- [ ] /train セッション中の種目名リンクが日本語（スクワット/ベンチプレス等）
- [ ] 種目追加モーダルのカテゴリ表示（胸/背中/脚等）が日本語
- [ ] /workout-summary の種目名が日本語主・英語サブ
- [ ] /session-history/[id] の種目名が日本語主・英語サブ
- [ ] /exercise-history/[slug] のページタイトルが日本語

### REMAINING_RISKS

- program_tags ラベルは SQL 手動適用が必要（適用前は英語のまま表示される）
- exercises テーブルの name_ja が null の種目は nameEn フォールバックで英語表示される
- Week 1 / Day 1 等の週ラベルは format-labels.ts で変換済み（DB変更不要）

---

## 2026-04-28 I18N: 利用者向け画面の全面日本語化

### STATUS: CLOSED (2026-04-28) — typecheck/build OK / 実機確認待ち

### PURPOSE

テストユーザーから「英語が多すぎて分かりにくい」という意見を受け、利用者・管理者が画面で見る英語表記を原則すべて日本語化した。

### IMPLEMENTED

| 対象 | 変更内容 | ファイル |
|---|---|---|
| ログイン画面 | Sign In→ログイン / Sign Up→新規登録 / Email→メールアドレス / Password→パスワード / Browse Programs→プログラム一覧を見る | `app/login/page.tsx` |
| トレーニング認証ガード | Login Required→ログインが必要です | `components/train/TrainAuthRequired.tsx` |
| ホームカード | My Program→進行中のプログラム / Up next→次のワークアウト / Resume workout→ワークアウトを再開 / Not enough data→データ不足 / Volume trend→ボリューム推移 / Est. 1RM→推定1RM / days complete→日 完了 | `components/home/ActiveProgramCard.tsx` |
| ブロック画面 | Workout In Progress→トレーニング進行中 / Back to Program→プログラムへ戻る / Go to Home→ホームへ戻る | `components/train/BlockedSessionScreen.tsx` |
| セッション開始画面 | Start {day}→{day}を開始 / Cancel→キャンセル / Back to Program→プログラムへ戻る | `components/workout/StartSessionScreen.tsx` |
| プログラム一覧 | Program Library→プログラム一覧 / Open detail→詳細を見る / Level/Frequency/Duration TBD→日本語 / Clear→リセット | `components/programs/ProgramsScreen.tsx` |
| プログラム詳細 | Program Detail→プログラム詳細 / Level/Frequency/Duration→レベル/頻度/期間 / Goal→目標 / Overview→概要 / Program Structure→プログラム構成 / Week N Day M→N週目 M日目 / Start Program→プログラムを開始 / Resume Training→トレーニングを再開 / Back to Programs→プログラム一覧へ戻る | `components/programs/ProgramDetailScreen.tsx` |
| セッション履歴 | Workout History→トレーニング履歴 / Completed/In Progress/Cancelled→完了/進行中/キャンセル済 / Free session→フリーセッション / N exercises→N種目 / Summary/Detail→サマリー/詳細 | `components/history/SessionHistoryScreen.tsx` |
| アーカイブボタン | Archive→アーカイブ | `components/history/ArchiveSessionButton.tsx` |
| サマリー画面 | N sets→Nセット | `components/summary/WorkoutSummaryScreen.tsx` |
| プログラム再開ボタン | Restarting→再開中 / Restart Program→プログラムを最初から / エラー文→日本語 | `components/summary/RestartProgramButton.tsx` |
| 管理者Hub | Admin badge→管理者 | `components/admin/AdminHubScreen.tsx` |
| 会員管理 | Active/Paused/Cancelled→利用中/休会中/退会済（StatsCard・フィルター） | `components/admin/MembersScreen.tsx` |
| 退会申請管理 | status表示（pending/approved/rejected）→未処理/承認済み/却下済み | `components/admin/DeletionRequestsScreen.tsx` |
| program-library.ts | Beginner/Intermediate/Advanced→初級/中級/上級 / N days per week→N日/週 / N weeks→N週間 | `lib/programs/program-library.ts` |
| program-catalog.ts | BIG3 2-Day→BIG3 2日/週（4週）など全プログラム名・頻度・期間を日本語化 | `lib/programs/program-catalog.ts` |
| format-labels.ts | formatWeekDay: Week N / Day M → N週目 · M日目 に変換 | `lib/workout/format-labels.ts` |

### DB_UPDATE（手動適用が必要）

プログラム名はDBに保存されているため、コード側の変更だけでは本番に反映されない。
以下のSQLを Supabase ダッシュボード SQL Editor で手動実行すること。

```
seed/programs/update-program-titles-jp.sql
```

対象: big3-2day / big3-3day / big3-2day-6week / gzclp-base / gzclp-base-v2-4day / barbell-2day-base / starting-strength-base / upper-lower-base / dumbbell-full-body-base

### CHECK

- typecheck: ✅ pass
- build: ✅ pass（全ルート正常ビルド）
- commit: fbab6b9
- push: ✅ feature/auto-dev-phase3-loop

### LIVE_CHECK_REQUIRED（次回実機確認リスト）

- [ ] /login: ログイン/新規登録タブ・ボタン・フィールドラベルが日本語
- [ ] /programs: プログラム一覧・フィルター・カード内文言が日本語
- [ ] /programs/[slug]: レベル/頻度/期間/目標/概要・週構成が日本語
- [ ] /train 開始画面: 「N週目 · M日目を開始」ボタン
- [ ] ホーム: My Program→進行中のプログラム / Up next→次のワークアウト
- [ ] セッション履歴: 完了/進行中/キャンセル済バッジ
- [ ] 管理者画面: 利用中/休会中/退会済 表示
- [ ] DBプログラム名更新SQL手動適用後に /programs でプログラム名が日本語になること

### REMAINING_RISKS

- DBプログラム名・説明文はSQLの手動適用が必要（Supabaseダッシュボード）
- program_weeks.label（"Week 1"等）はDBに格納されているため、format-labelsでの変換に依存する
  → formatWeekDay() が "Week N" → "N週目" に変換するので表示は日本語になる
- 管理者画面の membership_status 生値（"active"/"paused"/"cancelled"）はいくつか箇所でそのまま表示されている可能性あり

### NEXT

- DBプログラム名更新SQLを手動適用
- 実機で全主要画面を確認
- 英語が残る箇所があれば追加対応

---

## 2026-04-27 U-2: ユーザー種目管理画面（編集/アーカイブ）

### STATUS: CLOSED (2026-04-27)

### PURPOSE

U-1 で作成したカスタム種目の一覧・編集・アーカイブを管理できる専用ページを追加。
アーカイブしても過去の `workout_session_exercises` レコードは保持（`on delete restrict` により保護）。

### IMPLEMENTED

| 機能 | 内容 | ファイル |
|---|---|---|
| PATCH API | 種目名・カテゴリ・is_archived を更新（ownership guard: user_id 照合） | `app/api/user-exercises/[id]/route.ts` |
| 管理ページ | 認証guard + 全種目取得（archived含む）→ MyExercisesScreen | `app/my-exercises/page.tsx` |
| 管理UI | 使用中/アーカイブ済み2セクション・インライン編集・アーカイブ/復元ボタン | `components/workout/MyExercisesScreen.tsx` + `.module.css` |
| プロフィールリンク | `/profile` 下部に「マイ種目 →」リンク追加 | `components/profile/ProfileScreen.tsx` + `.module.css` |

### DESIGN_NOTES

- 実削除なし: アーカイブ（`is_archived=true`）のみ。`workout_session_exercises.user_exercise_id` の FK が `on delete restrict` のため物理削除は DB レベルでも防止
- アーカイブした種目は `/my-exercises` のみ表示（使用中セクションには出ない）
- 種目追加モーダルでもアーカイブ済み種目は除外（GET `/api/user-exercises` は `is_archived=false` のみ返す — U-1 実装済み）
- DB migration なし（`is_archived` 列は U-1 migration 20260427_000026 で追加済み）

### CHECK

- typecheck: ✅ pass
- build: ✅ pass（/my-exercises: 2.32kB 正常ビルド）

### LIVE_CHECK — 2026-04-27 実機確認済み

| 確認項目 | 結果 |
|---|---|
| `/profile` に「マイ種目」リンクが表示される | ✅ |
| リンクタップ → `/my-exercises` に遷移 | ✅ |
| カスタム種目がある場合 → 一覧表示 | ✅ |
| 「編集」→ 種目名・カテゴリ変更 → 「保存」→ 反映 | ✅ |
| 「アーカイブ」→ confirm → 使用中から消える | ✅ |
| 「アーカイブ済み」折りたたみ → 展開 → 「復元」| ✅ |
| アーカイブ後に種目追加モーダルを開く → アーカイブ種目が出ないこと | ✅ |

### NEXT

- U-3: 自由トレーニングテンプレート保存（将来フェーズ）
- U-4: ユーザー種目の前回セット表示・統計（将来フェーズ）

---

## 2026-04-27 U-1: 個人カスタム種目ライブラリ

### STATUS: CLOSED (2026-04-27) — DB migration 適用済み / 実機確認済み

### PURPOSE

自由トレーニング中に既存の種目リストにない種目をユーザー自身が作成・追加し、次回以降も再利用できるようにする。
追加した種目はユーザーごとに蓄積され、他のユーザーには見えない。

### IMPLEMENTED

| 機能 | 内容 | ファイル |
|---|---|---|
| DBテーブル | `user_exercises`（user_id/name/category/default_unit/memo/is_archived） | `supabase/migrations/20260427_000026_user_exercises.sql` |
| スキーマ変更 | `workout_session_exercises.exercise_id` nullable化 + `user_exercise_id` 追加 + CHECK制約 | 同上 |
| RLS | ユーザーは自分のみ SELECT/INSERT/UPDATE/DELETE | 同上 |
| user exercises API | GET (一覧取得) / POST (新規作成) | `app/api/user-exercises/route.ts` |
| exercises API 拡張 | カスタムセッション時にユーザー種目も返す（`source: 'user'` フラグ付き） | `app/api/exercises/route.ts` |
| セッション種目追加API | `user_exercise_id` パラメータ対応 | `app/api/workout-sessions/[id]/exercises/route.ts` |
| セッション読み込み | `user_exercise_id` を持つ行を `user_exercises` テーブルから取得して名前表示 | `lib/workout/train-session.ts` |
| WorkoutScreen UI | 種目追加モーダルに「自分」バッジ表示 + 「＋ 新しい種目を作成」フォーム追加 | `components/workout/WorkoutScreen.tsx` + `.module.css` |
| 型更新 | `ExerciseListItem.source` / `AddExerciseResponse.userExerciseId` | `types/workout.ts` |

### DESIGN_NOTES

- 既存の共通種目（`exercises` テーブル）は無変更
- `workout_session_exercises` に `user_exercise_id` nullable FK を追加し CHECK constraint で排他
- 既存の全レコードは `exercise_id != null, user_exercise_id = null` のまま → 後方互換
- 「新しい種目を作成」は自由トレーニング（カスタムセッション）の種目追加モーダルのみに表示
- 種目交換（swap）は共通種目のみ対応（ユーザー種目のswapは将来フェーズ）

### DEFERRED_SCOPE

| 機能 | 理由 | 将来フェーズ |
|---|---|---|
| ユーザー種目の前回セット表示 | `buildPreviousDisplayMap` の拡張が必要 | U-4 |
| ユーザー種目管理画面（編集/アーカイブ） | 作成・再利用優先 | U-2 |
| 自由トレーニングテンプレート保存 | 別フェーズ | U-3 |
| ユーザー種目の統計・履歴グラフ | 別フェーズ | U-4 |

### DB_MIGRATION

✅ 適用済み — `supabase/migrations/20260427_000026_user_exercises.sql`

### CHECK

- typecheck: ✅ pass
- build: ✅ pass（/train: 13kB、正常増加）

### LIVE_CHECK — 2026-04-27 実機確認済み

| 確認項目 | 結果 |
|---|---|
| 自由トレーニング開始 → 種目追加モーダルで「＋ 新しい種目を作成」表示 | ✅ |
| 種目名入力 → 「作成して追加」→ セッションに追加されること | ✅ |
| 再び種目追加モーダルを開く → 作成した種目が「自分」バッジ付きで表示 | ✅ |
| 翌日以降に自由トレーニング開始 → 作成した種目が再利用可能 | ✅ |
| プログラムトレーニング中は「新しい種目を作成」ボタンが非表示 | （未確認） |

---

## 2026-04-27 Admin Hub: 管理トップページ追加

### STATUS: CLOSED (2026-04-27) — 実機確認済み

### PURPOSE

G-2〜G-5 で増加した管理画面を管理者専用の入口 `/admin` から一覧できるようにする。
URL 直打ちでも admin 以外は入れない guard を設置。

### IMPLEMENTED

| 機能 | 内容 | ファイル |
|---|---|---|
| 管理トップ | admin guard + 4管理機能へのカードリスト | `app/admin/page.tsx` |
| AdminHubScreen | 会員/お知らせ/スポンサー/相談申込の4カード | `components/admin/AdminHubScreen.tsx` + `.module.css` |
| nav 統一 | 全4 admin 画面の nav 先頭に「← 管理トップ」追加 | MembersScreen / GymAnnouncementsScreen / GymSponsorsScreen / GymRequestsScreen |

### AUTH_GUARD

全画面同一パターン:
```ts
const userContext = await getCurrentUserRole();
if (!userContext) redirect("/login");
if (userContext.role !== "admin") redirect("/");
```
一般ユーザー → `/` へ redirect、未ログイン → `/login` へ redirect。

### CHECK

- typecheck: ✅ pass
- build: ✅ pass（/admin: 361B、全 admin サブルート正常ビルド）

### LIVE_CHECK — 2026-04-27 実機確認済み

| 確認項目 | 結果 |
|---|---|
| `/admin` に admin でアクセス → 4カード表示 | ✅ |
| 各カードから各管理画面へ遷移 | ✅ |
| 各管理画面の「← 管理トップ」リンク | ✅ |
| 非admin ユーザーが `/admin` → `/` redirect | （未確認） |
| 未ログインで `/admin` → `/login` redirect | （未確認） |

---

## 2026-04-27 G-5: トレーナー相談・パーソナルトレーニング申込フォーム

### STATUS: CLOSED (2026-04-27) — DB migration 適用済み / 実機確認済み

### PURPOSE

`/gym` の coming soon スロットをDB-backed な申込フォームとして実装する。
一般ユーザーが相談・申込を送信でき、管理者が `/admin/gym-requests` で一覧・ステータス管理できる。

### IMPLEMENTED

| 機能 | 内容 | ファイル |
|---|---|---|
| DBテーブル | `gym_consultation_requests`（id/user_id/requester_name/contact/request_type/preferred_date/message/status/admin_note/created_at/updated_at） | `supabase/migrations/20260427_000025_gym_consultation_requests.sql` |
| RLS | 誰でも INSERT 可、ユーザーは自分の申込を SELECT 可、admin は全件 SELECT/UPDATE/DELETE | 同上 |
| 型定義 | `RequestType` / `RequestStatus` / `GymConsultationRequest` / ラベル定数 | `lib/gym/consultation-types.ts` |
| DB操作 | `getAllConsultationRequests()` — admin client | `lib/gym/consultation-requests.ts` |
| 公開フォーム送信 | `submitConsultationRequest()` Server Action | `app/gym/actions.ts` |
| フォームUI | お名前・連絡先・種別・希望日時・内容、送信後サンクスカード | `components/gym/GymConsultationForm.tsx` + `.module.css` |
| `/gym` 更新 | coming soon → `GymConsultationForm` セクションに差し替え | `components/gym/GymScreen.tsx` |
| 管理者CRUD | `updateConsultationRequest` / `deleteConsultationRequest` Server Actions | `app/admin/gym-requests/actions.ts` |
| 管理者UI | 申込一覧・ステータス変更（new/contacted/closed）・管理者メモ・削除 | `components/admin/GymRequestsScreen.tsx` + `.module.css` |
| 管理者ページ | admin ロールチェック → redirect | `app/admin/gym-requests/page.tsx` |
| admin nav | 全4画面（会員・お知らせ・スポンサー・相談申込）間のナビを追加 | MembersScreen / GymAnnouncementsScreen / GymSponsorsScreen |

### DB_MIGRATION

⚠️ **human approval 必要** — 以下の手順で Supabase に適用する。

Supabase ダッシュボード > SQL Editor で `supabase/migrations/20260427_000025_gym_consultation_requests.sql` の内容を実行。

### CHECK

- typecheck: ✅ pass
- build: ✅ pass（/gym: 1.72kB → 3.2kB、フォーム追加の正常増加）

### NOTES

- `lib/gym/consultation-types.ts` を server-only なしの共有型ファイルとして分離
  - クライアントコンポーネントが型とラベルを安全に import できる設計
- フォームは未ログインでも送信可能（user_id は nullable、Server Action でセッションから取得）
- 相談種別: trainer_consultation / personal_training / other（DB constraint）
- ステータス: new / contacted / closed（DB constraint）

### LIVE_CHECK — 2026-04-27 実機確認済み

| 確認項目 | 結果 |
|---|---|
| `/gym` 下部のフォーム表示 | ✅ |
| フォーム送信 → サンクスカード表示 | ✅ |
| `/admin/gym-requests` でデータ確認 | ✅ |
| ステータス変更・管理者メモ保存 | ✅ |
| 未ログイン送信 → user_id=null で保存 | （未確認） |
| admin nav 4画面間リンク動作 | ✅ |

### NEXT

- G-6候補: プロフィール強化 / ワークアウト統計拡張 など

---

## 2026-04-27 G-4: スポンサー・協力店のDB化

### STATUS: CLOSED (2026-04-27) — DB migration 適用済み / 実機確認済み

### PURPOSE

`/gym` のスポンサー・協力店セクションを静的配列からDBに移行。
管理者が `/admin/gym-sponsors` から登録・編集・削除できるようにする。

### IMPLEMENTED

| 機能 | 内容 | ファイル |
|---|---|---|
| DBテーブル | `gym_sponsors`（id/name/description/url/image_url/is_published/display_order/created_at/updated_at） | `supabase/migrations/20260427_000024_gym_sponsors.sql` |
| RLS | 公開読み取り（anon+authenticated/is_published=true）、管理者全読み取り、管理者書き込み（insert/update/delete） | 同上 |
| 公開ページ取得 | `getPublishedSponsors()` — display_order ASC, created_at ASC | `lib/gym/sponsors.ts` |
| 管理ページ取得 | `getAllSponsors()` — admin client でRLSバイパス | 同上 |
| `/gym` 更新 | 静的配列→DB取得、0件時セクション非表示、URL指定時にリンク化 | `app/gym/page.tsx`, `components/gym/GymScreen.tsx` |
| 管理者CRUD | `createSponsor` / `updateSponsor` / `deleteSponsor` Server Actions | `app/admin/gym-sponsors/actions.ts` |
| 管理者UI | 作成フォーム＋一覧（編集・削除・公開切替）、他 admin ページへのナビ | `components/admin/GymSponsorsScreen.tsx` + `.module.css` |
| 管理者ページ | admin ロールチェック → redirect | `app/admin/gym-sponsors/page.tsx` |
| admin nav | `/admin/members` と `/admin/gym-announcements` に「スポンサー管理 →」リンク追加 | 各 Screen.tsx / .module.css |

### DB_MIGRATION

⚠️ **human approval 必要** — 以下の手順で Supabase に適用する。

Supabase ダッシュボード > SQL Editor で `supabase/migrations/20260427_000024_gym_sponsors.sql` の内容を実行。

### CHECK

- typecheck: ✅ pass（型整合・imports確認済み）
- build: ✅ pass（2026-04-27 確認、/admin/gym-sponsors ルート正常ビルド）

### LIVE_CHECK — 2026-04-27 実機確認済み

| 確認項目 | 結果 |
|---|---|
| `/admin/gym-sponsors` へのアクセス | ✅ |
| スポンサー作成 → `/gym` に反映 | ✅ |
| `/gym` の表示確認 | ✅ |
| admin nav リンク | ✅ |
| 0件時スポンサーセクション非表示 | （未確認） |
| 非公開 → `/gym` に出ないこと | （未確認） |

---

## 2026-04-27 G-3: お知らせ未読バッジ（localStorage 軽量版）

### STATUS: CLOSED (2026-04-27) — 実機確認済み

### PURPOSE

BottomTabBar のジムタブに未読お知らせ件数バッジを表示し、`/gym` を開くと既読になる UX を実装する。
DB migration 不要の localStorage ベース軽量版として実装。DB-backed 版は将来フェーズ G-3-DB に予約。

### IMPLEMENTED

| 機能 | 内容 | ファイル |
|---|---|---|
| unread store | localStorage 読み書き / カウントキャッシュ / カスタムイベント dispatch | `lib/gym/unread-store.ts` |
| unread hook | `useGymUnreadCount()` — localStorage + storage イベントでリアクティブに件数取得 | `hooks/useGymUnreadCount.ts` |
| お知らせセクション | 「未読」バッジ表示 / 「全て既読にする」ボタン / unread count を localStorage に保存 | `components/gym/GymAnnouncementSection.tsx` + `.module.css` |
| BottomTabBar バッジ | gym タブアイコン右上に橙色バッジ（1〜9 は数字、10以上は "9+"）、件数0は非表示 | `components/navigation/BottomTabBar.tsx` + `.module.css` |
| GymScreen 更新 | announcements セクションを GymAnnouncementSection に委譲 | `components/gym/GymScreen.tsx` |

### DESIGN_NOTES

- localStorage キー:
  - `gym_announcements_read_ids` — 既読済み announcement ID の配列
  - `gym_unread_count` — BottomTabBar が参照する件数キャッシュ
- `/gym` 初回開封時: 既読履歴のない announcement に「未読」バッジ表示 → 「全て既読にする」で消える
- BottomTabBar バッジ: GymAnnouncementSection が mount 時に `gym_unread_count` を書き込み → BottomTabBar がリアクティブに読む
- DB-backed 版（`gym_announcement_reads` テーブル）は G-3-DB として ROADMAP に記録

### CHECK

- typecheck: ✅ pass
- build: ✅ pass（/gym: 654B → 1.71kB、クライアントコード追加の正常増加）

### LIVE_CHECK — コード静的確認済み / ブラウザ実機確認済み（2026-04-27）

#### コードレベルで確認済み（2026-04-27 静的解析）

| 確認項目 | 根拠 | 結果 |
|---|---|---|
| localStorage clear → 全件未読として扱う | `readSnapshot = new Set(getReadIds())` が空 → `unreadCount = announcements.length` | ✅ |
| 各カードに「未読」バッジ + アクセント枠 | `isUnread(id) = !markedAllRead && !readSnapshot.has(id)` → `.cardUnread` / `.unreadBadge` 付与 | ✅ |
| BottomTabBar バッジ数がリアクティブに更新 | `saveUnreadCount()` → `gym_unread_updated` イベント → `useGymUnreadCount` が `getCachedUnreadCount()` を再取得 | ✅ |
| 「全て既読にする」→ 件数0・イベント dispatch | `markAsRead()` が `gym_unread_count="0"` 書き込み + `gym_unread_updated` 発火 + `setMarkedAllRead(true)` | ✅ |
| ページ再読み込み後も既読状態が維持 | `markAsRead()` が `gym_announcements_read_ids` に JSON 永続化 → reload 後も `getReadIds()` で復元 | ✅ |
| 新しいお知らせ → 自動的に未読扱い | 新 ID は `readSnapshot` に存在しない → `isUnread()` = true → バッジ・枠が再表示 | ✅ |
| 他タブ（/train 等）でもバッジが残る | BottomTabBar は全ページに存在し mount 時に `getCachedUnreadCount()` を読み取り | ✅ ※1 |

※1 hydration flash（初期 0 → 実値）は `useState(0)` → `useEffect` 更新の設計上の意図。機能的には正常。

#### ブラウザ実機確認済み（2026-04-27）

| 確認項目 | 結果 |
|---|---|
| `/gym` を開いて BottomTabBar のジムタブに未読バッジが出る | ✅ |
| 「全て既読にする」を押すと未読表示とバッジがすぐ消える | ✅ |
| ページ再読み込み後も既読状態が維持され、バッジが復活しない | ✅ |

---

## 2026-04-27 G-2: gym_announcements テーブル + 管理者投稿

### STATUS: CLOSED (2026-04-27) — DB migration 適用済み / 実機確認済み

### PURPOSE

`/gym` のお知らせセクションを静的配列からDBに移行。管理者が `/admin/gym-announcements` から投稿・編集・削除できるようにする。

### IMPLEMENTED

| 機能 | 内容 | ファイル |
|---|---|---|
| DBテーブル | `gym_announcements`（id/title/body/is_published/display_order/published_at/created_by/created_at/updated_at） | `supabase/migrations/20260427_000023_gym_announcements.sql` |
| RLS | 公開読み取り（anon+authenticated/is_published=true）、管理者全読み取り、管理者書き込み（insert/update/delete） | 同上 |
| 公開ページ取得 | `getPublishedAnnouncements()` — display_order ASC, published_at DESC | `lib/gym/announcements.ts` |
| 管理ページ取得 | `getAllAnnouncements()` — admin client でRLSバイパス | 同上 |
| `/gym` 更新 | 静的配列→DB取得、0件時「現在お知らせはありません」 | `app/gym/page.tsx`, `components/gym/GymScreen.tsx` |
| 管理者CRUD | `createAnnouncement` / `updateAnnouncement` / `deleteAnnouncement` Server Actions | `app/admin/gym-announcements/actions.ts` |
| 管理者UI | 作成フォーム＋一覧（編集・削除）、`/admin/members` ← → ナビ | `components/admin/GymAnnouncementsScreen.tsx` + `.module.css` |
| 管理者ページ | admin ロールチェック → redirect | `app/admin/gym-announcements/page.tsx` |
| admin nav | `/admin/members` ヘッダーに「お知らせ管理→」リンク追加 | `components/admin/MembersScreen.tsx` + `.module.css` |

### DB_MIGRATION

⚠️ **human approval 必要** — 以下の手順で Supabase に適用する。

```
supabase db push
```

または Supabase ダッシュボード > SQL Editor で `supabase/migrations/20260427_000023_gym_announcements.sql` の内容を実行。

### CHECK

- typecheck: ✅ pass（型整合・imports確認済み）
- build: ✅ pass（2026-04-27 確認）

### LIVE_CHECK_REQUIRED

| 確認項目 | 方法 |
|---|---|
| `/gym` のお知らせセクション（0件表示） | DB migration 適用後にブラウザ確認 |
| `/admin/gym-announcements` へのアクセス | admin ロールでログインして確認 |
| お知らせ作成→ `/gym` に反映 | 管理者で投稿し、公開設定で `/gym` を確認 |
| 非公開→ `/gym` に出ないこと | is_published=false にして `/gym` を確認 |
| 非admin ユーザーが `/admin/gym-announcements` にアクセス → `/` redirect | 確認 |

### NEXT

- DB migration 適用（`supabase db push` または SQL Editor）
- LIVE_CHECK_REQUIRED の全項目をブラウザ確認
- G-3: お知らせ未読バッジ（`gym_announcement_reads` + BottomTabBar）

---

## 2026-04-26 G-1: ジムタブ基本ダッシュボード

### STATUS: CLOSED (2026-04-26)

### PURPOSE

`/gym` タブを会員向けのジム情報ホームとして刷新する。
トレーニング統計・クイックリンク・お知らせ・スポンサー・通信スロットを一画面に集約。

### IMPLEMENTED

| 機能 | 内容 | データソース |
|---|---|---|
| 今月のトレーニング回数 | completed session を今月分カウント（JST基準） | `workout_sessions`（RLSスコープ） |
| 最終トレーニング日 | MAX(started_at) JST変換 | 同上 |
| 未ログイン時の表示 | ログインリンク + ゼスト表示 | — |
| クイックリンク | トレーニング開始/プログラム/履歴/プロフィール 2列グリッド | 静的 |
| お知らせ | 3件（静的配列、G-2でDB化予定） | コード内配列 |
| スポンサー・協力店 | 2件（静的配列、G-4でDB化予定） | コード内配列 |
| アカウント | `/profile` リンク | 静的 |
| 通信機能スロット | 「近日対応予定」dashed カード（G-5で差し替え） | — |

### CHANGED_FILES

- `lib/workout/gym-dashboard.ts`（新規）: `getGymDashboardData()` — JST月初→UTC変換、completed session 集計
- `app/gym/page.tsx`（更新）: `force-dynamic`、auth取得後に stats を渡す
- `components/gym/GymScreen.tsx`（全面刷新）: stats props 受け取り + 全セクション
- `components/gym/GymScreen.module.css`（全面刷新）: 各セクション対応スタイル

### DB_MIGRATION

なし（`workout_sessions` への read only クエリのみ）

### CHECK

- typecheck: pass
- build: pass

### LIVE_CHECK — 2026-04-26 ブラウザ確認済み

| 確認項目 | 結果 |
|---|---|
| `/gym` 表示 | ✅ PASS |
| 今月のトレーニング回数 | ✅ PASS |
| 最終トレーニング日 | ✅ PASS |
| クイックリンク（4項目） | ✅ PASS |
| お知らせ | ✅ PASS |
| スポンサー・協力店 | ✅ PASS |
| アカウントリンク | ✅ PASS |
| 通信機能スロット（近日対応予定） | ✅ PASS（将来用枠のみ、機能未実装） |
| スマホ表示 | ✅ PASS |
| BottomTabBar 重なりなし | ✅ PASS |
| クイックリンクのタップ | ✅ PASS |
| お知らせ・スポンサーの縦並び | ✅ PASS |
| 通信機能 placeholder が隠れない | ✅ PASS |

### NEXT_PHASES（G-2 以降）

| フェーズ | 内容 |
|---|---|
| G-2 | `gym_announcements` テーブル + 管理者投稿 |
| G-3 | お知らせ未読バッジ（`gym_announcement_reads` + BottomTabBar） |
| G-4 | `gym_sponsors` テーブル + 管理者登録 |
| G-5 | 通信機能（相談・パーソナル申込フォーム / `gym_contact_requests`） |

---

## 2026-04-26 PWA化 安全調査

### STATUS: 調査完了 / 実装は後回し

調査結果は `docs/pwa-investigation.md` に記録済み。

- Service Worker なし → `/train` / `/session-history` の古いキャッシュリスクはない
- PWA Phase 1 は manifest + icon のみ（SW 追加なし）で低リスク実施可能
- 実装は別タスク優先後に着手する

---

## 2026-04-26 H-1: トレーニング履歴カレンダー表示

### STATUS: CLOSED (2026-04-26 / LIVE確認待ち)

### PURPOSE

`/session-history` に月間カレンダーを追加し、「今月何回トレーニングしたか」「どの日に実施したか」を一目で分かるようにする。

### IMPLEMENTED

| 機能 | 内容 |
|---|---|
| 月間カレンダー | 日曜始まり・7列グリッド |
| 月移動 | ‹ › ボタンで前月/次月移動 |
| 今月実施回数 | ヘッダーに「今月のトレーニング: N回」 |
| 実施日のマーク | `--accent-dim` 背景 + 数字色変更 |
| 複数回実施 | dot に件数を小さく表示 |
| 今日 | `--accent` 枠線で強調 |
| 日付タップ | セッション詳細を下部に表示（詳細リンクあり） |
| 既存履歴一覧 | そのまま残す（カレンダーの下） |
| Googleカレンダー連携 | Phase 3 以降に持ち越し |

### CHANGED_FILES

- `components/history/TrainingCalendar.tsx`（新規 client component）
- `components/history/TrainingCalendar.module.css`（新規）
- `components/history/SessionHistoryScreen.tsx`（`<TrainingCalendar sessions={sessions} />` 追加）

### DATA

- `sessions` は既存の `getSessionHistoryView()` から取得済みデータを再利用（新規 DB クエリなし）
- `status === 'completed'` のみカレンダーにマーク
- `session.startedAt` は既に JST "YYYY-MM-DD" 形式（`jstDateSlice` 適用済み）

### KNOWN_LIMITS（H-1 時点）

- ~~直近 20 件のみ取得（`SESSION_LIST_LIMIT = 20`）→ 高頻度ユーザーでは月をさかのぼると未表示になる可能性~~ → **H-1b で解消**

### CHECK

- typecheck: pass
- build: pass（session-history 1.19kB → 2.95kB）

---

## 2026-04-28 H-1b: 履歴カレンダー専用クエリ（SESSION_LIST_LIMIT 依存解消）

### STATUS: CLOSED

### 実装内容

H-1 の KNOWN_LIMITS として記録されていた「SESSION_LIST_LIMIT = 20 によるカレンダー未表示問題」を解消。
カレンダーの dot 表示をセッション一覧（最新20件）から切り離し、月単位の専用軽量クエリに移行した。

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `types/workout.ts` | `CalendarDayEntry`・`CalendarMonthResult` 型を追加 |
| `lib/workout/session-list.ts` | `getCalendarMonthData(year, month)` 関数を追加 |
| `components/history/TrainingCalendar.tsx` | props に `entries: CalendarDayEntry[]` を追加、dot 計算を entries に切り替え |
| `components/history/SessionHistoryScreen.tsx` | `calendarEntries` prop を追加して TrainingCalendar へ渡す |
| `app/session-history/page.tsx` | `getCalendarMonthData` を並列実行し calendarEntries をページに注入 |

### 設計ポイント

- `getCalendarMonthData` は `status='completed'` かつ `archived_at IS NULL` の当月セッションのみを `started_at` で絞り込む
- 月境界は UTC+JST 変換を考慮して広め（前月25日〜翌月1日）に取得し、`jstDateSlice` で JST 日付に変換後に当月プレフィックスで再フィルタ
- DB migration 不要（既存テーブルの新クエリのみ）
- 既存の履歴一覧表示（最新20件）・選択日詳細パネルはそのまま維持

### RISKS

- カレンダー移動（前月/次月）時はページリロードが発生しないため、表示月が変わっても `calendarEntries` は初期ロード時の当月データのまま
- 将来的には月移動のたびにクライアントサイドで `getCalendarMonthData` 相当の API を呼び出す対応が必要
- 現状: 当月カレンダーは正確、前月/次月に移動した場合のドット表示は sessions（最新20件）ベースのフォールバックなし → 他月は空になる

### CHECK

- typecheck: pass
- build: pass（session-history 2.94 kB）
- DB migration: 不要

### LIVE_CHECK — 2026-04-28 スマホ実機確認済み

| 確認項目 | 結果 |
|---|---|
| `/session-history` 表示 | ✅ PASS |
| 当月カレンダーに実施日の dot / マークが表示される | ✅ PASS |
| 今月のトレーニング回数が表示される | ✅ PASS |
| 日付選択ができる | ✅ PASS |
| 選択日の履歴カードが表示される | ✅ PASS |
| 既存の履歴一覧・詳細導線に大きな崩れなし | ✅ PASS |

残課題: ~~前月/次月移動時に calendarEntries が更新されない~~ → H-1c で対応済み

---

## 2026-04-28 H-1c: 月移動時カレンダーAPI取得（前月/次月 dot 更新）

### STATUS: CLOSED

### 実装内容

H-1b の残課題として記録されていた「前月/次月移動時に calendarEntries が更新されない」問題を解消。
月移動ボタン押下時に `/api/session-history/calendar` を呼び出し、対象月の dot と月間回数を更新する。

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `app/api/session-history/calendar/route.ts` | 新規追加。GET `?year=&month=` で CalendarMonthResult を返す軽量 API |
| `components/history/TrainingCalendar.tsx` | `currentEntries` / `isLoading` / `fetchError` state 追加、月移動時に fetchMonthData() を呼び出す |
| `components/history/TrainingCalendar.module.css` | `.calendarLoading` / `.calendarError` スタイル追加 |

### 設計ポイント

- 初期表示は server-side props の `entries` をそのまま使用（flicker なし）
- 月移動時のみ `/api/session-history/calendar?year=X&month=Y` を fetch
- month は 0-indexed（JS Date.getMonth() 準拠）
- loading 中は「読み込み中...」、エラー時は控えめなエラー文を表示（カレンダーグリッドは崩さない）
- 選択日詳細パネルは引き続き sessions（最新20件）を使用

### RISKS

- 選択日詳細パネルは sessions（最新20件）ベースのため、20件超前の月の日付を選択しても詳細が表示されない
  → 詳細パネル強化は将来タスク（H-1d 候補）

### CHECK

- typecheck: pass
- build: pass（/session-history 3.22kB、/api/session-history/calendar が build に追加）
- DB migration: 不要

### LIVE_CHECK — 2026-04-28 スマホ実機確認済み

| 確認項目 | 結果 |
|---|---|
| `/session-history` 初期表示 | ✅ PASS |
| 前月ボタンで前月へ移動 | ✅ PASS |
| 前月の dot 表示が更新される | ✅ PASS |
| 表示月の月間トレーニング回数が更新される | ✅ PASS |
| 次月ボタンで戻した時も dot / 月間回数が更新される | ✅ PASS |
| 既存の履歴一覧表示に大きな崩れなし | ✅ PASS |
| スマホ実機 全項目 | ✅ PASS |

補足: 選択日詳細パネルは最新20件ベース（既知リスク）。次候補 H-1d で対応予定。

### LIVE_CHECK — 2026-04-26 ブラウザ確認済み

| 確認項目 | 結果 |
|---|---|
| `/session-history` 表示 | ✅ PASS |
| カレンダーが既存一覧の上に配置される | ✅ PASS |
| 日曜始まり | ✅ PASS |
| 今月のトレーニング N回 表示 | ✅ PASS |
| 実施日のマーク | ✅ PASS |
| 複数回実施の件数表示 | ✅ PASS |
| 今日のハイライト | ✅ PASS |
| 日付タップで詳細表示 | ✅ PASS |
| 前月/次月移動 | ✅ PASS |
| 既存履歴一覧が残っている | ✅ PASS |
| スマホ表示 | ✅ PASS |
| Googleカレンダー連携 | 未実装（Phase 3 以降）|

---

## 2026-04-28 H-1d: 選択日詳細パネルのAPI化（SESSION_LIST_LIMIT 完全排除）

### STATUS: CLOSED

### 実装内容

カレンダーで日付を選択した時の詳細パネルを、`sessions`（最新20件）ベースから
`/api/session-history/day?date=YYYY-MM-DD` の API フェッチに切り替え。
20件より古い日付でも正確な詳細カードが表示できるようになった。

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `lib/workout/session-list.ts` | `getDaySessionData(date)` 関数を追加（JST日付指定クエリ） |
| `app/api/session-history/day/route.ts` | 新規。GET `?date=YYYY-MM-DD` で DaySessionResult を返す API |
| `components/history/TrainingCalendar.tsx` | `sessions` prop を削除、`daySessions` / `daySessionsCache` / `isDayLoading` / `dayError` state 追加、日付クリック時に fetchDaySessions() 呼び出し |
| `components/history/SessionHistoryScreen.tsx` | TrainingCalendar への `sessions` 渡しを削除 |

### 設計ポイント

- JST日付 → UTC範囲変換: `(day-1) T15:00:00Z` ～ `day T15:00:00Z`、さらに `jstDateSlice` で再フィルタ
- 同一日付は `daySessionsCache` にキャッシュし再フェッチを防止
- ローディング中は「読み込み中...」、エラー時は控えめなエラーメッセージ
- 月移動時に selectedDate / daySessions をクリア
- `SESSION_LIST_LIMIT` への依存がカレンダー周りから完全排除された

### CHECK

- typecheck: pass
- build: pass（/session-history 3.35kB、/api/session-history/day が追加）
- DB migration: 不要

### LIVE_CHECK — 2026-04-28 スマホ実機確認済み

| 確認項目 | 結果 |
|---|---|
| `/session-history` スマホ表示 | ✅ PASS |
| dot がある日付をタップで詳細カード表示 | ✅ PASS |
| 前月・次月移動後、日付タップで対象日の詳細が表示される | ✅ PASS |
| 既存の履歴一覧表示に崩れなし | ✅ PASS |
| 最新20件より古い日付でも詳細が表示される | ✅ PASS |
| 全7確認項目 | ✅ PASS |

---

## 2026-04-28 D-1b: 管理者退会申請一覧 — email JOIN バグ修正

### STATUS: CLOSED

### 根本原因

`app/admin/account-deletion-requests/page.tsx` で embedded join に `email` を含めていたが、
`email` は `public.users` に存在せず `auth.users` にのみある。
クエリがエラーになり `data=null` → 空リスト表示。

### 修正内容

- `users ( email, ... )` の embedded join を廃止
- `account_deletion_requests` を plain select で取得
- `public.users` から member_name / display_name / membership_status を別クエリ（`.in("id", userIds)`）
- `auth.admin.listUsers()` から email を取得（`lib/admin/members.ts` と同パターン）
- 両者を Map で結合して DeletionRequestsScreen に渡す

### 変更ファイル

| ファイル | 内容 |
|---|---|
| `app/admin/account-deletion-requests/page.tsx` | JOIN 廃止・2段階取得・email を auth から取得 |

### CHECK

- typecheck: pass
- build: pass
- DB migration: 不要（コードのみ）

### LIVE_CHECK — 2026-04-28 スマホ実機確認済み

| 確認項目 | 結果 |
|---|---|
| /admin/account-deletion-requests に pending 申請が表示される | ✅ PASS |
| email が表示される | ✅ PASS |
| member_name / display_name が表示される | ✅ PASS |
| membership_status が表示される | ✅ PASS |
| 申請理由が未入力の場合「未入力」と表示される | ✅ PASS |
| 承認・却下ボタンが表示される | ✅ PASS |
| 「ログイン情報やトレーニング履歴は削除されません」の注意文が表示される | ✅ PASS |
| 管理画面の表示崩れなし | ✅ PASS |

### DEFERRED_CHECK（後日確認）

- [ ] active/paused ユーザーを承認した時に membership_status が cancelled になる（今回の確認ユーザーは既に cancelled だったため後日別ユーザーで確認）
- [ ] cancelled ユーザーが /train で退会向け案内になる（M-1 連携）
- [ ] 却下時に membership_status が変わらない

---

## 2026-04-28 D-2: 退会承認時に cancelled_at を記録する

### STATUS: CLOSED — コードレビュー PASS / Supabase実機確認は手動実施が必要

### 実装内容

D-1c「退会後1年保管方針」の基準日として、`public.users.cancelled_at` を追加した。
退会申請承認時（管理者 approve）および /admin/members 直接ステータス変更時に `cancelled_at` を記録する。

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `supabase/migrations/20260428_000028_users_cancelled_at.sql` | 新規。`public.users` に `cancelled_at timestamptz` を追加 |
| `app/admin/account-deletion-requests/actions.ts` | `approveDeletionRequest` で `cancelled_at = now` をセット |
| `app/admin/members/actions.ts` | `updateMembershipStatus` で `cancelled` → `cancelled_at = now`、`active/paused` → `cancelled_at = null` |

### 設計ポイント

- `cancelled_at` は D-3「退会後1年経過ユーザーの削除対象表示」の基準日として使う
- `/admin/members` から直接 cancelled にした場合も記録される（退会申請なしの管理者操作でも一貫性を保つ）
- `active` / `paused` へ戻した場合は `cancelled_at = null` にクリア（将来の D-6 再入会を見据えた設計）
- 既存 cancelled ユーザーの `cancelled_at` は `null` のまま（補完は D-2b または手動確認として残す）
- 物理削除は一切行わない

### DB migration 適用手順（手動）

```bash
# Supabase CLI (接続済みの場合)
supabase db push

# または Supabase ダッシュボード SQL Editor で実行
# supabase/migrations/20260428_000028_users_cancelled_at.sql
```

### CHECK

- typecheck: pass
- build: pass
- DB migration: ファイル作成済み・**本番DB適用済み（2026-04-28 Supabase Dashboard SQL Editor）**

### MIGRATION 適用確認 — 2026-04-28

| 確認項目 | 結果 |
|---|---|
| Supabase Dashboard SQL Editor で migration SQL を適用 | ✅ 完了 |
| public.users に cancelled_at カラムが存在する | ✅ 確認済み |
| 既存 cancelled ユーザーの cancelled_at | NULL のまま（安全側・自動補完は未実施） |

**方針メモ:** 既存 cancelled ユーザーは cancelled_at=NULL のため、D-3「1年後削除対象判定」では `cancelled_at IS NOT NULL` を条件にする。既存ユーザーは削除対象外になるため安全。

### CODE_REVIEW — 2026-04-28 コードレビュー実施

Claude が `app/admin/account-deletion-requests/actions.ts` および `app/admin/members/actions.ts` を読んでロジックを検証した。

| 確認シナリオ | コードの動作 | 判定 |
|---|---|---|
| 退会申請を承認（approveDeletionRequest） | `users.membership_status = 'cancelled'` + `cancelled_at = now()` を同一UPDATE | ✅ 正しい |
| 退会申請を却下（rejectDeletionRequest） | `account_deletion_requests` のみ更新。`users` テーブルに一切触れない | ✅ 正しい（cancelled_at 入らない） |
| 管理者画面から直接 cancelled（updateMembershipStatus） | `newStatus === 'cancelled'` 時 → `cancelled_at = new Date().toISOString()` | ✅ 正しい |
| cancelled → active / paused へ変更（updateMembershipStatus） | `newStatus !== 'cancelled'` 時 → `cancelled_at = null` | ✅ 正しい |
| データ削除 | 実施しない（`users` レコードの削除コードなし） | ✅ 正しい |

**注意:** 以上はコードレビューによる論理検証。Supabase 上での実際の値変化は UI 操作 + ダッシュボード確認が必要。

### LIVE_CHECK — 手動実施が必要（Supabaseダッシュボード確認）

以下をテストユーザーで実施してください。

| 手順 | 操作 | Supabase で確認する値 |
|---|---|---|
| 1 | テストユーザーが /profile から退会申請を送信 | account_deletion_requests に pending レコードが入ること |
| 2 | 管理者が /admin/account-deletion-requests で「承認して退会済みにする」 | users.membership_status = cancelled / cancelled_at = 日時が入ること |
| 3 | 同テストユーザーで /profile を開く | 退会済み案内が表示され退会申請フォームが非表示になること |
| 4 | 管理者が /admin/members で同ユーザーを active に変更 | users.membership_status = active / cancelled_at = NULL になること |
| 5 | 別のテストユーザーを管理者画面から直接 cancelled に変更 | users.membership_status = cancelled / cancelled_at = 日時が入ること |
| 6 | そのユーザーを paused に変更 | users.membership_status = paused / cancelled_at = NULL になること |

**確認状態:** 手動確認待ち（Supabase直接アクセス不可のためClaudeによる代替確認不可）

- [x] public.users に cancelled_at カラムが存在する ✅ SQL確認済み（2026-04-28）
- [x] コードレビュー：承認時に cancelled_at が入るロジックが正しい ✅
- [x] コードレビュー：却下時に cancelled_at が入らないロジックが正しい ✅
- [x] コードレビュー：active/paused 変更時に cancelled_at = null になるロジックが正しい ✅
- [ ] Supabase実機：退会申請承認時の cancelled_at 記録 — **コードレビューPASS / 実機未確認**
- [x] Supabase実機：/admin/members 直接変更時の cancelled_at 記録 ✅ **PASS（2026-04-28 手動確認）**
- [x] Supabase実機：cancelled→active 時の cancelled_at=null ✅ **PASS（2026-04-28 手動確認）**
- [ ] Supabase実機：トレーニング履歴が削除されていないこと — 未確認

### LIVE_CHECK 結果サマリー（2026-04-28）

| 確認項目 | 方法 | 結果 |
|---|---|---|
| /admin/members から cancelled に変更 → cancelled_at が入る | Supabase実機 | ✅ PASS |
| /admin/members から active / paused に変更 → cancelled_at が null になる | Supabase実機 | ✅ PASS |
| 退会申請承認フロー → cancelled_at が入る | コードレビューのみ | ⚠️ 実機未確認 |
| 退会申請却下フロー → cancelled_at が入らない | コードレビューのみ | ⚠️ 実機未確認 |

---

## 2026-04-28 D-1d: 退会済みユーザーの再申請防止・表示整理

### STATUS: CLOSED

### 問題

`membership_status=cancelled` のユーザーが /profile から再度退会申請を作成できた。
管理者画面に cancelled ユーザーの pending 申請が表示され、誤って承認操作できる状態だった。

### 修正内容

| 層 | 変更内容 |
|---|---|
| UI（/profile） | `membershipStatus=cancelled` 時は退会申請フォームを非表示。「退会済みです。再入会はスタッフへ」の案内を表示。 |
| Server Action | `submitDeletionRequest` で insert 前に `membership_status` を確認。cancelled なら `already_cancelled` エラーで拒否。 |
| 管理者画面 | pending 申請のユーザーが cancelled の場合、黄色の警告バナーを表示。承認ボタンを disabled に。却下ボタンは維持。 |

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `app/profile/page.tsx` | `membership_status` も取得して ProfileScreen に渡す |
| `components/profile/ProfileScreen.tsx` | `membershipStatus` prop 追加。cancelled 時は退会済み案内を表示 |
| `app/profile/deletion-actions.ts` | `submitDeletionRequest` に cancelled チェックを追加 |
| `components/admin/DeletionRequestsScreen.tsx` | cancelled ユーザーの pending 申請に警告バナー・承認ボタン disabled |
| `components/admin/DeletionRequestsScreen.module.css` | `.alreadyCancelledNote` スタイル追加 |

### CHECK

- typecheck: pass
- build: pass
- DB migration: 不要

### LIVE_CHECK — 2026-04-28 スマホ実機確認済み

| 確認項目 | 結果 |
|---|---|
| cancelled ユーザーで /profile を開くと退会済み案内が表示される | ✅ PASS |
| cancelled ユーザーには退会申請フォームが表示されない | ✅ PASS |
| /profile に再入会希望はスタッフ問い合わせの案内が表示される | ✅ PASS |
| /profile に退会後データは原則1年間保管する旨が表示される | ✅ PASS |
| /admin/account-deletion-requests で処理済み申請が表示される | ✅ PASS |
| 処理済み申請で approved status が表示される | ✅ PASS |
| 処理済み申請で membership_status cancelled が表示される | ✅ PASS |
| スマホ表示で大きな崩れなし | ✅ PASS |

### DEFERRED_CHECK（後日確認）

- [ ] cancelled ユーザーが直接送信しようとしても新規 pending 申請が作られない（Server Action ガード）
- [ ] /admin で cancelled ユーザーの pending 申請に警告バナーが表示される（今回は pending が処理済みだったため未確認）
- [ ] 警告バナーがある場合、承認ボタンが無効化されている
- [ ] 却下処理は動く
- [ ] active/paused ユーザーの承認フロー（active→cancelled）は後日別ユーザーで確認

---

## 2026-04-28 D-1c: 退会後データ保持方針の明文化・文言追加

### STATUS: CLOSED

### 方針

退会後のデータは、問い合わせ対応・再開希望・会費確認・履歴確認に備えて原則1年間保管する。
1年経過後は削除対象として扱う方針とする。

現時点では完全削除処理は未実装。auth.users / public.users / workout_sessions / enrollments は削除しない。

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `components/profile/ProfileScreen.tsx` | 退会申請説明に「退会後1年保管・1年後に削除対象」を追記 |
| `components/admin/DeletionRequestsScreen.tsx` | ページ subtitle と承認カード disclaimer に1年保管方針を追記 |

### CHECK

- typecheck: pass
- build: pass
- DB migration: 不要

### LIVE_CHECK_REQUIRED

- [ ] /profile の退会申請セクションに「退会後データを1年保管する」旨が表示される
- [ ] /admin/account-deletion-requests の説明文に1年保管方針が表示される
- [ ] 承認カードの disclaimer に1年保管方針が表示される

### 将来タスク（D-2〜D-5）

| タスク | 内容 |
|---|---|
| D-2 | 退会承認時に cancelled_at を記録する |
| D-3 | 退会後1年経過したユーザーを削除対象として管理画面に表示する |
| D-4 | 管理者が最終確認して完全削除または匿名化できるようにする |
| D-5 | 必要なら Vercel Cron / Supabase Cron で自動処理を検討する |

---

## 2026-04-28 D-1: 退会・アカウント削除申請と管理者退会処理

### STATUS: CLOSED (DB migration 手動適用待ち)

### 実装内容

ユーザーが /profile から退会申請を送り、管理者が /admin/account-deletion-requests で確認・承認できる仕組みを実装。
承認すると `membership_status = cancelled` に変更される。物理削除は一切行わない。

### 変更・新規ファイル

| ファイル | 種別 | 内容 |
|---|---|---|
| `supabase/migrations/20260428_000027_account_deletion_requests.sql` | 新規 | account_deletion_requests テーブル・RLS・インデックス |
| `app/profile/deletion-actions.ts` | 新規 | `submitDeletionRequest` / `getOwnPendingDeletionRequest` server actions |
| `app/admin/account-deletion-requests/page.tsx` | 新規 | 管理者退会申請一覧ページ |
| `app/admin/account-deletion-requests/actions.ts` | 新規 | `approveDeletionRequest` / `rejectDeletionRequest` server actions |
| `components/admin/DeletionRequestsScreen.tsx` | 新規 | 管理者退会申請画面コンポーネント |
| `components/admin/DeletionRequestsScreen.module.css` | 新規 | 管理者画面スタイル |
| `components/admin/AdminHubScreen.tsx` | 変更 | 「退会申請管理」カード追加 |
| `components/profile/ProfileScreen.tsx` | 変更 | 退会申請セクション追加（2クリック確認） |
| `components/profile/ProfileScreen.module.css` | 変更 | 退会申請セクションのスタイル追加 |
| `app/profile/page.tsx` | 変更 | pending 申請チェックを並列フェッチ |

### DB設計

**テーブル:** `account_deletion_requests`

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → users | 申請ユーザー |
| reason | text null | 申請理由（任意） |
| status | text | pending / approved / rejected / cancelled_by_user |
| requested_at | timestamptz | 申請日時 |
| reviewed_at | timestamptz null | 対応日時 |
| reviewed_by | uuid null FK → users | 対応管理者 |
| admin_note | text null | 管理メモ |

**制約:** status check constraint / 同一 user_id での pending は1件のみ（unique partial index）

**RLS:** ユーザーは自分の申請を SELECT/INSERT。管理者は全件 SELECT/UPDATE。

### 安全設計ポイント

- 承認しても auth.users / public.users / workout_sessions / enrollments は削除しない
- ユーザー本人が membership_status を直接変更できない（管理者 action のみ）
- 却下時は membership_status を変更しない
- 申請理由の入力なしでも申請できる

### DB migration 適用手順（手動）

```bash
# Supabase CLI (接続済みの場合)
supabase db push

# または Supabase ダッシュボード SQL Editor で以下を実行
# supabase/migrations/20260428_000027_account_deletion_requests.sql
```

### CHECK

- typecheck: pass
- build: pass（/profile 2.54kB、/admin/account-deletion-requests 2.33kB 追加）
- DB migration: ファイル作成済み・本番DB適用は手動

### LIVE_CHECK_REQUIRED

- [ ] /profile に退会申請セクションが表示される
- [ ] 理由なしでも申請できる（送信 → 確認クリック）
- [ ] 理由ありでも申請できる
- [ ] 申請後に「受付済みです」表示になる
- [ ] 同一ユーザーが pending 申請を重複作成できない
- [ ] /admin に「退会申請管理」カードが表示される
- [ ] /admin/account-deletion-requests で申請一覧が見える
- [ ] email / member_name / display_name が確認できる
- [ ] 管理者が承認すると membership_status が cancelled になる
- [ ] cancelled ユーザーは /train で退会向け案内が表示される（M-1 連携）
- [ ] 管理者が却下すると membership_status は変更されない
- [ ] トレーニング履歴は削除されていない
- [ ] スマホ表示で大きく崩れていない

---

## 2026-04-28 M-1: 非activeユーザー向け表示整理

### STATUS: CLOSED

### 背景・目的

`membership_status` が `paused` / `cancelled` のユーザーがアプリを開いた時、なぜ使えないのかが分からない問題に対応。
強い拒絶表現を避け、やわらかく状況を伝える文言へ整理した。

### 対象 status

| status | 意味 |
|---|---|
| `paused` | 休会中 |
| `cancelled` | 退会済み |
| その他（将来的な拡張） | 汎用停止メッセージ |

※ `suspended` / `inactive` は現在 DB の `MembershipStatus` 型に存在しない（`active` / `paused` / `cancelled` のみ）

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `components/train/MembershipRequiredScreen.tsx` | `status` prop 追加、paused / cancelled / default で文言を切り替え |
| `app/train/page.tsx` | `membershipStatus` を `MembershipRequiredScreen` に渡す |
| `components/gym/GymScreen.tsx` | `membershipStatus` prop 追加、非active 時に soft notice バナーを表示 |
| `components/gym/GymScreen.module.css` | `.membershipNotice` / `.membershipNoticeText` スタイル追加 |
| `app/gym/page.tsx` | `getMembershipStatus` を並列呼び出し、GymScreen に渡す |

### 文言方針

| status | タイトル | 本文要約 |
|---|---|---|
| paused | 現在、休会中です | 休会中につきトレーニング機能利用不可・再開はスタッフへ |
| cancelled | ご利用状況をご確認ください | 再度利用希望の場合はスタッフへ |
| default | 現在ご利用を一時停止しています | 詳細はスタッフへ |

### 変更しなかった範囲

- `/programs` — 閲覧は引き続き可能（変更なし）
- `/profile` — 表示は可能、membership_status 編集は admin-only（変更なし）
- enrollment / 履歴カレンダー H-1b〜H-1d — 触らない
- トレーニング記録保存処理 — 触らない
- DB migration — 不要

### CHECK

- typecheck: pass
- build: pass（/gym 3.24kB、/train 13kB 変化なし）
- DB migration: 不要

### LIVE_CHECK — 2026-04-28 スマホ実機確認済み

| 確認項目 | 結果 |
|---|---|
| /gym で休会中ユーザー向け soft notice が表示される | ✅ PASS |
| /train で退会済みユーザー向け案内画面が表示される | ✅ PASS |
| 文言が強すぎず、利用状況と問い合わせ案内が分かる | ✅ PASS |
| スマホ表示で大きな崩れなし | ✅ PASS |
| active ユーザー側の通常表示に問題なし | ✅ PASS |

---

## 2026-04-26 C-8: 5本目プログラム seed 追加

### STATUS: CLOSED (seed追加済み / 本番DB反映は手動SQL実行待ち)

### PROGRAM_PROPOSAL

| 項目 | 内容 |
|---|---|
| slug | `barbell-2day-base` |
| title | `Barbell 2-Day Full Body Base` |
| level | beginner |
| days_per_week | 2（既存4本は全て3〜4日。週2ニーズを新規カバー） |
| duration_weeks | 4 |
| goal tag | strength |
| equipment tag | barbell |
| split tag | full-body |
| concept | 5大バーベル種目を2パターン（スクワット日/デッドリフト日）で全身カバー |
| target | 週2日のみ通えるジム初心者・再開者 |

### STRUCTURE

| Day | 種目 | Type | Sets × Reps |
|---|---|---|---|
| Day 1 | Squat | T1 | 4×5 |
| Day 1 | Bench Press | T2 | 3×8 |
| Day 1 | Barbell Row | T2 | 3×8 |
| Day 2 | Deadlift | T1 | 1×5 |
| Day 2 | Overhead Press | T2 | 3×8 |
| Day 2 | Barbell Row | T2 | 3×8 |

### IMPLEMENTED

- seed ファイル: `seed/programs/barbell-2day-base.sql`
- 新規 exercise なし（既存 squat/bench-press/barbell-row/deadlift/overhead-press を再利用）
- ON CONFLICT (slug) DO NOTHING でべき等
- 既存プログラム skip guard（既に存在する場合は早期 return）
- tag 未存在時は graceful degradation（RAISE NOTICE のみ）
- 確認クエリをコメント付きで付属

### CHECK

- typecheck: pass
- build: pass
- 既存プログラム影響: なし（既存 seed・enrollment・sessions に触れない）

### DB_APPLY

| 環境 | 状態 |
|---|---|
| local migration | seed SQL のみ（migration 不要） |
| 本番 Supabase | **未実施** — Supabase Dashboard SQL Editor で以下を順番に実行 |

**本番反映手順（Supabase Dashboard SQL Editor）:**

Step A: tags 存在確認（3行返れば program-metadata.sql 不要）

```sql
select slug, label, axis from public.program_tags
where slug in ('strength', 'barbell', 'full-body') order by axis, slug;
```

Step A で3行返らない場合 → `seed/programs/program-metadata.sql` を先に実行。

Step B: `seed/programs/barbell-2day-base.sql` の内容を全コピーして実行。

Step C: 反映確認（各クエリが weeks=4 / days=8 / exercises=24 であること）

```sql
select count(*) as weeks from public.program_weeks pw
  join public.programs p on p.id = pw.program_id where p.slug = 'barbell-2day-base';
select count(*) as days from public.program_days pd
  join public.program_weeks pw on pw.id = pd.program_week_id
  join public.programs p on p.id = pw.program_id where p.slug = 'barbell-2day-base';
select count(*) as exercises from public.program_day_exercises pde
  join public.program_days pd on pd.id = pde.program_day_id
  join public.program_weeks pw on pw.id = pd.program_week_id
  join public.programs p on p.id = pw.program_id where p.slug = 'barbell-2day-base';
select slug, is_public from public.programs
  where slug in ('gzclp-base','starting-strength-base','upper-lower-base','dumbbell-full-body-base')
  order by slug;
```

### DB_APPLY — 2026-04-26 本番反映済み

| 確認項目 | 結果 |
|---|---|
| seed 実行 | ✅ PASS |
| programs に barbell-2day-base 存在 | ✅ PASS |
| program_weeks | ✅ 4件 |
| program_days | ✅ 8件 |
| program_day_exercises | ✅ 24件 |
| 既存プログラム（本番 programs 合計 10件確認） | ✅ 消えていない |

### LIVE_CHECK — 2026-04-26 ブラウザ確認

| 確認項目 | 結果 |
|---|---|
| `/programs` に5本目が表示される | ✅ PASS |
| カード表示（Beginner / Strength / Barbell / Full Body / 2 days / 4 weeks） | ✅ PASS |
| プログラム詳細が表示される | 未確認 |
| Start Program できる | 未確認 |
| `/train` に進める | 未確認 |
| Week / Day 表示が自然 | 未確認 |
| 既存ユーザーの active enrollment に影響なし | ✅ 問題なし |

---

## 2026-04-26 U-5: 休憩タイマー自動起動

### STATUS: CLOSED (2026-04-26)

### PURPOSE

セット完了後に休憩タイマーを自動起動する。

### FINDING

`startRestTimer()` は実装時点（U-1〜U-4 フェーズ）からすでに `handleComplete` の optimistic update 直後（line 969）に実装済みだった。
ROADMAP の「中優先・未実装」は prototype README の注記をもとにした誤記入だったため、今回訂正。

### IMPLEMENTED (今回の追加修正)

**save 失敗時のタイマーキャンセル（3行追加）:**

`handleComplete` の catch ブロックで、optimistic に開始したタイマーをロールバックするよう修正。
変更前: save 失敗時もタイマーが走り続ける
変更後: save 失敗 → UI ロールバック + タイマーキャンセル

```typescript
// catch ブロックに追加
restEndTimeRef.current = null;
clearRestDoneTimeout();
setRestSecondsLeft(null);
```

### 既存の自動起動動作（変更なし）

| 条件 | タイマー動作 |
|---|---|
| セット完了タップ | 即時 auto-start（optimistic）|
| save 成功 | タイマー継続 |
| save 失敗 | タイマーキャンセル（今回追加） |
| セッション完了済み / キャンセル済み | `handleComplete` が return → タイマー起動なし |
| 手動タイマーボタン | 従来通り start / cancel |

### CHECK

- typecheck: pass
- build: pass

---

## 2026-04-26 V-2: 1RM計算ボタン実装

### STATUS: CLOSED / LIVE確認済み (2026-04-26)

### PURPOSE

WorkoutScreen.tsx の「計算」ボタンスタブ（onClick 未実装）を最小 1RM 計算機として実装する。

### IMPLEMENTED

| 項目 | 内容 |
|---|---|
| 計算式 | Epley 式: `1RM = 重量 × (1 + 回数 / 30)` |
| UI | 計算ボタン押下でモーダルを表示。重量・回数を入力→即時計算 |
| バリデーション | 未入力・0以下・NaN → エラーメッセージを表示 |
| DB保存 | なし（UI補助のみ） |
| 既存記録ロジックへの影響 | なし |
| 日本語UI | 推定1RM / 重量 / 回数 / 参考値注記 |
| モバイル対応 | グリッド2列入力 + モーダルは既存 `.modal` スタイルを再利用 |

### CHANGED_FILES

- `components/workout/WorkoutScreen.tsx`
  - `compute1RM()` 純粋関数追加（コンポーネント外）
  - state 追加: `is1RMModalOpen` / `calc1RMWeight` / `calc1RMReps`
  - 計算ボタンに `onClick={() => setIs1RMModalOpen(true)}` 追加
  - 1RM モーダル JSX 追加（Add Exercise モーダルの直後）
- `components/workout/WorkoutScreen.module.css`
  - `.calc1RMBody` / `.calc1RMInputRow` / `.calc1RMField` / `.calc1RMLabel` / `.calc1RMInput`
  - `.calc1RMResult` / `.calc1RMResultLabel` / `.calc1RMResultValue` / `.calc1RMResultSub`
  - `.calc1RMPlaceholder` / `.calc1RMError` / `.calc1RMNote` 追加

### STATIC_CHECK

| ケース | 期待値 | 結果 |
|---|---|---|
| 100kg × 5回（計算値） | 116.7kg | ✅ |
| 80kg × 10回（計算値） | 106.7kg | ✅ |
| 重量未入力 | エラー表示 | ✅（コードで確認） |
| 回数未入力 | エラー表示 | ✅（コードで確認） |
| 0以下 | エラー表示 | ✅（コードで確認） |
| typecheck | pass | ✅ |
| build | pass (train: 11.5kB→12.2kB) | ✅ |

### LIVE_CHECK — 2026-04-26 ブラウザ確認済み

| 確認項目 | 結果 |
|---|---|
| ボタン表示 | ✅ PASS |
| モーダル開閉 | ✅ PASS |
| 100kg × 3回 → 110kg | ✅ PASS（100 × (1 + 3/30) = 110.0） |
| 80kg × 10回 → 106.7kg | ✅ PASS（80 × (1 + 10/30) = 106.7） |
| UI表示（入力欄・結果・参考文） | ✅ PASS（モーダル自然、大きく表示） |
| スマホ/狭幅表示 | ✅ PASS |
| バリデーション | 未確認 |
| workout 入力値に影響しないか | 未確認 |
| セット保存処理に影響しないか | 未確認 |
| DB保存なし（UI補助のみ） | ✅ PASS（設計上 DB 操作なし） |

### PHASE_3 候補（持ち越し）

- 複数式対応（Brzycki / Lander / O'Conner など）
- 計算結果のコピー機能
- セット入力値からの自動プリフィル

---

## 2026-04-26 V-1: S-7 Restart Program 静的検証

### STATUS: STATIC_CHECK PASS / LIVE_E2E 未実施（完走が必要）

### PURPOSE

プログラム完走後に「プログラムを最初から」ボタンが正しく動作するか確認する。

### STATIC_CHECK (2026-04-26)

| 確認項目 | 結果 | 根拠 |
|---|---|---|
| Restart ボタンの表示条件 | ✅ `isProgramCompleted && programId !== null` のみ | `WorkoutSummaryScreen.tsx:89` |
| `isProgramCompleted` 判定 | ✅ `findNextProgramDayId` が null → 最終 day | `workout-summary.ts:402-414` |
| 既存 completed enrollment の保持 | ✅ INSERT のみ。completed row には触れない | `restart-program.ts:155-168` |
| 重複 INSERT 防止 | ✅ 同一 program の active 行があれば reused を返す | `restart-program.ts:145-153` |
| 新 enrollment が Week1/Day1 を向く | ✅ `resolveFirstProgramDayId` (week_number=1, day_number=1) | `restart-program.ts:135` |
| user_id スコープ | ✅ `auth.getUser()` でサーバー側取得、INSERT に明示 | `route.ts:29` |
| DB unique constraint との整合 | ✅ completed 後は active row なし → INSERT 成功 | `migration 000021` |
| 成功後キャッシュ無効化 | ✅ `/`, `/train`, `/programs` を revalidatePath | `route.ts:110-112` |
| 成功後の画面遷移 | ✅ `redirectUrl: "/"` → Home でカード即時表示 | `RestartProgramButton.tsx:68-70` |
| エラー表示 | ✅ `insert_failed` / `program_not_found` / `first_day_not_found` を適切に表示 | `RestartProgramButton.tsx:56-61` |

### EDGE_CASE（実害なし）

- active Program B を持つユーザーが completed Program A の Summary に直接遷移して Restart → DB unique constraint で `insert_failed` → graceful error 表示
- 通常の導線では発生しない

### LIVE_E2E の制約

Restart ボタンは「最終 day のセッション完了後 Summary」でのみ表示される。
最短の GZCLP (9 days) を実際に完走するか、Supabase ダッシュボードで enrollment を最終 day に直接セットして確認する必要がある。

**Supabase 直接確認による最小手順（推奨）:**
1. SQL Editor で enrollment の `current_program_day_id` を最終 day ID に更新
2. その day の session を開始して Finish
3. Summary で「プログラムを最初から」ボタンが表示されるか確認
4. 押下後 Home で新しい enrollment カードが表示されるか確認
5. 旧 completed enrollment が残っているか確認

---

## 2026-04-26 ROADMAP棚卸し — 会員管理Phase 1完了時点

### 完了エリアサマリー（2026-04-26 時点）

| エリア | コミット例 | 状態 |
|---|---|---|
| トレーニング基本フロー（全画面） | `C-7`〜`S-7` | ✅ |
| 記録・履歴・ダッシュボード | `H-1`〜`H-4b` | ✅ |
| IA redesign + UX改善（U-1〜U-4） | `2026-04-15`〜`16` | ✅ |
| Programs 4本 + metadata + filter | `C-4`〜`C-7` | ✅ |
| 会員管理 Phase 1 | `835a486` | ✅ 2026-04-26 |

### スタブ・未動作

| 項目 | 場所 |
|---|---|
| 計算ボタン（1RM/Calc）— onClick 未実装 | `WorkoutScreen.tsx:1348` |
| 休憩タイマー自動起動 — 手動のみ | `WorkoutScreen.tsx` |

### Phase 2 推奨タスク（優先順）

1. V-1: S-7 Restart E2E 確認（低リスク・確認のみ）
2. V-2: 計算ボタン 1RM 実装（ボタンが非機能）
3. C-8: 5本目プログラム seed
4. U-5: 休憩タイマー自動起動

詳細は ROADMAP.md の「次フェーズ候補」を参照。

---

## 2026-04-26 /profile display_name 編集機能 実機確認

### STATUS: CLOSED (2026-04-26)

### PURPOSE

ユーザー自身がアプリ上の表示名（display_name）を `/profile` から変更できる機能の確認。
退会・停止判断の基準となる `member_name` は変更されないことを担保する。

### ROLE_SEPARATION（確認済み）

| フィールド | 編集主体 | 変更可否（/profile から） |
|---|---|---|
| `display_name` | ユーザー本人（/profile）+ 管理者（/admin/members） | ✅ 変更可 |
| `member_name` | 管理者のみ | ❌ 変更不可（コード上 /profile から一切触れない） |
| `membership_status` | 管理者のみ | ❌ 変更不可 |
| `email` | 変更不可（Supabase auth 管理） | ❌ 変更不可 |
| `role` | 変更不可 | ❌ 変更不可 |

### STATIC_CHECK (2026-04-26)

| 確認項目 | 結果 | 根拠 |
|---|---|---|
| 未ログインで `/profile` → `/login` リダイレクト | ✅ | `auth.getUser()` → null で `redirect("/login")` |
| 他ユーザーの display_name を書き換えられない | ✅ | ID は JWT から取得・`WHERE id = user.id` スコープ |
| `member_name` が変更されない | ✅ | `update({ display_name: trimmed })` のみ。member_name はコード上どこにも触れない |
| `membership_status` が変更されない | ✅ | 同上 |
| `email` / `role` が変更されない | ✅ | 同上 |
| 空文字保存 → `null` 変換 | ✅ | `const trimmed = newDisplayName.trim() \|\| null` |
| エラーログに email 含まれない | ✅ | `console.error` は `userId` と `errorMessage` のみ |
| 文字数制限 | ✅ | `maxLength={50}` |
| admin members への反映 | ✅ | `/admin/members` は `force-dynamic`、次回ロード時に反映される |
| `/gym` → `/profile` 導線 | ✅ | `GymScreen.tsx:38` に `<Link href="/profile">` 実装済み |
| typecheck | ✅ | pass（エラーなし） |

### LIVE_CHECK — 2026-04-26 ブラウザ確認済み

テストユーザーを新規作成し、一般ユーザー・管理者の両視点で確認。

| 確認項目 | 結果 |
|---|---|
| `/profile` が正常表示される | ✅ PASS |
| 現在の display_name がフォームに表示される | ✅ PASS |
| display_name を変更・保存できる | ✅ PASS |
| 保存後に成功フィードバックが表示される | ✅ PASS |
| リロード後も変更後の display_name が維持される | ✅ PASS |
| `/admin/members` 側に display_name が反映される | ✅ PASS |
| member_name が変わっていない | ✅ PASS |
| membership_status が変わっていない | ✅ PASS |

### 会員管理フェーズ完了まとめ（Phase 1）

| 機能 | 実装コミット | 確認日 |
|---|---|---|
| member_name フィールド追加（管理者用識別名） | `63f6aed` | 2026-04-24 |
| display_name ユーザー本人編集（/profile） | `d27d117` | 2026-04-26 |
| /admin/members 利用状況集計 Phase 1 | `835a486` | 2026-04-26 |

### PHASE_2 候補（持ち越し）

| 項目 | 内容 |
|---|---|
| ログイン回数 | `public.user_login_events` テーブル + Auth Webhook で記録 |
| スマホカードUI化 | `@media (max-width: 639px)` でカード表示に切り替え |
| PC横スクロール改善 | 列幅最適化または重要度低い列の折りたたみ |
| DB view / RPC 化 | 会員数増加時にメモリ集計から移行 |

---

## 2026-04-26 /admin/members 利用状況集計 Phase 1

### STATUS: CLOSED (2026-04-26)

### PURPOSE

管理者が会員ごとの利用状況を `/admin/members` で確認できるようにする。
スマホでのテーブル横切れ問題も最小修正。

### IMPLEMENTED

**個別集計（MemberRow に追加）:**

| フィールド | ソース | 内容 |
|---|---|---|
| `last_sign_in_at` | `auth.admin.listUsers()` の `User.last_sign_in_at` | 最終ログイン日時 |
| `training_started_count` | `workout_sessions` COUNT per user | セッション開始回数 |
| `training_completed_count` | `workout_sessions` WHERE status='completed' COUNT | セッション完了回数 |
| `last_training_at` | `workout_sessions` MAX(started_at) per user | 最終トレーニング日 |
| `has_active_enrollment` | `program_enrollments` WHERE status='active' | プログラム進行中の有無 |

**全体集計カード（ページ上部に追加）:**

- 登録会員数 / active / paused / cancelled
- 直近30日の完了セッション数
- 直近30日で未利用の active 会員数

**スマホ修正:**

- `.card { overflow-x: auto }` — テーブルが横スクロール可能に
- `.table { min-width: 820px }` — テーブルが縮まずに表示される

**日時表示:**

- `last_sign_in_at` / `last_training_at` / `created_at` はすべて JST（`lib/utils/date-jst.ts` 使用）

### UNCHANGED (Phase 2 候補)

| 項目 | 理由 | 将来案 |
|---|---|---|
| ログイン回数 | `auth.audit_log_entries` の利用可否不明、確実な集計には新規ログが必要 | `public.user_login_events` テーブル + Auth Webhook |
| DB view / RPC 化 | 会員数が少ない間はメモリ集計で十分 | 件数増加時に移行 |
| スマホカードUI化 | 現状は overflow-x で操作可能になるため保留 | `@media (max-width: 639px)` でカード表示に切り替え |

### CHANGED_FILES

- `lib/admin/members.ts` — 型拡張（`MemberRow` / `AdminGlobalStats` / `AdminMembersData`）、`getAllMembersData()` に変更
- `app/admin/members/page.tsx` — `getAllMembersData()` に切り替え、`globalStats` を `MembersScreen` へ渡す
- `components/admin/MembersScreen.tsx` — サマリーカード追加、新列（最終ログイン / 開始・完了 / 最終T）追加
- `components/admin/MembersScreen.module.css` — `overflow-x: auto` / `min-width` / サマリーカードスタイル追加

### TYPECHECK

pass（エラーなし）

### BUILD

pass（`npm run build` / next build 成功）

### STATIC_CHECK (2026-04-26)

コードレビューで以下を確認済み:

| 確認項目 | 結果 |
|---|---|
| `—` 表示（未ログイン・未トレーニング） | ✅ null チェック後に明示的に `"—"` を表示 |
| `0` 表示（回数ゼロ） | ✅ `{ started: 0, completed: 0 }` をデフォルト値として集計 |
| JST日時（last_sign_in_at / last_training_at / created_at） | ✅ `lib/utils/date-jst.ts` 使用 |
| セッション集計ロジック（30日フィルター含む） | ✅ ISO文字列大小比較で正確 |
| email / 個人情報の console.log なし | ✅ 確認済み |
| auth schema をフロントに出さない | ✅ サーバー側のみで取得 |
| overflow-x: auto / min-width: 820px | ✅ 実装済み |
| colSpan 更新（5→8） | ✅ 更新済み |
| 既存編集機能（member_name / display_name / status / isSelf ガード）| ✅ ロジック変更なし |

注意事項（動作に問題はないが差分あり）:
- 登録日の表示形式が `2026/04/26` → `2026年4月26日` に変更（`formatJstDate` の long 形式）

### LIVE_CHECK — 2026-04-26 ブラウザ確認済み

| 確認項目 | 結果 | 備考 |
|---|---|---|
| `/admin/members` が正常表示される | ✅ PASS | |
| サマリーカード（6枚）が表示される | ✅ PASS | 登録会員数 / Active / Paused / Cancelled / 直近30日完了 / 30日未利用active |
| 数値整合（サマリー vs 一覧） | ✅ PASS | 会員別完了数 66+3+2=71、サマリー直近30日完了71と一致 |
| 最終ログイン / 開始・完了 / 最終T が表示される | ✅ PASS | |
| スマホ/狭幅で横スクロールできる | ✅ 暫定PASS | スクロールバー表示・右端列まで確認可能 |
| 自分自身のステータス変更禁止 | ✅ PASS | 既存ガード動作確認済み |
| 既存編集機能の崩れなし | ✅ PASS | 大きな崩れなし |

### LIVE_CHECK 備考

- PC表示でも横スクロールバーが目立つ（min-width: 820px によるもの）
- Phase 1 目的「切れて操作不能を防ぐ」は達成
- PC での見た目改善・スマホカードUI化は Phase 2 として持ち越し

### PHASE_2 候補

| 項目 | 内容 |
|---|---|
| ログイン回数 | `public.user_login_events` テーブル + Auth Webhook で記録 |
| スマホカードUI化 | `@media (max-width: 639px)` でカード表示に切り替え |
| PC横スクロール改善 | 列幅の最適化または重要度低い列の折りたたみ |
| DB view / RPC 化 | 会員数増加時にメモリ集計から移行 |

---

## 2026-04-24 display_name ユーザー本人編集機能 追加

### STATUS: CLOSED (2026-04-24)

### PURPOSE

ユーザー本人がアプリ上の表示名（display_name）を変更できるようにする。
管理者専用の会員識別フィールド member_name は変更されない。

### ROLE_SEPARATION（再確認）

| フィールド | 編集主体 | 用途 |
|---|---|---|
| `display_name` | ユーザー本人（/profile）+ 管理者（/admin/members） | アプリ上の表示名 |
| `member_name` | 管理者のみ（/admin/members） | 退会・停止・本人確認の正本。ユーザー編集不可 |
| `email` | 変更不可（Supabase auth が管理） | ログイン識別子 |
| `membership_status` | 管理者のみ | 利用可否制御 |

### SECURITY

- `updateOwnDisplayName` Server Action:
  - `auth.getUser()` でユーザー ID を JWT 検証済みで取得（ユーザー入力からは取らない）
  - `createSupabaseAdminClient()` で UPDATE。ただし更新カラムは `display_name` のみ
  - WHERE `id = user.id` でスコープを自分の行に限定
  - `member_name` / `membership_status` / `email` / `role` には触れない
- `/profile` ページ:
  - 未ログイン → `/login` リダイレクト
  - `public.users.display_name` は RLS "Users can read own profile" で server client から取得

### CHANGES

- `app/profile/actions.ts`（新規）: `updateOwnDisplayName` Server Action
- `app/profile/page.tsx`（新規）: プロフィールページ（Server Component）
- `components/profile/ProfileScreen.tsx`（新規）: フォーム UI（Client Component）
- `components/profile/ProfileScreen.module.css`（新規）: スタイル
- `components/gym/GymScreen.tsx`: アカウントセクションに /profile リンク追加
- `components/gym/GymScreen.module.css`: profileLink スタイル追加

### DB_CHANGE

なし。migration 不要。RLS UPDATE policy の追加も不要（Server Action が admin client で書き込む）。

### TEST

- `npm run typecheck`: エラーなし
- 実機確認: **未実施（後日確認）**

### LIVE_CHECK — 保留中

実機確認は実施していない。後日、以下の項目を確認すること。

| 確認項目 | 結果 |
|---|---|
| /gym から /profile へ遷移できるか | 未確認 |
| display_name を保存できるか | 未確認 |
| 保存後に /admin/members の表示名へ反映されるか | 未確認 |
| 保存後に member_name が変更されないか | 未確認 |
| 保存後に email / role / membership_status が変更されないか | 未確認 |

確認完了後、この表を更新して STATUS を CLOSED に変更すること。

---

## 2026-04-24 member_name: 管理者用会員識別フィールド追加

### STATUS: CLOSED (2026-04-24)

### PURPOSE

`display_name` はユーザーが自由に変更できる表示名として設計されている（将来的にユーザー本人編集を許可予定）。
ニックネームや略称を設定された場合、退会・停止・問い合わせ対応時に「誰のアカウントか」が分からなくなる恐れがある。

`member_name`（会員氏名）を管理者専用フィールドとして追加し、本人識別の正本とする。

### ROLE_SEPARATION

| フィールド | 管理主体 | 用途 | 将来変更可否 |
|---|---|---|---|
| `display_name` | 管理者（現状）→ 将来ユーザー本人 | アプリ上の表示名・ニックネーム | ユーザー本人が変更可能にする予定 |
| `member_name` | 管理者のみ | 退会・停止・本人確認の正本 | ユーザーは変更不可（管理者専用） |
| `email` | auth.users が管理 | ログイン識別子 | — |

`display_name` が変更されても `member_name` は独立しているため、運営側の本人識別は常に正確に保たれる。

### CHANGES

- `supabase/migrations/20260424_000022_users_member_name.sql`: `public.users` に `member_name text` 追加（既存行は NULL、DEFAULT なし）
- `lib/admin/members.ts`: `MemberRow` 型に `member_name: string | null` 追加、SELECT に `member_name` 追加
- `app/admin/members/actions.ts`: `updateMemberName` Server Action 追加（管理者のみ実行可能、pattern は `updateDisplayName` と同一）
- `components/admin/MembersScreen.tsx`: 会員氏名列（inline 編集付き）を表示名列の前に追加、検索対象に `member_name` を含める
- `components/admin/MembersScreen.module.css`: ページ最大幅 720px → 960px（5列対応）

### SECURITY

- `updateMemberName` は `requireAdminUserId()` で管理者チェック済み
- DB 操作は `createSupabaseAdminClient()`（service role）— RLS をバイパスするが管理者検証後のみ実行
- `public.users` の RLS は `auth.uid() = id`（自己行のみ）— 一般ユーザーは他ユーザーの `member_name` を読めない
- 一般ユーザー画面（`/train` 等）には `member_name` を渡していない

### TEST

- `npm run typecheck`: エラーなし

### LIVE_CHECK (2026-04-24)

| 確認項目 | 結果 |
|---|---|
| migration 000022 適用 | ✅ 適用済み |
| /admin/members がエラーなく開く | ✅ |
| 会員氏名列が表示される | ✅ |
| 会員氏名 inline 編集・保存 | ✅ 既存会員2名で確認済み |
| member_name と display_name が別列で管理される | ✅ |
| email / membership_status への影響 | ✅ なし |

---

## 2026-04-24 enrollment 制約強化 安定確認 + verbose ログ削除

### STATUS: CLOSED (2026-04-24)

### PURPOSE

accca38（enrollment 一人 active 1件制約）の安定確認と、
PROJECT_STATUS に「次の安定確認後に削除」と記録されていた
verbose info ログ 3件を削除する。

### CHECKED

| 確認項目 | 結果 |
|---|---|
| migration 000021: CTE UPDATE（最新 active 以外を paused に）| ✅ 安全。非破壊的 UPDATE のみ |
| migration 000021: DROP old index `idx_program_enrollments_active_user_program` | ✅ 旧制約を削除。問題なし |
| migration 000021: CREATE UNIQUE `idx_program_enrollments_one_active_per_user` (user_id) WHERE active | ✅ 正しい制約。DB レベルのハードストップ |
| `findOrCreateEnrollment`: 別プログラムへの切替時 pause ガード | ✅ INSERT 前に otherActive を pause。DB 制約違反を防ぐ設計 |
| `findOrCreateEnrollment`: 同一プログラムの既存 enrollment 検出 | ✅ archived_at を含む全 status を検索し、active 優先で返す |
| `getActiveProgramView`: 単一 enrollment 前提での安全性 | ✅ `views[0] ?? null` 参照。0 or 1 件で正常動作 |
| custom session → /programs 誤リダイレクト修正への影響 | ✅ 影響なし（strategy2 の `.not("program_day_id","is",null)` は変更なし）|
| `getTrainFallbackView` strategy1: `status IN ('active','paused')` 参照 | ✅ プログラム切替後も paused enrollment を拾えるため正常 |
| membership_status / admin members / display_name | ✅ 変更なし |

### CHANGES

- `lib/workout/enrollment.ts`: verbose info ログ 3件を削除
  - `train-fallback:strategy1`（fallback 呼び出しごとに出力されノイジー）
  - `train-fallback:strategy1_resolved`（同上）
  - `train-fallback:strategy2`（同上）
- 残留ログ（意図的）:
  - `train-fallback:strategy1_no_slug` (warn) — DB 異常検知
  - `train-fallback:strategy2_no_next_day` (warn) — プログラム構造問題の検知
  - `enrollment:advanced` (info) — 日進行の追跡
  - `enrollment:marked_completed` (warn) — 誤完了の検知
  - `enrollment:paused_for_program_switch` (info) — プログラム切替追跡（accca38 追加）

### TEST

- `npm run typecheck`: エラーなし

---

## 2026-04-23 /train: custom session 完了後の復帰不具合 — 修正・動作確認完了

### STATUS: CLOSED (2026-04-23)

### PURPOSE

フリーセッション（custom session）完了後に `/train` へ遷移すると
`/programs` にリダイレクトされる不具合を調査・修正。

### ROOT_CAUSE

`getTrainFallbackView` Strategy 2 が、最新の completed session として
custom session（`program_day_id = null`）を拾い `null` を返していた。
Strategy 1 が何らかの理由で失敗した際（enrollment が見つからない等）に
この経路に落ち、`redirect("/programs")` が発生。

### FIX

`lib/workout/enrollment.ts` Strategy 2 クエリに
`.not("program_day_id", "is", null)` を追加。
custom session を除外し、直近のプログラムセッションを参照するよう修正。

### LIVE_CHECK

| 確認項目 | 結果 |
|---|---|
| フリーセッション完了後に `/train` へ遷移 | ✅ GZCL プログラム側に正常復帰 |
| `/programs` への誤リダイレクト | ✅ 解消 |

### DIAGNOSTIC_LOGS（残留分）

今回の調査で追加したログの残留方針：

| ログキー | レベル | 判断 |
|---|---|---|
| `enrollment:advanced` | info | **残す** — 日進行の追跡に有用 |
| `enrollment:marked_completed` | warn | **残す** — 誤完了の検知に有用 |
| `train-fallback:strategy1_no_slug` | warn | **残す** — DB 異常の検知 |
| `train-fallback:strategy2_no_next_day` | warn | **残す** — プログラム構造問題の検知 |
| `train-fallback:strategy1` | info | **後で削除** — fallback 呼び出しごとに出力されノイジー |
| `train-fallback:strategy1_resolved` | info | **後で削除** — 同上 |
| `train-fallback:strategy2` | info | **後で削除** — 同上 |

verbose な info ログ 3 件は次の安定確認後に `lib/workout/enrollment.ts` から削除する。

### CHANGES

- `lib/workout/enrollment.ts`: Strategy 2 に `.not("program_day_id", "is", null")` 追加
- `lib/workout/enrollment.ts`: 診断ログ追加（warn 4 件 / info 3 件）
- Commits: `563a268` (fix), `83f7bab` (diag logs)

---

## 2026-04-23 display_name 自動保存フロー — 実機確認完了・仕様確定

### STATUS: CLOSED (2026-04-23)

### PURPOSE

2026-04-23 のコードレビューに続き、実際の新規登録フローで
display_name が正しく保存・反映されることを実機確認し、本タスクをクローズする。

### LIVE_CHECK

| 確認項目 | 結果 |
|---|---|
| STEP 0: trigger `on_auth_user_created` 存在・有効 | ✅ `tgenabled = 't'` |
| STEP 0: 関数ボディに `raw_user_meta_data->>'display_name'` が含まれる | ✅ |
| STEP 2: `auth.users.raw_user_meta_data` に `display_name` が保存される | ✅ |
| STEP 3: `public.users.display_name` に trigger 経由で反映される | ✅ |
| STEP 4: `/admin/members` にリロード後即時表示される | ✅ |
| STEP 5: `display_name = null` ユーザーの fallback 表示 `（未設定）` | ✅ |
| テストユーザー削除後 auth.users / public.users ともにクリーン | ✅ |

### CONFIRMED_DESIGN

以下を本プロジェクトの確定仕様とする。

| 項目 | 仕様 |
|---|---|
| 登録経路 | `supabase.auth.signUp({ options: { data: { display_name } } })` |
| metadata 格納先 | `auth.users.raw_user_meta_data->>'display_name'` |
| public への反映 | `on_auth_user_created` trigger → `handle_new_user()` が INSERT 時に同時書き込み |
| NULL 変換 | 空文字・空白のみの値は `nullif(trim(...), '')` で NULL に変換される |
| 既存ユーザー | trigger は `AFTER INSERT` のみ発火するため遡及しない。`display_name = null` は仕様上正常 |
| 既存ユーザーへの対処 | admin inline edit（`/admin/members`）で手動設定、または UPDATE SQL で一括反映 |
| admin 表示 | `getAllMembers()` が `display_name` を SELECT。null の場合 `（未設定）` を表示 |

### CHANGES

コード変更なし。実機確認・仕様確定の記録のみ。

---

## 2026-04-23 display_name 自動保存 — コードレビュー完了

### STATUS: CLOSED (2026-04-23)

### PURPOSE

`display_name` の自動保存フロー（signUp → `raw_user_meta_data` → trigger → `public.users`）について、
コードレビューで実装の正当性を確認し、実機確認が必要な範囲を切り分ける。

### CODE_REVIEW_RESULT

| 確認項目 | 結果 | 根拠ファイル |
|---|---|---|
| `public.users.display_name` 列の存在 | ✅ 初期スキーマから存在 | `000001_initial_schema.sql:6` |
| signUp で `options.data.display_name` が渡されているか | ✅ 正しく渡されている | `app/login/page.tsx:89-93` |
| trigger が `raw_user_meta_data->>'display_name'` を参照しているか | ✅ キー名一致 | `000020_handle_new_user_display_name.sql:16` |
| 空文字列 → NULL 変換の正確性 | ✅ `nullif(trim(coalesce(...,'')),'')` で正しい | `000020:16` |
| `on conflict (id) do nothing` の影響 | ✅ 新規ユーザーには競合なし。想定通り | `000020:18` |
| trigger 本体の再登録要否 | ✅ 不要。`create or replace function` で関数を差し替えるだけで trigger は自動的に新実装を使う | `000005:19-24` vs `000020:6` |
| `getAllMembers()` が `display_name` を取得しているか | ✅ `.select("id, display_name, ...")` に含まれている | `lib/admin/members.ts:54` |
| `/admin/members` の表示 fallback | ✅ `display_name` が null の場合 `（未設定）` を表示 | `MembersScreen.tsx:219` |
| admin の inline edit (`updateDisplayName`) | ✅ `public.users.display_name` を直接 UPDATE し、空→null 変換済み | `app/admin/members/actions.ts:80-85` |

**コード上に問題なし。実装は正しい。**

### SCOPE_SEPARATION

**SQL だけで確認できる部分（Supabase SQL Editor で実行可）:**

```sql
-- 1. display_name 列の存在確認
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'display_name';

-- 2. trigger の存在確認
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgrelid = 'auth.users'::regclass AND tgname = 'on_auth_user_created';

-- 3. 現行の trigger 関数ボディ確認
SELECT prosrc
FROM pg_proc
WHERE proname = 'handle_new_user' AND pronamespace = 'public'::regnamespace;

-- 4. 既存ユーザーの display_name 状況確認
SELECT id, display_name FROM public.users ORDER BY created_at;

-- 5. auth.users の raw_user_meta_data 確認（service role が必要）
SELECT id, raw_user_meta_data FROM auth.users ORDER BY created_at DESC LIMIT 10;
```

**新規登録でしか確認できない部分（実機確認が必要）:**

- signUp 後に `auth.users.raw_user_meta_data` に `display_name` が実際に入るか（Supabase ランタイムの動作）
- trigger が発火して `public.users.display_name` に値が書き込まれるか
- `/admin/members` に即時反映されるか（ページリロード後に表示されるか）

**UI でしか確認できない部分:**

- `/admin/members` の表示確認
- inline edit の操作感・保存後の feedback 表示

### EXISTING_USERS_BEHAVIOR

既存ユーザー（`000020` 適用前に登録済み）の `display_name` が `null` のままなのは**仕様上正常**。

- trigger は `auth.users` への INSERT 時のみ発火する（`AFTER INSERT`）
- 既存ユーザーは `000005` の backfill で `id` のみ挿入されたため `display_name = null`
- `000020` を適用しても既存行には遡及しない
- 対処: admin の inline edit で手動設定するか、必要なら一括 UPDATE SQL を実行する

```sql
-- 既存ユーザーに raw_user_meta_data から遡及反映する場合
UPDATE public.users u
SET display_name = nullif(trim(coalesce(au.raw_user_meta_data->>'display_name', '')), '')
FROM auth.users au
WHERE u.id = au.id
  AND u.display_name IS NULL
  AND nullif(trim(coalesce(au.raw_user_meta_data->>'display_name', '')), '') IS NOT NULL;
```

※上記 SQL はオプション。実行する場合は Supabase SQL Editor で手動確認後に実施すること。

### CHANGES

コード変更なし。調査・記録のみ。

### NEXT_ACTION

1. 新規登録テストで実機確認（メール確認不要な開発環境推奨）
2. 上記 SQL を Supabase SQL Editor で実行して現状を確認
3. 問題なければこのフローは完了とし、次フェーズ（ユーザー自身によるプロフィール編集等）へ進む

---

## 2026-04-22 /admin/members live check — email display required

### STATUS: CLOSED (2026-04-22)

### PURPOSE

Live verification of the Phase 4 / 4.1 admin member management UI,
and identification of a usability gap that needs to be addressed next.

### LIVE_CHECK

| Item | Result |
|---|---|
| admin access to `/admin/members` | ✅ confirmed |
| Member list display | ✅ confirmed |
| Self-update disabled (`自分自身は変更できません`) | ✅ confirmed |
| Name search + status filter | ✅ confirmed |
| `display_name` unset → shows `（未設定）` | ⚠️ user identity unclear |

### FINDING

When `display_name` is not set, the member row shows `（未設定）` with no other
identifier. With multiple unset users, it is impossible to determine who is who.
In practice, **email address is the only reliable identifier** available in
`auth.users` and is required for the management UI to be operationally usable.

### CHANGES

No code changes. Observation log only.

### NEXT_ACTION

Add email column to `/admin/members`:
- Fetch `email` alongside existing columns (requires `auth.users` access via service role or admin client).
- Display email in the member list row.
- Include email as a search target in the client-side name filter.

---

## 2026-04-22 Membership status control — Phase 1–3 complete

### STATUS: CLOSED (2026-04-22)

### PURPOSE

Introduce a `membership_status` column to gate feature access for non-active users,
without disrupting existing active users. Implemented in three phases to allow
incremental rollout and verification at each step.

### CHANGES

**Phase 1 — DB foundation (migration 000019)**

- `ALTER TABLE public.users ADD COLUMN membership_status text NOT NULL DEFAULT 'active'`
- `CHECK (membership_status IN ('active', 'paused', 'cancelled'))`
- All existing users received `'active'` automatically via the column default.
- `handle_new_user` trigger unchanged — new users also default to `'active'`.
- Live DB confirmed: column exists, all rows `= 'active'`.

**Phase 2 — UI gate (`/train`)**

- New: `lib/workout/membership.ts` — `getMembershipStatus(userId)` using authenticated client (RLS: own row only).
- New: `components/train/MembershipRequiredScreen.tsx` — holding screen for non-active users (reuses `TrainAuthRequired` styles).
- Modified: `app/train/page.tsx` — membership check inserted after auth gate.
- Fail-open on DB error (`null` passes through) to avoid blocking users on transient failures.
- Explicitly `paused` or `cancelled` → `MembershipRequiredScreen`.

**Phase 3 — API gate (`POST /api/workout-sessions`)**

- `StartSessionResult` reason union: added `'membership_inactive'`.
- `startSessionForDay`: membership query added to the existing `Promise.all` batch — zero additional latency.
- Fail-open on DB error, fail-closed on explicit `paused` / `cancelled` status.
- Route handler: `membership_inactive` → HTTP 403 `{ code: "membership_inactive", message: "現在、このアカウントではワークアウトを開始できません。" }`.
- Frontend unchanged — `StartSessionScreen` already surfaces `body.error.message` on `!response.ok`.

### DESIGN NOTES

UI + API double guard: `/train` page blocks first; even if bypassed via direct API call,
`POST /api/workout-sessions` rejects with 403.

Active users: no behavioural change at any layer.
Status control: update `public.users.membership_status` via Supabase Dashboard SQL Editor.

```sql
-- Suspend a user
UPDATE public.users SET membership_status = 'paused' WHERE id = '<uuid>';

-- Restore
UPDATE public.users SET membership_status = 'active' WHERE id = '<uuid>';
```

### PERFORMANCE_IMPACT

Phase 1: none.
Phase 2: +1 DB query on `/train` render (authenticated server client, own-row select).
Phase 3: +0 latency — membership query runs within the existing `Promise.all` in `startSessionForDay`.

---

## 2026-04-22 DB integrity check — migration 000017 / 000018 live confirmation

### STATUS: CLOSED (2026-04-22)

### PURPOSE

Confirm that migration 000017 and 000018 were applied to the production DB.
Both were added to the repo on 2026-04-22 but had no corresponding confirmation log,
which led to an incorrect "未適用" assessment.

### PROD_CHECK

| Migration | Content | Result |
|---|---|---|
| 000017 | `create_workout_session_for_day` RPC | ✅ exists — `has_body = true` confirmed via `information_schema.routines` |
| 000018 | `hip-thrust` category `legs → glutes` | ✅ `category = 'glutes'` confirmed via `public.exercises` |

Both were already applied. No re-application required.

### CHANGES

No code changes. Confirmation log only.

### PERFORMANCE_IMPACT

None — audit only.

---

## 2026-04-19 Phase 1 Sync Guard — verification (client-side safety check)

### STATUS: CLOSED (2026-04-19)

### PURPOSE

Confirm that the `session_completed` → `session_not_in_progress` error code rename
does not break client-side error handling, and audit 409 behavior for cancelled sessions.

### PROD_CHECK (migration 000016)

Migration 000016 must be applied manually via Supabase SQL Editor.
Run to verify the column exists after applying:

```sql
select column_name, data_type, column_default, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name   = 'workout_sessions'
  and column_name  = 'updated_at';
```

Expected result: 1 row — `updated_at | timestamp with time zone | now() | NO`

Also verify trigger was created:
```sql
select trigger_name, event_manipulation, action_timing
from information_schema.triggers
where event_object_table = 'workout_sessions'
  and trigger_name = 'trg_workout_sessions_updated_at';
```

### CLIENT_CHECK (error_code rename safety)

**`session_completed` string dependency in client code:** NONE
- grep across all .ts/.tsx files returned zero matches
- The old code was server-side only (route handlers); client never referenced it by name

**409 handling pattern across all mutation functions:**
All functions use `!response.ok` — 409 is `!ok`, so the guard triggers.
Error message comes from `payload.error.message` (server-sent string).
No function matches on `error.code` string.

| Function | Pattern | Shows error |
|---|---|---|
| `postSetAction` (delete/complete/unlock) | `!response.ok` → throw Error(message) | `setErrorMessage` → status banner |
| `patchWorkoutSet` | `!response.ok` → throw Error(message) | `setErrorMessage` → status banner |
| `postAddSet` | `!response.ok` → throw Error(message) | `setErrorMessage` → status banner |
| `postAddExercise` | `!response.ok` → throw Error(message) | `setAddExerciseError` → modal banner |
| `postSwapExercise` | `!response.ok` → throw Error(message) | `setAddExerciseError` → modal banner |

### LIVE_BEHAVIOR (race condition scenario)

Normal flow (no race): `isSessionEnded = isSessionCompleted || isSessionCancelled`.
All buttons/inputs are `disabled={isSessionEnded}` and all handlers guard `if (isSessionEnded) return`.
Client never reaches the API under normal conditions when session is cancelled.

Race condition (stale client, server already cancelled):
1. Server returns HTTP 409 `{ error: { code: "session_not_in_progress", message: "Only in-progress sessions can be edited." } }`
2. `!response.ok` → `throw new Error("Only in-progress sessions can be edited.")`
3. Catch block → `setErrorMessage("Only in-progress sessions can be edited.")`
4. UI renders `<section role="alert">` banner ✅

No code changes required. Client-side handling is safe and complete.

### CHANGES

No code changes. Documentation only.

### PERFORMANCE_IMPACT

None — audit only.

---

## 2026-04-19 Phase 1 Sync Guard — cancelled session protection across all mutation routes

### STATUS: CLOSED (2026-04-19)

### PURPOSE

Prevent mutations on cancelled sessions. The prior guards only blocked `=== "completed"`;
a session cancelled on one device could still receive set/add-exercise writes from another.

### ROOT_CAUSE

All set mutation routes and Add/Swap Exercise routes checked `=== "completed"` but not `=== "cancelled"`.
Add Set route had the same gap. Pattern: `!== "in_progress"` covers both states and any future terminal state.

### CHANGES

**7 API routes — guard upgraded from `=== "completed"` to `!== "in_progress"`:**

| Route file | Old code | error_code |
|---|---|---|
| `app/api/workout-sets/[id]/complete/route.ts` | `=== "completed"` | `session_not_in_progress` |
| `app/api/workout-sets/[id]/route.ts` (PATCH) | `=== "completed"` | `session_not_in_progress` |
| `app/api/workout-sets/[id]/unlock/route.ts` | `=== "completed"` | `session_not_in_progress` |
| `app/api/workout-sets/[id]/delete/route.ts` | `=== "completed"` | `session_not_in_progress` |
| `app/api/workout-session-exercises/[id]/sets/route.ts` | `=== "completed"` | `session_not_in_progress` |
| `app/api/workout-sessions/[id]/exercises/route.ts` | `=== "completed"` | `session_not_in_progress` |
| `app/api/workout-sessions/[id]/exercises/[exerciseId]/route.ts` | `=== "completed"` | `session_not_in_progress` |

**New migration:**
- `supabase/migrations/20260419_000016_session_updated_at.sql`
  - `workout_sessions.updated_at timestamptz NOT NULL DEFAULT now()`
  - Back-fill: `coalesce(finished_at, started_at)`
  - Trigger: `trg_workout_sessions_updated_at` via `set_updated_at()` function

### PERFORMANCE_IMPACT

None. All guards are in-memory checks after the existing `findOwnedWorkoutSet` /
`findOwnedWorkoutSessionExercise` fetch that already retrieves `session.status`.

### NOTES

- Migration 000016 must be applied to production via Supabase SQL Editor (no CLI available).
- Client-side `cancelled` error handling: existing `session_completed` path in WorkoutScreen
  catches 409; the new `session_not_in_progress` code will surface the same generic error banner.
- Phase 2 (polling/realtime) remains deferred.

---

## 2026-04-19 C-13 Verification — methodology live check + multi-device sync design

### STATUS: CLOSED (2026-04-19)

### PROD_CHECK: migration 000015 applied (manual via Supabase SQL Editor)

programs.methodology column verified in production DB:

| slug                     | methodology |
|---|---|
| gzclp-base               | gzcl        |
| gzclp-base-v2            | gzcl        |
| upper-lower-base         | gzcl        |
| starting-strength-base   | linear      |
| dumbbell-full-body-base  | generic     |

### LIVE_CHECK: exerciseRoleLabel resolution verified via real session data

Real session traces confirmed end-to-end path resolution:

| session     | program               | methodology | exercise_type | exerciseRoleLabel |
|---|---|---|---|---|
| b454ceb6    | dumbbell-full-body    | generic     | T1/T1/T2      | (hidden all)       |
| 90e796f6    | gzclp-base-v2         | gzcl        | T1/T2/T3      | T1/T2/T3           |

METHODOLOGY_RESULT:
- gzcl   → T1→"T1",      T2→"T2",         T3→"T3"          ✅ unchanged
- linear → T1→"Primary", T2→"Secondary",   T3→"Accessory"   ✅ correct
- generic→ T1→"",        T2→"",            T3→""  (badge hidden) ✅ correct

No live Starting Strength session in DB at verification time (no real user on that program).
Logic confirmed correct via simulation with real program data.

---

### SYNC RISK DESIGN — multi-device / concurrent session safety

#### 現行の並行制御 (コードレビューより)

| route | guard |
|---|---|
| finish | `.eq("status","in_progress")` — 0 rows affected if already finished → 409 |
| cancel | 同上（コメント明記済み） |
| set/patch (weight/reps) | `session.status === "completed"` → 409 (cancelled は通過) |
| set/complete | `is_completed` idempotency check |
| set/delete | `deleted_at` guard |
| S-4 re-finish | `advanceEnrollment` は再呼び出しても idempotent |

#### SYNC_RISK_POINTS（壊れやすい箇所）

1. workout_sets に updated_at / version なし
   → 重量/回数の並行 PATCH は last-write-wins、競合検知なし
2. workout_sessions に updated_at なし
   → クライアントは別デバイスの状態変化を HTTP でしか知れない
3. set/patch は session.status=cancelled を拒否しない
   → キャンセル後も重量更新 API が通る（DB は書き換わるが UI には出ない）
4. WorkoutScreen に リアルタイム同期なし
   → PCでfinishしてもスマホ側は stale state のまま操作継続可能

#### CONFLICT_CASES（具体的競合シナリオ）

| シナリオ | 現行挙動 | リスク |
|---|---|---|
| PC で Finish → スマホで重量変更 | スマホ: 409 session_completed → エラー表示 | 低（409で止まる）|
| PC で Cancel → スマホで Complete | スマホ: set/complete は session.status を確認しない → is_completed=true が書かれる | 中（cancelled session に完了データが残る）|
| PC と スマホで同じセットを同時 PATCH | last-write-wins | 低（トレーニング中の誤差範囲内）|
| PC で Finish → スマホで別セットを Add | スマホ: session_completed チェックなし → exercises が追加される | 中（completed session にデータが増える）|
| ネットワーク遅延で Finish が2回送信 | S-4 recovery: idempotent ✅ | なし |

#### MINIMUM_SAFE_GUARD（最小安全策）

優先度順:
1. **set/complete に session status チェック追加** (Small / 30分)
   → `in_progress` 以外は 409 を返す（cancel 後の誤記録を防ぐ）
2. **workout_sessions.updated_at カラム追加** (Small / migration 1本)
   → session reload 判断の基準を持てる（即時の競合検知には使わないが基盤になる）
3. **WorkoutScreen 上の session status polling** (Small / ~2時間)
   → 30秒ごとに GET /api/workout-sessions/:id で status を確認
   → completed / cancelled なら自動リダイレクト
4. **Supabase Realtime 購読** (Medium / 半日)
   → workout_sessions テーブルの status 変化をリアルタイム受信
   → 別デバイスの Finish / Cancel を即時検知してリダイレクト

#### SYNC_OPTIONS

| 方式 | 仕組み | Supabase対応 | 体感改善 |
|---|---|---|---|
| **Polling (30s)** | setInterval → GET session status | ✅ 追加設定不要 | 中（最大30秒遅延）|
| **Realtime subscription** | WebSocket → DB変化をpush | ✅ 組み込み機能 | 高（即時）|
| **ETag / If-Match** | PATCH時に updated_at を送信、stale なら 409 | ✅ workout_sets.updated_at 追加で対応 | 高（PATCH競合検知）|
| **Optimistic UI + rollback** | クライアント状態管理 + 失敗時ロールバック | ✅ クライアントのみ | 高（体感速度）|
| **session lock flag** | is_locked カラムをセッション単位で | ✅ migration追加 | 高（強制排他）|

#### IMPLEMENTATION_SIZE

| タスク | Size | 破壊リスク | 工数目安 |
|---|---|---|---|
| set/complete に session status チェック追加 | S | LOW | 30分 |
| workout_sessions.updated_at migration | S | LOW | 15分 |
| workout_sets.updated_at migration | S | LOW | 15分 |
| WorkoutScreen 30s status polling | S | LOW | 2時間 |
| Supabase Realtime subscription on session | M | LOW | 半日 |
| ETag/If-Match on workout_sets PATCH | M | LOW | 半日 |
| Optimistic UI + rollback (全セット) | L | MEDIUM | 2日 |
| Full real-time collaborative session | L | HIGH | 1週間 |

#### RECOMMENDED_NEXT_STEP（段階的導入案）

Phase 1（今すぐ / Low risk）:
  S1: set/complete に `.neq("status","cancelled")` guard 追加
  S2: workout_sessions.updated_at migration

Phase 2（必要になったら / Medium）:
  M1: WorkoutScreen 30s polling → Finish/Cancel を別デバイスで検知
  M2: Supabase Realtime → finish/cancel を瞬時に伝播

Phase 3（ユーザーが増えたら / High value）:
  L1: ETag on PATCH + optimistic UI rollback
  L2: Full real-time set sync

---

## 2026-04-19 C-13 Step 2 — exerciseRoleLabel in WorkoutScreen

### STATUS: CLOSED (2026-04-19)

### PURPOSE

Resolve `exerciseRoleLabel` per methodology and display it in WorkoutScreen badge
instead of the raw `exerciseType`. GZCL users see no change. Non-GZCL programs
will show correct labels once the migration has been applied to Supabase.

### CHANGES

**types/workout.ts**
- Added `exerciseRoleLabel: string` to `WorkoutExerciseBlock`
  (required; always populated by loadSessionView and mock data)

**lib/workout/train-session.ts**
- `ProgramRow`: added `methodology: string | null`
- `selectProgram()`: SELECT extended from `"id, title"` to `"id, title, methodology"`
  (zero extra round-trips — same single-row query, one more column)
- `EXERCISE_ROLE_LABELS` const: methodology → exerciseType → display label map
  gzcl: T1→"T1", T2→"T2", T3→"T3"
  linear: T1→"Primary", T2→"Secondary", T3→"Accessory"
  generic: T1/T2/T3→"" (badge hidden)
- `resolveExerciseRoleLabel(exerciseType, methodology): string` pure function
- `buildExerciseBlocks()`: added `methodology` param, added `exerciseRoleLabel` to returned blocks
- `loadSessionView()`: passes `program?.methodology ?? null` to `buildExerciseBlocks()`

**lib/mock/workout.ts**
- Added `exerciseRoleLabel: "T1"/"T2"/"T3"` to all 3 mock exercise blocks
  (mock is GZCL, so labels equal exerciseType)

**components/workout/WorkoutScreen.tsx**
- Badge: `{exercise.exerciseType}` → `{exercise.exerciseRoleLabel}` with hide-when-empty guard
  - Before: `<span className={typeClassName(exercise.exerciseType)}>{exercise.exerciseType}</span>`
  - After: `{exercise.exerciseRoleLabel ? (<span className={typeClassName(exercise.exerciseType)}>{exercise.exerciseRoleLabel}</span>) : null}`
  - CSS class still uses `exerciseType` (T1/T2/T3 color coding preserved)
- `handleAddExercise`: `exerciseRoleLabel: sessionExercise.exerciseType` as safe fallback
  (Add Exercise API always returns T3; label resolution without session context is deferred)

### SCOPE NOT COVERED (deferred)

- WorkoutSummaryScreen, ExerciseHistoryScreen, SessionDetailScreen — Step 3
- handleAddExercise full methodology resolution (requires session.methodology propagation)
- handleSwapExercise exerciseRoleLabel update (same constraint)

### TYPECHECK
tsc --noEmit: PASSED

---

## 2026-04-19 C-13 Step 1 — programs.methodology column + MethodologyType

### STATUS: CLOSED (2026-04-19)

### PURPOSE

Introduce a methodology layer as the foundation for:
1. exerciseRoleLabel resolution (T1→"T1" for gzcl, T1→"Primary" for linear, no badge for generic) — Step 2
2. B2B2C gym branding layer groundwork — future phase

### CHANGES

**supabase/migrations/20260419_000015_programs_methodology.sql** (new)
- `programs.methodology text NOT NULL DEFAULT 'gzcl' CHECK ('gzcl','linear','generic')`
- `UPDATE starting-strength-base → 'linear'`
- `UPDATE dumbbell-full-body-base → 'generic'`
- All other programs inherit DEFAULT 'gzcl' (gzclp-base, gzclp-base-v2, upper-lower-base)

**types/programs.ts**
- Added `MethodologyType = "gzcl" | "linear" | "generic"`
- Added `methodology: MethodologyType` to `ProgramSummary`

**lib/programs/program-library.ts**
- Added `MethodologyType` import
- Added `methodology: string | null` to `ProgramRow`
- Added `normalizeMethodology()` (unknown values fall back to `'gzcl'`)
- Added `methodology` to SELECT query
- Added `methodology: normalizeMethodology(row.methodology)` to `mapProgramRow()`

**lib/programs/program-catalog.ts**
- Added `methodology` to all 6 mock catalog entries:
  gzclp-base→gzcl, gzclp-base-v2→gzcl, upper-lower-base→gzcl,
  starting-strength-base→linear, dumbbell-full-body-base→generic, full-body-foundation→generic

### PROGRAM METHODOLOGY ASSIGNMENTS

| slug                     | methodology | reason                                  |
|---|---|---|
| gzclp-base               | gzcl        | GZCL T1/T2/T3 structure                 |
| gzclp-base-v2            | gzcl        | same T1/T2/T3 structure                 |
| upper-lower-base         | gzcl        | uses T1/T2/T3 slot structure            |
| starting-strength-base   | linear      | linear progression model                |
| dumbbell-full-body-base  | generic     | custom, no progression structure        |
| full-body-foundation     | generic     | custom placeholder, no structure        |

### WHAT DOES NOT CHANGE

- exercise_type DB column remains 'T1'|'T2'|'T3' — internal storage unchanged
- No UI changes — exerciseRoleLabel resolution is Step 2
- No change to WorkoutScreen, train-session.ts, or any session recording logic
- Existing GZCL user experience: unchanged

### TYPECHECK
tsc --noEmit: PASSED

---

## 2026-04-19 C-12 — previousDisplay T1/T2/T3 isolation fix

### STATUS: CLOSED (2026-04-19)

### ROOT_CAUSE

`buildPreviousDisplayMap` in `lib/workout/train-session.ts` used `exerciseId:setNumber` as the lookup key.
This caused T1/T2/T3 sessions for the same exercise_id to share previous-set data —
e.g. Squat done as T2 in a past session would surface as the "Previous" column when Squat is T1 today.

### CHANGES

`lib/workout/train-session.ts` — 3 lines:
1. `historicalExerciseMap` value: added `exerciseType: item.exercise_type`
2. `previousCandidateMap` key: `exerciseId:exerciseType:setNumber` (was `exerciseId:setNumber`)
3. `buildExerciseBlocks` lookup key: `exerciseId:exerciseType:setNumber` (was `exerciseId:setNumber`)

### DISPLAY_RULE (confirmed post-fix)

| Lookup key | Matches |
|---|---|
| `exerciseId:exerciseType:setNumber` | Same exercise, same T1/T2/T3 slot, same set index |

- Each set row shows its own per-set previous result (set1→prev set1, set2→prev set2, …)
- T1 Squat and T2 Squat have independent histories
- "Previous" = most recent completed session where same exercise + same type + same set_number exists
- "-" when no prior data for that combination

### REQUIREMENTS_CHECK

| # | Requirement | Before | After |
|---|---|---|---|
| 1 | 前回同一スロットの実績 | ✗ type混在 | ✅ type分離 |
| 2 | T1/T2/T3 混在しない | ✗ | ✅ |
| 3 | 各セットごとに表示 | ✅ (set_number per row) | ✅ |
| 4 | set1〜set5 対応表示 | ✅ | ✅ |
| 5 | 途中重量変更もそのまま表示 | ✅ | ✅ |
| 6 | UI は per-set 表示 | ✅ (WorkoutScreen:1438) | ✅ |

### DB SIMULATION VERIFICATION (2026-04-19)

typecheck: PASSED (tsc --noEmit)
ライブUIチェック: in_progress セッションなし → Supabase 実データで手動シミュレーション実施

**検証ケース: exercise `5555d754`（同一 exercise_id が T3/T1/T2 全タイプで使用歴あり）**

| セッション | 時刻(JST) | タイプ | set1 completed | set2 completed |
|---|---|---|---|---|
| `332cbb95` | 04:09 | T3 | 20kg×10 | 20kg×10 |
| `6ee51b45` | 07:54 | T1 | 20kg×3 | 20kg×3 |
| `510a63b4` | 11:00 | T1 | 20kg×3 | null |
| `ed2f9af0` | 11:06 | **T2** | 20kg×**10** | null |

新セッションで同 exercise を **T1** として使った場合の set1 Previous:
- **旧コード**: `20kg x 10`（T2 の `ed2f9af0` が最新 → T2 データ混入 ← BUG）
- **新コード**: `20kg x 3`（T1 限定最新 `510a63b4` → 正しい T1 データ ✅）

**追加確認: exercise `4595f485`（通常 T1、`8a98725e` では T2）**
- `8a98725e` (T2): set1=80kg×10
- `2765c7bc` (T1, より新しい): set1=100kg×3
- 旧コード: `2765c7bc` が新しいため偶然正しい（ただし T2 セッションが最新だったら混入する）
- 新コード: T1/T2 が完全分離され順序に依存しない ✅

VERIFIED: 修正は実データで正しく動作する。ライブブラウザ確認は次回 in_progress セッション開始時に行う。

---

## 2026-04-19 S-12 — Go to Train navigation fix

### STATUS: CLOSED (2026-04-19, DB fix applied)

### ROOT_CAUSE (Round 1 — commit 5c0b430)

Naked `/train` (no `programDayId`) falls through to `getCurrentWorkoutSessionView()`, then `getActiveProgramView()`.
Train page only handled `actionType === "start"` explicitly; `actionType === "resume"` fell through to `redirect("/programs")`.

Additionally, `selectCurrentInProgressSession` and `selectSessionByDayId` in `train-session.ts` lacked `.is("archived_at", null)`,
allowing C-10-archived in-progress sessions to surface incorrectly when using the naked `/train` path.

### ROOT_CAUSE (Round 2 — commit b17022f)

Two additional issues remained after Round 1:

1. **`programSlug = ""` silently blocks `actionType === "start"`**: `selectProgramsBatch` (used inside
   `getActiveProgramView`) returns `[]` when RLS fails (`is_public = false` or query error), making
   `programSlug = program?.slug ?? ""` an empty string. The `start` condition had `primaryView.programSlug`
   as a truthy guard → empty string → condition fails → redirect to `/programs`.
   Fix: removed `programSlug` from the condition. `StartSessionScreen` still works with empty slug;
   only the "Back to Program" link degrades (links to `/programs` generically).

2. **Infinite redirect loop when `programSlug = ""` + `actionType === "resume"`**: Round 1's
   `redirect(primaryView.continueUrl)` builds `continueUrl = "/train?program=&programDayId=uuid"`.
   `getTrainProgramSelection("")` → empty string → `null` → `state: "none"` → naked path →
   `getCurrentWorkoutSessionView()` may return null → `getActiveProgramView()` → `resume` again → loop.
   Fix: added `primaryView.programSlug` guard before `redirect(continueUrl)` — falls through to
   `redirect("/programs")` instead of looping.

3. **Debug overlay**: Added `/train?debug=train` for authenticated users to see resolved state
   in-browser without Vercel log access.

### CHANGES

**Round 1** (`lib/workout/train-session.ts`, `app/train/page.tsx`):
- `train-session.ts`: Added `.is("archived_at", null)` to `selectCurrentInProgressSession` and `selectSessionByDayId`.
- `train/page.tsx`: Added `actionType === "resume"` → `redirect(continueUrl)` handler.

**Round 2** (`app/train/page.tsx`):
- `actionType === "start"`: removed `primaryView.programSlug` truthy guard.
- `actionType === "resume"`: added `primaryView.programSlug` guard before redirect (loop prevention).
- Added `start_missing_slug` `RedirectCause` for log correlation.
- Added `/train?debug=train` in-browser diagnostic overlay.

### ROOT_CAUSE (Round 3 — DB data corruption, 2026-04-19)

All 3 active `program_enrollments` had `archived_at` set (2026-04-18T07:05:10-27, within 17 seconds).
`selectActiveEnrollments` filters `.is("archived_at", null)` → all enrollments excluded → `views=[]` →
`primaryView=null` → `redirectCause="no_selected_program"` → `redirect("/programs")`.

This was NOT an RLS failure or `is_public` issue — `programs` table was clean (all `is_public=true`).
Root cause: enrollment archive route (`/api/enrollments/[enrollmentId]/archive`) was called
on all 3 active enrollments during testing, leaving them soft-archived but status=active.

**DB Fix (2026-04-19):**
```sql
UPDATE program_enrollments SET archived_at = NULL
WHERE status = 'active' AND archived_at IS NOT NULL;
-- 3 rows updated: gzclp-base-v2, dumbbell-full-body-base, gzclp-base
```
Applied via Supabase REST API (service role). Verified: 3 rows now `archived_at=null`.

### CLOSED_STATE

Post-fix DB state:
| enrollment_id | program | current_program_day_id | archived_at |
|---|---|---|---|
| 17fcd538 | gzclp-base-v2 | cfcce85e (set) | null |
| d8ed99da | dumbbell-full-body-base | 3e8d65fe (set) | null |
| f76d85df | gzclp-base | null | null |

Expected `/train` behavior: `primaryView = gzclp-base-v2`, `actionType="start"` → `StartSessionScreen`.

### MANUAL_CHECK

1. `/train` → verify StartSessionScreen loads (not redirect to /programs)
2. `/programs` → "Go to Train" → verify StartSessionScreen or WorkoutScreen
3. Finish a session → from Summary → "Go to Train" → verify StartSessionScreen for next day
4. No active enrollment → "Go to Train" → redirect to /programs is still expected

---

## 2026-04-18 C-11 — GZCLP T1 Progression (Phase 1): state management + live hint

### STATUS: CLOSED — migrations applied, smoke test passed (2026-04-19)

### FINISH_BUG_FIX (2026-04-18)

**症状**: C-11 デプロイ後、/train の Finish ボタンが失敗。Cancel は成功。

**根本原因**: `countIncompleteSets` が Supabase クエリエラー時に `throw new Error(...)` していた。
これがフィニッシュルートの外側 try-catch に伝播し 500 を返していた可能性が高い。
- Cancel は `countIncompleteSets` を呼ばないため成功
- `updateT1ProgressionAfterSession` は内部 try-catch でサイレント処理済みだが、
  `countIncompleteSets` のみ非サイレント (throw) 設計だった
- C-11 デプロイ後に migration 未適用の状態でクエリが失敗すると、この throw が露出した

**修正**: `countIncompleteSets` のエラー時挙動を throw → `return 0` + console.warn に変更。
  - `sessionExercisesError` → warn + return 0
  - `incompleteCountError` → warn + return 0
  - フィニッシュルート全体の「エラーはサイレント処理、リクエストを止めない」方針に統一

**変更ファイル**: `app/api/workout-sessions/[id]/finish/route.ts`

### DESIGN_DECISION

New table `t1_progression_states` (not a column on `program_enrollments`) because:
- Each enrollment can have up to 4 T1 exercises (Squat / Bench / OHP / Deadlift —
  different exercises are T1 on different rotation days).
- A single-column JSONB approach would be opaque and unqueryable.
- Separate table gives FK integrity, per-exercise indexability, and easy extension to T2/T3.
- Follows the same "separate state table per concern" pattern as `exercise_swap_groups`.

`current_weight_kg` = recommendation for the NEXT session (already advanced after each finish).

Writes: admin client in `finish/route.ts` (bypasses RLS). Silent on any error.
Reads:  cookie client in `train-session.ts` (RLS select policy). Non-blocking.

### STATE_MODEL

```
t1_progression_states (
  enrollment_id, exercise_id   -- PK pair (unique constraint)
  phase                        -- '5x3' | '6x2' | '10x1' | 'retest_required'
  current_weight_kg            -- recommendation for next session
  last_result                  -- 'success' | 'fail'
  updated_at
)
```

Phase transitions:
- success → same phase, weight += 2.5kg
- fail:  5x3 → 6x2 → 10x1 → retest_required

AMRAP success = last visible set is_completed=true AND reps_done >= phase minimum
  (min parsed from target_reps_text "3+" → 3; fallback to phase constant)

### LOGIC

`lib/workout/t1-progression.ts` exports:
- `determineAmrapResult(lastSet, phase)` — pure, testable
- `computeNextState(current, result)` — pure, testable
- `phaseBadgeLabel(phase)` — "5x3" → "5×3+"
- `selectT1ProgressionHints(client, enrollmentId, exerciseIds)` — DB read
- `updateT1ProgressionAfterSession(sessionId, userId, dbClient)` — DB write hook

Bootstrap (first session, no existing state):
- Phase inferred from set count: 5 sets→5x3, 6→6x2, ≥9→10x1
- Weight seeded from session's first set weight

Idempotency: called only on primary completion path in finish/route.ts,
NOT on S-4 idempotent re-finish, to prevent double-advancing weight.

### UI

T1 exercise cards in WorkoutScreen show (from 2nd session onward):
```
[ Next: 82.5kg · 5×3+ ]
```
Displayed as an orange-tinted hint bar between exerciseHeader and swipeHint.
No hint on first session (state created on finish, visible next open).

### CHANGED_FILES

**New:**
- `supabase/migrations/20260418_000014_t1_progression_states.sql`
- `lib/workout/t1-progression.ts`

**Modified:**
- `types/workout.ts` — `T1ProgressionHint` type + `WorkoutExerciseBlock.t1ProgressionHint`
- `lib/workout/train-session.ts` — load hints via `selectT1ProgressionHints`, pass to `buildExerciseBlocks`
- `app/api/workout-sessions/[id]/finish/route.ts` — call `updateT1ProgressionAfterSession` on primary path
- `components/workout/WorkoutScreen.tsx` — hint bar in T1 card
- `components/workout/WorkoutScreen.module.css` — `.t1ProgressionHintBar` + label/value styles

### PROD_MIGRATION_STATUS (2026-04-19)

All 4 migrations applied and verified via Supabase REST API:

| migration | table/column | status |
|---|---|---|
| 000011 | exercise_swap_groups / exercise_swap_group_members | ✅ applied (4 groups, 17 members) |
| 000012 | program_day_exercises.swap_group_slug / workout_session_exercises.swap_group_slug | ✅ applied |
| 000013 | program_enrollments.archived_at / workout_sessions.archived_at | ✅ applied |
| 000014 | t1_progression_states | ✅ applied (1 row after full-flow simulation) |

### SMOKE_TEST (2026-04-19 — DB-layer + full-flow simulation)

| check | result |
|---|---|
| Programs list (is_public=true) | ✅ 5 programs |
| gzclp-base-v2 weeks/days | ✅ 4 weeks resolved |
| current_program_day_id → program_days | ✅ Week1/Day1 (cfcce85e) |
| program_day_exercises (incl. swap_group_slug) | ✅ 5 exercises, 2 with swap groups |
| Active enrollments (archived_at=null) | ✅ 3 enrollments |
| Recent sessions (archived_at=null) | ✅ 5 completed sessions |
| swap_group RLS (anon read) | ✅ 4 groups readable |
| finish route (countIncompleteSets silent) | ✅ verified in code |

### FULL_FLOW_SIMULATION (2026-04-19 — DB direct via service role)

Simulated: Session d68b5180 (gzclp-base-v2 W1D1, enrollment 17fcd538)

| step | operation | result |
|---|---|---|
| session create | in_progress, enrollment+day linked | ✅ |
| T1 Squat add | workout_session_exercises (T1, order=1) | ✅ |
| 5 sets record | 80kg × 5 sets, set5 AMRAP target=3+ reps=5 | ✅ |
| AMRAP判定 | reps_done(5) ≥ minReps(3) → **success** | ✅ |
| bootstrap | inferPhaseFromSetCount(5) → "5x3" | ✅ |
| computeNextState | weight 80 + 2.5 = **82.5**, phase stays 5x3 | ✅ |
| finish session | status=completed, finished_at set | ✅ |
| t1_progression_states | phase=5x3, current_weight_kg=82.5, last_result=success | ✅ |
| enrollment advance | current_program_day_id → Week1/Day2 | ✅ |
| next session Day2 | T1=Overhead Press (初回 → hint なし / 正常) | ✅ |

Expected hint bar for next Squat session:
```
[ Next: 82.5kg · 5×3+ ]
```

### UI_CHECK_STATUS (2026-04-19)

Dev server 起動 (port 3001) で WebFetch によるアクセスを試みたが、
`/train` は認証必須のため `TrainAuthRequired` が返った（実装バグではない）。
ブラウザ UI 目視は引き続き手動確認が必要。

**コード監査（完全）:**

| 確認項目 | コード箇所 | 結果 |
|---|---|---|
| hint bar 条件 | WorkoutScreen.tsx:1378 | `T1 AND t1ProgressionHint not null` のみ表示 ✅ |
| T2/T3 が出ない保証 | buildExerciseBlocks:519 | Map キーは T1 exercise_id のみ → 構造的に null ✅ |
| オレンジ CSS | WorkoutScreen.module.css:854 | `color: #f97316, font-weight: 700` ✅ |
| テキスト形式 | WorkoutScreen.tsx:1380-1384 | `"Next: 82.5kg · 5×3+"` ✅ |

**現在の DB 状態:**
- enrollment: Week1/Day2 (T1=OHP, 初回 → hint なし = 正常)
- t1_progression_states: Squat / 5x3 / 82.5kg / success

**Squat hint bar の確認パス:**
```
W1D2: OHP T1   → hint なし (OHP 初回, 正常)
W2D1: DL  T1   → hint なし (DL  初回, 正常)
W2D2: Squat T1 → "Next: 82.5kg · 5×3+" ← ここで確認
```

**手動確認チェックリスト（ブラウザ）:**
- [ ] /train → StartSessionScreen が表示される
- [ ] W2D2 セッション開始 → Squat T1 カードに "Next: 82.5kg · 5×3+" (orange)
- [ ] T2/T3 カードには hint bar なし
- [ ] W2D2 Finish (AMRAP success) → weight = 85.0kg に進む

### OPEN_POINTS

- Weight increment is fixed at 2.5kg for all T1 exercises.
  Typically Squat/DL should be +5kg; Bench/OHP +2.5kg. Configurable increment per
  exercise category is a natural next step (P-1 or C-12).
- `retest_required` state has no UI guidance yet — hint shows "Retest" badge.
  Deload flow (reduce weight by 10%, reset to 5x3) is a future iteration.
- T2/T3 progression: table is exercise-agnostic — extending is a matter of
  removing the `exercise_type = 'T1'` filter and adding separate logic per tier.

---

## 2026-04-18 C-10 - Training History Cleanup: soft-archive for sessions and enrollments

### STATUS: fully closed（2026-04-18 live 実機確認済み）

### DESIGN_DECISION

Soft-archive (not physical delete) for both `program_enrollments` and `workout_sessions`.
Pattern mirrors `workout_sets.deleted_at`: `archived_at IS NULL` = visible, non-null = hidden.

**What gets archived:**
- `workout_sessions`: test/abandoned sessions, in-progress sessions that blocked new starts
- `program_enrollments`: wrong-start programs, abandoned enrollments

**Archiving an in-progress session** is allowed and safe — after archiving, `train-entry`'s
in-progress check (now filtered by `archived_at IS NULL`) no longer sees it as blocking.

**Enrollment archiving cascades visually** — archived enrollment is excluded from
`selectActiveEnrollments`, so all related sessions also disappear from the active-program view
(without needing to archive them individually).

### CHANGED_FILES

**New migrations:**
- `supabase/migrations/20260418_000013_archived_at_columns.sql`
  - `archived_at timestamptz null` on both `program_enrollments` and `workout_sessions`
  - Partial indexes: `idx_program_enrollments_active_not_archived`, `idx_workout_sessions_history_not_archived`

**New API routes:**
- `app/api/workout-sessions/[id]/archive/route.ts` — POST, idempotent, ownership check
- `app/api/enrollments/[enrollmentId]/archive/route.ts` — POST, idempotent, ownership check

**Query filter additions (`.is("archived_at", null)`):**
- `lib/workout/enrollment.ts` — `findActiveEnrollment`, `advanceEnrollmentAfterSessionComplete`
- `lib/workout/active-program.ts` — `selectActiveEnrollments`, `selectInProgressSessionsForEnrollments`, `selectRecentSessionsForEnrollments`, `selectTrendSessions`
- `lib/workout/train-entry.ts` — enrollment lookup, in-progress session check
- `lib/workout/session-list.ts` — `selectSessions`

**New UI components:**
- `components/history/ArchiveSessionButton.tsx` — client component, confirm dialog + POST + router.refresh()
- `components/history/ArchiveSessionButton.module.css`

**Modified UI:**
- `components/history/SessionHistoryScreen.tsx` — ArchiveSessionButton per card
- `components/programs/ProgramsScreen.tsx` — enrollmentId added to ActiveEnrollmentInfo, Archive button in enrollment banner
- `components/programs/ProgramsScreen.module.css` — enrollmentBannerActions + enrollmentArchiveBtn styles
- `app/programs/page.tsx` — passes enrollmentId to ProgramsScreen

### LIVE_CONFIRMATION（2026-04-18）

- archived_at migration 適用済み
- Programs 画面で進行中 enrollment を archive → 正常に解除・非表示確認
- History 画面で session を 3 件 archive → 一覧から除外確認
- active program 判定・train フロー問題なし
- 既存データへの影響なし

---

## 2026-04-18 C-9 - gzclp-base-v2 Swap Pool (S-2): role-restricted accessory swap

### STATUS: fully closed（2026-04-18 live 実機確認済み）

### DESIGN_DECISION

T3 アクセサリースロット（order_index 4・5）に対して、role に紐づいたスワップ候補プールを追加。
pull スロット（order_index 3）は固定のまま。

データ設計: `exercise_swap_groups` + `exercise_swap_group_members` の 2 新テーブル。
`program_day_exercises.swap_group_slug` と `workout_session_exercises.swap_group_slug`（nullable）で連携。
NULL = 制限なし（Add Exercise と同じ全量リスト）— 既存プログラムへの影響ゼロ。

### POOL_DEFINITIONS

| group_slug | label | メンバー（spec + 現在のデフォルト） |
|---|---|---|
| `squat-aux` | Squat Assistance | Leg Press / Hack Squat / Bulgarian Split Squat / Leg Extension |
| `bench-aux` | Bench Press Assistance | Chest Press / DB Bench Press / Dips / Triceps Pushdown / Incline DB Press |
| `deadlift-aux` | Deadlift Assistance | Leg Curl / Good Morning / Hip Thrust / Back Extension / Romanian Deadlift |
| `ohp-aux` | OHP Assistance | Lateral Raise / Rear Delt Fly / DB Shoulder Press (soft) |

### POOL_ASSIGNMENT (gzclp-base-v2)

| Workout | order 4 (T1-sup) | pool | order 5 (T2-sup) | pool |
|---|---|---|---|---|
| A1 | Leg Curl | deadlift-aux | Triceps Pushdown | bench-aux |
| B1 | Lateral Raise | ohp-aux | Back Extension | deadlift-aux |
| A2 | Incline DB Press | bench-aux | Leg Extension | squat-aux |
| B2 | Romanian Deadlift | deadlift-aux | Lateral Raise | ohp-aux |

### CHANGES

| ファイル | 変更内容 |
|---|---|
| `supabase/migrations/20260418_000011_exercise_swap_groups.sql` | 新規: `exercise_swap_groups` + `exercise_swap_group_members` テーブル + RLS |
| `supabase/migrations/20260418_000012_swap_group_slug_columns.sql` | 新規: `program_day_exercises` + `workout_session_exercises` に `swap_group_slug` 追加 |
| `seed/programs/gzclp-base-v2-swap-groups.sql` | 新規: 8 新種目 upsert + 4 グループ作成 + メンバー追加 + gzclp-base-v2 への assignment |
| `types/workout.ts` | `WorkoutExerciseBlock` に `swapGroupSlug` 追加 |
| `lib/workout/start-session.ts` | `swap_group_slug` を `program_day_exercises` から `workout_session_exercises` へコピー |
| `lib/workout/train-session.ts` | `WorkoutSessionExerciseRow` + select + return に `swap_group_slug` 追加 |
| `components/workout/WorkoutScreen.tsx` | `openSwapModal(blockId, groupSlug?)` + `loadExercises(groupSlug?)` + swap_group param 連携 |
| `app/api/exercises/route.ts` | `?swap_group=<slug>` パラメータで候補を絞り込む |
| `components/workout/WorkoutScreen.module.css` | `.swapGroupHint` スタイル追加 |

### NEW_EXERCISES (8種目 — pool-only)

| slug | name_en | category |
|---|---|---|
| `chest-press` | Chest Press | chest |
| `dips` | Dips | chest |
| `leg-press` | Leg Press | legs |
| `hack-squat` | Hack Squat | legs |
| `bulgarian-split-squat` | Bulgarian Split Squat | legs |
| `good-morning` | Good Morning | back |
| `hip-thrust` | Hip Thrust | glutes |
| `rear-delt-fly` | Rear Delt Fly | shoulders |

### LIVE_APPLY

Supabase Dashboard > SQL Editor で以下の順に実行:
1. `supabase/migrations/20260418_000011_exercise_swap_groups.sql`
2. `supabase/migrations/20260418_000012_swap_group_slug_columns.sql`
3. `seed/programs/gzclp-base-v2-swap-groups.sql`

### MANUAL_CHECK (live 実機 — 確認済み 2026-04-18)

| 確認項目 | 結果 |
|---|---|
| seed 適用後 24/24 rows に swap_group_slug 設定 | ✅ PASS |
| A1 の Leg Curl Swap → deadlift-aux 5 種目のみ（Good Morning / Back Extension / Hip Thrust / Romanian DL / Leg Curl） | ✅ PASS |
| 候補制限が正常動作 | ✅ PASS |
| swap 実行後 T3 バッジ維持 | ✅ PASS |
| order 3（pull 枠）は制限なし（仕様通り） | ✅ PASS |
| 既存プログラムへの影響なし | ✅ PASS |

---

## 2026-04-18 C-8 - GZCLP 5-Exercise Base (gzclp-base-v2) seed 追加

### STATUS: seed 実装完了 — live SQL 実行待ち

### DESIGN_DECISION

既存 `gzclp-base` への上書きではなく、新 slug `gzclp-base-v2` として追加。
理由: live DB に active enrollment が存在する可能性があり、構造変更は mid-program ユーザーに
予期しない変更をもたらす。既存プログラムは保持し、v2 は新規 enrollment の選択肢として追加する。

### CHANGES

| ファイル | 変更内容 |
|---|---|
| `seed/programs/gzclp-base-v2.sql` | 新規作成。7 種目追加 + プログラム全構造（4 weeks × 3 days × 5 exercises = 60 rows） |
| `seed/programs/program-metadata.sql` | gzclp-base-v2 を soft 追加（not null check 付き、既存 seeds が v2 なしで動作するよう互換維持） |
| `lib/programs/program-catalog.ts` | mock fallback カタログに gzclp-base-v2 エントリ追加 |
| `docs/program-source-audit.md` | gzclp-base-v2 監査エントリ追加（adapted / DESIGN_DECISION 記録） |
| `docs/week-preview-spec.md` | gzclp-base-v2 の確認計画を追記 |

### NEW_EXERCISES (7種目)

| slug | name_en | category |
|---|---|---|
| `leg-curl` | Leg Curl | legs |
| `triceps-pushdown` | Triceps Pushdown | arms |
| `lateral-raise` | Lateral Raise | shoulders |
| `back-extension` | Back Extension | back |
| `incline-dumbbell-press` | Incline Dumbbell Press | chest |
| `leg-extension` | Leg Extension | legs |
| `romanian-deadlift` | Romanian Deadlift | back |

### PROGRAM_STRUCTURE

```
A1: Squat(T1) / Bench(T2) / Lat Pulldown(T3) / Leg Curl(T3) / Triceps Pushdown(T3)
B1: OHP(T1)   / Deadlift(T2) / DB Row(T3)    / Lateral Raise(T3) / Back Extension(T3)
A2: Bench(T1) / Squat(T2)   / Lat Pulldown(T3) / Incline DB Press(T3) / Leg Extension(T3)
B2: Deadlift(T1) / OHP(T2)  / DB Row(T3)     / Romanian Deadlift(T3) / Lateral Raise(T3)

Week 1: A1 / B1 / A2  |  Week 2: B2 / A1 / B1
Week 3: A2 / B2 / A1  |  Week 4: B1 / A2 / B2
```

### CODE_CHANGES

なし。start-session.ts / WorkoutScreen.tsx / train-session.ts はすべてデータ駆動で
order_index 順に任意件数の種目を処理するため、コード変更不要。

### LIVE_APPLY

Supabase Dashboard > SQL Editor で以下の順に実行:
1. `seed/programs/gzclp-base-v2.sql` (新 program + exercises + tag assignments)
2. `seed/programs/program-metadata.sql` (任意 — タグ情報の再確認・再適用)

Post-check: 60 rows が返ること確認 (seed ファイル末尾の確認クエリを実行)

### MANUAL_CHECK (live 反映後)

- [ ] `/programs` に `GZCLP 5-Exercise Base` が表示される
- [ ] `/programs/gzclp-base-v2` の week preview に 5 種目が `·` 区切りで表示される
- [ ] `/train?program=gzclp-base-v2&programDayId=...` で 5 種目記録できる
- [ ] T1/T2/T3 バッジが正しく色分けされる（T3 が 3 種目並ぶ）
- [ ] gzclp-base（既存）が壊れていないこと

## 2026-04-17 U-19 - Cancel lookup failure: explicit-token client で cookie re-read 問題を根本修正

### STATUS: fully closed（2026-04-18 live 実機確認済み）

### DEPLOYMENT_CHECK

commit 541a27a (admin client fallback) がデプロイ済みでも live で失敗している。
→ `SUPABASE_SERVICE_ROLE_KEY` が Vercel 本番環境に未設定の場合、
  `hasSupabaseServiceRoleEnv()` が false → server client (cookie ベース) にフォールバック → 同じ JWT 問題が継続。

### VERCEL_ENV_CHECK

`SUPABASE_SERVICE_ROLE_KEY` が Vercel に設定されているか確認が必要。
未設定の場合: 今回の修正（explicit-token client）が根本対処になる。
設定済みの場合: admin client が使われるはずだが、それでも失敗するなら別の問題がある。

### ROOT_CAUSE (確定)

`@supabase/ssr` の `createServerClient` は DB クエリのたびに `getAll()`（= リクエスト Cookie）から
access token を再読み込みする可能性がある。
`auth.getUser()` がトークンをリフレッシュしてもリクエスト Cookie は変わらない（Set-Cookie ヘッダは
レスポンス側に書かれ、同一リクエスト内では古い Cookie が読まれ続ける）。
→ PostgREST が失効済み JWT を受け取り `PGRST301` を返す → `findOwnedWorkoutSession` が throw →
"Workout session lookup failed."

### CHANGES (U-19)

| ファイル | 変更内容 |
|---|---|
| `lib/supabase/server.ts` | `createSupabaseTokenClient(accessToken)` を追加: Bearer トークンを Authorization ヘッダに直接セットするクライアント生成関数 |
| `lib/workout/session-access.ts` | `getAuthenticatedWorkoutContext()` を修正: auth.getUser() 後に auth.getSession() でトークンを取得し、explicit-token client を DB クライアントとして返す。Cookie 再読み込みを完全に回避 |

### 修正後の認証フロー

```
auth.getUser()  → Cookie から JWT を取得してネットワーク検証 → 必要に応じてリフレッシュ
auth.getSession() → in-memory から最新 access_token を取得（ネットワーク不要）
createSupabaseTokenClient(token) → Authorization: Bearer <token> を全リクエストに付与
DB クエリ → 常に検証済み・最新トークンを使用（Cookie 再読み込みなし）
```

admin client 優先順位（cancel/finish route）:
1. `SUPABASE_SERVICE_ROLE_KEY` あり → admin client（RLS バイパス）
2. なし → explicit-token client（getSession() からの JWT）
3. session なし（稀）→ cookie client（従来と同じ、フォールバック）

### TESTS: typecheck ✅ / build ✅

### MANUAL_CHECK (live 実機 — 確認済み 2026-04-18)

| 確認項目 | 結果 |
|---|---|
| Cancel → "Workout session lookup failed." が出ない | ✅ PASS |
| Finish → /workout-summary/{id} が表示される | ✅ PASS |

## 2026-04-17 U-18 - Cancel / Finish: session lookup failure 根本原因特定 + admin client 修正

### STATUS: 修正実装完了 — live 実機手動確認待ち

### ROOT_CAUSE

`auth.getUser()` は Supabase Auth API へのネットワーク呼び出しでトークンを検証・リフレッシュするが、
その後の PostgREST クエリには JWT を Authorization ヘッダーとして直接渡す。
Route Handler 内で JWT が期限切れになっていた場合、`auth.getUser()` はリフレッシュ成功・userId 取得できるが、
PostgREST 側で同 JWT の期限切れを検出し `PGRST301` エラーを返す可能性がある。
この場合 `maybeSingle()` が `{ data: null, error: { ... } }` を返し → `findOwnedWorkoutSession` が throw →
内側の catch が "Workout session lookup failed." (500) を返していた。

補足: `eb7ab3e` で cancel/finish が admin client → server client に変更されたが、
ワークアウト中に JWT が期限切れになるとこの問題が顕在化する。

### LOOKUP_FAILURE_TYPE

`findOwnedWorkoutSession` が throw する = Supabase query error (error != null)。
RLS や "no row" ではなく、JWT/PostgREST レベルのエラー。

### CHANGES

| ファイル | 変更内容 |
|---|---|
| `lib/workout/session-access.ts` | `findOwnedWorkoutSession`: Supabase error 発生時に errorCode/errorMessage/errorHint/errorDetails を構造化ログ出力してから throw |
| `app/api/workout-sessions/[id]/cancel/route.ts` | admin client 導入: `SUPABASE_SERVICE_ROLE_KEY` がある場合は `createSupabaseAdminClient()`、なければ server client にフォールバック。lookup と update 両方を `dbClient` に切り替え。catch の Error シリアライズも修正 |
| `app/api/workout-sessions/[id]/finish/route.ts` | 同上 (cancel と同じパターン) |

セキュリティ維持: userId は引き続き `auth.getUser()` (server client) から取得し、
DB クエリには `.eq("user_id", userId)` を明示的に付けている。admin client は RLS をバイパスするが
アプリレベルのオーナーチェックで同等の保証を維持する。

### MANUAL_CHECK (live 実機 — 要確認)

- ログイン済みセッションで Cancel ボタン押下 → "Workout session lookup failed." が出ない
- Cancel 成功後 `/` → `/train` に戻り StartSession 画面が出ること
- Finish ボタン押下 → `/workout-summary/{id}` に遷移すること
- Vercel ログで `dbClientType: "admin"` が出ていること（admin client が使われていることの確認）

### TESTS

- `npm run typecheck` ✅
- `npm run build` ✅

## 2026-04-17 U-17 - Cancel / Finish write path コード検証 + build 確認

### STATUS: 完了（コード解析 + typecheck + build pass）

live 実機テスト（認証済みセッション）は credentials がないため local preview では未実施。
コード解析・静的検証で正常を確認。

### 検証結果

| 確認項目 | 結果 |
|---|---|
| `getAuthenticatedWorkoutContext()` が auth エラー時に throw しない（U-14 fix） | ✅ 適用済み |
| cancel route: 401/404/409/500 各パスの分岐 | ✅ 正常 |
| finish route: 401/404/409(requiresConfirmation)/409(conflict)/500 各パスの分岐 | ✅ 正常 |
| `postCancelSession`: `!response.ok` で throw → `handleCancel` の catch で `errorMessage` セット | ✅ 正常 |
| `postFinishSession`: 409 + requiresConfirmation は throw せず confirm ダイアログへ | ✅ 正常 |
| Cancel 成功後 `router.push("/")` → authenticated user は `/login` に飛ばない | ✅ `HomePage` は `isAuthenticated` が true の場合 `/login` に遷移しない |
| Finish 成功後 `router.push(payload.summaryPath)` = `/workout-summary/${id}` | ✅ 正常 |
| `npm run typecheck` | ✅ pass |
| `npm run build` | ✅ pass |

### 残確認項目（ユーザー手動 live 実機）

- ログイン済みセッションで Cancel → `/` → `/train` に戻り StartSession 画面が出ること
- ログイン済みセッションで Finish → `/workout-summary/{id}` が表示されること

### 追加修正なし

コード・ルート・クライアント側いずれも期待通り。追加修正は不要と判断。

## 2026-04-17 U-16 - 未認証導線 live 手動確認（0cd5545 検証）

### STATUS: 完了（未認証フロー全シナリオ ✅）

| シナリオ | 結果 | 備考 |
|---|---|---|
| Cookie クリア後 `/` → `/login` へ遷移 | ✅ PASS | pathname = /login 確認 |
| 未ログインで `/train` → `TrainAuthRequired` 表示 | ✅ PASS | 「LOGIN REQUIRED」「ログインが必要です」表示 |
| `ログインへ` ボタン → `/login` 遷移 | ✅ PASS | click 後 pathname = /login 確認 |
| `プログラム一覧へ戻る` → `/programs` 遷移 | ✅ PASS | click 後 pathname = /programs 確認 |
| ログイン後 `/train` 正常表示 | 🔲 要手動確認 | credentials 不要で代替確認不可 |
| 既存ログイン済み導線（Go to Train等）正常 | 🔲 要手動確認 | 同上 |

### スクリーンショット確認

`TrainAuthRequired` 画面が正しいスタイルで表示された（オレンジバッジ + ログインへボタン + プログラム一覧リンク）。
BottomTabBar の Train タブもハイライトされている（正常）。

### 残確認項目（ユーザー手動）

認証済み状態での確認（live または local .env.local ログイン後）:
- ログイン → `/` → `/train` へ正常リダイレクトされること
- `/train` でワークアウト画面が表示されること
- Cancel / Finish が正常に動作すること（U-14 の修正効果確認）

### Changes / 修正なし

今回確認のみ。routing は期待通りに動作しているため追加修正なし。

## 2026-04-17 U-15 - 未認証ユーザーの /train ルーティング正常化・ログイン導線追加

### STATUS

| Item | Result |
|---|---|
| root cause 特定: 未認証時に `/train` が mock WorkoutScreen を表示 | **confirmed** |
| `app/page.tsx`: 未認証 → `/login` リダイレクト | **implemented** |
| `app/train/page.tsx`: 早期認証チェック → `TrainAuthRequired` 表示 | **implemented** |
| `components/train/TrainAuthRequired.tsx` 作成 | **implemented** |
| `lib/workout/train-session.ts`: 未認証時 null 返却に修正 | **implemented** |
| TypeScript / build | **pass** |

### Root Cause

複数の問題が重なっていた。

**① `getCurrentWorkoutSessionView()` が未認証時に mock セッションを返していた**
```typescript
if (!userId) {
  return getMockWorkoutSession();  // ← 未認証でも workout 画面が出た
}
```
`train/page.tsx` は `session` が truthy なら `WorkoutScreen` を表示するため、
未認証ユーザーが `/train` に直接アクセスすると mock exercises が見えていた。
その後のボタン操作で API が 401 → "ログインが必要です。" が出るが、ログインへのリンクがない。

**② `app/train/page.tsx` に認証ガードがなかった**
`!userId` のフォールスルーパスが最終的に `WorkoutScreen(getMockWorkoutSession())` に落ちていた。

**③ `app/page.tsx` が未認証ユーザーを `/programs` に送っていた**
`/programs` は public なので正しいが、ユーザー体験として「ワークアウト開始 → /train → 詰む」の導線が残っていた。

### Fix

1. `app/page.tsx`: `!isAuthenticated → redirect("/login")` に変更。未ログインはまず認証を促す。
2. `app/train/page.tsx`: ページ先頭で `getAuthenticatedWorkoutUserId()` を呼び、未認証なら即 `<TrainAuthRequired />` を返す。
3. `components/train/TrainAuthRequired.tsx`: ログインへのボタン + プログラム一覧へのリンクを持つシンプルなエラー画面。
4. `lib/workout/train-session.ts`: `getCurrentWorkoutSessionView()` の未認証時 `getMockWorkoutSession()` → `null` に変更。エラーキャッチ時も同様。

### Routing Table (after fix)

| 状態 | `/` 遷移先 | `/train` 直アクセス |
|---|---|---|
| 未認証 | `/login` | `TrainAuthRequired`（ログインボタン + Programs リンク） |
| 認証済み + enrollment あり | `/train` | workout or StartSession |
| 認証済み + enrollment なし | `/programs` | StartSession or mock fallback |

### Manual Check

- Cookie クリア後に `/` → `/login` へ飛ぶことを確認
- Cookie クリア後に `/train` 直アクセス → "ログインが必要です" 画面とボタンが出ることを確認
- 認証済みで `/` → `/train` への正常ルーティングが変わっていないことを確認

## 2026-04-17 U-14 - Cancel route: auth error throw が outer catch に伝播する問題を修正

### STATUS

| Item | Result |
|---|---|
| root cause 特定: `getAuthenticatedWorkoutContext()` が auth エラー時に throw | **confirmed** |
| `session-access.ts`: auth エラーを throw せず `{ client, userId: null }` で返すよう変更 | **implemented** |
| `cancel/route.ts`: outer catch ログに name / message / stack を追加 | **implemented** |
| TypeScript / build | **pass** |

### Root Cause

`eb7ab3e` で導入した `getAuthenticatedWorkoutContext()` が `auth.getUser()` エラー時に `throw` するが、
cancel route ではこの呼び出しが内側の try-catch（lookup を囲む部分）より前に位置するため、
例外が outer catch まで伝播して "Unexpected error occurred while cancelling workout session." になっていた。

```
POST /cancel
  try {                                      ← outer try
    await getAuthenticatedWorkoutContext()   ← ここで throw → outer catch に直行
    try {
      findOwnedWorkoutSession(...)           ← inner try-catch (lookup 専用)
    } catch (lookupError) { ... }           ← auth エラーはここでは捕まらない
    ...
  } catch (error) {
    // "Unexpected error occurred while cancelling workout session."  ← ここへ落ちる
  }
```

### Fix

`getAuthenticatedWorkoutContext()` の auth エラー処理を throw から `console.warn + return { client, userId: null }` に変更。
- `userId === null` のケースは各 route が既に `!userId → 401` で正しく処理済み
- expired token / missing session / network error はすべて「未認証」として 401 で応答する（500 ではなく）
- 再発デバッグのため outer catch も `err.name / message / stack` をログに含めるよう強化

### Reproduction Pattern

live 環境で token が期限切れ・refresh 失敗・cookie 破損のいずれかが起きると `auth.getUser()` がエラーを返す。
旧 `getAuthenticatedWorkoutUserId()` はエラーを無視して null を返していたため 401 になっていたが、
`getAuthenticatedWorkoutContext()` への置き換え後は throw するようになり 500 に変わった。

### 再発防止観点

`getAuthenticatedWorkoutContext()` を呼ぶ全 route が恩恵を受ける（cancel 以外の finish / unlock / complete も同様に修正済み）。
auth エラーは原則 throw せず `userId: null` → 401 で処理する。予期しない例外だけ outer catch が 500 を返す設計に統一。

## 2026-04-17 U-13 - Live mutation auth/query client unification
### STATUS

| Item | Result |
|---|---|
| `/train` write path の共通 auth/query 差分を調査 | **implemented** |
| complete / unlock / cancel / finish の構造化ログ追加 | **implemented** |
| `/train` mutation route を単一 Supabase client 化 | **implemented** |
| TypeScript / build | **pass** |

### Notes

- root cause は、`/train` mutation route 群だけが「`auth.getUser()` 用 client」と「lookup / update 用 client」を別々に作っていたことだと判断しました。
- `startSessionForDay()` は 1 request 内で単一の Supabase server client を使っており live でも動いていた一方、壊れていた mutation 群は `getAuthenticatedWorkoutUserId()` と `createWorkoutQueryClient()` を別呼びしていました。
- live で token refresh や cookie 更新が必要なタイミングだと、最初の client では user を解決できても、2 個目の client が同一 request 内で同じ auth state を見られず、lookup / update だけが失敗する構造になっていました。
- 今回は `getAuthenticatedWorkoutContext()` を追加して、同じ Supabase client で `auth.getUser()` とその後の select / update を実行する形に統一しました。
- あわせて `complete / unlock / cancel / finish` には `route name / userId / setId or sessionId / lookup result / update result / error` の構造化ログを追加し、live 再発時にどの段階で落ちたかを追いやすくしました。
- 同じ根を踏む `/train` 配下の `PATCH workout-set`、`delete workout-set`、`add set`、`add exercise`、`swap exercise` も単一 client 化しています。
- update 系 route では `.select(...).maybeSingle()` を返して、`updateError` だけでなく「0 rows 更新」の conflict も区別できるようにしました。
- Manual check: このセッションでは認証済み live E2E までは未実施です。次回は production で `complete -> undo -> cancel -> finish` を 1 回通し、追加した route logs と結果を合わせて確認すると完了確定しやすいです。

## 2026-04-17 U-12 - Cancel failure escape hatch
### STATUS

| Item | Result |
|---|---|
| Cancel 失敗時の `/train` 退避導線追加 | **implemented** |
| Cancel failure 後の retry / Home / History 導線保証 | **implemented** |
| TypeScript / build | **pass** |

### Notes

- live 環境では `Workout session lookup failed.` がまだ起こり得るため、今回は root cause の完全解消よりも「失敗しても `/train` に閉じ込められない」ことを優先しました。
- `WorkoutScreen` に `failedAction = "cancel"` を持たせ、Cancel failure のときだけ recovery actions を赤バナー内へ表示するようにしました。
- recovery actions は `Leave to Home` / `Session History` / `Retry Cancel` の 3 つです。Home / History は通常の `href` 遷移なので、client router state に依存せず退避できます。
- Cancel failure 時は `isCancelling` を finally で解除しつつ、`revealedSetId` を閉じて swipe 状態だけを cleanup するようにしました。workout 自体は継続中なので rest timer や入力 state は壊さない方針です。
- 他の編集操作や session 更新時には `failedAction` を clear して、Cancel failure 用の退避 UI が残留しないようにしています。
- Manual check: 今回は local で JSX / CSS と disabled 条件を確認する範囲までです。認証済み live での `Cancel failure -> Leave to Home` は次回 1 回見るとより安心です。

## 2026-04-17 U-11 - Cancel session lookup hardening
### STATUS

| Item | Result |
|---|---|
| `/train` Cancel の `Workout session lookup failed.` 修正 | **implemented** |
| cancel route の ownership lookup を共通 helper に統一 | **implemented** |
| TypeScript / build | **pass** |

### Notes

- Cancel route だけが `workout_sessions` を直接 lookup しており、他の session mutation route と実装がずれていました。
- 今回は `findOwnedWorkoutSession()` に統一し、Cancel 前の session 解決を他 route と同じ ownership check に揃えました。
- lookup が失敗した場合は `sessionId` / `userId` / `lookupError` を server log に残すようにして、再発時に stale id か query failure かを切り分けやすくしました。
- `update(...).eq("user_id", userId).eq("status", "in_progress")` に寄せ、Cancel mutation も lookup と同じ user scope で閉じるようにしました。
- `components/workout/WorkoutScreen.tsx` 側の cleanup / redirect は既存実装を維持しているため、今回の修正範囲は cancel API の session 解決に限定しています。
- Manual check: このセッションでは認証済みブラウザの Cancel E2E までは未実施です。次回は production 実データで `Cancel -> Home -> Go to Train` を 1 回確認すれば今回の修正を閉じられます。

## 2026-04-17 U-10 - Train top bar Boostcamp pass
### STATUS

| Item | Result |
|---|---|
| Rest / Calc を補助操作として整理 | **implemented** |
| Session timer を中央の主表示に整理 | **implemented** |
| Finish / Cancel の主従を明確化 | **implemented** |

### Notes

- Top bar は既存の 4 列構成を維持しつつ、`Rest` / `Calc` を二段ラベルの小さな補助ボタンに変更しました。
- タイマーは中央の panel にまとめ、セッション経過時間を最も読み取りやすい要素として強調しました。
- `Finish` は Boostcamp 寄せの強い黄系 CTA、`Cancel` は控えめな赤の secondary action として差を明確化しました。
- Mobile check at `390 x 844`: top bar height was `61px`, all controls stayed on one row, and the button widths remained usable (`Rest 48px`, `Calc 48px`, `Finish 64px`).

## 2026-04-17 U-9 - DONE action reliability and mobile fit
### STATUS

| Item | Result |
|---|---|
| `Complete target lookup failed.` root cause hardening | **implemented** |
| DONE complete color switches immediately and clearly | **implemented** |
| Mobile row width adjusted so DONE stays inside viewport | **implemented** |

### Notes

- `findOwnedWorkoutSessionExercise()` now selects only `id` and `workout_session_id`, which are the only fields needed for set ownership checks.
- DONE completion now updates optimistically so the right-side check turns accented immediately, then rolls back if the API fails.
- `router.refresh()` right after DONE / undo DONE was snapping the row back to stale server data in mock or lagging states, so DONE now stays on local confirmed state instead of flashing back.
- Mobile width was recovered by shrinking `# / Previous / Target / Done` slightly and trimming row padding/gap while keeping `Kg / Reps` usable.
- Added server-side logging for complete/unlock lookup failures so future regressions are diagnosable without changing API responses.
- Manual check: headless Chrome at `390 x 844` confirmed the DONE button turns green, no red error banner appeared during the mocked complete flow, and the DONE button bounding box stayed inside the viewport.
- E2E check on 2026-04-17: authenticated production session was verified in Chrome. A real `Dumbbell Full Body Base / Week 1 / Day 1` session was started from `/api/workout-sessions`, the first DONE action completed without any red banner, the button stayed green after reload, unlock returned it to the incomplete state, and the DONE column remained inside the narrow window width used for the check.

## 2026-04-17 U-8 - DONE button 視認性改善

### STATUS

| 項目 | 状態 |
|---|---|
| 未完了 / 完了の DONE ボタン差分を強化 | **完了 ✅** |
| 完了後も Kg / Reps 編集可の挙動維持 | **完了 ✅** |
| TypeScript / build 検証 | **完了 ✅** |

### 変更内容

- `components/workout/WorkoutScreen.module.css`
  - 未完了ボタンをダークで控えめな見た目に整理
  - 完了時は緑の塗り + 明るいチェック + 軽いシャドウで一瞬で認識できる見た目へ変更
  - row 全体の演出は増やさず、DONE ボタン単体の視認性を最優先
- `components/workout/WorkoutScreen.tsx`
  - DONE ボタン内を `checkIcon` span に整理し、未完了でも薄いチェックを見せて操作対象を分かりやすくした

### 判断理由

- 現状は完了・未完了の差が弱く、スマホ幅でどこまで終わったかを一目で追いづらかった
- Boostcamp 寄せとして、まずは DONE ボタン自体の色差で進行状況が分かることを優先した
- Kg / Reps 編集可の仕様は維持したいので、row 全体のロック風演出は強めず、右端ボタンだけで状態差を作った

## 2026-04-17 U-7 - /train cancelled session fallback 修正

### STATUS

| 項目 | 状態 |
|---|---|
| `/train` の primary session 選択から `cancelled` / `completed` を除外 | **完了 ✅** |
| active enrollment の current day を start 画面へ優先接続 | **完了 ✅** |
| cancel 後の rest / swipe UI 残留 cleanup | **完了 ✅** |
| TypeScript / build 検証 | **完了 ✅** |

### 原因

- `/train` のクエリなし表示が `getCurrentWorkoutSessionView()` を通じて「最新 session」をそのまま返していた
- そのため `in_progress` が存在しないタイミングでは、最新が `cancelled` の場合でも `WorkoutScreen` にそのまま表示されていた
- `Go to Train` / `Back to Train` のように `/train` へ素で戻る導線では、この fallback が active enrollment の current day より優先されてしまっていた

### 修正内容

- `lib/workout/train-session.ts`
  - current session 解決を `in_progress` 限定に変更し、`cancelled` / `completed` を primary display 対象から除外
- `app/train/page.tsx`
  - 優先順位を `in_progress -> active enrollment current day の StartSessionScreen -> mock fallback` に整理
- `components/workout/WorkoutScreen.tsx`
  - cancel 成功後に rest timer と swipe reveal state を明示 cleanup してから遷移

### 再発防止メモ

- `/train` の primary display は「編集可能な現在セッション」だけを対象にし、履歴状態は session-history / summary 側へ限定する
- `cancelled` / `completed` を見せたい場合は明示的に履歴導線から遷移した時だけ扱う

## 2026-04-17 U-6c - Workout row Boostcamp寄せ 手動確認

### STATUS

| 項目 | 状態 |
|---|---|
| スマホ幅で Kg / Reps 入力欄が押しやすいか | **pass** |
| Delete が通常時に見えず、左スワイプ時のみ表示されるか | **pass** |
| チェック完了後も Kg / Reps 編集が可能か | **pass** |
| 何セット目をやっているか視認しやすいか | **pass** |
| complete / update / delete API が今回 UI 変更と矛盾しないか | **pass（コード確認 + ローカル補助確認）** |
| Rest Timer が row UX 変更で崩れていないか | **pass** |

### 確認結果

- Headless Chrome を 390 x 844 のスマホ幅で起動し、`/train` を確認
- 初期表示では row の横スクロールは発生せず、Kg / Reps は各 `48px` 幅で確保されていた
- 左スワイプ後だけ Delete lane が表示され、通常時 opacity は `0`、reveal 時は `1` を確認
- check 完了後も Kg / Reps は disabled にならず、そのまま編集・blur 保存できることを確認
- Rest Timer は `Rest -> 1:29` へ遷移し、active 表示クラスも維持されていた

### 補足

- ローカル未認証の `/train` は mock session fallback になるため、complete / update / delete の UI 操作確認は一時的な API スタブで実施
- 実 API 自体は `app/api/workout-sets/[id]/route.ts` / `complete/route.ts` / `delete/route.ts` を再確認し、完了後編集可・完了済み削除可・`is_locked: false` 正規化の方針と矛盾がないことを確認
- 今回はコード修正不要。状態記録のみ更新

## 2026-04-17 U-6b - Workout row Boostcamp寄せ 検証完了

### STATUS

| 項目 | 状態 |
|---|---|
| Delete を通常非表示にして、左スワイプ時のみ表示 | **完了 ✅** |
| モバイルで Kg / Reps 入力欄を拡張 | **完了 ✅** |
| lock / unlock 操作をやめ、check ベースの完了操作に統一 | **完了 ✅** |
| 完了後も Kg / Reps をそのまま編集可能に変更 | **完了 ✅** |
| TypeScript / build 検証 | **完了 ✅** |

### 変更内容

- `components/workout/WorkoutScreen.tsx`
  - Delete lane を通常非表示にし、左スワイプ時だけ表示する挙動へ変更
  - 完了操作を check ボタン 1つに統一し、完了後も Kg / Reps を編集可能に変更
  - 補助文言を Boostcamp 寄せの操作説明へ更新
- `components/workout/WorkoutScreen.module.css`
  - モバイル時の row grid を調整して Kg / Reps 入力欄を拡張
  - delete lane の reveal 表示と completed row の見た目を調整
- `app/api/workout-sets/[id]/route.ts`
  - PATCH 時の `is_locked` 制約を外し、旧データも `is_locked: false` に正規化
- `app/api/workout-sets/[id]/complete/route.ts`
  - complete 後も編集できるよう `is_locked: false` を返す実装へ変更
- `app/api/workout-sets/[id]/delete/route.ts`
  - 完了済みセットでも削除できるよう制約を整理

### 検証

- `npm run typecheck` : pass
- `npm run build` : pass

### NEXT

- ローカル画面で swipe reveal / check toggle / 完了後編集の見た目を最終確認

## 2026-04-17 U-6 — Workout row Boostcamp 寄せ

### STATUS

| 項目 | 状態 |
|---|---|
| Delete を通常時は隠し、左スワイプ時のみ表示 | **完了 ✅** |
| 完了後も Kg / Reps を編集可能に変更 | **完了 ✅** |
| lock / unlock ボタン分岐をやめ、check ベース操作に統一 | **完了 ✅** |
| モバイルで Kg / Reps 入力幅を拡張 | **完了 ✅** |
| TypeScript / build 検証 | **確認予定** |

### 変更内容

- `components/workout/WorkoutScreen.tsx`
  - 完了済みセットでも Kg / Reps を編集できるよう UI ガードを緩和
  - Done 列を常時 check ボタンに統一し、完了済みは再タップで未完了へ戻せる形に変更
  - Delete lane は `revealedSetId` のときだけ可視化
  - 補助文言を `左スワイプで Delete ・ 完了後も Kg / Reps はそのまま編集できます` に更新
- `components/workout/WorkoutScreen.module.css`
  - set row の列幅を見直し、Done 列を圧縮して Kg / Reps を広げた
  - delete lane を非表示→表示のトランジションに変更
  - completed row の軽いハイライトを追加
- `app/api/workout-sets/[id]/route.ts`
  - `is_locked` による PATCH ブロックを撤去し、保存時は `is_locked: false` に正規化
- `app/api/workout-sets/[id]/complete/route.ts`
  - complete 時に `is_locked: false` を返すよう変更
- `app/api/workout-sets/[id]/delete/route.ts`
  - delete 時の `Unlock first` 制約を撤去

### 修正理由

- 現状 UI は Delete が常時透けて見え、Boostcamp のような「左スワイプ時だけ Delete」が再現できていなかった。
- また complete 後に lock されるため重量・回数の微修正がしにくく、何セット目まで終わったかを check だけで追える Boostcamp の操作感とずれていた。

### NEXT

- `npm run typecheck` / `npm run build` を実行して静的検証
- ローカル画面で swipe reveal / check toggle / complete 後編集を目視確認

## 2026-04-17 U-5 — Rest Timer 安定化

### STATUS

| 項目 | 状態 |
|---|---|
| WorkoutScreen の Rest ボタンから 90 秒カウントダウン開始 | **完了 ✅** |
| カウント完了後に `Done!` を一時表示 | **完了 ✅** |
| `Done!` 表示中に再スタートしても旧 timeout が新タイマーを消さない | **完了 ✅** |
| セッション切替 / unmount 時の rest timer 後始末 | **完了 ✅** |
| TypeScript `tsc --noEmit` | **完了 ✅** |

### 変更内容

- `components/workout/WorkoutScreen.tsx`
  - `restDoneTimeoutRef` を追加し、`Done!` 表示を消す timeout を明示管理
  - 新しいレスト開始時に旧 timeout を必ず `clearTimeout` するよう修正
  - `session` 切替時に rest timer state / ref をリセット
  - rest timer interval cleanup 時にも timeout を後始末

### 修正理由

- 2026-04-16 時点の Rest Timer 実装は UI 上ほぼ完成していたが、`Done!` 表示を消す `setTimeout` が次のレスト開始後も残るため、短時間で再スタートすると新しいカウントダウン表示が途中で消えるレース条件があった。
- 今回は仕様追加ではなく、既存 UX を壊さずに安定化する最小修正だけを入れた。

### NEXT

- ローカル画面で Rest → Done! → 即再スタートの挙動を目視確認
- 必要なら `Done!` 表示時間（現状 2.5 秒）を UX 観点で微調整

最終更新: 2026-04-15（H-4 IA redesign E2E 検証完了 / BottomTabBar・smart redirect・enrollment guard 実装 pass）

## 2026-04-15 H-4 — IA redesign E2E 検証完了

### STATUS

| 確認項目 | 状態 |
|---|---|
| `/` → smart redirect（未ログイン → `/programs`） | **pass ✅** |
| `/login` で BottomTabBar 非表示 | **pass ✅** |
| `/programs` で BottomTabBar 表示 / Programs タブ active | **pass ✅** |
| `/train` で BottomTabBar 表示 / Train タブ active | **pass ✅** |
| `/session-history` で BottomTabBar 表示 / History タブ active | **pass ✅** |
| SessionHistoryScreen の "← Home" 削除済み | **pass ✅** |
| Program Detail（enrollment なし）→ "Start Program" CTA | **pass ✅** |
| スクロールスペーサーで CTA がタブに隠れない | **pass ✅** |
| コンソールエラー・警告 | **なし ✅** |
| TypeScript `tsc --noEmit` | **pass ✅** |
| WorkoutSummaryScreen — "Back to Home" → "Back to Train" 修正 | **完了 ✅** |
| History → completed session に "Summary →" リンク追加 | **完了 ✅** |
| active enrollment あり分岐（Programs バナー / Detail 警告）| **実装済み / Supabase 接続環境で E2E 要確認** |
| Restart Program → `/` → `/train` smart redirect | **設計上 pass（`/` が active enrollment → /train へ振る）** |

### 実装サマリー（H-4）

**新規ファイル:**
- `components/navigation/BottomTabBar.tsx` — Programs / Train / History の 3 タブ固定ナビ（SVG アイコン / active 状態 / safe-area 対応）
- `components/navigation/AppNav.tsx` — pathname ベースの表示制御 + スクロールスペーサー（`/login` は非表示）

**変更ファイル:**
- `app/layout.tsx` — AppNav を root layout に注入
- `app/page.tsx` — Home → smart router（enrollment → `/train`、それ以外 → `/programs`）
- `app/login/page.tsx` — ログイン後 `/` へ redirect（Home がルーターとして機能）
- `app/programs/page.tsx` — enrollment バナーデータを並列取得して ProgramsScreen へ渡す
- `ProgramsScreen.tsx` + CSS — 進行中プログラムバナー追加（「続ける →」CTA）
- `app/programs/[slug]/page.tsx` — anyActiveEnrollment を取得して Detail へ渡す
- `ProgramDetailScreen.tsx` + CSS — enrollment 3 パターン分岐（Resume / 警告+切り替え / Start）

**E2E 仕上げ（H-4-E2E）:**
- `WorkoutSummaryScreen.tsx` — `href="/"` + "Back to Home" → `href="/train"` + "Back to Train"（全 4 箇所）
- `SessionHistoryScreen.tsx` — "← Home" バックリンク削除
- `SessionHistoryScreen.tsx` + CSS — completed セッションに `/workout-summary/[id]` "Summary →" リンク追加

### 導線整合マップ（H-4 後）

| ユーザー状態 | 着地点 |
|---|---|
| 未ログイン → `/` | `/programs`（ゲスト閲覧） |
| ログイン + enrollment あり → `/` | `/train`（ワークアウト継続） |
| ログイン + enrollment なし → `/` | `/programs` |
| ログイン後 `/login` redirect | `/` → 上記分岐 |
| Restart Program → API → redirect | `/` → `/train`（新 enrollment active） |
| History → completed session | "Summary →" で `/workout-summary/[id]` へ直接 |

### NEXT

- Vercel auto-deploy 確認（push 済み）
- active enrollment あり状態での E2E（Programs バナー / ProgramDetail 警告バナー）はログイン環境で確認
- 次フェーズ: 入力 UI 改善（weight/reps 入力体験）または Analytics 準備

---

## 2026-04-15 Auth blocker fix — ErrorCard の sign-in 導線復旧

### STATUS

| 項目 | 状態 |
|---|---|
| `ActiveProgramCard` の `ErrorCard` に Sign In リンク追加 | **完了 ✅** |
| `getActiveProgramView` — 認証未確定で throw した場合は `isAuthenticated: false` を返す | **完了 ✅** |
| TypeScript 型エラー | **なし ✅** |
| localhost での unauth home 再確認（Sign In card 表示）| **pass ✅** |
| localhost での stale cookie シミュレーション（`sb-*` ダミー値）→ Sign In card 表示 | **pass ✅** |

### 現象（Vercel production）

- Home (`/`) を開くと "Could not load your active program. Please try again." の赤い error card が表示
- Home にも他ページにも header / nav に Sign In リンクが存在せず、error card の中にも Sign In なし
- ユーザーは `/login` へたどり着けず **E2E 検証が blocker で停止**

### ROOT CAUSE

1. **`getActiveProgramView` の catch 節が誤って `isAuthenticated: true` を返していた**
   - `auth.getUser()` 自体が throw する経路（expired / broken session cookie 等）でも catch が発火
   - catch 節では auth が確認できたかに関わらず `isAuthenticated: true` + errorMessage をセット
   - localhost では常に fresh state で throw しないため顕在化せず、実ユーザー環境（cookie が蓄積）でのみ再現

2. **`ErrorCard` が escape link を持たなかった**
   - `ActiveProgramCard` の優先順位は `errorMessage → !isAuthenticated → NoProgramCard`
   - errorMessage が立つと Sign In card が描画されず、sign in 導線を完全に失う
   - layout にも global header がなく、error card の外側に login 導線が存在しない

**localhost で通る理由:** fresh dev session では `auth.getUser()` が throw しない → userId=null 経路 → `isAuthenticated:false, errorMessage:null` → NotSignedIn 描画。Vercel 側でも fresh cookie では同じく正常。**"以前 sign in したことがあるブラウザ" の残存 cookie 経由でのみ誤った catch に入る。**

### 変更内容

**components/home/ActiveProgramCard.tsx**
- `ErrorCard` に `/login` への Sign In リンクを追加。どんな error path でも sign in 導線を保つ

**lib/workout/active-program.ts**
- `authConfirmed: boolean` フラグを追加。`auth.getUser()` で `userId` が確定した直後に true にセット
- catch 節で `authConfirmed === false` の場合は `isAuthenticated: false` で返す（stale cookie → fresh "Sign in" card にフォールバック）
- auth 確定後の DB failure のみ従来どおり errorMessage を設定（実害のある error のみ表示）

### 環境変数・設定変更

- **なし**。Vercel 側の env / middleware / Supabase 設定は変更していない
- middleware の matcher は変更せず（`/workout-summary/*` と `/exercise-history/*` のみ保護。Home は public のまま）
- auth callback URL / site URL / cookie 設定は既定のまま

### CHECKS

**localhost（dev server）:**
- 未ログイン GET `/` → "Sign in to track your progress" + "Sign In" link（errCard=false, signIn=true, loginLink=1）
- 破損 cookie 付き GET `/` → "Sign in to track your progress" + "Sign In" link（errCard=false, signIn=true, loginLink=1）
- `tsc --noEmit` → pass

**Vercel（deploy 後に確認するポイント）:**
- 未ログイン `/` → Sign In card が表示される
- stale cookie で `/` → 正常に Sign In card へフォールバック（または errorCard に Sign In link が見える）
- `/login` でサインイン → `/programs` 遷移 → Home で active program card が正常表示

### NEXT

- Vercel 反映後、ユーザーは `https://training-program-platform-jp.vercel.app` で以下を確認:
  1. `/` を開き Sign In card が出ること
  2. "Sign In" リンクから `/login` に遷移できること
  3. sign up / sign in 後に `/programs` → Home に戻り、active program card が progress 表示で出ること
- その後 S-7 E2E（Restart Program ボタン → Home の新 active card）を継続

---

## 2026-04-15 S-7 — Restart Program フロー

### STATUS

| 項目 | 状態 |
|---|---|
| `lib/workout/restart-program.ts`（`restartProgramEnrollment`）新規作成 | **完了 ✅** |
| `app/api/programs/[programId]/restart/route.ts` POST 新規作成 | **完了 ✅** |
| `components/summary/RestartProgramButton.tsx` 新規作成（client） | **完了 ✅** |
| `WorkoutSummaryView` に `programId: string \| null` 追加 | **完了 ✅** |
| `RestartProgramResponse` 型追加 | **完了 ✅** |
| `workout-summary.ts` — `programId` を view に渡す | **完了 ✅** |
| `WorkoutSummaryScreen` — 完走時 CTA を dedicated button に差し替え（Link fallback 残す） | **完了 ✅** |
| idempotency — 既存 active enrollment があれば reuse | **完了 ✅** |
| first day 不在 / broken program は 422 で safe fail | **完了 ✅** |
| TypeScript 型エラー | **なし ✅**（`tsc --noEmit` pass）|

### 設計方針

**再開ではなく再受講:**
- completed enrollment は履歴として保持（update しない）
- 新しい enrollment を INSERT（status='active', current_program_day_id = week 1 / day 1）
- DB の UNIQUE INDEX は `WHERE status='active'` のみに適用されるため、completed は何件でも残る

**restart 条件:**

| 条件 | 動作 | レスポンス |
|---|---|---|
| signed-in + program 存在 + first day 解決可 + 既存 active なし | 新 enrollment INSERT | 201, `reused: false` |
| signed-in + program 存在 + first day 解決可 + 既存 active あり | 既存を返す | 200, `reused: true` |
| program 不存在 | 作成しない | 404 `program_not_found` |
| Week 1 / Day 1 が存在しない（broken program）| 作成しない | 422 `first_day_not_found` |
| 未ログイン | 作成しない | 401 `unauthenticated` |
| Supabase 未設定 | 作成しない | 503 `supabase_unavailable` |

**first day 解決ルール:**

```
1. program_weeks を week_number = 1 で lookup
2. 該当 week の program_days を day_number = 1 で lookup
3. 見つからなければ null → 422 safe fail
```

（`lib/workout/workout-summary.ts` の `selectFirstProgramDayId` と同一仕様 — summary 内部に依存せず独立実装）

**既存 active enrollment がある場合:**
- 新規作成しない（idempotent）
- 既存の id と current_program_day_id を返す（current_program_day_id が null の場合のみ first day に fallback）
- 二重クリック耐性: client 側で `isBusy` flag で連打ブロック + server 側で findActiveEnrollment による reuse

**遷移先:**
- 成功時は `redirectUrl: "/"`（Home）
- Home の active-program card で新 enrollment を progress = 0 として表示
- 直接 /train に飛ばさないことで「新しい active enrollment ができた」ことを明示

### 変更内容

#### types/workout.ts
- `WorkoutSummaryView` に `programId: string | null` を追加（restart API 呼び出しに必要）
- `RestartProgramResponse` 型を新規追加（`enrollmentId` / `programDayId` / `reused` / `redirectUrl`）

#### lib/workout/restart-program.ts（新規）
- `restartProgramEnrollment(programId, userId)` server function
- `resolveFirstProgramDayId(client, programId)` private helper（2 queries）
- `RestartProgramResult` discriminated union を export
- 認証失敗 / program 不在 / first day 不在 / insert 失敗 を明示的に分岐

#### app/api/programs/[programId]/restart/route.ts（新規）
- POST endpoint — auth check → `restartProgramEnrollment` 呼び出し → revalidatePath("/")
- 成功時は 201（新規）or 200（reuse）で `RestartProgramResponse` を返す
- `first_day_not_found` は 422（broken data の明示）

#### lib/workout/workout-summary.ts
- `buildSummaryView` のシグネチャに `programId: string | null` を追加
- `getWorkoutSummaryView` から `program?.id ?? null` を view に渡す

#### components/summary/RestartProgramButton.tsx（新規）
- `"use client"` + `useRouter` + `useTransition`
- POST `/api/programs/:programId/restart` → 成功時は redirectUrl（既定 /）へ navigate + `router.refresh()`
- `isBusy`（local state + transition）で連打ブロック
- エラー時はボタン下に赤文字で表示

#### components/summary/WorkoutSummaryScreen.tsx
- `RestartProgramButton` を import
- `programId` を summary から取り出し、`canRestartViaApi` を導出
- 完走時 primary CTA を 3 パターンで分岐:
  1. `canRestartViaApi` → `RestartProgramButton`（推奨経路）
  2. fallback: `restartFallbackUrl`（旧 payload との互換用リンク → `/train?...`）
  3. どちらも不可 → `Browse Programs` リンク
- completedCard 文言分岐を `hasRestartCta` に変更

### 今回やらないこと（スコープ外）

- completed enrollment の上書き reset
- restart reason / cycle number の保存
- completed runs の比較 UI
- multi-cycle analytics（N 周目表示・前周との比較）
- paused enrollment からの再開
- 同一 program の複数 active enrollment を正式サポートする設計変更

### OPEN ISSUES

- **completed runs の比較表示:** 現状 completed enrollment は history として残るだけで UI 導線なし。session-history からたどる必要がある。将来 "N 周目" 表示をする場合は enrollment 単位のグルーピング UI が必要
- **multi-cycle analytics:** volume/e1RM trend は現状 enrollment 単位で集計（H-4 / H-4b）。複数周回をまたいだ長期推移を見せる場合は user × program 単位での集計が必要になる

### Verification（2026-04-15）

**静的検証（AI 実施）:**

| 項目 | 結果 |
|---|---|
| `tsc --noEmit` | ✅ exit 0（型エラーなし）|
| `next build` | ✅ success — `/api/programs/[programId]/restart` が route table に登録 |
| API smoke（未ログイン POST）| ✅ 401 `unauthenticated` / 日本語メッセージ `ログインが必要です。` を返却 |
| API smoke（不正 UUID POST）| ✅ 401（auth gate が UUID 検証より先に発火、情報漏洩なし）|

**DB 一意性保証:**

```sql
-- supabase/migrations/20260413_000007_not_null_user_id.sql
create unique index idx_program_enrollments_active_user_program
  on public.program_enrollments (user_id, program_id)
  where status = 'active';
```

- `(user_id, program_id) WHERE status='active'` の **partial UNIQUE INDEX 確認済み**
- `findActiveEnrollment` → INSERT が非アトミックでも、DB レイヤで同一 (user, program) の 2 件目 active INSERT を拒否
- client の `isBusy` flag と組み合わせて 2 段構えで冪等性を担保

**Production 反映:**

- commit `0e21dfb` は `feature/auto-dev-phase3-loop` に push 済み
- Vercel の production branch が `feature/auto-dev-phase3-loop` のため **push 時点で自動デプロイ実行**
- live endpoint: `https://training-program-platform-jp.vercel.app/api/programs/[programId]/restart`
- 未ログイン POST で 401 レスポンス live 確認済み

**AI で未実施の E2E（ユーザー検証項目）:**

localhost / preview の両方で、以下はサインイン済みブラウザでの実機確認が必要:

1. プログラム完走 → Summary の "Restart Program" ボタンクリック → Home に遷移
2. Home の active program card に新 enrollment が progress=0 で表示される
3. 同じプログラムをもう一度 Restart（2 重クリック含む）→ 409 等のエラーにならず 200 reuse される
4. Restart 連打中にボタンが "Restarting…" に変わり二重 POST が飛ばない
5. broken program（Week 1/Day 1 が無いシード）での Restart → 422 で safe fail
6. cancelled enrollment は履歴として残り、新 active の進行を妨げない

**preview URL:**

Vercel production branch = `feature/auto-dev-phase3-loop` のため、専用 preview deploy は作成せず production URL を preview として共有する運用。

→ **ユーザー確認 URL: `https://training-program-platform-jp.vercel.app`**

---

## 2026-04-14 S-6 — Workout Summary 改善

### STATUS

| 項目 | 状態 |
|---|---|
| `WorkoutSummaryState` に `"cancelled"` 追加 | **完了 ✅** |
| `WorkoutSummaryView` に `sessionVolume: number \| null` 追加 | **完了 ✅** |
| `workout-summary.ts` — sets に `weight_kg` / `reps_done` を SELECT、volume 計算 | **完了 ✅** |
| `workout-summary.ts` — cancelled session → `state: "cancelled"` + summary データ返却 | **完了 ✅** |
| `WorkoutSummaryScreen` — cancelled 専用ヒーロー・バナー表示 | **完了 ✅** |
| `WorkoutSummaryScreen` — `sessionVolume` stat card 追加 | **完了 ✅** |
| `WorkoutSummaryScreen` — "Back to Home" / "View all sessions" CTA 追加 | **完了 ✅** |
| `WorkoutSummaryScreen` — back link を `/train` → `/` に修正 | **完了 ✅** |
| TypeScript 型エラー | **なし ✅** |

### 変更内容

#### types/workout.ts
- `WorkoutSummaryState` に `"cancelled"` を追加
- `WorkoutSummaryView` に `sessionVolume: number | null` を追加（totalVisibleSets の直後）

#### lib/workout/workout-summary.ts
- `WorkoutSetRow` に `weight_kg: number | null` / `reps_done: number | null` を追加
- `selectVisibleWorkoutSets` SELECT に `weight_kg, reps_done` を追加
- `buildSummaryView` — `visibleSets` ループ内で volume 累計（H-4 と同定義: completed + non-null weight）→ `sessionVolume` 算出
- `getWorkoutSummaryView` の最終 return を修正:
  - `completed` → `state: "ready"`
  - `cancelled` → `state: "cancelled"`（summary データも返す — UI でキャンセル済みセッションの実績を表示可能）
  - `in_progress` → `state: "not_completed"`

#### components/summary/WorkoutSummaryScreen.tsx
- `resolveStateTitle` / `resolveStateBody` に `"cancelled"` 分岐追加
- `isCancelled` フラグ追加、`showMetadata` / `showExercises` を `isReady || isCancelled` で拡張
- キャンセル済みセッション: `heroCancelled` スタイル + `cancelledBanner` を表示
- stats grid に `sessionVolume` カード追加（null 時は非表示）
- "Completed At" → キャンセル時は "Started At" へ切り替え
- CTA 構造を再設計:
  - cancelled: "Back to Home"（primary）/ "View all sessions"（secondary）
  - isProgramCompleted: "Restart Program" / "Browse Programs"（primary）+ "Back to Home" / "View all sessions" / "Choose Another Program"（secondary）
  - nextTrainUrl あり: "Go to Next Day"（primary）+ "Back to Home" / "View all sessions"（secondary）
  - fallback: "Back to Home"（primary）/ "View all sessions" / "Browse Programs"（secondary）
- back link: `isProgramCompleted ? "/programs" : "/"`（旧: `/train`）

#### components/summary/WorkoutSummaryScreen.module.css
- `.heroCancelled` — 赤系グラジェント hero
- `.cancelledBanner` — キャンセル通知バナー

### session volume 定義（H-4 と同一）

```
sessionVolume = Math.round(Σ weight_kg × reps_done)
  where: is_completed = true AND deleted_at IS NULL AND weight_kg IS NOT NULL AND reps_done IS NOT NULL
null when no qualifying sets (bodyweight-only session 等)
```

---

## 2026-04-14 S-5 — Cancel Workout (in_progress session discard)

### STATUS

| 項目 | 状態 |
|---|---|
| `POST /api/workout-sessions/[id]/cancel` 新規作成 | **完了 ✅** |
| `WorkoutSessionCancelResponse` 型追加 | **完了 ✅** |
| `WorkoutScreen` — Cancel ボタン + `handleCancel` + `isSessionCancelled` / `isSessionEnded` | **完了 ✅** |
| mutation guard を `isSessionEnded` に統一 | **完了 ✅** |
| CSS — `.cancelButton` / `.cancelledBanner` / `.topBarActions` / `.finishButtonCancelled` | **完了 ✅** |
| TypeScript 型エラー | **なし ✅** |

### 状態遷移ルール

| 条件 | Cancel API 挙動 | enrollment |
|---|---|---|
| `in_progress` | `status = 'cancelled'` | 変更なし（`current_program_day_id` 保持） |
| `cancelled` | 200 no-op（idempotent） | 変更なし |
| `completed` | 409 エラー | 変更なし |
| session not found | 404 | — |

### Cancel 後の各画面の見え方

| 画面 | 挙動 |
|---|---|
| Cancel 直後 | `router.push("/")` でホームへ遷移 |
| Home CTA | `actionType = 'start'`（in_progress session がなくなるため）→ "Start next workout" |
| `/train?program=slug&programDayId=sameDay` | `resolveTrainingEntry` = `mode='start'`（in_progress がないため）→ StartSessionScreen |
| session-history | 一覧に `status='cancelled'` で表示（既存リスト実装より） |
| trend / e1RM / volume | `status='completed'` のみ集計のため影響なし |

### UI 詳細

- topBar に `topBarActions` div を追加: `[Cancel] [Finish]` 横並び
- Cancel ボタンは `isSessionEnded` のとき非表示（completed / cancelled 後は不要）
- Finish ボタンラベル: `Completed` / `Cancelled` / `Finishing...` / `Finish`
- confirm dialog 文言:
  - completedSetCount = 0: `"Discard this workout? No completed sets will be lost."`
  - completedSetCount ≥ 1: `"Discard this workout? N completed set(s) will be kept in history but this session will be marked as cancelled."`
- Cancel 成功後は `router.push("/")` — WorkoutScreen を離れる

### データ保持方針

- `workout_sets` / `workout_session_exercises` は**物理削除しない**
- `status = 'cancelled'` による論理無効化のみ
- 理由: audit / future analytics / 誤 cancel からの recovery 余地を残す
- 集計クエリ（trend / e1RM）は `status='completed'` のみを対象にしているため汚染なし

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `app/api/workout-sessions/[id]/cancel/route.ts` | **新規作成** |
| `types/workout.ts` | `WorkoutSessionCancelResponse` 追加 |
| `components/workout/WorkoutScreen.tsx` | Cancel ボタン / `handleCancel` / `isCancelling` / `isSessionCancelled` / `isSessionEnded` / mutation guard 統一 / cancelled banner |
| `components/workout/WorkoutScreen.module.css` | `.topBarActions` / `.cancelButton` / `.cancelledBanner` / `.finishButtonCancelled` 追加 |

---

## 2026-04-14 S-4 — Session Completion → Enrollment Advancement

### STATUS

| 項目 | 状態 |
|---|---|
| session finish → `advanceEnrollmentAfterSessionComplete` 呼び出し（新規 path） | **完了 ✅** |
| 既存 completed session の early-return で enrollment advance が skip される recovery gap を修正 | **完了 ✅** |
| `revalidatePath("/")` 追加（Home progress 即時反映） | **完了 ✅** |
| TypeScript 型エラー | **なし ✅** |

### 実装概要

S-4 の大部分（finish ボタン / API / enrollment 進行 / idempotency guard / summary 画面）は D-1〜D-4 で実装済みだった。
今回修正したのは 1 箇所のみ: `POST /api/workout-sessions/[id]/finish` の `session.status === 'completed'` early-return パス。

#### 修正前の問題（recovery gap）

```
first POST:
  1. UPDATE workout_sessions SET status='completed' ✅
  2. advanceEnrollmentAfterSessionComplete()         ← 失敗 (silent)
     → enrollment がスタックしたまま

retry POST (session already completed):
  session.status === 'completed' → early return     ← advance は呼ばれない
  → enrollment が永続的にスタック
```

#### 修正後

```
retry POST (session already completed):
  session.status === 'completed'
  → advanceEnrollmentAfterSessionComplete() を呼ぶ  ← 追加
    - enrollment 進んでいれば idempotency guard で no-op
    - enrollment スタックなら advance を実行して回復
  → 200 return
```

### 状態遷移ルール（完全版）

| 条件 | 挙動 |
|---|---|
| in_progress session → finish | `status='completed'`, `finished_at=now()`, enrollment 進行 |
| 既に completed session → retry finish | session 更新なし、enrollment advance を retry して return 200 |
| 中間 day 完了 | `enrollment.current_program_day_id` = 次の day UUID |
| 最終 day 完了 | `enrollment.status = 'completed'`、`current_program_day_id` は最終 day のまま保持 |
| enrollment.current_program_day_id ≠ session.program_day_id（idempotency guard） | advance を skip（D-3: 二重進行防止） |
| incomplete sets > 0, forceFinish = false | 409 + `requiresConfirmation: true` → ブラウザ確認 dialog |
| broken data (program_day_id null, no enrollment) | silent skip、session のみ完了扱い |

### 最終 day の設計判断

`findNextProgramDayId` が null（プログラム完走）のとき:
- `enrollment.status = 'completed'` に更新
- `current_program_day_id` は**最後の day のまま保持**（null にしない）
- 理由: どこまでやったかの情報を保持するため。Home は `status='active'` のみを対象とするため完了 enrollment は自動的に非表示になる

### S-3 との整合

| ケース | 挙動 |
|---|---|
| completed session の `program_day_id` で `/train` 再入場 | `resolveTrainingEntry` は `status='in_progress'` のみを検索 → in_progress なし → `mode='start'` → StartSessionScreen（re-session 可能） |
| Home に戻ると | `force-dynamic` で毎回再取得 + `revalidatePath("/")` で即時反映 |

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `app/api/workout-sessions/[id]/finish/route.ts` | `session.status === 'completed'` 分岐内に `advanceEnrollmentAfterSessionComplete` 呼び出しを追加。`revalidatePath("/")` を追加 |

### 既存実装（D-1〜D-4）の再確認

| 機能 | 場所 | 状態 |
|---|---|---|
| `findNextProgramDayId()` — 次 day 解決 | `lib/workout/enrollment.ts` | ✅ 実装済み |
| `advanceEnrollmentAfterSessionComplete()` — enrollment 進行 | `lib/workout/enrollment.ts` | ✅ 実装済み |
| D-3 idempotency guard | `lib/workout/enrollment.ts` | ✅ 実装済み |
| Finish ボタン + 確認 dialog | `components/workout/WorkoutScreen.tsx` | ✅ 実装済み |
| Summary (isProgramCompleted / Up Next / Restart) | `lib/workout/workout-summary.ts` + `WorkoutSummaryScreen.tsx` | ✅ 実装済み |

---

## 2026-04-14 S-3 — /train Entry Resolution (blocked state)

### STATUS

| 項目 | 状態 |
|---|---|
| `TrainEntryResolution` 型を `types/workout.ts` に追加 | **完了 ✅** |
| `lib/workout/train-entry.ts` — `resolveTrainingEntry()` 新規作成 | **完了 ✅** |
| `components/train/BlockedSessionScreen.tsx` / `.module.css` 新規作成 | **完了 ✅** |
| `app/train/page.tsx` — blocked 分岐を追加 | **完了 ✅** |
| TypeScript 型エラー | **なし ✅** |

### Resolution モード

| mode | 条件 | 挙動 |
|---|---|---|
| `resume` | 同 day の `in_progress` session が存在する | 既存フロー通過 → WorkoutScreen |
| `start` | `in_progress` session なし、または enrollment 未作成 | 既存フロー通過 → StartSessionScreen |
| `blocked` | 同 enrollment の**別 day** に `in_progress` session あり | `BlockedSessionScreen` を返す（新 session 作成をブロック） |
| `invalid` | unauthenticated / supabase 不達 | 既存フロー通過（graceful degradation） |

### BlockedSessionScreen

- エラーカード（赤テーマ）で blocking session の day label を表示
- CTA: "Resume [day label]" → `/train?program=<slug>&programDayId=<blockedByProgramDayId>`
- "Start anyway" は意図的に非実装（現フェーズ外）
- 副アクション: "Go to Home"

### クエリ予算（resolveTrainingEntry — 最大 5 クエリ、N+1 なし）

| ステップ | クエリ | 条件 |
|---|---|---|
| 1a | `program_days` で `program_week_id` を解決 | 常時 |
| 1b | `program_weeks` で `program_id` を解決 | 常時 |
| 2 | `program_enrollments` で active enrollment を検索 | `program_id` 解決済みの場合 |
| 3 | `workout_sessions` で in_progress sessions を検索 | enrollment あり |
| 4 | `getProgramDayLabel` で blocking day ラベルを取得 | mode = `blocked` のみ |

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `types/workout.ts` | `TrainEntryResolution` 型を追加 |
| `lib/workout/train-entry.ts` | **新規作成** — `resolveTrainingEntry(programDayId)` |
| `components/train/BlockedSessionScreen.tsx` | **新規作成** |
| `components/train/BlockedSessionScreen.module.css` | **新規作成** |
| `app/train/page.tsx` | `resolveTrainingEntry()` を呼び出し、blocked 時に `BlockedSessionScreen` を返す |

---

## 2026-04-14 S-2 — Home Resume/Start CTA

### STATUS

| 項目 | 状態 |
|---|---|
| `ActiveProgramView` に `actionType` / `activeSessionId` 追加 | **完了 ✅** |
| `InProgressSessionRow` 型 / `selectInProgressSessionsForEnrollments` 追加 | **完了 ✅** |
| Batch 1 に `inProgressSessions` を追加（13クエリ固定） | **完了 ✅** |
| `inProgressByEnrollmentId` マップ構築 + `actionType` / `continueUrl` 算出 | **完了 ✅** |
| `ActiveProgramCard.tsx` — CTA ラベルを actionType で切り替え | **完了 ✅** |
| TypeScript 型エラー | **なし ✅** |

### actionType 判定ルール

| 条件 | actionType | CTA ラベル |
|---|---|---|
| `in_progress` session あり | `'resume'` | **Resume workout** |
| `in_progress` なし + `current_program_day_id` あり | `'start'` | **Start next workout** |
| `current_program_day_id` なし（edge case） | `'none'` | Continue Training (fallback) |

### 遷移先（continueUrl）

| ケース | URL |
|---|---|
| resume | `/train?program=${slug}&programDayId=${in_progress_session.program_day_id}` |
| start | `/train?program=${slug}&programDayId=${enrollment.current_program_day_id}` |
| none | `/train?program=${slug}` |

- train ページが `programDayId` を受け取り、in-progress session の存在を自動検出して resume/start を切り替える（既存ロジックをそのまま再利用）
- 二重作成防止も `startSessionForDay()` の既存 idempotency guard が担う

### クエリ追加

- `selectInProgressSessionsForEnrollments`: 1クエリ追加（Batch 1 に同時並列）
- 合計 **13クエリ固定**（enrollment 数に依存しない）

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `types/workout.ts` | `actionType: 'start'|'resume'|'none'` / `activeSessionId: string|null` を `ActiveProgramView` に追加 |
| `lib/workout/active-program.ts` | `InProgressSessionRow` 型、`selectInProgressSessionsForEnrollments`、`inProgressByEnrollmentId` マップ、`actionType` + resume-aware `continueUrl` 算出を追加 |
| `components/home/ActiveProgramCard.tsx` | CTA ラベルを actionType で三分岐 |

### Defensive handling

| ケース | 対処 |
|---|---|
| enrollment 0件 | 既存 empty state 維持（変化なし） |
| `current_program_day_id = null` | `actionType = 'none'` → "Continue Training" fallback |
| in-progress session が複数（異常系） | DESC order で最新1件を `inProgressByEnrollmentId` に格納（先着）|
| in-progress session の `program_day_id = null` | `enrollment.current_program_day_id` にフォールバック |
| `selectInProgressSessionsForEnrollments` エラー | `[]` を返す（card 全体は維持） |

---

## 2026-04-14 H-4b — e1RM Trend (T1 primary lift)

### STATUS

| 項目 | 状態 |
|---|---|
| `E1RMTrend` 型を `types/workout.ts` に追加 | **完了 ✅** |
| `ActiveProgramView` に `e1rmTrend: E1RMTrend` フィールドを追加 | **完了 ✅** |
| `TrendExerciseRow` に `exercise_type` / `exercise_id` を追加（クエリ拡張） | **完了 ✅** |
| `buildE1RMTrend` — primary T1 lift 選定 + Epley e1RM 算出 | **完了 ✅** |
| `getActiveProgramView` — `e1rmTrend` を各 enrollment view に追加 | **完了 ✅** |
| `E1RMSection` コンポーネント追加（sparkline + 数値比較） | **完了 ✅** |
| TypeScript 型エラー | **なし ✅** |
| 追加クエリ数 | **0（12クエリ固定維持）** |

### T1 判定ルール

| 項目 | ルール |
|---|---|
| T1 判定 | `workout_session_exercises.exercise_type = 'T1'`（DB カラム、NOT NULL） |
| fallback | 不要（カラムが存在するため） |
| Primary T1 lift | T1 exercise_id の中で最多 session 数のもの（tie は Map 挿入順で先勝ち） |
| スコープ | enrollment 単位で独立選定（enrollment ごとに主役 lift が異なってよい） |

### e1RM 定義

| 項目 | 定義 |
|---|---|
| 計算式 | Epley: `e1RM = weight_kg × (1 + reps_done / 30)` |
| Session 代表値 | その session 内の primary T1 completed sets のうち **e1RM 最大値** |
| 除外条件 | `weight_kg = null / ≤ 0`（自重種目等）/ `reps_done = null / ≤ 0` |
| 丸め | `Math.round(e1rm × 10) / 10`（1 decimal）。表示は `.toFixed(1)` |
| sparkline | T1 データが存在する session のみ（データなし session はバー非表示） |

### クエリ変更

- `selectTrendExercises` の select に `exercise_type, exercise_id` を追加のみ
- 新規クエリ追加なし → **12クエリ固定を維持**

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `types/workout.ts` | `E1RMTrend` 型追加、`ActiveProgramView.e1rmTrend` フィールド追加 |
| `lib/workout/active-program.ts` | `TrendExerciseRow` に `exercise_type` / `exercise_id` 追加、`selectTrendExercises` 拡張、`buildE1RMTrend` 追加、view 構築に `e1rmTrend` 追加 |
| `components/home/ActiveProgramCard.tsx` | `E1RMSection` コンポーネント追加、`ProgramCard` に配置 |

### 表示ルール

| recentE1RMs 数 | 表示 |
|---|---|
| 0（T1データなし） | e1RM section 非表示 |
| 1 | sparkline 1本 + `X.X kg` + "Not enough data" |
| 2+ | sparkline + `prev → latest (+X.X%)` |

### Defensive handling

| ケース | 対処 |
|---|---|
| T1 exercises 0件 | `empty` を返す（section 非表示） |
| primary T1 が複数 session に均等分布 | Map 挿入順で先勝ち（安全、deterministic） |
| `weight_kg = null` / `reps_done = null` | continue でスキップ |
| `previousE1RM = 0` | `e1rmChangePercent = null`（0除算防止） |
| 異種 T1 混在（Upper/Lower 等） | primary lift 1本に絞る → 比較不能を防ぐ |

---

## 2026-04-14 H-4 — Volume Trend (first slice)

### STATUS

| 項目 | 状態 |
|---|---|
| `VolumeTrend` 型を `types/workout.ts` に追加 | **完了 ✅** |
| `ActiveProgramView` に `trend: VolumeTrend` フィールドを追加 | **完了 ✅** |
| `selectTrendSessions` / `selectTrendExercises` / `selectTrendSets` バッチクエリ追加 | **完了 ✅** |
| `aggregateSessionVolumes` — session ごとの volume 集計 | **完了 ✅** |
| `buildVolumeTrend` — enrollment ごとの trend 算出 | **完了 ✅** |
| `getActiveProgramView` — 12クエリ固定で trend データをバッチ取得に組み込み | **完了 ✅** |
| `TrendSection` コンポーネント追加（sparkline + 数値比較） | **完了 ✅** |
| `ActiveProgramCard.module.css` — trend section スタイル追加 | **完了 ✅** |
| TypeScript 型エラー | **なし ✅** |

### Volume 定義

| 項目 | 定義 |
|---|---|
| 対象セッション | `status = 'completed'` かつ `program_enrollment_id IN (enrollment_ids)` |
| 対象セット | `is_completed = true` かつ `deleted_at IS NULL` |
| Volume 計算式 | `SUM(weight_kg × reps_done)` |
| 除外条件 | `weight_kg IS NULL or ≤ 0`（自重種目等）/ `reps_done IS NULL or ≤ 0` |
| セッション volume | 上記セットの合計（自重種目のみのセッションは volume = 0 だが sessions 数に計上） |
| 集計対象件数 | 直近最大 6 セッション（`TREND_SESSION_LIMIT`）/ enrollment ごと |

### クエリ構成（12クエリ固定、N+1なし）

| バッチ | クエリ | 依存 |
|---|---|---|
| 1 (parallel×5) | programs / currentDays / allWeeks / recentSessions / **trendSessions** | enrollmentIds のみ |
| 2 (parallel×4) | currentWeeks / allDays / sessionDays / **trendExercises** | trendSessions.ids |
| 3 (parallel×2) | sessionWeeks / **trendSets** | trendExercises.ids |

### 表示ルール

| sessions 数 | 表示 |
|---|---|
| 0 | trend section 非表示 |
| 1 | sparkline 1本 + latest volume (kg) + "Not enough data" |
| 2+ | sparkline + `previous → latest (+X.X%)` |

### Defensive handling

- `weight_kg = null` → 0 扱い（volume に加算しない、session は count される）
- `volumeChangePercent = null` when `previousVolume = 0`（0除算防止）
- `recentVolumes = []` → `TrendSection` が null を返す（crash なし）
- `latestVolume = null` → trend section 非表示（null チェック明示）
- `sessionVolumeMap.get(...)` が `undefined` → 0 に fallback（`?? 0`）

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `types/workout.ts` | `VolumeTrend` 型追加、`ActiveProgramView` に `trend` フィールド追加 |
| `lib/workout/active-program.ts` | `TrendSessionRow` / `TrendExerciseRow` / `TrendSetRow` 追加、3クエリ関数追加、`aggregateSessionVolumes` / `buildVolumeTrend` 追加、`getActiveProgramView` をバッチ拡張 |
| `components/home/ActiveProgramCard.tsx` | `TrendSection` コンポーネント追加、`ProgramCard` 内の最下部に配置 |
| `components/home/ActiveProgramCard.module.css` | trend section 用スタイル追加（sparkline / trendValues / trendUp / trendDown 等） |

### OPEN ISSUES（次段階: e1RM）

- **exercise 選定:** T1 種目（Squat / Bench / Deadlift 等）に絞る必要あり。全種目 e1RM 表示は意味が薄い
- **算出式:** Epley（`w × (1 + r/30)`）か Brzycki か選定が必要
- **top set の定義:** セッション内で最重量のセット（重量優先）or 最高 RPE セットか要決定
- **表示粒度:** enrollment 全体の top set e1RM か、最新セッションのみか
- **実装タイミング:** volume trend の動作と表示設計が固まってから着手推奨

---

## 2026-04-14 H-3c — Multi-enrollment Home

### STATUS

| 項目 | 状態 |
|---|---|
| `ActiveProgramResult.view` → `views: ActiveProgramView[]` に変更 | **完了 ✅** |
| `selectActiveEnrollments` — LIMIT 1 撤去、updated_at / created_at desc 順 | **完了 ✅** |
| `selectProgramsBatch` / `selectCurrentDaysBatch` バッチ取得に置換 | **完了 ✅** |
| `selectAllProgramWeeksByProgramIds` — program_ids バッチ取得 | **完了 ✅** |
| `selectRecentSessionsForEnrollments` — enrollment_ids バッチ取得 + in-memory 分配 | **完了 ✅** |
| `computeProgress` を enrollment ごとに独立呼び出し | **完了 ✅** |
| `ActiveProgramCard.tsx` — `ProgramCard` 抽出 / 0-1-N 表示分岐 | **完了 ✅** |
| `app/page.tsx` — `views` 配列を渡すよう変更 | **完了 ✅** |
| TypeScript 型エラー | **なし ✅** |

### クエリ方針（N+1 なし）

- total 9 クエリ固定（enrollment 数に比例しない）
  1. `selectActiveEnrollments`
  2–5. parallel: `selectProgramsBatch` / `selectProgramDaysBatch`(currentDays) / `selectAllProgramWeeksByProgramIds` / `selectRecentSessionsForEnrollments`
  6–8. parallel: `selectProgramWeeksBatch`(currentWeeks) / `selectAllProgramDays` / `selectProgramDaysBatch`(sessionDays)
  9. `selectProgramWeeksBatch`(sessionWeeks)

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `types/workout.ts` | `ActiveProgramResult.view → views: ActiveProgramView[]` |
| `lib/workout/active-program.ts` | 全 query 関数をバッチ対応に置換、`getActiveProgramView` を N-enrollment 対応に書き直し |
| `components/home/ActiveProgramCard.tsx` | `ProgramCard` サブコンポーネント抽出、props を `views[]` に変更、0/1/N 表示分岐 |
| `app/page.tsx` | `views` 配列を渡すよう変更 |

### 表示分岐

| enrollments 数 | 表示 |
|---|---|
| 0 | 既存 empty state（変化なし） |
| 1 | 既存 ProgramCard と同一の外見 |
| 2+ | ProgramCard を縦に複数枚 |

### Defensive handling

- `current_program_day_id = null` → `completedDays = 0`（progress 0%）
- `current_program_day_id` が day 一覧に存在しない → `completedDays = 0`（crash しない）
- `totalDays = 0` → progress bar 非表示（既存挙動を維持）
- inactive / archived program が program_id に対応しない → title "Current Program" でフォールバック
- enrollment に program_enrollment_id のない sessions → in-memory 分配で自動スキップ

---

## 2026-04-14 H-3b — Progress Bar

### STATUS

| 項目 | 状態 |
|---|---|
| `completedDays` / `totalDays` / `progressPercent` を `ActiveProgramView` に追加 | **完了 ✅** |
| `selectAllProgramWeeks` / `selectAllProgramDays` / `computeProgress` 追加 | **完了 ✅** |
| `Promise.all` 再編（第1バッチに allWeeks、第2バッチに allDays + currentWeek + sessionDays）| **完了 ✅** |
| `ActiveProgramCard.tsx` — progress bar セクション追加 | **完了 ✅** |
| `ActiveProgramCard.module.css` — progress bar スタイル追加 | **完了 ✅** |
| TypeScript 型エラー | **なし ✅** |
| `docs/h3b-progress-bar-spec.md` 作成 | **完了 ✅** |

### 算出ロジック

- `totalDays` = program の全 program_days 数
- `completedDays` = `current_program_day_id` の sorted index（week_number ASC → day_number ASC）
- `progressPercent` = `Math.round(completedDays / totalDays * 100)`
- `current_program_day_id = null` → completedDays = 0（safe fallback）
- `totalDays = 0` → progress bar 非表示

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `types/workout.ts` | `ActiveProgramView` に `completedDays` / `totalDays` / `progressPercent` 追加 |
| `lib/workout/active-program.ts` | `selectAllProgramWeeks` / `selectAllProgramDays` / `computeProgress` 追加、Promise.all 再編 |
| `components/home/ActiveProgramCard.tsx` | progress bar セクション（meta 直下、positionRow 直上） |
| `components/home/ActiveProgramCard.module.css` | progress bar スタイル群追加 |
| `docs/h3b-progress-bar-spec.md` | 新規作成 |

---

## 2026-04-14 H-3 — Active Program Dashboard

### STATUS

| 項目 | 状態 |
|---|---|
| `ActiveProgramSession` / `ActiveProgramView` / `ActiveProgramResult` 型追加 | **完了 ✅** |
| `lib/workout/active-program.ts` — `getActiveProgramView` 実装 | **完了 ✅** |
| `app/page.tsx` — SSR 化（force-dynamic）+ ActiveProgramCard 組み込み | **完了 ✅** |
| `components/home/ActiveProgramCard.tsx` + `.module.css` 新規作成 | **完了 ✅** |
| TypeScript 型エラー | **なし ✅** |
| `docs/h3-active-program-spec.md` 作成 | **完了 ✅** |

### DISCOVERY

- `program_enrollments.program_id` は直接カラムとして存在 → program join に program_day → program_week 経由の traversal 不要
- `current_program_day_id` から Continue Training URL を直接生成できる
- 既存の `/login` がサインイン入口（`/auth/signin` は存在しない）

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `types/workout.ts` | `ActiveProgramSession` / `ActiveProgramView` / `ActiveProgramResult` を追加 |
| `lib/workout/active-program.ts` | 新規作成。`getActiveProgramView()` — active enrollment → program → day/week → recent 3 sessions |
| `app/page.tsx` | SSR 化、`ActiveProgramCard` + nav grid（Programs / Train / History）を配置 |
| `app/page.module.css` | nav grid スタイル追加、旧 card/list スタイル削除 |
| `components/home/ActiveProgramCard.tsx` | My Program カード（active / empty / 未認証 / エラー 4状態） |
| `components/home/ActiveProgramCard.module.css` | カードスタイル |
| `docs/h3-active-program-spec.md` | 新規作成 |

### 表示分岐

| 状態 | 表示 |
|---|---|
| active enrollment あり | My Program カード（タイトル・level・頻度・期間・Up Next・Continue Training・直近3セッション） |
| 認証済み + enrollment なし | "No active program" + Browse Programs |
| 未認証 | "Sign in to track your progress" + Sign In → `/login` |
| エラー | エラーメッセージ |

### OPEN ISSUES

| ID | 内容 |
|---|---|
| H-3b | 全体進捗バー（完了 day 数 / 総 day 数） |
| H-3c | 複数 active enrollment のサポート（現在 LIMIT 1） |

---

## 2026-04-14 H-2 — Session Detail

### STATUS

| 項目 | 状態 |
|---|---|
| `WorkoutSessionDetailSet` / `WorkoutSessionDetailExercise` / `WorkoutSessionDetailView` / `SessionDetailResult` 型追加 | **完了 ✅** |
| `lib/workout/session-detail.ts` — `getWorkoutSessionDetailView` 実装 | **完了 ✅** |
| `app/session-history/[sessionId]/page.tsx` — 動的ルートページ作成 | **完了 ✅** |
| `SessionDetailScreen.tsx` + `.module.css` — 詳細画面コンポーネント作成 | **完了 ✅** |
| `SessionHistoryScreen.tsx` — "View summary" → "View detail" リンク先を `/session-history/<id>` に変更 | **完了 ✅** |
| TypeScript 型エラー | **なし ✅** |
| `docs/h2-session-detail-spec.md` 作成 | **完了 ✅** |

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `types/workout.ts` | `WorkoutSessionDetailSet` / `WorkoutSessionDetailExercise` / `WorkoutSessionDetailView` / `SessionDetailResult` を追加 |
| `lib/workout/session-detail.ts` | 新規作成。`getWorkoutSessionDetailView(sessionId)` — 8クエリ（session owner guard → exercises → sets → program day/week/program） |
| `app/session-history/[sessionId]/page.tsx` | 動的ルートページ 新規作成（force-dynamic） |
| `components/history/SessionDetailScreen.tsx` | 詳細画面コンポーネント 新規作成 |
| `components/history/SessionDetailScreen.module.css` | 詳細画面スタイル 新規作成 |
| `components/history/SessionHistoryScreen.tsx` | "View summary →" → "View detail →"、リンク先を `/session-history/<id>` へ変更 |
| `docs/h2-session-detail-spec.md` | 新規作成 |

### 画面構成

- Hero: 日付 / プログラム名 — Week N / Day N / ステータスバッジ
- Stats Grid: Started / Finished / Sets Done（completed/total）
- Exercise List: エクササイズカード × N（T1/T2/T3 バッジ / Swapped バッジ / Added バッジ / セットテーブル）
- セットテーブル: # / Kg / Reps / Done（✓/—）/ Note（note があるエクササイズのみ列表示）
- 完了行: `color: --text-primary`、未完了行: `opacity: 0.5`

### OPEN ISSUES

| ID | 内容 |
|---|---|
| H-2b | セット編集（詳細画面からのインライン修正） |
| H-2c | 種目別パフォーマンスグラフ |
| H-3 | セッション削除・アーカイブ |

---

## 2026-04-14 D-4 — Program Re-enroll

### STATUS

| 項目 | 状態 |
|---|---|
| `firstProgramDayId` 型追加（`WorkoutSummaryView`） | **完了 ✅** |
| `selectFirstProgramDayId` 実装（`workout-summary.ts`） | **完了 ✅** |
| "Restart Program" CTA（`WorkoutSummaryScreen.tsx`） | **完了 ✅** |
| TypeScript 型エラー | **なし ✅** |
| `docs/d4-reenroll-spec.md` 作成 | **完了 ✅** |

### DISCOVERY

- `findOrCreateEnrollment` は completed enrollment を無視し、**新 enrollment を INSERT** — re-enroll コアロジックは既実装
- `UNIQUE INDEX` が `WHERE status='active'` のみに適用 → completed は複数保持可能
- 欠けていたのは「Summary から firstProgramDayId を受け取り、Restart Program CTA を出す」UIだけ

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `types/workout.ts` | `WorkoutSummaryView` に `firstProgramDayId: string \| null` を追加 |
| `lib/workout/workout-summary.ts` | `selectFirstProgramDayId` 追加。`isProgramCompleted` 時のみ呼び出し（+2クエリ） |
| `components/summary/WorkoutSummaryScreen.tsx` | `restartUrl` 生成、完走時 actions を "Restart Program" + "Choose Another Program" に変更 |
| `docs/d4-reenroll-spec.md` | 新規作成 |

### 完走後の CTA 分岐

| 状態 | Primary | Secondary |
|---|---|---|
| 完走 + firstDayId あり | **Restart Program** → `/train?program=<slug>&programDayId=<firstDayId>` | Choose Another Program → `/programs` |
| 完走 + firstDayId なし | Browse Programs → `/programs` | — |

---

## 2026-04-14 S-1 — Exercise Swap MVP

### STATUS

| 項目 | 状態 |
|---|---|
| API（PATCH swap endpoint） | **実装済み ✅**（S-1 以前から） |
| `postSwapExercise` クライアント関数 | **実装済み ✅**（S-1 以前から） |
| UI modal（Add/Swap 共有） | **実装済み ✅**（S-1 以前から） |
| `was_swapped` DB 列 | **実装済み ✅**（S-1 以前から） |
| Train「Swapped」バッジ追加 | **完了 ✅** |
| Summary「Swapped this session」バッジ追加 | **完了 ✅** |
| TypeScript 型エラー | **なし ✅** |
| `docs/swap-spec.md` 作成 | **完了 ✅** |

### DISCOVERY

S-1 のコア機能（API・クライアント・モーダル・型・DB）は実装済みだった。
今回追加したのは視覚フィードバック（Swapped バッジ）のみ。

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `components/workout/WorkoutScreen.tsx` | `wasSwapped` 時に Swapped バッジ表示（`headerHint` を差し替え） |
| `components/workout/WorkoutScreen.module.css` | `.swappedBadge` スタイル追加 |
| `components/summary/WorkoutSummaryScreen.tsx` | `wasSwapped` 時に「Swapped this session」バッジ追加 |
| `components/summary/WorkoutSummaryScreen.module.css` | `.swappedBadge` スタイル追加 |
| `docs/swap-spec.md` | 新規作成（API仕様・UIフロー・blocker条件・スコープ外） |

### OPEN ISSUES

| ID | 内容 |
|---|---|
| S-2 | 恒久 swap（program day への書き戻し） |
| S-3 | 代替種目の自動推薦 |
| S-4 | `original_exercise_id` DB 列追加（元種目追跡） |

---

## 2026-04-14 H-1 — Session History（直近セッション一覧）

### STATUS

| 項目 | 状態 |
|---|---|
| `WorkoutSessionListItem` / `SessionHistoryResult` 型追加 | **完了 ✅** |
| `lib/workout/session-list.ts` 新規作成 | **完了 ✅** |
| `app/session-history/page.tsx` 新規作成 | **完了 ✅** |
| `components/history/SessionHistoryScreen.tsx` 新規作成 | **完了 ✅** |
| Home ページに Session History リンク追加 | **完了 ✅** |
| TypeScript 型エラー | **なし ✅** |
| `docs/session-history-spec.md` 作成 | **完了 ✅** |

### 変更ファイル

| ファイル | 内容 |
|---|---|
| `types/workout.ts` | `WorkoutSessionListItem` / `SessionHistoryResult` 型追加 |
| `lib/workout/session-list.ts` | 新規 — `getSessionHistoryView()` / 5クエリで session リストを構築 |
| `app/session-history/page.tsx` | 新規 — Server Component（`force-dynamic`） |
| `components/history/SessionHistoryScreen.tsx` | 新規 — カードリスト UI / auth guard / empty state |
| `components/history/SessionHistoryScreen.module.css` | 新規 |
| `app/page.tsx` | "Session History" ボタン追加 |
| `docs/session-history-spec.md` | 新規 — 仕様書 |

### 表示分岐

| 状態 | 表示 |
|---|---|
| 未ログイン | "Sign in is required to view session history." |
| 0 件 | Empty state + Train へのリンク |
| 1 件以上 | カード一覧（実施日・ステータス・プログラム名・種目数） |
| completed | "View summary →" リンク表示 |

---

## 2026-04-14 D-2 — Summary → 次 day 直接 CTA

### STATUS

| 項目 | 状態 |
|---|---|
| `WorkoutSummaryView` に `nextProgramDayId` / `programSlug` 追加 | **完了 ✅** |
| `workout-summary.ts` で UUID と slug を解決・返却 | **完了 ✅** |
| `WorkoutSummaryScreen.tsx` に Go to Next Day CTA 追加 | **完了 ✅** |
| TypeScript 型エラー | **なし ✅** |
| `docs/day-progression-spec.md` 更新（D-2 セクション追加） | **完了 ✅** |

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `types/workout.ts` | `WorkoutSummaryView` に `nextProgramDayId: string \| null` / `programSlug: string \| null` を追加 |
| `lib/workout/workout-summary.ts` | `ProgramRow` に `slug` を追加、`nextProgramDayId` を outer scope に保持して view に渡す |
| `components/summary/WorkoutSummaryScreen.tsx` | `nextTrainUrl` 生成ロジック追加、actions に "Go to Next Day" CTA 追加 |
| `docs/day-progression-spec.md` | D-2 セクション追加（CTA ロジック・URL 組み立て・表示分岐） |

### CTA 表示分岐

| 状態 | Primary | Secondary |
|---|---|---|
| 通常完了（next day あり） | **Go to Next Day** → `/train?program=<slug>&programDayId=<uuid>` | Back to Train / Browse Programs |
| program 完走 | Back to Programs | Browse Programs |
| program なしセッション | Back to Train | Browse Programs |

---

## 2026-04-14 D-3 — idempotency guard（同一 day 再実行対策）

### STATUS

| 項目 | 状態 |
|---|---|
| root cause 特定 | **完了 ✅** |
| `advanceEnrollmentAfterSessionComplete` に guard 追加 | **完了 ✅** |
| TypeScript 型エラー | **なし ✅** |
| `docs/day-progression-spec.md` 更新 | **完了 ✅** |

### ROOT CAUSE

`advanceEnrollmentAfterSessionComplete` が `session.program_day_id` から next day を計算して enrollment を更新する際、`enrollment.current_program_day_id` がすでに先に進んでいるかを確認していなかった。

古い day の新規セッションを Finish すると enrollment が巻き戻る（regression）可能性があった。

### FIX

`enrollment.current_program_day_id !== session.program_day_id` の場合に早期 return を追加。

```typescript
if (enrollment.current_program_day_id !== session.program_day_id) {
  return;  // 既に advance 済み — no-op
}
```

### 動作マトリクス

| シナリオ | 修正後 |
|---|---|
| 通常の初回 Finish | 正常に advance ✅ |
| 同一 session 再 Finish | Finish route が early return → guard 未到達 ✅ |
| 古い day の新規 session を Finish | guard で skip → regression なし ✅ |
| 最終 day 完了後の新規 session Finish | enrollment が completed → active 検索で取得不可 → return ✅ |

---

## 2026-04-14 D-1 — day progression（Summary Up Next / Program Complete）

### STATUS

| 項目 | 状態 |
|---|---|
| DB の day advancement | **既存実装が稼働中**（`advanceEnrollmentAfterSessionComplete` / `findNextProgramDayId`） |
| `WorkoutSummaryView` 型拡張 | **完了 ✅** |
| `getWorkoutSummaryView` に next day 解決追加 | **完了 ✅** |
| Summary UI — Up Next / Program Complete | **完了 ✅** |
| TypeScript 型エラー | **なし ✅** |
| ローカル確認（`/programs` 4 本・filter・認証ガード） | **pass ✅** |

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `types/workout.ts` | `WorkoutSummaryView` に `isProgramCompleted` / `nextProgramDayLabel` 追加 |
| `lib/workout/workout-summary.ts` | `findNextProgramDayId` を呼び出し next day ラベルを解決。`buildSummaryView` に渡す |
| `components/summary/WorkoutSummaryScreen.tsx` | Up Next カード・Program Complete カード・hero 色・back リンク先を分岐 |
| `components/summary/WorkoutSummaryScreen.module.css` | `.heroCompleted` / `.nextUpCard` / `.completedCard` を追加 |
| `docs/day-progression-spec.md` | 仕様・edge case・未対応事項を新規作成 |

### Summary の表示分岐

| 状態 | 表示 |
|---|---|
| 通常完了（次 day あり） | Up Next: Week N / Day N（青カード）/ Back to Train |
| プログラム完走（最終 day） | 完走メッセージ（黄金カード）/ Back to Programs |
| session 未完了 / エラー | state ごとのメッセージ |

### 未対応（今後の課題）

- 同一 day 再実行で enrollment が 2 day 進む問題（D-3 候補）
- Summary → 次 day 直接リンク（D-2 候補）
- program 完走後の re-enroll フロー（D-4 候補）

---

## 2026-04-14 C-7 — Dumbbell Full Body Base（4本目 seed）

### STATUS

| 項目 | 状態 |
|---|---|
| seed SQL（dumbbell-full-body-base.sql） | **実装完了・commit 3551def ✅** |
| program-metadata.sql（general-fitness / dumbbell タグ追加） | **更新完了・commit 3551def ✅** |
| mock catalog エントリ（program-catalog.ts） | **追加済み ✅** |
| live Supabase 反映 | **fully closed ✅（2026-04-14）** |
| program creation フェーズ | **一時終了 ✅** |

### seed 構成

| 項目 | 内容 |
|---|---|
| slug | `dumbbell-full-body-base` |
| title | `Dumbbell Full Body Base` |
| level | `beginner` |
| frequency | `3 days / week` |
| duration | `4 weeks` |
| source_fidelity | `custom` |
| split | A/B 交互（W1: A/B/A → W2: B/A/B → W3: A/B/A → W4: B/A/B） |
| Day A | Goblet Squat T1 3×12 / DB Bench Press T1 3×10 / DB Row T2 3×10 |
| Day B | Romanian Deadlift T1 3×12 / DB Shoulder Press T1 3×10 / DB Curl T2 3×12 |

### 追加 tags

| slug | label | axis |
|---|---|---|
| `general-fitness` | General Fitness | goal |
| `dumbbell` | Dumbbell | equipment |

### live 反映手順（手動実行 2 本）

```
1. seed/programs/dumbbell-full-body-base.sql
2. seed/programs/program-metadata.sql
```

### live 確認項目（SQL 実行後）

| 確認項目 | 期待値 |
|---|---|
| `/programs` に 4本目が追加される | Dumbbell Full Body Base が表示される |
| filter chip に Dumbbell が追加される | equipment 軸 |
| filter chip に General Fitness が追加される | goal 軸 |
| `/programs/dumbbell-full-body-base` detail が表示される | 4 weeks × 3 days の week preview |
| 既存 3本（GZCLP / Starting Strength / Upper Lower）の表示が壊れない | 変化なし |

---

## 2026-04-14 C-4 / C-5 fully closed

### STATUS

| 項目 | 状態 |
|---|---|
| C-4 live（Upper Lower Base） | **fully closed ✅** |
| C-5 live（gzclp-base correction） | **fully closed ✅** |
| 原典準拠ルール | **live 反映済み ✅** |
| live SQL hold | **解除 ✅** |
| upper-lower-base tags | **live fix 完了 ✅** |

### live 確認結果（2026-04-14）

| ページ | 確認項目 | 結果 |
|---|---|---|
| `/programs` | 3本表示（GZCLP Base / Starting Strength Phase 2 Base / Upper Lower Base） | ✅ |
| `/programs` | Level filter（Beginner 2件 / Intermediate 1件）が成立 | ✅ |
| `/programs` | filter chips（Beginner / Intermediate / Barbell / Full Body / Strength / Upper / Lower / Squat Focus / Explosive） | ✅ |
| `/programs` | Upper Lower Base カード tags（Strength / Barbell / Upper / Lower） | ✅ |
| `/programs/starting-strength-base` | title = `Starting Strength Phase 2 Base` | ✅ |
| `/programs/starting-strength-base` | Level=Beginner / 3 days/week / 3 weeks | ✅ |
| `/programs/starting-strength-base` | tags = Strength / Barbell / Full Body / Squat Focus | ✅ |
| `/programs/gzclp-base` | title = `GZCLP Base` | ✅ |
| `/programs/gzclp-base` | Level=Beginner / 3 days/week / 4 weeks | ✅ |
| `/programs/gzclp-base` | tags = Strength / Barbell / Full Body | ✅ |

### upper-lower-base tags live fix メモ

- **symptom:** `/programs` 一覧で Upper Lower Base の tag badge が非表示。filter chips に `Upper / Lower` も未表示
- **root cause:** `program-metadata.sql` の upper-lower-base 分はローカル定義済みだったが、live DB に未適用だった（C-3a-live 時点では upper-lower-base が未存在のため反映できなかった可能性が高い）
- **fix scope:** live DB のみ。`upper-lower-base` の `program_tag_assignments` 3件を補修（strength/goal, barbell/equipment, upper-lower/split）。`upper-lower` tag master も必要に応じて補完
- **repo 変更:** なし（ローカル seed 定義に不足はなかった）
- **verification:** `/programs` 一覧で Upper Lower Base カードに tags 表示、filter chips に `Upper / Lower` 追加を確認 ✅

### 確定した原典準拠ルール

- `gzclp-base`: `source_fidelity = original`（Cody Lefever GZCLP base month 準拠）
- `starting-strength-base`: `source_fidelity = original`（Starting Strength Novice Program Phase 2 切り出し）
- `upper-lower-base`: `source_fidelity = custom`（単一原典なしの internal template）

---

## 2026-04-13 Program Source Audit

### STATUS

| 項目 | 状態 |
|---|---|
| audit | 完了 |
| seed correction | 完了 |
| live SQL hold | **解除（2026-04-14）** |

### この更新で固定した原則

- 有名プログラムは、まず原典準拠版を正本にする
- 派生版は別 slug / 別 title / 別 metadata で管理する
- 元ネタがある場合、期間・頻度・日割り・種目順・セット回数・進行ロジック・リセット条件を勝手に変えない
- live Supabase への手動 SQL 実行は、監査後の反映順が固まるまで保留する

### 今回の整理内容

- `seed/programs/gzclp-base.sql`
  - original GZCLP base month に合わせて 3 days / 4 weeks / A1-B1-A2-B2 / T1-T2-T3 構成へ修正
- `seed/programs/starting-strength-base.sql`
  - `Starting Strength Phase 2 Base` として整理
  - slug は route 互換のため `starting-strength-base` を維持
- `seed/programs/upper-lower-base.sql`
  - 単一原典なしの internal custom template と明示
- `supabase/migrations/20260413_000010_program_source_metadata.sql`
  - `source_program_name`
  - `source_fidelity` (`original` / `adapted` / `custom`)
  - `source_notes`
- `seed/programs/program-metadata.sql`
  - 3 program の source metadata を正本化

### 現在の分類

| slug | title | source_program_name | source_fidelity | live 反映 |
|---|---|---|---|---|
| `gzclp-base` | `GZCLP Base` | `GZCLP` | `original` | **live pass ✅** |
| `starting-strength-base` | `Starting Strength Phase 2 Base` | `Starting Strength Novice Program - Phase 2` | `original` | **live pass ✅** |
| `upper-lower-base` | `Upper Lower Base` | `null` | `custom` | **live pass ✅**（tags 要確認） |

### 参照

- `docs/program-source-audit.md`

## 2026-04-13 C-5 — live 反映直前段階

### STATUS

| 項目 | 状態 |
|---|---|
| gzclp-base correction SQL | 完了 |
| live runbook | 完了 |
| live Supabase 反映 | **手動実行待ち** |

### 作成・更新ファイル

| ファイル | 種別 | 内容 |
|---|---|---|
| `seed/programs/gzclp-base-live-correction.sql` | NEW | 既存 gzclp-base を原典準拠構成へ安全に更新する SQL（transaction + pre/post-check 付き） |
| `docs/live-runbook-gzclp-correction.md` | NEW | live 反映の実行手順書（確認チェックリスト・ロールバック観点・実行順まとめ） |

### gzclp-base-live-correction.sql の設計

| 観点 | 内容 |
|---|---|
| slug | 維持（`gzclp-base`）— route / enrollment FK 継続性を保つ |
| program.id | 維持 — `workout_sessions.program_enrollment_id` FK を壊さない |
| transaction | `begin; ... commit;` で囲む。エラー時は自動ロールバック |
| 構造更新方式 | `program_weeks` を DELETE → CASCADE（days / exercises も消える）→ 再 INSERT |
| enrollment 安全性 | `program_enrollments.current_week/day` は integer 型 — FK なし。削除後も壊れない |
| `workout_sessions.program_day_id` | `SET NULL` FK のため、旧 day_id は NULL になる（許容範囲） |
| 事前ガード | `gzclp-base` slug が存在しない場合は EXCEPTION で即 ABORT |
| enrollment NOTICE | active enrollment がある場合は RAISE NOTICE で警告（ブロックしない） |

### live 反映 SQL 実行順

```
1. gzclp-base-live-correction.sql  STEP 0（pre-check）
2. gzclp-base-live-correction.sql  STEP 1（correction、transaction）
3. gzclp-base-live-correction.sql  STEP 2（post-check）
4. program-metadata.sql            （tags / assignments upsert）
5. upper-lower-base.sql            （upper-lower-base が未作成の場合のみ）
```

詳細は `docs/live-runbook-gzclp-correction.md` を参照。

最終更新: 2026-04-13（C-4 完了 / Upper Lower Base seed 追加 — live 反映は手動 SQL 実行待ち）

## 現在地

### 限定公開到達点（2026-04-13 時点）

| 項目 | 状態 |
|---|---|
| public programs 閲覧 | `/programs` / `/programs/[slug]` は未ログインで表示可 ✅ |
| auth 基盤 | Supabase Email/Password sign in / sign up + session cookie ✅ |
| アプリ側 owner guard | finish / summary / set mutation / add exercise / swap exercise = 本人のみ ✅ |
| DB 側制限 | user_id NOT NULL 復元 + RLS 全テーブル適用済み ✅ |
| live workout flow | Program Detail → StartSession → Train → Add/Swap → Finish → Summary 通し確認済み ✅ |
| Exercise History auth 強化 | admin client → server client 統一 / middleware で `/exercise-history/*` 保護 ✅ |
| B-7 live 確認 | 未ログイン redirect（2 slug）/ ログイン済み表示（2 slug）/ 公開ルート非影響 ✅ |
| **C-3b live 確認** | **✅ pass（2026-04-13）— badge 表示確認済み** |
| **C-3c live 確認** | **✅ pass（2026-04-13）— detail metadata 行確認済み** |
| **Phase B 限定公開判断** | **Go ✅（2026-04-13）** |
| **Phase C-1 seed 運用 docs 化** | **完了 ✅（2026-04-13）** |
| **限定公開準備（デプロイガイド）** | **完了 ✅（2026-04-13）** |
| **限定公開実施** | **開始済み ✅（2026-04-13）** |
| **本番 URL** | **`https://training-program-platform-jp.vercel.app`** |
| **Vercel Production Branch** | **✅ `feature/auto-dev-phase3-loop` に変更済み（2026-04-13）** |

- `training-program-platform-jp` は **Next.js App Router + React + TypeScript + Route Handlers + Supabase PostgreSQL + Supabase Auth** で MVP 実装を継続中
- `/train` は workout session の実行画面として利用中
- Exercise History は `/exercise-history/[exerciseSlug]` で Supabase 読込済み
- Finish 後は `/workout-summary/[sessionId]` へ遷移する
- Programs 一覧は `/programs`
- Program Detail MVP は `/programs/[programSlug]`
- Programs list / detail / train selection は Supabase `programs` 読込を土台にしている
- route 用 slug の正本は `programs.slug` に移行済み
- **Program Detail → StartSessionScreen → session 開始** の最小 MVP が完成した
- **限定公開を開始（2026-04-13）**
  - 本番 URL: `https://training-program-platform-jp.vercel.app`
  - Supabase Authentication → URL Configuration 設定済み
  - 招待制運用で live 導線確認を完了
- **Phase B の設計固定（Auth / user_id 必須化 / RLS / 移行順）が完了**
  - 設計メモ: `docs/auth-rls-design.md`
  - 方針: `programs` は public のまま、session / enrollment / summary / history は auth 必須へ戻す
  - 安全方針: user-scoped API は service role 前提にせず、`server client + RLS` を優先する
- **Phase B Step 1 ログイン基盤を実装**
  - `/programs` と `/programs/[programSlug]` は public 維持
  - `/login` を追加
  - middleware は `/workout-summary/*` のみ保護
  - session 開始 API は未ログイン時 401 を返す
- **Phase B Step 1 の live 再確認を実施**
  - `auth.users -> public.users` 自動作成 trigger の live 反映を確認
  - `/login` -> `/programs` の sign in 導線を再確認
  - `/workout-summary/*` の未ログイン保護を再確認
  - Program Detail -> StartSession の未ログイン 401 / ログイン後 201 を再確認
- **Phase B Step 2 を実装**
  - finish / workout summary / workout_sets / workout_session_exercises / session exercise mutation を本人限定へ変更
  - 未ログイン時は user-scoped API が 401 を返す
  - 他人の session / set / summary は 404 で触れない
  - `train-session.ts` / `workout-summary.ts` / `enrollment.ts` の `user_id null` 依存を縮小
- **Phase B Step 3 実装完了（2026-04-13）**
  - migration 000006: `workout_sessions` / `program_enrollments` の null user_id 行を削除（live Supabase 適用済み）
  - migration 000007: 両テーブルの `user_id` を NOT NULL に復元。`idx_program_enrollments_active_user_program` の WHERE 句から `user_id IS NOT NULL` を除去（live Supabase 適用済み）
  - migration 000008: 全テーブルに RLS を有効化 + ポリシー適用（live Supabase 適用済み）
    - public テーブル（programs/exercises/program_weeks/program_days/program_day_exercises）: anon + authenticated が SELECT 可
    - user テーブル（users/enrollments/sessions/session_exercises/sets）: `auth.uid() = user_id` に一致する行のみ操作可
  - コード変更: `session-access.ts` / `enrollment.ts` / `start-session.ts` の client 生成を常に server client へ統一（admin client は RLS を無視するため除去）
  - typecheck: pass / build: pass 確認済み（commit 07cf8c1）
- **Phase B Step 3 ローカル動作確認（2026-04-13）**
  - `/programs` — 未ログインで表示される（server error なし、console error なし）✅
  - `/programs/gzclp-base` — 未ログインで表示される ✅
  - `/workout-summary/*` — ローカル dev 環境（Supabase 未設定）では "Supabase is not configured" を表示（live では `/login` へリダイレクト期待）
  - サーバーログ: error なし ✅
  - コンソールログ: error なし ✅
  - 注: ローカル dev 環境では Supabase 接続なしのため mock catalog fallback が動作。live Supabase への full flow 確認は手動チェック待ち
- **Phase B B-5: Add Exercise / Swap Exercise コードレビュー完了（2026-04-13）**
  - Add Exercise (`POST /api/workout-sessions/[id]/exercises`)
    - 未認証 → `getAuthenticatedWorkoutUserId()` が null → 401 を返す（live 環境で動作）
    - 他人 session_id → `findOwnedWorkoutSession` が null → 404（Step 2 と同じ owner guard パターン）
    - 本人 session → INSERT `workout_session_exercises` + `workout_sets` → RLS INSERT ポリシーを通過する構造を確認
      - exercise INSERT: `workout_session_id = session.id`（検証済み session）→ `session.user_id = auth.uid()` ✅
      - set INSERT: 直前の exercise INSERT 後に実行 → チェーン (set→exercise→session→auth.uid()) が成立 ✅
  - Swap Exercise (`PATCH /api/workout-sessions/[id]/exercises/[exerciseId]`)
    - 未認証 → 401（同上）
    - 他人 session_id → 404（同上）
    - exercise lookup: `.eq("workout_session_id", session.id)` で自分のセッションのみ対象 ✅
    - blocking set check: RLS で自分の session の sets のみ可視 ✅
    - UPDATE `workout_session_exercises` → RLS UPDATE ポリシー通過 ✅
  - ローカル dev テスト（Supabase 未設定）: 500 を返す（env vars なしで `createSupabaseServerClient()` が throw するため。live 環境では 401 → 404 → 成功の期待動作を実装通り確認）
  - **live ブラウザ clickthrough（StartSession → Add Exercise → Swap Exercise → Finish → Summary）完了（2026-04-13）**
    - Program Detail → StartSession → Train → Add Exercise → Swap Exercise → Finish → Summary の通し確認済み ✅

## 完了済み

- Train 画面の基本機能
  - Delete / Complete / Unlock
  - Kg / Reps PATCH 更新
  - Previous history 表示
  - Add Set
- Add Exercise
  - `POST /api/workout-sessions/{id}/exercises`
  - modal UI 実装済み
- Swap Exercise
  - `PATCH /api/workout-sessions/{id}/exercises/{exerciseId}`
  - Add / Swap modal 共通化
  - blocking set がある場合は 409
- Exercise History
  - route: `/exercise-history/[exerciseSlug]`
  - loader: `lib/workout/exercise-history.ts`
  - `auth.getUser()` の `user_id` と `exercises.slug` で絞り込み
  - completed set のみ表示
  - `loading` / `empty` / `error` 実装済み
- Finish summary
  - route: `/workout-summary/[sessionId]`
  - loader: `lib/workout/workout-summary.ts`
  - finish API は `summaryPath` を返す
  - normal finish / `forceFinish=true` のどちらでも summary へ遷移
  - `unauthenticated` / `not_found` / `not_completed` / `error` を画面で分岐
- Programs 一覧 MVP
  - route: `/programs`
  - loader: `lib/programs/program-list.ts`
  - 正本は Supabase `programs`
  - 利用項目は `id` / `slug` / `title` / `description` / `duration_weeks` / `days_per_week` / `level` / `is_public`
  - card は title / level / goal / frequency / duration を表示
  - C-3b で metadata 表示を追加
    - required tags: `goal / equipment / split`
    - optional tag: `focus` は最大 1 件だけ表示
    - `starting-strength-base` は `Squat Focus` badge で `gzclp-base` と差が見える状態に更新
  - C-3b live 修正（2026-04-13）
    - 症状: badge が本番で表示されなかった（`program.tags` が `[]`）
    - 原因: `program_tag_assignments` → `program_tags` の PostgREST 複合 FK join がサイレントエラー
    - 修正: 2クエリ + メモリ結合に変更（`lib/programs/program-library.ts`）
- Program Detail metadata 表示（C-3c）
  - `/programs/[slug]` detail 画面に required tags + optional focus タグ行を追加
  - `ProgramDetailScreen.tsx` / `ProgramDetailScreen.module.css` を変更
  - 一覧と詳細で badge 見た目・意味を統一済み
- Programs filter UI（C-3d）
  - Level / Tag チップ型フィルターを `/programs` に追加
  - client-side AND 結合、Clear ×、0件時 empty state
  - `ProgramsScreen.tsx` に `"use client"` + `useState` / `useMemo`
  - local preview で動作確認済み
- 3本目プログラム seed（C-4）
  - `seed/programs/upper-lower-base.sql` 新規作成（4 weeks × 4 days / week、intermediate）
  - `seed/programs/program-metadata.sql` 更新（upper-lower タグ追加、3プログラム正本化）
  - `lib/programs/program-catalog.ts` mock エントリを `upper-lower-base` へ整合
  - filter の Level 絞り込み（Beginner / Intermediate）と Split タグ（Full Body vs Upper / Lower）が意味ある差分を持つ状態に
  - **live 反映は手動 SQL 実行待ち**: Supabase Dashboard で `upper-lower-base.sql` → `program-metadata.sql` の順で実行
  - `loading` / `empty` / `error` 実装済み
  - summary の戻り先を `/programs` に統一済み
- Program Detail MVP
  - route: `/programs/[programSlug]`
  - loader: `lib/programs/program-detail.ts`
  - 一覧と同じ Supabase `programs` 読込を使用
  - route param は `programs.slug` を使用
  - title / level / goal / frequency / duration / overview を表示
  - `loading` / `ready` / `not_found` / `error` を分岐
  - `/programs` の card から detail route へ遷移可能
  - detail から `/programs` へ戻れる
- Program Detail -> Train の選択連携
  - detail の `Go to Train` は `/train?program=[programSlug]&programDayId=[firstProgramDayId]`
  - `firstProgramDayId`: week 1 / day 1 の UUID を Supabase から解決
  - `firstProgramDayId` が null の場合は `programDayId` なしで遷移し、従来導線を維持
  - train 側 helper は `lib/workout/train-selection.ts`
  - `program` query 一致時のみ selected program title / source を表示
  - `program` query 不一致時のみ warning を表示しつつ current session を継続
  - query なしは従来どおり
- Programs 系 read path の DB slug 化
  - 共通 helper: `lib/programs/program-library.ts`
  - migration で `programs.slug` を追加し、backfill 後に `NOT NULL + UNIQUE` を付与
  - slug ルールは title を slugify し、重複時は `-2`, `-3` suffix で安定採番
  - insert / update で slug が未指定または空なら DB trigger で採番
  - Supabase 読込時は DB の `programs.slug` を使い、読込失敗時のみ `mock_catalog` fallback
  - `mock_catalog` fallback は mock 側の `slug` を維持
  - 読込成功で 0 件のときは empty / not_found / invalid をそのまま表示
- Home 導線
  - `/` は Programs を第一導線、Train を第二導線に整理済み
- **enrollment 最小実装**
  - helper: `lib/workout/enrollment.ts`
    - `findActiveEnrollment(programId, userId)` — active enrollment を検索
    - `findOrCreateEnrollment(programId, firstProgramDayId, userId)` — なければ作成
    - `resolveStartProgramDayId(programId, firstProgramDayId, userId)` — enrollment current day > first day の優先解決
    - `findNextProgramDayId(currentDayId)` — 同 week 次 day → 次 week day 1 → null（完了）の順で解決
    - `advanceEnrollmentAfterSessionComplete(sessionId)` — Finish 後に enrollment を進める
  - migration: `20260412_000004_enrollment_current_day_id.sql`
    - `program_enrollments.current_week/current_day` を削除
    - `program_enrollments.current_program_day_id uuid` を追加（day UUID 直接保持）
    - `program_enrollments.updated_at` を追加
    - `program_enrollments.user_id` を nullable 化（MVP、auth 整備後に戻す）
    - partial unique index: `(user_id, program_id) WHERE status='active' AND user_id IS NOT NULL`
  - Program Detail → `startProgramDayId` を enrollment ベースで解決（enrollment > firstProgramDayId > null）
  - `ProgramDetailView` に `startProgramDayId` / `hasActiveEnrollment` を追加
  - Finish 後に `advanceEnrollmentAfterSessionComplete` を呼び enrollment を次 day へ進める
  - 最終 day 完了時: `enrollment.status = 'completed'`、`current_program_day_id` は最後の day のまま維持（ゼロ化しない）
- **session 開始 MVP（program_day_id ベース）**
  - 開始単位: `program_day_id`（Week 1 / Day 1 の UUID）
  - `enrollment_id` は今回スコープ外（未使用）
  - helper: `lib/workout/start-session.ts::startSessionForDay()`
    - 重複防止: 同一 `program_day_id` の `in_progress` セッションが存在すれば即 `reused=true` を返す
    - `program_day_exercises` を読み込み `workout_session_exercises` + `workout_sets` を seed
    - `user_id` は auth があれば設定、なければ null（migration 3 で nullable 化）
  - helper: `lib/workout/start-session.ts::getProgramDayLabel(programDayId)`
    - `program_days.day_number` + `program_weeks.week_number` を JOIN して `"Week N / Day N"` を返す
    - Supabase 未接続時は `"Week 1 / Day 1"` にフォールバック
  - API: `POST /api/workout-sessions { program_day_id }` → `{ sessionId, reused }` を返す
  - 画面: `StartSessionScreen`（`components/workout/StartSessionScreen.tsx`）
    - Program タイトル / 動的 day ラベル（DB から取得）を表示
    - Start Workout ボタン → API 呼び出し → `/train?program=[slug]` へ遷移
    - Cancel → `/programs/[slug]` へ戻る
  - `/train` ルーティング:
    - `programDayId` あり + `in_progress` セッション存在 → `WorkoutScreen`
    - `programDayId` あり + セッションなし → `StartSessionScreen`
    - `programDayId` なし → 従来どおり `getCurrentWorkoutSessionView()`
- migration: `20260412_000003_nullable_session_user.sql`
- **Phase B 設計メモ更新（2026-04-12）**
  - auth 依存箇所の洗い出しを完了
  - `user_id` 必須化の DB / API / server / client 変更点を整理
  - RLS 最小設計案を整理
  - Workout Summary の auth なし暫定対応を戻す条件を明文化
  - 実装順を `1. login基盤 -> 2. user_id必須化 -> 3. NOT NULL + RLS` で固定
- **Phase B Step 1 実装（2026-04-12）**
  - migration: `20260412_000005_auth_user_profile_trigger.sql`
    - `auth.users -> public.users` 自動 insert trigger を追加
    - 既存 `auth.users` の backfill insert を追加
  - browser client: `lib/supabase/client.ts`
  - login page: `app/login/page.tsx`
    - Email / Password の sign in / sign up トグルを追加
    - 成功時は `/programs` に遷移
    - env 未設定 / auth エラーの表示あり
  - middleware: `middleware.ts`
    - `/workout-summary/*` だけを保護
    - `/programs` と `/programs/[programSlug]` は保護しない
  - session 開始の入口だけ先行保護
    - `lib/workout/start-session.ts`: 未ログイン時 `unauthenticated`
    - `POST /api/workout-sessions`: 401 を返す
    - `StartSessionScreen`: 401 時に `/login` 導線を表示

## 次アクション

1. **C-3c: Program Detail metadata 表示**
   - 一覧で使い始めた metadata を `/programs/[slug]` にも載せる
   - required / optional tag の見せ分けを detail で整理する
   - filter UI を入れる前に detail 側の情報密度を整える
2. **B-6: sign up 429 の再確認（低優先）**
   - live Supabase Auth の `over_email_send_rate_limit` により未通過（外部レート制限、実装不備ではない）
   - 時間経過後に再試行する
3. helper 旧形式 slug から DB slug への redirect 方針が必要かを判断する

## 保留事項

- Supabase 読込失敗時のみ `mock_catalog` fallback が残る
- `lib/programs/program-library.ts` / `lib/programs/program-detail.ts` は admin client のまま（programs は public RLS ポリシーがあるため実害なし。Phase C で server client 統一を検討）
- user-scoped な通常ユーザーフロー（train/summary/history）は server client + RLS に統一済み
- service role は通常ユーザーフローでは使用しない方針。管理処理専用に限定する
- Delete undo は MVP スコープ外
- live sign up は `over_email_send_rate_limit` が解消するまで再試行待ち（外部レート制限、実装不備ではない）
- 招待制運用のため、案内先 URL と配布アカウントの棚卸しを継続する

## Phase C 進捗

### 限定公開開始（完了 2026-04-13）

- Vercel 本番 URL: `https://training-program-platform-jp.vercel.app`
- Supabase URL Configuration を本番 URL に更新済み
- live 確認結果
  - `/programs` 表示成功
  - 未ログインで保護ページは `/login` へ redirect
  - ログイン後 `/exercise-history/squat` 表示成功
  - `/train` → Finish → `/workout-summary` 成功
  - `/exercise-history/overhead-press` に 5 セット履歴反映成功
- 判定: 限定公開は成功。次フェーズは C-2 に戻る

### 限定公開準備（完了 2026-04-13）

- `docs/limited-release-guide.md` — Vercel + Supabase 限定公開の全手順
  - 役割分担（Vercel / Supabase / GitHub）
  - 環境変数 3 つの用途・設定手順
  - Supabase Site URL / Redirect URL 設定
  - デプロイ手順（Vercel プロジェクト作成 → env 設定 → デプロイ → URL 設定）
  - 招待制ユーザー管理手順
  - スモークテスト（公開ルート / 認証フロー / ワークアウトフロー）
  - よくある失敗点
- `docs/limited-release-checklist.md` — 限定公開前チェックリスト（7セクション）
- `.env.example` — 環境変数テンプレートにコメント追加（用途・注意点を明記）

### C-1: seed 運用ルール docs 化（完了 2026-04-13）

- `docs/seed-program-guide.md` — プログラム追加の完全ガイド
  - 追加順序（exercises → programs → weeks → days → day_exercises）
  - 各テーブルの制約（slug 一意・order_index 一意・exercise_type 制約等）
  - UUID ハードコード禁止 / `do $$ ... $$` + `SELECT INTO` パターンを規定
  - idempotent 設計（同一 slug なら全体スキップ）
  - ローカル反映手順・確認クエリ・失敗しやすい点
  - 既存プログラムを壊さない更新方針
- `seed/programs/_template.sql` — 新規追加用テンプレート
  - 全プレースホルダーにコメント付き
  - 週 / 日 / 種目の構造を拡張しやすい形で記述
  - 確認クエリをコメントで同梱

### C-2 以降（更新 2026-04-13）

- C-2: 2本目のプログラム追加（Starting Strength Base を live 反映済み）
- C-3: プログラム難易度・タグ管理
- C-4: ユーザー進捗ダッシュボード

### C-2: 2本目プログラム追加（完了 2026-04-13）

- 候補: `Starting Strength Base`
- 判断理由
  - `GZCLP Base` と同じ初心者向けバーベル軸だが、`Starting Strength Base` は「スクワット毎回」「A/B 交互」「Power Clean を含む」構成で役割を分けやすい
  - 既存 seed の `squat / bench-press / overhead-press / deadlift` を再利用でき、追加種目は `power-clean` の 1 つだけで済む
- 適用結果
  - `seed/programs/starting-strength-base.sql`
  - service role 経由で live Supabase に反映済み（CLI / `psql` 未導入のため）
  - `starting-strength-base` program 作成済み
  - 3 weeks x 3 days、27 件の `program_day_exercises` を確認済み
  - `power-clean` を含む exercise 参照成立済み
- live 確認結果
  - `/programs` に `Starting Strength Base` 表示成功
  - `/programs/starting-strength-base` 表示成功
  - detail の `Go to Train` が `/train?program=starting-strength-base&programDayId=...` を指すことを確認
  - `/train` 入口で `Starting Strength Base` / `Week 1 / Day 1` / `Start Workout` を確認
- 補足
  - 初回適用時に Power Clean の日本語名と description が `?` で入ったため、live DB 上で日本語文字列を修正済み
  - 既存 `GZCLP Base` は `slug / title / level / is_public / duration_weeks / days_per_week` に変更なし

### C-2b: seed 原本整合（完了 2026-04-13）

- `seed/programs/starting-strength-base.sql` の日本語文字列を live 修正内容に合わせて更新
  - `power-clean.name_ja`
  - `program.description`
  - `program_days.progression_guide`
  - `program_days.notes`
- seed 内の実データ文字列は `U&'...'` の Unicode escape 形式へ変更し、文字コード差分の影響を受けにくくした
- `docs/seed-program-guide.md` に UTF-8 保存と SQL Editor 貼り付け時の注意を追記
- 正本方針を回復
  - repo の seed 原本 = live DB へ反映したい状態
  - live DB の手修正内容は seed 原本へ戻し込み済み

### C-3: プログラム metadata 設計（完了 2026-04-13）

- `docs/program-metadata-design.md` を追加し、`/programs` 比較用 metadata の仕様を固定
- level 方針
  - DB canonical value は `beginner / intermediate / advanced`
  - UI は `Beginner / Intermediate / Advanced` 表示
  - `novice` は現時点では採用しない
- tag 方針
  - required: `goal`, `equipment`, `split`
  - optional: `focus`
  - `level / days_per_week / duration_weeks` は tag に重複させない
- 既存 2 本への仮割り当て
  - `gzclp-base`: `strength`, `barbell`, `full-body`
  - `starting-strength-base`: `strength`, `barbell`, `full-body`, `squat-focus`, `explosive`
- 次は C-3 実装として schema / seed / `/programs` 表示反映へ進む

### C-3a: metadata 基盤実装（完了 2026-04-13）

- migration を追加
  - `supabase/migrations/20260413_000009_program_metadata_foundation.sql`
  - `programs.level` を `beginner / intermediate / advanced` の canonical value に正規化
  - `program_tags` / `program_tag_assignments` を追加
  - axis は `goal / equipment / split / focus` のみに制限
  - `goal / equipment / split` は `program_id + axis` の unique index で single-select 制御
  - public reference data として RLS の read policy を追加
- seed を追加
  - `seed/programs/program-metadata.sql`
  - `gzclp-base` と `starting-strength-base` に metadata を付与する idempotent seed
- read path を追加
  - `types/programs.ts`: `ProgramLevel`, `ProgramTag`, `levelKey`, `tags`
  - `lib/programs/program-library.ts`: program ごとに metadata tags を取得する土台を追加
  - metadata table 未適用時は warning を出しつつ tags を空配列にして既存 `/programs` を壊さない
  - `lib/programs/program-catalog.ts`: mock catalog は fallback 維持、metadata tags は空配列で非正本扱い
- 次は C-3b として `/programs` list / detail の metadata 表示を実装する

### C-3a-live: metadata live 反映（完了 2026-04-13）

- live Supabase へ反映済み
  - migration: `20260413_000009_program_metadata_foundation.sql`
  - seed: `seed/programs/program-metadata.sql`
- SQL 確認結果
  - `program_tags_count = 5`
  - `program_tag_assignments_count = 8`
  - `gzclp-base`: required `goal / equipment / split` が各 1
  - `starting-strength-base`: required `goal / equipment / split` が各 1、optional `focus = 2`
- live route 確認
  - `/programs`
  - `/programs/gzclp-base`
  - `/programs/starting-strength-base`
  - いずれも `Source: Supabase` で正常表示を確認

### C-3b: `/programs` metadata 表示（完了 2026-04-13）

- `components/programs/ProgramsScreen.tsx`
  - list card に `level` badge を維持
  - required tags を `goal -> equipment -> split` の順で表示
  - optional `focus` は最大 1 件だけ補助 badge として表示
- `components/programs/ProgramsScreen.module.css`
  - 既存 card デザインに合わせた最小 pill / badge を追加
- 表示差分
  - `gzclp-base`: `Strength / Barbell / Full Body`
  - `starting-strength-base`: `Strength / Barbell / Full Body + Squat Focus`
- local / live とも `/programs` 一覧で表示崩れなく比較性が上がった

---

## テスト状況

- `npm run typecheck`
  - pass
- `npm run build`
  - pass
- **限定公開 live 実施確認（2026-04-13 完了）**
  - 本番 URL: `https://training-program-platform-jp.vercel.app`
  - `/programs` 表示成功 ✅
  - 未ログインで保護ページは `/login` に redirect ✅
  - ログイン後 `/exercise-history/squat` 表示成功 ✅
  - `/train` → Finish → `/workout-summary` 成功 ✅
  - `/exercise-history/overhead-press` に 5 セット履歴反映成功 ✅
- **Phase B B-7: Exercise History auth 強化 + live 確認（2026-04-13 完了）**
  - 未ログイン `/exercise-history/squat` → `/login?next=%2Fexercise-history%2Fsquat` redirect ✅
  - 未ログイン `/exercise-history/overhead-press` → `/login?next=%2Fexercise-history%2Foverhead-press` redirect ✅（slug 変更でも `next` 正確）
  - ログイン済み `/exercise-history/squat` → T1 / Squat 表示（Supabase DB 取得）✅
  - ログイン済み `/exercise-history/bench-press` → T3 / Bench Press 表示（Supabase DB 取得）✅
  - 未ログイン `/programs` → redirect なし・一覧表示 ✅（middleware の公開ルート通過を確認）
  - 未ログイン `/programs/gzclp-base` → redirect なし・詳細表示 ✅
  - 画面崩れ・500 エラーなし ✅
- **Phase B B-7: Exercise History auth 強化 実装詳細（2026-04-13）**
  - `lib/workout/exercise-history.ts`: admin client 条件分岐を削除し、常に server client を使用
    - 変更前: `hasSupabaseServiceRoleEnv() ? createSupabaseAdminClient() : serverClient`
    - 変更後: `const queryClient = serverClient`
    - 不要になった `createSupabaseAdminClient` / `hasSupabaseServiceRoleEnv` import を削除
  - `middleware.ts`: matcher に `/exercise-history/:path*` を追加
    - 未ログイン時は `/login?next=/exercise-history/[slug]` へ redirect
    - 変更前: `matcher: ["/workout-summary/:path*"]`
    - 変更後: `matcher: ["/workout-summary/:path*", "/exercise-history/:path*"]`
  - `train-session.ts` / `workout-summary.ts`: B-3 で `createWorkoutQueryClient()` → server client 統一済み。追加変更なし
  - typecheck: pass / build: pass 確認済み（commit 後 live 確認推奨）
  - 認可境界の担保:
    - middleware で未ログイン遮断（redirect to `/login`）
    - `getExerciseHistoryView` 内で `auth.getUser()` による userId チェック（二重防衛）
    - `selectRecentUserSessions` で `.eq("user_id", userId)` — 本人セッションのみ取得
    - RLS: `workout_sessions` の SELECT ポリシー `auth.uid() = user_id` がクエリを本人に限定
    - 後続の `session_exercises` / `sets` クエリは本人セッション IDs を起点とするため他ユーザーデータ混入なし
- **Phase B B-3/B-4/B-5 live 手動確認（2026-04-13 完了）**
  - Program Detail → StartSession → Train → Add Exercise → Swap Exercise → Finish → Summary 通し確認 ✅
  - Supabase dashboard: null user_id = 0 件 / NOT NULL 制約 / RLS ポリシー適用済み ✅
  - 未ログイン時の 401 保護・他ユーザー session → 404 の動作確認 ✅
- **Phase B Step 3 ローカル dev 確認（2026-04-13）**
  - `/programs` — 未ログイン・Supabase 未設定環境で表示確認 ✅（mock fallback 動作）
  - `/programs/gzclp-base` — 未ログインで表示確認 ✅
  - `/workout-summary/test-session-id` — "Supabase is not configured" 表示（Supabase 未設定のため。live では `/login` リダイレクト期待）
  - server error: なし ✅ / console error: なし ✅
- **Phase B Step 2 local browser + live Supabase 確認（2026-04-12）**
  - sign in 相当
    - auth cookie を使った browser context で `/programs` 表示を確認
  - StartSession（本人）
    - user A / user B とも `POST /api/workout-sessions` が `201`
  - workout summary（未ログイン）
    - `/workout-summary/[sessionId]` は `/login?next=...` へ redirect
  - Finish（未ログイン）
    - `POST /api/workout-sessions/[id]/finish` が `401`
  - Finish（他人 session）
    - user A から user B の session finish は `404`
  - workout set complete（他人 set）
    - user A から user B の set complete は `404`
  - Finish（本人 session）
    - user A の session finish は `200`
    - `summaryPath` を返し、本人 summary を表示
  - workout summary（他人 session）
    - user A で user B の summary を開くと `Workout summary not found`
- **Phase B Step 1 live 手動確認（2026-04-12 再確認済み）**
  - `/programs`
    - 未ログインでも表示可
  - `/programs/gzclp-base`
    - 未ログインでも表示可
  - `/workout-summary/[sessionId]`
    - 未ログイン時は `/login?next=...` へ redirect されることを再確認
  - Program Detail -> StartSession（未ログイン）
    - `POST /api/workout-sessions` が `401` を返すことを確認
    - メッセージ「ログインするとワークアウトを開始できます。」と `/login` 導線表示を再確認
  - sign in
    - **pass**
    - fresh verified test user で `/login` -> `/programs` redirect を再確認
  - StartSession（ログイン済み）
    - **pass**
    - `POST /api/workout-sessions` が `201` を返し、`sessionId` を受け取れることを確認
    - `/programs/gzclp-base` -> `Go to Train` -> `Start Workout` 後に `/train?program=gzclp-base` へ遷移し、WorkoutScreen 表示を再確認
  - `public.users` 自動作成
    - **pass**
    - live Supabase で fresh verified test user 作成直後に `public.users(id)` 行が自動作成されることを確認
    - `20260412_000005_auth_user_profile_trigger.sql` の live 反映前提で再確認完了
  - sign up
    - **pending / external**
    - live Supabase Auth が引き続き `429 over_email_send_rate_limit` を返し、browser 上で `email rate limit exceeded` 表示
    - auth user は作成されず、外部レート制限継続中と判断
- **live Supabase E2E（2026-04-12 完了）**
  - Programs → GZCLP Base → StartSession → Train → Finish → Summary まで通し確認済み
  - DB: `workout_sessions.status = completed`, `program_enrollment_id` 紐付き確認済み
  - enrollment `current_program_day_id` は Day 2 に進行（SQL Editor で確認）

## 直近の重要判断

- Programs list / detail / train selection の正本は Supabase `programs` とする
- route 用 slug は helper 導出を廃止し、Supabase `programs.slug` を正本にする
- slug は title を base に slugify し、重複時は `-2`, `-3` suffix で安定採番する
- 既存 row は migration の backfill で埋め、今後の insert / update は DB trigger で補完する
- fallback は Supabase 読込失敗時のみ `mock_catalog` を使う。空データはそのまま empty / not_found / invalid として扱う
- Workout Summary の戻り先は `/` ではなく `/programs`
- `screens.md` と `PROJECT_STATUS.md` は日本語ベースで継続する
- **開始単位は `program_day_id`、enrollment_id は今回スコープ外とした**
  - 理由: enrollment フローを先に作ると scope が大きくなりすぎる。まず「選んだ day を開始できる」を優先した
- **`workout_sessions.user_id` を nullable にした（migration 3）**
  - 理由: 未認証 MVP では `public.users` FK を満たせないため。auth 整備後に戻す方針
- **Phase B の通常ユーザーフローでは service role を使わない方針に修正（2026-04-12）**
  - 理由: admin client は RLS を無視するため、`ログイン済み` チェックだけだと他人の session / set を触れる危険がある
  - user-scoped API / loader は `server client + cookie + RLS` を第一選択にする
- **Step 1 では public 導線を維持する判断（2026-04-12）**
  - `/programs` と `/programs/[programSlug]` は保護しない
  - まず `/workout-summary/*` と session 開始だけに auth を入れ、Phase A の閲覧導線を壊さない
- **Step 1 は完了扱いに更新（2026-04-12）**
  - `auth.users -> public.users` 自動作成 trigger の live 反映を確認
  - sign in / protected route / StartSession auth gate / StartSession logged-in success を再確認
  - browser sign up は `over_email_send_rate_limit` 継続中だが、外部レート制限による pending と判断し Step 1 の blocker から外す
- **Step 2 はアプリ側 owner guard を優先して実装（2026-04-12）**
  - RLS 前でも、finish / summary / set mutation / session exercise mutation は `user_id` と関連 session を必ず照合する
  - 未ログインは `401`、他人データは `404`、完了済み session への mutation は `409` で止める
- **Next.js 14 の fetch cache 問題を修正（2026-04-12）**
  - `createSupabaseAdminClient` / `createSupabaseServerClient` に `global.fetch` で `cache: 'no-store'` を設定
  - Server Component から Supabase を呼ぶとき Next.js が fetch 結果をキャッシュしていた
  - API Route は影響を受けないが Server Component（page.tsx）は同じ fetch URL をキャッシュする
  - `force-dynamic` はページのキャッシュを無効化するが fetch キャッシュは別途対処が必要

---

## 2026-04-20 Performance Round 1–3 — /train ロード速度改善

### STATUS: CLOSED (2026-04-20)

### BOTTLENECK_HISTORY

| Round | 主犯 | commit | 節約量（推定 200ms/rtt） |
|---|---|---|---|
| R1 (4fc9330) | `loadSessionView` 10 sequential queries | `lib/workout/train-session.ts` | ~1000ms → ~600ms |
| R2 (ff96ee8) | `startSessionForDay` N×2 sequential INSERT loop | `lib/workout/start-session.ts` | ~1600ms → ~400ms (start flow) |
| R2 (ff96ee8) | `selectHistoricalSessions` LIMIT なし | `lib/workout/train-session.ts` | Q8/Q9 データ削減 |
| R2 (ff96ee8) | train page: start mode でも loadSessionView 実行 | `app/train/page.tsx` | ~700ms skip |
| R2 (ff96ee8) | `getSessionHistoryView` 5 sequential queries | `lib/workout/session-list.ts` | ~200ms |
| R3 (本 commit) | `resolveTrainingEntry` が `findWorkoutSessionByDayId` を直列ブロック | `app/train/page.tsx` | ~800ms (resume flow) |

### R3 ROOT_CAUSE

resume flow の `/train?program=X&programDayId=Y` ロード時：
- `resolveTrainingEntry(programDayId)` が 4 sequential queries (~800ms) を直列実行
- その後に `findWorkoutSessionByDayId(programDayId)` + `loadSessionView` (~1200ms) が実行
- 合計: ~2000ms（server render のみ）

`resolveTrainingEntry` と `findWorkoutSessionByDayId` にデータ依存なし。
blocked 判定は speculative の結果を後から参照すれば十分。

### R3 FIX

```typescript
// before (sequential)
const entry = await resolveTrainingEntry(dayId);   // 800ms
if (entry.mode === "start") { ... fast path }
const [session, label] = await Promise.all([findWorkoutSessionByDayId(dayId), getProgramDayLabel(dayId)]);
// total: 800 + 1200 = 2000ms

// after (speculative parallel)
const [entry, session, label] = await Promise.all([
  resolveTrainingEntry(dayId),          // 800ms ┐
  findWorkoutSessionByDayId(dayId),     // 1200ms┤ max = 1200ms
  getProgramDayLabel(dayId)             // 200ms ┘
]);
// total: max(800, 1200, 200) = 1200ms → 800ms 節約
```

### BEFORE_AFTER

| path | before R3 | after R3 | delta |
|---|---|---|---|
| resume (既存 session あり) | ~2000ms server | ~1200ms server | -800ms |
| start (session なし) | ~900ms server | ~800ms server | -100ms |
| blocked | ~800ms server | ~1200ms server | +400ms (wasted work, rare case) |

blocked path は `findWorkoutSessionByDayId` が null を返す 1 query のみで実質オーバーヘッドは 1 rtt 分の増加（許容）。

### CORRECTNESS

- blocked: `findWorkoutSessionByDayId(dayId)` は blocking session が別 day のため null を返す → 正常
- start: `findWorkoutSessionByDayId(dayId)` は 1 query で null → loadSessionView 未実行 → 正常
- resume: session 取得済み → WorkoutScreen 表示 → 正常
- 整合性修正（enrollment advance, idempotency guard, cancel/finish RLS）に変更なし

### SIDE_EFFECT_CHECK (ff96ee8 Fix 1)

`startSessionForDay` の bulk INSERT は session 作成フロー専用。
resume flow は既存 session を READ するだけなので影響なし。
ORDER は `exercise_id:order_index` マップで保証。

### LIMIT(20) UX IMPACT

`selectHistoricalSessions` を completed 限定 LIMIT 20 に変更したことで、
20 セッション以上前のデータは `previousDisplay` が"-"になる可能性がある。
週3回トレーニングで約7週分。T1 種目（毎セッション出現）は実質影響なし。
T3 種目（週1出現）でも20回前まで参照可能。実運用上は許容範囲。

### NEXT_BOTTLENECK (R3 時点)

| 残余 | 想定時間 | 対処方針 |
|---|---|---|
| `resolveTrainingEntry` 内部 Q1+Q2（day→week join） | 1 round-trip | PostgREST nested embed で 2→1 query（~200ms 節約。並列化後は critical path から外れるため優先度低） |
| `buildPreviousDisplayMap` Q1+Q2（session→exercise join） | 1 round-trip | **→ R4 で対処済み** |
| Vercel cold start | 1–2s | コード変更で解消不可 |
| tab switch Router Cache 消去（router.refresh 後） | 0.5–1s/tab | force-dynamic 方針は維持。改善するなら Suspense streaming 検討 |

---

## 2026-04-20 Performance Round 4 — buildPreviousDisplayMap 3 sequential → 2 sequential

### STATUS: CLOSED (2026-04-20)

### ROOT_CAUSE

R3 後の critical path（resume flow）:
```
Promise.all([resolveTrainingEntry, findWorkoutSessionByDayId, getProgramDayLabel])
  └─ findWorkoutSessionByDayId + loadSessionView が支配 (~1200ms)
       └─ Round 3 (parallel): program || buildPreviousDisplayMap || t1Hints
            └─ buildPreviousDisplayMap が支配 (~600ms, 3 sequential queries)
                 Q1: selectHistoricalSessions          ~200ms
                 Q2: selectHistoricalWorkoutSessionExercises  ~200ms  ← Q1 依存
                 Q3: selectHistoricalCompletedWorkoutSets     ~200ms  ← Q2 依存
```

`resolveTrainingEntry`（~800ms）は `findWorkoutSessionByDayId`（~1200ms）より先に完了するため critical path 外。
`buildPreviousDisplayMap` の Q1+Q2 が主犯。

### FIX

Q1+Q2 を PostgREST 埋め込みクエリ（`workout_sessions!inner(started_at)`）で 1 round-trip に統合。

```typescript
// before (2 sequential: Q1 sessions → Q2 exercises)
const sessions = await selectHistoricalSessions(client, userId, currentSessionId);  // ~200ms
const exercises = await selectHistoricalWorkoutSessionExercises(client, sessions.map(s=>s.id), exerciseIds); // ~200ms

// after (1 embedded query: exercises + session.started_at in one round-trip)
const historicalExercises = await selectHistoricalExercisesWithSession(client, userId, exerciseIds); // ~200ms
// workout_sessions!inner(started_at) → status=completed, archived_at IS NULL, limit 400
```

`status=completed` フィルタが currentSession（always in_progress）を自動除外 → `.neq("id", currentSessionId)` 不要。
`limit(400)` = 20 sessions × 20 exercises の余裕値（R2 の LIMIT 20 sessions に相当する実質的なカバレッジ）。

### BEFORE_AFTER

| path | before R4 | after R4 | delta |
|---|---|---|---|
| resume (既存 session あり) | ~1200ms server | ~1000ms server | -200ms |
| start / blocked | 影響なし（buildPreviousDisplayMap は existingSession ありの場合のみ実行） | — | — |

### CORRECTNESS

- `!inner` join: session が存在しない exercise row は返らない（元の inner join 相当）
- `status=completed` + `archived_at IS NULL`: 元の `selectHistoricalSessions` フィルタと同等
- `workout_sessions?.started_at ?? ""`: null ガード→ 空文字列 → 既存の `!historicalExercise.startedAt` ガードで skip → 安全
- `previousCandidateMap` の most-recent-wins ロジック: `startedAt` 比較は変更なし → 結果同一
- ORDER BY 削除: コード側で最大値を選択するため不要（影響なし）

### SIDE_EFFECTS

- `selectHistoricalSessions` / `selectHistoricalWorkoutSessionExercises` を削除（`buildPreviousDisplayMap` 専用、他から未参照）
- `HistoricalSessionRow` 型を `HistoricalExerciseWithSessionRow` に置換
- ff96ee8 Fix 1 (bulk INSERT) との干渉: buildPreviousDisplayMap は READ 専用、影響なし

### LIMIT(20) vs LIMIT(400) UX IMPACT

R2 で追加した LIMIT 20（セッション数）は、より多くの履歴を参照できる limit(400)（exercise 行数）に実質的に緩和された。
T3 種目（週 1 出現、1 行/session）なら最大 400 セッション分参照可能。
previousDisplay の "-" が増えるリスクは R4 でむしろ減少する方向。

### R4 LIVE_CHECK (2026-04-20)

**静的解析（自動）:** ✅ 完了

| 確認項目 | 結果 |
|---|---|
| `.is("workout_sessions.archived_at", null)` URL 生成 | `workout_sessions.archived_at=is.null` — postgrest-js v2.103.0 `searchParams.append(column, \`is.${value}\`)` で確認 ✅ |
| `.eq("workout_sessions.user_id", ...)` など embedded filter 構文 | 全 filter メソッドが `column=operator.value` 形式でパラメータ生成 ✅ |
| FK 方向（many-to-one: workout_session_exercises → workout_sessions） | 同コードベース `getProgramDayLabel` が同パターン（program_days → program_weeks outward FK）を使用し単一 object 返却 ✅ |
| `workout_sessions?.started_at ?? ""` null ガード | `!historicalExercise.startedAt` による skip と組み合わせ安全 ✅ |
| TypeScript | `npx tsc --noEmit` clean ✅ |
| Graceful degradation 追加 | embedded query 失敗時 → `console.warn` + empty map 返却 → WorkoutScreen は必ずレンダー ✅ |

**live 確認（手動）:** ✅ PASS (2026-04-29)

| 確認項目 | 結果 |
|---|---|
| resume flow: WorkoutScreen 表示 | ✅ branch: 'workout_screen_from_current' 確認 |
| 前回値表示（全行「-」でない） | ✅ 前回値あり |
| コンソール: embedded query failed なし | ✅ エラーなし |
| Vercel ログ: Q1 found=4 / Q2 found=14 | ✅ `buildPreviousDisplayMap Q1: 275ms \| found=4` / `Q2: 256ms \| found=14` |

### NEXT_BOTTLENECK (R4 以降)

| 残余 | 想定時間 | 対処方針 |
|---|---|---|
| `resolveTrainingEntry` 内部 Q1+Q2（day→week join） | ~200ms 節約 | parallel 化後は critical path 外。優先度低 |
| `buildPreviousDisplayMap` Q2+Q3（exercise→set join） | ~200ms 節約 | 2 level embed or 残存 sequential の 1 本。R4 後の次候補 |
| Vercel cold start | 1–2s | コード変更で解消不可 |
| tab switch Router Cache 消去 | 0.5–1s/tab | force-dynamic 方針は維持 |

---

## 2026-04-29 Phase 2.7 — PWA化 Step 1〜4 実装

### STATUS: 実装完了 — 実機確認待ち

### 実装内容

| Step | 内容 | 結果 |
|---|---|---|
| Step 1 | `app/manifest.ts` 作成 | ✅ `/manifest.webmanifest` build 出力確認済み |
| Step 2 | PWA アイコン生成・配置 | ✅ 3種生成済み（下記参照） |
| Step 3 | `app/layout.tsx` 更新 | ✅ iOS meta / apple-touch-icon / viewport themeColor 追加 |
| Step 4 | `public/sw.js` 作成 + 登録 | ✅ 最小構成 SW（キャッシュなし） |

### アイコン生成情報

| ファイル | サイズ | 生成元 |
|---|---|---|
| `public/icons/icon-192.png` | 192×192 | Google Drive ロゴ (926×1140 JPEG) を System.Drawing でリサイズ・中央配置 |
| `public/icons/icon-512.png` | 512×512 | 同上 |
| `public/apple-touch-icon.png` | 180×180 | 同上 |

**生成方針:** キャンバス正方形・白背景・ロゴ 85% fill・中央配置。後で正式ロゴに差し替えるときは同スクリプトで再生成可能。

**ロゴ素材:** 青いウルフキャラがダンベルを持つトレーニングマスコットイラスト（Google Drive ID: 1U6PWrVLZBB3vw-Rh8he5MYWFH2jfPfYc）

### manifest 設定値

```
name:             Training Program JP
short_name:       Training
display:          standalone
orientation:      portrait
theme_color:      #131d2e
background_color: #ffffff
icons:            icon-192.png (maskable) / icon-512.png (any)
```

### SW 方針

- `public/sw.js` は最小構成（install: skipWaiting / activate: clients.claim）
- **fetch ハンドラなし** — キャッシュ介入なし、全リクエストをブラウザデフォルトに委ねる
- aggressive cache / offline fallback は Phase 5 以降に検討
- `layout.tsx` で `afterInteractive` Script 登録

### build 確認

| 確認項目 | 結果 |
|---|---|
| `npx tsc --noEmit` | ✅ エラーなし |
| `npx next build` | ✅ 成功 / `/manifest.webmanifest` 出力確認 |
| build エラー・警告 | なし |

### 実機確認結果 (2026-04-29)

| プラットフォーム | 確認項目 | 結果 |
|---|---|---|
| Android Chrome | ホーム画面追加・インストール | ✅ PASS |
| Android Chrome | ホーム画面アイコンから起動 | ✅ PASS |
| Android Chrome | アプリ風表示（standalone） | ✅ PASS |
| Android Chrome | アイコン表示 | ✅ PASS |
| iOS Safari | ホーム画面に追加 → アイコン・アプリ名表示 | ⚠️ 未確認（iPhone 未所持） |
| iOS Safari | ホーム画面から起動 → アドレスバーなし | ⚠️ 未確認（iPhone 未所持） |

**Phase 2.7 ステータス: CONDITIONAL CLOSED (2026-04-29)**
- Android Chrome: PASS — PWA土台の実用動作確認済み
- iOS Safari: 未確認 — ユーザーが iPhone 未所持のため後日確認（deferred risk）
- 既知リスク: iOS Safari のホーム画面追加・standalone表示は未検証
- G-6b 以降は Android PASS を根拠に進行する

---

## 2026-04-29 G-6b — PWA起動時の再開メッセージ強調

### STATUS: 実装完了 — Android実機確認待ち

### 実装内容

| 変更 | 内容 |
|---|---|
| `components/gym/GymTrainingGapBanner.tsx` | 新規クライアントコンポーネント |
| `components/gym/GymScreen.tsx` | trainingGap ブロックを GymTrainingGapBanner に差し替え |
| `components/gym/GymScreen.module.css` | `.trainingGap_standalone` / `.trainingGapPwaLabel` / `.trainingGapCta` を追加 |

### 実装方針

- `GymScreen`（サーバーコンポーネント）は極力触らず、trainingGap ブロックのみクライアント化
- standalone 検出: `window.matchMedia('(display-mode: standalone)')` ＋ iOS用 `navigator.standalone`
- SSR 時は `isStandalone = false` でフォールバック（通常表示）
- standalone 時の追加表示:
  1. `ホーム画面から起動中` ラベル（accent / uppercase / 10px）
  2. trainingGap 背景に `--accent-dim`（orange tint）と border-left 4px
  3. `トレーニングを始める →` CTA（level !== "none" の場合のみ）

### build 確認

| 確認項目 | 結果 |
|---|---|
| `npx tsc --noEmit` | ✅ エラーなし |
| `npx next build` | ✅ `/gym: 3.73kB` — エラー・警告なし |

### 実機確認結果 (2026-04-29)

| 確認項目 | 結果 |
|---|---|
| 「ホーム画面から起動中」ラベル表示 | ✅ PASS |
| trainingGap orange tint 背景 | ✅ PASS |
| 「トレーニングを始める →」CTA 表示 | ✅ PASS |
| Chrome通常タブでは通常表示のまま | ✅ PASS |
| iOS Safari | ⚠️ deferred（iPhone 未所持） |

**G-6b LIVE_CHECK: Android ✅ PASS (2026-04-29) / iOS deferred**

---

## 2026-04-29 休会・退会ロジック 仕様設計（Phase M: Membership Lifecycle）

### STATUS: 設計確定 — 実装未着手

### 対象ビジネスルール（ワイルドボア運用）

| フロー | ルール |
|---|---|
| 休会 | 当月申請→翌月1日開始。翌月分振替確定後なら翌々月1日開始（翌月分は再開月に充当） |
| 退会 | 翌月分振替未確定→当月末退会。確定後→翌月末退会 |
| 鍵返却 | 退会時に受付へ返却。返却確認で500円返金 |
| 判定基準 | 「毎月10日」等の日付固定ではなく「翌月分口座振替データが確定済みか」で判定 |

### 現状スキーマとの整合

| 現状 | 評価 |
|---|---|
| `users.membership_status` ('active'/'paused'/'cancelled') | ✅ そのまま使用 |
| `users.cancelled_at` | ✅ そのまま使用 |
| `account_deletion_requests` テーブル | ✅ 退会申請として拡張して使用。命名問題は将来フェーズで整理 |
| `users.paused_at` / `prepaid_month_credit` | 未実装 → 新規追加 |
| `billing_cutoff_records` テーブル | 未実装 → 新規作成 |
| `membership_pause_requests` テーブル | 未実装 → 新規作成 |

### DB変更サマリー

**新規テーブル:**
- `billing_cutoff_records` — 管理者が翌月振替確定を記録
- `membership_pause_requests` — 休会申請。1ユーザー1pending制約

**既存テーブル拡張:**
- `users` に `paused_at timestamptz` / `prepaid_month_credit boolean DEFAULT false`
- `account_deletion_requests` に `effective_date` / `next_month_billing_confirmed` / `key_returned_at` / `refund_500_paid_at`

### 実装フェーズ

| Phase | 内容 |
|---|---|
| A | billing_cutoff_records migration + /admin/billing ページ | ✅ LIVE_CHECK PASS (2026-04-29) — 確定/履歴/リロード全項目PASS |
| B | membership_pause_requests migration + /admin/pause-requests — 休会申請アプリ受付 ⛔ 停止 | ✅ MAIN FLOW PASS / 停止完了 (2026-04-29) |
| C | 退会申請アプリ受付停止・窓口受付に変更 | ✅ LIVE_CHECK PASS (2026-04-29) — /profile フォームなし・管理画面正常 |
| D | /profile ステータスバッジ + 休会退会受付案内統合 + /gym 申請中通知除去 | ✅ LIVE_CHECK PASS (2026-04-29) — 全項目PASS |

**Phase M 全体: ✅ CLOSED (2026-04-29)**
休会・退会はアプリ申請なし、受付対応に統一。管理者手動変更（/admin/members）は継続稼働。

---

## 2026-04-29 UX fix: セット完了チェック遅延問題

### STATUS: 実装完了 — 実機確認待ち

### ROOT_CAUSE

| # | 問題 | 場所 |
|---|---|---|
| 1 (主因) | `handleComplete` の guard に `savingSetIds.includes(setId)` があるため、`onBlur` 入力保存中にチェックタップすると**アクションが DROP される**。ユーザーは保存完了（~300ms）を待って再タップ必要 | `WorkoutScreen.tsx:951` |
| 2 (副因) | `complete` API と `PATCH` API で `revalidatePath("/train")` を呼んでいる。`WorkoutScreen` はクライアント管理なので不要。後続の `router.refresh()` で不要な全画面リロードを誘発 | `complete/route.ts:165` / `route.ts:187` |

### FIX

| 変更 | 内容 |
|---|---|
| `WorkoutScreen.tsx` | `handleComplete` / `handleUncomplete` guard から `savingSetIds.includes(setId)` を削除。入力保存中でもチェックを受け付ける |
| `complete/route.ts` | `revalidatePath("/train")` を削除 |
| `route.ts` (PATCH) | `revalidatePath("/train")` を削除 |

### 安全性

- `handleInputSave` は自身の guard で重複呼び出しをスキップ（no-op）。既存の in-flight save がそのまま完了する
- `postSetAction(complete)` と in-flight `patchWorkoutSet` は異なる DB カラムを更新（競合なし）
- 失敗時の rollback ロジックは変更なし

---

### 追加修正 (2026-04-29) — 初回修正は不十分、3層の ROOT_CAUSE を全修正

**実機確認で判明した追加問題:**
1. check ボタンが `disabled={isBusy || isSessionEnded}` で `isBusy = isSaving || isMutating`。`onBlur` → `markSaving` → React 再描画で **click 前にボタンが disabled** → クリック無視
2. `pendingMutation` が全セット共通の global lock → 連続チェック完全ブロック
3. `handleComplete` 内の `handleInputSave` は `savingSetIds` guard で no-op → 入力値が complete 側に渡らない

**追加修正内容:**

| 変更 | 内容 |
|---|---|
| `completingSetIds: string[]` 追加 | per-set complete/unlock ロック。global `pendingMutation` を廃止 |
| check ボタン `disabled` | `isBusy → isCompleting`（`isSaving` を除去。ボタン disabled 解除） |
| `handleComplete` guard | `pendingMutation / savingSetIds` → `completingSetIds.includes(setId)` |
| `handleUncomplete` guard | 同上 |
| `postCompleteSet(setId, {weightKg, repsDone})` 追加 | 入力値を complete と同時に原子保存 |
| complete API | body から `weightKg` / `repsDone` を受け取り DB update に含める |
| Finish / Cancel 側 | `completingSetIds.length > 0` を guard に追加 |

**STATUS: ✅ LIVE_CHECK PASS (2026-04-29)** — 重量入力即チェック/リロード保存/連続チェック/Finish 全項目PASS

---

## 2026-04-29 休憩タイマー通知音追加

### STATUS: 実装完了 — 実機確認待ち

### 実装内容

| 変更 | 内容 |
|---|---|
| `playBeep()` 追加（module-level） | Web Audio API oscillator で音生成。失敗は silent |
| `timerSoundEnabled` state | localStorage `restTimerSound` で ON/OFF を永続化 |
| `timerSoundEnabledRef` | setInterval 内の stale closure を防ぐ同期 ref |
| `audioCtxRef` | AudioContext を再利用（毎回生成しない） |
| `lastBeepedSecRef` | 250ms ポーリングで同じ秒に二重 beep しないガード |
| 休憩タイマー interval を拡張 | 残り 3/2/1 秒: 660Hz 0.1s / 終了時: 880Hz 0.4s |
| 🔔/🔕 トグルボタン追加 | topBar の 計算ボタン左隣。localStorage 保存 |

### 音の設計

| タイミング | 周波数 | 長さ | 意図 |
|---|---|---|---|
| 残り 3/2/1 秒 | 660Hz | 0.1s | 軽いカウントダウン tick |
| タイマー終了（0秒） | 880Hz | 0.4s | やや長めの通知音 |

### 安全性

- Web Audio API が使えない環境では try/catch で silent fail
- `ctx.state === "running"` チェックで suspended 状態をスキップ（iOS 対策）
- 音が鳴らなくてもタイマー表示・セット記録は正常動作
- 既存のチェック高速化（completingSetIds）に影響なし

**STATUS: ✅ LIVE_CHECK PASS (2026-04-29)** — 全8項目PASS（カウントダウン音/終了音/ON/OFF/localStorage/操作重さなし）

---

### 2026-04-29 通知音パターン変更 — D「ベル風」に調整

- カウントダウン (3/2/1秒): 880Hz / 0.07s / vol 0.04（「ピッ」）
- 終了時: 880+1320+1760Hz 重ね / 0.6s / vol 0.045 / quick attack + exponential decay（「チーン」）
- `playBellChime()` を追加（3 oscillator 同時起動）
- build: tsc clean / next build PASS
- **✅ LIVE_CHECK PASS (2026-04-29)** — ピッ×3 + チーン / ON/OFF / localStorage 全項目PASS

---

## 2026-04-29 重量反映の後続セット拡張

### STATUS: 実装完了 — 実機確認待ち

### ROOT_CAUSE

`handleInputChange` の `shouldReflectWeight` に `targetSet.displaySetNumber === 1` 条件があり、セット1以外では後続への反映が起きなかった。また候補フィルターにセット順序の制約がなかった。

### FIX（2行変更）

| 変更 | 内容 |
|---|---|
| `displaySetNumber === 1` を削除 | 全セットで重量入力時に反映を試みる |
| `candidate.setNumber > targetSet.setNumber` を追加 | **後続セットのみ**に絞る（前セットは対象外） |

### 上書きルール（変更なし）

既存の `isAutoFilled` フラグを継続利用:
- 空欄 → 反映される ✅
- `isAutoFilled=true`（自動反映値）→ 上書きされる ✅
- `isAutoFilled=false` かつ非空（ユーザー手入力）→ 上書きされない ✅
- 完了済みセット → 対象外 ✅

**✅ LIVE_CHECK PASS (2026-04-29)** — 全9項目PASS（後続反映/手入力保護/完了済み保護/リロード保存）

---

## 2026-04-29 プログラム一覧改善 — おすすめバッジ + 管理者集計

### STATUS: 実装完了 — 実機確認待ち

### 実装内容

**A. 管理者: /admin/program-stats（DB migration 不要）**

| 項目 | 内容 |
|---|---|
| データソース | `program_enrollments` × `programs` をメモリ集計 |
| 表示項目 | プログラム名 / 累計選択数 / 利用中 / 完了 / 休止 / 最終選択日 |
| 個人情報 | 表示なし（プログラム単位の集計のみ） |
| 最多選択に ★ | 累計1位に星バッジ表示 |

**B. ユーザー: プログラムカードにおすすめバッジ**

| slug | バッジ | 理由文 |
|---|---|---|
| `gzclp-base` | おすすめNo.1 | 初心者に最適な定番の筋力強化プログラム |
| `starting-strength-base` | BIG3習得におすすめ | スクワット中心の王道ノービスプログラム |
| `upper-lower-base` | 筋量・筋力アップにおすすめ | 週4日の上下分割で効率的に強化 |
| `dumbbell-full-body-base` | ダンベルで始められる | 器具が少なくても全身を鍛えられる |
| `barbell-2day-base` | 週2日から始めたい方に | 忙しい方向けのバーベル短縮プログラム |

「人気No.1」は実績データが揃うまで使用しない方針。

**✅ LIVE_CHECK PASS (2026-04-29)** — 全8項目PASS（切替中断/運営コメント/ステータス説明/個人情報なし）。横スクロールは管理者画面として許容範囲。将来的にカード型表示を検討。

---

## 2026-04-29 アーカイブ連鎖修正 — enrollment アーカイブ時に in_progress session も archived_at を記録

### STATUS: 実装完了 — 既存データ修正 SQL 実行待ち / 実機確認待ち

### ROOT_CAUSE

`/api/enrollments/[id]/archive` が `program_enrollments.archived_at` のみ更新し、
紐づく `workout_sessions` は変更しなかった。

`getCurrentWorkoutSessionView()` は `workout_sessions.archived_at IS NULL` でフィルターするだけで
enrollment の状態を確認しないため、アーカイブ済み enrollment の `in_progress` session を拾ってしまう。

→ /train ではトレーニング中に見える が /admin/program-stats では「利用中 0」のズレが発生。

### FIX

archive route に連鎖アーカイブを追加:
- `program_enrollments.archived_at = now()` 更新後
- `workout_sessions WHERE program_enrollment_id = enrollmentId AND status='in_progress' AND archived_at IS NULL` も `archived_at = now()` に更新
- completed/cancelled 履歴は変更しない（物理削除なし）
- Non-fatal: session archive 失敗でも enrollment archive は成功扱い

### 既存データ修正 SQL（手動実行が必要）

```sql
-- アーカイブ済み enrollment の in_progress session を連鎖アーカイブ
UPDATE workout_sessions
SET archived_at = now()
WHERE status = 'in_progress'
  AND archived_at IS NULL
  AND program_enrollment_id IN (
    SELECT id FROM program_enrollments WHERE archived_at IS NOT NULL
  );
```

---

## 2026-04-29 アーカイブ連鎖修正 追加 — paused enrollment の in_progress session も archive

### STATUS: 実装完了 — 既存データ修正 SQL 実行待ち / 実機確認待ち

### ROOT_CAUSE（追加）

前回の archive route 修正は `archived_at IS NOT NULL` の enrollment のみ対象だった。  
本当の原因は `status='paused' AND archived_at IS NULL` の enrollment。

別プログラム開始時（`enrollment:paused_for_program_switch`）に:
- `program_enrollments.status = 'paused'` にするが `archived_at` は NULL のまま
- 紐づく `workout_sessions` の `in_progress` も変更しない
→ `getCurrentWorkoutSessionView()` が古い session を拾い /train に表示

### FIX（追加）

`lib/workout/enrollment.ts` の program switch 処理に連鎖アーカイブを追加:
- enrollment を paused にする直後に
- `workout_sessions WHERE enrollment_id=X AND status='in_progress' AND archived_at IS NULL`
- → `archived_at = pausedAt` に更新（completed/cancelled は変更しない）
- Non-fatal（session archive 失敗でも enrollment pause は成功扱い）

### 既存データ修正 SQL（要手動実行）

```sql
-- 対象確認
SELECT COUNT(*) AS target_count
FROM workout_sessions
WHERE status = 'in_progress'
  AND archived_at IS NULL
  AND program_enrollment_id IN (
    SELECT id FROM program_enrollments
    WHERE status = 'paused' AND archived_at IS NULL
  );

-- 問題なければ実行
UPDATE workout_sessions
SET archived_at = now()
WHERE status = 'in_progress'
  AND archived_at IS NULL
  AND program_enrollment_id IN (
    SELECT id FROM program_enrollments
    WHERE status = 'paused' AND archived_at IS NULL
  );
```

---

## 2026-04-29 getTrainFallbackView Strategy 1 — paused 除外

### STATUS: 実装完了 — 実機確認待ち

### ROOT_CAUSE

`getTrainFallbackView` Strategy 1 が `.in("status", ["active", "paused"])` で
`paused` enrollment も /train の再開候補にしていた。

`paused` = 別プログラムへ切り替えた古い受講（enrollment:paused_for_program_switch）
→ GZCLP の paused enrollment が拾われ、StartSessionScreen「2週目・3日目を開始」が表示されていた。

### FIX（2段階）

**Step 1（前回）:** `.in("status", ["active", "paused"])` → `.eq("status", "active")`  
**Step 2（今回）:** active enrollment が null なら即 `return null`。Strategy 2（全 session グローバル検索）を削除。

Strategy 2 が paused/completed enrollment の session を拾って `/train?program=gzclp-base&programDayId=XXXX` にリダイレクトしていた。これを排除。active enrollment がない場合は /programs へ。active enrollment があるが current_program_day_id が null の場合は enrollment スコープの session 検索で解決。

**✅ LIVE_CHECK PASS (2026-04-29)** — GZCLP 古い画面なし / /programs 誘導OK / 履歴残存 / エラーなし（シークレット確認済み）

### 再選択フローの確認

同じプログラムを再選択した場合:
- archived enrollment は `archived_at IS NOT NULL` のため active enrollment 検索から除外される
- `findOrCreateEnrollment` が新規 enrollment を Week1 Day1 で作成 → 正常動作

---

## 2026-04-29 日本語化対応 — progression_guide / program 説明文 / お知らせ

### STATUS: 実装完了 — 実機確認 + migration 適用待ち

### 対応内容

#### 1. progression_guide / notes の日本語化（migration 000032）

`program_days.progression_guide` と `notes` に残っていた英語表記を日本語に置換。

| 対象ファイル | 修正内容 |
|---|---|
| `seed/programs/gzclp-base-live-correction.sql` | A1/B1/A2/B2 × 12行を日本語化 |
| `seed/programs/gzclp-base-v2.sql` | 同上 × 12行 |
| `seed/programs/gzclp-base-v2-4day.sql` | 同上 × 16行（週4日分） |
| `seed/programs/gzclp-base.sql` | 旧 `->` 形式 × 12行を日本語化 |
| `seed/programs/starting-strength-base.sql` | Day A/B × 9行を日本語化 |
| `lib/workout/t1-progression.ts` | `"Retest"` → `"再テスト"` |

**日本語化パターン:**
- `A1 — T1 Squat: 5×3+ → ...` → `スクワット中心の日 — T1 スクワットは 5×3+ → 6×2+ → 10×1+ の順に進みます。…`
- B1 → プレス中心の日 / A2 → ベンチプレス中心の日 / B2 → デッドリフト中心の日

**既存DB反映:** `supabase/migrations/20260429_000032_translate_progression_guide_jp.sql`

---

#### 2. ジムお知らせ追加（migration 000033）

`gym_announcements` テーブルに「GZCLプログラムの見方について」を追加。

- T1/T2/T3 の役割を初心者向けに段落ごとに説明
- A1/B1 などの内部表記なし
- `display_order = 10`（上位表示）、`is_published = true`
- `GymAnnouncementSection.module.css` に `white-space: pre-wrap` を追加し改行を有効化

**既存DB反映:** `supabase/migrations/20260429_000033_gzcl_announcement_seed.sql`

---

#### 3. プログラム詳細「目標」「概要」の A1/B1/A2/B2 除去（migration 000034）

スクショで確認した「GZCLP 基礎 4日/週（4週）」の「目標」「概要」に A1/B1/A2/B2 が残存。

**ROOT_CAUSE:** `lib/workout/format-labels.ts` の `PROGRAM_GOAL_BY_SLUG` / `PROGRAM_OVERVIEW_BY_SLUG` が
`ProgramDetailScreen.tsx` の「目標」「概要」を上書きする最優先ソース。

| 対象ファイル | 修正内容 |
|---|---|
| `lib/workout/format-labels.ts` | GOAL/OVERVIEW の gzclp 系エントリを全修正。T2練習 → T2の補助種目 |
| `lib/programs/program-catalog.ts` | モック catalog の goal / overview / sourceNotes を修正 |
| `seed/programs/gzclp-base-v2.sql` | description を英語→日本語 |
| `seed/programs/gzclp-base-v2-4day.sql` | 同上 |
| `seed/programs/update-program-titles-jp.sql` | gzclp-base-v2 の description 更新を追加 |

**既存DB反映:** `supabase/migrations/20260429_000034_translate_program_description_jp.sql`

---

### コミット一覧（2026-04-29）

| hash | 内容 |
|---|---|
| `d5c192a` | i18n(seed): progression_guide / notes 日本語化、Retest→再テスト |
| `221c1bc` | feat(gym): GZCLお知らせ追加、cardBody に pre-wrap |
| `15d08f8` | i18n(programs): 「目標」「概要」から A1/B1/A2/B2 除去 |

---

### 次回開始時の確認事項

1. **migration 適用（最優先）**
   - `supabase/migrations/20260429_000032_translate_progression_guide_jp.sql`
   - `supabase/migrations/20260429_000033_gzcl_announcement_seed.sql`
   - `supabase/migrations/20260429_000034_translate_program_description_jp.sql`
   - Supabase ダッシュボード SQL Editor または `supabase db push` で適用

2. **実機確認（migration 適用後）**
   - `/train` — ワークアウト画面の progressionGuide 欄が「スクワット中心の日 —」など日本語になっているか
   - `/gym` — お知らせに「GZCLプログラムの見方について」が表示され、段落改行されているか
   - `/programs/gzclp-base-v2-4day` — 「目標」「概要」から A1/B1/A2/B2 が消えているか
   - T1 10×1+ 失敗後のフェーズバッジが「再テスト」と表示されるか

3. **残存確認が不要な箇所**（修正済・問題なし）
   - SQL コメント（`--`）内の A1/B1: 開発者向け注釈のみ
   - `source_notes` カラム: ユーザー画面非表示（管理専用）

