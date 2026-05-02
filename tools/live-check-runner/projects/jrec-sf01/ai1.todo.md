# AI1 LiveCheck TODO — JREC-SF01 Phase AI-1

Phase AI-1（患者マスター・カルテ項目追加）の HEAD /dev 実機確認項目。
自動化可能な項目と人間確認が必要な項目に分類する。

clasp push 済み: 2026-05-02
versioned deployment: 未実施（HEAD /dev 確認後に @36 として実施）

LC-2 PASS: 2026-05-02（smoke 16 passed / auth.json CDP 方式で取得済み）
LC-3 実装: 2026-05-02（ai1.spec.ts 作成。実行: npm run test:jrec:ai1）

HEAD /dev URL:
https://script.google.com/macros/s/AKfycbzJWJAKCxStP82lfFl8eEHei98dWh7f6cgtEM33r3M5/dev

---

## 確認項目 AI1-1〜AI1-9

| Test | 自動化分類 | 確認内容 | 判定 |
|---|---|---|---|
| AI1-1 | 🤖 自動化可能 | 新規患者登録画面に「職業」「既往歴」のラベル・入力欄が表示される | 🔧 ai1.spec.ts 実装済み |
| AI1-2 | 👤 人間確認 | 既存患者編集で「職業」「既往歴」が復元される（既存データ依存） | ⏸ |
| AI1-3 | 🤖→👤 条件付き | カルテ入力画面に患者情報参照欄（性別・年齢・職業・既往歴ブロック）が見える | 🔧 patientIdForVisitForm 設定で自動化可 / 未設定はSKIP |
| AI1-4 | 🤖 自動化可能 | カルテ入力に「受傷起点」「今回追記既往歴」のラベル・テキストエリアが表示される | 🔧 ai1.spec.ts 実装済み（visitForm 到達要確認） |
| AI1-5 | 👤 人間確認 | カルテ再編集時に「受傷起点」「今回追記既往歴」が復元される（データ依存） | ⏸ |
| AI1-6 | 👤 人間確認 | 既存患者（空欄）・既存カルテ（空欄）でエラーメッセージが出ない | ⏸ |
| AI1-7 | 🤖 部分自動化 | dailyCheckout 到達確認済み / 「会計入力へ進む」ボタンは保存後出現のため手動確認 | 🔧 到達確認のみ実装済み |
| AI1-8 | ✅ smoke 確認済 | home / dailyCheckout / monthlyReport / menuSalesReport / outstandingReport が開く | ✅ smoke.spec.ts で 16 PASS |
| AI1-9 | ✅ smoke 確認済 | 追加項目によりモバイル表示（390px幅）が大きく崩れない | ✅ smoke.spec.ts で PASS |

---

## 自動化対象（ai1.spec.ts で実装予定）

以下を ai1.spec.ts に実装する（Phase LC-2 以降）:

### AI1-1: 新規患者登録画面

```typescript
// newPatient ページに職業・既往歴の入力欄があること
await page.goto(`${devUrl}?page=newPatient`);
await expect(page.locator('label:has-text("職業")')).toBeVisible();
await expect(page.locator('#occupation')).toBeVisible();
await expect(page.locator('label:has-text("既往歴")')).toBeVisible();
await expect(page.locator('#medicalHistory')).toBeVisible();
```

### AI1-3: カルテ入力画面（患者情報参照欄）

```typescript
// visitForm ページに患者情報参照ブロックがあること
await page.goto(`${devUrl}?page=visitForm&id=P0001`);
// 患者情報参照欄（空欄でも存在するブロック）
// ※ 職業・既往歴が空の患者の場合は表示されない設計なので注意
```

### AI1-4: カルテ入力（受傷起点・今回追記既往歴）

```typescript
await page.goto(`${devUrl}?page=visitForm&id=P0001`);
await expect(page.locator('label:has-text("受傷起点")')).toBeVisible();
await expect(page.locator('#injuryTrigger')).toBeVisible();
await expect(page.locator('label:has-text("今回追記既往歴")')).toBeVisible();
await expect(page.locator('#relatedHistoryNote')).toBeVisible();
```

### AI1-7: 会計導線

```typescript
// カルテ保存後に「会計入力へ進む」ボタンが出ること
// → 保存動作が必要なため完全自動化は難しい。ボタンのラベル存在確認のみ
```

### AI1-8: 既存レポート影響なし → smoke.spec.ts で確認済み

### AI1-9: モバイル表示 → smoke.spec.ts で確認済み

---

## 人間確認が必要な項目（自動化しない）

### AI1-2: 既存患者編集・復元確認

1. 患者一覧から既存患者を選択
2. 「患者情報を編集」をクリック
3. 職業・既往歴の欄に値が表示されること（または空欄のまま表示されること）
4. 値を入力・保存して患者詳細に戻る
5. 詳細画面に職業・既往歴が表示されること

### AI1-5: カルテ再編集・復元確認

1. 既存カルテ（受傷起点入力済み）を再編集
2. 受傷起点・今回追記既往歴の値が復元されること
3. 修正して保存 → 同じ visitKey で更新されること

### AI1-6: 既存データ互換確認

1. 職業・既往歴が空欄の既存患者でカルテ入力画面を開く
2. エラーが出ないこと
3. 受傷起点・今回追記既往歴が空欄のカルテを再編集
4. エラーが出ないこと

---

## ai1.spec.ts 実装時の注意事項

- GAS /dev は認証済みセッション（storageState）が必要
- `visitForm` ページは `?id=P0001` などの有効な patientId が必要
- GAS iframe の DOM アクセスには `page.frameLocator()` が必要になる可能性あり
- 詳細: `docs/GAS_LIVE_CHECK_NOTES.md`
