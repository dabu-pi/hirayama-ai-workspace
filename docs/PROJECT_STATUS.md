# PROJECT_STATUS.md — 現在地・進捗トラッキング

> **使い方:** 各開発サイクルの終わりにこのファイルを更新する。
> Claude への引き継ぎ・再開プロンプトの冒頭にこのファイルの内容を貼る。

---

## 現在地 (Current Position)

| 項目 | 内容 |
|---|---|
| プロジェクト | <!-- 例: freee-automation / jyu-gas-ver3.1 --> |
| ブランチ | <!-- 例: feature/freee-oauth-rebuild --> |
| フェーズ | <!-- 例: Phase2 / 実装中 --> |
| 最終更新 | <!-- 例: 2026-03-05 21:30 --> |

---

## 最後の実行 (Last Execution)

```
コマンド  :
終了コード:
ログ      : logs/run/run_YYYYMMDD_HHmmss.log
ステータス: SUCCESS / FAILED
```

### 実行結果サマリ

<!-- auto-dev.ps1 の ## COMMANDS セクションをここに貼る -->

---

## 次のアクション (NEXT)

1. <!-- 例: freee API の redirect_uri をスプシ設定シートから取得するよう修正 -->
2. <!-- 例: test_oauth.py を実行して OAuth フロー確認 -->
3. <!-- 例: ROADMAP.md の B-2 を ✅ に更新 -->

---

## STOP 理由 (Stop Reason)

> **該当する場合のみ記入。正常完了時は「なし」。**

```
## STOP — 理由: [条件名]

状況: （何をしようとしていたか）

問題: （なぜ止まったか）

確認事項:
1.
2.

再開手順: （確認後にどうすれば再開できるか）

AI レポート: artifacts/debug_YYYYMMDD_HHmmss.txt
```

---

## 完了タスク履歴 (Done Log)

| 日時 | タスク | コミット |
|---|---|---|
| <!-- 2026-03-05 --> | <!-- feat: xxx --> | <!-- abc1234 --> |

---

## 参照

- `ROADMAP.md` — タスク全体像・優先順位
- `CLAUDE.md` — AIアシスタント向けルール
- `docs/AUTO_DEV_MODE_PHASE2.md` — Phase2 仕様
- `docs/PROMPTS/auto-dev-phase2.md` — Phase2 開始プロンプト
- `scripts/auto-dev-checklist.md` — 各フェーズのチェックリスト
