# JREC-01 fixture テスト仕様

最終更新: 2026-03-17

---

## 目的

- `calcHeaderAmountsByVisitKey_V3_` の算定ロジックをシート不依存で検証する
- 修正のたびに手動でシートへ入力する運用を廃止し、fixture を正本化する
- GAS 上の `runFixtureSuite_()` で一括確認できる状態を維持する

---

## ディレクトリ構成

```
tests/jrec01/
├── README.md          ← このファイル
├── fixtures/          ← 入力データ（テストシナリオ）
│   ├── TC01_初検.json
│   ├── TC02_再検.json
│   ├── TC03_後療.json
│   ├── M01_mixed再検_初検抑制.json
│   ├── M02_mixed再検_初検抑制なし.json
│   ├── M03_mixed後療_初検抑制.json
│   ├── M04_mixed初検_初検.json
│   └── M05_mixed後療_再検.json
└── expected/          ← 期待値（fixture と 1:1 対応）
    ├── TC01_初検.json
    ├── TC02_再検.json
    ├── TC03_後療.json
    ├── M01_mixed再検_初検抑制.json
    ├── M02_mixed再検_初検抑制なし.json
    ├── M03_mixed後療_初検抑制.json
    ├── M04_mixed初検_初検.json
    └── M05_mixed後療_再検.json
```

> **後続作成: TC04〜TC10** は M 系の確認後に順次追加する

---

## テスト実行方法（GAS 上）

Apps Script エディタで以下を実行：

```
runFixtureSuite_()    ← 全 fixture を一括実行
runFixtureTest_("M01") ← 個別実行
```

結果は `Logger` に出力され、ダイアログにも表示される。

---

## fixture スキーマ

### fixtures/*.json（入力）

```json
{
  "testId": "M01",
  "description": "テストの説明",
  "ref": "TESTCASES.md#M01",

  "context": {
    "patientId": "P001",
    "treatDate": "YYYY-MM-DD",
    "monthlyStatus": {
      "initBilled": false,
      "reBilled": false,
      "supportBilled": false
    }
  },

  "cases": [
    {
      "caseNo": 1,
      "kubun": "初検 | 再検 | 後療",
      "parts": [
        {
          "bui": "腰部",
          "byomei": "捻挫",
          "injuryDate": "YYYY-MM-DD",
          "cold": false,
          "warm": false,
          "electro": false
        }
      ]
    }
  ]
}
```

### expected/*.json（期待値）

```json
{
  "testId": "M01",

  "header": {
    "initFee": 0,
    "reFee": 0,
    "supportFee": 0,
    "detailSum": 0,
    "visitTotal": 0,
    "needCheck": false,
    "needCheckReason": "",
    "billedKubun": "後療",
    "mixedFlag": "通常 | Mixed",
    "case1Summary": "case1:後療",
    "case2Summary": "case2:なし",
    "chargeReason": "後療のみ"
  },

  "details": [
    {
      "detailID": "P001_YYYY-MM-DD_C1_P1",
      "kubun": "後療",
      "baseOut": 505,
      "coldOut": 0,
      "rowTotalOut": 505
    }
  ]
}
```

---

## テスト設定単価（TEST_SETTINGS_ / Ver3_test.js）

| キー | 値 | 備考 |
|---|---|---|
| initFee | 1550 | 令和6年6月施行 |
| initSupport | 100 | 同上 |
| reFee | 410 | 同上 |
| shoryoDaboku/NenZa/Zasyo | 760 | 施療料（打撲/捻挫/挫傷）|
| koryoDaboku/NenZa/Zasyo | 505 | 後療料（打撲/捻挫/挫傷）|
| cold | 85 | 冷罨法 |
| warm | 70 | ⚠️ 要確認（設定シートから取得） |
| electro | 70 | ⚠️ 要確認（設定シートから取得） |
| taiki | 35 | ⚠️ 要確認（設定シートから取得） |
| multiCoef3 | 0.6 | 3部位目逓減 |
| roundUnit | 10 | 窓口端数 |

> ⚠️ warm / electro / taiki は TC06〜TC08 追加時に設定シートから確認して更新すること

---

## TESTCASES.md との対応

| fixture | TESTCASES.md | シート確認 |
|---|---|---|
| TC01_初検 | TC01 | コードレビューのみ |
| TC02_再検 | TC02 | コードレビューのみ |
| TC03_後療 | TC03 | コードレビューのみ |
| M01_mixed再検_初検抑制 | M01 | ✅ 2026-03-16 |
| M02_mixed再検_初検抑制なし | M02 | ⏸ 未確認 |
| M03_mixed後療_初検抑制 | M03 | ✅ 2026-03-16 |
| M04_mixed初検_初検 | M04 | ✅ 確認済み |
| M05_mixed後療_再検 | M05 | ✅ 2026-03-16 |

---

## 設計メモ

- `Ver3_test.js` の `computeAmountsFromFixture_V3_` は `calcHeaderAmountsByVisitKey_V3_` の
  純粋計算部分を複製している。production ロジックを変更した場合は両方を更新すること。
- `calcOnePartAmount_V3_` は既にシート非依存の純粋関数のため、テストランナーから直接呼び出す。
- windowPay / claimPay は負担割合（患者個別）に依存するため expected には含めない。
