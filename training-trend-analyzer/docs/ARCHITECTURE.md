# ARCHITECTURE.md — システム構成

最終更新: 2026-04-08

---

## 概要

```
[データソース群]
      ↓
[Collectors] → raw データを source_metrics テーブルへ
      ↓
[Normalizer] → ブランド/機種/カテゴリを正規化
      ↓
[Scorer]     → trend_scores テーブルへスコアを書き込み
      ↓
[Output Layer] → CLI / CSV / HTML（MVP）→ API / Web（将来）
```

---

## レイヤー別設計

### 1. データ収集層（Collectors）

**役割:** 各ソースからデータを取得し、`source_metrics` テーブルに保存する。

**設計方針:**
- 各ソースは独立したモジュール（`collectors/google_trends.py` 等）
- 共通インターフェース: `collect(keyword_list, date_range) → List[RawMetric]`
- 取得失敗は例外ではなくエラーレコードとして記録（処理継続）
- robots.txt チェックを収集前に実施

**MVP で実装するもの:**
- `collectors/manual_csv.py` — CSVファイルからの手動取り込み
- `collectors/google_trends.py` — pytrends 経由
- `collectors/mock.py` — モックデータ（テスト用）

**将来追加:**
- `collectors/amazon.py` — PA-API 経由
- `collectors/instagram.py` — Instagram Graph API
- `collectors/rakuten.py` — 楽天API

```
src/collectors/
├── __init__.py
├── base.py          # 共通基底クラス・インターフェース定義
├── google_trends.py
├── manual_csv.py
└── mock.py
```

---

### 2. 正規化層（Normalizer）

**役割:** 収集データのブランド名・機種名・カテゴリの表記ゆれを解消し、正規化された ID に紐付ける。

**設計方針:**
- マスタ辞書（`data/master/brands.json`, `models.json`）で管理
- マッチしない場合は `unclassified` キューに入れてアラート
- 大文字・小文字・全角・半角・記号は前処理で統一
- 別名テーブル（aliases）でブランド名の複数表記を吸収

**処理フロー:**
```
raw_text → 前処理（大文字化・全角→半角）
         → aliases テーブルで照合
         → マッチ → brand_id / model_id を返す
         → 未マッチ → unclassified キューへ登録
```

```
src/normalizer/
├── __init__.py
├── preprocessor.py   # テキスト前処理（正規化・クレンジング）
├── brand_matcher.py  # ブランド名マッチング
├── model_matcher.py  # 機種名マッチング
└── queue.py          # 未分類キュー管理
```

---

### 3. スコア計算層（Scorer）

**役割:** 正規化済みの `source_metrics` データを読み込み、合成スコアと変化率を計算して `trend_scores` に保存する。

**設計方針:**
- 重み設定は `config/score_weights.json` で外部化
- 指標ごとに最小・最大値でMin-Max正規化してから加重平均
- 欠損指標はその重みを他の指標に按分（再正規化）
- スコア計算のパラメータ（重み・期間・バージョン）を `trend_scores` に記録

**計算式:**
```
normalized_i = (value_i - min_i) / (max_i - min_i)  # 0〜1
trend_score = Σ (normalized_i × weight_i)
change_rate = (score_t - score_t-1) / score_t-1 × 100
rank_label = classify(change_rate)
```

```
src/scorer/
├── __init__.py
├── normalizer.py    # 指標値の正規化（Normalizer 層とは別）
├── calculator.py    # スコア計算・変化率計算
└── labeler.py       # ランクラベル付与
```

---

### 4. 出力層（Output / API）

**MVP 出力:**
- CLI: `scripts/run_batch.py` → ランキング表をターミナル表示
- CSV: `data/output/ranking_YYYYMMDD.csv`
- HTML: Jinja2 テンプレートで静的HTML生成

**将来の出力（Phase 3〜）:**
- FastAPI REST API
- Next.js フロントエンド

```
src/api/
├── __init__.py
├── cli.py           # CLI 出力
├── csv_exporter.py  # CSV エクスポート
└── html_renderer.py # HTML 静的生成（Jinja2）
```

---

### 5. バッチ処理

**MVP バッチフロー:**
```
run_batch.py
  1. Collect  → 各 Collector を実行
  2. Normalize → Normalizer を実行
  3. Score    → Scorer を実行
  4. Output   → CSV / HTML を生成
  5. Log      → 実行ログを logs/ に書き出し
```

**スケジューラ（MVP）:**
- Windows タスクスケジューラ または cron（WSL）
- 週1回（月曜 AM 6:00）

**将来:**
- GitHub Actions で週次自動実行
- 急騰検知時のアラートメール

---

### 6. データ構成

```
data/
├── mock/                    # モックデータ（開発・テスト用）
│   ├── brands.json
│   ├── models.json
│   └── source_metrics.json
├── master/                  # 正規化マスタ辞書
│   ├── brands.json
│   ├── categories.json
│   └── models.json
├── db/
│   └── trend.db             # SQLite DB ファイル（MVP）
└── output/                  # 出力先
    ├── ranking_YYYYMMDD.csv
    └── ranking_YYYYMMDD.html
```

---

### 7. 設定管理

```
config/
├── settings.json            # 環境設定（DB接続先、ログレベル等）
├── score_weights.json       # スコア重み設定
└── sources.json             # 収集ソースの有効/無効・設定
```

**認証情報は設定ファイルに含めない。** `.env` または環境変数で管理し、`.gitignore` で除外。

---

## 将来の公開サイト化を見据えた構成

```
[Phase 1-2: ローカル]
  SQLite + Python CLI

[Phase 3: API化]
  PostgreSQL + FastAPI
  → 社内 LAN での参照

[Phase 4: 公開]
  PostgreSQL (Cloud) + FastAPI + Next.js
  → Vercel / Render / Railway 等でホスティング

[Phase 5: 拡張]
  ユーザー認証 + ウォッチリスト + メーカー向けレポート
```

**公開時の注意点:**
- 生データ（スクレイピング結果）はDBに保持するが公開APIからは返さない
- 自社引き合いデータは公開DBに混ぜない（社内DBと公開DBを分離）
- スコアと順位のみを公開エンドポイントで返す
