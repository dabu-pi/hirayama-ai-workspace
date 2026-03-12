# Codex Sheets Direct Write Setup

`Codex` から `Hirayama AI OS Dashboard` の `Run_Log` シートへ直接 1 行追記するためのセットアップ手順です。

対象スクリプト:

- [scripts/append-runlog-to-sheet.mjs](C:/hirayama-ai-workspace/workspace/scripts/append-runlog-to-sheet.mjs)
- [scripts/dev-end.ps1](C:/hirayama-ai-workspace/workspace/scripts/dev-end.ps1)

## 目的

- `de` 実行後に、`logs/runlog/` へ JSON / TSV を残す
- 認証情報が揃っている PC では、そのまま `Run_Log` シートにも 1 行追加する
- 認証情報がない PC では、従来どおりローカル出力だけで止める

## 事前条件

- `node` が使える
- Google Cloud のサービスアカウント JSON を持っている
- `Hirayama AI OS Dashboard` をそのサービスアカウントに共有している

## 1. サービスアカウント JSON を配置

GitHub には含めず、各 PC に手動配置します。

推奨例:

```text
C:\hirayama-ai-workspace\secrets\aios-service-account.json
```

## 2. ダッシュボードをサービスアカウントへ共有

サービスアカウント JSON の `client_email` を確認して、Google Sheets 側で編集者として共有します。

対象シート:

- [Hirayama AI OS Dashboard](https://docs.google.com/spreadsheets/d/1EvZMtMiX5TKsSBYPhF5VrCcK9JEWHhUHuuYkUTRSIfk/edit?usp=sharing)

## 3. 環境変数を設定

PowerShell で実行:

```powershell
[Environment]::SetEnvironmentVariable('AIOS_SERVICE_ACCOUNT_PATH', 'C:\hirayama-ai-workspace\secrets\aios-service-account.json', 'User')
[Environment]::SetEnvironmentVariable('AIOS_DASHBOARD_SPREADSHEET_ID', '1EvZMtMiX5TKsSBYPhF5VrCcK9JEWHhUHuuYkUTRSIfk', 'User')
[Environment]::SetEnvironmentVariable('AIOS_RUNLOG_SHEET_NAME', 'Run_Log', 'User')
[Environment]::SetEnvironmentVariable('AIOS_RUNLOG_SHEET_WRITE', '1', 'User')
```

反映後は新しい PowerShell を開くか、既存セッションを再起動します。

## 4. 単体確認

まずはローカル JSON を 1 つ作ります。

```powershell
cd C:\hirayama-ai-workspace\workspace
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\export-run-log-entry.ps1 -Summary "test write" -Result SUCCESS -CommitHash test123 -NextAction "confirm row in sheet"
```

次に dry-run で確認します。

```powershell
node .\scripts\append-runlog-to-sheet.mjs --json .\logs\runlog\<latest>.json
```

実書き込み:

```powershell
node .\scripts\append-runlog-to-sheet.mjs --json .\logs\runlog\<latest>.json --write
```

## 5. `de` 連携

環境変数が揃っていれば、`de` 実行後に自動で `Run_Log` へ追記します。

```powershell
de "docs: update ai-os notes"
```

スキップしたい場合:

```powershell
.\scripts\dev-end.ps1 -SkipRunLogSheetWrite -Message "wip: local only"
```

## 補足

- 認証情報がない PC では、自動的にローカル JSON / TSV だけを生成します
- 直接書き込みの対象は今のところ `Run_Log` のみです
- `Projects` や `Task_Queue` の更新はまだ自動化しません
