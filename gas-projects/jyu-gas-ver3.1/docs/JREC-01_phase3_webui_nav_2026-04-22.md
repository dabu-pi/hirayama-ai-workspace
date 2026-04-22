# JREC-01 Web UI Phase 3 — 患者検索 → 自費明細 導線追加

実装日: 2026-04-22  
対象ブランチ: `feature/auto-dev-phase3-loop`

---

## 目的

患者検索（Phase 2）と自費明細入力（Step 1）を繋ぎ、
1回の操作フローで患者選択 → 自費明細入力まで到達できるようにする。

---

## 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `patientSearch.html` | 患者選択成功後に「自費明細入力 →」ボタンを含むパネルを表示 |

---

## 実装内容

### UI フロー

```
患者検索
  ↓ キーワード入力 → 検索
カード一覧表示
  ↓ カードタップ
シート B2/B4 更新（setPatientAndDate_V3）
  ↓ 成功
選択パネル表示
  ┌─────────────────────────────┐
  │ 選択済み患者                │
  │ 平山 克（P001）             │
  │ [ 自費明細入力 → ]          │  ← クリックで遷移
  └─────────────────────────────┘
  ↓
?page=selfpay&visitKey=P001_2026-04-22
  ↓
selfPayWeb.html で自費明細入力
```

### visitKey の生成（クライアント側）

```javascript
function todayYMD() {
  var d  = new Date();
  var mm = d.getMonth() + 1;
  var dd = d.getDate();
  return d.getFullYear() + "-" + (mm < 10 ? "0" : "") + mm + "-" + (dd < 10 ? "0" : "") + dd;
}
var visitKey = patientId + "_" + todayYMD();
```

- `new Date()` はブラウザのローカル時刻を使用
- GAS サーバー側の `buildVisitKey_` と同形式（`patientId_YYYY-MM-DD`）
- 日本時間のユーザーであれば GAS の日付と一致する

### URL 生成

```javascript
var baseUrl    = window.location.href.split("?")[0];
var selfpayUrl = baseUrl + "?page=selfpay&visitKey=" + encodeURIComponent(visitKey);
```

- `window.location.href.split("?")[0]` で現在の URL からクエリパラメータを除去
- `encodeURIComponent` で `_` など特殊文字を安全にエンコード

### 既存ロジックへの影響

- `selectPatient()` の既存処理（selecting クラス / 選択済みカード表示 / トースト）は変更なし
- 成功ハンドラに `showSelectedPanel(patientId, name)` を1行追加するだけ
- 再検索しても `#selected-panel` は表示されたまま（意図的: 直前の選択を保持）

---

## 確認手順

1. GAS エディタ → デプロイを管理 → 既存デプロイを編集 → **新しいバージョン**で再デプロイ
2. 患者検索ページを開く
3. キーワード検索 → 患者カードをタップ
4. 「選択済み患者」パネルが表示されること
5. 「自費明細入力 →」ボタンをクリック
6. `selfPayWeb.html` が開き、来院キーが正しく表示されること
7. メニューマスタが読み込まれること
8. 保存まで動作すること

---

## 残リスク

| リスク | 内容 | 対策 |
|---|---|---|
| 日付の timezone ずれ | ブラウザが JST 以外に設定されている場合、visitKey の日付がサーバーと異なる可能性 | 現状オーナーのみ（日本国内）なので許容範囲。必要なら GAS 関数で今日の visitKey を返す API を追加する |
| 複数患者を続けて選択した場合 | パネルは最後の選択内容に上書きされる（意図的） | 問題なし |
