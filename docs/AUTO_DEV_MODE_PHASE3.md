# AUTO_DEV_MODE_PHASE3.md — Claude 自動開発モード Phase3 仕様

平山克司ワークスペース — Phase2（スクリプト固定ループ）から Phase3（Claude 自律開発）への移行仕様。

最終更新: 2026-03-05

---

## 1. Phase2 との差分

| 観点 | Phase2 | Phase3 |
|---|---|---|
| セッション開始入力 | タスクを手動で指定 | `PROJECT_STATUS.md` を読んで自動把握 |
| 実行コマンド | `auto-dev-run.ps1` | `auto-dev.ps1`（統合コマンダー）を必須 |
| ブランチ強制 | 規約あり・ガイドのみ | feature/* 必須・master 直はドキュメントのみ |
| 失敗時の診断 | analyze-error を表示 | `[AI REPORT]` を Claude に貼って自動診断 |
| STOP 条件 | 4項目 | 8項目（削除・本番・大量変更を追加） |
| 出力フォーマット | 6セクション（GIT 独立） | 5セクション（GIT を COMMANDS に統合） |
| 状態の引き継ぎ | 毎回リセット | `PROJECT_STATUS.md` を引き継ぎ媒体として使う |
| 追加ラッパー | なし | `scripts/auto-dev-phase3.ps1` |

---

## 2. Phase3 の1サイクルフロー

```
┌──────────────────────────────────────────────────────────────────┐
│                       PHASE3 CYCLE                               │
│                                                                  │
│  START   PROJECT_STATUS.md を読む（現在地・STOP理由・NEXT 把握） │
│          ROADMAP 「今すぐ」でタスク確認                          │
│          dstat でスナップショット                                 │
│          master なら feature/* 作成コマンドを提示                │
│          ↓                                                       │
│  PLAN    PLAN セクションを出力（承認を待つ）                     │
│          ↓                                                       │
│  DO      コードを実装                                            │
│          auto-dev.ps1 -Cmd "..." -Note "..." [-Commit]           │
│          ↓                                                       │
│  CHECK   exit 0 → 成功フロー                                    │
│          exit != 0 → [AI REPORT] パスを出力・Claude に貼る       │
│          ↓                                                       │
│  ACT     成功: git-safe-commit コマンドを提示（自動実行しない）  │
│          成功: PROJECT_STATUS.md 更新テンプレを出力              │
│          成功: ROADMAP の完了タスクを ✅ に更新するよう提示      │
│          失敗: 診断 → 修正方針を提示 → 人間承認 → 再実行        │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. STOP 条件一覧

### 絶対STOP（即停止・人間承認必須）

| # | 条件 | 具体例 |
|---|---|---|
| S-1 | 認証情報の読み取り | `.env`, `token.json`, `service_account.json` を開く |
| S-2 | 認証情報の書き込み | API キー・トークン・パスワードをファイルに書く |
| S-3 | 認証情報のコミット | 上記ファイルを `git add` する |
| S-4 | 外部 API 本番 POST | freee 見積書作成・Gmail 送信・Slack 通知 |
| S-5 | 課金 API 呼び出し | Claude API・OpenAI API・有料 SaaS |
| S-6 | 削除・DROP 操作 | ファイル削除・DB レコード削除・シート削除 |
| S-7 | 本番環境への書き込み | 本番スプレッドシート更新・本番 DB 更新 |
| S-8 | 大量変更（5ファイル超） | 1サイクルで 6 ファイル以上 → 分割を提案 |

### 報告 & STOP（自律判断不可）

| 条件 |
|---|
| 仕様・要件が不明確でコードが書けない |
| 同じエラーが3回繰り返す |
| ROADMAP に記載のない新機能を実装しようとしている |
| テストが失敗したまま進もうとしている |
| `git reset --hard` / `git push --force` が必要に見える |

---

## 4. スクリプト一覧（Phase3 追加分）

| スクリプト | 役割 | 呼び出し例 |
|---|---|---|
| `scripts/auto-dev-phase3.ps1` | Phase3 ラッパー：dstat + ブランチ確認 + auto-dev.ps1 + ガイダンス | `auto-dev-phase3.ps1 -Cmd "python -m pytest"` |

### 引き続き使用するスクリプト（Phase2 以前）

| スクリプト | 役割 |
|---|---|
| `scripts/auto-dev.ps1` | Phase3 で必須の統合コマンダー |
| `scripts/git-safe-commit.ps1` | 安全確認付きコミット & push |
| `scripts/analyze-error.ps1` | エラーログ整形 + artifacts/ へ AI レポート保存 |
| `scripts/dev-status.ps1` | プロジェクト状態ダッシュボード |
| `scripts/auto-dev-run.ps1` | Phase2 互換（Phase3 では auto-dev.ps1 を優先） |

---

## 5. PROJECT_STATUS.md の更新タイミング

| タイミング | 更新内容 |
|---|---|
| サイクル開始前 | 読み取るだけ（更新しない） |
| サイクル成功後 | 「最後の実行」「次のNEXT」を更新 |
| STOP 発生時 | 「STOP理由」セクションを記入 |
| セッション終了時 | 「現在地」の最終更新日を更新 |

---

## 6. 参照ドキュメント

| ドキュメント | 内容 |
|---|---|
| `docs/AUTO_DEV_MODE.md` | Phase1 全体仕様 |
| `docs/AUTO_DEV_MODE_PHASE2.md` | Phase2 仕様 |
| `docs/PROMPTS/auto-dev-phase3.md` | **Phase3 開始プロンプト（Claude に貼るもの）** |
| `docs/PROJECT_STATUS.md` | 現在地・引き継ぎテンプレート |
| `scripts/auto-dev-checklist.md` | サイクル別チェックリスト |
| `CLAUDE.md` | AI アシスタント向けルール（最重要） |
