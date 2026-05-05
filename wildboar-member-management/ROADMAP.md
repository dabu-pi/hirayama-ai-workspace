# ROADMAP — ワイルドボア会員管理システム

最終更新：2026-05-05

## フェーズ一覧

| フェーズ | 名称 | ステータス |
|---|---|---|
| Phase 0 | 設計資料作成 | ✅ 完了（2026-05-04） |
| Phase 1 | スプレッドシート基盤構築 | ✅ 完了（2026-05-05 DEV実行確認済み） |
| Phase 2 | 入会フォーム実装 | 🔄 実装完了・Webアプリデプロイ確認待ち |
| Phase 3 | スタッフ確認・会員登録機能 | 未着手 |
| Phase 4 | 会員一覧・検索・詳細表示 | 未着手 |
| Phase 5 | 休会・退会・再開処理 | 未着手 |
| Phase 6 | 初回費用計算・請求管理 | 未着手 |
| Phase 7 | リコーリース集金代行エクスポート | 未着手 |
| Phase 8 | PDF出力・書類生成 | 未着手 |
| Phase 9 | 月別集計・ダッシュボード | 未着手 |
| Phase 10 | Next.js フロントエンド構築 | 未着手 |
| Phase 11 | Supabase PostgreSQL 移行 | 未着手 |
| Phase 12 | 本番リリース・GAS版廃止 | 未着手 |

---

## Phase 0 — 設計資料作成

**目標:** 実装に入る前に設計を完成させる。後続フェーズのAI引き継ぎプロンプトも整備する。

**ステータス:** 完了（2026-05-04）

### タスク

- [x] プロジェクトディレクトリ作成
- [x] README.md 作成
- [x] ROADMAP.md 作成
- [x] PROJECT_STATUS.md 作成
- [x] CONTEXT.md 作成
- [x] AI_RULES.md 作成
- [x] docs/CURRENT_WORKFLOW_ANALYSIS.md 作成
- [x] docs/DATA_MODEL.md 作成
- [x] docs/MEMBER_FIELDS.md 作成
- [x] docs/MEMBERSHIP_RULES.md 作成
- [x] docs/FEE_CALCULATION_RULES.md 作成
- [x] docs/INTAKE_FORM_DESIGN.md 作成
- [x] docs/STAFF_REVIEW_FLOW.md 作成
- [x] docs/PAUSE_WITHDRAWAL_RESTART_FLOW.md 作成
- [x] docs/RICOH_LEASE_EXPORT_DESIGN.md 作成
- [x] docs/PRIVACY_SECURITY_POLICY.md 作成
- [x] docs/WEBAPP_FINAL_ARCHITECTURE.md 作成
- [x] docs/DATABASE_SCHEMA_WEBAPP.md 作成
- [x] docs/WEBAPP_MIGRATION_PLAN.md 作成
- [x] docs/GAS_TO_SUPABASE_MAPPING.md 作成
- [x] gas-project/ スタブファイル群作成
- [x] sheets/ スキーマ・移行計画作成
- [x] tests/ チェックリスト作成
- [x] prompts/ 引き継ぎプロンプト作成

---

## Phase 1 — スプレッドシート基盤構築

**目標:** GASセットアップコードを実装し、setupSpreadsheet()一発で11シートを構築できるようにする。

**ステータス:** ✅ 完了（2026-05-05 DEV実行確認済み）

**前提条件:** Phase 0の全設計資料が完成していること

### タスク（AIが完了したもの）

- [x] SetupService.gs 新規作成（setupSpreadsheet / createRequiredSheets / setupHeaders / setupInitialSettings / setupMembershipPlans / setupFeeRules / setupValidations）
- [x] SheetService.gs 実装（getSheetData / appendRow / findRowByKey / updateRowByKey / getSetting / generateId / nowIso）
- [x] SheetService.gs バグ修正（getSpreadsheet() を getActiveSpreadsheet() 優先に変更）
- [x] Config.gs 修正（MEMBER_STATUS.PAUSED = 'paused' に統一）
- [x] 全ドキュメントのステータス表記を pause → paused に統一
- [x] StatusHistory フィールド名を status_before/status_after → previous_status/new_status に統一
- [x] SHEET_SCHEMA.md 全11シートのヘッダー・入力規則確定
- [x] INITIAL_SETTINGS.md セットアップ手順書完成
- [x] Google Drive `00_会員管理システム/` フォルダ構成作成（6サブフォルダ）
- [x] DEVスプレッドシート作成（`02_開発・テスト/` 内）
- [x] clasp コンテナバインド Apps Script プロジェクト作成・24ファイル push

### タスク（オーナーが完了したもの）

- [x] DEVスプレッドシートで setupSpreadsheet() を実行
- [x] 11シート作成確認
- [x] ヘッダー・初期データ確認
- [x] 2回実行でも重複なし（冪等性）確認

### 残タスク（Phase 2 開始前）

- [ ] GASをWebアプリとしてデプロイする
- [ ] MembershipPlansシートの金額を実際の値に更新する（仮値のままでも開発は可能）
- [ ] Settingsシートの仮値を実際の値に更新する
- [ ] KeyCardsシートに鍵番号を手動登録する

---

## Phase 2 — 入会フォーム実装

**目標:** タブレットから入力できる入会申込フォームを実装する。

**ステータス:** GASコード実装・clasp push 完了（2026-05-05）。Webアプリデプロイ後に動作確認。

**前提条件:** Phase 1が完了していること

### タスク（完了）

- [x] intake-form.html の実装（Step 1〜5 + 確認画面 + 完了画面を1ファイルに実装）
- [x] フォーム送信後の完了メッセージ・受付番号表示実装
- [x] IntakeService.gs: getMembershipPlans / generateApplicationId / saveIntakeApplication 実装
- [x] ValidationService.gs: validateIntakeForm 全バリデーション実装
- [x] 郵便番号自動検索（zipcloud API）実装
- [x] sessionStorage によるステップ間データ保持
- [x] 二重送信防止・ローディングオーバーレイ
- [x] 個人情報ログ出力防止

### タスク（オーナー動作確認待ち）

- [ ] GAS Webアプリとしてデプロイする（「新しいデプロイ」→「種類：Webアプリ」→「アクセス：全員」）
- [ ] タブレットでフォームを開いてStep 1〜完了まで通し確認
- [ ] IntakeApplications シートに申込データが保存されることを確認
- [ ] 2回送信しても application_id が重複しないことを確認

---

## Phase 3 — スタッフ確認・会員登録機能

**目標:** スタッフが入会申込を確認し、正式な会員として登録できる画面を実装する。

**前提条件:** Phase 2が完了していること

### タスク

- [ ] member-list.html の申込一覧表示（未確認フィルタ）
- [ ] member-detail.html の申込詳細表示
- [ ] スタッフ確認フォーム（会員番号・鍵番号・コース確定）
- [ ] MemberService.gs の会員登録処理を実装
- [ ] 会員番号自動採番ロジックを実装
- [ ] 鍵番号管理（KeyCardsシート）との連携
- [ ] FeeService.gs の初回費用計算を実装
- [ ] AuditLogService.gs の操作ログ記録を実装
- [ ] 却下・差し戻し機能

---

## Phase 4 — 会員一覧・検索・詳細表示

**目標:** 登録済み会員の一覧・検索・詳細表示・編集ができる管理画面を実装する。

### タスク

- [ ] member-list.html の会員一覧実装（全会員・フィルタ付き）
- [ ] 検索機能（氏名・会員番号・電話番号）
- [ ] member-detail.html の会員詳細表示
- [ ] member-edit.html の会員情報編集
- [ ] 編集履歴の AuditLog 記録

---

## Phase 5 — 休会・退会・再開処理

**目標:** 休会・退会・再開の申請受付から処理完了までをシステム上で管理する。

### タスク

- [ ] status-change.html の実装
- [ ] StatusService.gs の休会処理を実装
- [ ] StatusService.gs の退会処理を実装
- [ ] StatusService.gs の再開処理を実装
- [ ] StatusHistory シートへの履歴記録
- [ ] 月別集計への影響反映

---

## Phase 6 — 初回費用計算・請求管理

**目標:** 初回費用の自動計算と支払い記録管理を実装する。

### タスク

- [ ] FeeService.gs の日割り計算を実装
- [ ] billing-dashboard.html の請求ダッシュボード実装
- [ ] Payments シートへの記録
- [ ] 支払い状況の管理画面

---

## Phase 7 — リコーリース集金代行エクスポート

**目標:** 毎月のリコーリース集金代行用データを自動生成・エクスポートできる機能を実装する。

### タスク

- [ ] RicohLeaseService.gs の実装
- [ ] 月次対象者（休会・退会除外）の抽出ロジック
- [ ] CSV エクスポート機能
- [ ] BillingExports シートへの記録
- [ ] エクスポート前確認画面

---

## Phase 8 — PDF出力・書類生成

**目標:** 入会申込書・領収書等のPDF出力機能を実装する。

### タスク

- [ ] PdfService.gs の実装
- [ ] 入会申込書PDF生成
- [ ] 領収書PDF生成

---

## Phase 9 — 月別集計・ダッシュボード

**目標:** 会員数・売上・入退会状況等の月別集計とダッシュボードを実装する。

### タスク

- [ ] 月別会員数集計
- [ ] 月別入会・退会・休会人数集計
- [ ] 売上集計
- [ ] ダッシュボード画面

---

## Phase 10 — Next.js フロントエンド構築

**目標:** Next.js 14+ でフロントエンドを再構築する。GAS版と並行稼働。

### タスク

- [ ] Next.js プロジェクト初期化
- [ ] Supabase 接続設定
- [ ] 認証（Supabase Auth）
- [ ] 各画面の実装（会員一覧・詳細・入会申込・休会退会・請求）

---

## Phase 11 — Supabase PostgreSQL 移行

**目標:** Google SheetsのデータをSupabaseに移行する。

### タスク

- [ ] Supabaseプロジェクト作成
- [ ] テーブル作成（DATABASE_SCHEMA_WEBAPP.md のSQL実行）
- [ ] RLSポリシー設定
- [ ] データエクスポート・クレンジング
- [ ] データインポート
- [ ] 移行後検証

---

## Phase 12 — 本番リリース・GAS版廃止

**目標:** WebアプリをVercelにデプロイし、GAS版を廃止する。

### タスク

- [ ] Vercel デプロイ
- [ ] ドメイン設定
- [ ] スタッフへの操作説明
- [ ] GAS版の読み取り専用化（一定期間後に廃止）
- [ ] 最終データ整合確認
