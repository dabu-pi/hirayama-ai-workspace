# JREC-01 Web UI Phase 3 — 遷移先真っ白バグ修正

修正日: 2026-04-22  
対象ブランチ: `feature/auto-dev-phase3-loop`

---

## 症状

「自費明細入力 →」ボタン押下後、遷移先が真っ白になる。  
スクショ上の URL: `https://...googleusercontent.com/userCodeAppPanel?page=selfpay&visitKey=...`

---

## 原因

`patientSearch.html` 内の URL 生成コード:

```javascript
// バグあり
var baseUrl = window.location.href.split("?")[0];
```

GAS Web App を開いた際、`window.location.href` は Web App の公式 `/exec` URL ではなく、
GAS 内部の描画フレーム URL を返す。

```
期待値: https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec
実際値: https://n-xxxx.googleusercontent.com/userCodeAppPanel
```

このため `?page=selfpay&visitKey=xxx` が `userCodeAppPanel` に付加され、
GAS の Web App として解釈されずに真っ白になる。

### なぜ検索・選択は正常だったか

`google.script.run` は GAS の内部 RPC 通信（フレーム間通信）を使うため、
URL とは無関係に動作する。壊れるのは「ページ遷移（`href` による移動）」だけ。

---

## 修正内容

### 修正方針

クライアント側で URL を推測しない。
`ScriptApp.getService().getUrl()` で正式な `/exec` URL を取得し、
テンプレート変数で HTML に埋め込む。

### `Ver3_core.js` — `doGet(e)` 改修

```javascript
var appBaseUrl = ScriptApp.getService().getUrl();   // 正式な /exec URL

// patientSearch を createTemplateFromFile に変更
var tmpl2 = HtmlService.createTemplateFromFile("patientSearch");
tmpl2.appBaseUrl = appBaseUrl;
return tmpl2.evaluate()...
```

- 診断用 Logger を追加: `[doGet] page=... appBaseUrl=...`
- `selfPayWeb.html` にも同じ `appBaseUrl` を渡す（将来の「患者検索に戻る」リンクに使用可能）

### `patientSearch.html` — URL 生成修正

```javascript
// テンプレートで埋め込まれた /exec URL を使う
var APP_BASE_URL = "<?= appBaseUrl ?>";

function showSelectedPanel(patientId, name) {
  var visitKey   = patientId + "_" + todayYMD();
  var selfpayUrl = APP_BASE_URL + "?page=selfpay&visitKey=" + encodeURIComponent(visitKey);
  // ...
}
```

- `window.location.href.split("?")[0]` を完全に除去
- `createHtmlOutputFromFile` → `createTemplateFromFile` に変更（doGet 側）

---

## 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `Ver3_core.js` | `doGet`: `ScriptApp.getService().getUrl()` で appBaseUrl 取得 / patientSearch を createTemplateFromFile 化 / Logger 追加 |
| `patientSearch.html` | `APP_BASE_URL = "<?= appBaseUrl ?>"` 追加 / `window.location.href` 除去 |

---

## 再発防止

GAS Web App で HTML 内からページ遷移 URL を組み立てる際は、
`window.location.href` を使わず、必ずサーバー側で `ScriptApp.getService().getUrl()` を
取得してテンプレート変数で渡すこと。

---

## 再確認手順

1. GAS エディタ → デプロイを管理 → 既存デプロイを編集 → **新しいバージョン**で再デプロイ
2. GAS ログ（ツール > ログ）で `[doGet] page=search appBaseUrl=https://script.google.com/macros/s/...` を確認
3. 患者検索ページで患者を選択 → 「自費明細入力 →」ボタンをクリック
4. `https://script.google.com/macros/s/.../exec?page=selfpay&visitKey=...` に遷移すること
5. selfPayWeb.html が正常に表示されること
