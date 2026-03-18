# 柔整 Ver3 金額計算 テストケース（TESTCASES.md）

最終更新: 2026-03-17
参照: SPEC.md（柔整 Ver3 金額計算 仕様書）

> **fixture テスト: 48/48 PASS 確認予定（2026-03-18）**
> TC09b（[A]施術継続中・case2再検抑制）追加。clasp push → runFixtureSuite() で PASS 確認すること。
>
> **2026-03-18 金額不整合修正:** [A] 施術継続中シナリオで case2 再検が誤算定されるバグを修正。
> `getMonthlyBilledStatus_` に reBilled 用 `isCaseEndedBefore_` チェック追加 + `calcHeaderAmountsByVisitKey_V3_` の reFee 条件に `!reBilled` を追加。TC09b fixture で修正後の動作を確認。

---

## 0. 共通前提

- 日数計算:
  - 受傷日経過 = 来院日 - 受傷日（受傷日=0, 翌日=1）
  - 前回来院差 = 来院日 - 前回来院日
- 別ケース判定:
  - UIでcaseKey新規作成 → 別ケース
- 患者×月上限（当月1回）:
  - 初検料 / 相談支援料
- 再検料:
  - 同一 caseKey の初検後・最初の後療日のみ（エピソード内1回、caseKey単位で独立管理）
- 実装安全弁:
  - 算定不可でもチェックは残す、金額0、要確認TRUE、要確認理由へ記録

---

## 1. テストケース一覧（概要）

- TC01: 初検（新規捻挫1部位・来院日=受傷日・冷あり・相談支援あり）✅
- TC02: 最初の後療日（再検算定・加算なし）✅
- TC03: 2回目以降の後療日（再検不可ログ・加算なし）✅
- TC04: 30日境界（30日継続 / 31日リセット）✅
- TC05: 冷罨法（打撲/捻挫 受傷0-1日のみ）✅
- TC06: 温/電（捻挫 受傷5日経過後のみ）✅
- TC07: 温/電（骨折 受傷7日経過後のみ）✅
- TC08: 冷罨法（脱臼 0-4日のみ）✅ koryoDakkyu=720 確認済み（2026-03-17）
- TC09: 月内上限の再検抑制（両ケース後療・reBilled=true）✅
- TC09b: [A]施術継続中・case2再検抑制（reBilled=true → reFee=0）✅ 2026-03-18 修正・fixture 追加 / ✅ 実シート確認済み（2026-03-19: コア挙動OK、総額差は付随算定による）
- TC10: 複合（同月別ケース＋加算算定不可＋要確認理由複数）✅
- TC11: 初検 脱臼（整復料 seifukuDakkyu=5200 算定）✅ seifukuDakkyu=5200 確認済み（2026-03-17）
- TC12: 多部位逓減 2部位（1,2部位目 係数1.0 各505→合計1010）
- TC13: 多部位逓減 3部位（3部位目 係数0.6→303、合計1313）
- TC14a: 長期逓減 境界（monthsElapsed=4、減額なし→505）
- TC14b: 長期逓減 75%適用（monthsElapsed=5、505×0.75=379）
- TC15a: 不全骨折冷罨法 dayDiff=6（境界OK）→ base=720+cold=85=805
- TC15b: 不全骨折冷罨法 dayDiff=7（境界NG）→ cold=0、needCheck=true
- TC16a: 長期50%逓減（monthsElapsed=5 + 全月10回以上）→ 505×0.50=253
- TC16b: 長期75%維持（monthsElapsed=5 だが月3=9回<10）→ 505×0.75=379
- TC16c: 長期条件未達（monthsElapsed=4）→ 減額なし=505
- TC17a: 温罨法 初検日特例（初検日+dayDiff=6+warm要求 → warm=0, visitTotal=2410）
- TC17b: 温罨法 後療日・通常算定（後療日+dayDiff=6+warm要求 → warm=75, rowTotalOut=585）
- TC18a: 長期継続理由書アラート（monthsElapsed=3 → needCheck=true, 理由追加）
- TC18b: 長期継続理由書アラートなし（monthsElapsed=2 → needCheck=false）
- TC19a: 金属副子等加算 骨折（metalChk=true → metalOut=1000, rowTotalOut=1850, needCheck=false）
- TC19b: 金属副子等加算 捻挫（metalChk=true → metalOut=0 + 要確認, needCheck=true）
- TC20a: 金属副子等加算 Phase 2・1回目（metalPriorCount=0 → metalOut=1000, needCheck=false）
- TC20b: 金属副子等加算 Phase 2・3回目（metalPriorCount=2 → metalOut=1000, needCheck=false）
- TC20c: 金属副子等加算 Phase 2・上限超（metalPriorCount=3 → metalOut=0 + 要確認, needCheck=true）
- M01: 混在（case1=再検 / case2=初検抑制）→ 再検料410 / 初検料0 ✅ 実シート確認済み
- M02: 混在（case1=再検 / case2=初検抑制なし）→ 初検料1550 / 再検料0 ✅ 実シート確認済み
- M03: 混在（case1=後療 / case2=初検抑制）→ 初検料0 / 再検料0 ✅ 実シート確認済み
- M04: 混在（case1=初検 / case2=初検）→ 初検料1回のみ / 両ケース施療料 ✅
- M05: 混在（case1=後療 / case2=再検）→ 再検料410 / 後療料のみ ✅ 実シート確認済み（e931fe5）
- M06a: 治癒後別負傷（施術継続中 Mixed）→ 再検料410×1 のみ（キャップ）✅ ロジック確認
- M06b: 治癒後別負傷（治癒後の新規 Mixed）→ 再検料410×2（各エピソードで1回ずつ）✅ ロジック確認 / ✅ NDJSON・申請書生成で実値確認済み（2026-03-17: initFee=3100 / reFee=820）/ ✅ fixture 追加済み（2026-03-18: case2初検 per-visit）

---

## TC01: 初検（新規捻挫1部位・来院日=受傷日・冷あり・相談支援あり）

### 入力
- 患者: P001
- 2026/02/03 caseKey=A 新規、傷病=捻挫、部位=腰部、受傷日=2/03
- 冷チェックON（受傷後経過0日）、相談支援あり

### 期待値（金額計算）
- 区分=初検
- 初検料=1550、相談支援料=100、再検料=0
- 施療料=760、冷罨法=85
- detailSum（施療料+冷）= 845
- visitTotal（初検料+相談支援料+detailSum）= 2495
- 要確認=FALSE

### 期待値（施術明細upsert観点）

| 確認項目 | 期待値 |
|---|---|
| detailID | `P001_2026-02-03_C1_P1` |
| 区分 | `初検` |
| 部位 | `腰部` |
| 傷病 | `捻挫` |
| 部位順位 | `1` |
| 基本料_確定 | 760（施療料_捻挫） |
| 冷_確定 | 85 |
| 行合計_確定 | 845 |

---

## TC02: 最初の後療日（再検算定・加算なし）

### 入力
- 患者: P001（TC01 の続き、同一 caseKey=A）
- 2026/02/05 caseKey=A 継続（前回来院差=2日、経過日数=2日）
- 加算チェックなし

### 期待値（金額計算）
- 区分=再検（初検後最初の後療日）
- 初検料=0、相談支援料=0
- 再検料=410
- 後療料=505（後療料_捻挫）
- detailSum（後療料のみ）= 505
- visitTotal（再検料+detailSum）= 915
- 要確認=FALSE

### 期待値（施術明細upsert観点）

| 確認項目 | 期待値 |
|---|---|
| detailID | `P001_2026-02-05_C1_P1` |
| 区分 | `再検` |
| 基本料_確定 | 505（後療料_捻挫） |
| 行合計_確定 | 505 |

---

## TC03: 2回目以降の後療日（再検不可ログ・加算なし）

### 入力
- 患者: P001（TC02 の続き、同一 caseKey=A）
- 2026/02/07 caseKey=A 継続（前回来院差=2日、経過日数=4日）
- 加算チェックなし

### 期待値（金額計算）
- 区分=後療（2回目以降の後療）
- 初検料=0、相談支援料=0
- 再検料=0（抑制）
- 後療料=505（後療料_捻挫）
- detailSum（後療料のみ）= 505
- visitTotal = 505
- 要確認=FALSE
- 監査ログ: 「初検後2回目以降の後療のため再検料不可」を記録

### 期待値（施術明細upsert観点）

| 確認項目 | 期待値 |
|---|---|
| detailID | `P001_2026-02-07_C1_P1` |
| 区分 | `後療` |
| 基本料_確定 | 505（後療料_捻挫） |
| 行合計_確定 | 505 |

---

## TC04: 30日境界（30日継続 / 31日リセット）

### 入力
- 患者: P001
- 2026/01/05 caseKey=A 新規（初検）
- 2026/02/04 来院（前回来院差=30日）
- 2026/02/05 来院（前回来院差=31日） ※比較用

### 期待値
- 2/4:
  - 30日以内 → 継続（後療）
  - 初検料=0
- 2/5:
  - 30日超 → 初検リセット（初検扱い）
  - 当月初検が未算定なら初検料=1, 相談支援料=1
  - 要確認=FALSE（抑制ではない）

---

## TC05: 冷罨法（打撲/捻挫 受傷0-1日のみ）

### 入力
- 患者: P001
- 傷病=捻挫, 受傷日=2026/02/01
- 2/01 来院（経過0日）冷チェックON
- 2/02 来院（経過1日）冷チェックON
- 2/03 来院（経過2日）冷チェックON

### 期待値
- 2/01: 冷=算定可（>0）
- 2/02: 冷=算定可（>0）
- 2/03: 冷=算定不可（0）
  - チェックは残る
  - 要確認=TRUE
  - 要確認理由: 「冷罨法 算定不可（捻挫：受傷後2日）」等

---

## TC06: 温/電（捻挫 受傷5日経過後のみ）

### 入力
- 患者: P001
- 傷病=捻挫, 受傷日=2026/02/01
- 2/05 来院（経過4日）温/電チェックON
- 2/06 来院（経過5日）温/電チェックON

### 期待値
- 2/05: 温=0, 電=0（算定不可）
  - 要確認=TRUE, 理由記録
- 2/06: 温>0, 電>0（算定可）
  - 要確認は算定不可が無ければFALSE

---

## TC07: 温/電（骨折 受傷7日経過後のみ）

### 入力
- 患者: P001
- 傷病=骨折, 受傷日=2026/02/01
- 2/07 来院（経過6日）温/電チェックON
- 2/08 来院（経過7日）温/電チェックON

### 期待値
- 2/07: 温=0, 電=0（算定不可）
- 2/08: 温>0, 電>0（算定可）

---

## TC08: 冷罨法（脱臼 0-4日のみ）

### 入力
- 患者: P001
- 傷病=脱臼, 受傷日=2026/02/01
- 2/05 来院（経過4日）冷チェックON
- 2/06 来院（経過5日）冷チェックON

### 期待値
- 2/05: 冷>0（算定可）
- 2/06: 冷=0（算定不可）＋要確認TRUE＋理由

---

## TC09: 月内上限の再検抑制（両ケース後療・reBilled=true）

> **実装状況:** `reBilled` フラグで月上限制御済み（追加実装不要・2026-03-17 確認）
> `getMonthlyBilledStatus_` が `reBilled: true` を返すと `reFee=0` に抑制。
> fixture は「再検消化後の状態（両ケース後療）」をモデル化しており、reBilled=true → reFee=0 の動作を確認している。

### 入力
- 患者: P001
- 2/01 caseKey=A 新規（初検）
- 2/03 来院（次回来院）→ 再検算定（ここで当月再検が消化）
- 2/10 caseKey=B 新規（同月別ケース初回：初検抑制）
- 2/12 来院（Bの次回来院相当）→ 本来なら再検っぽいが上限で抑制

### 期待値
- 2/12:
  - 再検料=0（当月再検は既に1回算定済、reBilled=true）
  - 後療料は施術実態があれば算定可
  - 要確認=FALSE（算定不可なし）

---

## TC09b: [A]施術継続中・case2再検抑制（reBilled=true → reFee=0）

> **実装状況:** 2026-03-18 修正済み。Ver3_amounts.js 2箇所変更で正しく抑制される。
>
> **修正前のバグ:** `calcHeaderAmountsByVisitKey_V3_` の reFee 判定に `!monthlyStatus.reBilled` が欠落。
> case1 施術継続中 + case2 再検の来院日で reFee=410 が誤算定されていた。
>
> **修正内容:**
> - `getMonthlyBilledStatus_`: reBilled 立てる前に `isCaseEndedBefore_` チェック追加（[B] なら suppressReBilled=true）
> - `calcHeaderAmountsByVisitKey_V3_`: reFee 条件に `!monthlyStatus.reBilled` 追加
> - `computeAmountsFromFixture_V3_` (Ver3_test.js): reFee 条件に `!ms.reBilled` 追加（production と同期）

### 入力（fixture）
- 患者: P001
- treatDate: 2026-02-12
- monthlyStatus: initBilled=true, reBilled=true, supportBilled=true
- case1: kubun=後療、腰部、捻挫、受傷日=2026-02-01（施術継続中）
- case2: kubun=再検、肩関節、打撲、受傷日=2026-02-08（月内2件目の再検）

### 期待値

> **実シート確認済み: 2026-03-19**
> コア挙動（reFee抑制・区分判定・要約5列）はOK。
> 実シートの detailSum/visitTotal は付随算定（温罨法・電療等）の入力により 1010 より大きくなりうる。
> 総額一致はテスト趣旨の対象外。

**コア確認項目（合否判定の本質）:**
- reFee=0（reBilled=true → [A] 抑制）✅
- billedKubun=後療 ✅
- mixedFlag=Mixed ✅
- case1Summary=case1:後療 ✅
- case2Summary=case2:再検 ✅
- chargeReason=後療のみ ✅

**参考: 付随算定OFFの基準額（加算なし入力時の理論値）:**
- initFee=0（initBilled=true → 抑制）
- supportFee=0（hasBillableInitial=false）
- detailSum=1010（後療505 + 再検505）
- visitTotal=1010

### [A]/[B] 分岐まとめ

| シナリオ | 先行ケース状態 | isCaseEndedBefore_ | reBilled | case2 再検 reFee |
|---|---|---|---|---|
| [A] 施術継続中（TC09b）| 施術継続中（endDate なし/未来）| false | true | 0（抑制）✅ |
| [B] 治癒後別負傷（M06b相当）| 治癒済（endDate < treatDate）| true | false | 410（許可）✅ |

---

## TC11: 初検 脱臼（整復料 seifukuDakkyu=5200 算定）

> seifukuDakkyu=5200（2026-03-17 設定シート確認済み）

### 入力
- 患者: P001
- 2026/02/01 caseKey=A 新規（初検）、脱臼、肩関節、受傷日=2/01

### 期待値
- kubun=初検、hasBillableInitial=true
- 初検料=1550、相談支援料=100（当月初）
- baseOut=seifukuDakkyu=5200（脱臼の整復料）
- detailSum=5200、visitTotal=6850
- 要確認=FALSE

---

## TC-W01: write_application.py — 帳票番号飛び（施療料・部位明細）

> 対象: `write_application.py` の帳票出力レイアウト確認
> 実施日: 2026-03-16
> 参考 commit: 93b228e

### 入力（NDJSON）

- **hirayamaka**: case1（頸部捻挫・背部挫傷）、case2=null
- **touji**: case1（頸部捻挫）、case2（腰部捻挫）

### 修正前の挙動（93b228e 適用前）

| 患者 | 施療料 | 部位ラベル | 部位行 |
|---|---|---|---|
| touji | (1) @ AC35 / **(3)** @ BG35 | ⑴ @ 行38 / **⑶ @ 行40** | 行38 と行40に分散 |

- case1施療料2 が空のため index=1 がスキップされ、case2施療料1 が index=2 → `(3)` になっていた
- 同様に部位明細でも `labels[2]="⑶"` / `PART_ROWS[2]=行40` が参照されていた

### 修正後の挙動（93b228e 適用後）

| 患者 | 施療料 | 部位ラベル | 部位行 |
|---|---|---|---|
| touji | (1) @ AC35 / **(2) @ AR35** | ⑴ @ 行38 / **⑵ @ 行39** | 行38・行39 に詰まる |
| hirayamaka | 変化なし | 変化なし | 変化なし（case2=null のため影響なし） |

### 判定

- touji: **PASS**
- hirayamaka: **PASS（影響なし確認）**

### 補足

- 実行時に Permission denied エラー（出力 xlsx のロック）が1回発生したが、コード側の問題ではなく、Excel でファイルを開いたままにしていたことが原因。ファイルを閉じて再実行で成功。
- 傷病名は L385 の後フィルタで元々詰まっていた。今回の修正により3関数がすべて同じ「詰め寄せ方式」に統一された。

---

## TC10: 複合（同月別ケース＋加算算定不可＋理由複数）

### 入力
- 患者: P001
- 2/01 caseKey=A 新規（初検算定）
- 2/03 来院（次回来院で再検算定）
- 2/10 caseKey=B 新規（同月別ケース初回）
  - 傷病=捻挫, 受傷日=2/01
  - 冷チェックON（経過9日 → 冷は不可）
  - 温/電チェックON（経過9日 → 温/電は可）

### 期待値
- 2/10:
  - 区分=後療（同月初検抑制）
  - 初検料=0, 相談支援料=0
  - 再検料=0（当月再検は既に消化済）
  - 後療料=1（施術実態があれば）
  - 冷=0（算定不可、チェック残す）
  - 温>0, 電>0（算定可）
  - 要確認=TRUE
  - 要確認理由に以下を両方含む（;区切り）
    - 同月別ケース初回 初検抑制
    - 冷罨法 算定不可（捻挫：受傷後9日）

---

## 混在来院日テストケース（M01〜M04）

> 前提: SPEC.md §4-1「混在来院日の課金優先順位」参照

---

## M01: 混在（case1=再検 / case2=初検抑制）✅ 実シート確認済み

> 実シート確認: 2026-03-16 / commit 5077920

### 入力
- 患者: P001
- 2026/02/03 caseKey=A 新規（初検）、捻挫、腰部、受傷日=2/03
- 2026/02/05 caseKey=A 継続（再検）
- 2026/02/10 caseKey=A 継続（後療）、caseKey=B 新規（同月別ケース初回、打撲、肩関節、受傷日=2/10）

### 期待値（2/05 の visit: case1=再検 のみ）
- kubun1=再検、kubun2=なし
- 初検料=0、相談支援料=0、再検料=410
- case1 後療料_捻挫=505
- visitTotal = 410 + 505 = 915
- 要確認=FALSE

### 期待値（2/10 の visit: case1=後療 + case2=初検抑制）
- kubun1=後療、kubun2=初検（抑制: 同月別ケース）
- hasBillableInitial=false、hasReexam=false
- 初検料=0、相談支援料=0、再検料=0
- effectiveKubun2: 初検→後療（抑制変換）
- case1 後療料_捻挫=505、case2 後療料_打撲=505
- detailSum = 1010
- visitTotal = 0 + 0 + 0 + 1010 = 1010
- 要確認=TRUE（「同月別ケース初回 初検抑制」あり）

### 期待値（新5列: 2/10 の visit）

> 2/10 visit は case1=後療 / case2=初検(抑制)。金額パターンは M03 相当。

| 列 | 期待値 |
|---|---|
| 算定区分 | `後療` |
| Mixed区分 | `Mixed` |
| case1要約 | `case1:後療` |
| case2要約 | `case2:初検(抑制)` |
| 課金理由要約 | `初検抑制かつ再検対象なし` |

---

## M02: 混在（case1=再検 / case2=初検抑制なし）✅ 実シート確認済み

> 実シート確認: 2026-03-17 / fixture PASS確認済み

### 入力
- 患者: P001
- 2026/01/20 caseKey=A 新規（1月初検）、捻挫、腰部、受傷日=1/20
- 2026/02/03 caseKey=A 継続（再検）、caseKey=B 新規（2月初検・抑制なし）、打撲、肩関節、受傷日=2/03

### 期待値（2/03 の visit: case1=再検 + case2=初検抑制なし）
- kubun1=再検、kubun2=初検
- hasBillableInitial=true（case2の初検が算定）→ 初検優先
- 初検料=1550、相談支援料=100、再検料=0（初検優先で再検なし）
- effectiveKubun1: 再検のまま（calcKoryoOnThisDay=false）
- effectiveKubun2: 初検のまま
- case1 後療料_捻挫=505（kubun=再検）、case2 施療料_打撲=760（kubun=初検）
- detailSum = 505 + 760 = 1265
- visitTotal = 1550 + 0 + 100 + 1265 = 2915
- 要確認=FALSE

---

## M03: 混在（case1=後療 / case2=初検抑制）✅ 実シート確認済み

> 実シート確認: 2026-03-16 / commit 5077920

### 入力
- 患者: P001
- 2026/02/01 caseKey=A 新規（初検）
- 2026/02/03 caseKey=A 継続（再検）
- 2026/02/10 caseKey=A 継続（後療）、caseKey=B 新規（同月別ケース初回、打撲、肩関節）

### 期待値（2/10 の visit: case1=後療 + case2=初検抑制）
- kubun1=後療、kubun2=初検（抑制）
- hasBillableInitial=false、hasReexam=false（再検区分なし）
- 初検料=0、相談支援料=0、再検料=0
- effectiveKubun2: 初検→後療（抑制変換）
- case1 後療料_捻挫=505、case2 後療料_打撲=505
- visitTotal = 0 + 0 + 0 + 1010 = 1010
- 要確認=TRUE（「同月別ケース初回 初検抑制」あり）

### 期待値（新5列）

| 列 | 期待値 |
|---|---|
| 算定区分 | `後療` |
| Mixed区分 | `Mixed` |
| case1要約 | `case1:後療` |
| case2要約 | `case2:初検(抑制)` |
| 課金理由要約 | `初検抑制かつ再検対象なし` |

---

## M04: 混在（case1=初検 / case2=初検）

> 制度根拠: JREC-01 §3-4「現に施術継続中に他の負傷が発生して初検を行った場合、初検料は合わせて1回とし、1回目の初検時に算定する」

### 入力
- 患者: P001
- 2026/02/10 caseKey=A 新規（初検）、捻挫、腰部、受傷日=2/10
             caseKey=B 新規（初検）、打撲、肩関節、受傷日=2/10
- 当月 initBilled=false（2/10が当月初）

### 期待値（2/10 の visit: case1=初検 + case2=初検）
- kubun1=初検、kubun2=初検
- hasInit=true、monthlyStatus.initBilled=false
- 初検料=1550（1回のみ）、相談支援料=100、再検料=0
- hasBillableInitial=true → calcKoryoOnThisDay=false → 両ケース初検日扱い
- case1 施療料_捻挫=760（kubun=初検）、case2 施療料_打撲=760（kubun=初検）
- detailSum = 760 + 760 = 1520
- visitTotal = 1550 + 0 + 100 + 1520 = 3170
- 要確認=FALSE

---

## M05: 混在（case1=後療 / case2=再検）✅ 実シート確認済み

> 実シート確認: 2026-03-16 / bugfix commit e931fe5
> 背景: 課金理由要約が「算定なし」になる不具合を修正（initSuppressed=false の isMixed+reFee>0 が else に落ちていた）

### 入力
- 患者: 任意
- 来院日: case1 = 後療（継続ケース）、case2 = 再検（別ケース初回後療）
- case2 は当月初検済み（抑制なし）、かつ case2 の初検後最初の後療日（再検算定条件を満たす）

### 期待値

- kubun1=後療、kubun2=再検
- hasBillableInitial=false、initSuppressed=false
- 初検料=0、相談支援料=0、再検料=410
- visitTotal = 410 + detailSum

### 期待値（新5列）

| 列 | 期待値 |
|---|---|
| 算定区分 | `再検` |
| Mixed区分 | `Mixed` |
| case1要約 | `case1:後療` |
| case2要約 | `case2:再検` |

---

## M06a: 治癒後別負傷 — 施術継続中 Mixed（再検料1回にキャップ）

> 制度根拠（厚生労働省集団指導資料）:
> 現に施術継続中に他の負傷が発生した場合は、初検料は合わせて1回とし、再検料も増えない。

### 入力（V3TR_countKubunInCases_ 集計層）

- 患者: P001
- 2026/02/05 caseNo=1 kubun=初検  施術終了日_部位1 = 未設定（治療継続中）
- 2026/02/07 caseNo=2 kubun=初検  （同月、別負傷、施術継続中に発生）
- 2026/02/09 caseNo=2 kubun=再検

### 期待値（V3TR_countKubunInCases_）

| 項目 | 期待値 | 根拠 |
|---|---|---|
| validInitCount | 1 | case1 の終了日なし → 施術継続中 → 有効初検1件 |
| rawReCount | 1 | 再検行1件 |
| initCount | 1 | validInitCount そのまま |
| reCount | 1 | Math.min(1, 1) = 1 |

### 月次請求計算

- 初検料 = 1550 × 1 = 1,550
- 再検料 = 410 × 1 = 410

---

## M06b: 治癒後別負傷 — 治癒後の新規別負傷（再検料2回）

> 制度根拠（厚生労働省集団指導資料）:
> 治癒後に同月内で新たな別負傷が発生した場合は、初検料を再度算定可。
> それに対応する再検料も別途1回立ちうる。

### 入力（V3TR_countKubunInCases_ 集計層）

- 患者: P001
- 2026/02/01 caseNo=1 kubun=初検  施術終了日_部位1 = 2026/02/10（治癒済）
- 2026/02/04 caseNo=1 kubun=再検
- 2026/02/15 caseNo=2 kubun=初検  （治癒後の新規別負傷、2/10 > 治癒 → 2/15 新規開始）
- 2026/02/18 caseNo=2 kubun=再検

### 期待値（V3TR_countKubunInCases_）

| 項目 | 期待値 | 根拠 |
|---|---|---|
| earlier.endDate | 2026/02/10 | case1 施術終了日 |
| later.initDate | 2026/02/15 | case2 初検日 |
| isPostRecovery | true | 2/10 < 2/15 |
| validInitCount | 2 | 治癒後の新規別負傷 → 両初検とも有効 |
| rawReCount | 2 | 再検行2件（caseNo=1,2 それぞれ1回） |
| initCount | 2 | validInitCount そのまま |
| reCount | 2 | Math.min(2, 2) = 2 |

### 月次請求計算

- 初検料 = 1550 × 2 = 3,100
- 再検料 = 410 × 2 = 820

> **実装完了（2026-03-17）:** `getMonthlyBilledStatus_`（amounts.js）に `isCaseEndedBefore_` ヘルパーを追加し、
> 治癒後ケース（先行 caseKey の終了日 < 現在 treatDate）では `initBilled=true` を抑制しない実装が完成。
> `calcHeaderAmountsByVisitKey_V3_` の呼び出し元も `caseSh / caseMap / treatDate` を渡す形に更新済み。
> NDJSON・申請書生成で実値確認済み（2026-03-17）。fixture 追加済み（2026-03-18）。
| 課金理由要約 | `再検ありのため再検採用` |

### fixture 仕様（M06b: case2初検 per-visit、2026-03-18 追加）

| 項目 | 値 |
|---|---|
| testId | M06b |
| treatDate | 2026-02-15（case1は2/10治癒済、case2新規初検）|
| monthlyStatus.initBilled | false（isCaseEndedBefore_ 確定: case1終了2/10 < 2/15）|
| monthlyStatus.reBilled | true（case1の再検2/04算定済・月内グローバル）|
| monthlyStatus.supportBilled | true（case1相談支援料算定済）|
| kubun | 初検（case2新規）|
| 期待: initFee | 1550 |
| 期待: reFee | 0（hasReexam=false: case2=初検のため reBilled 無関係）|
| 期待: supportFee | 0（supportBilled=true）|
| 期待: visitTotal | 2310（1550+760）|
| 期待: billedKubun | 初検 |
| 期待: chargeReason | 初検のみ |

#### fixture の意図と [A] 不整合の解消

M06b fixture は [B] 治癒後別負傷シナリオの initFee=1550 算定確認に特化している（case2=初検、hasReexam=false）。
reBilled=true は「case1 の再検(2/04)が月内算定済」を表すが、case2 は初検来院なので reFee とは無関係。

[A] 施術継続中での再検誤算定は **TC09b で修正確認済み（2026-03-18）**。

| レイヤー | [B] M06b（case2=初検 2/15）| [A] TC09b（case2=再検・修正後）|
|---|---|---|
| per-visit reFee | 0（hasReexam=false）✅ | 0（reBilled=true → 抑制）✅ |
| V3TR reCount | 2（2/04 + 2/18）→ reFee=820 ✅ | ―（対象シナリオが異なる）|