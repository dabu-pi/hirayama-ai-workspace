# 施術明細upsert 実装計画

## 目的
saveVisit_V3 のステップ④（施術明細upsert）を実装し、
申請書_転記データが正しく生成できるようにする。

## 方針: 案A — 施術明細シートへの書き込み

### 理由
1. 施術明細シートのヘッダ(31列)は既に準備済み
2. Ver3_transferData.js は施術明細を参照する実装が完成済み
3. 療養費支給申請書は部位×傷病単位の明細が必要 → 施術明細の粒度が正にそれ
4. 来院ヘッダへの列追加は煩雑で粒度不足

## 変更一覧

### 1. calcOnePartAmount_V3_ (Ver3_core.js)
- 現在: 数値1つを返す `return (base + cold + warm + electro + taiki) * coef`
- 変更: 内訳オブジェクトを返す
```javascript
return {
  base: base,      // 後療料（逓減前）
  cold: cold,      // 冷罨法
  warm: warm,      // 温罨法
  electro: electro,// 電療
  taiki: taiki,    // 待機
  coef: coef,      // 逓減係数
  total: (base + cold + warm + electro + taiki) * coef,
  // 施術明細シート用の追加情報
  byomei: byomei,
  bui: bui,
  partOrder: partOrder,
  injuryDate: injuryDate,
  coldChk: coldChk,
  warmChk: warmChk,
  electroChk: electroChk
}
```

### 2. calcCaseDetailAmount_V3_ (Ver3_core.js)
- 現在: detail1 + detail2 の数値合計を返す
- 変更: { total: 数値, parts: [部位1内訳, 部位2内訳] } を返す

### 3. calcHeaderAmountsByVisitKey_V3_ (Ver3_core.js)
- 内訳をamountsオブジェクトに含めて上位に渡す
- amounts.details = { case1Parts: [...], case2Parts: [...] }

### 4. saveVisit_V3 ステップ④ (Ver3_core.js)
- amounts.details を使って施術明細シートに部位ごとの行をupsert
- detailID = visitKey + "_C" + caseNo + "_P" + partOrder
- 既存行があれば上書き、なければ追記

### 5. Ver3_transferData.js
- V3TR.CONFIG.setKeys.initSupport: "初検時相談支援" → "初検時相談支援料"

### 6. SPEC.md
- §14 ステップ④の仕様を具体化
