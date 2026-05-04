# トレーニングジム ワイルドボア 会員管理システム

## プロジェクト概要

兵庫県朝来市にあるトレーニングジム「ワイルドボア」の会員管理を一元化するシステム。
現在は紙の入会申込書をスタッフがスプレッドシートに手入力しているが、
タブレット対応の入会フォームと会員管理画面を構築し、業務効率化と正確性の向上を図る。

## ジム情報

| 項目 | 内容 |
|---|---|
| ジム名 | トレーニングジム ワイルドボア |
| 所在地 | 兵庫県朝来市立野169-1 |
| 営業時間 | 5:00〜23:00 |
| 集金代行 | リコーリース（月次口座振替） |

## プロジェクト目的

- 紙の申込書をなくし、タブレットから直接入力できる入会フォームを構築する
- 会員番号・鍵番号の手動管理を廃止し、システムで自動採番・管理する
- 初回費用の日割り計算をシステムが自動計算し、計算ミスをなくす
- リコーリース集金代行用データの月次エクスポートを自動化する
- 休会・退会・再開の処理をシステム上で管理し、履歴を残す

## フェーズ構成

| フェーズ | 内容 | 技術 |
|---|---|---|
| Phase 0 | 設計資料作成 | なし（ドキュメントのみ） |
| Phase 1 | スプレッドシート設計・初期セットアップ | Google Sheets |
| Phase 2 | 入会フォーム実装（タブレット用） | GAS + HTML |
| Phase 3 | スタッフ確認・会員登録機能 | GAS |
| Phase 4 | 会員一覧・検索・詳細表示 | GAS + HTML |
| Phase 5 | 休会・退会・再開処理 | GAS |
| Phase 6 | 初回費用計算・請求管理 | GAS |
| Phase 7 | リコーリース集金代行エクスポート | GAS |
| Phase 8 | PDF出力・書類生成 | GAS |
| Phase 9 | 月別集計・ダッシュボード | GAS |
| Phase 10 | Next.js フロントエンド構築 | Next.js 14+ |
| Phase 11 | Supabase PostgreSQL 移行 | Supabase |
| Phase 12 | 本番リリース・GAS版廃止 | Vercel |

## ディレクトリ構造

```
wildboar-member-management/
├── README.md                          # このファイル
├── ROADMAP.md                         # 開発計画・フェーズ別タスク
├── PROJECT_STATUS.md                  # 現在の進捗状態
├── CONTEXT.md                         # AI向け背景情報・再開ガイド
├── AI_RULES.md                        # AI作業ルール
│
├── docs/                              # 設計資料（Phase 0の成果物）
│   ├── CURRENT_WORKFLOW_ANALYSIS.md   # 現状業務フロー分析
│   ├── DATA_MODEL.md                  # データモデル設計
│   ├── MEMBER_FIELDS.md               # 会員情報全項目定義
│   ├── MEMBERSHIP_RULES.md            # 会員制度ルール
│   ├── FEE_CALCULATION_RULES.md       # 初回費用計算ルール
│   ├── INTAKE_FORM_DESIGN.md          # 入会フォーム画面設計
│   ├── STAFF_REVIEW_FLOW.md           # スタッフ確認画面設計
│   ├── PAUSE_WITHDRAWAL_RESTART_FLOW.md  # 休会・退会・再開フロー
│   ├── RICOH_LEASE_EXPORT_DESIGN.md   # リコーリース集金代行設計
│   ├── PRIVACY_SECURITY_POLICY.md     # 個人情報・セキュリティ方針
│   ├── WEBAPP_FINAL_ARCHITECTURE.md   # 最終Webアプリアーキテクチャ
│   ├── DATABASE_SCHEMA_WEBAPP.md      # Supabase PostgreSQLスキーマ
│   ├── WEBAPP_MIGRATION_PLAN.md       # GAS版からWebアプリへの移行計画
│   └── GAS_TO_SUPABASE_MAPPING.md     # データモデルマッピング表
│
├── gas-project/                       # GAS実装（Phase 1〜9）
│   ├── appsscript.json
│   ├── Code.gs
│   ├── Config.gs
│   ├── MemberService.gs
│   ├── IntakeService.gs
│   ├── FeeService.gs
│   ├── StatusService.gs
│   ├── BillingService.gs
│   ├── RicohLeaseService.gs
│   ├── AuditLogService.gs
│   ├── PdfService.gs
│   ├── SheetService.gs
│   ├── ValidationService.gs
│   └── html/
│       ├── layout.html
│       ├── home.html
│       ├── intake-form.html
│       ├── intake-confirm.html
│       ├── member-list.html
│       ├── member-detail.html
│       ├── member-edit.html
│       ├── status-change.html
│       ├── billing-dashboard.html
│       └── settings.html
│
├── sheets/                            # Google Sheetsスキーマ・移行計画
│   ├── SHEET_SCHEMA.md
│   ├── INITIAL_SETTINGS.md
│   └── MIGRATION_PLAN.md
│
├── tests/                             # テスト計画・チェックリスト
│   ├── manual-checklist.md
│   └── live-check-plan.md
│
└── prompts/                           # AI引き継ぎプロンプト
    ├── PHASE_0_PROJECT_SETUP_PROMPT.md
    ├── PHASE_1_DATA_MODEL_PROMPT.md
    ├── PHASE_2_INTAKE_FORM_PROMPT.md
    └── PHASE_3_MEMBER_REGISTRATION_PROMPT.md
```

## 技術スタック

### Phase 1〜9（GAS版MVP）

| 技術 | 用途 |
|---|---|
| Google Apps Script | バックエンドロジック・API |
| Google Sheets | データベース |
| HTML / CSS / JavaScript | フロントエンド（GAS HTMLサービス） |
| clasp | GASバージョン管理 |

### Phase 10〜12（Webアプリ版）

| 技術 | 用途 |
|---|---|
| Next.js 14+（App Router） | フロントエンド |
| Supabase PostgreSQL | データベース |
| Supabase Auth | 認証 |
| Vercel | ホスティング |

## 開発方針

- Phase 0では設計資料を先に完成させ、実装は Phase 1から開始する
- 個人情報は外部AIサービスに送信しない（AI_RULES.md 参照）
- 金額・料金はコードにハードコードせず、スプレッドシートの設定シートから取得する
- 本番データを壊さないよう、テスト環境を別途用意してから移行する
