# JREC-01 別PC再開手順書

最終更新: 2026-03-21
対象フェーズ: 申請書様式確認フェーズ完了 → 月次運用継続・発生時確認フェーズへ

---

## 現在の到達点（2026-03-21）

| 項目 | 状態 |
|---|---|
| Cloud Run `jrec-appgen-server` デプロイ | ✅ 完了（Revision 00019-w8n）|
| `/health` 200 OK 確認 | ✅ 完了（0.13s / Booting worker pid 確認済み）|
| GAS Script Properties 設定（APPGEN_ENDPOINT / APPGEN_SECRET） | ✅ 完了 |
| `Ver3_smokeTest.js` 追加（V3TR_smokeHealth / V3TR_smokeGenerate） | ✅ 完了（clasp push 済み）|
| GAS → Cloud Run 疎通確認（smokeHealth / smokeGenerate 実行） | ✅ 完了（2026-03-20）|
| 本番メニュー「【B案】申請書を生成して Drive に保存」実行 | ✅ 完了（3件生成 / エラー0件）|
| 申請書目視確認（全欄）| ✅ 完了（2026-03-21 ユーザー全体OK）|
| Cloud Run 起動安定化 | ✅ 完了（gunicorn 23.0.0 固定・--preload廃止・遅延import化）|
| 月次運用フロー文書整備 | ✅ 完了（`docs/JREC-01_月次運用フロー.md` 新規作成）|
| U2 施術機関コード 制度確認 + 現行値照合 | ✅ 完了（届出承諾通知書で `2804440-0-0` 確定 2026-03-21）|
| U6 給付割合 制度確認 | ✅ 完了（神奈川県国保連記載要領原文。「10」○不可・2択形式 確定）|
| 申請書様式の主要暫定項目 | ✅ **全項目クリア**（残: 発生時確認のみ）|

### 残課題（発生時のみ — 制度調査不要）

| 項目 | 発生条件 | 確認内容 |
|---|---|---|
| 高7「⓪」表示 | 保険種別=6 / 7割給付の患者が出たとき | 帳票上の見た目を目視確認 |
| D4 3部位ケース | 3部位算定が発生したとき | `row2["部位1_計"]>0` 判定の帳票反映を実案件確認 |
| D5 施術証明欄・委任欄 | 手書き運用廃止を検討するとき | 低優先・当面は手書き継続 |

---

## 新PCで最初にやること（PowerShell）

### 1. ワークスペースに移動・最新化

```powershell
cd C:\hirayama-ai-workspace\workspace
git status
git pull origin feature/auto-dev-phase3-loop
git log --oneline -5
```

期待: 最新 commit が `0c8e31c`（U2 施術機関コード確定完了）以降であること

---

### 2. ツール利用可否を確認

```powershell
# clasp（GAS 反映に必須）
clasp whoami
# → Logged in as: xxxx@gmail.com
# NG なら: clasp login

# gcloud（Cloud Run 確認用・必要なら）
gcloud auth list
# → ACTIVE ACCOUNT 表示
# NG なら: gcloud auth login

# docker（再ビルドが必要な場合のみ）
docker --version
# 今回は使わなければ不要
```

---

### 3. clasp push（必須）

GAS に最新コード（`Ver3_smokeTest.js`）を反映する。

```powershell
cd C:\hirayama-ai-workspace\workspace\gas-projects\jyu-gas-ver3.1
clasp push
```

> `.clasp.json` が存在しない場合は作成が必要:
> スプレッドシート > 拡張機能 > Apps Script > 設定 > スクリプト ID を確認し、
> 以下の内容で `gas-projects/jyu-gas-ver3.1/.clasp.json` を作成する（コミット不可）:
>
> ```json
> { "scriptId": "ここにスクリプトIDを貼る", "rootDir": "." }
> ```

---

### 4. スクリプトプロパティの確認

Apps Script エディタ（スプレッドシート > 拡張機能 > Apps Script > プロジェクトの設定 > スクリプトプロパティ）で以下が設定されているか確認:

| プロパティ名 | 値 |
|---|---|
| `APPGEN_ENDPOINT` | `https://jrec-appgen-server-xxxxxxxxxx-an.a.run.app`（末尾スラッシュなし）|
| `APPGEN_SECRET` | Secret Manager の `JREC_APPGEN_SECRET_KEY` と同じ値 |

> ※スクリプトプロパティはスプレッドシートに紐付いており、別PCでも同じスプレッドシートを開けば参照できる。再設定不要のはず。

---

### 5. スモークテスト（疎通確認）

Apps Script エディタで順番に実行:

#### STEP A: /health 確認

1. 関数プルダウンで **`V3TR_smokeHealth`** を選択
2. 「実行」をクリック
3. 期待: `✅ /health OK / HTTP: 200 / {"status":"ok"}`

#### STEP B: /generate 疎通確認（患者0件）

1. 関数プルダウンで **`V3TR_smokeGenerate`** を選択
2. 「実行」をクリック
3. 期待: `✅ /generate OK / HTTP: 200 / {"status":"ok","patients":[],...}`

---

### 6. 本番メニュー実行

STEP A / B が両方 OK なら:

1. スプレッドシートを開く
2. メニュー「柔整ツール」>「**【B案】申請書を生成して Drive に保存**」
3. 月を確認（デフォルト当月）して **OK**
4. 処理中トースト: 「NDJSON 生成中...」→「Cloud Run に送信中...」→「Drive に保存中...」
5. 完了アラートで確認:
   - 「保存: X 件」
   - 「エラー: 0 件」
   - 保存先フォルダ URL が表示される

#### 完了後の確認項目

| 確認 | 方法 |
|---|---|
| Drive に xlsx が保存されている | アラートのフォルダ URL を開く |
| xlsx の内容が正しい | ファイルを開いて氏名・保険者番号・金額を目視 |
| `_申請書生成ログ` シートに OK 行 | スプレッドシートのシートタブを確認 |

---

## 失敗時の確認ポイント

| 症状 | 確認先 |
|---|---|
| `APPGEN_ENDPOINT が未設定` | Script Properties を再確認 |
| HTTP 401 | `APPGEN_SECRET` と Cloud Run の `JREC_APPGEN_SECRET_KEY` の値が一致しているか |
| HTTP 400 | 対象月に来院データがあるか（転記データ生成先を確認）|
| HTTP 500 | GCP Console > Cloud Logging でスタックトレース確認 |
| 接続失敗 | `APPGEN_ENDPOINT` の URL が正しいか（`gcloud run services describe` で確認）|
| Drive 保存失敗 | スプレッドシートを開いているアカウントの Drive 権限確認 |

```powershell
# Cloud Run の URL を確認する
gcloud run services describe jrec-appgen-server `
  --platform=managed `
  --region=asia-northeast1 `
  --format="value(status.url)"

# Cloud Run のログを確認する
gcloud run services logs tail jrec-appgen-server --region=asia-northeast1
```

---

## 参照ドキュメント

| ドキュメント | 内容 |
|---|---|
| `PROJECT_STATUS.md` | 進捗・次タスク全体 |
| `docs/JREC-01_月次運用フロー.md` | 月次の標準手順（生成前確認〜完了報告） |
| `docs/JREC-01_申請書様式運用メモ.md` | 申請書各欄の制度定義・実装状態・暫定注記 |
| `docs/JREC-01_CloudRun_デプロイ手順.md` | Cloud Run 構築手順（完了済み）|
| `docs/JREC-01_スモークテスト手順.md` | メニュー実行の詳細手順 |
| `docs/JREC-01_申請書生成B案_MVP実装設計.md` | API 仕様・GAS 実装設計 |

---

## 変更履歴

| 日付 | 内容 |
|---|---|
| 2026-03-19 | 初版作成（Cloud Run デプロイ完了・本番確認待ち状態で別PC引継）|
| 2026-03-21 | 到達点更新（B案目視確認完了・Cloud Run 安定化完了・全項目✅）|
| 2026-03-21 | 到達点更新（申請書様式確認フェーズ完了: 月次運用フロー整備・U2現行値確定・U6制度確定。残課題は発生時確認のみ）|
