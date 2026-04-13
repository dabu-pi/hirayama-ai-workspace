# ROADMAP

最終更新: 2026-04-13（C-3b/C-3c live pass / programs 一覧 CTA UX 修正完了）

---

## 現在地（2026-04-13）

### Phase A〜B 完了状態

| 項目 | 状態 |
|---|---|
| MVP ワークアウトフロー | Programs → Detail → StartSession → Train → Finish → Summary ✅ |
| Auth 基盤（Supabase Email/Password） | sign in / sign up + session cookie ✅ |
| RLS 全テーブル適用 | user-scoped テーブルに auth.uid() ポリシー ✅ |
| Exercise History 認可強化 | 未ログイン遮断 / server client 統一 ✅ |
| **限定公開判断** | **Go ✅（2026-04-13）** |
| **限定公開実施** | **開始済み ✅（2026-04-13）** |
| **本番 URL** | **`https://training-program-platform-jp.vercel.app`** |

### 直近タスク

| タスク | 状態 |
|---|---|
| 限定公開準備（デプロイガイド・チェックリスト作成） | ✅ 完了（2026-04-13） |
| 限定公開実施（Vercel デプロイ + live 確認） | ✅ 完了（2026-04-13） |
| C-1: seed 運用ルール docs 化 | ✅ 完了（2026-04-13） |
| **C-2: 2本目プログラム seed 追加** | **✅ 完了（2026-04-13, Starting Strength Base live 反映）** |
| **C-2b: seed 原本整合回復** | **✅ 完了（2026-04-13）** |
| **C-3: プログラム難易度・タグ管理（仕様固定）** | **✅ 設計完了（2026-04-13）** |
| **C-3a: metadata 基盤実装** | **✅ 完了（2026-04-13）** |
| **C-3a-live: metadata live 反映** | **✅ 完了（2026-04-13）** |
| **C-3b: `/programs` metadata 表示** | **✅ 完了 + live 修正済み（2026-04-13）** |
| **C-3c: Program Detail metadata 表示** | **✅ 完了 + live pass（2026-04-13）** |
| **C-3b/C-3c live 確認** | **✅ pass（2026-04-13）** |
| **Vercel Production Branch 統一** | **✅ `feature/auto-dev-phase3-loop` に変更済み** |
| **Programs 一覧 CTA UX 修正** | **✅ 完了（2026-04-13）** |
| C-3d: filter UI / タグ絞り込み | 📋 候補（優先度検討） |
| B-6: sign up 429 再確認 | 低優先（外部レート制限） |

### 限定公開完了の確認結果

| 条件 | 状態 |
|---|---|
| 公開ルートが未ログインで表示される | ✅ live 確認済み |
| ワークアウトフローが通しで動く | ✅ live 確認済み |
| 他人のデータに触れない（owner guard + RLS） | ✅ 確認済み |
| 未ログインで保護ルートがリダイレクトされる | ✅ 確認済み |
| sign up 429 | ⚠️ 外部レート制限（blockerとしない） |

### 次フェーズの優先タスク（C-3）

1. `/programs/[slug]` で required / optional metadata の見せ分けを追加する
2. 一覧と詳細で tag の意味づけがずれないように揃える
3. filter UI は metadata 表示が落ち着いてから検討する

### C-2 完了メモ

- 2本目候補は `Starting Strength Base` を採用
- `GZCLP Base` との軽い差分確認:
  - 共通点: どちらも初心者向けのバーベル中心プログラム
  - 差分: `Starting Strength Base` はスクワット毎回 + A/B 交互 + Power Clean を含むクラシック novice 構成
- `seed/programs/starting-strength-base.sql` を live Supabase へ反映済み
- SQL 確認: `starting-strength-base` program 存在、3 weeks / 9 days / 27 day_exercises、`power-clean` 参照成立
- live 確認: `/programs` と `/programs/starting-strength-base` 表示成功、`Go to Train` の入口も確認済み

### C-2b 完了メモ

- live DB で手修正した日本語文言を `seed/programs/starting-strength-base.sql` へ戻し込み済み
- 日本語の実データ文字列は Unicode escape 形式へ変更し、別環境再投入時の文字化け耐性を上げた
- `docs/seed-program-guide.md` に UTF-8 保存と貼り付け時の注意を追記
- 「正本は repo、live はその反映結果」という前提を回復済み

### C-3 設計完了メモ

- `docs/program-metadata-design.md` を追加し、比較用 metadata の仕様を固定
- level 方針
  - `programs.level` は `beginner / intermediate / advanced` の 3 段階を正本とする
  - UI 表示は `Beginner / Intermediate / Advanced`
  - `novice` は現時点では不採用
- tag 方針
  - required: `goal`, `equipment`, `split`
  - optional: `focus`
  - `days_per_week` / `duration_weeks` / `level` は既存 structured field を使い、tag に重複させない
- 仮比較表
  - `gzclp-base` = `strength`, `barbell`, `full-body`
  - `starting-strength-base` = `strength`, `barbell`, `full-body`, `squat-focus`, `explosive`
- metadata の正本は code ではなく DB で持つ方針を採用

### C-3a 完了メモ

- `supabase/migrations/20260413_000009_program_metadata_foundation.sql`
  - `programs.level` canonical constraint を追加
  - `program_tags` / `program_tag_assignments` を追加
  - axis 制限と single-select axis 制約を追加
  - public 読み取り用 RLS policy を追加
- `seed/programs/program-metadata.sql`
  - `gzclp-base` と `starting-strength-base` へ metadata を付与する seed を追加
- read path
  - `types/programs.ts` に `ProgramLevel` / `ProgramTag` / `levelKey` / `tags`
  - `program-library.ts` で program ごとの metadata 読込を追加
  - metadata table 未適用環境では tags を空にして既存導線を維持
- 次は C-3b として `/programs` UI 表示へ進む

### C-3a-live 完了メモ

- live Supabase に migration / seed を反映済み
  - `program_tags_count = 5`
  - `program_tag_assignments_count = 8`
- `gzclp-base` は required 3 軸が各 1
- `starting-strength-base` は required 3 軸が各 1、`focus = 2`
- live `/programs` / `/programs/gzclp-base` / `/programs/starting-strength-base` で `Source: Supabase` の正常表示を確認

### C-3b 完了メモ

- `/programs` list card に metadata を追加
  - `level`
  - required tags: `goal / equipment / split`
  - optional `focus`: 最大 1 件
- `gzclp-base` と `starting-strength-base` の差分が一覧で見える状態に更新
  - 共通: `Strength / Barbell / Full Body`
  - 差分: `starting-strength-base` に `Squat Focus`

### C-3b live 修正メモ（2026-04-13）

- **症状:** 本番 `/programs` で `Beginner` / `3 days / week` / `3 weeks` は表示されるが metadata badge (`Strength / Barbell / Full Body / Squat Focus`) が未表示
- **原因:** `listProgramTagsByProgramId` が `program_tag_assignments` → `program_tags` の PostgREST 複合 FK 埋め込み (`!inner`) でサイレントエラーを起こし、空配列で fallback していた
  - FK は `(tag_id, axis) → program_tags(id, axis)` という複合構成で、PostgREST の関係解決が失敗していた可能性が高い
- **修正:** `lib/programs/program-library.ts` の `listProgramTagsByProgramId` を2本の単純クエリ + メモリ結合に変更（複合 FK join を廃止）
  1. `program_tag_assignments` から `(program_id, tag_id, axis)` を取得
  2. `program_tags` から tag 詳細を取得
  3. メモリ上で結合
### C-3c 完了メモ（2026-04-13）

- `components/programs/ProgramDetailScreen.tsx` に required tags + optional focus タグ行を追加
  - metaGrid（Level / Frequency / Duration）の直下に `tagRow` を追加
  - required: `goal / equipment / split`（tagBadge: ニュートラル）
  - optional: `focus`（focusBadge: 黄色）
  - tags が空の場合は tagRow を非表示
- `ProgramDetailScreen.module.css` に `.tagRow` / `.tagBadge` / `.focusBadge` を追加
  - ProgramsScreen と同じ badge スタイルを踏襲
- 一覧と詳細で badge の見た目・意味を統一済み

### Vercel Production Branch 運用メモ（2026-04-13）

- **発生した問題:** Vercel Production Branch = `master` に対し、開発は `feature/auto-dev-phase3-loop` で継続していたため `74b2718` 以降が production に反映されなかった
- **今回の対応:** `feature/auto-dev-phase3-loop` を `master` にマージ（`7883c1b`）して production 反映
- **今後の方針:**
  - Vercel Dashboard → Settings → Git → Production Branch を `feature/auto-dev-phase3-loop` に変更する
  - 変更後は push するたびに自動デプロイされる
  - `master` へのマージは不要になる
  - **この設定変更はダッシュボードで手動操作が必要（未実施）**
- **参照:** CLAUDE.md 「常用ブランチ: `feature/auto-dev-phase3-loop`」

---

## Phase 0: 企画固定

- 企画の本質を「日本語のプログラム配布型トレーニングアプリ」として固定する
- MVP の対象ユーザー、初期収録方針、管理運用前提を整理する
- 必須機能と後回し機能を切り分ける
- 用語、画面、データモデルの初期文書を整備する

## Phase 1: 土台作成

- Web 寄りのプロジェクト構成を作る
- 利用 UI / 管理 UI / seed データの置き場を分ける
- 初期データモデルと seed 方針を整える
- 単一管理者前提でも将来の複数ユーザー対応に耐える ID 設計を置く

## Phase 2: UI プロトタイプ

- スマホ優先の画面導線を固める
- ホーム、ライブラリ、プログラム詳細、今日のワークアウトの試作を作る
- 記録入力体験を最小構成で検証する
- PC 管理画面の最低限の導線を作る

## Phase 3: ワークアウト実行

- プログラム開始から当日メニュー生成までをつなぐ
- セット / 回数 / 重量 / RPE / メモを保存できるようにする
- 前回記録参照と履歴表示を実装する
- 実行中に迷わない UI と入力速度を優先する

## Phase 4: 管理画面

- 管理者ログインを整える
- プログラム登録 / 編集を実装する
- 種目マスタと作成者マスタを整備する
- 公開 / 非公開管理を実装する

## Phase 5: 複数ユーザー対応の土台整理

- ユーザー、ロール、参加中プログラムの境界を見直す
- 単一管理者前提の仮実装が複数ユーザー化で破綻しないか確認する
- 認証、権限、履歴所有の責務を整理する
- 将来のマイページ、継続記録、ユーザー別進捗に備える

## Phase 6: PWA 最適化

- ホーム追加しやすい UI を整える
- 起動速度、キャッシュ、オフライン耐性を強化する
- モバイルでの継続利用前提の UX を調整する
- 通知や再開導線など、PWA 的な改善余地を評価する
