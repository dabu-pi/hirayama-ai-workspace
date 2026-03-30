# GOOGLE_DRIVE_SYNC.md

hirayama-ai-workspace 全体で、GitHub 正本を維持したまま Google Drive を共有・検索・参照・バックアップ先として使うための最終運用ガイドです。

---

## 目的

- ローカル環境・GitHub・Google Drive の 3 系統で同じ作業資産を参照できるようにする
- `de` の最後に毎回安全な export を作り、その export を Google Drive へ一方向アップロードする
- ChatGPT / 人間が Google Drive 上の Markdown・README・PROJECT_STATUS を参照しやすくする
- Drive 側コピーで Git 作業しない安全設計を維持する

---

## 正本の考え方

- 正本は **GitHub + `C:\hirayama-ai-workspace\workspace`**
- Google Drive は **共有・検索・参照・バックアップ用**
- `workspace` はローカル作業用ディレクトリ
- `workspace-export` は **upload 用の安全な export**
- Drive 側コピーや `workspace-export` 側では Git 操作をしない
- Google Drive for desktop の常駐同期は前提にしない

---

## 構成

```text
GitHub (source of truth)
        ^
        | git pull / commit / push
        |
C:\hirayama-ai-workspace\workspace
        |
        | scripts/sync-workspace-to-drive.ps1
        v
C:\hirayama-ai-workspace\workspace-export
        |
        | scripts/upload-workspace-export-to-gdrive.ps1
        | (rclone copy / sync)
        v
Google Drive
```

---

## 2段階フロー

### 1. export sync

`[sync-workspace-to-drive.ps1](C:\hirayama-ai-workspace\workspace\scripts\sync-workspace-to-drive.ps1)` が `workspace` を `workspace-export` へ guarded mirror します。

- `.git` / secrets / 巨大生成物を除外する
- `workspace-export\INDEX.md` を毎回再生成する
- export root に `.drive-export-root` marker を置く
- Google Drive へ送る前の安全な中間層として使う

### 2. Google Drive upload

`[upload-workspace-export-to-gdrive.ps1](C:\hirayama-ai-workspace\workspace\scripts\upload-workspace-export-to-gdrive.ps1)` が `workspace-export` を `rclone` で Google Drive へ一方向アップロードします。

- upload 先は専用 remote path に限定する
- rclone 未設定でも GitHub handoff は失敗扱いにしない
- upload 結果は `logs/gdrive-upload/` に残す

---

## copy と sync の違い

### `copy`

- source にあるファイルを追加・更新する
- Drive 側に残っている古いファイルは削除しない
- 初回確認や安全重視のテストに向く

### `sync`

- Drive 側を source と同じ状態へ揃える
- source から消えたファイルは Drive 側でも削除される
- 専用保存先が確認できた後の通常運用に向く

### 推奨方針

- 初回確認・安全重視: `copy`
- 専用保存先確認後の完全ミラー: `sync`

### 既定が `sync` である理由

この handoff の目的は、GitHub 正本に追従する最新の export 状態を Drive 側にも保つことです。  
通常運用では stale な古い Markdown や旧 status が残る方が再開判断を誤りやすいため、専用 remote path を前提に既定は `sync` のままにしています。

その代わり、初回セットアップ時は必ず `-Mode copy -DryRun`、次に `-Mode copy` で確認し、保存先が専用フォルダだと確認できてから `sync` に移る運用を推奨します。

---

## 同期対象

Drive へ持っていく主対象は、再開や参照に必要な Markdown / docs / status 類です。

- `README.md`
- `PROJECTS.md`
- `ROADMAP.md`
- `docs/PROJECT_STATUS.md`
- 各プロジェクトの `README.md`
- 各プロジェクトの `PROJECT_STATUS.md`
- 必要に応じて `spec.md` / `SPEC.md`
- `ai-os/` の運用文書
- `docs/` 配下の運用文書
- `workspace-export\INDEX.md`

---

## 非同期対象

`[drive-sync-exclude.txt](C:\hirayama-ai-workspace\workspace\config\drive-sync-exclude.txt)` で除外します。

### secrets / 認証

- `.env`
- `*.env`
- `service_account.json`
- `credentials.json`
- `token.json`
- `client_secret*.json`
- `*.pem`
- `*.p12`
- `*.pfx`
- `.clasp.json`
- `secrets/`

### Git / ローカル専用

- `.git/`
- `.claude/`

### 巨大生成物 / 一時ファイル

- `node_modules/`
- `.venv/`
- `venv/`
- `dist/`
- `build/`
- `coverage/`
- `.mypy_cache/`
- `.pytest_cache/`
- `__pycache__/`
- `tmp/`
- `artifacts/`
- `*.log`
- `logs/run/`
- `logs/error/`
- `logs/artifacts/`
- `logs/runlog/`

必要なら `config/drive-sync-exclude.txt` を更新して調整します。

---

## 設定項目

### export 側

- `HIRAYAMA_DRIVE_SYNC_EXPORT_ROOT`
  - 既定: `C:\hirayama-ai-workspace\workspace-export`
  - export 先を変えたいときに設定

### Google Drive upload 側

- `HIRAYAMA_GDRIVE_REMOTE`
  - 例: `gdrive`
  - `rclone config` で作った remote 名

- `HIRAYAMA_GDRIVE_REMOTE_PATH`
  - 例: `hirayama-ai-workspace/workspace-export`
  - Google Drive 上の専用保存先

remote path は、この workspace export 専用フォルダにしてください。共用フォルダ直下や root は避けます。

---

## 実行方法

### export のみ

```powershell
cd C:\hirayama-ai-workspace\workspace
.\scripts\sync-workspace-to-drive.ps1
```

### export dry-run

```powershell
.\scripts\sync-workspace-to-drive.ps1 -DryRun
```

### upload のみ

既定モードは `sync` です。

```powershell
.\scripts\upload-workspace-export-to-gdrive.ps1
```

### upload dry-run

```powershell
.\scripts\upload-workspace-export-to-gdrive.ps1 -DryRun
```

### 初回確認向け `copy`

```powershell
.\scripts\upload-workspace-export-to-gdrive.ps1 -Mode copy -DryRun
.\scripts\upload-workspace-export-to-gdrive.ps1 -Mode copy
```

### 完全ミラーの `sync`

```powershell
.\scripts\upload-workspace-export-to-gdrive.ps1 -Mode sync -DryRun
.\scripts\upload-workspace-export-to-gdrive.ps1 -Mode sync
```

---

## de 統合

`de` は次の順で動きます。

1. cleanup（必要時のみ）
2. commit
3. push
4. Run_Log JSON/TSV 出力
5. Run_Log シート追記（設定済み時）
6. Projects 最小同期（条件一致時）
7. `workspace -> workspace-export` export sync
8. `workspace-export -> Google Drive` rclone upload

### handoff のルール

- export / upload は **push 成功後のみ**
- export が失敗したら upload は実行しない
- upload が失敗しても commit / push / Run_Log / Projects は成功扱いのまま継続
- まとめて回避したいときは `de -SkipDriveSync`
- export は行うが upload だけ止めたいときは `de -SkipGDriveUpload`

---

## rclone 初回設定

各 PC で 1 回だけ行います。

1. `rclone` をインストールする
2. `rclone config` を実行する
3. Google Drive remote を作る
4. 確認する

```powershell
rclone listremotes
```

5. 環境変数を設定する

```powershell
[Environment]::SetEnvironmentVariable('HIRAYAMA_GDRIVE_REMOTE', 'gdrive', 'User')
[Environment]::SetEnvironmentVariable('HIRAYAMA_GDRIVE_REMOTE_PATH', 'hirayama-ai-workspace/workspace-export', 'User')
```

6. 必要なら export 先も設定する

```powershell
[Environment]::SetEnvironmentVariable('HIRAYAMA_DRIVE_SYNC_EXPORT_ROOT', 'C:\hirayama-ai-workspace\workspace-export', 'User')
```

7. 初回 upload は `copy` で確認する

```powershell
.\scripts\sync-workspace-to-drive.ps1 -DryRun
.\scripts\sync-workspace-to-drive.ps1
.\scripts\upload-workspace-export-to-gdrive.ps1 -Mode copy -DryRun
.\scripts\upload-workspace-export-to-gdrive.ps1 -Mode copy
```

8. 保存先が専用フォルダだと確認できたら通常運用へ移る

```powershell
de -ProjectId AIOS-06 "chore: verify gdrive handoff"
```

---

## 別PCで必要な初回設定

PC を替えたときは次を入れれば再開できます。

- Git / GitHub 認証
- `rclone` インストール
- `rclone config` で同じ remote を作成
- `HIRAYAMA_GDRIVE_REMOTE`
- `HIRAYAMA_GDRIVE_REMOTE_PATH`
- 必要なら `HIRAYAMA_DRIVE_SYNC_EXPORT_ROOT`

Drive 側で見る入口は `workspace-export\INDEX.md` です。  
ただし再開時の正本は GitHub / `workspace` 側であり、Drive 側は参照用です。

---

## INDEX.md の位置づけ

`workspace-export\INDEX.md` は Drive 上で人や ChatGPT が最初に開く前提の案内文書です。

- 何が正本か
- どの文書から読めば再開できるか
- 主要な README / PROJECT_STATUS / spec はどこか

を毎回わかるようにします。`sync-workspace-to-drive.ps1` 実行時に再生成されます。

---

## トラブル時の確認

### export に失敗した

- `logs/drive-sync/drive-sync_*.log`
- `logs/drive-sync/drive-sync_*.json`
- `workspace-export\.drive-export-root`

### upload に失敗した

- `logs/gdrive-upload/gdrive-upload_*.log`
- `logs/gdrive-upload/gdrive-upload_*.json`
- `rclone listremotes`
- `HIRAYAMA_GDRIVE_REMOTE`
- `HIRAYAMA_GDRIVE_REMOTE_PATH`

### rclone 未設定のとき

upload スクリプトは warning と summary を残して終了します。`de` 全体は失敗扱いにしません。

---

## Dashboard 反映

この運用変更は handoff 導線の変更なので、Dashboard 既存スキーマの列追加までは行いません。

- Run_Log: `de -ProjectId ...` の handoff で記録
- Projects: 対象 project の最小同期を継続
- 詳細ログ: `docs/PROJECT_STATUS.md` / `ai-os/PROJECT_STATUS.md` / `logs/drive-sync/` / `logs/gdrive-upload/`

Task_Queue は今回の変更が個別タスクの状態更新ではなく、handoff 基盤の変更なので更新不要です。
