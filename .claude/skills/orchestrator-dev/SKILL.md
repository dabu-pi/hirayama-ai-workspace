---
name: orchestrator-dev
description: Use this when the user says "オーケストレーターで進めて", "開発オーケストレーター", "Claude Discord OpenAI Orchestrator", "auto dev loop", "Discord経由でClaudeに流す", "前回の続きから再開", "別PCで再開", or wants to continue development through the Claude ↔ Discord ↔ OpenAI Orchestrator workflow. Guides safe, logged, human-in-the-loop development using git status, pull, branch confirmation, process health checks, Discord commands, approval flow, commit/push reporting, and restart/resume instructions.
---

# Orchestrator Development Skill

この Skill は、Claude ↔ Discord ↔ OpenAI Orchestrator を使って開発を進めるための運用手順です。

## 呼び出し合図

ユーザーが以下のように言ったら、この Skill を使う。

- 「オーケストレーターで進めて」
- 「開発オーケストレーター」
- 「Claude ↔ Discord ↔ OpenAI Orchestrator」
- 「Discord経由でClaudeに流す」
- 「auto dev loop」
- 「前回の続きから再開」
- 「別PCで再開」
- 「!run に流すプロンプトを作って」
- `/orchestrator-dev`

## 基本方針

- `.env` や secret は表示しない。
- AUTO_LOOP=true には、ユーザーが明示するまでしない。
- 作業前に必ず現在地を確認する。
- 実行結果は STATUS / BRANCH / COMMIT / PUSH / TEST / NEXT 形式でまとめる。
- 実機確認していないものを「実機確認済み」と書かない。
- 不明な点は推測で断定せず、確認方法を示す。
- commit / push / clasp push / deploy の有無を明記する。
- 長い作業では途中経過を短く報告する。
- ユーザーが「このまま進めて」と言った場合でも、secret 表示や危険操作は避ける。

## 開発開始時の標準チェック

まず以下を確認する。

1. `git status`
2. `git pull`
3. 現在 branch
4. `.env` が存在し、git管理外であること
5. 対象プロジェクトの現在地
6. Orchestrator API / Planner Agent / Discord Bot の3プロセス状態
7. `/health` または `/diagnostics`
8. AUTO_LOOP の状態
9. MAX_AUTO_LOOP_ITERATIONS
10. 直近 run_id / commit / task status

## 3プロセスが停止している場合の起動手順

標準チェック 6 で node プロセスが検出されない、または `/health` が応答しない場合は、以下を自動実行する。

### 起動前確認

```bash
# dist ビルド済みか確認（なければ npm run build が必要）
ls C:/hirayama-ai-workspace/automation/claude-openai-discord-orchestrator/apps/orchestrator-api/dist/
ls C:/hirayama-ai-workspace/automation/claude-openai-discord-orchestrator/apps/planner-agent/dist/
ls C:/hirayama-ai-workspace/automation/claude-openai-discord-orchestrator/apps/discord-bot/dist/
```

dist が存在しない場合は先にビルドを実行する。

```bash
cd C:/hirayama-ai-workspace/automation/claude-openai-discord-orchestrator
npm run build
```

### バックグラウンド起動（順番厳守）

**① Orchestrator API（最初に起動）**

```bash
# run_in_background: true で実行
cd C:/hirayama-ai-workspace/automation/claude-openai-discord-orchestrator/apps/orchestrator-api
node dist/index.js >> C:/hirayama-ai-workspace/automation/claude-openai-discord-orchestrator/logs/orchestrator.log 2>&1
```

起動後 3秒待ち、`curl http://localhost:3100/health` でレスポンスを確認してから次へ進む。

**② Planner Agent**

```bash
# run_in_background: true で実行
cd C:/hirayama-ai-workspace/automation/claude-openai-discord-orchestrator/apps/planner-agent
node dist/index.js >> C:/hirayama-ai-workspace/automation/claude-openai-discord-orchestrator/logs/planner.log 2>&1
```

**③ Discord Bot（最後に起動）**

```bash
# run_in_background: true で実行
cd C:/hirayama-ai-workspace/automation/claude-openai-discord-orchestrator/apps/discord-bot
node dist/index.js >> C:/hirayama-ai-workspace/automation/claude-openai-discord-orchestrator/logs/discord-bot.log 2>&1
```

### 起動確認

```bash
# API ヘルスチェック
curl http://localhost:3100/health

# ログ末尾で各プロセスの ready メッセージを確認
tail -3 logs/orchestrator.log
tail -3 logs/planner.log
tail -3 logs/discord-bot.log
```

**期待する起動確認メッセージ:**

| プロセス | 確認メッセージ |
|---|---|
| Orchestrator API | `Orchestrator API listening on port 3100` |
| Planner Agent | `Planner agent listening on port 3101` |
| Discord Bot | `Discord bot ready: Hirayama AI Bot#1825` |

### 起動後の報告フォーマット

```
ORCHESTRATOR: 起動済み
  API:     port 3100 / idle / AUTO_LOOP=false
  Planner: port 3101
  Bot:     Hirayama AI Bot#1825 ready
```

起動確認後、標準チェックの 7〜10 に進む。

## Discord に流すプロンプト作成時

ユーザーが「Discordに流すプロンプトを作って」と言ったら、以下の形式で出す。

```md
!run --project <project_id> <task内容>

制約:
- .env や secret は表示しない
- 作業前に git status / git pull / branch を確認
- 変更ファイルを明記
- テストまたは確認結果を明記
- commit / push まで実施
- 実機未確認なら未確認と書く
- 最後に STATUS / BRANCH / COMMIT / PUSH / NEXT を報告
```

## 作業完了報告フォーマット

```
STATUS:
BRANCH:
COMMIT:
PUSH:
TEST:
BUILD:
CLASP_PUSH:
DEPLOY:

UPDATED_FILES:
- 

SUMMARY:
- 

ROOT_CAUSE:
- 

FIX:
- 

VERIFY:
- 

NEXT:
- 

RISKS:
- 
```

## 複数プロジェクト運用ルール

- この Skill は全プロジェクトで使用できる。
- ただし Orchestrator 本体の実行は原則1件ずつ行う。
- 複数プロジェクトへ同時に `!run` を投げない。
- 次のプロジェクトを実行する前に、前の run が完了し、Orchestrator state が `idle` に戻っていることを確認する。
- `CLAUDE_PROJECT_ROOT` を切り替える場合は、対象プロジェクト・branch・git status を必ず確認する。
- 同時並行運用が必要な場合は、port / state / worktree / approval thread / project queue を分けた別インスタンス構成にする。
- AUTO_LOOP=true はユーザーが明示するまで有効化しない。
