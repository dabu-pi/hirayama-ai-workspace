# JREC-01 自費明細 Web UI — Step 1 実装記録

実装日: 2026-04-22  
対象ブランチ: `feature/auto-dev-phase3-loop`

---

## 実装内容

設計書 `JREC-01_selfpay_webui_design_2026-04-22.md` Step 1 に基づく最小試作。

---

## 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `Ver3_core.js` | `doGet(e)` をページ分岐版に改修 / `getSelfPayDataByVisitKey_V3()` を追加 |
| `selfPayWeb.html` | 新規作成（Web App 版自費明細入力ページ） |
| `selfPayDialog.html` | **変更なし**（既存ダイアログを維持） |

---

## 実装詳細

### 1. `doGet(e)` — ページルーティング追加

```
?page=selfpay&visitKey=P001_2026-04-22
  → createTemplateFromFile("selfPayWeb")
  → tmpl.visitKey = sanitizedVisitKey
  → evaluate() で <?= visitKey ?> を展開

?page=search（または省略）
  → createHtmlOutputFromFile("patientSearch")（既存）
```

- visitKey の形式チェック（`.+_\d{4}-\d{2}-\d{2}` の正規表現）を doGet 側で実施
- 不正な visitKey は空文字に落とし、selfPayWeb.html 側でエラーパネルを表示

### 2. `getSelfPayDataByVisitKey_V3(visitKey)`

| 処理 | 内容 |
|---|---|
| visitKey パース | `m[1]` = patientId / `m[2]` = treatDate（YYYY-MM-DD） |
| 既存明細取得 | `readSelfPayDetailsForVisit_V3_()` を流用 |
| JSON-safe 化 | Date 型フィールドを除外（getCurrentVisitKey_V3 と同じ理由） |
| 文脈情報 | UI シート（B5/B7/B8/D8）を best-effort で読む |
| Logger | `[getSelfPayDataByVisitKey] visitKey=... existItems=N` |
| エラー | `{ error: "...", existItems: [] }` を返す（例外を投げない） |

`getCurrentVisitKey_V3` との違い: visitKey を引数で受け取るため、アクティブシートの状態に依存しない。

### 3. `selfPayWeb.html`

**selfPayDialog.html との差分:**

| 項目 | ダイアログ版 | Web App 版 |
|---|---|---|
| visitKey の取得 | `getCurrentVisitKey_V3()` を呼ぶ | `<?= visitKey ?>` で埋め込み済み → `getSelfPayDataByVisitKey_V3(VISIT_KEY)` を呼ぶ |
| キャンセル | `google.script.host.close()` | `history.back()` へのリンク |
| 保存成功後 | `google.script.host.close()` | 成功パネルを表示（件数 + 「患者検索に戻る」リンク） |
| エラーパネル | なし（alert のみ） | visitKey 不正・初期化失敗時に黄色エラーパネルを表示 |
| ページサイズ | 600×420px ダイアログ | フルページ（viewport 対応） |
| フォントサイズ | 12〜13px（ダイアログ向け） | 13〜14px（スタンドアロン向け） |

**共通流用（変更なし）:**
- `getSelfPayMenuMaster_V3()` の呼び出し
- `saveSelfPayDetailsFromDialog_V3()` の呼び出し（visitKey / itemsJson / contextJson 形式）
- addRow / updateSubtotal / updateTotal / renumberRows の JS ロジック
- ジム会員フラグによる価格切替ロジック

---

## Web 確認手順

### 前提
- GAS エディタ → デプロイを管理 → 既存デプロイを編集 → **新しいバージョン**で再デプロイ

### 手順

1. **visitKey なしアクセス（エラーパネル確認）**
   ```
   https://<WebAppURL>?page=selfpay
   ```
   → 「visitKey が指定されていません」エラーパネルが表示されること

2. **正常アクセス（新規登録）**
   ```
   https://<WebAppURL>?page=selfpay&visitKey=P001_2026-04-22
   ```
   ※ 実際の患者ID と今日の日付を使うこと

   確認項目:
   - 「来院キー: P001_2026-04-22 / 来院日: 2026-04-22」が表示されること
   - メニューマスタが読み込まれプルダウンに表示されること
   - 空行が1件追加されること

3. **既存明細の読み込み確認**
   - 既存の自費明細がある visitKey でアクセス
   - 既存データが行として復元されること

4. **保存確認**
   - メニュー選択 → 数量入力 → 「保存する」ボタンクリック
   - 「N 件の自費明細を保存しました」パネルが表示されること
   - スプレッドシートの自費明細シートに行が追加されていること
   - D7/F7/H8 が更新されていること

5. **GAS ログ確認（ツール > ログ）**
   ```
   [getSelfPayDataByVisitKey] visitKey=... existItems=N
   [deleteSelfPay] visitKey=... 削除件数=N
   [appendSelfPay] 書き込み: visitKey=... lineNo=N
   ```

---

## 残リスク

| リスク | 状況 | 対策 |
|---|---|---|
| B7/B8/D8 の文脈情報（accountingType 等）が正しく読めない | UI シートの状態依存（best-effort） | Phase 4 でフォームから入力できるようにする |
| 2回目以降の保存で D7/F7/H8 が旧値のまま | `updateSelfPayDisplay_V3_` / `updateH8Status_V3_` は保存時に必ず実行される → 問題なし | — |
| テンプレートエラー（`<?= visitKey ?>` が展開されない） | `createTemplateFromFile` 必須。`createHtmlOutputFromFile` では動かない | doGet の実装を確認 |

---

## Dashboard / Run_Log 反映

**不要（設計書記録と同様）。** 実装はコードのみ、シート構造変更なし。
