# JREC-01 柔整保険申請書 Ver3.1 — プロジェクトステータス

最終更新: 2026-05-06 (WEB-2.5 完了・スマホ実機確認待ち)  
担当: dabu-pi  
ブランチ: `feature/auto-dev-phase3-loop`

---

## 現在の状態

**稼働中 + WEB-1 / WEB-2 / WEB-2.5 完了**

スプレッドシート運用は継続中。  
Web UI から来院記録の登録・候補金額算定まで実装済み（needCheck=TRUE / 要確認）。

### 次のアクション

**→ 現場スマホ実機確認（チェックリスト: `docs/WEB25_SMARTPHONE_FIELD_CHECK_2026-05-06.md`）**

実機確認完了後に以下を判断:
- デフォルト URL を `page=home` に変更するか
- WEB-2.5.1（施術明細自動生成）に進むか

---

## 実装フェーズ一覧

| フェーズ | 内容 | 状態 |
|---|---|---|
| WEB-1 | Web UI 入口・患者詳細・home 画面 | ✅ 完了 |
| WEB-2 | Web UI 来院登録（金額=0・要確認） | ✅ 完了 |
| WEB-2.5 | Web UI 来院登録 × 候補金額算定 | ✅ 完了 |
| スマホ実機確認 | 現場スマホでの動作確認 | ✅ Playwright mobile PASS / 実機確認待ち |
| WEB-2.5.1 | 施術明細自動生成 | 📋 未着手 |
| WEB-3 | 施術録・申請書生成 | 📋 未着手 |

---

## Phase WEB-1 実装内容（2026-05-05）

### 新規追加ファイル

| ファイル | 内容 |
|---|---|
| `web-home.html` | Web ナビゲーションハブ（カード形式） |
| `web-patient-detail.html` | 患者詳細・来院履歴の読み取り専用画面 |
| `docs/WEB_UI_MIGRATION_PLAN_2026-05-05.md` | Web UI 移行計画 Markdown |

### Ver3_core.js 変更内容

| 変更種別 | 内容 |
|---|---|
| `doGet(e)` 拡張 | `page=home` / `page=detail` ルート追加（既存ルートは変更なし） |
| 新関数追加 | `getPatientDetail_V3(patientId)` — 患者基本情報 + 来院履歴10件返却 |

### patientSearch.html 変更内容

- 「患者詳細を見る」ボタンを選択後パネルに追加（`?page=detail&patientId=xxx` へのリンク）

---

## doGet ルーティング（現在）

| `page=` | HTML | 状態 |
|---|---|---|
| `search`（デフォルト） | `patientSearch.html` | 稼働中 |
| `selfpay` | `selfPayWeb.html` | 稼働中 |
| `home` | `web-home.html` | WEB-1 追加 |
| `detail` | `web-patient-detail.html` | WEB-1 追加 |

---

## 既存スプレッドシート運用への影響

**影響なし**

- 既存シート構造は変更していない
- 既存 GAS 関数は変更していない（doGet の既存ルートも変更なし）
- スプレッドシート操作（保存・帳票出力）は従来通り動作する

---

## Phase WEB-1B 入口整理・設計固め（2026-05-05）

### 実施内容

| 項目 | 内容 |
|---|---|
| `patientSearch.html` | 「← Web ホームへ」リンクを追加（最小差分） |
| デフォルト URL 方針 | `page=search` のまま維持（変更しない） |
| 設計 Markdown 作成 | `docs/PHASE_WEB2_VISIT_CREATE_DESIGN_2026-05-05.md` |

### デフォルト URL をまだ変更しない理由

`patientSearch.html` → `selfPayWeb.html` はスマホ実地テスト済みの稼働導線。
`web-home.html` は実機未確認のため、デフォルトに変更すると既存運用が止まるリスクがある。
条件リスト（PHASE_WEB2 設計 §8）が揃ったタイミングで変更する。

### `saveVisitFromWeb_V3` が必要な理由

既存の `saveVisit_V3` はスプレッドシートの患者画面シート（C2, B4, A12:H13 等）からデータを読むため、
Web App の google.script.run から呼んでも意図した値が読めない。
JSON 引数で受け取る専用関数 `saveVisitFromWeb_V3(payload)` を新規実装する必要がある。

### `setPatientAndDate_V3` を Web 保存処理に流用しない理由

B2（患者表示名）と B4（来院日）を **シートに書き込む副作用** がある。
Web セッションと並行してスプレッドシートを開いている場合に干渉する。
Web UI からの来院登録では、シートを経由しない保存経路（`saveVisitFromWeb_V3`）を使う。

### 次の実装候補（Phase WEB-2）

```
1. getPrevVisitData_V3(patientId)  ← 前回来院データ JSON 返却
2. web-visit-new.html              ← 来院登録フォーム
3. doGet に page=visitNew 追加
4. saveVisitFromWeb_V3(payload)    ← 来院登録保存（UIシート非依存）
5. web-patient-detail.html に「来院記録を追加」ボタン
```

---

## Phase WEB-1 後 既存 Web UI 棚卸し（2026-05-05）

詳細は `docs/WEB_UI_EXISTING_INVENTORY_2026-05-05.md` 参照。

### 棚卸し結果サマリ

- 既存稼働中導線: `patientSearch.html` → `selfPayWeb.html`（スマホ操作・実地テスト済み）
- Phase WEB-1 の位置づけ: **部分延長 + 部分並列**
  - 延長: `patientSearch.html` に「患者詳細を見る」追加
  - 並列: `web-home.html` は `?page=home` 指定でのみアクセス可能（デフォルト URL は変更なし）
- 既存スプレッドシートUI専用関数（Web から直接呼べない）: `saveVisit_V3`, `autofillFromPreviousVisit_V3`, `openSelfPayDialog_V3`

### Phase WEB-2 前に決めること

1. **デフォルト URL の方針**（`web-home.html` をデフォルトにするか）
2. **来院登録の設計**（`saveVisitFromWeb_V3` 新関数の引数・バリデーション方針）
3. **実機確認**（`web-home.html` / `web-patient-detail.html` の動作確認）

### Phase WEB-2 で必要な新関数

| 関数 | 役割 |
|---|---|
| `saveVisitFromWeb_V3(params)` | JSON 引数で来院登録（`saveVisit_V3` の Web 版） |
| `getPrevVisitData_V3(patientId, treatDate)` | 前回来院データの JSON 返却 |

---

## Phase WEB-2.5 調査・設計（2026-05-06）

**ステータス: 実装完了 / LiveCheck 5 PASS**

設計書: `docs/WEB25_AMOUNT_CALCULATION_DESIGN_2026-05-06.md`

### 調査結論

| 確認事項 | 結論 |
|---|---|
| `calcHeaderAmountsByVisitKey_V3_` を Web から呼べるか | ✅ 全シート読み取りのみ・UIシート依存なし |
| `calcEpisodeForCase_` を Web から呼べるか | ✅ 来院ケースのみ読み取り・UIシート依存なし |
| `saveVisit_V3` のロジックを流用できるか | △ UIシート部分を除外し、算定関数のみ再利用 |
| kubun を自動判定できるか | ✅ `calcEpisodeForCase_` で30日ルール準拠 |
| 施術明細・初検情報履歴の書き込みが必要か | △ MVP では省略可能（needCheckReason で記録） |

### WEB-2.5 実装内容（2026-05-06）

| 実装 | 結果 |
|---|---|
| `saveVisitFromWeb_V3` 改修: kubun を `calcEpisodeForCase_` で自動判定 | ✅ 完了 |
| `saveVisitFromWeb_V3` 改修: `calcHeaderAmountsByVisitKey_V3_` で候補金額算定 | ✅ 完了 |
| 来院ヘッダに候補金額保存（needCheck=true + 理由付き） | ✅ 完了 |
| `web-visit-new.html` 成功画面に候補金額表示 | ✅ 完了 |
| LiveCheck（W2.5-1〜5 全 PASS） | ✅ 完了 |
| clasp push | ✅ 完了 |

**LiveCheck テスト visitKey:** `hirayamaka_2999-12-31`

### テストデータ確認結果（2026-05-06）

| 確認項目 | 結果 |
|---|---|
| 来院ヘッダ存在 | ✅ 確認済み |
| 来院合計 ¥2,410 | ✅ 確認済み |
| needCheck=TRUE | ✅ 確認済み |
| 区分 = 初検（自動判定） | ✅ 確認済み |
| 削除 | ✅ 削除確認済み（W2.5-4 新規保存 PASS で確認） |

**削除確認済み:** W2.5-4 が「新規保存 PASS」（✅）になったことで、  
元のテストデータが正常に削除されていたことを確認。  
削除後の保存で来院合計 ¥2,410・区分 初検（自動判定）が正常動作。

W2.5-4 の実行により `(検証用実在ID)_2999-12-31` が再作成されています。  
引き続きスプレッドシートで削除可能（施術日 2999-12-31 の行）。

**WEB-2.5 LiveCheck 全テスト: 5 passed / 0 failed**
- W2.5-1: kubun 未選択でモーダルが開く ✅
- W2.5-2: 「システムが自動判定」モーダル表示 ✅
- W2.5-3: 「請求確定ではありません」警告表示 ✅
- W2.5-4: 新規保存 PASS（削除確認） ✅
- W2.5-5: 二重保存防止 DUPLICATE_VISIT ✅

### 実装後の動作仕様

- kubun は `calcEpisodeForCase_`（30日ルール）で自動判定（user input は参考のみ）
- 来院ヘッダに候補金額（initFee / reFee / visitTotal / windowPay / claimPay）を記録
- `needCheck=true` は常に維持
- `needCheckReason` = "Web UI 登録;（算定抑制理由）;施術明細未記録（Web MVP）;（初検時: 初検情報履歴未記録）"
- 成功画面: visitKey / 区分（自動判定）/ 来院合計 / 窓口負担 / 保険請求 / 要確認理由を表示

### 実装前オーナー確認事項

| 確認 | 内容 |
|---|---|
| A | Web 登録の needCheck=true を月次申請前に必ず確認する運用を合意 |
| B | 施術明細なしヘッダが既存処理に影響しないこと |
| C | Web 登録の kubun を後変更する手順（`saveVisit_V3` で上書き可） |
| D | W2.5 テスト実施時のデータ削除手順 |

---

## Phase WEB-2 実装内容（2026-05-06）

### 追加ファイル

| ファイル | 内容 |
|---|---|
| `web-visit-new.html` | 来院記録登録フォーム（WEB-2 新規） |
| `docs/WEB1_LIVECHECK_2026-05-06.md` | WEB-1 コードレビュー LiveCheck 記録 |
| `docs/WEB2_LIVECHECK_2026-05-06.md` | WEB-2 コードレビュー LiveCheck 記録 |

### Ver3_core.js 追加関数

| 関数 | 行番号 | 役割 |
|---|---|---|
| `getPrevVisitData_V3(patientId)` | 5831 | 前回来院データを JSON 返却（読み取りのみ） |
| `findLatestCaseKeyForPatient_(caseSh, caseMap, pid, caseNo)` | 5924 | 最新 caseKey 取得ヘルパー |
| `saveVisitFromWeb_V3(payload)` | 5976 | 来院を来院ケース+来院ヘッダに保存（UI シート非依存） |

### doGet 変更

| page= | HTML | 状態 |
|---|---|---|
| `visitNew` | `web-visit-new.html` | WEB-2 追加 |

### web-patient-detail.html 変更

- 「来院記録を追加 →」ボタンを追加（`?page=visitNew&patientId=xxx` へ遷移）
- 「自費明細入力 →」ボタンは変更なし

### WEB-2 の制約（意図的・スコープ外）

| 制約 | 理由 |
|---|---|
| 金額計算なし（来院合計=0, 要確認=true） | calcVisitAmounts_V3_ はシート依存が深い（WEB-2.5 予定） |
| ケース1のみ（ケース2は未対応） | MVP に不要（WEB-2.5 予定） |
| keikaNow / shoken 入力なし | セル結合の複雑さ（WEB-2.5 予定） |
| 保険算定なし | スプレッドシートで従来通り実施 |

---

## 現在の doGet ルーティング

| `page=` | HTML | 状態 |
|---|---|---|
| `search`（デフォルト） | `patientSearch.html` | 稼働中 |
| `selfpay` | `selfPayWeb.html` | 稼働中 |
| `home` | `web-home.html` | WEB-1 追加（実機未確認） |
| `detail` | `web-patient-detail.html` | WEB-1 追加（実機未確認） |
| `visitNew` | `web-visit-new.html` | WEB-2 追加（実機未確認） |

---

## Playwright LiveCheck 状況（2026-05-06）

**スペック:** `tools/live-check-runner/projects/jyu-gas-ver31/`

| スペック | コマンド | **最終結果** | 備考 |
|---|---|---|---|
| `smoke.spec.ts`（WEB-1 S-1〜S-6） | `npm run test:jyu:smoke` | **26 PASS / 0 FAIL** | 全件 PASS |
| `web2.spec.ts`（WEB-2 W2-1〜W2-8） | `npm run test:jyu:web2` | **16 PASS / 0 FAIL** | 全件 PASS |
| **合計** | `npm run test:jyu` | **42 PASS / 0 FAIL / 0 SKIP** | ✅ 完了 |

### テスト修正一覧（2026-05-06）

| テスト | 原因 | 修正 |
|---|---|---|
| S-3 | `isVisible()` リトライなし → inner iframe 描画前に false | `waitFor({ state: "visible" })` に変更 |
| S-6 | `#loading` が DOM 未ロード時 → `waitFor(hidden)` が即時解決 | `Promise.race` 両腕を `waitFor({ state: "visible" })` に変更 |
| S-6/W2 | `testData.patientId` 未設定 | `find-patient-id.ts` で検証用実在IDを取得・設定 |

**GAS コード変更なし。doGet のデフォルト（page=search）は正常維持。**

### auth 更新手順（次回確認時）

```powershell
# 1. Chrome を remote debugging で起動
$dir = "C:\hirayama-ai-workspace\workspace\tools\live-check-runner\.chrome-profile"
Start-Process "chrome" "--remote-debugging-port=9222 --user-data-dir=`"$dir`""

# 2. Chrome で以下を開く（順番通りに実行）
#    a) https://accounts.google.com でログイン確認（RTS 更新のため必須）
#    b) JYU-GAS dev URL を開き Account Chooser で pinshanka24@gmail.com を選択
#    c) GAS ページが表示されるまで待つ（この確認が重要）

# 3. GAS ページ表示確認後に save-auth
cd C:\hirayama-ai-workspace\workspace\tools\live-check-runner
npm run save-auth

# 4. テスト実行
npm run test:jyu
npm run test:jrec:smoke
```

### testData.patientId が必要なテスト

`projects/jyu-gas-ver31/config.json` の `testData.patientId` に実在 ID を設定後:
- W2-3b, W2-4b, W2-6/7, S-6a/b が PASS になる

---

## 要実機確認（現場スマホ）

**WEB-1:**
1. `?page=home` → ナビゲーション表示
2. `?page=search` → 検索・選択・自費明細リンク動作
3. `?page=detail&patientId=実在ID` → 患者情報・来院履歴表示
4. `?page=detail` → 「来院記録を追加」「自費明細入力」ボタン動作

**WEB-2:**
1. `?page=visitNew&patientId=実在ID` → フォーム表示
2. 「前回引き継ぎ」→ 前回データがセットされる
3. フォーム入力 → 確認モーダル → 登録実行
4. 来院ケースシート・来院ヘッダシートに行が追加されることを確認
5. 来院ヘッダの 要確認=TRUE / 来院合計=0 を確認

---

## 次フェーズ候補

### Phase WEB-2.5
Web 登録後の金額算定と拡張。

- `saveVisitFromWeb_V3` から `calcVisitAmounts_V3_` を呼び出す
- ケース2入力対応
- keikaNow / shoken 入力フォーム

### Phase WEB-3
Web から施術録・申請書生成へ。

- 月次申請対象者一覧
- 申請書プレビュー・生成
- PDF / 印刷導線

---

---

## 設計方針リファレンス

詳細は `docs/WEB_UI_MIGRATION_PLAN_2026-05-05.md` を参照。

### 個人情報ログ禁止フィールド

氏名・住所・電話番号・生年月日・保険者番号・記号番号・被保険者情報

### 算定ルール優先順位（維持）

30日ルール → 月内制御 → 区分確定 → 逓減 → 長期減額
