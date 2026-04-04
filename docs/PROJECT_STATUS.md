# PROJECT_STATUS.md — 現在地・進捗トラッキング

## 2026-03-30 Google Drive handoff docs 最終整文（進行中）
- `SETUP.md` の旧 Step 10 と新 Step 10B を統合し、rclone 前提の Step 10 のみへ整理。
- `docs/GOOGLE_DRIVE_SYNC.md` を最終版へ更新し、`copy` と `sync` の差分、推奨方針、既定 `sync` の理由を明記。
- wording を `README.md` / `CLAUDE.md` / `SETUP.md` / `docs/GOOGLE_DRIVE_SYNC.md` / `docs/PROJECT_STATUS.md` / `ai-os/PROJECT_STATUS.md` で統一。
- 統一方針: GitHub / workspace が正本、`workspace-export` は upload 用 export、Drive for desktop 常駐同期は前提にしない、`de` の最後に rclone upload、Drive 側コピーでは Git 作業しない。
- `SETUP.md` の文字化けを解消し、初回セットアップ手順として読める日本語へ再整文。
- `scripts/setup-gdrive-handoff.ps1` を追加し、`rclone` 検出または user-local install、remote 作成確認、User 環境変数設定、初回 `copy` upload までを一括導線化。
- `upload-workspace-export-to-gdrive.ps1` は `PATH` だけでなく `HIRAYAMA_RCLONE_EXE` と既知 install path からも `rclone` を自動解決するよう補強。
- 指定 folder ID に既存ファイルがあっても、upload 先は dedicated child path に固定する方針を `SETUP.md` / `docs/GOOGLE_DRIVE_SYNC.md` に追記。

## 2026-03-30 Google Drive handoff を rclone upload 前提へ修正（進行中）
- Drive for desktop 常駐同期前提は廃止し、`workspace -> workspace-export -> rclone -> Google Drive` の 2 段階 handoff へ修正。
- `scripts/upload-workspace-export-to-gdrive.ps1` を追加し、`HIRAYAMA_GDRIVE_REMOTE` / `HIRAYAMA_GDRIVE_REMOTE_PATH` による一方向アップロードへ整理。
- `scripts/sync-workspace-to-drive.ps1` は export 作成に責務を限定。`workspace-export\INDEX.md` は Drive 上の再開導線として継続生成。
- `de` は push 成功後に export sync、続いて Google Drive upload を試行。upload が未設定または失敗でも commit / push / Run_Log / Projects は継続。
- 記録先は `logs/drive-sync/` と `logs/gdrive-upload/` に分離。Dashboard の既存スキーマ追加は行わない。
- 保留事項: 各 PC で `rclone config` と環境変数設定を完了し、最初の実 upload を確認する。

## 2026-03-30 Google Drive export sync 導入（進行中）

- workspace 全体の handoff 導線として `scripts/sync-workspace-to-drive.ps1` を追加。
- 方針は **GitHub 正本 / Drive は export 参照先**。`workspace` を Drive 配下で直接作業しない。
- 既定 export 先は `C:\hirayama-ai-workspace\workspace-export`。必要に応じて `HIRAYAMA_DRIVE_SYNC_EXPORT_ROOT` で変更可能。
- `config/drive-sync-exclude.txt` を追加し、`.git` / `.claude` / `node_modules` / `.venv` / `secrets` / `logs/runlog` / `*.log` などを除外。
- `de` は push 成功後に Drive sync を呼ぶ構成へ拡張。失敗しても commit / push / Run_Log / Projects sync は継続。
- Drive 側の再開導線として `workspace-export\INDEX.md` を毎回再生成する。
- 運用文書を `docs/GOOGLE_DRIVE_SYNC.md` / `SETUP.md` / `README.md` / `CLAUDE.md` に反映する方針。

### 現在地

- 現在地: Drive export script / de 統合 / docs 作成まで完了。
- 次アクション: 初回 export 実行確認と、`de -ProjectId AIOS-06` で handoff 一式を検証。
- 保留事項: 各 PC で `rclone config` と `HIRAYAMA_GDRIVE_REMOTE*` の初期設定を行い、最初の実 upload を確認する。
- テスト状況: script dry-run / 実 sync / de handoff の順で確認予定。
- 重要判断: Drive は補助導線であり、正本を GitHub から移さない。


> **使い方:** 各開発サイクルの終わりにこのファイルを更新する。
> Claude への引き継ぎ・再開プロンプトの冒頭にこのファイルの内容を貼る。

---
## 2026-03-16 de を全プロジェクト共通 handoff コマンドとして明文化（完了）

- `de` は AIOS-06 専用から workspace 全体の共通終了コマンドへ正式移行（commit `d7462e8`）
- `de -ProjectId <id>` で任意の既存案件 ID を指定し `Projects` シートへ最小同期（次アクション・最終更新日・補足の 3 列）
- JREC-01 実 write で AIOS-06 以外でも動作確認済み（commit `c7e48c2`・`949746a`）
- `Projects` シートが全案件台帳の正本であることを `CLAUDE.md` に明文化
- 未登録 project_id は `[WARN] Skip: no auto-append`（安全設計維持）
- env vars（`AIOS_DASHBOARD_SPREADSHEET_ID` / `AIOS_SERVICE_ACCOUNT_PATH`）が設定済みなら `de` 1コマンドで commit→push→Run_Log シート追記→Projects 同期まで完結
- WIP commit / push 方針（別 PC 再開前提）を `CLAUDE.md` の `### 毎日の作業ルール` に追記

---
## 2026-03-16 AIOS validate-task-queue スキーマ修正（解消済み）

- `task-queue-validation-lib.mjs` の `LIVE_HEADERS` / `REQUIRED_FIELDS` / `KNOWN_CLEANUP_MISSING` を日本語スキーマへ更新。
- `validate-task-queue.mjs --warn-only` → `[OK] No incomplete Task_Queue rows detected.` (exit 0) 確認済み。
- 詳細: `ai-os/PROJECT_STATUS.md` の `2026-03-16 RESOLVED` セクション参照。

---
## 2026-03-16 Git operation rule update

- ルート `AGENTS.md` に、全プロジェクト共通の commit / push 運用ルールを追記した。
- 原則として作業終了時は commit / push まで実施し、途中でも別PCで再開価値がある状態は WIP commit / push 対象とする。
- PC 切り替え前には `git status` / 現在ブランチ / 未push有無を必ず確認する運用を明文化した。

---
## 2026-03-13 Dashboard final polish memo

- `Dashboard` の `開く / SPEC` は `Projects` 正本参照の `HYPERLINK()` に更新済み。
- `Projects` は canonical 4案件だけでなく、backup/current seed を元に全案件台帳として再構成済み。live は 7 案件。
- `Dashboard` 27行目以降は空化し、row 27+ を hidden 化。旧凡例ブロックは撤去済み。
- `Dashboard` は白ベース + 淡色配色へ更新。タイトル帯は淡青、KPI は白地と淡色ラベル、文字は濃いグレー。
- `Dashboard` 右上から `Projects を開く` で全案件正本へ遷移できる。

---

## 現在地 (Current Position)

| 項目 | 内容 |
|---|---|
| プロジェクト | workspace インフラ（AI 開発環境） |
| ブランチ | feature/auto-dev-phase3-loop |
| フェーズ | Phase3.1 完成（AI 開発環境 E-1〜E-8 すべて完了） |
| 最終更新 | 2026-03-13 |

---

## 最後の実行 (Last Execution)

```
コマンド  : Hirayama AI OS Dashboard 日本語再設計
終了コード: 0
コミット  : このファイル更新後に commit / push
ステータス: SUCCESS
```

### 実行結果サマリ

```
## COMMANDS
  Hirayama AI OS Dashboard を日本語中心の表示専用操作盤へ再設計
    - Dashboard / Projects / Task_Queue / Ideas / Metrics / Lists を新スキーマへ更新
    - `優先度調整` シートを追加し、`project_id` 正本運用へ移行
    - live sheet へ反映後、Task_Queue / Ideas / Dashboard / Projects / Metrics を再確認

## LIVE RESULT
  Dashboard 指標
    - 総案件数 = 4
    - 本番運用中 = 1
    - 進行中 = 3
    - 未完了タスク = 7
    - 保留アイデア数 = 1
  確認事項
    - 今日の優先タスクの期限表示を `yyyy-mm-dd` に修正済み
    - Projects の案件リンク / SPEC リンクを Dashboard から直接開ける構成へ更新
    - Task_Queue / Ideas は backup から再構築できる再実行安全なスクリプトに修正済み
    - canonical 4案件の `メインシートURL` を直接 URL へ確定済み
    - Dashboard `最近の更新` は canonical project_id のみ表示する式へ更新済み
    - `優先度調整` で `TASK-003` を一時的に `はい` にすると `70 -> 170` となり Dashboard 先頭へ移動、空欄へ戻すと元へ復元されることを確認済み
    - Dashboard はタイトル / 説明 / KPI / セクション見出しのみ結合し、一覧本体は非結合のまま列幅・行高・折り返し・配置・背景色・罫線を整理済み
```

---

## 次のアクション (NEXT)

1. `優先度調整` の運用ルールを固め、`今日は最優先` と `加点` の使い分けを日次運用へ落とし込む
2. `Ideas -> Task_Queue -> Projects` の日次運用を 4 案件で回し、必要なら段階遷移ルールを微調整する
3. Projects の `フォルダURL` 不足分を、必要になった案件から順に実 URL へ確定する
4. Run_Log の記録粒度を見直す場合も、Dashboard は canonical 4案件中心の表示を維持する

---

## STOP 理由 (Stop Reason)

なし（正常完了）

---

## 完了タスク履歴 (Done Log)

| 日時 | タスク | コミット |
|---|---|---|
| 2026-03-05 | feat: Phase1+2 エイリアス自動登録スクリプト追加 | 0212a15 |
| 2026-03-05 | docs: Auto Dev Mode Phase2 仕様書・プロンプト追加 | ddc9667 |
| 2026-03-05 | chore: Phase2スクリプト完成形（英語化・構文修正・Step2-5改善） | 34dbae4 |
| 2026-03-05 | chore: finalize auto-dev Phase2（STOP handling, AI report, PROJECT_STATUS） | 403c8d7 |
| 2026-03-05 | docs: ROADMAP に AI開発環境セクション追加・PROJECT_STATUS 初回記入 | c5b5a25 |
| 2026-03-05 | feat: add Auto Dev Mode Phase3（Claude 自律開発モード） | 223f7f5 |
| 2026-03-06 | docs: Phase3.1 loop prompt 改訂（入力一本化・AI REPORT 優先・20ファイル閾値） | ce149c4 |
| 2026-03-06 | docs: ERROR_ANALYSIS.md — エラー解析システム仕様書を追加 | 6445a33 |

---

## 参照

- `ROADMAP.md` — タスク全体像・優先順位
- `CLAUDE.md` — AIアシスタント向けルール
- `docs/AUTO_DEV_MODE_PHASE2.md` — Phase2 仕様
- `docs/PROMPTS/auto-dev-phase3.md` — Phase3 開始プロンプト（セッション初回）
- `docs/PROMPTS/auto-dev-phase3-loop.md` — Phase3.1 ループ継続プロンプト
- `docs/AUTO_DEV_MODE_PHASE3.md` — Phase3 仕様
- `docs/ERROR_ANALYSIS.md` — エラー解析システム仕様
- `scripts/auto-dev-checklist.md` — 各フェーズのチェックリスト


---

## 2026-04-03 Handoff Sync

- `feature/auto-dev-phase3-loop` は `67c7ac7` まで GitHub push 済み
- `scripts/upload-workspace-export-to-gdrive.ps1` の PowerShell 5.1 非互換な `return (if (...))` を修正
- `scripts/sync-workspace-to-drive.ps1` で `C:\hirayama-ai-workspace\workspace-export` へ MIRROR 同期済み
- `scripts/upload-workspace-export-to-gdrive.ps1 -Mode copy` で `hirayama_gdrive_handoff:hirayama-ai-workspace/workspace-export` へアップロード済み
- Google Drive アップロードログ: `logs/gdrive-upload/gdrive-upload_20260403_181301.log`
- Google Drive アップロード結果JSON: `logs/gdrive-upload/gdrive-upload_20260403_181301.json`

---

## 2026-04-04 中古マシン販売システム再構築 初回棚卸し

### 目的

現行の中古マシン販売システムを壊さず棚卸しし、WordPress を使わない次世代再構築に向けた調査ドキュメントを作成する。

### 作成した成果物

- `docs/current-system-overview.md`
- `docs/sheet-inventory.md`
- `docs/gas-responsibility-map.md`
- `docs/rebuild-architecture-draft.md`
- `docs/migration-strategy.md`
- `docs/open-questions.md`
- `docs/tab-classification.csv`

### 現在地

- 商品マスタ、見積テンプレート、案件進捗台帳、競合データの主要スプレッドシートを Drive から特定し、主要タブの役割を Markdown に整理した。
- 商品マスタの中核候補は `ネットショップ商品一覧2018-10-22`。
- 見積/案件進捗は `【見積】見積もりテンプレート2.3`、`【見積】長谷川様ご依頼分`、`2020マシンやグループ全案件進捗状況` の `2024長谷川さん` が連動している可能性が高い。
- ユーザー提供の `ネットショップ商品一覧GAS.txt`、`見積もりテンプレートGAS.txt`、`競合サイトGAS.txt` を読み、商品コード生成、WordPress/BASE出力、外部PHPへのサイト反映POST、見積自動入力/再計算、競合収集/画像保存の処理内容を `docs/gas-responsibility-map.md` に反映した。
- 見積GASが A列のSD商品コードだけでなく、B列のその他商品コードから別ブック `【商品追加用ページ】メーカー、同業者`（`1oyelesEq-Hw2Nlr6nNdxqWoR6RsftvWyZw0b-uNUVyQ`）の `その他の商品一覧` を参照していることを追加確認した。
- 競合価格データは `STRONGDEPOT 競合サイトデータ` を収集元とし、`他社競合データ` が `IMPORTRANGE` で中継していることを確認した。
- ローカルの `freee-automation` は `2024長谷川さん` / `lines_json作成` を対象に、freee見積作成・Gmail下書き・メール貼り付けを担っていることを整理した。

### 完了済み

- ルート `README.md`、`PROJECTS.md`、`ROADMAP.md`、`docs/PROJECT_STATUS.md` を読み、作業前に `git status` と `git pull --ff-only` を確認した。
- Drive 上の主要スプレッドシートを `中古`、`商品一覧`、`見積`、`競合` などで検索し、主要ブックIDとタブ構成を棚卸しした。
- 主要タブのサンプル範囲を取得し、商品コード体系、WordPress/BASE出力、見積計算、競合収集、案件台帳、freee連携の流れを整理した。
- 提供されたGASテキスト3件を読み、関数一覧、入出力シート、外部依存、固定列/固定セル依存、文字列パース依存、分類マスタ二重管理リスクをドキュメントへ追記した。
- `競合サイトデータまとめ` の `メーカー分類` に `#ERROR!` が出ていること、`リンク` タブの旧見積テンプレートID `1ZM5veZcu-WGifslyCRkBtQwjigSUiAccqvDOypkZ_zs` が 404 であることを確認した。

### 次アクション

1. `ネットショップ商品一覧2018-10-22`、`【見積】見積もりテンプレート2.3`、`STRONGDEPOT 競合サイトデータ` の Apps Script エディタから scriptId、トリガー、最終更新日を取得し、提供テキストと一致確認する。
2. `machine-group.net/strongdepot-product-manager/generate.php` と `Settings.php` を回収し、GAS POST 後に WordPress/サイト側へどう反映しているかを棚卸しする。
3. `ネットショップ商品一覧2018-10-22` が商品マスタ正本かどうか、旧コピー/バックアップ/試作ブックの現役度、`【商品追加用ページ】メーカー、同業者` の位置づけを現場確認する。
4. 商品コード生成仕様、見積テンプレート正本、BASE継続要否、競合分類エラー原因、分類マスタ三重管理の解消方針を優先確認する。
5. 新統合スプレッドシート v0 の列定義と、現行正本からの変換マッピング表を作る。

### 保留事項

- 対象ブックに紐づくコンテナバインドGASの `scriptId` と実トリガーは、今回のCLI/Drive API調査ではまだ取得できていない。コード内容はユーザー提供テキストから確認済み。
- GAS から `https://machine-group.net/strongdepot-product-manager/generate.php` へ POST する経路は確認できたが、PHP側で WordPress/サイトへどう反映しているかは未確認。
- `中古マシン販売管理アプリ`、`ネットショップ商品一覧2024`、`ネットショップ商品一覧3.24bk`、コピー系ブック、空白/旧版タブの現役度は未確定。
- `【商品追加用ページ】メーカー、同業者` の `TEST商品` / `画像` タブの用途、`ネットショップ商品一覧2018-10-22` 側の `その他商品一覧` タブとの関係は未確定。
- `お客様希望商品` や案件タブに個人情報が含まれるため、今後のドキュメント/移行設計では値そのものを不用意に転記しない。

### テスト状況

- Google Drive コネクタで主要スプレッドシートのメタデータと範囲データを取得し、ブック名・タブ名・サンプル値を確認した。
- ユーザー提供の3つのGASテキストを PowerShell で読み取り、関数一覧と主要処理ブロックを確認した。
- `clasp list` とローカル `.clasprc.json` の Drive API 呼び出しでは、今回対象の中古マシン系コンテナバインドGASは見つからず、別件の JREC 系スクリプト2件のみ確認した。
- `rg` は Windows 環境でアクセス拒否になったため、PowerShell `Get-ChildItem` + `Select-String` でローカル全文検索を実施した。

### 直近の重要判断

- 役割が不明なタブや旧コピーは即削除候補にせず、`要確認` または `アーカイブ` として扱う。
- 新システムでは、商品マスタ本体と WordPress/BASE などのチャネル別出力を分離し、見積・案件・競合価格・メディアを別ドメインとして設計する方針でたたき台を作成した。
