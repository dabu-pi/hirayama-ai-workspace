# Phase 2 入会フォーム実装 — AIへの引き継ぎプロンプト

このプロンプトはPhase 2（入会フォーム実装）を担当するAIへの引き継ぎです。

---

## このフェーズの目的

タブレット（iPad）から入力できる入会申込フォームを実装する。
フォームはGAS HTMLサービスで提供し、送信されたデータをIntakeApplicationsシートに保存する。

## 作業前に必ず読むファイル

1. `CONTEXT.md` — プロジェクト背景・重要ルール
2. `AI_RULES.md` — AIが守るべきルール
3. `docs/INTAKE_FORM_DESIGN.md` — 入会フォームの詳細設計（最重要）
4. `docs/MEMBER_FIELDS.md` — 各フィールドの定義・バリデーションルール
5. `gas-project/IntakeService.gs` — バックエンドのスタブ
6. `gas-project/ValidationService.gs` — バリデーション関数のスタブ
7. `gas-project/html/intake-form.html` — 実装するHTMLのスタブ
8. `gas-project/html/intake-confirm.html` — 確認画面HTMLのスタブ

## Phase 2 のタスク

### バックエンド（GAS）

- IntakeService.gs の実装
  - saveIntakeApplication(formData)
  - getIntakeApplications(reviewStatus)
  - getIntakeApplicationById(applicationId)
  - generateApplicationId()
- ValidationService.gs の実装
  - validateIntakeForm(formData)
  - validateName(value)
  - validateKana(value)
  - validatePostalCode(value)
  - validateMobilePhone(value)
  - validatePhone(value)
  - validateEmail(value)
  - validateBirthDate(value)
- FeeService.gs の補助関数実装（getDaysInMonth, getRemainingDays）

### フロントエンド（HTML）

- intake-form.html の実装
  - Step 1：基本情報（氏名・フリガナ・生年月日・性別・職業）
  - Step 2：住所（郵便番号・都道府県・市区町村・番地・建物名）
  - Step 3：連絡先（携帯・自宅・メール）
  - Step 4：緊急連絡先
  - Step 5：コース選択・紹介者・備考・プライバシー同意
  - ステップナビゲーション・進捗バー
  - リアルタイムバリデーション
  - sessionStorageへの入力保存（戻ったときに復元）
- intake-confirm.html の実装
  - 全入力内容の一覧表示
  - 「戻って修正する」ボタン
  - 「この内容で申し込む」ボタン（google.script.run で送信）
  - 送信完了画面（受付番号の表示）

## UI の要件

- タブレット（iPad横向き：1024px幅）に最適化する
- ボタンは最小44px以上の高さにする
- 電話番号フィールドにはtype="tel"を設定する
- 1ページに表示する項目は少なく抑える
- エラーメッセージは対象フィールドの直下に表示する

## バリデーションの実装方針

- フロントエンド（JavaScript）でリアルタイムバリデーションを行う
- バックエンド（GAS）でも必ず再検証する（フロントのみに依存しない）
- バリデーションルールは MEMBER_FIELDS.md を参照する

## 動作確認

- tests/manual-checklist.md の Phase 2 テスト項目を実施する
- 特にタブレット（iPad）での表示・操作を確認する

## 重要な注意事項

- フォームの送信先は google.script.run.saveIntakeApplication(formData) のみ（外部APIは使わない）
- 個人情報は IntakeApplications シートにのみ保存する
- フォームは認証不要（doGet で access = 'ANYONE' 設定済み）
- 金額をフロントエンドでハードコードしない（コースの月会費はMembershipPlansシートから動的取得）

## 完了条件

- iPad でフォームの全ステップが正常に動作する
- 申込後に IntakeApplications シートにデータが保存される
- review_status = pending が設定される
- 受付番号（application_id）が表示される
- tests/manual-checklist.md の Phase 2 項目が全て OK になっている
