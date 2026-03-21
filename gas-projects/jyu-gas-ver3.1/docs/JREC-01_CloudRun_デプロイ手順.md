# JREC-01 申請書生成B案 — Cloud Run デプロイ手順書

作成日: 2026-03-19
対象コミット: 5542ed9
ステータス: **デプロイ完了（2026-03-19）**

---

## 0. 前提・環境

| 項目 | 値 |
|---|---|
| GCP プロジェクト ID | `hirayama-jrec-appgen`（利用不可なら同系統名で調整）|
| Cloud Run リージョン | `asia-northeast1`（東京）|
| イメージリポジトリ | Artifact Registry（`asia-northeast1-docker.pkg.dev`）|
| 認証方式 | HTTPS + Secret Manager（X-Secret-Key ヘッダ）|
| ローカル必須ツール | `gcloud` CLI / `docker` |

---

## 1. GCP プロジェクト作成

```bash
# プロジェクト作成
gcloud projects create hirayama-jrec-appgen --name="JREC AppGen"

# プロジェクトをデフォルトに設定
gcloud config set project hirayama-jrec-appgen

# 課金アカウントを紐付け（Console で確認してから実行）
# gcloud billing projects link hirayama-jrec-appgen --billing-account=BILLING_ACCOUNT_ID
```

> **確認:** [GCP Console](https://console.cloud.google.com/) でプロジェクトが作成されたことを確認する

---

## 2. 必要な API を有効化

```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com
```

---

## 3. Artifact Registry リポジトリ作成

```bash
gcloud artifacts repositories create jrec-appgen \
  --repository-format=docker \
  --location=asia-northeast1 \
  --description="JREC 申請書生成サーバー"
```

---

## 4. Secret Manager に SECRET_KEY を登録

```bash
# 32バイト以上のランダム文字列を生成してシークレット登録
# ★ 生成した値は安全な場所（パスワードマネージャー等）にも保存すること

# macOS / Linux の場合
python3 -c "import secrets; print(secrets.token_urlsafe(40))"

# 上記の出力をコピーして以下を実行
echo -n "ここに生成した文字列を貼り付け" | \
  gcloud secrets create JREC_APPGEN_SECRET_KEY \
    --data-file=- \
    --replication-policy=automatic
```

> **確認:** Console > Security > Secret Manager で `JREC_APPGEN_SECRET_KEY` が作成されたことを確認

---

## 5. Cloud Run サービスアカウントに権限付与

```bash
# Cloud Run が使うデフォルト SA を確認
gcloud iam service-accounts list

# Secret Manager へのアクセス権を付与
# PROJECT_NUMBER は Console または下記で確認
gcloud projects describe hirayama-jrec-appgen --format="value(projectNumber)"

# SA メールアドレス例: PROJECT_NUMBER-compute@developer.gserviceaccount.com
gcloud secrets add-iam-policy-binding JREC_APPGEN_SECRET_KEY \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 6. Docker イメージのビルドと push

```bash
# jyu-gas-ver3.1 ディレクトリに移動
cd gas-projects/jyu-gas-ver3.1

# Docker にログイン
gcloud auth configure-docker asia-northeast1-docker.pkg.dev

# イメージをビルド（ローカル確認込み）
docker build -t jrec-appgen-server .

# ローカル動作確認（オプション: スモークテスト前に実施）
# docker run -p 8080:8080 -e SECRET_KEY=test-secret jrec-appgen-server
# curl http://localhost:8080/health

# Artifact Registry 用タグ付け
docker tag jrec-appgen-server \
  asia-northeast1-docker.pkg.dev/hirayama-jrec-appgen/jrec-appgen/server:latest

# push
docker push \
  asia-northeast1-docker.pkg.dev/hirayama-jrec-appgen/jrec-appgen/server:latest
```

---

## 7. Cloud Run へデプロイ

```bash
gcloud run deploy jrec-appgen-server \
  --image=asia-northeast1-docker.pkg.dev/hirayama-jrec-appgen/jrec-appgen/server:latest \
  --platform=managed \
  --region=asia-northeast1 \
  --allow-unauthenticated \
  --set-secrets=SECRET_KEY=JREC_APPGEN_SECRET_KEY:latest \
  --memory=512Mi \
  --timeout=120 \
  --min-instances=0 \
  --max-instances=3 \
  --port=8080
```

> **`--allow-unauthenticated` について:**
> IAM 認証なし（URL 秘匿 + X-Secret-Key で保護）。
> 将来 IAM/OIDC に移行する際は `--no-allow-unauthenticated` に変更するだけ。

---

## 8. デプロイ後の URL 確認

```bash
gcloud run services describe jrec-appgen-server \
  --platform=managed \
  --region=asia-northeast1 \
  --format="value(status.url)"
```

出力例:
```
https://jrec-appgen-server-xxxxxxxxxx-an.a.run.app
```

> **この URL を次のステップで使用する。**

---

## 9. ヘルスチェック確認

```bash
curl https://jrec-appgen-server-xxxxxxxxxx-an.a.run.app/health
# 期待値: {"status": "ok"}
```

---

## 10. Apps Script スクリプトプロパティ設定

Apps Script エディタを開く:
1. スプレッドシート > 拡張機能 > Apps Script
2. 左メニュー「プロジェクトの設定」>「スクリプトプロパティ」
3. 以下を追加:

| プロパティ名 | 値 |
|---|---|
| `APPGEN_ENDPOINT` | ステップ8で確認した URL（末尾スラッシュなし） |
| `APPGEN_SECRET` | ステップ4で生成した SECRET_KEY の値 |

> **注意:** スクリプトプロパティの値は GAS の UI 上に表示されるが、コミット対象外。絶対にコードに直書きしない。

---

## 11. デプロイ完了チェックリスト

- [x] GCP プロジェクト作成
- [x] API 有効化（run / artifactregistry / secretmanager / cloudbuild）
- [x] Artifact Registry リポジトリ作成
- [x] Secret Manager に `JREC_APPGEN_SECRET_KEY` 登録
- [x] SA に Secret Accessor 権限付与
- [x] Docker build & push 成功
- [x] Cloud Run デプロイ成功
- [x] `/health` エンドポイント 200 OK 確認（`{"status":"ok"}`）
- [x] スクリプトプロパティ `APPGEN_ENDPOINT` / `APPGEN_SECRET` 設定

### 次ステップ（2026-03-19 時点）

- [x] GAS → Cloud Run 疎通確認（GAS エディタから呼び出しテスト）— ✅ 完了（2026-03-20）
- [x] `/generate` 本処理エンドポイント確認 — ✅ B案 3件生成 / エラー0件 / 目視確認OK（2026-03-21）

---

## 起動安定化メモ（Revision 00016 〜 00019 で発覚・解消）

### 問題の経緯

| リビジョン | 状態 | 原因 |
|---|---|---|
| 00015-g96 | ✅ 正常稼働 | gunicorn 旧世代（21.x/22.x 系）が動作 |
| 00016-4lw 〜 00018 | ❌ 全リクエスト 504 | 下記2問題が重複 |
| 00019-w8n | ✅ 正常稼働（/health 0.13s / Booting worker 確認済み）| 両問題を解消 |

### 問題1 — `--preload` + モジュールレベル import の組み合わせ

- **原因:** `server.py` に `from write_application import batch_write_from_string` がモジュールレベルにあった
- **影響:** gunicorn `--preload` 使用時、master プロセスで openpyxl/PIL の重い import が実行 → worker fork 前に詰まり worker が一切起動しない
- **修正:** `write_application` import を `/generate` ハンドラ内の遅延 import に変更。`--preload` は廃止

### 問題2（根本原因）— gunicorn 25.1.0 の worker fork 不全

- **原因:** `requirements.txt` に `gunicorn>=21.0.0` と書いていたため、2026-03-21 以降のビルドで gunicorn 25.1.0 がインストールされた
- **影響:** gunicorn 25.1.0 は worker が一切 fork されない（Booting worker ログなし）。TCP probe は master が listening = pass するが HTTP 応答なし
- **修正:** `requirements.txt` を `gunicorn==23.0.0` に固定（long-term stable）
- **根拠:** 00015-g96（動作確認済み）は dirty_xxx config dump を出力 → 旧世代 gunicorn と判断

### 現在の安定起動設計（Revision 00019〜）

| 設計項目 | 内容 |
|---|---|
| gunicorn バージョン | `==23.0.0` に固定（25.x の fork バグ回避）|
| `--preload` | **廃止**（master での重い import を防ぐ）|
| `write_application` import | `/generate` ハンドラ内での遅延 import（初回のみ。キャッシュして再利用）|
| `/health` ルート | `os` / `logging` / `flask` のみ使用。worker 起動直後から即応 |
| 起動確認ログ | `app import 開始` → `Flask app 生成完了` → `health route 登録完了` → （/generate 初回）`write_application import 開始/完了` |

> **再デプロイ後の確認方法:** `/health` が 200 OK を返し、Cloud Logging に `Booting worker pid:N` が出ることを確認する。

---

## 変更履歴

| 日付 | 内容 |
|---|---|
| 2026-03-19 | 初版作成 |
| 2026-03-19 | デプロイ完了・チェックリスト全項目確認済み |
| 2026-03-21 | 起動安定化メモ追記（gunicorn 23.0.0 固定・--preload廃止・遅延import化）/ 次ステップ完了マーク |
