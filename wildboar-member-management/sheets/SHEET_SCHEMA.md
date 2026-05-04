# Google Sheets 全シート構成・列定義

作成日：2026-05-04
更新日：2026-05-04（Phase 1 — ヘッダー確定・paused統一・フィールド名整合）

このファイルはGoogle Sheetsの構造仕様の正本（single source of truth）である。
スプレッドシートを変更した場合は必ずこのファイルも更新すること。

---

## スプレッドシート構成

| シート名 | 日本語名 | 行数（初期） | 備考 |
|---|---|---|---|
| Members | 会員マスタ | 1（ヘッダーのみ） | 会員登録後に行が追加される |
| IntakeApplications | 入会申込 | 1（ヘッダーのみ） | |
| MembershipPlans | コースマスタ | 7（ヘッダー + 初期6件） | 初期データを投入する |
| FeeRules | 料金ルール | 7（ヘッダー + 初期6件） | 初期データを投入する |
| Payments | 支払い記録 | 1（ヘッダーのみ） | |
| StatusHistory | ステータス変更履歴 | 1（ヘッダーのみ） | |
| KeyCards | 鍵番号管理 | 1以上 | オーナーが鍵番号を手動登録する |
| Referrals | 紹介者管理 | 1（ヘッダーのみ） | |
| BillingExports | 集金代行データ | 1（ヘッダーのみ） | |
| AuditLogs | 操作ログ | 1（ヘッダーのみ） | |
| Settings | システム設定 | 14（ヘッダー + 初期13件） | 初期設定値を投入する |

---

## Members シート — ヘッダー行（30列）

| 列 | フィールド名 | 型 | 必須 | 入力規則 |
|---|---|---|---|---|
| A | member_id | TEXT | 必須 | 例：W-0001 |
| B | family_name | TEXT | 必須 | |
| C | given_name | TEXT | 必須 | |
| D | family_name_kana | TEXT | 必須 | 全角カタカナ |
| E | given_name_kana | TEXT | 必須 | 全角カタカナ |
| F | birth_date | DATE | 必須 | YYYY-MM-DD |
| G | gender | TEXT | 必須 | ドロップダウン: male / female / other |
| H | postal_code | TEXT | 必須 | ハイフンなし7桁 |
| I | prefecture | TEXT | 必須 | |
| J | city | TEXT | 必須 | |
| K | address1 | TEXT | 必須 | |
| L | address2 | TEXT | 任意 | |
| M | phone_home | TEXT | 任意 | |
| N | phone_mobile | TEXT | 必須 | |
| O | email | TEXT | 任意 | |
| P | emergency_contact_name | TEXT | 必須 | |
| Q | emergency_contact_relation | TEXT | 必須 | |
| R | emergency_contact_phone | TEXT | 必須 | |
| S | occupation | TEXT | 任意 | |
| T | plan_id | TEXT | 必須 | MembershipPlans.plan_id参照 |
| U | key_card_number | TEXT | 必須 | KeyCards.key_card_number参照 |
| V | join_date | DATE | 必須 | YYYY-MM-DD |
| W | status | TEXT | 必須 | ドロップダウン: active / paused / withdrawn |
| X | referrer_member_id | TEXT | 任意 | Members.member_id参照 |
| Y | intake_application_id | TEXT | 必須 | IntakeApplications.application_id参照 |
| Z | notes | TEXT | 任意 | |
| AA | created_at | DATETIME | 必須 | 自動設定 |
| AB | updated_at | DATETIME | 必須 | 自動更新 |
| AC | created_by | TEXT | 必須 | 登録スタッフID |
| AD | updated_by | TEXT | 任意 | 最終更新スタッフID |

---

## IntakeApplications シート — ヘッダー行（32列）

| 列 | フィールド名 | 型 | 必須 | 入力規則 |
|---|---|---|---|---|
| A | application_id | TEXT | 必須 | 自動採番 |
| B | application_date | DATETIME | 必須 | 自動設定 |
| C | family_name | TEXT | 必須 | |
| D | given_name | TEXT | 必須 | |
| E | family_name_kana | TEXT | 必須 | |
| F | given_name_kana | TEXT | 必須 | |
| G | birth_date | DATE | 必須 | |
| H | gender | TEXT | 必須 | ドロップダウン: male / female / other |
| I | postal_code | TEXT | 必須 | |
| J | prefecture | TEXT | 必須 | |
| K | city | TEXT | 必須 | |
| L | address1 | TEXT | 必須 | |
| M | address2 | TEXT | 任意 | |
| N | phone_home | TEXT | 任意 | |
| O | phone_mobile | TEXT | 必須 | |
| P | email | TEXT | 任意 | |
| Q | emergency_contact_name | TEXT | 必須 | |
| R | emergency_contact_relation | TEXT | 必須 | |
| S | emergency_contact_phone | TEXT | 必須 | |
| T | occupation | TEXT | 任意 | |
| U | plan_id | TEXT | 必須 | |
| V | referrer_member_id | TEXT | 任意 | |
| W | notes | TEXT | 任意 | |
| X | privacy_agreed | BOOLEAN | 必須 | ドロップダウン: TRUE / FALSE |
| Y | review_status | TEXT | 必須 | ドロップダウン: pending / approved / rejected |
| Z | reviewed_by | TEXT | 任意 | |
| AA | reviewed_at | DATETIME | 任意 | |
| AB | assigned_member_id | TEXT | 任意 | 承認後に設定 |
| AC | assigned_key_card_number | TEXT | 任意 | 承認後に設定 |
| AD | rejection_reason | TEXT | 任意 | |
| AE | created_at | DATETIME | 必須 | |
| AF | updated_at | DATETIME | 必須 | |

---

## MembershipPlans シート — ヘッダー行（11列）

| 列 | フィールド名 | 型 | 必須 | 備考 |
|---|---|---|---|---|
| A | plan_id | TEXT | 必須 | 例：PLAN-001 |
| B | plan_name | TEXT | 必須 | |
| C | monthly_fee | NUMBER | 必須 | 月会費（円）※仮値は0 |
| D | enrollment_fee | NUMBER | 必須 | 入会金（円）※仮値は0 |
| E | card_key_fee | NUMBER | 必須 | カードキー発行料（円）※仮値は0 |
| F | description | TEXT | 任意 | フォームに表示するコース説明 |
| G | is_active | BOOLEAN | 必須 | ドロップダウン: TRUE / FALSE |
| H | display_order | NUMBER | 必須 | フォームでの表示順 |
| I | notes | TEXT | 任意 | ※金額が仮値の場合はnotesに記録 |
| J | created_at | DATETIME | 必須 | |
| K | updated_at | DATETIME | 必須 | |

### 初期データ（setupMembershipPlans()で投入）

| plan_id | plan_name | monthly_fee | enrollment_fee | card_key_fee | is_active | display_order |
|---|---|---|---|---|---|---|
| PLAN-001 | 一般会員 | 0（仮値） | 0（仮値） | 0（仮値） | TRUE | 1 |
| PLAN-002 | 女性会員 | 0（仮値） | 0（仮値） | 0（仮値） | TRUE | 2 |
| PLAN-003 | 学生会員 | 0（仮値） | 0（仮値） | 0（仮値） | TRUE | 3 |
| PLAN-004 | ペア会員 | 0（仮値） | 0（仮値） | 0（仮値） | TRUE | 4 |
| PLAN-005 | 法人会員 | 0（仮値） | 0（仮値） | 0（仮値） | TRUE | 5 |
| PLAN-006 | その他 | 0（仮値） | 0（仮値） | 0（仮値） | FALSE | 6 |

---

## FeeRules シート — ヘッダー行（11列）

| 列 | フィールド名 | 型 | 必須 | 備考 |
|---|---|---|---|---|
| A | rule_id | TEXT | 必須 | 例：FR-001 |
| B | rule_key | TEXT | 必須 | ユニークキー（コードから参照する） |
| C | rule_name | TEXT | 必須 | |
| D | rule_category | TEXT | 必須 | fee / proration / billing |
| E | rule_value | TEXT | 必須 | 値（rule_typeに応じて解釈） |
| F | rule_type | TEXT | 必須 | ドロップダウン: boolean / number / text / percentage |
| G | description | TEXT | 任意 | |
| H | is_active | BOOLEAN | 必須 | ドロップダウン: TRUE / FALSE |
| I | notes | TEXT | 任意 | |
| J | created_at | DATETIME | 必須 | |
| K | updated_at | DATETIME | 必須 | |

### 初期データ（setupFeeRules()で投入）

| rule_id | rule_key | rule_name | rule_category | rule_value | rule_type |
|---|---|---|---|---|---|
| FR-001 | prorating_enabled | 初月日割り計算あり | proration | TRUE | boolean |
| FR-002 | prorating_rounding | 日割り端数処理 | proration | floor | text |
| FR-003 | prepay_next_month | 翌月分前払いあり | billing | TRUE | boolean |
| FR-004 | join_fee_enabled | 入会金あり | fee | TRUE | boolean |
| FR-005 | card_key_fee_enabled | カードキー発行料あり | fee | TRUE | boolean |
| FR-006 | join_fee_waived_on_line | LINE登録で入会金無料 | fee | FALSE | boolean |

---

## Payments シート — ヘッダー行（10列）

| 列 | フィールド名 | 型 | 必須 | 備考 |
|---|---|---|---|---|
| A | payment_id | TEXT | 必須 | 自動採番 |
| B | member_id | TEXT | 必須 | Members.member_id参照 |
| C | payment_type | TEXT | 必須 | ドロップダウン: initial / monthly / other |
| D | amount | NUMBER | 必須 | 金額（円） |
| E | payment_method | TEXT | 必須 | ドロップダウン: cash / bank_transfer |
| F | payment_date | DATE | 必須 | |
| G | target_month | TEXT | 任意 | 対象月（例：2026-06） |
| H | notes | TEXT | 任意 | |
| I | created_at | DATETIME | 必須 | |
| J | created_by | TEXT | 必須 | |

---

## StatusHistory シート — ヘッダー行（11列）

| 列 | フィールド名 | 型 | 必須 | 備考 |
|---|---|---|---|---|
| A | history_id | TEXT | 必須 | 自動採番 |
| B | member_id | TEXT | 必須 | Members.member_id参照 |
| C | change_type | TEXT | 必須 | ドロップダウン: pause / withdraw / restart |
| D | previous_status | TEXT | 必須 | ドロップダウン: active / paused / withdrawn |
| E | new_status | TEXT | 必須 | ドロップダウン: active / paused / withdrawn |
| F | effective_date | DATE | 必須 | 変更適用日 |
| G | end_date | DATE | 任意 | 休会の場合のみ設定 |
| H | reason | TEXT | 任意 | |
| I | notes | TEXT | 任意 | |
| J | created_at | DATETIME | 必須 | |
| K | created_by | TEXT | 必須 | 処理スタッフID |

---

## KeyCards シート — ヘッダー行（8列）

| 列 | フィールド名 | 型 | 必須 | 備考 |
|---|---|---|---|---|
| A | key_card_number | TEXT | 必須 | 主キー（例：K-001） |
| B | status | TEXT | 必須 | ドロップダウン: available / in_use / lost / damaged |
| C | member_id | TEXT | 任意 | 使用中会員番号 |
| D | issued_date | DATE | 任意 | |
| E | returned_date | DATE | 任意 | |
| F | notes | TEXT | 任意 | |
| G | created_at | DATETIME | 必須 | |
| H | updated_at | DATETIME | 必須 | |

### 初期データ

全鍵番号を事前に登録する。使用前は status = available。
鍵番号の範囲はオーナーが確認して手動で登録する（K-001〜K-xxx）。

---

## Referrals シート — ヘッダー行（7列）

| 列 | フィールド名 | 型 | 必須 | 備考 |
|---|---|---|---|---|
| A | referral_id | TEXT | 必須 | 自動採番 |
| B | referrer_member_id | TEXT | 必須 | 紹介した会員 |
| C | referee_member_id | TEXT | 必須 | 紹介された会員 |
| D | referral_date | DATE | 必須 | |
| E | reward_applied | BOOLEAN | 必須 | 特典適用済みか |
| F | notes | TEXT | 任意 | |
| G | created_at | DATETIME | 必須 | |

---

## BillingExports シート — ヘッダー行（10列）

| 列 | フィールド名 | 型 | 必須 | 備考 |
|---|---|---|---|---|
| A | export_id | TEXT | 必須 | 自動採番 |
| B | target_month | TEXT | 必須 | 対象月（例：2026-06） |
| C | export_date | DATETIME | 必須 | エクスポート日時 |
| D | exported_by | TEXT | 必須 | 操作スタッフID |
| E | file_name | TEXT | 任意 | 出力ファイル名 |
| F | member_count | NUMBER | 必須 | 対象会員数 |
| G | total_amount | NUMBER | 必須 | 合計金額（円） |
| H | status | TEXT | 必須 | ドロップダウン: draft / submitted / confirmed |
| I | notes | TEXT | 任意 | |
| J | created_at | DATETIME | 必須 | |

---

## AuditLogs シート — ヘッダー行（10列）

| 列 | フィールド名 | 型 | 必須 | 備考 |
|---|---|---|---|---|
| A | log_id | TEXT | 必須 | 自動採番（UUID） |
| B | action | TEXT | 必須 | create / update / delete / approve / reject / export |
| C | table_name | TEXT | 必須 | 対象シート名 |
| D | record_id | TEXT | 必須 | 対象レコードの主キー |
| E | field_name | TEXT | 任意 | 変更フィールド名 |
| F | old_value | TEXT | 任意 | 変更前の値 |
| G | new_value | TEXT | 任意 | 変更後の値 |
| H | performed_by | TEXT | 必須 | 操作したスタッフID |
| I | performed_at | DATETIME | 必須 | 操作日時 |
| J | notes | TEXT | 任意 | |

---

## Settings シート — ヘッダー行（7列）

| 列 | フィールド名 | 型 | 必須 | 備考 |
|---|---|---|---|---|
| A | setting_key | TEXT | 必須 | ユニークキー（コードから参照する） |
| B | setting_value | TEXT | 必須 | 値（setting_typeに応じて解釈） |
| C | setting_type | TEXT | 必須 | text / number / boolean |
| D | description | TEXT | 必須 | 設定の説明 |
| E | is_editable | BOOLEAN | 必須 | スタッフが編集可能かどうか |
| F | updated_at | DATETIME | 必須 | 最終更新日時 |
| G | updated_by | TEXT | 任意 | 最終更新スタッフID |

### 初期データ（setupInitialSettings()で投入）

| setting_key | setting_value | description |
|---|---|---|
| gym_name | トレーニングジム ワイルドボア | ジム名 |
| gym_address | 兵庫県朝来市立野169-1 | ジム所在地 |
| business_hours | 5:00〜23:00 | 営業時間 |
| card_key_issue_fee | 0（仮値） | カードキー発行料（円） |
| default_join_fee | 0（仮値） | 入会金デフォルト（円） |
| tax_rate | 0.10 | 消費税率 |
| member_id_prefix | W- | 会員番号プレフィックス |
| member_id_digits | 4 | 会員番号連番の桁数 |
| key_number_prefix | K- | 鍵番号プレフィックス |
| key_number_digits | 3 | 鍵番号連番の桁数 |
| billing_cutoff_day | 0（仮値） | 請求締め日 |
| pause_max_months | 0（仮値） | 最長休会月数 |
| pause_fee_enabled | FALSE（仮値） | 休会中も月会費徴収するか |

---

## 列幅・書式設定の方針

| 列の種類 | 書式 |
|---|---|
| 日付（DATE） | YYYY/MM/DD 形式で表示 |
| 日時（DATETIME） | YYYY/MM/DD HH:mm:ss 形式で表示 |
| 金額（NUMBER） | 整数（カンマ区切り） |
| 真偽値（BOOLEAN） | TRUE / FALSE |
| ステータス | 入力規則（ドロップダウン）を設定する |

## 入力規則まとめ

| シート | 列 | フィールド名 | 入力規則 |
|---|---|---|---|
| Members | G | gender | male, female, other |
| Members | W | status | active, paused, withdrawn |
| IntakeApplications | H | gender | male, female, other |
| IntakeApplications | X | privacy_agreed | TRUE, FALSE |
| IntakeApplications | Y | review_status | pending, approved, rejected |
| KeyCards | B | status | available, in_use, lost, damaged |
| StatusHistory | C | change_type | pause, withdraw, restart |
| StatusHistory | D | previous_status | active, paused, withdrawn |
| StatusHistory | E | new_status | active, paused, withdrawn |
| Payments | C | payment_type | initial, monthly, other |
| Payments | E | payment_method | cash, bank_transfer |
| BillingExports | H | status | draft, submitted, confirmed |
| FeeRules | F | rule_type | boolean, number, text, percentage |
| FeeRules | H | is_active | TRUE, FALSE |
| MembershipPlans | G | is_active | TRUE, FALSE |
