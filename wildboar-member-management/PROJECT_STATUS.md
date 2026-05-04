# PROJECT_STATUS — ワイルドボア会員管理システム

最終更新：2026-05-04

## 現在の状態

| 項目 | 内容 |
|---|---|
| 現在フェーズ | Phase 1（スプレッドシート基盤構築） |
| ステータス | 完了 |
| 担当 | Claude Code（AI） + 平山克司（オーナー） |

---

## Phase 0 完了タスク（2026-05-04）

- プロジェクトディレクトリ作成（wildboar-member-management/）
- README.md 作成
- ROADMAP.md 作成
- PROJECT_STATUS.md 作成
- CONTEXT.md 作成
- AI_RULES.md 作成
- docs/ 全設計資料作成（14ファイル）
- gas-project/ スタブファイル作成（13ファイル + 10HTMLファイル）
- sheets/ スキーマ・移行計画作成（3ファイル）
- tests/ テスト計画作成（2ファイル）
- prompts/ 引き継ぎプロンプト作成（4ファイル）

---

## Phase 1 完了タスク（2026-05-04）

- `gas-project/SetupService.gs` 新規作成（setupSpreadsheet()他 全セットアップ関数）
- `gas-project/SheetService.gs` 実装（getSheetData, appendRow, findRowByKey, updateRowByKey, getSetting 等）
- `gas-project/Config.gs` 修正（MEMBER_STATUS.PAUSE → PAUSED = 'paused'）
- `sheets/SHEET_SCHEMA.md` 更新（全11シートのヘッダー・入力規則確定）
- `sheets/INITIAL_SETTINGS.md` 更新（セットアップ手順書完成）
- ステータス表記を全ドキュメントで `pause` → `paused` に統一
- StatusHistoryのフィールド名を `status_before` / `status_after` → `previous_status` / `new_status` に統一（Supabase移行準備）
- `docs/DATA_MODEL.md` 更新（フィールド名・ステータス値統一）
- `docs/DATABASE_SCHEMA_WEBAPP.md` 更新（paused統一・フィールド名統一）
- `docs/GAS_TO_SUPABASE_MAPPING.md` 更新（マッピング修正）
- `docs/PAUSE_WITHDRAWAL_RESTART_FLOW.md` 更新（paused統一・フィールド名統一）
- `docs/RICOH_LEASE_EXPORT_DESIGN.md` 更新（paused統一）
- `docs/WEBAPP_MIGRATION_PLAN.md` 更新（paused統一）

---

## 未完了タスク（オーナー作業待ち）

| タスク | 優先度 | 担当 |
|---|---|---|
| 新規スプレッドシート作成 + GASプロジェクト作成 | 高 | オーナー |
| setupSpreadsheet() の実行 | 高 | オーナー |
| MembershipPlansシートの金額を実際の値に更新 | 高 | オーナー |
| Settingsシートの仮値を実際の値に更新 | 高 | オーナー |
| KeyCardsシートに鍵番号を登録 | 中 | オーナー |
| リコーリース提出フォーマットの確認 | 高 | オーナー |

---

## 課題・未解決事項

| 項目 | 内容 | 優先度 |
|---|---|---|
| コース・料金の確定 | MembershipPlansの金額はすべて仮値（0円）。実際の金額をオーナーが記入する必要がある | 高 |
| リコーリース提出フォーマット | 実際の提出書式・必須項目を確認する必要がある | 高 |
| 鍵番号の現在の使用状況 | 何番まで発行済みか、欠番があるかを確認する必要がある | 中 |
| 休会・退会ルール | 休会費の有無・最長休会月数・退会月の請求方法を確認する必要がある | 中 |
| 請求締め日 | 毎月何日締めかを確認する必要がある | 中 |

---

## Phase 2（次フェーズ）の準備チェック

Phase 2（入会フォーム実装）を開始するには以下が完了していること：

- [ ] スプレッドシートが作成されている（手順1〜2完了）
- [ ] setupSpreadsheet() が正常に完了している（手順4完了）
- [ ] MembershipPlansの金額が実際の値に更新されている（手順5完了）
- [ ] GASがWebアプリとしてデプロイされている（手順7完了）

---

## 変更履歴

| 日付 | 変更内容 |
|---|---|
| 2026-05-04 | Phase 0 プロジェクトファイル一式作成 |
| 2026-05-04 | Phase 1 スプレッドシート基盤構築（SetupService.gs実装、ステータス統一） |
