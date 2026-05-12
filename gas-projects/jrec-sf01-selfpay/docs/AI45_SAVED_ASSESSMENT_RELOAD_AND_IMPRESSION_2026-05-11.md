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

---

## 2026-05-12 追記（その2） — @39 deploy 後の追加不具合と修正

### 観測

@39 deploy 後、本番 URL で再確認したところ:

| 項目 | 結果 |
|---|---|
| 対象URL | `?page=visitForm&id=P0001&visitKey=SPV_20260511_P0001_001` |
| AI_Assessments の対象行 | ✅ 実在（複数行、outputJson も埋まっている） |
| Console 系列 | called → start → result → `no saved assessment for this visitKey/patientId` |
| 画面 | 青バナー出ず・カルテ下書き出ず・AI参考見立て出ず |

つまり、フロント側の到達ログは正常で、サーバー側 `getLatestAIAssessmentForVisitOrPatient`
が「実在する行を見つけられない」状態だった。

### 真因（推定）

`getLatestAIAssessmentForVisitOrPatient` の header lookup が `data[0].indexOf("visitKey")` の **完全一致依存**。

| 経路 | 列名依存 | 影響 |
|---|---|---|
| 保存（`saveAIAssessment_` → `appendRow`） | **positional**（配列順で書き込む） | header 名がズレていても無関係に保存できる |
| 読み取り（`getLatestAIAssessmentForVisitOrPatient`） | **名前 lookup** | header 側に前後空白 / 大小文字差 / 不可視文字があると `indexOf = -1` → `row[-1] = undefined` → 全行 silent skip |

保存はずっと positional で動いていたため、シートのヘッダーに微妙な差異があっても気づかれず、
AI-4.5 で初めて読み取り側に名前 lookup を入れた瞬間に表面化した、という構造的バグ。

### 修正内容（4回目 clasp push, 2026-05-12 / JREC_SF01_Main.gs のみ）

| 修正 | 目的 |
|---|---|
| header lookup を `trim + lowercase` 正規化に変更 | 前後空白・大小文字差を吸収 |
| 比較値も `String(v\|\|'').trim()` で正規化 | セル値側の前後空白も吸収 |
| 必須ヘッダー（assessmentId / visitKey / patientId）が見つからない場合は raw headers をログ出力して即 return | ヘッダー異常をすぐ可視化 |
| `vkMatches / pidMatches / totalScanned` を集計してログ出力 | no-match 時に「読んだ行はあるが needle と一致なし」を判定できる |
| found 時に `outputLen` も出力 | outputJson が空でない確認 |
| `debugAIAssessmentsRead()` を追加 | GAS エディタから固定ターゲットで1コマンド診断（headers / 文字長 / 先頭 hex / 行数 / 取得結果）|

既存の save / runAIAssessment ロジックには変更なし。

### 検証手順

1. /dev (HEAD 反映) で `?page=visitForm&id=P0001&visitKey=SPV_20260511_P0001_001` を開く
2. F12 → Console:
   - 期待: `[AI45] getLatestAIAssessmentForVisitOrPatient result { ok: true, found: true, ... }`
   - 続いて `[AI45] displaySavedAssessment rendered banner`
3. 画面: 青バナー + AI参考見立て + カルテ下書き 再表示
4. もし依然 `found: false` の場合 → GAS エディタで `debugAIAssessmentsRead` を実行 → Logger.log で:
   - raw headers の JSON
   - 各 header の文字長（trailing space があれば判明）
   - 先頭 hex（不可視 BOM などがあれば判明）
   この情報から次の手を決める

### deploy 判断

- /dev で PASS → versioned deploy @40 を作成 → docs を改めて CLOSED 化
- /dev で FAIL → `debugAIAssessmentsRead` の Logger 出力を持って再診

---

## 2026-05-12 追記（その3） — `ok: false` 観測の追跡 + 診断 payload 拡充

### 観測

4回目 push 後も Console は依然:

```
[AI45] getLatestAIAssessmentForVisitOrPatient result
{ ok: false, found: false, assessmentId: null, sourceType: null, promptVersion: null }
[AI45] no saved assessment for this visitKey/patientId
```

ただし当時の GAS コードは全ての return path で `{ ok: true, assessment: null }` を返す実装。
`ok: false` が出るのは原理的に「`res` が null か `res.ok !== true` の object」だけ。

### サーバー実体検証

`clasp pull` を temp dir に投げて差分を取った結果:

| ファイル | 結果 |
|---|---|
| `JREC_SF01_Main.gs` (34154 bytes) | local と完全一致 |
| `visit-form.html` | local と完全一致 |
| `debugAIAssessmentsRead` の定義 | line 692 に存在 |
| `getLatestAIAssessmentForVisitOrPatient` の定義 | line 582 に **単一定義のみ**（shadow なし） |

つまり、push は成功している。GAS エディタで関数が見つからなかったのは
**エディタ側のキャッシュ・別プロジェクト誤認・検索条件**のいずれか
（コードベース側の問題ではない）。

### 最有力仮説 — URL 取り違え

| 種類 | deploymentId | 用途 |
|---|---|---|
| HEAD | `AKfycbzJWJAKCxStP82lfFl8eEHei98dWh7f6cgtEM33r3M5` | `/dev` で HEAD コードを serve |
| @39 (frozen) | `AKfycbxdngcgHbq4q52xPV3-ukDlun3s29Kbk8gy_oA11RGrwe4oPDBr4ocbeRyGUys8oxMCpw` | `/exec` で @39 frozen コードを serve |

ユーザーが叩いていた URL は @39 deploymentId + `/dev`。
versioned deployment ID に `/dev` を付けた挙動は GAS で不定（frozen を返すケースがある）。
ゆえに最新 HEAD コード（trim+lowercase 化済み）が serve されておらず、旧コードのまま
何らかの理由で `ok: false`相当（または `res` 自体が null）が返っていた可能性が最有力。

正しい /dev URL:

```
https://script.google.com/macros/s/AKfycbzJWJAKCxStP82lfFl8eEHei98dWh7f6cgtEM33r3M5/dev?page=visitForm&id=P0001&visitKey=SPV_20260511_P0001_001
```

### 修正（5回目 clasp push）

URL 取り違えが真因だとしても、それでも判別不可能なケースに備えて
診断 payload を構造化して常時返すように変更。

#### GAS 側（`JREC_SF01_Main.gs`）

返却 schema を `{ ok, found, assessment, debug }` に変更。
`debug` は失敗 / 成功どちらの経路でも必ず詰める。

```js
{
  ok: true,                      // server 側で例外発生 / 不可能（常に true）
  found: true | false,           // assessment が見つかったか
  assessment: {...} | null,
  debug: {
    reason:         "match found" | "no match" | "header missing"
                  | "sheet not found" | "sheet empty" | "exception",
    sheetName:      "AI_Assessments",
    spreadsheetId:  "<先頭8文字>",
    headerCount:    <ヘッダー数>,
    rowCount:       <最終行(ヘッダー込み)>,
    rawHeaders:     [...],
    missingHeaders: ["assessmentId" | "visitKey" | "patientId"] (空配列なら全揃い),
    needleVk:       "<検索 visitKey trim 後>",
    needlePid:      "<検索 patientId trim 後>",
    totalScanned:   <非空行件数>,
    vkMatches:      <visitKey 一致件数>,
    pidMatches:     <patientId 一致件数>,
    error:          "<例外時メッセージ>"   // 例外時のみ
  }
}
```

#### フロント側（`visit-form.html`）

```js
.withSuccessHandler(function(res) {
  console.log('[AI45] raw response object', res);            // ← 生 Object を console に
  console.log('[AI45] raw response JSON', JSON.stringify(res)); // ← 文字列化版（取りこぼし防止）
  // ...
  console.log('[AI45] getLatestAIAssessmentForVisitOrPatient summary', {
    ok, found, hasAssessment, reason, sheetName, spreadsheetId,
    rowCount, headerCount, missingHeaders, needleVk, needlePid,
    totalScanned, vkMatches, pidMatches, error,
    assessmentId, sourceType, promptVersion
  });
  if (res && res.found && res.assessment) {
    displaySavedAssessment(res.assessment);
  } else {
    console.log('[AI45] no saved assessment — reason=' + (dbg.reason || 'unknown'));
  }
})
```

判定を `res.ok && res.assessment` から `res.found` に切り替え（ok と found を分離）。

### 次セッションの実機検証手順

1. **必ず HEAD deploymentId の /dev URL を使う**:
   ```
   https://script.google.com/macros/s/AKfycbzJWJAKCxStP82lfFl8eEHei98dWh7f6cgtEM33r3M5/dev?page=visitForm&id=P0001&visitKey=SPV_20260511_P0001_001
   ```
2. F12 → Console → 以下のログ系列が出るはず:
   - `[AI45] raw response object {ok: true, found: true, ...}`
   - `[AI45] raw response JSON ...`
   - `[AI45] getLatestAIAssessmentForVisitOrPatient summary {reason: "match found", vkMatches: 1, ...}`
   - `[AI45] displaySavedAssessment rendered banner`
3. もし依然 found=false の場合は **summary 行の reason / rawHeaders / missingHeaders / vkMatches / pidMatches** をそのまま貼ってもらえば原因が一意に判定できる:
   | reason | 意味 / 次の手 |
   |---|---|
   | `"sheet not found"` | スプレッドシート側に AI_Assessments シートが無い |
   | `"sheet empty"` | データ行なし（保存できていない）|
   | `"header missing"` | 必須ヘッダーが正規化後も足りない（rawHeaders を確認）|
   | `"no match"` (vkMatches=0 / pidMatches=0) | 検索キーがどの行とも一致しない（needleVk / needlePid と rawHeaders を確認）|
   | `"exception"` | error フィールドを確認 |

### deploy 判断

- HEAD /dev で PASS → versioned deploy @40 → CLOSED 化
- HEAD /dev で FAIL → 上記 reason 表に従って次の修正を狙い撃ち

---

## 2026-05-12 追記（その4） — `raw response object null` 観測 → RPC 安全化対応

### 観測（HEAD /dev での再検証）

```
[AI45] loadSavedAIAssessment called   { ..., googleReady: true }
[AI45] loadSavedAIAssessment start    { hasVisitKey: true, hasPatientId: true }
[AI45] raw response object null
[AI45] raw response JSON null
[AI45] getLatestAIAssessmentForVisitOrPatient summary
  { ok:false, found:false, hasAssessment:false, reason:null, sheetName:null, ... }
[AI45] no saved assessment — reason=unknown
```

つまり、**フロント・サーバー接続は正常 / google.script.run も生きている / 関数も呼ばれている**が、
返却値が **`null`** で届いている。GAS コード側の全 return path は `{ ok: true, found: ..., debug: {...} }`
を返す実装になっているにもかかわらず、である。

### 原因（推定）

HtmlService の `google.script.run` RPC シリアライザは、応答 object 内に
**`Date` / `undefined` / `Error` / circular / 一部の特殊型** が含まれると、
withFailureHandler に行かず withSuccessHandler に `null` を渡す既知の挙動がある。

該当しそうな箇所:

| 箇所 | 内容 | 問題 |
|---|---|---|
| `debug.rawHeaders = data[0]` | `getValues()` の生 array | Date / number / null が混入する可能性 |
| `assessment.createdAt = target[idxAt]` | セルの Date object | 直接含めると serializer が落とすことがある |

### 修正（6回目 clasp push）

#### サーバー側（`JREC_SF01_Main.gs`）

```js
function toRpcSafeObject_(obj) {
  return JSON.parse(JSON.stringify(obj, function(key, value) {
    if (value === undefined)    return null;
    if (value instanceof Date)  return value.toISOString();
    if (value instanceof Error) return String(value.stack || value.message || value);
    return value;
  }));
}

function _rpcSafeStringArray_(arr) {
  // 各セルを必ず String 化（Date は ISO、null/undefined は空文字）
}
```

`getLatestAIAssessmentForVisitOrPatient` の **全 return** をこのラッパー経由に変更:

```js
return toRpcSafeObject_({ ok: true, found: false, assessment: null, debug: debug });
```

さらに:

- `debug.rawHeaders` を `_rpcSafeStringArray_(data[0])` で String[] に変換
- `debug.normalizedHeaders` を追加（trim+lowercase 後の配列）
- `assessment.createdAt` を必ず ISO 文字列に変換
- `assessment.patientId` を追加

#### 診断関数（新規）

| 関数 | 用途 |
|---|---|
| `debugAI45RpcPing()` | シート参照なし・固定 object を返却。RPC 層単独の健全性確認 |
| `getLatestAIAssessmentForVisitOrPatientJson(visitKey, patientId)` | 本体結果を **JSON 文字列**で返す（string は確実に RPC 安全） |

#### フロント側（`visit-form.html`）

`loadSavedAIAssessment` 内で **3つの呼び出しを並行発射**:

1. `debugAI45RpcPing()` → `[AI45] rpc ping response object {...}` / `[AI45] rpc ping JSON ...`
2. `getLatestAIAssessmentForVisitOrPatientJson(...)` → `[AI45] JSON-string fallback raw "{...}"` / `[AI45] JSON-string fallback parsed {...}`
3. `getLatestAIAssessmentForVisitOrPatient(...)` → `[AI45] raw response object {...}`（本体・従来）

これで切り分けが一意になる:

| ping | JSON fallback | 本体 object | 解釈 |
|---|---|---|---|
| ✅ object | ✅ string/parsed | ❌ null | RPC が object 内の非安全型で落ちている → `toRpcSafeObject_` で修正済みのはず・差分があれば追跡 |
| ✅ object | ❌ null | ❌ null | 本体関数内部で例外 → fallback もろとも落ちる |
| ❌ null | ❌ null | ❌ null | RPC 層全体の障害（極めて稀）|
| ✅ object | ✅ | ✅ object | 期待状態 — 全部 OK |

### サーバー verify

`clasp push` 後に `clasp pull` で server == local を再確認:

| 関数 | server line |
|---|---|
| `toRpcSafeObject_` | 604 |
| `_rpcSafeStringArray_` | 630 |
| `debugAI45RpcPing` | 783 |
| `getLatestAIAssessmentForVisitOrPatientJson` | 811 |

サーバー側に確実に反映済み。

### 次セッションの実機検証手順

1. HEAD /dev URL で開く:
   ```
   https://script.google.com/macros/s/AKfycbzJWJAKCxStP82lfFl8eEHei98dWh7f6cgtEM33r3M5/dev?page=visitForm&id=P0001&visitKey=SPV_20260511_P0001_001
   ```
2. F12 → Console
3. **3つの応答すべてを確認**:
   - `[AI45] rpc ping response object` の中身
   - `[AI45] JSON-string fallback parsed` の中身
   - `[AI45] raw response object` の中身
4. 上の切り分け表に当てはめて次の手を決定

### deploy 判断

- HEAD /dev で `raw response object` が `{ found: true, ... }` なら → versioned deploy @40 → CLOSED 化
- それまでは @40 deploy しない

---

## 2026-05-12 追記（その5・最終） — HEAD /dev PASS + @40 deploy → CLOSED

### HEAD /dev 最終確認結果

URL: `https://script.google.com/macros/s/AKfycbzJWJAKCxStP82lfFl8eEHei98dWh7f6cgtEM33r3M5/dev?page=visitForm&id=P0001&visitKey=SPV_20260511_P0001_001`

| 確認項目 | 結果 |
|---|---|
| `[AI45] rpc ping response object` | ✅ PASS（RPC 層健全） |
| `[AI45] JSON-string fallback raw / parsed` | ✅ PASS（文字列経路健全）|
| `[AI45] raw response object` | ✅ `ok: true, found: true`（object 経路 PASS）|
| `[AI45] summary` | `reason: "match found"` / `vkMatches: 5` / `pidMatches: 5` / `sourceType: "visitKey"` |
| `assessmentId` | `ASMNT_20260512081820313` |
| `[AI45] displaySavedAssessment called` | ✅ PASS |
| `[AI45] displaySavedAssessment rendered banner` | ✅ PASS |
| 画面: 青バナー / AI参考見立て / カルテ下書き | ✅ 再表示 PASS |

3系列（ping / JSON fallback / 本体 object）すべて PASS。
RPC 安全化（`toRpcSafeObject_`）が効いた状態で本体 object が正常返却される。

### versioned deployment @40（本命・現運用版）

| 項目 | 値 |
|---|---|
| version | @40 |
| deploymentId | `AKfycbxyvyOGA6GRDMwA6mS35Q5xLypdfz_wtFo8XEKSnMcmlZAct6BrPyk8oJlj8td29M6M9g` |
| exec URL | `https://script.google.com/macros/s/AKfycbxyvyOGA6GRDMwA6mS35Q5xLypdfz_wtFo8XEKSnMcmlZAct6BrPyk8oJlj8td29M6M9g/exec` |
| description | `@40 - Phase AI-4.5: header tolerant read + debug payload` |
| 実施日 | 2026-05-12 |

### deploy 履歴サマリ

| 版 | 状態 | 取り扱い |
|---|---|---|
| @39 | superseded（header lookup / RPC null 問題あり）| URL は残置（既存共有の互換性）。新規共有は @40 を使う |
| @40 | **本命・現運用版** | header tolerant + 診断 payload + RPC 安全化 |

### Phase AI-4.5 最終状態: ✅ CLOSED

実装〜本番反映までの合計工程:
- 設計・実装
- clasp push: 6回（初期実装 / fallback修正 / google.script.run timing diag / header tolerant / 構造化 debug / RPC 安全化）
- versioned deploy: 2回（@39 → @40）
- 本命 deployment: **@40**
- 解決した本質的不具合: header lookup の完全一致依存 + HtmlService RPC が非安全型を含む応答を null 化する挙動

### 次フェーズ

- Phase AI-5: 運用改善（プロンプト調整・過去判定比較）
- Phase 6-M: CSV / 印刷 / 監査レポート ⏸

### 残置の診断ログ（運用注意）

以下は今後の障害切り分け用にそのまま残置:
- フロント: `[AI45] rpc ping response`, `[AI45] JSON-string fallback raw/parsed`, `[AI45] raw response`
- サーバー: `Logger.log("[getLatestAIAssessmentForVisitOrPatient] ...")`
- 診断関数: `debugAIAssessmentsRead()`, `debugAI45RpcPing()`, `getLatestAIAssessmentForVisitOrPatientJson()`

Console ノイズが気になる場合は将来 level-gate 化を別タスクで検討。
個人情報は一切ログに出していないことを確認済み（visitKey / patientId / assessmentId のみ）。
