# 来院履歴 訂正・ゴミ箱機能 設計書

**作成日:** 2026-04-28
**対象:** JREC-SF01 自費カルテ・会計システム
**ステータス:** 将来タスク（未実装）

---

## 1. 背景・目的

患者詳細画面の来院・カルテ履歴で、誤入力した来院記録を削除または修正したい。

自費カルテは保険請求と異なり療養費請求上の監査対象ではないため、
未会計データについては完全削除も許容できる。
ただし、会計済み・領収書発行済みデータは売上・Payments・DailySales との整合があるため
単純な完全削除は避ける。

---

## 2. 削除可否ポリシー

| 会計状態 | 削除方針 | 理由 |
|---|---|---|
| 未会計 | ゴミ箱移動 → 復元 or 完全削除 OK | 売上データなし |
| 未収 | Payments との整合確認後にゴミ箱移動 | paidAmount=0 なら影響最小 |
| 一部入金 | 原則として取消扱い。完全削除は慎重に | paidAmount が記録されている |
| 入金済 | 削除不可。取消・返金処理（Phase 6-C）| Payments / DailySales に影響 |
| 領収書発行済み | 完全削除不可。領収書取消・再発行・返金と連動 | 領収書番号の監査性が必要 |

---

## 3. 採用方針：deletedFlag 方式（候補 A）

### 概要

SelfPayVisits に論理削除フラグ列を追加し、削除済みデータを非表示にする。
実データは保持するため復元が容易。

### SelfPayVisits への追加列（案）

| 列名 | 型 | 内容 |
|---|---|---|
| `isDeleted` | boolean | TRUE = ゴミ箱 |
| `deletedAt` | datetime | ゴミ箱移動日時 |
| `deletedBy` | string | 削除操作者（将来の多ユーザー対応） |
| `deleteReason` | string | 削除理由（自由入力）|
| `deleteStatus` | string | `TRASHED` / `RESTORED` / `PERMANENTLY_DELETED` |

### 非採用候補：SelfPayTrash シート方式（候補 B）

- 複数シート（SelfPayVisits / Payments / SelfPayItems）をまたぐ退避が必要
- visitKey の参照整合を維持するのが複雑
- 将来の候補として保留

---

## 4. 実装フェーズ計画

### Phase 6-A：患者基本情報編集（先行）

patient-detail から患者の基本情報（氏名・よみ・連絡先等）を編集できるようにする。

| 内容 | 詳細 |
|---|---|
| 対象 | Patients シートの基本情報列 |
| UI | patient-detail に「患者情報を編集」ボタンを追加 |
| フロー | インライン編集 or patient-form に prefill して遷移 |

---

### Phase 6-B：来院履歴のゴミ箱機能（メイン）

#### 6-B-1: SelfPayVisits への deletedFlag 列追加

- JREC_SF01_Setup.gs: `setupSelfPayVisits_` に列定義を追加
- 既存行への後方互換: isDeleted 空 → FALSE として扱う

#### 6-B-2: 削除 API

```js
// 対象: 未会計 / 未収のみ
// 会計済み・領収書発行済みはエラー返却
function trashVisit(visitKey, reason) { ... }
function restoreVisit(visitKey) { ... }
function permanentlyDeleteVisit(visitKey) { ... }
```

**削除前チェック（trashVisit）:**

```
1. Payments を確認
   - paymentStatus = 入金済 → エラー（Phase 6-C で別途対応）
   - paymentStatus = 一部入金 → エラーまたは警告（仕様確認が必要）
   - paymentStatus = 未収 → OK（paidAmount=0 を確認）
   - Payments なし（未会計）→ OK
2. Receipts を確認
   - 領収書あり → エラー（Phase 6-C で別途対応）
3. SelfPayVisits.isDeleted を TRUE に更新
4. deletedAt / deleteReason を記録
5. Run_Log に TRASH 記録
```

**復元前チェック（restoreVisit）:**

```
1. isDeleted = TRUE であることを確認
2. isDeleted を FALSE にクリア / deleteStatus = RESTORED
3. Run_Log に RESTORE 記録
```

**完全削除（permanentlyDeleteVisit）:**

```
1. isDeleted = TRUE であることを確認（ゴミ箱に入っていること）
2. paymentStatus = 未会計 または 未収（paidAmount=0）のみ許可
3. SelfPayItems 関連行を削除
4. Payments 行を削除（存在する場合）
5. SelfPayVisits 行を削除
6. Run_Log に PERMANENT_DELETE 記録
```

#### 6-B-3: patient-detail.html 表示変更

- isDeleted=TRUE の来院を通常の来院リストから非表示
- 「ゴミ箱を見る」展開オプションを追加（折りたたみ式）
- 来院リストの各行に「ゴミ箱へ」ボタンを追加（未会計・未収のみ表示）

#### 6-B-4: ゴミ箱ビュー

- patient-detail 内に「ゴミ箱」セクションを追加（または trash.html を新設）
- isDeleted=TRUE の来院一覧を表示
- 各行に「復元」「完全削除」ボタン

---

### Phase 6-C：会計済み・領収書発行済みの取消/返金/再発行（後続）

Phase 6-B に含めず、別設計を行う。

| 機能 | 概要 |
|---|---|
| 入金済み取消 | paymentStatus を変更し DailySales を再集計 |
| 領収書取消 | Receipts に cancelledAt 列追加 |
| 返金 | 返金記録の専用シートまたは Run_Log の REFUND アクション |
| 再発行 | reissueCount インクリメント・新 receiptNo 発行 |
| DailySales 整合 | rebuildDailySales の再実行が必要 |

---

## 5. 影響を受ける既存コンポーネント

| コンポーネント | 影響 |
|---|---|
| `JREC_SF01_Setup.gs` | SelfPayVisits に isDeleted 等の列追加 |
| `JREC_SF01_Visit.gs` | trashVisit / restoreVisit / permanentlyDeleteVisit を追加 |
| `JREC_SF01_Billing.gs` | getPatientListStats / getPatientAccountingData で isDeleted=TRUE を除外 |
| `JREC_SF01_DailySales.gs` | visitMap 構築時に isDeleted=TRUE を除外 |
| `patient-detail.html` | 来院リストに削除ボタン・ゴミ箱セクションを追加 |
| `PROJECT_STATUS.md` | Phase 6 進捗管理 |

---

## 6. 未解決事項（実装前に確認が必要）

| # | 確認事項 |
|---|---|
| 1 | 一部入金データのゴミ箱移動を許可するか（paidAmount > 0 の場合）|
| 2 | ゴミ箱保持期間を設けるか（例: 30日後に自動完全削除）|
| 3 | 複数 visitKey の一括ゴミ箱移動が必要か |
| 4 | ゴミ箱ビューを patient-detail 内に組み込むか、別画面（trash.html）にするか |
| 5 | permanentlyDeleteVisit の実行権限制御（誤操作防止のための確認ダイアログ等）|

---

## 7. 実装優先度・前提

| 項目 | 内容 |
|---|---|
| 実装優先度 | 低〜中（Phase 5 完了後のフォローアップ） |
| 前提 | Phase 5-B（paidAmount 管理）が CLOSED であること → ✅ 完了済み |
| 先行 Phase | Phase 6-A（患者基本情報編集）を先行させることを推奨 |
| DailySales 整合 | rebuildDailySales を削除後に再実行するフローが必要 |
