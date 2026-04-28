# README Task5 — project_id 隔離 / context 絞り込み

## なぜ全履歴を読ませないか

Task 4 までの orchestrator は `get_history()` で全件を LLM に渡していた。
これには以下のリスクがある。

| リスク | 内容 |
|---|---|
| トークン肥大化 | ターン数が増えるほど毎回全件を送信し、コストが二乗的に増える |
| 文脈汚染 | 同一 DB に複数案件があると、誤って他会話の内容を参照する余地が生まれる |
| 応答劣化 | 古い議論を引きずると LLM が最新指示を見失いやすくなる |

Task 5 では `build_context(limit=10)` に切り替え、
**summary + 直近 N 件だけ** を渡す方式にした。

---

## なぜ project_id で隔離するか

- 1 つの DB に複数プロジェクトの会話が混在する運用を想定している
- `project_id` を conversations に持たせることで、将来「project 単位のリスト取得・検索」が可能になる
- 現時点では **project をまたぐ検索・参照は実装していない**（意図的な制約）
- `get_recent_history()` / `build_context()` は常に `conversation_id` 単位で絞り込む

---

## 現在の context 構成

```
build_context(db_path, conversation_id, limit=10) -> {
    conversation_id: str,
    project_id:      str,   ← 今回追加
    summary:         str | None,   ← conversations.summary（Executor が更新）
    latest_output:   str | None,   ← 直近の Executor 出力
    recent_history:  list[dict],   ← 直近 limit 件（古い順）
    latest_message:  dict | None,  ← recent_history の末尾
}
```

### LLM に渡す messages の組み立て（`_build_messages_for_llm`）

```
1. summary があれば → {"role": "user", "content": "[会話の要約]\n{summary}"}
                       {"role": "assistant", "content": "了解しました…"}
2. recent_history → role/content のみを渡す
```

summary がない場合（序盤のターン）は recent_history だけを渡す。
他 conversation / project のデータは一切混ぜない。

---

## schema 変更点

```sql
-- conversations テーブルに追加
project_id TEXT NOT NULL DEFAULT 'default'

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_conversations_project
    ON conversations(project_id);
```

**既存 DB との互換:**
新規 DB は `init_db()` で自動作成される。
既存 DB を引き継ぐ場合は以下を手動実行すること（PoC 段階では DB 再作成推奨）。

```sql
ALTER TABLE conversations ADD COLUMN project_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_conversations_project ON conversations(project_id);
```

---

## 使い方（変更点のみ）

```bash
# project_id を指定して開始
python orchestrator.py start --project-id aios-poc --goal "九九表をMarkdownで生成せよ"

# project_id 未指定時は "default"
python orchestrator.py start --goal "..."
```

`show` / `pending` には project_id が表示される。

---

## E2E は Task 5 完了後に実施すること

- Task 1〜5 まで全モジュールが揃い、文脈スコープが安全側に固まった
- 次は `.env` に API キーを設定し、実際に run を通す E2E テストを行う
- E2E テストの手順は `07_next_tasks.md` の Task 5 を参照

---

## 動作確認結果（Task 5）

| 確認項目 | 結果 |
|---|---|
| `start --project-id aios-poc` | OK（DB に aios-poc で保存） |
| `get_conversation_project_id` | OK |
| `get_recent_history(limit=3)` | OK（8件中3件を古い順で取得） |
| `build_context` の構造 | OK（6キー全確認） |
| `_build_messages_for_llm` の role | OK（user/assistant 交互） |
| `show` に project_id 表示 | OK |
| `pending` に project_id 表示 | OK（JOIN で取得） |
| 他 conversation_id 混入なし | 設計上防止（conversation_id 絞り込み必須） |
| API 実呼び出し | 未実施（E2E で実施予定） |
