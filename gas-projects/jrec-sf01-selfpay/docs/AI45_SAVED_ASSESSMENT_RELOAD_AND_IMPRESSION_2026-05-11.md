# Phase AI-4.5 保存済みAI評価再読込 + AI参考見立て — 実装記録 2026-05-11

## 目的

- 保存済みAI評価を編集カルテ画面で自動再表示する
- AI参考見立て（aiImpression）を AI出力に追加する
- AIは参考情報であり診断の確定ではない旨を UI・プロンプト双方で明示する

---

## 実装概要

| 項目 | 結果 |
|---|---|
| 実施日 | 2026-05-11 → 2026-05-12 (CLOSED) |
| フェーズ | Phase AI-4.5 |
| ステータス | ✅ CLOSED |
| clasp push | ✅ 2026-05-11（2回）+ 2026-05-12（診断強化）= 計3回 |
| LiveCheck ai45 | ✅ 5 passed / 5 skipped / 0 failed |
| LiveCheck ai4（回帰） | ✅ 4 passed / 0 failed |
| LiveCheck ai3（回帰） | ✅ 3 passed / 0 failed |
| 実機確認 | ✅ PASS（2026-05-12 /dev 5項目すべて） |
| @39 deploy | ✅ 本番反映済み（2026-05-12） |

---

## 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `JREC_SF01_Main.gs` | `getLatestAIAssessmentForVisit(visitKey)` 追加 |
| `JREC_SF01_Main.gs` | `AI_SYSTEM_PROMPT_` に `aiImpression` フィールド追加（promptVersion v2） |
| `JREC_SF01_Main.gs` | `saveAIAssessment_()` に `promptVer` パラメータ追加 / `runAIAssessment()` で "v2" を渡す |
| `visit-form.html` | 編集モード起動時に `loadSavedAIAssessment(visitKey)` を自動呼び出し |
| `visit-form.html` | `loadSavedAIAssessment()` / `displaySavedAssessment()` / `buildAiImpressionHtml()` / `formatDateJP()` 追加 |
| `visit-form.html` | `displayAiResult()` に `aiImpression` レンダリング追加 + `dataset.freshResult` フラグ |
| `tools/.../ai45.spec.ts` | AI45-1〜5 自動 + AI45-H1〜H5 手動 SKIP の LiveCheck spec 新規 |
| `tools/.../package.json` | `test:jrec:ai45` スクリプト追加 |

---

## getLatestAIAssessmentForVisit 仕様

| 項目 | 内容 |
|---|---|
| 関数名 | `getLatestAIAssessmentForVisit(visitKey)` |
| 対象シート | `AI_Assessments`（ハードコード） |
| 取得対象 | 同一 visitKey の最新レコード（createdAt 基準） |
| 返却項目 | assessmentId / createdAt / outputJson / reviewStatus / model / promptVersion |
| PII | 返却しない（outputJson は AI出力のみ、personal info は AI送信なし） |
| 失敗時 | `{ ok: true, assessment: null }` fail-safe |

---

## AI参考見立て（aiImpression）設計

### JSON 構造（promptVersion v2）
```json
{
  "aiImpression": {
    "summary": "主訴・症状・所見から見た参考的な全体像（断定しない）",
    "therapistCheckpoints": ["施術者が確認すべきポイント1", "ポイント2", ...]
  }
}
```

### UI表現ルール
| 項目 | 内容 |
|---|---|
| 表示名 | 「AI参考見立て」（🧠 アイコン） |
| 必須注意文 | 「この内容はAIによる参考情報です。診断確定ではありません。最終判断は施術者が行ってください。」 |
| 禁止表現 | AI診断 / 確定診断 / 保険請求上の判断 / 医師判断不要 / 必ず〜 |
| 配色 | 背景 `#f3e8fd`（薄紫）/ ボーダー `#d7aefb` |

---

## 保存済みAI評価 再読込フロー

```
1. editMode 起動
2. enableAiAssist(visitKey) — ボタン有効化
3. loadSavedAIAssessment(visitKey) — google.script.run 非同期呼び出し
4. getLatestAIAssessmentForVisit(visitKey) — GAS 実行
5. 最新レコードが存在する場合
   → displaySavedAssessment(assessment)
   → 青バナー「📂 保存済みAI評価補助を読み込みました」
   → outputJson を parse → AI評価全セクション + aiImpression 表示
6. 存在しない場合 → 何も表示しない
```

### 新規AI実行後の挙動
- `displayAiResult()` 実行時に `result.dataset.freshResult = '1'` をセット
- `displaySavedAssessment()` は `dataset.freshResult === '1'` を確認して上書き禁止
- つまり: 新規実行済み → 再読み込みは発動しない

---

## promptVersion 変更

| バージョン | 対応 |
|---|---|
| v1 | AI-3 / AI-4 の基本評価補助（assessmentPoints / differentialDirection / redFlags / additionalQuestions / treatmentApproach / referralIndication / chartDraft） |
| v2 | v1 + `aiImpression`（summary + therapistCheckpoints）|

過去の v1 レコードを再表示する場合は `aiImpression` が存在しないため、グレースフルに省略して表示する。

---

## PII 除外確認（コードレビュー）

| 確認項目 | 状態 |
|---|---|
| getLatestAIAssessmentForVisit — name/phone/address/dob/jrecPatientId 非返却 | ✅ |
| outputJson は AI出力のみ（AI側には PII 非送信、AI-3 で確認済み） | ✅ |
| assessmentId / visitKey のみ UI に表示 | ✅ |
| API Key を返却・表示しない | ✅ |

---

## Dashboard 反映

対象外

---

## 実機確認手順（未実施）

1. 保存済みAI評価のある visitKey（例: SPV_20260511_P0001_001）で visitForm を開く
2. 青バナー「📂 保存済みAI評価補助を読み込みました」が表示されることを確認（AI45-H1）
3. 「🧠 AI参考見立て」セクションが表示されることを確認（AI45-H2）
4. 「AI評価補助を再実行する」ボタンを押す → 緑バナーに切り替わることを確認（AI45-H3）
5. AI_Assessments シートで最新レコードの promptVersion = v2 を確認（AI45-H4）
6. outputJson に aiImpression フィールドが含まれることを確認（AI45-H5）

---

## 実機確認結果（2026-05-11 PARTIAL）

| 確認項目 | 結果 |
|---|---|
| AI_Assessments v2保存 | ✅ PASS |
| outputJson に aiImpression | ✅ PASS |
| promptVersion = v2 | ✅ PASS |
| 青バナー表示（同一カルテ / 同一患者fallback） | ❌ FAIL × 2回 |
| 保存済みAI評価自動再読込 | ❌ FAIL |
| カルテ下書き再表示 | ❌ FAIL |
| AI参考見立て再表示 | ❌ FAIL |
| @39 deploy | ⏸ 未実施 |

**中断理由:** 青バナー表示が2回の実機確認でいずれも出ず。本日は記録して中断。

---

## 実装済み状態（中断時点）

| コンポーネント | 状態 |
|---|---|
| `getLatestAIAssessmentForVisitOrPatient(visitKey, patientId)` | ✅ 実装済み |
| visitKey → patientId fallback 検索 | ✅ 実装済み |
| 新規モードでも `loadSavedAIAssessment('', PATIENT_ID)` 呼び出し | ✅ 実装済み |
| バナーに `sourceType`（同一カルテ / 同一患者の直近カルテ）表示 | ✅ 実装済み |
| `[AI45]` console.log 診断ログ | ✅ 実装済み（loadSavedAIAssessment start / result / error） |
| `withFailureHandler` にログ追加 | ✅ 実装済み |
| v2 promptVersion 保存 | ✅ 動作確認済み |

---

## 次回再開手順（最優先）

1. `/dev` でF12→Console を開き `[AI45]` ログを確認する
2. `loadSavedAIAssessment start` ログが出るか確認 → 出ない場合は呼び出し側のバグ
3. `getLatestAIAssessmentForVisitOrPatient result` ログで `found` / `assessmentId` / `sourceType` を確認
4. `found: true` なのに青バナーが出ない場合は `displaySavedAssessment` のバグ
5. `found: false` の場合は GAS の検索ロジックまたは PATIENT_ID の不一致
6. `start` ログが出ない場合は `loadSavedAIAssessment` が呼ばれていない（PATIENT_ID / google.script.run の問題）

**確認できること:**
- `hasPatientId: true/false` → PATIENT_ID が取れているか
- `found: true/false` → GAS が記録を見つけたか
- `sourceType: "visitKey"/"patientId"/null` → どの検索でヒットしたか
- エラーログ → GAS 呼び出し自体が失敗していないか

---

## 次回作業

1. Console `[AI45]` ログ確認 → 原因特定 → 修正
2. 実機確認 PASS 後に versioned deployment @39
3. Phase AI-5: 運用改善（プロンプト調整・過去判定比較）
4. Phase 6-M: CSV / 印刷 / 監査レポート

---

## 2026-05-12 追記 — 診断強化 + google.script.run 未準備リトライ

### 推定原因（静的解析）

実機 FAIL × 2回かつ Console に `[AI45] loadSavedAIAssessment start` ログが残っていない場合、
最も可能性が高いのは **ページロード直後の IIFE 実行時点で `google.script.run` がまだ準備できていない**こと。
従来コードは未準備時に silent return していたため Console には何も残らず「関数が呼ばれていない」と誤判定されやすい構造だった。

判断根拠:
- `runAIAssessment`（ボタンクリック起点）の `google.script.run` 経由保存は PASS（v2 / aiImpression）
- 違いは「ユーザー操作後」vs「ページロード即時」のタイミングのみ
- 即時実行は IFRAME 初期化と競合する可能性がある

### 修正内容（visit-form.html）

| 修正 | 目的 |
|---|---|
| `loadSavedAIAssessment` の entry ログをガード前に移動 | 関数が呼ばれたかを必ず Console に残す |
| silent return 各経路（empty / google not ready / no assessment / parse fail）に理由ログ追加 | どこで止まったかを Console から特定できるようにする |
| `google.script.run` 未準備時のみ 300ms 後にリトライ（最大3回） | ページロード即時呼び出しの timing 競合に対する保険 |
| `displaySavedAssessment` の entry / skip / render 各段階にログ追加 | banner 未表示時の判定経路を可視化 |

すべて diagnostic レイヤーの追加であり、既存の保存・新規実行ロジックは変更していない。

### Console で確認すべきログ系列

期待される正常フロー:
```
[AI45] loadSavedAIAssessment called  { visitKey, patientId, retryCount: 0, googleReady: true }
[AI45] loadSavedAIAssessment start   { hasVisitKey, hasPatientId }
[AI45] getLatestAIAssessmentForVisitOrPatient result  { ok: true, found: true, assessmentId, sourceType }
[AI45] displaySavedAssessment called  { assessmentId, hasOutputJson, outputJsonLen }
[AI45] displaySavedAssessment rendered banner  { assessmentId, sourceType }
```

各 silent return パターンの観測ガイド:

| Console に見える最後のログ | 意味 |
|---|---|
| `called` のみ（その後何も出ない）+ `googleReady: false` + `retrying...` | google.script.run timing 競合（リトライで救済される想定）|
| `called` + `googleReady: false` + `giving up` | リトライ後も未準備（深刻 — 別調査必要）|
| `start` の後何も出ない | GAS 関数がタイムアウトまたはエラー（withFailureHandler すら来ない）|
| `result` で `found: false` | 検索ロジックまたは visitKey / patientId 不一致 |
| `displaySavedAssessment called` 後 `freshResult flag is set` | 別箇所で freshResult が立っている（新規実行と再読込の競合）|
| `displaySavedAssessment called` 後 `outputObj is null` | outputJson の JSON.parse 失敗（おそらく 40000 文字 truncate）|

### 実機再確認手順（2026-05-12 以降）

1. /dev で対象患者の保存済み visitKey を持つカルテを開く
2. F12 → Console を開く
3. 上記ログ系列がどこで止まるか確認
4. `result { ok: true, found: true }` まで到達すれば青バナー表示まで連動するはず
5. PASS なら @39 deploy へ進む / FAIL なら停止位置に応じて次の修正

### LiveCheck

- 2026-05-12: `npm run test:jrec:ai45` 実行 → 10 件すべて skip（auth.json 期限切れ）
- 自動テストは構造のみ確認・本件の本質（実機 timing）はカバーできないため、auth 再作成優先度は低い
- 必要時のみ `npm run save-auth` で再作成

---

## 2026-05-12 追記 — 実機確認 PASS + @39 deploy CLOSED

### 実機確認結果（/dev）

診断強化 3回目 clasp push 後に /dev で再検証：

| 確認項目 | 結果 |
|---|---|
| 保存済みAI評価の再読み込み | ✅ PASS |
| 青バナー「📂 保存済みAI評価補助を読み込みました」表示 | ✅ PASS |
| AI参考見立て（🧠）再表示 | ✅ PASS |
| カルテ下書き再表示 | ✅ PASS |
| 新規AI実行（緑バナー / freshResult 上書き） | ✅ PASS |

推定原因（page-load 時点で `google.script.run` 未準備 → silent return）は
2026-05-12 のリトライ実装で救済された見込み。
診断ログは今後の障害切り分け用にそのまま残置。

### versioned deployment @39

| 項目 | 値 |
|---|---|
| version | @39 |
| deploymentId | `AKfycbxdngcgHbq4q52xPV3-ukDlun3s29Kbk8gy_oA11RGrwe4oPDBr4ocbeRyGUys8oxMCpw` |
| exec URL | `https://script.google.com/macros/s/AKfycbxdngcgHbq4q52xPV3-ukDlun3s29Kbk8gy_oA11RGrwe4oPDBr4ocbeRyGUys8oxMCpw/exec` |
| description | `@39 - Phase AI-4.5: 保存済みAI評価再読込 + AI参考見立て` |
| 実施日 | 2026-05-12 |

### 次フェーズ

- Phase AI-5: 運用改善（プロンプト調整・過去判定比較）
- Phase 6-M: CSV / 印刷 / 監査レポート ⏸
