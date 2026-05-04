# Google Sheets 全シート構成・列定義

作成日：2026-05-04

このファイルはGoogle Sheetsの構造仕様の正本（single source of truth）である。
スプレッドシートを変更した場合は必ずこのファイルも更新すること。

---

## スプレッドシート構成

| シート名 | 日本語名 | 行数（初期） | 備考 |
|---|---|---|---|
| Members | 会員マスタ | 1（ヘッダーのみ） | 会員登録後に行が追加される |
| IntakeApplications | 入会申込 | 1（ヘッダーのみ） | |
| MembershipPlans | コースマスタ | 2以上 | 初期データを投入する |
| FeeRules | 料金ルール | 2以上 | 初期データを投入する |
| Payments | 支払い記録 | 1（ヘッダーのみ） | |
| StatusHistory | ステータス変更履歴 | 1（ヘッダーのみ） | |
| KeyCards | 鍵番号管理 | 2以上 | 全鍵番号の初期データを投入する |
| Referrals | 紹介者管理 | 1（ヘッダーのみ） | |
| BillingExports | 集金代行データ | 1（ヘッダーのみ） | |
| AuditLogs | 操作ログ | 1（ヘッダーのみ） | |
| Settings | システム設定 | 2以上 | 初期設定値を投入する |

---

## Members シート — ヘッダー行

A列から順に以下の列を設定する。

```
member_id | family_name | given_name | family_name_kana | given_name_kana | birth_date | gender | postal_code | prefecture | city | address1 | address2 | phone_home | phone_mobile | email | emergency_contact_name | emergency_contact_relation | emergency_contact_phone | occupation | plan_id | key_card_number | join_date | status | referrer_member_id | intake_application_id | notes | created_at | updated_at | created_by
```

| 列 | フィールド名 | 型 | 必須 |
|---|---|---|---|
| A | member_id | TEXT | 必須 |
| B | family_name | TEXT | 必須 |
| C | given_name | TEXT | 必須 |
| D | family_name_kana | TEXT | 必須 |
| E | given_name_kana | TEXT | 必須 |
| F | birth_date | DATE | 必須 |
| G | gender | TEXT | 必須 |
| H | postal_code | TEXT | 必須 |
| I | prefecture | TEXT | 必須 |
| J | city | TEXT | 必須 |
| K | address1 | TEXT | 必須 |
| L | address2 | TEXT | 任意 |
| M | phone_home | TEXT | 任意 |
| N | phone_mobile | TEXT | 必須 |
| O | email | TEXT | 任意 |
| P | emergency_contact_name | TEXT | 必須 |
| Q | emergency_contact_relation | TEXT | 必須 |
| R | emergency_contact_phone | TEXT | 必須 |
| S | occupation | TEXT | 任意 |
| T | plan_id | TEXT | 必須 |
| U | key_card_number | TEXT | 必須 |
| V | join_date | DATE | 必須 |
| W | status | TEXT | 必須 |
| X | referrer_member_id | TEXT | 任意 |
| Y | intake_application_id | TEXT | 必須 |
| Z | notes | TEXT | 任意 |
| AA | created_at | DATETIME | 必須 |
| AB | updated_at | DATETIME | 必須 |
| AC | created_by | TEXT | 必須 |

---

## IntakeApplications シート — ヘッダー行

```
application_id | application_date | family_name | given_name | family_name_kana | given_name_kana | birth_date | gender | postal_code | prefecture | city | address1 | address2 | phone_home | phone_mobile | email | emergency_contact_name | emergency_contact_relation | emergency_contact_phone | occupation | plan_id | referrer_member_id | notes | privacy_agreed | review_status | reviewed_by | reviewed_at | assigned_member_id | assigned_key_card_number | rejection_reason
```

---

## MembershipPlans シート — ヘッダー行

```
plan_id | plan_name | monthly_fee | enrollment_fee | card_key_fee | description | is_active | display_order | created_at | updated_at
```

### 初期データ例（オーナーが確定する）

| plan_id | plan_name | monthly_fee | enrollment_fee | card_key_fee | is_active | display_order |
|---|---|---|---|---|---|---|
| PLAN-001 | 一般コース | 要確認 | 要確認 | 要確認 | TRUE | 1 |
| PLAN-002 | 学生コース | 要確認 | 要確認 | 要確認 | TRUE | 2 |

---

## FeeRules シート — ヘッダー行

```
rule_id | rule_name | rule_type | value | unit | description | effective_from | effective_to
```

### 初期データ例

| rule_id | rule_name | rule_type | value | unit | description | effective_from |
|---|---|---|---|---|---|---|
| RULE-001 | 日割り端数処理 | prorating | 0 | - | floor=切り捨て | 2026-05-01 |

---

## Payments シート — ヘッダー行

```
payment_id | member_id | payment_type | payment_date | amount | breakdown | payment_method | billing_month | notes | created_at | created_by
```

---

## StatusHistory シート — ヘッダー行

```
history_id | member_id | change_type | status_before | status_after | effective_date | end_date | reason | processed_by | created_at | notes
```

---

## KeyCards シート — ヘッダー行

```
key_card_number | status | member_id | issued_date | returned_date | notes | updated_at
```

### 初期データ

全鍵番号を事前に登録する。使用前はstatus = available。

| key_card_number | status |
|---|---|
| K-001 | available |
| K-002 | available |
| ... | ... |

登録する鍵番号の範囲はオーナーが確認して初期設定時に入力する。

---

## Referrals シート — ヘッダー行

```
referral_id | referrer_member_id | referred_member_id | referral_date | benefit_applied | benefit_description | notes
```

---

## BillingExports シート — ヘッダー行

```
export_id | billing_month | export_date | exported_by | member_count | total_amount | file_name | status | submitted_date | notes
```

---

## AuditLogs シート — ヘッダー行

```
log_id | log_date | operator | action | target_sheet | target_id | field_name | old_value | new_value | description
```

---

## Settings シート — ヘッダー行

```
setting_key | setting_value | description | updated_at
```

### 初期データ

| setting_key | setting_value | description |
|---|---|---|
| gym_name | トレーニングジム ワイルドボア | ジム名 |
| gym_address | 兵庫県朝来市立野169-1 | ジム住所 |
| member_id_prefix | W | 会員番号プレフィックス |
| member_id_digits | 4 | 会員番号の桁数（プレフィックス除く） |
| key_card_prefix | K | 鍵番号プレフィックス |
| key_card_digits | 3 | 鍵番号の桁数（プレフィックス除く） |
| card_key_fee | 要確認 | カードキー発行料（円） |
| billing_cutoff_day | 要確認 | 請求締め日 |
| pause_max_months | 要確認 | 最長休会月数 |
| pause_fee_enabled | 要確認 | 休会費徴収フラグ（TRUE/FALSE） |

---

## 列幅・書式設定の方針

| 列の種類 | 書式 |
|---|---|
| 日付（DATE） | YYYY/MM/DD 形式で表示 |
| 日時（DATETIME） | YYYY/MM/DD HH:mm:ss 形式で表示 |
| 金額（NUMBER） | 整数（カンマ区切り） |
| 真偽値（BOOLEAN） | TRUE / FALSE |
| ステータス | 入力規則（ドロップダウン）を設定する |

## 入力規則の設定

| シート | 列 | 入力規則 |
|---|---|---|
| Members | status | active, pause, withdrawn |
| Members | gender | male, female, other |
| IntakeApplications | review_status | pending, approved, rejected |
| IntakeApplications | gender | male, female, other |
| KeyCards | status | in_use, available, lost, damaged |
| StatusHistory | change_type | pause, withdraw, restart |
| Payments | payment_type | initial, monthly, other |
| Payments | payment_method | cash, bank_transfer |
