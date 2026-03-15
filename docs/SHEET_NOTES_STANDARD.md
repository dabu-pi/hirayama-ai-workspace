# SHEET_NOTES_STANDARD.md

Google Sheets の説明文・注釈・更新メモ追記に関する workspace 標準。
対象は「説明・注釈・運用メモ系」のみとし、主要表や計算セルを壊さず再実行できる方式を統一する。

---

## 目的

- 説明文・注釈・更新メモ追記を案件ごとの場当たり実装にしない
- Codex / Claude Code が同じ方式で再開・横展開できるようにする
- live シートへ安全に再適用できる最小方式を維持する

## 使う対象

- シート右側や空きスペースへの「このシートの役割」説明
- 運用上の更新メモ
- 既存表を補足する短い注釈

## 使わない対象

- 主要表そのものの再構築
- 計算セル・入力セル・入力規則の変更
- 大きなレイアウト変更
- データ投入や KPI 更新そのもの

## 標準方式

- `common engine + config + 薄い wrapper` を標準とする
- engine は `scripts/sheets/` 配下に置く
- 案件固有の文面・色・対象シート・参照セルは案件側 config に置く
- 実行入口は案件名付き wrapper を残してよいが、処理本体は共通 engine に寄せる

## 必須要件

- `dry-run` があること
- upsert 方式で再実行安全であること
- 対象シート限定実行ができること
- 既存の主要表・主要計算セルを壊さないこと

## 運用ルール

- まず空きスペースを確認してから配置する
- 既存タイトルがあれば同じ位置へ上書きし、なければ右側空き列を使う
- 横展開してよいのは「説明・注釈・運用メモ系」に限定する
- 構造変更や数式変更はこの標準の対象外とする

## 初回適用例

- JBIZ-04
  - engine: `scripts/sheets/apply-sheet-notes.mjs`
  - config: `hirayama-jyusei-strategy/config/jbiz04-sheet-notes.json`
  - wrapper: `scripts/apply-jbiz04-sheet-role-notes.mjs`
