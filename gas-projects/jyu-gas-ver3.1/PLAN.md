# 施術明細upsert 実装計画

## ステータス: 実装完了 ✅

最終更新: 2026-03-05

---

## 目的
saveVisit_V3 のステップ④（施術明細upsert）を実装し、
申請書_転記データが正しく生成できるようにする。

## 方針: 案A — 施術明細シートへの書き込み

### 理由
1. 施術明細シートのヘッダ(23列)は既に準備済み
2. Ver3_transferData.js は施術明細を参照する実装が完成済み
3. 療養費支給申請書は部位×傷病単位の明細が必要 → 施術明細の粒度が正にそれ
4. 来院ヘッダへの列追加は煩雑で粒度不足
5. ただし JBIZ-04 連携用の月次KPI列 `会計区分 / 自費メニュー区分 / 自費売上額 / 慢性候補フラグ / 次回予約あり / 新規区分` は、来院ヘッダの最小列追加で扱う方針に切り替える

---

## 変更一覧（完了）

### 1. calcOnePartAmount_V3_ (Ver3_amounts.js) ✅
- **変更後**: 内訳オブジェクトを返す
```javascript
return {
  base, cold, warm, electro, taiki,
  coef, longTermCoef,
  total: (ltBase + ltCold + ltWarm + ltElectro + taiki) * coef,
  byomei, partOrder, injuryDate,
  coldChk, warmChk, electroChk
  // bui は calcCaseDetailAmount_V3_ が part.bui = 部位名 で追加
}
```

### 2. calcCaseDetailAmount_V3_ (Ver3_amounts.js) ✅
- **変更後**: `{ total: 数値, parts: [部位1内訳, 部位2内訳] }` を返す

### 3. calcHeaderAmountsByVisitKey_V3_ (Ver3_amounts.js) ✅
- **変更後**: `amounts.details = { case1Parts: [...], case2Parts: [...] }` を含む

### 4. saveVisit_V3 ステップ④ (Ver3_core.js) ✅
- `amounts.details` を使って施術明細シートに部位ごとの行をupsert
- `detailID = visitKey + "_C" + caseNo + "_P" + partOrder`
- 既存行があれば上書き、なければ追記（冪等）

### 5. Ver3_transferData.js ✅
- `V3TR.CONFIG.setKeys.initSupport`: `"初検時相談支援料"` に修正済み

### 6. SPEC.md §14 ✅
- ステップ④の仕様を具体化（データフロー・ctx引数・冪等性・全列定義）

### 7. TESTCASES.md ✅
- TC01〜TC03 に施術明細upsert観点を追記

---

## 実装関数

`upsertDetailRows_V3_(detailSh, detailMap, ctx)` — Ver3_core.js:879

```javascript
ctx = {
  visitKey,    // 来院キー
  patientId,   // 患者ID
  treatDate,   // 施術日（Date）
  kubun1,      // ケース1の区分
  kubun2,      // ケース2の区分
  amounts,     // calcHeaderAmountsByVisitKey_V3_の返り値（amounts.detailsを使用）
  ep1,         // ケース1のエピソード情報（ep1.episodeStartDateでcaseKey生成）
  ep2,         // ケース2のエピソード情報
  now,         // 現在日時
}
```
