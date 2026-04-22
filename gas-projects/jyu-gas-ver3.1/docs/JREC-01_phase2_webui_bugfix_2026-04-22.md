# JREC-01 Phase 2 Web UI — 候補行非表示バグ修正

修正日: 2026-04-22  
対象ブランチ: `feature/auto-dev-phase3-loop`

---

## 症状

- Web App で検索すると「2件ヒット — 行をタップして選択」と status には表示される
- しかし候補行そのものが画面に表示されない

---

## 原因

`show()` ユーティリティ関数のバグ。

```javascript
// 旧コード（バグあり）
function show(id) { document.getElementById(id).style.display = ""; }
```

`style.display = ""` はインラインスタイルを消去するだけで、CSS ファイル内のルール:

```css
#results { display: none; }
```

が残るため、要素は非表示のままになる。

ブラウザの優先度は「インラインスタイル > CSS ルール」なので、
`display: none` を上書きするには `style.display = "block"` のように明示する必要がある。

対して `hide()` は `style.display = "none"` と明示していたため正常動作し、
status（`setStatus` / `textContent`）も直接書き込みのため正常に表示されていた。

**なぜ見えたのに気づかなかったか:**  
`searchPatients_V3` は正常動作（件数は返る）、`setStatus` は DOM 直書きで正常、
描画バグは `show()` 一箇所のみで、表面上「検索は動いている」ように見えた。

---

## 修正内容

### 1. `show()` を `showEl(id, visible)` に置き換え

```javascript
// 新コード（修正後）
function showEl(id, visible) {
  document.getElementById(id).style.display = visible ? "block" : "none";
}
```

`visible=true` のとき `"block"` を明示的にセットするため CSS ルールを上書きできる。

### 2. テーブル → カードリストに変更

`<table>` の `display` 復元には `"table"` が必要で `"block"` と挙動が異なる可能性がある。
根本解決として `<table id="results">` を `<div id="resultList">` に置き換え、
候補をカードコンポーネントで描画するよう変更した。

### 3. 表示レイアウト改善

| 変更点 | 内容 |
|---|---|
| 1行目 | 氏名（`font-size:16px`, `font-weight:700`, `color:#222`）|
| 2行目 | 患者ID　フリガナ　生年月日（`font-size:12px`, `color:#666`）|
| カード枠 | `border: 1px solid #ddd`, `border-radius:8px`, 背景白 `#fff` |
| hover | `background:#e8f4fd`, `border-color:#3498db` |
| selected | `background:#d4edda`, `border-color:#27ae60` |
| padding | `14px 16px`（タップしやすい高さ） |

---

## 変更ファイル

| ファイル | 変更 |
|---|---|
| `patientSearch.html` | `show()` → `showEl()` に統一、テーブル → カードリスト |

---

## 再確認手順

1. GAS エディタ → デプロイを管理 → 既存デプロイを編集 → **新しいバージョン** で再デプロイ
2. Web App URL をブラウザで開く
3. キーワードを入力して「検索」→ **カードが表示されること**を確認
4. カードをタップ → 「✓ 〇〇 を選択しました」トーストが出ること
5. スプレッドシートの患者画面で B2・B4 が更新されていること

---

## 再発防止

今後 HTML で要素の表示切替をする場合は `style.display = ""` を使わない。  
`"block"` / `"none"` / `"flex"` / `"table"` を明示的にセットすること。
