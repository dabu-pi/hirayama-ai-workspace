# JREC-01 項目名ベース転記 横展開計画

作成日: 2026-04-22  
対象ブランチ: `feature/auto-dev-phase3-loop`

---

## 背景

`copyInsurerToMaster_V3` のリファクタリング（2026-04-22）で確立した方式:

- **項目名ベース転記**: `buildHeaderColMap_` / `getMasterHeaderMap_` + `setByName_` でセル番地を持たない
- **Logger 3種出力**: 転記済み / マスタ列なし / 値が空 を分類して可視化
- **転記スコープ = シート構造**: FIELD_MAP ハードコードなし。シートに列があれば転記する

この方式を他の転記・データ連携処理へ横展開する計画を記録する。

---

## 評価対象関数一覧

### Ver3_core.js

| 関数名 | 行番号 | 対象シート | 方式 | Logger | 評価 |
|---|---|---|---|---|---|
| `readRowNewUI_` | 1016 | 患者画面(UI) | A1定数（`UI.*`） | なし | UIフォーム=レイアウト固定→**対応不要** |
| `saveVisit_V3` → `saveCaseRow_V3_` | 1076 / 1580 | 来院ケース | `setByName_` + `CASE_COLS.*` | なし | ✅ ラベル完了。Logger 追加候補 |
| `appendHeaderRow_V3_` | 1440 | 来院ヘッダ | `setByName_` + `HEADER_COLS.*` | なし | ✅ ラベル完了。Logger 追加候補 |
| `autofillFromPreviousVisit_V3` | 1839 | 患者画面↔来院ケース | UI側A1定数 / ケース側ラベル | なし | UIフォーム側→**対応不要** |
| `reloadVisitToUI_V3` | 2150 | 患者画面↔来院ケース | UI側A1定数 / ケース側ラベル | Logger.log 1行 | UIフォーム側→**対応不要** |
| `exportHeaderFromCases_V3` | 2598 | 来院ヘッダ | `setByName_` + `HEADER_COLS.*` | なし | ✅ ラベル完了。Logger 追加候補 |
| `appendSelfPayDetailRow_V3_` | 4240 | 自費明細 | **位置固定 `appendRow([...])`** | なし | ⚠️ **要対応（最優先）** |
| `readSelfPayDetailsForVisit_V3_` | 4303 | 自費明細 | 自前 `indexOf` でcolIdxマップ | なし | ⚠️ 要統一（appendRow対応時に同時） |
| `deleteSelfPayDetailRows_V3_` | 4219 | 自費明細 | 自前 `indexOf("visitKey")` | なし | ⚠️ 要統一（同上） |
| `copyInsurerToMaster_V3` | 3971 | 患者マスタ | ラベルベース + Logger3種 | Logger有3種 | ✅ **今回実装済み（基準実装）** |

### Ver3_transferData.js

| 関数名 | 行番号 | 対象シート | 方式 | Logger | 評価 |
|---|---|---|---|---|---|
| `V3TR_loadMasterRow_` | 831 | 患者マスタ | `V3TR_buildHeaderMap_` + colName | なし | ✅ ラベル完了 |
| `V3TR_loadInsurerRow_` | 870 | 保険者情報 | `V3TR_buildHeaderMap_` + colName | なし | ✅ ラベル完了 |
| `V3TR_writeToApplication_` | 1645 | 申請書テンプレ | A1定数（`appCellMap`） | なし | 申請書=固定レイアウト→**対応不要** |

---

## 「対応不要」の根拠

### UIフォームシート（患者画面）
`患者画面` はスプレッドシートを入力フォームとして使う固定レイアウトシート。  
行1にヘッダがなく、セル位置（B2=患者ID、B4=来院日 等）がUIの意味をもつ。  
`UI.*` 定数による A1 アクセスはこのシートの正しいアクセスパターン。  
変更するとUIデザイン全体と連動するため、項目名ベース化の対象外。

### 申請書テンプレ
療養費支給申請書の決まった書式に1桁ずつ入力する処理。  
`appCellMap` は書式仕様のセルアドレス集であり、「ヘッダ行から探す」概念がない。  
書式が変わらない限り A1 アドレスで管理するのが正しい。

---

## 優先度付き対応リスト

### P1（最優先）— 自費明細シートの3関数セット

**対象:**
- `appendSelfPayDetailRow_V3_`（line 4240）— 書き込み
- `readSelfPayDetailsForVisit_V3_`（line 4303）— 読み込み
- `deleteSelfPayDetailRows_V3_`（line 4219）— 削除

**問題:**  
`appendSelfPayDetailRow_V3_` は `detailSh.appendRow([14要素の固定配列])` で書き込む。  
シートヘッダ順（明細ID, visitKey, 行番号, 施術日, 患者ID, 会計区分, menu_id, メニュー名, 単価, 数量, 小計, 慢性候補フラグ, 次回予約あり, 作成日時）がコード内配列順と一致している前提。  
列が追加・移動された場合、データが誤列に書き込まれる（値が正常に見えても意味がずれる）。

`readSelfPayDetailsForVisit_V3_` / `deleteSelfPayDetailRows_V3_` は `headRow.indexOf(...)` で自前マップを構築しているため読み取り側はある程度安全だが、`buildHeaderColMap_` に統一されていない。

**対応内容:**  
1. `appendSelfPayDetailRow_V3_` を `buildHeaderColMap_` + `setByName_` 方式に変換
2. `readSelfPayDetailsForVisit_V3_` / `deleteSelfPayDetailRows_V3_` の自前 indexOf を `buildHeaderColMap_` に統一
3. 3関数に Logger 出力を追加（書き込み件数・列なし・削除件数）

**シートヘッダ定数（現状）:**  
`ensureSelfPayDetailSheetInternal_` で定義（line 4203）:
```
明細ID / visitKey / 行番号 / 施術日 / 患者ID /
会計区分 / menu_id / メニュー名 / 単価 / 数量 /
小計 / 慢性候補フラグ / 次回予約あり / 作成日時
```
これを `SELF_DETAIL_COLS` 定数にまとめ、コード全体で参照する。

### P2（中優先）— ラベル完了済み関数への Logger 追加

**対象:**
- `saveCaseRow_V3_` / `writeLinesToCaseRow_`（来院ケース保存）
- `appendHeaderRow_V3_`（来院ヘッダ追記）
- `exportHeaderFromCases_V3`（ヘッダ一括エクスポート）

**問題:**  
転記方式は `setByName_` + 定数でラベルベース完了済み。  
ただし Logger が実質ゼロのため、保存失敗・列なしを実機で検知できない。

**対応内容:**  
`copyInsurerToMaster_V3` のパターンに倣い、各関数末尾に Logger.log を追加。  
最低限: 保存した visitKey + 列数 / 列なしの場合は警告。

---

## 最初に着手する1件

**P1: 自費明細シート3関数セット** の `appendSelfPayDetailRow_V3_` を起点に着手する。

**選定理由:**
- 位置固定 `appendRow` はリスクが最も高い（書き込み時に静かにデータを壊す）
- `readSelfPayDetailsForVisit_V3_` / `deleteSelfPayDetailRows_V3_` と同一シートの3操作セットなので一括修正が最もコスト効率が高い
- `copyInsurerToMaster_V3` と同じ「書き込み + Logger」パターンで完結できる
- 保険算定ロジック（Ver3_amounts.js）への影響なし

---

## 次回実装プロンプト（P1用）

```
JREC-01 の自費明細シート（SHEETS.selfPayDetail = "自費明細"）の
3関数を、項目名ベース転記 + Logger 方式に統一してください。

【対象関数】
1. appendSelfPayDetailRow_V3_（line 4240）— 書き込み
2. readSelfPayDetailsForVisit_V3_（line 4303）— 読み込み
3. deleteSelfPayDetailRows_V3_（line 4219）— 削除

【現状の問題】
- appendSelfPayDetailRow_V3_ が detailSh.appendRow([14要素固定配列]) を使っている
  → 列追加・並び替えでデータが誤列に書き込まれる
- read/delete 関数は headRow.indexOf() で自前マップを作っている
  → buildHeaderColMap_ に統一されていない

【実装要件】
1. SELF_DETAIL_COLS 定数を Ver3_core.js の定数セクション（CASE_COLS 等の近く）に追加する
   列名は ensureSelfPayDetailSheetInternal_（line 4203）の 14 列と同一:
   {
     detailId:       "明細ID",
     visitKey:       "visitKey",
     lineNo:         "行番号",
     treatDate:      "施術日",
     patientId:      "患者ID",
     accountingType: "会計区分",
     menuId:         "menu_id",
     menuName:       "メニュー名",
     unitPrice:      "単価",
     qty:            "数量",
     subtotal:       "小計",
     chronicFlag:    "慢性候補フラグ",
     nextReservation:"次回予約あり",
     createdAt:      "作成日時"
   }

2. appendSelfPayDetailRow_V3_ を以下の方式に変換する:
   - detailSh の lastColumn を取得し、空配列 rowArr を作成
   - buildHeaderColMap_(detailSh) でヘッダマップを取得
   - setByName_(rowArr, detailMap, SELF_DETAIL_COLS.xxx, rowObj.xxx) で各列に書き込む
   - detailSh.appendRow(rowArr) で書き込み
   - Logger.log("[appendSelfPay] 書き込み: visitKey=" + rowObj.visitKey + " lineNo=" + rowObj.lineNo)
   - 列が見つからない場合は Logger.log("[appendSelfPay] WARN 列なし: ...")

3. readSelfPayDetailsForVisit_V3_ を buildHeaderColMap_ ベースに変換する:
   - data[0] の indexOf() を廃止し、buildHeaderColMap_ でマップ取得
   - colIdx[colName] → detailMap[SELF_DETAIL_COLS.xxx] でアクセス
   - Logger.log("[readSelfPay] visitKey=" + visitKey + " 件数=" + result.length)

4. deleteSelfPayDetailRows_V3_ を buildHeaderColMap_ ベースに変換する:
   - headRow.indexOf("visitKey") を廃止
   - detailMap = buildHeaderColMap_(detailSh); vkCol = detailMap[SELF_DETAIL_COLS.visitKey]
   - Logger.log("[deleteSelfPay] visitKey=" + visitKey + " 削除件数=" + count)

【制約】
- シートヘッダの変更不要（ensureSelfPayDetailSheetInternal_ の 14 列はそのまま）
- Ver3_amounts.js / Ver3_transferData.js は変更しない
- 呼び出し元 saveSelfPayDetails_V3_（line 4345）のシグネチャは変えない
- clasp push まで実施して完了とする
```

---

## 残論点

| 論点 | 内容 | 対応優先度 |
|---|---|---|
| `saveCaseRow_V3_` Logger | 来院ケース保存に Logger がない | P2（次次回） |
| `appendHeaderRow_V3_` Logger | 来院ヘッダ追記に Logger がない | P2 |
| `V3TR_loadMasterRow_` Logger | 患者マスタ読み込みに Logger がない | P2 |
| 自費明細 col 不足時の初期化 | `buildHeaderColMap_` でマップできない列がある場合の保護 | P1 実装時に確認 |
