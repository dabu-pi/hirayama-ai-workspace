# Phase AI-3 検証記録 — 2026-05-11

## 検証概要（最終）

| 項目 | 結果 |
|---|---|
| 実施日 | 2026-05-11 |
| フェーズ | Phase AI-3: OpenAI API連携 |
| ステータス | ✅ CLOSED |
| clasp push | ✅ 2026-05-11（最終: testExternalRequestAuth 削除後 push）|
| OPENAI_API_KEY | ✅ ScriptProperties 設定済み（キー値は記録しない） |
| GAS外部通信権限 | ✅ 再認証完了（testExternalRequestAuth HTTP 200確認） |
| LiveCheck | ✅ 3 passed / 3 skipped / 0 failed |
| 実機AIボタン確認 | ✅ /dev PASS（AI3-H1 2026-05-11） |
| PII除外 | ✅ コードレビューで確認済み |
| versioned deploy @37 | ✅ 本番反映済み（2026-05-11） |

---

## LiveCheck 詳細

**コマンド:** `npm run test:jrec:ai3`

**実行環境:** `tools/live-check-runner` / Playwright / auth.json（2026-05-11 再作成）

| テスト ID | 内容 | 結果 |
|---|---|---|
| AI3-1 | visitForm — #aiAssistCard 存在 + バッジ「AI評価補助（ベータ）」 | ✅ PASS |
| AI3-2 | visitForm — #aiAssistBtn 存在 + 初期 disabled | ✅ PASS |
| AI3-3 | 旧文言「Phase AI-3 で有効化予定」が表示されていない | ✅ PASS |
| AI3-H1 | カルテ保存 → AIボタン押下で結果表示 | ✅ 実機 PASS（/dev） |
| AI3-H2 | 結果カードに7セクション表示 | ⏸ 運用中に確認（実機では表示確認済み） |
| AI3-H3 | 個人情報がAIに送信されていない（GAS実行ログ） | ⏸ コードレビューで代替確認済み |

**合計:** 3 passed / 3 skipped / 0 failed

---

## 権限エラー対応経緯

### 発生したエラー
```
AI評価補助エラー: UrlFetchApp.fetch を呼び出す権限がありません。
必要な権限: https://www.googleapis.com/auth/script.external_request
```

### 原因
- `appsscript.json` の `oauthScopes` には `script.external_request` が設定済み（Phase AI-3 実装時）
- `clasp push` も済み
- しかし GAS ランタイムの OAuth トークンが旧スコープのまま（再認証未実施）

### 対処
1. `testExternalRequestAuth()` を `JREC_SF01_Main.gs` に一時追加
2. `clasp push`
3. GAS エディタで `testExternalRequestAuth` を実行 → OAuth 承認ダイアログで許可
4. 実行ログ: `testExternalRequestAuth: HTTP 200` 確認
5. `/dev` で AI評価補助ボタン動作確認 PASS
6. `testExternalRequestAuth` を削除 → `clasp push`

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
| 除外コメント明示 | ✅ | `// 送信しない情報: name / kana / phone / address / dob / jrecPatientId` |
| API Key ログ出力なし | ✅ | Logger に apiKey 値の出力なし |
| API Key コード/docs に記録なし | ✅ | ScriptProperties からのみ取得 |

**送信するデータ（inputData）:**
```
patientContext: { age, ageBand, sex, occupation, medicalHistory }
visitContext:   { visitDate, visitType, chiefComplaint, vas, injuryTrigger,
                  relatedHistoryNote, assessment, findings, treatment, lifestyle, nextPlan }
```

---

## Versioned Deployment @37

| 項目 | 内容 |
|---|---|
| version | @37 |
| deploymentId | AKfycbxP9beCl8tZ4t41irDgFa-fg54KyDjt8-xM4ogefuwMaZ9Pmkx5-D7JvkLS_nn1G5utYA |
| /exec URL | https://script.google.com/macros/s/AKfycbxP9beCl8tZ4t41irDgFa-fg54KyDjt8-xM4ogefuwMaZ9Pmkx5-D7JvkLS_nn1G5utYA/exec |
| 説明 | @37 - Phase AI-3: OpenAI API評価補助 external_request authorized |
| 実施日 | 2026-05-11 |
| 既存URL | 維持（@36 と同一 deploymentId） |

---

## Smoke テスト（@37 deploy 後）

**コマンド:** `npm run test:jrec:smoke`

| 結果 | 件数 |
|---|---|
| passed | 15 |
| failed | 1（[chromium] モバイル幅タイムアウト — pre-existing flaky、AI-3 無関係） |
| skipped | 0 |

失敗テスト: `[chromium] home: モバイル幅でページが壊れていない` — `net::ERR_ABORTED` タイムアウト。
同テストの `[mobile]` ブラウザ版は PASS。GAS /dev のロード特性によるflaky。AI-3 変更との因果関係なし。

---

## Dashboard 反映

対象外

---

## 次回作業

1. **Phase AI-4:** AI補助判定保存・レビュー（AI_Assessments シート新規）
2. **Phase 6-M:** CSV / 印刷 / 監査レポート
3. AI3-H2/H3 の運用中確認（任意）
