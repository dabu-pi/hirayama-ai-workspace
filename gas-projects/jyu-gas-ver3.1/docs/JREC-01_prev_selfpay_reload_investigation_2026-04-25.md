# JREC-01 前回施術再読込：実装前調査結果

作成日: 2026-04-25  
ブランチ: `feature/auto-dev-phase3-loop`  
ステータス: **調査完了（実装方針確定）**  
前提設計: `docs/JREC-01_prev_selfpay_reload_design_2026-04-23.md`

---

## 0. 調査サマリ

| 論点 | 結論 |
|---|---|
| `openSelfPayDialog_V3` に prevItems を直接渡せるか | **直接渡す方法はない**（引数なし・HTMLへのデータ注入手段がない） |
| 安全な回避パターンは存在するか | **存在する**（PropertiesService 一時スロット方式が推奨） |
| 既存の P01/P04 動作に影響しない方法か | **影響しない**（推奨パターンは openSelfPayDialog_V3 を変更しない） |

---

## 1. `openSelfPayDialog_V3` の定義

**場所:** `Ver3_core.js:5161`

```js
function openSelfPayDialog_V3() {   // 引数なし
  var ss   = SpreadsheetApp.getActive();
  var uiSh = ss.getSheetByName(SHEETS.ui);
  // ...B2(patientId) / B4(treatDate) から visitKey 生成
  var html = HtmlService.createHtmlOutputFromFile("selfPayDialog")
    .setWidth(600).setHeight(420);
  SpreadsheetApp.getUi().showModalDialog(html, "自費明細入力 — " + visitKey);
}
```

**現在の引数: なし。**  
`createHtmlOutputFromFile` を使っているため、サーバー側からHTMLへのデータ直接注入（スクリプトレット）は使えない。コードコメントにも明記されている（Ver3_core.js:5192）。

---

## 2. 現在のデータフロー（完全版）

```
openSelfPayDialog_V3()
  └─ HtmlService.createHtmlOutputFromFile("selfPayDialog")
  └─ showModalDialog(html, タイトル)
       ↓（ダイアログ内で非同期・2ステップ）
       Step1: google.script.run.getCurrentVisitKey_V3()
              ← { visitKey, patientId, treatDate, accountingType,
                  chronicFlag, nextReservation, existItems[], isGymMember }
       Step2: google.script.run.getSelfPayMenuMaster_V3()
              ← [{ menuId, menuName, unitPrice, memberPrice }, ...]
       ↓
       addRow(item.menuId, item.menuName, item.unitPrice, item.qty) × existItems.length
       ↓
       [人間が確認・修正]
       ↓
       google.script.run.saveSelfPayDetailsFromDialog_V3(visitKey, itemsJson, contextJson)
```

---

## 3. `getCurrentVisitKey_V3` の返却構造

**場所:** `Ver3_core.js:5204`  
**返却型:**

```js
{
  visitKey:        string,   // "P001_2026-04-25"
  patientId:       string,   // "P001"
  treatDate:       string,   // "2026-04-25"（Date → 文字列に変換済み）
  accountingType:  string,   // B7
  chronicFlag:     boolean,  // B8
  nextReservation: boolean,  // D8
  existItems:      [{ menuId, menuName, unitPrice, qty }],  // 今回の自費明細
  isGymMember:     boolean,  // B5
}
```

`existItems` は今回の visitKey の実際のデータ。prevItems（前回来院のデータ）とは別物。

**重要:** Date型フィールドはシリアライズ問題のため `existItems` には含めない（既存コメント参照）。prevItems も同じ制約を守る必要がある。

---

## 4. HTML側の初期値読み込みロジック（selfPayDialog.html:200-208）

```js
// 既存データがあれば復元、なければ空行1件
if (visitKeyInfo && visitKeyInfo.existItems && visitKeyInfo.existItems.length > 0) {
  visitKeyInfo.existItems.forEach(function(item) {
    addRow(item.menuId, item.menuName, item.unitPrice, item.qty);
  });
} else {
  addRow();
}
```

**構造上の確認:** HTML側は `visitKeyInfo.existItems` を参照するだけ。サーバー側でこのフィールドに prevItems を混ぜて返せれば、HTML側の変更なしで初期値を注入できる可能性がある。

---

## 5. 論点① 解消結論

### `openSelfPayDialog_V3` に prevItems を直接渡す方法は存在しない

**理由:**
- 引数がない
- `createHtmlOutputFromFile` はスクリプトレット不可
- `showModalDialog` の第1引数（HtmlOutput）にデータを付与する標準的な方法がない

### ただし、安全な回避パターンが2つ存在する

---

## 6. 実装候補パターン比較

### パターンA: PropertiesService 一時スロット方式（推奨）

**仕組み:**

1. `loadPrevSelfPayToDialog_V3()` が prevItems を PropertiesService に書き込む
2. `openSelfPayDialog_V3()` をそのまま呼ぶ（変更なし）
3. ダイアログ内で `getCurrentVisitKey_V3()` の後に新ブリッジ関数 `getAndClearPrevSelfPayItems_V3()` を追加呼び出し
4. 新ブリッジ関数は PropertiesService から prevItems を読んで返し、読み取り後にクリア

**変更範囲:**

| ファイル | 変更 |
|---|---|
| `Ver3_core.js` | `loadPrevSelfPayToDialog_V3()` 新規追加 / `getAndClearPrevSelfPayItems_V3()` 新規追加 |
| `selfPayDialog.html` | `loadMenuMaster()` 内に prevItems 取得・確認ダイアログ処理を追加（約15行） |
| `openSelfPayDialog_V3` | **変更なし** |

**メリット:**
- `openSelfPayDialog_V3` を変更しないため P01/P04 の既存動作に影響なし
- PropertiesService は単一ユーザー運用のため競合リスクなし
- prevItems の有効期限（expiry）をスロットに含めれば古いデータの誤読み込みも防げる

**デメリット:**
- `selfPayDialog.html` の変更が必要（小規模だが変更は変更）
- PropertiesService の読み書きが1往復増える（体感速度への影響は無視できるレベル）

**実装イメージ（GAS側）:**

```js
function loadPrevSelfPayToDialog_V3() {
  // ① patientId/treatDate 取得
  // ② existItems チェック（今回の明細あり → 確認ダイアログ → キャンセルなら中断）
  // ③ prevDate = findLastVisitDateInHeader_(...)
  // ④ prevItems = readSelfPayDetailsForVisit_V3_(detailSh, prevVisitKey)
  //    → {menuId, menuName, qty} のみ抽出。unitPrice は渡さない
  // ⑤ PropertiesService.setProperty('_prevSelfPay_temp',
  //      JSON.stringify({items: [...], expiry: Date.now() + 300000}))
  // ⑥ openSelfPayDialog_V3() を呼ぶ
}

function getAndClearPrevSelfPayItems_V3() {
  var raw = PropertiesService.getScriptProperties().getProperty('_prevSelfPay_temp');
  PropertiesService.getScriptProperties().deleteProperty('_prevSelfPay_temp');
  if (!raw) return [];
  try {
    var data = JSON.parse(raw);
    if (data.expiry && Date.now() > data.expiry) return [];  // 期限切れ
    return data.items || [];
  } catch(e) { return []; }
}
```

---

### パターンB: createTemplateFromFile に切り替える方式

**仕組み:**  
`openSelfPayDialog_V3` を `HtmlService.createTemplateFromFile` に変更し、スクリプトレットで `prevItems` を直接HTMLに埋め込む。

**変更範囲:**

| ファイル | 変更 |
|---|---|
| `openSelfPayDialog_V3` | **変更あり**（createTemplateFromFile に切り替え） |
| `selfPayDialog.html` | スクリプトレット構文に変更 |

**メリット:** データ注入がクリーン

**デメリット:**
- `openSelfPayDialog_V3` を変更するため既存動作への影響リスクがある
- selfPayDialog.html の構造変更が必要（スクリプトレット追加）
- Phase A 中の変更はリスクが高い

**→ 採用しない。**

---

## 7. 論点② 廃止・変更された menuId の扱い（確認）

selfPayDialog.html:246-254 に既存の処理が存在する：

```js
// 既存データでマスタに存在しないメニュー名の場合
if (menuName && !menuMaster.some(function(m){ return m.menuId === menuId; })) {
  var opt2 = document.createElement('option');
  opt2.value = menuId || '';
  opt2.textContent = menuName + ' (手入力)';
  // ...
  opt2.selected = true;
  sel.appendChild(opt2);
}
```

**確認結果:** マスタに存在しない menuId は「(手入力)」として選択状態にする処理が already 実装済み。  
prevItems にマスタ廃止のメニューが含まれていても、「(手入力)」として表示されるため業務は継続できる。  
**論点② は追加実装不要で自然に解消される。**

---

## 8. 実装方針確定

### 採用: パターンA（PropertiesService 一時スロット）

| 項目 | 内容 |
|---|---|
| `openSelfPayDialog_V3` 変更 | **なし** |
| 新規追加関数（GAS） | `loadPrevSelfPayToDialog_V3` / `getAndClearPrevSelfPayItems_V3` の2関数 |
| HTML変更 | `selfPayDialog.html` の `loadMenuMaster()` 内に prevItems 処理を追加（約15行） |
| 論点① | 解消済み。PropertiesService 経由で安全に渡せる |
| 論点② | 解消済み。既存の「(手入力)」フォールバック処理が流用可能 |

### Phase A 中の実装可否

Phase A 中（コード変更なし期間）は実装しない。  
**Phase A 完了（目安: 2026-05-07）後に着手する。**

---

## 9. 実装着手時のチェックリスト

- [ ] `openSelfPayDialog_V3` の動作を再確認してから着手する
- [ ] PropertiesService のキー名 `_prevSelfPay_temp` が既存プロパティと衝突しないか確認
- [ ] `loadPrevSelfPayToDialog_V3` から `openSelfPayDialog_V3` を呼ぶ前に、今回の existItems 確認ダイアログを入れる
- [ ] prevItems の unitPrice は渡さない（マスタ取り直しを徹底）
- [ ] 手動テスト: 同一患者・2回来院シナリオで prevItems が正しく復元されることを確認
- [ ] 手動テスト: 今回の明細がある状態で呼んだ場合の上書き確認ダイアログが出ることを確認
- [ ] 手動テスト: prevItems に廃止 menuId が含まれる場合に「(手入力)」表示になることを確認

---

## 10. 調査対象ファイル・行番号まとめ

| 項目 | ファイル | 行番号 |
|---|---|---|
| `openSelfPayDialog_V3` 定義 | `Ver3_core.js` | 5161 |
| `getCurrentVisitKey_V3` 定義 | `Ver3_core.js` | 5204 |
| `readSelfPayDetailsForVisit_V3_` | `Ver3_core.js` | 4381 |
| `getSelfPayMenuMaster_V3` | `Ver3_core.js` | 4521 |
| `buildVisitKey_` | `Ver3_core.js` | 802 |
| `findLastVisitDateInHeader_` | `Ver3_core.js` | 2764 |
| HTML初期値復元ロジック | `selfPayDialog.html` | 200-208 |
| HTML廃止menuIdフォールバック | `selfPayDialog.html` | 246-254 |
| メニュー登録箇所 | `Ver3_core.js` | 402 |
