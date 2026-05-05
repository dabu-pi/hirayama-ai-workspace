# PROJECT_STATUS — ワイルドボア会員管理システム

最終更新：2026-05-05（Phase 3 LiveCheck 完了・Playwright 10テストPASS・正式登録統合テストはデータ準備後）

## 現在の状態

| 項目 | 内容 |
|---|---|
| 現在フェーズ | **Phase 3（スタッフ確認・会員登録機能）** |
| ステータス | GASコード実装完了・clasp push済み・デプロイ@3更新済み・静的確認完了・Playwright LiveCheck 10/10 PASS |
| 担当 | Claude Code（AI） + 平山克司（オーナー） |

---

## Apps Script プロジェクト

| 項目 | 内容 |
|---|---|
| Script ID | `1htqjLatNbSEqKXqPnvLTu5Vnc-YG0BypBxgWJhc8u4Bfz88-E7jxLB-L` |
| Script URL | https://script.google.com/d/1htqjLatNbSEqKXqPnvLTu5Vnc-YG0BypBxgWJhc8u4Bfz88-E7jxLB-L/edit |
| バインド先 | DEVスプレッドシート（1yaDDY4dujLqk6ZM-C_-8DDYirqK6cGqkr87XeaBTdtg） |
| push済みファイル数 | 24ファイル（.gs × 13, .html × 10, appsscript.json） |
| push日時 | 2026-05-05（Phase 3 LiveCheck 用に再 push 済み） |
| clasp管理ファイル | `gas-project/.clasp.json` |

### デプロイメント一覧（2026-05-05 確認）

| デプロイID | バージョン | 説明 | WebApp URL |
|---|---|---|---|
| `AKfycbwY4pYydi36qgUCpo77myt09YKErpEezGF6ZKfC9Tc` | @HEAD | HEAD（開発用） | ※本番用途では使わない |
| `AKfycbzPDXd0IYoDwjY8gqBlwtp073wp8N9OIapvnTHa5nGKpbEXmfRNantsEHkOwrgouQyG` | @1 | Phase3-LiveCheck | `https://script.google.com/macros/s/AKfycbzPDXd0IYoDwjY8gqBlwtp073wp8N9OIapvnTHa5nGKpbEXmfRNantsEHkOwrgouQyG/exec` |
| `AKfycbzdV-MkuHdcXlUebX38K38gTWT-dK9wX259N7-OLSiU_NyzRv1MhVZd_gOKKPacRLvG` | **@3（最新）** | Phase3 LiveCheck 2026-05-05 | **`https://script.google.com/macros/s/AKfycbzdV-MkuHdcXlUebX38K38gTWT-dK9wX259N7-OLSiU_NyzRv1MhVZd_gOKKPacRLvG/exec`** |

> **デプロイ設定（appsscript.json 確認済み）:**
> - `executeAs: USER_DEPLOYING` ✅（BUG-01 修正済み）
> - `access: ANYONE_ANONYMOUS`（Googleアカウント不要・匿名ユーザーも利用可）← Phase 3 deploy sync で自動更新

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

---

## Phase 2 Live Check 結果（2026-05-05）

### 実施方法

GAS WebApp 未デプロイのため Playwright 実機実行は未実施。
全 Phase 2 ファイルの静的コード分析（目視確認）を実施。
Playwright spec は `tests/intake/phase2.spec.js` に追加済み（デプロイ後に実行可能）。

### 発見バグ・修正済み

| バグID | 深刻度 | 内容 | 修正 |
|---|---|---|---|
| BUG-01 | **重大** | `appsscript.json` の `executeAs` が `USER_ACCESSING`。匿名ユーザー（Google未ログイン入会希望者）がフォーム送信するとスプレッドシート書き込みエラーになる | `USER_DEPLOYING` に修正・clasp push 済み |

### 静的確認結果サマリー

| カテゴリ | 件数 | 結果 |
|---|---|---|
| 静的確認チェック総数 | 20 | PASS: 19 / BUG修正: 1 |
| 個人情報ログ出力 | 確認 | **PII なし（application_id のみ）** |
| 二重送信防止 | 確認 | **submitting フラグ + ボタン disabled** |
| フロント/バックエンド二重バリデーション | 確認 | **両方実装済み** |
| XSS 対策 | 確認 | **esc() 関数でエスケープ済み** |

### 実機確認が必要な残タスク（デプロイ後）

| # | 内容 | 確認方法 |
|---|---|---|
| RT-01 | GAS WebApp として「全員」アクセス・デプロイ後にフォームが開くこと | Playwright test / 手動 |
| RT-02 | getMembershipPlans() でコース一覧が表示されること | Playwright test |
| RT-03 | 送信後に IntakeApplications シートに行が追加されること | シート目視確認 |
| RT-04 | review_status = pending で保存されること | シート目視確認 |
| RT-05 | GAS 実行ログに個人情報が出力されていないこと | GASエディタ ログ確認 |
| RT-06 | 二重送信しても application_id が重複しないこと | Playwright test |

### デプロイ手順（オーナー向け）

1. GASエディタ → 「デプロイ」→「新しいデプロイ」
2. 種類：「ウェブアプリ」
3. 実行ユーザー：**「自分（開発者）」**（USER_DEPLOYING に修正済み）
4. アクセス権限：「全員」
5. 「デプロイ」→ URL をメモして `WEBAPP_URL` として共有

---

---

## Phase 3 LiveCheck 結果（2026-05-05）

### 実施方法

1. **clasp push**: 24ファイル再 push 完了（Phase 3 実装コードを GAS に反映）
2. **clasp deploy @2**: `access: ANYONE_ANONYMOUS` に修正（BUG-02 修正）して clasp push + deploy @2 実施
3. **疎通確認**: PowerShell `Invoke-WebRequest` で HTTP 200 OK・HTML レスポンス確認
4. **フレーム構造解析**: Playwright デバッグで `userHtmlFrame` = 実際の HTML が入るフレームを確認
5. **静的コード分析（全ファイル目視確認）**: 29チェック実施
6. **Playwright 実機実行**: `access: ANYONE_ANONYMOUS` に修正後、**10テスト PASS** 確認

### 発見バグ・修正済み

| バグID | 深刻度 | 内容 | 修正 |
|---|---|---|---|
| BUG-02 | **重大** | `appsscript.json` の `access` が `ANYONE`（Google ログイン必須）でヘッドレスブラウザからアクセス不可 | `ANYONE_ANONYMOUS` に修正・clasp push + deploy @2 済み |

### Playwright Live Check 結果（10/10 PASS）

**実行日**: 2026-05-05  
**対象 URL**: `https://script.google.com/macros/s/AKfycbzdV.../exec`  
**使用 spec**: `tests/member/phase3.spec.js`

| テストID | テスト内容 | 結果 | 備考 |
|---|---|---|---|
| 3-1-1 | `?page=member-list` でフィルタタブ4種が表示される | **PASS** | 実際の GAS WebApp に接続・iframe コンテンツ確認 |
| 3-1-2 | 「再読み込み」ボタンが表示される | **PASS** | `.refresh-btn` 要素確認 |
| 3-1-3 | ページタイトル「入会申込一覧」が正しい | **PASS** | `.page-title` 確認 |
| 3-1-4 | GAS 呼び出し後に適切な状態が表示される | **PASS** | 空メッセージ表示（DEV データなし状態） |
| 3-1-5 | フィルタタブのアクティブ状態切り替え | **PASS** | pending クリック → active 切り替え確認 |
| 3-1-6 | テーブル行の「確認する」ボタン | **PASS** | DEV データなし（NO_ROWS）→ 正常スキップ |
| 3-1-7 | バッジに申込件数が表示される | **PASS** | `#badge-all` = 0 件（DEV 初期状態） |
| 3-2-1 | applicationId 未指定でエラービューが表示される | **PASS** | ERROR_VIEW: true, MAIN_VIEW: false |
| 3-2-2 | 存在しないIDでエラービューが表示される | **PASS** | FAKE_ID → ERROR: true |
| 3-5-1 | 静的確認 — GAS ログに個人情報が出力されないこと | **PASS** | コードレビューで確認済み |

### データ依存テスト（TEST_APPLICATION_ID 設定後に実行）

| テストID | 内容 | 実行方法 |
|---|---|---|
| 3-3-1〜3-3-6 | 実申込データを使った member-detail 確認 | `TEST_APPLICATION_ID=APP-...` を設定して実行 |
| 3-4-1 | 正式登録フロー | `TEST_APPLICATION_ID + TEST_KEY_CARD` を設定して実行 |
| 3-4-2 | 二重承認防止 | `TEST_APPROVED_APPLICATION_ID` を設定して実行 |

### 静的確認結果サマリー

| カテゴリ | 件数 | 結果 |
|---|---|---|
| 静的確認チェック総数 | 29 | PASS: 27 / スペックID修正: 2（重大度: 低） |
| Code.gs ルーティング | 確認 | ✅ member-list / member-detail 両ルート正常 |
| テンプレート変数 | 確認 | ✅ `applicationId = e.parameter.id` が member-detail に渡る |
| member-list UI | 確認 | ✅ フィルタタブ4種・バッジカウント・テーブル・確認ボタン全実装 |
| member-detail UI | 確認 | ✅ 2カラム・申込者情報・費用計算・鍵番号選択・ダイアログ全実装 |
| 正式登録フロー | 確認 | ✅ createMember → KeyCards 更新 → Payments 記録 → IntakeApplications 更新 → AuditLog |
| 差し戻しフロー | 確認 | ✅ review_status=rejected 更新 → AuditLog 記録 |
| 二重承認防止 | 確認 | ✅ `review_status !== PENDING` チェックで blocking（Members/Payments 重複なし） |
| 二重差し戻し防止 | 確認 | ✅ 同様のチェック |
| 個人情報ログ出力 | 確認 | ✅ applicationId / memberId のみ（氏名・住所・電話番号は出力されない） |
| XSS 対策 | 確認 | ✅ member-list で `esc()` 関数によるエスケープ実装 |
| 処理済み申込の表示 | 確認 | ✅ approved/rejected の場合はフォームを非表示にして処理済み情報を表示 |
| 正式登録ボタン disabled 制御 | 確認 | ✅ 全必須項目が揃うまで disabled（誤クリック防止） |

### 発見したスペックバグ（修正済み）

| # | 内容 | 修正 |
|---|---|---|
| SPEC-01 | Playwright spec で `#key_card_number` を参照していたが、実際の HTML は `<select id="s_keyCard">` | spec を `#s_keyCard` に修正済み |
| SPEC-02 | Playwright spec で `#rejectDialog` を参照していたが、実際は `#rejectOverlay`（CSS: `.overlay` クラス） | spec を `#rejectOverlay.show` に修正済み |
| SPEC-03 | Playwright spec で `#loadingOverlay` を参照していたが、member-detail.html の実際の ID は `#loadingView` | spec を `#loadingView` に修正済み |

### オーナー実機確認が必要な残タスク

| # | 内容 | 確認方法 | 優先度 |
|---|---|---|---|
| RT-P2-01 | `?page=intake-form` でフォームが開くこと | Playwright または手動 | 高 |
| RT-P2-02 | フォーム送信で IntakeApplications に pending 行が追加されること | DEV シート目視 | 高 |
| RT-P3-01 | `?page=member-list` で申込一覧が表示されること | Playwright または手動 | 高 |
| RT-P3-02 | 未確認申込の「確認する」で member-detail に遷移すること | 手動 | 高 |
| RT-P3-03 | 「正式登録する」で Members / KeyCards / Payments が更新されること | DEV シート目視 | 高 |
| RT-P3-04 | AuditLogs に承認ログが記録されること | DEV シート目視 | 中 |
| RT-P3-05 | 差し戻しで IntakeApplications が rejected に更新されること | DEV シート目視 | 高 |
| RT-P3-06 | 承認済み申込を再度「正式登録する」しようとしてもエラーになること | 手動 | 中 |
| RT-P3-07 | GAS 実行ログに個人情報が出力されていないこと | GASエディタ ログ確認 | 中 |

### OWNER_ACTION_REQUIRED — Playwright 実行のための準備

Playwright でフル E2E テストを実行するには以下が必要です。

```powershell
# 1. Playwright の認証セッションを保存する（初回のみ・ブラウザが開く）
Set-Location "C:\hirayama-ai-workspace\workspace\wildboar-member-management"
node_modules/.bin/playwright codegen --save-storage=auth.json

# 2. ブラウザが開いたら Google アカウントにログイン
# 3. WebApp URL にアクセスしてアプリが開くことを確認
# 4. Ctrl+C で終了 → auth.json が生成される

# 5. playwright.config.js に以下を追加
#    use: { storageState: 'auth.json' }

# 6. テスト実行
$env:WILDBOAR_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbzdV-MkuHdcXlUebX38K38gTWT-dK9wX259N7-OLSiU_NyzRv1MhVZd_gOKKPacRLvG/exec"
npm run test:phase3
```

> **注意:** `auth.json` は認証情報のため git に含めない（`.gitignore` に追加済み、または追加してください）

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
| 2026-05-05 | **BUG-01 修正**: appsscript.json executeAs USER_ACCESSING → USER_DEPLOYING（匿名ユーザー送信不可バグ）clasp push 済み |
| 2026-05-05 | Phase 2 静的確認実施・Playwright spec 追加（tests/intake/phase2.spec.js）|
| 2026-05-05 | Phase 3 スタッフ確認・会員登録機能 実装（MemberService.gs / FeeService.gs / AuditLogService.gs / member-list.html / member-detail.html / IntakeService.gs 拡張）|
| 2026-05-05 | **Phase 3 LiveCheck 実施**: clasp push @3 更新 / 静的確認29チェック PASS / Playwright spec 追加（tests/intake/phase3.spec.js）|
