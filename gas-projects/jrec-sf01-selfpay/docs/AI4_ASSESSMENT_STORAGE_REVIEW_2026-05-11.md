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
| ステータス | 🔄 実装完了 / migrate + 実機確認待ち |
| clasp push | ✅ 2026-05-11 |
| LiveCheck ai4 | ✅ 4 passed / 4 skipped / 0 failed |
| LiveCheck ai3（回帰） | ✅ 3 passed / 3 skipped / 0 failed |
| migrate 実行 | ⏸ 人間作業（GAS エディタで `runMigrateAddAIAssessmentsSheet()` を1回実行） |
| 実機確認 | ⏸ migrate 後に実施 |
| @38 deploy | ⏸ 実機確認 PASS 後 |

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

## 次回作業

1. GAS エディタで `runMigrateAddAIAssessmentsSheet()` を実行（シート作成）
2. 実機確認（AI4-H1〜H4）
3. 確認 PASS 後 versioned deployment @38
4. Phase AI-5 または Phase 6-M を検討
