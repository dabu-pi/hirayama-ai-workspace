# Apps Script 台帳（中古マシン販売システム）

最終更新: 2026-04-04

## 目的

現行スプレッドシートに紐づく Apps Script の所在、役割、参照シート、外部連携、トリガー、現役度を整理し、新システム移行時に「どのGASを残し、どこから切り離すか」を判断できる状態にする。

## 確認ステータスの読み方

| 表記 | 意味 |
|---|---|
| 確認済 | コード・参照先・役割を実ファイルまたは提供テキストから確認できた |
| 一部確認済 | コードは確認できたが scriptId / トリガー / プロジェクト名などが未回収 |
| 未確認 | script の有無や中身をまだ確認できていない |
| 推定 | コード内容や `getActiveSpreadsheet()` の使い方からバインド先を推測したが、Apps Script エディタ上で未照合 |

## スクリプト台帳

| スプレッドシート名 | script プロジェクト名 | scriptId | バインド種別 | ファイル名一覧 | 主な関数 | 実行トリガー | 参照シート | 外部連携先 | 現役 / 旧運用 / 要確認 | 備考 |
|---|---|---|---|---|---|---|---|---|---|---|
| ネットショップ商品一覧2018-10-22 | 未回収（`ネットショップ商品一覧GAS.txt` 相当プロジェクトと推定） | 未回収 | コンテナバインド推定 | `コード.gs` 相当1本をテキストで確認。`.html` / `appsscript.json` は未回収 | `onOpen`、`mainFunc`、`createProductCode`、`createWordpressCsv`、`createBaseCsv`、`hideRowsFunc`、`showRowsFunc`、`sendHttpPost`、`doGet`、`getData` | `onOpen` カスタムメニュー。時間トリガー有無は未回収 | `ネットショップ商品一覧`、`Wordpress用csv`、`BASE用csv` | `https://machine-group.net/strongdepot-product-manager/generate.php` | 現役の可能性が高い / script実体は要確認 | `shops`/`makers`/`machines`/`bodyParts`/`productStatus` をGAS内配列で保持。`Settings.php` 更新コメントあり |
| 【見積】見積もりテンプレート2.3 | 未回収（`見積もりテンプレートGAS.txt` 相当プロジェクトと推定） | 未回収 | コンテナバインド推定 | `コード.gs` 相当1本をテキストで確認。`.html` / `appsscript.json` は未回収 | `onOpen`、`initFunc`、`createTrigger`、`myOnEdit`、`mainFunc`、`setMatchDatas2`、`setMatchDatas`、`setEachSum`、`getFinalSum`、`getShippingFee`、`deleteShippingFee`、`deleteSummary`、`isGoodSheet` | `onOpen` カスタムメニュー、`createTrigger()` が `myOnEdit` のインストール型 onEdit トリガーを作成 | アクティブな `mitsumori` 系タブ、`ネットショップ商品一覧2018-10-22` / `ネットショップ商品一覧`、`【商品追加用ページ】メーカー、同業者` / `その他の商品一覧` | 外部HTTP通信なし | 現役の可能性が高い / script実体は要確認 | `isGoodSheet()` がシート名に `mitsumori` を含むタブだけ処理対象にするため、タブ命名が実質仕様 |
| 【見積】見積もりテンプレート2.3freee連携API | 未確認 | 未回収 | 要確認 | 未回収 | 未回収 | 未回収 | `mitsumori` 他 | freee連携を含む可能性あり / 未確認 | 要確認 | `見積もりテンプレートGAS.txt` と同系統コードが入っている可能性はあるが、Apps Script エディタで未照合 |
| 【見積】長谷川様ご依頼分 | 未確認 | 未回収 | 要確認 | 未回収 | 未回収 | 未回収 | `見積書テンプレート`、案件別タブ多数 | 未確認 | 要確認 | 案件別コピーを多数持つブック。コンテナバインドGASの有無は未回収 |
| STRONGDEPOT 競合サイトデータ | 未回収（`競合サイトGAS.txt` 相当プロジェクトと推定） | 未回収 | コンテナバインド推定 | `コード.gs` 相当1本をテキストで確認。`.html` / `appsscript.json` は未回収 | `mainFunc`、`getPageUrls`、`getSinglePageData`、`insert`、`getArchivePageLength`、`downloadImages` | 時間トリガー有無は未回収。手動実行入口は `mainFunc()` | `リサイフィット` | `https://recyfit.com/products/`、`https://rawgit.com/medialize/URI.js/gh-pages/src/URI.js`、Driveフォルダ `1Q0vGVu2N8Ouq8us0JIMSaH1oCdHVLiZl` | 現役の可能性が高い / script実体は要確認 | `Parser` ライブラリ前提。HTML構造変更や `rawgit.com` 停止に弱い |
| 2020マシンやグループ全案件進捗状況 | `freee-automation` | `194kDwfuLoTJ_xUgI1xfBb6KJ74MSR1sOPHvIpgycnZbygJy_RrtWqsKj` | コンテナバインド推定（ただし `.clasp.json` 未回収のため要照合） | `src/hawkメール自動貼り付け.js`、`src/freee請求書作成.js`、`src/phase3_下書き作成.js`、`src/appsscript.json` | `phase1_recordHawkMailsToSheet`、`phase1_rebuildFromProcessedLabel`、`openLinesJsonSheet`、`applyLinesJsonToRow`、`installPhase1Trigger_10min`、`freee_phase2_processPendingQuotations`、`freee_runAll`、`phase3_createDraftsForQuotedRows` | `installPhase1Trigger_10min()` が10分おき時間トリガー作成。`freee_runAll` の時間トリガーは未設定と `freee-automation/PROJECT_STATUS.md` に記載 | `2024長谷川さん`、`lines_json作成` | Gmail API、freee OAuth/API `https://accounts.secure.freee.co.jp/public_api`、`https://api.freee.co.jp` | 現役 | scriptId は `freee-automation/PROJECT_STATUS.md` に記載あり。`.clasp.json` は gitignore 対象で未所持 |
| 【商品追加用ページ】メーカー、同業者 | 未確認 | 未回収 | 要確認 | 未回収 | 未回収 | 未回収 | `その他の商品一覧`、`TEST商品`、`画像` | 未確認 | 要確認 | 見積GASから参照されるマスタだが、このブック自身のGAS有無は未確認 |
| ネットショップ商品一覧2024 | 未確認 | 未回収 | 要確認 | 未回収 | 未回収 | 未回収 | `ネットショップ商品一覧` ほか同型タブ | 未確認 | 旧運用/アーカイブ候補だが要確認 | `ネットショップ商品一覧2018-10-22` と同型の旧コピー候補 |
| ネットショップ商品一覧2018-10-22 のコピー | 未確認 | 未回収 | 要確認 | 未回収 | 未回収 | 未回収 | 同型タブ | 未確認 | 旧運用/アーカイブ候補だが要確認 | コピー名から複製バックアップと推測 |
| ネットショップ商品一覧3.24bk | 未確認 | 未回収 | 要確認 | 未回収 | 未回収 | 未回収 | 同型タブ | 未確認 | 旧運用/アーカイブ候補だが要確認 | `bk` 名称からバックアップと推測 |

## ファイル単位の役割整理

### ネットショップ商品一覧GAS.txt

| ファイル | 主な関数 | 役割 | 参照先 | 外部連携 | 使っていない可能性 |
|---|---|---|---|---|---|
| `ネットショップ商品一覧GAS.txt` | `onOpen` | `★システムスタート` メニュー追加 | アクティブスプレッドシート | なし | 現役の可能性が高い |
| 同上 | `mainFunc` | 商品コード生成 → WordPress CSV生成 → BASE CSV生成の一括実行 | `ネットショップ商品一覧`、`Wordpress用csv`、`BASE用csv` | なし | 現役の可能性が高い |
| 同上 | `createProductCode` | SD商品コード生成 | `ネットショップ商品一覧` | なし | 現役の可能性が高い |
| 同上 | `createWordpressCsv` | WordPress用CSV生成、カテゴリ文字列生成、商品状態/公開状態変換 | `ネットショップ商品一覧`、`Wordpress用csv` | なし | 新サイトでは置き換え対象 |
| 同上 | `createBaseCsv` | BASE用CSV生成 | `ネットショップ商品一覧`、`BASE用csv` | なし | BASE継続要否により現役度要確認 |
| 同上 | `hideRowsFunc` / `showRowsFunc` | 売却済み行の非表示/再表示 | `ネットショップ商品一覧` | なし | 現役の運用補助か要確認 |
| 同上 | `sendHttpPost` / `doGet` / `getData` | 商品一覧をJSON化し外部PHPへPOST | `ネットショップ商品一覧` | `generate.php` | 商品反映の本体。PHP側未回収 |
| 同上 | `colorImportantHeaderCell` | 必須ヘッダー背景色付け | `ネットショップ商品一覧` | なし | `onOpen` メニューに出ておらず、日常運用では未使用の可能性 |
| 同上 | `getSheetObj` / `getAllDatas` / `getKeywordColIndex` / `getColDatas` | 共通ユーティリティ | 各シート | なし | 同名関数が2重定義されており整理余地あり |
| 同上 | `setColDatas` | 生成商品コード列への逐次書き込み | `ネットショップ商品一覧` | なし | 現役の可能性が高い |
| 同上 | `formatCategoryText` | カテゴリ文字列の重複カンマ・先頭末尾カンマ除去 | なし | なし | WordPressカテゴリ生成専用 |
| 同上 | `hideRowsFromKeyword` / `showRowsFromKeyword` | キーワード一致行の表示制御 | `ネットショップ商品一覧` | なし | `keyword` 引数が実質未使用で `売却済み` 固定 |

### 見積もりテンプレートGAS.txt

| ファイル | 主な関数 | 役割 | 参照先 | 外部連携 | 使っていない可能性 |
|---|---|---|---|---|---|
| `見積もりテンプレートGAS.txt` | `onOpen`、`initFunc`、`createTrigger` | 初回メニュー追加、認証導線、`myOnEdit` トリガー設置 | 見積ブック自身 | なし | 現役の初期設定導線 |
| 同上 | `myOnEdit` | A/B/G/J/K列編集時だけ見積再計算を起動 | アクティブシート | なし | 現役の中核トリガー |
| 同上 | `mainFunc` | SD商品/その他商品の自動取得、行合計・送料/運搬設置費・小計/税/合計再生成、ヘッダー整形 | `mitsumori` 系タブ、`ネットショップ商品一覧`、`その他の商品一覧` | なし | 現役の中核処理 |
| 同上 | `setMatchDatas2` | SD商品コードから `ネットショップ商品一覧` の商品情報を展開 | `ネットショップ商品一覧` | なし | 現役 |
| 同上 | `setMatchDatas` | B列のその他商品コードから `その他の商品一覧` の商品情報を展開 | `【商品追加用ページ】メーカー、同業者` / `その他の商品一覧` | なし | 現役 |
| 同上 | `setEachSum` | 商品名文字列から現状価格を取り直し、値引き後単価と行合計を再計算 | `mitsumori` 系タブ | なし | 文字列依存が強く、次世代では置き換え対象 |
| 同上 | `getFinalSum` | H列合計から小計/消費税/合計を算出 | `mitsumori` 系タブ | なし | 現役 |
| 同上 | `getShippingFee` / `deleteShippingFee` / `deleteSummary` | K2/K3 の追加費用取得、既存送料・運搬設置費・集計行の初期化 | `mitsumori` 系タブ | なし | K2/K3固定セル前提 |
| 同上 | `isGoodSheet` | シート名が `mitsumori` を含むか判定 | アクティブシート | なし | 日本語名見積タブには効かない設計 |
| 同上 | `getSheetNames`、`getMessage`、`deleteEmptyRow`、`getKeyWordMatchRange`、`getMatchRowDatas` | 補助/デバッグ | 各シート | なし | `getSheetNames` / `getMessage` は日常運用で未使用の可能性 |

### 競合サイトGAS.txt

| ファイル | 主な関数 | 役割 | 参照先 | 外部連携 | 使っていない可能性 |
|---|---|---|---|---|---|
| `競合サイトGAS.txt` | `mainFunc` | リサイフィット新着商品の重複除外取り込み、画像保存、シート追記 | `リサイフィット` | `https://recyfit.com/products/`、Drive | 現役の可能性が高い |
| 同上 | `getPageUrls` | 一覧HTMLから商品詳細URL抽出 | なし | `https://recyfit.com/products/` | 現役 |
| 同上 | `getSinglePageData` | 詳細HTMLから商品名・メーカー・価格・説明・画像URLを抽出 | なし | リサイフィット商品詳細URL | 現役 |
| 同上 | `downloadImages` | 画像をDriveへ保存しURL返却 | Driveフォルダ `1Q0vGVu2N8Ouq8us0JIMSaH1oCdHVLiZl` | 画像URL、`rawgit.com` の URI.js | 現役だが外部ライブラリ依存が危うい |
| 同上 | `insert` | 2次元配列を指定シートへ書き込み | `リサイフィット` | なし | 現役 |
| 同上 | `getArchivePageLength` | アーカイブページ数を返す | なし | なし | `mainFunc` で呼ばれておらず未使用の可能性 |

### freee-automation

| ファイル | 主な関数 | 役割 | 参照先 | 外部連携 | 使っていない可能性 |
|---|---|---|---|---|---|
| `src/hawkメール自動貼り付け.js` | `phase1_recordHawkMailsToSheet`、`phase1_rebuildFromProcessedLabel`、`openLinesJsonSheet`、`applyLinesJsonToRow`、`installPhase1Trigger_10min` | Hawkメール取込、lines_json補助シート生成、台帳Q列転記、10分トリガー設置 | `2024長谷川さん`、`lines_json作成` | Gmail / Gmail API | 現役 |
| `src/freee請求書作成.js` | `freee_setup_printAuthUrl`、`freee_phase2_processPendingQuotations`、`freee_runAll`、`doGet` | OAuth認可、freee見積作成、partner_id解決/作成、冪等制御、Phase2+3連続実行 | `2024長谷川さん` | freee OAuth/API | `freee_testPhase2` や診断系関数は手動検証用 |
| `src/phase3_下書き作成.js` | `phase3_createDraftsForQuotedRows`、`phase3_testDraft`、`phase3_diagnosePdf` | freee見積作成済み行からGmail返信下書きを作る | `2024長谷川さん` | Gmail、freee API | PDF自動添付系は診断用・手動運用前提 |
| `src/appsscript.json` | なし | ランタイム/タイムゾーン/Gmail Advanced Service/WebApp設定 | なし | Gmail Advanced Service | 現役 |

## 現時点で確定したこと

- 商品反映のGAS入口は `ネットショップ商品一覧GAS.txt` の `sendHttpPost()` で、送信先は `https://machine-group.net/strongdepot-product-manager/generate.php`。
- 見積テンプレートの自動補完/再計算トリガーは `createTrigger()` で作成される `myOnEdit` のインストール型 onEdit トリガー。
- 競合取得の実行入口は `競合サイトGAS.txt` の `mainFunc()`。
- 競合画像保存ロジックの実体は `downloadImages()` で、保存先DriveフォルダIDは `1Q0vGVu2N8Ouq8us0JIMSaH1oCdHVLiZl`。
- `freee-automation` の scriptId は `194kDwfuLoTJ_xUgI1xfBb6KJ74MSR1sOPHvIpgycnZbygJy_RrtWqsKj`。

## まだ未確定のこと

- 商品一覧GAS、見積テンプレートGAS、競合サイトGASの `scriptId`、Apps Script プロジェクト名、実際の `.gs` ファイル名、`appsscript.json`、インストール済みトリガー一覧
- `【見積】見積もりテンプレート2.3freee連携API` と `【見積】長谷川様ご依頼分` に、提供GASと同一または派生したコンテナバインドスクリプトが入っているか
- `generate.php` / `Settings.php` のPHP側処理内容
- BASE出力が現在も業務で使われているか

## 次の一手

1. 各対象ブックを Apps Script エディタで開き、URL中の scriptId、プロジェクト名、ファイル一覧、トリガー画面の設定を回収する。
2. 回収結果でこの台帳の `未回収` / `未確認` を置き換える。
3. `generate.php` / `Settings.php` を回収し、WordPress反映ロジックの責務をこの台帳へ追記する。
