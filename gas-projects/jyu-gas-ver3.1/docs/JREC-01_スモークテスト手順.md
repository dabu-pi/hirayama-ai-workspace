# JREC-01 申請書生成B案 — 初回スモークテスト手順書

作成日: 2026-03-19
前提: デプロイ手順書（`JREC-01_CloudRun_デプロイ手順.md`）完了済み
ステータス: 手順書作成済み / テスト未実施

---

## 0. テスト前チェックリスト

- [ ] Cloud Run デプロイ済み
- [ ] `/health` エンドポイント 200 OK 確認済み
- [ ] スクリプトプロパティ `APPGEN_ENDPOINT` / `APPGEN_SECRET` 設定済み
- [ ] `clasp push` 済み（GAS に最新コードが反映されている）
- [ ] テスト対象月に来院記録のある患者が最低1名いる

---

## 1. スモークテスト手順（1患者・当月）

### Step 1: GAS メニューから実行

1. スプレッドシートを開く
2. メニュー「柔整ツール」>「**【B案】申請書を生成して Drive に保存**」をクリック
3. ダイアログに当月（例: `2026-03`）が表示される → **OK** をクリック

### Step 2: 処理中のトースト確認

スプレッドシート右下に以下が順番に表示されることを確認:
- `NDJSON 生成中... (X 名)`
- `Cloud Run に送信中...`
- `Drive に保存中...`

### Step 3: 完了アラート確認

完了アラートに以下が含まれることを確認:

```
【申請書生成完了】

対象月: YYYY-MM
保存: X 件
エラー: 0 件

保存先フォルダ: https://drive.google.com/...

生成ファイル:
  hirayamaka
```

### Step 4: Drive フォルダ確認

1. アラートに表示されたフォルダ URL を開く
2. `申請書_<患者ID>_YYYY-MM_HHMMSS.xlsx` が存在することを確認
3. ファイルを開いて内容を目視確認（氏名・保険者番号・金額）

### Step 5: `_申請書生成ログ` シート確認

スプレッドシートの `_申請書生成ログ` シートを確認:

| 確認項目 | 期待値 |
|---|---|
| 実行日時 | 実行した日時 |
| 対象月 | YYYY-MM |
| 患者ID | テスト対象患者ID |
| ファイル名 | `申請書_XXX_YYYY-MM_HHMMSS.xlsx` |
| Drive URL | 有効なリンク |
| ステータス | `OK` |
| warnings | 空欄（問題なし）/ 内容があれば目視確認 |

---

## 2. 失敗時の確認ポイント

### 2-1. アラートでエラーが出た場合

| エラー表示 | 原因候補 | 対処 |
|---|---|---|
| `APPGEN_ENDPOINT が未設定` | スクリプトプロパティ未設定 | プロパティを設定して再実行 |
| `APPGEN_SECRET が未設定` | スクリプトプロパティ未設定 | プロパティを設定して再実行 |
| `Cloud Run への接続に失敗` | URL 誤り / Cloud Run 停止 | エンドポイント URL 確認 + `/health` 確認 |
| `HTTP 401` | SECRET_KEY 不一致 | `APPGEN_SECRET` の値と Cloud Run 環境変数を照合 |
| `HTTP 400` | NDJSON 不正 / 患者データなし | 対象月に転記データがあるか確認 |
| `HTTP 500` | Cloud Run 側の処理エラー | Cloud Logging でスタックトレースを確認 |
| `Drive保存エラー` | Drive 権限 / フォルダ不明 | スプレッドシートの親フォルダの権限確認 |

### 2-2. Cloud Run ログの確認方法

```bash
# リアルタイムログ
gcloud run services logs tail jrec-appgen-server \
  --region=asia-northeast1

# 過去ログ（直近50件）
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=jrec-appgen-server" \
  --limit=50 \
  --format="table(timestamp, textPayload)"
```

### 2-3. ローカルでの curl テスト

Cloud Run に問題があるか GAS に問題があるかを切り分けるために:

```bash
# SECRET_KEY の値は環境変数から参照
SECRET="ここに APPGEN_SECRET の値"
ENDPOINT="https://jrec-appgen-server-xxxxxxxxxx-an.a.run.app"

# ヘルスチェック
curl -s "$ENDPOINT/health"

# 最小 NDJSON でのテスト（スキーマ確認のみ）
curl -s -X POST "$ENDPOINT/generate" \
  -H "Content-Type: application/json" \
  -H "X-Secret-Key: $SECRET" \
  -d '{"ndjson": "{\"_meta\":true,\"schemaVersion\":\"3.0\",\"month\":\"2026-03\",\"patientCount\":0}", "month": "2026-03"}' \
  | python3 -m json.tool
```

> 期待値: `{"status": "ok", "month": "2026-03", "patients": [], ...}`

---

## 3. ロールバック手順

### 3-1. Cloud Run revision 巻き戻し

```bash
# デプロイ済みリビジョン一覧を確認
gcloud run revisions list \
  --service=jrec-appgen-server \
  --region=asia-northeast1

# 前のリビジョンに 100% トラフィックを戻す
gcloud run services update-traffic jrec-appgen-server \
  --region=asia-northeast1 \
  --to-revisions=jrec-appgen-server-REVISION_NAME=100
```

### 3-2. GAS メニューの一時無効化

Cloud Run が完全に停止している場合、GAS メニューを押してもエラーアラートが出るだけで
データ破壊はしない。メニューを無効化する必要はない。

ただし混乱を防ぎたい場合は以下をコメントアウトして clasp push:

```javascript
// Ver3_core.js の onOpen から以下の行を一時コメントアウト
// .addItem("【B案】申請書を生成して Drive に保存", "V3TR_menuGenerateApplication_B")
```

### 3-3. 旧フロー（手動 NDJSON + ローカル Python）への退避

B案が使えない場合は旧フローが現行のまま残っている:

1. メニュー「一括JSON出力（月指定）」→ NDJSON を Drive に出力
2. NDJSON をローカルにダウンロード
3. `python write_application.py --batch`（ローカル Python 環境が必要）

---

## 4. よくあるエラー一覧

| HTTP | コード | 原因 | 対処 |
|---|---|---|---|
| 401 | AUTH_FAILED | X-Secret-Key 不一致 / 未設定 | `APPGEN_SECRET` プロパティと Cloud Run の `SECRET_KEY` 環境変数が一致しているか確認 |
| 400 | INVALID_INPUT | ndjson フィールドが空 | 対象月に来院データがあるか確認 |
| 400 | INVALID_INPUT | schemaVersion 不一致 | GAS 側の NDJSON 生成が `3.0` を出しているか確認 |
| 400 | INVALID_INPUT | patientCount 不一致 | NDJSON 生成中にエラーが出た患者がいないか GAS ログを確認 |
| 422 | SCHEMA_MISMATCH | スキーマ非対応 | `write_application.py` の `SCHEMA_VERSION` 定数を確認 |
| 500 | GENERATION_FAILED | openpyxl 処理エラー | Cloud Logging のスタックトレースを確認。テンプレ xlsx が破損していないか確認 |
| 接続失敗 | — | エンドポイント URL 誤り / Cloud Run 停止 | `APPGEN_ENDPOINT` の値と gcloud でのサービス URL を照合 |
| Drive 保存失敗 | — | 出力フォルダ権限不足 | スプレッドシートを開いているアカウントが Drive フォルダに書き込み権限を持っているか確認 |
| テンプレ読込失敗 | — | `療養費支給申請書.xlsx` がイメージに含まれていない | Dockerfile で COPY されているか確認して再ビルド |
| warnings に内容あり | — | 生成は成功したが検証で警告あり | `_申請書生成ログ` の warnings 列を確認し、該当セルを xlsx で目視確認 |

---

## 5. スモークテスト完了チェックリスト

- [ ] メニュー実行 → トースト表示確認
- [ ] 完了アラートで「エラー: 0 件」
- [ ] Drive に xlsx ファイルが保存されている
- [ ] xlsx を開いて氏名・保険者番号・金額が正しい
- [ ] `_申請書生成ログ` に `OK` 行が追記されている
- [ ] warnings が空欄（またはある場合は内容を確認済み）

---

## 変更履歴

| 日付 | 内容 |
|---|---|
| 2026-03-19 | 初版作成 |
