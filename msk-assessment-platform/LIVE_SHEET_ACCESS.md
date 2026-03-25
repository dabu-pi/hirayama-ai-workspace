# LIVE_SHEET_ACCESS.md — JASSESS-01

最終更新: 2026-03-25

---

## 方針

- **正本はローカル**（この workspace 内のファイル）
- live Google Sheet は実機確認・運用確認のための参照先
- live で確認した内容は、必要なものだけローカル正本へ反映する

---

## 対象

| 項目 | 内容 |
|---|---|
| Spreadsheet ID | `1sj6dYtkFbnk4fjLOk764f-w7KUUeGNVYcbMDOg26OXY` |
| Spreadsheet title | `平山接骨院_運動器初期評価システム_JASSESS-01` |
| Main input sheet | `腰痛評価入力` |
| Apps Script ID | `1EuUnfTRIEZ_0VYib_d8hdAE-EPRkng-ZBdwICrJDFuXX3TEKOdvyeTyK` |

---

## 認証

- service account ファイル:
  - `C:\hirayama-ai-workspace\workspace\secrets\service_account.json`
- 共有先メール:
  - `id-719@e-carte-448107.iam.gserviceaccount.com`
- 必要権限:
  - 通常の読取確認は `閲覧者` で十分
  - 将来書込み確認が必要なら `編集者`

---

## 再利用スクリプト

### 推奨

```powershell
node scripts/read_live_sheet_jassess.mjs
```

### JSON 出力

```powershell
node scripts/read_live_sheet_jassess.mjs --json true
```

### 既存 inspector

```powershell
node scripts/inspect-jassess-live-sheet.mjs
```

---

## 取得対象

`scripts/read_live_sheet_jassess.mjs` は最低限以下を取得する。

- `C95`
- `C99:C106`

あわせて次も取得する。

- `C3:C4`
- `C11:C93`

---

## 2026-03-25 確認結果

- service account 共有後、live Google Sheet 読取に成功
- `腰痛評価入力` シートの `C95` / `C99:C106` を直接取得できることを確認
- live 値は `TC-EMPTY03` 相当の状態と整合
  - `C95 = 機能改善・セルフケア習慣化 — 再発予防を見据えた運動療法と生活指導`
  - `C99` のスコア行 = `【スコア】（スコア未入力）`
- 結論:
  - JASSESS-01 は **実臨床テスト開始可**

---

## 任意残件

- `saveToHistory()` を実症例で 1 回だけ確認
- `C84:C87` の複数セル貼り付けでも onEdit 自動更新するか追加確認

---

## 運用メモ

- live シートが clear 直後だと、読取結果は空欄になる
- 空欄でも読取経路自体が正常ならスクリプトは有効
- 正本更新が必要なときは、必ずこの workspace 側の markdown / script を更新する
