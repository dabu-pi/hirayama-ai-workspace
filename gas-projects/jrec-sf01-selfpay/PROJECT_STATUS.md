# PROJECT_STATUS.md — JREC-SF01 自費カルテ・会計システム

## 現在ステータス

**Phase 2 MVP 実装完了・Webアプリデプロイ待ち**（2026-04-27）

---

## 今回の作業内容（2026-04-27 セッション4）

| 作業 | 内容 |
|---|---|
| Phase 2 MVP 実装 | 患者一覧・患者登録・患者詳細（入口のみ）の GAS Webアプリ |
| clasp push | 9ファイルを Apps Script に反映済み |

### 作成ファイル

| ファイル | 内容 |
|---|---|
| `JREC_SF01_Main.gs` | doGet() エントリ・ページルーティング・include/getAppUrl_ |
| `JREC_SF01_Patient.gs` | getPatients / getPatientById / createPatient / generateNextPatientId_ / appendRunLog_ |
| `index.html` | 共通ナビヘッダー（各ページに include('index') で埋め込む）|
| `patient-list.html` | S01 患者一覧画面（検索・未収強調・患者行クリック）|
| `patient-form.html` | S06 新規患者登録画面（google.script.run.createPatient）|
| `patient-detail.html` | S02 患者詳細入口（基本情報表示・Phase 3〜4 プレースホルダー付き）|
| `styles.html` | 共通CSS（全ページに include('styles') で埋め込む）|
| `appsscript.json` | webapp 設定追加（executeAs: USER_DEPLOYING / access: MYSELF）|

### 実装内容サマリー

| 機能 | 状態 |
|---|---|
| doGet() ルーティング（page パラメータ）| ✅ |
| 患者一覧表示（Patients シートから取得）| ✅ |
| 患者検索（氏名・フリガナ・患者ID・電話番号）| ✅ |
| 新規患者登録（Patients シートへ保存）| ✅ |
| patientId 自動採番（P0001 形式）| ✅ |
| Settings シートから prefix/digits を参照 | ✅ |
| Run_Log への操作記録 | ✅ |
| 患者詳細入口（基本情報表示）| ✅ |
| 未収強調表示（行の橙背景）| ✅（データあり次第有効）|
| 共通ヘッダー・CSS | ✅ |

### clasp push 済みファイル一覧

```
appsscript.json / index.html / JREC_SF01_Main.gs / JREC_SF01_Patient.gs
JREC_SF01_Setup.gs / patient-detail.html / patient-form.html
patient-list.html / styles.html
```

### Webアプリ デプロイ手順（ユーザー実施）

1. [Apps Script エディタ](https://script.google.com/d/1-1opRkAFbFQz96Uqlgy3sWjgAs_PKS_1Eg9Pz7_6geTFztHx_5APSj2G/edit) を開く
2. 右上「デプロイ」→「新しいデプロイ」
3. 種類: **ウェブアプリ**
4. 次のユーザーとして実行: **自分（dabu-pi）**
5. アクセスできるユーザー: **自分のみ**
6. 「デプロイ」をクリック → Webアプリ URL を確認

以降の更新は「デプロイを管理」→「既存のデプロイを編集」→バージョン「新しいバージョン」で更新する。

### 実機確認チェックリスト（ユーザー実施）

- [ ] Webアプリ URL を開いて患者一覧が表示される
- [ ] 「＋ 新規患者登録」から患者登録フォームが開く
- [ ] 氏名を入力して保存 → Patients シートに P0001 で記録される
- [ ] 一覧に戻ったとき登録した患者が表示される
- [ ] 2件目登録 → P0002 で採番される
- [ ] 検索ボックスで絞り込みができる
- [ ] 「詳細」ボタンで患者詳細画面が開く

---

## 今回の作業内容（2026-04-27 セッション3）

| 作業 | 内容 |
|---|---|
| runSetupAll 実行確認 | ユーザーが Apps Script で実行し、10シート作成を確認 ✅ |
| UIレイアウト設計書作成 | `docs/UI_LAYOUT_v1.md` — 7画面レイアウト・遷移図・設計方針・Phase 2 MVP範囲を定義 |

### 10シート確認済み（2026-04-27）

- [x] **runSetupAll() 実行済み**（ユーザーが Apps Script エディタから実行）
- [x] **10シート作成確認済み**

| シート名 | 状態 |
|---|---|
| Settings | ✅ |
| Patients | ✅ |
| SelfPayVisits | ✅ |
| SelfPayChart | ✅ |
| SelfPayItems | ✅ |
| Payments | ✅ |
| Receipts | ✅ |
| MenuMaster | ✅ |
| DailySales | ✅ |
| Run_Log | ✅ |

---

## 今回の作業内容（2026-04-27 セッション2）

`hirayama-jyusei-strategy` を参照し、以下を確定。

| 作業 | 内容 |
|---|---|
| MenuMaster 初期データ確定 | 主力3本・個別パーツ6種・評価入口3種・保留3本（計15メニュー）|
| 消費税設計確定 | 税率10%・税別管理・端数切り捨て・明細行ごと計算 |
| 患者ID設計確定 | P + 4桁連番（P0001〜）。jrecPatientId で保険JRECと任意紐づけ |
| シート列定義確定 | Settings / Patients / SelfPayVisits / SelfPayChart / SelfPayItems / Payments / Receipts / MenuMaster / DailySales / Run_Log（10シート）|
| SHEET_DESIGN_v1.md 作成 | `docs/SHEET_DESIGN_v1.md`（全シート定義・ID体系・MenuMaster初期データを記録）|

### ジム会員割引: 廃止確定

2026-04-25 院長判断で廃止済み。JREC-SF01 の MenuMaster に「ジム会員価格」列は持たない。通常価格（税別）のみで運用する。

---

## 今回の作業内容（2026-04-27 セッション1）

| 作業 | 内容 |
|---|---|
| フォルダー作成 | `gas-projects/jrec-sf01-selfpay/` を新規作成 |
| README.md 作成 | プロジェクト概要・JREC本体との違い・将来展開を記録 |
| PROJECT_STATUS.md 作成 | 本ファイル。進捗管理の起点 |
| 設計ドキュメント作成 | `docs/JREC-SF01_selfpay_chart_accounting_system_design_2026-04-27.md` |

---

## コード実装状態

| ファイル | 状態 | 内容 |
|---|---|---|
| `JREC_SF01_Setup.gs` | ✅ 作成済み | 全10シート初期セットアップスクリプト |
| `appsscript.json` | ✅ 作成済み | Apps Script マニフェスト（V8 / Asia/Tokyo）|
| `.clasp.json` | ❌ 未作成 | clasp 管理は次フェーズで設定 |

### clasp 設定（2026-04-27）

| 項目 | 値 |
|---|---|
| scriptId | `1-1opRkAFbFQz96Uqlgy3sWjgAs_PKS_1Eg9Pz7_6geTFztHx_5APSj2G` |
| Apps Script URL | https://script.google.com/d/1-1opRkAFbFQz96Uqlgy3sWjgAs_PKS_1Eg9Pz7_6geTFztHx_5APSj2G/edit |
| clasp push | ✅ 実施済み（2ファイル: appsscript.json + JREC_SF01_Setup.gs）|
| setupAll_ 実行 | ❌ 未実施（手動実行が必要）|

**⚠️ 注意: スクリプトの紐づきについて**

`clasp create --type sheets` は既存 SS への紐づけができず、**新規 Google Sheets（`13Sxfk1w3yU_XUjlah7C01cxaoIWQjWfTpXTKmNjjaRw`）が別途作成**された。
コード内の `openById(SPREADSHEET_ID)` が正しい対象 SS（`15O2AIWv1...`）を直接参照するため、**setupAll_() は正しく動作する**。

ただし対象 SS の「拡張機能 > Apps Script」メニューからはこのスクリプトにアクセスできない。
実行は Apps Script エディタ（上記 URL）から行う。

将来的に対象 SS へ container-bound で紐づけ直したい場合:
1. 対象 SS を開く → 拡張機能 > Apps Script
2. 生成された scriptId を確認（URL 中の `/d/SCRIPT_ID/`）
3. `.clasp.json` の `scriptId` を更新して `clasp push` し直す

### JREC_SF01_Setup.gs でできること

- `setupAll_()` を実行するだけで全10シートを一括セットアップ
- 再実行安全（既存データは保持）
- 各シート: ヘッダー色・列幅・ドロップダウン入力規則を自動設定
- Settings 初期値（12件）を自動投入
- MenuMaster 初期データ（15件）を自動投入
- 有効フラグ TRUE=薄緑 / FALSE=薄グレーで色分け

---

## JREC本体への影響

- **影響なし**
- `jyu-gas-ver3.1/` には一切変更を加えていない
- 既存JRECの clasp 設定・push・保険請求ロジックへの変更はない

---

## Dashboard反映

- **Dashboard反映対象外**（JREC-SF01 専用の Dashboard は未作成）
- 将来フェーズで自費売上ダッシュボードを作成予定

---

## フェーズ別ロードマップ

| Phase | 内容 | ステータス |
|---|---|---|
| Phase 0 | 初期設計ドキュメント作成 | **完了（2026-04-27）** |
| Phase 1 | スプレッドシート設計・GASセットアップ | **完了（2026-04-27）** |
| Phase 2 | GAS Webアプリ — 患者一覧・患者詳細・患者登録 | **実装完了（2026-04-27）/ デプロイ・実機確認待ち** |
| Phase 3 | GAS Webアプリ — 来院入力・カルテ記録 | UI設計完了 / 実装未着手 |
| Phase 4 | GAS Webアプリ — 会計入力・領収書・未収管理 | UI設計完了 / 実装未着手 |
| Phase 5 | タイムライン・VASグラフ・日次集計 | UI設計完了 / 実装未着手 |
| Phase 6 | Next.js / Supabase 化検討 | 未着手 |
| Phase 7 | 外販モデル化 | 未着手 |

---

## 確定済み設計方針サマリー

| 項目 | 決定値 |
|---|---|
| 消費税率 | 10% |
| 価格管理 | 税別（税込は計算で導出）|
| 端数処理 | 切り捨て（floor）|
| 税計算単位 | 明細行ごと |
| 患者ID形式 | P + 4桁連番（P0001〜）|
| 領収書番号 | R + 年度 + 4桁連番（SPR_2026_0001）|
| ジム会員割引 | 廃止（2026-04-25）|
| 主力KPI基準単価 | 継続標準施術 3,500円税別（月40回目標）|

---

## 次フェーズ着手条件（Phase 1 スプレッドシート作成）

- [x] シート列定義完了 → `docs/SHEET_DESIGN_v1.md`
- [x] MenuMaster 初期データ確定 → `docs/SHEET_DESIGN_v1.md`
- [x] 税・ID 方針確定
- [x] **GASセットアップスクリプト作成** → `JREC_SF01_Setup.gs`
- [x] **スプレッドシート作成済み** → ID: `15O2AIWv1OyZAXdCOWoz1-OxVukuFttHoZydsCDlYPX0`
- [ ] **スクリプトを SS に貼り付けて `setupAll_()` を実行する**（次の手作業）
- [ ] 実行後、各シートの状態を目視確認する
- [ ] MenuMaster 評価入口3メニューの有効フラグを院長に確認する

### 院長への確認依頼（Phase 1 開始前）

| # | 確認事項 | 影響 |
|---|---|---|
| 1 | 腰痛・首肩こり・膝 の初回評価3メニューを現在受付で使っているか | MenuMaster 有効フラグ |
| 2 | パーソナルトレーニング（SELFPAY_PT60）を現在提供しているか | MenuMaster 有効フラグ |
| 3 | 4回集中コースの価格を決めたか | TRAINING_4PASS 有効フラグ |

---

## 別PC再開状態（2026-04-27）

| 項目 | 状態 |
|---|---|
| ブランチ | `feature/auto-dev-phase3-loop` ✅ |
| git pull | 最新（Already up to date）✅ |
| `.clasp.json` | 別PCで復元済み（scriptId: `1-1opRkAFbFQz96Uqlgy3sWjgAs_PKS_1Eg9Pz7_6geTFztHx_5APSj2G`）✅ |
| `runSetupAll()` 実行 | **未確認** — ユーザーが Apps Script から実行する必要あり |
| 10シート作成 | **未確認** |
| MenuMaster 初期15件 | **未確認** |
| Phase 2 着手 | setup確認後に着手可能 |

### ユーザー確認依頼

以下を実施してください。

1. [Apps Script エディタ](https://script.google.com/d/1-1opRkAFbFQz96Uqlgy3sWjgAs_PKS_1Eg9Pz7_6geTFztHx_5APSj2G/edit) を開く
2. 関数プルダウンで `runSetupAll` を選択して「実行」をクリック
3. 権限承認が出たら許可する
4. [自費専用スプレッドシート](https://docs.google.com/spreadsheets/d/15O2AIWv1OyZAXdCOWoz1-OxVukuFttHoZydsCDlYPX0/edit) を開く
5. 以下を確認して結果を教えてください

| 確認項目 | 期待値 |
|---|---|
| シート数 | 10枚（Settings / Patients / SelfPayVisits / SelfPayChart / SelfPayItems / Payments / Receipts / MenuMaster / DailySales / Run_Log）|
| Settings シート | 税率10% / floor / 税別管理 など12件の初期値 |
| MenuMaster | 15メニュー（主力3本・個別パーツ6種・評価入口3種・保留3本）|

確認完了後、このファイルの以下チェックボックスを更新します。

---

## 変更履歴

| 日付 | 内容 |
|---|---|
| 2026-04-27 | プロジェクト初期設計ドキュメントを作成。コード実装なし。 |
| 2026-04-27 | `docs/SHEET_DESIGN_v1.md` 作成。MenuMaster初期データ・税設計・ID設計・全10シート列定義を確定。 |
| 2026-04-27 | `JREC_SF01_Setup.gs` 作成。全10シート初期セットアップスクリプト。スプレッドシートID確定（15O2AIWv1...）。 |
| 2026-04-27 | `.clasp.json` 作成・`clasp push` 実施。Apps Script に JREC_SF01_Setup.gs を反映済み。setupAll_() は未実行。 |
| 2026-04-27 | `runSetupAll()` ラッパー追加・clasp push。Apps Script エディタの関数選択で `runSetupAll` を選んで実行可能になった。 |
| 2026-04-27 | `docs/UI_DESIGN_v1.md` 作成。7画面・バックエンド関数一覧・Phase別ロードマップを定義。 |
| 2026-04-27 | 別PC再開。`.clasp.json` 復元。`runSetupAll()` 実行・10シート確認をユーザーに依頼。 |
| 2026-04-27 | `runSetupAll()` 実行確認・10シート作成確認済み。`docs/UI_LAYOUT_v1.md` 作成。UIレイアウト設計完了。 |
| 2026-04-27 | Phase 2 MVP 実装。JREC_SF01_Main.gs / JREC_SF01_Patient.gs / 5 HTML + styles.html 作成。clasp push 完了（9ファイル）。 |
