# PROJECT_STATUS.md — 運動器初期評価システム (JASSESS-01)

最終更新: 2026-03-26（CLINICAL_FLOW.md 内容改訂 — 11セクション構成に整理）

---

## 現在地

- **CLINICAL_FLOW.md 内容改訂（2026-03-26）** ← 最新
  - 目的・設計思想・臨床フロー（Step 0〜7）・実務使い分け・慢性疼痛強化プロジェクト接続を整理
  - 全11セクション構成に再整理（旧版を差し替え）
  - JASSESS-01 = **入口評価** / 運動療法初回評価 = **介入設計評価** の定義を明文化・固定
  - **今後のコード修正・仕様修正・シート設計は `CLINICAL_FLOW.md` を前提として行うこと**
  - **次フェーズ: 実臨床テスト再開（5〜10症例）**
- **DESIGN_DECISIONS.md §8 追加（2026-03-26）**
  - 入口評価/介入設計評価を分ける設計判断・採用理由・役割分担・臨床上の利点を記録
- **JASSESS-01 臨床位置づけ確定（2026-03-26）**
  - `CLINICAL_FLOW.md` 新規作成・`DESIGN_DECISIONS.md` §7 追記・`patient-flow.md` 参照追加
- **実臨床テスト開始可（2026-03-25）**
  - ローカル正本を維持しつつ、service account 共有で live Google Sheet 読取に成功
  - live `腰痛評価入力` シートから `C95` と `C99:C106` を直接取得できる確認経路を整備
  - Apps Script installable `onEdit` トリガー 1 本を確認（Head / スプレッドシートから / 編集時 / エラー率 0%）
  - `refreshInputSheetC33Formula()` 実行済み
  - `clearInputSheet()` 実行後、TC-J01 の 1 症例で `C95` および `C99:C106` の自動更新を確認
  - 複数セル貼り付け確認: `C42:C51` および `C56:C64` の貼り付けでも自動更新を確認
  - TC-EMPTY03 PASS: `C11=3か月以上` + NRS/RMDQ/STarT 空欄で `機能改善・セルフケア習慣化` 分岐と `【スコア】（スコア未入力）` を確認
  - live 読取でも TC-EMPTY03 相当の `C95` / `C99:C106` 整合を再確認
  - `saveToHistory()` 実機確認 PASS: 評価履歴に `E0001` / `TEST` / 判定文一致 / 評価まとめ一致を確認
  - 次フェーズ: 実臨床テスト（5〜10症例）。任意残件は `C84:C87` 複数貼り付け確認のみ
- **Phase 1 実機確認完了（2026-03-25）** ← 最新
  - TC-J01・TC-J01b PASS → TC-J01〜J10・TC-EMPTY01〜02 全ケース PASS
  - C52/C65 数式バグ（全空欄で0を返す）を発見・修正・実機反映で解消
  - 次フェーズ: onEdit 確認 / 実臨床前チェック → 実臨床テスト（5〜10症例）
- **実機確認準備完了（2026-03-24）**
  - TESTCASES.md 更新: TC-J01〜J10 の設計検証（期待値訂正・入力パターン早見表追加）
  - TC-J01 期待値訂正（STarT=2 → 機能改善・運動療法開始 / 旧: セルフケア習慣化 は誤り）
  - TC-J05 入力条件訂正（両側陽性→重度になる / 中等度確認は片側陽性で行う）
  - TC-J04〜J10 期待値をコード完全テキストに更新
  - TC-EMPTY01〜03（空欄安全性）追加
  - onEdit 自動トリガー実装方針・セットアップ手順を TESTCASES.md に記録
- **Phase 1 ルールベース判定ロジック実装完了（2026-03-24）**
  - `gas/logic_engine.js` 新規作成（Step 8〜10 GAS 実装）
  - Step 8: 全フラグ集計（慢性期・既往含む 13 フラグ）
  - Step 9: 総合方針判定（判定マトリクス完全版 15 パターン → C95）
  - Step 10: 自動生成コメント（K. セクション C99〜C106 の 8 種コメント）
- **H.動作評価まとめ判定バグ修正・確認完了（2026-03-24）**
  - else分岐バグ（全正常→軽度制限型になっていた）を修正
  - 右側屈・左側屈（C78/C79）が数式に含まれていなかった問題を修正
  - 重症度ベース4段階判定（正常/軽度/中等度/重度）に変更・全確認PASS
  - TESTCASES.md 新規作成（TC-H01〜TC-H05 PASS 記録）
- **JASSESS-01 再整理完了（2026-03-23）**
  - プロジェクト名: 腰痛評価シートシステム → **運動器初期評価システム** に変更
  - フォルダ: `low-back-assessment/` → **`msk-assessment-platform/`** に変更
  - プロジェクトID: JEVAL-01 → **JASSESS-01** に変更
  - 腰痛評価を Phase 1 モジュールとして位置づけ確定
  - DESIGN_DECISIONS.md に設計判断の根拠を記録
  - modules/low-back/README.md で腰痛モジュール仕様を分離
- **設計フェーズ完了（2026-03-23、旧JEVAL-01時点）**
  - SPEC.md / SHEET_DESIGN.md / LOGIC.md / COMMENT_DESIGN.md / CLINICAL_OPERATION.md 作成済み
  - gas/setup_sheets.js（スプレッドシート自動生成GAS雛形）作成済み

---

## プロジェクト概要

| 項目 | 内容 |
|---|---|
| プロジェクトID | **JASSESS-01** |
| 日本語正式名 | **運動器初期評価システム** |
| 英字フォルダ名 | **msk-assessment-platform** |
| 目的 | 接骨院での運動器疾患評価の標準化・評価→方針→説明の一貫化・将来AI連携基盤 |
| 現在の実装フェーズ | **Phase 1 = 腰痛評価モジュール** |
| ステータス | **Phase 1 実臨床前チェック完了 → 実臨床テスト開始可** |
| スプレッドシートID | **1sj6dYtkFbnk4fjLOk764f-w7KUUeGNVYcbMDOg26OXY** |
| スプレッドシート名 | **平山接骨院_運動器初期評価システム_JASSESS-01** |
| Apps Script ID | **1EuUnfTRIEZ_0VYib_d8hdAE-EPRkng-ZBdwICrJDFuXX3TEKOdvyeTyK** |
| clasp 設定 | `gas/.clasp.json`（gitignore対象）/ `gas/appsscript.json`（コミット済み）|
| live 読取経路 | `service_account.json` を shared viewer として使用 / `scripts/read_live_sheet_jassess.mjs` |

---

## システム全体の位置づけ（治療家育成の基盤）

このシステムは単なる記録票ではなく、治療家育成の基盤として設計されている。

```
評価 → 説明 → 方針提示 → 施術 → セルフケア → 再評価
```

施術者がこのシステムを使い続けることで：
- 痛みや不調を背景から整理できるようになる
- 原因・悪化要因を患者さんに納得感を持って説明できるようになる
- 回復の見通し・未来予測を立てられるようになる
- 施術だけでなく運動療法・セルフケア・生活指導まで提案できるようになる
- 患者さんと二人三脚で改善を積み上げられるようになる

---

## フェーズ構成

### Phase 0（完了）: 設計・基盤整理

| タスク | ステータス |
|---|---|
| プロジェクト全体設計（SPEC.md / SHEET_DESIGN.md 等） | ✅ 完了 |
| gas/setup_sheets.js 雛形作成 | ✅ 完了 |
| JASSESS-01 / msk-assessment-platform へ再整理 | ✅ 完了 |

### Phase 1: 腰痛評価モジュール（セットアップ完了）

| タスク | ステータス |
|---|---|
| setup_sheets.js 実行 → 8シート生成 | ✅ 完了 |
| スプレッドシートID取得 → PROJECT_STATUS.md に記録 | ✅ 完了 |
| 基本入力動作確認（プルダウン・赤旗アラート・自動計算） | ✅ 完了（H.まとめバグ修正・再確認済み） |
| ルールベース判定ロジック実装（LOGIC.md 準拠） | ✅ 完了（logic_engine.js 実装済み） |
| コメント自動生成（onEdit連携） | ✅ 完了（installable trigger 設定・1症例自動更新確認済み / 2026-03-25） |
| **実機確認（TC-J01〜J10・TC-EMPTY）** | ✅ **完了**（TC-J01〜J10・TC-EMPTY01〜02 全 PASS / 2026-03-25） |
| 実臨床テスト（5〜10症例） | ✅ **開始可**（onEdit / 空欄安全性 / 複数貼り付け確認済み） |
| live Google Sheet 読取 | ✅ 完了（service account 共有後に `腰痛評価入力` の `C95` / `C99:C106` 直接取得成功） |

### 将来拡張モジュール（着手前）

| フェーズ | 追加モジュール | 着手条件 |
|---|---|---|
| Phase 2 | 頸部・肩こり評価モジュール（neck-shoulder） | Phase 1 実臨床テスト完了後 |
| Phase 3 | 膝慢性痛評価モジュール（knee） | Phase 2 完了後 |
| Phase 4a | 姿勢評価モジュール（posture） | Phase 3 完了後 |
| Phase 4b | 高齢者機能・移乗評価モジュール（elderly-function） | Phase 3 完了後 |
| Phase 5 | Claude API連携（AI判定層） | Phase 1〜2 実臨床データ蓄積後 |
| Phase 6 | タブレット入力UI最適化 | Phase 5 完了後 |

---

## 変更名称の対照表

| 項目 | 旧（JEVAL-01） | 新（JASSESS-01） |
|---|---|---|
| プロジェクトID | JEVAL-01 | **JASSESS-01** |
| 日本語名 | 腰痛評価シートシステム | **運動器初期評価システム** |
| フォルダ名 | low-back-assessment/ | **msk-assessment-platform/** |

---

## 置いた仮定

| 仮定 | 内容 | 要確認タイミング |
|---|---|---|
| Phase 1 実装シート | 腰痛評価のみ（8シート構成） | Phase 1 完了後 |
| RMDQ | 10項目短縮版を採用 | Phase 1 実臨床テスト後 |
| STarT | 9項目簡易版 | Phase 1 実臨床テスト後 |
| PSFS | 施術者聞き取り入力形式 | Phase 6 タブレット化時に見直し |
| 将来モジュール | modules/ 配下に仕様を追加する方針 | 各Phase着手時 |

---

## 次回再開時に最初に確認すべき点

1. このファイルで現在地・フェーズ確認
2. `DESIGN_DECISIONS.md` でなぜこの構造かを確認
3. `TESTCASES.md` で確認済みテストを確認（TC-J01〜J10・TC-EMPTY01〜02 全 PASS 済み）
4. `gas/logic_engine.js` で Steps 8〜10 の判定ロジック確認（変更が必要な場合）
5. **次アクション: 実臨床テスト**
   - 実臨床テスト 5〜10 症例を実施し、評価基準・コメントを微調整
   - 途中確認は `scripts/read_live_sheet_jassess.mjs` で live の `C95` / `C99:C106` を読む
   - 任意で `C84:C87` の複数セル貼り付けでも onEdit を追加確認

---

## 変更履歴

| 日付 | 内容 | commit |
|---|---|---|
| 2026-03-25 | `saveToHistory()` 実機確認 PASS。評価履歴で `E0001` / `TEST` / 判定文一致 / 評価まとめ一致を確認し、残件を `C84:C87` 複数貼り付け確認のみに整理 | （このコミット） |
| 2026-03-25 | service account 共有後、live `腰痛評価入力` から `C95` / `C99:C106` の直接読取に成功。ローカル正本へ反映し、再利用用スクリプトと access メモを整備 | （このコミット） |
| 2026-03-25 | TC-EMPTY03 PASS。`C11=3か月以上` + NRS/RMDQ/STarT 空欄で `機能改善・セルフケア習慣化` と `【スコア】（スコア未入力）` を確認 | （このコミット） |
| 2026-03-25 | `C42:C51` / `C56:C64` の複数セル貼り付けでも自動更新を確認。既知リスクは縮小し、`C84:C87` は任意の追加確認項目へ変更 | （このコミット） |
| 2026-03-25 | onEdit トリガー1本確認・`refreshInputSheetC33Formula()` 実行・TC-J01 1症例で `C95` / `C99:C106` 自動更新確認 PASS | （このコミット） |
| 2026-03-25 | TC-J01・TC-J01b PASS確認 → Phase 1 実機確認完了 | （このコミット） |
| 2026-03-25 | TC-J01b 不一致の根本原因特定・C52/C65 数式修正（COUNTIF→空欄ガード付き）・LOGIC.md/TESTCASES.md/PROJECT_STATUS.md 更新 | 8793fcf |
| 2026-03-24 | TC-J02〜J10 PASS記録・PROJECT_STATUS.md 実機確認メモ整理 | 5071d46 |
| 2026-03-24 | openById()修正・C88転倒リスク数式修正・実機確認WIPメモ追加 | be90df3 |
| 2026-03-24 | clasp リンク設定・appsscript.json 追加・Apps Script へ push（3ファイル反映） | dc12d6d |
| 2026-03-24 | 実機確認準備（TC-J 設計検証・期待値訂正・入力パターン表・onEdit ガイド） | 623558d |
| 2026-03-24 | Phase 1 ルールベース判定ロジック実装（logic_engine.js 新規 / LOGIC.md / TESTCASES.md 更新） | 08e4d3e |
| 2026-03-24 | TESTCASES.md 新規作成・TC-H01〜H05 PASS 記録 | 117e097 |
| 2026-03-24 | 動作評価まとめ判定バグ修正（全正常→正常・重症度ベース4段階） | 850e7ad |
| 2026-03-24 | Phase 1 セットアップ完了・スプレッドシートID記録 | 823f8e9 |
| 2026-03-23 | JASSESS-01 / msk-assessment-platform へ再整理 | 14a1cad |
| 2026-03-23 | プロジェクト新規作成（旧JEVAL-01） | ac5fb10 |


## 2026-03-24 実機確認メモ

### PASS 確認済み（TESTCASES.md 記録済み）— **全ケース完了**
| TC | 結果 | 確認日 |
|---|---|---|
| TC-EMPTY01 | PASS | 2026-03-24 |
| TC-EMPTY02 | PASS | 2026-03-24 |
| TC-J01（CHRONIC+STarT低） | PASS | 2026-03-25 |
| TC-J01b（CHRONIC+STarT未入力） | PASS | 2026-03-25 |
| TC-J02（馬尾緊急） | PASS | 2026-03-24 |
| TC-J03（赤旗） | PASS | 2026-03-24 |
| TC-J04（神経症状重度） | PASS | 2026-03-24 |
| TC-J05（神経根障害） | PASS | 2026-03-24 |
| TC-J06（行動変容・NRS中） | PASS | 2026-03-24 |
| TC-J07（行動変容・NRS低） | PASS | 2026-03-24 |
| TC-J08（疼痛管理優先） | PASS | 2026-03-24 |
| TC-J09（急性期管理） | PASS | 2026-03-24 |
| TC-J10（機能改善・運動療法） | PASS | 2026-03-24 |

### 発見した不具合・修正済み
| 不具合 | 対応 |
|---|---|
| `runLogicAll()` が standalone GAS で動かない（`getActiveSpreadsheet()` 取得不全） | `openById()` に変更・反映済み（be90df3） |
| `C88` 転倒リスク数式：空欄でも「高」判定になる | `AND(C84<>"",C84<>"自立")` に修正済み（be90df3） |

### 発見した不具合・修正済み（追記 2026-03-25）
| 不具合 | 対応 |
|---|---|
| `C52`（RMDQ合計）・`C65`（STarT合計）が全空欄でも `0` を返し `START_LOW=true` になる | `COUNTIF` → `IF(COUNTA=0,"",COUNTIF)` に修正（`setup_sheets.js` 修正済み） |
| TC-J01b 実機結果が branch12（運動療法開始）になり期待値 branch14 と不一致 | C52/C65 数式修正後に再確認済み。2026-03-25 に branch14「機能改善・セルフケア習慣化」で PASS 反映完了 |
| `generateComments()` の `C103` で `flags.NRS_HIGH || flags.ACUTE` が同一分岐になり、慢性高疼痛でも急性期寄り文面になる | `logic_engine.js` の C103 分岐を `ACUTE + NRS_HIGH` / `CHRONIC + NRS_HIGH` / `ACUTE` / `NRS_HIGH` に分割。`judgeOverallPolicy()` と `C95` は変更なし。TC-J08 PASS 実績は維持、TC-J09 の急性期文面方針も維持 |

### 未完了
| 項目 | 状況 |
|---|---|
| 実臨床テスト（5〜10症例） | 開始可。5〜10 症例で評価基準・コメントの妥当性を微調整する |
| `clearInputSheet()` | UI-less 実行対応済み（`zz_clear_input_override.js`）。継続して spreadsheet UI からの使用を基本とする |
| onEdit の複数セル貼り付け取りこぼし | `C42:C51` / `C56:C64` の複数セル貼り付けでは再現せず自動更新を確認済み。任意残件は `C84:C87` のみで、現時点では既知重大リスクではない |

### 次に最初にやること
1. 実臨床テスト 5〜10 症例を開始
2. 各症例で `C95` / `C99:C106` の妥当性をメモし、過不足のある文言を洗い出す
3. live 再確認が必要なときは `node scripts/read_live_sheet_jassess.mjs` を実行する
4. 任意で `saveToHistory()` 1回確認と `C84:C87` への複数セル貼り付け確認を行う

---

## 2026-03-26 位置づけ整理メモ

### 今回確定したこと

JASSESS-01 の臨床上の位置づけを、**慢性疼痛強化プロジェクトにおける「入口評価システム」**として明確化した。

また、従来進めていた運動療法初回評価との関係を整理し、以下の役割分担を採用した。

- **JASSESS-01 = 入口評価**
- **運動療法初回評価 = 介入設計評価**

### 追加した正本

臨床導線の正本として、`CLINICAL_FLOW.md` を新設した。
ここに以下を集約する。

- JASSESS-01 の位置づけ
- 運動療法初回評価との役割分担
- 慢性疼痛強化プロジェクトとの接続
- 実際の臨床フロー

### 記録方針

設計判断の理由は `DESIGN_DECISIONS.md` に記録し、
慢性疼痛強化プロジェクト全体との接続は `hirayama-jyusei-strategy/strategy/patient-flow.md` 側にも要点のみ反映する。

### 次回再開ポイント

次回は実臨床テストを再開し、症例レビューを通して、
この位置づけと分岐が現場で使いやすいかを確認する。

再開の合図:
`JASSESS-01 実臨床テスト再開：症例レビューから開始`
