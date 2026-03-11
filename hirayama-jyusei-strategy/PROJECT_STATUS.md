# PROJECT_STATUS.md — 平山接骨院 経営戦略プロジェクト

最終更新: 2026-03-11

---

## 現在地

- プロジェクト: 平山接骨院 経営戦略プロジェクト
- ディレクトリ: `hirayama-jyusei-strategy/`
- 状態: ドキュメント整備済み・実装準備中
- 主軸: 慢性疼痛特化の整骨院 × ジム モデル

---

## 概要

経営戦略、商品設計、集患導線、業務導線、利益構造を文書化し、
将来的に AI 分析や Google Sheets と連携して提案生成へつなげるプロジェクト。

---

## 完了済み

- `STRATEGY_ONE_PAGE.md` に上位方針を整理
- `ROADMAP.md`、`NEXT_ACTIONS.md`、`SPEC.md` を整備
- `strategy/`、`menu/`、`operations/`、`marketing/`、`finance/` の文書群を作成
- `README_SHEETS.md`、`SHEET_DESIGN.md`、`gas_spreadsheet_setup.js` を整備

---

## 次アクション

- `finance/` 配下の数値を実数値で埋める
- シート設計と現場運用の整合を確認する
- Claude / Codex で再利用しやすい入力データと出力形式を固める
- AI分析フェーズに入る前提条件を明文化する

---

## 保留事項

- 固定費、変動費、設備投資額、月次売上の確定が必要
- 実データ投入前は分析自動化に進まない
- AI出力のテンプレートと評価基準は今後の詰めが必要

---

## テスト状況

- コード中心のプロジェクトではなく、現時点では文書・設計確認が中心
- スプレッドシート設計は人手での運用確認が必要

---

## 重要ファイル

- `README.md`
- `STRATEGY_ONE_PAGE.md`
- `ROADMAP.md`
- `NEXT_ACTIONS.md`
- `IMPLEMENTATION_LINK.md`
- `SPEC.md`
- `README_SHEETS.md`
- `SHEET_DESIGN.md`

---

## 再開メモ

作業再開時は、まず `STRATEGY_ONE_PAGE.md` を読み、その後 `ROADMAP.md` と `NEXT_ACTIONS.md` を確認する。
設計変更を行う場合は、下位文書が上位方針とずれていないかを必ず見直す。
