# JREC-01 前回施術再読込 — 最小安全仕様設計メモ

作成日: 2026-04-23  
対象ブランチ: `feature/auto-dev-phase3-loop`  
ステータス: **設計メモのみ（実装前）**

---

## 0. 調査前提：既存の「前回引き継ぎ」機能の確認

設計に入る前に、既存コードで何が**すでに対応済み**かを明確にする。

| 機能 | 関数名 | 対象 | 状態 |
|---|---|---|---|
| 自動引継ぎ | `autofillFromPreviousVisit_V3` | 保険算定側（部位・傷病・受傷日・治療法・区分） | **実装済み** |
| 当日再読み込み | `reloadVisitToUI_V3` | 同日保存済み記録の復元（閲覧・転帰更新用） | **実装済み** |
| 前回来院日取得 | `findLastVisitDateInHeader_` | 来院ヘッダから同一患者の直前来院日を返す | **実装済み** |
| 自費明細読み取り | `readSelfPayDetailsForVisit_V3_` | visitKey 指定で自費明細一覧を返す | **実装済み** |
| **自費明細の前回引き継ぎ** | （なし） | 前回の自費メニュー・数量を今回のダイアログ初期値にする | **未実装 ← ここが空白** |

### 結論

保険算定側（部位・傷病・治療法）の前回引き継ぎは `autofillFromPreviousVisit_V3` が担っており、
既に動作している。

**今回新たに実装が必要なのは「自費明細の前回引き継ぎ」のみ。**  
保険算定側には触れない。

---

## 1. 識別子・シート構造の前提

### 識別子

| 識別子 | 定義 | 例 |
|---|---|---|
| `patientId` | 患者ID（患者マスタの主キー） | `P001` |
| `visitKey` | 来院キー = `patientId + "_" + yyyy-MM-dd` | `P001_2026-04-23` |
| `caseKey` | エピソードID（初検日ベース・エピソード中は不変） | `P001_2026-01-10` |

### 保存先シート

| シート定数 | シート名 | 内容 |
|---|---|---|
| `SHEETS.header` | `来院ヘッダ` | 来院単位のサマリ。`visitKey` / `patientId` / `treatDate` / `lastVisit` など |
| `SHEETS.selfPayDetail` | `自費明細` | 自費の行明細。`visitKey` / `menuId` / `menuName` / `unitPrice` / `qty` / `subtotal` など |
| `SHEETS.cases` | `来院ケース` | 保険算定側の部位・傷病・受傷日・治療法 |
| `SHEETS.ui` | 患者画面 | 入力UI。B2=患者選択、B4=来院日、B7=会計区分 |

### 自費明細の列定義（`SELF_DETAIL_COLS`）

| 列名定数 | シート列名 | 引き継ぎ対象 |
|---|---|---|
| `detailId` | 明細ID | ❌ 新規生成 |
| `visitKey` | visitKey | ❌ 今回の値 |
| `lineNo` | 行番号 | ❌ 新規採番 |
| `treatDate` | 施術日 | ❌ 今回の日付 |
| `patientId` | 患者ID | ❌ 同じだが新規 |
| `accountingType` | 会計区分 | ❌ UI の B7 から取得 |
| `menuId` | menu_id | ✅ **引き継ぐ** |
| `menuName` | メニュー名 | ✅ **引き継ぐ（表示用）** |
| `unitPrice` | 単価 | ❌ マスタから取り直す |
| `qty` | 数量 | ✅ **引き継ぐ** |
| `subtotal` | 小計 | ❌ 今回の単価×数量で再計算 |
| `chronicFlag` | 慢性候補フラグ | ❌ 今回入力で決める |
| `nextReservation` | 次回予約あり | ❌ 今回入力で決める |
| `createdAt` | 作成日時 | ❌ 新規タイムスタンプ |

---

## 2. 「前回施術」の判定候補と選択

### 候補一覧

| 候補 | 判定方法 | 使用関数 | 適否 |
|---|---|---|---|
| **A. 同一患者の直近来院** | 来院ヘッダの全行から `patientId` 一致 & 当日より前の最新日 | `findLastVisitDateInHeader_` | ✅ **採用** |
| B. 同一 caseKey の直近 | エピソード内直前来院（30日制限あり） | `findLatestCaseRowDateInEpisode_` | △ 保険算定側専用。自費明細はエピソード横断でよく不適切 |
| C. 自費明細シートで直近 | 自費明細から `patientId` 一致の最新 `treatDate` を検索 | なし（新規実装が必要） | △ 正確だが複雑。A で代替可能 |

### 採用: A（同一患者の直近来院 = `findLastVisitDateInHeader_`）

- **理由**: `findLastVisitDateInHeader_` が既に実装済みで信頼できる
- エピソード制限なし（自費明細はエピソードを跨いで引き継いでよい）
- 保険算定側の `autofillFromPreviousVisit_V3` と判定軸を分離できる

---

## 3. 最小安全仕様

### 3-1 機能概要

```
関数名（案）: loadPrevSelfPayToDialog_V3()
メニュー登録先: 柔整管理 > 自費明細入力（サブメニューに追加）
トリガー: 手動（人間が「前回引き継ぎ」を選択したとき）
```

### 3-2 処理フロー

```
① UI から patientId・treatDate を取得
     ↓
② 未選択チェック（patientId・treatDate が空なら中断+メッセージ）
     ↓
③ findLastVisitDateInHeader_ で直前来院日 prevDate を取得
     prevDate がなければ「前回の来院記録がありません」で中断
     ↓
④ prevVisitKey = buildVisitKey_(patientId, prevDate) を生成
     ↓
⑤ readSelfPayDetailsForVisit_V3_ で prevVisitKey の自費明細 prevItems を取得
     prevItems が空なら「前回の自費明細がありません」で中断
     ↓
⑥ 今回の自費明細（現在の visitKey）に既存データがあるか確認
     → あれば「今回の自費明細に既に入力があります。上書きしますか？」確認ダイアログ
     → キャンセルなら中断
     ↓
⑦ prevItems から menuId・menuName・qty のみ取り出してダイアログ初期値を構築
     単価はマスタから取り直す（getSelfPayMenuMaster_V3 経由）
     ↓
⑧ openSelfPayDialog_V3 を呼び出し、初期値セット済みのダイアログを開く
     ↓
⑨ 人間が確認・修正後に保存ボタンを押す（保存は既存の saveSelfPayDetailsFromDialog_V3 が担う）
```

### 3-3 上書き事故を防ぐ方法

| リスク | 対策 |
|---|---|
| 今回の自費明細が既入力なのに上書き | ⑥の確認ダイアログ（OK/キャンセル）。キャンセルで完全中断 |
| 前回の古い単価が今回に引き継がれる | 単価は引き継がない。マスタから取り直す |
| 前回のフラグ（慢性・予約）が引き継がれる | `chronicFlag` / `nextReservation` は引き継がない。今回入力で決める |
| 誤った患者に引き継ぐ | `patientId` を `prevVisitKey` 生成に使うため患者を跨がない |
| 保存まで自動で行われる | ダイアログを開くだけ。保存は人間の確認後 |

---

## 4. 対象外（意図的除外）

| 項目 | 除外理由 |
|---|---|
| 部位・傷病・受傷日・治療法の引き継ぎ | `autofillFromPreviousVisit_V3` が既に担当 |
| 区分（初検/再検/後療）の引き継ぎ | GAS の制度ロジックが判定。引き継ぎ不可 |
| 単価の引き継ぎ | 単価は常にマスタから取り直す。価格改定に追従するため |
| 小計の引き継ぎ | 単価×数量で再計算するため不要 |
| 会計区分の引き継ぎ | 来院ごとに決まる。UI の B7 から取得 |
| `chronicFlag` / `nextReservation` の引き継ぎ | 来院ごとの実態で決まる |
| Web UI での呼び出し | 初版は Sheets/GAS 側のみ。Web UI 対応は別フェーズ |
| 複数来院前の選択 | 初版は「直前1回」のみ。「N回前を選ぶ」は将来フェーズ |

---

## 5. 既存コードの再利用計画

| 再利用元 | 用途 |
|---|---|
| `findLastVisitDateInHeader_` | 直前来院日の取得（変更不要） |
| `buildVisitKey_` | prevVisitKey の生成（変更不要） |
| `readSelfPayDetailsForVisit_V3_` | 直前の自費明細取得（変更不要） |
| `getSelfPayMenuMaster_V3` | 単価の取り直し（変更不要） |
| `openSelfPayDialog_V3` | ダイアログ起動（初期値渡し方の拡張が必要か要確認） |
| `saveSelfPayDetailsFromDialog_V3` | 保存（変更不要） |

---

## 6. 未解決論点

| 論点 | 内容 | 優先度 |
|---|---|---|
| ダイアログへの初期値渡し方 | `openSelfPayDialog_V3` は現在 UI.patientId/treatDate ベースで初期化している。初期値（前回 items）をダイアログに渡す方法を確認する必要あり | 高（実装着手前に調査） |
| 前回明細がある場合の既存データ確認方法 | 今回 visitKey で既に自費明細があるか `readSelfPayDetailsForVisit_V3_` で確認する（新規ロジック不要） | 中 |
| メニューが廃止・変更されていた場合 | 前回の `menuId` が現在のマスタに存在しない場合の扱い（スキップ or 警告）を決める | 中 |

---

## 7. 次のアクション

1. `openSelfPayDialog_V3` のシグネチャ確認 → 初期値（prevItems）の渡し方を調査
2. 論点①が解消したら `loadPrevSelfPayToDialog_V3` を実装
3. 実装後にスプレッドシート上で手動テスト（患者1名・2回来院のシナリオ）
4. 問題なければメニューに登録

---

## 8. Dashboard / Run_Log 反映

**不要（設計メモのみ）。** 実装着手時に `de -ProjectId JREC-01` で反映する。
