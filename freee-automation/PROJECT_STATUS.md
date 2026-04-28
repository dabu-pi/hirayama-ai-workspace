# PROJECT_STATUS.md — freee見積自動化

更新日: 2026-03-06

> このファイルはプロジェクトの現在地を1ファイルで把握するためのリファレンスです。
> Claude が再開時に最初に読むファイルとして機能します。
> 詳細仕様は `spec.md` を参照してください。

---

## Project Summary

`hawk@pop13.odn.ne.jp`（長谷川さん）からの見積依頼メールを起点に、以下を自動化する GAS プロジェクト。

| フェーズ | 内容 | 状態 |
|---|---|---|
| Phase1 | 見積依頼メールをスプレッドシートに記録 | ✅ 稼働中 |
| Phase2 | freee で見積書を作成し R列に quotation_id を記録 | ✅ 稼働中 |
| Phase3 | Gmail に返信下書きを作成し U列に実行日時を記録 | ✅ 実装完了・テスト済み |
| Phase4 | エラー通知・取引先マスタ整備 | ⬜ 未着手 |

**自動化の到達点:** Gmail 下書き作成まで。送信は人が行う。

---

## Current Status

- Phase1 / Phase2 / Phase3 コード実装完了
- Phase3: `phase3_testDraft()` で専修大学様宛の下書き作成を確認済み（2026-03-06）
- `phase3_createDraftsForQuotedRows`（本番一括処理）は未実行
- freee 時間トリガー（`freee_runAll`）は未設定

---

## Scope

### 対象メール

- 送信元: `hawk@pop13.odn.ne.jp`
- 件名: 「見積」「見積依頼」「作成お願いします」のいずれかを含む
- 対象外件名: ラベル付与のみ、シート記録なし

### 自動化の範囲（明示的な除外）

| 項目 | 扱い |
|---|---|
| メール送信 | **自動化しない**（下書き保存まで） |
| PDF 取得・添付 | **自動化しない**（人が手動で行う） |
| freee への本番 POST | 確認ステップを経て実行 |

---

## Completed

- [x] Phase1: 対象メール検知 → シート記録（B/C/D/E/O列）+ ラベル付与
- [x] Phase2: メール情報から freee 見積書を POST → R列に quotation_id 記録
- [x] Phase3: R列あり・U列空の行に対して Gmail 返信下書きを作成 → U列に実行日時記録
- [x] 宛名正規化: `p3_normalizeName_()` — 末尾が「様」なら追加しない
- [x] PDF 取得廃止: freee IV API が PDF 非対応であることを確認し、手動運用に切り替え
- [x] 二重処理防止: Gmail ラベル付与 + シートへの Message-ID 保存

---

## In Progress

- [ ] `phase3_createDraftsForQuotedRows` の本番実行（U列書き込み確認）

---

## Pending / Backlog

- [ ] freee 時間トリガー設定（`freee_runAll` を 5〜15分ごと）
- [ ] Phase4: エラー通知（Slack または メール）
- [ ] Phase4: 取引先マスタ整備（顧客名 → freee partner_id の対応表）
- [ ] Phase4: 定型品目マスタ整備
- [ ] 重複検知の強化（同一顧客・同一件名）

---

## Operational Flow

```
hawk@pop13.odn.ne.jp がメール送信
         │
         ▼
[Phase1] メール検知（5〜15分トリガー）
  ├─ シートに B/C/D/E/O 列を記録
  └─ Gmail ラベル付与（処理済みマーク）
         │
         ▼
[Phase2] freee 見積書作成（freee_phase2_processPendingQuotations）
  ├─ R列に quotation_id を記録
  ├─ G列に見積日を記録
  └─ 失敗時は T列に「要確認（理由）」を記録
         │
         ▼
[Phase3] Gmail 返信下書き作成（phase3_createDraftsForQuotedRows）
  ├─ R列あり・U列空 の行を対象
  ├─ 返信本文（宛名正規化済み）を生成
  ├─ Gmail スレッドに下書きを保存（絶対に送信しない）
  └─ U列に実行日時を記録
         │
         ▼
[人間] Gmail 下書きを確認
  ├─ freee から PDF を手動ダウンロード
  ├─ 下書きに PDF を手動添付
  └─ 送信
```

---

## Safety Rules

1. **送信しない** — Phase3 は `thread.createDraftReply()` のみ。`sendReply()` は使わない。
2. **二重処理しない** — U列に日時が入っている行はスキップ。Message-ID をシートに保存して冪等性を担保。
3. **PDF 自動添付しない** — freee IV API は PDF ダウンロード非対応。人が手動で行う。
4. **freee への自動 POST は確認後に行う** — 本番実行前にテスト関数で動作確認。

---

## File Map

```
freee-automation/
├── PROJECT_STATUS.md        # このファイル（現在地・運用ルール）
├── spec.md                  # 詳細仕様（確定ルール・履歴）
└── src/
    ├── hawkメール自動貼り付け.js   # Phase1: メール検知・シート記録
    ├── freee請求書作成.js          # Phase2: freee 見積書作成・CFG定義
    └── phase3_下書き作成.js        # Phase3: Gmail 下書き作成
```

**GAS プロジェクト設定:**

- `.clasp.json`: `src/` 配下に配置（gitignore 対象・PC固有）
- スクリプト ID: `194kDwfuLoTJ_xUgI1xfBb6KJ74MSR1sOPHvIpgycnZbygJy_RrtWqsKj`

**スプレッドシート:**

- URL: `https://docs.google.com/spreadsheets/d/1TMKQO4zYwk1kWgkfoCR4K7jTeIxNxsS1B8uh7t8nd2c/edit?gid=382885172`
- シート名: `2024長谷川さん`

---

## Main Functions

| 関数名 | ファイル | 役割 | トリガー |
|---|---|---|---|
| `phase1_processHawkEmails` | hawkメール自動貼り付け.js | Phase1 本番 | 時間トリガー |
| `freee_phase2_processPendingQuotations` | freee請求書作成.js | Phase2 本番 | 手動 or freee_runAll |
| `freee_runAll` | freee請求書作成.js | Phase2+3 連続実行 | 時間トリガー（予定） |
| `phase3_createDraftsForQuotedRows` | phase3_下書き作成.js | Phase3 本番 | 手動 or freee_runAll |
| `phase3_testDraft` | phase3_下書き作成.js | Phase3 テスト（U列更新なし） | 手動 |
| `phase3_diagnosePdf` | phase3_下書き作成.js | PDF API 診断（デバッグ用） | 手動 |

---

## Column Map（スプレッドシート）

| 列 | 変数名 | 内容 | 自動/手動 |
|---|---|---|---|
| A | `COL_MESSAGE_ID` | Gmail Message-ID (RFC 822) | 自動 |
| B | `COL_CUSTOMER_NAME` | お客様名 | 自動 |
| C | — | 発生日（受信日） | 自動 |
| D | `COL_DESC` | 取引の内容 | 自動 |
| E | — | 長谷川（固定値） | 自動 |
| G | — | 見積をした日 | 自動 |
| O | `COL_MAIL_LINK` | Gmail スレッドへの HYPERLINK | 自動 |
| P | `COL_FREEE_PARTNER_ID` | freee 取引先 ID | 自動（解決失敗時は手動） |
| Q | `COL_LINES_JSON` | 明細 JSON | 自動（失敗時は手動） |
| R | `COL_FREEE_QUOTATION_ID` | freee 見積書 ID | 自動（Phase2 成功時） |
| T | `COL_CHECK_REQUIRED` | 要確認フラグ | 自動 |
| U | `COL_DRAFT_CREATED_AT` | 下書き作成日時 | 自動（Phase3 成功時） |

---

## Recent Decisions

| 日付 | 決定事項 |
|---|---|
| 2026-03-13 | 集計行除外ロジック追加: `isSummaryLine_()` を実装し `parseLinesJson_()` でフィルタ（小計・消費税・合計・税込合計・税額・総額など） |
| 2026-03-13 | G列リンク化: 見積作成成功時に `HYPERLINK("https://invoice.secure.freee.co.jp/reports/quotations/{id}","yyyy/MM/dd")` 形式で書き込み（URL修正2回: 最終確定 `invoice.secure.freee.co.jp/reports/...`） |
| 2026-03-13 | Phase1 skipWords 追加: `extractLinesJsonFromBody_()` に `税込合計`・`総額`・`税込`・`税抜`・`内税`・`外税` を追加 |
| 2026-03-06 | PDF 自動取得廃止（freee IV API は PDF 非対応: status 200 だが Content-Type が JSON） |
| 2026-03-06 | 返信本文テンプレートを刷新（freee URL 記載なし、PDF 手動添付の運用に変更） |
| 2026-03-06 | 宛名正規化 `p3_normalizeName_()` を実装（「様」の重複防止） |
| 2026-03-06 | T列 = 要確認フラグ（COL_CHECK_REQUIRED）、U列 = 下書き作成日時 を確定 |
| 2026-03-06 | 自動化トリガー条件確定: 件名に「見積」「見積依頼」「作成お願いします」のいずれかを含む |

---

## Next Actions

優先順に並べる。

1. **Phase3 本番実行**
   - GAS エディタで `phase3_createDraftsForQuotedRows` を実行
   - U列に日時が書き込まれることを確認
   - Gmail 下書きボックスに下書きが保存されていることを確認

2. **freee 時間トリガー設定**
   - `freee_runAll` を 5〜15分ごとに設定
   - GAS エディタ → トリガー → 時間ベースのトリガーを追加

3. **Phase4 着手**
   - エラー通知（Slack または メール）の実装
   - 取引先マスタ整備（P列の自動解決精度を上げる）

---

## Restart Cue

Claude が再開時にこのファイルを読んだ後、確認すべき順序:

```
1. このファイル（PROJECT_STATUS.md）で現在地を把握
2. spec.md の「確定仕様」「CLAUDE WORK LOG」を確認
3. freee請求書作成.js の CFG 定数（列番号・エンドポイント）を確認
4. phase3_下書き作成.js の P3 定数・公開関数を確認
5. スプレッドシートの最終行を確認して処理済み / 未処理を把握
```

**再開時の典型的な質問と答え:**

| 質問 | 答え |
|---|---|
| Phase3 は動いているか？ | テスト済み。本番一括実行（`phase3_createDraftsForQuotedRows`）が未実行 |
| PDF はどう扱う？ | 自動取得しない。人がfreeeから手動DLしてGmail下書きに添付 |
| 送信は自動化する？ | しない。下書き保存まで |
| U列に何が入る？ | Phase3 成功時の実行日時（`yyyy/MM/dd HH:mm` 形式） |
| T列に何が入る？ | 要確認フラグ（例: `要確認（明細不足）`）。問題なければ空 |
| テストは安全か？ | `phase3_testDraft` は U列を更新しない。Gmail に下書きは残るので不要なら削除 |
