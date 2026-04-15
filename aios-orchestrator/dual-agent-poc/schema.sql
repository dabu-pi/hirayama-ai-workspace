-- ============================================================
-- AIOS Dual-Agent Orchestrator — SQLite スキーマ
-- 設計根拠: aios-orchestrator/02_data_model.md
-- ============================================================
-- [v2] project_id を conversations に追加（Task 5 / 2026-04-15）
--   既存 DB との互換: DB を再作成するか、手動で ALTER TABLE を実行すること。
--   ALTER TABLE conversations ADD COLUMN project_id TEXT NOT NULL DEFAULT 'default';
-- [v3] summary_updated_at を conversations に追加（Phase 2 / 2026-04-15）
--   init_db() が自動で ALTER TABLE を行うため、既存 DB でもマイグレーション不要。
--   手動で実行する場合:
--   ALTER TABLE conversations ADD COLUMN summary_updated_at TEXT;
-- ============================================================

PRAGMA foreign_keys = ON;

-- ------------------------------------------------------------
-- conversations
-- 会話セッションの親レコード。1ゴール = 1会話。
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversations (
    conversation_id   TEXT PRIMARY KEY,             -- uuid4
    project_id        TEXT        NOT NULL DEFAULT 'default',
                                                     -- プロジェクト識別子。文脈を隔離する単位
    title             TEXT        NOT NULL,          -- ゴールの概要（人間が読む）
    role_system       TEXT        NOT NULL,          -- 全体の方針（Planner system prompt 基盤）
    status            TEXT        NOT NULL DEFAULT 'in_progress',
                                                     -- in_progress | waiting_approval | completed | failed
    summary           TEXT,                          -- 現在地の要約（Phase 2: 毎ターン自動更新）
    summary_updated_at TEXT,                          -- summary の最終更新時刻（ISO8601）
    latest_output     TEXT,                          -- 直近の Executor 出力
    turn_count        INTEGER     NOT NULL DEFAULT 0,
    created_at        TEXT        NOT NULL,          -- ISO8601
    updated_at        TEXT        NOT NULL           -- ISO8601
);

CREATE INDEX IF NOT EXISTS idx_conversations_project
    ON conversations(project_id);

-- ------------------------------------------------------------
-- messages
-- 各ターンの Planner / Executor の発言・指示・応答。
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
    message_id        TEXT PRIMARY KEY,             -- uuid4
    conversation_id   TEXT        NOT NULL
                        REFERENCES conversations(conversation_id),
    turn_id           INTEGER     NOT NULL,          -- 1始まりの連番
    role_executor     TEXT        NOT NULL,          -- 'planner' | 'executor'
    source_model      TEXT        NOT NULL,          -- 'gpt-4o' | 'claude-sonnet-4-6' など
    target_model      TEXT,                          -- 次に渡すモデル（Orchestrator が記録）
    content           TEXT        NOT NULL,          -- 発言内容
    requires_approval INTEGER     NOT NULL DEFAULT 0, -- 0 | 1（boolean代用）
    approved_by       TEXT,                          -- 'human' | NULL
    approved_at       TEXT,                          -- ISO8601
    status            TEXT        NOT NULL DEFAULT 'pending',
                                                     -- pending | approved | rejected | executed
    created_at        TEXT        NOT NULL           -- ISO8601
);

CREATE INDEX IF NOT EXISTS idx_messages_conv_turn
    ON messages(conversation_id, turn_id);

-- ------------------------------------------------------------
-- artifacts
-- LLM が生成したコード・ファイル等。自動実行は絶対にしない。
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS artifacts (
    artifact_id       TEXT PRIMARY KEY,             -- uuid4
    message_id        TEXT        NOT NULL
                        REFERENCES messages(message_id),
    artifact_type     TEXT        NOT NULL,          -- 'code' | 'file' | 'json' | 'markdown' | 'shell'
    filename          TEXT,                          -- ファイル名（任意）
    content           TEXT        NOT NULL,          -- 成果物本文
    created_at        TEXT        NOT NULL           -- ISO8601
);

CREATE INDEX IF NOT EXISTS idx_artifacts_message
    ON artifacts(message_id);

-- ------------------------------------------------------------
-- run_log
-- API コール・承認操作の監査ログ。削除・更新しない追記専用。
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS run_log (
    log_id            TEXT PRIMARY KEY,             -- uuid4
    conversation_id   TEXT        NOT NULL,          -- 参照のみ（FK なし。ログは生き続ける）
    turn_id           INTEGER,                       -- NULL 可（session_start 等）
    event_type        TEXT        NOT NULL,
        -- 'api_call' | 'approval_requested' | 'approved' | 'rejected'
        -- | 'error' | 'session_start' | 'session_end'
    model             TEXT,                          -- NULL 可（承認操作等）
    tokens_in         INTEGER,                       -- NULL 可
    tokens_out        INTEGER,                       -- NULL 可
    duration_ms       INTEGER,                       -- NULL 可
    metadata          TEXT,                          -- JSON 文字列（任意の追加情報）
    created_at        TEXT        NOT NULL           -- ISO8601
);

CREATE INDEX IF NOT EXISTS idx_run_log_conv_turn
    ON run_log(conversation_id, turn_id);
