# GAS_LIVE_CHECK_NOTES.md

GAS（Google Apps Script）Web App を Playwright で LiveCheck する際の注意事項。

作成日: 2026-05-02

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

**Option A（推奨初期）: storageState を使って認証済みセッションを再利用**

```powershell
# 一度だけ手動でログインしてセッションを保存
npx playwright codegen --save-storage=auth.json https://accounts.google.com
```

保存した `auth.json` を playwright.config.ts の `storageState` に指定。
**注意: auth.json には認証情報が含まれるため .gitignore に追加すること。**

**Option B: ヘッドフルモードで手動確認**

```powershell
npx playwright test --headed projects/jrec-sf01/smoke.spec.ts
```

Playwright を headless:false で起動し、手動でログイン後にテストを進める。

**Option C（初期段階）: 到達確認のみ・認証エラーは skip**

認証画面が出た場合は test.skip() して「ログイン画面まで到達」のみ確認する。
これが Phase LC-1 の現在のアプローチ。

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
