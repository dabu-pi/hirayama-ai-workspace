# JREC-01 申請書生成フロー B案 MVP実装設計

作成日: 2026-03-19
前提文書: `JREC-01_申請書生成フロー_B案設計.md`
ステータス: MVP実装設計確定 / 実装着手前

---

## 0. 固定方針（確定）

| # | 項目 | 決定内容 |
|---|---|---|
| 1 | 認証方式 | HTTPS + 共有シークレット（X-Secret-Key ヘッダ）。将来は IAM/OIDC へ拡張可能な構成を維持 |
| 2 | テンプレ xlsx | Cloud Run イメージ同梱（Drive 動的取得は将来拡張） |
| 3 | 同名ファイル | `JREC-01_月次出力/YYYY-MM/01_申請書/` に新規保存。再生成前の同一患者・同一月の旧版は `90_再生成旧版/` へ退避 |
| 4 | 月指定 | デフォルト当月。必要時のみダイアログ指定 |

---

## 1. 責務分担

```
[スプレッドシート / 人間]
  ↓ メニュー「申請書生成」クリック
  ↓ 月指定ダイアログ（省略時=当月）

[GAS: Ver3_transferData.js]
  ① 対象月の転記データを NDJSON 形式で生成（既存ロジック流用）
  ② Cloud Run に POST /generate（X-Secret-Key + NDJSON）
  ③ レスポンスの base64 xlsx を Drive の月別フォルダに保存
  ④ 完了アラート（保存先 URL を通知）
  ⑤ 生成ログをシートに追記

[Cloud Run: Python / Flask]
  ① X-Secret-Key を検証（不一致→401）
  ② NDJSON を受け取り患者ごとに xlsx を生成
  ③ 各 xlsx を base64 エンコード
  ④ 全患者分をまとめて JSON レスポンスで返す
  ⑤ Cloud Logging にログ出力

[Drive]
  ・JREC-01_月次出力/YYYY-MM/01_申請書/ フォルダに申請書_XXX_YYYY-MM_HHMMSS.xlsx として保存
```

---

## 2. 実装ファイル一覧

### 新規作成

| ファイル | 場所 | 役割 |
|---|---|---|
| `server.py` | `gas-projects/jyu-gas-ver3.1/` | Flask エンドポイント。write_application.py をインポートして流用 |
| `Dockerfile` | `gas-projects/jyu-gas-ver3.1/` | Cloud Run イメージ定義 |
| `.dockerignore` | `gas-projects/jyu-gas-ver3.1/` | イメージ不要ファイル除外 |
| `JREC-01_CloudRun_デプロイ手順.md` | `gas-projects/jyu-gas-ver3.1/docs/` | Cloud Run deploy 手順書 |

### 変更（最小修正）

| ファイル | 変更内容 |
|---|---|
| `write_application.py` | `batch_write()` を NDJSON 文字列受け取り版にオーバーロード（既存 CLI 動作は維持） |
| `Ver3_transferData.js` | `V3TR_menuGenerateApplication_B_()` 関数追加 + `onOpen()` メニュー登録 |
| `requirements.txt` | `flask` / `gunicorn` を追加 |

### 変更なし

| ファイル | 理由 |
|---|---|
| `療養費支給申請書.xlsx` | テンプレそのまま。Dockerfile で COPY |
| `Ver3_core.js` | 関与なし |
| `Ver3_amounts.js` | 関与なし |

---

## 3. API 仕様

### エンドポイント

```
POST https://<cloud-run-url>/generate
```

### リクエスト

| 項目 | 内容 |
|---|---|
| Content-Type | `application/json` |
| ヘッダ | `X-Secret-Key: <shared_secret>` |
| Body | `{ "ndjson": "<NDJSON文字列>", "month": "2026-03" }` |

```json
{
  "ndjson": "{\"_meta\":true,\"schemaVersion\":\"3.0\",...}\n{\"patientId\":\"hirayamaka\",...}",
  "month": "2026-03"
}
```

### レスポンス（成功 200）

```json
{
  "status": "ok",
  "month": "2026-03",
  "patients": [
    {
      "patientId": "hirayamaka",
      "fileName": "申請書_hirayamaka_2026-03.xlsx",
      "content": "<base64エンコードされたxlsx>",
      "warnings": []
    }
  ],
  "generatedAt": "2026-03-19T13:49:00+09:00"
}
```

### レスポンス（エラー）

| HTTP | 条件 | Body |
|---|---|---|
| 401 | X-Secret-Key 不一致 | `{"status":"error","code":"AUTH_FAILED","message":"Invalid secret key"}` |
| 400 | NDJSON 不正 / 患者データなし | `{"status":"error","code":"INVALID_INPUT","message":"..."}` |
| 422 | schemaVersion 不一致 | `{"status":"error","code":"SCHEMA_MISMATCH","message":"..."}` |
| 500 | openpyxl 処理失敗 | `{"status":"error","code":"GENERATION_FAILED","message":"...","detail":"..."}` |

---

## 4. GAS 側実装（`V3TR_menuGenerateApplication_B_`）

```
処理フロー:
1. 月指定取得（デフォルト当月。ダイアログは SHIFT キー押下時のみ表示）
2. 既存 V3TR_buildRows_() で転記データ生成
3. NDJSON 文字列化
4. PropertiesService から SECRET_KEY を取得
5. UrlFetchApp.fetch(endpoint, {
     method: "post",
     contentType: "application/json",
     headers: { "X-Secret-Key": secretKey },
     payload: JSON.stringify({ ndjson, month }),
     muteHttpExceptions: true
   })
6. HTTP 2xx 以外 → alert() でエラー表示・中断
7. レスポンスの patients 配列をループ
8. 各 patient の content を base64decode → Blob
9. Drive の月別フォルダに xlsx 保存
   ファイル名: 申請書_<patientId>_<YYYY-MM>_<HHMMSS>.xlsx
10. 生成ログシートに追記（患者ID / ファイルURL / 生成日時 / warnings）
11. 完了アラート（保存先フォルダ URL + 患者数）
```

**設定値の管理:**
- `CLOUD_RUN_ENDPOINT`: PropertiesService（スクリプトプロパティ）に保存
- `SECRET_KEY`: PropertiesService（スクリプトプロパティ）に保存
- → スプレッドシート上に平文で持たない

---

## 5. Cloud Run 側実装（`server.py`）

```python
# 構成イメージ
from flask import Flask, request, jsonify
import base64, io, os
from write_application import batch_write_from_string  # 新規追加関数

app = Flask(__name__)
SECRET_KEY = os.environ["SECRET_KEY"]  # Cloud Run 環境変数から取得

@app.route("/generate", methods=["POST"])
def generate():
    # 1. 認証
    if request.headers.get("X-Secret-Key") != SECRET_KEY:
        return jsonify({"status":"error","code":"AUTH_FAILED"}), 401

    # 2. 入力検証
    body = request.get_json(force=True)
    ndjson_str = body.get("ndjson", "")
    month = body.get("month", "")

    # 3. 患者ごとに xlsx 生成
    results = batch_write_from_string(ndjson_str)

    # 4. base64 エンコードしてレスポンス
    patients = []
    for r in results:
        buf = io.BytesIO()
        r["wb"].save(buf)
        patients.append({
            "patientId": r["patientId"],
            "fileName": r["fileName"],
            "content": base64.b64encode(buf.getvalue()).decode(),
            "warnings": r.get("warnings", [])
        })

    return jsonify({"status":"ok","month":month,"patients":patients,...})
```

**`write_application.py` への追加（`batch_write_from_string`）:**
```python
def batch_write_from_string(ndjson_str: str) -> list:
    """
    NDJSON 文字列を受け取り、患者ごとに Workbook オブジェクトを返す。
    既存の batch_write() とは独立（CLI 動作に影響しない）。
    テンプレパスは __file__ 基準の固定パスを使用。
    """
```

---

## 6. Dockerfile

```dockerfile
FROM python:3.11-slim
WORKDIR /app

# 依存インストール
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# アプリコピー
COPY server.py write_application.py 療養費支給申請書.xlsx ./

# 環境変数（デプロイ時に --set-env-vars で上書き）
ENV PORT=8080

CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "1", "--timeout", "120", "server:app"]
```

---

## 7. 監査ログ / Run_Log の残し方

| 対象 | 方法 | 内容 |
|---|---|---|
| GAS 実行ログ | `_申請書生成ログ` シート（新規追加）| 患者ID / 生成日時 / Drive URL / warnings / エラー |
| Cloud Run ログ | Cloud Logging（GCP Console）| リクエスト内容・処理時間・エラースタックトレース |
| Run_Log | `de -ProjectId JREC-01` で commit 時に自動記録 | 実装単位の作業記録 |

**`_申請書生成ログ` シートの列:**

| 列 | 内容 |
|---|---|
| 実行日時 | ISO8601 |
| 対象月 | YYYY-MM |
| 患者ID | — |
| ファイル名 | — |
| Drive URL | — |
| warnings | 要確認事項（空欄 = 問題なし）|
| ステータス | OK / ERROR |
| エラー詳細 | エラー時のみ |

---

## 8. セキュリティ設計

| 項目 | MVP | 将来拡張 |
|---|---|---|
| 通信 | HTTPS（Cloud Run デフォルト）| 変更なし |
| 認証 | X-Secret-Key ヘッダ | IAM/OIDC（GAS の `ScriptApp.getIdentityToken()` を使用）|
| シークレット管理 | GAS: PropertiesService / Cloud Run: 環境変数 | Secret Manager（GCP）|
| エンドポイント URL | 非公開（PropertiesService に保存）| 変更なし |
| NDJSON 内の個人情報 | HTTPS 通信のため平文 OK | 必要に応じて暗号化 |

**将来の IAM/OIDC 移行パス:**
```
GAS 側:
  ScriptApp.getIdentityToken() → Bearer トークンを Authorization ヘッダに付与

Cloud Run 側:
  認証あり（--no-allow-unauthenticated）に変更するだけ
  → server.py のコード変更不要
```

---

## 9. 残未確定件（実装前に確認が必要なもの）

| # | 項目 | 内容 |
|---|---|---|
| 1 | GCP プロジェクト ID | どのプロジェクトに Cloud Run をデプロイするか |
| 2 | Cloud Run リージョン | asia-northeast1（東京）で問題ないか確認 |
| 3 | SECRET_KEY の値 | ランダム文字列を生成して PropertiesService / 環境変数に設定（実装時に決定） |
| 4 | `_申請書生成ログ` シート | 既存スプレッドシートに追加してよいか確認 |

---

## 10. 実装ステップ（確定後の着手順）

| ステップ | 内容 | 所要見込み |
|---|---|---|
| 1 | `write_application.py` に `batch_write_from_string()` 追加 | 小 |
| 2 | `server.py` 作成（Flask + 認証 + base64 返却）| 中 |
| 3 | `Dockerfile` + `.dockerignore` + `requirements.txt` 更新 | 小 |
| 4 | ローカル docker build + 動作確認（curl テスト）| 中 |
| 5 | Cloud Run deploy（gcloud CLI）| 小（GCP 設定済み前提）|
| 6 | GAS 側 `V3TR_menuGenerateApplication_B_()` 実装 | 中 |
| 7 | PropertiesService にエンドポイント URL / SECRET_KEY 設定 | 小 |
| 8 | clasp push → スプレッドシートで動作確認（1患者）| — |
| 9 | 全患者バッチ確認 + Drive 保存確認 | — |
| 10 | docs 更新 + commit/push | — |

---

## 11. Dashboard 反映整理

| 対象 | 内容 | タイミング |
|---|---|---|
| Projects（JREC-01）| `次アクション` = "申請書B案 Cloud Run deploy 待ち" | 本 commit で `de -ProjectId JREC-01` |
| Task_Queue | B案実装タスク追加（GCP設定確定後）| 未確定事項 resolve 後 |
| Run_Log | 本設計完了を記録 | 本 commit 自動 |
| 参照元文書 | 本ファイル（JREC-01_申請書生成B案_MVP実装設計.md）| 本ファイルが実装設計正本 |

---

## 変更履歴

| 日付 | 内容 |
|---|---|
| 2026-03-19 | 初版作成（未確定4項目固定 → MVP実装設計確定）|
