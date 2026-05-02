# AI1 LiveCheck TODO — JREC-SF01 Phase AI-1

Phase AI-1（患者マスター・カルテ項目追加）の HEAD /dev 実機確認項目。
自動化可能な項目と人間確認が必要な項目に分類する。

clasp push 済み: 2026-05-02（commit cd726cc）
versioned deployment: 未実施（HEAD /dev 確認後に @36 として実施）

LC-2 PASS: 2026-05-02（smoke 16 passed / auth.json CDP 方式で取得済み）
LC-3 実装: 2026-05-02（ai1.spec.ts 作成。実行: npm run test:jrec:ai1）
LC-3 修正: 2026-05-02（frameLocator廃止 → page.locator() + AI1-4 SKIP条件追加）

HEAD /dev URL:
https://script.google.com/macros/s/AKfycbzJWJAKCxStP82lfFl8eEHei98dWh7f6cgtEM33r3M5/dev

---

## 現在の実行結果（2026-05-02 時点・作業中断）

```
npm run test:jrec:ai1
9 tests
1 passed  (AI1-7: dailyCheckout #dateForm)
4 failed  (AI1-1a/b/c, AI1-7旧体制の残存影響)
4 skipped (AI1-3, AI1-4a/b, AI1-8/9 参照)
```

**失敗原因の切り分け状況:**

| 原因候補 | 状態 |
|---|---|
| frameLocator 誤用 | ✅ 修正済み（page.locator() に変更）|
| visitForm patientId 必須 | ✅ 修正済み（AI1-4 は SKIP に変更） |
| clasp push 未反映 | 不明（commit 記録では実施済みだが要確認） |
| page.locator() での再実行結果 | ⏸ **未実行（作業中断）** |

**iframe 構造の確定知見（2026-05-03 error-context.md スナップショットより）:**

GAS /dev は 2段入れ子 iframe 構造:
```
page (top)
└─ iframe (outer)          ← frameLocator('iframe').first()
   └─ iframe (inner)       ← .frameLocator('iframe').first()
      └─ GAS コンテンツ（#occupation 等はここ）
```

- `page.locator('#occupation')` → ❌ フレームを越えられない
- `frameLocator('iframe[src*="googleusercontent"]').first()` → ❌ 外側 iframe（内側にアクセスできない）
- 正しい候補: `page.frameLocator('iframe').first().frameLocator('iframe').first().locator('#occupation')`

**次回再開時の最初にやること:**

1. ai1.spec.ts の frameLocator を 2段構造に修正する
2. `npm run test:jrec:ai1` を実行して AI1-1 PASS を確認
3. AI1-4 も patientId 付きで実行できれば確認する

修正候補コード（ai1.spec.ts）:
```typescript
const gasFrame = page.frameLocator('iframe').first().frameLocator('iframe').first();
await expect(gasFrame.locator('#occupation')).toBeVisible({ timeout: 25_000 });
```

---

## 確認項目 AI1-1〜AI1-9

| Test | 自動化分類 | 確認内容 | 判定 |
|---|---|---|---|
| AI1-1 | 🤖 自動化可能 | 新規患者登録画面に「職業」「既往歴」の入力欄が表示される | 🔧 実装済み / 再実行待ち |
| AI1-2 | 👤 人間確認 | 既存患者編集で「職業」「既往歴」が復元される（既存データ依存） | ⏸ |
| AI1-3 | 🤖→👤 条件付き | カルテ入力画面に患者情報参照欄（性別・年齢・職業・既往歴ブロック）が見える | 🔧 patientIdForVisitForm 設定で自動化可 / 未設定はSKIP |
| AI1-4 | 🤖→👤 条件付き | カルテ入力に「受傷起点」「今回追記既往歴」のラベル・テキストエリアが表示される | 🔧 patientIdForVisitForm 設定で自動化可 / 未設定はSKIP |
| AI1-5 | 👤 人間確認 | カルテ再編集時に「受傷起点」「今回追記既往歴」が復元される（データ依存） | ⏸ |
| AI1-6 | 👤 人間確認 | 既存患者（空欄）・既存カルテ（空欄）でエラーメッセージが出ない | ⏸ |
| AI1-7 | 🤖 部分自動化 | dailyCheckout 到達確認済み / 「会計入力へ進む」ボタンは保存後出現のため手動確認 | ✅ #dateForm PASS（LC-3修正後） |
| AI1-8 | ✅ smoke 確認済 | home / dailyCheckout / monthlyReport / menuSalesReport / outstandingReport が開く | ✅ smoke.spec.ts で 16 PASS |
| AI1-9 | ✅ smoke 確認済 | 追加項目によりモバイル表示（390px幅）が大きく崩れない | ✅ smoke.spec.ts で PASS |

---

## ai1.spec.ts 実装済み内容（2026-05-02）

### 注意事項（LC-3 調査で確定）

- **GAS /dev はトップレベルページとして描画される**（googleusercontent iframe ではない）
- `page.title()` が GAS タイトルを返すことで確認済み
- DOM アクセスは `page.locator()` を使う（`frameLocator` は不要）
- `visitForm` は patientId 必須（Main.gs: idParam なし → renderError_）
- 詳細: `docs/GAS_LIVE_CHECK_NOTES.md`

### AI1-1: 新規患者登録画面

```typescript
await expect(page.locator('#occupation')).toBeVisible({ timeout: 25_000 });
await expect(page.locator('#medicalHistory')).toBeVisible({ timeout: 25_000 });
await expect(page.getByText("AI補助判定用情報", { exact: false })).toBeVisible();
```

### AI1-3/AI1-4: カルテ入力画面（patientId 設定時のみ実行）

```typescript
// config.json の testData.patientIdForVisitForm に有効な患者IDを設定してから実行
await page.goto(`${devUrl}?page=visitForm&id=${TEST_PATIENT_ID}`);
await expect(page.locator('#injuryTrigger')).toBeVisible();
await expect(page.locator('#relatedHistoryNote')).toBeVisible();
```

### AI1-7: 会計導線

```typescript
// dailyCheckout ページ固有の要素で画面描画を確認
await expect(page.locator('#dateForm')).toBeVisible({ timeout: 25_000 });
```

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
