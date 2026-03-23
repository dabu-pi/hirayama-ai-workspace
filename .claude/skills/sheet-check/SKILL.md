---
name: sheet-check
description: Google Sheets の列・数式・入力規則を変更する作業の前後チェックを標準化する。before モードで7ステップ事前確認、after モードで完了報告テンプレを生成する。
argument-hint: "-Phase <before|after> -Sheet <シート名>"
allowed-tools: Read, Grep, Bash
---

# sheet-check — スプレッドシート作業チェック

**用途:** Google Sheets の列・数式・入力規則を変更する作業の前後チェックを標準化する。

---

## before モード（作業前）

`/sheet-check -Phase before -Sheet <シート名>` で起動。

CLAUDE.md の「作業開始前の必須確認」7ステップを実行し、各ステップの確認結果を報告する。

| # | 確認項目 | 確認内容 |
|---|---|---|
| 1 | 最新ブランチ確認 | `git status` — 未プッシュ変更の有無 |
| 2 | CLAUDE.md | 作業ルール・禁止事項を確認 |
| 3 | README_SHEETS.md | シート構造・操作ルールを確認 |
| 4 | SHEET_DESIGN.md | 列設計・数式設計を確認 |
| 5 | *_STATUS.md | 現状・差分・未解決論点を確認 |
| 6 | 現物確認 | docs と現物の差分有無をユーザーに確認 |
| 7 | 差分解消 | 差分があれば先に STATUS.md 更新を促す |

**チェック通過条件:** 7ステップすべて「確認済み」または「問題なし」になること。
差分がある場合は作業を中断し、STATUS.md 更新・コミットを先に行うよう指示する。

---

## after モード（作業後）

`/sheet-check -Phase after -Sheet <シート名>` で起動。

以下の完了報告テンプレートを生成して出力する（自動で埋められる部分は埋める）。

```
【作業開始前 Sheets確認】済
【確認した対象シート名】<シート名>
【作業前差分】あり（内容: ） / なし
【反映した Sheets差分】
【変更したシート名】<シート名>
【変更した列】追加: / 変更: / 削除: / 移動:
【数式変更】あり（内容: ） / なし
【入力規則変更】あり / なし
【注意書き変更】あり / なし
【更新した md ファイル名】
【最終整合状態】Sheets / docs 整合済み / 未整合（理由: ）
```

---

## 使用例

```
/sheet-check -Phase before -Sheet 保険・来院前提
/sheet-check -Phase after -Sheet KPI目標
```
