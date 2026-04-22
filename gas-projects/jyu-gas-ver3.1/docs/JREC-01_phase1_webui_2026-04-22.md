# JREC-01 Phase 1 Web UI — 患者検索試作

実装日: 2026-04-22  
実機確認: **PASS（2026-04-22）**  
対象ブランチ: `feature/auto-dev-phase3-loop`

---

## 目的

GAS Web App を使い、スプレッドシートUIに依存しない患者検索画面を試作する。  
Phase 1 はシート書き込みなし・参照のみ。オーナーのみアクセス可能（`access: MYSELF`）。

---

## 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `Ver3_core.js` | `searchPatients_V3` / `doGet` を追加 |
| `patientSearch.html` | 新規作成（検索UI） |
| `appsscript.json` | `webapp` セクション追加（前セッションで実施済み） |

---

## 実装詳細

### `searchPatients_V3(keyword)`

- `SHEETS.master`（患者マスタ）を全件読み込み
- `buildHeaderColMap_` 相当の inline index map を構築
- 照合列: `患者ID` / `氏名` / `フリガナ` / `検索用`（lowercase partial match）
- 最大 20 件返却
- 戻り値: `{patientId, name, furi, birthday}[]`
- Logger: `[searchPatients] keyword="..." ヒット=N件`

### `doGet(e)`

- `HtmlService.createHtmlOutputFromFile("patientSearch")` を返す
- `ALLOWALL` XFrameOptions（ブラウザ表示互換）

### `patientSearch.html`

- Vanilla HTML + inline CSS / JS（外部ライブラリなし）
- 検索入力 + 「検索」ボタン（Enter キー対応）
- `google.script.run.withSuccessHandler().searchPatients_V3(kw)` で非同期呼び出し
- 結果テーブル: 患者ID / 氏名・フリガナ / 生年月日
- 0件・ローディング・エラー状態表示あり
- モバイル対応（`viewport` / `flex` レイアウト）

---

## デプロイ手順

1. `clasp push` でコードをアップロード
2. GAS エディタ → デプロイ → 新しいデプロイ → 種類: ウェブアプリ
   - 次のユーザーとして実行: **自分（オーナー）**
   - アクセスできるユーザー: **自分のみ**
3. 発行された URL をブラウザで開いて動作確認

---

## 確認手順

1. 患者マスタに患者データが2行以上あること
2. Web App URL にアクセス
3. 患者ID の一部（例: `P0`）を入力して「検索」
4. 結果テーブルが表示されること
5. 存在しないキーワードで「該当する患者が見つかりませんでした。」が表示されること
6. GAS ログで `[searchPatients] keyword="..." ヒット=N件` を確認

---

## Phase 2 以降の予定

| Phase | 内容 |
|---|---|
| Phase 2 | 来院登録フォーム（doPost / 書き込みあり）|
| Phase 3 | 月次集計・PDF出力の Web 化 |

詳細は `docs/JREC-01_WebUI_段階移行設計_2026-04-22.md` を参照。
