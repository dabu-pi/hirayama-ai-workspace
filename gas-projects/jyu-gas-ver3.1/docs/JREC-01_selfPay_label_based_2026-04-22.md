# JREC-01 自費明細3関数 項目名ベース化 — 実装記録

実装日: 2026-04-22  
対象ブランチ: `feature/auto-dev-phase3-loop`  
関連計画: `docs/JREC-01_横展開計画_label_based_2026-04-22.md`（P1）

---

## 変更概要

自費明細シート（`SHEETS.selfPayDetail = "自費明細"`）を操作する3関数を、
位置固定アクセスから **列名ベースアクセス** に統一した。

| 関数 | 変更前 | 変更後 |
|---|---|---|
| `appendSelfPayDetailRow_V3_` | `appendRow([14要素固定配列])` | `buildHeaderColMap_` + `put_` ヘルパー + `appendRow(rowArr)` |
| `readSelfPayDetailsForVisit_V3_` | `colIdx["列名"] \|\| 位置番号` のフォールバック | `colIdx[SELF_DETAIL_COLS.xxx]` のみ（位置フォールバック廃止） |
| `deleteSelfPayDetailRows_V3_` | `headRow.indexOf("visitKey")` 文字列直打ち | `SELF_DETAIL_COLS.visitKey` 定数参照 |

---

## 追加定数

`Ver3_core.js` の `MASTER_COLS` 直後（line ~375）に `SELF_DETAIL_COLS` を追加。

```javascript
const SELF_DETAIL_COLS = {
  detailId:        "明細ID",
  visitKey:        "visitKey",
  lineNo:          "行番号",
  treatDate:       "施術日",
  patientId:       "患者ID",
  accountingType:  "会計区分",
  menuId:          "menu_id",
  menuName:        "メニュー名",
  unitPrice:       "単価",
  qty:             "数量",
  subtotal:        "小計",
  chronicFlag:     "慢性候補フラグ",
  nextReservation: "次回予約あり",
  createdAt:       "作成日時",
};
```

列名は `ensureSelfPayDetailSheetInternal_` の 14 列（line ~4203）と同一。
シートヘッダの変更は **行っていない**。

---

## 各関数の変更詳細

### appendSelfPayDetailRow_V3_

**変更前の問題:**  
`detailSh.appendRow([rowObj.selfPayDetailId, rowObj.visitKey, ...])` — 14要素固定順。  
シートで列が追加・並び替えされると、別列にデータが書き込まれる（サイレントな誤書き込み）。

**変更後の動作:**
1. `buildHeaderColMap_(detailSh)` でヘッダ → 列番号マップ取得
2. `new Array(lastCol).fill("")` で空行配列を作成
3. ローカル `put_` ヘルパーで `SELF_DETAIL_COLS.*` 定数を使って各列に書き込み
4. 列が見つからない場合は `missing` に記録 → Logger.log で WARN 出力
5. `detailSh.appendRow(rowArr)` で書き込み

**Logger 出力（正常時）:**
```
[appendSelfPay] 書き込み: visitKey=P001_20260422 lineNo=1
```

**Logger 出力（列なし時）:**
```
[appendSelfPay] WARN 列なし: 会計区分, menu_id visitKey=P001_20260422
```

### readSelfPayDetailsForVisit_V3_

**変更前の問題:**  
`data[r][colIdx["menu_id"] || 6]` — 列が見つからない場合に位置番号（6列目）にフォールバック。  
列順変更があると誤った列のデータを返す。

**変更後の動作:**
1. `headRow.forEach` で `colIdx` を構築（変更なし — データは1回読み）
2. `colIdx[SELF_DETAIL_COLS.xxx]` で 0-based インデックスを取得
3. `get_` ローカルヘルパーで「列が見つからない場合は `undefined` を返す」安全アクセス
4. 返却値の `|| default` は存在するが、位置番号フォールバック（`|| 6` 等）は **完全廃止**
5. 必須列の欠落を Logger.log で WARN 出力

**Logger 出力（正常時）:**
```
[readSelfPay] visitKey=P001_20260422 件数=2
```

**Logger 出力（列なし時）:**
```
[readSelfPay] WARN 列なし: 明細ID
[readSelfPay] WARN ヘッダに列なし: visitKey
```

### deleteSelfPayDetailRows_V3_

**変更前の問題:**  
`headRow.indexOf("visitKey")` — 文字列直打ち。`SELF_DETAIL_COLS` 未使用。

**変更後の動作:**
1. `headRow` を走査して `SELF_DETAIL_COLS.visitKey` に一致する列を 0-based で取得
2. 列が見つからない場合は Logger.log WARN 出力 + early return
3. 削除件数を Logger.log に出力

**Logger 出力（正常時）:**
```
[deleteSelfPay] visitKey=P001_20260422 削除件数=2
```

**Logger 出力（列なし時）:**
```
[deleteSelfPay] WARN ヘッダに列なし: visitKey
```

---

## 既存データ互換

- シートヘッダを **変更していない**（`ensureSelfPayDetailSheetInternal_` の14列は同一）
- 既存行のデータ値を **書き換えていない**
- `readSelfPayDetailsForVisit_V3_` の返却オブジェクトのキー名は変更なし  
  → `saveSelfPayDetails_V3_` / `updateSelfPayDisplay_V3_` / `updateH8Status_V3_` への影響なし
- `normalizeMenuId_` の適用ロジックは変更なし

---

## 変更しなかったもの

| 対象 | 理由 |
|---|---|
| `ensureSelfPayDetailSheetInternal_` | シートヘッダの 14 列文字列はそのまま。`SELF_DETAIL_COLS` の値と同一なので変更不要 |
| `saveSelfPayDetails_V3_` | シグネチャ・ロジック変更なし。3関数を呼び出す側で影響なし |
| `deleteSelfPayDetailRows_V3_` の行削除ロジック | 後方ループで deleteRow — 正しいパターンにつき変更なし |
| Ver3_amounts.js / Ver3_transferData.js | 自費明細関数を直接呼ばない |

---

## 確認手順（実機）

1. 自費明細入力ダイアログからメニューを選択して保存
   → Logger で `[appendSelfPay] 書き込み: visitKey=... lineNo=...` が出ること
   → 自費明細シートの列に正しくデータが入っていること（列順が変わっても正常）

2. 同日再保存（delete & replace フロー）
   → Logger で `[deleteSelfPay] 削除件数=N` → `[appendSelfPay] 書き込み: lineNo=1` の順に出ること

3. 患者画面で自費明細読み込み（D7/F7/H8 の表示確認）
   → Logger で `[readSelfPay] visitKey=... 件数=N` が出ること
   → `WARN 列なし` が出ていないこと

4. **列順変更テスト（省略可 — 必要時に）:**  
   自費明細シートの列を並び替えて上記手順を再実行 → データが正しい列に入ること

---

## Dashboard / Run_Log 反映

**不要。** コードのみの変更。運用フロー・帳票出力・保険計算ロジックへの影響なし。
