# 限定公開ガイド（Vercel + Supabase）

作成: 2026-04-13
最終更新: 2026-04-13（限定公開開始）

---

## 概要

このガイドは `training-program-platform-jp` を Vercel + Supabase live 環境で招待制限定公開する手順をまとめたものです。

**公開方針:** URL は公開するが、ワークアウト機能はログイン必須。招待したユーザーのみ実使用可能。

---

## 今回の限定公開実施結果（2026-04-13）

| 項目 | 内容 |
|---|---|
| 判定 | 成功（限定公開開始済み） |
| 本番 URL | `https://training-program-platform-jp.vercel.app` |
| URL Configuration | Supabase Authentication → URL Configuration 設定済み |
| 公開範囲 | 招待制。URL は案内先を限定し、ワークアウト系はログイン必須 |

### 実施して確認した項目

- `/programs` が本番環境で表示される
- 未ログインで保護ページへアクセスしたとき `/login` に redirect される
- ログイン後に `/exercise-history/squat` が表示される
- `/train` → Finish → `/workout-summary` が完走する
- `/exercise-history/overhead-press` に 5 セット履歴が反映される

### 今回成功した項目

- Vercel 本番デプロイ完了
- Supabase URL Configuration 反映完了
- 未ログイン保護の live 確認完了
- ログイン後の programs / history / workout summary 動線確認完了
- workout 実行結果の history 反映確認完了

### 残課題

- C-2 として 2 本目のプログラム seed 追加が未着手
- `sign up 429` は外部レート制限のため低優先で再確認待ち
- 招待制運用のため、アカウント配布と不要アカウント整理を継続する

---

## 役割分担

| サービス | 役割 |
|---|---|
| **Vercel** | Next.js アプリのホスティング・ビルド・CDN配信 |
| **Supabase** | PostgreSQL DB・Auth (Email/Password)・RLS |
| **GitHub** | ソースコード正本・Vercel の自動デプロイトリガー |

---

## 環境変数

### 必須（3つ）

| 変数名 | 説明 | 設定場所 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase プロジェクトの URL | Vercel Environment Variables |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (public) key | Vercel Environment Variables |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key（server-only） | Vercel Environment Variables |

### 変数の用途

```
NEXT_PUBLIC_SUPABASE_URL
  - ブラウザクライアント（lib/supabase/client.ts）
  - サーバークライアント（lib/supabase/server.ts）
  - ミドルウェア（middleware.ts）
  - ビルド時の環境チェック（hasSupabasePublicEnv()）

NEXT_PUBLIC_SUPABASE_ANON_KEY
  - 上記と同じ（セットで使用）
  - RLS ポリシーが有効なため、anon key が漏れても DB 操作は制限される

SUPABASE_SERVICE_ROLE_KEY
  - サーバー側のみ（NEXT_PUBLIC_ プレフィックスなし = クライアントには渡らない）
  - 現在の用途: lib/programs/program-library.ts / lib/programs/program-detail.ts（公開 programs 読込）
  - RLS を bypass するため、user-scoped 処理には使用しない方針
```

### Vercel での設定手順

1. Vercel Dashboard → プロジェクト → Settings → Environment Variables
2. 上記 3 変数を `Production` / `Preview` / `Development` すべてに設定
3. `SUPABASE_SERVICE_ROLE_KEY` は **絶対に `NEXT_PUBLIC_` プレフィックスをつけない**

---

## Supabase 側の設定

### Site URL と Redirect URL（必須）

Vercel のデプロイ URL が確定したら Supabase 側を更新する。

```
Supabase Dashboard → Authentication → URL Configuration
```

| 項目 | 設定値 |
|---|---|
| **Site URL** | `https://training-program-platform-jp.vercel.app` |
| **Redirect URLs** | `https://training-program-platform-jp.vercel.app/**` |

**注意:**
- Vercel のプロジェクト名が変わると URL が変わるため、カスタムドメインを使う場合は早めに設定する
- ローカル開発中は `http://localhost:3000` を Redirect URLs に追加する（既存設定を上書きしない）
- 現在の Email/Password 認証は magic link を使わないため Redirect URL の実害は少ないが、将来の拡張に備えて設定しておく

### Auth 設定確認

```
Supabase Dashboard → Authentication → Providers → Email
```

| 項目 | 推奨設定 | 理由 |
|---|---|---|
| Enable Email Provider | ON | Email/Password 認証を使用 |
| Confirm email | OFF（招待制運用時） | 招待ユーザーを自分で手動作成する場合は不要 |
| Secure email change | ON | セキュリティ |

---

## デプロイ手順

### 1. Vercel プロジェクト作成

```
1. vercel.com にログイン
2. "Add New Project" → GitHub リポジトリを選択
3. フレームワーク: Next.js（自動検出される）
4. Root Directory: training-program-platform-jp
5. Build Command: npm run build（デフォルト）
6. Output Directory: .next（デフォルト）
7. "Deploy" を押す前に Environment Variables を設定（下記）
```

### 2. 環境変数を設定

Vercel の "Environment Variables" タブで 3 変数を入力する。

```
名前: NEXT_PUBLIC_SUPABASE_URL
値: https://[your-project-ref].supabase.co

名前: NEXT_PUBLIC_SUPABASE_ANON_KEY
値: [Supabase Dashboard → Project Settings → API → anon public]

名前: SUPABASE_SERVICE_ROLE_KEY
値: [Supabase Dashboard → Project Settings → API → service_role secret]
```

### 3. デプロイ実行

```
"Deploy" ボタンをクリック
→ ビルドログを確認（エラーがないことを確認）
→ デプロイ成功後に Vercel が URL を発行
```

### 4. Supabase の URL 設定を更新

```
Supabase → Authentication → URL Configuration
Site URL: https://[vercel-project].vercel.app
Redirect URLs に追加: https://[vercel-project].vercel.app/**
```

### 5. 動作確認

`docs/limited-release-checklist.md` のスモークテストを実施する。

### 6. 実施結果を状態ファイルへ反映

限定公開の確認が完了したら、少なくとも次を更新する。

- `PROJECT_STATUS.md` に本番 URL / 実施日 / 成功項目 / 残課題 / 次アクションを記録
- `ROADMAP.md` に「限定公開開始済み」と次フェーズの優先タスクを反映
- 必要に応じてこのガイドと `docs/limited-release-checklist.md` に実施ログを追記

---

## 招待制運用ポリシー

### 運用の基本方針

| 方針 | 内容 |
|---|---|
| URL 公開範囲 | 招待ユーザーにのみ URL を伝える |
| アカウント作成 | 管理者が Supabase Dashboard で手動作成する |
| 自己サインアップ | 現時点では利用しない（`over_email_send_rate_limit` 外部制限のため） |
| ワークアウト機能 | ログイン必須（未ログインでは `/login` にリダイレクト） |
| 公開ルート | `/programs`・`/programs/[slug]` は未ログインでも閲覧可 |

### ユーザー招待手順（管理者作業）

```
Supabase Dashboard → Authentication → Users → "Invite user"
→ メールアドレスを入力
→ "Send invitation" を押す
→ ユーザーがメールリンクからパスワードを設定
```

または、管理者が直接アカウントを作成する場合:

```
Supabase Dashboard → Authentication → Users → "Create new user"
→ Email / Password を入力
→ "Create user" を押す
→ ユーザーにメールアドレスとパスワードを別途通知
```

**注意:** `public.users` テーブルへの行挿入は `trg_create_user_profile` trigger が自動で行う。手動 INSERT は不要。

### 限定公開後の運用補足

- 招待対象は少人数に絞り、URL の共有先を都度把握する
- パスワードを管理者が作る場合は、メールとは別経路で初期パスワードを共有する
- テスト用アカウントは使い回さず、不要になったら Supabase 側で削除または無効化する
- 問い合わせ対応時は `exercise-history` と `workout-summary` の挙動を優先確認する

---

## スモークテスト

デプロイ後に以下を順番に確認する。

### 公開ルート（未ログインで確認）

| # | URL | 期待動作 |
|---|---|---|
| 1 | `/programs` | プログラム一覧が表示される |
| 2 | `/programs/gzclp-base` | GZCLP Base 詳細が表示される |
| 3 | `/workout-summary/dummy-id` | `/login?next=%2Fworkout-summary%2Fdummy-id` にリダイレクト |
| 4 | `/exercise-history/squat` | `/login?next=%2Fexercise-history%2Fsquat` にリダイレクト |

### 認証フロー

| # | 操作 | 期待動作 |
|---|---|---|
| 5 | `/login` にアクセス | ログインフォームが表示される |
| 6 | 招待済みユーザーでサインイン | `/programs` にリダイレクト |
| 7 | 間違ったパスワードでサインイン | エラーメッセージが表示される |

### ワークアウトフロー（ログイン済み）

| # | 操作 | 期待動作 |
|---|---|---|
| 8 | `/programs/gzclp-base` → "Go to Train" | StartSession 画面に遷移 |
| 9 | "Start Workout" | セッション作成（POST 201）→ `/train` へ遷移 |
| 10 | `/train` 画面でセット記録（weight/reps 入力） | PATCH 成功・値が保持される |
| 11 | セット Complete | 完了マーク付く |
| 12 | Finish → Summary | `/workout-summary/[id]` に遷移・完了内容表示 |

### データ隔離確認（2ユーザーで確認できる場合）

| # | 操作 | 期待動作 |
|---|---|---|
| 13 | ユーザーAのセッションIDをユーザーBで `/workout-summary/[id]` アクセス | "Workout summary not found" |

---

## よくある失敗点

| 症状 | 原因 | 対処 |
|---|---|---|
| ビルドエラー: TypeScript | 型エラーが残っている | ローカルで `npm run typecheck` → `npm run build` を通してから push |
| `/programs` でプログラムが表示されない | env vars が Vercel に未設定 | Vercel → Settings → Environment Variables を確認 |
| ログインが通らない（サーバーエラー） | `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` が間違っている | Supabase Dashboard → Project Settings → API でキーを再確認 |
| sign in 後に blank page | Supabase の Site URL / Redirect URL が Vercel URL と不一致 | Supabase → Authentication → URL Configuration を更新 |
| セッション開始が 401 | セッション cookie が取れていない（middleware の env チェックが失敗） | env vars の NEXT_PUBLIC_ プレフィックスが正しいか確認 |
| `public.users` に行が作られない | auth trigger が未適用 | `20260412_000005_auth_user_profile_trigger.sql` が live に適用済みか確認 |
| Vercel: function timeout | Supabase クエリが遅い | Supabase プロジェクトのリージョンを確認（Vercel と近いリージョン推奨） |
| 招待メールが届かない | Supabase の SMTP 設定・レート制限 | Supabase Dashboard → Authentication → SMTP Settings を確認。または Dashboard から直接パスワード設定して手動通知 |

---

## ロールバック手順

デプロイ後に問題が発生した場合:

```
Vercel Dashboard → プロジェクト → Deployments
→ 前のデプロイを選択 → "Redeploy" で即時ロールバック可能
```

Supabase の migration ロールバックは `docs/phase-b-step3-checklist.md` の「ロールバック手順」を参照。

---

## 参照ドキュメント

| ファイル | 内容 |
|---|---|
| `docs/limited-release-checklist.md` | 限定公開前チェックリスト（このガイドのチェックリスト版） |
| `docs/phase-b-step3-checklist.md` | RLS 適用・live 動作確認の詳細チェックリスト |
| `docs/auth-rls-design.md` | Auth / RLS 設計方針 |
| `docs/seed-program-guide.md` | プログラム追加手順 |
| `.env.example` | 環境変数テンプレート |
