# 最終Webアプリアーキテクチャ設計

作成日：2026-05-04
対象：Phase 10〜12（Next.js + Supabase 移行後）

---

## 概要

GAS版（Phase 1〜9）での運用実績を踏まえ、Phase 10〜12でWebアプリ版に移行する。
スケーラビリティ・UI品質・メンテナンス性を向上させる。

---

## 技術スタック

| 役割 | 技術 | バージョン |
|---|---|---|
| フロントエンド | Next.js | 14以上（App Router使用） |
| 言語 | TypeScript | 5.0以上 |
| スタイリング | Tailwind CSS | 3.x |
| データベース | Supabase PostgreSQL | 最新安定版 |
| 認証 | Supabase Auth | 最新安定版 |
| ファイルストレージ | Supabase Storage | PDF・エクスポートファイル保存 |
| ホスティング | Vercel | 最新 |
| バージョン管理 | GitHub | feature/app-main ブランチ |

---

## システム構成

```
[タブレット / PC ブラウザ]
         |
         v
  [Vercel（Next.js）]
    ├── /intake       ← 入会フォーム（認証不要）
    ├── /admin        ← スタッフ管理画面（認証必須）
    │   ├── /intake-review    ← 申込確認
    │   ├── /members          ← 会員一覧・詳細
    │   ├── /status-change    ← 休会・退会・再開
    │   ├── /billing          ← 請求管理
    │   └── /settings         ← システム設定
    └── /api          ← APIルート（Next.js Route Handlers）
         |
         v
  [Supabase]
    ├── PostgreSQL    ← データベース
    ├── Auth          ← 認証（メール・パスワード）
    ├── Storage       ← ファイル保存
    └── Edge Functions ← バックグラウンド処理（将来）
```

---

## 画面構成

### 公開画面（認証不要）

| パス | 画面名 | 説明 |
|---|---|---|
| /intake | 入会申込フォーム | タブレット用。ステップ式フォーム |
| /intake/confirm | 入会申込確認画面 | 入力内容確認 |
| /intake/complete | 申込完了画面 | 受付番号の表示 |

### 管理画面（スタッフ認証必須）

| パス | 画面名 | 説明 |
|---|---|---|
| /admin | ダッシュボード | 会員数・最新申込・月別集計のサマリ |
| /admin/intake-review | 申込一覧・確認 | 未確認申込の確認・承認・却下 |
| /admin/members | 会員一覧 | 会員の検索・絞り込み・一覧表示 |
| /admin/members/[id] | 会員詳細 | 個人情報・ステータス履歴・支払い履歴 |
| /admin/members/[id]/edit | 会員編集 | 会員情報の修正 |
| /admin/status-change | ステータス変更 | 休会・退会・再開の申請受付 |
| /admin/billing | 請求ダッシュボード | 月次請求管理・支払い記録 |
| /admin/billing/export | 集金代行エクスポート | リコーリース用CSVの生成 |
| /admin/billing/monthly | 月別集計 | 会員数・収入の月別集計 |
| /admin/settings | システム設定 | コースマスタ・料金設定 |
| /admin/audit-logs | 操作ログ | AuditLogsの閲覧 |

### 認証画面

| パス | 画面名 | 説明 |
|---|---|---|
| /login | ログイン | メール・パスワードによるログイン |

---

## APIルート設計方針

Next.js の Route Handlers（`/app/api/` 配下）を使用する。

### エンドポイント設計方針

- RESTful API に準拠する
- 認証が必要なエンドポイントはサーバーサイドで Supabase Auth のセッションを確認する
- エラーレスポンスは統一フォーマットで返す

### 主要エンドポイント

| メソッド | パス | 説明 |
|---|---|---|
| POST | /api/intake | 入会申込の送信 |
| GET | /api/admin/intake | 申込一覧取得 |
| GET | /api/admin/intake/[id] | 申込詳細取得 |
| POST | /api/admin/intake/[id]/approve | 申込承認・会員登録 |
| POST | /api/admin/intake/[id]/reject | 申込却下 |
| GET | /api/admin/members | 会員一覧取得 |
| GET | /api/admin/members/[id] | 会員詳細取得 |
| PUT | /api/admin/members/[id] | 会員情報更新 |
| POST | /api/admin/members/[id]/pause | 休会処理 |
| POST | /api/admin/members/[id]/withdraw | 退会処理 |
| POST | /api/admin/members/[id]/restart | 再開処理 |
| GET | /api/admin/billing/export | 集金代行CSVエクスポート |
| GET | /api/admin/plans | コースマスタ取得 |

---

## RLSポリシー設計方針

Supabase の Row Level Security（RLS）を活用してデータアクセスを制御する。

### 基本方針

- すべてのテーブルでRLSを有効にする
- 認証済みユーザー（スタッフ）のみが管理データにアクセスできる
- 入会申込の INSERT は認証なしで許可する（タブレットから送信するため）
- 入会申込の SELECT・UPDATE・DELETE は認証済みスタッフのみ

### ポリシー設計例

```sql
-- intake_applications: 誰でも INSERT 可、認証ユーザーのみ SELECT
CREATE POLICY "anyone_can_submit_intake" ON intake_applications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "staff_can_read_intake" ON intake_applications
  FOR SELECT USING (auth.role() = 'authenticated');

-- members: 認証ユーザーのみ全操作
CREATE POLICY "staff_can_manage_members" ON members
  FOR ALL USING (auth.role() = 'authenticated');
```

### ロールベースのアクセス制御（将来）

- Supabase のカスタムクレームを使ってロール（admin / staff）を管理する
- admin のみが settings・fee_rules の変更を行えるようにする

---

## 認証設計

### 認証方式

- Supabase Auth を使ったメール・パスワード認証
- ソーシャルログイン（Google等）は使用しない（シンプルさを優先）

### セッション管理

- Supabase の JWT トークンを Next.js のサーバーサイドで検証する
- `/admin` 以下のルートはすべてサーバーサイドで認証チェックを行う
- 未認証の場合は `/login` にリダイレクトする

### スタッフアカウント管理

- スタッフアカウントの作成はオーナーが Supabase ダッシュボードから行う
- システム上での新規スタッフ追加機能は Phase 12 以降で検討

---

## パフォーマンス設計

| 項目 | 方針 |
|---|---|
| データフェッチ | Supabase クライアントのサーバーコンポーネントを使用 |
| キャッシュ | Next.js の fetch キャッシュを活用（会員一覧等は短時間キャッシュ） |
| ページネーション | 会員一覧は50件ずつ表示（Supabase の offset-based pagination） |
| リアルタイム更新 | 申込一覧は Supabase Realtime で自動更新（Phase 12 以降で検討） |

---

## デプロイ設計

### Vercel

- `main` ブランチへの push で本番デプロイが自動実行される
- プレビューデプロイ：feature ブランチは自動でプレビューURLが生成される
- 環境変数：Supabase の URL・anon key・service role key を Vercel の環境変数に設定する

### 環境分離

| 環境 | 用途 | Supabase プロジェクト |
|---|---|---|
| 開発（local） | 開発・テスト | ローカルの Supabase または開発用プロジェクト |
| 本番（production） | 本番運用 | 本番用 Supabase プロジェクト |

---

## GAS版との並行運用期間

- Phase 10 〜 11：GAS版を継続稼働しながら Webアプリ版を構築・テストする
- Phase 12：Webアプリ版を本番稼働し、GAS版を読み取り専用に変更する
- GAS版廃止：Webアプリ版が安定稼働を確認してから、段階的に GAS版を廃止する
