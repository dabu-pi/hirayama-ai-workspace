# WEB-1 LiveCheck 記録

実施日: 2026-05-06  
実施者: Claude Code  
対象: Phase WEB-1 実装内容 + 既存稼働導線

---

## Playwright LiveCheck 実行結果（2026-05-06）

**スペックファイル:** `tools/live-check-runner/projects/jyu-gas-ver31/smoke.spec.ts`  
**実行コマンド:** `npm run test:jyu:smoke`

| 結果 | 件数 |
|---|---|
| PASS | 0 |
| FAIL | 0 |
| SKIP | 26（全件） |

**SKIP 理由:** Google Account Chooser に遷移（`title: "Google Drive: Sign-in"`）

### SKIP の原因と対処

```
現象: GAS dev URL → accounts.google.com/v3/signin/accountchooser にリダイレクト
原因: auth.json は JREC-SF01 のログインで作成されており、JYU-GAS の URL を Chrome で
      一度も開いていないため Account Chooser が表示される
対処: 以下の手順で auth.json を更新する
```

**auth 更新手順（Chrome CDP 方式）:**
```powershell
# 1. Chrome を remote debugging で起動（.chrome-profile の既存セッションを使用）
cd C:\hirayama-ai-workspace\workspace\tools\live-check-runner
$dir = "$(Get-Location)\.chrome-profile"
Start-Process "chrome" "--remote-debugging-port=9222 --user-data-dir=`"$dir`""

# 2. 開いた Chrome で JYU-GAS dev URL を開く
#    https://script.google.com/macros/s/AKfycbzj47fbRvTlVixUrUiV_25xkevfyI_HXhFaBKYodB2B/dev
#    → Account Chooser が出たら pinshanka24@gmail.com を選択

# 3. auth.json を更新
cd C:\hirayama-ai-workspace\workspace\tools\live-check-runner
npm run save-auth

# 4. テスト再実行
npm run test:jyu:smoke
```

**期待結果（auth 更新後）:** 26 PASS / 0 FAIL / 0 SKIP

---

## 確認方式

GAS Web App はブラウザから直接アクセスできないため、  
**コードレビュー LiveCheck** を実施した。  
実機ブラウザ確認は現場スマホで実施すること（下記「要実機確認」参照）。

---

## 1. 作業場所・ブランチ確認

| 項目 | 結果 |
|---|---|
| `git rev-parse --show-toplevel` | `C:/hirayama-ai-workspace/workspace` |
| 現在ブランチ | `feature/auto-dev-phase3-loop` |
| リモートとの差分 | up to date（pull 済み） |

---

## 2. clasp deployments 確認

```
Found 9 deployments.
@HEAD / @7 / @8 / @9（最新番号）/ @3(x2) / @4 / @5 / @6
```

- 最新バージョン: `@9`（`AKfycbxODNWJNcCJVQnDXHzzWck237hnUIIXR_...`）
- Web App URL: `https://script.google.com/macros/s/AKfycbxODNWJNcCJVQnDXHzzWck237hnUIIXR_Ilt8SS5P5zodfF2dnmKeqso8BL8hcinVEBrQ/exec`
- `appsscript.json` の `access: "MYSELF"` → スクリプトオーナーのみアクセス可

---

## 3. doGet ルーティング（Ver3_core.js:5445-5490）

| ルート | HTMLファイル | 確認結果 |
|---|---|---|
| デフォルト（page未指定 / page=search） | `patientSearch.html` | ✅ 正常（既存と変更なし） |
| `page=home` | `web-home.html` | ✅ 正常（WEB-1 追加） |
| `page=detail&patientId=xxx` | `web-patient-detail.html` | ✅ 正常（WEB-1 追加） |
| `page=selfpay` | `selfPayWeb.html` | ✅ 正常（既存と変更なし） |

- 全ページに `appBaseUrl`（ScriptApp.getService().getUrl()）を注入済み ✅
- `page=detail` は patientId 未指定時「patients ID が指定されていません」エラーを HTML 側で表示 ✅

---

## 4. 既存稼働導線 — patientSearch.html（コードレビュー）

| 確認項目 | 結果 |
|---|---|
| `searchPatients_V3(keyword)` 呼び出し | ✅ 正常 |
| `setPatientAndDate_V3(patientId)` 呼び出し | ✅ 正常 |
| `自費明細入力 →` リンク（selfpayUrl）生成 | ✅ `APP_BASE_URL + "?page=selfpay&visitKey=" + encodeURIComponent(visitKey)` |
| `患者詳細を見る →` ボタン（detailUrl）生成 | ✅ `APP_BASE_URL + "?page=detail&patientId=" + encodeURIComponent(patientId)`（WEB-1追加） |
| `← Web ホームへ` リンク | ✅ `APP_BASE_URL + "?page=home"`（WEB-1追加） |
| `window.location` 使用禁止 | ✅ 使っていない（全て APP_BASE_URL ベース） |

---

## 5. WEB-1 新規ページ — web-home.html（コードレビュー）

| 確認項目 | 結果 |
|---|---|
| `患者検索` カード → `?page=search` リンク | ✅ 正常 |
| 未実装機能のカード | ✅ `disabled`（来院記録: Phase WEB-2、施術録/申請書: Phase WEB-3） |
| `appBaseUrl` テンプレート注入 | ✅ `<?= appBaseUrl ?>?page=search` 形式 |

---

## 6. WEB-1 新規ページ — web-patient-detail.html（コードレビュー）

| 確認項目 | 結果 |
|---|---|
| `getPatientDetail_V3(PATIENT_ID)` 呼び出し | ✅ window.onload で呼び出し |
| patientId 未指定時のエラーハンドリング | ✅ `showError("患者IDが指定されていません。")` |
| 患者基本情報表示（name/furi/birthday） | ✅ 正常 |
| 来院履歴テーブル（最大10件） | ✅ treatDate 降順、全列表示 |
| 「自費明細入力 →」ボタン（今日の visitKey） | ✅ `APP_BASE_URL + "?page=selfpay&visitKey=" + todayVK` |
| `← 患者検索に戻る` リンク | ✅ `?page=search` |
| XSS 対策（`esc()` 関数） | ✅ &/</>/& を全エスケープ |

---

## 7. getPatientDetail_V3（Ver3_core.js:5808-5880）

| 確認項目 | 結果 |
|---|---|
| `SHEETS.master`（"患者マスタ"）検索 | ✅ 正常 |
| `SHEETS.header`（"来院ヘッダ"）検索 | ✅ 正常 |
| HEADER_COLS との列名一致 | ✅ 全列名一致（visitKey/施術日/患者ID/区分/来院合計/会計区分/要確認） |
| treatDate 降順ソート + 10件スライス | ✅ 正常 |
| エラーハンドリング | ✅ `{ error: e.message }` 返却 |
| ログ方針（個人情報なし） | ✅ patientId と件数のみ |

---

## 8. selfPayWeb.html（既存稼働導線 — 変更なし確認）

| 確認項目 | 結果 |
|---|---|
| selfPayWeb.html の変更有無 | ✅ 変更なし（WEB-1 では触っていない） |
| `getSelfPayMenuMaster_V3()` | ✅ 存在・変更なし |
| `getSelfPayDataByVisitKey_V3()` | ✅ 存在・変更なし |
| `saveSelfPayDetailsFromDialog_V3()` | ✅ 存在・変更なし |

---

## 9. 総合判定

| ルート | 判定 | 備考 |
|---|---|---|
| `page=search`（デフォルト） | ✅ PASS | 既存稼働導線、コード変更なし |
| `page=selfpay` | ✅ PASS | 既存稼働導線、コード変更なし |
| `page=home` | ✅ PASS（コードレビュー） | 要実機確認 |
| `page=detail&patientId=xxx` | ✅ PASS（コードレビュー） | 要実機確認 |

---

## 10. 要実機確認（現場スマホ）

以下は実機ブラウザでの確認が必要:

1. **`?page=home`** → ナビゲーションカードが表示されるか
2. **`?page=home` → 「患者検索」タップ** → `?page=search` に遷移するか
3. **`?page=search`（デフォルト）** → 既存の検索・選択・自費明細リンク動作するか  
4. **`?page=search` → 患者選択後 → 「患者詳細を見る」タップ** → `?page=detail` に遷移するか
5. **`?page=detail&patientId=実在患者ID`** → 患者情報・来院履歴が表示されるか
6. **`?page=detail` → 「自費明細入力 →」タップ** → `?page=selfpay` に遷移するか

---

## 11. デフォルト URL 変更条件（web-home.html をデフォルト化）

`docs/PHASE_WEB2_VISIT_CREATE_DESIGN_2026-05-05.md §8` 記載の条件リスト:  
1. `web-home.html` 実機確認 PASS ← **未実施**
2. `patientSearch.html` に「← Web ホームへ」リンク追加済み ✅（WEB-1B で実装）
3. `selfPayWeb.html` への既存導線が壊れていない ✅
4. `web-patient-detail.html` 実機確認 PASS ← **未実施**
5. 患者詳細 → 来院記録追加の基本導線が安定（Phase WEB-2 完了後）
6. 現場でスマホ操作が試された実績

→ **条件 1 / 4 / 5 / 6 が未完のためデフォルト変更は保留**
