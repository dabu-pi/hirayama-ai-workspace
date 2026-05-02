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

## iframe / googleusercontent 問題

- GAS Web App のコンテンツは `googleusercontent.com` ドメインの iframe 内に表示される
- Playwright は cross-origin iframe を `frameLocator()` で取得できるが、制約がある
- `frame.locator()` で iframe 内 DOM にアクセスする場合は URL を確認してから行う

```typescript
// iframe 取得例
const frame = page.frameLocator('iframe[src*="googleusercontent"]').first();
const heading = frame.locator('h1');
```

ただし、iframe の src は毎回変わる可能性があるため、安定したセレクタが必要。

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
