# hirayama-ai-workspace

平山克司のAI活用・業務自動化開発ワークスペース。

---

## プロジェクト一覧

### 1. freee見積自動化プロジェクト
**ディレクトリ:** `freee-automation/`

freee APIを使用した見積書の自動作成システム。
手動で行っていた見積作成業務をAPI経由で自動化し、作業時間の削減と入力ミスの防止を目的とする。

- freee API連携
- 見積データの自動生成・送信
- Node.js製スクリプト

---

### 2. 柔整GASプロジェクト
**ディレクトリ:** `gas-projects/jyu-gas-ver3.1/`

柔道整復師向け施術録・管理システム（Google Apps Script製）。
スプレッドシートをベースに患者データや施術記録を管理する。

- Google Apps Script (GAS) + スプレッドシート
- 施術録の記録・集計
- 保険請求対応データの管理

---

### 3. 廃棄物日報GASシステム（開発予定）
**ディレクトリ:** `waste-report-system/`（今後作成予定）

廃棄物収集業務における日報作成を自動化するGASシステム。
収集実績の入力・集計・レポート出力を効率化することを目的とする。

- Google Apps Script (GAS) + スプレッドシート
- 日報の自動生成
- 収集データの管理・集計

---

### 4. hirayama接骨院戦略AI
**ディレクトリ:** `hirayama-jyusei-strategy/`（今後作成予定）

平山接骨院の経営戦略・患者集客・サービス改善をAIでサポートするプロジェクト。
データ分析・提案生成・施策立案の自動化を目指す。

- Claude API活用
- 経営データの分析・可視化
- 集客・リテンション戦略の立案支援

---

## 技術スタック

| 技術 | 用途 |
|---|---|
| Node.js | API連携・自動化スクリプト |
| Google Apps Script | スプレッドシート・Gmail自動化 |
| freee API | 見積・請求書作成 |
| Claude API | AI分析・文書生成 |
| clasp | GASのバージョン管理 |

---

## 開発環境

- OS: Windows 11
- ワークスペースルート: `C:\hirayama-ai-workspace`
- パッケージマネージャ: npm
- バージョン管理: Git / GitHub

---

## セキュリティ

APIキーや認証情報は `.env` ファイルまたは外部設定ファイルで管理し、リポジトリには含めない。

---

## 管理者

平山克司 (Katsushi Hirayama)
