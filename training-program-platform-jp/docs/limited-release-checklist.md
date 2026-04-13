# 限定公開前チェックリスト

作成: 2026-04-13
最終更新: 2026-04-13（限定公開実施ログ追記）

詳細手順は `docs/limited-release-guide.md` を参照。

---

## A. Vercel デプロイ前

- [ ] `npm run typecheck` がローカルで pass する
- [ ] `npm run build` がローカルで pass する
- [ ] `.env.example` の 3 変数がすべて揃っている（実際の値は `.env.local` にのみ入れる）
- [ ] `git push` 済みで GitHub のブランチが最新

---

## B. Vercel 設定

- [ ] GitHub リポジトリを Vercel にインポート済み
- [ ] Root Directory: `training-program-platform-jp` に設定
- [ ] 環境変数 3 つを設定済み（Production / Preview / Development すべて）
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`（`NEXT_PUBLIC_` プレフィックスなし ← 重要）
- [ ] ビルドが成功し、Vercel デプロイ URL が発行されている

---

## C. Supabase 設定

- [ ] Authentication → URL Configuration の Site URL を Vercel URL に更新
- [ ] Authentication → URL Configuration の Redirect URLs に Vercel URL を追加（`https://[project].vercel.app/**`）
- [ ] 招待ユーザーのアカウントが Authentication → Users に作成済み
- [ ] `public.users` テーブルに招待ユーザーの行が存在する（auth trigger 確認）

---

## D. スモークテスト（未ログイン）

- [ ] `/programs` → プログラム一覧が表示される（redirect なし）
- [ ] `/programs/gzclp-base` → GZCLP Base 詳細が表示される（redirect なし）
- [ ] `/workout-summary/any-id` → `/login?next=...` にリダイレクト
- [ ] `/exercise-history/squat` → `/login?next=...` にリダイレクト

---

## E. スモークテスト（ログイン済み）

- [ ] `/login` → ログインフォームが表示される
- [ ] 招待済みユーザーでサインイン → `/programs` にリダイレクト
- [ ] `/programs/gzclp-base` → "Go to Train" が表示される
- [ ] "Go to Train" → StartSession 画面に遷移
- [ ] "Start Workout" → セッション作成成功（console error なし）→ `/train` に遷移
- [ ] `/train` → ワークアウト画面が表示される
- [ ] セット weight / reps を入力 → 保持される
- [ ] セット Complete / Unlock が動作する
- [ ] Add Set が動作する
- [ ] Finish → `/workout-summary/[id]` に遷移し完了内容が表示される
- [ ] Summary の "Back to Programs" → `/programs` に戻れる
- [ ] `/exercise-history/squat` → セッション履歴が表示される（または "No history" 表示）

---

## F. 招待制ポリシー確認

- [ ] 招待ユーザー以外へ URL を公開していない
- [ ] 不要なデモアカウントを削除済み（または Supabase で無効化済み）
- [ ] 招待ユーザーにログイン情報の伝達方法を確認済み

---

## G. 完了報告

- [ ] `PROJECT_STATUS.md` に限定公開完了を記録
- [ ] Vercel URL を `PROJECT_STATUS.md` に記載
- [ ] `git push` 済み

---

## 2026-04-13 実施ログ

| 項目 | 結果 |
|---|---|
| 本番 URL | `https://training-program-platform-jp.vercel.app` |
| 実施日 | 2026-04-13 |
| 判定 | 成功（限定公開開始済み） |

### 確認した項目

- [x] `/programs` 表示成功
- [x] 未ログインで保護ページが `/login` へ redirect
- [x] ログイン後に `/exercise-history/squat` 表示成功
- [x] `/train` → Finish → `/workout-summary` 成功
- [x] `/exercise-history/overhead-press` に 5 セット履歴反映成功
- [x] Supabase URL Configuration 設定完了

### 残課題

- [ ] C-2: 2本目プログラム seed 追加
- [ ] `sign up 429` の再確認（低優先）

---

## 問題が起きたときの参照先

| 症状 | 参照先 |
|---|---|
| ビルドエラー | `npm run typecheck` → `npm run build` でローカル確認 |
| env 関連 | `docs/limited-release-guide.md` → 環境変数セクション |
| Auth / リダイレクト問題 | Supabase → Authentication → URL Configuration |
| RLS 関連 | `docs/phase-b-step3-checklist.md` |
| Vercel ロールバック | Vercel Dashboard → Deployments → 前バージョンを Redeploy |
