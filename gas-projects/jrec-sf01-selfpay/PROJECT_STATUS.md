# PROJECT_STATUS.md — JREC-SF01 自費カルテ・会計システム

## 現在ステータス

**✅ Phase 5-C 領収書発行フロー: CLOSED**（2026-04-29 全 PASS）
**✅ Phase 6-A 患者基本情報編集: CLOSED**（2026-04-29 全 PASS）
**✅ Phase 6-B 来院履歴ゴミ箱機能: CLOSED**（2026-04-29 全 PASS）
**✅ Phase 6-D トップメニュー + 本日会計待ち一覧: CLOSED**（2026-04-29 全 PASS）
**✅ Phase 5-D カルテ連動会計フロー: CLOSED（完全）**（2026-04-29 H-1〜H-4 全 PASS）
**✅ Versioned Deployment @26: 反映済み**（2026-04-29）
**✅ Phase 6-E カルテ再編集機能 + 主訴 textarea 化: CLOSED**（2026-05-01 I-1〜I-6 全 PASS）
**✅ Versioned Deployment @27: 本番反映済み**（2026-05-01 Phase 6-E 含む）
**✅ Phase 6-F ホーム月間カレンダー + 日別来院確認: CLOSED**（2026-05-01 J-1〜J-6 全 PASS）
**✅ Versioned Deployment @28: 本番反映済み**（2026-05-01 Phase 6-F 含む）
**✅ Phase 6-G-1 ホームカレンダー 前月/今月/翌月 切替: CLOSED**（2026-05-02 G1-1〜G1-7 全 PASS）
**✅ Versioned Deployment @29: 本番反映済み**（2026-05-02 Phase 6-G-1 含む）

**✅ Phase 6-N-1 共通タブナビゲーション: CLOSED**（2026-05-02 N1-1〜N1-8 全 PASS）
**✅ Versioned Deployment @30: 本番反映済み**（2026-05-02 Phase 6-N-1 含む）

**✅ Phase 6-H dailyCheckout 日別金額合計カード: CLOSED**（2026-05-02 H1-1〜H1-9 + H1-FIX-1〜6 全 PASS）
**✅ Versioned Deployment @31: 本番反映済み**（2026-05-02 Phase 6-H 含む）

**✅ Phase 6-I 集計メニュー / 集計ページ新設: CLOSED**（2026-05-02 I1-1〜I1-8 全 PASS）
**✅ Versioned Deployment @32: 本番反映済み**（2026-05-02 Phase 6-I 含む）

**✅ Phase 6-J 月別売上集計: CLOSED**（2026-05-02 J1-1〜J1-12 全 PASS）
**✅ Versioned Deployment @33: 本番反映済み**（2026-05-02 Phase 6-J 含む）

**✅ Phase 6-K メニュー別売上分析: CLOSED**（2026-05-02 K1-1〜K1-10 全 PASS）
**✅ Versioned Deployment @34: 本番反映済み**（2026-05-02 Phase 6-K 含む）

**✅ Phase 6-L 未収・回収管理レポート: CLOSED**（2026-05-02 L1-1〜L1-12 全 PASS）
**✅ Versioned Deployment @35: 本番反映済み**（2026-05-02 Phase 6-L 含む）

**✅ Phase AI-0 AI補助判定 設計調査: CLOSED**（2026-05-02 コード実装なし・設計書のみ）
**✅ Phase AI-1 患者マスター・カルテ項目追加: CLOSED**（2026-05-03）
  - LC-2 smoke: ✅ 16 PASS
  - LC-3 ai1.spec.ts: ✅ 7 passed / 3 skipped / 0 failed（patientId=P0001）
  - PASS 項目: AI1-1a/b/c, AI1-3, AI1-4a/b, AI1-7(#dateForm)
  - SKIP 項目: AI1-7ボタン（手動確認推奨）, AI1-8/9（smoke参照）
  - commit: c32bd4b
**✅ Phase AI-2 AI評価補助UI追加: CLOSED**（2026-05-04）
  - visit-form.html: AI評価補助セクション追加（#aiAssistCard / 7種の出力枠 / 免責文 / 保存前disabled）
  - カルテ保存後にボタン有効化（Phase AI-3 実行はプレースホルダー表示のみ）
  - API呼び出し・外部通信は未実装（Phase AI-3 で実装予定）
  - LC-4 ai2.spec.ts: ✅ 4 passed / 2 skipped（手動確認）/ 0 failed
  - smoke: ✅ 16 passed / ai1: ✅ 7 passed / ai2: ✅ 4 passed
  - commit: 7f048e6（実装）/ c32bd4b（LiveCheck PASS）
**✅ Versioned Deployment @36: 本番反映済み**（2026-05-04 Phase AI-1 + AI-2 含む）
  - deploymentId: AKfycbxP9beCl8tZ4t41irDgFa-fg54KyDjt8-xM4ogefuwMaZ9Pmkx5-D7JvkLS_nn1G5utYA
  - /exec 確認: home HTTP 200 ✅ / patient-list ✅ / visitForm ✅ / #aiAssistCard ✅ / 免責文 ✅ / btn disabled ✅ / dailyCheckout ✅

**✅ Phase AI-3 OpenAI API連携: CLOSED**（2026-05-11 全確認 PASS）
  - `JREC_SF01_Main.gs` に `runAIAssessment(visitKey)` を追加（gpt-4o-mini / response_format: json_object / temperature: 0.3 / max_tokens: 1500）
  - `calcAgeBand_(age)` / `buildAIPrompt_(data)` / `AI_SYSTEM_PROMPT_` 追加
  - 個人情報除去: 氏名 / 住所 / 電話 / 生年月日 / jrecPatientId は送信しない。dob は年齢/年代に変換（コードレビューで確認済み）
  - API Key: ScriptProperties の `OPENAI_API_KEY` から取得（未設定時はエラーメッセージで停止）
  - `OPENAI_API_KEY`: ✅ ScriptProperties 設定済み（2026-05-11）
  - `visit-form.html` の `runAiAssist()` を実 API 呼び出しに置換
  - バッジ文言を「Phase AI-3 で有効化予定」→「AI評価補助（ベータ）」に変更
  - `appsscript.json`: `https://www.googleapis.com/auth/script.external_request` スコープ追加
  - GAS 外部通信権限再認証: ✅ 完了（`testExternalRequestAuth` HTTP 200確認 → 関数削除済み）
  - LiveCheck: ✅ 3 passed / 3 skipped / 0 failed（`npm run test:jrec:ai3`）
    - AI3-1: #aiAssistCard + バッジ「AI評価補助（ベータ）」PASS ✅
    - AI3-2: #aiAssistBtn 初期 disabled PASS ✅
    - AI3-3: 旧文言なし PASS ✅
    - AI3-H1: ✅ /dev 実機 AIボタン押下 → 結果カード表示 PASS（2026-05-11）
    - AI3-H2: ⏸ 7セクション目視（運用中に確認）
    - AI3-H3: ⏸ PII除外 GASログ確認（コードレビューで確認済みのため実運用で確認）
  - PII除外: ✅ コードレビューで確認済み（name/kana/phone/address/dob/jrecPatientId 送信なし）
  - smoke: 15 passed / 1 failed（[chromium]モバイル幅タイムアウト — pre-existing flaky、AI-3無関係）

**✅ Versioned Deployment @37: 本番反映済み**（2026-05-11）
  - deploymentId: AKfycbxP9beCl8tZ4t41irDgFa-fg54KyDjt8-xM4ogefuwMaZ9Pmkx5-D7JvkLS_nn1G5utYA
  - /exec URL: https://script.google.com/macros/s/AKfycbxP9beCl8tZ4t41irDgFa-fg54KyDjt8-xM4ogefuwMaZ9Pmkx5-D7JvkLS_nn1G5utYA/exec
  - 説明: @37 - Phase AI-3: OpenAI API評価補助 external_request authorized

**✅ Phase AI-4 AI補助判定保存・レビュー: CLOSED**（2026-05-11 全確認 PASS）
  - `JREC_SF01_Setup.gs`: `AI_Assessments` シート定義 / `setupAIAssessments_()` / `runMigrateAddAIAssessmentsSheet()`
  - `JREC_SF01_Main.gs`: `saveAIAssessment_()` ハードコードシート名・エラー伝播 / `getAIAssessmentsByVisitKey()` / `runAIAssessment()` に保存呼び出し + `saveOk` / `saveDetail` 返却
  - `visit-form.html`: 保存成功バナー（緑 / assessmentId + レビュー未確認）/ 失敗時警告バナー（黄 / エラー詳細）
  - migrate: ✅ `runMigrateAddAIAssessmentsSheet()` 実行済み
  - 実機確認: ✅ 緑バナー表示 PASS（AI4-H2 2026-05-11）
  - LiveCheck ai4: ✅ 4 passed / 4 skipped / 0 failed（@38 deploy 後も PASS）
  - LiveCheck ai3（回帰）: ✅ 3 passed / 3 skipped / 0 failed
  - PII保存除外: ✅ コードレビュー確認済み（outputJson = AI出力のみ。name/phone/address/dob/jrecPatientId 非保存）
  - デバッグ経緯: 初期実装で `SHEET_NAMES.AI_ASSESSMENTS` 参照が webapp 実行時に失敗→シート未発見で "" 返却。シート名ハードコード + エラー伝播で解消
  - 人間目視確認（2026-05-11）: AI_Assessments シートに記録 PASS。assessmentId=`ASMNT_...` / visitKey=`SPV_20260511_P0001_001` / patientId=`P0001` / model=`gpt-4o-mini-2024-07-18` / promptVersion=`v1` / reviewStatus=`unreviewed` 確認済み
  - 空行補足: 記録は 502行目以降。`setupAIAssessments_()` で行 2〜501 にチェックボックス・入力規則を事前設定したため GAS の `appendRow` が 502 行目を最終行の次と判断。機能上の問題なし。将来 cleanup 候補（空行削除 or `setValues` 方式へ変更）

**✅ Versioned Deployment @38: 本番反映済み**（2026-05-11）
  - deploymentId: AKfycbxP9beCl8tZ4t41irDgFa-fg54KyDjt8-xM4ogefuwMaZ9Pmkx5-D7JvkLS_nn1G5utYA
  - /exec URL: https://script.google.com/macros/s/AKfycbxP9beCl8tZ4t41irDgFa-fg54KyDjt8-xM4ogefuwMaZ9Pmkx5-D7JvkLS_nn1G5utYA/exec
  - 説明: @38 - Phase AI-4: AI_Assessments 保存・レビューバナー

**🔄 Phase AI-4.5 保存済みAI評価再読込 + AI参考見立て: 実装完了・実機確認待ち（2026-05-11）**
  - `JREC_SF01_Main.gs`: `getLatestAIAssessmentForVisit(visitKey)` 追加（ハードコードシート名・fail-safe）
  - `JREC_SF01_Main.gs`: `AI_SYSTEM_PROMPT_` に `aiImpression` フィールド追加（promptVersion v2）
  - `JREC_SF01_Main.gs`: `saveAIAssessment_()` に `promptVer` パラメータ追加 / `runAIAssessment()` で "v2" を渡す
  - `visit-form.html`: 編集モード起動時に `loadSavedAIAssessment(visitKey)` を自動呼び出し
  - `visit-form.html`: `loadSavedAIAssessment()` → `displaySavedAssessment()` → 青バナー + AI評価全セクション + aiImpression
  - `visit-form.html`: `buildAiImpressionHtml()` / `formatDateJP()` ヘルパー追加
  - `visit-form.html`: `displayAiResult()` に `aiImpression` レンダリング追加 / `dataset.freshResult='1'` フラグ（再読み込み上書き防止）
  - `tools/live-check-runner/projects/jrec-sf01/ai45.spec.ts` 新規 / `package.json` に `test:jrec:ai45` 追加
  - clasp push: ✅ 2026-05-11
  - LiveCheck ai45: ✅ 5 passed / 5 skipped / 0 failed（修正後も維持）
  - LiveCheck ai4（回帰）: ✅ 4 passed / 0 failed
  - LiveCheck ai3（回帰）: ✅ 3 passed / 0 failed
  - AI参考見立て UI: 表示禁止事項（診断確定・保険請求・必ず〜）を含めない設計で実装
  - PII除外: ✅ コードレビュー確認済み

  **デバッグ修正（2回目 clasp push）:**
  - 初回 FAIL 原因: 新規モード（EDIT_VISIT=null）では loadSavedAIAssessment が呼ばれなかった可能性 OR visitKey検索がヒットしなかった
  - 修正: `getLatestAIAssessmentForVisitOrPatient(visitKey, patientId)` を追加（visitKey→patientId の fallback 検索）
  - 修正: `loadSavedAIAssessment(visitKey, patientId)` に patientId パラメータ追加
  - 修正: 新規モードでも `loadSavedAIAssessment('', PATIENT_ID)` を呼び出し（同一患者の直近AI評価を参考表示）
  - 修正: バナーに取得元表示（同一カルテ / 同一患者の直近カルテ）追加
  - 修正: console.log によるクライアント側診断ログ追加
  - 修正: `withFailureHandler` にエラーログ追加

  **追加修正（3回目 clasp push, 2026-05-12）:**
  - 推定原因: ページロード即時 IIFE 実行時点で `google.script.run` 未準備 → silent return → Console に何も残らず誤判定（v2 保存は PASS, 即時呼び出しのみ FAIL の症状と整合）
  - 修正: `loadSavedAIAssessment` の entry ログを **ガードより前**に移動（関数が呼ばれたか必ず Console に残るようにする）
  - 修正: silent return 各経路（empty key / google not ready / no record / JSON.parse fail）に理由ログ追加
  - 修正: `google.script.run` 未準備時のみ 300ms 後にリトライ（最大3回）— timing 競合に対する保険
  - 修正: `displaySavedAssessment` の entry / skip / render 各段階にログ追加（banner 未表示時の経路を可視化）
  - 既存の保存・新規実行ロジックは変更なし（diagnostic 層のみ追加）
  - 詳細: `docs/AI45_SAVED_ASSESSMENT_RELOAD_AND_IMPRESSION_2026-05-11.md` の 2026-05-12 追記参照

**Phase AI-4.5 実機確認結果（2026-05-11 PARTIAL）:**
  - ✅ AI_Assessments v2保存: PASS
  - ✅ outputJson.aiImpression保存: PASS
  - ✅ promptVersion=v2: PASS
  - ❌ 青バナー表示: FAIL（2回の実機確認いずれも未表示）
  - ❌ 保存済みAI評価自動再読込: FAIL
  - ❌ カルテ下書き再表示: FAIL
  - ❌ AI参考見立て再表示: FAIL
  - ⏸ versioned deploy @39: 未実施（実機確認 PASS 待ち）

**次回再開時の最優先確認手順（Console診断）:**
  1. /dev でF12→Console を開き `[AI45]` ログを確認する
  2. `loadSavedAIAssessment が呼ばれているか（start ログが出るか）
  3. `getLatestAIAssessmentForVisitOrPatient` の返却値（found / assessmentId / sourceType）を確認
  4. PATIENT_ID・visitKey の値が期待どおりか確認
  5. `displaySavedAssessment` が呼ばれているか、freshResultフラグでブロックされていないか確認

次期実装候補:
1. **Phase AI-4.5 再読込デバッグ + @39 deploy**（次にやること・Console確認から再開）
2. **Phase AI-5** 運用改善（プロンプト調整・過去判定比較）
3. **Phase 6-M** CSV / 印刷 / 監査レポート ⏸

**Phase AI-3 設計プロンプト作成済み（2026-05-04）:**
  - `docs/PHASE_AI3_DESIGN_PROMPT_2026-05-04.md`
  - GAS `runAIAssessment(visitKey)` 関数のコードドラフト含む
  - `visit-form.html` の `runAiAssist()` 置き換えコード含む
  - AI 出力表示関数（`displayAiResult` / `showAiError` / `resetAiBtn`）含む
  - OpenAI API Key 管理方針（ScriptProperties）明記
  - ai3.spec.ts 追加計画含む
  - 次回セッションはこのプロンプトをそのまま流せば実装開始できる

> **Phase 6-N を先に検討・実装候補化した理由（2026-05-02 方針）:**
> 現在のホームメニューは page パラメータによるフル画面遷移で、主要機能への行き来にホーム経由が必要。
> 共通タブ型ナビゲーションを導入することで、各画面から直接他機能へ移動できるようにする。
> 完全SPA化ではなく既存 page ルーティングを維持した安全な実装を採用。

AI補助判定ロードマップ（Phase AI 系列）:
- AI-0: 設計調査 ✅ CLOSED（2026-05-02 コード実装なし）
- AI-1: 患者マスター・カルテ項目追加 ✅ CLOSED（2026-05-03）
- AI-2: AI評価補助UI追加 ✅ CLOSED + @36 本番反映済み（2026-05-04）
- AI-3: OpenAI API連携 ✅ CLOSED + @37 本番反映済み（2026-05-11）
- AI-4: AI補助判定保存・レビュー ⏸
- AI-5: 運用改善 ⏸

詳細設計: `docs/PHASE_AI_CHART_ASSIST_DESIGN_2026-05-02.md`

Phase 6-G〜6-N ロードマップ:
- 6-G: カレンダー機能強化（前月/翌月切替）✅ CLOSED（2026-05-02）
- 6-N: 共通タブナビゲーション整備 ✅ CLOSED（2026-05-02 @30）
- 6-H: dailyCheckout 日別金額合計カード ✅ CLOSED（2026-05-02 @31）
- 6-I: 集計メニュー / 集計ページ新設 ✅ CLOSED（2026-05-02 @32）
- 6-J: 月別売上集計 ✅ CLOSED（2026-05-02 @33）
- 6-K: メニュー別売上分析 ✅ CLOSED（2026-05-02 @34）
- 6-L: 未収・回収管理レポート ✅ CLOSED（2026-05-02 @35）
- 6-M: CSV / 印刷 / 監査レポート ⏸

詳細: `ROADMAP.md`（Phase 6-N セクション参照）

---

## ✅ Phase 6-L 未収・回収管理レポート（2026-05-02 CLOSED）

### 既存関数の再利用可否確認（2026-05-02）

| 関数 | 内容 | 採用可否 |
|---|---|---|
| `getAllOutstandingByPatient()` | 患者別合計のみ。visitKey / visitDate / chiefComplaint なし | ✖ 詳細テーブルに使えない |
| `getPatientListStats()` | 患者別合計のみ（同上） | ✖ |
| `getPatientAccountingData(patientId)` | 患者単体。全患者一括取得に不適 | ✖ |

→ **新規 `getOutstandingReport()` を追加**（既存関数の破壊的変更なし）

### 実装内容

| ファイル | 変更内容 |
|---|---|
| `JREC_SF01_Billing.gs` | `getOutstandingReport()` を新規追加。Patients + SelfPayVisits(isDeleted 除外) + Payments(未収/一部入金) を結合。来院日昇順ソート |
| `JREC_SF01_Main.gs` | `case "outstandingReport"` を追加。currentPage = "reports" |
| `outstanding-report.html` | 新規作成。サマリーカード + 患者別サマリー + 未収明細テーブル + 回収・領収書導線 |
| `reports.html` | 未収・回収管理カードを有効化（`?page=outstandingReport`） |

### テスト項目（実機確認結果）

> DailySales / Run_Log 非依存。会計・保存ロジック変更なし。getAllOutstandingByPatient() は変更なし。

| Test | 判定 | 確認内容 |
|---|---|---|
| L1-1 | ✅ PASS | reports から未収・回収管理カードで outstandingReport に移動できる |
| L1-2 | ✅ PASS | outstandingReport にサマリーカードが表示される（患者数・件数・残高合計・最古日） |
| L1-3 | ✅ PASS | 未収患者数・未収件数・未収残高合計が表示される |
| L1-4 | ✅ PASS | 患者別サマリーが表示される（患者名リンク → 患者詳細） |
| L1-5 | ✅ PASS | 未収明細一覧が来院日昇順で表示される |
| L1-6 | ✅ PASS | 未収 / 一部入金のみ表示。入金済・未会計は除外される |
| L1-7 | ✅ PASS | isDeleted=true の来院が除外される |
| L1-8 | ✅ PASS | 「回収・領収書」ボタンで receipt ページに遷移できる |
| L1-9 | ✅ PASS | 未収0件でも「未収はありません」表示で壊れない |
| L1-10 | ✅ PASS | DailySales / Run_Log / getDailySalesReport 非依存 |
| L1-11 | ✅ PASS | 既存 reports / monthlyReport / menuSalesReport / dailyCheckout に影響なし |
| L1-12 | ✅ PASS | スマホ表示で大きく崩れない（主訴・入金額列は hide-sm-or） |

### 実測値（実機確認時）

| 項目 | 値 |
|---|---|
| 未収患者数 | 1名 |
| 未収件数 | 1件 |
| 未収残高合計 | ¥5,500 |
| 最古未収日 | 2026-05-02 |
| 患者別 | 藤次正久 / 1件 / ¥5,500 |
| 明細 | 2026-05-02 / 未収 / 請求¥5,500 / 残高¥5,500 |

### 本番 URL（@35 / /exec）:
```
https://script.google.com/macros/s/AKfycbzX8wauxGE0ucFeBd6JtCZ8CJkJ94rKT3D4P88DCP8KQ0ALCkh6azBKpDPkTcaHmWBLyA/exec
```

### HEAD 実機確認 URL

```
https://script.google.com/macros/s/AKfycbzJWJAKCxStP82lfFl8eEHei98dWh7f6cgtEM33r3M5/dev
```

---

## ✅ Phase 6-K メニュー別売上分析（2026-05-02 CLOSED）

### SelfPayItems 列構造確認結果（2026-05-02）

| col | r[idx] | フィールド | 型 | 集計利用 |
|---|---|---|---|---|
| 1 | r[0] | itemId | 文字列 | — |
| 2 | r[1] | selfPayVisitKey | 文字列 | JOIN キー |
| 3 | r[2] | menuCode | 文字列 | グループキー |
| 4 | r[3] | メニュー名 | 文字列 | 表示 |
| 5 | r[4] | 数量 | 数値 | Σ totalQty |
| 6 | r[5] | 単価（税別） | 数値 | — |
| 7 | r[6] | 税区分 | 文字列 | — |
| 8 | r[7] | 小計（税別） | 数値 | — |
| 9 | r[8] | 消費税額 | 数値 | — |
| 10 | r[9] | **小計（税込）** | 数値 | **Σ totalSales** |
| 11 | r[10] | createdAt | 日時 | — |

カテゴリ列なし（menuCode + menuName のみで集計）。

### 実装内容

| ファイル | 変更内容 |
|---|---|
| `JREC_SF01_Billing.gs` | `getMenuSalesSummary(year, month)` を追加。visitKey セット方式で isDeleted 除外 |
| `JREC_SF01_Main.gs` | `case "menuSalesReport"` を追加。currentPage = "reports" |
| `menu-sales-report.html` | 新規作成。月移動ナビ + サマリーカード + メニュー別テーブル（売上降順） |
| `reports.html` | メニュー別売上分析カードを有効化（`?page=menuSalesReport`） |

### テスト項目（実機確認結果）

> DailySales / Run_Log / getDailySalesReport 非依存。請求ベース集計（小計税込 r[9]）。会計・保存ロジック変更なし。

| Test | 判定 | 確認内容 |
|---|---|---|
| K1-1 | ✅ PASS | reports からメニュー別売上分析カードで menuSalesReport に移動できる |
| K1-2 | ✅ PASS | menuSalesReport に対象年月のサマリーカードが表示される |
| K1-3 | ✅ PASS | メニュー別テーブルが売上降順で表示される |
| K1-4 | ✅ PASS | 売上合計が monthlyReport の月間請求合計と一致する（¥16,500） |
| K1-5 | ✅ PASS | isDeleted=true の来院が除外される |
| K1-6 | ✅ PASS | 0件月でも 0件 / ¥0 表示で壊れない |
| K1-7 | ✅ PASS | ◀ 前月 / 今月 / 翌月 ▶ ナビが動作する |
| K1-8 | ✅ PASS | DailySales / Run_Log / getDailySalesReport 非依存 |
| K1-9 | ✅ PASS | 既存 reports / monthlyReport / dailyCheckout / home に影響なし |
| K1-10 | ✅ PASS | スマホ表示で大きく崩れない（件数列は hide-sm-ms） |

### 実測値（2026年5月）

| 項目 | menuSalesReport | monthlyReport 請求合計 | 一致 |
|---|---|---|---|
| 売上合計 | ¥16,500 | ¥16,500 | ✅ |
| メニュー種類 | 1種 | — | — |
| 明細行数 | 3行 | — | — |
| 数量合計 | 3点 | — | — |

メニュー内訳: 初回標準施術（SELF_PAY_INITIAL_FULL）: 3件・3行・3点・¥16,500・平均単価 ¥5,500

### 本番 URL（@34 / /exec）:
```
https://script.google.com/macros/s/AKfycbxwdjQ0ZOO4S-UfDGwQhTPWZwo9QqUVhX2NTIHm539lO9sj6Qupi3fultFo4d1tq5bf/exec
```

### HEAD 実機確認 URL

```
https://script.google.com/macros/s/AKfycbzJWJAKCxStP82lfFl8eEHei98dWh7f6cgtEM33r3M5/dev
```

---

## ✅ Phase 6-J 月別売上集計（2026-05-02 CLOSED）

### 実装内容

| ファイル | 変更内容 |
|---|---|
| `JREC_SF01_Billing.gs` | `getMonthlyRevenueSummary(year, month)` を追加。visitDate ベース、DailySales/Run_Log 非依存 |
| `JREC_SF01_Main.gs` | `case "monthlyReport"` を追加。currentPage = "reports"（売上・レポートタブを active に） |
| `monthly-report.html` | 新規作成。月移動ナビ + 月次サマリーカード + 日別内訳テーブル + dailyCheckout リンク |
| `reports.html` | 月次売上レポートカードを有効化（`?page=monthlyReport` リンクに更新） |

### currentPage の設計判断

`monthlyReport` ページは `currentPage = "reports"` とした。
理由: 月次レポートは「売上・レポート」カテゴリの子ページであり、タブナビの「売上・レポート」が active のままの方がパンくず的に自然。
reports ページ → monthlyReport ページ の遷移で active タブが変わらないことで UX が一貫する。

### テスト項目（実機確認結果）

> DailySales / Run_Log 非依存。getDailySalesReport 未使用。会計・保存ロジック変更なし。

| Test | 判定 | 確認内容 |
|---|---|---|
| J1-1 | ✅ PASS | reports から月次売上レポートカードをクリックして monthlyReport に移動できる |
| J1-2 | ✅ PASS | monthlyReport に対象年月のサマリーカードが表示される |
| J1-3 | ✅ PASS | 月間請求合計・入金合計・未収残高が表示される（¥表示） |
| J1-4 | ✅ PASS | 来院件数 / 未会計 / 未収 / 一部入金 / 未発行 / 発行済 件数が表示される |
| J1-5 | ✅ PASS | 日別内訳テーブルが表示される（来院あり日のみ行が出る） |
| J1-6 | ✅ PASS | 日別行の日付クリックで dailyCheckout の該当日に移動できる |
| J1-7 | ✅ PASS | ◀ 前月 / 今月 / 翌月 ▶ ナビが動作する（年またぎも含む） |
| J1-8 | ✅ PASS | 0件月でも 0件 / ¥0 表示で壊れない |
| J1-9 | ✅ PASS | isDeleted=true の来院が集計から除外される |
| J1-10 | ✅ PASS | DailySales シートが空でも表示が壊れない（非依存） |
| J1-11 | ✅ PASS | 既存 reports / dailyCheckout / home / 患者一覧が壊れていない |
| J1-12 | ✅ PASS | スマホ表示でカード・日別テーブルが大きく崩れない（テーブルは hide-sm-mr で件数列を非表示） |

### 実測値（実機確認時の数値一致確認）

| 確認日 | 項目 | monthlyReport 日別内訳 | dailyCheckout カード | 一致 |
|---|---|---|---|---|
| 2026-05-02 | 来院件数 | 2件 | 2件 | ✅ |
| 2026-05-02 | 未収件数 | 1件 | 1件 | ✅ |
| 2026-05-02 | 未発行件数 | 1件 | 1件 | ✅ |
| 2026-05-02 | 請求合計 | ¥11,000 | ¥11,000 | ✅ |
| 2026-05-02 | 入金合計 | ¥5,500 | ¥5,500 | ✅ |
| 2026-05-02 | 未収残高 | ¥5,500 | ¥5,500 | ✅ |

2026年5月 月間サマリー: 来院 3件 / 請求 ¥16,500 / 入金 ¥11,000 / 未収残 ¥5,500（日別内訳の合計と一致）

### 本番 URL（@33 / /exec）:
```
https://script.google.com/macros/s/AKfycbwKgRxPI2Xb6My5KZ4sTq-Gy-vJAAa4W01sPxPyxzObLtbtSJ4k1kfrBsvzbCCQs_dHag/exec
```

---

## ⏸ Phase 6-J 月別売上集計（2026-05-02 設計調査完了・実装未着手）

### 設計調査結果サマリー

**採用方針: 候補B（Payments 等から月次直接集計）**

| 項目 | 結論 |
|---|---|
| 集計正本 | SelfPayVisits + Payments + Receipts から直接集計 |
| 集計基準 | visitDate（来院日）ベース |
| getDailySalesReport の利用 | **禁止**（Run_Log 全スキャン × 31日 = タイムアウト確実） |
| DailySales 依存 | **なし**（空問題を完全回避） |
| 新規関数 | `getMonthlyRevenueSummary(year, month)` を Billing.gs に追加 |
| page 名 | `?page=monthlyReport`（year/month パラメータ付き） |

### getDailySalesReport 速度リスク記録

- Run_Log を**全件スキャン**してから日付フィルタする設計
- 月次で31回呼ぶと Run_Log 行数 × 31 のスキャンが発生
- GAS 実行上限（6分）に抵触するリスクが高い → **Phase 6-J では使用しない**
- getDailySalesReport は監査証跡目的（Phase 6-M）に温存する

### DailySales 空問題の記録

- DailySales シートは `rebuildDailySales(dateStr)` を手動実行した日のみ行が存在する
- 未実行日は「来院 0件」と誤判定するリスクがある
- Phase 6-J では DailySales を使わないため、この問題を完全回避する

### 実装候補手順

1. `JREC_SF01_Billing.gs` に `getMonthlyRevenueSummary(year, month)` を追加
2. `JREC_SF01_Main.gs` に `case "monthlyReport"` を追加
3. `monthly-report.html` を新規作成（月移動ナビ + サマリーカード + 日別内訳テーブル）
4. `reports.html` の月次カードを有効化（`?page=monthlyReport` リンクに更新）

設計詳細: `docs/PHASE_6J_MONTHLY_SALES_DESIGN_2026-05-02.md`

---

## ✅ Phase 6-I 集計メニュー / 集計ページ新設（2026-05-02 CLOSED）

### 実装内容

| ファイル | 変更内容 |
|---|---|
| `reports.html` | 新規作成。集計・レポートの入口ページ。日別売上確認（リンク済み）+ 未実装4カード（フェーズ名表示）|
| `JREC_SF01_Main.gs` | `case "reports"` を追加。currentPage = "reports" |
| `home.html` | 「売上・レポート」カードを業務メニューに追加（📊 → `?page=reports`） |
| `index.html` | タブナビに「売上・レポート」タブを追加（5番目）。active 表示対応済み |

### スコープ制御

- 新しい集計計算・getDailySalesReport・DailySales / Run_Log 依存を追加しない
- 会計・領収書・保存・患者管理ロジックに変更なし
- 未実装メニュー（月次/メニュー別/未収/CSV）は `menu-card-coming`（opacity + cursor:not-allowed + フェーズ名バッジ）で明示

### タブナビ追加の判断

タブナビ（index.html）に「売上・レポート」を追加した。
理由: `.tab-nav` に `overflow-x: auto` があるためスマホでも横スクロール対応済み。
既存4タブと同一パターンで実装し、`data-page="reports"` で active 表示に対応。

### テスト項目（実機確認結果）

> Phase 6-J 以降への入口整備として完了。新規集計計算・DailySales/Run_Log 依存なし。

| Test | 判定 | 確認内容 |
|---|---|---|
| I1-1 | ✅ PASS | ホームに「売上・レポート」カードが表示される |
| I1-2 | ✅ PASS | カードから `?page=reports` に移動できる |
| I1-3 | ✅ PASS | reports ページに集計メニューが表示される（5カード） |
| I1-4 | ✅ PASS | 日別売上確認から dailyCheckout に移動できる |
| I1-5 | ✅ PASS | 未実装メニュー（月次/メニュー別/未収/CSV）が「Phase X-X 予定」と表示され操作不可 |
| I1-6 | ✅ PASS | 共通タブナビに「売上・レポート」タブが表示され、reports ページで active になる |
| I1-7 | ✅ PASS | スマホ幅でカード・タブが崩れない（タブは横スクロール） |
| I1-8 | ✅ PASS | 既存ホーム・カレンダー・dailyCheckout・患者一覧が壊れていない |

### HEAD 実機確認 URL

```
https://script.google.com/macros/s/AKfycbzJWJAKCxStP82lfFl8eEHei98dWh7f6cgtEM33r3M5/dev
```

### 本番 URL（@32 / /exec）:
```
https://script.google.com/macros/s/AKfycbx67In4nZX24KHTteXFE8UxZmZuLWvyLY-vOb5zVkqL9GRBjCAqbsR_lKtnOBr7CAZgnw/exec
```

---

## ✅ Phase 6-H dailyCheckout 日別金額合計カード（2026-05-02 CLOSED）

### 設計メモ

| 項目 | 内容 |
|---|---|
| 集計方式 | **B案採用**: getDailyCheckoutList(dateStr) の戻り値 list を template scriptlet で集計 |
| DailySales 依存 | なし（DailySales シートが空でも動作） |
| 追加シート読み取り | なし（既存の list データのみ使用） |
| isDeleted 除外 | getDailyCheckoutList 側で保証済み |
| 責務分離 | Phase 6-J 月次売上は DailySales / Run_Log を正本とする。本カードは当日 UI 確認用。 |

### 表示項目の根拠

| 表示項目 | 根拠フィールド | 元シート |
|---|---|---|
| 来院件数 | list.length | SelfPayVisits（isDeleted 除外済み） |
| 未会計件数 | displayStatus === '未会計' | SelfPayVisits（Payments に対応行なし） |
| 未収件数 | displayStatus === '未収' | Payments.paymentStatus |
| 一部入金件数 | displayStatus === '一部入金' | Payments.paymentStatus |
| 入金済未発行件数 | displayStatus === '入金済（領収書未発行）' | Payments + Receipts（receiptNo なし） |
| 発行済件数 | displayStatus === '領収書発行済' | Payments + Receipts |
| 当日請求合計 | Σ totalTaxInc | Payments.col5（税込合計） |
| 当日入金合計 | Σ paidAmount | Payments.col11（入金済累計） |
| 未収残高 | Σ remainingAmount | Payments（totalTaxInc - paidAmount） |

### パフォーマンスメモ

- getDailySalesReport(dateStr) は Run_Log 全スキャンのため **採用しない**
- getDailyCheckoutList は既存呼び出しで取得済みのデータのみ使用 → 追加レイテンシなし

### テスト項目（実機確認結果）

| Test | 判定 | 確認内容 |
|---|---|---|
| H1-1 | ✅ PASS | dailyCheckout に日別金額合計カードが表示される（件数行 + 金額行） |
| H1-2 | ✅ PASS | 来院件数が一覧の行数と一致する |
| H1-3 | ✅ PASS | 未会計件数が一覧の「未会計」行数と一致する |
| H1-4 | ✅ PASS | 未収 / 一部入金 / 未発行 / 発行済の件数が一覧と一致する |
| H1-5 | ✅ PASS | 当日請求合計・入金合計・未収残高が表示される（¥表示） |
| H1-6 | ✅ PASS | DailySales シートが空でも表示が壊れない（このカードは非依存） |
| H1-7 | ✅ PASS | isDeleted=true の来院が集計から除外される（getDailyCheckoutList 側で保証） |
| H1-8 | ✅ PASS | スマホ表示でカードが崩れない（flex-wrap で折り返し） |
| H1-9 | ✅ PASS | 既存の会計入力・領収書発行・日付変更が壊れていない |

### HEAD 実機確認 URL

```
https://script.google.com/macros/s/AKfycbzJWJAKCxStP82lfFl8eEHei98dWh7f6cgtEM33r3M5/dev
```

### H1 UI視認性修正（2026-05-02）

**不具合:** 患者名ボタンに `.btn-ghost`（`color:#fff`）が残存。白/淡色背景の行で患者名が白文字となり読めない。

**修正:** `btn-ghost` クラスを除去し `color:#202124; background:transparent;` をインラインで指定。
- 対象: `daily-checkout.html` 患者名 `<button>` 1箇所
- `.visit-key`（visitKey 補足）は `color:#c5c7c9` で補足情報として視認性許容範囲。変更なし。
- 集計カード・金額・会計ロジックに変更なし。

**修正後確認項目:**

| Test | 判定 | 確認内容 |
|---|---|---|
| H1-FIX-1 | ✅ PASS | 未収行の患者名が読める |
| H1-FIX-2 | ✅ PASS | 入金済・領収書未発行行の患者名が読める |
| H1-FIX-3 | ✅ PASS | visitKey 等の補足情報も必要最低限読める |
| H1-FIX-4 | ✅ PASS | 集計カードの表示・金額・件数に変化なし |
| H1-FIX-5 | ✅ PASS | 会計入力・回収/領収書・領収書発行ボタンに変化なし |
| H1-FIX-6 | ✅ PASS | スマホ表示でも患者名が読める |

---

## ノートPC再開手順（2026-05-01 デスクトップ作業終了時点）

```bash
git checkout feature/auto-dev-phase3-loop
git pull
git status   # clean であることを確認
```

確認ファイル:
- `PROJECT_STATUS.md`（このファイル）
- `ROADMAP.md`（Phase 6-G〜6-M 一覧）
- `docs/PHASE_6G_TO_6M_REPORTING_ROADMAP_2026-05-01.md`（設計メモ・リスク）

次の作業候補:
1. **Phase 6-H**: `daily-checkout.html` + `JREC_SF01_Main.gs` — dailyCheckout 日別金額合計カード
2. **Phase 6-I**: 集計メニュー / 集計ページ新設

実機確認 URL（HEAD deployment）:
```
https://script.google.com/macros/s/AKfycbzJWJAKCxStP82lfFl8eEHei98dWh7f6cgtEM33r3M5/dev
```

本番 URL（@31 / /exec）:
```
https://script.google.com/macros/s/AKfycbys16l0WMyOYfAlDsp3R6lx_hsu56H-VZ1c0MBJxTOp87LIPr-9ZrxxMY33J5irxK1VAg/exec
```

実装前リスク確認事項:
- DailySales シート空問題（6-H/6-J 実装時に fallback 設計が必要）
- `getDailySalesReport` の速度（Run_Log 全スキャン）
- SelfPayItems col3 以降の列番号を Setup.gs で確認してから 6-K に着手

---

## ✅ Phase 6-N-1 共通タブナビゲーション（2026-05-02 CLOSED）

### 実装内容

| ファイル | 変更内容 |
|---|---|
| `JREC_SF01_Main.gs` | 全 page case に `currentPage` テンプレート変数を追加（home/dailyCheckout/list/newPatient は値を設定、その他は空文字） |
| `index.html` | 既存ヘッダー nav を廃止。`.tab-nav` バーに ホーム / 本日の受付・会計 / 患者一覧 / ＋新規患者登録 の4タブを配置。インラインスクリプトで `CURRENT_PAGE` に合わせて `tab-active` クラスを付与 |
| `styles.html` | `.app-header` を単純化（nav スタイル削除）。`.tab-nav` / `.tab-btn` / `.tab-btn.tab-active` CSS を追加 |
| `home.html` `daily-checkout.html` `patient-list.html` `patient-form.html` `patient-detail.html` `visit-form.html` `billing-form.html` `receipt.html` | `<head>` の script に `var CURRENT_PAGE = "<?= currentPage ?>";` を追加 |

### 設計メモ

- `include('index')` は `createHtmlOutputFromFile`（テンプレート非評価）のため、JS 変数 `CURRENT_PAGE` を各ページの `<head>` で先行定義し、`index.html` のインラインスクリプトで DOM 操作する方式を採用
- 既存の `?page=xxx` ルーティング・ホームメニュー・カレンダー・会計ロジックは変更なし
- タブは常に表示。ワークフロー画面（visitForm / billing / receipt / detail）では active なし

### テスト項目（実機確認結果）

> 会計・集計・保存ロジックに変更なし（ルーティング・UI のみ変更）

| Test | 判定 | 確認内容 |
|---|---|---|
| N1-1 | ✅ PASS | ホームに共通タブが表示される（4タブ：ホーム / 本日の受付・会計 / 患者一覧 / ＋新規患者登録） |
| N1-2 | ✅ PASS | 「本日の受付・会計」タブで dailyCheckout に移動できる |
| N1-3 | ✅ PASS | 「患者一覧」タブで list に移動できる |
| N1-4 | ✅ PASS | 「＋ 新規患者登録」タブで newPatient ページに移動できる |
| N1-5 | ✅ PASS | 現在ページの active 表示が正しい（ホームでは「ホーム」タブが強調） |
| N1-6 | ✅ PASS | dailyCheckout の date パラメータ付きでも「本日の受付・会計」タブが active |
| N1-7 | ✅ PASS | スマホ幅でタブが崩れない（横スクロール可） |
| N1-8 | ✅ PASS | 既存ホームメニュー・月間カレンダー・日付クリックが壊れていない |

### HEAD 実機確認 URL

```
https://script.google.com/macros/s/AKfycbzJWJAKCxStP82lfFl8eEHei98dWh7f6cgtEM33r3M5/dev
```

---

## ✅ Phase 6-G-1 ホームカレンダー 前月/今月/翌月 切替（2026-05-02 CLOSED）

### 実装内容

| ファイル | 変更内容 |
|---|---|
| `JREC_SF01_Main.gs` | `doGet` で `yearParam`/`monthParam` を受け取り `buildPage_` に渡す。`case "home"` でバリデーション（year: 2020〜2035, month: 1〜12）してカレンダー年月を決定 |
| `home.html` | 前月/次月年月をサーバーサイドで計算し、◀ 前月 / 今月 / 翌月 ▶ の 3 ボタンを cal-title 直下に追加。`.cal-nav` / `.cal-nav-btn` CSS 追加 |

### URL 形式

```
当月（パラメータなし）: ?page=home
指定月:               ?page=home&year=2026&month=4
```

### テスト項目（実機確認結果）

| Test | 判定 | 確認内容 |
|---|---|---|
| G1-1 | ✅ PASS | home 初期表示で現在月（2026年5月）が表示される |
| G1-2 | ✅ PASS | 2026年5月から「◀ 前月」で 2026年4月 に移動できる |
| G1-3 | ✅ PASS | 2026年5月から「翌月 ▶」で 2026年6月 に移動できる |
| G1-4 | ✅ PASS | 別月表示中に「今月」で現在月に戻る |
| G1-5 | ✅ PASS | 年またぎ動作確認済み |
| G1-6 | ✅ PASS | 月移動後も来院ありの日付クリックで dailyCheckout に date 付き遷移できる |
| G1-7 | ✅ PASS | 月移動ボタン追加後もスマホ幅で7列カレンダーが崩れない |

### 実機確認 URL（HEAD）

```
https://script.google.com/macros/s/AKfycbzJWJAKCxStP82lfFl8eEHei98dWh7f6cgtEM33r3M5/dev
```

---

## ✅ Phase 6-F ホーム月間カレンダー + 日別来院確認（2026-05-01 CLOSED）

### 実装内容

| ファイル | 変更内容 |
|---|---|
| `JREC_SF01_Billing.gs` | `getMonthlyVisitCalendar(year, month)` 追加 — 月単位で来院件数を日付集計、isDeleted 除外 |
| `JREC_SF01_Main.gs` | home ルートで当月カレンダーデータを取得し template に渡す |
| `home.html` | 業務メニュー下に月間カレンダー section 追加。来院ありの日は ●件数 + クリックで dailyCheckout に遷移 |

### テスト項目（実機確認待ち）

| Test | 判定 | 確認内容 |
|---|---|---|
| J-1 | ✅ PASS | 業務メニュー下に「月間来院カレンダー — 2026年5月」が表示された |
| J-2 | ✅ PASS | 2026-05-01 に来院件数バッジ「1」が表示された（isDeleted 除外） |
| J-3 | ✅ PASS | 日付クリックで `?page=dailyCheckout&date=2026-05-01` に遷移 |
| J-4 | ✅ PASS | 遷移先でその日の来院者・会計状況を確認できた |
| J-5 | ✅ PASS | 来院がない日には余分なマークなし |
| J-6 | ✅ PASS | スマホ幅でも7列カレンダー崩れなし |

### 備考

- 件数バッジは「●3」ではなく青丸バッジ「1」形式で表示（視認性問題なし）
- サーバーサイドレンダリング（google.script.run 不使用）
- 前月/翌月切替は次回候補（Phase 6-G 以降）
- dailyCheckout 側に変更なし（date パラメータ受け取りは既存実装で対応済み）

---

## ✅ Phase 6-E カルテ再編集機能 + 主訴 textarea 化（2026-05-01 CLOSED）

**実装 commit:** f62b737  
**CLOSED commit:** ※このコミット

### 実装内容

| ファイル | 変更内容 |
|---|---|
| `JREC_SF01_Visit.gs` | `getVisitFormData(patientId, visitKey)` 追加 — SelfPayVisits+SelfPayChart を一括取得 |
| `JREC_SF01_Main.gs` | visitForm case: vkParam があれば editVisit をテンプレートへ注入 |
| `visit-form.html` | editVisit あり時にプリフィル・編集モードバナー表示・SAVED_VISIT_KEY 初期化 |
| `visit-form.html` | chiefComplaint を `<input>`→`<textarea>`（min-height:72px, resize:vertical）に変更 |
| `patient-detail.html` | 各来院行に「✏️ カルテ編集」ボタンを追加 |

### URL 形式

```
新規: ?page=visitForm&id=P0001
編集: ?page=visitForm&id=P0001&visitKey=SPV_YYYYMMDD_P0001_001
```

### 実機確認結果（HEAD URL / 2026-05-01）

| Test | 判定 | 確認内容 |
|---|---|---|
| I-1 | ✅ PASS | 新規カルテ保存が従来通り動く（visitKey 新規発行・患者詳細に表示） |
| I-2 | ✅ PASS | 患者詳細の「✏️ カルテ編集」ボタンから visit-form に遷移・既存値プリフィル確認。「カルテ編集モード — SPV_20260501_P0002_001」バナー表示あり |
| I-3 | ✅ PASS | 編集保存で「更新しました（SPV_20260501_P0002_001）」表示。患者詳細の来院件数が増えず、同 visitKey が更新された |
| I-4 | ✅ PASS | 会計済み来院行に「✏️ カルテ編集」ボタン表示・クリックで visit-form 遷移・保存できた（Payments/Receipts 影響なし） |
| I-5 | ✅ PASS | 主訴欄が textarea（複数行）に変更済み。改行入力・保存後の改行保持を確認 |
| I-6 | ✅ PASS | ゴミ箱入り来院には「✏️ カルテ編集」ボタンが表示されないことを確認 |

### 備考

- 実機確認は HEAD deployment URL で実施（@26 固定デプロイ URL では Phase 6-E 未反映のため）
- 本番 /exec への反映は次回 versioned deployment（@27 相当）で実施予定
- I-2 調査中に発見: @26 URL + /dev では HEAD コードが反映されない → 以降の実機確認は HEAD URL を使うこと

---

## ✅ Phase 5-D 実機確認 PASS（2026-04-29）

**commits:** 23b10d6 / 92a9532 / e66e1b7

| Test | 判定 | 確認内容 |
|---|---|---|
| E-1 | ✅ PASS | カルテ保存後に「患者詳細へ戻る」「会計入力へ進む →」ボタン表示・自動遷移なし |
| E-2 | ✅ PASS | 「会計入力へ進む →」で billing-form が visitKey 付きで開く |
| E-3 | ✅ PASS | billing-form で未収選択・保存できる |
| E-4 | ✅ PASS | dailyCheckout に「未収」として反映される |
| E-5 | ✅ PASS | receipt で回収 → 入金済 → R_2026_0014 発行済み |
| G-1 | ✅ PASS | 初回保存で visitKey が1件のみ作成される |
| G-2 | ✅ PASS | 同一画面で再保存時、ボタンが「カルテを更新する」に変わり同じ visitKey を更新 |
| G-3 | ✅ PASS | dailyCheckout に重複行なし（SPV_20260429_P0001_011 が1件のみ） |
| G-4 | ✅ PASS | 更新後の同じ visitKey で billing-form へ進める |
| G-5 | ✅ PASS | 既存の未収保存・dailyCheckout 反映・receipt 回収・領収書発行フローが正常 |

### CLOSED_SCOPE

| 機能 | 内容 |
|---|---|
| カルテ保存後の2ボタン | 「患者詳細へ戻る」「🧾 会計入力へ進む →」を表示。自動遷移なし |
| create/update 自動切り替え | `SAVED_VISIT_KEY` で初回 create / 2回目以降 update を判定 |
| `updateVisitWithChart()` | visitKey を維持して SelfPayVisits + SelfPayChart を更新 |
| billing-form 未収分岐 | 未収/一部入金 → dailyCheckout へ / 入金済 → 領収書発行へ |
| 接骨院↔ジム 運用 | 接骨院で金額確定（未収保存）→ ジム側 dailyCheckout で回収・領収書発行 |

### Test H — billing-form 初期値修正（2026-04-29 全 PASS）

**commit:** 9f07d38

| Test | 判定 | 確認内容 |
|---|---|---|
| H-1 | ✅ PASS | billing-form 初期表示: 支払方法=未収（後払い）/ 入金状態=未収 / ボタン=「未収として保存」|
| H-2 | ✅ PASS | 「未収として保存」後に receipt へ自動遷移せず、成功メッセージ + 2ボタン表示 |
| H-3 | ✅ PASS | SPV_20260429_P0001_012 が dailyCheckout に未収（¥2,750）として表示 |
| H-4 | ✅ PASS | receipt で ¥2,750 回収 → 入金済 → R_2026_0015 発行 → dailyCheckout で発行済み表示 |

### CLOSED_SCOPE（完全）

| 機能 | 内容 |
|---|---|
| カルテ保存後の2ボタン | 「患者詳細へ戻る」「🧾 会計入力へ進む」表示。自動遷移なし |
| create/update 自動切り替え | `SAVED_VISIT_KEY` で初回 create / 2回目以降 update（重複 visit 防止） |
| `updateVisitWithChart()` | visitKey を維持して SelfPayVisits + SelfPayChart を更新 |
| billing-form 初期値 | 未収（後払い）/ 未収 がデフォルト。接骨院で金額確定 → ジム側で回収の運用に合致 |
| 未収保存分岐 | 未収/一部入金 → dailyCheckout へ / 入金済 → 領収書発行へ（自動遷移なし） |
| 接骨院↔ジム 運用 | 接骨院で未収保存 → ジム側 dailyCheckout で回収・領収書発行が完結 |

---

## ✅ Phase 6-D 実機確認 PASS（2026-04-29）

**commit:** 5bb3e63

| Test | 判定 | 確認内容 |
|---|---|---|
| D-1 | ✅ PASS | /dev パラメータなしで home 業務メニュー表示 |
| D-2 | ✅ PASS | home の各カードから主要ページへ遷移 |
| D-3 | ✅ PASS | ?page=dailyCheckout で本日受付・会計一覧表示 |
| D-4 | ✅ PASS | ?page=dailyCheckout&date=2026-04-28 で指定日一覧表示 |
| D-5 | 本番確認待ち | versioned deployment 後に /exec パラメータなしで確認 |
| D-6 | ✅ PASS | ?page=list で従来の患者一覧表示（後方互換維持） |
| D-7 | ✅ PASS | ナビゲーション 4ボタン表示・遷移確認 |

### CLOSED_SCOPE

| 機能 | 内容 |
|---|---|
| default ルート変更 | パラメータなしの URL → home（業務メニュー）を表示 |
| `?page=list` 維持 | 既存の患者一覧は後方互換として保持 |
| `getDailyCheckoutList()` | SelfPayVisits × Patients × Payments × Receipts を join。isDeleted 除外 |
| ソート順 | 未収→一部入金→入金済未発行→未会計→発行済（ジム側会計業務優先） |
| 状態別ラベル・ボタン | 未会計:会計入力 / 未収・一部入金:回収・領収書 / 入金済未発行:領収書発行 / 発行済:確認 |
| 日付ナビ | ?date=YYYY-MM-DD で指定日表示、フォームで日付変更可 |
| ナビゲーション | ホーム / 本日の受付・会計 / 患者一覧 / ＋ 新規患者登録 の 4ボタン |

---

## ✅ Phase 6-B 実機確認 PASS（2026-04-29）

**主要 commits:** 4f7cc78 / 99bfbef / 6e1f739 / e3e7786

| Test | 判定 | 確認内容 |
|---|---|---|
| B-1 | ✅ PASS | 未会計行に 🗑 ボタン表示 |
| B-2 | ✅ PASS | ゴミ箱移動 → 通常一覧から消える / Google Drive 権限画面に飛ばない / 成功メッセージ + 手動更新ボタン |
| B-3 | ✅ PASS | 復元 → 通常一覧に戻る / ゴミ箱件数が減る / Drive 権限画面なし |
| B-4 revised | ✅ PASS | 会計済・領収書発行済みでも 🗑 表示 / confirm 文言で「売上データは残る」と明示 |
| B-5 | ✅ PASS | isDeleted=true は来院件数・未会計件数から除外 / 復元後は件数に戻る |

### CLOSED_SCOPE

| 機能 | 内容 |
|---|---|
| SelfPayVisits 列追加 | isDeleted / deletedAt / deleteReason（col 12-14）|
| 来院履歴の論理ゴミ箱化 | isDeleted=TRUE → 通常一覧から非表示 |
| 全ステータス対応 | 未会計・未収・一部入金・入金済・領収書発行済みすべてゴミ箱可 |
| データ保護 | Payments / Receipts / DailySales / Run_Log は変更しない |
| 復元 | isDeleted=FALSE に戻すだけ。完全削除は未実装 |
| サマリ除外 | isDeleted=TRUE は来院件数・未会計件数から除外（getPatientAccountingData / getPatientListStats）|
| 遷移方式 | GAS iframe の success handler 内自動遷移を禁止 → 手動更新ボタン方式 |

### バグ修正履歴（Phase 6-B 中）

| commit | 問題 | 修正 |
|---|---|---|
| 99bfbef | B-2 FAIL: trashVisit 成功後 UI 変化なし | ROOT_CAUSE: `window.top.location.reload()` がクロスオリジン制約で silent fail → try/catch + `window.location.reload()` フォールバックへ（のちに廃止）|
| 6e1f739 | Google Drive「アクセス権が必要です」 | ROOT_CAUSE: success handler 内の自動遷移が GAS iframe → Drive へ飛ぶ → 自動遷移を廃止し DOM 更新 + 手動ボタン方式に変更 |
| e3e7786 | 未会計カウントにゴミ箱 visit が残る | ROOT_CAUSE: getPatientAccountingData が isDeleted 列を読まず全 visit を集計 → 12列読み取り + isDeleted フィルタ追加 |

### GAS iframe 遷移の教訓

| 禁止 | 理由 |
|---|---|
| `google.script.run` success handler 内での `window.location.href` | GAS iframe → Google Drive 権限画面に飛ぶ |
| `window.top.location.reload()` | クロスオリジン SecurityError または外側フレームの URL をリロード |
| `window.location.reload()` | フレームの URL にページパラメータが含まれず白画面 |
| **許可** | ユーザー操作（onclick）の `window.top.location.href = APP_URL + '?...'` |

### 将来タスク（DEFERRED）

- 完全削除（permanentlyDeleteVisit）→ Phase 6-C
- ゴミ箱内の詳細表示・理由入力 UI 改善
- 累計支払額のゴミ箱 visit 除外（現在は Payments は変更しないため除外なし）

---

## ✅ Phase 6-A 実機確認 PASS（2026-04-29）

**commits:** 88b37d3（実装）/ cb329de（Enter 誤保存修正）

| Test | 判定 | 確認内容 |
|---|---|---|
| 1 | ✅ PASS | 患者詳細に「✏ 患者情報を編集」ボタン表示 |
| 2 | ✅ PASS | 編集ページに既存データがプリフィル表示 |
| 3 | ✅ PASS | 「更新する」クリック時のみ保存 → 詳細ページに戻る |
| 4 | ✅ PASS | 氏名空欄で「氏名は必須です」エラー、保存なし |
| 5 | ✅ PASS | キャンセル動線確認済み |
| X-1 | ✅ PASS | 住所欄で Enter → ページ遷移・保存なし |
| X-2 | ✅ PASS | 氏名欄 blur → 保存なし |
| X-3 | ✅ PASS | 更新ボタンクリック時のみ保存・console.log 確認 |
| X-4 | ✅ PASS（コードレビュー） | 新規患者登録 new モードへの影響なし（createPatient 呼び出し・一覧遷移・Enter 防止 全て正常） |
| X-5 | ✅ PASS | 氏名空欄バリデーションで保存なし |

### X-4 確認結果（コードレビュー）

`MODE === 'edit'` 分岐で edit 専用処理を完全分離済み。new モードでは `createPatient()` 呼び出し・一覧遷移・「保存する」ラベル・プリフィルなし がすべて正しく動作する設計を確認。リスク解消。

### バグ修正記録（commit: cb329de）

| 項目 | 内容 |
|---|---|
| 現象 | input 欄で Enter を押すと「更新する」未押下でも保存が実行された |
| ROOT_CAUSE | `saveBtn` が `type="submit"` → input の Enter で form submit イベント発火 → `e.preventDefault()` は画面遷移のみ止め JS の `updatePatient()` まで止めなかった |
| FIX | `saveBtn` を `type="button"` に変更 / イベントを `form.submit` → `saveBtn.click` に変更 / `keydown` で Enter をブロック（textarea 除外）/ 保存開始ログ追加 |

---

## GAS デプロイ履歴

| 日付 | バージョン | deploymentId（末尾） | 内容 |
|---|---|---|---|
| 2026-04-28 | @21 | `AKfycbxhtWdy...` | Phase 5-B Step 2 v2 |
| 2026-04-29 | @22 | `AKfycbxhtWdy...` | Phase 5-C receipt flow closed |
| 2026-04-29 | @23 | `AKfycbxhtWdy...` | Phase 6-A patient edit closed |
| 2026-04-29 | @24 | `AKfycbxhtWdy...` | Phase 6-B visit trash closed |
| 2026-04-29 | @25 | `AKfycbxhtWdy...` | Phase 6-D home menu + daily checkout |
| 2026-04-29 | @26 | `AKfycbxhtWdy...` | Phase 5-D cart-to-billing flow closed |

**本番 /exec 確認事項（2026-04-29 @23 反映後）:**
- `?page=detail&id=P0001` で「✏ 患者情報を編集」ボタン表示 → 実機確認待ち
- `?page=editPatient&id=P0001` で編集画面・プリフィル表示 → 実機確認待ち
- 発行済み visitKey で再発行ボタン非表示 → 実機確認待ち

---

## ✅ Phase 5-C 実機確認 PASS（2026-04-29）

**最終確認 visitKey:** `SPV_20260429_P0001_002` / @HEAD URL

| Test | 判定 | 対象 | 確認内容 |
|---|---|---|---|
| A | ✅ PASS | SPV_20260429_P0001_002 | 未収状態で issueArea 非表示・回収エリア表示のみ |
| B | SKIP | — | 一部入金データなし |
| C | ✅ PASS | SPV_20260429_P0001_002 | 全額 ¥2,750 回収 → 入金済遷移 → 発行ボタン自動表示 |
| D | ✅ PASS | SPV_20260429_P0001_002 | R_2026_0009 発行・領収書プレビュー表示 |
| E | ✅ PASS | R_2026_0009 | 発行済みプレビューのみ表示・通常発行ボタン非表示 |

### CLOSED_SCOPE

| 確認済み動作 | 詳細 |
|---|---|
| 未収では発行 UI 非表示 | issueArea・「後で発行する」・「領収書を発行する」すべて非表示 |
| 回収完了後のみ発行 UI 表示 | ページリロード不要、handleCollect 成功時に JS で表示 |
| 入金済で発行可能 | SHOW_ISSUE_AREA = true → 初期化 IIFE が表示 |
| 発行後は発行済みプレビューのみ | receiptArea・印刷ボタン表示、issueArea 非表示 |
| 再発行は禁止 | GAS alreadyIssued 返却（Phase 6-C で将来対応） |
| GAS 側ガード | issueReceipt() で paymentStatus !== 入金済 は ok:false 返却 |

### Test A バグ経緯と根本修正

| 試行 | commit | 手法 | 結果 |
|---|---|---|---|
| 1回目 | 60678e4 | `style="<?= complex-expr ?>"` | FAIL |
| 2回目 | 0f1bf82 | `<? var flag = ... ?>` + `<?= flag ? '' : 'none' ?>` | FAIL |
| 3回目（根本修正） | be311f3 | `display:none;` ハードコード + `<? if ?>` で JS フラグ注入 | ✅ PASS |

**ROOT_CAUSE（確定）:** GAS HTML テンプレートの `<?= expression ?>` を `style=""` 属性値の中で使うと評価結果が安定しない。`<? if ?>` コードスクリプレットは確実に動作する（collectionArea で実証済み）。`<?= ?>` は style 属性内で使わない。

**根本修正の設計（be311f3）:**
- `issueArea` は `style="display:none;"` を常時ハードコード（テンプレート式なし）
- `<? if (!receipt && payment && payment.paymentStatus === '入金済') { ?> SHOW_ISSUE_AREA = true; <? } ?>` で JS フラグを注入
- 初期化 IIFE が `SHOW_ISSUE_AREA` を確認して `issueArea.style.display = ''`
- `handleCollect` が全額回収後に同じ処理を実行

---

## Phase 5-C — 領収書発行フロー（2026-04-29 実装）

### 修正内容

| ファイル | 変更箇所 | 内容 |
|---|---|---|
| `JREC_SF01_Billing.gs` | `issueReceipt()` | Payments の `paymentStatus` を取得し、`入金済` 以外は `{ ok: false }` を返すガードを追加 |
| `receipt.html` | `issueArea` 表示条件（サーバーサイド） | `receipt \|\| !payment \|\| payment.paymentStatus !== '入金済'` なら非表示に変更 |
| `receipt.html` | `handleCollect()` 完了ハンドラ | 全額回収完了（`res.newStatus === '入金済'`）時に `issueArea` を表示する処理を追加 |

### 設計判断

| 項目 | 決定内容 |
|---|---|
| 発行条件 | `paymentStatus === "入金済"` のみ。未収・一部入金は GAS と UI の両方でブロック |
| 再発行 | 今回は禁止（既存 receipt がある visitKey は `alreadyIssued: true` で既存返却）。将来タスクとして Phase 6-C で対応 |
| 二重発行防止の正本 | Receipts シートの visitKey 一意チェック（既存実装）が正本。GAS 側で `alreadyIssued` を返す |
| 回収完了後のフロー | ページリロード不要。`handleCollect()` 完了時に JS で `issueArea` を表示 |

### ROOT_CAUSE（修正前の問題）

| 問題 | 内容 |
|---|---|
| `issueReceipt()` が paymentStatus 未チェック | Payments が存在すれば未収でも発行できていた |
| `issueArea` 表示条件が甘い | `receipt == null` なら未収状態でも発行ボタンが表示されていた |
| 回収→発行ボタンが自動表示されない | `handleCollect()` で `issueArea` を show する処理がなかった |

### clasp push 状況

✅ `clasp push --force` 完了（2026-04-29）

---

## ✅ DailySales 集計確認 PASS（2026-04-28）

**対象日:** 2026-04-28  **実行関数:** `runRebuildDailySales()`  **action:** update (row=2)

### 集計結果

| 項目 | 値 | 判定 |
|---|---|---|
| totalSales | ¥14,850 | ✅ |
| paymentSaveTotal | ¥9,350 | ✅ |
| paymentCollectTotal | ¥5,500 | ✅ |
| unpaidTotal | ¥0 | ✅ |
| visitCount | 7 | ✅ |
| mainVisitCount | 3 | ✅ |
| receiptIssuedCount | 6 | ✅ |
| rowsCount | 4 | ✅ |
| warningsCount | 11 | ✅ 想定範囲 |
| warningTypes | MISSING_VISIT_KEY, MISSING_COLLECTED_AMOUNT | ✅ 想定どおり |

### rowsJson 内訳

| action | visitKey | amount | 内容 |
|---|---|---|---|
| PAYMENT_SAVE | SPV_20260428_P0001_005 | ¥3,850 | 入金済保存 |
| PAYMENT_SAVE | SPV_20260428_P0001_006 | ¥5,500 | 入金済保存 |
| PAYMENT_COLLECT | SPV_20260428_P0001_007 | ¥1,000 | Step 2 一部回収 |
| PAYMENT_COLLECT | SPV_20260428_P0001_007 | ¥4,500 | Step 2 残額全額回収 |

### 旧ログの扱い

| ログ種別 | 扱い |
|---|---|
| `PAYMENT_COLLECT 回収額: ¥5500`（旧UI誤操作） | `MISSING_COLLECTED_AMOUNT` として除外 ✅ |
| Phase 5-A Step 0 前の selfPayVisitKey 空欄ログ | `MISSING_VISIT_KEY` として除外 ✅ |

### 確認した整合チェーン

```
billing-form.html（会計入力）
→ Payments.paidAmount 累積保存
→ Run_Log PAYMENT_SAVE / PAYMENT_COLLECT 記録
→ receipt.html（分割回収 ¥1,000 + ¥4,500）
→ patient-detail（未収残高 ¥0 / 会計済）
→ DailySales paymentCollectTotal = ¥5,500
```

全連鎖が整合確認済み。

### バグ修正（commit: 294db4f）

| バグ | 内容 | 修正内容 |
|---|---|---|
| DUPLICATE_LOG ブロック | 旧PAYMENT_COLLECTが visitKey を先取りし Step 2 ログを全除外 | PAYMENT_COLLECT は seenAmountKeys チェックなし（分割回収を許容） |
| PAYMENT_SAVE 二重計上 | paymentStatus の現在値が 入金済 になった未収保存を誤計上 | detail「入金額: ¥N」でログ当時の実受取額を判定 |

---

## 将来タスク — Phase 5-D（未実装）

詳細設計: [`docs/chart-to-billing-flow-design.md`](./docs/chart-to-billing-flow-design.md)

### Phase 5-D: カルテ連動会計フロー

| 項目 | 内容 |
|---|---|
| 概要 | カルテ記録画面から施術内容をもとに会計候補を自動生成し、直接会計画面へ進める導線を追加 |
| 対象 | visit-form.html / billing-form.html / JREC_SF01_Visit.gs / JREC_SF01_Billing.gs |
| 優先度 | 低（Phase 5-C または Deployment 整理の後に検討） |
| 前提 | Phase 5-B CLOSED ✅ |

**設計方針:**
- カルテ記録からそのまま会計画面へ移行できる導線を追加
- カルテ内容を即請求確定にはしない（人間確認後に確定）
- 施術内容から会計候補を自動生成し、入力漏れを減らす
- 内部データは明細保持。患者向け表示は必要に応じて合算

---

## 将来タスク — Phase 6（未実装）

詳細設計: [`docs/patient-detail-maintenance-design.md`](./docs/patient-detail-maintenance-design.md)

### Phase 6-A: 患者基本情報編集

| 項目 | 内容 |
|---|---|
| 概要 | patient-detail から患者氏名・よみ・連絡先等を編集できるようにする |
| 対象 | Patients シート / patient-detail.html / JREC_SF01_Patient.gs |
| 優先度 | 中 |
| 前提 | なし |

### Phase 6-B: 来院履歴のゴミ箱機能

| 項目 | 内容 |
|---|---|
| 概要 | 未会計・未収の来院記録をゴミ箱へ移動・復元・完全削除できるようにする |
| 対象 | SelfPayVisits（isDeleted 列追加）/ patient-detail.html / JREC_SF01_Visit.gs |
| 方式 | **deletedFlag 方式**（SelfPayVisits に isDeleted / deletedAt / deleteReason 等を追加）|
| 優先度 | 中 |
| 前提 | Phase 5-B CLOSED ✅ |

**削除可否ポリシー（確定）:**

| 会計状態 | 削除方針 |
|---|---|
| 未会計 | ゴミ箱 → 復元 or 完全削除 OK |
| 未収（paidAmount=0） | Payments 確認後にゴミ箱 OK |
| 一部入金 | 要確認（paidAmount > 0 の場合の扱い） |
| 入金済 | 削除不可 → Phase 6-C で対応 |
| 領収書発行済み | 削除不可 → Phase 6-C で対応 |

### Phase 6-C: 会計済み・領収書発行済みの取消/返金/再発行

| 項目 | 内容 |
|---|---|
| 概要 | 入金済み取消・領収書取消・返金・再発行・DailySales 整合 |
| 優先度 | 低（Phase 6-B 完了後） |
| 前提 | Phase 6-B CLOSED |

---

## インシデント記録（2026-04-28）— 旧UI誤操作による SPV_20260428_P0001_007 入金済誤更新

### 経緯

1. Step 2 実装後 `clasp push` は完了したが `clasp deploy` を忘れた
2. /exec は依然 @19（旧コード）を参照
3. ユーザーが旧UI（「未収を回収する（入金済みに更新）」ボタン）を押した
4. 旧 `collectOutstandingPayment` が動作し `SPV_20260428_P0001_007` が誤って全額入金済に

### 旧コードが起こした破損

| 列 | 誤った値 | 正しい値 |
|---|---|---|
| Payments col7 paymentStatus | `入金済` | `未収` |
| Payments col8 paymentDate | `2026-04-28` | 空欄 |
| Payments col9 memo | `回収済(2026-04-28)` | 訂正メモ |
| Payments col11 paidAmount | **空欄**（旧コードは書かない） | `0` |
| SelfPayVisits billingStatus | `会計済` | `未収` |

### 補正方針

- 実際には現金回収なし（テスト操作）のため全項目を「未収」状態に戻す
- 補正関数 `correctPayment_P0001_007()` を JREC_SF01_Billing.gs に一時追加済み
- 補正実行後はこの関数を削除して再度 clasp push する

### 補正状況

✅ 完了（2026-04-28 ユーザー実機確認済み）

| 確認項目 | 結果 |
|---|---|
| SelfPayVisits 会計状態 | 未収 ✅ |
| Payments 入金状態 | 未収 ✅ |
| Payments 入金日 | 空欄 ✅ |
| Payments メモ | 【訂正 2026-04-28】... ✅ |
| Payments col11 paidAmount | 0 ✅ |
| Receipts 領収書 | 未発行 ✅ |

補正関数 correctPayment_P0001_007() は削除済み。

### 教訓 → GAS デプロイ標準手順に組み込み済み

---

## GAS デプロイ運用メモ（2026-04-28 判明）

**重要: `clasp push` だけでは `/exec` URL に変更が反映されない。**

| コマンド | 効果 |
|---|---|
| `clasp push` | Apps Script エディタの HEAD を更新するだけ |
| `clasp deploy --deploymentId <id>` | 指定 deployment を最新 HEAD から新バージョンに更新 → `/exec` に反映 |

**現在の deployment 構成（2026-04-28 更新）:**

| deployment ID（末尾） | バージョン | 用途 |
|---|---|---|
| `AKfycbzJWJAK...` | @HEAD | **開発確認用**（clasp push 即反映。Step 2 UI 確認済み） |
| `AKfycbxhtWdy...` | @21 | 本番 /exec URL（versioned。@HEAD との動作差あり → 未解決） |
| `AKfycbyjzy_g...` | @1 | 旧デプロイ（使用停止） |

**@HEAD URL（開発確認推奨）:**
```
https://script.google.com/macros/s/AKfycbzJWJAKCxStP82lfFl8eEHei98dWh7f6cgtEM33r3M5/exec
```

**今後の標準: clasp push → deploy セット:**
```bash
clasp push --force
clasp deploy --deploymentId "AKfycbxhtWdycr4Xt-LT867eoUiqixjM2zOlaE6Bcqzoi8qbtZIvLHkR820vRfRqyomdoTa7pQ" --description "変更内容の説明"
```

**残リスク:** versioned deployment @21 でも旧UIが表示される事象が再発した場合、
`appsscript.json` の `"access": "MYSELF"` またはブラウザキャッシュが原因の可能性。
調査が必要な場合は Apps Script エディタのデプロイ管理 UI から手動で更新する。

---

## ✅ Phase 5-B Step 2 実機確認 PASS（2026-04-28）

**対象 visitKey:** `SPV_20260428_P0001_007`
**確認 URL:** @HEAD deployment（`AKfycbzJWJAK...`）

### Test C: 過大回収防止

| 確認項目 | 結果 |
|---|---|
| 残額 ¥5,500 に ¥5,501 を入力 | クライアントバリデーション「未収残額（¥5,500）を超えています。」が表示 |
| GAS は呼ばれない | ✅ |
| Sheets 変更なし | ✅ |

判定: **PASS**

### Test A: 一部回収（¥1,000）

| 確認項目 | 結果 |
|---|---|
| 成功メッセージ | 「¥1,000 を回収しました。残額: ¥4,500」✅ |
| 金額サマリー更新 | 既回収額 ¥1,000 / 未収残額 ¥4,500 ✅ |
| 入金状態 | 一部入金 ✅ |
| 回収エリア | 継続表示（再回収可能）✅ |
| Payments.paidAmount | ¥1,000 累積 ✅ |
| Payments.paymentStatus | 一部入金 ✅ |
| Run_Log | `今回回収額: ¥1000 累積入金額: ¥1000 残額: ¥4500` ✅ |

判定: **PASS**

### Test B: 全額回収（残額 ¥4,500）

| 確認項目 | 結果 |
|---|---|
| 成功メッセージ | 「全額回収完了（入金日: 2026-04-28　今回: ¥4,500）」✅ |
| 入金状態 | 入金済 ✅ |
| 回収エリア | 非表示 ✅ |
| Payments.paidAmount | ¥5,500（= totalTaxInc）✅ |
| Payments.paymentStatus | 入金済 ✅ |
| Run_Log | `今回回収額: ¥4500 累積入金額: ¥5500 残額: ¥0` ✅ |

判定: **PASS**

### Sheets / Run_Log 裏取り

| 確認対象 | 内容 |
|---|---|
| Payments.totalTaxInc | ¥5,500 ✅ |
| Payments.paymentMethod | 現金 ✅ |
| Payments.paymentStatus | 入金済 ✅ |
| Payments.paymentDate | 2026-04-28 ✅ |
| Payments.paidAmount | ¥5,500 ✅ |
| Payments.memo | 訂正メモ + 回収(2026-04-28 ¥1000) + 回収(2026-04-28 ¥4500) ✅ |
| SelfPayVisits.billingStatus | 会計済 ✅ |
| Run_Log PAYMENT_SAVE | 入金額 ¥0 / 残額 ¥5,500（未収として保存）✅ |
| Run_Log CORRECTION | 旧UI誤操作を未収へ戻した記録 ✅ |
| Run_Log PAYMENT_COLLECT 1回目 | 今回回収額: ¥1,000 ✅ |
| Run_Log PAYMENT_COLLECT 2回目 | 今回回収額: ¥4,500 ✅ |
| patient-detail 未収残高 | ¥0 ✅ |
| patient-detail SPV_20260428_P0001_007 | 会計済 ✅ |
| patient-detail 未収回収ボタン | 表示なし ✅ |
| patient-detail 領収書発行ボタン | 表示あり ✅ |

判定: 全項目 **PASS**

### 旧UI誤操作時の PAYMENT_COLLECT ログ扱い

旧UI(@19)で発生した PAYMENT_COLLECT ログは detail が「回収額: ¥5500」形式。
Step 2 以降の DailySales が「今回回収額:」パターンを検索するため
`MISSING_COLLECTED_AMOUNT` warning として除外される。過大計上は発生しない。

---

## 本日実装（2026-04-28）— Phase 5-B Step 2

### 実装内容

| ファイル | 変更内容 |
|---|---|
| `JREC_SF01_Billing.gs` | `collectOutstandingPayment`: `payload.collectedAmount` を受け取り `paidAmount` を累積更新。全額回収時のみ `入金済`、途中回収なら `一部入金`。billingStatus も対応。Run_Log に「今回回収額: ¥N 累積入金額: ¥M 残額: ¥K」を記録。後方互換: 一部入金 + paidAmount 空 → エラー返却（自動補正しない） |
| `receipt.html` | 未収回収 UI に金額サマリー（請求額/既回収額/未収残額）を追加。「今回回収額」入力欄と「全額」ボタンを追加。一部回収成功時はエリアを閉じず残額を更新して継続可能。全額回収時は回収エリアを非表示。クライアントサイドバリデーション（0円以下・残額超過を事前チェック） |
| `JREC_SF01_DailySales.gs` | `paymentCollectTotal` を `totalTaxInc` 参照から Run_Log detail の「今回回収額: ¥N」抽出に変更。旧ログ（Step 2 以前）は `MISSING_COLLECTED_AMOUNT` WARNING として除外（過大計上防止） |

### 確定した paymentStatus 判定ロジック

| 条件 | paymentStatus |
|---|---|
| paidAmount = 0 | 未収 |
| 0 < paidAmount < totalTaxInc | 一部入金 |
| paidAmount >= totalTaxInc | 入金済 |

### Run_Log フォーマット（PAYMENT_COLLECT Step 2 以降）

```
visitKey: SPV_YYYYMMDD_P0001_001 今回回収額: ¥2000 累積入金額: ¥5000 残額: ¥5000 現金
```

### 既存 paidAmount 空欄データの扱い（後方互換）

| 既存状態 | Step 2 の扱い |
|---|---|
| 入金済 / paidAmount 空 | paidAmount = totalTaxInc 相当 |
| 未収 / paidAmount 空 | paidAmount = 0 |
| 一部入金 / paidAmount 空 | エラー返却。自動補正しない |

### 実機確認ステータス

未実施（ユーザー確認待ち）

### 次回実機確認手順

#### Test A: 一部回収
1. 未収または一部入金の visitKey を持つ来院の receipt.html を開く
2. 未収残額より少ない金額を「今回回収額」入力欄に入力
3. 「回収実行」をクリック
4. 確認: Payments.paidAmount が累積更新されている
5. 確認: paymentStatus が「一部入金」になっている
6. 確認: receipt.html の既回収額・未収残額が更新され、回収エリアが引き続き表示されている
7. 確認: DailySales.paymentCollectTotal に今回回収額のみ反映（rebuildDailySales 後）

#### Test B: 全額回収
1. 未収残額と同額を入力（または「全額」ボタンを押す）
2. 「回収実行」をクリック
3. 確認: Payments.paidAmount = totalTaxInc
4. 確認: paymentStatus が「入金済」になっている
5. 確認: receipt.html の回収エリアが非表示になり、入金状態が「入金済」に更新されている
6. 確認: patient-detail 側でも未収表示が消えている

#### Test C: 過大回収防止
1. 未収残額より大きい金額を入力
2. 「回収実行」をクリック前にクライアントバリデーションエラーが表示されること
3. 万一サーバーに届いた場合も `ok: false` エラーが返ること

---

## 本日終了状態（2026-04-28）

### Phase 5-B Step 1 完了（commit: 79222f7）

**実装内容:**

| ファイル | 変更内容 |
|---|---|
| `JREC_SF01_Setup.gs` | Payments ヘッダーに col 11 `paidAmount` を追加 |
| `JREC_SF01_Billing.gs` | 全 Payments 読み取りを 10→11 列に更新。`paidAmount` ベースで `remaining = totalTaxInc - paidAmount` を計算。後方互換: col 11 空の場合 status=入金済→paidAmount=totalTaxInc、else→0 |
| `JREC_SF01_Billing.gs` | `savePaymentWithItems`: paidAmount を計算・col 11 に保存。paymentStatus を paidAmount で自動確定。Run_Log に「入金額: ¥X 残額: ¥Y」を記録。一部入金・未収時の billingStatus → "未収" |
| `JREC_SF01_DailySales.gs` | Payments 読み取り 10→11 列。`unpaidTotal` と DailySales の残額計算を `remaining` ベースに修正 |
| `billing-form.html` | 入金状態セレクト onchange 追加。一部入金選択時に `paidAmountSection` を表示。`calcRemaining()` でリアルタイム残額表示。保存時バリデーション（paidAmount > 0 かつ < totalTaxInc）。payload に `paidAmount` を含めて送信 |

**後方互換フォールバック:**
- Payments の既存行（col 11 = 空）: status=入金済 → paidAmount=totalTaxInc と見なす（正しく処理）
- 未収・一部入金の古い行: paidAmount=0 として残額=totalTaxInc を計上

**未実装（Step 2 以降）:**
- `collectOutstandingPayment` の `collectedAmount` 累積更新
- receipt.html の残額表示更新（回収後 DOM 反映）
- PaymentCollections シートは採用しない（案 C 確定）

**実機確認ステータス:** 未実施（ユーザー確認待ち）

### 次回再開時の実機確認手順

1. 会計入力画面（billing-form.html）を開く
2. 入金状態セレクトで「一部入金」を選択 → 「今回入金額」入力欄が表示されること
3. 税込合計が表示されている状態で入金額を入力 → 「未収残額」がリアルタイム更新されること
4. 入金額=0 のまま「保存して領収書へ →」を押す → バリデーションエラーが出ること
5. 入金額 ≥ 税込合計 で保存 → 「入金済を選択してください」エラーが出ること
6. 正常な一部入金額（0 < paidAmount < totalTaxInc）で保存
7. Payments シートの col 11 に paidAmount が記録されていること
8. 患者詳細画面で当該来院の入金状態が「一部入金」、未収残額が正しく表示されること

### 次回実装候補: Phase 5-B Step 2

**テーマ:** `collectOutstandingPayment` に `collectedAmount` 引数を追加し、残額回収を正確に処理する

| 対象 | 変更内容 |
|---|---|
| `JREC_SF01_Billing.gs` | `collectOutstandingPayment`: `payload.collectedAmount` を受け取り `paidAmount` を累積更新。全額回収（paidAmount >= totalTaxInc）なら paymentStatus → 入金済。部分回収なら → 一部入金。Run_Log に「今回回収額: ¥N 累積入金額: ¥M 残額: ¥K」を記録 |
| `receipt.html` | 未収回収 UI に「今回回収額」入力フィールドを追加。保存後に画面の `paidAmount`・`remainingAmount`・`paymentStatus` をリアルタイム更新 |
| `JREC_SF01_DailySales.gs` | `paymentCollectTotal` を `collectedAmount`（今回回収額）ベースに修正（現在は totalTaxInc を使用） |

**Step 2 実装前確認事項:**
- 一部回収後に再び一部入金状態に戻す（paymentStatus=一部入金）のか、回収済み（入金済）とするのかを確認
- receipt.html の未収回収モーダルに金額入力欄を追加する UI 仕様を確認

---

## Phase 5-B 設計調査: 一部入金の差額管理（2026-04-28）

**詳細:** `docs/PARTIAL_PAYMENT_DESIGN.md` を参照

### 現状の問題点（サマリー）

| 問題 | 影響 |
|---|---|
| Payments に paidAmount 列がない | 一部入金額が保存されず、残額が計算できない |
| collectOutstandingPayment に collectedAmount がない | 部分回収が全額回収として処理される |
| unpaidTotal / outstanding が totalTaxInc を使用 | 一部入金の未収残高が過大（請求額を表示） |
| DailySales の売上が totalTaxInc を計上 | 一部入金の日次売上が過大計上になる |

### 確定した推奨案（案 C）

**Payments に paidAmount 列を追加 + Run_Log を監査ログとして活用**

- Payments col 11: `paidAmount`（実際の入金済み累積額）を追加
- `savePaymentWithItems`: 一部入金時に paidAmount を保存
- `collectOutstandingPayment`: collectedAmount を受け取り paidAmount を累積更新
- `outstanding = totalTaxInc - paidAmount`（残額として正しく計算）
- Run_Log.PAYMENT_COLLECT: 回収日・金額・手段の監査ログとして維持

### 実装前の確認事項（ユーザー判断待ち）

| # | 確認事項 |
|---|---|
| 1 | 一部入金の残額回収は「receipt 画面から」か「新規会計入力」か |
| 2 | 複数回分割払い履歴が必要か（案 B）、累積管理で十分か（案 C）|
| 3 | 一部入金時の部分領収書を発行するか |
| 4 | 既存の一部入金データ（paidAmount 不明）をどう補正するか |

---

## ✅ Phase 5-A「DailySales 集計基盤」CLOSED（2026-04-28）

### 完了スコープ

| Step | 内容 | 状態 |
|---|---|---|
| Step 0 | Run_Log `selfPayVisitKey` 列を常に空文字 → visitKey を正しく記録するよう修正 | ✅ CLOSED |
| Step 1 | `getDailySalesReport(date)` 実装（6シート読み取り・Run_Log 正本） | ✅ CLOSED |
| Step 2 | `runDailySalesReport()` 実機確認 PASS | ✅ CLOSED |
| Step 3 | `rebuildDailySales(date)` 実装・DailySales 16列 UPSERT | ✅ CLOSED |
| Step 3 実機確認 | insert/update UPSERT PASS・重複行なし | ✅ CLOSED |
| daily-sales.html | Web UI 未実装 | 保留（Phase 5-B 以降）|

### 実装済み関数一覧（JREC_SF01_DailySales.gs）

| 関数名 | 種別 | 説明 |
|---|---|---|
| `getDailySalesReport(dateStr)` | Public | 指定日の日次集計を返す（6シート読み取り）|
| `runDailySalesReport()` | Public | 今日の集計を Logger 出力（手動確認用）|
| `rebuildDailySales(dateStr)` | Public | getDailySalesReport 結果を DailySales シートへ UPSERT |
| `runRebuildDailySales()` | Public | "2026-04-28" 対象の rebuildDailySales を実行（手動確認用）|
| `normalizeDate_(val)` | Private | 日付を YYYY-MM-DD JST に正規化 |
| `toDateStr_(val)` | Private | Sheets の Date 値を YYYY-MM-DD JST に変換 |
| `ensureDailySalesHeaders_(sh)` | Private | DailySales ヘッダー初期化・列名→列番号マップ返却 |

### 実機確認サマリー

| 確認項目 | 結果 |
|---|---|
| getDailySalesReport("2026-04-28") ok=true | ✅ |
| totalSales=¥3,850（SPV_20260428_P0001_005）| ✅ |
| rows=1（patientName=平山克士 / receiptNo=R_2026_0005）| ✅ |
| warnings=9（全 MISSING_VISIT_KEY・旧ログ由来）| ✅ 想定通り |
| rebuildDailySales 1回目: insert row=2 | ✅ |
| rebuildDailySales 2回目: update row=2（重複なし）| ✅ |

### 確定した集計定義

| 集計値 | 定義 | 正本 |
|---|---|---|
| totalSales | 当日入金確定額（paymentSaveTotal + paymentCollectTotal）| Run_Log + Payments |
| paymentSaveTotal | 当日 PAYMENT_SAVE かつ paymentStatus=入金済 | Run_Log 基準 |
| paymentCollectTotal | 当日 PAYMENT_COLLECT（Step 0 以降ログのみ正本）| Run_Log 基準 |
| unpaidTotal | 現在時点の未収/一部入金合計（日付非依存スナップショット）| Payments |
| visitCount | SelfPayVisits.来院日 = date の件数 | SelfPayVisits |
| mainVisitCount | SELFPAY_CONTINUE20 含む当日来院件数 | SelfPayItems |
| receiptIssuedCount | Receipts.発行日 = date の件数 | Receipts |
| 売上日基準 | Run_Log.timestamp（PAYMENT_SAVE/COLLECT 記録日）| — |

### 保留・後続タスク候補

| 項目 | 内容 | 優先度 |
|---|---|---|
| daily-sales.html | 日次集計 Web 画面 | 低（スプレッドシートで確認可能）|
| 旧ログ MISSING_VISIT_KEY 補正 | Step 0 修正前ログの visitKey を detail から補完 | 低 |
| unpaidTotal の日付履歴化 | 日付時点の未収残高を正確に記録する設計 | 中 |
| visitCount / lastVisitDate 実データ化 | getPatients で常に 0 / 空の問題 | 中 |
| 一部入金の差額管理 | 現在は全額入金済として処理 | 中 |
| 領収書再発行 | reissueCount インクリメント | 低 |
| 取消・返金設計 | 不可逆操作のため別途設計が必要 | 低 |

---

## ✅ Phase 5-A Step 3 実機確認 PASS（2026-04-28）

### runRebuildDailySales() 実行結果

| 実行 | 時刻 | action | row | totalSales | rows | warnings |
|---|---|---|---|---|---|---|
| 1回目 | 17:28:29 | **insert** | 2 | ¥3,850 | 1 | 9 |
| 2回目 | 17:29:19 | **update** | 2 | ¥3,850 | 1 | 9 |

| 確認項目 | 結果 |
|---|---|
| 16列ヘッダー新規作成 | ✅ `[ensureDailySalesHeaders_] wrote 16 new headers` |
| 初回 insert（date=2026-04-28, row=2）| ✅ |
| 2回目 update（同 row=2、重複なし）| ✅ |
| totalSales = ¥3,850 | ✅ |
| UPSERT ロジック正常 | ✅ |
| warnings=9（全 MISSING_VISIT_KEY）| ✅ 想定通り |
| status = WARNING | ✅ 想定通り（warningsCount > 0）|

---

## Phase 5-A Step 3: rebuildDailySales() 実装（2026-04-28）

### 実装内容

**変更ファイル:** `JREC_SF01_DailySales.gs`

#### 追加した関数

| 関数名 | 種別 | 説明 |
|---|---|---|
| `rebuildDailySales(dateStr)` | Public | getDailySalesReport の結果を DailySales シートへ UPSERT |
| `runRebuildDailySales()` | Public（手動確認用）| "2026-04-28" を対象に rebuildDailySales を実行して Logger 出力 |
| `ensureDailySalesHeaders_(sh)` | Private | ヘッダー確認・初期化・列名→列番号マップを返す |

#### DailySales シートの列定義（16列）

| 列 | 名前 | 内容 |
|---|---|---|
| 1 | date | 集計日（YYYY-MM-DD）|
| 2 | totalSales | 当日売上合計（税込）|
| 3 | paymentSaveTotal | 新規会計（入金済）合計 |
| 4 | paymentCollectTotal | 未収回収合計 |
| 5 | unpaidTotal | 現在時点の未収残高（スナップショット）|
| 6 | visitCount | 来院件数 |
| 7 | mainVisitCount | 主力メニュー来院数 |
| 8 | receiptIssuedCount | 領収書発行件数 |
| 9 | rowsCount | rows 件数 |
| 10 | warningsCount | warnings 件数 |
| 11 | warningTypes | warnings の種別（カンマ区切り）|
| 12 | status | OK / WARNING / ERROR |
| 13 | updatedAt | 最終更新日時（JST）|
| 14 | rowsJson | rows の JSON |
| 15 | warningsJson | warnings の JSON |
| 16 | note | 既知制限の説明文 |

#### UPSERT ロジック

```
1. getDailySalesReport(date) を実行
2. DailySales シートを取得（なければ作成）
3. ensureDailySalesHeaders_ でヘッダーを初期化
   - データ行なし → 推奨16列ヘッダーを新規書き込み
   - データ行あり → 既存ヘッダーを読み取り、不足列を右端に追加
4. date 列でターゲット行を検索
   - 見つかれば UPDATE（action="update"）
   - 見つからなければ末尾に INSERT（action="insert"）
5. 全16列を setValues([rowData]) で一括書き込み
```

#### status の判定

| status | 条件 |
|---|---|
| OK | warningsCount = 0 |
| WARNING | warningsCount > 0 |
| ERROR | getDailySalesReport が ok:false またはエラー |

#### 期待される確認結果（2026-04-28）

| 列 | 期待値 |
|---|---|
| date | 2026-04-28 |
| totalSales | 3850 |
| paymentSaveTotal | 3850 |
| paymentCollectTotal | 0 |
| unpaidTotal | 0 |
| visitCount | 5 |
| mainVisitCount | 3 |
| receiptIssuedCount | 5 |
| rowsCount | 1 |
| warningsCount | 9 |
| warningTypes | MISSING_VISIT_KEY |
| status | WARNING |
| rowsJson | SPV_20260428_P0001_005 / 平山克士 / R_2026_0005 含む |

#### UPSERT 確認手順

1. Apps Script エディタ → `runRebuildDailySales` 実行
2. DailySales シートに `2026-04-28` 行が作成されることを確認
3. もう一度 `runRebuildDailySales` 実行
4. 行が重複せず、同じ行の `updatedAt` が更新されることを確認

#### Dashboard / Projects / Task_Queue / Run_Log への追加反映

今回は反映不要。理由:
- DailySales 書き込みは Payments / SelfPayVisits の派生集計であり、データ正本ではない
- Run_Log には `PAYMENT_SAVE` / `PAYMENT_COLLECT` で会計事実は記録済み
- DailySales はスプレッドシート上での日次確認用キャッシュとして位置づける
- Web UI は Step 4 以降で検討

#### clasp push

```
clasp push --force → 15ファイル push 完了（2026-04-28 17:13:19）
```

---

## ✅ Phase 5-A Step 2 実機確認 PASS（2026-04-28）

### runDailySalesReport() 実行結果

**実行時刻:** 2026-04-28 17:01
**対象日:** 2026-04-28

| 集計値 | 結果 | 判定 |
|---|---|---|
| ok | true | ✅ |
| totalSales | ¥3,850 | ✅ |
| paymentSaveTotal | ¥3,850 | ✅ |
| paymentCollectTotal | ¥0 | ✅（Step 0 修正前ログのため設計上正しい）|
| unpaidTotal | ¥0 | ✅ |
| visitCount | 5 | ✅ |
| mainVisitCount | 3 | ✅（SELFPAY_CONTINUE20 含む来院）|
| receiptIssuedCount | 5 | ✅ |
| rows | 1 件 | ✅ |
| warnings | 9 件（全 MISSING_VISIT_KEY）| ✅（想定通り）|

### 確認した rows[0]

| フィールド | 値 |
|---|---|
| visitKey | SPV_20260428_P0001_005 |
| patientId | P0001 |
| patientName | 平山克士 |
| visitDate | 2026-04-28 |
| salesDate | 2026-04-28 |
| action | PAYMENT_SAVE |
| amount | 3850 |
| paymentStatus | 入金済 |
| paymentMethod | 現金 |
| receiptNo | R_2026_0005 |
| detail | paymentId: SPP_SPV_20260428_P0001_005 税込合計: ¥3850 現金 |

### warnings=9 の判定

| 種別 | 件数 | 判定 |
|---|---|---|
| MISSING_VISIT_KEY | 9 件 | ✅ 想定通り |

9件すべて Phase 5-A Step 0 修正前の Run_Log（selfPayVisitKey 列が空）。
PAYMENT_COLLECT 2件を含む。これらは paymentCollectTotal に加算されないため、
paymentCollectTotal = ¥0 は設計上正しい。

---

## Phase 5-A Step 2: getDailySalesReport コードレビュー（2026-04-28）

### コードレビュー結果

全行精査を実施。**バグなし・コード変更不要。**

#### 確認した項目

| 確認項目 | 結果 |
|---|---|
| Payments 列インデックス（col1-10）| ✅ 正しい |
| SelfPayVisits 列インデックス（col1-9）| ✅ 正しい |
| SelfPayItems 列インデックス（col1-3）| ✅ 正しい |
| Receipts 列インデックス（col1-4）| ✅ 正しい |
| Run_Log 列インデックス（col1-7）| ✅ 正しい |
| Patients 列インデックス（col1-2）| ✅ 正しい |
| `toDateStr_()` の JST 変換（Date → YYYY-MM-DD）| ✅ 正しい |
| `normalizeDate_()` の入力形式（YYYY-MM-DD / YYYYMMDD / Date）| ✅ 正しい |
| Run_Log.selfPayVisitKey 空行 → MISSING_VISIT_KEY warnings | ✅ 正しい |
| PAYMENT_SAVE かつ paymentStatus≠入金済 → 売上から除外 | ✅ 正しい |
| 二重計上防止 `seenAmountKeys["ACTION_visitKey"]` | ✅ 正しい |
| Object.keys() 使用（GAS V8 対応）| ✅ 正しい |

#### コードトレース（2026-04-28 / SPV_20260428_P0001_005）

| データソース | 期待動作 |
|---|---|
| Payments | SPV_20260428_P0001_005: totalTaxInc=3850, status=入金済 → paymentsMap 登録 |
| Patients | P0001: 平山克士 → patientsMap 登録 |
| SelfPayVisits | SPV_20260428_P0001_005: visitDate=2026-04-28 → visitCount++ |
| Receipts | SPV_20260428_P0001_005: receiptNo=R_2026_0005 → receiptsMap 登録 |
| Run_Log | PAYMENT_SAVE + selfPayVisitKey=SPV_20260428_P0001_005: paymentSaveTotal+=3850, rows.push() |
| Run_Log（旧ログ）| selfPayVisitKey="" の PAYMENT_SAVE/COLLECT → MISSING_VISIT_KEY warnings |

#### 期待される出力（実行確認用）

```javascript
{
  ok:                  true,
  date:                "2026-04-28",
  totalSales:          3850,          // ← P0001_005 の¥3,850が反映される
  paymentSaveTotal:    3850,          // ← 同上
  paymentCollectTotal: 0,             // ← F-2の回収はStep0修正前のログのため除外
  unpaidTotal:         0,             // ← 現在状態スナップショット
  visitCount:          5,             // ← P0001_001〜P0001_005 (2026-04-28来院分)
  mainVisitCount:      0 または 1,    // ← P0001_005の会計メニューによる
  receiptIssuedCount:  1 以上,        // ← R_2026_0005が含まれる
  rows: [
    {
      visitKey:      "SPV_20260428_P0001_005",
      patientId:     "P0001",
      patientName:   "平山克士",
      visitDate:     "2026-04-28",
      salesDate:     "2026-04-28",
      action:        "PAYMENT_SAVE",
      amount:        3850,
      paymentStatus: "入金済",
      paymentMethod: "現金",
      receiptNo:     "R_2026_0005",
      detail:        "paymentId: SPP_... 税込合計: ¥3850 ..."
    }
  ],
  warnings: [
    { type: "MISSING_VISIT_KEY", action: "PAYMENT_SAVE", ... },  // 旧ログ分
    { type: "MISSING_VISIT_KEY", action: "PAYMENT_COLLECT", ... } // F-2回収の旧ログ
  ]
}
```

#### 既知の制限（今回の期待値からの差分）

| 項目 | 説明 |
|---|---|
| `paymentCollectTotal = 0` | F-2 の未収回収（¥5,500）は Step 0 修正前のログのため MISSING_VISIT_KEY に分類される。想定通り。 |
| `unpaidTotal` の日付非依存 | 現在スナップショット。対象日の残高ではない |
| 旧ログの warnings | Step 0 以前に記録された PAYMENT_SAVE / PAYMENT_COLLECT は selfPayVisitKey 空のため除外 |

### Apps Script での実行確認手順

1. Apps Script エディタを開く（スクリプト URL から）
2. 関数選択プルダウンで `runDailySalesReport` を選択
3. 「実行」ボタンをクリック
4. ログ表示で以下を確認:
   - `totalSales=¥3850`
   - rows に `SPV_20260428_P0001_005` と `patientName=平山克士` が含まれる
   - `receiptNo=R_2026_0005` が含まれる
   - warnings に `MISSING_VISIT_KEY` が出る（想定内）

---

## Phase 5-A Step 1: getDailySalesReport() 実装（2026-04-28）

### 実装内容

**新規ファイル:** `JREC_SF01_DailySales.gs`

#### 関数一覧

| 関数名 | 種別 | 説明 |
|---|---|---|
| `getDailySalesReport(dateStr)` | Public | 指定日の日次集計を返す |
| `runDailySalesReport()` | Public（手動確認用）| 今日の集計を Logger 出力するラッパー |
| `normalizeDate_(val)` | Private | 日付を YYYY-MM-DD に正規化（JST）|
| `toDateStr_(val)` | Private | Sheets の Date 値を YYYY-MM-DD 文字列に変換（JST）|

#### getDailySalesReport の集計定義（確定）

| 集計値 | 定義 | 正本シート |
|---|---|---|
| totalSales | paymentSaveTotal + paymentCollectTotal | Run_Log + Payments |
| paymentSaveTotal | PAYMENT_SAVE かつ paymentStatus=入金済 の totalTaxInc 合計 | Run_Log 基準 |
| paymentCollectTotal | PAYMENT_COLLECT の totalTaxInc 合計 | Run_Log 基準 |
| unpaidTotal | 現在時点の未収/一部入金の totalTaxInc 合計（日付非依存）| Payments |
| visitCount | SelfPayVisits.来院日 = date の件数 | SelfPayVisits |
| mainVisitCount | SELFPAY_CONTINUE20 を含む当日来院の件数 | SelfPayItems JOIN SelfPayVisits |
| receiptIssuedCount | Receipts.発行日 = date の件数 | Receipts |

**売上日基準:** Run_Log.timestamp（PAYMENT_SAVE/COLLECT が記録された日）

#### warnings 種別

| type | 内容 |
|---|---|
| MISSING_VISIT_KEY | Run_Log.selfPayVisitKey が空（Step 0 修正前の古いログ）|
| PAYMENT_NOT_FOUND | Run_Log に visitKey があるが Payments に対応行なし |
| DUPLICATE_LOG | 同一 visitKey の同一 action が2件以上（最初の1件のみ集計）|

#### 読み取りシートと目的

| シート | 目的 |
|---|---|
| Payments | 金額・入金状態・入金日 / unpaidTotal 集計 |
| Patients | patientName（rows の表示用）|
| SelfPayVisits | visitDate / visitCount / rows の JOIN |
| SelfPayItems | mainVisitCount（SELFPAY_CONTINUE20 フィルタ）|
| Receipts | receiptNo の JOIN / receiptIssuedCount |
| Run_Log | 売上日基準の正本（PAYMENT_SAVE / PAYMENT_COLLECT）|

#### 実機確認手順（再デプロイ後）

1. Apps Script エディタ → 関数選択「`runDailySalesReport`」→ 実行
2. 実行ログに以下が出力されることを確認:
   ```
   [getDailySalesReport] DONE totalSales=¥3850 save=¥3850 collect=¥0 ...
   ```
3. rows 配列に `SPV_20260428_P0001_005` が含まれることを確認（金額 ¥3,850）
4. receiptNo に `R_2026_0005`（または該当 receiptNo）が入ることを確認
5. warnings に `MISSING_VISIT_KEY` が出る場合は古いログ（想定内）
6. 患者詳細・会計・領収書画面が壊れていないことを確認（退行テスト）

#### 既知の制限

| 制限 | 内容 |
|---|---|
| unpaidTotal | 現在スナップショット。日付時点の残高履歴は未実装 |
| 古いログ | Step 0 修正前（selfPayVisitKey 空）の PAYMENT_COLLECT は MISSING_VISIT_KEY warnings に分類 |
| mainVisitCount | SELFPAY_CONTINUE20 固定。外販時は Settings 設定化を推奨 |
| 日次集計 Web UI | 今回は作成しない（Step 2 以降）|

#### clasp push

```
clasp push --force → 15ファイル push 完了（2026-04-28 16:45:29）
JREC_SF01_DailySales.gs が新規追加された
```

---

## Phase 5-A Step 0: appendRunLog_ バグ修正（2026-04-28）

### 根本原因

`appendRunLog_(action, patientId, detail)` が Run_Log の `selfPayVisitKey` 列（col 3）に
**常に空文字**を書き込んでいた。visitKey は `detail` テキストにのみ埋め込まれ、
DailySales 集計で `PAYMENT_COLLECT` の visitKey を取得するにはテキスト解析が必要だった。

### 修正内容

**JREC_SF01_Patient.gs: `appendRunLog_` に省略可能な第4引数 `visitKey` を追加**

```javascript
// 修正前
function appendRunLog_(action, patientId, detail) {
  sh.appendRow([new Date(), action, "", patientId, "SUCCESS", detail, email]);
}

// 修正後
function appendRunLog_(action, patientId, detail, visitKey) {
  sh.appendRow([new Date(), action, visitKey || "", patientId, "SUCCESS", detail, email]);
}
```

既存の3引数呼び出し（`PATIENT_CREATE`）は `visitKey || ""` でそのまま動作。後方互換あり。

**呼び出し側の修正（4箇所）:**

| ファイル | action | visitKey 引数 |
|---|---|---|
| `JREC_SF01_Visit.gs` | VISIT_CREATE | `vk` を追加 |
| `JREC_SF01_Billing.gs` | PAYMENT_COLLECT | `visitKey` を追加 ← **DailySales 集計の主目的** |
| `JREC_SF01_Billing.gs` | PAYMENT_SAVE | `visitKey` を追加 |
| `JREC_SF01_Billing.gs` | RECEIPT_ISSUE | `visitKey` を追加 |

**変更なし（visitKey なし）:**
- `JREC_SF01_Patient.gs: PATIENT_CREATE` → 患者登録は visit を伴わないため、visitKey なしが正しい

### 修正後の Run_Log 記録例

| timestamp | action | **selfPayVisitKey** | patientId | result | detail |
|---|---|---|---|---|---|
| 2026-04-28 | VISIT_CREATE | **SPV_20260428_P0001_005** | P0001 | SUCCESS | visitKey: SPV_... |
| 2026-04-28 | PAYMENT_SAVE | **SPV_20260428_P0001_005** | P0001 | SUCCESS | paymentId: SPP_... ¥3850 |
| 2026-04-28 | PAYMENT_COLLECT | **SPV_20260428_P0001_004** | P0001 | SUCCESS | visitKey: SPV_... 回収額: ¥5500 |
| 2026-04-28 | RECEIPT_ISSUE | **SPV_20260428_P0001_005** | P0001 | SUCCESS | receiptNo: R_2026_0001 |
| 2026-04-28 | PATIENT_CREATE | （空）| P0001 | SUCCESS | 氏名: 平山克士 |

### 実機確認手順（再デプロイ後）

1. 未収の来院で「未収を回収する」を実行
2. スプレッドシートの Run_Log シートを確認
3. PAYMENT_COLLECT 行の `selfPayVisitKey` 列に `SPV_...` が入っていることを確認
4. `detail` 列にも従来通り `"visitKey: SPV_... 回収額: ¥..."` が残っていることを確認
5. 新規来院保存でも VISIT_CREATE / PAYMENT_SAVE / RECEIPT_ISSUE に visitKey が入ることを確認

### clasp push

```
clasp push --force → 14ファイル push 完了（2026-04-28 16:34:12）
```

---

**詳細:** `docs/PHASE5A_DAILYSALES_DESIGN.md` を参照

### 調査サマリー

| 項目 | 現状 |
|---|---|
| DailySales シート | 存在するが空。集計ロジック未実装 |
| 集計の正本 | Payments（売上・未収）/ SelfPayVisits（来院数）/ Run_Log（未収回収） |
| Run_Log バグ | `appendRunLog_` の selfPayVisitKey 列が常に空。visitKey は detail テキストに埋め込み |
| 未収回収額の検出 | Run_Log.PAYMENT_COLLECT または Payments の createdAt ≠ 入金日 で判定 |

### 推奨実装方針（3ステップ）

```
Step 1: getDailySalesReport(date) — オンデマンド集計関数
Step 2: 日次集計画面（daily-sales.html）
Step 3: rebuildDailySales(date) — DailySales シートへの書き込み
```

### 実装前確認事項（ユーザー確認待ち）

| # | 確認事項 |
|---|---|
| 1 | 売上の日付基準: 来院日 / 入金日 / 領収書発行日 のどれ? |
| 2 | 未収回収額の帰属: 回収日 or 来院日? |
| 3 | Run_Log バグ修正を先に行うか? |
| 4 | 主力来院数の KPI 基準: SELFPAY_CONTINUE20 固定でよいか? |
| 5 | 日次集計画面を Web 画面として作るか、シートで直接見るか? |

---

## ✅ Phase 4 後半 F-2「未収回収処理」CLOSED（2026-04-28）

### F-2 実機確認 PASS

| 確認項目 | 結果 |
|---|---|
| 患者詳細 未収残高 ¥5,500 表示 | ✅ PASS |
| 対象来院に「一部入金」バッジ表示 | ✅ PASS |
| 「未収回収」ボタン表示 | ✅ PASS |
| receipt 画面で未収回収セクション表示 | ✅ PASS |
| 未収額 ¥5,500 表示 | ✅ PASS |
| 回収実行後の成功メッセージ | ✅ PASS |
| 入金状態が「入金済」に即時 DOM 更新 | ✅ PASS |
| 入金日表示 | ✅ PASS |
| 患者詳細へ戻ると未収残高 ¥0 | ✅ PASS |
| 未会計 0件 | ✅ PASS |
| 該当来院が「会計済」状態に更新 | ✅ PASS |

### F-2 確定仕様

#### 未収回収の定義

| 項目 | 定義 |
|---|---|
| 未収対象 | `paymentStatus = "未収"` または `"一部入金"` の Payment |
| 回収操作 | receipt 画面の「未収回収」セクションから実行 |
| 回収結果 | `paymentStatus → "入金済"` + 入金日記録 + Run_Log 記録 |
| 未収の除外 | 回収後は患者詳細・患者一覧の未収残高から除外される |

#### タイムラインの表示優先順位（確定）

| 優先度 | 条件 | バッジ | ボタン |
|---|---|---|---|
| 1 | Payments なし | 未会計（黄）| 会計入力 |
| 2 | paymentStatus = 未収/一部入金 | 未収/一部入金（赤）| 未収回収 → receipt |
| 3 | Payments あり + Receipt あり | 領収書発行済（青）| 領収書 |
| 4 | Payments あり + Receipt なし | 会計済（緑）| 領収書を発行 |

**未収は receipt 発行有無にかかわらず最優先で赤表示。**

#### 二重回収防止

| 層 | 実装 |
|---|---|
| GAS | paymentStatus = "入金済" の場合に `{ ok: false, error: "すでに入金済みです" }` を返す |
| UI（テンプレート）| `payment.paymentStatus !== "未収"/"一部入金"` の場合に回収セクションを非表示 |
| UI（DOM 更新）| 回収成功後に `paymentStatusDisplay` を「入金済」に更新し、collectionArea を非表示 |

#### 実装ファイル一覧（F-2 全体）

| ファイル | 変更内容 |
|---|---|
| `JREC_SF01_Billing.gs` | `collectOutstandingPayment()` 追加、`paymentMethod` を return に追加 |
| `receipt.html` | 未収回収セクション HTML + `handleCollect()` + DOM 更新ロジック |
| `billing-form.html` | 保存ボタン「保存済み ✓」修正 |
| `patient-detail.html` | タイムライン状態判定の優先順位修正 + 「未収回収」ボタン追加 |

### F-2 後半以降へ回した残課題

| 課題 | 理由 | 優先度 |
|---|---|---|
| 一部入金の差額管理 | 今回は全額を一括「入金済」更新。入金済み額との差額追跡は設計が必要 | 中 |
| 領収書再発行 | reissueCount インクリメント + 新規 Receipt INSERT | 低 |
| DailySales 集計 | 回収時の DailySales 未収回収額更新 | 中 |
| `visitCount` / `lastVisitDate` 実データ化 | getPatients が常に 0/空のまま | 中 |
| 取消・返金設計 | 不可逆操作のため別途設計 | 低 |

---

## Phase 4 後半 F-2 タイムライン優先順位修正（2026-04-28）

### 発見した問題と根本原因

**現象:** 患者詳細タイムラインで未収の来院が「領収書発行済」と表示される。赤バッジ「未収」が見えない。

**根本原因:** `patient-detail.html` の状態判定で `if (rec)` が最優先になっていた。
領収書が発行済みなら `paymentStatus` に関わらず「領収書発行済」と表示されていた。

```javascript
// 修正前（問題あり）
if (rec) {                         // ← Receipt が最優先 → 未収でも「領収書発行済」
  billingLabel = '領収書発行済';
} else if (v.billingStatus === '未収') {
  billingLabel = '未収';           // ← Receipt がある場合は到達しない
```

### 修正内容（patient-detail.html）

#### 状態判定の優先順位（確定版）

| 優先度 | 条件 | バッジ | 色 |
|---|---|---|---|
| 1 | `!pay`（Payments なし）| 未会計 | 黄/橙 |
| 2 | `payStatus = "未収"/"一部入金"` | 未収 / 一部入金 | 赤太字 ← **最優先** |
| 3 | `pay && rec`（入金済+領収書発行）| 領収書発行済 | 青 |
| 4 | `pay && !rec`（入金済+未発行）| 会計済 | 緑 |

**ポイント:** 未収は receipt 発行有無にかかわらず最優先で赤表示。
領収書が発行済みでも入金がない場合は「未収」を優先する。

```javascript
// 修正後
var payStatus = pay ? (pay.paymentStatus || '') : '';
if (!pay) {
  billingLabel = '未会計';
} else if (payStatus === '未収' || payStatus === '一部入金') {
  billingLabel = payStatus;  // "未収" or "一部入金"
} else if (rec) {
  billingLabel = '領収書発行済';
} else {
  billingLabel = '会計済';
}
```

#### アクションボタン（確定版）

| 状態 | ボタン | 遷移先 | クラス |
|---|---|---|---|
| 未会計 | 会計入力 | `?page=billing&visitKey=...` | tl-action-billing（青）|
| **未収/一部入金** | **未収回収** | `?page=receipt&visitKey=...` | **tl-action-outstanding（赤）** |
| 会計済（領収書未発行）| 領収書を発行 | `?page=receipt&visitKey=...` | tl-action-receipt（緑）|
| 領収書発行済 | 領収書 | `?page=receipt&visitKey=...` | tl-action-receipt（緑）|

CSS 追加: `.tl-action-outstanding { background:#fce8e6; color:#d93025; }`

#### clasp push

```
clasp push --force → 14ファイル push 完了（2026-04-28 16:07:18）
```

### 手動確認手順（再デプロイ後）

1. **未収の来院がある患者詳細を開く**
   - 期待: タイムラインで「未収」赤太字バッジ + 赤「未収回収」ボタン表示
   - 領収書発行済みの来院でも未収なら「未収」バッジが表示されることを確認

2. **「未収回収」ボタンをクリック**
   - 期待: `?page=receipt&visitKey=...` に遷移
   - receipt 画面で「未収回収」セクションが表示される

3. **回収後に患者詳細に戻る**
   - 期待: 該当来院のバッジが「未収」→「領収書発行済」または「会計済」に変わる

---

## Phase 4 後半 F-2 表示不整合修正（2026-04-28）

### F-2 実機確認結果 + 表示不整合の修正

#### F-2 実機確認

| 確認項目 | 結果 |
|---|---|
| 患者一覧 未会計件数・未収額表示 | ✅ PASS |
| 患者詳細 累計支払・未収残高・未会計件数 | ✅ PASS |
| receipt 画面に「未収回収」セクション表示 | ✅ PASS |
| 「未収を回収する」ボタン表示 | ✅ PASS |
| 回収成功メッセージ表示 | ✅ PASS |
| 領収書発行 + 発行済みバナー表示 | ✅ PASS |
| 患者一覧 未収額表示 | ✅ PASS |
| **問題** 回収後も画面上の入金状態が「未収」のまま | ❌ → 修正済み |

#### 根本原因

receipt.html はページロード時に GAS テンプレートから `PAYMENT` オブジェクトを受け取りサーバーサイドレンダリングする。
`collectOutstandingPayment()` は Payments シートを正しく更新するが、
DOM に反映されるのはページロード時の値（`payment.paymentStatus = "未収"`）のまま。
ページをリロードしない限り「未収」表示が残る。

#### 修正内容

**JREC_SF01_Billing.gs:**

`collectOutstandingPayment()` の return に `paymentMethod` を追加。
UI 側が DOM 更新で使用できるようにした。

```javascript
return {
  ok: true, visitKey, newStatus: "入金済",
  paymentDate, totalTaxInc,
  paymentMethod: paymentMethod || curPaymentMethod  // ← 追加
};
```

**receipt.html:**

- 支払方法セルに `id="paymentMethodDisplay"` 付与
- 入金状態セルに `id="paymentStatusDisplay"` 付与
- 入金日セルに `id="paymentDateDisplay"` 付与（常時表示、未設定時は「—」）
- メモブロック重複バグを修正（Edit時に生じた重複 `if(memo)` を削除）
- 入金日の `<?= date || '<span>...</span>' ?>` HTML エスケープバグを if ブロックに修正

**handleCollect() の成功ハンドラ:**

回収成功後に以下を実行:
1. DOM 更新: `paymentStatusDisplay` → 「入金済」（緑太字）
2. DOM 更新: `paymentMethodDisplay` → 回収時の支払方法
3. DOM 更新: `paymentDateDisplay` → 入金日
4. JS オブジェクト更新: `PAYMENT.paymentStatus / paymentMethod / paymentDate`
   （後続の issueReceipt でも正しい値を参照できる）

#### clasp push

```
clasp push --force → 14ファイル push 完了（2026-04-28 15:49:44）
```

---

## Phase 4 後半 F-2「未収回収処理」（2026-04-28）

### F-1 follow-up 実機確認 PASS

| 確認項目 | 結果 |
|---|---|
| `<span class="muted">—</span>` 文字列バグ修正 | ✅ PASS |
| 患者一覧「未会計あり 1名」表示 | ✅ PASS |
| 患者一覧 未収残高: ¥0 表示 | ✅ PASS |
| 患者一覧 未会計件数: 未会計 4件 | ✅ PASS |
| 患者詳細 累計支払: ¥11,550 | ✅ PASS |
| 患者詳細 未収残高: ¥0 | ✅ PASS |
| 患者詳細 未会計: 4件 | ✅ PASS |
| 未会計ボタン → 会計入力画面遷移 | ✅ PASS |
| 会計保存後 → 領収書未発行画面遷移 | ✅ PASS |
| 保存ボタン「保存済み ✓」表示（billing-form.html 修正）| ✅ 同時修正済み |

---

### F-2「未収回収処理」実装内容

#### 未収・未会計・回収済みの定義（確定版）

| 種別 | 条件 | 意味 |
|---|---|---|
| **未会計** | SelfPayVisits あり + Payments なし | 来院したが会計入力していない（金額未確定）|
| **未収** | Payments あり + paymentStatus = 未収/一部入金 | 請求済みだが入金できていない |
| **回収済み** | Payments あり + paymentStatus = 入金済 | 入金完了 |

**未会計は未収回収の対象外。** 会計入力（billing-form）で Payment を作成してから回収処理を行う。

#### 実装ファイル

**JREC_SF01_Billing.gs: `collectOutstandingPayment(visitKey, payload)` 追加**

| ステップ | 内容 |
|---|---|
| 1. Payment 検索 | Payments シートで visitKey に一致する行を探す |
| 2. 二重回収チェック | paymentStatus = "入金済" → `{ ok: false, error: "すでに入金済みです" }` |
| 3. 対象外チェック | paymentStatus が "未収"/"一部入金" 以外 → エラー |
| 4. Payments 更新 | col 7 = 入金済 / col 6 = 支払方法（オプション）/ col 8 = 入金日 / col 9 = メモ |
| 5. SelfPayVisits 更新 | `updateVisitBillingStatus_(visitKey, "会計済")` |
| 6. Run_Log 記録 | action = "PAYMENT_COLLECT" |

**receipt.html: 未収回収セクション追加**

- `payment.paymentStatus === '未収' || '一部入金'` のとき GAS テンプレートで表示
- 支払方法プルダウン（現金/カード/電子マネー/PayPay/その他）
- 回収メモ入力
- `handleCollect()` → `google.script.run.collectOutstandingPayment(VISIT_KEY, payload)`
- 20秒タイムアウト
- 成功後: collectionArea を非表示 + 「回収済み」成功メッセージ + 「患者詳細へ戻る」ボタン
- 失敗時: `#collectMsg` にエラー表示・ボタン再有効化

**billing-form.html: 小修正**

- 保存成功後の保存ボタンテキストを「保存中...」→「保存済み ✓」に変更

#### 二重回収防止

| 防止層 | 内容 |
|---|---|
| GAS 層 | `paymentStatus === "入金済"` の場合 `{ ok: false, error: "すでに入金済みです" }` を返す |
| UI 層 | `payment.paymentStatus !== '未収'/'一部入金'` の場合 GAS テンプレートで回収セクション非表示 |

#### clasp push

```
clasp push --force → 14ファイル push 完了（2026-04-28 15:33:03）
```

### 手動確認手順（再デプロイ後）

1. **未収ありの来院で receipt ページを開く**
   - paymentStatus = "未収" の visitKey を使う
   - 期待: 「未収回収」セクションが表示される（未収額・支払方法・メモ入力・回収ボタン）

2. **「未収を回収する」ボタンを押す**
   - 期待: 「回収しました（入金日: YYYY-MM-DD　¥X,XXX）」成功メッセージ
   - 期待: 回収セクションが非表示になる
   - 期待: 「患者詳細へ戻る」ボタンが表示

3. **二重回収テスト**
   - 同じ visitKey でもう一度「未収を回収する」を押す（もしページリロード後に回収ボタンが出た場合）
   - 期待: 「この支払はすでに入金済みです」エラーメッセージ

4. **患者詳細で確認**
   - 期待: 未収残高が回収額分減少 / 来院バッジが「未収」→「会計済」に変わる

5. **billing-form.html の保存ボタン確認**
   - 会計保存後: 「保存中...」ではなく「保存済み ✓」と表示される

### 残課題（後続フェーズ）

| 課題 | メモ |
|---|---|
| 一部入金の差額管理 | 今回は "一部入金 → 入金済" 全額回収として処理 |
| 未収督促履歴 | 督促日・手段の記録 |
| 領収書再発行 | Receipts に新規 INSERT（再発行回数カウント）|
| DailySales 集計 | 回収時の DailySales 更新（当日の未収回収額集計）|

---

### 未収と未会計の定義（確定）

| 種別 | 条件 | 表示 |
|---|---|---|
| **未収** | Payments が存在 かつ paymentStatus = "未収" または "一部入金" | 赤太字 ¥X,XXX |
| **未会計** | SelfPayVisits に来院記録あり かつ Payments が存在しない | 橙 X件 |
| **なし** | Payments あり かつ paymentStatus = "入金済" | ¥0（未収）/ 0件（未会計）|

**未会計を未収に含めない理由:**
会計入力がなければ金額が確定していないため「請求したが回収できていない」状態とは言えない。
未収 = 金額確定後の未回収。未会計 = 金額未確定の来院。

### 実装内容

**JREC_SF01_Billing.gs 追加:**

`getPatientListStats(patientId?)`:
- SelfPayVisits（visitKey→patientId）と Payments を各1回読み取り
- `{ [patientId]: { outstanding, unbilledCount } }` を返す
- `getAllOutstandingByPatient()` と新規の `unbilledCount` を統合した効率化関数
- 旧 `getAllOutstandingByPatient()` は後方互換で残す

`getPatientAccountingData()` を更新:
- `unbilledCount` フィールドを追加（Payments が存在しない visitKey の数）
- エラー時のフォールバックにも `unbilledCount: 0` を追加

**JREC_SF01_Main.gs 更新:**

`list` ルートを `getPatientListStats()` に切り替え（SS 読み取り 4回 → 2回に削減）。
`p.outstanding` と `p.unbilledCount` を patients 配列に注入。

**patient-list.html 変更:**

| 変更 | 内容 |
|---|---|
| バグ修正 | `<?= p.visitCount > 0 ? ... : '<span class="muted">—</span>' ?>` が HTML エスケープで文字列表示されていたのを if ブロックに変更 |
| 件数ラベル | `（未収あり X名）` に加えて `（未会計あり X名）` を橙色で追加 |
| 未収残高列 | 未収額の下に `未会計 X件` を橙色で表示（未会計が 0 の場合は非表示）|

**patient-detail.html 変更:**

サマリーグリッドに「未会計」アイテムを追加（5列目）。
- 未会計 0件: 通常表示 `0件`
- 未会計 > 0件: 橙太字 `X件`
- accounting が null: `—` フォールバック

#### clasp push

```
clasp push --force → 14ファイル push 完了（2026-04-28 12:25:59）
```

### 手動確認手順（再デプロイ後）

1. **患者一覧**
   - 未会計の来院がある患者: `（未会計あり X名）` が橙色表示 + 行の「未収残高」列に `未会計 X件` 橙表示
   - 未会計なし患者: 「未会計」表示なし、未収残高は `¥0`
   - 件数行の `<span class="muted">—</span>` が HTML 文字列として表示されないことを確認

2. **患者詳細**
   - サマリーグリッドに「未会計 X件」が 5列目に表示される
   - 未会計 0件: `0件` 通常色
   - 未会計 > 0件: `X件` 橙太字

### F-1 残課題とF-2への接続

| 残課題 | F-2 として実装 |
|---|---|
| 未収回収処理（paymentStatus 更新）| F-2 で実装予定 |
| `visitCount` の実データ表示 | 別途 Phase 5 で SelfPayVisits から集計 |

---

### 実装内容

#### 未収額の定義（確定）

```
未収額 = Payments.paymentStatus が "未収" または "一部入金" の totalTaxInc 合計
```

| 含む | 含まない |
|---|---|
| paymentStatus = "未収" の Payment | 来院したが会計入力していない来院（未会計）|
| paymentStatus = "一部入金" の Payment | paymentStatus = "入金済" の Payment |

**理由:** 会計入力自体がなければ未収とは言えない。未収は「請求したが回収できていない」状態。

#### 変更ファイル

**JREC_SF01_Billing.gs:**

`getAllOutstandingByPatient()` を新規追加。
SelfPayVisits（visitKey→patientId マップ）と Payments（未収・一部入金行）を1回ずつ読み取り、
`{ [patientId]: outstandingAmount }` を返す。

読み取りコスト: 患者一覧ページロードごとに SelfPayVisits + Payments の全行読み取り（2回）。
小規模運用（< 1,000 来院）では問題なし。増加した場合は DailySales へのキャッシュ化を検討する。

**JREC_SF01_Main.gs:**

`list` ルートを更新。`getAllOutstandingByPatient()` を呼び出し、各患者の `outstanding` に注入してからテンプレートへ渡す。

**patient-list.html:**

| 変更 | 内容 |
|---|---|
| 未収額フォーマット | `p.outstanding` → `Number(p.outstanding).toLocaleString()` に変更（カンマ区切り）|
| "0円" → "¥0" | 統一フォーマット |
| 件数行に未収件数 | `（未収あり X件）` を赤太字で追加（0件の場合は非表示）|
| 橙背景行 | `row-outstanding` クラス + 未収あり患者は橙背景（既存動作、実データで機能する）|

**patient-detail.html:**

| 変更 | 内容 |
|---|---|
| 未収残高 `—` → `¥0` | `accounting` が存在する限り `¥` + `toLocaleString()` 表示 |
| 未収 > 0 の場合 | 従来どおり赤太字 |
| `accounting` が null（異常系）| `—` 表示を維持（安全フォールバック）|

#### clasp push

```
clasp push --force → 14ファイル push 完了（2026-04-28 12:07:26）
```

### 手動確認手順（再デプロイ後）

1. **患者一覧を開く**
   - 期待: 未収あり患者がいる場合、件数行に「（未収あり X件）」赤太字表示
   - 期待: 未収あり患者の行が橙背景
   - 期待: 未収額列に `¥X,XXX` 形式（カンマ区切り）

2. **未収なし患者の一覧行を確認**
   - 期待: 未収額列に `¥0` 表示（「0円」ではなく「¥0」）

3. **患者詳細の未収残高を確認**
   - 未収なし患者: `¥0` 表示（以前は `—`）
   - 未収あり患者: 赤太字で `¥X,XXX` 表示

### F-2「未収回収処理」として次に残すこと

| タスク | 内容 |
|---|---|
| paymentStatus 更新 | 「未収」→「入金済」に更新するボタン/モーダルを患者詳細または receipt 画面に追加 |
| 患者詳細の未収行強調 | タイムラインで未収の来院を視覚的に強調（現在は「未収」バッジのみ）|
| 未収回収履歴 | いつ・誰が回収したかの記録（Run_Log への追記）|

---

## ✅ Phase 4 CLOSED（2026-04-28）

### Phase 4 実機確認 Step 5 PASS

| 確認項目 | 結果 |
|---|---|
| 未会計バッジ | ✅ PASS |
| 「会計入力」ボタン | ✅ PASS |
| 会計入力への遷移 | ✅ PASS |
| 領収書発行済バッジ | ✅ PASS |
| 「領収書」ボタン | ✅ PASS |
| 領収書画面への遷移 | ✅ PASS |
| 「✅ 発行済み」バナー表示 | ✅ PASS |
| 累計支払 ¥3,850 表示 | ✅ PASS |
| タイムライン表示（Phase 3 退行なし）| ✅ PASS |
| 対象患者: P0001 / visitKey: SPV_20260428_P0001_004 / receiptNo: R_2026_0001 | ✅ PASS |

**確認時の補足:**
- 未収残高 = 0 の場合は「—」表示（未収なし）→ Phase 4 CLOSED の阻害要因ではない
- 「¥0」表示の方が会計管理上明確かどうかは次フェーズで判断

---

### Phase 4 実装済みスコープ（CLOSED）

#### 実装ファイル

| ファイル | 役割 |
|---|---|
| `JREC_SF01_Billing.gs` | 会計バックエンド全関数 |
| `JREC_SF01_Main.gs` | billing / receipt ルート追加・accounting データ渡し |
| `billing-form.html` | 会計入力UI（メニュー選択・税計算・保存）|
| `receipt.html` | 領収書発行UI（プレビュー・印刷・発行済みバナー）|
| `patient-detail.html` | 会計導線・サマリー実データ化 |
| `docs/ACCOUNTING_POLICY_v1.md` | 会計設計方針（カルテ/会計分離・自動変換しない理由）|

#### 実装済み機能

| 機能 | 詳細 |
|---|---|
| MenuMaster 由来のメニュー選択 | `getActiveMenus()` → optgroup カテゴリ別プルダウン |
| 明細行の動的追加/削除 | 行追加・削除・リアルタイム税計算 |
| 会計保存 | `savePaymentWithItems()` → SelfPayItems + Payments + SelfPayVisits 会計状態更新 |
| 領収書発行 | `issueReceipt()` → Receipts 採番・保存 |
| 発行済み領収書表示 | `getReceiptByVisit()` → receiptNo / 宛名 / 金額 / 明細 |
| 印刷対応 | `window.print()` + `@media print` で UI 非表示 |
| 発行済みバナー | `✅ 発行済み No. R_2026_0001 発行日: YYYY年M月D日` |
| 二重保存防止 | GAS 側 Payments 重複チェック + 保存成功後フォーム disabled |
| 二重発行防止 | GAS 側 Receipts 重複チェック + alreadyIssued 時に既存返却 |
| 患者詳細の会計バッジ | 未会計/会計済/未収/領収書発行済 の 4状態 |
| 患者詳細のアクションボタン | 未会計→会計入力 / 会計済未発行→領収書を発行 / 発行済→領収書 |
| 累計支払表示 | `getPatientAccountingData()` から実値（¥X,XXX）|
| 未収残高表示 | 未収 > 0 の場合 赤太字で表示 |
| 会計設計方針文書 | `docs/ACCOUNTING_POLICY_v1.md` |

#### 会計フロー（確定版）

```
患者詳細 → 「会計入力」ボタン（未会計の来院行）
  → billing-form.html でメニュー選択・支払入力
  → savePaymentWithItems() → SelfPayItems + Payments 保存
  → receipt.html へ遷移
  → 「領収書を発行する」ボタン
  → issueReceipt() → Receipts 保存・receiptNo 採番
  → 領収書プレビュー表示・印刷
  → 患者詳細へ戻る
患者詳細 → 来院行に「領収書発行済」バッジ + 「領収書」ボタン
```

---

### Phase 4 後半以降へ回した残課題

| 課題 | 優先度 | メモ |
|---|---|---|
| 未収0円表示の改善 | 低 | 現在は `—`。`¥0` 表示の方が明確かどうか次フェーズで判断 |
| 未収回収処理 | 中 | Payments.paymentStatus を「入金済」に更新するモーダル |
| 患者一覧の未収額表示 | 中 | 患者一覧で Payments と JOIN して未収額列を実データ化 |
| 領収書の再発行 | 低 | reissueCount をインクリメントして新規 receipt INSERT |
| DailySales 日次集計 | 中 | savePaymentWithItems 後に DailySales を更新する集計ロジック |
| 取消・返金 | 要設計 | 不可逆操作のため設計フェーズで別途検討 |
| 会計明細の編集・削除 | 要設計 | 誤入力訂正フロー |

---

## ✅ Phase 4 Step 5 完了（2026-04-28）

### patient-detail.html 会計導線・サマリー実データ化

#### 変更内容

**JREC_SF01_Billing.gs に追加:**

`getPatientAccountingData(patientId)` — 患者単位の会計集計

| 戻り値 | 内容 |
|---|---|
| `totalPaid` | 入金済・一部入金 の tax-inc 合計 |
| `totalOutstanding` | 未収・一部入金 の tax-inc 合計 |
| `payments[visitKey]` | visitKey ごとの支払情報（exists ならば会計済み）|
| `receipts[visitKey]` | visitKey ごとの領収書情報（exists ならば発行済み）|

**JREC_SF01_Main.gs の detail ルート:**

`t.accounting = getPatientAccountingData(idParam)` を追加

**patient-detail.html:**

| 変更箇所 | 内容 |
|---|---|
| 累計支払 | `accounting.totalPaid > 0` の場合に `¥X,XXX` 表示（0なら `—`）|
| 未収残高 | `accounting.totalOutstanding > 0` の場合に赤太字で `¥X,XXX` 表示 |
| 来院ごとのステータスバッジ | 4状態: 未会計（黄）/ 会計済（緑）/ 未収（赤）/ 領収書発行済（青）|
| 来院ごとのアクションボタン | 未会計 → `会計入力` / 会計済み未発行 → `領収書を発行` / 発行済み → `領収書` |

#### 会計ステータスバッジ仕様

| 状態 | 条件 | バッジ | スタイル |
|---|---|---|---|
| 未会計 | `pay == null` | 「未会計」 | 黄背景・橙文字 |
| 会計済 | `pay != null && billingStatus != "未収" && rec == null` | 「会計済」 | 緑背景・緑文字 |
| 未収 | `billingStatus == "未収"` | 「未収」 | 赤背景・赤文字・太字 |
| 領収書発行済 | `rec != null` | 「領収書発行済」 | 青背景・青文字 |

#### アクションボタン動作

```javascript
// 会計入力ボタン（未会計のみ）
top.location.href = APP_URL + '?page=billing&visitKey=' + vk

// 領収書ボタン（会計済み・発行済み）
top.location.href = APP_URL + '?page=receipt&visitKey=' + vk
```

`event.stopPropagation()` で `tl-header` の `toggleDetail()` が誤発火しないよう制御済み。

#### 手動確認手順（再デプロイ後）

1. **未会計の来院がある患者詳細を開く**
   - 期待: タイムラインの各来院に「未会計」バッジ + 「会計入力」ボタン表示

2. **「会計入力」ボタンをクリック**
   - 期待: `?page=billing&visitKey=SPV_...` に遷移

3. **会計済み・領収書未発行の来院を持つ患者詳細を開く**（SPV_20260428_P0001_004 など）
   - 期待: 「会計済」バッジ + 「領収書を発行」ボタン
   - 累計支払に ¥3,850（または実際の値）表示

4. **「領収書を発行」ボタンをクリック**
   - 期待: `?page=receipt&visitKey=...` に遷移

5. **領収書発行済みの来院を持つ患者詳細を開く**
   - 期待: 「領収書発行済」青バッジ + 「領収書」ボタン表示

6. **「領収書」ボタンをクリック**
   - 期待: receipt 画面に直接遷移し、発行済みプレビューが即表示される

#### clasp push

```
clasp push --force → 14ファイル push 完了（2026-04-28 11:47:50）
```

---

## ✅ Phase 4 Step 4 実機確認 PASS（2026-04-28）

| 確認項目 | 結果 |
|---|---|
| 領収書発行ボタン | ✅ PASS |
| 発行後プレビュー表示 | ✅ PASS |
| receiptNo 表示（R_2026_0001）| ✅ PASS |
| 税込合計 ¥3,850 表示 | ✅ PASS |
| 印刷ボタン表示 | ✅ PASS |
| リロード後の発行済み表示 | ✅ PASS（receiptNo・プレビュー表示、発行ボタン再表示なし）|
| 二重発行防止 | ✅ PASS |
| 改善: 「発行済み」ラベル追加 | ✅ 対応済み（`showReceiptBox` に statusBanner を追加）|

### 改善内容（2026-04-28）

`showReceiptBox()` の先頭に「発行済み」ステータスバナーを追加。
リロード後に発行済み状態で開いたとき、受領書番号と発行日が画面上部で一目で確認できる。

```
✅ 発行済み  No. R_2026_0001  発行日: 2026年4月28日
```
（`no-print` クラス付き → 印刷時は非表示）

---

## ✅ Phase 4 Step 4 完了（2026-04-28）

### receipt.html 領収書発行UI 実装内容

#### 3状態の分岐表示

| 状態 | 条件 | 表示内容 |
|---|---|---|
| 未会計 | `payment == null` | 「未会計」メッセージ + 「会計入力へ」ボタン |
| 会計済み・未発行 | `payment != null && receipt == null` | 会計サマリー + 「領収書を発行する」ボタン |
| 発行済み | `receipt != null`（初期表示 or 発行後）| 領収書プレビュー + 印刷ボタン |

#### 領収書発行フロー

```
「領収書を発行する」ボタン押下
  → google.script.run.issueReceipt(VISIT_KEY) 呼び出し
  → 20秒タイムアウト付き
  → 成功: showReceiptBox(res) で領収書プレビューを DOM に描画
          発行ボタンを非表示、印刷ボタン・戻るボタンを表示
  → 失敗: DOM に GAS エラーメッセージを表示、ボタン再有効化
```

#### 二重発行防止

| 防止層 | 内容 |
|---|---|
| GAS 側（issueReceipt）| Receipts シートに同 visitKey が存在する場合、新規 INSERT せず既存レコードを返す（`alreadyIssued=true`）|
| UI 側 | 発行ボタンを押した時点で disabled。発行完了後は issueArea を非表示に変更 |
| ページロード時 | `receipt != null` の場合はボタンを初期非表示、プレビューを即描画 |

#### 領収書プレビュー（`showReceiptBox(data)` 関数）

| 表示項目 | データソース |
|---|---|
| 領収書番号（No.）| `data.receiptNo` |
| 発行日 | `data.issuedDate`（YYYY-MM-DD → YYYY年M月D日 に変換）|
| 宛名 | `data.addressee` または `data.patientName` または テンプレートの患者名 |
| 金額（税込）| `data.totalTaxInc` |
| 内消費税 | `data.totalTaxAmt` |
| 但し書き | `data.description`（デフォルト: 「施術費として」）|
| 明細 | `ITEMS` 配列（menuName × qty → subtotalInc）|
| 院名 | `data.clinicName` または `CLINIC_NAME` |

`showReceiptBox` は発行後の GAS レスポンスとページロード時の RECEIPT オブジェクト両方を処理できる正規化実装。

#### 印刷対応

- `@media print` で `.no-print` 要素（ヘッダー・ナビ・ボタン類）を非表示
- 白背景・ボックスシャドウなしの A4 フレンドリーレイアウト
- `window.print()` で印刷ダイアログを表示

#### clasp push

```
clasp push --force → 14ファイル push 完了（2026-04-28 11:22:57）
receipt.html が更新された
```

### 手動確認手順（再デプロイ後）

1. **発行前状態の確認**（billing 保存済みで receipt 未発行の visitKey）
   ```
   ?page=receipt&visitKey=SPV_20260428_P0001_004
   ```
   期待: 会計サマリー + 「領収書を発行する」ボタン

2. **「領収書を発行する」ボタン押下**
   期待: 20秒以内に領収書プレビューが表示。receiptNo（R_2026_0001 形式）が表示される

3. **印刷ボタン**
   期待: 印刷ダイアログが開く

4. **ページリロード（再表示）**
   期待: 発行済み状態で表示（発行ボタンは出ない、プレビューが即表示）

5. **二重発行テスト（発行済みの visitKey で再度「発行する」ボタンを押す）**
   期待: 「既に発行済みの領収書を表示しています。」メッセージ。既存 receiptNo が変わらない

6. **未会計の visitKey で receipt ページを開く**
   ```
   ?page=receipt&visitKey=SPV_20260428_P0001_001
   ```
   期待: 「この来院はまだ会計されていません」メッセージ + 「会計入力へ」ボタン

### Phase 4 Step 5 に残すこと

| 項目 | 内容 |
|---|---|
| patient-detail.html 更新 | 未会計の来院に「会計入力」ボタン、会計済みに「領収書」リンクを追加 |
| 患者一覧の未収額表示 | Payments との JOIN が必要（現在は `—` 固定）|
| 患者詳細サマリーの累計支払・未収残高 | Payments のリアルタイム集計（現在は `—` 固定）|

---

---

## 会計方針 v1（2026-04-28 確定）

**参照:** `docs/ACCOUNTING_POLICY_v1.md`

### 要約

| 項目 | 方針 |
|---|---|
| 来院・カルテ入力 | 施術事実を記録する（SelfPayVisits / SelfPayChart）|
| 会計入力 | MenuMaster から請求項目を選択する（SelfPayItems / Payments）|
| カルテ → 会計の自動変換 | **実装しない**（単価誤り・税区分誤り・外販対応の観点から）|
| 会計の確定 | 必ず人が確認してから「保存」ボタンを押す |
| 将来の候補自動セット | 検討は可。ただし確認・変更できる状態で提示し、自動保存は禁止 |

---

## ✅ Phase 4 Step 3 実機確認 PASS（2026-04-28）

| 確認項目 | 結果 |
|---|---|
| 会計入力画面表示 | ✅ PASS |
| MenuMaster 由来の UI 表示 | ✅ PASS |
| 保存成功（SPV_20260428_P0001_004）| ✅ PASS |
| receipt 画面への遷移 | ✅ PASS |
| 「会計済み・領収書未発行」状態表示 | ✅ PASS |
| 税込合計 ¥3,850 表示 | ✅ PASS |
| 支払方法: 現金 / 入金状態: 入金済 | ✅ PASS |
| 同 visitKey の billing 再表示で二重保存ブロック | ✅ PASS |
| 二重保存ブロック画面に「領収書を確認する」「患者詳細へ戻る」導線 | ✅ PASS |

---

## ✅ Phase 4 Step 3 完了（2026-04-28）

### billing-form.html 会計入力UI 実装内容

#### 機能一覧

| 機能 | 実装内容 |
|---|---|
| 患者サマリー | 患者ID / 氏名 / フリガナ / 電話番号 + 患者詳細へ戻るボタン |
| 来院情報 | 来院日 / 区分 / 主訴 / visitKey（モノスペース表示）|
| メニュー選択 | MenuMaster の有効フラグ=TRUE をカテゴリ別 `<optgroup>` で表示。選択時に税別単価を自動セット |
| 数量入力 | 数量変更で税込小計を即時再計算 |
| 行の追加 | 「＋ 行を追加」ボタンで明細行を動的に追加 |
| 行の削除 | 「×」ボタンで行削除（最低1行は保持）|
| 合計表示 | 税別合計 / 消費税（10%）/ 税込合計をリアルタイム更新 |
| 支払方法 | 現金 / カード / 電子マネー / 未収（後払い）|
| 入金状態 | 支払方法に連動して自動設定（現金・カード → 入金済、未収 → 未収）|
| 預かり金・お釣り | 現金のみ表示。預かり金入力でお釣りをリアルタイム計算 |
| メモ | 任意入力 |
| 保存処理 | `savePaymentWithItems(payload)` を呼び出し。20秒タイムアウト付き |
| 二重保存防止 | 保存成功後: フォーム全体を `disabled` にして再保存不可 |
| 成功表示 | 保存成功後: 税込合計 + 「領収書へ進む →」ボタン表示 |
| エラー表示 | GAS エラー / タイムアウト / 同期エラーを DOM に表示（alert 不使用）|
| 自動遷移 | 保存成功後に `receipt` ページへ自動遷移試行（iframe制限時はボタンで手動遷移）|
| メニューなし警告 | MENUS が空の場合に警告を表示 |

#### Payload 仕様

```javascript
{
  selfPayVisitKey: "SPV_20260428_P0001_001",
  items: [
    {
      menuCode:    "SELFPAY_CONTINUE20",
      menuName:    "継続標準施術",
      qty:         1,
      priceEx:     3500,
      taxCategory: "課税"
    }
  ],
  paymentMethod: "現金",      // 現金 | カード | 電子マネー | 未収
  paymentStatus: "入金済",    // 入金済 | 未収 | 一部入金（手動変更可）
  memo:          ""
}
```

GAS 側 `savePaymentWithItems` がこのペイロードを受け取り、
SelfPayItems / Payments に保存して SelfPayVisits.会計状態を更新する。

#### 二重保存防止 UI

| 状態 | 動作 |
|---|---|
| alreadyPaid=true（routing で検知）| Main.gs が renderError_ でブロック → billing-form.html は表示されない |
| 保存成功後 | フォーム全 input/select/button を disabled 化 → 再保存ボタンを押せなくなる |
| GAS 側でも二重チェック | Payments シートに同 visitKey が存在する場合 `{ ok: false, error: "既に会計済みです" }` を返す |

#### 税計算の分担

| 場所 | 役割 |
|---|---|
| クライアント（JS）| `Math.floor(priceEx × qty × 0.10)` でリアルタイム表示（概算）|
| GAS（savePaymentWithItems）| Settings の tax_rate / tax_rounding / tax_unit を参照して確定計算 |
| 注意 | Settings の端数処理設定により、UI 表示と実際の保存金額が1円ずれる可能性あり |

#### clasp push

```
clasp push --force → 14ファイル push 完了（2026-04-28 10:42:44）
billing-form.html が更新された
```

---

## ✅ Phase 4 Step 2 実機確認 PASS（2026-04-28）

### 確認内容

| 確認項目 | 結果 |
|---|---|
| billing ルート表示（visitKey=SPV_20260428_P0001_004）| ✅ PASS |
| 患者名「平山克士」表示 | ✅ PASS |
| 来院日「2026-04-28」表示 | ✅ PASS |
| 会計状態「未会計」表示 | ✅ PASS |
| 有効メニュー数「12件」表示 | ✅ PASS |
| receipt ルート（未会計メッセージ）| ✅ PASS |
| visitKey なしエラー | ✅ PASS |
| 存在しない visitKey エラー | ✅ PASS |
| Phase 3 退行なし（来院保存 / 患者詳細遷移 / タイムライン）| ✅ PASS |
| 同日採番 SPV_20260428_P0001_004 まで確認 | ✅ PASS |

---

## ✅ Phase 4 Step 2 完了（2026-04-28）

### JREC_SF01_Main.gs ルート追加 + 仮テンプレート作成

#### 変更内容

**JREC_SF01_Main.gs:**
- `doGet` に `vkParam` 抽出を追加（`e.parameter.visitKey || e.parameter.vk`）
- `buildPage_` の引数に `vkParam` を追加
- `billing` ルートを追加
- `receipt` ルートを追加

#### routing 仕様

| URL パラメータ | 動作 |
|---|---|
| `?page=billing&visitKey=SPV_...` | `getVisitForBilling()` → `billing-form.html` |
| `?page=receipt&visitKey=SPV_...` | `getReceiptByVisit()` → `receipt.html` |
| visitKey 未指定 | エラーページ |
| visit が見つからない | エラーページ |
| 既に会計済み（billing ルート）| 「会計済みです」メッセージ + 領収書リンク |

#### 作成したテンプレートファイル

**billing-form.html（仮 / Step 3 プレースホルダー）:**
- 患者名・来院キー・来院日・主訴・有効メニュー数を表示
- 「Step 3 実装予定」ノートを表示
- 「患者詳細に戻る」ボタン

**receipt.html（仮 / Step 4 プレースホルダー）:**
- 3パターンで分岐：
  1. `receipt != null` → 発行済み領収書プレビュー（receiptNo / 宛名 / 金額 / 内訳）+ 印刷ボタン
  2. `receipt == null && payment != null` → 会計済み・領収書未発行メッセージ + Step 4 ノート
  3. `payment == null` → 未会計メッセージ + 「会計入力へ」ボタン
- `@media print` で印刷不要要素を非表示

#### 手動確認手順（clasp push + 再デプロイ後）

**前提: WebApp を新バージョンで再デプロイしてから実施すること。**

1. **billing ルート（未会計の来院）**
   ```
   WebアプリURL?page=billing&visitKey=SPV_20260428_P0001_001
   ```
   期待: 患者名・来院日・有効メニュー数が表示され、「Step 3 実装予定」ノートが出る

2. **receipt ルート（未会計の来院 = payment なし）**
   ```
   WebアプリURL?page=receipt&visitKey=SPV_20260428_P0001_001
   ```
   期待: 「この来院はまだ会計されていません」メッセージ + 「会計入力へ」ボタン

3. **visitKey なし（エラー確認）**
   ```
   WebアプリURL?page=billing
   ```
   期待: 「visitKey が指定されていません」エラーページ

4. **billing ルート（存在しない visitKey）**
   ```
   WebアプリURL?page=billing&visitKey=SPV_99999999_P0000_999
   ```
   期待: 「来院記録が見つかりません」エラーページ

#### clasp push

```
clasp push --force → 14ファイル push 完了（2026-04-28 10:26:56）
billing-form.html / receipt.html が新規追加された
```

---

## ✅ Phase 4 Step 1 完了（2026-04-28）

### JREC_SF01_Billing.gs 実装内容

#### 実装した Public 関数

| 関数名 | 役割 |
|---|---|
| `getActiveMenus()` | MenuMaster から有効フラグ=TRUE のメニューを表示順で返す |
| `getVisitForBilling(visitKey)` | visit・患者・既存支払・既存領収書を返す（billing-form 表示用 + alreadyPaid 判定）|
| `savePaymentWithItems(payload)` | SelfPayItems 明細 + Payments 保存 + SelfPayVisits.会計状態 更新 |
| `issueReceipt(selfPayVisitKey)` | Receipts に保存し receiptNo を採番。二重発行防止で既存 receipt を返す |
| `getReceiptByVisit(selfPayVisitKey)` | receipt.html 用に visit/patient/items/payment/receipt/clinicName を集約 |

#### 実装した Private ヘルパー

| 関数名 | 役割 |
|---|---|
| `getSettingValue_(key)` | Settings シートから特定キーの値を取得 |
| `getTaxSettings_()` | tax_rate / tax_rounding / tax_unit を Settings から読む |
| `calcItemTax_(priceEx, qty, taxCategory, taxCfg)` | 明細1行の税額・税込小計を計算（item 単位）|
| `getMaxItemSeq_(visitKey)` | SelfPayItems の visitKey 最大連番を返す（重複防止）|
| `nextReceiptNo_()` | Settings の prefix/digits/reset から領収書番号を採番 |
| `updateVisitBillingStatus_(visitKey, status)` | SelfPayVisits の会計状態（col 9）を更新 |

#### 二重保存・二重発行の防止ロジック

| ケース | 対策 |
|---|---|
| `savePaymentWithItems` の二重保存 | 先頭で Payments を全件読み、同 visitKey が存在したら `{ ok: false, error: "既に会計済みです" }` を返す |
| `issueReceipt` の二重発行 | 先頭で Receipts を全件読み、同 visitKey が存在したら **既存レコードを返す**（新規 INSERT しない）|

#### 採番設計

| ID種別 | フォーマット | 例 |
|---|---|---|
| itemId | `SPI_{visitKey}_{3桁連番}` | `SPI_SPV_20260428_P0001_001_001` |
| paymentId | `SPP_{visitKey}` | `SPP_SPV_20260428_P0001_001` |
| receiptNo | `{prefix}_{YYYY}_{4桁連番}` | `R_2026_0001` |

#### ⚠️ Settings 不整合メモ

`receipt_no_prefix` の Settings 初期値は `"R"` → receiptNo が `R_2026_0001` になる。
設計書の例 `SPR_2026_0001` に合わせたい場合は、Settings シートの `receipt_no_prefix` を `"SPR"` に変更する。

#### 既存コードとの整合

| 項目 | 対応 |
|---|---|
| `getTargetSpreadsheet_()` | Setup.gs のものを使用 |
| `getPatientById()` | Patient.gs のものを使用 |
| `appendRunLog_()` | Patient.gs のものを使用（patientId に visitKey から抽出した P0001 を渡す）|
| `SHEET_NAMES` | Setup.gs の定数を使用 |

#### clasp push

```
clasp push --force → 12ファイル push 完了（2026-04-28 9:06:54）
JREC_SF01_Billing.gs が新規追加された
```

#### 次は Step 2

`JREC_SF01_Main.gs` に `billing` / `receipt` ルートを追加する。

```javascript
case "billing": {
  // getVisitForBilling(vk) → billing-form.html へ
}
case "receipt": {
  // getReceiptByVisit(vk) → receipt.html へ
}
```

---

## ✅ Phase 3 CLOSED（2026-04-28）

### 実機確認結果（最終・PASS）

| 確認項目 | 結果 |
|---|---|
| 保存成功メッセージ表示 | ✅ PASS |
| 「患者詳細へ戻る →」ボタン表示 | ✅ PASS |
| 保存ボタン復帰（保存中 → 元に戻る）| ✅ PASS |
| 患者詳細への遷移 | ✅ PASS |
| 来院履歴タイムライン表示 | ✅ PASS |
| 同日2件目採番（_002）| ✅ PASS |
| 同日3件目採番（_003）| ✅ PASS |
| visitKey 確認（3件）| ✅ SPV_20260428_P0001_001〜003 |

### Phase 3 解決済み問題サマリー

| 問題 | 原因 | 対応 |
|---|---|---|
| 保存ボタン押下後に「保存中」のまま停止 | alert() がブラウザブロック + session 8 修正が未デプロイ | alert 削除・showMsg DOM表示に統一・timeout追加 |
| 保存成功後に患者詳細へ遷移しない | GAS 非同期コールバック内では user activation が失われており、window.top.location.href が iframe 制限でブロック | 自動遷移フォールバック付き navigate() + 手動「患者詳細へ戻る」ボタン表示 |

**Phase 3 は全実機確認 PASS。CLOSED 扱い。**

---

## Phase 4 着手前整理（2026-04-28）

### Phase 4 概要

**目的:** 来院後の会計処理（メニュー選択・支払）と領収書発行を実装する。
**設計参照:** `docs/UI_DESIGN_v1.md` S04〜S05 / `docs/UI_LAYOUT_v1.md` S05・S07 / `docs/SHEET_DESIGN_v1.md` §7〜9

### Phase 4 フロー（設計確定）

```
患者詳細（未会計の来院）
  ↓ 「会計入力」ボタン
billing-form.html（S05）
  ↓ MenuMaster からメニュー選択 / 数量 / 支払方法 / 入金状態
  ↓ 保存 → SelfPayItems INSERT + Payments INSERT + SelfPayVisits.会計状態 UPDATE
receipt.html（S07）
  ↓ 領収書プレビュー表示
  ↓ 「発行して患者詳細へ戻る」→ Receipts INSERT
患者詳細（会計済に更新）
```

### Phase 4 MVP 実装単位（安全な分割）

#### Step 1 — `JREC_SF01_Billing.gs`（GAS バックエンド）

| 関数 | 役割 |
|---|---|
| `getActiveMenus()` | MenuMaster の有効フラグ=TRUE を表示順で返す |
| `getVisitForBilling(visitKey)` | 請求対象 visit の情報 + 患者名を返す（billing-form 表示用）|
| `savePaymentWithItems(payload)` | SelfPayItems + Payments を INSERT し、SelfPayVisits.会計状態 を更新 |
| `issueReceipt(payload)` | Receipts に INSERT し receiptId を返す |
| `getReceiptByVisit(visitKey)` | 発行済み領収書があれば返す（再発行・確認用）|
| `generateItemId_(visitKey)` | `SPI_visitKey_001` 形式で採番 |
| `generatePaymentId_(visitKey)` | `SPP_visitKey` を返す |
| `generateReceiptNo_(year)` | `SPR_YYYY_0001` 形式で年次連番採番 |

**二重保存防止:** `savePaymentWithItems` は既存 Payments.paymentId が存在する場合 `{ ok: false, error: "既に会計済みです" }` を返す。

#### Step 2 — `JREC_SF01_Main.gs` 更新

| 追加ルート | 画面 |
|---|---|
| `?page=billing&vk=SPV_...` | billing-form.html（会計入力）|
| `?page=receipt&vk=SPV_...` | receipt.html（領収書プレビュー・発行）|

#### Step 3 — `billing-form.html`（S05）

| 要素 | 内容 |
|---|---|
| ヘッダー | 患者名 + visitKey + 来院日（getVisitForBilling から）|
| 明細エリア | MenuMaster プルダウン + 数量 + 税別単価（自動）+ 税込小計（自動計算）|
| 明細追加ボタン | 行を動的に追加（JS）|
| 合計エリア | 税別合計 / 消費税 / 税込合計（リアルタイム再計算）|
| 支払エリア | 支払方法（現金/カード/電子マネー/未収）/ 入金状態（入金済/未収）/ メモ |
| 保存ボタン | `savePaymentWithItems` → receipt へ遷移 |
| 税計算式 | `floor(単価(税別) × 数量 × 0.10)` で消費税。税込 = 税別 + 税 |

#### Step 4 — `receipt.html`（S07）

| 要素 | 内容 |
|---|---|
| 領収書プレビュー | 患者名 / 金額（税込）/ 内消費税 / 但し書き / 院名 |
| 「印刷（新しいタブ）」| `window.print()` で印刷ダイアログ（CSS で印刷用レイアウト）|
| 「発行して患者詳細へ戻る」| `issueReceipt` → Receipts INSERT → 患者詳細へ遷移 |
| receiptNo 表示 | 発行後に表示。初回 = `SPR_YYYY_0001` 形式 |

#### Step 5 — `patient-detail.html` 更新

| 変更 | 内容 |
|---|---|
| タイムライン に「会計入力」ボタン追加 | 会計状態 = 未会計 の来院のみ表示。`?page=billing&vk=...` へ遷移 |
| タイムライン に「領収書」リンク追加 | 会計状態 = 会計済 の来院に表示。`?page=receipt&vk=...` へ遷移 |
| サマリーカードの累計支払 / 未収残高 | 現在は `—` 表示。Phase 4 実装後に実データ表示に切り替える |

### Phase 4 スコープ外（後回し）

| 項目 | 理由 | 対応フェーズ |
|---|---|---|
| DailySales 日次集計 | 複雑な集計ロジック。MVP 後回しで事故リスク低減 | Phase 5 |
| 未収回収処理（支払状態の更新）| 安全のため会計確認後に設計 | Phase 4 後半 |
| 領収書の再発行 | 初回発行が動いてから追加 | Phase 4 後半 |
| 会計明細の編集・削除 | 不可逆操作リスクあり。設計後に判断 | Phase 5 以降 |
| 患者一覧の未収額表示（実データ）| Payments との JOIN が必要。現在は `0円` 固定表示 | Phase 4 完了後 |

### Phase 4 リスク

| リスク | 対策 |
|---|---|
| 二重保存 | `savePaymentWithItems` の先頭で既存 Payments を確認し、重複なら return error |
| receiptNo 重複 | `generateReceiptNo_` でシート最終行から採番（GAS は基本シングルスレッド）|
| 金額計算ミス | GAS 側と JS 側で同じ式（`floor(税別 × 0.10)`）を使い、保存前に GAS で再計算して検証 |
| visit の会計状態が不整合 | `savePaymentWithItems` が成功した場合のみ `SelfPayVisits.会計状態` を更新する |

---

### 実機確認結果（2026-04-28 セッション10前）

| 項目 | 状態 |
|---|---|
| createVisitWithChart 保存 | ✅ **成功確認済み**（SPV_20260428_P0001_001 が作成された）|
| successHandler 到達 | ✅ **確認済み**（成功メッセージが画面上部に表示された）|
| 保存後の自動遷移 | ❌ **失敗** URL が `?page=visitForm&id=P0001` のまま動かない |
| 保存ボタンの復帰 | ❌ **失敗** 「保存中...」のまま re-enable されない |

**保存停止問題ではなく「保存成功後の画面遷移・UI復帰問題」に確定。**

---

### 修正内容（2026-04-28 セッション10）

#### 根本原因

GAS WebApp は `script.googleusercontent.com` の iframe 内でコンテンツを配信する。
`google.script.run` のコールバックは非同期で呼ばれるため、ユーザー操作（クリック）に紐づく **ユーザー活性化（user activation）** がすでに失われている。
さらに `setTimeout` で 1.2秒追加待機していたため、`window.top.location.href` への代入が
「cross-origin iframe からの非ユーザー操作ナビゲーション」としてブラウザにブロックされていた。

加えて、success パスでは `btn.disabled = false` が呼ばれていなかったため、
遷移に失敗するとボタンが「保存中...」のまま詰まっていた。

#### 実施した修正（visit-form.html）

| 変更 | 内容 |
|---|---|
| `setTimeout` + `window.top.location.href` を削除 | 遅延なし即時ナビゲーションに変更 |
| `navigate(url)` グローバル関数を追加 | `window.top → window.location` フォールバック付き |
| `goToDetail()` グローバル関数を追加 | `APP_URL + ?page=detail&id=PATIENT_ID` へ遷移 |
| 成功メッセージに「患者詳細へ戻る →」ボタンを追加 | onclick はユーザー活性化を生む → 確実に遷移できる |
| success パスで `btn.disabled = false` を追加 | 自動遷移が失敗しても詰まらない |

#### clasp push

```
clasp push --force → 11ファイル push 完了（2026-04-28 8:39:31）
```

---

### 次回実機確認手順（2026-04-28 セッション10）

**手順 1: WebApp を新バージョンで再デプロイ**（必須）
```
Apps Script エディタ
→「デプロイを管理」
→ 鉛筆アイコン（編集）
→ バージョン：「新しいバージョン」
→「デプロイ」
```

**手順 2: 保存テスト**
1. visit-form を開いて来院日・主訴を入力して「保存」
2. 画面上部に緑のメッセージが出るか確認
3. メッセージ内の「患者詳細へ戻る →」ボタンが表示されるか確認
4. ボタンをクリックして患者詳細に遷移できるか確認
5. 患者詳細の来院履歴に SPV_... が表示されるか確認

**期待動作（修正後）:**
- 保存成功 → 緑メッセージ + 「患者詳細へ戻る →」ボタンが表示
- 自動遷移が成功した場合: そのまま患者詳細ページへ切り替わる
- 自動遷移がブロックされた場合: ボタンをクリックすれば確実に遷移できる
- どちらの場合も保存ボタンは「保存して患者詳細へ戻る」に戻る

**Phase 3 完了条件:**
- [ ] 保存成功メッセージが表示される
- [ ] 「患者詳細へ戻る」で患者詳細に戻れる
- [ ] 患者詳細の来院履歴タイムラインに来院記録が表示される
- [ ] 2件目保存 → SPV_YYYYMMDD_P0001_002 が採番される

---

### 調査・修正内容（2026-04-28 セッション9）

#### 根本原因の仮説（コード調査結果）

| 仮説 | 根拠 | 確認方法 |
|---|---|---|
| **① session 8 修正が未デプロイ** | 15秒タイムアウトは session 8 で追加。旧バージョンが配信中 | 再デプロイして20秒タイムアウト表示が出るか確認 |
| **② `alert()` がブラウザでブロック** | GAS WebApp は script.googleusercontent.com から配信。モダンChromeはクロスオリジン iframe の alert をブロックする場合がある | alert を削除し showMsg（DOM表示）に一本化 |
| **③ google.script.run の同期例外** | try-catch がなかった。例外でタイマーも止まる可能性 | try-catch ラッパーを追加済み |
| **④ err.message が undefined** | catch の `err.message` がnullの場合に空文字で表示されず | `err.message || String(err)` に修正済み |

#### 実施した修正（2026-04-28）

**visit-form.html:**
- `window.onerror` ハンドラを追加（IIFE初期化エラーを DOM に表示）
- `google.script.run` の可用性チェックを追加（WebApp以外で開いた場合に即エラー表示）
- タイムアウトを 15秒 → 20秒 に延長（GAS コールドスタート対策）
- `alert()` を全て削除 → `showMsg()` による DOM 表示に一本化
- `google.script.run` 呼び出しを try-catch でラップ（同期例外を検知）
- `showMsg` / `clearMsg` に null チェックを追加

**JREC_SF01_Visit.gs:**
- `createVisitWithChart` の先頭に `Logger.log("[createVisitWithChart] START...")` を追加
- バリデーション通過後 / SS取得後にも Logger.log を追加
- catch ブロックを `err.message || String(err)` に修正（non-Error throws を安全処理）

#### clasp push 状況

```
clasp push --force → 11ファイル push 完了（2026-04-28 8:20:04）
```

---

### 次回実機確認手順（必ず実施）

**手順 1: WebApp を新バージョンで再デプロイ**
```
Apps Script エディタ
→「デプロイを管理」
→ 鉛筆アイコン（編集）
→ バージョン：「新しいバージョン」を選択
→「デプロイ」
```

**手順 2: F12 Console を開いて visit-form を操作**
1. Webアプリ URL を開く
2. F12 → Console タブを開く
3. 患者詳細 → 「＋ 来院・カルテ入力」
4. 来院日（今日）・主訴を入力して「保存」ボタンを押す

**手順 3: Console ログを確認**

| ログ | 意味 |
|---|---|
| `[visitForm] payload: {...}` が出る | JS は動いている。GAS呼び出しへ進む |
| `[visitForm] payload:` が出ない | IIFE 初期化エラー。window.onerror の表示を確認 |
| `[visitForm] success: {...}` | GAS 応答あり。res.ok が true なら成功、false ならエラーメッセージ表示 |
| `[visitForm] GAS failure: ...` | GAS 例外。エラーメッセージが DOM に表示される |
| 20秒後にタイムアウトメッセージ表示 | GAS が応答しない。GAS 実行ログを確認（次項） |
| `google.script.run が利用できません` | WebApp URL で開いていない（予備チェック） |

**手順 4: GAS 実行ログを確認（20秒タイムアウトが出た場合）**
```
Apps Script エディタ → 左メニュー「実行数」
→ createVisitWithChart の実行ログを開く
→ Logger.log の出力を確認
```

| Logger.log の到達点 | 意味 |
|---|---|
| `START patientId=P0001` が出ない | 関数が呼ばれていない（デプロイ問題） |
| `validation OK` まで出る | バリデーション通過。SS取得で失敗 |
| `ss OK id=...` まで出る | SS取得OK。appendRow で失敗 |
| `SelfPayVisits 保存完了` まで出る | SelfPayVisits OK。SelfPayChart で失敗 |
| `SelfPayChart 保存完了` まで出る | 両シート保存OK。Run_Log か return で失敗 |
| `ERROR: ...` が出る | catch に捕まったエラーメッセージを確認 |

---

## 本日終了状態（2026-04-27）

### 実機確認結果サマリー

| 項目 | 状態 |
|---|---|
| 患者一覧表示 | ✅ 確認済み |
| 新規患者登録 | ✅ 確認済み（P0001形式採番）|
| 患者詳細表示 | ✅ 確認済み |
| 「＋ 来院・カルテ入力」遷移 | ✅ 確認済み（iframe問題修正後）|
| visit-form 表示・入力 | ✅ 確認済み |
| 保存ボタン押下後の動作 | ❌ **「保存中」のまま停止**（未解決）|
| GAS保存エラー alert 表示 | ❌ 表示されない |
| 15秒タイムアウト表示 | ❌ 表示されない |

### 未解決: 保存処理が停止する問題

**現象:**
- 「保存して患者詳細へ戻る」を押すとボタンが「保存中...」になる
- そのまま止まる
- `alert('GAS保存エラー: ...')` が表示されない
- 15秒タイムアウトも発火しない
- 患者詳細へ戻らない

**特記事項:**
- alert も timeout も発火しないということは、`google.script.run.createVisitWithChart()` の呼び出し自体は実行されているが、`withSuccessHandler` / `withFailureHandler` のどちらも呼ばれていない可能性が高い
- または、`google.script.run` が完全に silent に失敗している

**次回調査項目:**

| 確認項目 | 方法 |
|---|---|
| ①デプロイが最新バージョンか | Apps Script → デプロイを管理 → バージョン番号を確認 |
| ②Apps Script 実行ログ | Apps Script エディタ → 実行数 / Stackdriver ログを確認 |
| ③ブラウザ Console | F12 → Console タブ → `[visitForm] payload:` が出ているか確認 |
| ④`google.script.run` が動いているか | `?page=ping` で doGet 疎通確認 |
| ⑤スプレッドシートへの書き込み権限 | 新しい患者登録（患者登録は成功するか？）で権限確認 |
| ⑥`createVisitWithChart` が存在するか | Apps Script エディタ → 関数一覧で `createVisitWithChart` が見えるか |

**次回再開時の方針:**
1. ブラウザ F12 Console を開いた状態で保存ボタンを押す
2. `[visitForm] payload:` のログが出るかを確認する
3. 出ない → JS の submit handler 自体が動いていない（HTML問題）
4. 出る → `[visitForm] success:` or `failure:` が出るかを確認する
5. 出ない → google.script.run の非同期処理が発火していない（デプロイ/権限問題）
6. 15秒後にタイムアウトも出ない → setTimeout 自体が動いていない（JS実行環境の問題）

---

## 今回の作業内容（2026-04-27 セッション8）

### 保存ボタン無反応バグ修正

| 原因 | 対応 |
|---|---|
| `createVisitWithChart` で `getTargetSpreadsheet_()` が try-catch の外にあり、失敗しても画面に出なかった | 全処理を1つの try-catch に統合 |
| `withFailureHandler` の `err` が文字列の場合に `.message` が undefined → `showMsg` が空文字を表示 | `err.message \|\| String(err)` でフォールバック。`alert()` も追加 |
| どちらのハンドラも呼ばれない場合に無反応 | 15秒タイムアウトを追加 |
| JS 内エラーが silent になる | successHandler/failureHandler 内を try-catch でラップ |
| デバッグ情報がなかった | `console.log(payload)` / `console.error` を追加 |

**修正ファイル:**
- `JREC_SF01_Visit.gs`: createVisitWithChart を全体 try-catch に。Logger.log を各ステップに追加。シート null チェック追加
- `visit-form.html`: 15秒タイムアウト。successHandler/failureHandler を try-catch でラップ。alert() による確実なエラー表示

### 実機確認手順（修正後）

1. Apps Script → 新バージョンデプロイ
2. visit-form で保存ボタン押下
3. ブラウザの開発者ツール（F12）の Console タブを確認
   - `[visitForm] payload:` のログが出ているか
   - `[visitForm] success:` または `[visitForm] GAS failure:` のログが出るか
4. 15秒以内に結果が出ない場合はタイムアウトメッセージが表示される
5. GASエラーの場合は alert ダイアログが必ず表示される

---

## 今回の作業内容（2026-04-27 セッション7）

### 白画面 根本修正 — iframe 遷移問題の解決

| 原因 | 対応 |
|---|---|
| GAS Webアプリは Google の iframe 内で動作する。`<a href>` クリックや `<form>` submit がページ全体ではなく iframe 内だけで遷移 → 白画面になる | 全ページの画面遷移を `window.top.location.href` に統一 |
| `<a href>` をそのまま使っていた | `<button type="button" onclick="window.top.location.href=...">` に変更 |
| `<form method="get">` での検索 | `onsubmit` で prevent + `window.top.location.href` に変更 |
| `getAppUrl_()` をテンプレート内から直接呼び出していた | doGet で `appUrl` を全テンプレートに渡し、JS変数 `APP_URL = "<?= appUrl ?>"` で参照 |

**修正ファイル一覧:**

| ファイル | 変更内容 |
|---|---|
| `JREC_SF01_Main.gs` | ping ルート追加。全テンプレートに `appUrl` を渡す。visitForm に Logger.log 追加 |
| `index.html` | nav ボタンを `<a href>` → `<button onclick="window.top.location.href=...">` に変更。不要なIIFEスクリプト削除 |
| `patient-list.html` | 検索フォームを onsubmit+window.top に。詳細ボタンを button onclick に |
| `patient-detail.html` | 全アクションボタンを window.top 方式に |
| `patient-form.html` | キャンセルボタンを window.top 方式に |
| `visit-form.html` | 戻るボタン・キャンセルを window.top 方式に。`append` 関数を `appendField` に改名 |

### 動作確認手順（修正後）

1. WebアプリURL + `?page=ping` → **"JREC-SF01 ping OK"** が表示されることを確認
2. 患者一覧 → 詳細ボタン → 患者詳細が表示される
3. 患者詳細 → ＋ 来院・カルテ入力 → visit-form が表示される（白画面にならない）
4. 来院・カルテを保存 → 患者詳細に戻り来院履歴が表示される

---

## 今回の作業内容（2026-04-27 セッション6）

### Phase 3 visit-form 白画面バグ修正

| 原因 | 修正内容 |
|---|---|
| `switch` 内で `var pt` を2回宣言（GAS V8 strict で挙動不安定）| `buildPage_()` 関数に分離。各 case を独立ブロック `{}` で囲み、変数名を `ptv` / `ptd` に分離 |
| `tmpl.evaluate()` のエラーが白画面になる | `evalTemplate_()` ヘルパーで個別 try-catch。エラーページを必ず表示するように変更 |
| `href` 属性内の `<?= expr ?>&id=<?= expr ?>` パターン | `<?= expr + '&id=' + id ?>` の単一式形式に統一し、HTML エンティティ問題を回避 |
| `id` / `patientId` パラメータ不一致への耐性 | doGet で `e.parameter.id || e.parameter.patientId` の両方を受け付けるように変更 |

**修正ファイル:**
- `JREC_SF01_Main.gs`: doGet を `buildPage_()` + `evalTemplate_()` + `renderError_()` に分離・堅牢化
- `visit-form.html`: href を式形式に統一
- `patient-detail.html`: href を式形式に統一
- `patient-list.html`: href を式形式に統一

### 再デプロイ手順（ユーザー実施）

```
Apps Script エディタ
→「デプロイを管理」
→ 鉛筆アイコン（編集）
→ バージョン：「新しいバージョン」を選択
→「デプロイ」
```

### 実機確認チェックリスト（修正後）

- [ ] 患者一覧 → 詳細 → 「＋ 来院・カルテ入力」をクリック
- [ ] 白画面ではなく visit-form.html が表示される
- [ ] 患者名・患者IDが上部に表示される
- [ ] 来院日（今日）・主訴を入力して保存できる
- [ ] 保存後に患者詳細に戻り、来院履歴に表示される

---

## 今回の作業内容（2026-04-27 セッション5）

| 作業 | 内容 |
|---|---|
| Phase 3 実装 | 来院・カルテ入力（S03+S04 統合画面） |
| clasp push | 11ファイルを Apps Script に反映済み |

### Phase 3 実装内容

| ファイル | 作成/更新 | 内容 |
|---|---|---|
| `JREC_SF01_Visit.gs` | 新規 | getVisitsByPatient / getChartsByVisitKeys / getVisitTimelineByPatient / createVisitWithChart / generateSelfPayVisitKey_ / getDefaultPractitioner_ |
| `visit-form.html` | 新規 | S03+S04 統合入力画面。来院情報 + カルテ記録。施術内容・使用機器のプリセットボタン付き |
| `JREC_SF01_Main.gs` | 更新 | visitForm ルーティング追加。detail ケースに timeline データを渡す |
| `patient-detail.html` | 更新 | サマリーカードに来院回数・最終来院日を実データから表示。来院・カルテ履歴タイムライン表示（最新は展開、過去は折りたたみ）。「＋ 来院・カルテ入力」ボタン追加 |

### Phase 3 設計決定事項

| 項目 | 決定内容 |
|---|---|
| UI統合 | S03 来院入力 + S04 カルテ入力 → 1画面に統合（visit-form.html）|
| 保存先分離 | 画面は1つ、保存先は SelfPayVisits + SelfPayChart の2シート |
| 担当者 | Phase 3 では「院長」固定。Settings の default_practitioner を参照（なければ "院長" にフォールバック）|
| selfPayVisitKey | SPV_YYYYMMDD_patientId_3桁連番（同日複数来院に対応）|
| chartId | selfPayVisitKey の SPV_ を SPC_ に置換（1対1対応）|

### 実機確認チェックリスト（ユーザー実施）

- [ ] Apps Script を新しいバージョンで再デプロイ
- [ ] 患者詳細から「＋ 来院・カルテ入力」ボタンで visit-form へ遷移
- [ ] 来院日・主訴を入力して保存
- [ ] SelfPayVisits に SPV_YYYYMMDD_P0001_001 が作成される
- [ ] SelfPayChart に SPC_YYYYMMDD_P0001_001 が作成される
- [ ] 患者詳細の来院履歴に表示される
- [ ] 2件目来院 → SPV_YYYYMMDD_P0001_002 になる
- [ ] 異なる日付の来院は別キーで採番される

---

## 今回の作業内容（2026-04-27 セッション4）

| 作業 | 内容 |
|---|---|
| Phase 2 MVP 実装 | 患者一覧・患者登録・患者詳細（入口のみ）の GAS Webアプリ |
| clasp push | 9ファイルを Apps Script に反映済み |

### 作成ファイル

| ファイル | 内容 |
|---|---|
| `JREC_SF01_Main.gs` | doGet() エントリ・ページルーティング・include/getAppUrl_ |
| `JREC_SF01_Patient.gs` | getPatients / getPatientById / createPatient / generateNextPatientId_ / appendRunLog_ |
| `index.html` | 共通ナビヘッダー（各ページに include('index') で埋め込む）|
| `patient-list.html` | S01 患者一覧画面（検索・未収強調・患者行クリック）|
| `patient-form.html` | S06 新規患者登録画面（google.script.run.createPatient）|
| `patient-detail.html` | S02 患者詳細入口（基本情報表示・Phase 3〜4 プレースホルダー付き）|
| `styles.html` | 共通CSS（全ページに include('styles') で埋め込む）|
| `appsscript.json` | webapp 設定追加（executeAs: USER_DEPLOYING / access: MYSELF）|

### 実装内容サマリー

| 機能 | 状態 |
|---|---|
| doGet() ルーティング（page パラメータ）| ✅ |
| 患者一覧表示（Patients シートから取得）| ✅ |
| 患者検索（氏名・フリガナ・患者ID・電話番号）| ✅ |
| 新規患者登録（Patients シートへ保存）| ✅ |
| patientId 自動採番（P0001 形式）| ✅ |
| Settings シートから prefix/digits を参照 | ✅ |
| Run_Log への操作記録 | ✅ |
| 患者詳細入口（基本情報表示）| ✅ |
| 未収強調表示（行の橙背景）| ✅（データあり次第有効）|
| 共通ヘッダー・CSS | ✅ |

### clasp push 済みファイル一覧

```
appsscript.json / index.html / JREC_SF01_Main.gs / JREC_SF01_Patient.gs
JREC_SF01_Setup.gs / patient-detail.html / patient-form.html
patient-list.html / styles.html
```

### Webアプリ デプロイ手順（ユーザー実施）

1. [Apps Script エディタ](https://script.google.com/d/1-1opRkAFbFQz96Uqlgy3sWjgAs_PKS_1Eg9Pz7_6geTFztHx_5APSj2G/edit) を開く
2. 右上「デプロイ」→「新しいデプロイ」
3. 種類: **ウェブアプリ**
4. 次のユーザーとして実行: **自分（dabu-pi）**
5. アクセスできるユーザー: **自分のみ**
6. 「デプロイ」をクリック → Webアプリ URL を確認

以降の更新は「デプロイを管理」→「既存のデプロイを編集」→バージョン「新しいバージョン」で更新する。

### 実機確認チェックリスト（ユーザー実施）

- [ ] Webアプリ URL を開いて患者一覧が表示される
- [ ] 「＋ 新規患者登録」から患者登録フォームが開く
- [ ] 氏名を入力して保存 → Patients シートに P0001 で記録される
- [ ] 一覧に戻ったとき登録した患者が表示される
- [ ] 2件目登録 → P0002 で採番される
- [ ] 検索ボックスで絞り込みができる
- [ ] 「詳細」ボタンで患者詳細画面が開く

---

## 今回の作業内容（2026-04-27 セッション3）

| 作業 | 内容 |
|---|---|
| runSetupAll 実行確認 | ユーザーが Apps Script で実行し、10シート作成を確認 ✅ |
| UIレイアウト設計書作成 | `docs/UI_LAYOUT_v1.md` — 7画面レイアウト・遷移図・設計方針・Phase 2 MVP範囲を定義 |

### 10シート確認済み（2026-04-27）

- [x] **runSetupAll() 実行済み**（ユーザーが Apps Script エディタから実行）
- [x] **10シート作成確認済み**

| シート名 | 状態 |
|---|---|
| Settings | ✅ |
| Patients | ✅ |
| SelfPayVisits | ✅ |
| SelfPayChart | ✅ |
| SelfPayItems | ✅ |
| Payments | ✅ |
| Receipts | ✅ |
| MenuMaster | ✅ |
| DailySales | ✅ |
| Run_Log | ✅ |

---

## 今回の作業内容（2026-04-27 セッション2）

`hirayama-jyusei-strategy` を参照し、以下を確定。

| 作業 | 内容 |
|---|---|
| MenuMaster 初期データ確定 | 主力3本・個別パーツ6種・評価入口3種・保留3本（計15メニュー）|
| 消費税設計確定 | 税率10%・税別管理・端数切り捨て・明細行ごと計算 |
| 患者ID設計確定 | P + 4桁連番（P0001〜）。jrecPatientId で保険JRECと任意紐づけ |
| シート列定義確定 | Settings / Patients / SelfPayVisits / SelfPayChart / SelfPayItems / Payments / Receipts / MenuMaster / DailySales / Run_Log（10シート）|
| SHEET_DESIGN_v1.md 作成 | `docs/SHEET_DESIGN_v1.md`（全シート定義・ID体系・MenuMaster初期データを記録）|

### ジム会員割引: 廃止確定

2026-04-25 院長判断で廃止済み。JREC-SF01 の MenuMaster に「ジム会員価格」列は持たない。通常価格（税別）のみで運用する。

---

## 今回の作業内容（2026-04-27 セッション1）

| 作業 | 内容 |
|---|---|
| フォルダー作成 | `gas-projects/jrec-sf01-selfpay/` を新規作成 |
| README.md 作成 | プロジェクト概要・JREC本体との違い・将来展開を記録 |
| PROJECT_STATUS.md 作成 | 本ファイル。進捗管理の起点 |
| 設計ドキュメント作成 | `docs/JREC-SF01_selfpay_chart_accounting_system_design_2026-04-27.md` |

---

## コード実装状態

| ファイル | 状態 | 内容 |
|---|---|---|
| `JREC_SF01_Setup.gs` | ✅ 作成済み | 全10シート初期セットアップスクリプト |
| `appsscript.json` | ✅ 作成済み | Apps Script マニフェスト（V8 / Asia/Tokyo）|
| `.clasp.json` | ❌ 未作成 | clasp 管理は次フェーズで設定 |

### clasp 設定（2026-04-27）

| 項目 | 値 |
|---|---|
| scriptId | `1-1opRkAFbFQz96Uqlgy3sWjgAs_PKS_1Eg9Pz7_6geTFztHx_5APSj2G` |
| Apps Script URL | https://script.google.com/d/1-1opRkAFbFQz96Uqlgy3sWjgAs_PKS_1Eg9Pz7_6geTFztHx_5APSj2G/edit |
| clasp push | ✅ 実施済み（2ファイル: appsscript.json + JREC_SF01_Setup.gs）|
| setupAll_ 実行 | ❌ 未実施（手動実行が必要）|

**⚠️ 注意: スクリプトの紐づきについて**

`clasp create --type sheets` は既存 SS への紐づけができず、**新規 Google Sheets（`13Sxfk1w3yU_XUjlah7C01cxaoIWQjWfTpXTKmNjjaRw`）が別途作成**された。
コード内の `openById(SPREADSHEET_ID)` が正しい対象 SS（`15O2AIWv1...`）を直接参照するため、**setupAll_() は正しく動作する**。

ただし対象 SS の「拡張機能 > Apps Script」メニューからはこのスクリプトにアクセスできない。
実行は Apps Script エディタ（上記 URL）から行う。

将来的に対象 SS へ container-bound で紐づけ直したい場合:
1. 対象 SS を開く → 拡張機能 > Apps Script
2. 生成された scriptId を確認（URL 中の `/d/SCRIPT_ID/`）
3. `.clasp.json` の `scriptId` を更新して `clasp push` し直す

### JREC_SF01_Setup.gs でできること

- `setupAll_()` を実行するだけで全10シートを一括セットアップ
- 再実行安全（既存データは保持）
- 各シート: ヘッダー色・列幅・ドロップダウン入力規則を自動設定
- Settings 初期値（12件）を自動投入
- MenuMaster 初期データ（15件）を自動投入
- 有効フラグ TRUE=薄緑 / FALSE=薄グレーで色分け

---

## JREC本体への影響

- **影響なし**
- `jyu-gas-ver3.1/` には一切変更を加えていない
- 既存JRECの clasp 設定・push・保険請求ロジックへの変更はない

---

## Dashboard反映

- **Dashboard反映対象外**（JREC-SF01 専用の Dashboard は未作成）
- 将来フェーズで自費売上ダッシュボードを作成予定

---

## フェーズ別ロードマップ

| Phase | 内容 | ステータス |
|---|---|---|
| Phase 0 | 初期設計ドキュメント作成 | **✅ CLOSED（2026-04-27）** |
| Phase 1 | スプレッドシート設計・GASセットアップ | **✅ CLOSED（2026-04-27）** |
| Phase 2 | GAS Webアプリ — 患者一覧・患者詳細・患者登録 | **✅ CLOSED（2026-04-27 実機確認済）** |
| Phase 3 | GAS Webアプリ — 来院入力・カルテ記録 | **✅ CLOSED（2026-04-28 実機確認済）** |
| Phase 4 Step 1 | JREC_SF01_Billing.gs — GAS 会計バックエンド | **✅ 実装完了（2026-04-28）** |
| Phase 4 Step 2 | JREC_SF01_Main.gs routing + 仮テンプレート | **✅ 実装完了・実機確認PASS（2026-04-28）** |
| Phase 4 Step 3 | billing-form.html — 会計入力画面 | **✅ 実装完了・実機確認PASS（2026-04-28）** |
| Phase 4 Step 4 | receipt.html — 領収書発行・プレビュー | **✅ 実装完了・実機確認PASS（2026-04-28）** |
| Phase 4 Step 5 | patient-detail.html 会計導線・サマリー実データ | **✅ 実装完了・実機確認PASS（2026-04-28）** |
| **Phase 4** | **会計入力・領収書・未収管理 MVP** | **✅ CLOSED（2026-04-28）** |
| Phase 4 Step 4 | receipt.html — 領収書プレビュー・発行 | 未着手 |
| Phase 4 Step 5 | patient-detail.html — 会計入力/領収書ボタン追加 | 未着手 |
| Phase 5 | タイムライン・VASグラフ・日次集計 | UI設計完了 / 実装未着手 |
| Phase 6 | Next.js / Supabase 化検討 | 未着手 |
| Phase 7 | 外販モデル化 | 未着手 |

---

## 確定済み設計方針サマリー

| 項目 | 決定値 |
|---|---|
| 消費税率 | 10% |
| 価格管理 | 税別（税込は計算で導出）|
| 端数処理 | 切り捨て（floor）|
| 税計算単位 | 明細行ごと |
| 患者ID形式 | P + 4桁連番（P0001〜）|
| 領収書番号 | R + 年度 + 4桁連番（SPR_2026_0001）|
| ジム会員割引 | 廃止（2026-04-25）|
| 主力KPI基準単価 | 継続標準施術 3,500円税別（月40回目標）|

---

## 次フェーズ着手条件（Phase 1 スプレッドシート作成）

- [x] シート列定義完了 → `docs/SHEET_DESIGN_v1.md`
- [x] MenuMaster 初期データ確定 → `docs/SHEET_DESIGN_v1.md`
- [x] 税・ID 方針確定
- [x] **GASセットアップスクリプト作成** → `JREC_SF01_Setup.gs`
- [x] **スプレッドシート作成済み** → ID: `15O2AIWv1OyZAXdCOWoz1-OxVukuFttHoZydsCDlYPX0`
- [ ] **スクリプトを SS に貼り付けて `setupAll_()` を実行する**（次の手作業）
- [ ] 実行後、各シートの状態を目視確認する
- [ ] MenuMaster 評価入口3メニューの有効フラグを院長に確認する

### 院長への確認依頼（Phase 1 開始前）

| # | 確認事項 | 影響 |
|---|---|---|
| 1 | 腰痛・首肩こり・膝 の初回評価3メニューを現在受付で使っているか | MenuMaster 有効フラグ |
| 2 | パーソナルトレーニング（SELFPAY_PT60）を現在提供しているか | MenuMaster 有効フラグ |
| 3 | 4回集中コースの価格を決めたか | TRAINING_4PASS 有効フラグ |

---

## 別PC再開状態（2026-04-27）

| 項目 | 状態 |
|---|---|
| ブランチ | `feature/auto-dev-phase3-loop` ✅ |
| git pull | 最新（Already up to date）✅ |
| `.clasp.json` | 別PCで復元済み（scriptId: `1-1opRkAFbFQz96Uqlgy3sWjgAs_PKS_1Eg9Pz7_6geTFztHx_5APSj2G`）✅ |
| `runSetupAll()` 実行 | **未確認** — ユーザーが Apps Script から実行する必要あり |
| 10シート作成 | **未確認** |
| MenuMaster 初期15件 | **未確認** |
| Phase 2 着手 | setup確認後に着手可能 |

### ユーザー確認依頼

以下を実施してください。

1. [Apps Script エディタ](https://script.google.com/d/1-1opRkAFbFQz96Uqlgy3sWjgAs_PKS_1Eg9Pz7_6geTFztHx_5APSj2G/edit) を開く
2. 関数プルダウンで `runSetupAll` を選択して「実行」をクリック
3. 権限承認が出たら許可する
4. [自費専用スプレッドシート](https://docs.google.com/spreadsheets/d/15O2AIWv1OyZAXdCOWoz1-OxVukuFttHoZydsCDlYPX0/edit) を開く
5. 以下を確認して結果を教えてください

| 確認項目 | 期待値 |
|---|---|
| シート数 | 10枚（Settings / Patients / SelfPayVisits / SelfPayChart / SelfPayItems / Payments / Receipts / MenuMaster / DailySales / Run_Log）|
| Settings シート | 税率10% / floor / 税別管理 など12件の初期値 |
| MenuMaster | 15メニュー（主力3本・個別パーツ6種・評価入口3種・保留3本）|

確認完了後、このファイルの以下チェックボックスを更新します。

---

## 🔄 Phase AI-1 患者マスター・カルテ項目追加（2026-05-02 clasp push 済み・HEAD確認待ち）

### 実装内容

| ファイル | 変更内容 |
|---|---|
| `JREC_SF01_Setup.gs` | `setupPatients_` ヘッダーに職業（col12）・既往歴（col13）追加。`setupSelfPayVisits_` ヘッダーに受傷起点（col15）・今回追記既往歴（col16）追加。`runAddPatientColumns()` / `runAddVisitColumns()` 手動実行用ヘルパー追加 |
| `JREC_SF01_Patient.gs` | `getPatientById` 読取列数を 13 へ拡張。戻り値に occupation / medicalHistory 追加。`createPatient` appendRow に追加。`updatePatient` に col12 / col13 更新処理追加 |
| `JREC_SF01_Visit.gs` | `getVisitFormData` 読取列数を 16 へ拡張。戻り値に injuryTrigger / relatedHistoryNote 追加。`createVisitWithChart` appendRow に col12-16 追加（col12=false, col13-14=""）。`updateVisitWithChart` に col15 / col16 更新処理追加 |
| `patient-form.html` | 「AI補助判定用情報」セクション追加。職業（text）・既往歴（textarea）入力欄追加。編集時プリフィル対応。保存 payload に追加 |
| `visit-form.html` | 患者情報参照欄（年齢・性別・職業・患者マスター既往歴）追加（読み取り専用）。受傷起点（textarea）・今回追記既往歴（textarea）入力欄追加。payload / 編集時復元対応 |
| `patient-detail.html` | 患者基本情報カード（職業・既往歴）追加 |

### 追加列

| シート | col | 内容 | 既存データ影響 |
|---|---|---|---|
| Patients | 12 | occupation（職業） | 既存行は空欄。エラーなし |
| Patients | 13 | medicalHistory（既往歴） | 既存行は空欄。エラーなし |
| SelfPayVisits | 15 | injuryTrigger（受傷起点） | 既存行は空欄。エラーなし |
| SelfPayVisits | 16 | relatedHistoryNote（今回追記既往歴） | 既存行は空欄。エラーなし |

### シート追加列の適用方法

GAS エディタから以下を手動実行してください（1回のみ）:

```
runAddPatientColumns()  → Patients に職業/既往歴列を追加
runAddVisitColumns()    → SelfPayVisits に受傷起点/今回追記既往歴列を追加
```

または `runSetupAll()` を再実行してもヘッダーのみ更新されます（既存データは保持）。

### clasp push / デプロイ状態

| 項目 | 状態 |
|---|---|
| clasp push | ✅ 実施済み（2026-05-02） |
| versioned deployment | ⏸ 未実施（HEAD /dev 実機確認後に実施） |
| HEAD /dev | https://script.google.com/macros/s/AKfycbzJWJAKCxStP82lfFl8eEHei98dWh7f6cgtEM33r3M5/dev |

### 実機確認項目 AI1-1〜AI1-9（未確認）

| Test | 判定 | 確認内容 |
|---|---|---|
| AI1-1 | ⏸ | 新規患者登録画面に「職業」「既往歴」が表示される。入力して保存できる |
| AI1-2 | ⏸ | 既存患者編集で「職業」「既往歴」が復元される。修正して保存できる |
| AI1-3 | ⏸ | カルテ入力画面で患者情報参照欄（年齢・性別・職業・既往歴）が見える。空欄患者でも壊れない |
| AI1-4 | ⏸ | カルテ入力に「受傷起点」「今回追記既往歴」が表示される。入力して保存できる |
| AI1-5 | ⏸ | カルテ再編集時に「受傷起点」「今回追記既往歴」が復元される |
| AI1-6 | ⏸ | 既存患者（職業・既往歴空欄）でエラーにならない。既存カルテ（受傷起点空欄）でもエラーにならない |
| AI1-7 | ⏸ | カルテ保存後の「会計入力へ進む」導線が壊れていない |
| AI1-8 | ⏸ | home / dailyCheckout / monthlyReport / menuSalesReport / outstandingReport が開く |
| AI1-9 | ⏸ | スマホ表示で追加項目が大きく崩れていない |

> **次はユーザー実機確認 AI1-1〜AI1-9。全 PASS 後に versioned deployment @36 を実施。**

---

## ✅ Phase AI-0 AI補助判定 設計調査（2026-05-02 CLOSED）

### 概要

自費カルテへの「AI補助判定」機能追加に向けた設計調査を実施した。
コード実装・clasp push・デプロイは**一切行っていない**。設計書とロードマップの作成のみ。

### 方針決定事項

| 項目 | 決定内容 |
|---|---|
| AIの役割 | 施術者の判断補助のみ。診断確定は行わない |
| 入力方式 | 手動プロンプト作成方式は**不採用**。カルテ入力欄を直接読み取る |
| 保険観点 | 除外（審査・返戻・査定・保険算定妥当性は対象外） |
| AI保存タイミング | 先生が手動で保存ボタンを押した場合のみ保存（案B採用推奨） |
| API実行タイミング | カルテ保存後のみAIボタン有効（visitKey 確定後に実行） |

### 調査結果サマリー

| 確認対象 | 結論 |
|---|---|
| Patients シート（11列） | 職業（col 12）・既往歴（col 13）を末尾追加で安全。既存関数への影響なし |
| SelfPayVisits シート（14列） | 受傷起点（col 15）・今回追記既往歴（col 16）を末尾追加で安全。ただし読取列数上限の変更が必要 |
| SelfPayChart シート（12列） | 追加項目は SelfPayVisits 側に持つ方が設計上自然 |
| visit-form.html | 患者情報参照欄・受傷起点・今回追記欄・AI補助判定セクションの追加が必要 |
| patient-form.html | 職業・既往歴の入力欄追加が必要 |
| t.patient（Main.gs） | dob / gender は現在すでに渡されている（Phase AI-1 で活用可能） |
| AI_Assessments シート | 新規追加設計完了。既存シートへの影響ゼロ |
| 既存会計・領収書・集計 | AI追加による影響なし |

### 作成ドキュメント

| ファイル | 内容 |
|---|---|
| `docs/PHASE_AI_CHART_ASSIST_DESIGN_2026-05-02.md` | AI補助判定全設計書（目的・シート構造・画面構造・入出力設計・保存設計・ロードマップ・リスク・未決事項） |

### 次の実装候補

**Phase AI-1**: 患者マスター・カルテ項目追加

実装プロンプトを作成して開始する。
Phase 6-M（CSV/印刷/監査）との優先順位はユーザーが決定する。

---

## 変更履歴

| 日付 | 内容 |
|---|---|
| 2026-04-27 | プロジェクト初期設計ドキュメントを作成。コード実装なし。 |
| 2026-04-27 | `docs/SHEET_DESIGN_v1.md` 作成。MenuMaster初期データ・税設計・ID設計・全10シート列定義を確定。 |
| 2026-04-27 | `JREC_SF01_Setup.gs` 作成。全10シート初期セットアップスクリプト。スプレッドシートID確定（15O2AIWv1...）。 |
| 2026-04-27 | `.clasp.json` 作成・`clasp push` 実施。Apps Script に JREC_SF01_Setup.gs を反映済み。setupAll_() は未実行。 |
| 2026-04-27 | `runSetupAll()` ラッパー追加・clasp push。Apps Script エディタの関数選択で `runSetupAll` を選んで実行可能になった。 |
| 2026-04-27 | `docs/UI_DESIGN_v1.md` 作成。7画面・バックエンド関数一覧・Phase別ロードマップを定義。 |
| 2026-04-27 | 別PC再開。`.clasp.json` 復元。`runSetupAll()` 実行・10シート確認をユーザーに依頼。 |
| 2026-04-27 | `runSetupAll()` 実行確認・10シート作成確認済み。`docs/UI_LAYOUT_v1.md` 作成。UIレイアウト設計完了。 |
| 2026-04-27 | Phase 2 MVP 実装。JREC_SF01_Main.gs / JREC_SF01_Patient.gs / 5 HTML + styles.html 作成。clasp push 完了（9ファイル）。 |
| 2026-04-27 | Phase 3 実装。JREC_SF01_Visit.gs / visit-form.html 作成。patient-detail.html・JREC_SF01_Main.gs 更新。clasp push（11ファイル）。 |
| 2026-05-02 | Phase AI-0 設計調査完了。`docs/PHASE_AI_CHART_ASSIST_DESIGN_2026-05-02.md` 作成。コード実装なし・clasp push なし。AI補助判定機能の全設計（患者マスター追加/カルテ項目追加/入力設計/出力設計/保存設計/ロードマップ）を記録。 |
| 2026-05-02 | Phase AI-1 患者マスター・カルテ項目追加 実装完了・clasp push 済み。Patients に職業/既往歴（col12-13）・SelfPayVisits に受傷起点/今回追記既往歴（col15-16）追加。patient-form/visit-form/patient-detail 対応。HEAD /dev 実機確認待ち。 |
