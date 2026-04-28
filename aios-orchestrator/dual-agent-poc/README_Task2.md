# README Task2 — API クライアント実装記録

## 実装内容

Task 2 として以下のファイルを新規作成した。

| ファイル | 役割 |
|---|---|
| `openai_client.py` | OpenAI Chat Completions API ラッパー |
| `anthropic_client.py` | Anthropic Messages API ラッパー |
| `requirements.txt` | 依存パッケージ定義 |
| `.env.example` | 環境変数テンプレート |

---

## セットアップ

```bash
# 依存インストール
pip install -r requirements.txt

# .env 作成
cp .env.example .env
# .env を編集して API キーを入力する
```

---

## 共通インターフェース

両クライアントは同じシグネチャで使える。orchestrator.py はどちらも同じように扱う。

```python
# 共通形式 messages
messages = [
    {"role": "user",      "content": "指示してください"},
    {"role": "assistant", "content": "了解しました"},
    {"role": "user",      "content": "1+1を計算してください"},
]

# OpenAI 呼び出し
from openai_client import chat_openai
result = chat_openai(system="あなたはPlannerです", messages=messages)

# Anthropic 呼び出し
from anthropic_client import chat_anthropic
result = chat_anthropic(system="あなたはExecutorです", messages=messages)
```

---

## 戻り値の形式

```python
{
    "content":     str,   # 応答テキスト（orchestrator はここだけ使う）
    "model":       str,   # 実際に使用されたモデル名
    "usage": {
        # OpenAI の場合
        "prompt_tokens":     int,
        "completion_tokens": int,
        "total_tokens":      int,
        # Anthropic の場合
        "input_tokens":  int,
        "output_tokens": int,
    } | None,
    "duration_ms": int,   # API 呼び出し時間（ミリ秒）
    "raw":         object, # SDK のレスポンスオブジェクト（デバッグ用）
}
```

`usage` は `append_run_log()` の `tokens_in` / `tokens_out` に渡す。

---

## normalize_for_anthropic() の役割

Anthropic API は OpenAI と異なり、以下の制約がある。

| 制約 | 対応 |
|---|---|
| system は別パラメータ | messages から role="system" を除去する |
| 先頭は role="user" 必須 | 先頭が assistant なら user を補完する |
| role は交互でなければならない | 同 role が連続する場合はマージする |

この変換は `anthropic_client.py` の内部でのみ行う。
orchestrator.py は OpenAI と Anthropic の差異を意識しない。

---

## 動作確認結果

| 確認項目 | 結果 |
|---|---|
| `from openai_client import chat_openai` | OK |
| `from anthropic_client import chat_anthropic` | OK |
| `normalize_for_anthropic` 5ケース | 全 PASS |
| API キー未設定時の ValueError | OpenAI / Anthropic 両方 OK |
| API 実呼び出し | 未実施（キー未設定環境のため） |

---

## 未対応事項（将来フェーズ）

| 項目 | 理由 |
|---|---|
| Retry / バックオフ | PoC 初手は不要。エラーはそのまま伝播させる |
| Streaming | CLIの単純 PoC には不要 |
| Tool use / Function calling | orchestrator 設計後に検討 |
| Token 上限超過時の context 圧縮 | Phase B（07_next_tasks.md 参照） |
| タイムアウト設定 | デフォルト（openai: 600s, anthropic: 600s）で運用 |
| 複数モデルの切り替え | orchestrator 側でモデル名を指定して対応 |

---

## 次のタスク

Task 3: `approval_gate.py` と `run_logger.py` の実装
→ `07_next_tasks.md` の Task 3 を参照
