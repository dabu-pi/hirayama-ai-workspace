# NEXT_ACTIONS.md — AIOS 次の行動 / 別PC再開手順

最終更新: 2026-04-26

> 再開時にこのファイルを最初に読む。PROJECT_STATUS.md は詳細参照用。

---

## 別PC セットアップ手順

### 前提
- Git / Node.js (v24+) / npm / Claude Code CLI がインストール済みであること
- GitHub への SSH または HTTPS アクセスが設定済みであること
- `.env` の実際の値は手動でコピー（チャットに貼らない）

---

### Step 1 — リポジトリ clone

```bash
mkdir -p C:/hirayama-ai-workspace/automation
mkdir -p C:/hirayama-ai-workspace/workspace

# orchestrator
git clone https://github.com/dabu-pi/hirayama-claude-orchestrator.git \
  C:/hirayama-ai-workspace/automation/claude-openai-discord-orchestrator

# workspace（training / AIOS など全プロジェクト）
git clone https://github.com/dabu-pi/hirayama-ai-workspace.git \
  C:/hirayama-ai-workspace/workspace
cd C:/hirayama-ai-workspace/workspace
git checkout feature/auto-dev-phase3-loop
```

---

### Step 2 — orchestrator .env を作成

`.env.example` をコピーして `.env` に名前を変え、以下のキーに値を設定する。
**値はチャットに貼らず、既存PCから安全な方法でコピーする。**

```
# Discord
DISCORD_WEBHOOK_URL=
DISCORD_BOT_TOKEN=
DISCORD_APPLICATION_ID=
DISCORD_GUILD_ID=
DISCORD_ALLOWED_USER_IDS=
DISCORD_CHANNEL_ID=
DISCORD_REPORT_CHANNEL_ID=
DISCORD_APPROVAL_CHANNEL_ID=

# OpenAI
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.4

# Orchestrator（ポートはそのままでOK）
ORCHESTRATOR_PORT=3100
ORCHESTRATOR_URL=http://localhost:3100
AUTO_LOOP=false
MAX_AUTO_LOOP_ITERATIONS=5
CLAUDE_RUN_TIMEOUT_MS=600000

# Planner
PLANNER_PORT=3101
PLANNER_URL=http://localhost:3101

# Claude Code
CLAUDE_PROJECT_ROOT=C:/hirayama-ai-workspace/automation/claude-openai-discord-orchestrator
PROJECT_NAME=claude-openai-discord-orchestrator
GIT_BRANCH=main

# Logging
LOG_LEVEL=info
```

```bash
# ファイル作成
cp C:/hirayama-ai-workspace/automation/claude-openai-discord-orchestrator/.env.example \
   C:/hirayama-ai-workspace/automation/claude-openai-discord-orchestrator/.env
# → .env を手動で編集して値を設定する
```

---

### Step 3 — npm install / build

```bash
cd C:/hirayama-ai-workspace/automation/claude-openai-discord-orchestrator
npm install
npm run build
npm test
# → 457 passed, 0 failed
```

---

### Step 4 — 3プロセス起動

```bash
cd C:/hirayama-ai-workspace/automation/claude-openai-discord-orchestrator
node apps/orchestrator-api/dist/index.js > /tmp/orch.log 2>&1 &
node apps/planner-agent/dist/index.js    > /tmp/plan.log 2>&1 &
node apps/discord-bot/dist/index.js      > /tmp/bot.log  2>&1 &
```

---

### Step 5 — 起動確認

```bash
curl -s http://localhost:3100/health
# 期待値: {"status":"ok","auto_loop":false,"state":"idle","run_id":null,...}

curl -s http://localhost:3101/health
# 期待値: {"status":"ok","mock_mode":false}
```

Discord `#01-ops-control` で確認:
```
!status
# → state: idle / AUTO_LOOP: false
```

---

### Step 6 — workspace 側（training / AIOS など）

```bash
cd C:/hirayama-ai-workspace/workspace
git pull
# → feature/auto-dev-phase3-loop の最新を取得

# AIOS の次のアクションを確認
cat aios-orchestrator/NEXT_ACTIONS.md
```

Discord でプロジェクト指定して run:
```
!status --project aios
!run --project aios <prompt>
!run --project training <prompt>
!run --project orchestrator <prompt>
```

---

### AIOS dual-agent-poc の Python 環境（任意）

AIOS の Python コードを直接実行する場合:

```bash
cd C:/hirayama-ai-workspace/workspace/aios-orchestrator/dual-agent-poc

# venv 作成（初回のみ）
python -m venv .venv_phase2
.venv_phase2/Scripts/activate

# 依存関係インストール
pip install -r requirements.txt

# .env 作成（値は手動コピー）
# 必要なキー:
#   ANTHROPIC_API_KEY=
#   OPENAI_API_KEY=
#   SUMMARY_MODEL=        # summarizer 用モデル名（省略可）

# テスト実行
.venv_phase2/Scripts/python.exe -m pytest \
    test_phase18_manifest_diff.py \
    test_phase19_export_diff_report.py \
    test_phase20_artifact_content_diff.py -v
# → 45 passed
```

---

### 別PC での注意事項

| 項目 | 注意点 |
|---|---|
| `.env` の値 | チャットに貼らない。既存PCから安全な方法でコピー |
| `sed -i` | Windows で .env を壊す場合あり。PowerShell `[System.IO.File]::WriteAllText()` 推奨 |
| slash command 再登録 | Discord slash commands は Guild ごとに登録が必要 → `node scripts/register-slash-commands.js` |
| AUTO_LOOP | 通常 `false`。自動運用時だけ `true` に変更し、完了後は必ず `false` に戻す |
| config 変更後の再起動 | `.env` / `config/projects.json` を変更したら3プロセス全再起動 |

---

## 現在地

| 項目 | 状態 |
|---|---|
| 最新完了 | Phase 20 CLOSED（artifact 内容 diff 比較）|
| Task 1〜5 | ✅ すべて完了 |
| Phase 5〜20 | ✅ すべて完了 |
| テスト | Phase 18〜20 合算 45/45 PASS |
| branch | `feature/auto-dev-phase3-loop` |

---

## 次の候補（推奨順）

### 1. Phase B — context 圧縮（推奨）

**目的:** 長い会話でのトークン肥大を防ぐ
**影響範囲:** `summarizer.py` 拡張 + `orchestrator.py` の run_loop 修正
**安全度:** 高（内部処理のみ、外部 API 呼び出し構造を変えない）
**前提:** real API 動作確認が必要

Discord 再開プロンプト:
```
!run --project aios AIOS Phase B「context圧縮」を実装してください。
summarizer.py を確認し、古いメッセージを summary に変換してトークン削減する仕組みを
orchestrator の run_loop に組み込んでください。
変更範囲は aios-orchestrator 内に限定してください。
```

---

### 2. Phase C — Google Sheets 連携（後回し可）

**目的:** run_log を Google Sheets Run_Log シートに書き込む
**影響範囲:** 新規モジュール追加（既存コードへの影響小）
**安全度:** 中（外部 API 呼び出しあり、credentials 管理が必要）
**前提:** Google Sheets API credentials が設定済みの環境が必要

---

### 3. Phase D — CI 統合（後回し可）

**目的:** GitHub Actions で manifest-diff / content-diff を自動実行
**影響範囲:** `.github/workflows/` 追加のみ
**安全度:** 高（新規ファイル追加のみ）
**前提:** GitHub Actions が利用可能な環境

---

## テスト再実行コマンド

```bash
cd C:/hirayama-ai-workspace/workspace/aios-orchestrator/dual-agent-poc
.venv_phase2/Scripts/python.exe -m pytest \
    test_phase18_manifest_diff.py \
    test_phase19_export_diff_report.py \
    test_phase20_artifact_content_diff.py -v
# → 45 passed
```

---

## 注意事項（引き継ぎ）

- Windows subprocess tests には `env={**os.environ, "PYTHONIOENCODING": "utf-8"}` が必要
- `claude -p` のタイムアウトは 600s。実装量が多い場合は途中確認が必要
- workspace は monorepo — commit 時は `aios-orchestrator/` 以外を add しない
- `.env` / secrets の中身は表示しない
- AUTO_LOOP=true は作業完了後に必ず false に戻す
