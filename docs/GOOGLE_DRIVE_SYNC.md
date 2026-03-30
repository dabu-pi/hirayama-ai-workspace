# GOOGLE_DRIVE_SYNC.md

hirayama-ai-workspace 全体で、GitHub 正本を維持したまま Google Drive を参照・共有・バックアップ先として使うための運用設計です。

---

## 目的

- ローカル環境・GitHub・Google Drive の 3 系統で同じ作業資産を参照できるようにする
- Claude Code の作業完了時に `de` から Drive export を自然に実行できるようにする
- ChatGPT / 人間が Google Drive 上の Markdown・README・PROJECT_STATUS を参照しやすくする
- Drive 直下で Git 作業しない安全な同期方式にする

---

## 正本の考え方

- **正本は GitHub + `C:\hirayama-ai-workspace\workspace`**
- **Google Drive は共有・検索・参照・バックアップ用の export 先**
- **Drive 配下で直接 Git 作業しない**
- **Claude Code / Codex / 人間の handoff は引き続き `de` を基準にする**

---

## 採用構成

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
        | Google Drive for desktop
        v
Google Drive
```

---

## 同期対象

Drive 側で主に参照してほしいのは、次の Markdown / docs / status 類です。

- `README.md`
- `PROJECTS.md`
- `ROADMAP.md`
- `docs/PROJECT_STATUS.md`
- 各プロジェクトの `README.md`
- 各プロジェクトの `PROJECT_STATUS.md`
- 必要な `spec.md` / `SPEC.md`
- `ai-os/` の運用文書
- `docs/` 配下の運用文書

export root には同期後に `INDEX.md` も生成し、Drive 上から再開導線を辿りやすくします。

---

## 同期しない対象

`config/drive-sync-exclude.txt` で除外します。初期設定では次を除外します。

### 秘密情報

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

### 巨大生成物・一時物

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

必要に応じて `config/drive-sync-exclude.txt` を更新して調整します。

---

## 実行方法

### 単独実行

```powershell
cd C:\hirayama-ai-workspace\workspace
.\scripts\sync-workspace-to-drive.ps1
```

### dry-run

```powershell
.\scripts\sync-workspace-to-drive.ps1 -DryRun
```

### export 先を変更したい場合

```powershell
.\scripts\sync-workspace-to-drive.ps1 -ExportRoot 'D:\shared\workspace-export'
```

またはユーザー環境変数 `HIRAYAMA_DRIVE_SYNC_EXPORT_ROOT` を設定します。

---

## de 統合

`de` は次の順で動きます。

1. cleanup（必要時のみ）
2. commit
3. push
4. Run_Log JSON/TSV 出力
5. Run_Log シート追記（環境変数あり時）
6. Projects 最小同期（成功時かつ project_id 指定時）
7. **Drive export sync**

Drive sync のルール:

- push 成功後にのみ実行
- Drive sync が失敗しても commit / push / Run_Log / Projects sync の結果は壊さない
- 失敗時は console と `logs/drive-sync/` に明確に残す
- 回避したいときは `de -SkipDriveSync`

---

## 初回セットアップ

1. `C:\hirayama-ai-workspace\workspace` で通常の Git / de 環境をセットアップする
2. 必要なら export 先を環境変数で固定する
3. `.\scripts\sync-workspace-to-drive.ps1 -DryRun` で確認する
4. `.\scripts\sync-workspace-to-drive.ps1` で初回 export を作る
5. `workspace-export` を Google Drive for desktop の同期対象にする

---

## Google Drive for desktop 前提

この運用は **Drive 配下を作業ディレクトリにしない** ことが前提です。

想定パターン:

- Google Drive for desktop の「フォルダのバックアップ」に `C:\hirayama-ai-workspace\workspace-export` を登録する
- または Drive 同期先として別 export パスを指定し、そのパスを `HIRAYAMA_DRIVE_SYNC_EXPORT_ROOT` で合わせる

禁止事項:

- `workspace` 本体を Drive 配下へ移す
- Drive 同期フォルダで `git add / commit / push` を実行する

---

## 別PC再開時の見方

Drive 側では、まず `INDEX.md` を開きます。

見る順番:

1. `README.md`
2. `PROJECTS.md`
3. `ROADMAP.md`
4. `docs/PROJECT_STATUS.md`
5. 対象プロジェクトの `README.md`
6. 対象プロジェクトの `PROJECT_STATUS.md`
7. 必要なら `spec.md` / `SPEC.md`

ただし、再開の正本は GitHub 側です。Drive は参照と検索を助ける補助導線として使います。

---

## トラブル時の確認

### sync が失敗した

- `logs/drive-sync/drive-sync_*.log`
- `logs/drive-sync/drive-sync_*.json`
- `de` の console 出力

### export 先に marker がない

`workspace-export` が手作業で別用途に使われている可能性があります。安全のため同期は停止します。空フォルダへ戻すか、正しい export 先を指定してください。

### Google Drive に反映されない

- Google Drive for desktop 側で対象フォルダが同期対象か
- `workspace-export` にファイル自体は生成されているか
- Drive アプリが停止していないか

### INDEX.md が古い

`sync-workspace-to-drive.ps1` 実行時に毎回再生成されます。Drive sync 自体が失敗していないかを先に確認してください。

---

## Dashboard 反映

この運用変更は AIOS / workspace handoff 運用の変更なので、`de -ProjectId AIOS-06` の handoff で Run_Log / Projects 反映対象に含めます。

ただし、Drive sync 自体の詳細結果は Dashboard の既存スキーマへ新列追加せず、次で管理します。

- `docs/PROJECT_STATUS.md`
- `ai-os/PROJECT_STATUS.md`
- `logs/drive-sync/`

Run_Log / Projects の既存設計は維持し、Drive sync は handoff 補助導線として扱います。
