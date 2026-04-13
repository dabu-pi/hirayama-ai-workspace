# Apps Script 実体監査メモ

最終更新: 2026-04-04

## 目的

現行スプレッドシートに紐づく Apps Script の実体を、`scriptId` / バインド種別 / ファイル一覧 / トリガー / 手元テキストとの一致状況という観点で監査し、「今どのコードが動いているか」を止めずに判断できる状態へ近づける。

## 今回の調査方法と制約

### 実際に確認できたこと

- ユーザー提供の3テキストから、商品マスタGAS・見積テンプレートGAS・競合収集GASのコード本文と主要関数を確認した。
- `freee-automation/PROJECT_STATUS.md` から、freee連携GASの scriptId `194kDwfuLoTJ_xUgI1xfBb6KJ74MSR1sOPHvIpgycnZbygJy_RrtWqsKj` を確認した。

### CLI/APIで試したが回収できなかったこと

| 試行 | 結果 | 意味 |
|---|---|---|
| Drive API で `mimeType = 'application/vnd.google-apps.script'` を検索 | 中古マシン系の3GASは見つからず、別件JREC系スクリプトのみ | 少なくとも現在のDrive検索経路では、対象ブックのコンテナバインドスクリプトを列挙できていない |
| `.clasprc.json` の access_token で `https://script.googleapis.com/v1/processes:listScriptProcesses?pageSize=50` を呼ぶ | `401 UNAUTHENTICATED` | access_token が失効していた |
| refresh_token で access_token を更新して再度 `processes:listScriptProcesses` を呼ぶ | `403 ACCESS_TOKEN_SCOPE_INSUFFICIENT` | 現在の `.clasprc.json` 資格情報スコープでは Apps Script 管理APIの process 一覧取得ができない |
| GitHubコネクタで `strongdepot-product-manager` を検索 | 該当リポジトリなし | 接続済みGitHub資産としては見えていない |
| `git ls-remote https://github.com/kohakuwebdesign/strongdepot-product-manager.git` | `Repository not found.` | 公開リポジトリとしては見えない、または権限不足 |

## 実体監査台帳

| スプレッドシート名 | script名 | scriptId | バインド種別 | 主要ファイル | 主要関数 | トリガー | 手元テキストとの一致状況 | リスク | 備考 |
|---|---|---|---|---|---|---|---|---|---|
| ネットショップ商品一覧2018-10-22 | 未回収 | 未回収 | コンテナバインド推定 | `ネットショップ商品一覧GAS.txt` 相当。実プロジェクト側の `.gs` / `.html` / `appsscript.json` は未回収 | `onOpen`、`mainFunc`、`createProductCode`、`createWordpressCsv`、`createBaseCsv`、`hideRowsFunc`、`showRowsFunc`、`sendHttpPost`、`doGet` | `onOpen` メニューはコード上確認。時間トリガー有無は未回収 | 未照合。手元テキストが最新実体と一致しているか未確認 | 古い版のGASが別途残っていてもCLIから判別できない。`sendHttpPost()` が本番反映入口なら誤操作リスクが高い | Apps Script エディタURLの手作業回収が必要 |
| 【見積】見積もりテンプレート2.3 | 未回収 | 未回収 | コンテナバインド推定 | `見積もりテンプレートGAS.txt` 相当。実プロジェクト側ファイル一覧は未回収 | `onOpen`、`initFunc`、`createTrigger`、`myOnEdit`、`mainFunc`、`setMatchDatas2`、`setMatchDatas`、`setEachSum`、`getFinalSum`、`getShippingFee` | `createTrigger()` が `myOnEdit` の installable onEdit トリガーを作る実装。既に設定済みかどうかは未回収 | 未照合。テキストが `2.3` の実体なのか、別ブック派生版なのか未確認 | 見積入力中に自動発火するため、古いトリガーが残っていると想定外の更新が起きる | Apps Script トリガー画面の確認が必須 |
| STRONGDEPOT 競合サイトデータ | 未回収 | 未回収 | コンテナバインド推定 | `競合サイトGAS.txt` 相当。実プロジェクト側ファイル一覧は未回収 | `mainFunc`、`getPageUrls`、`getSinglePageData`、`insert`、`downloadImages` | 時間主導トリガーがあるか未回収。手動入口は `mainFunc()` | 未照合。手元テキストが現在の収集本番版か未確認 | 古い HTML パーサー仕様のまま動いている/止まっている判断がトリガー未回収だとできない | `Parser` ライブラリの導入方法もエディタ側で確認したい |
| 2020マシンやグループ全案件進捗状況 | freee-automation | `194kDwfuLoTJ_xUgI1xfBb6KJ74MSR1sOPHvIpgycnZbygJy_RrtWqsKj` | コンテナバインド推定 | `hawkメール自動貼り付け.js`、`freee請求書作成.js`、`phase3_下書き作成.js`、`appsscript.json` | `phase1_recordHawkMailsToSheet`、`installPhase1Trigger_10min`、`freee_phase2_processPendingQuotations`、`freee_runAll`、`phase3_createDraftsForQuotedRows` | `installPhase1Trigger_10min()` は10分トリガー作成。`freee_runAll` 時間トリガーは未設定と文書上確認 | ローカル `freee-automation/src` と `PROJECT_STATUS.md` の記述は整合している。GASエディタ実体との最終照合は未実施 | `.clasp.json` がgitignoreで未所持のため、CLI上はバインド関係の最終確認ができない | この scriptId は唯一回収済み |
| 【見積】見積もりテンプレート2.3freee連携API | 未回収 | 未回収 | 要確認 | 未回収 | 未回収 | 未回収 | 未照合 | `2.3` とどちらが現役正本か未確定のまま切替すると、現場の見積入力導線を壊す | まずブックを開いて Apps Script 有無を確認 |
| 【見積】長谷川様ご依頼分 | 未回収 | 未回収 | 要確認 | 未回収 | 未回収 | 未回収 | 未照合 | 顧客別タブ生成や転記に別GASがあっても見落とす可能性 | Apps Script 有無の確認が必要 |

## 手元テキストと実体コードの一致確認ステータス

| テキスト | 推定バインド先 | 一致確認 | 理由 |
|---|---|---|---|
| `C:\Users\pinsh\OneDrive\デスクトップ\ネットショップ商品一覧GAS.txt` | `ネットショップ商品一覧2018-10-22` | 未確認 | scriptId と実 `.gs` をエディタから回収できていないため、テキストが最新本番版か断定できない |
| `C:\Users\pinsh\OneDrive\デスクトップ\見積もりテンプレートGAS.txt` | `【見積】見積もりテンプレート2.3` または派生ブック | 未確認 | テキスト内に固定参照IDはあるが、どの見積ブックのコンテナバインド実体かは未照合 |
| `C:\Users\pinsh\OneDrive\デスクトップ\競合サイトGAS.txt` | `STRONGDEPOT 競合サイトデータ` | 未確認 | `getActiveSpreadsheet()` 前提のためバインド先推定はできるが、scriptId未回収 |
| `freee-automation/src/*.js` | `2020マシンやグループ全案件進捗状況` | 一部確認済 | scriptId は文書上確認済みだが、Apps Script エディタから最新コード同一性をまだ直接比較していない |

## 現時点の結論

- freee連携GAS以外の3本は、コード内容は確認できたが `scriptId` / 実トリガー / 実プロジェクト名をこのCLI権限では回収できていない。
- `.clasprc.json` の OAuth スコープでは Apps Script 管理APIの process 一覧取得ができず、API経由での runtime audit はここで止まっている。
- よって「今動いているのは本当にこのコードか」「古い版GASが残っていないか」は、Apps Script エディタURLとトリガー画面の手作業確認が次の必須タスク。

## 次の一手

1. 各対象ブックで `拡張機能 > Apps Script` を開き、ブラウザURLの `/projects/<scriptId>/edit` を控える。
2. Apps Script エディタ左ペインのファイル一覧、`appsscript.json`、トリガー画面の関数名/種別/イベントソース/最終実行を転記する。
3. その情報を本ファイルと `docs/apps-script-inventory.md` へ反映し、手元テキストとの差分有無を確定する。

## すぐ実装着手できる候補

- scriptId / ファイル一覧 / トリガー一覧を貼るだけで埋まる監査表テンプレート化
- `freee-automation` だけ先に scriptId 確定済みとして、新旧切替境界図へ組み込む
