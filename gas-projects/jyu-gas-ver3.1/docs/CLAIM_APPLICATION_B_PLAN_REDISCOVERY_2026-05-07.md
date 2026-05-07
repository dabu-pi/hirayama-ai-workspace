# 申請書生成B案 再確認記録

作成日: 2026-05-07  
ステータス: **B案が正ルート確定 — Cloud Run 稼働中・実行確認済み**

---

## ユーザー指摘（2026-05-07）

> 完成度が一番高かった申請書出力は、スプレッドシートのメニューから実行していた「申請書生成B案」です。
> これは Excel で出力されていたもので、これまでの確認では最も成功していた申請書生成ルートです。

この指摘を受けて、B案の実体・現在の状態・実行可能性を調査した。

---

## 調査結果

### B案メニュー定義

| 項目 | 内容 |
|---|---|
| メニュー構成 | 柔整ツール > 帳票出力 > **申請書を出力** |
| コールバック関数 | `V3TR_menuGenerateApplication_B()` |
| ソースファイル | `Ver3_transferData.js` (行 2509〜2872) |
| ダイアログタイトル | 申請書生成（B案） |

### B案フロー

```
1. スプレッドシートメニュー「帳票出力」→「申請書を出力」
2. ダイアログ表示（患者ID省略可・対象月入力）
3. V3TR_runGenerateApplicationDialog(pid, ym)
4. V3TR_generateApplicationBCore_(patientIds, ym)
   ├── NDJSON生成（V3TR_buildTransferDataForMonth_ + V3TR_exportTransferJson_）
   ├── Layer 2 安全フィルタ（claimPay=0 患者を除外）
   ├── Preflight validation（必須キー・対象月一致・金額整合）
   ├── Cloud Run POST /generate（X-Secret-Key認証）
   ├── レスポンス base64 → Drive 月別フォルダに xlsx 保存
   └── _申請書生成ログ シートへ記録
```

### Cloud Run サービス

| 項目 | 値 |
|---|---|
| URL | `https://jrec-appgen-server-j6vlxdvqaa-an.a.run.app` |
| GCPプロジェクト | `hirayama-jrec-appgen` |
| リージョン | `asia-northeast1`（東京） |
| 現行リビジョン | `00026-wv2` |
| 最終デプロイ | 2026-04-20 |
| /health 確認 | `{"status":"ok"}` ✅（2026-05-07 確認） |

### B案実行結果（2026-05-07 実行）

対象: hirayamaka / 2026-04

| 項目 | 結果 |
|---|---|
| status | ok |
| 生成ファイル | `申請書_hirayamaka_2026-04.xlsx` |
| ファイルサイズ | 36,694 bytes |
| E26 負傷名 | `（1）頸部 捻挫` ✅ |
| カレンダー○ | Pillow 画像埋込（目視確認が必要） |
| 金額 | ¥3,053（目視確認が必要） |

---

## B案と NDJSON+Python ローカル実行の関係

| 方式 | 用途 | 位置づけ |
|---|---|---|
| B案（Cloud Run経由） | 正式帳票出力（Drive保存・ログ記録付き） | ✅ **正ルート** |
| ローカル実行（tools/claim-excel/） | 開発・デバッグ・Cloud Runなし環境 | 補助ルート |

**同一ロジック**: B案のCloud Runが内部で `write_application.py` を実行している。
`tools/claim-excel/write_application.py` と `workspace-export/gas-projects/jyu-gas-ver3.1/write_application.py` は完全一致（1719行）。

---

## B案実行に必要なGAS設定

GAS スクリプトプロパティに以下を設定すること:

| プロパティ名 | 値 |
|---|---|
| `APPGEN_ENDPOINT` | `https://jrec-appgen-server-j6vlxdvqaa-an.a.run.app` |
| `APPGEN_SECRET` | Secret Manager `JREC_APPGEN_SECRET_KEY` の値 |

設定手順:
1. スプレッドシート > 拡張機能 > Apps Script
2. 左メニュー「プロジェクトの設定」>「スクリプトプロパティ」
3. 上記2項目を追加/更新

---

## 各ルートの位置づけ（確定）

| ルート | 位置づけ | 理由 |
|---|---|---|
| **B案（Cloud Run）** | ✅ **正ルート** | 2026-04-06 正式帳票で確認済み・Drive保存・ログ記録 |
| Sheets直PDF（A案） | ❌ 停止 | 施術日カレンダー○・転帰が未実装で帳票不完全 |
| NDJSON + Python ローカル | 補助 | Cloud Run の代替として開発時使用可能 |

---

## 残人間確認

| 確認項目 | 内容 |
|---|---|
| GAS設定確認 | APPGEN_ENDPOINT / APPGEN_SECRET の設定状況（スクリプトエディタで確認） |
| Excel目視確認 | `申請書_hirayamaka_2026-04.xlsx` を開いて目視確認（カレンダー○・転帰・金額・1ページ） |
| Cloud Run再デプロイ判断 | workspace-export の write_application.py に変更があれば再デプロイ検討 |

---

## 関連ファイル

| ファイル | 内容 |
|---|---|
| `Ver3_transferData.js:2494` | B案メニュー関数本体 |
| `Ver3_core.js:413` | メニュー定義（帳票出力 > 申請書を出力） |
| `workspace-export/.../server.py` | Cloud Run Flaskサーバー |
| `workspace-export/.../Dockerfile` | Cloud Runイメージビルド定義 |
| `tools/claim-excel/write_application.py` | xlsx生成ロジック（Cloud Runと同一） |
| `docs/JREC-01_CloudRun_デプロイ手順.md` | Cloud Runデプロイ手順書（workspace-export内） |
