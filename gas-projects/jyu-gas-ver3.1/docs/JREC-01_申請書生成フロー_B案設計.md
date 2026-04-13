# JREC-01 申請書生成フロー B案 設計調査

作成日: 2026-03-19
ステータス: 設計調査完了 → MVP実装設計は `JREC-01_申請書生成B案_MVP実装設計.md` を参照

---

## 1. 現行フロー（As-Is）

```
[人間]  スプレッドシートのメニュー「一括JSON出力（月指定）」を実行
  ↓
[GAS]   転記データを NDJSON 形式で Drive に出力
        （transfer_batch_YYYY-MM.ndjson）
  ↓
[人間]  Drive から NDJSON をローカルにダウンロード
  ↓
[人間]  ローカルで python write_application.py --batch を実行
        （venv 起動 / PATH 確認 / Pillow 依存等の手順が必要）
  ↓
[Python] openpyxl でテンプレ xlsx にセル書き込み
  ↓
[人間]  JREC-01_月次出力/YYYY-MM/01_申請書/申請書_XXX_YYYY-MM_HHMMSS.xlsx を Excel で開いて確認
        → 問題なければ印刷・提出
```

**問題点:**
- ダウンロード → ローカル実行の 2ステップが毎月発生
- venv / Pillow / PATH のセットアップが PC 依存
- 別 PC での作業時に環境が揃っていないと詰まる
- 手順書なしでは操作者が迷う

---

## 2. B案 理想フロー（To-Be）

```
[人間]  スプレッドシートのメニュー「申請書を生成して Drive に保存」を実行
  ↓
[GAS]   転記データを NDJSON として生成
        → Cloud Run エンドポイントに POST
  ↓
[Cloud Run（Python）]
        NDJSON を受け取り、openpyxl でテンプレ xlsx に書き込み
        → 生成した xlsx を base64 エンコードして GAS に返す
  ↓
[GAS]   base64 を decode → Drive に xlsx として保存
        → 完了アラート（ファイル URL を通知）
  ↓
[人間]  Drive 上の申請書 xlsx を開いて確認 → 印刷・提出
```

**削減できる手順:**
| 現行 | B案 |
|---|---|
| NDJSON ダウンロード | 不要（GAS が直接渡す） |
| ローカル Python 実行 | 不要（Cloud Run が担う） |
| venv / 依存セットアップ | 不要（Cloud Run 側に封じ込め） |
| PC 依存の環境管理 | 不要（Cloud Run は常に同じ環境） |

**残る人間の操作（最小化後）:**
1. スプレッドシートメニューを実行（1クリック）
2. Drive 上のファイルを確認・印刷

---

## 3. 必要コンポーネント

| コンポーネント | 役割 | 既存資産流用可否 |
|---|---|---|
| GAS（Ver3_transferData.js）| NDJSON 生成 + UrlFetchApp POST + Drive 保存 | ✅ NDJSON 生成は流用可。POST / Drive 保存は追加実装 |
| Cloud Run（Python）| NDJSON 受信 → openpyxl → xlsx 返却 | ✅ write_application.py のロジック流用可 |
| 療養費支給申請書.xlsx（テンプレ）| Excel テンプレ | ✅ 現行のまま維持 |
| Drive フォルダ | 完成 xlsx の保存先 | ✅ 現行の出力フォルダ設定を流用 |

---

## 4. 設計論点

### 4-1. スプレッドシート側の操作 UI

| 項目 | 検討内容 |
|---|---|
| メニュー追加 | 「申請書を生成（B案）」メニューを GAS メニューに追加 |
| 月指定方法 | 既存の「月指定」ダイアログをそのまま流用するか、デフォルト当月で確認なし にするか |
| 実行中フィードバック | SpreadsheetApp.getUi().alert() で「生成中...」表示は不可（同期ブロックのため）。完了後アラートのみ現実的 |
| エラー表示 | Cloud Run がエラーを返した場合に alert() でメッセージ表示 |

### 4-2. Apps Script 側の役割

| 処理 | 内容 |
|---|---|
| NDJSON 生成 | 既存 `V3TR_menuBatchExportJson()` のロジックを流用 |
| POST | `UrlFetchApp.fetch(endpoint, {method:"post", payload:ndjson, ...})` |
| 認証 | Cloud Run を 認証あり or 認証なし で deploy するかで変わる（→ 未確定事項参照）|
| Drive 保存 | レスポンスの base64 を decode → `DriveApp.createFile()` |
| エラー処理 | HTTP ステータスが 2xx 以外なら alert() で通知 |

### 4-3. Python 側の役割

| 処理 | 内容 |
|---|---|
| エンドポイント | Flask または FastAPI で POST `/generate` を実装 |
| NDJSON 受信 | request.data または request.json から読み込み |
| xlsx 生成 | `write_application.py` の `main()` ロジックを関数化して呼び出し |
| テンプレ管理 | `療養費支給申請書.xlsx` を Cloud Run イメージに含める（ビルド時に COPY）|
| レスポンス | 生成 xlsx を base64 エンコードして JSON で返す |
| エラー時 | HTTP 4xx/5xx + エラーメッセージ JSON を返す |

**write_application.py の流用可否:**
- ✅ セルマッピング定数（CELL_MAP / INJURY_ROWS / PART_ROWS 等）はそのまま流用可
- ✅ `build_injury_rows()` / `build_shoryo_array()` 等のビルド関数は流用可
- ⚠️ `main()` は CLI 引数・ファイル読み込みを前提とした設計 → **関数化のリファクタが必要**
- ⚠️ ファイルパス操作（Downloads 検索 / output/ 保存）はサーバー用に変更が必要

### 4-4. データ受け渡し方式

| 案 | 内容 | メリット | デメリット |
|---|---|---|---|
| **案A（推奨）** | GAS が NDJSON を POST body に乗せる | 既存 NDJSON 生成ロジックをそのまま活用 | UrlFetchApp の payload サイズ上限（50MB）に注意 |
| 案B | GAS が Drive に NDJSON を置き → Cloud Run が Drive から取得 | GAS → Cloud Run の直接通信なし | Drive アクセス権管理が複雑。非同期になる |
| 案C | GAS が転記データシートの ID を渡し → Cloud Run が Sheets API で取得 | POST サイズ問題なし | Cloud Run に Sheets API 権限が必要 |

→ **案A を MVP とする。患者数は最大数十人/月のため POST サイズは問題なし。**

### 4-5. Drive への保存方式

| 項目 | 内容 |
|---|---|
| 保存先 | 既存 `V3TR_getOutputFolder_()` の出力フォルダ設定を流用 |
| ファイル名 | `申請書_YYYY-MM_生成日時.xlsx`（現行と同形式） |
| 既存ファイル | 同名があれば上書き or 別名保存（→ 未確定） |
| GAS での保存方法 | `DriveApp.createFile(name, blob, mimeType)` |

### 4-6. エラー時の戻し方 / 通知方法

| エラー種別 | 対応 |
|---|---|
| Cloud Run 到達不能 | GAS が UrlFetchApp 例外キャッチ → alert() でエラー通知 |
| NDJSON 不正 / 患者データなし | Cloud Run が 400 + エラーメッセージ → GAS が alert() |
| openpyxl 処理エラー | Cloud Run が 500 + スタックトレース → GAS が alert() |
| Drive 保存失敗 | GAS が例外キャッチ → alert() |

**原則: エラーは必ず人間に通知し、中途半端な状態で黙って終了しない。**

### 4-7. 監査ログ / 実行ログの残し方

| 対象 | 方法 |
|---|---|
| GAS 側 | `Logger.log()` + `console.log()` → Apps Script 実行ログ |
| Cloud Run 側 | `print()` / logging → Cloud Logging（GCP Console で確認可）|
| Drive 保存記録 | 既存 `_JSON出力` シートと同様に `_申請書生成ログ` シートに追記（任意）|
| Run_Log | 現行 `de` コマンドのログ方式と統合（任意・将来拡張）|

### 4-8. 既存 write_application.py の流用可否

| 対象 | 流用可否 | 備考 |
|---|---|---|
| セルマッピング定数群 | ✅ そのまま | CELL_MAP / INJURY_ROWS / PART_ROWS 等 |
| build 系関数群 | ✅ ほぼそのまま | ファイル I/O 部分を除く |
| main() | ⚠️ リファクタ必要 | CLI 前提 → 関数化（引数: ndjson文字列 / テンプレパス）|
| テンプレ xlsx | ✅ そのまま | Cloud Run イメージに COPY |
| TEMPLATE_FILE パス | ⚠️ 変更必要 | ローカルパス → コンテナ内パスに変更 |
| output/ 保存 | ❌ 不要 | Cloud Run では保存せず、呼び出し元（GAS）に返す |

### 4-9. セキュリティ / 認証の考え方

| 項目 | MVP案 | 将来案 |
|---|---|---|
| Cloud Run 認証 | **未確定**（下記参照） | IAM / OIDC |
| エンドポイント公開範囲 | 未確定 | VPC 内限定も可 |
| テンプレ xlsx の機密性 | 低（書式のみ） | 問題なし |
| NDJSON の機密性 | 中（患者氏名・保険情報含む）| HTTPS 通信が前提 |

---

## 5. 未確定事項（実装前に決めること）

| # | 項目 | 選択肢 / 検討内容 |
|---|---|---|
| 1 | **Cloud Run の認証方式** | (a) 認証なし（エンドポイント URL が秘密鍵代わり）/ (b) GCP サービスアカウント + OIDC トークン。MVP は (a) でもよいが、患者情報を POST するため (b) を推奨 |
| 2 | **Cloud Run の deploy 方法** | (a) GCP Console で手動 / (b) gcloud CLI / (c) Cloud Build CI |
| 3 | **テンプレ xlsx の管理場所** | (a) Cloud Run イメージに含める（ビルド時固定）/ (b) Drive から動的取得（更新が容易）|
| 4 | **同名ファイル上書きポリシー** | (a) 上書き（`trash()` → 新規）/ (b) タイムスタンプ付き別名保存 |
| 5 | **GAS メニューの月指定方法** | (a) 既存ダイアログを流用 / (b) デフォルト当月で確認なし |
| 6 | **Cloud Run のリージョン** | asia-northeast1（東京）推奨。コールドスタートを避けるなら最小インスタンス=1 に設定 |
| 7 | **write_application.py のリファクタ方針** | (a) 既存ファイルに Flask を追加 / (b) server.py を別ファイルで作成して write_application.py をインポート |
| 8 | **エラー時のロールバック** | Drive 保存後にエラーが発覚した場合の削除手順を設けるか |

---

## 6. MVP 構成

**MVP で実装する範囲（最小限）:**

```
1. write_application_server.py（新規）
   - Flask エンドポイント POST /generate
   - write_application.py をインポートして流用
   - 生成 xlsx を base64 で返す

2. Dockerfile（新規）
   - python:3.11-slim ベース
   - openpyxl / Pillow / Flask をインストール
   - 療養費支給申請書.xlsx を COPY

3. Ver3_transferData.js への追加（最小）
   - V3TR_menuGenerateApplication_B_() 関数追加
   - NDJSON 生成 → UrlFetchApp POST → Drive 保存

4. GAS メニュー登録（onOpen）
   - 「申請書を生成（B案）」をメニューに追加
```

**MVP で対象外にすること:**
- Cloud Run の認証（最初は URL 秘匿で運用。後で IAM 追加）
- 申請書生成ログシートへの追記
- 複数月対応（当月のみ）
- エラー時の自動リトライ

---

## 7. 将来拡張案

| 拡張 | 内容 |
|---|---|
| 認証強化 | Cloud Run を IAM 認証に変更。GAS が OIDC トークンを取得して POST |
| テンプレ動的取得 | テンプレ xlsx を Drive から取得 → 書式変更時にコンテナ再ビルド不要 |
| 生成ログ | `_申請書生成ログ` シートに患者・日時・ファイルURL を記録 |
| 複数月対応 | 月指定ダイアログで過去月も生成可能に |
| 進捗表示 | サイドバー UI で生成状況をリアルタイム表示（HtmlService） |
| 自動差分チェック | 生成後に前月比較して異常な金額変動があれば警告 |

---

## 8. 推奨実装順（確定事項が揃ったら着手）

| ステップ | 内容 | 先行確認事項 |
|---|---|---|
| 1 | `write_application.py` の関数化 | テンプレパス変更方針（未確定#3）|
| 2 | `write_application_server.py` + Dockerfile 作成 | 認証方式決定（未確定#1）|
| 3 | Cloud Run deploy（ローカル docker build → gcloud push）| GCP プロジェクト確認 |
| 4 | GAS 側に `V3TR_menuGenerateApplication_B_()` 追加 | エンドポイント URL 確定後 |
| 5 | 動作確認（1患者で試験実行）| — |
| 6 | 全患者バッチ確認 + Drive 保存確認 | — |
| 7 | clasp push + docs 更新 + commit/push | — |

---

## 9. Dashboard 反映整理

| 対象 | 内容 | 要否 |
|---|---|---|
| Projects シート | 案件 ID `JREC-01` の `次アクション` 列を更新 | ✅ `de -ProjectId JREC-01` で反映 |
| Task_Queue | B案実装タスクを追加（未確定事項を resolve してから）| ⚠️ 未確定事項が残るため保留 |
| Run_Log | 本調査完了を記録 | ✅ commit 時に自動反映 |
| 参照元文書 | 本ファイル（JREC-01_申請書生成フロー_B案設計.md）| ✅ 本ファイルが設計正本 |

---

## 変更履歴

| 日付 | 内容 |
|---|---|
| 2026-03-19 | 初版作成（設計調査完了 / 実装前未確定事項あり）|
