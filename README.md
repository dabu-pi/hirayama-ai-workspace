# hirayama-ai-workspace

平山克司のAI活用・業務自動化開発ワークスペース。

---

## プロジェクト一覧

### 1. 柔整GASプロジェクト
**ディレクトリ:** `gas-projects/jyu-gas-ver3.1/`
**ステータス:** 稼働中

柔道整復師向け施術録・保険請求管理システム（Google Apps Script製）。
患者データ・施術記録・療養費支給申請書の作成までを一貫管理する。

### 2. freee見積自動化プロジェクト
**ディレクトリ:** `freee-automation/`
**ステータス:** 開発中

Gmailの見積依頼メールを起点にfreee見積書作成・PDF下書き・スプレッドシート記録を自動化するGASシステム。

### 3. 患者管理Webアプリ
**ディレクトリ:** `patient-management/`
**ステータス:** 開発中（プロトタイプ）

Google スプレッドシートと連携した患者住所録管理Webアプリ（Flask製）。

### 4. 廃棄物日報GASシステム
**ディレクトリ:** `waste-report-system/`（未作成）
**ステータス:** 企画段階

廃棄物収集業務の日報作成・集計を自動化するGASシステム。

### 5. hirayama接骨院戦略AI
**ディレクトリ:** `hirayama-jyusei-strategy/`
**ステータス:** ドキュメント作成済み・実装予定

慢性疼痛特化の整骨院×トレーニングジムモデルの経営戦略をAIでサポートするプロジェクト。

---

## 技術スタック

| 技術 | 用途 |
|---|---|
| Google Apps Script | スプレッドシート・Gmail自動化 |
| Python (Flask) | Webアプリ・申請書生成 |
| freee API | 見積・請求書作成 |
| Claude API | AI分析・文書生成 |
| clasp | GASのバージョン管理 |

---

## 開発環境

- OS: Windows 11
- ワークスペースルート: `C:\hirayama-ai-workspace\workspace`
- パッケージマネージャ: pip / npm
- バージョン管理: Git / GitHub

---

## セキュリティ

APIキーや認証情報（`.env`、`service_account.json`等）はリポジトリに含めない。`.gitignore` で管理。

---

## 開発フロー

このワークスペースはClaude Codeを使ってAIと協働しながら開発を進める。

```
1. Claude Code で作業
   │
   │  コードの実装・修正・ドキュメント更新を依頼
   │  Claude が提案・実行 → 内容を確認
   │
2. commit
   │
   │  変更内容をローカルリポジトリに記録
   │  git add <files>
   │  git commit -m "変更内容の説明"
   │
3. push
      │
      └→ GitHub に反映
         git push origin master
```

**基本原則:**
- コードの確認は commit 前に行う
- 認証情報（`.env`、`service_account.json` 等）は commit しない
- 不可逆な操作（自動送信・削除等）は実装せず、必ず確認ステップを挟む

---

## 詳細設計

→ [PROJECTS.md](./PROJECTS.md)

---

## 管理者

平山克司 (Katsushi Hirayama)
