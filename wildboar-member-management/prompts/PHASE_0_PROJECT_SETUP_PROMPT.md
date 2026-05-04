# Phase 0 プロジェクトセットアップ — AIプロンプト

このドキュメントはPhase 0（設計資料作成）を担当するAIへの引き継ぎプロンプトです。

---

## このフェーズの目的

トレーニングジム ワイルドボアの会員管理システムを実装するための設計資料を作成する。
コードは書かない。設計資料のみ作成する。

## ジム概要

- ジム名：トレーニングジム ワイルドボア
- 所在地：兵庫県朝来市立野169-1
- 営業時間：5:00〜23:00
- 集金代行：リコーリース（月次口座振替）
- 現状：紙の入会申込書 → スタッフが手入力

## Phase 0 の成果物

以下のファイルを作成する（すべて完了したら次フェーズへ）。

### ルート直下
- README.md — プロジェクト概要・フェーズ構成
- ROADMAP.md — Phase 0〜12の開発計画
- PROJECT_STATUS.md — 現在の進捗
- CONTEXT.md — 背景情報・再開ガイド
- AI_RULES.md — AIが守るべきルール

### docs/ フォルダ
- CURRENT_WORKFLOW_ANALYSIS.md — 現状業務フロー分析
- DATA_MODEL.md — データモデル設計
- MEMBER_FIELDS.md — 会員情報全項目定義
- MEMBERSHIP_RULES.md — 会員制度ルール（金額はプレースホルダー）
- FEE_CALCULATION_RULES.md — 初回費用計算ルール
- INTAKE_FORM_DESIGN.md — 入会フォーム画面設計
- STAFF_REVIEW_FLOW.md — スタッフ確認画面設計
- PAUSE_WITHDRAWAL_RESTART_FLOW.md — 休会・退会・再開フロー
- RICOH_LEASE_EXPORT_DESIGN.md — 集金代行エクスポート設計
- PRIVACY_SECURITY_POLICY.md — 個人情報・セキュリティ方針
- WEBAPP_FINAL_ARCHITECTURE.md — 最終Webアプリアーキテクチャ
- DATABASE_SCHEMA_WEBAPP.md — Supabase PostgreSQLスキーマ（SQL含む）
- WEBAPP_MIGRATION_PLAN.md — GAS版からWebアプリへの移行計画
- GAS_TO_SUPABASE_MAPPING.md — データモデルマッピング表

### gas-project/ フォルダ（スタブのみ）
- appsscript.json — GAS設定
- Code.gs / Config.gs / 各Serviceファイル — 関数シグネチャとコメントのみ
- html/ — HTMLスタブファイル群

### sheets/ フォルダ
- SHEET_SCHEMA.md — Sheetsの全シート・列定義
- INITIAL_SETTINGS.md — スプレッドシート初期設定手順
- MIGRATION_PLAN.md — データ移行計画

### tests/ フォルダ
- manual-checklist.md — 手動テストチェックリスト
- live-check-plan.md — 本番環境での動作確認計画

### prompts/ フォルダ
- PHASE_0〜PHASE_3のAI引き継ぎプロンプト

## 重要なルール

- 金額はコードにハードコードしない（「設定値」「要確認」と記述する）
- 個人情報をAIに送信しない
- 設計資料は実際に使える品質で書く（スタブ・箇条書きだけでは不十分）
- 絵文字を使わない
- 日本語で書く

## Phase 0 完了の条件

- すべての設計ファイルが作成されている
- オーナーが設計資料を確認して承認した
- 料金・コース情報が確定してMEMBERSHIP_RULES.mdに記載されている
- リコーリースの提出フォーマットが確認済み

## 次のフェーズ

Phase 0 完了後は PHASE_1_DATA_MODEL_PROMPT.md を使ってPhase 1を開始する。
