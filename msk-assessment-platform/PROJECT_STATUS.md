# PROJECT_STATUS.md — 運動器初期評価システム (JASSESS-01)

最終更新: 2026-03-24（実機確認準備完了 / TESTCASES.md TC-J 設計検証・入力パターン表・onEdit ガイド追加）

---

## 現在地

- **実機確認準備完了（2026-03-24）** ← 最新
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
| ステータス | Phase 1 実機確認中（TC-J01〜J10 未実施） |
| スプレッドシートID | **1sj6dYtkFbnk4fjLOk764f-w7KUUeGNVYcbMDOg26OXY** |
| Apps Script ID | **1EuUnfTRIEZ_0VYib_d8hdAE-EPRkng-ZBdwICrJDFuXX3TEKOdvyeTyK** |
| clasp 設定 | `gas/.clasp.json`（gitignore対象）/ `gas/appsscript.json`（コミット済み）|

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
| コメント自動生成（onEdit連携） | ⏸ 実機確認後に有効化（ロジックは実装済み / トリガー設定は手動） |
| **実機確認（TC-J01〜J10・TC-EMPTY）** | 🔄 **進行中**（TC-J02〜J10 PASS済 / TC-J01・TC-J01b 未実施） |
| 実臨床テスト（5〜10症例） | ⏸ 実機確認完了後 |

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
3. GAS実行済みかどうか確認（スプレッドシートIDが記録されているか）
4. Phase 1 未実施なら `gas/setup_sheets.js` を Apps Script エディタで実行
5. `TESTCASES.md` で確認済みテストを確認（TC-H01〜H05 PASS 済み）
6. `gas/logic_engine.js` で Steps 8〜10 の判定ロジック確認
7. **次アクション: 実機確認**
   - Apps Script エディタで `logic_engine.js` を貼り付け（または確認）
   - TESTCASES.md の「実機確認手順」に従って TC-J01〜J10・TC-EMPTY01〜03 を確認
   - 全 PASS 後に onEdit トリガーを設定（TESTCASES.md「onEdit 自動トリガーについて」参照）

---

## 変更履歴

| 日付 | 内容 | commit |
|---|---|---|
| 2026-03-24 | TC-J02〜J10 PASS記録・PROJECT_STATUS.md 実機確認メモ整理 | （このコミット） |
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

### PASS 確認済み（TESTCASES.md 記録済み）
| TC | 結果 |
|---|---|
| TC-EMPTY01 | PASS |
| TC-EMPTY02 | PASS |
| TC-J02（馬尾緊急） | PASS |
| TC-J03（赤旗） | PASS |
| TC-J04（神経症状重度） | PASS |
| TC-J05（神経根障害） | PASS |
| TC-J06（行動変容・NRS中） | PASS |
| TC-J07（行動変容・NRS低） | PASS |
| TC-J08（疼痛管理優先） | PASS |
| TC-J09（急性期管理） | PASS |
| TC-J10（機能改善・運動療法） | PASS |

### 発見した不具合・修正済み
| 不具合 | 対応 |
|---|---|
| `runLogicAll()` が standalone GAS で動かない（`getActiveSpreadsheet()` 取得不全） | `openById()` に変更・反映済み（be90df3） |
| `C88` 転倒リスク数式：空欄でも「高」判定になる | `AND(C84<>"",C84<>"自立")` に修正済み（be90df3） |

### 未完了
| 項目 | 状況 |
|---|---|
| TC-J01b（CHRONIC+STarT未入力） | 入力設定途中（C56を空欄化済み・C57〜C64が残り） |
| TC-J01（CHRONIC+STarT低） | 未着手 |
| `clearInputSheet()` | `getUi()` 起因でスタンドアロン不安定・未修正 |

### 次に最初にやること
1. C57〜C64 を空欄化
2. `runLogicAll()` 実行 → TC-J01b 確認
3. TC-J01 入力 → 確認
4. TESTCASES.md に TC-J01b・TC-J01 結果を記録
5. PROJECT_STATUS.md ステータスを「実機確認完了」に更新 → commit/push
