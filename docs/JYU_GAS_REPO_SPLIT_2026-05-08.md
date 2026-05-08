# JYU-GAS 独立repo化記録 — 2026-05-08

## 分離した理由

Wildboar 側で別作業が同時進行する可能性があり、
workspace 親repoに JYU-GAS / Wildboar / live-check-runner の変更が
混ざらないよう repo 境界を整理するため。

## 分離対象

| 項目 | 内容 |
|---|---|
| プロジェクト | JREC-01 / JYU-GAS Ver3.1 |
| 旧パス | `gas-projects/jyu-gas-ver3.1` (workspace 親repo内) |
| ローカルパス | `C:\hirayama-ai-workspace\workspace\gas-projects\jyu-gas-ver3.1` |

## 新repo情報

| 項目 | 内容 |
|---|---|
| GitHub URL | https://github.com/dabu-pi/jyu-gas-ver3.1.git |
| branch | main |
| 初回commit | e99a2cc chore: initialize JYU-GAS Ver3.1 standalone repository |
| push日時 | 2026-05-08 |

## backup branch

| 項目 | 内容 |
|---|---|
| 親workspace backup | `backup/before-jyu-gas-repo-split-20260508-0954` |
| 作成リポジトリ | hirayama-ai-workspace (親workspace) |

## 親workspace側の処理

| 処理 | 実施内容 |
|---|---|
| 追跡解除 | `git rm -r --cached gas-projects/jyu-gas-ver3.1` |
| .gitignore追加 | `/gas-projects/jyu-gas-ver3.1/` |
| commit | `chore: stop tracking JYU-GAS standalone repository` |
| ファイル削除 | なし（--cached のみ。実ファイルはローカルに存在） |

## 秘密情報・除外対応

| ファイル | 対応 |
|---|---|
| `.clasp.json` | 独立repo .gitignore で除外 (scriptIdのみ・OAuthなし) |
| `申請書_*.json` | 独立repo .gitignore で除外（患者データ可能性あり） |
| `申請書_*.xlsx` | 独立repo .gitignore で除外（患者データ可能性あり） |
| `test_d6.xlsx` | 独立repo .gitignore で除外 |
| `__pycache__/` | 独立repo .gitignore で除外 |

## 未実施事項

- clasp push / GAS deploy は今回実施しない
- LiveCheck / GAS動作確認は別タスク
- `.clasp.json` が親workspaceで既にpush済みであることは既存事実（独立repo側では除外済み）

## 次回注意点

- JYU-GAS の作業は `gas-projects/jyu-gas-ver3.1` ローカルフォルダで実施
- 独立repo側で commit/push する（親workspaceには含めない）
- Wildboar / live-check-runner は別repo（影響なし）
- clasp push 前は .clasp.json の内容・scriptId を確認すること

## 重要方針（継承）

- `patientSearch.html → selfPayWeb.html` スマホフローは壊さない
- 申請書出力正ルート: B案 Cloud Run Excel
- Sheets直PDFは停止・本番化しない
- NDJSON + Python は補助扱い
