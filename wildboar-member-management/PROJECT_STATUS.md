# PROJECT_STATUS — ワイルドボア会員管理システム

最終更新：2026-05-05

## 現在の状態

| 項目 | 内容 |
|---|---|
| 現在フェーズ | Phase 1（スプレッドシート基盤構築） |
| ステータス | GASコード push 完了・setupSpreadsheet() 実行待ち |
| 担当 | Claude Code（AI） + 平山克司（オーナー） |

---

## Apps Script プロジェクト

| 項目 | 内容 |
|---|---|
| Script ID | `1htqjLatNbSEqKXqPnvLTu5Vnc-YG0BypBxgWJhc8u4Bfz88-E7jxLB-L` |
| Script URL | https://script.google.com/d/1htqjLatNbSEqKXqPnvLTu5Vnc-YG0BypBxgWJhc8u4Bfz88-E7jxLB-L/edit |
| バインド先 | DEVスプレッドシート（1yaDDY4dujLqk6ZM-C_-8DDYirqK6cGqkr87XeaBTdtg） |
| push済みファイル数 | 24ファイル（.gs × 13, .html × 10, appsscript.json） |
| push日時 | 2026-05-05 |
| clasp管理ファイル | `gas-project/.clasp.json` |

### setupSpreadsheet() 実行手順（オーナー作業）

1. DEVスプレッドシートを開く → 「拡張機能」→「Apps Script」
2. 関数選択で「setupSpreadsheet」を選択
3. ▶ 実行 → 権限承認（初回のみ）
4. スプレッドシートに戻り 11シート作成を確認
5. もう一度実行して重複作成されないことを確認（冪等性確認）

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

## Google Drive フォルダ構成

| 項目 | ID / URL |
|---|---|
| 親フォルダ（トレーニングジムワイルドボア） | `1T35j5N2y8TSoVBy84JONZjYlHuf_nR3i` |
| 00_会員管理システム | `10uL1GV6jrbzUVwv1_2kjuHOaYy0RWYbe` |
| 01_本番 | `1Jmi-1rZBKdGxxxDdLXgX2OefNaNHeZU7` |
| 02_開発・テスト | `1PjBdRJnR367X2f8jX6I4kzr7iDNoKbxE` |
| 03_既存データ_参照用 | `1F8YrZKrM-cwT9es_NqhkjPd4k_cTbCTS` |
| 04_口座振替・リコーリース | `18lXWVBXV0AzYZqEZyhCt-27aRM5YT_Bx` |
| 05_帳票・申込控え | `17RaZvGv878PdIihCnOeG7ukL-9uEsgcK` |
| 99_バックアップ | `18b2oC3IerlPzKnQ1IFx3Pddo0IzCGoLV` |

### DEVスプレッドシート（Phase 1 実行対象）

| 項目 | 内容 |
|---|---|
| ファイル名 | トレーニングジムワイルドボア_会員管理システム_DEV |
| スプレッドシートID | `1yaDDY4dujLqk6ZM-C_-8DDYirqK6cGqkr87XeaBTdtg` |
| URL | https://docs.google.com/spreadsheets/d/1yaDDY4dujLqk6ZM-C_-8DDYirqK6cGqkr87XeaBTdtg/edit |
| 保存先 | 02_開発・テスト/ |
| 用途 | setupSpreadsheet() の動作確認用（本番用MASTERではない） |
| 作成日 | 2026-05-05 |

### 既存ファイル（参照用ID）

| ファイル名 | ID |
|---|---|
| 入会者一覧 | `1bz95Vy2FnTxWq1PHvb-cqT5UZpRWkNMQQ_-OXmgG9Qs` |
| 6.価格表(ジム)R4.4.7改訂 | `1jKN0egW32hysLnHnULHQKxao-joICoUfda3blFEcB6A` |
| リコー集金代行（フォルダ） | `1aC6ZbObcx1KXrID2OLd-qD_tg15hBh-D` |

---

## 変更履歴

| 日付 | 変更内容 |
|---|---|
| 2026-05-04 | Phase 0 プロジェクトファイル一式作成 |
| 2026-05-04 | Phase 1 スプレッドシート基盤構築（SetupService.gs実装、ステータス統一） |
| 2026-05-05 | Google Drive フォルダ構成作成・DEVスプレッドシート作成 |
