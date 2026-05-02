# live-check-runner

workspace 全プロジェクト共通の LiveCheck（HEAD /dev 動作確認）自動化ツール。

Playwright を使い、各プロジェクトのページ到達・主要要素の存在確認・スクリーンショット保存を行う。

---

## 対象プロジェクト

| プロジェクト | type | 用途 |
|---|---|---|
| jrec-sf01 | gas-webapp | JREC-SF01 自費カルテ・会計システム |
| training-platform | nextjs | トレーニングプログラムプラットフォーム |
| subsidy-grants | docs | 補助金プロジェクト ドキュメント確認 |

---

## セットアップ

```powershell
cd C:\hirayama-ai-workspace\workspace\tools\live-check-runner
npm install
npx playwright install chromium
```

---

## 実行方法

### 全プロジェクト smoke テスト

```powershell
npm test
```

### JREC-SF01 のみ

```powershell
npm run test:jrec
```

### training-platform のみ

```powershell
npm run test:training
```

### CLI 経由（将来的に orchestrator から呼ぶ形）

```powershell
npm run livecheck -- --project jrec-sf01 --suite smoke
npm run livecheck -- --project training-platform --suite smoke
```

### HTML レポート確認

```powershell
npm run report
```

---

## レポート出力先

```text
reports/
├─ html/          ← playwright show-report で表示
├─ screenshots/   ← 失敗時スクリーンショット
└─ results.json   ← JSON 形式の結果
```

---

## プロジェクト別設定

各プロジェクトの URL・認証・注意事項は `projects/*/config.json` に記載。

---

## 最初の実用ターゲット

**JREC-SF01 Phase AI-1 HEAD /dev LiveCheck**

確認項目 AI1-1〜AI1-9 の一部自動化。
詳細は `projects/jrec-sf01/ai1.todo.md` を参照。

---

## GAS Web App の注意事項

`docs/GAS_LIVE_CHECK_NOTES.md` を参照。

Playwright で GAS /dev を扱う場合は Googleログイン済みセッションが必要になることがある。
初回権限承認画面は人間が対応する。

---

## 設計詳細

`docs/LIVE_CHECK_RUNNER_DESIGN.md` を参照。

---

## ディレクトリ構成

```text
tools/live-check-runner/
├─ README.md
├─ package.json
├─ playwright.config.ts
├─ livecheck.config.json
├─ tsconfig.json
├─ .gitignore
├─ docs/
│  ├─ LIVE_CHECK_RUNNER_DESIGN.md
│  └─ GAS_LIVE_CHECK_NOTES.md
├─ scripts/
│  ├─ run-livecheck.ts
│  ├─ make-report.ts
│  └─ collect-screenshots.ts
├─ projects/
│  ├─ jrec-sf01/
│  │  ├─ config.json
│  │  ├─ smoke.spec.ts
│  │  └─ ai1.todo.md
│  ├─ training-platform/
│  │  ├─ config.json
│  │  └─ smoke.spec.ts
│  └─ subsidy-grants/
│     ├─ config.json
│     └─ docs-check.todo.md
└─ reports/
   └─ .gitkeep
```
