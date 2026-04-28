# JREC-01 TEMPLATE_INDEX

作成日: 2026-04-04
用途: JREC-01 のテンプレート正本台帳。**ここに載っていないコピーは正本扱いしない。**

---

## 1. 申請書テンプレート

| 項目 | 内容 |
|---|---|
| テンプレ種別 | 療養費支給申請書（B案 Cloud Run） |
| 正本 repo パス | `C:\hirayama-ai-workspace\workspace\gas-projects\jyu-gas-ver3.1\application_template.xlsx` |
| 正本ファイル | `application_template.xlsx` |
| 実行時の使用場所 | Cloud Run コンテナのアプリ作業ディレクトリ直下 `./application_template.xlsx` |
| 実装参照 | `write_application.py` の `TEMPLATE_FILE = "application_template.xlsx"` / `Dockerfile` の `COPY server.py write_application.py application_template.xlsx ./` |
| 構造検査 | `inspect_merges.py` |
| 成果物保存先 | `JREC-01_月次出力/YYYY-MM/01_申請書/` |
| 旧版退避先 | `JREC-01_月次出力/YYYY-MM/90_再生成旧版/` |
| 修正時の必須作業 | **Cloud Run 再ビルド・再デプロイ** + 再生成結果の目視確認 |
| 運用メモ | 過去に日本語ファイル名で Cloud Build 失敗があったため、現行テンプレ実体名は ASCII を維持 |

### 変更履歴

| 日付 | 内容 |
|---|---|
| 2026-03-21 | 現行 `application_template.xlsx` を Cloud Run 同梱テンプレとして運用 |
| 2026-04-04 | 成果物保存先を `01_申請書`、旧版退避先を `90_再生成旧版` として台帳化 |

---

## 2. 施術録テンプレート

| 項目 | 内容 |
|---|---|
| テンプレ種別 | 施術録 Google Docs MASTER |
| MASTER ファイル名 | `施術録様式参考例` |
| 現行 Template ID | `1Tcq8kcwFfIzFixGF54xFoWyZcNz7IsgjYsT8NqV0mnY` |
| 現行 親フォルダ ID | `1XMx2e1ufCRqp7bhpfRRjvPDyXCESL83V` |
| 実行時参照元 | `srResolveTemplateId_(ss)` が返す Template ID の Drive ファイルを `DriveApp.getFileById(templateId).makeCopy(...)` で複製 |
| 実装参照 | `Ver3_shuRecorder.js` の `srResolveTemplateId_()` / `srDuplicateTemplate_()` |
| 設定キー | `設定!A:B` の `施術録テンプレートID`（未設定時は `SR_TEMPLATE_ID = 1Tcq8kcwFfIzFixGF54xFoWyZcNz7IsgjYsT8NqV0mnY` fallback） |
| 成果物保存先 | `JREC-01_月次出力/YYYY-MM/02_施術録/` |
| 旧版退避先 | `JREC-01_月次出力/YYYY-MM/90_再生成旧版/` |
| 修正時の必須作業 | **Google Docs MASTER 1本だけを編集** → `clasp push` → 1患者で再生成・目視確認 |
| 設計書 | `docs/施術録導線/JREC-01_施術録実装設計.md` |

### 変更履歴

| 日付 | 内容 |
|---|---|
| 2026-04-02 | Google Docs テンプレート方式で WS-SR 実装開始 |
| 2026-04-04 | Template ID を設定シート優先へ拡張し、成果物保存先/旧版退避先を台帳化 |

---

## 3. 参照 docs

| docs | 内容 |
|---|---|
| `docs/JREC-01_出力物テンプレート管理.md` | 出力物/テンプレ分離の運用ルール正本 |
| `docs/JREC-01_月次運用フロー.md` | 申請書 B案の月次生成・再生成・Cloud Run 再デプロイ手順 |
| `docs/施術録導線/JREC-01_施術録導線_設計方針.md` | WS-SR の位置づけと Dashboard 反映方針 |
| `docs/施術録導線/JREC-01_施術録実装設計.md` | 施術録テンプレート/出力ロジック詳細 |
| `docs/JREC-01_申請書様式運用メモ.md` | 申請書テンプレの様式差分・位置調整メモ |
