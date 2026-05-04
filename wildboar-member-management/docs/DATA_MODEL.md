# データモデル設計

作成日：2026-05-04

GAS版（Google Sheets）のデータモデルを定義する。
Supabase版のスキーマは DATABASE_SCHEMA_WEBAPP.md を参照。

---

## シート一覧

| シート名 | 日本語名 | 役割 |
|---|---|---|
| Members | 会員マスタ | 正式登録済みの会員情報 |
| IntakeApplications | 入会申込 | タブレット入力された申込情報（確認待ち含む） |
| MembershipPlans | コースマスタ | 会員コース・プランの定義 |
| FeeRules | 料金ルール | 入会金・月会費・カードキー料金等 |
| Payments | 支払い記録 | 初回費用・月会費の支払い記録 |
| StatusHistory | ステータス変更履歴 | 休会・退会・再開の履歴 |
| KeyCards | 鍵番号管理 | 鍵番号と会員の対応 |
| Referrals | 紹介者管理 | 紹介元・紹介先の対応 |
| BillingExports | 集金代行データ | リコーリース提出用のエクスポート履歴 |
| AuditLogs | 操作ログ | 全操作の記録 |
| Settings | システム設定 | システム全体の設定値 |

---

## Members（会員マスタ）

正式登録済みの会員情報を管理する。IntakeApplicationsで申込が確認されたら、このシートに転記される。

| フィールド名 | 型 | 説明 | 必須 | 備考 |
|---|---|---|---|---|
| member_id | TEXT | 会員番号（主キー） | 必須 | 例：W-0001 |
| family_name | TEXT | 氏名（姓・漢字） | 必須 | |
| given_name | TEXT | 氏名（名・漢字） | 必須 | |
| family_name_kana | TEXT | 氏名（姓・カナ） | 必須 | 全角カタカナ |
| given_name_kana | TEXT | 氏名（名・カナ） | 必須 | 全角カタカナ |
| birth_date | DATE | 生年月日 | 必須 | YYYY-MM-DD形式 |
| gender | TEXT | 性別 | 必須 | male / female / other |
| postal_code | TEXT | 郵便番号 | 必須 | ハイフンなし7桁 |
| prefecture | TEXT | 都道府県 | 必須 | |
| city | TEXT | 市区町村 | 必須 | |
| address1 | TEXT | 番地 | 必須 | |
| address2 | TEXT | 建物名・部屋番号 | 任意 | |
| phone_home | TEXT | 自宅電話番号 | 任意 | |
| phone_mobile | TEXT | 携帯電話番号 | 必須 | |
| email | TEXT | メールアドレス | 任意 | |
| emergency_contact_name | TEXT | 緊急連絡先氏名 | 必須 | |
| emergency_contact_relation | TEXT | 緊急連絡先続柄 | 必須 | |
| emergency_contact_phone | TEXT | 緊急連絡先電話番号 | 必須 | |
| occupation | TEXT | 職業 | 任意 | |
| plan_id | TEXT | コースID（外部キー） | 必須 | MembershipPlans.plan_id参照 |
| key_card_number | TEXT | 鍵番号（外部キー） | 必須 | KeyCards.key_card_number参照 |
| join_date | DATE | 入会日 | 必須 | YYYY-MM-DD形式 |
| status | TEXT | ステータス | 必須 | active / paused / withdrawn |
| referrer_member_id | TEXT | 紹介者会員番号 | 任意 | Members.member_id参照 |
| intake_application_id | TEXT | 申込ID（外部キー） | 必須 | IntakeApplications.application_id参照 |
| notes | TEXT | 備考 | 任意 | |
| created_at | DATETIME | 登録日時 | 必須 | 自動設定 |
| updated_at | DATETIME | 最終更新日時 | 必須 | 自動更新 |
| created_by | TEXT | 登録スタッフ | 必須 | GASのセッションユーザー |

---

## IntakeApplications（入会申込）

タブレットから送信された入会申込を管理する。スタッフが確認・承認した後にMembersに転記する。

| フィールド名 | 型 | 説明 | 必須 | 備考 |
|---|---|---|---|---|
| application_id | TEXT | 申込ID（主キー） | 必須 | 自動採番 |
| application_date | DATETIME | 申込日時 | 必須 | 自動設定 |
| family_name | TEXT | 氏名（姓・漢字） | 必須 | |
| given_name | TEXT | 氏名（名・漢字） | 必須 | |
| family_name_kana | TEXT | 氏名（姓・カナ） | 必須 | |
| given_name_kana | TEXT | 氏名（名・カナ） | 必須 | |
| birth_date | DATE | 生年月日 | 必須 | |
| gender | TEXT | 性別 | 必須 | |
| postal_code | TEXT | 郵便番号 | 必須 | |
| prefecture | TEXT | 都道府県 | 必須 | |
| city | TEXT | 市区町村 | 必須 | |
| address1 | TEXT | 番地 | 必須 | |
| address2 | TEXT | 建物名・部屋番号 | 任意 | |
| phone_home | TEXT | 自宅電話番号 | 任意 | |
| phone_mobile | TEXT | 携帯電話番号 | 必須 | |
| email | TEXT | メールアドレス | 任意 | |
| emergency_contact_name | TEXT | 緊急連絡先氏名 | 必須 | |
| emergency_contact_relation | TEXT | 緊急連絡先続柄 | 必須 | |
| emergency_contact_phone | TEXT | 緊急連絡先電話番号 | 必須 | |
| occupation | TEXT | 職業 | 任意 | |
| plan_id | TEXT | 希望コースID | 必須 | |
| referrer_member_id | TEXT | 紹介者会員番号 | 任意 | |
| notes | TEXT | 備考 | 任意 | |
| review_status | TEXT | 確認ステータス | 必須 | pending / approved / rejected |
| reviewed_by | TEXT | 確認スタッフ | 任意 | |
| reviewed_at | DATETIME | 確認日時 | 任意 | |
| assigned_member_id | TEXT | 割り当て会員番号 | 任意 | 承認後に設定 |
| assigned_key_card_number | TEXT | 割り当て鍵番号 | 任意 | 承認後に設定 |
| rejection_reason | TEXT | 却下理由 | 任意 | |
| privacy_agreed | BOOLEAN | プライバシーポリシー同意 | 必須 | TRUE/FALSE |

---

## MembershipPlans（コースマスタ）

利用可能な会員コース・プランを管理する。

| フィールド名 | 型 | 説明 | 必須 | 備考 |
|---|---|---|---|---|
| plan_id | TEXT | コースID（主キー） | 必須 | 例：PLAN-001 |
| plan_name | TEXT | コース名 | 必須 | 例：一般コース |
| monthly_fee | NUMBER | 月会費（円） | 必須 | Settingsから参照推奨 |
| enrollment_fee | NUMBER | 入会金（円） | 必須 | |
| card_key_fee | NUMBER | カードキー発行料（円） | 必須 | |
| description | TEXT | コース説明 | 任意 | フォームに表示 |
| is_active | BOOLEAN | 有効フラグ | 必須 | 無効コースは選択不可 |
| display_order | NUMBER | 表示順 | 必須 | フォームでの表示順 |
| created_at | DATETIME | 登録日時 | 必須 | |
| updated_at | DATETIME | 更新日時 | 必須 | |

---

## FeeRules（料金ルール）

料金計算に使うルールを管理する。コードにハードコードせず、このシートから読み込む。

| フィールド名 | 型 | 説明 | 必須 | 備考 |
|---|---|---|---|---|
| rule_id | TEXT | ルールID（主キー） | 必須 | |
| rule_name | TEXT | ルール名 | 必須 | 例：日割り計算基準 |
| rule_type | TEXT | ルール種別 | 必須 | prorating / discount / surcharge |
| value | NUMBER | 値 | 必須 | |
| unit | TEXT | 単位 | 必須 | yen / percent / days |
| description | TEXT | 説明 | 任意 | |
| effective_from | DATE | 適用開始日 | 必須 | |
| effective_to | DATE | 適用終了日 | 任意 | 空欄は無期限 |

---

## Payments（支払い記録）

初回費用・月会費の支払い記録を管理する。

| フィールド名 | 型 | 説明 | 必須 | 備考 |
|---|---|---|---|---|
| payment_id | TEXT | 支払いID（主キー） | 必須 | |
| member_id | TEXT | 会員番号（外部キー） | 必須 | Members.member_id参照 |
| payment_type | TEXT | 支払い種別 | 必須 | initial / monthly / other |
| payment_date | DATE | 支払日 | 必須 | |
| amount | NUMBER | 金額（円） | 必須 | |
| breakdown | TEXT | 内訳（JSON形式） | 任意 | 入会金・日割り等の内訳 |
| payment_method | TEXT | 支払い方法 | 必須 | cash / bank_transfer |
| billing_month | TEXT | 対象月 | 任意 | YYYY-MM形式 |
| notes | TEXT | 備考 | 任意 | |
| created_at | DATETIME | 登録日時 | 必須 | |
| created_by | TEXT | 登録スタッフ | 必須 | |

---

## StatusHistory（ステータス変更履歴）

会員のステータス変更（休会・退会・再開）の履歴を管理する。

| フィールド名 | 型 | 説明 | 必須 | 備考 |
|---|---|---|---|---|
| history_id | TEXT | 履歴ID（主キー） | 必須 | |
| member_id | TEXT | 会員番号（外部キー） | 必須 | Members.member_id参照 |
| change_type | TEXT | 変更種別 | 必須 | pause / withdraw / restart |
| previous_status | TEXT | 変更前ステータス | 必須 | active / paused / withdrawn |
| new_status | TEXT | 変更後ステータス | 必須 | active / paused / withdrawn |
| effective_date | DATE | 適用日 | 必須 | |
| end_date | DATE | 終了予定日 | 任意 | 休会の場合に設定 |
| reason | TEXT | 理由 | 任意 | |
| notes | TEXT | 備考 | 任意 | |
| created_at | DATETIME | 記録日時 | 必須 | |
| created_by | TEXT | 処理スタッフ | 必須 | |

---

## KeyCards（鍵番号管理）

鍵番号と会員の対応を管理する。退会時に鍵が返却されたら再利用可能になる。

| フィールド名 | 型 | 説明 | 必須 | 備考 |
|---|---|---|---|---|
| key_card_number | TEXT | 鍵番号（主キー） | 必須 | 例：K-001 |
| status | TEXT | 状態 | 必須 | in_use / available / lost / damaged |
| member_id | TEXT | 使用中会員番号 | 任意 | Members.member_id参照 |
| issued_date | DATE | 発行日 | 任意 | |
| returned_date | DATE | 返却日 | 任意 | |
| notes | TEXT | 備考 | 任意 | 紛失・破損の場合等 |
| updated_at | DATETIME | 更新日時 | 必須 | |

---

## Referrals（紹介者管理）

会員の紹介実績を管理する。紹介特典の付与に使用する。

| フィールド名 | 型 | 説明 | 必須 | 備考 |
|---|---|---|---|---|
| referral_id | TEXT | 紹介ID（主キー） | 必須 | |
| referrer_member_id | TEXT | 紹介者会員番号 | 必須 | Members.member_id参照 |
| referred_member_id | TEXT | 入会者会員番号 | 必須 | Members.member_id参照 |
| referral_date | DATE | 紹介成立日 | 必須 | |
| benefit_applied | BOOLEAN | 特典適用済みフラグ | 必須 | |
| benefit_description | TEXT | 特典内容 | 任意 | |
| notes | TEXT | 備考 | 任意 | |

---

## BillingExports（集金代行データ）

リコーリース集金代行用データのエクスポート履歴を管理する。

| フィールド名 | 型 | 説明 | 必須 | 備考 |
|---|---|---|---|---|
| export_id | TEXT | エクスポートID（主キー） | 必須 | |
| billing_month | TEXT | 集金対象月 | 必須 | YYYY-MM形式 |
| export_date | DATETIME | エクスポート日時 | 必須 | |
| exported_by | TEXT | エクスポート実施者 | 必須 | |
| member_count | NUMBER | 対象会員数 | 必須 | |
| total_amount | NUMBER | 合計金額（円） | 必須 | |
| file_name | TEXT | 出力ファイル名 | 必須 | |
| status | TEXT | ステータス | 必須 | exported / submitted / completed |
| submitted_date | DATE | 提出日 | 任意 | |
| notes | TEXT | 備考 | 任意 | |

---

## AuditLogs（操作ログ）

すべての操作を記録する。誰が何をいつ変更したかを追跡できるようにする。

| フィールド名 | 型 | 説明 | 必須 | 備考 |
|---|---|---|---|---|
| log_id | TEXT | ログID（主キー） | 必須 | |
| log_date | DATETIME | 操作日時 | 必須 | |
| operator | TEXT | 操作者 | 必須 | GASのセッションユーザー |
| action | TEXT | 操作種別 | 必須 | create / update / delete / export |
| target_sheet | TEXT | 対象シート名 | 必須 | |
| target_id | TEXT | 対象レコードID | 必須 | |
| field_name | TEXT | 変更フィールド名 | 任意 | 更新の場合 |
| old_value | TEXT | 変更前の値 | 任意 | |
| new_value | TEXT | 変更後の値 | 任意 | |
| description | TEXT | 操作の説明 | 任意 | |

---

## Settings（システム設定）

システム全体の設定値を管理する。コードにハードコードする代わりにこのシートから読み込む。

| フィールド名 | 型 | 説明 | 必須 | 備考 |
|---|---|---|---|---|
| setting_key | TEXT | 設定キー（主キー） | 必須 | 例：member_id_prefix |
| setting_value | TEXT | 設定値 | 必須 | |
| description | TEXT | 説明 | 任意 | |
| updated_at | DATETIME | 更新日時 | 必須 | |

### 主な設定キー

| setting_key | 説明 | 例 |
|---|---|---|
| member_id_prefix | 会員番号のプレフィックス | W |
| member_id_digits | 会員番号の桁数 | 4 |
| key_card_prefix | 鍵番号のプレフィックス | K |
| key_card_digits | 鍵番号の桁数 | 3 |
| gym_name | ジム名 | トレーニングジム ワイルドボア |
| gym_address | ジム住所 | 兵庫県朝来市立野169-1 |
| billing_cutoff_day | 請求締め日（日） | 要確認 |
| pause_max_months | 最長休会月数 | 要確認 |
| pause_fee_enabled | 休会費徴収フラグ | TRUE/FALSE |
