# Phase 0 設計書 — UI入力ギャップ解消

> ⚠️ **このファイルは Phase 0 の設計記録（履歴）です。**
> セル番地（B55〜B61）は Phase 1（2026-03-22）で 行7〜8（B7/D7/F7/H7/B8/D8/F8/H8）へ変更済み。
> 現行の設計は `UI_REDESIGN_PHASE1.md` / `SPEC.md` を参照してください。

作成: 2026-03-22
対象: JREC-01（柔整毎日記録システム Ver3.1）
目的: 来院ヘッダの経営管理列（会計区分・自費メニュー等）をUIから入力・保存できるようにする
前提: 保険算定ロジック・申請書生成ロジックは一切変更しない

---

## 背景・問題

`appendHeaderRow_V3_`（Ver3_core.js:1017-1023）に以下の書き込みコードはある：

```javascript
setByName_(rowArr, headMap, HEADER_COLS.accountingType, obj.accountingType ...);
setByName_(rowArr, headMap, HEADER_COLS.selfPayMenuType, obj.selfPayMenuType ...);
setByName_(rowArr, headMap, HEADER_COLS.selfPayAmount, obj.selfPayAmount ...);
setByName_(rowArr, headMap, HEADER_COLS.chronicCandidateFlag, obj.chronicCandidateFlag ...);
setByName_(rowArr, headMap, HEADER_COLS.nextReservation, obj.nextReservation ...);
setByName_(rowArr, headMap, HEADER_COLS.firstVisitType, obj.firstVisitType ...);
```

しかし `saveVisit_V3`（Ver3_core.js:912-944）の `appendHeaderRow_V3_` 呼び出しにこれらの
フィールドが**渡されていない**。UIオブジェクト（Ver3_core.js:36-88）にも自費入力セルが**定義されていない**。

→ 現状: 保存するたびに会計区分等は常に空欄で上書きされる

---

## 変更対象一覧

| ファイル | 変更種別 | 内容 |
|---|---|---|
| `Ver3_core.js` | 定数追加 | `UI` に会計ブロック（selfPay_*）を追加 |
| `Ver3_core.js` | 定数追加 | `HEADER_COLS` に `selfPayMenuCode` を追加 |
| `Ver3_core.js` | 関数新設 | `readSelfPayFromUI_V3_(uiSh)` |
| `Ver3_core.js` | 関数新設 | `clearSelfPayUI_V3_(uiSh)` |
| `Ver3_core.js` | 関数新設 | `setupSelfPayValidation_V3()` / `setupSelfPayValidation_V3_(uiSh)` |
| `Ver3_core.js` | 関数修正 | `saveVisit_V3` — selfPayInfo の読み取りと渡しを追加 |
| `Ver3_core.js` | 関数修正 | `clearAfterSaveUI_V3_` — `clearSelfPayUI_V3_` 追加 |
| `Ver3_core.js` | 関数修正 | `clearEntryUI_V3` — `clearSelfPayUI_V3_` 追加 |
| `Ver3_core.js` | 関数修正 | `onOpen` — メニューに「自費入力欄初期設定」追加 |
| **Sheets** | **手動作業** | 患者画面の行53〜62 に会計・経営情報ブロックを設置 |
| `SPEC.md` | 追記 | §Phase0 セクション追加 |

---

## UI追加項目（患者画面 行53〜62）

### レイアウト設計

```
行53  A53: ── 会計・経営情報 ─────────────── (見出しラベル、太字・背景色)
行55  A55: 会計区分          B55: [プルダウン] 保険のみ / 保険+自費 / 自費のみ
行56  A56: 自費メニュー区分  B56: [プルダウン] 手技50分/運動療法/セルフケア/ジム体験/その他
行57  A57: 自費金額（円）    B57: [数値入力]
行58  A58: 慢性候補フラグ    B58: [チェックボックス]
行59  A59: 次回予約あり      B59: [チェックボックス]
行60  A60: 新規区分          B60: [プルダウン] 保険新規 / 自費直新規 / 再来  ※空欄可
行61  A61: メニューコード     B61: [テキスト入力]  ※将来: self_pay_menu_code
```

> **行54 は意図的に空け**、Case2（行52まで）との視覚的な区切りとする。

### 書式ルール

| 要素 | 書式 |
|---|---|
| A53（見出し）| 背景: ダークグレー / 文字: 白 / 太字 |
| A55:A61（ラベル）| 背景: ライトグレー |
| B55,B56,B60（プルダウン）| 白背景 / プルダウン検証あり |
| B57（数値）| 白背景 / 数値書式 |
| B58,B59（チェックボックス）| チェックボックス / デフォルト: FALSE |
| B61（テキスト）| 白背景 / 薄青枠 |

---

## UIオブジェクト変更差分

**追加（`UI` 定数の末尾に追加）:**

```javascript
// 会計・経営情報ブロック（行53〜61）
// ※ 保険算定のUIブロックとは独立。保存時に readSelfPayFromUI_V3_ で読み取る。
selfPay_accountingType:  "B55",
selfPay_menuType:        "B56",
selfPay_amount:          "B57",
selfPay_chronicFlag:     "B58",
selfPay_nextReserv:      "B59",
selfPay_firstVisitType:  "B60",
selfPay_menuCode:        "B61",  // 将来拡張: self_pay_menu_code（空欄可）
```

---

## HEADER_COLS 変更差分

**追加（`firstVisitType` の次に追加）:**

```javascript
selfPayMenuCode: "自費メニューコード",  // 将来拡張用。空欄可。
```

> `ensureHeaderCols_` が自動追加するため、来院ヘッダのシート側は saveVisit_V3 実行時に自動追記される。

---

## 関数変更差分

### 新設: readSelfPayFromUI_V3_(uiSh)

```javascript
/** ===== 患者画面から自費・経営情報を読み込む（Phase 0） ===== */
function readSelfPayFromUI_V3_(uiSh) {
  var accType  = String(uiSh.getRange(UI.selfPay_accountingType).getValue() || "").trim();
  var menuType = String(uiSh.getRange(UI.selfPay_menuType).getValue() || "").trim();
  var amount   = uiSh.getRange(UI.selfPay_amount).getValue();
  var chronic  = uiSh.getRange(UI.selfPay_chronicFlag).getValue() === true;
  var nextResv = uiSh.getRange(UI.selfPay_nextReserv).getValue() === true;
  var fvType   = String(uiSh.getRange(UI.selfPay_firstVisitType).getValue() || "").trim();
  var menuCode = String(uiSh.getRange(UI.selfPay_menuCode).getValue() || "").trim();

  return {
    accountingType:       accType,
    selfPayMenuType:      menuType,
    selfPayAmount:        (typeof amount === "number" && amount > 0) ? amount : "",
    chronicCandidateFlag: chronic,
    nextReservation:      nextResv,
    firstVisitType:       fvType,
    selfPayMenuCode:      menuCode,
  };
}
```

---

### 新設: clearSelfPayUI_V3_(uiSh)

```javascript
/** ===== 患者画面の自費・経営情報ブロックをクリア ===== */
function clearSelfPayUI_V3_(uiSh) {
  uiSh.getRange(UI.selfPay_accountingType).clearContent();
  uiSh.getRange(UI.selfPay_menuType).clearContent();
  uiSh.getRange(UI.selfPay_amount).clearContent();
  uiSh.getRange(UI.selfPay_chronicFlag).setValue(false);  // チェックボックス → FALSE
  uiSh.getRange(UI.selfPay_nextReserv).setValue(false);   // チェックボックス → FALSE
  uiSh.getRange(UI.selfPay_firstVisitType).clearContent();
  uiSh.getRange(UI.selfPay_menuCode).clearContent();
}
```

---

### 新設: setupSelfPayValidation_V3 / setupSelfPayValidation_V3_(uiSh)

```javascript
/** ===== 自費入力欄の検証・チェックボックス設定（メニューから呼ぶ公開版） ===== */
function setupSelfPayValidation_V3() {
  var ss = SpreadsheetApp.getActive();
  var uiSh = ss.getSheetByName(SHEETS.ui);
  if (!uiSh) throw new Error("患者画面シートが見つかりません");
  setupSelfPayValidation_V3_(uiSh);
  SpreadsheetApp.getUi().alert("自費入力欄の検証設定を完了しました。");
}

/** ===== 患者画面の自費ブロックに検証・チェックボックスを設定（内部用） ===== */
function setupSelfPayValidation_V3_(uiSh) {
  // 会計区分プルダウン
  var acctRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["保険のみ", "保険+自費", "自費のみ"], true)
    .setAllowInvalid(true)
    .build();
  uiSh.getRange(UI.selfPay_accountingType).setDataValidation(acctRule);

  // 自費メニュー区分プルダウン
  var menuRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["手技50分", "運動療法", "セルフケア", "ジム体験", "その他"], true)
    .setAllowInvalid(true)
    .build();
  uiSh.getRange(UI.selfPay_menuType).setDataValidation(menuRule);

  // 慢性候補フラグ・次回予約あり → チェックボックス
  uiSh.getRange(UI.selfPay_chronicFlag).insertCheckboxes();
  uiSh.getRange(UI.selfPay_nextReserv).insertCheckboxes();

  // 新規区分プルダウン（空欄可）
  var fvRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["保険新規", "自費直新規", "再来"], true)
    .setAllowInvalid(true)
    .build();
  uiSh.getRange(UI.selfPay_firstVisitType).setDataValidation(fvRule);
}
```

---

### 修正: saveVisit_V3（差分のみ）

**追加位置: `var now = new Date();` の直後（行703付近）**

```javascript
// ★ Phase 0: 自費・経営情報をUIから読み込む（保険算定には影響しない）
var selfPayInfo = readSelfPayFromUI_V3_(uiSh);
```

**追加位置: `appendHeaderRow_V3_` 呼び出し（行912〜944）— オブジェクトに追加**

```javascript
// Phase 0 追加: 自費・経営情報（保険算定とは完全に独立）
accountingType:        selfPayInfo.accountingType,
selfPayMenuType:       selfPayInfo.selfPayMenuType,
selfPayAmount:         selfPayInfo.selfPayAmount,
chronicCandidateFlag:  selfPayInfo.chronicCandidateFlag,
nextReservation:       selfPayInfo.nextReservation,
firstVisitType:        selfPayInfo.firstVisitType,
selfPayMenuCode:       selfPayInfo.selfPayMenuCode,
```

---

### 修正: clearAfterSaveUI_V3_（差分のみ）

**追加位置: 末尾（行1881の `// 会計ブロックは...` コメントの前）**

```javascript
// Phase 0: 自費・経営情報ブロックをクリア（次の患者入力に備える）
clearSelfPayUI_V3_(uiSh);
```

---

### 修正: clearEntryUI_V3（差分のみ）

**追加位置: `clearAmountsUI_V3_(uiSh);` の直後**

```javascript
// Phase 0: 自費・経営情報ブロックをクリア
clearSelfPayUI_V3_(uiSh);
```

---

### 修正: onOpen — メニュー追加

```javascript
// 既存の "設定シート初期セットアップ" の後に追加
.addItem("自費入力欄初期設定（患者画面B55〜B61）", "setupSelfPayValidation_V3")
```

---

## 来院ヘッダ列対応表

| 患者画面セル | UI定義名 | HEADER_COLS キー | 来院ヘッダ列名 | 型 | 空欄可 |
|---|---|---|---|---|---|
| B55 | selfPay_accountingType | accountingType | 会計区分 | 選択肢 | ✅ |
| B56 | selfPay_menuType | selfPayMenuType | 自費メニュー区分 | 選択肢 | ✅ |
| B57 | selfPay_amount | selfPayAmount | 自費売上額 | 数値 | ✅ |
| B58 | selfPay_chronicFlag | chronicCandidateFlag | 慢性候補フラグ | bool | ✅ (FALSE) |
| B59 | selfPay_nextReserv | nextReservation | 次回予約あり | bool | ✅ (FALSE) |
| B60 | selfPay_firstVisitType | firstVisitType | 新規区分 | 選択肢 | ✅ |
| B61 | selfPay_menuCode | selfPayMenuCode（新設）| 自費メニューコード | テキスト | ✅ |

### 不変列（既存 HEADER_COLS — 変更なし）

| 来院ヘッダ列名 | 更新元 | 備考 |
|---|---|---|
| visitKey | 自動生成 | 変更なし |
| 来院合計 | 保険算定 | **自費金額を混入しない** |
| 窓口負担額 | 保険算定 | 変更なし |
| 保険請求額 | 保険算定 | 変更なし |
| 要確認 / 要確認理由 | 保険算定 | 変更なし |

---

## リスク評価

| リスク | 内容 | 対策 |
|---|---|---|
| 保険算定への混入 | selfPayAmount が来院合計に加算される | `readSelfPayFromUI_V3_` は `calcHeaderAmountsByVisitKey_V3_` に渡さない。保険算定関数は変更なし。|
| 申請書生成への影響 | 施術明細（保険専用）を参照する転記処理に干渉 | 施術明細シート・Ver3_amounts.js・Ver3_transferData.js は変更なし |
| clearAfterSaveUI_ のチェックボックスリセット漏れ | B58/B59が TRUE のまま次の患者に適用される | `clearSelfPayUI_V3_` で `.setValue(false)` を明示 |
| Sheets上の行競合 | 行53〜62が既に他のコンテンツと重なっている | 患者画面の定義行52まで（case2_shoken A47:B52）。行53以降は空欄を事前確認してから設置 |
| `selfPayMenuCode` 列の自動追加 | `ensureHeaderCols_` が来院ヘッダに列を自動追加する | 既存データに影響なし（末尾に追加される）。テストケースのヘッダ定義も更新不要（固定列以外は無視される） |

---

## 実装前の確認事項（手動）

| # | 確認内容 | 確認者 |
|---|---|---|
| 1 | 患者画面の行53〜62が空欄であることを確認 | 院長 or Claude Code（Sheets実物） |
| 2 | 来院ヘッダの最終列番号を確認（selfPayMenuCode列追加位置）| Claude Code |

---

## Sheets 手動設置手順（実装時）

> コード変更（clasp push）前に患者画面に会計ブロックを設置してから実装する。

| 手順 | 操作 |
|---|---|
| 1 | A53に「── 会計・経営情報 ──」と入力 |
| 2 | A55〜A61に各ラベルを入力 |
| 3 | B58/B59を選択 → 挿入 → チェックボックス |
| 4 | GASメニュー「自費入力欄初期設定」を実行してB55/B56/B60のプルダウンを設定 |

> 手順4はclasp push後にGAS上で実行する。

---

## テスト観点（Phase 0）

| # | テスト内容 | 期待値 |
|---|---|---|
| T1 | 会計区分「保険+自費」・自費金額5500・次回予約チェック済みで保存 | 来院ヘッダに正しい値が書き込まれる |
| T2 | 全自費フィールドを空欄で保存 | 来院ヘッダの経営管理列は空欄（エラーなし）|
| T3 | 保存後に来院合計が保険金額のみであることを確認 | 自費金額5500が来院合計に加算されていない |
| T4 | saveVisit_V3 の保存完了ダイアログに自費金額が表示されない | 「来院合計」「窓口負担」「保険請求」は保険算定値のみ |
| T5 | clearAfterSaveUI_V3_ 後にB58/B59がFALSEになっている | チェックボックスがリセットされている |
| T6 | clearEntryUI_V3 後に全自費フィールドが空欄・FALSEになっている | 正常クリア |

---

## ステータス

- [x] 設計完了（2026-03-22）
- [x] Ver3_core.js コード変更（2026-03-22）
- [ ] Sheets手動設置 ← **Phase 1 設計で行7〜9 へ変更予定（行53〜61 設置は不要）**
- [ ] clasp push（Phase 1 の UI const 変更後に実施）
- [ ] GASメニュー「自費入力欄初期設定」実行
- [ ] テスト T1〜T6 実施

> ⚠️ **Phase 1 設計書 (`UI_REDESIGN_PHASE1.md`) 作成済み（2026-03-22）。**
> Phase 0 の会計ブロックセル番地（B55〜B61）を行7〜9（B8/D8/F8/B9/D9/F9/H9）へ変更する。
> Sheets手動設置前に変更するため、行53〜61 への設置作業は不要。

## 実装済みコード変更（Ver3_core.js）

| 変更種別 | 内容 | 行番号（目安）|
|---|---|---|
| UI 追加 | `selfPay_accountingType` 〜 `selfPay_menuCode`（7フィールド）| UI オブジェクト末尾 |
| HEADER_COLS 追加 | `selfPayMenuCode: "自費メニューコード"` | firstVisitType の直後 |
| onOpen メニュー追加 | `自費入力欄初期設定（患者画面B55〜B61）`→ `setupSelfPayValidation_V3` | ensureDetailHeaders の後 |
| saveVisit_V3 修正 | `readSelfPayFromUI_V3_(uiSh)` を `now = new Date()` 直後に呼び出し | 738行付近 |
| appendHeaderRow_V3_ 呼び出し修正 | selfPayInfo の7フィールドを渡す | 956〜966行付近 |
| appendHeaderRow_V3_ 本体修正 | `selfPayMenuCode` の `if (headMap[...])` ガード付き書き込み追加 | 1047行付近 |
| 新設関数 | `readSelfPayFromUI_V3_` | clearAmountsUI_V3_ の後 |
| 新設関数 | `clearSelfPayUI_V3_` | readSelfPayFromUI_V3_ の後 |
| 新設関数 | `setupSelfPayValidation_V3` / `setupSelfPayValidation_V3_` | clearSelfPayUI_V3_ の後 |
| clearAfterSaveUI_V3_ 修正 | `clearSelfPayUI_V3_(uiSh)` を会計ブロックコメントの直前に追加 | 1984行付近 |
| clearEntryUI_V3 修正 | `clearSelfPayUI_V3_(uiSh)` を `clearAmountsUI_V3_` の直後に追加 | 1848行付近 |

## 残作業（院長アクション）

1. **患者画面の行53〜62が空欄であることを確認する**
2. Sheets 上で以下を手動設置：
   - A53: `── 会計・経営情報 ──`（見出し）
   - A55: `会計区分` / A56: `自費メニュー区分` / A57: `自費金額（円）`
   - A58: `慢性候補フラグ` / A59: `次回予約あり` / A60: `新規区分` / A61: `メニューコード`
3. 設置後に「clasp push 実施」を Claude Code に依頼する
4. clasp push 後に GAS メニュー「自費入力欄初期設定（患者画面B55〜B61）」を実行する
