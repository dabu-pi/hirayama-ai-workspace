# CLAUDE.md

平山克司ワークスペースのAIアシスタント（Claude Code）向けガイド。
このファイルはClaude Codeがワークスペースを理解するための参照ドキュメントです。

---

## ワークスペースの目的

接骨院経営・設備販売・廃棄物収集業務における**手作業の自動化とAI活用**を推進する開発ワークスペース。

- 保険請求ミスをなくし、事務工数を削減する
- 見積・請求業務をAPI連携で自動化する
- 経営データをAIで分析し、意思決定を支援する

---

## ディレクトリ構造

```
workspace/
├── CLAUDE.md                        # このファイル
├── README.md                        # ワークスペース概要
├── PROJECTS.md                      # 全プロジェクト詳細設計
├── .gitignore
│
├── gas-projects/
│   └── jyu-gas-ver3.1/              # 柔整GASシステム（稼働中）
│       ├── Ver3_core.js             # 来院登録・区分判定
│       ├── Ver3_amounts.js          # 金額計算
│       ├── Ver3_transferData.js     # 申請書データ転記
│       ├── Ver3_patientPicker.js    # 患者選択UI
│       ├── write_application.py     # 療養費支給申請書生成
│       ├── SPEC.md                  # 金額計算仕様書
│       ├── PLAN.md                  # 開発計画
│       └── TESTCASES.md             # テストケース
│
├── freee-automation/                # freee見積自動化（開発中）
│   ├── spec.md                      # 仕様書
│   └── src/
│       ├── freee請求書作成.js
│       ├── hawkメール自動貼り付け.js
│       └── phase3_下書き作成.js
│
├── patient-management/              # 患者管理Webアプリ（開発中）
│   ├── app.py                       # Flask本体
│   ├── requirements.txt
│   └── templates/
│
├── hirayama-jyusei-strategy/        # 接骨院戦略AIドキュメント
│   ├── strategy/                    # ビジネスモデル・KPI・患者フロー
│   ├── menu/                        # 施術メニュー・料金・会員プラン
│   ├── operations/                  # 日次業務・スケジュール
│   ├── marketing/                   # 集客・ポジショニング
│   └── finance/                     # コスト・利益シミュレーション
│
├── waste-report-system/             # 廃棄物日報GAS（未作成・企画段階）
│
└── archive/                         # 不使用・旧バージョンの保管庫
    ├── sandbox-flask-test/          # Flaskテスト用スケルトン
    └── jyu-gas-simple/              # jyu-gas旧簡易版
```

---

## 各プロジェクトの役割

### 1. `gas-projects/jyu-gas-ver3.1/` — 柔整GASシステム

**ステータス:** 稼働中（最優先）

柔道整復師の保険請求業務を支援するGoogle Apps Scriptシステム。
スプレッドシートをUIとして、来院受付から療養費支給申請書の生成まで一貫管理する。

**重要な設計方針:**
- 算定不可の場合でも金額0・要確認フラグで記録する（自動却下しない）
- 単価は設定シートで管理し、コード内に固定値を持たない
- 令和6年6月施行の算定単価に対応済み

**算定ロジックの優先順位:** 30日ルール → 受傷日経過日数 → 区分確定 → 月上限制御 → 多部位逓減 → 長期減額

### 2. `freee-automation/` — freee見積自動化

**ステータス:** 開発中

Gmail受信メール（hawk@pop13.odn.ne.jp）を起点に、freee見積書作成・PDF下書き・スプレッドシート記録を自動化するGASシステム。
自動送信はせず、**必ず下書き状態で止める**のが原則。

### 3. `patient-management/` — 患者管理Webアプリ

**ステータス:** 開発中（プロトタイプ）

Google スプレッドシートをDBとして使うFlask製患者住所録管理アプリ。
`service_account.json` は認証情報のためリポジトリに含めない。

### 4. `hirayama-jyusei-strategy/` — 接骨院戦略AI

**ステータス:** ドキュメント作成済み・実装予定

慢性疼痛特化の整骨院×トレーニングジムモデルの経営戦略ドキュメント群。
Claude APIを用いた分析・提案自動生成の実装が次フェーズ。

### 5. `waste-report-system/` — 廃棄物日報GAS

**ステータス:** 企画段階（ディレクトリ未作成）

廃棄物収集業務の日報作成・月次集計を自動化するGASシステム。

---

## 開発ルール

### セキュリティ

- `.env`、`service_account.json`、`credentials.json`、`token.json` は**絶対にコミットしない**
- 認証情報は `.gitignore` で除外済み
- freee OAuth2トークンも同様に管理する

### コーディング

- GASファイル（`.js`）はclasp経由でスプレッドシートプロジェクトと同期する
- 単価・定数はコード内にハードコードせず、スプレッドシートの設定シートから取得する
- 自動送信・自動削除などの**不可逆操作は実装しない**（必ず確認ステップを挟む）

### ファイル管理

- 不要になったファイルはすぐ削除せず `archive/` に移動する
- プロジェクトごとに `README.md` を置く
- 実験・テスト用コードは本番ディレクトリに混在させない

### Git運用

- コミット前に認証情報が含まれていないか確認する
- `venv/`、`__pycache__/`、ログファイルはコミットしない
- コミットメッセージは変更内容が明確にわかる英語または日本語で記述する

---

## 技術スタック

| 技術 | 用途 |
|---|---|
| Google Apps Script | スプレッドシート・Gmail自動化 |
| Python (Flask) | Webアプリ・申請書生成 |
| freee API (OAuth2) | 見積・請求書作成 |
| Claude API (claude-sonnet-4-6) | AI分析・文書生成 |
| clasp | GASのバージョン管理 |
| gspread | PythonからGoogle Sheets操作 |

---

## 詳細設計

各プロジェクトの詳細仕様は以下を参照:

- [PROJECTS.md](./PROJECTS.md) — 全プロジェクトの設計図
- [gas-projects/jyu-gas-ver3.1/SPEC.md](./gas-projects/jyu-gas-ver3.1/SPEC.md) — 柔整金額計算仕様
- [freee-automation/spec.md](./freee-automation/spec.md) — freee自動化仕様
