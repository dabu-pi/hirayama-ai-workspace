# ROADMAP.md — Phase 別開発計画

最終更新: 2026-04-08

---

## フェーズ概要

| フェーズ | 名称 | 目標 | 想定期間 |
|---|---|---|---|
| Phase 0 | 設計・基盤整備 | 設計ドキュメント群の整備 | 完了（2026-04-08） |
| Phase 1 | ローカルMVP | CLI + SQLite + 手動収集でランキングを出す | 2週間 |
| Phase 2 | 自動収集 | Google Trends 等の自動取得 + 週次バッチ | 2〜3週間 |
| Phase 3 | API化 | FastAPI + PostgreSQL + 社内参照UI | 1ヶ月 |
| Phase 4 | 公開サイト | Next.js + 公開DB + 公開ランキングページ | 1〜2ヶ月 |
| Phase 5 | 拡張 | ユーザー機能・メーカー向けレポート | 要検討 |

---

## Phase 0 — 設計・基盤整備（完了）

**完了条件:**
- [x] プロジェクトディレクトリ作成
- [x] PROJECT_STATUS.md 作成
- [x] README.md 作成
- [x] docs/SPEC.md 作成
- [x] docs/ARCHITECTURE.md 作成
- [x] docs/DB_SCHEMA.md 作成
- [x] docs/ROADMAP.md 作成（このファイル）
- [x] docs/DATA_SOURCES.md 作成

**完了日:** 2026-04-08

---

## Phase 1 — ローカルMVP

**目標:** モックデータ + 手動CSV入力でランキングが出力できる最小構成を作る。

**完了条件:**
- [ ] `scripts/init_db.py` でSQLiteにスキーマ作成できる
- [ ] `data/mock/` にブランド・機種・指標のモックデータがある
- [ ] `src/normalizer/` でブランド・機種名の基本正規化ができる
- [ ] `data/master/` に初期ブランド辞書・カテゴリ辞書がある
- [ ] 手動CSVを `source_metrics` にインポートできる
- [ ] `src/scorer/` でスコアと変化率を計算できる
- [ ] `scripts/run_batch.py` でランキングがCSV出力できる
- [ ] CLI でカテゴリ別ランキングを表示できる
- [ ] `requirements.txt` が整備されている

**削るもの（Phase 1 では不要）:**
- 自動収集（手動CSVで代替）
- 未分類キューのUI
- HTML出力
- エラーアラートメール

**技術スタック（Phase 1）:**
- Python 3.11+
- SQLite（`sqlite3` 標準ライブラリ）
- pandas（CSV処理・スコア計算）
- tabulate（CLI テーブル表示）

---

## Phase 2 — 自動収集

**目標:** Google Trends を起点に週次バッチを自動化し、手動作業を削減する。

**完了条件:**
- [ ] `collectors/google_trends.py` で pytrends からデータ取得できる
- [ ] `collectors/manual_csv.py` でCSVインポートが自動化される
- [ ] 週次バッチスクリプトが動く（Windows タスクスケジューラまたはcron）
- [ ] 欠損・エラー時にログに記録して処理継続できる
- [ ] `unclassified_queue` に未分類データが蓄積される
- [ ] ランキングのHTMLレポートが自動生成される

**追加収集ソース候補（Phase 2）:**
- Amazon（手動または PA-API）
- YouTube（動画タイトル・説明文の言及カウント）
- 業界メディア（手動ピックアップ）

**削るもの（Phase 2 では保留）:**
- Instagram API（審査コスト高）
- Twitter/X API（有料化・制限あり）
- 多言語対応

---

## Phase 3 — API化

**目標:** FastAPI + PostgreSQL で社内 LAN から参照できる REST API を構築する。

**完了条件:**
- [ ] FastAPI エンドポイント設計・実装
- [ ] PostgreSQL への移行（Alembic マイグレーション）
- [ ] 社内向けランキングAPI（認証なし or 簡易認証）
- [ ] Swagger UI で API ドキュメントが自動生成される
- [ ] バッチをGitHub Actions で週次実行できる（または VPS cron）

**API エンドポイント案:**
```
GET /api/v1/ranking?week=2026-03-30&category=treadmill&limit=10
GET /api/v1/brands/{brand_id}/models
GET /api/v1/models/{model_id}/trend?weeks=12
GET /api/v1/trending?direction=rising&limit=5
```

---

## Phase 4 — 公開サイト

**目標:** 外部公開ランキングサイトを構築する。社内用データとの分離を徹底する。

**完了条件:**
- [ ] 公開DBと社内DBの分離
- [ ] Next.js フロントエンド基本実装
- [ ] 公開用APIの認証・レート制限
- [ ] プライバシーポリシー・利用規約整備
- [ ] SEO対応（機種名・ブランド名での検索流入）
- [ ] 独自ドメイン設定

**技術スタック（Phase 4）:**
- Next.js（フロントエンド）
- FastAPI（バックエンド）
- PostgreSQL（Supabase or Railway）
- Vercel（フロントホスティング）
- Render or Railway（APIホスティング）

---

## Phase 5 — 拡張

**目標:** ユーザー機能・有料コンテンツ・メーカー向けサービスを追加する。

**候補機能（要検討）:**
- ユーザー登録・ウォッチリスト
- メール通知（急上昇アラート）
- メーカー向けトレンドレポートPDF自動生成
- 広告掲載（メーカー）
- 有料プラン（詳細データ・APIアクセス）

---

## MVP で削るもの／後回しにするもの

| 機能 | 後回し理由 | 想定フェーズ |
|---|---|---|
| 全ソース自動収集 | API審査・コスト・工数 | Phase 2〜3 |
| Instagram/Twitter 収集 | API制限・コスト | Phase 2〜3 |
| Web UI | MVPはCLI/CSVで十分 | Phase 3〜4 |
| 多言語対応（英語） | 日本市場優先 | Phase 4〜 |
| 季節調整 | 実データ蓄積後に実装 | Phase 3〜 |
| 機械学習による正規化 | マスタ辞書で十分な間は不要 | Phase 4〜 |
| ユーザーアカウント | 公開前には不要 | Phase 5 |
| リアルタイム収集 | 週次で十分 | Phase 5 |
