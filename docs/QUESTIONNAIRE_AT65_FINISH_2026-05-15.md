# JREC-SF01 問診票 @65 仕上げ + JBIZ fallback URL 正本化

**日付:** 2026-05-15  
**ブランチ:** workspace `feature/auto-dev-phase3-loop` / JREC-SF01 `main` / JBIZ `main`

---

## 実施内容

### 1. QC-2 テスト期待値更新（`questionnaire-transfer-chart.spec.ts`）

**変更ファイル:** `tools/live-check-runner/projects/jrec-sf01/questionnaire-transfer-chart.spec.ts`

@65 仕様に合わせ QC-2 の期待値を修正。

| 項目 | 変更前（旧仕様） | 変更後（@65 仕様） |
|---|---|---|
| `c.findings` | `.toContain("頸部")` | `.toBe("")`（施術者記入欄のため空） |
| `c.explanation` | チェックなし | `.toBe("")`（施術者説明記録欄のため空） |
| painLocation | `findings` に入ることを期待 | `chiefComplaint` に集約されることを確認 |
| `c.chiefComplaint` | "肩こり" 含有のみ | "肩こり" + "頸部" 含有（painLocation も chiefComplaint へ） |

### 2. カルテ画面 UI 注記追加（`visit-form.html`）

**変更ファイル:** `gas-projects/jrec-sf01-selfpay/visit-form.html`

施術者が初見・説明内容を問診票由来と誤解しないよう注記を追加。

| フィールド | 変更内容 |
|---|---|
| `所見（初見）` ラベル | `<small>施術者記入欄</small>` 追加 |
| `所見` placeholder | `触診所見・筋緊張・圧痛部位など（問診票からは自動転記しません）` に更新 |
| `説明内容` ラベル | `<small>施術者説明記録欄</small>` 追加 |
| `説明内容` placeholder | `施術者から患者への説明内容（患者申告メモは主訴欄に集約されます）` に更新 |
| `説明内容` コメント | @63 旧記述を @65 仕様に更新 |

### 3. JBIZ portal-gateway fallback URL 正本化

**変更ファイル:** `hirayama-jyusei-strategy/gas/portal-gateway-v1.gs` / `scripts/portal-gateway-v1.gs`

JBIZ ナビゲーションの JREC-SF01 fallback URL を更新。

| 項目 | 変更前 | 変更後 |
|---|---|---|
| deploymentId | `AKfycbz0...`（@48、旧 ANYONE access）| `AKfycbyOtef10...`（@65/@66 現行 staff UI）|
| landing page | ベース URL のみ | `?page=questionnaireAdmin&filter=submitted`（受付待ち画面） |

`submitted` = 受付待ち、`pending` = 患者入力待ち（@65 ラベル定義）。

**gas/ ↔ scripts/ SHA256 一致確認:**
- `gas/portal-gateway-v1.gs`: `CBC070B6457AE460880CEBBA7037106DF0D98ED9D14CD4C1EBD4CABAA9845085`
- `scripts/portal-gateway-v1.gs`: 同上（MATCH OK）

---

## deploy 記録

| repo | deploymentId | version | description |
|---|---|---|---|
| JREC-SF01 | `AKfycbyOtef10SuH7R1SaDVMBZS7L9yZIBYpEIVmNdS_fhz3hUtc1b0PSKvtzwRxQ6I43YObEA` | @66 | findings/explanation 施術者記入欄注記 + @65仕様完結 |
| JBIZ | `AKfycbw20tWvhR5nnRzCiUAMybtfrebRg-BK-EgDamvZYt-clSwf4TK9FGTKNZRmsO3wj7QSiQ` | @28 | JREC-SF01 fallback URL @65正本化 questionnaireAdmin filter=submitted |

URL は変更なし（既存 deploymentId に versioned deploy）。

---

## @65 仕様 確定内容

| 項目 | 仕様 |
|---|---|
| `submitted` | 受付待ち |
| `pending` | 患者入力待ち |
| `chiefComplaint` | 主訴 + 痛む部位 + 症状 + 患者申告メモブロック + 問診票 ID trace |
| `findings`（初見） | 施術者記入欄 — 空欄で転記 |
| `explanation`（説明内容） | 施術者説明記録欄 — 空欄で転記 |
| 患者申告メモ | `chiefComplaint` 末尾の `---[患者申告メモ]---` ブロックに集約 |

---

## 検証状況

| 項目 | 状態 | 備考 |
|---|---|---|
| QC-2 期待値更新 | ✅ | spec ファイル変更完了 |
| visit-form.html 注記 | ✅ | deploy @66 に反映 |
| JBIZ fallback URL 更新 | ✅ | deploy @28 に反映 |
| live-check QC-2 実機実行 | ✅ PASS | 11/11 PASS（QC-1〜7 / QC-SETUP-1 / QC-CLEANUP / QC-DOC-1〜2）|
| JBIZ smoke | ✅ PASS | 248/248 PASS |
| Portal-15 / Portal-17 回帰確認 | ✅ PASS | JBIZ smoke 248 PASS に含まれる |

---

## Dashboard / Task_Queue / Run_Log

今回の変更は spec 更新・UI 注記・fallback URL の軽微修正。Run_Log / Task_Queue / Dashboard への反映は不要と判断。

---

## 次回作業候補

- auth.json refresh → QC-2 live-check 実行（PASS 確認）
- JBIZ smoke で fallback URL のナビゲーション動作確認
- Wildboar member-id 変更 live-check（spec 4 本追加済み）
