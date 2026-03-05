# 患者管理Webアプリ

接骨院の患者住所録をGoogle スプレッドシートと連携して管理するFlask Webアプリケーション。

## ステータス

開発中（プロトタイプ）

## 目的

- 患者情報（氏名・生年月日・住所等）の登録・閲覧
- 郵便番号から住所を自動補完
- 年齢の自動計算
- Google スプレッドシートをデータストアとして使用

## ファイル構成

| ファイル | 役割 |
|---|---|
| `app.py` | Flaskアプリ本体（ルーティング・API） |
| `templates/` | HTMLテンプレート |
| `requirements.txt` | Pythonパッケージ一覧 |

## 技術構成

- **言語:** Python (Flask)
- **データストア:** Google スプレッドシート（gspread）
- **認証:** Google Service Account
- **実行環境:** ローカル（localhost:5000）

## セットアップ

```bash
pip install -r requirements.txt
# service_account.json を配置（リポジトリには含めない）
python app.py
```

## 注意

`service_account.json` は認証情報のため `.gitignore` に追加し、リポジトリには含めないこと。

## スプレッドシート

- ID: `1rASJV_j8pGmXY5NhQrw4FKJY_eRy-iSPoGSh08gdLk0`
- シート名: `住所録`
