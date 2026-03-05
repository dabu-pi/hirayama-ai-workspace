# freee見積自動化プロジェクト

Gmailで受信した見積依頼メールを起点に、freee見積書作成・PDF返信下書き・スプレッドシート記録を自動化するGoogle Apps Scriptシステム。

## ステータス

開発中

## 目的

- `hawk@pop13.odn.ne.jp`（長谷川さん）からの見積依頼メールを検知
- freeeで見積書を自動作成
- PDF添付の返信メールを下書き作成（自動送信はしない）
- 案件管理スプレッドシートに進捗を自動記録

## ファイル構成

| ファイル | 役割 |
|---|---|
| `src/freee請求書作成.js` | freee API連携・見積書作成 |
| `src/hawkメール自動貼り付け.js` | Gmail受信検知・内容抽出 |
| `src/phase3_下書き作成.js` | 返信メール下書き作成 |
| `src/コード.js` | メインエントリポイント |
| `appsscript.json` | GASプロジェクト設定 |
| `spec.md` | 仕様書 |

## 技術構成

- **言語:** Google Apps Script (JavaScript)
- **連携システム:** Gmail / freee API / Google スプレッドシート
- **認証:** OAuth2 (freee)

## 案件管理スプレッドシート

[2024長谷川さん管理シート](https://docs.google.com/spreadsheets/d/1TMKQO4zYwk1kWgkfoCR4K7jTeIxNxsS1B8uh7t8nd2c/edit?gid=382885172)

## 関連ドキュメント

- [spec.md](./spec.md) — 詳細仕様書
