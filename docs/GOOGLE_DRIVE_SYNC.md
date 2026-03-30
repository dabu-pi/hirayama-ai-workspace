# GOOGLE_DRIVE_SYNC.md

hirayama-ai-workspace 全体で、GitHub 正本を維持したまま Google Drive を共有・検索・参照・バックアップ先として使うための運用設計です。

---

## 目的

- ローカル環境・GitHub・Google Drive の 3 系統で同じ作業資産を参照できるようにする
- `de` の最後に毎回安全な export を作り、その export を Google Drive へ一方向アップロードする
- ChatGPT / 人間が Google Drive 上の Markdown・README・PROJECT_STATUS を参照しやすくする
- Drive 配下で直接 Git 作業しない安全設計を維持する

---

## 正本の考え方

- 正本は **GitHub + `C:\hirayama-ai-workspace\workspace`**
- Google Drive は **共有・検索・参照・バックアップ用**
- `workspace` 本体を Drive 配下で直接作業しない
- `workspace-export` は **アップロード専用の安全な export**
- Drive 側のコピーや `workspace-export` 側では Git 操作をしない

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
        | (rclone sync/copy)
        v
Google Drive
```

---

## 2段階フロー

### 1. export sync

`scripts/sync-workspace-to-drive.ps1` が `workspace` を `workspace-export` へ guarded mirror します。

- `.git` / secrets / 巨大生成物を除外する
- `workspace-export\INDEX.md` を毎回再生成する
- export root に `.drive-export-root` marker を置く
- Drive 側へ送る前の安全な中間層として使う

### 2. Google Drive upload

`scripts/upload-workspace-export-to-gdrive.ps1` が `workspace-export` を `rclone` で Google Drive へ一方向アップロードします。

- 既定は `rclone sync`
- 専用の remote path を使う
- rclone 未設定でも GitHub handoff は失敗扱いにしない
- upload 結果は `logs/gdrive-upload/` に残す

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

`config/drive-sync-exclude.txt` で除外します。

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

### Google Drive upload のみ

```powershell
.\scripts\upload-workspace-export-to-gdrive.ps1
```

### upload dry-run

```powershell
.\scripts\upload-workspace-export-to-gdrive.ps1 -DryRun
```

### copy モードを使う場合

```powershell
.\scripts\upload-workspace-export-to-gdrive.ps1 -Mode copy
```

既定は `sync` です。Drive 側を export の内容へ揃えたいときは `sync` のまま使います。

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
- 一時的にまとめて回避したいときは `de -SkipDriveSync`
- export は行うが upload だけ止めたいときは `de -SkipGDriveUpload`

---

## rclone 初回設定

各 PC で 1 回だけ行います。

1. `rclone` をインストールする
2. `rclone config` を実行する
3. Google Drive remote を作る
4. 確認:

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

7. 動作確認する

```powershell
.\scripts\sync-workspace-to-drive.ps1 -DryRun
.\scripts\upload-workspace-export-to-gdrive.ps1 -DryRun
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

を確認します。

### upload に失敗した

- `logs/gdrive-upload/gdrive-upload_*.log`
- `logs/gdrive-upload/gdrive-upload_*.json`
- `rclone listremotes`
- `HIRAYAMA_GDRIVE_REMOTE`
- `HIRAYAMA_GDRIVE_REMOTE_PATH`

を確認します。

### rclone 未設定のとき

upload スクリプトは warning と summary を残して終了します。`de` 全体は失敗扱いにしません。

---

## Dashboard 反映

この運用変更は handoff 導線の変更なので、Dashboard 既存スキーマの列追加までは行いません。

- Run_Log: `de -ProjectId ...` の handoff で記録
- Projects: 対象 project の最小同期を継続
- 詳細ログ: `docs/PROJECT_STATUS.md` / `ai-os/PROJECT_STATUS.md` / `logs/drive-sync/` / `logs/gdrive-upload/`

Task_Queue は今回の変更が個別タスクの状態更新ではなく、handoff 基盤の変更なので更新不要です。
