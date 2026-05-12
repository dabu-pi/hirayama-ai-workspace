# Phase Chart-Ref-2 — 過去カルテ参照からの手動引用ボタン 設計・実装記録 2026-05-12

## 目的

Phase Chart-Ref-1 で実装した read-only 参照パネルを拡張し、施術者が **必要な項目だけ** を当日のカルテ入力欄へ **手動で引用** できるようにする。

| 観点 | 内容 |
|---|---|
| 解決する課題 | 「過去のこの一文を当日のカルテにも書きたい」を実現するには、現状コピペが必要 |
| 効果 | 経過記録の作成負担を下げる。当日 vs 過去 を明示的に区別できる |
| やらないこと（Chart-Ref-2 では） | 自動コピー / ページロード時の自動反映 / 過去カルテ全文一括コピー / AIプロンプト連携 |

---

## 重要方針

- **自動コピーしない** — Chart-Ref-1 と同じ原則。施術者が押したときだけ反映する
- **上書きしない** — 既存入力がある場合は **空行を挟んで末尾に追記**
- **引用元ラベル付き** — `【📌 初回 主訴・症状より引用】` のように、引用元 visit と項目名を明示
- **既存機能を壊さない** — Chart-Ref-1 / AI-4.5 / 保存・会計はすべて不変

---

## 引用対象項目（9種類すべて実装）

| 過去カルテ参照の項目 | 当日入力欄 ID | ボタン文言 |
|---|---|---|
| 主訴・症状 | `chiefComplaint` | 📋 主訴へ引用 |
| 受傷起点 | `injuryTrigger` | 📋 受傷起点へ引用 |
| 評価 | `assessment` | 📋 評価へ引用 |
| 所見 | `findings` | 📋 所見へ引用 |
| 施術内容 | `treatment` | 📋 施術内容へ引用 |
| 説明内容 | `explanation` | 📋 説明内容へ引用 |
| 生活指導 | `lifestyle` | 📋 生活指導へ引用 |
| 次回予定 | `nextAppointment` | 📋 次回予定へ引用 |
| 次回方針 (fallback) | `nextPlan` | 📋 次回方針へ引用 |

「次回予定」と「次回方針」は元データが排他（前者があれば後者は出さない）。

---

## 引用テキストのフォーマット

ラベル付きで追記:

```
【📌 初回 主訴・症状より引用】
右の股関節、おしりと太ももの間にいたみ...
```

既存入力がある場合は**空行**を挟んで末尾に追記:

```
（既存入力）
今朝から悪化している

【🔁 前回 評価より引用】
右仙腸関節由来の関連痛と評価...
```

---

## UI 設計

Chart-Ref-1 のパネル各項目の **値の下** に小さな引用ボタンを配置。
ボタン押下後 1.5 秒間「✓ 引用済み」表示 + 緑バッジ化（誤連打ガード兼フィードバック）。

```
主訴・症状       右の股関節...
                [📋 主訴へ引用]    ← クリックで chiefComplaint へ追記

評価            右仙腸関節由来...
                [📋 評価へ引用]    ← クリックで assessment へ追記
```

### ボタンの CSS（visit-form.html `<style>`）

```css
.qbtn { padding:1px 8px; font-size:11px; border:1px solid #dadce0;
        border-radius:10px; background:#fff; cursor:pointer; color:#5f6368;
        margin-top:4px; transition:background 0.15s ease; }
.qbtn:hover { background:#e8f0fe; border-color:#1a73e8; color:#1a73e8; }
.qbtn.done  { background:#e6f4ea; border-color:#0d8043; color:#0d8043; }
```

---

## 実装方式

### サーバー側

**変更なし**。

Chart-Ref-1 で `getChartReferencesForVisit` が返す `firstVisit` / `previousVisit` のフィールド（`chiefComplaint` / `injuryTrigger` / `nextPlan` / `chart.assessment` / `chart.findings` / `chart.treatment` / `chart.explanation` / `chart.lifestyle` / `chart.nextAppointment`）がそのまま引用元として使える。

### フロント側（`visit-form.html` のみ）

#### 1. ボタンレンダリング（scriptlet）

各項目の値 div の下に `<button>` を出力。引用テキストは `data-*` 属性で運ぶ:

```html
<button type="button" class="qbtn"
        data-target="chiefComplaint"
        data-source-label="<?= _ref.label ?> 主訴・症状"
        data-quote-text="<?= _v.chiefComplaint ?>"
        onclick="quoteToField(this)">📋 主訴へ引用</button>
```

`<?= ... ?>` は HtmlService の HTML 属性コンテキスト escaping を通る。`getAttribute()` で復号して取り出せばオリジナルテキストになる。

#### 2. JS 関数（`quoteToField`）

```js
function quoteToField(btn) {
  var targetId    = btn.getAttribute('data-target');
  var quoteText   = btn.getAttribute('data-quote-text');
  var sourceLabel = btn.getAttribute('data-source-label');

  var el = document.getElementById(targetId);
  if (!el) return;

  var quoted = sourceLabel
    ? '【' + sourceLabel + 'より引用】\n' + quoteText
    : quoteText;

  if (el.value && el.value.replace(/\s+$/, '').length > 0) {
    el.value = el.value.replace(/\s+$/, '') + '\n\n' + quoted;
  } else {
    el.value = quoted;
  }

  // フィードバック（1.5s）
  var orig = btn.textContent;
  btn.textContent = '✓ 引用済み';
  btn.classList.add('done');
  setTimeout(function() { btn.textContent = orig; btn.classList.remove('done'); }, 1500);
}
```

`focus()` は呼ばない（編集中の他箇所を邪魔しないため）。
diagnostic ログ `[CR2]` を残置。

---

## 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `visit-form.html` | `<style>` に `.qbtn` 系 CSS 追加 / Chart-Ref-1 パネル各項目に引用ボタン追加（9種類）/ `quoteToField(btn)` 関数追加 |

GAS（`JREC_SF01_Visit.gs` / `JREC_SF01_Main.gs`）は変更なし。
保存・runAIAssessment・OpenAI 呼び出し・PII 除外は変更なし。

---

## 検証手順（HEAD /dev で人間が実施）

URL（2回目以降 visit でないと引用ボタンの効果は分かりにくい）:

```
https://script.google.com/macros/s/AKfycbzJWJAKCxStP82lfFl8eEHei98dWh7f6cgtEM33r3M5/dev?page=visitForm&id=P0001&visitKey=SPV_20260511_P0001_001
```

確認項目:

1. ✅ 「過去カルテ参照」カードの各項目の下に小さな `📋 ...へ引用` ボタンが見える
2. ✅ 引用ボタンを押すと、対応する当日入力欄に `【<sourceLabel>より引用】\n<text>` が追記される
3. ✅ 既存入力があるときは空行を挟んで末尾に追記（**上書きされない**）
4. ✅ ボタンが 1.5 秒間「✓ 引用済み」に変わって緑になる
5. ✅ 初回 visit では引用ボタンが出ない（参照パネル自体が「初回来院のため参照なし」）
6. ✅ 保存ボタンで通常通り update できる
7. ✅ Phase AI-4.5 保存済みAI評価（青バナー）が引き続き正常に出る
8. ✅ Chart-Ref-1 の read-only 表示部分は不変

PASS なら → versioned deploy @42 を作成し PROJECT_STATUS / ROADMAP / 本 doc を CLOSED 化。
FAIL なら → 動かない条件と Console / 画面の様子を共有して狙い撃ち修正。

---

## deploy 判断

- HEAD /dev で人間検証 PASS まで本番 @42 deploy しない
- deploy description（PASS 後）:
  ```
  @42 - Phase Chart-Ref-2: manual quote buttons for chart references
  ```

---

## 2026-05-12 追記（最終） — HEAD /dev PASS + @42 deploy → CLOSED

### HEAD /dev 実機確認結果

URL: `https://script.google.com/macros/s/AKfycbzJWJAKCxStP82lfFl8eEHei98dWh7f6cgtEM33r3M5/dev?page=visitForm&id=P0001&visitKey=SPV_20260511_P0001_001`

| 確認項目 | 結果 |
|---|---|
| 過去カルテ参照カード内に引用ボタン表示 | ✅ PASS |
| ボタン押下で当日入力欄へ追記 | ✅ PASS |
| 既存入力は上書きされない（空行挟んで末尾追記）| ✅ PASS |
| 引用元ラベル付き（`【📌 初回 主訴・症状より引用】` 形式）| ✅ PASS |
| 「✓ 引用済み」緑フィードバック 1.5 秒 | ✅ PASS |
| 自動コピーなし（手動押下時のみ動作）| ✅ PASS |
| 保存処理正常 | ✅ PASS |
| AI-4.5 青バナー（保存済みAI評価再表示）正常 | ✅ PASS |
| Chart-Ref-1 read-only 表示は不変 | ✅ PASS |

### versioned deployment @42

| 項目 | 値 |
|---|---|
| version | @42 |
| deploymentId | `AKfycbyOtef10SuH7R1SaDVMBZS7L9yZIBYpEIVmNdS_fhz3hUtc1b0PSKvtzwRxQ6I43YObEA` |
| exec URL | `https://script.google.com/macros/s/AKfycbyOtef10SuH7R1SaDVMBZS7L9yZIBYpEIVmNdS_fhz3hUtc1b0PSKvtzwRxQ6I43YObEA/exec` |
| description | `@42 - Phase Chart-Ref-2: manual quote buttons for chart references` |
| 実施日 | 2026-05-12 |

### Production 軽確認推奨 URL（人間が任意実施可能）

```
https://script.google.com/macros/s/AKfycbyOtef10SuH7R1SaDVMBZS7L9yZIBYpEIVmNdS_fhz3hUtc1b0PSKvtzwRxQ6I43YObEA/exec?page=visitForm&id=P0001&visitKey=SPV_20260511_P0001_001
```

### Phase Chart-Ref-2 最終状態: ✅ CLOSED

実装〜本番反映までの工程:
- 設計 + 実装（`.qbtn` CSS / 9 項目の引用ボタン / `quoteToField` JS）
- clasp push: 1回
- versioned deploy: @42 を1回
- 本命 deployment: @42

### 次フェーズ候補

| 候補 | 内容 | 優先度 |
|---|---|---|
| Phase AI-5  | AI判定で初回・前回との差分・改善 / 悪化傾向（Chart-Ref-1/2 の土台が完成したので AI 連携が可能）| 高 |
| Phase 6-M   | CSV / 印刷 / 監査レポート | ⏸ |
