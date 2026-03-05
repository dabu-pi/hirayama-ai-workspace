# CLAUDE.md

平山克司ワークスペースのAIアシスタント（Claude Code）向けガイド。
このファイルはClaude Codeがワークスペースを理解するための一次情報です。

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
├── CLAUDE.md                        # このファイル（AI向け一次ガイド）
├── README.md                        # GitHub表示用・ナビゲーションのみ
├── PROJECTS.md                      # 全プロジェクト詳細設計
├── ROADMAP.md                       # 開発計画・タスクとステータス管理
├── SETUP.md                         # 新PCセットアップ手順
├── .gitignore
│
├── gas-projects/
│   └── jyu-gas-ver3.1/              # 柔整GASシステム（稼働中）
│       ├── Ver3_core.js             # 来院登録・区分判定・算定ロジック
│       ├── Ver3_amounts.js          # 金額計算
│       ├── Ver3_transferData.js     # 申請書データ転記
│       ├── Ver3_patientPicker.js    # 患者選択UI
│       ├── write_application.py     # 療養費支給申請書生成（ローカル実行）
│       ├── SPEC.md                  # 金額計算仕様書
│       ├── PLAN.md                  # 開発計画
│       └── TESTCASES.md             # テストケース（TC01〜TC10）
│
├── freee-automation/                # freee見積自動化（開発中）
│   ├── spec.md
│   └── src/
│       ├── freee請求書作成.js
│       ├── hawkメール自動貼り付け.js
│       └── phase3_下書き作成.js
│
├── patient-management/              # 患者管理Webアプリ（開発中）
│   ├── app.py
│   ├── requirements.txt
│   └── templates/
│
├── hirayama-jyusei-strategy/        # 接骨院戦略AIドキュメント
│   ├── strategy/
│   ├── menu/
│   ├── operations/
│   ├── marketing/
│   └── finance/
│
└── archive/                         # 不使用・旧バージョンの保管庫
    ├── sandbox-flask-test/
    └── jyu-gas-simple/
```

> `waste-report-system/` は**企画段階・ディレクトリ未作成**。PROJECTS.md の企画メモを参照。

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

### 5. 廃棄物日報GASシステム

**ステータス:** 企画段階（ディレクトリ未作成）

企画メモは PROJECTS.md を参照。ディレクトリ作成・開発着手後にここへ追記する。

---

## workspace と claude-sandbox の運用ルール

このワークスペースは2つのディレクトリで構成されている。Claudeはどちらで作業するかを常に明確にする。

```
C:\hirayama-ai-workspace\
├── workspace\        ← 本番開発（このリポジトリ）
└── claude-sandbox\   ← 実験・プロトタイプ専用（別リポジトリ）
```

### workspace（本番）で行うこと

- プロジェクトのソースコード実装・修正
- ドキュメントの更新（CLAUDE.md / PROJECTS.md / ROADMAP.md 等）
- 仕様が固まった機能の実装
- commit & push まで実施する

### claude-sandbox（実験）で行うこと

- 新技術・新APIの動作確認
- 仕様が未確定のプロトタイプ
- workspace に影響を与えたくない試行錯誤
- **commit は任意。push 不要**

### 判断基準

| 状況 | 作業場所 |
|---|---|
| 既存プロジェクトのバグ修正・機能追加 | `workspace/` |
| 「試しにやってみる」「動くか確認する」 | `claude-sandbox/` |
| claude-sandbox で動作確認済みのコードを本番化 | `workspace/` に移植 |
| 仕様が不明・要件が曖昧 | 先に質問。claude-sandbox で試作後に本番化 |

---

## Claudeへの行動指針

### 作業開始時に必ず実行

```bash
git pull origin master
```

コンフリクト防止のため、毎回の作業開始前に必ず実行する。

### 判断基準

- **仕様が不明な場合は実装せず、質問してから進める**
- GASコードはローカル実行不可。テストは `TESTCASES.md` のケースをもとにコードレビューで行い、スプレッドシート上の動作確認は人間が行う
- freee API の仕様は `freee-automation/spec.md` を参照し、エンドポイントを推測で実装しない
- 認証情報ファイルが必要な場合は「このパスに配置してください」と指示するにとどめ、内容を生成・提案しない

### やってはいけないこと

| 禁止事項 | 理由 |
|---|---|
| freee APIへの本番POST自動実行 | 下書き確認ステップが必須 |
| Gmail・メールの自動送信 | 不可逆操作 |
| `_backup/` への新規ファイル追加 | gitが代替。不要 |
| 単価・料金のコード内ハードコード | 設定シートで一元管理 |
| `service_account.json` 等の認証情報を生成・コミット | 絶対禁止 |
| OneDriveフォルダ内での作業・ファイル保存 | 同期競合の原因になる |

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
- `_backup/` フォルダはgitが代替するため新規作成・追加不可
- 実験・テスト用コードは本番ディレクトリに混在させず `claude-sandbox/` を使う

### Git運用

- **Claude Codeは作業完了後、基本的にcommitとpushまで行う**
- コミット前に認証情報が含まれていないか確認する
- `venv/`、`__pycache__/`、ログファイルはコミットしない
- コミットメッセージは変更内容が明確にわかる日本語または英語で記述する

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

## 参照ドキュメント

| ドキュメント | 内容 |
|---|---|
| [PROJECTS.md](./PROJECTS.md) | 全プロジェクトの詳細設計・仕様 |
| [ROADMAP.md](./ROADMAP.md) | 開発計画・タスクとステータス |
| [SETUP.md](./SETUP.md) | 新PCセットアップ手順 |
| [gas-projects/jyu-gas-ver3.1/SPEC.md](./gas-projects/jyu-gas-ver3.1/SPEC.md) | 柔整金額計算仕様 |
| [freee-automation/spec.md](./freee-automation/spec.md) | freee自動化仕様 |
