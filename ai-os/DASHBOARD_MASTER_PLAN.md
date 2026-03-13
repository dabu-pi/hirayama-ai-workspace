# DASHBOARD_MASTER_PLAN.md — Hirayama AI OS ダッシュボード 全体設計書

> 本ドキュメントはダッシュボードプロジェクトの**設計判断・全体構造・完成条件を記録するマスタードキュメント**。
> AIセッション引き継ぎ・設計レビュー・フェーズ判断の基準として使用する。
>
> 作成: 2026-03-08 | 最終更新: 2026-03-08（Phase 1 構造タスク全完了・ドロップダウン検証・KPIヘッダー追加済み）

---

## 1. プロジェクトの目的

接骨院経営・設備販売・廃棄物収集の複数プロジェクトにまたがる **AI開発・業務自動化活動を、1画面で把握・制御・記録できる状態にすること**。

### なぜこのダッシュボードが必要か

| 問題 | 解決策 |
|---|---|
| AIセッションをまたいで状態が失われる | Run_Log・Task_Queue・PROJECT_STATUS.md で状態を保持する |
| 複数プロジェクトの優先順位が曖昧になる | Projects・Task_Queue シートで優先度を可視化する |
| アイデアや課題が揮発する | Ideas シートにすべて記録する |
| 進捗が体感的で数値化されていない | Metrics・Avg Progress で定量化する |
| ChatGPT / Claude Code の役割分担が不明確 | 本ドキュメントで役割分担を定義し、都度参照する |

---

## 2. ダッシュボードの役割

Google スプレッドシート「Hirayama_AI_OS_Dashboard」は **Hirayama AI OS の実行面** であり、以下4つの役割を担う。

| 役割 | 内容 |
|---|---|
| **コントロールパネル** | 全プロジェクトの状態を1画面で把握する（Dashboard シート） |
| **タスク管理台帳** | 直近の実行キューを可視化し、AIと人間の作業分担を明確にする（Task_Queue） |
| **記憶装置** | セッション間の引き継ぎ情報・実行履歴を蓄積する（Run_Log） |
| **アイデアバンク** | 揮発しやすいアイデア・改善案を収集・評価・分類する（Ideas） |

---

## 3. 7シートの責務一覧

| # | シート | 責務 | 更新者 | 更新頻度 |
|---|---|---|---|---|
| 1 | **Dashboard** | 全体俯瞰・KPI表示・読み取り専用コントロールパネル | 数式のみ（直接入力禁止） | 自動（数式連動） |
| 2 | **Lists** | 全語彙の Single Source of Truth。ドロップダウン値の一元管理 | 人間のみ | 新語彙追加時のみ |
| 3 | **Projects** | 全6プロジェクトの状態・進捗・フェーズ管理 | 人間のみ | 週1〜フェーズ変化時 |
| 4 | **Ideas** | アイデア収集・評価・パーキングロット | 人間のみ | アイデア発生時 |
| 5 | **Task_Queue** | 直近1〜2週間のタスク管理。AI+人間の協調作業 | 人間 + Claude | セッション開始/終了時 |
| 6 | **Run_Log** | 実行履歴・監査証跡の時系列記録（追記専用） | 手動（将来GAS） | セッション終了時 |
| 7 | **Metrics** | KPI・定量指標の集計と業績数値の追跡 | 数式 + 人間 | 週次/月次 |

---

## 4. データの流れ

### Phase 1（現在: 手動フロー）

```
[作業発生（AI/人間）]
       │
       ▼
[Claude Code で実装 / Claude Desktop で設計]
       │
       ├──→ タスク完了 → Task_Queue を人間が更新（status → 完了）
       │
       ├──→ ログ記録  → Run_Log に人間が1行追記
       │
       ├──→ 進捗変化  → Projects の Progress % を更新
       │
       ├──→ アイデア発生 → Ideas に登録
       │
       └──→ 月次集計  → Metrics に業績数値を入力
                 │
                 └──→ Dashboard が数式で自動集約（常時最新）
```

### Phase 2 以降（自動化フロー）

```
[de コマンド実行（作業終了）]
       │
       ▼
[GASスクリプトが workspace/logs/ を読み取り]
       │
       └──→ Run_Log に自動書き込み（1行追記）
```

---

## 5. 役割分担

| アクター | 担当範囲 | 使用シート |
|---|---|---|
| **人間** | 最終意思決定・手動データ入力・スプレッドシート直接編集 | Lists / Projects / Ideas / Task_Queue / Run_Log / Metrics |
| **Claude Code** | コード実装・ドキュメント更新・Task_Queue のタスク状態更新・コミット | Task_Queue（状態更新のみ） |
| **Claude Desktop** | 設計相談・レビュー・ドキュメント作成・提案 | ローカルファイル（ai-os/） |
| **GAS**（将来 Phase 2） | Run_Log への自動書き込みのみ | Run_Log（追記専用） |
| **GitHub** | コード管理・変更履歴・ブランチ管理 | 外部（リポジトリ） |
| **ChatGPT**（将来 Phase 3） | 週次サマリ生成・KPI分析 | 読み取りのみ（予定） |

---

## 6. フェーズ構成

| フェーズ | 名称 | 到達目標 | 状態 |
|---|---|---|---|
| **Phase 1** | 手動運用基盤確立 | 7シート整備・手動更新フロー確立・ドキュメント整合化 | **進行中**（2026-03-06〜） |
| **Phase 2** | GAS自動連携 | Run_Log自動書き込み・ドロップダウン検証設定 | 未着手 |
| **Phase 3** | Claude API統合 | 週次サマリ自動生成・KPI異常検知 | 未着手 |
| **Phase 4** | 完全自動化ループ | 設計→実装→テスト→ログの自動ループ | 構想段階 |

---

## 7. 現在の課題（2026-03-08 監査時点）

| 優先度 | 課題 | 内容 | 担当 |
|---|---|---|---|
| ✅ 完了 | Metrics 計算誤り修正 | 「200%」誤り修正済み（2026-03-08） | ✅ |
| ✅ 完了 | Lists 列ヘッダー追加 | Row 1 に語彙グループ名追加済み（2026-03-08） | ✅ |
| ✅ 完了 | AIOS-06 登録 | Projects シートに 6件目として登録済み（2026-03-08） | ✅ |
| 🟡 中 | Dashboard 数式参照（詳細） | 参照方式確認済み。完全自動参照か手入力かの詳細は残課題 | 人間 |
| ✅ 完了 | ドロップダウン検証設定 | Projects（Type/Status/Phase）/ Task_Queue（Project/Type/Priority/Status/Assigned To）設定済み（2026-03-08） | ✅ |
| ✅ 完了 | Metrics 業績KPI 行ヘッダー追加 | A13:Business KPI〜A19:Profit まで追加済み（2026-03-08）。数値入力は 4月以降 | ✅ |
| 🟡 中 | Run_Log 記録の習慣化 | 手動記録フロー開始済み（2026-03-08〜）。2週間継続（〜2026-03-22）が目標 | 人間 |
| 🟡 中 | Dashboard 数式参照（詳細） | 参照方式確認済み。QUERY/FILTER の完全自動参照かどうかの詳細は未確認 | 人間 |

---

## 8. 安全ルール

以下のルールは `workspace/CLAUDE.md` の全体規則に追加して適用する。

| ルール | 内容 |
|---|---|
| **Dashboard 直接入力禁止** | Dashboard シートへのデータ直接入力は禁止。数式・参照セルのみで構成する |
| **Lists 変更の文書化** | Lists の語彙値を変更した場合は `dashboard-schema.md` のスキーマ変更履歴にも記録する |
| **Run_Log 削除禁止** | 過去の Run_Log 行は削除・上書きしない。追記専用 |
| **GAS書き込み境界** | GASの書き込みは Run_Log と Metrics のみ許可。他シートへの書き込みは禁止 |
| **ai-os/ 外不変** | ai-os ディレクトリ作業時は、ai-os/ 外のソースコードを変更しない |
| **自動実行禁止（Phase 1）** | Phase 1 ではすべてのスクリプト実行を手動起動に限定する |
| **スキーマ変更は文書化** | dashboard-schema.md を変更する際は変更理由と日付を必ず記録する |

---

## 9. 完成条件

### Phase 1 完成条件（手動運用基盤）

- [x] Projects シートに 6件全プロジェクト登録済み（AIOS-06 含む）✅ 2026-03-08
- [x] Lists シートに列ヘッダー追加済み ✅ 2026-03-08
- [x] Metrics シートの計算誤り修正済み ✅ 2026-03-08
- [x] Task_Queue・Projects の各セルにドロップダウン検証設定済み ✅ 2026-03-08
- [ ] Dashboard シートの数式参照（QUERY/FILTER）が正しく動作している（詳細未確認）
- [ ] Run_Log に毎セッション終了後 1行追記する習慣が確立している（2026-03-08 開始・継続中）
- [ ] 手動更新フローを 1〜2 週間継続できている（〜2026-03-22 目標）

### Phase 2 完成条件（GAS自動連携）

- [ ] `de` コマンド実行時に Run_Log に自動で 1行追記される GAS スクリプトが稼働
- [ ] スクリプトは Run_Log への追記のみに限定されている（他シート書き込みなし）

### 全体完成の判断基準

毎朝ダッシュボードを開いて「どのプロジェクトが何の状態にあり、今日何をすべきか」が **30秒以内に判断できる** こと。
## 2026-03-13 Projects Handling Update

- `JREC-01` is the current center project for patient / visit operations and its
  main sheet is `【毎日記録】来店管理施術録ver3.1`.
- `WEB-03` is no longer treated as an active project. Keep it visible only as a
  migration target to `JREC-01` and as an archive candidate.
- `WST-05` should be managed with `workspace/waste-report-system` as the
  canonical local folder path.
- `AINV-07` remains a registration candidate until the Dashboard Projects row is
  added or confirmed.
