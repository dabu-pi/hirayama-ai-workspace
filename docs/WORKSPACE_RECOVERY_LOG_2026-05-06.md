# WORKSPACE RECOVERY LOG — 2026-05-06

このPCで `C:\hirayama-ai-workspace` 配下の主要プロジェクトの棚卸し・復旧を実施した。
別PC移行・再セットアップ・トラブル復旧時の参考記録として残す。

---

## 1. 概要

- このPCの主要プロジェクトをすべて確認し、不足・破損していたものを復旧した
- 最終的に全主要プロジェクトが clean / 起動確認 / build確認済みの状態になった
- 認証情報（`.env` / `token` / APIキー）の中身はこの記録に含めない

---

## 2. 実施した主な作業

### workspace 親 repo

- Path: `C:\hirayama-ai-workspace\workspace`
- Branch: `feature/auto-dev-phase3-loop`
- 状態: `git status clean`
- 実施: 不要な `training-program-platform-jp_artifacts_20260505/` ディレクトリを削除
- 他ブランチの pull 確認済み

---

### desktop-work-status-overlay

- GitHub: `https://github.com/dabu-pi/desktop-work-status-overlay.git` (private)
- Clone先: `C:\hirayama-ai-workspace\workspace\desktop-work-status-overlay`
- Branch: `master`
- 実施内容:
  - Python 3.12.10 を winget で導入（このPCに未導入だった）
  - `requirements.txt` から `pyvda` / `pywin32` / `comtypes` を導入
  - `run.bat` 起動確認 → PASS
  - `start-silent.bat` 通常起動確認 → PASS
- 最終状態: `git status clean`

---

### training-program-platform-jp

- Path: `C:\hirayama-ai-workspace\workspace\training-program-platform-jp`
- 問題: 112ファイルが `unstaged deleted` 状態になっていた
- 実施内容:
  - `git restore .` でファイル復元
  - `git fetch --all --prune`
  - `git pull --ff-only` で 16 commit 取得
  - latest commit: `68997f2 feat: Phase U-4A — /programs 導線改善・/my-programs 空状態改善・詳細画面コピーヒント追加`
  - `npm run typecheck` → PASS
  - `npm run build` → PASS
- 最終状態: `git status clean`
- 注意: migration `000038〜000040` の本番適用状況は別途確認が必要（未適用の可能性あり）

---

### training-trend-analyzer

- Path: `C:\hirayama-ai-workspace\workspace\training-trend-analyzer`
- 問題: `.git` なし・ソース消失・`data/` のみ残存という状態だった
- 実施内容:
  - `data/` を一時退避
  - GitHub から再 clone
  - `data/output` の差分を `workspace-export` にバックアップ
  - `git restore data/output` / `git clean -fd -- data/output` で clean 化
  - `pytest` → **164 passed**
- 最終状態: `git status clean`

---

### automation / claude-openai-discord-orchestrator

- Path: `C:\hirayama-ai-workspace\automation\claude-openai-discord-orchestrator`
- 備考: `automation/` 自体は git repo ではない。orchestrator は独立 repo として存在している
- Remote: `https://github.com/dabu-pi/hirayama-claude-orchestrator.git`
- Branch: `main`
- latest commit: `e740fff fix(orchestrator): run discord bot from root directory`
- 最終状態: `git status clean`
- `.env` は存在するが gitignore 対象。中身はこの記録に含めない

---

### wildboar-member-management

- Path: `C:\hirayama-ai-workspace\workspace\wildboar-member-management`
- Branch: `feature/wildboar-member-phase4`
- 最終状態: `git status clean`
- フェーズ状況: Phase 8 全 CLOSED
- 次候補: Phase 9 経営分析ダッシュボード

---

### jrec-sf01-selfpay

- Path: `C:\hirayama-ai-workspace\workspace\gas-projects\jrec-sf01-selfpay`
- 管理: 親 workspace repo 管理
- フェーズ状況: Phase AI-2 CLOSED
- 次候補: Phase AI-3 AI API 本番実装

---

### jyu-gas-ver3.1

- Path: `C:\hirayama-ai-workspace\workspace\gas-projects\jyu-gas-ver3.1`
- 管理: 親 workspace repo 管理
- フェーズ状況: WEB-1 / WEB-2 / WEB-2.5 完了
- 次候補: WEB-2.5 来院登録フォーム実動作確認

---

## 3. 最終状態一覧

| Project | Path | Repo | Branch | Status | Test/Build | Next |
|---|---|---|---|---|---|---|
| workspace | `workspace/` | workspace（親） | `feature/auto-dev-phase3-loop` | clean | — | 通常開発 |
| desktop-work-status-overlay | `workspace/desktop-work-status-overlay` | 独立 (private) | `master` | clean | 起動確認 PASS | Phase 3-E |
| training-program-platform-jp | `workspace/training-program-platform-jp` | 独立 | — | clean | typecheck/build PASS | Phase U-4A 以降 |
| training-trend-analyzer | `workspace/training-trend-analyzer` | 独立 | — | clean | pytest 164 PASS | 週次運用フロー |
| claude-openai-discord-orchestrator | `automation/claude-openai-discord-orchestrator` | 独立 | `main` | clean | — | 通常起動 |
| wildboar-member-management | `workspace/wildboar-member-management` | workspace（親） | `feature/wildboar-member-phase4` | clean | — | Phase 9 |
| jrec-sf01-selfpay | `workspace/gas-projects/jrec-sf01-selfpay` | workspace（親） | — | clean | — | Phase AI-3 |
| jyu-gas-ver3.1 | `workspace/gas-projects/jyu-gas-ver3.1` | workspace（親） | — | clean | — | WEB-2.5 実動作確認 |

---

## 4. 注意点

- `.env` / `token` / 認証情報の中身はこの記録に含めていない
- `training-program-platform-jp` の migration 000038〜000040 は本番適用状況が未確認。次回作業時に確認すること
- `workspace-export` 配下に `training-trend-analyzer/data/output` のバックアップが存在する（クリーン化前の差分）
- `automation/` 自体は git 管理外（orchestrator だけが独立 repo）

---

## 5. 作業環境（参考）

| 項目 | 内容 |
|---|---|
| 実施日 | 2026-05-06 |
| PC | このPC（C:\hirayama-ai-workspace） |
| Python | 3.12.10（winget で導入） |
| 主な追加パッケージ | pyvda / pywin32 / comtypes |
| workspace branch | feature/auto-dev-phase3-loop |
