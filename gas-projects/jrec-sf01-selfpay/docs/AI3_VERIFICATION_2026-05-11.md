# Phase AI-3 検証記録 — 2026-05-11

## 検証概要

| 項目 | 結果 |
|---|---|
| 実施日 | 2026-05-11 |
| フェーズ | Phase AI-3: OpenAI API連携 |
| clasp push | ✅ 2026-05-11 済み（latest commit: 3cd4972） |
| OPENAI_API_KEY | ✅ ScriptProperties 設定済み確認（キー値は記録しない） |
| LiveCheck | ✅ 3 passed / 3 skipped / 0 failed |
| PII除外 | ✅ コードレビューで確認済み |
| 実機AIボタン確認 | ⏸ 未実施（次フェーズで実施） |
| versioned deploy @37 | ⏸ 未実施 |

---

## LiveCheck 詳細

**コマンド:** `npm run test:jrec:ai3`

**実行環境:** `tools/live-check-runner` / Playwright / auth.json（2026-05-11 再作成）

| テスト ID | 内容 | 結果 |
|---|---|---|
| AI3-1 | visitForm — #aiAssistCard 存在 + バッジ「AI評価補助（ベータ）」 | ✅ PASS (9.0s) |
| AI3-2 | visitForm — #aiAssistBtn 存在 + 初期 disabled | ✅ PASS (4.4s) |
| AI3-3 | 旧文言「Phase AI-3 で有効化予定」が表示されていない | ✅ PASS (4.2s) |
| AI3-H1 | OPENAI_API_KEY 設定後、カルテ保存 → AIボタン押下で結果表示 | SKIP（手動確認項目） |
| AI3-H2 | 結果カードに7セクションが表示される | SKIP（手動確認項目） |
| AI3-H3 | 個人情報がAIに送信されていない（GAS実行ログ確認） | SKIP（手動確認項目） |

**合計:** 3 passed / 3 skipped / 0 failed（29.0s）

---

## PII除外確認（コードレビュー）

**確認対象:** `JREC_SF01_Main.gs` — `runAIAssessment()` 関数

| 確認項目 | 状態 | 根拠 |
|---|---|---|
| 氏名（name/kana）送信なし | ✅ | inputData に含まれない |
| 住所（address）送信なし | ✅ | inputData に含まれない |
| 電話番号（phone）送信なし | ✅ | inputData に含まれない |
| 生年月日（dob）送信なし | ✅ | age/ageBand に変換して送信 |
| jrecPatientId 送信なし | ✅ | inputData に含まれない |
| L398 コメントで除外明示 | ✅ | `// 送信しない情報: name / kana / phone / address / dob / jrecPatientId` |
| API Key ログ出力なし | ✅ | Logger に apiKey 出力なし |
| API Key をコード/ドキュメントに記録なし | ✅ | ScriptProperties からのみ取得 |

**送信するデータ（inputData）:**
```
patientContext: { age, ageBand, sex, occupation, medicalHistory }
visitContext:   { visitDate, visitType, chiefComplaint, vas, injuryTrigger,
                  relatedHistoryNote, assessment, findings, treatment, lifestyle, nextPlan }
```

---

## 実機確認（未実施・次作業）

以下は実機での確認が必要な手動確認項目（AI3-H1〜H3）:

1. **AI3-H1:** `/dev` URL で患者 P0001 のカルテを開き、保存後に「AI評価補助」ボタンを押下。数十秒後に結果が表示されることを確認。
2. **AI3-H2:** 結果カードに「評価の観点整理 / 鑑別の方向性 / 危険サイン確認 / 追加問診候補 / 施術方針案 / 受診勧奨の目安 / カルテ下書き」7セクションが表示されることを確認。
3. **AI3-H3:** GAS エディタ → 実行ログで `[runAIAssessment]` のログを確認。氏名 / 住所 / 電話 / 生年月日 / jrecPatientId が含まれていないことを確認。

---

## deploy 判断

- **@37 deploy 保留理由:** AI3-H1〜H3（実機AIボタン押下確認）が未実施のため。
- **@37 deploy 実施条件:** 実機確認 PASS 後に任意タイミングで実施。
- **既存 deploymentId（@36）:** `AKfycbxP9beCl8tZ4t41irDgFa-fg54KyDjt8-xM4ogefuwMaZ9Pmkx5-D7JvkLS_nn1G5utYA`

---

## Dashboard 反映

対象外（本タスクは LiveCheck / docs 更新のみ）

---

## 次回作業

1. `/dev` URL で実機AIボタン押下確認（AI3-H1〜H3）
2. GAS実行ログで PII 送信なしを目視確認
3. 確認 PASS 後に versioned deployment @37 を実施
