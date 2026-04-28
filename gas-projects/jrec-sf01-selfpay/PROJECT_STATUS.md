# PROJECT_STATUS.md — JREC-SF01 自費カルテ・会計システム

## 現在ステータス

**Phase 5-A DailySales 設計調査完了（コード変更なし）**（2026-04-28）

---

## 本日終了状態（2026-04-28）

---

## Phase 5-A DailySales 集計 設計調査（2026-04-28）

**詳細:** `docs/PHASE5A_DAILYSALES_DESIGN.md` を参照

### 調査サマリー

| 項目 | 現状 |
|---|---|
| DailySales シート | 存在するが空。集計ロジック未実装 |
| 集計の正本 | Payments（売上・未収）/ SelfPayVisits（来院数）/ Run_Log（未収回収） |
| Run_Log バグ | `appendRunLog_` の selfPayVisitKey 列が常に空。visitKey は detail テキストに埋め込み |
| 未収回収額の検出 | Run_Log.PAYMENT_COLLECT または Payments の createdAt ≠ 入金日 で判定 |

### 推奨実装方針（3ステップ）

```
Step 1: getDailySalesReport(date) — オンデマンド集計関数
Step 2: 日次集計画面（daily-sales.html）
Step 3: rebuildDailySales(date) — DailySales シートへの書き込み
```

### 実装前確認事項（ユーザー確認待ち）

| # | 確認事項 |
|---|---|
| 1 | 売上の日付基準: 来院日 / 入金日 / 領収書発行日 のどれ? |
| 2 | 未収回収額の帰属: 回収日 or 来院日? |
| 3 | Run_Log バグ修正を先に行うか? |
| 4 | 主力来院数の KPI 基準: SELFPAY_CONTINUE20 固定でよいか? |
| 5 | 日次集計画面を Web 画面として作るか、シートで直接見るか? |

---

## ✅ Phase 4 後半 F-2「未収回収処理」CLOSED（2026-04-28）

### F-2 実機確認 PASS

| 確認項目 | 結果 |
|---|---|
| 患者詳細 未収残高 ¥5,500 表示 | ✅ PASS |
| 対象来院に「一部入金」バッジ表示 | ✅ PASS |
| 「未収回収」ボタン表示 | ✅ PASS |
| receipt 画面で未収回収セクション表示 | ✅ PASS |
| 未収額 ¥5,500 表示 | ✅ PASS |
| 回収実行後の成功メッセージ | ✅ PASS |
| 入金状態が「入金済」に即時 DOM 更新 | ✅ PASS |
| 入金日表示 | ✅ PASS |
| 患者詳細へ戻ると未収残高 ¥0 | ✅ PASS |
| 未会計 0件 | ✅ PASS |
| 該当来院が「会計済」状態に更新 | ✅ PASS |

### F-2 確定仕様

#### 未収回収の定義

| 項目 | 定義 |
|---|---|
| 未収対象 | `paymentStatus = "未収"` または `"一部入金"` の Payment |
| 回収操作 | receipt 画面の「未収回収」セクションから実行 |
| 回収結果 | `paymentStatus → "入金済"` + 入金日記録 + Run_Log 記録 |
| 未収の除外 | 回収後は患者詳細・患者一覧の未収残高から除外される |

#### タイムラインの表示優先順位（確定）

| 優先度 | 条件 | バッジ | ボタン |
|---|---|---|---|
| 1 | Payments なし | 未会計（黄）| 会計入力 |
| 2 | paymentStatus = 未収/一部入金 | 未収/一部入金（赤）| 未収回収 → receipt |
| 3 | Payments あり + Receipt あり | 領収書発行済（青）| 領収書 |
| 4 | Payments あり + Receipt なし | 会計済（緑）| 領収書を発行 |

**未収は receipt 発行有無にかかわらず最優先で赤表示。**

#### 二重回収防止

| 層 | 実装 |
|---|---|
| GAS | paymentStatus = "入金済" の場合に `{ ok: false, error: "すでに入金済みです" }` を返す |
| UI（テンプレート）| `payment.paymentStatus !== "未収"/"一部入金"` の場合に回収セクションを非表示 |
| UI（DOM 更新）| 回収成功後に `paymentStatusDisplay` を「入金済」に更新し、collectionArea を非表示 |

#### 実装ファイル一覧（F-2 全体）

| ファイル | 変更内容 |
|---|---|
| `JREC_SF01_Billing.gs` | `collectOutstandingPayment()` 追加、`paymentMethod` を return に追加 |
| `receipt.html` | 未収回収セクション HTML + `handleCollect()` + DOM 更新ロジック |
| `billing-form.html` | 保存ボタン「保存済み ✓」修正 |
| `patient-detail.html` | タイムライン状態判定の優先順位修正 + 「未収回収」ボタン追加 |

### F-2 後半以降へ回した残課題

| 課題 | 理由 | 優先度 |
|---|---|---|
| 一部入金の差額管理 | 今回は全額を一括「入金済」更新。入金済み額との差額追跡は設計が必要 | 中 |
| 領収書再発行 | reissueCount インクリメント + 新規 Receipt INSERT | 低 |
| DailySales 集計 | 回収時の DailySales 未収回収額更新 | 中 |
| `visitCount` / `lastVisitDate` 実データ化 | getPatients が常に 0/空のまま | 中 |
| 取消・返金設計 | 不可逆操作のため別途設計 | 低 |

---

## Phase 4 後半 F-2 タイムライン優先順位修正（2026-04-28）

### 発見した問題と根本原因

**現象:** 患者詳細タイムラインで未収の来院が「領収書発行済」と表示される。赤バッジ「未収」が見えない。

**根本原因:** `patient-detail.html` の状態判定で `if (rec)` が最優先になっていた。
領収書が発行済みなら `paymentStatus` に関わらず「領収書発行済」と表示されていた。

```javascript
// 修正前（問題あり）
if (rec) {                         // ← Receipt が最優先 → 未収でも「領収書発行済」
  billingLabel = '領収書発行済';
} else if (v.billingStatus === '未収') {
  billingLabel = '未収';           // ← Receipt がある場合は到達しない
```

### 修正内容（patient-detail.html）

#### 状態判定の優先順位（確定版）

| 優先度 | 条件 | バッジ | 色 |
|---|---|---|---|
| 1 | `!pay`（Payments なし）| 未会計 | 黄/橙 |
| 2 | `payStatus = "未収"/"一部入金"` | 未収 / 一部入金 | 赤太字 ← **最優先** |
| 3 | `pay && rec`（入金済+領収書発行）| 領収書発行済 | 青 |
| 4 | `pay && !rec`（入金済+未発行）| 会計済 | 緑 |

**ポイント:** 未収は receipt 発行有無にかかわらず最優先で赤表示。
領収書が発行済みでも入金がない場合は「未収」を優先する。

```javascript
// 修正後
var payStatus = pay ? (pay.paymentStatus || '') : '';
if (!pay) {
  billingLabel = '未会計';
} else if (payStatus === '未収' || payStatus === '一部入金') {
  billingLabel = payStatus;  // "未収" or "一部入金"
} else if (rec) {
  billingLabel = '領収書発行済';
} else {
  billingLabel = '会計済';
}
```

#### アクションボタン（確定版）

| 状態 | ボタン | 遷移先 | クラス |
|---|---|---|---|
| 未会計 | 会計入力 | `?page=billing&visitKey=...` | tl-action-billing（青）|
| **未収/一部入金** | **未収回収** | `?page=receipt&visitKey=...` | **tl-action-outstanding（赤）** |
| 会計済（領収書未発行）| 領収書を発行 | `?page=receipt&visitKey=...` | tl-action-receipt（緑）|
| 領収書発行済 | 領収書 | `?page=receipt&visitKey=...` | tl-action-receipt（緑）|

CSS 追加: `.tl-action-outstanding { background:#fce8e6; color:#d93025; }`

#### clasp push

```
clasp push --force → 14ファイル push 完了（2026-04-28 16:07:18）
```

### 手動確認手順（再デプロイ後）

1. **未収の来院がある患者詳細を開く**
   - 期待: タイムラインで「未収」赤太字バッジ + 赤「未収回収」ボタン表示
   - 領収書発行済みの来院でも未収なら「未収」バッジが表示されることを確認

2. **「未収回収」ボタンをクリック**
   - 期待: `?page=receipt&visitKey=...` に遷移
   - receipt 画面で「未収回収」セクションが表示される

3. **回収後に患者詳細に戻る**
   - 期待: 該当来院のバッジが「未収」→「領収書発行済」または「会計済」に変わる

---

## Phase 4 後半 F-2 表示不整合修正（2026-04-28）

### F-2 実機確認結果 + 表示不整合の修正

#### F-2 実機確認

| 確認項目 | 結果 |
|---|---|
| 患者一覧 未会計件数・未収額表示 | ✅ PASS |
| 患者詳細 累計支払・未収残高・未会計件数 | ✅ PASS |
| receipt 画面に「未収回収」セクション表示 | ✅ PASS |
| 「未収を回収する」ボタン表示 | ✅ PASS |
| 回収成功メッセージ表示 | ✅ PASS |
| 領収書発行 + 発行済みバナー表示 | ✅ PASS |
| 患者一覧 未収額表示 | ✅ PASS |
| **問題** 回収後も画面上の入金状態が「未収」のまま | ❌ → 修正済み |

#### 根本原因

receipt.html はページロード時に GAS テンプレートから `PAYMENT` オブジェクトを受け取りサーバーサイドレンダリングする。
`collectOutstandingPayment()` は Payments シートを正しく更新するが、
DOM に反映されるのはページロード時の値（`payment.paymentStatus = "未収"`）のまま。
ページをリロードしない限り「未収」表示が残る。

#### 修正内容

**JREC_SF01_Billing.gs:**

`collectOutstandingPayment()` の return に `paymentMethod` を追加。
UI 側が DOM 更新で使用できるようにした。

```javascript
return {
  ok: true, visitKey, newStatus: "入金済",
  paymentDate, totalTaxInc,
  paymentMethod: paymentMethod || curPaymentMethod  // ← 追加
};
```

**receipt.html:**

- 支払方法セルに `id="paymentMethodDisplay"` 付与
- 入金状態セルに `id="paymentStatusDisplay"` 付与
- 入金日セルに `id="paymentDateDisplay"` 付与（常時表示、未設定時は「—」）
- メモブロック重複バグを修正（Edit時に生じた重複 `if(memo)` を削除）
- 入金日の `<?= date || '<span>...</span>' ?>` HTML エスケープバグを if ブロックに修正

**handleCollect() の成功ハンドラ:**

回収成功後に以下を実行:
1. DOM 更新: `paymentStatusDisplay` → 「入金済」（緑太字）
2. DOM 更新: `paymentMethodDisplay` → 回収時の支払方法
3. DOM 更新: `paymentDateDisplay` → 入金日
4. JS オブジェクト更新: `PAYMENT.paymentStatus / paymentMethod / paymentDate`
   （後続の issueReceipt でも正しい値を参照できる）

#### clasp push

```
clasp push --force → 14ファイル push 完了（2026-04-28 15:49:44）
```

---

## Phase 4 後半 F-2「未収回収処理」（2026-04-28）

### F-1 follow-up 実機確認 PASS

| 確認項目 | 結果 |
|---|---|
| `<span class="muted">—</span>` 文字列バグ修正 | ✅ PASS |
| 患者一覧「未会計あり 1名」表示 | ✅ PASS |
| 患者一覧 未収残高: ¥0 表示 | ✅ PASS |
| 患者一覧 未会計件数: 未会計 4件 | ✅ PASS |
| 患者詳細 累計支払: ¥11,550 | ✅ PASS |
| 患者詳細 未収残高: ¥0 | ✅ PASS |
| 患者詳細 未会計: 4件 | ✅ PASS |
| 未会計ボタン → 会計入力画面遷移 | ✅ PASS |
| 会計保存後 → 領収書未発行画面遷移 | ✅ PASS |
| 保存ボタン「保存済み ✓」表示（billing-form.html 修正）| ✅ 同時修正済み |

---

### F-2「未収回収処理」実装内容

#### 未収・未会計・回収済みの定義（確定版）

| 種別 | 条件 | 意味 |
|---|---|---|
| **未会計** | SelfPayVisits あり + Payments なし | 来院したが会計入力していない（金額未確定）|
| **未収** | Payments あり + paymentStatus = 未収/一部入金 | 請求済みだが入金できていない |
| **回収済み** | Payments あり + paymentStatus = 入金済 | 入金完了 |

**未会計は未収回収の対象外。** 会計入力（billing-form）で Payment を作成してから回収処理を行う。

#### 実装ファイル

**JREC_SF01_Billing.gs: `collectOutstandingPayment(visitKey, payload)` 追加**

| ステップ | 内容 |
|---|---|
| 1. Payment 検索 | Payments シートで visitKey に一致する行を探す |
| 2. 二重回収チェック | paymentStatus = "入金済" → `{ ok: false, error: "すでに入金済みです" }` |
| 3. 対象外チェック | paymentStatus が "未収"/"一部入金" 以外 → エラー |
| 4. Payments 更新 | col 7 = 入金済 / col 6 = 支払方法（オプション）/ col 8 = 入金日 / col 9 = メモ |
| 5. SelfPayVisits 更新 | `updateVisitBillingStatus_(visitKey, "会計済")` |
| 6. Run_Log 記録 | action = "PAYMENT_COLLECT" |

**receipt.html: 未収回収セクション追加**

- `payment.paymentStatus === '未収' || '一部入金'` のとき GAS テンプレートで表示
- 支払方法プルダウン（現金/カード/電子マネー/PayPay/その他）
- 回収メモ入力
- `handleCollect()` → `google.script.run.collectOutstandingPayment(VISIT_KEY, payload)`
- 20秒タイムアウト
- 成功後: collectionArea を非表示 + 「回収済み」成功メッセージ + 「患者詳細へ戻る」ボタン
- 失敗時: `#collectMsg` にエラー表示・ボタン再有効化

**billing-form.html: 小修正**

- 保存成功後の保存ボタンテキストを「保存中...」→「保存済み ✓」に変更

#### 二重回収防止

| 防止層 | 内容 |
|---|---|
| GAS 層 | `paymentStatus === "入金済"` の場合 `{ ok: false, error: "すでに入金済みです" }` を返す |
| UI 層 | `payment.paymentStatus !== '未収'/'一部入金'` の場合 GAS テンプレートで回収セクション非表示 |

#### clasp push

```
clasp push --force → 14ファイル push 完了（2026-04-28 15:33:03）
```

### 手動確認手順（再デプロイ後）

1. **未収ありの来院で receipt ページを開く**
   - paymentStatus = "未収" の visitKey を使う
   - 期待: 「未収回収」セクションが表示される（未収額・支払方法・メモ入力・回収ボタン）

2. **「未収を回収する」ボタンを押す**
   - 期待: 「回収しました（入金日: YYYY-MM-DD　¥X,XXX）」成功メッセージ
   - 期待: 回収セクションが非表示になる
   - 期待: 「患者詳細へ戻る」ボタンが表示

3. **二重回収テスト**
   - 同じ visitKey でもう一度「未収を回収する」を押す（もしページリロード後に回収ボタンが出た場合）
   - 期待: 「この支払はすでに入金済みです」エラーメッセージ

4. **患者詳細で確認**
   - 期待: 未収残高が回収額分減少 / 来院バッジが「未収」→「会計済」に変わる

5. **billing-form.html の保存ボタン確認**
   - 会計保存後: 「保存中...」ではなく「保存済み ✓」と表示される

### 残課題（後続フェーズ）

| 課題 | メモ |
|---|---|
| 一部入金の差額管理 | 今回は "一部入金 → 入金済" 全額回収として処理 |
| 未収督促履歴 | 督促日・手段の記録 |
| 領収書再発行 | Receipts に新規 INSERT（再発行回数カウント）|
| DailySales 集計 | 回収時の DailySales 更新（当日の未収回収額集計）|

---

### 未収と未会計の定義（確定）

| 種別 | 条件 | 表示 |
|---|---|---|
| **未収** | Payments が存在 かつ paymentStatus = "未収" または "一部入金" | 赤太字 ¥X,XXX |
| **未会計** | SelfPayVisits に来院記録あり かつ Payments が存在しない | 橙 X件 |
| **なし** | Payments あり かつ paymentStatus = "入金済" | ¥0（未収）/ 0件（未会計）|

**未会計を未収に含めない理由:**
会計入力がなければ金額が確定していないため「請求したが回収できていない」状態とは言えない。
未収 = 金額確定後の未回収。未会計 = 金額未確定の来院。

### 実装内容

**JREC_SF01_Billing.gs 追加:**

`getPatientListStats(patientId?)`:
- SelfPayVisits（visitKey→patientId）と Payments を各1回読み取り
- `{ [patientId]: { outstanding, unbilledCount } }` を返す
- `getAllOutstandingByPatient()` と新規の `unbilledCount` を統合した効率化関数
- 旧 `getAllOutstandingByPatient()` は後方互換で残す

`getPatientAccountingData()` を更新:
- `unbilledCount` フィールドを追加（Payments が存在しない visitKey の数）
- エラー時のフォールバックにも `unbilledCount: 0` を追加

**JREC_SF01_Main.gs 更新:**

`list` ルートを `getPatientListStats()` に切り替え（SS 読み取り 4回 → 2回に削減）。
`p.outstanding` と `p.unbilledCount` を patients 配列に注入。

**patient-list.html 変更:**

| 変更 | 内容 |
|---|---|
| バグ修正 | `<?= p.visitCount > 0 ? ... : '<span class="muted">—</span>' ?>` が HTML エスケープで文字列表示されていたのを if ブロックに変更 |
| 件数ラベル | `（未収あり X名）` に加えて `（未会計あり X名）` を橙色で追加 |
| 未収残高列 | 未収額の下に `未会計 X件` を橙色で表示（未会計が 0 の場合は非表示）|

**patient-detail.html 変更:**

サマリーグリッドに「未会計」アイテムを追加（5列目）。
- 未会計 0件: 通常表示 `0件`
- 未会計 > 0件: 橙太字 `X件`
- accounting が null: `—` フォールバック

#### clasp push

```
clasp push --force → 14ファイル push 完了（2026-04-28 12:25:59）
```

### 手動確認手順（再デプロイ後）

1. **患者一覧**
   - 未会計の来院がある患者: `（未会計あり X名）` が橙色表示 + 行の「未収残高」列に `未会計 X件` 橙表示
   - 未会計なし患者: 「未会計」表示なし、未収残高は `¥0`
   - 件数行の `<span class="muted">—</span>` が HTML 文字列として表示されないことを確認

2. **患者詳細**
   - サマリーグリッドに「未会計 X件」が 5列目に表示される
   - 未会計 0件: `0件` 通常色
   - 未会計 > 0件: `X件` 橙太字

### F-1 残課題とF-2への接続

| 残課題 | F-2 として実装 |
|---|---|
| 未収回収処理（paymentStatus 更新）| F-2 で実装予定 |
| `visitCount` の実データ表示 | 別途 Phase 5 で SelfPayVisits から集計 |

---

### 実装内容

#### 未収額の定義（確定）

```
未収額 = Payments.paymentStatus が "未収" または "一部入金" の totalTaxInc 合計
```

| 含む | 含まない |
|---|---|
| paymentStatus = "未収" の Payment | 来院したが会計入力していない来院（未会計）|
| paymentStatus = "一部入金" の Payment | paymentStatus = "入金済" の Payment |

**理由:** 会計入力自体がなければ未収とは言えない。未収は「請求したが回収できていない」状態。

#### 変更ファイル

**JREC_SF01_Billing.gs:**

`getAllOutstandingByPatient()` を新規追加。
SelfPayVisits（visitKey→patientId マップ）と Payments（未収・一部入金行）を1回ずつ読み取り、
`{ [patientId]: outstandingAmount }` を返す。

読み取りコスト: 患者一覧ページロードごとに SelfPayVisits + Payments の全行読み取り（2回）。
小規模運用（< 1,000 来院）では問題なし。増加した場合は DailySales へのキャッシュ化を検討する。

**JREC_SF01_Main.gs:**

`list` ルートを更新。`getAllOutstandingByPatient()` を呼び出し、各患者の `outstanding` に注入してからテンプレートへ渡す。

**patient-list.html:**

| 変更 | 内容 |
|---|---|
| 未収額フォーマット | `p.outstanding` → `Number(p.outstanding).toLocaleString()` に変更（カンマ区切り）|
| "0円" → "¥0" | 統一フォーマット |
| 件数行に未収件数 | `（未収あり X件）` を赤太字で追加（0件の場合は非表示）|
| 橙背景行 | `row-outstanding` クラス + 未収あり患者は橙背景（既存動作、実データで機能する）|

**patient-detail.html:**

| 変更 | 内容 |
|---|---|
| 未収残高 `—` → `¥0` | `accounting` が存在する限り `¥` + `toLocaleString()` 表示 |
| 未収 > 0 の場合 | 従来どおり赤太字 |
| `accounting` が null（異常系）| `—` 表示を維持（安全フォールバック）|

#### clasp push

```
clasp push --force → 14ファイル push 完了（2026-04-28 12:07:26）
```

### 手動確認手順（再デプロイ後）

1. **患者一覧を開く**
   - 期待: 未収あり患者がいる場合、件数行に「（未収あり X件）」赤太字表示
   - 期待: 未収あり患者の行が橙背景
   - 期待: 未収額列に `¥X,XXX` 形式（カンマ区切り）

2. **未収なし患者の一覧行を確認**
   - 期待: 未収額列に `¥0` 表示（「0円」ではなく「¥0」）

3. **患者詳細の未収残高を確認**
   - 未収なし患者: `¥0` 表示（以前は `—`）
   - 未収あり患者: 赤太字で `¥X,XXX` 表示

### F-2「未収回収処理」として次に残すこと

| タスク | 内容 |
|---|---|
| paymentStatus 更新 | 「未収」→「入金済」に更新するボタン/モーダルを患者詳細または receipt 画面に追加 |
| 患者詳細の未収行強調 | タイムラインで未収の来院を視覚的に強調（現在は「未収」バッジのみ）|
| 未収回収履歴 | いつ・誰が回収したかの記録（Run_Log への追記）|

---

## ✅ Phase 4 CLOSED（2026-04-28）

### Phase 4 実機確認 Step 5 PASS

| 確認項目 | 結果 |
|---|---|
| 未会計バッジ | ✅ PASS |
| 「会計入力」ボタン | ✅ PASS |
| 会計入力への遷移 | ✅ PASS |
| 領収書発行済バッジ | ✅ PASS |
| 「領収書」ボタン | ✅ PASS |
| 領収書画面への遷移 | ✅ PASS |
| 「✅ 発行済み」バナー表示 | ✅ PASS |
| 累計支払 ¥3,850 表示 | ✅ PASS |
| タイムライン表示（Phase 3 退行なし）| ✅ PASS |
| 対象患者: P0001 / visitKey: SPV_20260428_P0001_004 / receiptNo: R_2026_0001 | ✅ PASS |

**確認時の補足:**
- 未収残高 = 0 の場合は「—」表示（未収なし）→ Phase 4 CLOSED の阻害要因ではない
- 「¥0」表示の方が会計管理上明確かどうかは次フェーズで判断

---

### Phase 4 実装済みスコープ（CLOSED）

#### 実装ファイル

| ファイル | 役割 |
|---|---|
| `JREC_SF01_Billing.gs` | 会計バックエンド全関数 |
| `JREC_SF01_Main.gs` | billing / receipt ルート追加・accounting データ渡し |
| `billing-form.html` | 会計入力UI（メニュー選択・税計算・保存）|
| `receipt.html` | 領収書発行UI（プレビュー・印刷・発行済みバナー）|
| `patient-detail.html` | 会計導線・サマリー実データ化 |
| `docs/ACCOUNTING_POLICY_v1.md` | 会計設計方針（カルテ/会計分離・自動変換しない理由）|

#### 実装済み機能

| 機能 | 詳細 |
|---|---|
| MenuMaster 由来のメニュー選択 | `getActiveMenus()` → optgroup カテゴリ別プルダウン |
| 明細行の動的追加/削除 | 行追加・削除・リアルタイム税計算 |
| 会計保存 | `savePaymentWithItems()` → SelfPayItems + Payments + SelfPayVisits 会計状態更新 |
| 領収書発行 | `issueReceipt()` → Receipts 採番・保存 |
| 発行済み領収書表示 | `getReceiptByVisit()` → receiptNo / 宛名 / 金額 / 明細 |
| 印刷対応 | `window.print()` + `@media print` で UI 非表示 |
| 発行済みバナー | `✅ 発行済み No. R_2026_0001 発行日: YYYY年M月D日` |
| 二重保存防止 | GAS 側 Payments 重複チェック + 保存成功後フォーム disabled |
| 二重発行防止 | GAS 側 Receipts 重複チェック + alreadyIssued 時に既存返却 |
| 患者詳細の会計バッジ | 未会計/会計済/未収/領収書発行済 の 4状態 |
| 患者詳細のアクションボタン | 未会計→会計入力 / 会計済未発行→領収書を発行 / 発行済→領収書 |
| 累計支払表示 | `getPatientAccountingData()` から実値（¥X,XXX）|
| 未収残高表示 | 未収 > 0 の場合 赤太字で表示 |
| 会計設計方針文書 | `docs/ACCOUNTING_POLICY_v1.md` |

#### 会計フロー（確定版）

```
患者詳細 → 「会計入力」ボタン（未会計の来院行）
  → billing-form.html でメニュー選択・支払入力
  → savePaymentWithItems() → SelfPayItems + Payments 保存
  → receipt.html へ遷移
  → 「領収書を発行する」ボタン
  → issueReceipt() → Receipts 保存・receiptNo 採番
  → 領収書プレビュー表示・印刷
  → 患者詳細へ戻る
患者詳細 → 来院行に「領収書発行済」バッジ + 「領収書」ボタン
```

---

### Phase 4 後半以降へ回した残課題

| 課題 | 優先度 | メモ |
|---|---|---|
| 未収0円表示の改善 | 低 | 現在は `—`。`¥0` 表示の方が明確かどうか次フェーズで判断 |
| 未収回収処理 | 中 | Payments.paymentStatus を「入金済」に更新するモーダル |
| 患者一覧の未収額表示 | 中 | 患者一覧で Payments と JOIN して未収額列を実データ化 |
| 領収書の再発行 | 低 | reissueCount をインクリメントして新規 receipt INSERT |
| DailySales 日次集計 | 中 | savePaymentWithItems 後に DailySales を更新する集計ロジック |
| 取消・返金 | 要設計 | 不可逆操作のため設計フェーズで別途検討 |
| 会計明細の編集・削除 | 要設計 | 誤入力訂正フロー |

---

## ✅ Phase 4 Step 5 完了（2026-04-28）

### patient-detail.html 会計導線・サマリー実データ化

#### 変更内容

**JREC_SF01_Billing.gs に追加:**

`getPatientAccountingData(patientId)` — 患者単位の会計集計

| 戻り値 | 内容 |
|---|---|
| `totalPaid` | 入金済・一部入金 の tax-inc 合計 |
| `totalOutstanding` | 未収・一部入金 の tax-inc 合計 |
| `payments[visitKey]` | visitKey ごとの支払情報（exists ならば会計済み）|
| `receipts[visitKey]` | visitKey ごとの領収書情報（exists ならば発行済み）|

**JREC_SF01_Main.gs の detail ルート:**

`t.accounting = getPatientAccountingData(idParam)` を追加

**patient-detail.html:**

| 変更箇所 | 内容 |
|---|---|
| 累計支払 | `accounting.totalPaid > 0` の場合に `¥X,XXX` 表示（0なら `—`）|
| 未収残高 | `accounting.totalOutstanding > 0` の場合に赤太字で `¥X,XXX` 表示 |
| 来院ごとのステータスバッジ | 4状態: 未会計（黄）/ 会計済（緑）/ 未収（赤）/ 領収書発行済（青）|
| 来院ごとのアクションボタン | 未会計 → `会計入力` / 会計済み未発行 → `領収書を発行` / 発行済み → `領収書` |

#### 会計ステータスバッジ仕様

| 状態 | 条件 | バッジ | スタイル |
|---|---|---|---|
| 未会計 | `pay == null` | 「未会計」 | 黄背景・橙文字 |
| 会計済 | `pay != null && billingStatus != "未収" && rec == null` | 「会計済」 | 緑背景・緑文字 |
| 未収 | `billingStatus == "未収"` | 「未収」 | 赤背景・赤文字・太字 |
| 領収書発行済 | `rec != null` | 「領収書発行済」 | 青背景・青文字 |

#### アクションボタン動作

```javascript
// 会計入力ボタン（未会計のみ）
top.location.href = APP_URL + '?page=billing&visitKey=' + vk

// 領収書ボタン（会計済み・発行済み）
top.location.href = APP_URL + '?page=receipt&visitKey=' + vk
```

`event.stopPropagation()` で `tl-header` の `toggleDetail()` が誤発火しないよう制御済み。

#### 手動確認手順（再デプロイ後）

1. **未会計の来院がある患者詳細を開く**
   - 期待: タイムラインの各来院に「未会計」バッジ + 「会計入力」ボタン表示

2. **「会計入力」ボタンをクリック**
   - 期待: `?page=billing&visitKey=SPV_...` に遷移

3. **会計済み・領収書未発行の来院を持つ患者詳細を開く**（SPV_20260428_P0001_004 など）
   - 期待: 「会計済」バッジ + 「領収書を発行」ボタン
   - 累計支払に ¥3,850（または実際の値）表示

4. **「領収書を発行」ボタンをクリック**
   - 期待: `?page=receipt&visitKey=...` に遷移

5. **領収書発行済みの来院を持つ患者詳細を開く**
   - 期待: 「領収書発行済」青バッジ + 「領収書」ボタン表示

6. **「領収書」ボタンをクリック**
   - 期待: receipt 画面に直接遷移し、発行済みプレビューが即表示される

#### clasp push

```
clasp push --force → 14ファイル push 完了（2026-04-28 11:47:50）
```

---

## ✅ Phase 4 Step 4 実機確認 PASS（2026-04-28）

| 確認項目 | 結果 |
|---|---|
| 領収書発行ボタン | ✅ PASS |
| 発行後プレビュー表示 | ✅ PASS |
| receiptNo 表示（R_2026_0001）| ✅ PASS |
| 税込合計 ¥3,850 表示 | ✅ PASS |
| 印刷ボタン表示 | ✅ PASS |
| リロード後の発行済み表示 | ✅ PASS（receiptNo・プレビュー表示、発行ボタン再表示なし）|
| 二重発行防止 | ✅ PASS |
| 改善: 「発行済み」ラベル追加 | ✅ 対応済み（`showReceiptBox` に statusBanner を追加）|

### 改善内容（2026-04-28）

`showReceiptBox()` の先頭に「発行済み」ステータスバナーを追加。
リロード後に発行済み状態で開いたとき、受領書番号と発行日が画面上部で一目で確認できる。

```
✅ 発行済み  No. R_2026_0001  発行日: 2026年4月28日
```
（`no-print` クラス付き → 印刷時は非表示）

---

## ✅ Phase 4 Step 4 完了（2026-04-28）

### receipt.html 領収書発行UI 実装内容

#### 3状態の分岐表示

| 状態 | 条件 | 表示内容 |
|---|---|---|
| 未会計 | `payment == null` | 「未会計」メッセージ + 「会計入力へ」ボタン |
| 会計済み・未発行 | `payment != null && receipt == null` | 会計サマリー + 「領収書を発行する」ボタン |
| 発行済み | `receipt != null`（初期表示 or 発行後）| 領収書プレビュー + 印刷ボタン |

#### 領収書発行フロー

```
「領収書を発行する」ボタン押下
  → google.script.run.issueReceipt(VISIT_KEY) 呼び出し
  → 20秒タイムアウト付き
  → 成功: showReceiptBox(res) で領収書プレビューを DOM に描画
          発行ボタンを非表示、印刷ボタン・戻るボタンを表示
  → 失敗: DOM に GAS エラーメッセージを表示、ボタン再有効化
```

#### 二重発行防止

| 防止層 | 内容 |
|---|---|
| GAS 側（issueReceipt）| Receipts シートに同 visitKey が存在する場合、新規 INSERT せず既存レコードを返す（`alreadyIssued=true`）|
| UI 側 | 発行ボタンを押した時点で disabled。発行完了後は issueArea を非表示に変更 |
| ページロード時 | `receipt != null` の場合はボタンを初期非表示、プレビューを即描画 |

#### 領収書プレビュー（`showReceiptBox(data)` 関数）

| 表示項目 | データソース |
|---|---|
| 領収書番号（No.）| `data.receiptNo` |
| 発行日 | `data.issuedDate`（YYYY-MM-DD → YYYY年M月D日 に変換）|
| 宛名 | `data.addressee` または `data.patientName` または テンプレートの患者名 |
| 金額（税込）| `data.totalTaxInc` |
| 内消費税 | `data.totalTaxAmt` |
| 但し書き | `data.description`（デフォルト: 「施術費として」）|
| 明細 | `ITEMS` 配列（menuName × qty → subtotalInc）|
| 院名 | `data.clinicName` または `CLINIC_NAME` |

`showReceiptBox` は発行後の GAS レスポンスとページロード時の RECEIPT オブジェクト両方を処理できる正規化実装。

#### 印刷対応

- `@media print` で `.no-print` 要素（ヘッダー・ナビ・ボタン類）を非表示
- 白背景・ボックスシャドウなしの A4 フレンドリーレイアウト
- `window.print()` で印刷ダイアログを表示

#### clasp push

```
clasp push --force → 14ファイル push 完了（2026-04-28 11:22:57）
receipt.html が更新された
```

### 手動確認手順（再デプロイ後）

1. **発行前状態の確認**（billing 保存済みで receipt 未発行の visitKey）
   ```
   ?page=receipt&visitKey=SPV_20260428_P0001_004
   ```
   期待: 会計サマリー + 「領収書を発行する」ボタン

2. **「領収書を発行する」ボタン押下**
   期待: 20秒以内に領収書プレビューが表示。receiptNo（R_2026_0001 形式）が表示される

3. **印刷ボタン**
   期待: 印刷ダイアログが開く

4. **ページリロード（再表示）**
   期待: 発行済み状態で表示（発行ボタンは出ない、プレビューが即表示）

5. **二重発行テスト（発行済みの visitKey で再度「発行する」ボタンを押す）**
   期待: 「既に発行済みの領収書を表示しています。」メッセージ。既存 receiptNo が変わらない

6. **未会計の visitKey で receipt ページを開く**
   ```
   ?page=receipt&visitKey=SPV_20260428_P0001_001
   ```
   期待: 「この来院はまだ会計されていません」メッセージ + 「会計入力へ」ボタン

### Phase 4 Step 5 に残すこと

| 項目 | 内容 |
|---|---|
| patient-detail.html 更新 | 未会計の来院に「会計入力」ボタン、会計済みに「領収書」リンクを追加 |
| 患者一覧の未収額表示 | Payments との JOIN が必要（現在は `—` 固定）|
| 患者詳細サマリーの累計支払・未収残高 | Payments のリアルタイム集計（現在は `—` 固定）|

---

---

## 会計方針 v1（2026-04-28 確定）

**参照:** `docs/ACCOUNTING_POLICY_v1.md`

### 要約

| 項目 | 方針 |
|---|---|
| 来院・カルテ入力 | 施術事実を記録する（SelfPayVisits / SelfPayChart）|
| 会計入力 | MenuMaster から請求項目を選択する（SelfPayItems / Payments）|
| カルテ → 会計の自動変換 | **実装しない**（単価誤り・税区分誤り・外販対応の観点から）|
| 会計の確定 | 必ず人が確認してから「保存」ボタンを押す |
| 将来の候補自動セット | 検討は可。ただし確認・変更できる状態で提示し、自動保存は禁止 |

---

## ✅ Phase 4 Step 3 実機確認 PASS（2026-04-28）

| 確認項目 | 結果 |
|---|---|
| 会計入力画面表示 | ✅ PASS |
| MenuMaster 由来の UI 表示 | ✅ PASS |
| 保存成功（SPV_20260428_P0001_004）| ✅ PASS |
| receipt 画面への遷移 | ✅ PASS |
| 「会計済み・領収書未発行」状態表示 | ✅ PASS |
| 税込合計 ¥3,850 表示 | ✅ PASS |
| 支払方法: 現金 / 入金状態: 入金済 | ✅ PASS |
| 同 visitKey の billing 再表示で二重保存ブロック | ✅ PASS |
| 二重保存ブロック画面に「領収書を確認する」「患者詳細へ戻る」導線 | ✅ PASS |

---

## ✅ Phase 4 Step 3 完了（2026-04-28）

### billing-form.html 会計入力UI 実装内容

#### 機能一覧

| 機能 | 実装内容 |
|---|---|
| 患者サマリー | 患者ID / 氏名 / フリガナ / 電話番号 + 患者詳細へ戻るボタン |
| 来院情報 | 来院日 / 区分 / 主訴 / visitKey（モノスペース表示）|
| メニュー選択 | MenuMaster の有効フラグ=TRUE をカテゴリ別 `<optgroup>` で表示。選択時に税別単価を自動セット |
| 数量入力 | 数量変更で税込小計を即時再計算 |
| 行の追加 | 「＋ 行を追加」ボタンで明細行を動的に追加 |
| 行の削除 | 「×」ボタンで行削除（最低1行は保持）|
| 合計表示 | 税別合計 / 消費税（10%）/ 税込合計をリアルタイム更新 |
| 支払方法 | 現金 / カード / 電子マネー / 未収（後払い）|
| 入金状態 | 支払方法に連動して自動設定（現金・カード → 入金済、未収 → 未収）|
| 預かり金・お釣り | 現金のみ表示。預かり金入力でお釣りをリアルタイム計算 |
| メモ | 任意入力 |
| 保存処理 | `savePaymentWithItems(payload)` を呼び出し。20秒タイムアウト付き |
| 二重保存防止 | 保存成功後: フォーム全体を `disabled` にして再保存不可 |
| 成功表示 | 保存成功後: 税込合計 + 「領収書へ進む →」ボタン表示 |
| エラー表示 | GAS エラー / タイムアウト / 同期エラーを DOM に表示（alert 不使用）|
| 自動遷移 | 保存成功後に `receipt` ページへ自動遷移試行（iframe制限時はボタンで手動遷移）|
| メニューなし警告 | MENUS が空の場合に警告を表示 |

#### Payload 仕様

```javascript
{
  selfPayVisitKey: "SPV_20260428_P0001_001",
  items: [
    {
      menuCode:    "SELFPAY_CONTINUE20",
      menuName:    "継続標準施術",
      qty:         1,
      priceEx:     3500,
      taxCategory: "課税"
    }
  ],
  paymentMethod: "現金",      // 現金 | カード | 電子マネー | 未収
  paymentStatus: "入金済",    // 入金済 | 未収 | 一部入金（手動変更可）
  memo:          ""
}
```

GAS 側 `savePaymentWithItems` がこのペイロードを受け取り、
SelfPayItems / Payments に保存して SelfPayVisits.会計状態を更新する。

#### 二重保存防止 UI

| 状態 | 動作 |
|---|---|
| alreadyPaid=true（routing で検知）| Main.gs が renderError_ でブロック → billing-form.html は表示されない |
| 保存成功後 | フォーム全 input/select/button を disabled 化 → 再保存ボタンを押せなくなる |
| GAS 側でも二重チェック | Payments シートに同 visitKey が存在する場合 `{ ok: false, error: "既に会計済みです" }` を返す |

#### 税計算の分担

| 場所 | 役割 |
|---|---|
| クライアント（JS）| `Math.floor(priceEx × qty × 0.10)` でリアルタイム表示（概算）|
| GAS（savePaymentWithItems）| Settings の tax_rate / tax_rounding / tax_unit を参照して確定計算 |
| 注意 | Settings の端数処理設定により、UI 表示と実際の保存金額が1円ずれる可能性あり |

#### clasp push

```
clasp push --force → 14ファイル push 完了（2026-04-28 10:42:44）
billing-form.html が更新された
```

---

## ✅ Phase 4 Step 2 実機確認 PASS（2026-04-28）

### 確認内容

| 確認項目 | 結果 |
|---|---|
| billing ルート表示（visitKey=SPV_20260428_P0001_004）| ✅ PASS |
| 患者名「平山克士」表示 | ✅ PASS |
| 来院日「2026-04-28」表示 | ✅ PASS |
| 会計状態「未会計」表示 | ✅ PASS |
| 有効メニュー数「12件」表示 | ✅ PASS |
| receipt ルート（未会計メッセージ）| ✅ PASS |
| visitKey なしエラー | ✅ PASS |
| 存在しない visitKey エラー | ✅ PASS |
| Phase 3 退行なし（来院保存 / 患者詳細遷移 / タイムライン）| ✅ PASS |
| 同日採番 SPV_20260428_P0001_004 まで確認 | ✅ PASS |

---

## ✅ Phase 4 Step 2 完了（2026-04-28）

### JREC_SF01_Main.gs ルート追加 + 仮テンプレート作成

#### 変更内容

**JREC_SF01_Main.gs:**
- `doGet` に `vkParam` 抽出を追加（`e.parameter.visitKey || e.parameter.vk`）
- `buildPage_` の引数に `vkParam` を追加
- `billing` ルートを追加
- `receipt` ルートを追加

#### routing 仕様

| URL パラメータ | 動作 |
|---|---|
| `?page=billing&visitKey=SPV_...` | `getVisitForBilling()` → `billing-form.html` |
| `?page=receipt&visitKey=SPV_...` | `getReceiptByVisit()` → `receipt.html` |
| visitKey 未指定 | エラーページ |
| visit が見つからない | エラーページ |
| 既に会計済み（billing ルート）| 「会計済みです」メッセージ + 領収書リンク |

#### 作成したテンプレートファイル

**billing-form.html（仮 / Step 3 プレースホルダー）:**
- 患者名・来院キー・来院日・主訴・有効メニュー数を表示
- 「Step 3 実装予定」ノートを表示
- 「患者詳細に戻る」ボタン

**receipt.html（仮 / Step 4 プレースホルダー）:**
- 3パターンで分岐：
  1. `receipt != null` → 発行済み領収書プレビュー（receiptNo / 宛名 / 金額 / 内訳）+ 印刷ボタン
  2. `receipt == null && payment != null` → 会計済み・領収書未発行メッセージ + Step 4 ノート
  3. `payment == null` → 未会計メッセージ + 「会計入力へ」ボタン
- `@media print` で印刷不要要素を非表示

#### 手動確認手順（clasp push + 再デプロイ後）

**前提: WebApp を新バージョンで再デプロイしてから実施すること。**

1. **billing ルート（未会計の来院）**
   ```
   WebアプリURL?page=billing&visitKey=SPV_20260428_P0001_001
   ```
   期待: 患者名・来院日・有効メニュー数が表示され、「Step 3 実装予定」ノートが出る

2. **receipt ルート（未会計の来院 = payment なし）**
   ```
   WebアプリURL?page=receipt&visitKey=SPV_20260428_P0001_001
   ```
   期待: 「この来院はまだ会計されていません」メッセージ + 「会計入力へ」ボタン

3. **visitKey なし（エラー確認）**
   ```
   WebアプリURL?page=billing
   ```
   期待: 「visitKey が指定されていません」エラーページ

4. **billing ルート（存在しない visitKey）**
   ```
   WebアプリURL?page=billing&visitKey=SPV_99999999_P0000_999
   ```
   期待: 「来院記録が見つかりません」エラーページ

#### clasp push

```
clasp push --force → 14ファイル push 完了（2026-04-28 10:26:56）
billing-form.html / receipt.html が新規追加された
```

---

## ✅ Phase 4 Step 1 完了（2026-04-28）

### JREC_SF01_Billing.gs 実装内容

#### 実装した Public 関数

| 関数名 | 役割 |
|---|---|
| `getActiveMenus()` | MenuMaster から有効フラグ=TRUE のメニューを表示順で返す |
| `getVisitForBilling(visitKey)` | visit・患者・既存支払・既存領収書を返す（billing-form 表示用 + alreadyPaid 判定）|
| `savePaymentWithItems(payload)` | SelfPayItems 明細 + Payments 保存 + SelfPayVisits.会計状態 更新 |
| `issueReceipt(selfPayVisitKey)` | Receipts に保存し receiptNo を採番。二重発行防止で既存 receipt を返す |
| `getReceiptByVisit(selfPayVisitKey)` | receipt.html 用に visit/patient/items/payment/receipt/clinicName を集約 |

#### 実装した Private ヘルパー

| 関数名 | 役割 |
|---|---|
| `getSettingValue_(key)` | Settings シートから特定キーの値を取得 |
| `getTaxSettings_()` | tax_rate / tax_rounding / tax_unit を Settings から読む |
| `calcItemTax_(priceEx, qty, taxCategory, taxCfg)` | 明細1行の税額・税込小計を計算（item 単位）|
| `getMaxItemSeq_(visitKey)` | SelfPayItems の visitKey 最大連番を返す（重複防止）|
| `nextReceiptNo_()` | Settings の prefix/digits/reset から領収書番号を採番 |
| `updateVisitBillingStatus_(visitKey, status)` | SelfPayVisits の会計状態（col 9）を更新 |

#### 二重保存・二重発行の防止ロジック

| ケース | 対策 |
|---|---|
| `savePaymentWithItems` の二重保存 | 先頭で Payments を全件読み、同 visitKey が存在したら `{ ok: false, error: "既に会計済みです" }` を返す |
| `issueReceipt` の二重発行 | 先頭で Receipts を全件読み、同 visitKey が存在したら **既存レコードを返す**（新規 INSERT しない）|

#### 採番設計

| ID種別 | フォーマット | 例 |
|---|---|---|
| itemId | `SPI_{visitKey}_{3桁連番}` | `SPI_SPV_20260428_P0001_001_001` |
| paymentId | `SPP_{visitKey}` | `SPP_SPV_20260428_P0001_001` |
| receiptNo | `{prefix}_{YYYY}_{4桁連番}` | `R_2026_0001` |

#### ⚠️ Settings 不整合メモ

`receipt_no_prefix` の Settings 初期値は `"R"` → receiptNo が `R_2026_0001` になる。
設計書の例 `SPR_2026_0001` に合わせたい場合は、Settings シートの `receipt_no_prefix` を `"SPR"` に変更する。

#### 既存コードとの整合

| 項目 | 対応 |
|---|---|
| `getTargetSpreadsheet_()` | Setup.gs のものを使用 |
| `getPatientById()` | Patient.gs のものを使用 |
| `appendRunLog_()` | Patient.gs のものを使用（patientId に visitKey から抽出した P0001 を渡す）|
| `SHEET_NAMES` | Setup.gs の定数を使用 |

#### clasp push

```
clasp push --force → 12ファイル push 完了（2026-04-28 9:06:54）
JREC_SF01_Billing.gs が新規追加された
```

#### 次は Step 2

`JREC_SF01_Main.gs` に `billing` / `receipt` ルートを追加する。

```javascript
case "billing": {
  // getVisitForBilling(vk) → billing-form.html へ
}
case "receipt": {
  // getReceiptByVisit(vk) → receipt.html へ
}
```

---

## ✅ Phase 3 CLOSED（2026-04-28）

### 実機確認結果（最終・PASS）

| 確認項目 | 結果 |
|---|---|
| 保存成功メッセージ表示 | ✅ PASS |
| 「患者詳細へ戻る →」ボタン表示 | ✅ PASS |
| 保存ボタン復帰（保存中 → 元に戻る）| ✅ PASS |
| 患者詳細への遷移 | ✅ PASS |
| 来院履歴タイムライン表示 | ✅ PASS |
| 同日2件目採番（_002）| ✅ PASS |
| 同日3件目採番（_003）| ✅ PASS |
| visitKey 確認（3件）| ✅ SPV_20260428_P0001_001〜003 |

### Phase 3 解決済み問題サマリー

| 問題 | 原因 | 対応 |
|---|---|---|
| 保存ボタン押下後に「保存中」のまま停止 | alert() がブラウザブロック + session 8 修正が未デプロイ | alert 削除・showMsg DOM表示に統一・timeout追加 |
| 保存成功後に患者詳細へ遷移しない | GAS 非同期コールバック内では user activation が失われており、window.top.location.href が iframe 制限でブロック | 自動遷移フォールバック付き navigate() + 手動「患者詳細へ戻る」ボタン表示 |

**Phase 3 は全実機確認 PASS。CLOSED 扱い。**

---

## Phase 4 着手前整理（2026-04-28）

### Phase 4 概要

**目的:** 来院後の会計処理（メニュー選択・支払）と領収書発行を実装する。
**設計参照:** `docs/UI_DESIGN_v1.md` S04〜S05 / `docs/UI_LAYOUT_v1.md` S05・S07 / `docs/SHEET_DESIGN_v1.md` §7〜9

### Phase 4 フロー（設計確定）

```
患者詳細（未会計の来院）
  ↓ 「会計入力」ボタン
billing-form.html（S05）
  ↓ MenuMaster からメニュー選択 / 数量 / 支払方法 / 入金状態
  ↓ 保存 → SelfPayItems INSERT + Payments INSERT + SelfPayVisits.会計状態 UPDATE
receipt.html（S07）
  ↓ 領収書プレビュー表示
  ↓ 「発行して患者詳細へ戻る」→ Receipts INSERT
患者詳細（会計済に更新）
```

### Phase 4 MVP 実装単位（安全な分割）

#### Step 1 — `JREC_SF01_Billing.gs`（GAS バックエンド）

| 関数 | 役割 |
|---|---|
| `getActiveMenus()` | MenuMaster の有効フラグ=TRUE を表示順で返す |
| `getVisitForBilling(visitKey)` | 請求対象 visit の情報 + 患者名を返す（billing-form 表示用）|
| `savePaymentWithItems(payload)` | SelfPayItems + Payments を INSERT し、SelfPayVisits.会計状態 を更新 |
| `issueReceipt(payload)` | Receipts に INSERT し receiptId を返す |
| `getReceiptByVisit(visitKey)` | 発行済み領収書があれば返す（再発行・確認用）|
| `generateItemId_(visitKey)` | `SPI_visitKey_001` 形式で採番 |
| `generatePaymentId_(visitKey)` | `SPP_visitKey` を返す |
| `generateReceiptNo_(year)` | `SPR_YYYY_0001` 形式で年次連番採番 |

**二重保存防止:** `savePaymentWithItems` は既存 Payments.paymentId が存在する場合 `{ ok: false, error: "既に会計済みです" }` を返す。

#### Step 2 — `JREC_SF01_Main.gs` 更新

| 追加ルート | 画面 |
|---|---|
| `?page=billing&vk=SPV_...` | billing-form.html（会計入力）|
| `?page=receipt&vk=SPV_...` | receipt.html（領収書プレビュー・発行）|

#### Step 3 — `billing-form.html`（S05）

| 要素 | 内容 |
|---|---|
| ヘッダー | 患者名 + visitKey + 来院日（getVisitForBilling から）|
| 明細エリア | MenuMaster プルダウン + 数量 + 税別単価（自動）+ 税込小計（自動計算）|
| 明細追加ボタン | 行を動的に追加（JS）|
| 合計エリア | 税別合計 / 消費税 / 税込合計（リアルタイム再計算）|
| 支払エリア | 支払方法（現金/カード/電子マネー/未収）/ 入金状態（入金済/未収）/ メモ |
| 保存ボタン | `savePaymentWithItems` → receipt へ遷移 |
| 税計算式 | `floor(単価(税別) × 数量 × 0.10)` で消費税。税込 = 税別 + 税 |

#### Step 4 — `receipt.html`（S07）

| 要素 | 内容 |
|---|---|
| 領収書プレビュー | 患者名 / 金額（税込）/ 内消費税 / 但し書き / 院名 |
| 「印刷（新しいタブ）」| `window.print()` で印刷ダイアログ（CSS で印刷用レイアウト）|
| 「発行して患者詳細へ戻る」| `issueReceipt` → Receipts INSERT → 患者詳細へ遷移 |
| receiptNo 表示 | 発行後に表示。初回 = `SPR_YYYY_0001` 形式 |

#### Step 5 — `patient-detail.html` 更新

| 変更 | 内容 |
|---|---|
| タイムライン に「会計入力」ボタン追加 | 会計状態 = 未会計 の来院のみ表示。`?page=billing&vk=...` へ遷移 |
| タイムライン に「領収書」リンク追加 | 会計状態 = 会計済 の来院に表示。`?page=receipt&vk=...` へ遷移 |
| サマリーカードの累計支払 / 未収残高 | 現在は `—` 表示。Phase 4 実装後に実データ表示に切り替える |

### Phase 4 スコープ外（後回し）

| 項目 | 理由 | 対応フェーズ |
|---|---|---|
| DailySales 日次集計 | 複雑な集計ロジック。MVP 後回しで事故リスク低減 | Phase 5 |
| 未収回収処理（支払状態の更新）| 安全のため会計確認後に設計 | Phase 4 後半 |
| 領収書の再発行 | 初回発行が動いてから追加 | Phase 4 後半 |
| 会計明細の編集・削除 | 不可逆操作リスクあり。設計後に判断 | Phase 5 以降 |
| 患者一覧の未収額表示（実データ）| Payments との JOIN が必要。現在は `0円` 固定表示 | Phase 4 完了後 |

### Phase 4 リスク

| リスク | 対策 |
|---|---|
| 二重保存 | `savePaymentWithItems` の先頭で既存 Payments を確認し、重複なら return error |
| receiptNo 重複 | `generateReceiptNo_` でシート最終行から採番（GAS は基本シングルスレッド）|
| 金額計算ミス | GAS 側と JS 側で同じ式（`floor(税別 × 0.10)`）を使い、保存前に GAS で再計算して検証 |
| visit の会計状態が不整合 | `savePaymentWithItems` が成功した場合のみ `SelfPayVisits.会計状態` を更新する |

---

### 実機確認結果（2026-04-28 セッション10前）

| 項目 | 状態 |
|---|---|
| createVisitWithChart 保存 | ✅ **成功確認済み**（SPV_20260428_P0001_001 が作成された）|
| successHandler 到達 | ✅ **確認済み**（成功メッセージが画面上部に表示された）|
| 保存後の自動遷移 | ❌ **失敗** URL が `?page=visitForm&id=P0001` のまま動かない |
| 保存ボタンの復帰 | ❌ **失敗** 「保存中...」のまま re-enable されない |

**保存停止問題ではなく「保存成功後の画面遷移・UI復帰問題」に確定。**

---

### 修正内容（2026-04-28 セッション10）

#### 根本原因

GAS WebApp は `script.googleusercontent.com` の iframe 内でコンテンツを配信する。
`google.script.run` のコールバックは非同期で呼ばれるため、ユーザー操作（クリック）に紐づく **ユーザー活性化（user activation）** がすでに失われている。
さらに `setTimeout` で 1.2秒追加待機していたため、`window.top.location.href` への代入が
「cross-origin iframe からの非ユーザー操作ナビゲーション」としてブラウザにブロックされていた。

加えて、success パスでは `btn.disabled = false` が呼ばれていなかったため、
遷移に失敗するとボタンが「保存中...」のまま詰まっていた。

#### 実施した修正（visit-form.html）

| 変更 | 内容 |
|---|---|
| `setTimeout` + `window.top.location.href` を削除 | 遅延なし即時ナビゲーションに変更 |
| `navigate(url)` グローバル関数を追加 | `window.top → window.location` フォールバック付き |
| `goToDetail()` グローバル関数を追加 | `APP_URL + ?page=detail&id=PATIENT_ID` へ遷移 |
| 成功メッセージに「患者詳細へ戻る →」ボタンを追加 | onclick はユーザー活性化を生む → 確実に遷移できる |
| success パスで `btn.disabled = false` を追加 | 自動遷移が失敗しても詰まらない |

#### clasp push

```
clasp push --force → 11ファイル push 完了（2026-04-28 8:39:31）
```

---

### 次回実機確認手順（2026-04-28 セッション10）

**手順 1: WebApp を新バージョンで再デプロイ**（必須）
```
Apps Script エディタ
→「デプロイを管理」
→ 鉛筆アイコン（編集）
→ バージョン：「新しいバージョン」
→「デプロイ」
```

**手順 2: 保存テスト**
1. visit-form を開いて来院日・主訴を入力して「保存」
2. 画面上部に緑のメッセージが出るか確認
3. メッセージ内の「患者詳細へ戻る →」ボタンが表示されるか確認
4. ボタンをクリックして患者詳細に遷移できるか確認
5. 患者詳細の来院履歴に SPV_... が表示されるか確認

**期待動作（修正後）:**
- 保存成功 → 緑メッセージ + 「患者詳細へ戻る →」ボタンが表示
- 自動遷移が成功した場合: そのまま患者詳細ページへ切り替わる
- 自動遷移がブロックされた場合: ボタンをクリックすれば確実に遷移できる
- どちらの場合も保存ボタンは「保存して患者詳細へ戻る」に戻る

**Phase 3 完了条件:**
- [ ] 保存成功メッセージが表示される
- [ ] 「患者詳細へ戻る」で患者詳細に戻れる
- [ ] 患者詳細の来院履歴タイムラインに来院記録が表示される
- [ ] 2件目保存 → SPV_YYYYMMDD_P0001_002 が採番される

---

### 調査・修正内容（2026-04-28 セッション9）

#### 根本原因の仮説（コード調査結果）

| 仮説 | 根拠 | 確認方法 |
|---|---|---|
| **① session 8 修正が未デプロイ** | 15秒タイムアウトは session 8 で追加。旧バージョンが配信中 | 再デプロイして20秒タイムアウト表示が出るか確認 |
| **② `alert()` がブラウザでブロック** | GAS WebApp は script.googleusercontent.com から配信。モダンChromeはクロスオリジン iframe の alert をブロックする場合がある | alert を削除し showMsg（DOM表示）に一本化 |
| **③ google.script.run の同期例外** | try-catch がなかった。例外でタイマーも止まる可能性 | try-catch ラッパーを追加済み |
| **④ err.message が undefined** | catch の `err.message` がnullの場合に空文字で表示されず | `err.message || String(err)` に修正済み |

#### 実施した修正（2026-04-28）

**visit-form.html:**
- `window.onerror` ハンドラを追加（IIFE初期化エラーを DOM に表示）
- `google.script.run` の可用性チェックを追加（WebApp以外で開いた場合に即エラー表示）
- タイムアウトを 15秒 → 20秒 に延長（GAS コールドスタート対策）
- `alert()` を全て削除 → `showMsg()` による DOM 表示に一本化
- `google.script.run` 呼び出しを try-catch でラップ（同期例外を検知）
- `showMsg` / `clearMsg` に null チェックを追加

**JREC_SF01_Visit.gs:**
- `createVisitWithChart` の先頭に `Logger.log("[createVisitWithChart] START...")` を追加
- バリデーション通過後 / SS取得後にも Logger.log を追加
- catch ブロックを `err.message || String(err)` に修正（non-Error throws を安全処理）

#### clasp push 状況

```
clasp push --force → 11ファイル push 完了（2026-04-28 8:20:04）
```

---

### 次回実機確認手順（必ず実施）

**手順 1: WebApp を新バージョンで再デプロイ**
```
Apps Script エディタ
→「デプロイを管理」
→ 鉛筆アイコン（編集）
→ バージョン：「新しいバージョン」を選択
→「デプロイ」
```

**手順 2: F12 Console を開いて visit-form を操作**
1. Webアプリ URL を開く
2. F12 → Console タブを開く
3. 患者詳細 → 「＋ 来院・カルテ入力」
4. 来院日（今日）・主訴を入力して「保存」ボタンを押す

**手順 3: Console ログを確認**

| ログ | 意味 |
|---|---|
| `[visitForm] payload: {...}` が出る | JS は動いている。GAS呼び出しへ進む |
| `[visitForm] payload:` が出ない | IIFE 初期化エラー。window.onerror の表示を確認 |
| `[visitForm] success: {...}` | GAS 応答あり。res.ok が true なら成功、false ならエラーメッセージ表示 |
| `[visitForm] GAS failure: ...` | GAS 例外。エラーメッセージが DOM に表示される |
| 20秒後にタイムアウトメッセージ表示 | GAS が応答しない。GAS 実行ログを確認（次項） |
| `google.script.run が利用できません` | WebApp URL で開いていない（予備チェック） |

**手順 4: GAS 実行ログを確認（20秒タイムアウトが出た場合）**
```
Apps Script エディタ → 左メニュー「実行数」
→ createVisitWithChart の実行ログを開く
→ Logger.log の出力を確認
```

| Logger.log の到達点 | 意味 |
|---|---|
| `START patientId=P0001` が出ない | 関数が呼ばれていない（デプロイ問題） |
| `validation OK` まで出る | バリデーション通過。SS取得で失敗 |
| `ss OK id=...` まで出る | SS取得OK。appendRow で失敗 |
| `SelfPayVisits 保存完了` まで出る | SelfPayVisits OK。SelfPayChart で失敗 |
| `SelfPayChart 保存完了` まで出る | 両シート保存OK。Run_Log か return で失敗 |
| `ERROR: ...` が出る | catch に捕まったエラーメッセージを確認 |

---

## 本日終了状態（2026-04-27）

### 実機確認結果サマリー

| 項目 | 状態 |
|---|---|
| 患者一覧表示 | ✅ 確認済み |
| 新規患者登録 | ✅ 確認済み（P0001形式採番）|
| 患者詳細表示 | ✅ 確認済み |
| 「＋ 来院・カルテ入力」遷移 | ✅ 確認済み（iframe問題修正後）|
| visit-form 表示・入力 | ✅ 確認済み |
| 保存ボタン押下後の動作 | ❌ **「保存中」のまま停止**（未解決）|
| GAS保存エラー alert 表示 | ❌ 表示されない |
| 15秒タイムアウト表示 | ❌ 表示されない |

### 未解決: 保存処理が停止する問題

**現象:**
- 「保存して患者詳細へ戻る」を押すとボタンが「保存中...」になる
- そのまま止まる
- `alert('GAS保存エラー: ...')` が表示されない
- 15秒タイムアウトも発火しない
- 患者詳細へ戻らない

**特記事項:**
- alert も timeout も発火しないということは、`google.script.run.createVisitWithChart()` の呼び出し自体は実行されているが、`withSuccessHandler` / `withFailureHandler` のどちらも呼ばれていない可能性が高い
- または、`google.script.run` が完全に silent に失敗している

**次回調査項目:**

| 確認項目 | 方法 |
|---|---|
| ①デプロイが最新バージョンか | Apps Script → デプロイを管理 → バージョン番号を確認 |
| ②Apps Script 実行ログ | Apps Script エディタ → 実行数 / Stackdriver ログを確認 |
| ③ブラウザ Console | F12 → Console タブ → `[visitForm] payload:` が出ているか確認 |
| ④`google.script.run` が動いているか | `?page=ping` で doGet 疎通確認 |
| ⑤スプレッドシートへの書き込み権限 | 新しい患者登録（患者登録は成功するか？）で権限確認 |
| ⑥`createVisitWithChart` が存在するか | Apps Script エディタ → 関数一覧で `createVisitWithChart` が見えるか |

**次回再開時の方針:**
1. ブラウザ F12 Console を開いた状態で保存ボタンを押す
2. `[visitForm] payload:` のログが出るかを確認する
3. 出ない → JS の submit handler 自体が動いていない（HTML問題）
4. 出る → `[visitForm] success:` or `failure:` が出るかを確認する
5. 出ない → google.script.run の非同期処理が発火していない（デプロイ/権限問題）
6. 15秒後にタイムアウトも出ない → setTimeout 自体が動いていない（JS実行環境の問題）

---

## 今回の作業内容（2026-04-27 セッション8）

### 保存ボタン無反応バグ修正

| 原因 | 対応 |
|---|---|
| `createVisitWithChart` で `getTargetSpreadsheet_()` が try-catch の外にあり、失敗しても画面に出なかった | 全処理を1つの try-catch に統合 |
| `withFailureHandler` の `err` が文字列の場合に `.message` が undefined → `showMsg` が空文字を表示 | `err.message \|\| String(err)` でフォールバック。`alert()` も追加 |
| どちらのハンドラも呼ばれない場合に無反応 | 15秒タイムアウトを追加 |
| JS 内エラーが silent になる | successHandler/failureHandler 内を try-catch でラップ |
| デバッグ情報がなかった | `console.log(payload)` / `console.error` を追加 |

**修正ファイル:**
- `JREC_SF01_Visit.gs`: createVisitWithChart を全体 try-catch に。Logger.log を各ステップに追加。シート null チェック追加
- `visit-form.html`: 15秒タイムアウト。successHandler/failureHandler を try-catch でラップ。alert() による確実なエラー表示

### 実機確認手順（修正後）

1. Apps Script → 新バージョンデプロイ
2. visit-form で保存ボタン押下
3. ブラウザの開発者ツール（F12）の Console タブを確認
   - `[visitForm] payload:` のログが出ているか
   - `[visitForm] success:` または `[visitForm] GAS failure:` のログが出るか
4. 15秒以内に結果が出ない場合はタイムアウトメッセージが表示される
5. GASエラーの場合は alert ダイアログが必ず表示される

---

## 今回の作業内容（2026-04-27 セッション7）

### 白画面 根本修正 — iframe 遷移問題の解決

| 原因 | 対応 |
|---|---|
| GAS Webアプリは Google の iframe 内で動作する。`<a href>` クリックや `<form>` submit がページ全体ではなく iframe 内だけで遷移 → 白画面になる | 全ページの画面遷移を `window.top.location.href` に統一 |
| `<a href>` をそのまま使っていた | `<button type="button" onclick="window.top.location.href=...">` に変更 |
| `<form method="get">` での検索 | `onsubmit` で prevent + `window.top.location.href` に変更 |
| `getAppUrl_()` をテンプレート内から直接呼び出していた | doGet で `appUrl` を全テンプレートに渡し、JS変数 `APP_URL = "<?= appUrl ?>"` で参照 |

**修正ファイル一覧:**

| ファイル | 変更内容 |
|---|---|
| `JREC_SF01_Main.gs` | ping ルート追加。全テンプレートに `appUrl` を渡す。visitForm に Logger.log 追加 |
| `index.html` | nav ボタンを `<a href>` → `<button onclick="window.top.location.href=...">` に変更。不要なIIFEスクリプト削除 |
| `patient-list.html` | 検索フォームを onsubmit+window.top に。詳細ボタンを button onclick に |
| `patient-detail.html` | 全アクションボタンを window.top 方式に |
| `patient-form.html` | キャンセルボタンを window.top 方式に |
| `visit-form.html` | 戻るボタン・キャンセルを window.top 方式に。`append` 関数を `appendField` に改名 |

### 動作確認手順（修正後）

1. WebアプリURL + `?page=ping` → **"JREC-SF01 ping OK"** が表示されることを確認
2. 患者一覧 → 詳細ボタン → 患者詳細が表示される
3. 患者詳細 → ＋ 来院・カルテ入力 → visit-form が表示される（白画面にならない）
4. 来院・カルテを保存 → 患者詳細に戻り来院履歴が表示される

---

## 今回の作業内容（2026-04-27 セッション6）

### Phase 3 visit-form 白画面バグ修正

| 原因 | 修正内容 |
|---|---|
| `switch` 内で `var pt` を2回宣言（GAS V8 strict で挙動不安定）| `buildPage_()` 関数に分離。各 case を独立ブロック `{}` で囲み、変数名を `ptv` / `ptd` に分離 |
| `tmpl.evaluate()` のエラーが白画面になる | `evalTemplate_()` ヘルパーで個別 try-catch。エラーページを必ず表示するように変更 |
| `href` 属性内の `<?= expr ?>&id=<?= expr ?>` パターン | `<?= expr + '&id=' + id ?>` の単一式形式に統一し、HTML エンティティ問題を回避 |
| `id` / `patientId` パラメータ不一致への耐性 | doGet で `e.parameter.id || e.parameter.patientId` の両方を受け付けるように変更 |

**修正ファイル:**
- `JREC_SF01_Main.gs`: doGet を `buildPage_()` + `evalTemplate_()` + `renderError_()` に分離・堅牢化
- `visit-form.html`: href を式形式に統一
- `patient-detail.html`: href を式形式に統一
- `patient-list.html`: href を式形式に統一

### 再デプロイ手順（ユーザー実施）

```
Apps Script エディタ
→「デプロイを管理」
→ 鉛筆アイコン（編集）
→ バージョン：「新しいバージョン」を選択
→「デプロイ」
```

### 実機確認チェックリスト（修正後）

- [ ] 患者一覧 → 詳細 → 「＋ 来院・カルテ入力」をクリック
- [ ] 白画面ではなく visit-form.html が表示される
- [ ] 患者名・患者IDが上部に表示される
- [ ] 来院日（今日）・主訴を入力して保存できる
- [ ] 保存後に患者詳細に戻り、来院履歴に表示される

---

## 今回の作業内容（2026-04-27 セッション5）

| 作業 | 内容 |
|---|---|
| Phase 3 実装 | 来院・カルテ入力（S03+S04 統合画面） |
| clasp push | 11ファイルを Apps Script に反映済み |

### Phase 3 実装内容

| ファイル | 作成/更新 | 内容 |
|---|---|---|
| `JREC_SF01_Visit.gs` | 新規 | getVisitsByPatient / getChartsByVisitKeys / getVisitTimelineByPatient / createVisitWithChart / generateSelfPayVisitKey_ / getDefaultPractitioner_ |
| `visit-form.html` | 新規 | S03+S04 統合入力画面。来院情報 + カルテ記録。施術内容・使用機器のプリセットボタン付き |
| `JREC_SF01_Main.gs` | 更新 | visitForm ルーティング追加。detail ケースに timeline データを渡す |
| `patient-detail.html` | 更新 | サマリーカードに来院回数・最終来院日を実データから表示。来院・カルテ履歴タイムライン表示（最新は展開、過去は折りたたみ）。「＋ 来院・カルテ入力」ボタン追加 |

### Phase 3 設計決定事項

| 項目 | 決定内容 |
|---|---|
| UI統合 | S03 来院入力 + S04 カルテ入力 → 1画面に統合（visit-form.html）|
| 保存先分離 | 画面は1つ、保存先は SelfPayVisits + SelfPayChart の2シート |
| 担当者 | Phase 3 では「院長」固定。Settings の default_practitioner を参照（なければ "院長" にフォールバック）|
| selfPayVisitKey | SPV_YYYYMMDD_patientId_3桁連番（同日複数来院に対応）|
| chartId | selfPayVisitKey の SPV_ を SPC_ に置換（1対1対応）|

### 実機確認チェックリスト（ユーザー実施）

- [ ] Apps Script を新しいバージョンで再デプロイ
- [ ] 患者詳細から「＋ 来院・カルテ入力」ボタンで visit-form へ遷移
- [ ] 来院日・主訴を入力して保存
- [ ] SelfPayVisits に SPV_YYYYMMDD_P0001_001 が作成される
- [ ] SelfPayChart に SPC_YYYYMMDD_P0001_001 が作成される
- [ ] 患者詳細の来院履歴に表示される
- [ ] 2件目来院 → SPV_YYYYMMDD_P0001_002 になる
- [ ] 異なる日付の来院は別キーで採番される

---

## 今回の作業内容（2026-04-27 セッション4）

| 作業 | 内容 |
|---|---|
| Phase 2 MVP 実装 | 患者一覧・患者登録・患者詳細（入口のみ）の GAS Webアプリ |
| clasp push | 9ファイルを Apps Script に反映済み |

### 作成ファイル

| ファイル | 内容 |
|---|---|
| `JREC_SF01_Main.gs` | doGet() エントリ・ページルーティング・include/getAppUrl_ |
| `JREC_SF01_Patient.gs` | getPatients / getPatientById / createPatient / generateNextPatientId_ / appendRunLog_ |
| `index.html` | 共通ナビヘッダー（各ページに include('index') で埋め込む）|
| `patient-list.html` | S01 患者一覧画面（検索・未収強調・患者行クリック）|
| `patient-form.html` | S06 新規患者登録画面（google.script.run.createPatient）|
| `patient-detail.html` | S02 患者詳細入口（基本情報表示・Phase 3〜4 プレースホルダー付き）|
| `styles.html` | 共通CSS（全ページに include('styles') で埋め込む）|
| `appsscript.json` | webapp 設定追加（executeAs: USER_DEPLOYING / access: MYSELF）|

### 実装内容サマリー

| 機能 | 状態 |
|---|---|
| doGet() ルーティング（page パラメータ）| ✅ |
| 患者一覧表示（Patients シートから取得）| ✅ |
| 患者検索（氏名・フリガナ・患者ID・電話番号）| ✅ |
| 新規患者登録（Patients シートへ保存）| ✅ |
| patientId 自動採番（P0001 形式）| ✅ |
| Settings シートから prefix/digits を参照 | ✅ |
| Run_Log への操作記録 | ✅ |
| 患者詳細入口（基本情報表示）| ✅ |
| 未収強調表示（行の橙背景）| ✅（データあり次第有効）|
| 共通ヘッダー・CSS | ✅ |

### clasp push 済みファイル一覧

```
appsscript.json / index.html / JREC_SF01_Main.gs / JREC_SF01_Patient.gs
JREC_SF01_Setup.gs / patient-detail.html / patient-form.html
patient-list.html / styles.html
```

### Webアプリ デプロイ手順（ユーザー実施）

1. [Apps Script エディタ](https://script.google.com/d/1-1opRkAFbFQz96Uqlgy3sWjgAs_PKS_1Eg9Pz7_6geTFztHx_5APSj2G/edit) を開く
2. 右上「デプロイ」→「新しいデプロイ」
3. 種類: **ウェブアプリ**
4. 次のユーザーとして実行: **自分（dabu-pi）**
5. アクセスできるユーザー: **自分のみ**
6. 「デプロイ」をクリック → Webアプリ URL を確認

以降の更新は「デプロイを管理」→「既存のデプロイを編集」→バージョン「新しいバージョン」で更新する。

### 実機確認チェックリスト（ユーザー実施）

- [ ] Webアプリ URL を開いて患者一覧が表示される
- [ ] 「＋ 新規患者登録」から患者登録フォームが開く
- [ ] 氏名を入力して保存 → Patients シートに P0001 で記録される
- [ ] 一覧に戻ったとき登録した患者が表示される
- [ ] 2件目登録 → P0002 で採番される
- [ ] 検索ボックスで絞り込みができる
- [ ] 「詳細」ボタンで患者詳細画面が開く

---

## 今回の作業内容（2026-04-27 セッション3）

| 作業 | 内容 |
|---|---|
| runSetupAll 実行確認 | ユーザーが Apps Script で実行し、10シート作成を確認 ✅ |
| UIレイアウト設計書作成 | `docs/UI_LAYOUT_v1.md` — 7画面レイアウト・遷移図・設計方針・Phase 2 MVP範囲を定義 |

### 10シート確認済み（2026-04-27）

- [x] **runSetupAll() 実行済み**（ユーザーが Apps Script エディタから実行）
- [x] **10シート作成確認済み**

| シート名 | 状態 |
|---|---|
| Settings | ✅ |
| Patients | ✅ |
| SelfPayVisits | ✅ |
| SelfPayChart | ✅ |
| SelfPayItems | ✅ |
| Payments | ✅ |
| Receipts | ✅ |
| MenuMaster | ✅ |
| DailySales | ✅ |
| Run_Log | ✅ |

---

## 今回の作業内容（2026-04-27 セッション2）

`hirayama-jyusei-strategy` を参照し、以下を確定。

| 作業 | 内容 |
|---|---|
| MenuMaster 初期データ確定 | 主力3本・個別パーツ6種・評価入口3種・保留3本（計15メニュー）|
| 消費税設計確定 | 税率10%・税別管理・端数切り捨て・明細行ごと計算 |
| 患者ID設計確定 | P + 4桁連番（P0001〜）。jrecPatientId で保険JRECと任意紐づけ |
| シート列定義確定 | Settings / Patients / SelfPayVisits / SelfPayChart / SelfPayItems / Payments / Receipts / MenuMaster / DailySales / Run_Log（10シート）|
| SHEET_DESIGN_v1.md 作成 | `docs/SHEET_DESIGN_v1.md`（全シート定義・ID体系・MenuMaster初期データを記録）|

### ジム会員割引: 廃止確定

2026-04-25 院長判断で廃止済み。JREC-SF01 の MenuMaster に「ジム会員価格」列は持たない。通常価格（税別）のみで運用する。

---

## 今回の作業内容（2026-04-27 セッション1）

| 作業 | 内容 |
|---|---|
| フォルダー作成 | `gas-projects/jrec-sf01-selfpay/` を新規作成 |
| README.md 作成 | プロジェクト概要・JREC本体との違い・将来展開を記録 |
| PROJECT_STATUS.md 作成 | 本ファイル。進捗管理の起点 |
| 設計ドキュメント作成 | `docs/JREC-SF01_selfpay_chart_accounting_system_design_2026-04-27.md` |

---

## コード実装状態

| ファイル | 状態 | 内容 |
|---|---|---|
| `JREC_SF01_Setup.gs` | ✅ 作成済み | 全10シート初期セットアップスクリプト |
| `appsscript.json` | ✅ 作成済み | Apps Script マニフェスト（V8 / Asia/Tokyo）|
| `.clasp.json` | ❌ 未作成 | clasp 管理は次フェーズで設定 |

### clasp 設定（2026-04-27）

| 項目 | 値 |
|---|---|
| scriptId | `1-1opRkAFbFQz96Uqlgy3sWjgAs_PKS_1Eg9Pz7_6geTFztHx_5APSj2G` |
| Apps Script URL | https://script.google.com/d/1-1opRkAFbFQz96Uqlgy3sWjgAs_PKS_1Eg9Pz7_6geTFztHx_5APSj2G/edit |
| clasp push | ✅ 実施済み（2ファイル: appsscript.json + JREC_SF01_Setup.gs）|
| setupAll_ 実行 | ❌ 未実施（手動実行が必要）|

**⚠️ 注意: スクリプトの紐づきについて**

`clasp create --type sheets` は既存 SS への紐づけができず、**新規 Google Sheets（`13Sxfk1w3yU_XUjlah7C01cxaoIWQjWfTpXTKmNjjaRw`）が別途作成**された。
コード内の `openById(SPREADSHEET_ID)` が正しい対象 SS（`15O2AIWv1...`）を直接参照するため、**setupAll_() は正しく動作する**。

ただし対象 SS の「拡張機能 > Apps Script」メニューからはこのスクリプトにアクセスできない。
実行は Apps Script エディタ（上記 URL）から行う。

将来的に対象 SS へ container-bound で紐づけ直したい場合:
1. 対象 SS を開く → 拡張機能 > Apps Script
2. 生成された scriptId を確認（URL 中の `/d/SCRIPT_ID/`）
3. `.clasp.json` の `scriptId` を更新して `clasp push` し直す

### JREC_SF01_Setup.gs でできること

- `setupAll_()` を実行するだけで全10シートを一括セットアップ
- 再実行安全（既存データは保持）
- 各シート: ヘッダー色・列幅・ドロップダウン入力規則を自動設定
- Settings 初期値（12件）を自動投入
- MenuMaster 初期データ（15件）を自動投入
- 有効フラグ TRUE=薄緑 / FALSE=薄グレーで色分け

---

## JREC本体への影響

- **影響なし**
- `jyu-gas-ver3.1/` には一切変更を加えていない
- 既存JRECの clasp 設定・push・保険請求ロジックへの変更はない

---

## Dashboard反映

- **Dashboard反映対象外**（JREC-SF01 専用の Dashboard は未作成）
- 将来フェーズで自費売上ダッシュボードを作成予定

---

## フェーズ別ロードマップ

| Phase | 内容 | ステータス |
|---|---|---|
| Phase 0 | 初期設計ドキュメント作成 | **✅ CLOSED（2026-04-27）** |
| Phase 1 | スプレッドシート設計・GASセットアップ | **✅ CLOSED（2026-04-27）** |
| Phase 2 | GAS Webアプリ — 患者一覧・患者詳細・患者登録 | **✅ CLOSED（2026-04-27 実機確認済）** |
| Phase 3 | GAS Webアプリ — 来院入力・カルテ記録 | **✅ CLOSED（2026-04-28 実機確認済）** |
| Phase 4 Step 1 | JREC_SF01_Billing.gs — GAS 会計バックエンド | **✅ 実装完了（2026-04-28）** |
| Phase 4 Step 2 | JREC_SF01_Main.gs routing + 仮テンプレート | **✅ 実装完了・実機確認PASS（2026-04-28）** |
| Phase 4 Step 3 | billing-form.html — 会計入力画面 | **✅ 実装完了・実機確認PASS（2026-04-28）** |
| Phase 4 Step 4 | receipt.html — 領収書発行・プレビュー | **✅ 実装完了・実機確認PASS（2026-04-28）** |
| Phase 4 Step 5 | patient-detail.html 会計導線・サマリー実データ | **✅ 実装完了・実機確認PASS（2026-04-28）** |
| **Phase 4** | **会計入力・領収書・未収管理 MVP** | **✅ CLOSED（2026-04-28）** |
| Phase 4 Step 4 | receipt.html — 領収書プレビュー・発行 | 未着手 |
| Phase 4 Step 5 | patient-detail.html — 会計入力/領収書ボタン追加 | 未着手 |
| Phase 5 | タイムライン・VASグラフ・日次集計 | UI設計完了 / 実装未着手 |
| Phase 6 | Next.js / Supabase 化検討 | 未着手 |
| Phase 7 | 外販モデル化 | 未着手 |

---

## 確定済み設計方針サマリー

| 項目 | 決定値 |
|---|---|
| 消費税率 | 10% |
| 価格管理 | 税別（税込は計算で導出）|
| 端数処理 | 切り捨て（floor）|
| 税計算単位 | 明細行ごと |
| 患者ID形式 | P + 4桁連番（P0001〜）|
| 領収書番号 | R + 年度 + 4桁連番（SPR_2026_0001）|
| ジム会員割引 | 廃止（2026-04-25）|
| 主力KPI基準単価 | 継続標準施術 3,500円税別（月40回目標）|

---

## 次フェーズ着手条件（Phase 1 スプレッドシート作成）

- [x] シート列定義完了 → `docs/SHEET_DESIGN_v1.md`
- [x] MenuMaster 初期データ確定 → `docs/SHEET_DESIGN_v1.md`
- [x] 税・ID 方針確定
- [x] **GASセットアップスクリプト作成** → `JREC_SF01_Setup.gs`
- [x] **スプレッドシート作成済み** → ID: `15O2AIWv1OyZAXdCOWoz1-OxVukuFttHoZydsCDlYPX0`
- [ ] **スクリプトを SS に貼り付けて `setupAll_()` を実行する**（次の手作業）
- [ ] 実行後、各シートの状態を目視確認する
- [ ] MenuMaster 評価入口3メニューの有効フラグを院長に確認する

### 院長への確認依頼（Phase 1 開始前）

| # | 確認事項 | 影響 |
|---|---|---|
| 1 | 腰痛・首肩こり・膝 の初回評価3メニューを現在受付で使っているか | MenuMaster 有効フラグ |
| 2 | パーソナルトレーニング（SELFPAY_PT60）を現在提供しているか | MenuMaster 有効フラグ |
| 3 | 4回集中コースの価格を決めたか | TRAINING_4PASS 有効フラグ |

---

## 別PC再開状態（2026-04-27）

| 項目 | 状態 |
|---|---|
| ブランチ | `feature/auto-dev-phase3-loop` ✅ |
| git pull | 最新（Already up to date）✅ |
| `.clasp.json` | 別PCで復元済み（scriptId: `1-1opRkAFbFQz96Uqlgy3sWjgAs_PKS_1Eg9Pz7_6geTFztHx_5APSj2G`）✅ |
| `runSetupAll()` 実行 | **未確認** — ユーザーが Apps Script から実行する必要あり |
| 10シート作成 | **未確認** |
| MenuMaster 初期15件 | **未確認** |
| Phase 2 着手 | setup確認後に着手可能 |

### ユーザー確認依頼

以下を実施してください。

1. [Apps Script エディタ](https://script.google.com/d/1-1opRkAFbFQz96Uqlgy3sWjgAs_PKS_1Eg9Pz7_6geTFztHx_5APSj2G/edit) を開く
2. 関数プルダウンで `runSetupAll` を選択して「実行」をクリック
3. 権限承認が出たら許可する
4. [自費専用スプレッドシート](https://docs.google.com/spreadsheets/d/15O2AIWv1OyZAXdCOWoz1-OxVukuFttHoZydsCDlYPX0/edit) を開く
5. 以下を確認して結果を教えてください

| 確認項目 | 期待値 |
|---|---|
| シート数 | 10枚（Settings / Patients / SelfPayVisits / SelfPayChart / SelfPayItems / Payments / Receipts / MenuMaster / DailySales / Run_Log）|
| Settings シート | 税率10% / floor / 税別管理 など12件の初期値 |
| MenuMaster | 15メニュー（主力3本・個別パーツ6種・評価入口3種・保留3本）|

確認完了後、このファイルの以下チェックボックスを更新します。

---

## 変更履歴

| 日付 | 内容 |
|---|---|
| 2026-04-27 | プロジェクト初期設計ドキュメントを作成。コード実装なし。 |
| 2026-04-27 | `docs/SHEET_DESIGN_v1.md` 作成。MenuMaster初期データ・税設計・ID設計・全10シート列定義を確定。 |
| 2026-04-27 | `JREC_SF01_Setup.gs` 作成。全10シート初期セットアップスクリプト。スプレッドシートID確定（15O2AIWv1...）。 |
| 2026-04-27 | `.clasp.json` 作成・`clasp push` 実施。Apps Script に JREC_SF01_Setup.gs を反映済み。setupAll_() は未実行。 |
| 2026-04-27 | `runSetupAll()` ラッパー追加・clasp push。Apps Script エディタの関数選択で `runSetupAll` を選んで実行可能になった。 |
| 2026-04-27 | `docs/UI_DESIGN_v1.md` 作成。7画面・バックエンド関数一覧・Phase別ロードマップを定義。 |
| 2026-04-27 | 別PC再開。`.clasp.json` 復元。`runSetupAll()` 実行・10シート確認をユーザーに依頼。 |
| 2026-04-27 | `runSetupAll()` 実行確認・10シート作成確認済み。`docs/UI_LAYOUT_v1.md` 作成。UIレイアウト設計完了。 |
| 2026-04-27 | Phase 2 MVP 実装。JREC_SF01_Main.gs / JREC_SF01_Patient.gs / 5 HTML + styles.html 作成。clasp push 完了（9ファイル）。 |
| 2026-04-27 | Phase 3 実装。JREC_SF01_Visit.gs / visit-form.html 作成。patient-detail.html・JREC_SF01_Main.gs 更新。clasp push（11ファイル）。 |
