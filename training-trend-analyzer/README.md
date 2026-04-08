# トレーニングマシントレンド分析基盤

複数ソースからトレーニングマシンのトレンドデータを継続収集し、ブランド・カテゴリ・機種単位でスコア化・ランキング提示するシステム。

---

## 何をするシステムか

| 機能 | 内容 |
|---|---|
| データ収集 | SNS・EC・検索トレンド・業界メディアから言及・評価・販売データを取得 |
| 正規化 | ブランド名・機種名の表記ゆれを統一し、重複を排除 |
| 蓄積 | 日次または週次でスナップショットをDBに保存 |
| スコア計算 | 複数指標（言及数・評価・検索ボリューム等）を合成してトレンドスコアを算出 |
| ランキング | 上昇中 / 下降中 / 安定 のランキングを出力 |
| 出力 | CSV・JSON・将来的にはWeb画面で参照可能 |

---

## 想定ユーザー

| ユーザー | フェーズ |
|---|---|
| 自社（平山AI整骨院・設備販売部門）の仕入れ担当 | MVP（Phase 1〜2） |
| 接骨院・フィットネスジムのオーナー・機器購入担当 | 公開版（Phase 3〜） |
| フィットネス機器メーカーのマーケティング担当 | 公開版 Phase 5 以降 |

---

## 想定ユースケース

### MVP（自社利用）

- 「今どのメーカーのどの機種が注目されているか」を週1で確認する
- 仕入れ候補リストのスコアを比較して購入判断の材料にする
- 新興ブランドが急上昇していないか定期的にウォッチする

### 公開版（将来）

- ジムオーナーが「今シーズン買うべきマシン」を調べる
- 仕入れ担当者がカテゴリ別トレンド推移を時系列で見る
- メーカーが競合機種のトレンド動向を参照する

---

## MVP範囲

| 含む | 含まない |
|---|---|
| ローカル SQLite DB | クラウドDB・本番サーバー |
| 手動CSV取り込み + 最小自動収集 | 全ソース自動化 |
| CLI / シンプルなHTML出力 | 本格的なWeb UI |
| 週次バッチ | リアルタイム収集 |
| 業務用マシン中心 | 家庭用マシンの網羅的収集 |

---

## 将来拡張

- Phase 3: FastAPI ベースの REST API
- Phase 4: 公開 Web サイト（Next.js 等）
- Phase 5: ユーザーアカウント・ウォッチリスト機能
- Phase 5+: メーカー向けレポート販売

---

## セットアップ（新PC / 初回）

```bash
# 1. DB 初期化
python scripts/init_db.py

# 2. インポートメタデータ追加マイグレーション
python scripts/migrate_add_import_meta.py

# 3. マスタデータ投入
python scripts/load_master_data.py

# 4. 動作確認（モックデータ）
python scripts/run_batch.py

# 5. 実データ CSV を投入
python scripts/import_csv.py --file data/import/your_data.csv --dry-run
python scripts/import_csv.py --file data/import/your_data.csv

# 6. 実データでランキング確認
python scripts/run_batch.py --use-db --week 2026-04-06
```

---

## CSV インポート

手動収集データを CSV で投入できる。詳細は [docs/IMPORT_PIPELINE.md](./docs/IMPORT_PIPELINE.md) を参照。

```bash
# 投入件数確認（DB書き込みなし）
python scripts/import_csv.py --file data/import/sample_metrics.csv --dry-run

# 投入（家庭用除外）
python scripts/import_csv.py --file data/import/sample_metrics.csv --only-commercial

# ランキング表示
python scripts/run_batch.py --use-db --week 2026-04-06 --category treadmill
```

---

## ディレクトリ構成

```
training-trend-analyzer/
├── PROJECT_STATUS.md        # 現在地・次アクション・リスク
├── README.md                # このファイル
├── docs/
│   ├── SPEC.md              # 要件定義
│   ├── ARCHITECTURE.md      # システム構成
│   ├── DB_SCHEMA.md         # DB テーブル設計（import_batches 追加済み）
│   ├── ROADMAP.md           # Phase 別開発計画
│   ├── DATA_SOURCES.md      # 収集ソース一覧
│   ├── NORMALIZER.md        # 正規化エンジン仕様
│   └── IMPORT_PIPELINE.md   # CSV インポートパイプライン仕様
├── src/
│   ├── collectors/          # データ収集モジュール（mock, db）
│   ├── normalizer/          # 表記ゆれ正規化（types, rules, engine）
│   ├── scorer/              # スコア計算
│   └── api/                 # API / 出力層
├── data/
│   ├── master/              # マスタデータ JSON（brands, categories, models, aliases）
│   ├── import/              # 取り込む CSV を置く場所
│   ├── review/              # 未解決・要レビュー行の CSV 出力先
│   └── mock/                # モックデータ（テスト・初期開発用）
├── tests/
│   └── test_normalizer.py   # 正規化エンジンテスト（16件）
└── scripts/
    ├── init_db.py                   # DB 初期化
    ├── migrate_add_import_meta.py   # Phase 2 スキーママイグレーション
    ├── load_master_data.py          # マスタデータ投入
    ├── import_csv.py                # CSV インポーター
    └── run_batch.py                 # バッチ実行（--use-db / --use-mock）
```

---

## 技術スタック（想定）

| 層 | 技術 | 備考 |
|---|---|---|
| 言語 | Python 3.11+ | |
| DB | SQLite（MVP）→ PostgreSQL（公開時） | |
| 収集 | requests / pytrends / BeautifulSoup | robots.txt 確認必須 |
| スケジューラ | cron / GitHub Actions | |
| 出力 | CLI + Jinja2 HTML / CSV | MVPはこれで十分 |
| API | FastAPI（Phase 3〜） | |
| フロント | Next.js（Phase 4〜） | |
