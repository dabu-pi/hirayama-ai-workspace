# PROJECT_STATUS — ワイルドボア会員管理システム

最終更新：2026-05-05

## 現在の状態

| 項目 | 内容 |
|---|---|
| 現在フェーズ | **Phase 2（入会フォーム実装）** |
| ステータス | GASコード実装完了・clasp push済み・Webアプリデプロイ待ち |
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

### setupSpreadsheet() 実行結果（2026-05-05 確認済み）

| 確認項目 | 結果 |
|---|---|
| 対象スプレッドシート認識 | OK |
| 11シート作成 | OK |
| ヘッダー行設定 | OK |
| Settings 初期データ | OK（13件） |
| MembershipPlans 初期データ | OK（6件） |
| FeeRules 初期データ | OK（6件） |
| 入力規則設定 | OK（15箇所） |
| 2回目実行・重複なし（冪等性） | OK（全件スキップ確認済み） |

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

## Phase 1 完了タスク（2026-05-04〜05）

**GASコード実装（Claude Code）:**
- `gas-project/SetupService.gs` 新規作成（setupSpreadsheet()他 全セットアップ関数）
- `gas-project/SheetService.gs` 実装（getSheetData / appendRow / findRowByKey / updateRowByKey / getSetting 等）
- `gas-project/SheetService.gs` バグ修正（getSpreadsheet() を getActiveSpreadsheet() 優先に変更）
- `gas-project/Config.gs` 修正（MEMBER_STATUS.PAUSED = 'paused' に統一）
- `sheets/SHEET_SCHEMA.md` 更新（全11シートのヘッダー・入力規則確定）
- `sheets/INITIAL_SETTINGS.md` 更新（セットアップ手順書完成）
- ステータス表記を全ドキュメントで `pause` → `paused` に統一
- StatusHistoryのフィールド名を `status_before/status_after` → `previous_status/new_status` に統一

**Google Drive・GAS環境構築（Claude Code + オーナー）:**
- Google Drive `00_会員管理システム/` フォルダ構成作成
- DEVスプレッドシート作成（`02_開発・テスト/`）
- clasp でコンテナバインド Apps Script プロジェクト作成
- 24ファイル clasp push

**DEV実行確認（オーナー、2026-05-05）:**
- setupSpreadsheet() 実行 → 11シート・ヘッダー・初期データ全確認
- 2回目実行 → 重複なし（冪等性）確認

---

## 未完了タスク（Phase 2 開始前にオーナーが確認すること）

| タスク | 優先度 | 備考 |
|---|---|---|
| MembershipPlans の金額を実際の値に更新 | 高 | 現在すべて 0円（仮値） |
| Settings の仮値を実際の値に更新 | 高 | card_key_issue_fee / default_join_fee / billing_cutoff_day / pause_max_months |
| KeyCards に鍵番号を登録 | 中 | 何番まで発行済みか確認が必要 |
| リコーリース提出フォーマットの確認 | 高 | Phase 7 実装の前提 |
| GAS を Webアプリとしてデプロイ | 高 | Phase 2 入会フォームの動作確認に必要 |

---

## 課題・未解決事項

| 項目 | 内容 | 優先度 |
|---|---|---|
| コース・料金の確定 | MembershipPlansの金額はすべて仮値（0円） | 高 |
| リコーリース提出フォーマット | 実際の提出書式・必須項目を未確認 | 高 |
| 鍵番号の現在の使用状況 | 何番まで発行済みか・欠番の有無 | 中 |
| 休会・退会ルール | 休会費の有無・最長休会月数・退会月の請求方法 | 中 |
| 請求締め日 | 毎月何日締めか | 中 |

---

## Phase 2 実装済み内容（2026-05-05）

| ファイル | 実装内容 |
|---|---|
| `gas-project/IntakeService.gs` | `getMembershipPlans()` / `generateApplicationId()` / `saveIntakeApplication()` 実装 |
| `gas-project/ValidationService.gs` | `validateIntakeForm()` 全バリデーション実装 |
| `gas-project/html/intake-form.html` | 5ステップ入会フォーム + 確認画面 + 完了画面（1ファイル完結） |

**intake-form.html 実装内容:**
- Step 1: 基本情報（氏名・フリガナ・生年月日・性別・職業）
- Step 2: 住所（郵便番号自動検索 / zipcloud API 使用）
- Step 3: 連絡先（携帯・自宅・メール）
- Step 4: 緊急連絡先（氏名・続柄・電話番号）
- Step 5: コース選択（MembershipPlansから動的取得）+ プライバシー同意
- 確認画面: 全入力内容の一覧表示
- 完了画面: 受付番号表示
- sessionStorage によるステップ間データ保持
- フロントエンド + バックエンド二重バリデーション
- 二重送信防止（submitting フラグ + ボタン disabled）
- 個人情報をログに出力しない設計

**採番ロジック（generateApplicationId）:**
- フォーマット: `APP-YYYYMMDD-XXXX`（当日連番・4桁ゼロ埋め）
- 既存IDを参照して重複を防ぐ

## Phase 2（入会フォーム実装）開始条件

| 条件 | 状態 |
|---|---|
| DEVスプレッドシートで 11シート作成確認済み | ✅ 完了（2026-05-05） |
| setupSpreadsheet() 冪等性確認済み | ✅ 完了（2026-05-05） |
| フォーム・バックエンドコード実装 | ✅ 完了（2026-05-05） |
| GAS を Webアプリとしてデプロイ | ⏸ オーナー作業待ち |
| MembershipPlans 金額確定 | ⏸ 仮値のままでも動作確認は可能 |

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
| 2026-05-05 | clasp コンテナバインド作成・24ファイル push |
| 2026-05-05 | SheetService.gs バグ修正（getActiveSpreadsheet() 優先化） |
| 2026-05-05 | **Phase 1 DEV実行確認完了**（setupSpreadsheet() 全項目PASS・冪等性確認済み） |
| 2026-05-05 | Phase 2 入会フォーム実装（IntakeService.gs / ValidationService.gs / intake-form.html）|
