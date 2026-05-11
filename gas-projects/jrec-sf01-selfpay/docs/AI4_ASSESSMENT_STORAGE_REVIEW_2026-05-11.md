# Phase AI-4 AI補助判定保存・レビュー — 実装記録 2026-05-11

## 目的

AI評価補助の結果を一過性表示で終わらせず、AI_Assessments シートに自動保存する。
施術者があとから確認・レビューできる基盤を作る。

AIは参考情報であり、診断の確定ではない。最終判断は施術者が行う。

---

## 実装概要

| 項目 | 結果 |
|---|---|
| 実施日 | 2026-05-11 |
| フェーズ | Phase AI-4: AI補助判定保存・レビュー |
| ステータス | ✅ CLOSED |
| clasp push | ✅ 2026-05-11（最終: デバッグ修正後）|
| migrate 実行 | ✅ `runMigrateAddAIAssessmentsSheet()` 完了 |
| 実機確認 | ✅ 緑バナー表示 PASS（AI4-H2 2026-05-11） |
| LiveCheck ai4 | ✅ 4 passed / 4 skipped / 0 failed |
| LiveCheck ai3（回帰） | ✅ 3 passed / 3 skipped / 0 failed |
| @38 deploy | ✅ 本番反映済み（2026-05-11） |

---

## 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `JREC_SF01_Setup.gs` | `SHEET_NAMES.AI_ASSESSMENTS` 追加 / `setupAIAssessments_()` / `runMigrateAddAIAssessmentsSheet()` / `setupAll_()` に追加 |
| `JREC_SF01_Main.gs` | `saveAIAssessment_()` / `getAIAssessmentsByVisitKey()` / `runAIAssessment()` に保存呼び出し + `assessmentId` 返却 |
| `visit-form.html` | `displayAiResult(r, assessmentId)` 引数追加 / `#aiSavedBanner` 追加 / 成功ハンドラで `res.assessmentId` 受け取り |
| `tools/.../ai4.spec.ts` | AI4-1〜4 自動 + AI4-H1〜H4 手動 SKIP の LiveCheck spec 新規 |
| `tools/.../package.json` | `test:jrec:ai4` スクリプト追加 |

---

## AI_Assessments シート設計

| カラム | 内容 | PII |
|---|---|---|
| assessmentId | `ASMNT_YYYYMMDDHHmmssSSS`（一意） | なし |
| visitKey | 来院内部キー | なし |
| patientId | 患者内部キー（例: P0001） | なし（識別子のみ） |
| createdAt | 実行日時 | なし |
| model | 使用モデル（gpt-4o-mini） | なし |
| promptVersion | プロンプトバージョン（v1） | なし |
| outputJson | AI出力JSON（参考情報） | なし（個人情報は AIに送っていない） |
| reviewStatus | unreviewed / reviewed / adopted / dismissed | なし |
| reviewedAt | レビュー日時 | なし |
| reviewedBy | レビュー者 | なし |
| reviewNote | レビューメモ | なし |
| adoptedToChart | カルテに採用したか（bool） | なし |
| errorCode | エラーコード（失敗時） | なし |
| errorMessage | エラー詳細（失敗時） | なし |
| updatedAt | 更新日時 | なし |

**保存しない情報:** 氏名 / フリガナ / 住所 / 電話番号 / 生年月日 / jrecPatientId

---

## 実装の設計判断

| 判断 | 内容 |
|---|---|
| 自動保存 vs 手動保存 | **自動保存採用**（AI実行成功時に自動で1行追記。手動ボタンは不要） |
| 保存失敗時の挙動 | **fail-safe**: 保存失敗は Logger.log のみ。UI は壊さない |
| reviewStatus 初期値 | `unreviewed`（バナーに「レビュー未確認」バッジ表示） |
| assessmentId 形式 | `ASMNT_` + `Utilities.formatDate(now, "Asia/Tokyo", "yyyyMMddHHmmssSSS")` |
| inputSummaryJson 保存 | **非保存**（入力データは GAS ログにも残らない。プライバシー優先） |
| レビューUI（変更ボタン） | ⏸ Phase AI-5 で検討 |
| 過去AI判定の表示 | ⏸ Phase AI-5 で検討 |

---

## LiveCheck 詳細

**コマンド:** `npm run test:jrec:ai4`

| テスト ID | 内容 | 結果 |
|---|---|---|
| AI4-1 | #aiAssistCard が AI-4後も存在 | ✅ PASS |
| AI4-2 | #aiAssistBtn が AI-4後も初期 disabled | ✅ PASS |
| AI4-3 | #aiSavedBanner が初期状態では非表示 | ✅ PASS |
| AI4-4 | 回帰 — 旧文言なし | ✅ PASS |
| AI4-H1 | runMigrateAddAIAssessmentsSheet 実行確認 | SKIP（手動） |
| AI4-H2 | 保存バナー表示確認 | SKIP（手動） |
| AI4-H3 | AI_Assessments シートへの書き込み確認 | SKIP（手動） |
| AI4-H4 | 保存データの PII 除外確認 | SKIP（手動） |

---

## migrate 手順（人間作業・1回のみ）

1. GAS エディタを開く（スプレッドシート → 拡張機能 → Apps Script）
2. 関数プルダウンで **`runMigrateAddAIAssessmentsSheet`** を選択
3. ▶ 実行
4. 実行ログに `AI_Assessments シートを作成しました。` が出ることを確認
5. スプレッドシートに `AI_Assessments` シートが追加されていることを確認

---

## 実機確認手順（migrate 後）

1. `/dev` URL を開く
2. 患者のカルテを保存
3. 「AI評価補助を実行する」ボタンを押す
4. 結果カード上部に以下のバナーが表示されることを確認:
   - 「✔ AI評価補助結果を保存しました」
   - 「ID: ASMNT_xxxxxxxxxxxxxxx」
   - 「レビュー未確認」バッジ
5. スプレッドシートの `AI_Assessments` シートを開き、1行追記されていることを確認
6. `outputJson` 列に AI出力（JSON）が入っていること
7. `reviewStatus` が `unreviewed` であること

---

## PII 保存除外確認（コードレビュー）

| 確認項目 | 状態 |
|---|---|
| saveAIAssessment_ に name/kana/phone/address/dob/jrecPatientId なし | ✅ |
| outputJson は AI出力のみ（AI側には PII 送信なし） | ✅（AI-3 で確認済み） |
| assessmentId / visitKey / patientId は内部キーのみ | ✅ |
| API Key を outputJson や他フィールドに記録しない | ✅ |

---

## Dashboard 反映

対象外

---

## デバッグ経緯（初回実機確認 FAIL → 修正 → PASS）

### 症状
- AI評価補助の結果表示: PASS
- 保存バナー: 表示されない
- AI_Assessments シート: 記録なし

### 原因
`saveAIAssessment_()` 内で `SHEET_NAMES.AI_ASSESSMENTS` を参照していたが、
GAS webapp 実行コンテキストでは `SHEET_NAMES` グローバル変数が未解決となり、
`getSheetByName(undefined)` → null → 早期 return "" が発生していた。

### 修正
1. `SHEET_NAMES.AI_ASSESSMENTS` → `"AI_Assessments"` にハードコード（定数参照排除）
2. `saveAIAssessment_()` の戻り値を `string` → `{ ok, id, detail }` に変更（エラー伝播）
3. `runAIAssessment()` に `saveOk` / `saveDetail` を追加
4. `visit-form.html` に保存失敗時の黄色警告バナー追加（エラー詳細表示）

### 再確認結果
修正後の実機テストで緑バナー表示 PASS。AI_Assessments シートに記録確認。

---

## Versioned Deployment @38

| 項目 | 内容 |
|---|---|
| version | @38 |
| deploymentId | AKfycbxP9beCl8tZ4t41irDgFa-fg54KyDjt8-xM4ogefuwMaZ9Pmkx5-D7JvkLS_nn1G5utYA |
| /exec URL | https://script.google.com/macros/s/AKfycbxP9beCl8tZ4t41irDgFa-fg54KyDjt8-xM4ogefuwMaZ9Pmkx5-D7JvkLS_nn1G5utYA/exec |
| 説明 | @38 - Phase AI-4: AI_Assessments 保存・レビューバナー |
| 実施日 | 2026-05-11 |
| 既存URL | 維持（@37/@36 と同一 deploymentId） |

---

## 人間目視確認結果（2026-05-11）

| 確認項目 | 結果 |
|---|---|
| AI_Assessments シートに記録あり | ✅ PASS |
| assessmentId が `ASMNT_...` 形式 | ✅ PASS |
| visitKey: `SPV_20260511_P0001_001` | ✅ PASS |
| patientId: `P0001`（内部キーのみ） | ✅ PASS |
| createdAt 記録あり | ✅ PASS |
| model: `gpt-4o-mini-2024-07-18` | ✅ PASS |
| promptVersion: `v1` | ✅ PASS |
| 氏名・住所・電話・生年月日 非保存 | ✅（内部キーのみ確認） |

### 補足: 空行について

記録は 502行目以降に入っていた。

**原因:** `setupAIAssessments_()` 内で `applyDropdown_()` と `insertCheckboxes()` を行 2〜501（500行分）に事前適用。GAS の `appendRow` は入力規則・チェックボックスが設定された行も「データあり」とカウントするため、502行目が最初のデータ行になった。

**機能上の影響:** なし（記録は正常に行われる）。

**将来 cleanup 候補:**
- 事前検証・チェックボックス行数を削減（例: 50行）
- または `appendRow` → `setValues` 方式に変更
- 既存 500 空行は手動削除またはスクリプトで一括削除可能

---

## 次回作業

1. Phase AI-5: 運用改善（プロンプト調整・過去判定比較）
2. Phase 6-M: CSV / 印刷 / 監査レポート
3. AI_Assessments 空行 cleanup（任意タイミング・@38 後の cleanup 候補）
