# PROJECT_STATUS.md — 柔整GAS Ver3.1

最終更新: 2026-03-19

---

## 現在地

- プロジェクト: 柔整毎日記録システム Ver3.1
- ディレクトリ: `gas-projects/jyu-gas-ver3.1/`
- 状態: 稼働中
- 優先度: 最優先

---

## 概要

接骨院の患者管理・保険算定・申請書作成を支援する Google Apps Script システム。
スプレッドシートをUIとして、来院登録から療養費支給申請書作成までを扱う。

---

## 完了済み

- `Ver3_core.js` に来院登録・区分判定・算定中枢ロジックを実装
- `Ver3_amounts.js` に金額計算を実装
- `Ver3_transferData.js` に申請書転記処理を実装
- `Ver3_patientPicker.js` に患者選択UIを実装
- `write_application.py` に申請書生成処理を実装
- `SPEC.md`、`PLAN.md`、`TESTCASES.md` を整備
- JBIZ-04 との役割分担を整理し、毎日記録ブックを日次入力の正本に固定
- 来院ヘッダの最小列追加について、追加位置・正式列名・選択肢マスタ案・月次KPI対応・リスク整理を文書化
- 来院ヘッダに `会計区分 / 自費メニュー区分 / 自費売上額 / 慢性候補フラグ / 次回予約あり / 新規区分` を末尾追加できる実装を反映
- `設定` シート `E:I` に選択肢マスタを持てるようにし、来院ヘッダの入力候補設定まで連動させた
- service account 経由で live スプレッドシートの現状を確認し、`設定` は実質 `A:D` 使用中・`E:I` 未使用、`来院ヘッダ` の現行末尾は `caseIndex` であることを確認

---

## 次アクション

> 最終更新: 2026-03-17（168ecfc — exportHeaderFromCases_V3 新3列配線完了）
> 次: 下記「次タスク候補」参照。

### ✅ exportHeaderFromCases_V3 新3列配線 完了（2026-03-17）

- `Ver3_core.js` に事前集計パス追加（visitKey → kubun1/kubun2 マップ）
- `Mixed区分 / case1要約 / case2要約` の3列をkubunから生成して書き込み
- `算定区分 / 課金理由要約` は空のまま維持（金額計算・保存で上書きされる）
- `case2要約` の初検抑制表現は近似（`"case2:初検"`）。金額計算後に正確値で上書きされる
- 確認状況: 既存ヘッダ全件が出力済みのため export 新規追加でのlive確認は省略。コードレビュー確認完了扱い
- **live 再確認予定: 来院ヘッダ再構築時（リセット→一括 export するタイミング）**
- commit: `168ecfc`

### ✅ transferData 表示列 正式仕様整合 完了（2026-03-18）

- `Ver3_transferData.js` の Mixed区分 / case1要約 / case2要約 / 算定区分 / 課金理由要約 を header 側正式仕様に整合
- **case2:初検(抑制)** 判定を追加: `case1.endDate < case2.startDate`（厳密）= [B] 治癒後 → 抑制なし / それ以外 = [A] 施術継続中 → 抑制
- **算定区分** を transferCols に追加: 初検/再検/後療/算定なし（`_effInitFee` で抑制フラグを反映、金額計算は変えない）
- **課金理由要約** を transferCols に追加: header 側と同一7パターンルール
- commit: （本 commit）

#### 整合確認観点（M01〜M03 / TC03）

| ケース | Mixed区分 | case1要約 | case2要約 | 算定区分 | 課金理由要約 |
|---|---|---|---|---|---|
| M01（case1=再検 / case2=初検抑制）| Mixed | case1:再検 | case2:初検(抑制) | 再検 | 初検抑制のため再検採用 |
| M02（case1=再検 / case2=初検算定可）| Mixed | case1:再検 | case2:初検 | 初検 | 算定可能な初検ありのため初検採用 |
| M03（case1=後療 / case2=初検抑制）| Mixed | case1:後療 | case2:初検(抑制) | 後療 | 初検抑制かつ再検対象なし |
| M05（case1=後療 / case2=再検）| Mixed | case1:後療 | case2:再検 | 再検 | 再検ありのため再検採用 |
| TC03（case1=後療のみ）| 通常 | case1:後療 | case2:なし | 後療 | 後療のみ |

#### 未解決論点（引き続き保留）

- M01 のケース: case1=再検(継続中)、case2=初検(抑制) のとき `V3TR_countKubunInCases_` は initCount=1 を返す（case2の初検を金額計算に含める）が、amounts.js は initFee=0 を算定する。金額不整合が残る。今回は「金額計算の正本は変えない」方針のため未修正。算定区分 display 列は `_initSuppressed` フラグで正しく表示できる。
- live 確認は次回転記再生成時（clasp push → 転記データ再生成）で実施する

### ✅ transferData 表示列 実シート確認 完了（2026-03-18）

| パターン | 実例 | 算定区分 | Mixed区分 | case1要約 | case2要約 | 課金理由要約 | 判定 |
|---|---|---|---|---|---|---|---|
| M01 | hirayamaka_2026-03-09 | 再検 | Mixed | case1:再検 | case2:初検(抑制) | 初検抑制のため再検採用 | ✅ OK |
| M03 | touji_2026-03-10 | 後療 | Mixed | case1:後療 | case2:初検(抑制) | 初検抑制かつ再検対象なし | ✅ OK |
| TC03 | mineo_2026-03-03 | 後療 | 通常 | case1:後療 | case2:なし | 後療のみ | ✅ OK |

- clasp push（707e3d1）→ 転記データ再生成 → 3パターン全て正式仕様と整合確認済み
- case2:初検(抑制) が M01 / M03 で正しく出力されることを実シートで確認

### ✅ M06b fixture 追加 完了（2026-03-18）

- `Ver3_test.js` に `M06b` fixture & expected を追加（JREC01_FIXTURES_ / JREC01_EXPECTED_）
- `tests/jrec01/fixtures/M06b_治癒後別負傷_case2初検.json` / `expected/` 追加
- `runFixtureM06b()` ラッパー関数追加
- `TESTCASES.md` の M06b セクションに fixture 仕様・金額不整合の確認箇所を追記
- fixture カウント: 46 → 47 件（PASS 確認は clasp push → runFixtureSuite() で実施すること）

**fixture 設計の要点:**

| 項目 | 設計判断 |
|---|---|
| テスト対象レイヤー | per-visit 計算（computeAmountsFromFixture_V3_）|
| treatDate | 2026-02-15（case1は2/10治癒済、case2新規初検）|
| initBilled=false | isCaseEndedBefore_ が確定した状態を monthlyStatus に直接設定 |
| reBilled=true | case1の再検(2/04)算定済・月内グローバルフラグ |
| reFee=0 | per-visit グローバル reBilled=true による抑制 |
| reBilled=true 影響 | M06b は hasReexam=false（case2=初検）のため reBilled は reFee に無関係。[A] 抑制は TC09b 参照。 |

### ✅ [A]施術継続中 再検料抑制バグ修正 完了（2026-03-18）

**問題:** [A] 施術継続中シナリオで case2=再検の来院日に reFee=410 が誤算定されていた。
**根本原因:** `calcHeaderAmountsByVisitKey_V3_` の reFee 判定に `!monthlyStatus.reBilled` チェックが欠落。`getMonthlyBilledStatus_` も reBilled に `isCaseEndedBefore_` を適用していなかった。

| ファイル | 対象関数 | 変更内容 |
|---|---|---|
| Ver3_amounts.js | `getMonthlyBilledStatus_` | reBilled 立てる前に `isCaseEndedBefore_` で [B] 判定 → suppressReBilled 時は reBilled=false を維持 |
| Ver3_amounts.js | `calcHeaderAmountsByVisitKey_V3_` | reFee 条件に `!monthlyStatus.reBilled` を追加 |
| Ver3_test.js | `computeAmountsFromFixture_V3_` | reFee 条件に `!ms.reBilled` を追加（production と同期） |
| Ver3_test.js | JREC01_FIXTURES_ | TC09b fixture 追加（[A] case1後療 / case2再検 / reBilled=true → reFee=0） |
| Ver3_test.js | JREC01_EXPECTED_ | TC09b expected 追加（reFee=0, visitTotal=1010） |

**修正後の[A]/[B]挙動整理:**

| シナリオ | isCaseEndedBefore_ | reBilled | reFee（case2再検来院日） |
|---|---|---|---|
| [A] 施術継続中 | false | true | 0（抑制）✅ |
| [B] 治癒後別負傷 | true | false（suppressReBilled） | 410（許可）✅ |

- fixture カウント: 47 → **48 件**（TC09b 追加）
- M06b fixture note の誤記（"per-visit reFee=0 だが V3TR=820"）を修正済み

### ✅ B-3: SPEC.md §14 実装整合更新 完了（2026-03-19）

- 施術明細列数を 23 → 27 に修正（metalChk / exerciseChk / metalOut / exerciseOut 追加）
- 列テーブルに §18.3 対応の4列を追記
- 行合計_確定の式に `+ metalOut + exerciseOut` を追加
- データフローの戻り値に metalOut / exerciseOut / metalChk / exerciseChk を追記
- fixture 48/48 PASS・TC09b 実シート確認を反映

**JREC-01 テストフェーズ（B-1〜B-3）完全クローズ**

### ✅ 特殊骨折制限 fixture 実装完了（2026-03-19）

- fixture/expected JSON（TC23a〜TC25b 9件）作成
- Ver3_test.js: `JREC01_FIXTURES_` / `JREC01_EXPECTED_` / wrapper関数 追加
- Ver3_amounts.js: §20 継続理由書アラートを骨折/不全骨折除外に修正
- Ver3_test.js: TEST_SETTINGS_._rawMap に 整復料_骨折_*/固定料_* 単価 14件追加
- fixture 件数: 48 → 57（TC23a〜TC25b 9件追加）
- clasp push 済み（2026-03-19）
- **✅ 57/57 PASS 確認済み（2026-03-19 GAS エディタ runFixtureSuite()）**

**実装済み fixture:**

| TC | 傷病 | 部位 / 条件 | ポイント |
|---|---|---|---|
| TC23a | 骨折 | 膝蓋骨（未定義部位） | base=0 + 要確認 |
| TC23b | 骨折 | 腰椎（脊椎） | base=0 + 要確認 |
| TC23c | 骨折 | 胸骨 | base=0 + 要確認 |
| TC23d | 骨折 | 大腿（定義済み） | base=11800 正常算定 |
| TC24a | 不全骨折 | 肩甲骨（未定義部位） | base=0 + 要確認 |
| TC24b | 骨折 | 後療 monthsElapsed=14 | ltCoef=1.0（長期減額対象外） |
| TC24c | 不全骨折 | 後療 monthsElapsed=14 | ltCoef=1.0（同上） |
| TC25a | 脱臼 | 後療 monthsElapsed=5 | ltCoef=0.75 + 継続理由書アラート |
| TC25b | 骨折 | 後療 monthsElapsed=3 | ltCoef=1.0 + アラートなし（§20 骨折対象外） |

### ✅ 特殊骨折制限 制度整理・fixture 設計 完了（2026-03-19）

- `FRACTURE_RESTRICTION.md` 作成（同ディレクトリ）
- 骨折/不全骨折/脱臼 の算定可否ルールを令和6年改正通知根拠で整理
- 現行実装の安全弁（mapBuiToSettingKey_ 未登録 → base=0）を確認・文書化
- TC23a〜TC25b 合計 9 件の fixture 境界ケース設計完了（実装も同日完了）
- 未実装事項（医師同意制御・特殊骨折医師依頼後療特例）を記録

### 次タスク候補（優先順）

| 優先 | タスク | 分類 | 概要 |
|---|---|---|---|
| 1 | ~~runFixtureSuite() PASS確認~~ | ✅ **完了** | 57/57 PASS 確認済み（2026-03-19） |
| 2 | transferData への新5列反映 | **調査先行** | Ver3_transferData.js（月次転記）への新5列反映。申請書データへの影響・不要列の除外方針を確認してから実装着手。 |

**保留継続:**
- 運動後療料 月2回特例 → `docs/JREC-01_運動後療料_月2回特例メモ.md` 参照（根拠資料未確認のため）
- 既存データ一括再計算メニュー → 低優先度

### ✅ 温罨法初検日特例 実装完了（2026-03-17）

- **33/33 PASS 確認済み**（TC01〜TC17b + M01〜M05）
- TC17a（初検日特例・warm=0）/ TC17b（後療日通常算定・warm=75）すべてPASS
- `calcOnePartAmount_V3_`: kubun=初検 時に warm=0 固定（初検日特例）

### ✅ 金属副子等加算 Phase 2 実装済み（2026-03-17）— clasp push 後 40/40 PASS 確認待ち

- TC20a/b/c 実装済み（1回目・3回目・上限超）
- `buildMetalCountByCaseKey_V3_`: 施術明細から caseKey 単位の通算算定回数を集計（beforeDate 以前、visitKey 重複除去）
- `calcOnePartAmount_V3_`: `metalPriorCount` 引数追加 → 3回以上で 要確認「金属副子等加算 算定上限超（通算3回）」
- `calcCaseDetailAmount_V3_`: `detailValues`/`detailMap` 引数追加 → `buildMetalCountByCaseKey_V3_` を呼び出し
- `calcHeaderAmountsByVisitKey_V3_`: 施術明細シート読み込みを追加
- `recalcAmountsByVisitKey_V3_`: metalPriorCount を計算して渡す

### ✅ 金属副子等加算 Phase 1 実装完了（2026-03-17）— 37/37 PASS 確認済み

- TC19a/b 実装済み（骨折=算定可・捻挫=要確認）
- `AM_SET_KEYS.metalAddon` / `loadSettings_V3_` に `金属副子等加算` = 1,000 追加
- `AM_DETAIL_COLS` に `metalChk / metalOut` 追加（施術明細列）
- `CASE_COLS` に `metal1 / metal2` 追加（来院ケース列）
- `calcOnePartAmount_V3_`: `metalChk` 引数追加 → 骨折/不全骨折/脱臼→1,000円, C群→0+要確認
- `metalOut` は逓減（coef・ltCoef）対象外 → `total += metalOut`（乗算なし）

### ✅ 長期継続理由書アラート 実装完了（2026-03-17）— 35/35 PASS 確認済み

- TC18a/b PASS 確認済み。TC14a/b・TC16a/b/c expected 更新済み
- `calcMonthsElapsed_V3_`: 受傷日から来院日までの月数を計算（共通ヘルパー）
- `calcOnePartAmount_V3_`: monthsElapsed ≥ 3 → `"長期施術3か月超（継続理由書確認）"` を needCheck reason に追加
- 長期減額 reason（あれば）が先、継続理由書 reason が後（セミコロン区切り）

### ✅ 長期50%逓減 実装完了（2026-03-17）

- **31/31 PASS 確認済み**（TC01〜TC16c + M01〜M05）
- TC16a（50%適用）/ TC16b（75%維持・頻回未達）/ TC16c（4か月目・条件未達）すべてPASS
- `buildMonthlyVisitCounts_V3_`: 来院ヘッダから caseKey 単位の月別来院数を集計
- `calcLongTermCoef_V3_`: 4引数化。monthlyVisitCounts 全月≥10 → 0.50、そうでなければ 0.75
- 起算月ルール: 初検日<16日→当月起算、≥16日→翌月起算（ユーザー確認済み 2026-03-17）
- 確認済み単価: koryoDakkyu=720 / seifukuDakkyu=5200 / warm=75 / electro=33 / taiki=5 / cold=85
- `runFixtureSuite()` で一括実行可能（31 件→35 件）

### 未実装制度論点（優先順）

| 優先 | 項目 | 状況 |
|---|---|---|
| 高 | 温罨法 初検日特例 | ✅ 実装済み（TC17a/b PASS）|
| 中 | 長期継続理由書アラート | ✅ 実装済み（TC18a/b PASS 確認済み）|
| 中 | 金属副子等加算 Phase 1 | ✅ 実装完了（TC19a/b PASS 確認済み）|
| 低 | 金属副子等加算 Phase 2（回数制限） | ✅ 実装完了（TC20a/b/c PASS 確認済み）|
| 中 | 特殊骨折制限（3部位目以降の制限等） | 未調査。骨折+多部位の制限条件があれば fixture で境界確認が必要 |
| 中 | transferData への新5列反映 | 申請書データへの反映可否を検討 |
| 低 | 既存データ一括再計算メニュー | 過去来院ヘッダへの新5列遡及反映 |

### 次フェーズ候補

1. **申請書フロー実運用確認** — write_application.py の動作確認
2. **特殊骨折制限** — 骨折+多部位の制限条件調査と fixture 追加
3. **transferData への新5列反映** — 月次転記への影響検討

### 中長期

- 申請書生成フローの実運用確認
- 現場運用で `会計区分` と `区分` の混同が起きないかを入力確認
- 次段階で `保険新規 / 自費直新規` の実入力運用を設計

---

## 保留事項

- 実スプレッドシート上での最終確認状況は人手確認が必要
- 単価や算定条件の制度変更時は `SPEC.md` と設定シートの両方を見直す
- `保険新規 / 自費直新規 / 再来` の分離運用は次段階で必ず着手する
- 現在のローカル設定では container-bound GAS の script ID が取れておらず、`clasp run` / Execution API による live 関数実行確認は未完了
- bound GAS の script ID / `.clasp.json` / `executionApi.access=MYSELF` / API executable deployment までは確認済み。2026-03-15 時点の残課題は `scripts.run` 実行権限で、`clasp run ensureSettingsRows_V3` は devMode で permission エラー、`--nondev` では API executable 未解決エラーになる
- Apps Script Execution API の 403 条件として「呼び出し側 OAuth client とスクリプト側が同じ Google Cloud project を共有していること」が公式要件。現状はここが最後の有力候補で、最短ルートは Apps Script エディタから `ensureSettingsRows_V3` を手動実行して live 反映確認しつつ、必要なら標準 GCP プロジェクト側の紐付けを確認すること

---

## 直近の重要判断

- 来院ヘッダの追加位置は `caseIndex` 右側の末尾追加を第一案とする
- 追加する正式列名は `会計区分 / 自費メニュー区分 / 自費売上額 / 慢性候補フラグ / 次回予約あり / 新規区分`
- 選択肢マスタは `設定` シート右側の `E:I` を第一案とし、既存の `A:D` 用途を崩さない
- 既存コードは見出し名ベース参照のため、末尾列追加なら既存処理影響は限定的と判断
- `新規区分` は今回は受け皿だけ用意し、`保険新規 / 自費直新規` の必須運用は次段階で行う
- save/export 経路で来院ヘッダ不足列を自動補完し、設定シート側では選択肢マスタと入力候補を一括で整える
- live 実行の切り分けでは、`ensureSettingsRows_V3` 自体はトップレベル関数として存在し、API executable deployment も作成済みのため、実装本体より execution 条件側を優先確認する

---

## テスト状況

- テストケース文書: `TESTCASES.md` あり
- fixture テスト基盤: `Ver3_test.js` + `tests/jrec01/fixtures/` + `tests/jrec01/expected/` 整備済み
- fixture 件数: 57件（TC01〜TC25b + TC09b + M01〜M05 + M06b）
- **✅ 57/57 PASS 確認済み（2026-03-19）** TC01〜TC25b 全件 runFixtureSuite() で通過確認済み
- 実シート確認済み: M01 / M02 / M03 / M04 / M05 / TC09b
- Apps Script メニューから `runFixtureSuite()` で一括実行可能
- 確認済み単価: koryoDakkyu=720 / seifukuDakkyu=5200 / warm=75 / electro=33 / taiki=5 / cold=85

---

## 重要ファイル

- `README.md`
- `SPEC.md`
- `PLAN.md`
- `TESTCASES.md`
- `Ver3_core.js`
- `Ver3_amounts.js`
- `Ver3_transferData.js`
- `write_application.py`

---

## コード正本と同期ルール（2026-03-16 確定）

### 正本の定義

| 対象 | 正本 | 参照元 |
|---|---|---|
| GAS コード（.js）| GitHub `feature/auto-dev-phase3-loop` | Claude Code / ChatGPT はここを読む |
| 申請書スクリプト（.py）| GitHub 同上 | 同上 |
| 療養費算定ルール | `SPEC.md` / `JREC-01_制度SPEC_v0.9.md` | GitHub |
| 実運用データ | Google スプレッドシート | Apps Script で書き込み |

**Apps Script エディタは編集場所ではなく実行場所**。コードの変更は必ず GitHub 経由で行い、その後 `clasp push` で Apps Script に反映する。

### GAS 修正後の必須手順

```
1. ローカルでコードを編集
2. git add / commit / push → GitHub に反映
3. clasp push → Apps Script エディタに反映
```

```bash
# 手順3のコマンド（jyu-gas-ver3.1 ディレクトリで実行）
cd gas-projects/jyu-gas-ver3.1
clasp push
```

### やってはいけないこと

- Apps Script エディタで直接コードを編集する（GitHub と乖離する）
- `clasp pull` でローカルを上書きする（GitHub の変更が失われる）
- clasp push せずに GitHub だけ更新したまま放置する

### 最終 clasp push 状況

| ファイル | 最終 GitHub commit | Apps Script 反映 |
|---|---|---|
| Ver3_amounts.js | `209ceb9`（2026-03-18）| ✅ clasp push 済み |
| Ver3_core.js | `7dd0790`（2026-03-17）| ✅ clasp push 済み |
| Ver3_test.js | `209ceb9`（2026-03-18）| ✅ clasp push 済み |
| Ver3_transferData.js | `707e3d1`（2026-03-18）| ✅ clasp push 済み |
| Ver3_patientPicker.js | 変更なし | 問題なし |
| SPEC.md | `22447fd`（2026-03-17）| N/A（ローカル文書のみ）|

### clasp status について

`clasp status` はファイルの追跡状況のみ表示し、Apps Script との内容差分は表示しない。
内容差分の確認には `clasp pull`（ローカル上書き）が必要だが、GitHub 正本運用下では原則使わない。

---

## 再開メモ

作業再開時は、まず `README.md`、`SPEC.md`、`TESTCASES.md` を確認し、次に対象ロジックの実装ファイルを読む。
制度変更や単価変更に関わる作業では、コードより前に仕様との整合を確認する。
JBIZ-04 には日次入力を持たせず、このブックを現場入力の正本として使う前提を崩さない。
**コード修正後は必ず `clasp push` まで行うこと（上記「コード正本と同期ルール」参照）。**

---

## 2026-03-15 完了整理

- 実装完了: 来院ヘッダ6列追加と `設定!E:I` 候補マスタ反映の最小実装まで完了
- live 確認完了: Apps Script エディタから `ensureSettingsRows_V3` を手動実行し、`設定!E:I` と来院ヘッダ6列の反映、既存列・既存データ非破壊を確認
- 保留: `clasp run` / Execution API 調査は別タスク。現時点ではコードではなく実行条件側の課題の可能性が高い

---

## 2026-03-17 再検料月内上限ロジック修正 + amounts.js 治癒後初検抑制解除

### 修正概要

| 対象ファイル | 対象関数 | 変更内容 |
|---|---|---|
| Ver3_transferData.js | `V3TR_countKubunInCases_` | `reCount` を `Math.min(rawReCount, validInitCount)` に変更（cebeffe）|
| Ver3_transferData.js | `V3TR_countKubunInCases_` | `initCount` を `Math.min(rawInitCount, validInitCount)` に変更（本 commit）|
| Ver3_amounts.js | `getMonthlyBilledStatus_` | 治癒後別負傷 [B] 判定を追加（opt_caseSh / opt_caseMap / opt_treatDate）|
| Ver3_amounts.js | ─ | `isCaseEndedBefore_` ヘルパー追加 |

### 判定ロジック（全層整合済み）

```
V3TR_countKubunInCases_（transferData）:
  validInitCount:
    [A] 施術継続中 Mixed: 先行ケース終了日なし or >= 後続初検日 → 1
    [B] 治癒後別負傷:     先行ケース終了日 < 後続初検日（厳密）   → 2
  initCount = Math.min(rawInitCount, validInitCount)
  reCount   = Math.min(rawReCount,   validInitCount)

getMonthlyBilledStatus_（amounts.js）:
  initFee > 0 の行を発見した場合:
    → isCaseEndedBefore_ で、そのケースが現在の treatDate より前に終了しているか確認
    → 終了していれば suppressInitBilled=true → initBilled=false を維持（治癒後 [B]）
    → 終了していなければ initBilled=true（施術継続中 [A]）

isCaseEndedBefore_（amounts.js）:
  caseKey の全行を走査し、施術終了日_部位1/2 の最遅値を取得
  最遅終了日 < treatDate → true（治癒済み）/ それ以外 → false
```

### エッジケース明文化済み

| ケース | 扱い |
|---|---|
| `endDate == later.initDate`（同日） | [A] 保守扱い（`<` 厳密）|
| `endDate` 空欄（Date でない） | [A] 保守扱い（施術継続中とみなす）|
| `caseKey` 列なし（headMap に未存在） | `ckVals=null` → `suppressInitBilled=false` → 従来動作 |
| `caseNo` 列なし | 全行 caseNo=1 扱い → `initCases.length<=1` → `validInitCount=min(rawInitCount,1)` |

### 到達点

| 項目 | 状態 |
|---|---|
| transferData 再検料集計（reCount） | ✅ [A]=1 / [B]=2 |
| transferData 初検料集計（initCount） | ✅ [A]=1 / [B]=2 |
| amounts.js 初検抑制（getMonthlyBilledStatus_）| ✅ 治癒後別負傷 [B] で suppressInitBilled |
| isCaseEndedBefore_ ヘルパー | ✅ 追加済み |
| M06a（施術継続中）既存 M01〜M05 | ✅ 変化なし（validInitCount=1 → 旧挙動と等価）|
| M06b fixture / 実シート確認 | ⚠️ 未実施（fixture 追加・실시후 확인が必要）|

### M06b 全層整合の確認結果（コード分析）

```
[B] 治癒後別負傷 シナリオ（例: case1 終了 2/10、case2 初検 2/15）

amounts.js（per-visit 算定）:
  case1 の初検（2/1）: initBilled=false → initFee=1550 ✅ billed
  case2 の初検（2/15）:
    getMonthlyBilledStatus_ → case1 caseKey の endDate=2/10 < treatDate=2/15 → suppressInitBilled=true
    → initBilled=false → initFee=1550 ✅ billed（抑制されない）
  来院ヘッダ initFee 合計 = 3100

transferData 月次集計:
  rawInitCount=2, validInitCount=2 → initCount=2 → initFee = 1550×2 = 3100 ✅
  rawReCount=2,   validInitCount=2 → reCount=2   → reFee  = 410×2  = 820  ✅

全層整合: ✅ amounts.js ↔ transferData で initFee / reFee が一致
```

> **ステータス: 実装受理 / 運用完了は未了（2026-03-17 確認）**
> M06b は amounts.js（per-visit）と transferData（月次集計）の両層が修正されたことで、
> 「治癒後別負傷の初検料・再検料を各エピソードで独立算定する」という制度要件を充足している。
>
> **運用完了条件（残タスク）:**
> 1. ~~実シートで M06b パターン入力 → initFee=3100 / reFee=820 を確認~~ ✅ NDJSON・申請書生成で確認済み（2026-03-17）
> 2. Dashboard 反映: `de -ProjectId JREC-01` ✅ 本セッションで実施
> 3. M06b fixture 追加（TESTCASES.md 追記）⚠️ 未実施
> 4. caseKey 欠落フォールバック時のログ化（任意）⚠️ 未実施

## 2026-03-17 M06b 実シート確認（write_application.py バッチ実行）

### 確認条件

| 項目 | 内容 |
|---|---|
| 実行コマンド | `python write_application.py --batch` |
| NDJSON | transfer_batch_2026-03.ndjson（再生成） |
| 実行環境 | .venv（Pillow 不足で一度失敗 → pip install Pillow 後に成功）|
| 出力ファイル | output\2026-03\申請書_hirayamaka_2026-03.xlsx |
| セル書込数 | 86 |
| 検証 | 全件パス ✅ |

### hirayamaka M06b データ確認

| 項目 | 値 | 確認 |
|---|---|---|
| case1 caseKey | hirayamaka_2026-03-02_C1 | — |
| case1 施術終了年月日 | 2026-03-09 | 治癒 |
| case2 caseKey | hirayamaka_2026-03-16_C2 | — |
| case2 初検日 | 2026-03-16 | 治癒後の新規別負傷 |
| isPostRecovery 判定 | 2026-03-09 < 2026-03-16 → true | ✅ [B] 治癒後別負傷 |
| 初検料_月額 | 3,100 | ✅ 期待値通り（1550×2） |
| 再検料_月額 | 820 | ✅ 期待値通り（410×2） |
| 当月合計 | 6,936 | — |
| 窓口負担額 | 2,080 | — |
| 請求金額 | 4,856 | — |

### 確認余地（事実として記録、未解決）

| 項目 | 内容 |
|---|---|
| case要約表示 | case1要約="case1:再検" / case2要約="case2:再検" — 両ケースとも再検表示。M06b では case2 に初検（3/16）があるが case2要約が "再検" を示す。表示仕様として問題ないか確認余地あり（billing 正確性に影響なし）|

### Pillow 依存追加（再発防止）

- .venv に Pillow 未インストール状態で実行 → `ModuleNotFoundError: No module named 'PIL'`
- `pip install Pillow` 後に再実行し成功
- `requirements.txt` を新規作成し openpyxl / Pillow を明記（本コミット）

---

## 2026-03-17 請求前チェックリスト実施結果（2026-03 2件）

### 実施条件

| 項目 | 内容 |
|---|---|
| 転記データ再生成日時 | 2026-03-17T16:57:58+09:00（post-fix: 施療料 caseTotal 算入済み） |
| 対象月 | 2026-03 |
| 患者件数 | 2件（hirayamaka / touji） |
| SHEETS.ui | `"患者画面"` ✅（commit 7dd0790 で確認） |

### 金額確認（post-fix 値）

| 患者 | 当月合計 | 窓口負担額 | 請求金額 | pre-fix 当月合計 | 差分 |
|---|---|---|---|---|---|
| hirayamaka | 5,481 | 1,640 | 3,841 | 3,961 | +1,520 ✅（施療料 760×2 case） |
| touji | 4,363 | 1,310 | 3,053 | 2,843 | +1,520 ✅（施療料 760×2 case） |

### チェックリスト結果

| チェック項目 | hirayamaka | touji |
|---|---|---|
| 初検取得モード = caseKey | ✅ | ✅ |
| 当月合計 / 窓口負担額 / 請求金額 計算整合 | ✅ | ✅ |
| 保険者番号 | 1280015 ✅ | 32280414 ✅ |
| 患者氏名 | 平山克士 ✅ | 田路吾子 ✅ |
| 患者生年月日 | 1973-10-10 ✅ | 1969-05-23 ✅ |
| 住所 | 兵庫県朝来市立野 169-1 ✅ | **⚠️ 空欄（要入力）** |
| 負傷名1 | 頸部 捻挫 ✅ | 頸部 捻挫 ✅ |
| 転帰 | 空欄（治療継続中なら可）| 空欄（治療継続中なら可）|
| Mixed 区分 | Mixed ✅ | Mixed ✅ |
| case1要約 / case2要約 | 後療 / 再検 ✅ | 再検 / 初検 ✅ |

### 請求確定できる項目

- 施療料欠落修正（commit 09129b7）反映済み ✅
- 当月合計・窓口負担額・請求金額の計算整合 ✅
- 初検取得モード caseKey ✅
- effectiveKubun → kubun 修正（commit 4f6419d）反映済み ✅

### 請求確定前に人間が確認する項目

| 項目 | 内容 |
|---|---|
| ⚠️ touji 住所 | 申請書の住所欄が空欄。患者画面で入力してから再生成すること |
| ⚠️ 転帰 | 両患者とも空欄。治療継続中なら空欄可。終了の場合は記入要 |

### 保留論点（制度確認待ち・今回変更なし）

**再検料 Mixed 2エピソード算定キャップ → 2026-03-17 一部解消**

- commit `cebeffe` で `Math.min(reCount, 1)` を `Math.min(reCount, validInitCount)` に修正済み
- hirayamaka / touji 両患者とも validInitCount=1 のため今回の請求には影響なし

---

## 2026-03-16 帳票番号飛び修正 完了

### 対象

- `write_application.py`

### 問題

- case2 のみ実データがある場合（例: touji）、以下の飛び番が発生していた
  - 施療料: `(1)` @ AC35 の次が `(3)` @ BG35 になる（`(2)` が抜ける）
  - 部位明細: ラベルが `⑴` の次が `⑶` になり、書き込み行も 行38 → 行40 と飛ぶ

### 原因

- `build_injury_rows` は L385 で後フィルタ（名称が空の行を除去）し詰めて書き込んでいた
- `build_shoryo_array` と `build_part_detail_array` はソース配列のインデックスをそのまま使っていたため、空スロットが挟まるとインデックスが飛んだ
  - `build_shoryo_array`: ゼロ値エントリを `continue` でスキップするが、`SHORYO_CELLS[i]["no"]` は元のインデックス `i` を参照
  - `build_part_detail_array`: `has_data=False` をスキップするが、`labels[i]` と `PART_ROWS[i]` は元のインデックス `i` を参照

### 対応（commit: 93b228e）

- **Fix-S**: `build_shoryo_array` の返り値を書き込み前にリスト内包でフィルタし、非ゼロ値だけに詰めてから `enumerate` → `SHORYO_CELLS[i]` で連番書き込み
- **Fix-P**: `build_part_detail_array` の書き込みループに `display_idx` を導入。`has_data=True` のときだけ `display_idx` を進め、`PART_ROWS[display_idx]` と `labels[display_idx]` で連続行・連番を保証

### 結果（実機確認済み）

| 確認項目 | 修正前 | 修正後 |
|---|---|---|
| touji 施療料 | (1) @ AC35 / **(3)** @ BG35 | (1) @ AC35 / **(2) @ AR35** |
| touji 部位ラベル | ⑴ @ 行38 / **⑶ @ 行40** | ⑴ @ 行38 / **⑵ @ 行39** |
| hirayamaka（case2=null） | 変化なし | 変化なし（影響なし） |

- Permission denied エラーが1回発生したが、原因は出力 xlsx ファイルのロック（Excel で開いたまま実行）。コード側の問題ではなく成功判定。

### 参考 commit

- `93b228e` — fix(JREC-01): 施療料・部位明細の番号付けを詰め連番に修正 (Fix-S / Fix-P)

---

## 2026-03-16 mixed case 表示改善 完了

### 対象

- `Ver3_amounts.js`（calcHeaderAmountsByVisitKey_V3_ に新5列生成ロジック追加）
- `Ver3_core.js`（HEADER_COLS / appendHeaderRow_V3_ に5列配線追加）
- `docs/JREC-01_mixed_case_display_memo.md`（設計判断メモ追加）

### 実装内容

来院ヘッダに以下5列を追加し、mixed case の説明性を強化した。

| 列名 | 内容 |
|---|---|
| 算定区分 | 実際に課金した区分（初検/再検/後療/算定なし） |
| Mixed区分 | 複数ケース同日かどうか（Mixed/通常） |
| case1要約 | case1 の区分を短縮表示 |
| case2要約 | case2 の区分と抑制状況を短縮表示 |
| 課金理由要約 | なぜその算定区分になったかを短文で説明 |

### 実シート確認結果

| パターン | 確認結果 |
|---|---|
| M01（case1=再検 / case2=初検抑制）| ✅ OK |
| M03（case1=後療 / case2=初検抑制）| ✅ OK |
| M05（case1=後療 / case2=再検）| ✅ OK（e931fe5 で課金理由要約バグ修正後） |

### バグ修正（e931fe5）

- 原因: case1=後療 / case2=再検 の mixed で `initSuppressed=false` のため M01 条件を通過できず `else → "算定なし"` に落ちていた
- 修正: `!hasBillableInitial && reFee>0 && isMixed && !initSuppressed` 分岐を追加し `"再検ありのため再検採用"` を返すようにした

### 実シート確認状況

| テストケース | 確認結果 |
|---|---|
| M01（case1=再検 / case2=初検抑制） | ✅ OK |
| M02（case1=再検 / case2=初検抑制なし） | ✅ OK（2026-03-17 fixture PASS確認） |
| M03（case1=後療 / case2=初検抑制） | ✅ OK |
| M04（case1=初検 / case2=初検） | ✅ OK |
| M05（case1=後療 / case2=再検） | ✅ OK（e931fe5 修正後） |

### 未対応範囲（次スコープ）

- `exportHeaderFromCases_V3` への新5列配線
- `transferData` への新5列反映（月次転記への影響検討）
- 既存データの一括再計算メニュー
- `区分` → `表示区分` へのリネーム（将来候補）

### 参考 commit

- `ff7d0ab` — docs(JREC-01): mixed case 表示改善メモ追加
- `5077920` — feat(JREC-01): 来院ヘッダ新5列実装（算定区分/Mixed区分/case要約）
- `e931fe5` — fix(JREC-01): chargeReason に「後療+再検 mixed」分岐を追加
