# PROJECT_STATUS.md — 柔整GAS Ver3.1

最終更新: 2026-03-11

---

## 現在地

- プロジェクト: 柔整GASシステム Ver3.1
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

---

## 次アクション

- `TESTCASES.md` の観点でテスト通過確認を進める
- 算定ロジックの回帰確認を行う
- 申請書生成フローの実運用確認を行う

---

## 保留事項

- 実スプレッドシート上での最終確認状況は人手確認が必要
- 単価や算定条件の制度変更時は `SPEC.md` と設定シートの両方を見直す

---

## テスト状況

- テストケース文書: `TESTCASES.md` あり
- 自動テスト基盤: 明示なし
- 実運用前提の人手確認が重要

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

## 再開メモ

作業再開時は、まず `README.md`、`SPEC.md`、`TESTCASES.md` を確認し、次に対象ロジックの実装ファイルを読む。
制度変更や単価変更に関わる作業では、コードより前に仕様との整合を確認する。
