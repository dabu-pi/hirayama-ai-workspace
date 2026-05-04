# Phase 1 データモデル・スプレッドシート設計 — AIへの引き継ぎプロンプト

このプロンプトはPhase 1（スプレッドシート設計・初期セットアップ）を担当するAIへの引き継ぎです。

---

## プロジェクト概要

トレーニングジム ワイルドボア（兵庫県朝来市立野169-1）の会員管理システム。
Phase 0（設計資料作成）が完了した。Phase 1 からGAS実装を開始する。

## このフェーズの目的

Google Sheetsにすべてのシートを作成し、ヘッダー・入力規則・保護設定を整える。
また、SheetService.gs の基本関数を実装して動作確認する。

## 作業前に必ず読むファイル

1. `CONTEXT.md` — プロジェクト背景・重要ルール
2. `AI_RULES.md` — AIが守るべきルール
3. `sheets/SHEET_SCHEMA.md` — シート構成・列定義（最重要）
4. `sheets/INITIAL_SETTINGS.md` — スプレッドシート初期設定手順
5. `gas-project/Config.gs` — 定数定義

## Phase 1 のタスク

### スプレッドシート作成・設定

- Google Sheetsの新規スプレッドシートを作成する
- SHEET_SCHEMA.md に従い全11シートを作成する
- 各シートのヘッダー行を設定する
- 入力規則（ドロップダウン）を設定する
- 1行目を固定する
- シート保護を設定する
- MembershipPlansシートにコースマスタを投入する
- FeeRulesシートに初期データを投入する
- Settingsシートに初期設定を投入する
- KeyCardsシートに全鍵番号を投入する

### GAS実装

- Config.gs：getSpreadsheetId() の実装（ScriptPropertiesから取得）
- SheetService.gs：以下の関数を実装する
  - getSpreadsheet()
  - getSheet(sheetName)
  - getSheetData(sheetName)
  - appendRow(sheetName, rowData)
  - findRowByKey(sheetName, keyColumn, keyValue)
  - updateRowByKey(sheetName, keyColumn, keyValue, updateData)
  - getSetting(settingKey)
  - getHeaders(sheetName)

### 動作確認

- tests/manual-checklist.md の Phase 1 テスト項目を実施する

## 重要な設計方針

- 金額はコードにハードコードしない。getSetting() または getSheetData() で取得する
- スプレッドシートIDはScriptPropertiesに設定し、GitHubには記載しない
- すべての関数には日本語コメントを書く
- エラーハンドリングを省略しない

## 完了条件

- SHEET_SCHEMA.md のシート構造が実際のスプレッドシートと一致している
- SheetService.gsの全関数が動作する
- GASのログ（Logger.log）でデータ読み書きが確認できる
- tests/manual-checklist.md のPhase 1チェック項目が全てOKになっている

## 次のフェーズ

Phase 1 完了後は PHASE_2_INTAKE_FORM_PROMPT.md を使ってPhase 2を開始する。

## 注意事項

- 本番スプレッドシートIDをGitHub（コード内）に書かない
- 個人情報（実際の会員データ）をAIに貼り付けない
- スプレッドシートの列順を変更する場合はSHEET_SCHEMA.mdを先に更新する
