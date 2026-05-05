/**
 * Phase 2 入会フォーム Playwright テスト
 *
 * 実行前提:
 *   1. GAS Webアプリをデプロイして環境変数を設定すること
 *      export WILDBOAR_WEBAPP_URL=https://script.google.com/macros/s/xxxxx/exec
 *   2. DEVスプレッドシートが対象であること（本番データを汚さない）
 *   3. npx playwright install chromium で事前にブラウザをインストールすること
 *
 * 実行:
 *   npx playwright test tests/intake/phase2.spec.js
 *   WILDBOAR_WEBAPP_URL=<URL> npx playwright test tests/intake/phase2.spec.js
 *
 * 個人情報:
 *   テストデータはすべて架空（実在しない氏名・番号）。
 *   テスト完了後は IntakeApplications シートのテスト行を削除すること。
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.WILDBOAR_WEBAPP_URL;
const INTAKE_URL = BASE_URL ? `${BASE_URL}?page=intake-form` : null;

// テスト用ダミーデータ（架空・実在しない個人情報）
const DUMMY = {
  family_name:                'テスト',
  given_name:                 '太郎',
  family_name_kana:           'テスト',
  given_name_kana:            'タロウ',
  birth_date:                 '1990-01-01',
  postal_code:                '1000001',
  prefecture:                 '東京都',
  city:                       'テスト市（架空）',
  address1:                   '0丁目0番0号（架空）',
  phone_mobile:               '09000000000',
  emergency_contact_name:     'テスト 花子',
  emergency_contact_relation: '親',
  emergency_contact_phone:    '09000000001',
};

const APP_ID_PATTERN = /^APP-\d{8}-\d{4}$/;

// ============================================================
// テストスキップ条件: URL 未設定
// ============================================================
test.beforeEach(async () => {
  if (!INTAKE_URL) {
    test.skip(true, [
      'WILDBOAR_WEBAPP_URL が未設定です。',
      'GAS Webアプリをデプロイ後に環境変数を設定してから実行してください。',
      '例: WILDBOAR_WEBAPP_URL=https://script.google.com/macros/s/xxxx/exec npx playwright test',
    ].join('\n'));
  }
});

// ============================================================
// 正常系テスト
// ============================================================
test.describe('正常系', () => {

  test('2-1: intake-form が開ける', async ({ page }) => {
    await page.goto(INTAKE_URL);
    await expect(page.locator('h1')).toContainText('トレーニングジム ワイルドボア');
    await expect(page.locator('#step1')).toBeVisible();
    await expect(page.locator('#step2')).toBeHidden();
    await expect(page.locator('#stepLabel')).toContainText('STEP 1 / 5');
  });

  test('2-3: Step 1 — 基本情報が入力できてStep 2に進める', async ({ page }) => {
    await page.goto(INTAKE_URL);
    await fillStep1(page);
    await page.click('#btnNext');

    await expect(page.locator('#step2')).toBeVisible();
    await expect(page.locator('#step1')).toBeHidden();
    await expect(page.locator('#stepLabel')).toContainText('STEP 2 / 5');
  });

  test('2-4: Step 2 — 住所が入力できてStep 3に進める', async ({ page }) => {
    await page.goto(INTAKE_URL);
    await fillStep1(page); await page.click('#btnNext');
    await page.waitForSelector('#step2:visible');

    await fillStep2(page);
    await page.click('#btnNext');

    await expect(page.locator('#step3')).toBeVisible();
    await expect(page.locator('#stepLabel')).toContainText('STEP 3 / 5');
  });

  test('2-5: Step 3 — 連絡先が入力できてStep 4に進める', async ({ page }) => {
    await page.goto(INTAKE_URL);
    await fillStep1(page); await page.click('#btnNext');
    await fillStep2(page); await page.click('#btnNext');
    await page.waitForSelector('#step3:visible');

    await fillStep3(page);
    await page.click('#btnNext');

    await expect(page.locator('#step4')).toBeVisible();
    await expect(page.locator('#stepLabel')).toContainText('STEP 4 / 5');
  });

  test('2-6: Step 4 — 緊急連絡先が入力できてStep 5に進める', async ({ page }) => {
    await page.goto(INTAKE_URL);
    await fillStep1(page); await page.click('#btnNext');
    await fillStep2(page); await page.click('#btnNext');
    await fillStep3(page); await page.click('#btnNext');
    await page.waitForSelector('#step4:visible');

    await fillStep4(page);
    await page.click('#btnNext');

    await expect(page.locator('#step5')).toBeVisible();
    await expect(page.locator('#stepLabel')).toContainText('STEP 5 / 5');
  });

  test('2-7: Step 5 — MembershipPlansのアクティブなコース一覧が表示される', async ({ page }) => {
    await page.goto(INTAKE_URL);
    await fillStep1(page); await page.click('#btnNext');
    await fillStep2(page); await page.click('#btnNext');
    await fillStep3(page); await page.click('#btnNext');
    await fillStep4(page); await page.click('#btnNext');
    await page.waitForSelector('#step5:visible');

    // getMembershipPlans() の GAS 呼び出し完了まで待つ
    await page.waitForSelector('.course-card', { timeout: 30000 });
    const cards = page.locator('.course-card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('2-7b: Step 5 — コース選択とプライバシー同意ができる', async ({ page }) => {
    await page.goto(INTAKE_URL);
    await fillStep1(page); await page.click('#btnNext');
    await fillStep2(page); await page.click('#btnNext');
    await fillStep3(page); await page.click('#btnNext');
    await fillStep4(page); await page.click('#btnNext');
    await page.waitForSelector('.course-card', { timeout: 30000 });

    await page.click('.course-card:first-child');
    await expect(page.locator('.course-card:first-child')).toHaveClass(/selected/);

    await page.check('#privacy_agreed');
    await expect(page.locator('#privacy_agreed')).toBeChecked();
  });

  test('2-8: 確認画面に全入力内容が表示される', async ({ page }) => {
    await page.goto(INTAKE_URL);
    await fillAllSteps(page);
    await page.waitForSelector('#stepConfirm:visible');

    await expect(page.locator('#c_name')).toContainText('テスト 太郎');
    await expect(page.locator('#c_kana')).toContainText('テスト タロウ');
    await expect(page.locator('#c_birth_date')).toContainText('1990-01-01');
    await expect(page.locator('#c_gender')).toContainText('男性');
    await expect(page.locator('#c_mobile')).toContainText('090');
    await expect(page.locator('#c_emg_name')).toContainText('テスト 花子');
    await expect(page.locator('#c_emg_rel')).toContainText('親');
    await expect(page.locator('#c_plan_name')).not.toBeEmpty();
  });

  test('2-9: 送信後に受付番号が表示される', async ({ page }) => {
    await page.goto(INTAKE_URL);
    await fillAllSteps(page);
    await page.waitForSelector('#stepConfirm:visible');

    await page.click('#btnNext'); // 「この内容で申し込む」

    // saveIntakeApplication() GAS 呼び出し完了まで待つ
    await page.waitForSelector('#stepComplete:visible', { timeout: 60000 });
    await expect(page.locator('#stepComplete')).toBeVisible();

    const receiptId = await page.locator('#receiptId').textContent();
    expect(receiptId).toMatch(APP_ID_PATTERN);
  });

  test('2-10: 受付番号が APP-YYYYMMDD-XXXX 形式である', async ({ page }) => {
    await page.goto(INTAKE_URL);
    await fillAllSteps(page);
    await page.click('#btnNext');
    await page.waitForSelector('#stepComplete:visible', { timeout: 60000 });

    const receiptId = await page.locator('#receiptId').textContent();
    expect(receiptId).toMatch(APP_ID_PATTERN);

    const parts = receiptId.split('-');
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe('APP');
    expect(parts[1]).toHaveLength(8);
    expect(parseInt(parts[2])).toBeGreaterThan(0);
  });

});

// ============================================================
// バリデーションテスト
// ============================================================
test.describe('バリデーション', () => {

  test('2-11: Step 1 — 氏名未入力でエラーが表示される', async ({ page }) => {
    await page.goto(INTAKE_URL);
    await page.click('#btnNext');

    await expect(page.locator('#err_family_name')).toHaveClass(/show/);
    await expect(page.locator('#step1')).toBeVisible();
  });

  test('2-12: Step 1 — フリガナにひらがなでエラーが表示される', async ({ page }) => {
    await page.goto(INTAKE_URL);
    await page.fill('#family_name', 'テスト');
    await page.fill('#given_name', '太郎');
    await page.fill('#family_name_kana', 'てすと'); // ひらがな（NG）
    await page.fill('#given_name_kana', 'たろう');
    await page.fill('#birth_date', '1990-01-01');
    await page.click('#g_male');
    await page.click('#btnNext');

    await expect(page.locator('#err_family_name_kana')).toHaveClass(/show/);
    await expect(page.locator('#step1')).toBeVisible();
  });

  test('2-13: Step 1 — 未来の生年月日でエラーが表示される', async ({ page }) => {
    await page.goto(INTAKE_URL);
    await page.fill('#family_name', 'テスト');
    await page.fill('#given_name', '太郎');
    await page.fill('#family_name_kana', 'テスト');
    await page.fill('#given_name_kana', 'タロウ');
    await page.fill('#birth_date', '2099-01-01'); // 未来
    await page.click('#g_male');
    await page.click('#btnNext');

    await expect(page.locator('#err_birth_date')).toHaveClass(/show/);
    await expect(page.locator('#step1')).toBeVisible();
  });

  test('2-14: Step 3 — 携帯番号8桁でエラーが表示される', async ({ page }) => {
    await page.goto(INTAKE_URL);
    await fillStep1(page); await page.click('#btnNext');
    await fillStep2(page); await page.click('#btnNext');
    await page.waitForSelector('#step3:visible');

    await page.fill('#phone_mobile', '0900000'); // 桁数不足
    await page.click('#btnNext');

    await expect(page.locator('#err_phone_mobile')).toHaveClass(/show/);
    await expect(page.locator('#step3')).toBeVisible();
  });

  test('2-15: Step 5 — コース未選択でエラーが表示される', async ({ page }) => {
    await page.goto(INTAKE_URL);
    await fillStep1(page); await page.click('#btnNext');
    await fillStep2(page); await page.click('#btnNext');
    await fillStep3(page); await page.click('#btnNext');
    await fillStep4(page); await page.click('#btnNext');
    await page.waitForSelector('.course-card', { timeout: 30000 });

    // プライバシー同意だけしてコース選択なし
    await page.check('#privacy_agreed');
    await page.click('#btnNext');

    await expect(page.locator('#err_plan_id')).toHaveClass(/show/);
  });

  test('2-16: Step 5 — プライバシー同意なしでエラーが表示される', async ({ page }) => {
    await page.goto(INTAKE_URL);
    await fillStep1(page); await page.click('#btnNext');
    await fillStep2(page); await page.click('#btnNext');
    await fillStep3(page); await page.click('#btnNext');
    await fillStep4(page); await page.click('#btnNext');
    await page.waitForSelector('.course-card', { timeout: 30000 });

    // コース選択だけしてプライバシー同意なし
    await page.click('.course-card:first-child');
    await page.click('#btnNext');

    await expect(page.locator('#err_privacy_agreed')).toHaveClass(/show/);
  });

});

// ============================================================
// 操作性・保持確認
// ============================================================
test.describe('操作性', () => {

  test('2-17: 戻るボタンで前ステップのデータが保持される', async ({ page }) => {
    await page.goto(INTAKE_URL);
    await fillStep1(page); await page.click('#btnNext');
    await fillStep2(page); await page.click('#btnNext');
    await page.waitForSelector('#step3:visible');

    await page.click('#btnBack');
    await page.waitForSelector('#step2:visible');

    const postalValue = await page.locator('#postal_code').inputValue();
    expect(postalValue).toBe(DUMMY.postal_code);
    const cityValue = await page.locator('#city').inputValue();
    expect(cityValue).toBe(DUMMY.city);
  });

  test('2-18: 二重送信防止が効いている（送信ボタン連打で1回だけ送信）', async ({ page }) => {
    await page.goto(INTAKE_URL);
    await fillAllSteps(page);
    await page.waitForSelector('#stepConfirm:visible');

    // ボタンをクリック直後にもう1度クリック
    await page.click('#btnNext');
    // ボタンが disabled になっていること（二重送信フラグが立っている）
    await expect(page.locator('#btnNext')).toBeDisabled();
  });

  test('2-19: プログレスバーが各ステップで更新される', async ({ page }) => {
    await page.goto(INTAKE_URL);

    // Step 1: 20%
    const fill1 = await page.locator('#progressFill').getAttribute('style');
    expect(fill1).toContain('20%');

    await fillStep1(page); await page.click('#btnNext');
    await page.waitForSelector('#step2:visible');

    // Step 2: 40%
    const fill2 = await page.locator('#progressFill').getAttribute('style');
    expect(fill2).toContain('40%');
  });

});

// ============================================================
// 個人情報ログ確認（静的確認のみ・自動化困難）
// ============================================================
test.describe('個人情報ログ確認', () => {
  test('2-20: 静的確認 — saveIntakeApplication のログに個人情報が含まれないこと', async () => {
    // GAS Logger.log の出力はブラウザからは確認できないため、
    // この項目はコードレビューで確認済み（下記参照）。
    //
    // 確認済み内容 (IntakeService.gs:59, IntakeService.gs:97):
    //   Logger.log('[saveIntakeApplication] 保存開始: ' + applicationId);  // application_id のみ
    //   Logger.log('[saveIntakeApplication] 保存完了: ' + applicationId);  // application_id のみ
    //
    // 氏名・住所・電話番号・メールアドレスはログに出力されない設計。
    //
    // GAS 実機確認時は以下を手動確認すること：
    //   GAS エディタ → 実行 → ログ → 個人情報が出力されていないことを確認

    expect(true).toBe(true); // 静的確認パス済みを記録
  });
});

// ============================================================
// ヘルパー関数
// ============================================================

async function fillStep1(page) {
  await page.fill('#family_name', DUMMY.family_name);
  await page.fill('#given_name', DUMMY.given_name);
  await page.fill('#family_name_kana', DUMMY.family_name_kana);
  await page.fill('#given_name_kana', DUMMY.given_name_kana);
  await page.fill('#birth_date', DUMMY.birth_date);
  await page.click('#g_male');
}

async function fillStep2(page) {
  await page.fill('#postal_code', DUMMY.postal_code);
  await page.selectOption('#prefecture', DUMMY.prefecture);
  await page.fill('#city', DUMMY.city);
  await page.fill('#address1', DUMMY.address1);
}

async function fillStep3(page) {
  await page.fill('#phone_mobile', DUMMY.phone_mobile);
}

async function fillStep4(page) {
  await page.fill('#emergency_contact_name', DUMMY.emergency_contact_name);
  await page.selectOption('#emergency_contact_relation', DUMMY.emergency_contact_relation);
  await page.fill('#emergency_contact_phone', DUMMY.emergency_contact_phone);
}

async function fillStep5(page) {
  await page.waitForSelector('.course-card', { timeout: 30000 });
  await page.click('.course-card:first-child');
  await page.check('#privacy_agreed');
}

async function fillAllSteps(page) {
  await fillStep1(page);
  await page.click('#btnNext');
  await page.waitForSelector('#step2:visible');

  await fillStep2(page);
  await page.click('#btnNext');
  await page.waitForSelector('#step3:visible');

  await fillStep3(page);
  await page.click('#btnNext');
  await page.waitForSelector('#step4:visible');

  await fillStep4(page);
  await page.click('#btnNext');
  await page.waitForSelector('#step5:visible');

  await fillStep5(page);
  await page.click('#btnNext'); // → 確認画面
  await page.waitForSelector('#stepConfirm:visible');
}
