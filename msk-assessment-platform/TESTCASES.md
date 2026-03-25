# TESTCASES.md — 運動器初期評価システム (JASSESS-01)

テストケース一覧と実機確認結果を記録する。
GAS 実機確認後はこのファイルを更新し commit / push する。

---

## テスト記録フォーマット

| TestId | 対象セクション | テスト内容 | 結果 | 確認日 | 備考 |
|---|---|---|---|---|---|
| TC-XX | セクション名 | 内容 | PASS / FAIL / 未実施 | YYYY-MM-DD | 備考 |

---

## Phase 1: 腰痛評価モジュール

### H. 動作評価 — まとめ判定ロジック（C81）

> **確認背景:** 全項目「正常」入力時に「軽度制限型」と表示される不整合を発見（2026-03-24）。
> `else = "軽度制限型"` の固定バグ + 右側屈・左側屈（C78/C79）未参照の2点を修正後に確認。

| TestId | 対象 | 入力条件（C76/C77/C78/C79） | 期待値 | 結果 | 確認日 | 備考 |
|---|---|---|---|---|---|---|
| TC-H01 | H. 動作評価まとめ（C81） | 前屈=正常 / 後屈=正常 / 右側屈=正常 / 左側屈=正常 | 正常 | PASS | 2026-03-24 | 旧仕様では「軽度制限型」になっていたバグを修正 |
| TC-H02 | H. 動作評価まとめ（C81） | 前屈=軽度制限 / 後屈=正常 / 右側屈=正常 / 左側屈=正常 | 軽度制限型 | PASS | 2026-03-24 | 軽度制限1項目 |
| TC-H03 | H. 動作評価まとめ（C81） | 前屈=軽度制限 / 後屈=軽度制限 / 右側屈=正常 / 左側屈=正常 | 中等度制限型 | PASS | 2026-03-24 | 軽度制限2項目 → 複数異常で中等度に格上げ |
| TC-H04 | H. 動作評価まとめ（C81） | 前屈=中等度制限 / 後屈=正常 / 右側屈=正常 / 左側屈=正常 | 中等度制限型 | PASS | 2026-03-24 | 中等度制限1項目 |
| TC-H05 | H. 動作評価まとめ（C81） | 前屈=著明制限 / 後屈=正常 / 右側屈=正常 / 左側屈=正常 | 重度制限型 | PASS | 2026-03-24 | 著明制限1項目で即 重度制限型 |

**修正前の不具合まとめ:**

| バグ | 内容 |
|---|---|
| else 固定 | 全正常でも else に落ちて「軽度制限型」を返す（正常分岐が存在しなかった） |
| C78/C79 未参照 | 右側屈・左側屈が数式に含まれておらず、前屈・後屈のみで判定していた |

---

### 未実施テスト（基本動作・転記 — Phase 1 継続確認予定）

| TestId | 対象セクション | テスト内容 | 結果 | 予定日 |
|---|---|---|---|---|
| TC-B01 | B. 赤旗スクリーニング | 1項目「あり」 → 赤旗判定=要確認・背景赤色表示 | 未実施 | — |
| TC-B02 | B. 赤旗スクリーニング | 排尿障害「あり」 → 即紹介フラグ | 未実施 | — |
| TC-C01 | C. 神経症状 | SLR陽性（右）→ 神経症状レベル=中等度 | 未実施 | — |
| TC-D01 | D. NRS | NRS現在=7 → NRS判定=重度 | 未実施 | — |
| TC-E01 | E. RMDQ-10 | はい=3 → 軽度 / はい=7 → 中等度 / はい=10 → 重度 | 未実施 | — |
| TC-F01 | F. STarT | はい=4 → 高リスク | 未実施 | — |
| TC-I01 | I. 移乗動作 | 歩行=著明障害 → 転倒リスク=高 | 未実施 | — |
| TC-Z01 | 全体 | 全項目入力 → 評価履歴への転記 | 未実施 | — |

---

### J. 総合方針判定（C95）/ K. 自動生成コメント — ルールベース判定ロジック

> **実装:** `logic_engine.js` の `runLogicAll()` により C95・C99〜C106 を更新。
> **確認方法:** 下記「実機確認手順」の通りに入力後 `runLogicAll()` を実行し、C95 の出力を確認。
> **注意:** onEdit トリガー未設定の場合は手動実行が必要（→「onEdit 自動トリガーについて」参照）。

#### ⚠️ 設計検証メモ（実機確認前に確認済み）

| 項目 | 内容 |
|---|---|
| TC-J01 期待値修正 | STarT=2 (< 4) → `START_LOW=true` → branch12「機能改善・運動療法開始」が優先される。旧期待値「機能改善・セルフケア習慣化」は誤りのため修正済み。 |
| TC-J05 入力条件修正 | `C32=両側陽性` → C33=**重度**（NERVE_SEVERE）。旧記述「両側SLR→中等度」は誤り。中等度確認には `C32=陽性（右）` または `C32=陽性（左）` を使用。 |
| TC-J04〜J10 期待値 | 実装コードの完全テキストに合わせて更新済み。 |

#### テストケース一覧

| TestId | 入力条件（代表値） | C95 期待値（完全テキスト） | 結果 | 確認日 | 備考 |
|---|---|---|---|---|---|
| TC-J01 | 発症3か月以上 / NRS=2 / RMDQ=2 / STarT=2 / 神経なし / 全動作正常 | 機能改善・運動療法開始 — 段階的なエクササイズと日常活動の再開を促進 | **PASS** | 2026-03-25 | CHRONIC+STarT低（START_LOW=true→branch12） |
| TC-J01b | 発症3か月以上 / NRS=2 / RMDQ未入力 / STarT未入力 / 神経なし / 全動作正常 | 機能改善・セルフケア習慣化 — 再発予防を見据えた運動療法と生活指導 | **PASS** | 2026-03-25 | CHRONIC+STarT未入力（START_LOW=false→branch14）/ 一度不一致→C52/C65数式修正（COUNTIF→空欄ガード付き）後に再確認 PASS |
| TC-J02 | C22=あり（排尿障害） | 【緊急】馬尾症候群疑い — 即日医療機関紹介を強く検討してください | **PASS** | 2026-03-24 | 最優先・緊急（branch1） |
| TC-J03 | C16=あり（外傷）/ C22〜C23=なし | 赤旗あり — 施術前に医療連携の必要性を確認してください | **PASS** | 2026-03-24 | 赤旗1件・馬尾なし（branch2） |
| TC-J04 | C31=あり（下肢筋力低下）→ C33=重度（自動） | 神経症状重度 — 神経所見優先・整形外科精査（MRI等）を強く推奨 | **PASS** | 2026-03-24 | NERVE_SEVERE（branch3） |
| TC-J05 | C32=陽性（右）→ C33=中等度（自動）/ C31=なし | 神経根障害疑い — 神経所見優先・施術強度を慎重に。悪化時は即医療連携 | **PASS** | 2026-03-24 | NERVE_MOD（branch4）※両側陽性は重度になるため片側で確認 |
| TC-J06 | STarT=7（C56〜C62=全てはい(1)）/ NRS=6 | 行動変容・説明優先 — 心理社会的介入と疼痛教育を施術と並行して実施 | **PASS** | 2026-03-24 | START_HIGH+NRS_MID（branch5） |
| TC-J07 | STarT=7（C56〜C62=全てはい(1)）/ NRS=2 | 行動変容優先 — 段階的な機能改善プログラムを導入。セルフエフィカシー（自己効力感）の向上を重視 | **PASS** | 2026-03-24 | START_HIGH+NRS_LOW（branch6） |
| TC-J08 | NRS=8 / RMDQ=6（C42〜C47=全てはい(1)）/ STarT低 | 疼痛管理優先 → 機能改善 — まず痛みを緩和してから機能回復へ段階的に移行 | **PASS** | 2026-03-24 | NRS_HIGH+RMDQ_MOD（branch8） |
| TC-J09 | 発症2週未満 / NRS=5 / STarT低 | 急性期管理優先 — 安静・保護と急性期疼痛管理から開始（2〜4週で改善を目標） | **PASS** | 2026-03-24 | ACUTE+NRS_MID（branch11） |
| TC-J10 | 発症6週〜3か月 / STarT=2 / NRS=3 | 機能改善・運動療法開始 — 段階的なエクササイズと日常活動の再開を促進 | **PASS** | 2026-03-24 | SUBACUTE+STarT低（branch12） |

---

#### ⚠️ TC-J01b 不一致の根本原因と修正（2026-03-25）

**発生した不具合:**
RMDQ・STarT を全空欄にしたとき、C52/C65 が `0` を返すため `START_LOW=true` になり、
branch14（セルフケア習慣化）ではなく branch12（運動療法開始）に到達した。

**根本原因:**
- 旧数式: `=COUNTIF(C42:C51,"はい(1)")` → 全空欄でも `0` を返す
- `toNum(0) = 0`（null でない）→ `START_LOW = true` → branch12 に到達
- `toNum()` の設計意図（「null で未入力と0点を区別する」）と矛盾

**修正内容（`setup_sheets.js` 修正済み）:**
```
C52（RMDQ合計）: =IF(COUNTA(C42:C51)=0,"",COUNTIF(C42:C51,"はい(1)"))
C65（STarT合計）: =IF(COUNTA(C56:C64)=0,"",COUNTIF(C56:C64,"はい(1)"))
```
→ 全空欄のとき `""` を返す → `toNum("") = null` → `START_LOW = false` → branch14

**実機シートへの反映手順（ユーザー作業）:**
```
1. スプレッドシートを開く（ID: 1sj6dYtkFbnk4fjLOk764f-w7KUUeGNVYcbMDOg26OXY）
2. 「腰痛評価入力」シートを開く
3. C52 セルを選択し、数式を以下に手動変更:
   =IF(COUNTA(C42:C51)=0,"",COUNTIF(C42:C51,"はい(1)"))
4. C65 セルを選択し、数式を以下に手動変更:
   =IF(COUNTA(C56:C64)=0,"",COUNTIF(C56:C64,"はい(1)"))
5. 両セルが空欄状態（C42:C64 が全空欄）のとき "" と表示されることを確認
6. TC-J01b の入力パターン（全空欄）で runLogicAll() を実行し、C95 を確認
7. 期待値「機能改善・セルフケア習慣化 — 再発予防を見据えた運動療法と生活指導」に一致すれば PASS
```

> **なお setup_sheets.js 側も修正済み** のため、将来 `setupAllSheets()` を再実行した場合は自動的に正しい数式が設定される。
> **進捗整合メモ:** TC-J01b は 2026-03-25 の再確認で PASS 反映済み。再開時に TC-J01b からやり直す必要はない。

---

#### 実機確認手順（runLogicAll 実行前後の確認フロー）

```
【事前準備】
1. スプレッドシートを開く（ID: 1sj6dYtkFbnk4fjLOk764f-w7KUUeGNVYcbMDOg26OXY）
2. Apps Script エディタを開く（ツール → Apps Script）
3. logic_engine.js の内容を貼り付け（または既存ファイルを確認）
4. setup_sheets.js も同じプロジェクト内にあることを確認
   ※ SHEET_NAMES, COLORS 定数は setup_sheets.js に定義されている

【各テストケースの確認手順】
1. 「腰痛評価入力」シートを開く
2. 下記「入力パターン早見表」に従って各セルに値を入力する
3. ※ C3（評価日）と C4（患者ID）は必ず入力すること（空欄だと runLogicAll がスキップされる）
4. Apps Script エディタで runLogicAll() を実行する
5. C95（ルールベース判定結果）の内容を確認する
6. C99〜C106（K. コメントセクション）も確認する（自然な文章か確認）
7. 結果を TESTCASES.md に記録する

【確認後のクリア】
- 次のテストケース前に clearInputSheet() を実行して入力をリセットする
  ※ clearInputSheet() は setup_sheets.js に実装済み
```

---

#### 入力パターン早見表（TC-J 各ケース）

> **注意:** C33（神経症状レベル）・C24（赤旗スコア）・C81（動作評価まとめ）は Sheets 数式で自動計算されるため手動入力不要。

| セル | 項目名 | TC-J01 | TC-J01b | TC-J02 | TC-J03 | TC-J04 |
|---|---|---|---|---|---|---|
| C3 | 評価日 | 2026-03-24 | 同左 | 同左 | 同左 | 同左 |
| C4 | 患者ID | TEST | 同左 | 同左 | 同左 | 同左 |
| C11 | 発症からの期間 | 3か月以上 | 3か月以上 | 3か月以上 | 3か月以上 | 3か月以上 |
| C13 | 既往歴（腰部） | なし | なし | なし | なし | なし |
| C16〜C21 | 赤旗（各項目） | 全てなし | 全てなし | 全てなし | C16=あり / C17〜C21=なし | 全てなし |
| C22 | 排尿・排便障害 | なし | なし | **あり** | なし | なし |
| C23 | 会陰部感覚異常 | なし | なし | なし | なし | なし |
| C28 | 下肢放散痛 | なし | なし | なし | なし | なし |
| C31 | 下肢筋力低下 | なし | なし | なし | なし | **あり** |
| C32 | SLRテスト | 陰性 | 陰性 | 陰性 | 陰性 | 陰性 |
| C36 | NRS（現在） | 2 | 2 | 2 | 2 | 4 |
| C42〜C51 | RMDQ Q1〜Q10 | Q1-Q2=はい(1) 残=いいえ(0) | 全て空欄 | 全ていいえ(0) | 全ていいえ(0) | 全ていいえ(0) |
| C56〜C64 | STarT Q1〜Q9 | Q1-Q2=はい(1) 残=いいえ(0) | 全て空欄 | 全ていいえ(0) | 全ていいえ(0) | 全ていいえ(0) |
| C76〜C79 | 動作評価（4方向） | 全て正常 | 全て正常 | 全て正常 | 全て正常 | 全て正常 |
| C84〜C87 | 移乗動作（4項目） | 全て自立 | 全て自立 | 全て自立 | 全て自立 | 全て自立 |

| セル | 項目名 | TC-J05 | TC-J06 | TC-J07 | TC-J08 | TC-J09 | TC-J10 |
|---|---|---|---|---|---|---|---|
| C3 | 評価日 | 2026-03-24 | 同左 | 同左 | 同左 | 同左 | 同左 |
| C4 | 患者ID | TEST | 同左 | 同左 | 同左 | 同左 | 同左 |
| C11 | 発症からの期間 | 3か月以上 | 3か月以上 | 3か月以上 | 3か月以上 | **2週未満** | **6週〜3か月** |
| C13 | 既往歴 | なし | なし | なし | なし | なし | なし |
| C16〜C23 | 赤旗（全項目） | 全てなし | 全てなし | 全てなし | 全てなし | 全てなし | 全てなし |
| C28 | 下肢放散痛 | なし | なし | なし | なし | なし | なし |
| C31 | 下肢筋力低下 | なし | なし | なし | なし | なし | なし |
| C32 | SLRテスト | **陽性（右）** | 陰性 | 陰性 | 陰性 | 陰性 | 陰性 |
| C36 | NRS（現在） | 4 | **6** | **2** | **8** | **5** | 3 |
| C42〜C51 | RMDQ Q1〜Q10 | 全ていいえ(0) | 全ていいえ(0) | 全ていいえ(0) | **Q1〜Q6=はい(1) 残=いいえ(0)** | 全ていいえ(0) | 全ていいえ(0) |
| C56〜C64 | STarT Q1〜Q9 | 全ていいえ(0) | **全てはい(1)** | **全てはい(1)** | Q1-Q2=はい(1) 残=いいえ(0) | Q1-Q2=はい(1) 残=いいえ(0) | Q1-Q2=はい(1) 残=いいえ(0) |
| C76〜C79 | 動作評価（4方向） | 全て正常 | 全て正常 | 全て正常 | 全て正常 | 全て正常 | 全て正常 |
| C84〜C87 | 移乗動作（4項目） | 全て自立 | 全て自立 | 全て自立 | 全て自立 | 全て自立 | 全て自立 |

---

#### 空欄安全性確認（TC-EMPTY）

> **目的:** 未入力状態で runLogicAll() が暴走・誤判定しないことを確認する。

| TestId | 確認内容 | 期待動作 | 結果 | 確認日 | 備考 |
|---|---|---|---|---|---|
| TC-EMPTY01 | C3（評価日）・C4（患者ID）両方空欄 | runLogicAll() が何も書かずに静かに終了 | PASS | 2026-03-24 | 空シート誤書込み防止ガード確認 |
| TC-EMPTY02 | C3・C4 入力済み / その他全て空欄 | C95=「機能改善・セルフケア優先 — 状態に応じた標準的な施術方針で対応」(デフォルト) / エラーなし | PASS | 2026-03-24 | 空欄=null 安全処理確認 |
| TC-EMPTY03 | NRS・RMDQ・STarT のみ空欄 / C11=3か月以上 | C95が CHRONIC フラグで分岐 / スコア=「（スコア未入力）」 | PASS | 2026-03-25 | `機能改善・セルフケア習慣化` 分岐 / `【スコア】（スコア未入力）` を確認 |

---

## onEdit 自動トリガーについて

### 現在の状態（2026-03-24 時点）

`logic_engine.js` の `onEdit(e)` 関数は実装済みだが、**Apps Script のトリガー設定は手動で行う必要がある**。

現在は `runLogicAll()` を手動実行する方式で実機確認を行う。

---

### onEdit を有効化する手順

```
1. スプレッドシートの Apps Script エディタを開く
2. 左側の「トリガー（時計アイコン）」をクリック
3. 「トリガーを追加」ボタン（右下）をクリック
4. 設定:
   - 実行する関数: onEdit
   - デプロイ: Head
   - イベントのソース: スプレッドシートから
   - イベントの種類: 編集時
5. 保存（Googleアカウント認証が求められる場合は許可）
```

---

### onEdit 本実装の推奨タイミングと注意点

| 項目 | 内容 |
|---|---|
| **推奨タイミング** | TC-J01〜J10 の実機確認が全 PASS になった後 |
| **理由** | トリガーを先に設定すると、テスト中の中途入力ごとに runLogicAll() が走り、テスト確認が煩雑になる |
| **遅延問題への対処** | onEdit 内で `SpreadsheetApp.flush()` を実行済み（数式再計算完了を待ってから判定する） |
| **書き込み競合** | onEdit が連続で発火しても、writeResults は上書きのみ（undo 対象になる点に注意） |
| **空欄ガード** | 評価日・患者ID が両方空なら実行しない（空シートへの誤書き込みを防止） |
| **対象セル以外の編集** | TRIGGER_CELLS 定数に含まれないセルを編集しても onEdit は実行しない |
| **実施前の確認点** | 全テストケース PASS 確認後、臨床使用開始前に 1 症例だけ onEdit ありで動作確認する |

---

### 将来モジュール（頸部・膝）での onEdit 拡張方針

```javascript
// 頸部モジュール追加時: TRIGGER_CELLS に頸部評価セルを追加
// logic_engine.js 内の TRIGGER_CELLS を更新するだけで対応可能
const TRIGGER_CELLS = new Set([
  // 既存（腰痛）
  'C11', 'C13', ...
  // 追加（頸部モジュール）
  'C200', 'C201', ...  // 頸部評価入力行を追加
]);
```

---

## テスト実施ルール

- GAS 実機確認後に人間が結果を口頭確認 → Claude Code がこのファイルに記録する
- FAIL の場合は「備考」に原因と対応 commit を記載する
- 確認日は実機確認日（commit日ではなく実際に操作した日）を記載する
- 将来モジュール（頸部・膝等）はセクションを追加して同パターンで記録する
- 期待値テキストは `logic_engine.js` のコード出力と完全一致で記載する（部分一致は不可）
---
## 2026-03-25 onEdit quickstart

### Short trigger setup

1. Open the Apps Script editor for JASSESS-01.
2. Add an installable trigger for `onEdit`.
3. Choose `From spreadsheet` as the event source.
4. Choose `On edit` as the event type.

### 2026-03-25 verification result

- Installable `onEdit` trigger inventory confirmed: 1 trigger only.
- Trigger settings confirmed: `Head` / `From spreadsheet` / `On edit`.
- `refreshInputSheetC33Formula()` executed once before verification.
- `clearInputSheet()` executed successfully from the Apps Script editor.
- One-case verification PASS with `TC-J01`.
- Confirmed auto-update targets:
  - `C95`
  - `C99:C106`
- Confirmed `C95` output:
  - `機能改善・運動療法開始 — 段階的なエクササイズと日常活動の再開を促進`

### One-case verification

1. Run `clearInputSheet()` once.
2. Enter `C3` and `C4` first.
3. Input one simple case such as `TC-J01` or `TC-J10`.
4. Make the last input on a trigger cell.
5. Confirm that `C95` and `C99:C106` update automatically.
6. If needed, run `runLogicAll()` once and confirm the result matches the onEdit result.

### Before clinical testing

- Confirm one case first, then move to 5-10 real cases.
- onEdit can run during input, so final review should be done after the main cells are filled.
- `clearInputSheet()` is UI-safe and falls back to logging when UI is unavailable.
- `saveToHistory()` should still be used from spreadsheet UI.
- See `ONEDIT_NEXT_STEPS.md` and `CLEAR_INPUT_CONTEXT_FIX.md` for handoff notes.

### Trigger inventory check before live use

1. Open the Apps Script editor.
2. Open the Triggers screen.
3. Confirm how many installable `onEdit` triggers exist.
4. Confirm there is no duplicate trigger that would cause double execution.
5. Only then proceed to one-case onEdit verification.

## 2026-03-25 live sheet read verification

### Access result

- live Google Sheet read succeeded after sharing the sheet with the service account
  - `id-719@e-carte-448107.iam.gserviceaccount.com`
- Source-of-truth policy remains:
  - local files are canonical
  - live sheet is an execution / verification target
- Reusable script added:
  - `scripts/read_live_sheet_jassess.mjs`

### Verified live target

- Spreadsheet ID:
  - `1sj6dYtkFbnk4fjLOk764f-w7KUUeGNVYcbMDOg26OXY`
- Spreadsheet title:
  - `平山接骨院_運動器初期評価システム_JASSESS-01`
- Sheet:
  - `腰痛評価入力`

### Verified live consistency

| TestId | 確認内容 | 期待動作 | 結果 | 確認日 | 備考 |
|---|---|---|---|---|---|
| TC-LIVE01 | service account 共有後、live `腰痛評価入力` の `C95` / `C99:C106` を直接取得 | 読取成功し、ローカルで確認済みの期待値と整合する | PASS | 2026-03-25 | read path confirmed |
| TC-LIVE02 | TC-EMPTY03 相当の live 状態を読取 | `C95=機能改善・セルフケア習慣化` / `C99` に `【スコア】（スコア未入力）` が含まれる | PASS | 2026-03-25 | `C95` と `C99:C106` 整合確認 |

### Practical conclusion

- live read path is now reusable
- JASSESS-01 is ready to begin live clinical testing
- optional remaining checks:
  - `saveToHistory()` one real run
  - multi-cell paste check on `C84:C87`

## 2026-03-25 C33 empty-guard fix

### Observed issue

- After `clearInputSheet()`, `C28`, `C31`, and `C32` can all be blank.
- In that state, `C33` could become `軽度`.
- The root cause was the old `setup_sheets.js` formula using `C28 <> "なし"` for the mild branch.

### Spec after fix

- `C28/C31/C32` all blank -> `C33` stays blank
- `C28=なし`, `C31=なし`, `C32=陰性` -> `C33=なし`
- `C28=片側` or `C28=両側` -> `C33=軽度`
- `C32=陽性（右）` or `C32=陽性（左）` -> `C33=中等度`
- `C31=あり` or `C32=両側陽性` -> `C33=重度`
- Partial entry without an explicit rule match -> keep `C33` blank

### Quick regression check

1. Run `clearInputSheet()`.
2. Confirm `C28`, `C31`, and `C32` are blank.
3. Confirm `C33` is blank and does not auto-change to `軽度`.
4. Enter the normal case `C28=なし`, `C31=なし`, `C32=陰性`.
5. Confirm `C33=なし`.
6. Reconfirm that the known normal flow used in `TC-J01` still behaves normally.
7. If the live sheet still has the old formula, run `refreshInputSheetC33Formula()` once from the Apps Script editor after `clasp push`.

## 2026-03-25 transfer validation refresh

### Live-sheet issue

- The source code already defines row-specific options for `C84:C87`.
- The live sheet drifted so that `C84:C87` all used the `C84` list.
- That blocks the intended transfer/ADL evaluation flow for the high fall-risk case.

### Expected validation lists

- `C84` -> `自立 / 見守り要 / 介助要 / 不可`
- `C85` -> `自立 / 軽度障害 / 中等度障害 / 著明障害`
- `C86` -> `自立 / 可能（手すり要） / 困難 / 不可`
- `C87` -> `自立 / 可能（支持要） / 困難 / 不可`

### Live refresh step

1. Run `clasp push`.
2. Open the Apps Script editor.
3. Run `refreshInputSheetTransferValidations()` once.
4. Re-open each dropdown in `C84:C87`.
5. Confirm that `C85:C87` no longer reuse the `C84` choices.

## 2026-03-25 C103 selfcare wording split

### Scope

- This change does not modify `judgeOverallPolicy()` or the main result in `C95`.
- The target is only the wording branch used for `C103`.

### Intent

- `ACUTE + NRS_HIGH` keeps the acute-phase wording.
- `CHRONIC + NRS_HIGH` now uses a chronic high-pain wording:
  - avoid full rest
  - maintain activity within a tolerable range
  - restart movement gradually
  - support self-control of load and symptoms

### Existing cases to keep stable

- `TC-J08` remains a PASS case for the main policy branch `NRS_HIGH + RMDQ_MOD`.
- `TC-J09` remains a PASS case for the main policy branch `ACUTE + NRS_MID`.
- This fix is intended to improve `C103` wording for chronic high-pain cases without changing those policy outcomes.

## 2026-03-25 onEdit multi-cell paste check

### Risk note

- `logic_engine.js` currently uses `e.range.getA1Notation()` and checks it with `TRIGGER_CELLS.has(cell)`.
- That works for single-cell edits such as `C42`.
- For multi-cell paste, Apps Script can pass a range notation such as `C42:C51`.
- In that case, the edited range may include trigger cells but still fail the current single-cell membership check.
- This was left as a pre-operation check item.

### Pre-operation check item

1. After installable `onEdit` trigger setup, paste into a multi-cell trigger range such as `C42:C51`.
2. Confirm whether `C95` and `C99:C106` update automatically.
3. Repeat once with another trigger range if needed.
4. If auto-update does not occur, record it as the expected limitation of the current single-cell trigger check.
5. Treat this as a future fix candidate before full live onEdit operation.

### 2026-03-25 observed result

- Multi-cell paste into `C42:C51` updated the sheet automatically.
- Multi-cell paste into `C56:C64` also updated the sheet automatically.
- In the current live sheet + trigger setup, the previously noted risk did not reproduce for RMDQ and STarT ranges.
- `C84:C87` remains optional as an extra confidence check, but it is no longer a blocking pre-clinical item.
