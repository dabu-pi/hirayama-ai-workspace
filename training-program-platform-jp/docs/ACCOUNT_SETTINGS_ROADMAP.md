# アカウント設定機能 ロードマップ

> 作成: 2026-05-02  
> ステータス: 設計フェーズ（Phase S-1 完了 / Phase S-2 実装待ち）

---

## 現状調査結果

### 既存の認証・設定画面の状態

| 項目 | 状態 | 場所 |
|------|------|------|
| ログイン画面 | ✅ 実装済み | `/login` |
| ログアウト機能 | ❌ 未実装 | — |
| `/profile` 画面 | ✅ 実装済み | `/profile` |
| `/settings` または `/account` 画面 | ❌ 未作成 | — |
| アカウント削除（ユーザー申請） | ❌ ユーザー側 UI なし | — |
| アカウント削除（管理者審査） | ✅ 実装済み | `/admin/account-deletion-requests` |

### BottomTabBar の現状

4タブ構成（プログラム / トレーニング / 履歴 / ジム）。  
プロフィール・設定へのナビゲーションはボトムバーに存在しない。  
`/profile` へは現状どこからもリンクがない（直接URLアクセスのみ）。

### `/profile` ページの現状コンテンツ

- メールアドレス表示（read-only）
- 会員ステータスバッジ（active / paused / cancelled）
- 表示名編集フォーム + 保存ボタン
- マイ種目へのリンク
- 休会・退会の案内（受付対応）

**ログアウトボタンは存在しない。**

### Supabase Auth の利用状況

| ファイル | 用途 |
|---------|------|
| `app/login/page.tsx` | `signInWithPassword()` / `signUp()` |
| `lib/supabase/client.ts` | ブラウザ用クライアント（`createSupabaseBrowserClient()`） |
| `lib/supabase/server.ts` | Server/Admin クライアント（4種類） |
| `middleware.ts` | Cookie ベース session 確認 |

ログアウトは `createSupabaseBrowserClient().auth.signOut()` で実装できる（Client Component）。

### `account_deletion_requests` テーブルの実装状況

管理者側のレビューUIはすでに実装済み：

- `/admin/account-deletion-requests` — 削除リクエスト一覧・審査
- `approveDeletionRequest()` — 承認時に `membership_status = 'cancelled'` を設定
- `rejectDeletionRequest()` — 却下処理

**欠けているのはユーザー側の申請 UI のみ。**  
このテーブルの詳細スキーマは `docs/ACCOUNT_DELETE_DESIGN.md` を参照。

### 既存ページへの影響確認

| 画面 | ログアウト機能追加時の影響 |
|------|--------------------------|
| `/train` | 未ログインで訪問 → Server Component が `/login` へ redirect（既実装） |
| `/session-history` | 同上 |
| `/profile` | 同上 |
| `/gym` | Server Component が auth.getUser() を呼んでいるが未認証でもページ表示可（統計なし） |
| `/programs` | 認証不要（公開ページ）|
| `/admin/*` | Server Component の `requireAdminUserId()` でガード済み |
| middleware.ts | `/workout-summary/*`, `/exercise-history/*` を保護中 |

ログアウト後に全保護ページへアクセス不可になる（既存 redirect が機能する）。

---

## ログアウト機能の設計

### ログアウトボタンの配置

**採用案: `/profile` ページ下部に追加**

理由：
- 設定・個人情報系の操作は `/profile` に集約するのが自然
- 新規ルートを作らず既存ページに追加できる
- スマホでは「下にスクロールして操作する」行動パターンに合う

```
/profile 画面構成（追加後）

  プロフィール
  ├─ メールアドレス
  ├─ 会員ステータス
  ├─ 表示名編集
  ├─ マイ種目リンク
  ├─ 休会・退会について
  └─ ── ログアウト ──          ← 追加するセクション
       [ログアウトする] ボタン
```

### ログアウト処理の方式

```typescript
// Client Component (ProfileScreen.tsx) に追加
"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

async function handleLogout() {
  const supabase = createSupabaseBrowserClient();
  await supabase.auth.signOut();
  window.location.href = "/login"; // router.push より確実（cache flush）
}
```

**`signOut()` 後の遷移について:**  
`router.push("/login")` ではなく `window.location.href = "/login"` を使う。  
理由: Next.js Router Cache に stale な認証状態が残る可能性があるため（`/train` タブと同じ対策）。

### 表示文言

```
ログアウト

このデバイスからログアウトします。
アカウントやトレーニングデータは削除されません。

[ログアウトする]
```

### エラー時の表示

```
ログアウトに失敗しました。
もう一度お試しください。
```

Supabase の `signOut()` はネットワーク障害時に失敗する場合があるが、  
セッション Cookie はブラウザ側ですでに無効化されるため、  
エラーでも `window.location.href = "/login"` へ遷移してよい。

### スマホでの UI

- ボタン高さ: 最低 48px（タップターゲット確保）
- 色: 赤系（`color: #c0392b` / `background: #fdf2f2` 程度）
- 余白: 他セクションと明確に分離（`margin-top: 40px` 以上）

### 未ログイン時の挙動

`/profile` は Server Component でログインチェック済み。  
未ログインなら `/login` へ redirect されるため、ボタンが表示されること自体がない。

### 管理者ログイン時への影響

管理者も同じユーザーロールを持つ（role='admin' はカラムで判断）。  
ログアウト処理は `auth.users` の session を削除するだけなので、  
管理者・一般ユーザーで処理を分ける必要はない。

---

## Phase S-1: ユーザー設定画面の整理

**ステータス: 設計完了（このドキュメントが成果物）**

目的: ログアウトや将来のアカウント削除を置くための設定画面を整理する。

### 成果物

- [x] 現状調査（本ドキュメント）
- [x] ログアウト機能の設計
- [x] アカウント削除機能の設計メモ（`docs/ACCOUNT_DELETE_DESIGN.md`）
- [x] フェーズ分けロードマップ

### 既存導線への影響

BottomTabBar に Profile タブを追加するかどうかは Phase S-2 の実装時に判断する。  
最低限: `/profile` へのリンクを `/gym` ページまたはヘッダーに追加する。

---

## Phase S-2: ログアウト機能実装

**ステータス: 実装待ち（次に着手するフェーズ）**

目的: ユーザーが自分で安全にログアウトできるようにする。

### 実装スコープ

```
変更ファイル:
  components/profile/ProfileScreen.tsx   ← ログアウトセクション追加
  components/profile/ProfileScreen.module.css  ← スタイル追加

新規ファイル:
  なし（既存 /profile ページに追加）
```

### 実装内容

1. `ProfileScreen.tsx` にログアウトセクション追加
2. `createSupabaseBrowserClient().auth.signOut()` を呼び出し
3. 成功・失敗を `useState` で管理
4. 成功後 `window.location.href = "/login"` へ遷移
5. ボタンの `isPending` 中は disabled + "ログアウト中…" 表示

### テスト項目

| # | テスト | 確認方法 |
|---|--------|----------|
| T1 | ログアウトできる | ボタン押下 → `/login` 遷移確認 |
| T2 | ログアウト後に `/train` へ入れない | 直接URLアクセス → `/login` redirect 確認 |
| T3 | ログアウト後に `/profile` へ入れない | 同上 |
| T4 | ログアウト後に再ログインできる | ログインフォームで再認証 |
| T5 | スマホで問題なく操作できる | タップターゲット / レイアウト確認 |
| T6 | admin ログイン時に影響なし | admin でログアウト → `/login` 遷移のみ |
| T7 | npm run typecheck | エラーなし |
| T8 | npm run build | エラーなし |

---

## Phase S-3: アカウント削除機能の詳細設計

**ステータス: 設計中（`docs/ACCOUNT_DELETE_DESIGN.md` 参照）**

目的: 実装前に削除方式・履歴・注意文言を確定する。

詳細は `docs/ACCOUNT_DELETE_DESIGN.md` を参照。

---

## Phase S-4: アカウント削除機能実装

**ステータス: 未着手（Phase S-3 設計確定後に着手）**

目的: ユーザー自身でアプリのアカウント削除申請を行えるようにする。

**注意: このフェーズは Phase S-3 設計が完全に固まってから、別プロンプトで実装する。**

---

## 実装前のリスク整理

| リスク | 内容 | 対策 |
|--------|------|------|
| ログアウト後の Router Cache | stale な session 情報が残る場合がある | `window.location.href` で強制リロード |
| signOut() のネットワークエラー | 失敗しても /login へ遷移する設計で問題なし | エラー時もリダイレクト |
| BottomTabBar に /profile へのリンクなし | ユーザーがログアウトにたどり着けない | Phase S-2 実装時に /gym か nav に追加 |
| アカウント削除 ≠ ジム退会 | ユーザーが誤解する可能性 | 確認文言を強調表示・詳細設計で対応 |

---

## 次アクション

**Phase S-2: ログアウト機能から実装開始。**

実装すべきファイル:
- `components/profile/ProfileScreen.tsx`
- `components/profile/ProfileScreen.module.css`

実装しないこと（Phase S-3 以降）:
- アカウント削除 UI
- DB 変更
- service_role key の追加利用
