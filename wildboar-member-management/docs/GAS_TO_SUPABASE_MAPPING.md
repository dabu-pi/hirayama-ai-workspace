# GAS/SheetsデータモデルとSupabase PostgreSQLのマッピング表

作成日：2026-05-04

GAS版（Google Sheets）の各シートとSupabase PostgreSQLのテーブル・カラムの対応を示す。

---

## Members シート → members テーブル

| Sheetsフィールド名 | 型 | Supabaseカラム名 | 型 | 変換・注意点 |
|---|---|---|---|---|
| member_id | TEXT | member_code | TEXT | 値はそのまま（例：W-0001） |
| （なし） | - | id | UUID | Supabase が自動生成 |
| family_name | TEXT | family_name | TEXT | そのまま |
| given_name | TEXT | given_name | TEXT | そのまま |
| family_name_kana | TEXT | family_name_kana | TEXT | 全角カタカナに統一 |
| given_name_kana | TEXT | given_name_kana | TEXT | 全角カタカナに統一 |
| birth_date | DATE | birth_date | DATE | YYYY-MM-DD に統一 |
| gender | TEXT | gender | TEXT | 男性→male, 女性→female, 回答しない→other |
| postal_code | TEXT | postal_code | TEXT | ハイフンなし7桁に統一 |
| prefecture | TEXT | prefecture | TEXT | そのまま |
| city | TEXT | city | TEXT | そのまま |
| address1 | TEXT | address1 | TEXT | そのまま |
| address2 | TEXT | address2 | TEXT | そのまま（NULLに変換） |
| phone_home | TEXT | phone_home | TEXT | ハイフン除去（NULLに変換） |
| phone_mobile | TEXT | phone_mobile | TEXT | ハイフン除去 |
| email | TEXT | email | TEXT | そのまま（NULLに変換） |
| emergency_contact_name | TEXT | emergency_contact_name | TEXT | そのまま |
| emergency_contact_relation | TEXT | emergency_contact_relation | TEXT | そのまま |
| emergency_contact_phone | TEXT | emergency_contact_phone | TEXT | ハイフン除去 |
| occupation | TEXT | occupation | TEXT | そのまま（NULLに変換） |
| plan_id | TEXT | plan_id | UUID | MembershipPlansのplan_codeからUUIDに変換 |
| key_card_number | TEXT | key_card_id | UUID | KeyCardsのkey_card_codeからUUIDに変換 |
| join_date | DATE | join_date | DATE | YYYY-MM-DD に統一 |
| status | TEXT | status | TEXT | 在籍→active, 休会→pause, 退会→withdrawn |
| referrer_member_id | TEXT | referrer_member_id | UUID | member_codeからUUIDに変換（NULLに変換） |
| intake_application_id | TEXT | intake_application_id | UUID | application_codeからUUIDに変換 |
| notes | TEXT | notes | TEXT | そのまま（NULLに変換） |
| created_at | DATETIME | created_at | TIMESTAMPTZ | UTCに変換 |
| updated_at | DATETIME | updated_at | TIMESTAMPTZ | UTCに変換 |
| created_by | TEXT | created_by | UUID | メールアドレスからauth.users.idに変換（変換できない場合はNULL） |

---

## IntakeApplications シート → intake_applications テーブル

| Sheetsフィールド名 | 型 | Supabaseカラム名 | 型 | 変換・注意点 |
|---|---|---|---|---|
| application_id | TEXT | application_code | TEXT | 値はそのまま |
| （なし） | - | id | UUID | Supabase が自動生成 |
| application_date | DATETIME | application_date | TIMESTAMPTZ | UTCに変換 |
| family_name | TEXT | family_name | TEXT | そのまま |
| given_name | TEXT | given_name | TEXT | そのまま |
| family_name_kana | TEXT | family_name_kana | TEXT | 全角カタカナに統一 |
| given_name_kana | TEXT | given_name_kana | TEXT | 全角カタカナに統一 |
| birth_date | DATE | birth_date | DATE | YYYY-MM-DD に統一 |
| gender | TEXT | gender | TEXT | 男性→male, 女性→female, 回答しない→other |
| postal_code | TEXT | postal_code | TEXT | ハイフンなし7桁に統一 |
| prefecture | TEXT | prefecture | TEXT | そのまま |
| city | TEXT | city | TEXT | そのまま |
| address1 | TEXT | address1 | TEXT | そのまま |
| address2 | TEXT | address2 | TEXT | NULLに変換 |
| phone_home | TEXT | phone_home | TEXT | ハイフン除去（NULLに変換） |
| phone_mobile | TEXT | phone_mobile | TEXT | ハイフン除去 |
| email | TEXT | email | TEXT | NULLに変換 |
| emergency_contact_name | TEXT | emergency_contact_name | TEXT | そのまま |
| emergency_contact_relation | TEXT | emergency_contact_relation | TEXT | そのまま |
| emergency_contact_phone | TEXT | emergency_contact_phone | TEXT | ハイフン除去 |
| occupation | TEXT | occupation | TEXT | NULLに変換 |
| plan_id | TEXT | plan_id | UUID | MembershipPlansのplan_codeからUUIDに変換 |
| referrer_member_id | TEXT | referrer_member_code | TEXT | Sheetsの値をそのまま（文字列）保存 |
| notes | TEXT | notes | TEXT | NULLに変換 |
| review_status | TEXT | review_status | TEXT | pending/approved/rejectedをそのまま |
| reviewed_by | TEXT | reviewed_by | UUID | メールアドレスからauth.users.idに変換（変換不可→NULL） |
| reviewed_at | DATETIME | reviewed_at | TIMESTAMPTZ | UTCに変換（NULLに変換） |
| rejection_reason | TEXT | rejection_reason | TEXT | NULLに変換 |
| privacy_agreed | BOOLEAN | privacy_agreed | BOOLEAN | TRUE/FALSEそのまま |

---

## MembershipPlans シート → membership_plans テーブル

| Sheetsフィールド名 | Supabaseカラム名 | 変換・注意点 |
|---|---|---|
| plan_id | plan_code | 値はそのまま（例：PLAN-001） |
| （なし） | id | Supabase が自動生成 |
| plan_name | plan_name | そのまま |
| monthly_fee | monthly_fee | 数値に変換 |
| enrollment_fee | enrollment_fee | 数値に変換 |
| card_key_fee | card_key_fee | 数値に変換 |
| description | description | NULLに変換 |
| is_active | is_active | TRUE/FALSEに変換 |
| display_order | display_order | 数値に変換 |

---

## FeeRules シート → fee_rules テーブル

| Sheetsフィールド名 | Supabaseカラム名 | 変換・注意点 |
|---|---|---|
| rule_id | （なし） | Supabase側ではUUID自動生成 |
| rule_name | rule_name | そのまま |
| rule_type | rule_type | そのまま |
| value | value | 数値に変換 |
| unit | unit | そのまま |
| description | description | NULLに変換 |
| effective_from | effective_from | DATE型に変換 |
| effective_to | effective_to | DATE型に変換（NULLに変換） |

---

## StatusHistory シート → status_histories テーブル

| Sheetsフィールド名 | Supabaseカラム名 | 変換・注意点 |
|---|---|---|
| history_id | （なし） | Supabase側ではUUID自動生成 |
| member_id | member_id | member_codeからUUIDに変換 |
| change_type | change_type | pause/withdraw/restart をそのまま |
| status_before | status_before | active/pause/withdrawnをそのまま |
| status_after | status_after | active/pause/withdrawnをそのまま |
| effective_date | effective_date | DATE型に変換 |
| end_date | end_date | DATE型に変換（NULLに変換） |
| reason | reason | NULLに変換 |
| processed_by | processed_by | メールアドレスからauth.users.idに変換（変換不可→NULL） |
| created_at | created_at | UTCに変換 |
| notes | notes | NULLに変換 |

---

## KeyCards シート → key_cards テーブル

| Sheetsフィールド名 | Supabaseカラム名 | 変換・注意点 |
|---|---|---|
| key_card_number | key_card_code | 値はそのまま（例：K-001） |
| （なし） | id | Supabase が自動生成 |
| status | status | in_use/available/lost/damagedをそのまま |
| member_id | member_id | member_codeからUUIDに変換（NULLに変換） |
| issued_date | issued_date | DATE型に変換（NULLに変換） |
| returned_date | returned_date | DATE型に変換（NULLに変換） |
| notes | notes | NULLに変換 |
| updated_at | updated_at | UTCに変換 |

---

## Payments シート → payments テーブル

| Sheetsフィールド名 | Supabaseカラム名 | 変換・注意点 |
|---|---|---|
| payment_id | （なし） | Supabase側ではUUID自動生成 |
| member_id | member_id | member_codeからUUIDに変換 |
| payment_type | payment_type | initial/monthly/other をそのまま |
| payment_date | payment_date | DATE型に変換 |
| amount | amount | 数値に変換（円） |
| breakdown | breakdown | JSON文字列→JSONBに変換 |
| payment_method | payment_method | cash/bank_transfer をそのまま |
| billing_month | billing_month | YYYY-MM形式を確認 |
| notes | notes | NULLに変換 |
| created_at | created_at | UTCに変換 |
| created_by | created_by | メールアドレスからauth.users.idに変換（変換不可→NULL） |

---

## Settings シート → settings テーブル

| Sheetsフィールド名 | Supabaseカラム名 | 変換・注意点 |
|---|---|---|
| setting_key | setting_key | そのまま |
| setting_value | setting_value | そのまま（TEXT型） |
| description | description | NULLに変換 |
| updated_at | updated_at | UTCに変換 |

---

## 変換できないデータの扱い

| ケース | 対応 |
|---|---|
| スタッフのメールアドレスからauth.users.idに変換できない | NULLに設定し、備考（notes）に「移行時NULL」と記録 |
| 日付のフォーマットが統一されていない | クレンジングスクリプトで統一してからインポート |
| 外部キー参照先のレコードが存在しない | インポート前にチェックし、問題があればスタッフが手動修正 |
| GAS版にのみ存在する列 | SupabaseのnotesフィールドにJSON形式で保存するか、別途検討 |

---

## 変換スクリプトの方針

- Python スクリプトで CSV を読み込み、変換処理を行い、Supabase に INSERT する
- 変換スクリプトは `scripts/migrate_gas_to_supabase.py` として作成する（Phase 11 で実装）
- テスト環境で実行後、問題がなければ本番環境で実行する
- 変換結果のレポートを CSV で出力し、件数・エラーを記録する
