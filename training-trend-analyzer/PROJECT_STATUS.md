# PROJECT_STATUS.md — トレーニングマシントレンド分析基盤

最終更新: 2026-04-08

---

## プロジェクト目的

トレーニングマシンのトレンドを複数ソースから継続収集し、ブランド・カテゴリ・機種単位でデータベース化し、時系列変化をスコア化してランキング提示する。

**短期目標（MVP）:** 自社仕入れ判断を数字で支援するローカルツール
**中期目標:** ジムオーナー・仕入れ担当者向け参照サイトとして公開

---

## プロジェクト境界

| 項目 | パス |
|---|---|
| **このプロジェクトルート** | `C:\hirayama-ai-workspace\workspace\training-trend-analyzer\` |
| 更新対象（全て内包） | `training-trend-analyzer/` 配下のみ |
| DB ファイル | `training-trend-analyzer/data/db/trend.db` |
| 設定ファイル | `training-trend-analyzer/config/` |
| ドキュメント | `training-trend-analyzer/docs/` |
| マスタデータ | `training-trend-analyzer/data/master/` |
| スクリプト | `training-trend-analyzer/scripts/` |
| ソースコード | `training-trend-analyzer/src/` |
| テスト | `training-trend-analyzer/tests/` |

**触らない他プロジェクト領域:**
- `workspace/gas-projects/` — 柔整GASシステム
- `workspace/freee-automation/` — freee自動化
- `workspace/patient-management/` — 患者管理Webアプリ
- `workspace/scripts/` — workspace共通スクリプト（AIOS/handoff系）
- `workspace/docs/` — workspace共通ドキュメント
- `workspace/config/` — workspace共通設定

**混合リスクなしの根拠:**
- DB は `training-trend-analyzer/data/db/` に分離（他プロジェクトの DB なし）
- Python パッケージ（`src/`）はこのプロジェクト配下のみ
- `workspace/scripts/` とは独立した `training-trend-analyzer/scripts/` を使用

---

## 現在地

| 項目 | 状態 |
|---|---|
| 設計ドキュメント整備 | 完了（Phase 0） |
| DB スキーマ作成（SQLite） | 完了 |
| 初期マスタデータ整備 | 完了（Phase 1） |
| マスタ投入スクリプト | 完了 |
| 正規化エンジン初版 | 完了（Phase 1） |
| 検証テストケース | 完了（16/16 passed） |
| モックデータでのランキング出力 | 完了 |
| Google Trends 自動収集 | 未着手 |
| 実データCSV取り込み | 未着手 |
| HTML レポート生成 | 未着手 |

---

## 今のフェーズ

**Phase 1 — ローカルMVP（進行中）**

設計ドキュメント・DBスキーマ・マスタデータ・正規化エンジン基盤が完成した。
次は「実データを入れてランキングを出す」フローの完成。

---

## 次アクション（優先順）

1. **実データCSVインポーター整備** — `scripts/import_csv.py` を作成し、手動収集データを `source_metrics` テーブルに投入できるようにする
2. **Google Trends 収集器の動作確認** — `collectors/google_trends.py` の初版を実装し、主要キーワードで取得テストをする
3. **aliases.json の拡充** — 実務で見かける表記ゆれを追加登録し `load_master_data.py` で再投入
4. **HTMLレポート生成** — Jinja2で週次ランキングHTMLを自動生成する
5. **正規化エンジンをバッチフローに組み込む** — `run_batch.py` の [NORMALIZE] ステップで `NormalizerEngine` を使うように更新

---

## マスタデータ現状（2026-04-08）

| テーブル | 件数 | 内容 |
|---|---|---|
| brands | 20 | 業務用中心の主要メーカー |
| categories | 23 | 有酸素系・筋力系・機能的トレーニング |
| models | 22 | 主力業務用機種 |
| aliases | 88 | ブランド・カテゴリ・モデルの別名・表記ゆれ |

---

## リスク

| リスク | 深刻度 | 対策 |
|---|---|---|
| 表記ゆれによる同一機種の重複登録 | 高 | 正規化エンジン + aliases テーブルで吸収済み |
| 家庭用/業務用の混在 | 高 | `use_type` カラム + brands の `market_type` で分離 |
| aliases.json のメンテナンスコスト | 中 | 未分類キューで発見 → 手動追記の運用フローを確立 |
| pytrends の非公式API依存 | 中 | 手動CSVで代替フローを確保 |
| confidence 0.5〜0.7 の LOW 判定の扱い | 中 | LOW は自動確定せず未分類キューに入れる方針を検討 |
| DB スキーマ変更時のマイグレーション | 低 | Alembic 導入は Phase 3 で対応 |

---

## 未決事項

| 事項 | 優先度 | 備考 |
|---|---|---|
| Google Trends pytrends の IP ブロック対策 | 高 | リクエスト間隔を長めに設定 |
| aliases.json の `_section` コメント行の扱い | 中 | load_master_data.py では除去済み。問題なし |
| LOW 信頼度レコードの自動処理 vs 手動確認 | 中 | 現状は MEDIUM 以上を自動確定、LOW は保留方針を推奨 |
| DB の `data/db/trend.db` を git 管理するか | 中 | `.gitignore` に追加推奨（バイナリ・実データ混入回避） |
| unclassified_queue の確認 UI | 低 | Phase 2 以降 |

---

## 関連ドキュメント

| ドキュメント | 内容 |
|---|---|
| [README.md](./README.md) | プロジェクト概要・ユースケース |
| [docs/SPEC.md](./docs/SPEC.md) | 要件定義 |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | システム構成 |
| [docs/DB_SCHEMA.md](./docs/DB_SCHEMA.md) | DB テーブル設計 |
| [docs/ROADMAP.md](./docs/ROADMAP.md) | Phase 別開発計画 |
| [docs/DATA_SOURCES.md](./docs/DATA_SOURCES.md) | 収集ソース一覧と方針 |
| [docs/NORMALIZER.md](./docs/NORMALIZER.md) | 正規化エンジン仕様 |
