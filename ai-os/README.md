# Hirayama AI OS

平山克司ワークスペースの **AIコマンドセンター**。複数のAIツール（Claude / ChatGPT）・開発プロジェクト・運用ログ・ダッシュボードを一元管理するための制御構造。

---

## 役割

Hirayama AI OS は「AIを使う仕事」そのものをシステム化するプロジェクト。個々のプロジェクト（GAS・freee・患者管理等）を実装するのではなく、**それらを横断して管理・追跡・改善するための仕組み**を提供する。

| 機能 | 内容 |
|---|---|
| Claude 開発管理 | Claude Code セッションのタスク・ログ・プロンプト管理 |
| ChatGPT 設計管理 | ChatGPT への指示・ペルソナ・出力テンプレートの設計 |
| GitHub リポジトリ管理 | ブランチ・マイルストーン・リリース状況の追跡 |
| GAS プロジェクト管理 | clasp プロジェクト・スプレッドシートIDの一元登録 |
| ワークスペースログ | 日次ノート・実行ログ・エラーログの構造化管理 |
| Google スプレッドシートダッシュボード | 全プロジェクトの状況をリアルタイムで可視化 |

---

## 管理対象

```
Claude 開発
  ├── セッション管理（タスク・プロンプト・AI REPORT）
  ├── エラー解析・再開キュー
  └── auto-dev ループ（Phase3.1）

ChatGPT 設計
  ├── 指示書・ペルソナ定義
  └── 出力フォーマットテンプレート

GitHub リポジトリ
  ├── workspace（本番）
  └── claude-sandbox（実験）

GAS プロジェクト
  ├── jyu-gas-ver3.1（柔整GAS・稼働中）
  ├── freee-automation（開発中）
  └── waste-report（企画段階）

ダッシュボード（Google スプレッドシート）
  ├── Dashboard シート  ← 集約ビュー（数式参照型・読み取り専用）
  ├── Lists シート      ← 語彙制御・マスタ値（人間のみ更新）
  ├── Projects シート
  ├── Ideas シート
  ├── Task_Queue シート
  ├── Run_Log シート
  └── Metrics シート
```

---

## フォルダ構造

```
ai-os/
├── README.md              # このファイル — 概要・ナビゲーション
├── spec.md                # システム仕様書（アーキテクチャ・コンポーネント）
├── PROJECT_STATUS.md      # 現在地・進捗トラッキング（AI引き継ぎ用）
└── dashboard-schema.md    # ダッシュボードスプレッドシートのスキーマ定義
```

---

## workspace との関係

```
workspace/
├── CLAUDE.md              ← AIアシスタント向けルール（最重要）
├── ROADMAP.md             ← 全プロジェクト開発計画
├── PROJECTS.md            ← プロジェクト設計図
│
├── ai-os/                 ← Hirayama AI OS（このディレクトリ）
│   ├── spec.md            ← AI OS仕様
│   ├── dashboard-schema.md← ダッシュボード設計
│   └── PROJECT_STATUS.md  ← AI OS進捗
│
├── gas-projects/          ← GASプロジェクト群
├── freee-automation/      ← freee連携
├── patient-management/    ← 患者管理Web
├── hirayama-jyusei-strategy/ ← 接骨院戦略
└── logs/                  ← 実行ログ・日次ノート
    └── notes/
```

### Ideas との関係

新機能のアイデア・改善提案は **ダッシュボードの Ideas シート** に一元登録する。`ai-os` はそのスキーマ定義（`dashboard-schema.md`）を管理し、登録ルールを定める。

### Logs との関係

`workspace/logs/` に保存された日次ノート・実行ログは **Run_Log シート** に要約を記録する。生ログはローカルファイルで管理し、ダッシュボードには集計・サマリのみを記載する。

### Dashboard との関係

Google スプレッドシートのダッシュボードが **Hirayama AI OS の実行面**。`dashboard-schema.md` で定義したスキーマに従い、人間（または将来のGASスクリプト）が更新する。

---

## 運用原則

- **ドキュメントファースト** — コードより先に仕様・状態・スキーマを整備する
- **シンプルに保つ** — 管理ツールが管理対象より複雑になってはいけない
- **安全第一** — 自動実行・自動削除は実装しない。確認ステップを挟む
- **再現性** — AIセッションをまたいでも状態を復元できるよう記録する

---

最終更新: 2026-03-06（7シート構成に更新）
