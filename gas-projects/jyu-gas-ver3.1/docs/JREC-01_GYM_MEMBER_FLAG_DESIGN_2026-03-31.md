# JREC-01 ジム会員フラグ（A5/B5）設計調査レポート

作成日: 2026-03-31
ステータス: **Phase B 実装完了（2026-03-31）— clasp push + 実機テストが院長タスク**
実施者: Claude Code

---

## 調査概要

患者画面 A5/B5 セルを「ジム会員チェックボックス」として使用し、
自費入力時にジム会員料金を参照する案の実現可否を調査した。

---

## 調査対象ファイル

| ファイル | 確認内容 |
|---|---|
| `Ver3_core.js` | UI const・clearEntryUI_V3_・clearAfterSaveUI_V3_・getSelfPayMenuMaster_V3・JBIZ_COL 定数 |
| `selfPayDialog.html` | ダイアログの価格参照・loadMenuMaster の実装 |
| `SELF_PAY_DETAIL_DESIGN.md` | 価格マスタ設計・会員料金列の定義 |
| `UI_REDESIGN_PHASE1.md` | 行5のレイアウト定義・将来の isGymMember 設計方針 |
| `PHASE0_DESIGN.md` | Phase0 時点の行5の役割 |
| `SPEC.md` | 保険算定ロジック（A5/B5 参照なし確認） |
| `TESTCASES.md` | A5/B5 参照なし確認 |

---

## 確認結果

### A5 の現状

| 項目 | 状態 |
|---|---|
| GAS コード参照 | **なし**（全ファイル検索で "A5" へのアクセスは 0 件）|
| setup 関数での設置 | **なし**（setupSelfPayValidation_V3_ は行7〜8のみ設置）|
| シート上の想定状態 | Phase0 設計上は「区分」ラベル（手動設定）。GAS からは書き込まれていない |
| 保険算定への影響 | **なし** |

→ **A5 は GAS から完全に独立した未使用セル。自由に使用可能。**

---

### B5 の現状

| 項目 | 状態 |
|---|---|
| UI const 定義 | `UI.kubun = "B5"` として定義されている（Ver3_core.js L82）|
| getValue（読み取り）| **0件** — B5 から値を読み取る処理は存在しない |
| setValue（書き込み）| `clearAfterSaveUI_V3_` のみ：`uiSh.getRange(UI.kubun).setValue("")`（クリア専用）|
| clearContent | `clearEntryUI_V3` の `"B5:B7".clearContent()` に含まれる |
| kubun の実際の計算 | `calcEpisodeForCase_()` が来院ケース履歴から自動算定（B5 は関与しない）|
| kubun の実際の表示 | `UI.case1_kubunView = "C10"` / `UI.case2_kubunView = "C34"` が表示セル |
| 保険算定への影響 | **なし**（算定ロジックは B5 を参照しない）|

→ **B5 は「区分表示」として定義されたが、実際には書き込まれておらず、読み取りもされていない。事実上の死セル。**

#### B5 が「死セル」になった経緯

Phase0 設計 `Row 5: B5: 区分（表示）` として設計されたが、
実際の区分表示は C10（case1_kubunView）・C34（case2_kubunView）に実装された。
B5 に対応する setValue("初検") / setValue("後療") の処理が実装されなかった。
GAS コード上は名前 `UI.kubun = "B5"` だけが残り、クリア処理にのみ使われている状態。

---

### 旧「保険上の区分」の移動先

| 認識 | 実態 |
|---|---|
| 院長の認識「旧 保険上の区分が B5 にあった」| **正しい（部分的に）** |
| 「別セルへ移動した」| **正確には「表示場所が C10/C34 に移った + 計算が自動化された」** |
| B5 は未使用か | **未使用（GAS 非参照・setValue なし）** — 認識通り |

---

### 自費ダイアログの価格参照（現状）

| 項目 | 内容 |
|---|---|
| マスタ取得関数 | `getSelfPayMenuMaster_V3()` |
| 参照元 | JBIZ-04 「価格設定」シート（`SpreadsheetApp.openById`）|
| 返却内容 | `{menuId, menuName, unitPrice}` — **一般料金のみ** |
| 会員料金 | `JBIZ_COL.memberPrice = 7`（H列）として**定数は定義済み**だが、getSelfPayMenuMaster_V3 では**まだ読まれていない** |
| 会員フラグ | **現在は未実装**。UI_REDESIGN_PHASE1.md に将来方針のみ記載あり |
| 価格切り替え | **現状なし**。一般料金固定でダイアログに渡している |

```javascript
// 現在の返却構造（memberPrice は含まれない）
result.push({menuId, menuName, unitPrice});  // 一般料金のみ

// JBIZ_COL.memberPrice = 7 は定義済みだが未使用
```

---

### 既存ドキュメントの将来設計記述（UI_REDESIGN_PHASE1.md）

```
> **会員フラグ（isGymMember）** は将来 JBIZ-04 の患者マスタと連携。
> Phase 1 では手入力で問題なし。将来拡張しやすいよう H7 数式を
> `=IF(F7="",E3,E3+F7)` にしておく。
```

```
F7 の数式案（将来）:
  =IF(D7="","", IFERROR(VLOOKUP(D7, 設定!$A$xx:$D$yy, IF(isGymMember, 3, 2), FALSE), ""))
```

→ **今回提案の「B5 = ジム会員チェックボックス」は、既存設計方針と完全に整合している。**

---

## 結論

### A5/B5 案は採用可能か

| 項目 | 判定 | 根拠 |
|---|---|---|
| A5 を「ジム会員」ラベルに使う | ✅ **可** | GAS から全く参照されていない |
| B5 をチェックボックスに使う | ✅ **可（条件付き）**| getValue なし・保険算定に影響なし。UI.kubun 定義の変更が必要 |
| 当日UI上書きとして妥当か | ✅ **妥当** | 1来院ごとに会計入力を行う既存フローに自然に馴染む |
| 将来の患者マスタ連携と両立するか | ✅ **両立可** | 既存設計に「患者マスタ既定値 + 当日UI上書き」が想定されている |

**採用判定: 条件付き可 — UI.kubun 定義の変更が必要なため、コード修正を伴う。影響範囲は狭く、リスクは Low。**

---

## 採用時の注意点（条件）

1. `UI.kubun = "B5"` を `UI.gymMember = "B5"` に改名すること
2. `clearAfterSaveUI_V3_` の `setValue("")` を `setValue(false)` に変更すること（チェックボックスは false リセットが正確）
3. `clearEntryUI_V3` の `"B5:B7".clearContent()` はそのままでよい（チェックボックスの clearContent は FALSE に戻る）
4. `setupSelfPayValidation_V3_` に A5/B5 の設置処理を追加すること（他の行と同様）

---

## 最小改修案（実装するなら）

### Phase A: UI のみ（チェックボックス設置 + 保存）— 最小構成

**変更ファイル: `Ver3_core.js` のみ**

| 変更箇所 | 変更内容 | 影響 |
|---|---|---|
| `UI` const L82 | `kubun: "B5"` → `gymMember: "B5"` | 定数名の改名のみ |
| `clearAfterSaveUI_V3_` | `setValue("")` → `setValue(false)` | clearの動作を明確化 |
| `readSelfPayFromUI_V3_` | `gymMember: uiSh.getRange(UI.gymMember).getValue()` を追加 | 来院ヘッダへの書き込みが可能になる |
| `appendHeaderRow_V3_` | gymMember の値を「ジム会員フラグ」列として来院ヘッダに保存 | 来院ヘッダに1列追加 |
| `setupSelfPayValidation_V3_` | A5=「ジム会員」ラベル・B5=チェックボックス の設置を追加 | Sheets 初期設定に A5/B5 が含まれる |

### Phase B: ダイアログ価格切り替え（Phase A の後）

**変更ファイル: `Ver3_core.js` + `selfPayDialog.html`**

| 変更箇所 | 変更内容 |
|---|---|
| `getSelfPayMenuMaster_V3` | `memberPrice: Number(row[JBIZ_COL.memberPrice])` を返却に追加 |
| `getCurrentVisitKey_V3` | B5 の値（isGymMember）を返却に追加 |
| `selfPayDialog.html` | `visitKeyInfo.isGymMember` を見て、メニュー選択時に一般/会員価格を切り替える |

### Phase C: 患者マスタ連携（将来）

- 患者マスタに「ジム会員」列を追加
- 患者選択時（B2 onEdit）に患者マスタからデフォルト値を B5 に書き込む
- B5 はユーザーが当日上書き可能（Phase A/B の UI をそのまま継続）

---

## 影響ファイル一覧

| ファイル | Phase A | Phase B | Phase C |
|---|---|---|---|
| `Ver3_core.js` | ✅ 変更必要 | ✅ 変更必要 | ✅ 変更必要 |
| `selfPayDialog.html` | 変更なし | ✅ 変更必要 | 変更なし |
| 患者マスタ シート | 変更なし | 変更なし | ✅ 列追加 |
| 来院ヘッダ シート | ✅ 列追加 | 変更なし | 変更なし |
| `SPEC.md` | 変更なし | 変更なし | 変更なし |
| `Ver3_amounts.js` | 変更なし | 変更なし | 変更なし |
| `Ver3_transferData.js` | 変更なし | 変更なし | 変更なし |

---

## リスク評価

| リスク | 影響度 | 内容 |
|---|---|---|
| `UI.kubun` 改名漏れ | Low | clearAfterSaveUI_V3_ が参照しているため、改名時に同時変更必須。見落とし防止: grep で `UI\.kubun` を検索して 0 件になることを確認する |
| `"B5:B7".clearContent()` | Low | B5 チェックボックスのクリアは clearContent() で FALSE に戻る。問題なし |
| 来院ヘッダ列追加 | Low | 既存データ（gymMember 列なし行）は空欄として扱われる。HEADER_COLS に追加すれば自動的に backward-compatible |
| 当日入会者対応 | 低（設計で解決済み）| チェックボックスを毎回入力するUIなので当日入会者も問題なく対応できる |
| ダイアログ価格切り替えのUX | Medium | Phase B 実装時、「会員チェック後にダイアログを開く」フローを受付に周知する必要あり |

---

## 推奨実施順序

```
Phase A（最小構成・安全）
  ① Ver3_core.js に gymMember フラグを追加
  ② setupSelfPayValidation_V3_ で A5/B5 を自動設置
  ③ 来院ヘッダに「ジム会員フラグ」列を追加
  ④ clasp push → GAS メニュー「会計ブロック自動生成」再実行
  ⑤ T-GYM-01〜03 テスト実施（チェックあり/なしで保存、来院ヘッダ確認）
  ⑥ PROJECT_STATUS.md 更新 + commit/push

Phase B（価格切り替え — Phase A 安定後）
  ① getSelfPayMenuMaster_V3 に memberPrice を追加
  ② getCurrentVisitKey_V3 に isGymMember を追加
  ③ selfPayDialog.html を価格切り替え対応に改修
  ④ clasp push + テスト（会員/非会員でダイアログ価格が変わることを確認）

Phase C（患者マスタ連携 — 運用データ蓄積後）
  患者マスタに「ジム会員」列追加 + onEdit で B5 にデフォルト値を書き込む
```

---

## Phase A 実装完了（2026-03-31）

### 実装内容（Ver3_core.js）

| 変更箇所 | 変更内容 |
|---|---|
| `UI` const | `kubun: "B5"` → `gymMember: "B5"` に改名。Phase A〜C の拡張方針をコメントに記載 |
| `HEADER_COLS` | `gymMemberFlag: "ジム会員フラグ"` を追加 |
| `readSelfPayFromUI_V3_` | `gymMember = getValue() === true` を追加。`gymMemberFlag` を返却オブジェクトに含める |
| `appendHeaderRow_V3_` 呼び出し | `gymMemberFlag: selfPayInfo.gymMemberFlag` を追加 |
| `clearAfterSaveUI_V3_` | `setValue("")` → `setValue(false)`（チェックボックス前提の明示的リセット）|
| `clearEntryUI_V3` | `"B5:B7".clearContent()` → `gymMember.setValue(false)` + `"B6:B7".clearContent()` に分割 |
| `setupSelfPayValidation_V3_` | A5 ラベル・B5 チェックボックス・A5:B5 罫線・A6:B6 クリア の設置処理を追加 |
| `setupSelfPayValidation_V3`（公開版）| アラートメッセージに Row 5 の説明を追加 |
| `onOpen` メニュー | `"会計ブロック自動生成（患者画面 行7〜8）"` → `"UI初期設定（行5:ジム会員 / 行7〜8:会計ブロック）"` |

### UIデザイン（A5:B5）

| セル | 設定内容 |
|---|---|
| A5 | "ジム会員" / 背景 `#e8e8e8`（LABEL_BG）/ 太字 |
| B5 | チェックボックス / 背景 `#ffffff`（INPUT_BG）|
| A5:B5 | 外枠罫線 `#888888` SOLID（行7〜8ブロックと同スタイル）|
| A6:B6 | clearContent + clearDataValidations + 背景 `#ffffff`（旧残骸除去・視覚分離）|

### 院長が実行するタスク（clasp push 後）

| # | 操作 | 方法 |
|---|---|---|
| 1 | clasp push を実行する | ローカルで `clasp push` |
| 2 | スプレッドシートを開く | 来店管理施術録ver3.1 |
| 3 | メニュー「柔整システム」→「UI初期設定（行5:ジム会員 / 行7〜8:会計ブロック）」を実行 | 1回だけ |
| 4 | 患者画面 A5/B5 にチェックボックスが設置されていることを確認 | 目視確認 |
| 5 | T-GYM-01〜03 テスト実施 | 下記参照 |

### テスト観点（院長実機確認用）

| # | テスト内容 | 期待結果 |
|---|---|---|
| T-GYM-01 | B5 チェックあり（会員）で保存 → 来院ヘッダの「ジム会員フラグ」列を確認 | TRUE が記録されている |
| T-GYM-02 | B5 チェックなし（非会員）で保存 → 来院ヘッダの「ジム会員フラグ」列を確認 | FALSE が記録されている |
| T-GYM-03 | 保存後に B5 が FALSE に戻っているか確認 | clearAfterSaveUI_V3_ で FALSE リセット |
| T-GYM-04 | 「患者画面クリア（入力のみ）」実行後に B5 が FALSE になっているか確認 | clearEntryUI_V3 で FALSE リセット |

---

## Phase B 実装完了（2026-03-31）

### 実装内容

| ファイル | 変更内容 |
|---|---|
| `Ver3_core.js` — `getSelfPayMenuMaster_V3` | `memberPrice: Number(row[JBIZ_COL.memberPrice]) \|\| 0` を追加。fallback オブジェクトにも `memberPrice: 0` を追加 |
| `Ver3_core.js` — `getCurrentVisitKey_V3` | バッチ読み取り範囲 `"B2:C4"` → `"B2:C5"` に拡張。`isGymMember = metaVals[3][0] === true` で B5 を読み取り、返却オブジェクトに追加 |
| `selfPayDialog.html` | CSS に `#gymMemberBadge` スタイル追加。HTML にバッジ要素追加。`getCurrentVisitKey_V3` 成功時に `isGymMember` なら表示。`addRow` の option 生成で `effectivePrice = (isGymMember && memberPrice > 0) ? memberPrice : unitPrice` に切り替え |

### 価格切替ロジック

```
B5 = true（ジム会員）
  → JBIZ H列(memberPrice) > 0 なら H列を使用
  → H列が 0 or 空なら G列(unitPrice) にフォールバック

B5 = false（一般）
  → G列(unitPrice) を使用
```

### フォールバック設計

| 状況 | 動作 |
|---|---|
| JBIZ H列が空 / 0 の場合 | G列（一般料金）で表示。JBIZ に会員料金を設定すれば自動で切り替わる |
| JBIZ シートに接続不可 | fallback 定数を使用（memberPrice: 0 なので G列相当で動作）|
| B5 未チェックのまま dialog 開く | 一般料金で表示（Phase A 完了前の既存挙動と同じ）|

### テスト観点（院長実機確認）

| # | テスト内容 | 期待結果 |
|---|---|---|
| T-GYM-B1 | B5 チェックあり → 自費明細ダイアログを開く | バッジ「🏋 ジム会員料金 適用中」が表示される |
| T-GYM-B2 | B5 チェックなし → 自費明細ダイアログを開く | バッジが表示されない |
| T-GYM-B3 | B5 チェックあり → JBIZ H列に会員料金が設定されているメニューを選択 | 会員料金が単価欄に入る |
| T-GYM-B4 | B5 チェックあり → JBIZ H列が 0（未設定）のメニューを選択 | G列の一般料金が入る（フォールバック）|
| T-GYM-B5 | B5 チェックなし → 同じメニューを選択 | G列の一般料金が入る |

### 院長の次アクション

| # | 操作 |
|---|---|
| 1 | `clasp push` を実行 |
| 2 | JBIZ「メニューマスタ（価格設定）」シートの H列（ジム会員料金）に金額を入力 |
| 3 | T-GYM-B1〜B5 を実機確認 |

---

## 次に院長が判断すべき1点

> **Phase C（患者マスタ連携）をいつ実施するか？**
> Phase B 安定確認後に検討。患者マスタに「ジム会員」列を追加し、
> B2 に患者 ID を入力したタイミングで B5 を自動セットする実装。

---

## 変更履歴

| 日付 | 内容 |
|---|---|
| 2026-03-31 | 初版作成（調査フェーズ。実装なし）|
| 2026-03-31 | Phase A 実装完了。ステータス更新・実装内容・院長タスク・テスト観点を追記 |
| 2026-03-31 | T-GYM-01〜04 全件 OK。Phase A 完了確認。Phase B 実装完了。実装内容・価格切替ロジック・テスト観点を追記 |
