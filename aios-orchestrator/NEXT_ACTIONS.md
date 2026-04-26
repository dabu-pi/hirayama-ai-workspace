# NEXT_ACTIONS.md — AIOS 次の行動

最終更新: 2026-04-26

> 再開時にこのファイルを最初に読む。PROJECT_STATUS.md は詳細参照用。

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
