# JREC-01 Phase 2 Web UI — 患者選択 → シート反映

実装日: 2026-04-22  
実機確認: **PASS（2026-04-22）**  
対象ブランチ: `feature/auto-dev-phase3-loop`

---

## 目的

Phase 1（検索・候補表示）に「行クリック → シート反映」を追加する。  
Web UI から患者を選択すると、来院入力シート（患者画面）の B2・B4 を自動セットする。

---

## 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `Ver3_core.js` | `setPatientAndDate_V3(patientId)` を追加 |
| `patientSearch.html` | 行クリック選択 / `setPatientAndDate_V3` 呼び出し / トースト表示 |

---

## 実装詳細

### `setPatientAndDate_V3(patientId)`

**フロー:**
1. 患者マスタの `検索用` 列（PatientPicker の表示形式: `P0001｜平山 克｜ヒラヤマ カツ｜1950-01-01`）を検索
2. 該当患者の表示文字列を取得
3. `UI.patientDisplay`（B2）に書き込む → C2 の `=IFERROR(TRIM(LEFT(B2,...)))` 数式が患者IDを自動抽出
4. `UI.treatDate`（B4）に `new Date()`（当日）を書き込む
5. Logger: `[setPatientAndDate] patientId=... displayStr=...`
6. `{ok, patientId, displayStr}` を返す

**フォールバック:** `検索用` 列が未セットアップ or 値が空の場合は patientId をそのまま B2 にセット

**既存仕様との整合:**
- C2 の数式・B3 の VLOOKUP は変更しない（自動再計算に任せる）
- `onEdit` は GAS からの書き込みでは発火しないため onEdit ロジックへの影響なし

### `patientSearch.html` の変更

| 変更点 | 内容 |
|---|---|
| 行スタイル | `cursor: pointer` / hover・active・selected 色付け |
| クリックハンドラ | `addEventListener("click")` で `selectPatient()` を呼ぶ |
| 選択中フィードバック | 行を `opacity: .6` + `pointer-events: none`（二重タップ防止） |
| 成功トースト | 画面下部に 3 秒間表示（緑: 成功 / 赤: エラー） |
| テーブル列 | 患者ID+氏名+フリガナを縦並びに統合・右端に `›` ナビゲーション矢印追加 |

---

## 既存シートへの影響

| セル | 変更前 | 変更後 |
|---|---|---|
| B2 | プルダウンで手動選択 | Web UI から setValue で書き込み（数式なし → 値直書き） |
| C2 | 既存 LEFT 数式が自動抽出 | **変更なし**（B2 が変われば自動再計算） |
| B3 | 既存 VLOOKUP が自動表示 | **変更なし** |
| B4 | 手動入力 | Web UI から setValue で当日日付を書き込み |
| 既存プルダウン | 維持 | **変更なし** |

---

## 確認手順

1. GAS エディタ → デプロイ → Web App を**再デプロイ**（コード更新後は再デプロイ必須）
2. Web App URL をブラウザで開く
3. キーワードを入力して「検索」
4. 候補行をタップ/クリック
5. 「✓ 〇〇 を選択しました」トーストが表示されること
6. スプレッドシートの患者画面を確認:
   - B2: `P0001｜平山 克｜...` 形式の文字列がセットされている
   - C2: 患者ID が自動抽出されている（数式が機能している場合）
   - B4: 当日日付がセットされている
7. GAS ログで `[setPatientAndDate] patientId=... displayStr=...` を確認

---

## 残リスク

| リスク | 対策 |
|---|---|
| `getActiveSpreadsheet()` が Web App で null になる | bound script の場合は問題なし。standalone の場合は `SpreadsheetApp.openById()` に変更が必要 |
| B2 にデータバリデーションがある場合に値が拒否される | `setAllowInvalid(true)` が設定済みのため setValue は通る |
| 再デプロイ忘れ | コード変更後は毎回「デプロイを管理」→ 既存デプロイを更新すること |

---

## Phase 3 以降の予定

| Phase | 内容 |
|---|---|
| Phase 3 | 来院登録フォーム（部位・区分入力 + doPost / 書き込みあり） |
| Phase 4 | 月次集計・PDF 出力の Web 化 |

詳細は `docs/JREC-01_WebUI_段階移行設計_2026-04-22.md` を参照。
