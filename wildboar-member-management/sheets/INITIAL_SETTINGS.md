# スプレッドシート初期設定手順

作成日：2026-05-04
対象：Phase 1 のスプレッドシート作成・設定作業

---

## 事前準備

- Googleアカウントにログインしている状態であること
- オーナーのGoogleドライブにアクセスできること
- MEMBERSHIP_RULES.md の料金・コース情報がオーナーによって確定済みであること
- KeyCardsシートに登録する鍵番号の一覧（全鍵の番号）が手元にあること

---

## 手順1：新規スプレッドシートの作成

1. Googleドライブを開く
2. 「新規」→「Googleスプレッドシート」→「空白のスプレッドシート」
3. スプレッドシートの名前を「ワイルドボア会員管理」に変更する
4. スプレッドシートのURLからIDを取得しておく
   - URL例：`https://docs.google.com/spreadsheets/d/[スプレッドシートID]/edit`

---

## 手順2：シートの作成

デフォルトの「シート1」を最初のシートに流用する。

### 作成するシート（タブ）一覧

| 作成順 | シート名 | 操作 |
|---|---|---|
| 1 | Members | シート1の名前を変更する |
| 2 | IntakeApplications | 新規シートを追加 |
| 3 | MembershipPlans | 新規シートを追加 |
| 4 | FeeRules | 新規シートを追加 |
| 5 | Payments | 新規シートを追加 |
| 6 | StatusHistory | 新規シートを追加 |
| 7 | KeyCards | 新規シートを追加 |
| 8 | Referrals | 新規シートを追加 |
| 9 | BillingExports | 新規シートを追加 |
| 10 | AuditLogs | 新規シートを追加 |
| 11 | Settings | 新規シートを追加 |

---

## 手順3：各シートのヘッダー行設定

SHEET_SCHEMA.md のヘッダー行をコピーして、各シートの1行目に貼り付ける。
ヘッダー行（1行目）はフォントを太字にして背景色（薄いグレー）を設定する。

### 各シートのヘッダー（1行目 A列から順番に入力する）

#### Members シート
```
member_id, family_name, given_name, family_name_kana, given_name_kana, birth_date, gender, postal_code, prefecture, city, address1, address2, phone_home, phone_mobile, email, emergency_contact_name, emergency_contact_relation, emergency_contact_phone, occupation, plan_id, key_card_number, join_date, status, referrer_member_id, intake_application_id, notes, created_at, updated_at, created_by
```

#### IntakeApplications シート
```
application_id, application_date, family_name, given_name, family_name_kana, given_name_kana, birth_date, gender, postal_code, prefecture, city, address1, address2, phone_home, phone_mobile, email, emergency_contact_name, emergency_contact_relation, emergency_contact_phone, occupation, plan_id, referrer_member_id, notes, privacy_agreed, review_status, reviewed_by, reviewed_at, assigned_member_id, assigned_key_card_number, rejection_reason
```

#### MembershipPlans シート
```
plan_id, plan_name, monthly_fee, enrollment_fee, card_key_fee, description, is_active, display_order, created_at, updated_at
```

#### FeeRules シート
```
rule_id, rule_name, rule_type, value, unit, description, effective_from, effective_to
```

#### Payments シート
```
payment_id, member_id, payment_type, payment_date, amount, breakdown, payment_method, billing_month, notes, created_at, created_by
```

#### StatusHistory シート
```
history_id, member_id, change_type, status_before, status_after, effective_date, end_date, reason, processed_by, created_at, notes
```

#### KeyCards シート
```
key_card_number, status, member_id, issued_date, returned_date, notes, updated_at
```

#### Referrals シート
```
referral_id, referrer_member_id, referred_member_id, referral_date, benefit_applied, benefit_description, notes
```

#### BillingExports シート
```
export_id, billing_month, export_date, exported_by, member_count, total_amount, file_name, status, submitted_date, notes
```

#### AuditLogs シート
```
log_id, log_date, operator, action, target_sheet, target_id, field_name, old_value, new_value, description
```

#### Settings シート
```
setting_key, setting_value, description, updated_at
```

---

## 手順4：入力規則の設定

以下の列にドロップダウンの入力規則を設定する。

| シート | 列（アルファベット） | 入力規則の値 |
|---|---|---|
| Members | W列（status） | active,pause,withdrawn |
| Members | G列（gender） | male,female,other |
| IntakeApplications | Y列（review_status） | pending,approved,rejected |
| IntakeApplications | H列（gender） | male,female,other |
| KeyCards | B列（status） | in_use,available,lost,damaged |
| StatusHistory | C列（change_type） | pause,withdraw,restart |
| Payments | C列（payment_type） | initial,monthly,other |
| Payments | G列（payment_method） | cash,bank_transfer |

入力規則の設定方法：
1. 対象のセル（2行目以降を全選択）を選択する
2. メニュー「データ」→「データの入力規則」
3. 条件「リストをアイテムで指定」を選択する
4. 値を入力する（カンマ区切り）

---

## 手順5：初期データの投入

### MembershipPlans シートへの初期データ投入

MEMBERSHIP_RULES.md のコース情報を参照してオーナーが入力する。

- 2行目以降に各コースを1行ずつ入力する
- is_active は TRUE を入力する
- created_at, updated_at は入力した日時を入力する

### FeeRules シートへの初期データ投入

- 2行目：RULE-001, 日割り端数処理, prorating, 0, -, 切り捨て, 2026-05-01,（空白）

### KeyCards シートへの初期データ投入

- ジムにある全鍵番号を1つずつ入力する
- status は全て available を入力する
- 例：K-001, available,（member_idは空白）, ...

### Settings シートへの初期データ投入

INITIAL_SETTINGS.md の「Settings シート初期データ」表を参考に入力する。
金額・日数はオーナーが確定した値を入力する。

---

## 手順6：行の固定設定

各シートで1行目（ヘッダー行）を固定する。

1. 1行目を選択する
2. メニュー「表示」→「固定」→「1行」

---

## 手順7：シートの保護設定

### ヘッダー行の保護（全シート共通）

各シートの1行目を保護して、スクリプト実行中の誤操作を防ぐ。

1. 1行目を選択する
2. メニュー「データ」→「シートと範囲を保護」
3. 「範囲を追加」で1行目を指定する
4. 説明を「ヘッダー行（変更禁止）」とする
5. 「権限を設定」→「自分のみ」に設定する

### AuditLogsシートの保護

操作ログは手動変更を禁止する。

1. AuditLogs シートを選択する
2. メニュー「データ」→「シートと範囲を保護」
3. 「シート」タブで保護する
4. 説明を「操作ログ（変更禁止）」とする
5. 「権限を設定」→「自分のみ」に設定する

---

## 手順8：GASプロジェクトの紐付け

1. スプレッドシートのメニュー「拡張機能」→「Apps Script」を開く
2. GASエディタが開く
3. GASプロジェクト名を「ワイルドボア会員管理」に設定する
4. スクリプトプロパティに SPREADSHEET_ID を設定する
   - 「プロジェクト設定」→「スクリプト プロパティ」
   - キー：SPREADSHEET_ID
   - 値：手順1で取得したスプレッドシートのID

---

## 手順9：動作確認

設定完了後、以下を確認する。

- [ ] 全シートが作成されている（11シート）
- [ ] 各シートのヘッダー行が正しい列名になっている
- [ ] 入力規則が設定されている（ドロップダウンで値が選択できる）
- [ ] MembershipPlansシートにコースデータが入力されている
- [ ] KeyCardsシートに全鍵番号が入力されている
- [ ] Settingsシートに初期設定値が入力されている
- [ ] 1行目が固定されている
- [ ] GASプロジェクトが紐付けられている
- [ ] ScriptProperties に SPREADSHEET_ID が設定されている
