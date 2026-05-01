# Workspace Folder Audit 2026-05-02

## STATUS
調査完了・一部退避完了（tmp/ のみ）・人間確認待ち事項あり

## TARGET
`C:\hirayama-ai-workspace\workspace`

---

## ACTIVE_KEEP
残すべきフォルダー一覧

| フォルダー | 理由 | 最終更新 | 備考 |
|---|---|---|---|
| `gas-projects/` | JREC-01（柔整毎日記録システム）最優先稼働中 | 2026-04-27 | jrec-portal, jrec-sf01-selfpay, jyu-gas-ver3.1 |
| `hirayama-jyusei-strategy/` | JBIZ-04（接骨院経営戦略AI）active | 2026-04-25 | 管理表・KPI・pricing scripts 使用中 |
| `freee-automation/` | freee見積自動化 開発中 | 2026-04-20 | |
| `patient-management/` | 患者管理Webアプリ プロトタイプ | 2026-04-20 | |
| `training-program-platform-jp/` | Next.js トレーニングプラットフォーム、最近更新 | 2026-05-01 | .env.local あり（secrets扱い）|
| `subsidy-grants-projects/` | 別リポジトリ（dabu-pi/subsidy-grants-projects）最近更新 | 2026-05-02 | branch: main, clean |
| `aios-orchestrator/` | デュアルエージェントオーケストレーター開発中 | 2026-04-27 | dual-agent-poc/.env あり（絶対移動禁止）|
| `ai-os/` | AIOS-06 Hirayama AI OS Dashboard | 2026-04-20 | lifecycle-projects.json = HAIKI-05参照 |
| `waste-report-system/` | HAIKI-05（廃棄物日報システム）active_setup_pending | 2026-03-13 | ai-os/lifecycle-projects.json から参照済み |
| `msk-assessment-platform/` | MSK評価プラットフォーム（GASコード・詳細仕様）| 2026-03-27 | PROJECTS.md に記載あり |
| `PMOD-08/` | 物療機器学習・成功マニュアル（知識体系） | 2026-04-10 | Phase 1 完了、拡張中 |
| `training-trend-analyzer/` | トレーニングトレンド分析（Python publication pipeline 実装済み）| 2026-04-12 | src/ に実コードあり |
| `life-design-project/` | 人生設計プロジェクト（西尾慎吾氏）進行中 | 2026-04-28 | 個人データ含む |
| `ai-invest/` | AINV-07 AI投資プロジェクト（registration_candidate）| 2026-03-10 | ペーパートレード準備中 |
| `projects/machine-sales-rebuild/` | 中古医療機器販売サイト再構築。git管理済み、実データあり | 2026-04-06 | PROJECTS.md にプロジェクトID未登録 → NEEDS_REVIEW |
| `scripts/` | ワークスペース共通スクリプト群（de, ds, auto-loop等）| - | orchestrator から多数参照 |
| `docs/` | ワークスペース共通ドキュメント（AUTO_DEV_MODE等）| - | |
| `config/` | drive-sync-exclude.txt（Drive同期除外リスト）| - | sync-workspace-to-drive.ps1 から参照 |
| `logs/` | ログ保存先（runlog, drive-sync, gdrive-upload等）| - | gitignore対象・de コマンドが書き込む |
| `archive/` | 既存アーカイブ（freee-old, jyu-gas-simple等）| 2026-03-10 | |
| `secrets/` | 認証情報（gitignore対象）| - | **絶対触らない** |
| `.claude/` | Claude Code 設定 | 2026-05-01 | |

---

## ARCHIVED
退避したフォルダー一覧

| 元パス | 退避先 | 理由 |
|---|---|---|
| `workspace/tmp/jrec-clasp-recover/` | `_archive_workspace_cleanup_20260502/tmp/jrec-clasp-recover/` | git-ignored、2026-03-19 の旧GASバックアップ（Ver3_core.js: 112KB。現在の gas-projects 版は 251KB でずっと新しい） |

退避先: `C:\hirayama-ai-workspace\_archive_workspace_cleanup_20260502\`

---

## DELETE_NOT_EXECUTED
今回、削除は一切実施していない。退避のみ。

---

## DUPLICATE_CANDIDATES
重複・混在候補として調査したが、実際には別プロジェクトと判断

| ペア | 調査結果 |
|---|---|
| `aios-orchestrator/` vs `ai-os/` | 別プロジェクト。aios-orchestrator = Python デュアルエージェント PoC。ai-os = AIOS-06 Google Sheets Dashboard システム |
| `msk-assessment-platform/` vs `PMOD-08/` | 別プロジェクト。msk-assessment-platform = GAS製臨床評価ツール（スプレッドシートUI）。PMOD-08 = 物療機器の知識体系・学習マニュアル |

---

## NEEDS_REVIEW
人間確認が必要な事項

### 1. `projects/machine-sales-rebuild/` の扱い
- **状況:** `projects/` という中間フォルダー内に存在。git管理済み（実データ多数含む）。最終更新 2026-04-05。
- **内容:** 中古医療機器販売サイト（machine-group.net）の商品データ・WordPress画像・フロントエンド
- **問題:** PROJECTS.md にプロジェクトIDが登録されていない
- **選択肢:** ① workspace 直下に昇格（`workspace/machine-sales-rebuild/`）② `projects/machine-sales-rebuild/` のまま維持 ③ 保留
- **判断が必要な理由:** プロジェクトID未登録・`projects/` ラッパーの必要性が不明確

### 2. CLAUDE.md の waste-report-system 記述の不整合
- **状況:** CLAUDE.md §5「廃棄物日報システム」に「企画段階（**ディレクトリ未作成**）」と記載されているが、`waste-report-system/` は実際には存在し、HAIKI-05 として `ai-os/lifecycle-projects.json` から参照済み
- **対応:** CLAUDE.md の該当箇所を「active_setup_pending・HAIKI-05」に修正すべき
- **リスク:** 放置すると次回の Claude Code セッションで「ディレクトリが存在しない」という誤認識が起きる

### 3. `ai-invest/` の活性度確認
- **状況:** AINV-07 (registration_candidate)。最終更新 2026-03-10（2ヶ月前）
- **内容:** ペーパートレード準備中で止まっている
- **質問:** このプロジェクトは現在も進める予定がありますか？

### 4. `msk-assessment-platform/` のステータス確認
- **状況:** 最終更新 2026-03-27（約5週間前）。GASコードと詳細仕様書あり
- **質問:** このプロジェクトは現在も継続中ですか？稼働中のシートがありますか？

### 5. `aios-orchestrator/dual-agent-poc/.env` に秘密情報あり
- **状況:** `.env` ファイルが gitignore 対象として存在（363バイト）
- **対応不要:** gitignore 対象で追跡されていないため問題なし。ただし PC 移行時に手動コピーが必要
- **メモ:** このディレクトリは今後も移動・削除しないこと

---

## GIT_STATUS_SUMMARY

| フォルダー | 種別 | Branch | Status | Remote |
|---|---|---|---|---|
| `workspace/`（ルート）| Git リポジトリ | feature/auto-dev-phase3-loop | mostly clean（settings.json Modified, 2 untracked） | github.com/dabu-pi/hirayama-ai-workspace |
| `subsidy-grants-projects/` | 別 Git リポジトリ | main | clean | github.com/dabu-pi/subsidy-grants-projects |
| その他全フォルダー | workspace root の一部（別 .git なし）| - | workspace git に含まれる | - |

workspace root 以下のフォルダーはすべて `hirayama-ai-workspace` リポジトリの一部（submodule なし）。
ただし以下は gitignore で除外:
- `tmp/`（退避済み）
- `secrets/`
- `logs/`（notes/ と runlog/ の一部は除外から除外）
- `aios-orchestrator/dual-agent-poc/.env`
- `.env.local`（training-program-platform-jp 内）

---

## REFERENCES
orchestrator config やドキュメント内の参照確認

| 参照元 | 参照先 | 結果 |
|---|---|---|
| `ai-os/lifecycle-projects.json` | `["HAIKI-05"]` → `waste-report-system/` | フォルダー存在確認済み ✓ |
| `config/drive-sync-exclude.txt` | `tmp/` 等の除外リスト | `tmp/` は退避済みで問題なし ✓ |
| `scripts/sync-workspace-to-drive.ps1` | workspace 全体 | `tmp/` は元々 exclude リストに含まれていた ✓ |
| CLAUDE.md | `waste-report-system/` = 「ディレクトリ未作成」 | **不整合あり** → NEEDS_REVIEW #2 |
| PROJECTS.md | `projects/machine-sales-rebuild/` | プロジェクトID登録なし → NEEDS_REVIEW #1 |

---

## VALIDATION
確認チェックリスト

- [x] workspace 直下の全フォルダーを棚卸し済み（22フォルダー）
- [x] git status 確認済み（workspace root: mostly clean）
- [x] subsidy-grants-projects git 確認済み（clean）
- [x] aios-orchestrator/dual-agent-poc/.env の存在確認（gitignore対象、移動禁止）
- [x] tmp/ が gitignore 対象であることを確認（.gitignore line 35）
- [x] tmp/ の内容が旧バックアップのみであることを確認（jrec-clasp-recover, 2026-03-19）
- [x] tmp/ の退避完了確認（_archive_workspace_cleanup_20260502/tmp/）
- [x] secrets/ 未接触確認
- [x] 削除ゼロ確認
- [x] ACTIVE 判定フォルダーが workspace に残っていることを確認
- [x] orchestrator 参照確認（ai-os/lifecycle-projects.json → waste-report-system/ 存在）
- [x] 重複候補の別プロジェクト性を確認（aios-orchestrator vs ai-os / msk vs PMOD-08）

---

## NEXT
人間が次に判断・対応すべきこと

1. **CLAUDE.md 修正（推奨）:** §5「廃棄物日報システム」の記述を「企画段階・ディレクトリ未作成」→「active_setup_pending / HAIKI-05 / workspace/waste-report-system/」に修正
2. **`projects/machine-sales-rebuild/` の扱い確認:** workspace 直下に昇格するか、`projects/` ラッパーを維持するか判断
3. **`ai-invest/` の継続有無確認:** ペーパートレードを再開する予定があるか
4. **`msk-assessment-platform/` のステータス確認:** 稼働中のシートがあるか、継続中か
5. **PROJECTS.md の `machine-sales-rebuild` 登録検討:** プロジェクトID（例: MSRB-XX）を割り当てるか

---

## 調査実施日時
2026-05-02

## 調査担当
Claude Code (claude-sonnet-4-6)
