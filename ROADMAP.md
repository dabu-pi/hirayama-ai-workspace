# 開発ロードマップ

平山克司ワークスペース — 全プロジェクト統合ロードマップ
作成: 2026-03-05 / 最終更新: 2026-04-13（B-3/B-4 migration 適用済み / B-5 コードレビュー完了）

---

## ステータス凡例

| マーク | 意味 |
|---|---|
| ✅ | 完了 |
| 🔄 | 進行中 |
| ⏸ | 待機（着手前） |
| ❌ | 中断・保留 |

---

## 全体マップ

```
2026年3月                    4月                      5月〜
│
├─ 【柔整GAS】───────────────────────────────────────────────────→
│     施術明細upsert ✅ → テスト通過 → 申請書生成安定稼働
│
├─ 【freee自動化】───────────────────────────────────────────────→
│     OAuth再構築 → フェーズ2完成 → フェーズ3(下書き) → 運用強化
│
├─ 【患者管理Web】──────────────────────────────────→
│     認証整備 → 柔整GASと連携 → 検索・可視化
│
├─ 【トレーニング機器トレンド分析】──────────────────────────→
│     CSV/正規化基盤 ✅ → Trends/Suggest収集 ✅ → 第3ソース追加 → 公開サイト
│
├─ 【廃棄物日報システム】────────────────────────────────────────────→
│                              要件定義 → 設計 → 実装
│
├─ 【接骨院経営戦略AI】─────────────────────────────────────────────→
│                             数値入力 → Claude API実装 → 月次レポート
│
└─ 【トレーニングプログラムプラットフォーム】──────────────────────→
       MVP基盤 ✅ → Auth/owner guard ✅ → NOT NULL・RLS → 限定公開 → プログラム追加
```

---

## AI 開発環境（インフラ）

> workspace 全体で使う開発自動化スクリプト群。プロジェクト作業の前提基盤。

| # | タスク | 内容 | ステータス |
|---|---|---|---|
| E-1 | Phase1 基本スクリプト整備 | `run-with-log`, `note`, `create-ai-project`, `AUTO_DEV_MODE.md` | ✅ 完了 |
| E-2 | Phase2 半自動→自動スクリプト整備 | `auto-dev-run`, `git-safe-commit`, `analyze-error`, `dev-status`, `setup-aliases` | ✅ 完了 |
| E-3 | 統合コマンダー `auto-dev.ps1` | 1コマンドで rwl→note→gsc の PDCA サイクルを完走 | ✅ 完了 |
| E-4 | `docs/PROJECT_STATUS.md` テンプレート | 現在地・STOP理由・NEXTの引き継ぎ用テンプレ | ✅ 完了 |
| E-5 | `.gitignore` 調整 | `artifacts/`, `logs/` を除外 | ✅ 完了 |
| E-6 | Phase3 Claude 自動開発モード | `auto-dev-phase3.ps1`, `AUTO_DEV_MODE_PHASE3.md`, `auto-dev-phase3.md` | ✅ 完了 |
| E-7 | Phase3.1 自走ループプロンプト | `auto-dev-phase3-loop.md`（入力一本化・AI REPORT 優先・20ファイル閾値） | ✅ 完了 |
| E-8 | エラー解析システム仕様書 | `docs/ERROR_ANALYSIS.md`（ログ構造・AI レポート形式・Phase3 連携） | ✅ 完了 |
| E-9 | AI開発自動ループ v2 | `scripts/auto-loop.ps1`（多タスクループ・STOP検知・リトライ・AI REPORT・ループサマリー）+ `scripts/tasks.json.example` + `docs/AUTO_LOOP.md` | ✅ 完了 |

---

## プロジェクト別ロードマップ

---

### 1. 柔整GASプロジェクト `gas-projects/jyu-gas-ver3.1/`

**現状:** 来院登録・金額計算・来院ヘッダ追記（ステップ①〜③）は稼働中。
施術明細upsert（ステップ④）実装済み。テスト・本番確認フェーズへ移行。

#### フェーズ A — 施術明細upsert完成

| # | タスク | ファイル | ステータス |
|---|---|---|---|
| A-1 | `calcOnePartAmount_V3_` の戻り値を内訳オブジェクト化 | `Ver3_core.js` | ✅ 完了 |
| A-2 | `calcCaseDetailAmount_V3_` を `{total, parts[]}` 形式に変更 | `Ver3_core.js` | ✅ 完了 |
| A-3 | `calcHeaderAmountsByVisitKey_V3_` に `amounts.details` を追加 | `Ver3_core.js` | ✅ 完了 |
| A-4 | `saveVisit_V3` ステップ④を実装（施術明細シートへのupsert） | `Ver3_core.js` | ✅ 完了 |
| A-5 | `initSupport` キー名を修正（`"初検時相談支援"` → `"初検時相談支援料"`） | `Ver3_transferData.js` | ✅ 完了 |

#### フェーズ B — テスト・品質保証

| # | タスク | 内容 | ステータス |
|---|---|---|---|
| B-1 | TC01〜TC10 を実際のスプレッドシートで実行・通過確認 | TESTCASES.md 全10ケース | ⏸ 待機 |
| B-2 | 施術明細→申請書転記データの出力確認 | 実データで申請書生成テスト | ⏸ 待機 |
| B-3 | SPEC.md §14（ステップ④）の仕様を実装内容に合わせて更新 | ドキュメント整合 | ⏸ 待機 |

#### 2026-03-16 完了済み追加修正

| # | タスク | 内容 | ステータス |
|---|---|---|---|
| X-1 | HIGH-1/HIGH-2/MEDIUM-1 修正束A | visitTotal 再構成・caseKey2 追加・再検抑制理由ログ | ✅ 完了（d356b27） |
| X-2 | RC-1 転記データ case2 空行抑制 | `V3TR_buildTransferDataForMonth_` guard 追加 | ✅ 完了（80f8b0e） |
| X-3 | NDJSON case2 空オブジェクト抑制 | `V3TR_exportTransferJson_` guard 追加 | ✅ 完了（20fc562） |
| X-4 | write_application.py 帳票番号飛び修正 | Fix-S（施療料詰め）/ Fix-P（部位明細display_idx）| ✅ 完了（93b228e）/ 実機 PASS |
| X-5 | 文書反映・別PCセットアップ手順作成 | PROJECT_STATUS.md / TESTCASES.md / SETUP.md / README.md | ✅ 完了（8431092） |

#### フェーズ C — 将来拡張

| # | タスク | ステータス |
|---|---|---|
| C-1 | 月次レポート自動生成（請求データ集計） | ⏸ 待機 |
| C-2 | 接骨院経営戦略AIへの患者数・売上データ連携 | ⏸ 待機 |
| C-3 | 患者管理Webアプリとの患者IDスキーマ共通化 | ⏸ 待機 |

---

### 2. freee見積自動化 `freee-automation/`

**現状:** フェーズ1（メール→スプレッドシート自動記録）は動作済み。
フェーズ2（freee見積書作成）は OAuth再構築・取引先解決・見積POSTテスト・仕様確定まで完了。
件名フィルタ・T列（要確認フラグ）・発生日ルールをコードに実装済み。

#### フェーズ 1 — 完了済み

| タスク | ステータス |
|---|---|
| hawk メール検知・A/B/C/D/E/O列 自動記録 | ✅ 完了 |
| Gmailラベル付与による重複防止 | ✅ 完了 |
| Message-ID による冪等処理 | ✅ 完了 |

#### フェーズ 2 — OAuth再構築・見積書作成

| # | タスク | 内容 | ステータス |
|---|---|---|---|
| 2-1 | OAuth再構築 | `reset()` でトークン全削除 → `redirect_uri` をGAS WebアプリURL `/exec` と完全一致させて再認証 | ✅ 完了 |
| 2-2 | 取引先解決 | B列（顧客名）→ freee `partner_id` を自動解決（会計API / IV API / P列手入力）| ✅ 完了 |
| 2-3 | 見積書POSTテスト | Q列（lines_json）をもとに freee `/iv/api/1/quotations` へPOST → id=53553029, Q-0000000197 確認 | ✅ 完了 |
| 2-4 | 成功時の自動記録 | G列（見積日）・R列（quotation_id）をシートに保存 | ✅ 完了 |
| 2-5 | 仕様確定・コード実装 | 件名フィルタ（見積/見積依頼/作成お願いします）・発生日=受信日・T列（要確認フラグ）実装 | ✅ 完了 |

#### フェーズ 3 — Gmail下書き作成

| # | タスク | 内容 | ステータス |
|---|---|---|---|
| 3-1 | 見積PDF取得 | `fetchQuotationPdf_()` — GET /iv/quotations/{id}/pdf → Blob | ✅ 完了 |
| 3-2 | 返信メール下書き生成 | `freee_phase3_createGmailDrafts()` — PDF添付 + 返信テンプレートで下書き保存（送信しない） | ✅ 完了 |
| 3-3 | 暫定案（PDF困難な場合） | PDF取得失敗時は freee見積URL を本文に記載してフォールバック（自動） | ✅ 完了 |

#### フェーズ 4 — 運用強化

| # | タスク | ステータス |
|---|---|---|
| 4-1 | エラー通知（Slack / メール）の実装 | ⏸ 待機 |
| 4-2 | 取引先マスタの整備（顧客名 → freee取引先ID 対応表） | ⏸ 待機 |
| 4-3 | 品目マスタの整備（定型品目の単価・税区分） | ⏸ 待機 |
| 4-4 | 重複検知（同一顧客・同一件名の二重見積防止） | ⏸ 待機 |

---

### 3. 患者管理Webアプリ `patient-management/`

**現状:** 患者登録・編集・削除・施術記録追加・詳細表示の全ルートが実装済みのプロトタイプ。
`service_account.json` の管理が未整備。柔整GASとの連携は未設計。

#### フェーズ A — 本番化準備

| # | タスク | 内容 | ステータス |
|---|---|---|---|
| A-1 | 認証情報管理の整備 | `service_account.json` のパスを環境変数（`.env`）経由に変更 | ⏸ 待機 |
| A-2 | エラーハンドリングの強化 | Sheets API失敗時のフォールバック・ユーザー向けメッセージ | ⏸ 待機 |
| A-3 | `flask_log.txt` の出力先を整理 | ログをファイルではなく標準出力へ | ⏸ 待機 |

#### フェーズ B — 柔整GASとの連携

| # | タスク | 内容 | ステータス |
|---|---|---|---|
| B-1 | 患者IDスキーマの共通化 | 柔整GAS の `患者ID` フォーマットと合わせる | ⏸ 待機 |
| B-2 | 患者検索・フィルタリング機能 | 氏名・生年月日・住所でのインクリメンタル検索 | ⏸ 待機 |
| B-3 | 来院履歴の表示 | 柔整GASの「来院ヘッダ」シートから来院日・区分・金額を取得して表示 | ⏸ 待機 |

#### フェーズ C — 可視化・拡張

| # | タスク | ステータス |
|---|---|---|
| C-1 | 月別来院数グラフ（Chart.js等） | ⏸ 待機 |
| C-2 | 患者ステータス管理（アクティブ / 休眠 / 終了） | ⏸ 待機 |

---

### トレーニング機器トレンド分析 `training-trend-analyzer/`

**現状:** 手動CSV取り込み、正規化、score/ranking 計算に加え、Google Trends と Google Suggest の collector が接続済み。
2026-04-08 時点で Phase 4 入口として整理されているが、直近タスクは第3ソース追加と score detail の改善。

#### フェーズ A — 基盤整備（完了）

| # | タスク | 内容 | ステータス |
|---|---|---|---|
| A-1 | SQLite / 初期スキーマ整備 | `scripts/init_db.py` / DB schema / master data | ✅ 完了 |
| A-2 | 手動CSV取り込み | `scripts/import_csv.py` / import metadata 管理 | ✅ 完了 |
| A-3 | 正規化エンジン初版 | brand / model / category canonical 化 | ✅ 完了 |
| A-4 | score / ranking 初版 | `scripts/run_batch.py` / `src/scorer/calculator.py` | ✅ 完了 |

#### フェーズ B — 自動収集の拡張（進行中）

| # | タスク | 内容 | ステータス |
|---|---|---|---|
| B-1 | Google Trends collector | live / mock / auto と fail-safe artifact | ✅ 完了 |
| B-2 | Trends metric 安定化 | `google_trends_interest` の初期安定化 | ✅ 完了 |
| B-3 | Google Suggest collector | `search_suggest_count` / `search_suggest_presence` 接続 | ✅ 完了 |
| B-4 | 第3ソース追加 | Suggest と相性の良い軽量ソースを追加 | 🔄 進行中 |
| B-5 | score detail 改善 | 検索系軽量ソースの寄与を見やすくする | 🔄 進行中 |

#### フェーズ C — 公開導線（将来）

| # | タスク | ステータス |
|---|---|---|
| C-1 | FastAPI + PostgreSQL 化 | ⏸ 待機 |
| C-2 | Next.js 公開ランキングページ | ⏸ 待機 |
| C-3 | 公開DBと社内DBの分離 | ⏸ 待機 |

---

### 4. 廃棄物日報システム `waste-report-system/`（企画段階・未作成）

**現状:** 企画段階。ディレクトリ未作成。要件定義から着手する。

#### フェーズ A — 要件定義

| # | タスク | ステータス |
|---|---|---|
| A-1 | 収集業務フローのヒアリング（収集品目・収集先・記録頻度） | ⏸ 待機 |
| A-2 | 法定書類フォーマットの確認（提出先・必須項目） | ⏸ 待機 |
| A-3 | 既存の日報様式（紙・Excel等）の収集 | ⏸ 待機 |

#### フェーズ B — 設計・実装

| # | タスク | 内容 | ステータス |
|---|---|---|---|
| B-1 | スプレッドシート設計 | 日報入力シート・集計シート・マスタシートの構成 | ⏸ 待機 |
| B-2 | 日報入力UIの実装 | GASフォーム or スプレッドシートUI | ⏸ 待機 |
| B-3 | 月次集計の自動化 | 品目別・収集先別の集計ロジック | ⏸ 待機 |
| B-4 | PDF出力 | 日報・月報の印刷用PDF生成 | ⏸ 待機 |

---

### 5. 接骨院経営戦略AI `hirayama-jyusei-strategy/`

**現状:** 戦略・メニュー・マーケティング・財務のドキュメントは整備済み。
慢性疼痛プロジェクト管理表（Google Sheets）の構造整備が完了。Claude APIの実装は未着手。

#### 慢性疼痛プロジェクト管理表（Google Sheets）

**スプレッドシートID:** `1FnJdALwFSv48WiD6NWr0DzG78kwB692R2pFeiTcZlCc`

| # | 実施内容 | 日付 | ステータス |
|---|---|---|---|
| S-1 | 全体ダッシュボード・ロードマップ・数値前提・価格設定・KPI目標・未確定項目の6シート整備 | 2026-03-10 | ✅ 完了 |
| S-2 | 「保険・来院前提」シート新設（患者来院構造 + 保険単価シナリオ管理） | 2026-03-10 | ✅ 完了 |
| S-3 | 窓口単価（患者負担）と総保険売上単価（院収入）を列B/C に分離管理 | 2026-03-10 | ✅ 完了 |
| S-4 | 月次窓口売上・月次総保険売上の試算行を分離し数値前提との整合確認を強化 | 2026-03-10 | ✅ 完了 |

#### フェーズ A — データ入力

| # | タスク | ファイル | ステータス |
|---|---|---|---|
| A-1 | 固定費・変動費の実数値を入力 | `finance/cost-structure.md` | ⏸ 待機 |
| A-2 | 治療機器投資額・ジム設備費を入力 | `finance/equipment-investment.md` | ⏸ 待機 |
| A-3 | 現状の月次患者数・売上を入力 | `finance/profit-simulation.md` | ⏸ 待機 |

#### フェーズ B — Claude API実装

| # | タスク | 内容 | ステータス |
|---|---|---|---|
| B-1 | データ読み込みスクリプト | スプレッドシート（柔整GAS）から月次患者数・売上を取得するPythonスクリプト | ⏸ 待機 |
| B-2 | 分析プロンプト設計 | LTV試算・損益分岐点・集客施策提案のプロンプトを設計 | ⏸ 待機 |
| B-3 | 月次レポート生成 | Claude API (`claude-sonnet-4-6`) でMarkdownレポートを自動生成 | ⏸ 待機 |
| B-4 | PDF出力 | Markdown → PDF変換（WeasyPrint等） | ⏸ 待機 |

#### フェーズ C — 継続運用

| # | タスク | ステータス |
|---|---|---|
| C-1 | 月次自動実行（GAS or cronで月初に実行） | ⏸ 待機 |
| C-2 | KPIダッシュボード（患者数推移・自費比率・LTV） | ⏸ 待機 |

---

## マイルストーン

| 時期 | マイルストーン | ステータス |
|---|---|---|
| **3月中旬** | 柔整GAS: 修正束A+RC-1+帳票番号飛び修正 完了・申請書出力実機確認済み | ✅ 完了 |
| **3月下旬** | 柔整GAS: fixture 48/48 PASS・TC09b 実シート確認・B-1〜B-2 クローズ | ✅ 完了（2026-03-19） |
| **3月上旬** | freee自動化: OAuth再構築完了・フェーズ2（見積書作成）動作確認・仕様確定 | ✅ 完了 |
| **3月上旬** | freee自動化: フェーズ3（Gmail下書き）完成 | ✅ 完了 |
| **4月中旬** | 患者管理Webアプリ: 本番化準備完了・柔整GASと患者ID連携 | ⏸ 待機 |
| **4月中旬** | トレーニング機器トレンド分析: 第3ソース小規模接続・寄与明細の見える化 | 🔄 進行中 |
| **4月中旬** | トレーニングプログラムプラットフォーム: Phase A 完了（live E2E・enrollment Day 進行確認済み） | ✅ 完了 |
| **4月中旬** | トレーニングプログラムプラットフォーム: Phase B Step 1・2 完了（Auth 基盤・アプリ側 owner guard live 確認済み） | ✅ 完了 |
| **4月下旬〜5月** | トレーニングプログラムプラットフォーム: NOT NULL + RLS 適用・限定公開判断 | ⏸ 待機 |
| **4月下旬** | 廃棄物日報システム: 要件定義完了・設計開始 | ⏸ 待機 |
| **5月** | 接骨院経営戦略AI: 数値入力完了・Claude APIで月次レポート初回生成 | ⏸ 待機 |
| **6月以降** | 全システム安定稼働・KPIダッシュボード構築 | ⏸ 待機 |

---

## 着手優先順位

```
🔴 今すぐ（稼働中システムの完成）
   1. 柔整GAS: テスト通過確認（B-1〜B-3）  ← 実装は完了済み
   2. freee自動化: OAuth再構築（2-1）✅

🟡 次に（業務効率化の直接効果）
   3. freee自動化: フェーズ2完成（2-2〜2-5）✅
   4. freee自動化: フェーズ3 下書き作成（3-1〜3-3）✅
   5. 患者管理Webアプリ: 認証整備・柔整GAS連携（A-1〜B-3）
   6. トレーニング機器トレンド分析: 第3ソース追加・score detail 改善

🟢 後半（新規開発・中長期）
   7. 運動器初期評価システム JASSESS-01: Phase 1 シート生成 → Phase 2 ロジック実装 → Phase 5 Claude API連携
   8. 接骨院経営戦略AI: 数値入力 → Claude API実装
   9. 廃棄物日報システム: 要件定義 → 設計 → 実装
  10. トレーニングプログラムプラットフォーム Phase B Step 3: user_id NOT NULL + RLS 適用 → 限定公開判断 → プログラム追加
```

---

## 運動器初期評価システム JASSESS-01 `msk-assessment-platform/`

*旧称: 腰痛評価シートシステム JEVAL-01 / 旧フォルダ: low-back-assessment/*

**現状:** 設計・全体基盤整理完了（2026-03-23）。Phase 1（腰痛評価モジュール実装）待機中。

### Phase 0（完了）: 設計・全体基盤整理

| # | タスク | ステータス |
|---|---|---|
| P0-1 | SPEC.md / SHEET_DESIGN.md / LOGIC.md / COMMENT_DESIGN.md / CLINICAL_OPERATION.md 作成 | ✅ 完了 |
| P0-2 | gas/setup_sheets.js（腰痛モジュール GAS雛形）作成 | ✅ 完了 |
| P0-3 | JASSESS-01 / msk-assessment-platform へ再整理・全体基盤構造化 | ✅ 完了 |
| P0-4 | DESIGN_DECISIONS.md（設計判断の記録）作成 | ✅ 完了 |
| P0-5 | modules/low-back/README.md（腰痛モジュール仕様）作成 | ✅ 完了 |

### Phase 1: 腰痛評価モジュール実装（待機中）

| # | タスク | ステータス |
|---|---|---|
| P1-1 | setup_sheets.js を Apps Script エディタで実行 → 8シート生成 | ⏸ 待機 |
| P1-2 | スプレッドシートID取得 → PROJECT_STATUS.md 更新 | ⏸ 待機 |
| P1-3 | 基本入力動作確認（プルダウン・赤旗アラート・自動計算） | ⏸ 待機 |
| P1-4 | 判定ロジックシートの数式実装（LOGIC.md 腰痛固有ロジック） | ⏸ 待機 |
| P1-5 | コメントマスタ充填（COMMENT_DESIGN.md の全テンプレ） | ⏸ 待機 |
| P1-6 | onEdit トリガー実装 → コメント自動生成 | ⏸ 待機 |
| P1-7 | saveToHistory() の必須項目バリデーション強化 | ⏸ 待機 |
| P1-8 | 実臨床テスト（5症例以上） | ⏸ 待機 |
| P1-9 | 評価基準・コメントの微調整 | ⏸ 待機 |

### 将来フェーズ（拡張モジュール）

| フェーズ | 内容 | 着手条件 |
|---|---|---|
| Phase 2 | 頸部・肩こり評価モジュール（modules/neck-shoulder/） | Phase 1 実臨床テスト完了後 |
| Phase 3 | 膝慢性痛評価モジュール（modules/knee/） | Phase 2 完了後 |
| Phase 4a | 姿勢評価モジュール（modules/posture/） | Phase 3 完了後 |
| Phase 4b | 高齢者機能・移乗評価モジュール（modules/elderly-function/） | Phase 3 完了後 |
| Phase 5 | Claude API連携 → AI判定層実装 | Phase 1〜2 実臨床データ蓄積後 |
| Phase 6 | タブレット入力UI最適化 | Phase 5 完了後 |

---

### トレーニングプログラムプラットフォーム `training-program-platform-jp/`

**位置づけ:** トレーニングプログラムを継続的に追加していくプラットフォームとして育てる想定。単発アプリではなく、複数プログラムを提供・管理する基盤として設計する。

**現状:** フェーズ A（MVP 基盤）・フェーズ B Step 1（Auth 基盤）・Step 2（アプリ側 owner guard）完了（2026-04-12）。アプリ側では本人しか触れない制限まで実装・live 確認済み。DB 側の NOT NULL 化と RLS 適用が次ステップ。

#### フェーズ A — MVP 基盤（完了）

| # | タスク | ステータス |
|---|---|---|
| A-1 | Next.js App Router + Supabase 基盤構築 | ✅ 完了 |
| A-2 | Programs 一覧 / 詳細（Supabase DB 読込） | ✅ 完了 |
| A-3 | Train 画面（セット記録・完了・削除・追加・交換） | ✅ 完了 |
| A-4 | Workout Summary（セッション完了後の結果画面） | ✅ 完了 |
| A-5 | Program Day → Session 開始 MVP（StartSessionScreen） | ✅ 完了 |
| A-6 | program_enrollments 実装（find-or-create / Day 進行） | ✅ 完了 |
| A-7 | live Supabase E2E 検証（GZCLP Base 通し確認） | ✅ 完了 |
| A-8 | Next.js fetch cache 問題修正（`cache: no-store`） | ✅ 完了 |

#### フェーズ B — 認証・本番整備（進行中）

**3ステップで段階的に実施。Step 1・2 完了済み。**

| # | タスク | ステータス |
|---|---|---|
| B-1 | **[Step 1]** Supabase Auth 整備（login 画面・middleware・`auth→public.users` trigger） | ✅ 完了 |
| B-2 | **[Step 2]** アプリ側 owner guard（finish / summary / set mutation を本人限定・他人は 404） | ✅ 完了 |
| B-3 | **[Step 3]** `workout_sessions.user_id` / `program_enrollments.user_id` を NOT NULL に復元 | 🔄 migration 適用済み・live 手動確認待ち |
| B-4 | **[Step 3]** RLS（Row Level Security）設計・適用 | 🔄 migration 適用済み・live 手動確認待ち |
| B-5 | Add Exercise / Swap Exercise の live clickthrough 補完確認 | 🔄 コードレビュー完了・live ブラウザ操作待ち |
| B-6 | sign up 429 エラー（`over_email_send_rate_limit`）の再確認 | ⏸ 待機（外部レート制限が解消次第） |
| B-7 | Exercise History の auth 対応（user_id 絞り込み強化） | ⏸ 待機（B-3 以降） |

#### 公開判断の段階

> 感覚ではなく条件で判断する。

**限定公開してよい条件（招待制・知人のみ）:**

| 条件 | 説明 |
|---|---|
| B-3 / B-4 完了 | `user_id NOT NULL` + RLS 適用済み |
| sign up 動作確認 | 新規ユーザーが実際に登録できることを確認（B-6 解消） |
| B-5 完了 | Add Exercise / Swap Exercise が auth 状態で正常動作することを確認 |
| 基本エラー表示 | 認証エラー・not found・server error がユーザーに適切に表示される |

**一般公開してよい条件（URL 公開・不特定多数）:**

| 条件 | 説明 |
|---|---|
| 限定公開を一定期間運用して問題なし | 最低 1 プログラムで複数ユーザーが実際に使えていること |
| パスワードリセット機能 | Supabase Auth の magic link / reset を実装済み |
| 複数プログラム掲載 | GZCLP 以外に最低 1 プログラムを追加済み |
| プライバシー・利用規約 | 最小限の掲載（Supabase ホスト前提の基本文） |

#### フェーズ C — プラットフォーム拡張（将来）

**方針:** 管理画面を先に作らず、まず SQL / seed ベースでプログラムを追加していく。管理画面は運用負荷が増えた段階で後続フェーズとして判断する。

| # | タスク | 内容 | ステータス |
|---|---|---|---|
| C-1 | プログラム追加フロー整備 | SQL seed ファイルの書き方・slug 採番ルール・`is_public` フラグの運用を文書化 | ⏸ 待機 |
| C-2 | 2本目以降のプログラム登録 | Starting Strength / GZCLP LP 等の seed 作成（データ登録中心） | ⏸ 待機 |
| C-3 | プログラム難易度・タグ管理 | `programs.level` / タグ検索・フィルタ UI | ⏸ 待機 |
| C-4 | ユーザー進捗ダッシュボード | セッション履歴・完了プログラム・次 day 表示 | ⏸ 待機 |
| C-5 | 管理画面（後続フェーズ候補） | プログラム CRUD・ユーザー管理（運用負荷が増えた段階で判断） | ⏸ 将来検討 |

#### 技術スタック

- Next.js 14 App Router + TypeScript
- Supabase PostgreSQL（programs / program_enrollments / workout_sessions 他）
- Supabase Auth（sign in / sign up / session cookie）
- `lib/supabase/server.ts` — `cache: no-store` 設定済み（Next.js 14 fetch cache 対策）
- seed: `seed/programs/gzclp-base.sql`（GZCLP Base 3週 × 3日）
- 設計ドキュメント: `docs/auth-rls-design.md`（Phase B 実装順・RLS 設計）

---

最終更新: 2026-04-13（B-3/B-4 migration 適用済み / B-5 コードレビュー完了）
