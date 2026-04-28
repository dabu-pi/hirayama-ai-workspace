# 00 Overview — AIOS Dual-Agent Orchestrator

## このプロジェクトの目的

OpenAI API（ChatGPT）と Anthropic API（Claude）を、共通の履歴ストアで連携させる
**自前オーケストレータ**を構築する。

MCP や画面自動操作は使わない。APIを直接叩き、Python スクリプトが仲介する。

---

## なぜ作るか

| 現状の問題 | このプロジェクトで解決すること |
|---|---|
| ChatGPT と Claude の会話が断絶している | 共通の SQLite ストアで履歴を共有する |
| 指示や結果をコピペで渡している | Orchestrator が自動でターンを回す |
| どのAIが何をしたか記録が残らない | run_log に全 API コールを記録する |
| 危険操作の確認が属人的 | approval_gate で CLI 承認フローを強制する |

---

## AIOS 内での役割

```
AIOS（全体）
│
├── Dashboard / Projects シート   ← 案件管理・進捗の正本
├── de コマンド（handoff）        ← commit / push / run_log 記録
│
└── aios-orchestrator/            ← このプロジェクト
    ChatGPT と Claude が協調して
    タスクを実行する自動化レイヤー
```

**位置づけ:**
- AIOS の「実行エンジン」として機能する
- 人間は監視・承認に専念し、コピペ作業から離れる
- run_log は de コマンドの Run_Log シートと将来的に統合する

---

## 役割分担

| 役割 | 担当 | 責務 |
|---|---|---|
| Planner | ChatGPT (OpenAI API) | タスクを分解し、1ターン1指示を書く |
| Executor | Claude (Anthropic API) | 指示を読んで実行し、結果を報告する |
| Orchestrator | Python スクリプト | ターン管理・DB書き込み・承認制御 |
| Human | 人間 | ゴール設定・承認・異常検知 |

---

## 制約・原則

- 自動送信・自動削除などの不可逆操作は実装しない
- artifacts（生成コード等）は保存するが自動実行しない
- API キーは `.env` で管理し、コードに直書きしない
- run_log は必ず書く（コスト追跡・監査の基盤）
