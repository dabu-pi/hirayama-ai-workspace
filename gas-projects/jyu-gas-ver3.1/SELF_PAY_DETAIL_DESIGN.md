# 自費明細設計書 — Phase 2 実装方針（改訂版）

作成: 2026-03-22（初版）
改訂: 2026-03-22（Rev.2 — D7/F7 表示専用化・自費明細ブロック正本化・delete&replace 方針確定）
対象: JREC-01（柔整毎日記録システム Ver3.1）+ JBIZ-04（接骨院経営戦略）

---

## ⚠️ Rev.2 変更点サマリー（初版からの差分）

| 項目 | 初版（Phase 1 → 2 拡張）| Rev.2（本ファイル・確定版）|
|---|---|---|
| D7 | 入力欄（自費メニュー選択）| **表示専用**（明細からの集計結果を表示）|
| F7 | 入力欄（金額手入力）| **表示専用**（明細小計の合計を表示）|
| 入力正本 | D7/F7 直接入力 | **自費明細ブロック**（ダイアログ）+ `自費明細` シート |
| 二重管理 | D7/F7 と明細の並存を計画 | **禁止**（明細が唯一の入力源）|
| 保存方式 | 追記のみ | **visitKey 単位の delete & replace** |

---

## 設計原則（Rev.2）

| 原則 | 内容 |
|---|---|
| 自費明細が唯一の正本 | D7/F7 は自費明細の集計表示。手入力は禁止 |
| 保険と自費は分けて保存 | 来院ヘッダ = 保険用集計値 + 自費集計値（フォールバック用）|
| 来院ヘッダの自費列は集計コピー | Phase 1 との連続性のため保持。正本は自費明細シート |
| visitKey 単位で delete & replace | 修正・再保存時は全行削除後に挿入。部分更新なし |
| 価格 snapshot 保存 | 保存時点の単価を記録。価格マスタ変更後も過去データ不変 |
| 複数メニュー対応を前提 | lineNo キーで設計。Phase 2 当面は 1来院 = 1行でOK |

---

## Phase 別役割分担（Rev.2）

### Phase 1（実機確認完了 2026-03-22）
- **入力**: 患者画面 行7〜8（B7=会計区分 / D7=自費メニュー入力 / F7=金額入力）
- **保存先**: 来院ヘッダ 7列のみ
- **D7/F7**: 入力欄（手動入力）
- **制約**: 1来院=1メニュー・自費明細シートなし

### Phase 2（本設計）
- **入力正本**: 患者画面の「自費明細入力ダイアログ」（HTML サイドパネル）
- **D7/F7**: 表示専用（GASが書き込み。手入力不可）
- **保存先**: `自費明細` シート（1来院×n行）+ 来院ヘッダ（集計コピー）
- **保存方式**: visitKey 単位 delete & replace

### Phase 3（将来）
- 慢性疼痛管理表への月次集計自動反映（JBIZ-04）
- 複数メニューUI の UX改善

---

## 患者画面 行7〜8 — Phase 2 後の配置

### Row 7（会計ヘッダ行）

```
A7: 「会計区分」（ラベル）
B7: [プルダウン入力] 保険のみ / 保険+自費 / 自費のみ  ← 引き続き入力
C7: 「自費メニュー」（ラベル）
D7: [表示専用] GAS が書き込む集計テキスト             ← Phase 2 で入力禁止
    └─ 1件: "手技50分"
    └─ 複数: "手技50分ほか1件"
    └─ なし: ""（空欄）
E7: 「自費金額（円）」（ラベル）
F7: [表示専用] GAS が書き込む小計合計                 ← Phase 2 で入力禁止
    └─ SUM(自費明細.subtotal WHERE visitKey=当該)
G7: 「会計合計」（ラベル）
H7: [数式] =IF(F7="",E3,E3+F7)  ← 変更なし（E3=窓口負担額）
```

### Row 8（フラグ・コード行）

```
A8: 「慢性候補」（ラベル）
B8: [チェックボックス入力]  ← 引き続き入力
C8: 「次回予約」（ラベル）
D8: [チェックボックス入力]  ← 引き続き入力
E8: 「新規区分」（ラベル）
F8: [プルダウン入力]         ← 引き続き入力
G8: 「明細入力」（ラベル）
H8: [状態表示セル] GAS が書き込む自費明細の保存状態
    └─ 0件: "未入力"
    └─ n件: "n件保存済"（例: "1件保存済", "2件保存済"）
    ※ ダイアログの起動は Drawing ボタンで行う（H8 はトリガーでない）
```

> **H8 の扱い（Phase 2 確定）:** Phase 1 では「メニューコード」入力欄だったが、Phase 2 では
> **状態表示セル**に転用する（Q6 確定）。GAS が "未入力" または "n件保存済" を書き込む。
> ダイアログの起動は Drawing ボタンで行い、H8 はトリガーとして使わない。
> UI.selfPay_menuCode = "H8" は引き続き使用するが、Phase 2 では状態書き込み先として機能する。

### H8 状態表示仕様（確定）

| 条件 | H8 表示値 | 設定タイミング |
|---|---|---|
| 自費明細 0件（初期・クリア後）| `"未入力"` | `updateH8Status_V3_(uiSh, 0)` / `clearSelfPayUI_V3_` / `setupSelfPayValidation_V3_` |
| 自費明細 1件以上 | `"n件保存済"`（例: "1件保存済"）| `updateH8Status_V3_(uiSh, n)` — n は保存行数 |

> **"0件保存済" は存在しない。** count=0 のとき必ず "未入力" を書き込む。
> `saveVisit_V3` の警告チェックは「H8 = "未入力" かつ F7 > 0」のときのみ発火する。

---

## 自費明細入力 ダイアログ設計（案P2-B 採用）

### 採用理由

| 案 | 方式 | 評価 |
|---|---|---|
| 案P2-A | 患者画面右側（列I〜N）にインライン入力欄 | △ 横スクロールが発生。行7〜8 が横に伸びて視認性低下 |
| **案P2-B** | **HTML サイドパネル / ダイアログ** | **◎ 行構造ゼロ変更。複数メニュー対応が自然** |
| 案P2-C | 下部ブロック（行53〜）に入力欄 | △ スクロール必要。Phase 0 と同じ問題 |

→ **案P2-B（ダイアログ）採用**

### ダイアログ UI 構成案

```
┌──────────────────────────────────────────────┐
│  自費明細入力  [ P001 / 2026-04-01 ]          │
├────────┬──────────────┬──────┬───────┬──────┤
│ # | メニュー名     │ 単価  │ 数量  │ 小計  │
├────────┼──────────────┼──────┼───────┼──────┤
│ 1 │ [プルダウン▼] │[数値]│  [1] │[自動]│
│ 2 │ [プルダウン▼] │[数値]│  [1] │[自動]│
│ + 行追加                                      │
├────────┴──────────────┴──────┴───────┴──────┤
│                        合計: ¥ 0,000          │
│              [ キャンセル ]  [ 保存して閉じる ] │
└──────────────────────────────────────────────┘
```

- メニュー名: 価格マスタから選択（手入力も可・allowInvalid=true）
- 単価: メニュー選択時に価格マスタから自動入力（手動変更可）
- 数量: デフォルト 1（変更可）
- 小計: 単価 × 数量（自動計算）
- 「保存して閉じる」: `saveSelfPayDetails_V3_` を呼び出し

---

## 自費明細シート設計

### シート名
`自費明細`（既存の `施術明細` とは別シート）

### 列定義（Rev.2 確定 — 14列）

| # | 列名（日本語） | キー名 | 型 | 内容 | 空欄可 |
|---|---|---|---|---|---|
| 1 | 明細ID | `selfPayDetailId` | 文字列 | `{visitKey}_L{lineNo}`（例: P001_2026-04-01_L1）| 不可 |
| 2 | visitKey | `visitKey` | 文字列 | 来院ヘッダ結合キー（患者ID_YYYY-MM-DD）| 不可 |
| 3 | 行番号 | `lineNo` | 数値 | 来院内の連番（1始まり）| 不可 |
| 4 | 施術日 | `treatDate` | 日付 | 来院ヘッダと同値 | 不可 |
| 5 | 患者ID | `patientId` | 文字列 | 来院ヘッダと同値 | 不可 |
| 6 | 会計区分 | `accountingType` | 選択肢 | 保険のみ / 保険+自費 / 自費のみ | ✅ |
| 7 | menu_id | `menuId` | 文字列 | M001 等（価格マスタ結合キー）| ✅ |
| 8 | メニュー名 | `menuName` | 文字列 | 手技50分 等（保存時 snapshot）| 不可 |
| 9 | 単価 | `unitPrice` | 数値 | 保存時点の価格 snapshot | 不可 |
| 10 | 数量 | `qty` | 数値 | デフォルト 1 | 不可 |
| 11 | 小計 | `subtotal` | 数値 | 単価 × 数量 | 不可 |
| 12 | 慢性候補フラグ | `chronicFlag` | boolean | 来院ヘッダ B8 と同値 | ✅ |
| 13 | 次回予約あり | `nextReservation` | boolean | 来院ヘッダ D8 と同値 | ✅ |
| 14 | 作成日時 | `createdAt` | 日時 | 保存時刻（JST）| 不可 |

> **Rev.2 変更点（初版 16列 → 14列）:**
> - `会員区分`（memberType）削除 → Phase 3 以降で検討
> - `新規区分`（firstVisitType）削除 → 来院ヘッダの F8 で管理で十分
> 単純化して正確性を上げる

### ユニークキー

```
selfPayDetailId = visitKey + "_L" + lineNo
例: "P001_2026-04-01_L1"（2行目: "P001_2026-04-01_L2"）
```

---

## データフロー（Phase 2）

```
[患者画面]
  B7: 会計区分（入力） ─────────────────────────────────────┐
  D7: 自費メニュー（表示）←─ GAS が書き込む                 │
  F7: 自費金額合計（表示）←─ GAS が書き込む                 │
  H7: 会計合計（数式）                                       │
  B8: 慢性候補（入力）────────────────────────────────────┐ │
  D8: 次回予約（入力）────────────────────────────────────┼─┼─→ [来院ヘッダ]
  F8: 新規区分（入力）                                       │ │
  H8: [ダイアログ起動]                                       │ │
         │                                                   │ │
         ▼                                                   │ │
  [自費明細ダイアログ]                                        │ │
  └─ 行1: メニュー名/単価/数量/小計                          │ │
  └─ 行2: メニュー名/単価/数量/小計 …                        │ │
         │                                                   │ │
         ▼ 「保存して閉じる」                                 │ │
  saveSelfPayDetails_V3_()                                   │ │
  ├─ 1. `自費明細` シートの visitKey 行を全削除              │ │
  ├─ 2. 新しい行を append（lineNo=1,2,...）                   │ │
  ├─ 3. subtotal を SUM → F7 に書き込み                     │ │
  ├─ 4. menuName 集計テキスト → D7 に書き込み                │ │
  └─ 5. 来院ヘッダ（selfPayAmount / selfPayMenuType）も更新 ─┘ │
                                                               │
  saveVisit_V3()                                               │
  └─ readSelfPayFromUI_V3_()                                   │
     ├─ B7/B8/D8/F8 を読む（B7 は入力値・D7/F7 は表示値を読む）│
     └─ appendHeaderRow_V3_() へ渡す ─────────────────────────┘
```

---

## 保存方式: visitKey 単位 delete & replace

### 実装関数（設計）

```javascript
/**
 * 自費明細を visitKey 単位で delete & replace する
 * @param {Sheet}  detailSh - `自費明細` シート
 * @param {string} visitKey - 対象の visitKey
 * @param {Array}  items    - [{menuId, menuName, unitPrice, qty}, ...]
 * @param {Object} context  - {treatDate, patientId, accountingType, chronicFlag, nextReservation, createdAt}
 */
function saveSelfPayDetails_V3_(detailSh, visitKey, items, context) {
  // Step 1: 既存行の全削除（visitKey 一致行）
  deleteSelfPayDetailRows_V3_(detailSh, visitKey);

  // Step 2: 新しい行を追記（lineNo = 1, 2, ...）
  items.forEach(function(item, idx) {
    var lineNo   = idx + 1;
    var detailId = visitKey + "_L" + lineNo;
    var subtotal = item.unitPrice * item.qty;
    appendSelfPayDetailRow_V3_(detailSh, {
      selfPayDetailId: detailId,
      visitKey:        visitKey,
      lineNo:          lineNo,
      treatDate:       context.treatDate,
      patientId:       context.patientId,
      accountingType:  context.accountingType,
      menuId:          item.menuId  || "",
      menuName:        item.menuName,
      unitPrice:       item.unitPrice,
      qty:             item.qty,
      subtotal:        subtotal,
      chronicFlag:     context.chronicFlag,
      nextReservation: context.nextReservation,
      createdAt:       context.createdAt,
    });
  });
}
```

### delete の安全設計

```javascript
function deleteSelfPayDetailRows_V3_(detailSh, visitKey) {
  // ヘッダ行(1行目)をスキップし、visitKey 列を探して一致行を後ろから削除
  // 後ろから削除することで行番号ずれを回避
  var data    = detailSh.getDataRange().getValues();
  var headRow = data[0];
  var vkCol   = headRow.indexOf("visitKey");  // 0-based
  if (vkCol < 0) return;

  for (var r = data.length - 1; r >= 1; r--) {
    if (data[r][vkCol] === visitKey) {
      detailSh.deleteRow(r + 1);  // Sheet は 1-based
    }
  }
}
```

---

## D7/F7 表示値の更新ロジック

```javascript
function updateSelfPayDisplay_V3_(uiSh, detailRows) {
  // detailRows: [{menuName, subtotal}, ...] (当該 visitKey の全行)

  // F7: 合計金額
  var total = detailRows.reduce(function(s, r) { return s + r.subtotal; }, 0);
  uiSh.getRange(UI.selfPay_amount).setValue(total > 0 ? total : "");

  // D7: メニュー集計テキスト
  var display = "";
  if (detailRows.length === 1) {
    display = detailRows[0].menuName;
  } else if (detailRows.length > 1) {
    display = detailRows[0].menuName + "ほか" + (detailRows.length - 1) + "件";
  }
  uiSh.getRange(UI.selfPay_menuType).setValue(display);
}
```

> **保存後クリア（clearSelfPayUI_V3_）:**
> D7/F7 は Phase 2 以降も clearSelfPayUI_V3_ でクリアする。
> ただし、クリアのタイミングは `clearAfterSaveUI_V3_`（別患者入力開始時）のまま。
> 保存直後は D7/F7 に確認用の表示を残す（Phase 1 と同じ方針）。

---

## 来院ヘッダ との連携（Phase 2）

```
来院ヘッダ（1行/来院）                      自費明細（n行/来院）
  visitKey          ←── 結合キー ──────→   visitKey
  自費売上額         ←── SUM(subtotal) ──   subtotal（各行）
  自費メニュー区分   ←── 先頭 menuName ──   menuName（lineNo=1）
  会計区分          ←── B7 の値 ────────   accountingType（各行）
  慢性候補フラグ     ←── B8 の値 ────────   chronicFlag（各行）
  次回予約あり       ←── D8 の値 ────────   nextReservation（各行）
  新規区分          ←── F8 の値
  自費メニューコード ←── lineNo=1 の menuId
```

> 来院ヘッダの自費列は JBIZ-04 との後方互換のために保持する。
> 自費明細が存在する場合は自費明細が正本。
> 自費明細が空の場合（Phase 1 期間の過去データ）は来院ヘッダをフォールバックとして扱う。

---

## 価格マスタ設計（設定シート）

設定シートの「価格マスタ」テーブル（Phase 2 で追加）:

| 列 | 内容 |
|---|---|
| menu_id | M001 / M002 等 |
| メニュー名 | 手技50分 / 運動療法 等 |
| 一般料金 | 5500 |
| asago会員料金 | 4700（Phase 3 で会員フラグ連携）|
| KPI集計対象 | TRUE |
| 確定状況 | 確定 / 仮 |

### 現在の確定メニュー（2026-03-22 確定）

| menu_id | メニュー名 | 一般料金 | 会員料金 | 状態 |
|---|---|---|---|---|
| M001 | 慢性ケア手技50分 | 5,500円 | 4,700円 | ✅ 確定 |
| M002 | 症状別初回評価 | 3,300円 | 2,800円（仮）| 仮 |
| M010 | パーソナルトレーニング60分 | 8,800円 | 7,480円 | ✅ 確定 |
| M011 | 4回集中コース | 35,200円 | 29,920円 | ✅ 確定 |

> **Phase 2 での単価参照:** ダイアログでメニュー選択時に一般料金を自動入力（手動変更可）。
> 保存時は入力値を snapshot として自費明細に記録（価格マスタ変更の影響を受けない）。

---

## コード変更方針（Phase 2 実装時）

### 変更が必要な箇所

| 関数 / 定数 | 変更内容 | 影響範囲 |
|---|---|---|
| `UI` const コメント | D7/F7 を「表示専用」に注記変更 | コメントのみ |
| `setupSelfPayValidation_V3_` | D7/F7 のデータ検証を削除、背景色を薄黄（表示専用）に変更 | Sheets UI |
| `readSelfPayFromUI_V3_` | D7 は表示値を読む（変更なし）/ F7 は表示値を読む（変更なし）| ロジック変更なし |
| `clearSelfPayUI_V3_` | D7/F7 clearContent 追加（Phase1では clearContent されていた — 確認要）| 要確認 |
| `saveVisit_V3` | `saveSelfPayDetails_V3_` 呼び出し追加 | 追加のみ |
| 新設: `saveSelfPayDetails_V3_` | delete & replace + D7/F7 書き込み | 新規 |
| 新設: `deleteSelfPayDetailRows_V3_` | visitKey 行の後方削除 | 新規 |
| 新設: `appendSelfPayDetailRow_V3_` | 1行追記 | 新規 |
| 新設: `updateSelfPayDisplay_V3_` | D7/F7 表示値更新 | 新規 |
| 新設: `openSelfPayDialog_V3` | ダイアログ HTML 起動（メニューから呼ぶ）| 新規 |
| HTML ファイル | `selfPayDialog.html` 新設 | 新規 |
| `onOpen` | 「自費明細入力」メニューを追加 | 追加 |
| `ensureDetailHeaders_V3` | `自費明細` シートヘッダ初期化を追加 | 追加 |

### 変更しない関数（影響なし）

- `appendHeaderRow_V3_` — selfPayInfo の渡し方は変わらない
- `Ver3_amounts.js` — 保険算定と完全独立
- `Ver3_transferData.js` — 申請書生成と完全独立

---

## テスト観点（Phase 2）

| # | テスト内容 | 確認ポイント |
|---|---|---|
| T2-1 | 自費1件（M001/5500円）保存 | 自費明細 1行 / D7="慢性ケア手技50分" / F7=5500 / 来院ヘッダ更新 |
| T2-2 | 自費2件（M001/M010）保存 | 自費明細 2行 / D7="慢性ケア手技50分ほか1件" / F7=14300 |
| T2-3 | 保存後 再保存（金額変更）| 旧行全削除 → 新行追記 / D7/F7 再計算 / 来院ヘッダ上書き |
| T2-4 | 価格マスタ変更後の過去データ確認 | 自費明細の unitPrice は保存時点の値のまま（snapshot 維持）|
| T2-5 | 会計区分=保険のみ・自費入力なしで保存 | 自費明細に行なし / D7空欄 / F7空欄 / 来院ヘッダ自費列空欄 |
| T2-6 | clearEntryUI_V3 実行後 | D7/F7 空欄 / B7/B8/D8/F8/H8 クリア / 自費明細シートは変化なし |
| T2-7 | 同一 visitKey で delete & replace 後の行番号ずれなし | 削除後に他の visitKey 行がずれていないこと |
| T2-8 | 自費明細シートが存在しない場合の挙動 | エラーダイアログ表示（シート未作成時）|

---

## JBIZ-04 KPI集計（Phase 2 以降）

| KPI | 集計クエリ | 集計元 |
|---|---|---|
| 月次手技自費売上 | SUM(subtotal) WHERE menuId=M001 AND month | 自費明細 |
| 月次全自費売上 | SUM(subtotal) WHERE month | 自費明細 |
| 自費のみ来店数 | COUNT DISTINCT(visitKey) WHERE accountingType=自費のみ | 自費明細 |
| 保険延べ来院数 | COUNT(visitKey) WHERE accountingType IN (保険のみ,保険+自費) | 来院ヘッダ |
| 慢性候補移行率 | COUNT(chronicFlag=TRUE) / COUNT(*) | 来院ヘッダ |
| 再来率 | COUNT(nextReservation=TRUE) / COUNT(*) | 来院ヘッダ |

---

## 実装ロードマップ（Rev.2）

```
Phase 1（完了 2026-03-22）
  ├─ 来院入力: 行7〜8（B7/D7/F7/B8/D8/F8/H8）✅
  ├─ 保存先: 来院ヘッダ 7列 ✅
  └─ D7/F7: 入力欄（手動入力） ✅

Phase 2（実装準備完了 2026-03-22 / 実装: 2026-04-01 以降）
  ├─ 設定シートに「価格マスタ」テーブル追加（Sheets 手動）
  ├─ `自費明細` シート作成・ヘッダ初期化（ensureDetailHeaders_V3 拡張）
  ├─ D7/F7 を表示専用化（setupSelfPayValidation_V3_ 修正）
  ├─ HTML ダイアログ（selfPayDialog.html）新設
  ├─ saveSelfPayDetails_V3_ / deleteSelfPayDetailRows_V3_ / appendSelfPayDetailRow_V3_ 実装
  ├─ updateSelfPayDisplay_V3_ 実装（D7/F7 書き込み）
  ├─ saveVisit_V3 に saveSelfPayDetails_V3_ 呼び出し追加
  └─ onOpen に「自費明細入力」メニュー追加

Phase 3（将来）
  ├─ 慢性疼痛管理表への月次集計自動反映（JBIZ-04）
  └─ 会員区分（asago会員）対応
```

---

## 未解決論点・要確認事項

| # | 論点 | 現在の方針 | 確認タイミング |
|---|---|---|---|
| Q1 | ダイアログ vs onSelectionChange vs Drawing ボタン | ✅ **確定: Drawing ボタン起動（案P2-B）**| 実装完了 |
| Q2 | 保存順序: ダイアログ保存 → saveVisit の順か / 同時か | ✅ **確定: ダイアログ保存 → saveVisit の順（独立した操作）**。saveVisit 時に未保存警告あり | 実装完了 |
| Q3 | 既存保存（saveVisit_V3）時に自費明細ダイアログを未起動だった場合 | ✅ **確定: checkSelfPayWarningBeforeSave_V3_ で confirm 警告。キャンセル可** | 実装完了 |
| Q4 | 既往 Phase 1 データ（自費明細シートなし）の扱い | フォールバック（来院ヘッダの selfPayAmount/MenuType を参照）| Phase 3 移行時 |
| Q5 | `自費明細` シートのヘッダ言語（日本語 vs キー名）| ✅ **確定: 日本語ヘッダ（他シートと統一）。visitKey 列は "visitKey" のみ英字** | 実装完了 |
| Q6 | H8 の用途変更（メニューコード → ダイアログ起動トリガー）| ✅ **確定: H8 = 状態表示セル（"未入力" / "n件保存済"）。起動はDrawingボタン** | 実装完了 |

---

## 会計区分による保険処理ゲート（Phase 2 バグ修正 — 2026-03-22）

> **不具合:** 自費のみ選択時も保険継続 case が保存されレセプト事故リスクがあった。
> **修正:** `saveVisit_V3` に `isInsuranceVisit` フラグを追加し、保険処理を完全ゲートした。

### 保存仕様（3パターン確定）

| 会計区分 | 保険ケース保存 | 保険算定 | ヘッダ保険列 | 施術明細 | 自費明細 |
|---|---|---|---|---|---|
| 保険のみ | ✅ あり | ✅ あり | 通常値 | ✅ あり | ❌ なし |
| 保険+自費 | ✅ あり | ✅ あり | 通常値 | ✅ あり | ✅ あり |
| **自費のみ** | **❌ スキップ** | **❌ スキップ** | **全0** | **❌ スキップ** | **✅ あり** |
| 空欄（後方互換）| ✅ あり | ✅ あり | 通常値 | ✅ あり | ✅ あり |

### クロスチェック警告（新設 `checkAccountingTypeCrossWarning_V3_`）

| 条件 | 警告内容 |
|---|---|
| 自費のみ + 保険ケースデータあり | confirm: "保険ケースは保存しません。続行しますか？" |
| 保険のみ + H8 = "n件保存済" | confirm: "自費明細が保存済みです。来院ヘッダの自費金額は0になります。" |

---

## ステータス

- [x] Phase 1 実装完了（2026-03-22）
- [x] Phase 1 実機確認完了 T1〜T6（2026-03-22）
- [x] Phase 2 設計 Rev.2 完了（2026-03-22）— 本ファイル
  - D7/F7 表示専用化・ダイアログ方式・delete&replace・テスト観点
- [x] **Phase 2 コード実装完了（2026-03-22）**
  - `SHEETS.selfPayDetail: "自費明細"` を SHEETS const に追加
  - `ensureSelfPayDetailSheetInternal_` / `ensureSelfPayDetailSheet_V3`（公開メニュー用）
  - `deleteSelfPayDetailRows_V3_` — visitKey 単位後方削除
  - `appendSelfPayDetailRow_V3_` — 1行追記（14列）
  - `readSelfPayDetailsForVisit_V3_` — visitKey 一致行取得
  - `saveSelfPayDetails_V3_` — delete & replace + D7/F7/H8 更新
  - `updateSelfPayDisplay_V3_` — D7/F7 書き込み
  - `updateH8Status_V3_` — H8 状態表示
  - `getSelfPayMenuMaster_V3` — 設定シート/フォールバック価格マスタ取得
  - `openSelfPayDialog_V3` — ダイアログ起動公開関数（Drawing ボタン割り当て先）
  - `getCurrentVisitKey_V3` — ダイアログ初期化ブリッジ
  - `saveSelfPayDetailsFromDialog_V3` — ダイアログから呼ぶ保存関数
  - `checkSelfPayWarningBeforeSave_V3_` — saveVisit 前の警告チェック
  - `clearSelfPayUI_V3_` 修正: H8 を "未入力" にリセット
  - `setupSelfPayValidation_V3_` 修正: D7/F7 表示専用化・H8 状態表示セル化
  - `selfPayDialog.html` 新規作成（価格マスタプルダウン・複数行入力・合計計算）
  - `onOpen` 更新: 「自費明細入力」「自費明細シート初期化」メニュー追加
  - `saveVisit_V3` 更新: `checkSelfPayWarningBeforeSave_V3_` 呼び出し追加
  - `clasp push` 完了（2026-03-22）
- [x] **会計区分ゲート実装完了（2026-03-22 — 実機確認不具合の即時修正）**
  - `isInsuranceVisit` フラグ追加: 自費のみ → 保険処理全スキップ
  - `checkAccountingTypeCrossWarning_V3_` — 矛盾検出+confirm警告
  - `buildZeroInsuranceAmounts_V3_` — 全ゼロ金額オブジェクト
  - `caseKey`/`caseIndex`/`caseKey2` を null-safe に修正
  - `clasp push` 完了（2026-03-22）
- [ ] 価格マスタ テーブル追加（設定シート手動）← 院長が設定シートに追加
- [ ] `自費明細` シート作成（GASメニュー「自費明細シート初期化」を1回実行）
- [ ] Drawing ボタンをシートに設置して `openSelfPayDialog_V3` を割り当て（手動）
- [ ] `setupSelfPayValidation_V3`（会計ブロック自動生成）を再実行して D7/F7 表示専用化を適用（手動）

## Drawing ボタン設置手順（院長の手動作業）

1. スプレッドシートの患者画面シートを開く
2. メニュー「挿入」→「図形描画」を選択
3. 図形（角丸四角形など）を描き、ラベルに「自費明細入力 ▶」と入力
4. 「保存して閉じる」
5. シート上のボタン図形を右クリック →「スクリプトを割り当て」
6. 関数名 `openSelfPayDialog_V3` を入力して「確定」
7. メニュー「柔整ツール」→「会計ブロック自動生成（患者画面 行7〜8）」を実行
   （D7/F7 が薄黄背景の表示専用セルになり、H8 が「未入力」と表示される）

---

## Phase 2 実機確認状況（2026-03-22 時点）

> **次回再開位置: T2-3 から**

### 完了済みテスト

| # | テスト内容 | 実機確認結果 |
|---|---|---|
| T2-1 | 自費1件（M001/5500円）保存 | ✅ **OK** — 自費明細1行 / D7=メニュー名 / F7=5500 / H8="1件保存済" / 来院ヘッダ更新 確認 |
| T2-2 | 自費複数件保存 | ✅ **OK** — 自費明細2行 / D7="〇〇ほか1件" / F7=合計 / H8="2件保存済" 確認 |
| T2-9 | 自費のみ + 保険継続 case あり | ✅ **OK（部分）** — confirm 警告: OK / 保険算定なし: OK / 施術明細保険記録なし: OK / **来院ヘッダに1行追記: あり（仕様として許容）** |

### 未実施テスト

| # | テスト内容 | 実装根拠（コードレビュー済）|
|---|---|---|
| **T2-3**（次回開始）| 保存後 再保存（金額変更）| `deleteSelfPayDetailRows_V3_` で一括削除後 `appendSelfPayDetailRow_V3_` で再追記。D7/F7/H8 も再計算 |
| T2-4 | 価格マスタ変更後の過去データ確認 | `unitPrice` は保存時点の snapshot。マスタ変更の影響なし |
| T2-5 | 会計区分=保険のみ・自費なし | H8="未入力" かつ F7 空欄 → 警告なしで saveVisit 続行 |
| T2-6 | clearEntryUI_V3 実行後 | D7/F7 clearContent / H8="未入力" / 自費明細シートは変化なし |
| T2-7 | delete & replace 後の他行ずれなし | 後方ループ削除（`r = data.length-1` から）でインデックスずれなし |
| T2-8 | 自費明細シートが存在しない場合 | `ensureSelfPayDetailSheetInternal_` が `insertSheet` で自動作成 |
| T2-10 | 自費のみ + 保険データなし | 警告なし / 自費明細のみ保存 / 来院ヘッダ保険列=0 |
| T2-11 | 保険のみ + H8="1件保存済" | confirm 警告 / OK後: 保険通常保存 / ヘッダ自費金額=0 |
| T2-12 | 保険+自費（通常ケース）| 両方保存 / ヘッダ保険列+自費列ともに正常値 / 来院ケースあり |

### 保留中の必須修正（Phase 2 完了前に対応必須 — 後回し不可）

> **レセプト事故防止の観点から、Phase 2 完了宣言の前に必ず対応する。**

**📌 `Ver3_transferData.js` の保険申請対象フィルタ確認・修正**

| 項目 | 内容 |
|---|---|
| **問題** | 自費のみ来院でも来院ヘッダに1行追記される（仕様として許容）。ただし転記データ生成時に `会計区分=自費のみ` の行が申請対象に含まれていないことを未確認 |
| **現状** | `Ver3_transferData.js` に `accountingType` 参照・フィルタが存在しないことをコードレビューで確認済み |
| **リスク** | 自費のみ来院が申請書に混入すると不正請求になる可能性がある |
| **安全ルール候補** | 保険申請対象 = `会計区分 ∈ { 保険のみ, 保険+自費 }` **かつ** `保険請求額（claimPay）> 0` の行のみ |
| **対応フロー** | ① `Ver3_transferData.js` の来院ヘッダ集計箇所を特定 → ② accountingType フィルタを追加 → ③ 自費のみ来院が申請書に含まれないことを実機確認（T2-9 の発展確認として）|
| **担当** | Claude Code（次セッション）|

### 改善候補（Phase 2 必須ではない）

| # | 内容 | 対応時期 |
|---|---|---|
| I-1 | 来院ヘッダ列順の整理: 現状は「保険列 / 保険列 / 自費列 / 保険列(caseKey2)」が混在して視認性が低い。保険関連 → 自費関連 → 経営KPI の順に統一したい | Phase 3 以降 |
