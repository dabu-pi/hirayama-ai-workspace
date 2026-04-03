# JREC-01 出力物 / テンプレート分離管理ルール

作成日: 2026-04-04
ステータス: **repo 正本・docs 正本の整理完了 / live Drive フォルダ反映は手動確認待ち**

---

## 0. 目的

JREC-01 の「テンプレート正本」と「月次成果物」を分離し、申請書・施術録のどちらを直すときも **どのファイル/どのマスターを触るべきか迷わない状態** にする。

今回の結論:
- **テンプレート正本** = 申請書テンプレ xlsx 正本 / 施術録 Google Docs MASTER
- **成果物** = 月次出力フォルダ配下の申請書 xlsx / 施術録 GDocs + PDF / 再生成旧版
- **日次データ正本** = 来院ヘッダ / 施術明細 / 患者マスタ / 初検情報履歴

---

## 1. 現状調査結果

### 1-1. 申請書テンプレート・出力ロジック

| 項目 | 現在地 | 役割 / 現状 |
|---|---|---|
| Python帳票転記 | `write_application.py` | `TEMPLATE_FILE = "application_template.xlsx"` をロードし、Cloud Run コンテナ内で申請書 xlsx を生成 |
| 申請書テンプレ xlsx | `application_template.xlsx` | Cloud Run Docker イメージに同梱される申請書テンプレート正本 |
| Docker 同梱定義 | `Dockerfile` | `COPY server.py write_application.py application_template.xlsx ./` |
| テンプレ構造確認 | `inspect_merges.py` | `TEMPLATE = "application_template.xlsx"` |
| 申請書出力メニュー | `Ver3_transferData.js` | `V3TR_menuGenerateApplication_B()` が Cloud Run `/generate` を呼び、Drive 保存する |
| 出力ルート設定 | `Ver3_transferData.js` | `設定` シート `出力フォルダID` を優先、なければスプレッドシート親フォルダ / Drive ルート |
| 旧月別出力 | `Ver3_transferData.js` | 旧実装は `output/YYYY-MM/` または親フォルダ直下 `YYYY-MM/` 相当 |

### 1-2. 施術録テンプレート・出力ロジック

| 項目 | 現在地 | 役割 / 現状 |
|---|---|---|
| 施術録生成 GAS | `Ver3_shuRecorder.js` | Google Docs テンプレート複製 → 表面/裏面差し込み → PDF 出力 |
| 施術録テンプレートID | `Ver3_shuRecorder.js` | 旧実装は `SR_TEMPLATE_ID` 直書き。今回 `設定!A:B` の `施術録テンプレートID` 優先に変更 |
| 施術録出力ルートID | `Ver3_shuRecorder.js` | 旧実装は `SR_ROOT_FOLDER_ID` 直書き。今回 `設定!A:B` の `出力フォルダID` 優先に変更 |
| 旧施術録出力階層 | `Ver3_shuRecorder.js` | 旧実装は `施術録/YYYY-MM/` |
| テンプレ設計書 | `docs/施術録導線/JREC-01_施術録実装設計.md` | Template ID / 出力先 / 再生成時挙動を記録 |
| 技術検証メモ | `docs/施術録導線/JREC-01_施術録GDocs技術検証.md` | 現時点の Google Docs テンプレート正本IDと構造確認 |

### 1-3. 既存 docs の関連箇所

| docs | 現状 |
|---|---|
| `docs/JREC-01_月次運用フロー.md` | 申請書再生成条件 / Cloud Run 再デプロイ条件 / 旧版手動削除ルールを記載 |
| `docs/施術録導線/JREC-01_施術録導線_設計方針.md` | WS-SR のプロジェクト境界・Dashboard反映方針を記載 |
| `docs/施術録導線/JREC-01_施術録実装設計.md` | 施術録テンプレID・出力先・再生成挙動を記載 |
| `docs/JREC-01_申請書様式運用メモ.md` | 申請書テンプレの様式判断・楕円位置調整方針を記載 |
| `PROJECT_STATUS.md` | WS-SR と申請書 B案の最新到達点を管理 |

---

## 2. 標準フォルダ構造

### 2-1. 月次成果物

Drive 側の成果物はこの棚に統一する。

```text
JREC-01_月次出力/
  YYYY-MM/
    01_申請書/
    02_施術録/
    90_再生成旧版/
```

### 2-2. テンプレート集

テンプレート正本は成果物棚と分離して管理する。

```text
JREC-01_テンプレ集/
  01_申請書テンプレ/
    application_template_MASTER.xlsx
    README_申請書テンプレ.md
    old/
  02_施術録テンプレ/
    施術録様式参考例_MASTER
    README_施術録テンプレ.md
    old/
  TEMPLATE_INDEX.md
```

repo 上の台帳は `docs/JREC-01_TEMPLATE_INDEX.md` を正本とする。
Drive 上の Google Docs 実体は `docs/JREC-01_TEMPLATE_INDEX.md` に ID を記録し、複数コピーを正本扱いしない。

---

## 3. 何が正本か / 何が成果物か

| 区分 | 正本 | 成果物 |
|---|---|---|
| 日次運用データ | スプレッドシートの `来院ヘッダ` / `施術明細` / `患者マスタ` / `初検情報履歴` | なし |
| 申請書テンプレート | repo の `application_template.xlsx`（現行 Cloud Run 同梱ファイル） + 台帳 `docs/JREC-01_TEMPLATE_INDEX.md` | `JREC-01_月次出力/YYYY-MM/01_申請書/申請書_*.xlsx` |
| 施術録テンプレート | Google Docs MASTER 1本（Template ID は `docs/JREC-01_TEMPLATE_INDEX.md` と `設定!施術録テンプレートID` で管理） | `JREC-01_月次出力/YYYY-MM/02_施術録/施術録_*` と `施術録_*.pdf` |
| 再生成旧版 | なし | `JREC-01_月次出力/YYYY-MM/90_再生成旧版/` |
| コード正本 | `Ver3_transferData.js` / `Ver3_shuRecorder.js` / `Ver3_outputManager.js` / `write_application.py` | clasp push 後の GAS 実体 / Cloud Run デプロイ済みイメージ |

---

## 4. テンプレート修正時の必須作業

### 4-1. 申請書テンプレートを修正したとき

必須:
1. `application_template.xlsx` を更新する
2. `docs/JREC-01_TEMPLATE_INDEX.md` の更新日・変更点を更新する
3. **Cloud Run を再ビルド・再デプロイする**
4. `docs/JREC-01_月次運用フロー.md` の手順で申請書を再生成し、目視確認する
5. `PROJECT_STATUS.md` にテンプレ修正内容・デプロイ結果・目視確認結果を残す

理由:
- `application_template.xlsx` は Docker イメージに同梱されている
- `write_application.py` / `server.py` と同じく、**clasp push だけでは反映されない**

### 4-2. 施術録テンプレートを修正したとき

必須:
1. **Google Docs の MASTER 1本だけを編集する**
2. Template ID を変えた場合だけ `設定!A:B` の `施術録テンプレートID` を更新する
3. `docs/JREC-01_TEMPLATE_INDEX.md` の Template ID / 更新日 / 変更点を更新する
4. `clasp push` 後、施術録を再生成して出力GDocs/PDFを目視確認する
5. `PROJECT_STATUS.md` と `docs/施術録導線/JREC-01_施術録実装設計.md` に差分を残す

禁止:
- Google Docs MASTER を複数コピーして「どれが正本かわからない」状態にすること
- 出力済みの月次成果物をテンプレ正本として編集すること

---

## 5. 再生成時の旧版退避ルール

### 5-1. 申請書

- 新規保存先: `JREC-01_月次出力/YYYY-MM/01_申請書/`
- 再生成前に、同一患者・同一対象月の旧 `申請書_{患者ID}_{YYYY-MM}_*.xlsx` を `90_再生成旧版/` へ退避する
- 退避ファイル名は `_旧_yyyyMMdd-HHmmss_{fileId8}` を付けて衝突を避ける
- 旧版を即削除しない。最終版確定後に人間がまとめて整理する

### 5-2. 施術録

- 新規保存先: `JREC-01_月次出力/YYYY-MM/02_施術録/`
- 同名の旧 Google Docs / PDF がある場合、上書き前に確認ダイアログを出す
- YES のときだけ旧版を `90_再生成旧版/` へ退避し、新しいテンプレ複製から再生成する
- NO のときは生成を中止し、既存成果物を残す

---

## 6. 出力先解決の共通小設計

今回 `Ver3_outputManager.js` を追加し、申請書・施術録で共通のフォルダ解決ルールを持たせた。

### 6-1. 共通関数

| 関数 | 役割 |
|---|---|
| `V3OUT.getOrCreateMonthlyOutputRootFolder_(ss, legacyFallbackFolderId)` | `設定!出力フォルダID` → legacy fallback → SS親フォルダ → Drive ルート の順で基準フォルダを解決し、その配下に `JREC-01_月次出力` を確保 |
| `V3OUT.getOrCreateMonthlyOutputFolder_(ss, ym, legacyFallbackFolderId)` | `JREC-01_月次出力/YYYY-MM/` を取得/作成 |
| `V3OUT.getOrCreateDocTypeFolder_(ss, ym, 'application'|'shuroku', legacyFallbackFolderId)` | `01_申請書` / `02_施術録` の保存先を取得/作成 |
| `V3OUT.getOrCreateArchiveFolder_(ss, ym, legacyFallbackFolderId)` | `90_再生成旧版` を取得/作成 |
| `V3OUT.archiveFilesByExactName_()` / `V3OUT.archiveFilesByPrefix_()` | 再生成前の旧版退避 |

### 6-2. 呼び出し側

| 呼び出し元 | 変更内容 |
|---|---|
| `Ver3_transferData.js` | 申請書 xlsx と NDJSON を `01_申請書` へ保存し、同一患者・同一月の旧 xlsx を `90_再生成旧版` へ退避 |
| `Ver3_shuRecorder.js` | 施術録 GDocs/PDF を `02_施術録` へ保存し、同名旧版を `90_再生成旧版` へ退避。Template ID は `設定!施術録テンプレートID` 優先 |

---

## 7. repo 実装の今回スコープ / 非対応範囲

### 今回やったこと

- 共通フォルダ解決・旧版退避ヘルパー `Ver3_outputManager.js` を追加
- 申請書 B案の保存先を `01_申請書` へ寄せ、旧版退避を追加
- 施術録 WS-SR の保存先を `02_施術録` へ寄せ、旧版トラッシュ削除から旧版退避へ変更
- 施術録 Template ID を設定シート優先に変更
- 出力物/テンプレ分離ルールを docs 正本化

### 今回あえて残したこと

- live Google Drive 上の既存フォルダ移動・既存成果物の一括整理は **未実施**
- `application_template.xlsx` の物理配置移動は **未実施**
  - 理由: 過去に日本語ファイル名で Cloud Build 失敗があり、Docker build context のパス変更は別途安全確認が必要
  - まずは「成果物保存先の共通化」と「テンプレ正本/成果物のルール分離」を優先した
- 施術録 Google Docs MASTER の Drive 側フォルダ再配置は **未実施**
  - ただし Template ID は設定化したため、Drive 側整理後に `設定!施術録テンプレートID` を差し替え可能

---

## 8. 次の一手

1. live スプレッドシートの `設定` シートで `出力フォルダID` と `施術録テンプレートID` の値を確認/追記する
2. `clasp push` 後、申請書 B案と施術録 WS-SR を 1患者・1月で再生成し、Drive に新フォルダ構造ができるか確認する
3. Drive 上で `JREC-01_テンプレ集` を作り、施術録 MASTER をその棚へ移動したうえで Template ID が変わらないことを確認する
4. `application_template.xlsx` の repo 物理移動は Cloud Run build 検証を挟んで別タスクで実施する

---

## 9. 変更履歴

| 日付 | 内容 |
|---|---|
| 2026-04-04 | 初版作成。現状調査結果、正本/成果物の定義、テンプレ修正時の必須作業、旧版退避ルール、共通出力フォルダ設計を整理 |
