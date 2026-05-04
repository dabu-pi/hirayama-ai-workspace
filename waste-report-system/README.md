# HAIKI-05 / 廃棄物日報システム

一般廃棄物収集運搬業の日報・月報・年度積算を自動作成するGASシステム。

## Management baseline

- `project_id`: `HAIKI-05`
- `project_name`: `廃棄物日報システム`
- `local_folder`: `workspace/waste-report-system`
- `main_sheet_name`: `【UI日報・月報】2026年一般廃棄物業務報告書（日報・月報）`
- `sheet_id`: `1QS-WXy692GrnHERAAZ2ZMX0b1bR-O1No7kqgPh7yBwQ`
- `sheet_status`: `active`（稼働中）
- `drive_folder_id`: `12jb2rDkQa01R1wxm4Gl79sTEZROftrO2`

## ドキュメント

| ファイル | 内容 |
|---|---|
| [SPEC.md](./SPEC.md) | 仕様書（GAS実装・フロー・セル設計） |
| [PROJECT_STATUS.md](./PROJECT_STATUS.md) | 現在地・次アクション・テスト状況 |

## GASコード管理

```
waste-report-system/
└── gas/
    ├── appsscript.json      # V8 runtime 設定
    ├── WR_main.gs.js        # 日報・月報・年度積算（WR_ / WR2_ / WR2V2_ prefix）
    └── WR_autoSubmit.js     # 月初自動処理（WR_AUTO_ prefix）
```

**正本:** GitHub `feature/auto-dev-phase3-loop` ブランチ  
**clasp clone:** コンテナバインド型スクリプト（スプレッドシート直結）

## 月次運用フロー

```
毎月1日 21:00（自動）
  WR_AUTO_runMonthlyFiscalDraft
  → 前月分「年度積算_YYYY-MM月分」シート生成
  → PDF出力（Drive同フォルダ）
  → Gmail下書き作成（To: tanigaki-toshihiko@nantan.hyogo.jp）
  → 提出済み確認シートに PDF_READY 記録

翌営業日（手動）
  → Gmail下書き確認・送信
  → 提出済み確認シートのステータスを SENT に更新
```

## 申請者情報

| 項目 | 値 |
|---|---|
| 事業者名 | あさご暮らしサポート |
| 代表者 | 平山克士 |
| 住所 | 朝来市立野169-1 |
| 電話 | 090-1486-1348 |
| 提出先 | 南但広域行政事務組合 管理者（南但クリーンセンター 谷垣 様） |

## Notes

- GAS内に会社名のハードコードなし。会社名は月報テンプレートシートのセル（J16等）から継承
- 2026-05-05: J16（月報テンプレ）を「あさご暮らしサポート」に変更済み。今後生成分は新名称
- 過去提出済みPDF（2026-01〜04）は原則変更しない
- バックアップスプレッドシート: `1WSPieqO6iRMYvABvz8STFq5XrPPfbmB4Oba6VwG55kc`（2026-02-26作成）
