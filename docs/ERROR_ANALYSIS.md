# ERROR_ANALYSIS.md — 自動エラー解析システム仕様

平山克司ワークスペース — `analyze-error.ps1` と `auto-dev.ps1` による自動エラー解析の仕様書。

最終更新: 2026-03-06

---

## 概要

コマンドが失敗した（exit != 0）とき、`auto-dev.ps1` が自動的に `analyze-error.ps1` を呼び出し、
最新エラーログを解析して AI に貼り付けられる形式のデバッグレポートを生成する。

```
コマンド実行 (rwl)
    ↓ exit != 0
auto-dev.ps1 → analyze-error.ps1 → artifacts/debug_YYYYMMDD_HHmmss.txt
                                        ↓
                               [AI REPORT] パスを表示
                                        ↓
                               Claude に貼り付けて診断
```

---

## スクリプト: `scripts/analyze-error.ps1`

### パラメータ

| パラメータ | 型 | デフォルト | 説明 |
|---|---|---|---|
| `-LogDir` | string | `logs` | ログルートディレクトリ |
| `-Lines` | int | `50` | 末尾から表示する行数 |
| `-All` | switch | — | 全行を表示（`-Lines` を無視） |
| `-ListAll` | switch | — | 最近のエラーログ一覧を表示して終了 |

### 呼び出し例

```powershell
# 最新エラーを解析（デフォルト: 末尾50行）
analyze-error.ps1

# 末尾100行を表示
analyze-error.ps1 -Lines 100

# 全行を表示
analyze-error.ps1 -All

# エラーログの一覧を確認
analyze-error.ps1 -ListAll
```

### 処理フロー

1. `logs/error/error_*.log` の最新ファイルを検出
2. 対応する `logs/run/run_*.log`（同タイムスタンプ優先、なければ直前）をリンク
3. ログヘッダー（`#` 行）からコマンド・終了コード・開始時刻を抽出
4. `[STDERR]` プレフィックス行を抽出・表示（最大30行）
5. ログ末尾 N 行を表示
6. AI デバッグレポートを `artifacts/debug_YYYYMMDD_HHmmss.txt` に保存

---

## AI デバッグレポート形式

`artifacts/` に保存されるレポートの構造:

```
=== AI Debug Report ===
Generated : 2026-03-06 14:30:00
Project   : workspace
Error log : error_20260306_143000.log
Run log   : run_20260306_143000.log
Command   : python -m pytest tests/ -v
Exit code : 1
Run start : 2026-03-06 14:29:55

=== STDERR (error lines) ===
[実際の STDERR 出力]

=== LAST 50 LINES OF OUTPUT ===
[ログ末尾 50 行]

=== PLEASE HELP ===
The above error occurred when running: python -m pytest tests/ -v
What is the likely cause and how can I fix it?
```

このレポートを Claude に貼ると、根本原因と修正方針を返答してもらえる。

---

## auto-dev.ps1 との統合

`auto-dev.ps1` は exit != 0 のとき、自動で以下を実行する:

```powershell
# auto-dev.ps1 内部（抜粋）
if ($exitCode -ne 0) {
    # ... STOP 表示 ...
    & $aerrScript -LogDir $LogDir -Lines 20   # analyze-error.ps1 を呼ぶ
    # artifacts/ の最新レポートパスを [AI REPORT] として表示
}
```

出力例（コンソール）:

```
================================================================
  [AI REPORT] C:\hirayama-ai-workspace\workspace\artifacts\debug_20260306_143000.txt
  Paste this file to Claude for diagnosis.
================================================================
```

---

## ログディレクトリ構造

```
workspace/
├── logs/
│   ├── run/
│   │   └── run_YYYYMMDD_HHmmss.log   # コマンドの全出力（rwl が生成）
│   ├── error/
│   │   └── error_YYYYMMDD_HHmmss.log # 失敗時のみ（rwl が生成）
│   └── notes/
│       └── note_YYYYMMDD_HHmmss.json # 開発メモ（note.ps1 が生成）
└── artifacts/
    └── debug_YYYYMMDD_HHmmss.txt     # AI デバッグレポート（analyze-error.ps1 が生成）
```

### run ログのヘッダー形式

`run-with-log.ps1` が生成するログは以下のヘッダーから始まる:

```
# Command   : python -m pytest tests/ -v
# Start     : 2026-03-06 14:29:55
# ExitCode  : 1
# [STDERR] エラーメッセージ行 ...
（以降: コマンドの標準出力）
```

`analyze-error.ps1` はこのヘッダーを解析して AI レポートに埋め込む。

---

## Phase3 ループとの連携

Phase3.1 自走ループでは、`[AI REPORT]` ファイルの内容を直接 Claude に貼ることで
次サイクルの修正方針を取得する:

```
1. auto-dev.ps1 が FAILED → [AI REPORT] パスが表示される
2. artifacts/debug_*.txt の内容をコピー
3. auto-dev-phase3-loop.md のプロンプトと一緒に Claude に貼る
4. Claude が根本原因を1つに絞り、修正コマンドを提示
5. COMMANDS を実行 → 次サイクルへ
```

詳細: `docs/PROMPTS/auto-dev-phase3-loop.md`

---

## 注意事項

- `analyze-error.ps1 -All` は大きなログで出力が長くなる場合がある。通常は `-Lines 50`（デフォルト）で十分
- AI レポートの `=== PLEASE HELP ===` セクションはそのまま Claude に提示する用途
- エラーログが存在しない場合（`logs/error/` なし、またはファイルなし）は exit 0 で終了する
- `artifacts/` は `.gitignore` に追加を推奨（デバッグレポートはコミット不要）

---

## 参照ドキュメント

| ドキュメント | 内容 |
|---|---|
| `docs/AUTO_DEV_MODE.md` | Phase1 全体仕様 |
| `docs/AUTO_DEV_MODE_PHASE2.md` | Phase2 仕様（スクリプト一覧） |
| `docs/AUTO_DEV_MODE_PHASE3.md` | Phase3 仕様（自走ループ） |
| `docs/PROMPTS/auto-dev-phase3-loop.md` | Phase3.1 ループ継続プロンプト |
| `scripts/analyze-error.ps1` | エラー解析スクリプト本体 |
| `scripts/auto-dev.ps1` | 統合コマンダー（analyze-error を統合） |
| `scripts/run-with-log.ps1` | ログ付き実行（run/error ログを生成） |
