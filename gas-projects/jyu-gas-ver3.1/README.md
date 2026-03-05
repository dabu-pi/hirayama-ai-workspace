# 柔整GASプロジェクト Ver3.1

柔道整復師（接骨院）の患者管理・保険請求業務を支援するGoogle Apps Scriptシステム。

## ステータス

稼働中（Ver3.1）

## 目的

- 来院受付・施術内容の登録
- 保険算定ルールに基づく金額自動計算
- 窓口会計（患者負担額の算出）
- 療養費支給申請書の自動生成

## ファイル構成

| ファイル | 役割 |
|---|---|
| `Ver3_core.js` | メインロジック（来院登録・区分判定） |
| `Ver3_amounts.js` | 金額計算（初検料・後療料・加算） |
| `Ver3_transferData.js` | 申請書へのデータ転記 |
| `Ver3_patientPicker.js` | 患者選択UI |
| `write_application.py` | 療養費支給申請書の生成（Python） |
| `appsscript.json` | GASプロジェクト設定 |
| `SPEC.md` | 金額計算仕様書 |
| `PLAN.md` | 開発計画 |
| `TESTCASES.md` | テストケース一覧 |

## 技術構成

- **言語:** Google Apps Script (JavaScript) / Python
- **プラットフォーム:** Google スプレッドシート
- **バージョン管理:** clasp + GitHub

## 算定ロジック概要

1. 30日ルール判定（31日超で初検リセット）
2. 受傷日経過日数による加算可否判定
3. 区分確定（初検 / 再検 / 後療）
4. 患者×月 上限制御
5. 多部位逓減（3部位目60%、4部位目以降算定不可）
6. 長期減額（5か月超75%、長期+頻回50%）

## 関連ドキュメント

- [SPEC.md](./SPEC.md) — 金額計算仕様
- [PLAN.md](./PLAN.md) — 開発計画
- [TESTCASES.md](./TESTCASES.md) — テストケース
