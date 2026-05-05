# GAS_LIVE_CHECK_NOTES.md

GAS（Google Apps Script）Web App を Playwright で LiveCheck する際の注意事項。

作成日: 2026-05-02
最終更新: 2026-05-02（認証方式を Chrome CDP 方式に変更）

---

## 認証方式の変更履歴

| 日付 | 変更内容 |
|---|---|
| 2026-05-02 | 初回実装: playwright codegen 方式 |
| 2026-05-02 | **方式変更**: codegen 廃止 → Chrome remote debugging + CDP 方式に変更 |

### 変更理由

`npx playwright codegen --save-storage=auth.json https://accounts.google.com` を試みたところ、Google 側から

> 「ログインできませんでした。このブラウザまたはアプリは安全でない可能性があります」

と表示されブロックされた。

Playwright の Chromium は `navigator.webdriver = true` および automation フラグを立てており、Google がこれを検出してログインを拒否する。

**採用した代替方式:** Chrome remote debugging (CDP) + 人間による手動ログイン → セッション保存

---

## 現在の認証フロー（Chrome CDP 方式）

```text
1. Chrome を --remote-debugging-port=9222 で起動（専用プロファイル）
   ↓ 人間操作
2. Chrome で Google にログイン
3. JREC-SF01 /dev を開いて権限確認を済ませる
   ↓ スクリプト操作
4. npm run save-auth（CDP 経由で auth.json 保存）
   ↓ Playwright
5. npm run test:jrec（auth.json を storageState として使用）
```

**なぜこの方式が有効か:**
- Chrome に `--remote-debugging-port=9222` を付けても `navigator.webdriver` は立たない
- 人間が Chrome で手動ログインするため Google の bot 検出に引っかからない
- CDP でセッションを取得するだけなので Google との通信は発生しない

---

## 初回実行結果（2026-05-02）

```
環境: headless Chromium / 未認証状態
対象: JREC-SF01 HEAD /dev smoke.spec.ts（7テスト）
結果: 全 7 テスト SKIP（エラーなし）
```

**観測内容:**
- GAS /dev URL にアクセス → HTTP status 200 で返る
- 最終到達 URL: `https://accounts.google.com/v3/signin/identifier?continue=...`
- ページタイトル: "Google Drive: Sign-in"
- `skipIfLoginRequired` が `accounts.google.com` を検出 → `test.skip()` 発火
- **Scenario D 確定: skip 設計が正常動作している**

**結論:**
- エラーや例外は発生していない（クリーンな skip）
- GAS /dev へのアクセスには Google 認証セッションが必須
- 次ステップ: `storageState` を使った認証済みセッション設定（Phase LC-2 前提）

---

## LC-4 SKIP 記録（2026-05-06）— RTS 期限切れ

**JYU-GAS WEB-1/WEB-2 テスト全 SKIP / JREC-SF01 も全 SKIP**

```
フェーズ: JYU-GAS LC-1（WEB-1/WEB-2 Playwright テスト初回実行）
環境: Chrome CDP + Playwright storageState（auth.json 既存）
対象: jyu-gas-ver31 smoke.spec.ts (26) + web2.spec.ts (16) = 42テスト
結果: 42 SKIP / 0 FAIL（JREC-SF01 smoke も 8 SKIP）
```

### 根本原因

`__Secure-1PSIDRTS` / `__Secure-3PSIDRTS`（ローテーショントークン）が期限切れ。

| クッキー | 有効期間 | 役割 |
|---|---|---|
| `__Secure-1PSIDTS` | 約1年 | セッションタイムスタンプ（長期） |
| `__Secure-1PSIDRTS` | **約24時間** | ローテーショントークン（短期・必須） |

RTS が期限切れになると、Google は全 GAS サービスで Account Chooser を強制表示する。  
SAPISID/SID 等の長期クッキーが有効でも、RTS がないと認証が通らない。

### save-auth の有効期間

- auth.json は **約24時間**で再認証が必要になる可能性がある（RTS の有効期限による）
- 実際のテスト実行頻度に合わせて save-auth の実行タイミングを管理すること

### 正しい save-auth 手順（RTS 更新必須）

```powershell
# 1. Chrome を起動
$dir = "C:\hirayama-ai-workspace\workspace\tools\live-check-runner\.chrome-profile"
Start-Process "chrome" "--remote-debugging-port=9222 --user-data-dir=`"$dir`""

# 2. Chrome で以下を「順番通りに」実施（RTS 更新には Google ページのアクティブアクセスが必要）
#    a) https://accounts.google.com → ログイン確認（RTS 更新トリガー）
#    b) テスト対象の GAS dev URL を開く → Account Chooser → 正しいアカウント選択
#    c) GAS ページが完全表示されるまで待つ

# 3. GAS ページ確認後に save-auth（順番は厳守）
npm run save-auth
```

**注意:** Chrome を起動しただけ（Google ページを開かないまま save-auth）では RTS が更新されない。

### 診断ツール

```powershell
# 現在の auth.json の期限切れクッキーを確認
cd C:\hirayama-ai-workspace\workspace\tools\live-check-runner
npx tsx scripts/diag-jyu-auth.ts

# クッキー期限の確認（node コマンド）
node -e "
const a=JSON.parse(require('fs').readFileSync('auth.json','utf8'));
const now=Date.now()/1000;
a.cookies.filter(c=>c.expires>0&&c.expires<now).forEach(c=>console.log('EXPIRED:',c.name,'exp:'+new Date(c.expires*1000).toISOString()));
"
```

---

## LC-3 PASS 記録（2026-05-03）

**auth 再取得後、ai1.spec.ts（2段 frameLocator 修正版）が PASS**

```
フェーズ: LC-3（ai1.spec.ts — Phase AI-1 自動確認）
環境: Chrome CDP + Playwright storageState（auth 再取得済み）
対象: JREC-SF01 HEAD /dev ai1.spec.ts
結果: 4 passed / 6 skipped / 0 failed（10 tests）
```

**PASS 項目:**
- AI1-1a: newPatient — `#occupation` 入力欄が存在する
- AI1-1b: newPatient — `#medicalHistory` 入力欄が存在する
- AI1-1c: newPatient — 「AI補助判定用情報」セクションタイトルが存在する
- AI1-7:  dailyCheckout — `#dateForm` が描画される

**SKIP 項目（想定通り）:**
- AI1-3/AI1-4: `testData.patientIdForVisitForm` 未設定
- AI1-7 ボタン: カルテ保存後に出現のため手動確認推奨
- AI1-8/9: smoke.spec.ts で確認済みのため参照 SKIP

**使用したフレームアクセス方法:**
```typescript
function gasAppFrame(page: Page) {
  return page.frameLocator("iframe").first().frameLocator("iframe").first();
}
```

---

## LC-2 PASS 記録（2026-05-02）

**Chrome CDP 方式で auth.json 作成後、smoke テスト全項目 PASS**

```
フェーズ: LC-2（CDP 認証 + storageState 設定）
環境: Chrome CDP + Playwright storageState
対象: JREC-SF01 HEAD /dev smoke.spec.ts
結果: 16 passed / 0 failed / 0 skipped
実行時間: 約 1.2 分
```

**確認済み項目:**
- home devUrl 到達（HTTP 200）
- タイトルが "JREC" を含む
- newPatient ページ到達
- dailyCheckout ページ到達
- monthlyReport ページ到達
- menuSalesReport ページ到達
- outstandingReport ページ到達
- モバイル幅（390px）での横スクロール発生なし

**auth.json 作成手順（Chrome CDP 方式）:**
1. `Start-Process chrome @("--remote-debugging-port=9222", "--user-data-dir=$dir") -PassThru`
2. 手動でオーナーアカウントにログイン・JREC /dev の権限承認
3. `npm run save-auth`（CDP 経由で auth.json 保存）
4. `npm run test:jrec`

**次フェーズ:** LC-3 — ai1.spec.ts 実装（Phase AI-1 確認項目の自動化）

---

## /dev と /exec の違い

| 項目 | /dev | /exec |
|---|---|---|
| 対象コード | HEAD（最新 push 済みコード） | バージョン付き deploymet |
| 認証 | スクリプトオーナーのみアクセス可 | 設定により全員アクセス可 |
| URL | `...s/{scriptId}/dev` | `...s/{deploymentId}/exec` |
| 用途 | 開発中確認 | 本番利用 |

**LiveCheck は /dev を対象にする**（HEAD の動作確認が目的のため）。

---

## Google ログイン・権限承認の注意

### Playwright での対応が難しい状況

- GAS /dev は **スクリプトオーナーの Google アカウントでログインしたブラウザ** でのみアクセス可能
- 未ログイン状態でアクセスすると Google ログイン画面にリダイレクトされる
- 初回アクセス時に「このアプリは Google で確認されていません」警告が出ることがある
- OAuth 承認モーダルは Playwright で自動対話が難しい

### 対処方針

**❌ Option A（廃止）: playwright codegen 方式**

```powershell
# NG: Google が "安全でない可能性があるアプリ" として拒否する（2026-05-02 確認済み）
npx playwright codegen --save-storage=auth.json https://accounts.google.com
```

Google 側で `「このブラウザまたはアプリは安全でない可能性があります」` と表示されログインできない。
Playwright Chromium が `navigator.webdriver = true` を立てており、Google がこれを検出する。

---

**✅ Option A2（採用: Chrome CDP 方式）: Chrome remote debugging + 手動ログイン**

```powershell
# Step 1: 専用プロファイルで Chrome を起動（remote debugging 付き）
$dir = "C:\hirayama-ai-workspace\workspace\tools\live-check-runner\.chrome-profile"
Start-Process "chrome" @("--remote-debugging-port=9222", "--user-data-dir=$dir") -PassThru

# Step 2: 開いた Chrome で手動ログイン
#   → https://accounts.google.com にアクセス
#   → JREC-SF01 スプレッドシートオーナーアカウントでログイン
#   → JREC-SF01 /dev を開いて権限確認を済ませる

# Step 3: 別ターミナルで auth.json を保存（Chrome は閉じない）
cd C:\hirayama-ai-workspace\workspace\tools\live-check-runner
npm run save-auth

# Step 4: smoke テスト実行
npm run test:jrec
```

**なぜ機能するか:**
- `--remote-debugging-port=9222` は Chrome の内部デバッグポートを開くだけ
- `navigator.webdriver` は立たない → Google に bot と認識されない
- 人間が手動でログインするため Google の認証が通る
- CDP 接続時は認証情報を取得するだけで Google との通信は発生しない

**重要注意:**
- `auth.json` / `.chrome-profile/` は **絶対にコミットしない**（`.gitignore` で除外済み）
- セッション有効期限: 約 1〜2 週間（期限切れは Step 1〜3 を再実行）
- `npm run setup-auth` でガイドと Chrome パスを確認できる

---

**Option B: ヘッドフルモードで手動確認（デバッグ用途）**

```powershell
npx playwright test --headed projects/jrec-sf01/smoke.spec.ts
```

Playwright を headless:false で起動する。Google 認証は通らないが UI 確認には使える。

**Option C（現在の動作）: 到達確認のみ・認証エラーは skip**

認証画面が出た場合は test.skip() して「ログイン画面まで到達」のみ確認する。
auth.json がない状態ではこの動作になる（エラーにはならない）。

---

## GAS /dev のフレーム構造（2026-05-02/03 LC-3 実機調査で確定）

### 実際の構造: 2段入れ子 iframe

LC-3 初回実行（`npm run test:jrec:ai1`）の失敗ログ（`test-results/*/error-context.md`）の
ページスナップショットにより、以下の構造が確定した。

```
page (top-level)
├─ table [ref=e2]                    ← Google 警告バナー（全 /dev ページに表示）
│  └─ "このアプリケーションはGASユーザーによって作成されたものです"
│     + 「不正行為を報告」「詳細」リンク + 「閉じる」ボタン
└─ iframe [ref=e21]                  ← 外側 iframe（contentが別iframe）
   └─ iframe [ref=f1e2]             ← 内側 iframe（GAS アプリ本体）
      ├─ heading "JREC-SF01 自費カルテ・会計"
      ├─ navigation (ホーム/受付/患者一覧/...)
      └─ form fields: #occupation, #medicalHistory, #injuryTrigger, etc.
```

**重要:** `page.title()` は "JREC-SF01 自費カルテ・会計" を返す。
これは GAS `setTitle()` が外側ページの `document.title` を更新するためであり、
コンテンツが外側 iframe にないことを意味しない。

### アクセス方法の正誤

| 方法 | 結果 | 理由 |
|---|---|---|
| `page.locator('#occupation')` | ❌ FAIL | page.locator はフレームを越えられない |
| `frameLocator('iframe[src*="googleusercontent"]').first().locator('#occupation')` | ❌ FAIL | 外側 iframe を掴む（中身は内側 iframe のみ） |
| `frameLocator('iframe').first().locator('body')` | ⚠️ 偽 PASS | 外側 iframe の body（中身は内側 iframe のみ）を掴む |
| `frameLocator('iframe').first().frameLocator('iframe').first().locator('#occupation')` | ✅ 期待 | 2段 frameLocator で内側 iframe にアクセス |

### 次回修正の候補コード（未検証・要確認）

```typescript
// GAS /dev の2段 iframe 構造に対応
const gasFrame = page
  .frameLocator('iframe')      // 外側 iframe
  .first()
  .frameLocator('iframe')      // 内側 iframe（GAS コンテンツ）
  .first();

await expect(gasFrame.locator('#occupation')).toBeVisible({ timeout: 25_000 });
```

`page.frames()` API で URL パターンから内側フレームを直接取得する方法も有効。
`page.frames()` は同期的に現在のフレームツリーを返す。

### LC-3 初回実行での失敗の原因（時系列）

1. 初期実装: `frameLocator('iframe[src*="googleusercontent"]').first()` → 外側 iframe を掴む
   - AI1-7 `frame.locator('body')` : ⚠️ 偽 PASS（外側 iframe の body）
   - AI1-1 `frame.locator('#occupation')` : ❌ FAIL（内側 iframe にある）

2. LC-3 修正: `page.locator()` に変更 → フレームを越えられない
   - 再実行未済。同様に FAIL する可能性が高い

3. **次回必要な修正**: 2段 frameLocator（上記コード参照）

### /exec URL との比較（未確認）

| URL | フレーム構造 | 現在の知見 |
|---|---|---|
| `/dev` (認証済み) | 2段 iframe（確定） | 上記の通り |
| `/exec` (公開) | 未調査 | `/dev` と異なる可能性あり |

`/exec` URL を LiveCheck する場合は改めてページスナップショットで構造を確認すること。

---

## DOM 取得の注意

- GAS テンプレートは サーバーサイドレンダリング（SSR）で HTML 生成
- クライアントサイド JS がエラーになると画面が壊れている可能性がある
- `page.waitForLoadState("networkidle")` より `page.waitForSelector(".container")` の方が安定することが多い
- GAS のロード時間は 2〜5 秒程度かかることがある（タイムアウトを 10〜15 秒に設定）

---

## 画面遷移の注意

- GAS Web App は `window.top.location.href = APP_URL + '?page=xxx'` でページ遷移する
- `page.goto()` でパラメータ付き URL に直接アクセスすることで各ページを開ける

```typescript
// 例: dailyCheckout ページを直接開く
await page.goto(`${devUrl}?page=dailyCheckout&date=2026-05-02`);
```

ただし、ページ遷移後の DOM 更新を待つ必要がある（`waitForSelector` 推奨）。

---

## 自動化できる確認

| 確認内容 | Playwright 対応 |
|---|---|
| ページ到達確認 | `page.goto()` + `response.status()` |
| フォームフィールドの存在確認 | `page.locator('label:has-text("職業")')` |
| ボタンの存在確認 | `page.locator('button:has-text("保存する")')` |
| エラーメッセージの非表示確認 | `.alert-error` が存在しないこと |
| タブナビゲーションの存在 | `.tab-nav` |
| スマホ viewport 確認 | `devices["Pixel 5"]` |
| スクリーンショット保存 | 自動（failure time） |

---

## 人間確認が残る確認

| 確認内容 | 理由 |
|---|---|
| Google 認証画面の突破 | Playwright での自動ログインは不安定 |
| GAS 初回権限承認 | OAuth モーダルの対話 |
| 実際の保存動作（スプレッドシートへの書き込み） | DB 値の確認が必要 |
| 再編集時のデータ復元（既存データ依存） | テストデータの準備が必要 |
| 見た目の主観評価 | 人間判断が必要 |

---

## JREC-SF01 固有の注意

- HEAD /dev URL: `https://script.google.com/macros/s/AKfycbzJWJAKCxStP82lfFl8eEHei98dWh7f6cgtEM33r3M5/dev`
- 本番 /exec URL（@35）: `https://script.google.com/macros/s/AKfycbzX8wauxGE0ucFeBd6JtCZ8CJkJ94rKT3D4P88DCP8KQ0ALCkh6azBKpDPkTcaHmWBLyA/exec`
- GAS iframe のため、DOM アクセスには `frameLocator` が必要になる可能性がある
- `?page=` パラメータで各ページに直接遷移できる
