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

---

## 2026-04-04 中古マシン販売システム再構築 調査フェーズ2

### 目的

初回棚卸しで残った未確定要素のうち、Apps Script実体、商品コード仕様、見積フロー正本、WordPress依存、新統合シートv0、products.json仕様を整理し、設計フェーズへ進める状態を作る。

### 作成した成果物

- `docs/apps-script-inventory.md`
- `docs/product-code-spec.md`
- `docs/quotation-flow-current.md`
- `docs/wordpress-dependencies.md`
- `docs/integrated-sheet-v0.md`
- `docs/products-json-spec-draft.md`

### 今回新たに確定したこと

- 商品反映GASの入口は `ネットショップ商品一覧GAS.txt` の `sendHttpPost()` で、`https://machine-group.net/strongdepot-product-manager/generate.php` へ `ネットショップ商品一覧` 全行JSONをPOSTしている。
- 見積テンプレートGASの実行トリガーは `createTrigger()` が作るインストール型 onEdit トリガー `myOnEdit` で、A/B/G/J/K列編集時に `mainFunc()` が走る。
- 見積A列のSD商品コードは `ネットショップ商品一覧2018-10-22` を、B列のその他商品コードは `【商品追加用ページ】メーカー、同業者` / `その他の商品一覧` を参照する。
- 競合取得の実行入口は `競合サイトGAS.txt` の `mainFunc()`、画像保存の実体は `downloadImages()`、保存先フォルダIDは `1Q0vGVu2N8Ouq8us0JIMSaH1oCdHVLiZl`。
- 商品コード仕様は `店舗コード + メーカーコード + 仕入年コード + 通し番号3桁 + 部位コード`。ただしメーカーコード長例外、`MC` 衝突、`首` の空部位コード、未一致時の前行値流用バグなどを確認した。

### まだ未確定のこと

- 商品一覧GAS、見積テンプレートGAS、競合サイトGASの `scriptId`、Apps Script プロジェクト名、実ファイル名、`appsscript.json`、インストール済みトリガー一覧。
- `【見積】見積もりテンプレート2.3` と `2.3freee連携API` のどちらが新規見積作成の現行正本か、`長谷川様ご依頼分` 顧客別タブへのコピー/転記手順。
- `generate.php` / `Settings.php` のPHP側コード実体。
- BASE出力の現役度、`TEST商品` / `画像` タブの用途、分類マスタをどこに一本化するか。

### 設計に進めるようになった項目

- `商品マスタ` / `設定マスタ` / `サイト出力ビュー` / `見積入力` / `見積履歴` / `競合価格データ` / `アーカイブ` の新統合シートv0列設計レビュー。
- `sd_product_code` を保持しながら、コード構成要素を独立列で持つ商品マスタ設計。
- WordPress taxonomy/post状態を使わない `products.json` の項目設計。

### 次の一手

1. 各対象ブックの Apps Script エディタURLから `scriptId` とファイル一覧とトリガー設定を回収し、`docs/apps-script-inventory.md` の `未回収` を埋める。
2. `strongdepot-product-manager` の `generate.php` / `Settings.php` を回収し、WordPress反映ロジックを確定する。
3. 実運用の見積作成手順を1件トレースし、`2.3` / `2.3freee連携API` / `長谷川様ご依頼分` の正本・派生・旧運用を最終確定する。
4. `docs/integrated-sheet-v0.md` と `docs/products-json-spec-draft.md` をもとに、最小v0列だけに絞った実装用マッピング表を作る。

### すぐ実装着手できる候補

- 新統合シートv0の雛形生成
- 現行 `ネットショップ商品一覧` → `商品マスタ` / `サイト出力ビュー` / `products.json` の変換マッピング表
- 現行 `mitsumori` → `見積入力` / `見積履歴` の列マッピング表
- 既存 `sd_product_code` のバリデーション/分解チェック仕様

---

## 2026-04-04 中古マシン販売システム再構築 調査フェーズ3

### 目的

Apps Script 実体と WordPress/PHP 反映経路の未確定部分を、CLI/API/接続済み資産で回収できる範囲まで詰め、どこを止めると何が止まるかを設計判断できる状態へ近づける。

### 作成・更新した成果物

- 新規: `docs/apps-script-runtime-audit.md`
- 新規: `docs/php-publish-flow.md`
- 新規: `docs/design-readiness-check.md`
- 更新: `docs/wordpress-dependencies.md`
- 更新: `docs/sheet-inventory.md`
- 更新: `docs/tab-classification.csv`
- 更新: `docs/open-questions.md`

### 今回新たに確定したこと

- Apps Script API の `processes:listScriptProcesses` は、`.clasprc.json` の refresh_token で access_token を更新しても `403 ACCESS_TOKEN_SCOPE_INSUFFICIENT` になり、このCLI権限では対象GASの `scriptId` / トリガー一覧を自動回収できない。
- `strongdepot-product-manager` は、接続済みGitHubコネクタ検索で見つからず、`git ls-remote https://github.com/kohakuwebdesign/strongdepot-product-manager.git` も `Repository not found.`、`C:\Users\pinsh\OneDrive` 配下にも `generate.php` / `Settings.php` 控えが見つからなかった。
- そのため、`sendHttpPost()` → `generate.php` という入口とPOST payload構造はGAS側から確定できたが、PHP内部のWordPress投稿更新処理はこの環境だけでは未回収のまま。
- 商品一覧GAS・見積GAS・競合GASのコード本文は提供テキストから読めているが、「そのテキストが今ブックに紐づいている最新の実体コードと一致するか」は、Apps Script エディタURL回収なしでは断定できない。

### まだ未確定のこと

- `ネットショップ商品一覧2018-10-22`、`【見積】見積もりテンプレート2.3`、`STRONGDEPOT 競合サイトデータ` の script名、scriptId、実ファイル一覧、トリガー種別/対象関数、デプロイ設定、最終更新情報。
- `generate.php` / `Settings.php` のPHPコード、WordPress DB/投稿/taxonomy 更新方式、認証/アクセス制限の有無。
- `2.3` と `2.3freee連携API` のどちらが見積正本か、BASE出力が現役か、旧コピー/試作ブックの最終現役度。

### 次に設計へ進める項目

- 商品マスタv0、設定マスタ、サイト出力ビュー、`products.json` は先行設計に進める。
- 見積は `mitsumori` 中心の新入力/明細モデル設計に進めるが、正本ブック確定後に最終調整が必要。
- WordPress切替停止順序と現行GAS停止順序は、scriptId/トリガーとPHPコード回収後に確定する。

### 次の一手

1. ユーザー側で対象ブックの Apps Script エディタを開き、`/projects/<scriptId>/edit` のURL、左ペインのファイル一覧、トリガー画面の設定を控えて共有する。
2. サーバー側または権限付きGitHubから `strongdepot-product-manager` の `generate.php` / `Settings.php` を含むPHP一式を回収する。
3. 共有された scriptId/PHPソースを `docs/apps-script-runtime-audit.md` と `docs/php-publish-flow.md` に追記し、停止影響マップを確定する。

### すぐ実装着手できる候補

- 現行商品マスタ → 新統合シートv0 / `products.json` の変換マッピング
- `sd_product_code` バリデーション/分解テスト仕様
- PHPソース回収後の `generate.php` 入出力差分表

---

## 2026-04-04 中古マシン販売システム再構築 設計フェーズ4

### 目的

未確定な PHP / scriptId を追い続けるのではなく、調査フェーズ1〜3で「もう設計に進める」と判断できた商品マスタ・設定マスタ・サイト出力ビュー・`products.json`・現行→新構造マッピングを具体化する。

### 作成/更新した成果物

- 新規: `docs/product-master-v0.md`
- 新規: `docs/settings-master-v0.md`
- 新規: `docs/site-output-view-v0.md`
- 新規: `docs/products-json-spec.md`
- 新規: `docs/current-to-v0-mapping.md`
- 新規: `docs/product-code-validation-spec.md`
- 新規: `docs/competitor-data-v0.md`
- 更新: `docs/integrated-sheet-v0.md`
- 更新: `docs/design-readiness-check.md`
- 更新: `docs/open-questions.md`
- 更新: `docs/rebuild-architecture-draft.md`

### 今回確定した設計要素

- 新統合スプレッドシート v0 は `商品マスタ`, `設定マスタ`, `サイト出力ビュー`, `競合価格データ`, `見積入力`, `見積履歴`, `アーカイブ` の7タブ構成で進める。
- 商品マスタ v0 は `internal_id` を新内部主キー、`sd_product_code` を既存互換コードとして分離保持し、価格・公開状態・画像・SEO・`legacy_wp_*` 隔離列まで定義した。
- 設定マスタ v0 は `master_type + code` を主キーにし、`display_name`, `legacy_value`, `legacy_code`, `aliases`, `is_active` を持つ構成で進める。
- サイト出力ビュー v0 は商品マスタの派生生成物とし、一覧/詳細/検索/ソート/SEO/公開判定に必要な列だけを持つ。
- `products.json` は WordPress 非依存の `schemaVersion + products[]` 構造で定義し、完全例・売却済み例・非公開例をサンプル化した。
- 現行 `ネットショップ商品一覧` 列から新商品マスタ/サイト出力ビュー/JSONへのマッピングと、加工/廃止/隔離保持の判定を整理した。
- `sd_product_code` は既存値保持を原則とし、新規採番と検証では設定マスタ参照、重複チェック、未登録マスタ停止、可変長メーカーコード対応、旧例外処理を分けて扱う。
- 競合価格データ v0 は収集結果、自社商品紐付け候補、レビュー状態、価格差分、画像URLを持つ独立タブとして残す。

### まだ保留の設計要素

- `generate.php` / `Settings.php` の実装未回収により、旧WordPressカテゴリ最終一覧と旧投稿更新ロジックの完全突合は未完了。
- 商品/見積/競合GASの `scriptId` と実トリガー一覧は未回収のまま。
- 見積の正本が `2.3` / `2.3freee連携API` のどちらか、案件別コピーとの最終関係は未確定のため、`見積入力` / `見積履歴` は概要設計に留めた。
- BASE出力の現役度、`売値計算式` 列の実運用度、売却済み商品をサイト掲載するかどうか、競合価格の税込/税抜区分、`products.json` に非公開商品を含めるかは保留。

### 実装に近づいたもの

- 新統合スプレッドシート v0 のタブ雛形生成
- 商品マスタ v0 と設定マスタ v0 の列定義作成
- 現行商品マスタ → 新v0シート/サイト出力ビュー/`products.json` の変換スクリプト試作
- `sd_product_code` の検証/分解ユニットテスト作成
- `products.json` 静的生成プロトタイプ

### 次の一手

1. `docs/product-master-v0.md` / `docs/settings-master-v0.md` / `docs/site-output-view-v0.md` をもとに、新統合スプレッドシート v0 の実タブ雛形を別ブックとして作る。
2. `docs/current-to-v0-mapping.md` を入力にして、現行 `ネットショップ商品一覧` の読み取り専用変換スクリプトを作る。
3. 変換結果から `products.json` を生成し、売却済み/非公開/画像なし/未登録マスタ行のサンプルを比較検証する。
4. `docs/settings-master-v0.md` のメーカー/カテゴリ一覧を、現行 `ルール` シートとGAS配列の完全表で埋める。
5. 見積正本ブック確定後に `見積入力` / `見積履歴` の詳細列設計へ進む。

### すぐ着手できる実装候補

- 新統合スプレッドシート v0 雛形生成スクリプト
- 現行商品マスタCSV/Sheets → 商品マスタ v0 変換スクリプト
- 商品コード `sd_product_code` 検証ライブラリ
- `products.json` 生成スクリプトとサンプル出力
- 設定マスタ初期データ投入スクリプト

---

## 2026-04-05 中古マシン販売システム再構築 画像仕様反映タスク

### 目的

設計フェーズ4で作成した新システム設計ドキュメントへ、商品画像の正式仕様「最低1枚、最大10枚、元画像は縦横比自由、表示用は700x700正方形の派生生成物、収まり優先で余白背景を付ける」を反映する。

### 作成/更新した成果物

- 新規: `docs/image-spec-v0.md`
- 更新: `docs/integrated-sheet-v0.md`
- 更新: `docs/product-master-v0.md`
- 更新: `docs/site-output-view-v0.md`
- 更新: `docs/products-json-spec.md`
- 更新: `docs/current-to-v0-mapping.md`
- 更新: `docs/rebuild-architecture-draft.md`
- 更新: `docs/open-questions.md`
- 更新: `docs/PROJECT_STATUS.md`

### 今回確定した画像仕様

- 商品1件あたり画像は最低1枚、最大10枚。現行 `画像1〜3` は初回移行で順序を保ってそのまま取り込み、4枚目以降は新構造で追加できる。
- 商品マスタの正本画像は元画像URL配列 `source_image_urls`。元画像は縦横比を問わず保持し、`image_count`, `main_image_index`, `main_source_image_url` で枚数と代表画像を管理する。
- 700x700正方形の表示用画像は商品マスタの正本列に持たず、`サイト出力ビュー` / `products.json` 生成時の派生画像として `display_image_urls`, `main_display_image_url`, `images[].displayUrl` に分けて持つ。
- 表示用画像生成は商品全体の収まりを優先し、過度な自動トリミングではなく余白背景で正方形化する。
- `products.json.images[]` は `sourceUrl`, `displayUrl`, `width`, `height`, `alt`, `isMain`, `sortOrder` を持つv0仕様とし、`thumbnailUrl` はまだ必須化しない。

### まだ実装時に決めること

- 表示用画像の保存先を Drive派生画像、オブジェクトストレージ、CDN のどれにするか。
- 余白背景色を白固定にするか、サイトデザイン側の背景色に合わせるか。
- 元画像差し替え時の派生画像再生成を即時処理、バッチ処理、手動再生成のどれにするか。
- `thumbnailUrl` など追加派生をv0から持つか、必要になった時点で後方互換追加するか。
- 画像0枚の既存行が見つかった場合に、移行時エラー停止にするか、`draft/private` 限定の要確認データとして一時許容するか。

### 次に着手しやすい実装候補

1. 新統合スプレッドシート v0 雛形へ `source_image_urls`, `image_count`, `main_image_index`, `display_image_urls`, `main_display_image_url` を反映する。
2. 現行 `画像1〜3` → `source_image_urls` 変換と `main_image_index` 初期化を含む読み取り専用変換スクリプトを作る。
3. 元画像URLから700x700正方形の表示用画像を生成し、`display_image_urls` と `products.json.images[].displayUrl` を出力する試作を作る。
4. `products.json` 生成サンプルで、最大10枚、代表画像、売却済み、非公開、画像欠損要確認のケースを比較検証する。
