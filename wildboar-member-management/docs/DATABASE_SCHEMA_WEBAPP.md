# Supabase PostgreSQL テーブルスキーマ設計

作成日：2026-05-04
対象：Phase 11（Supabase 移行時に実行する）

---

## 前提

- Supabase PostgreSQL を使用する
- すべてのテーブルで RLS（Row Level Security）を有効にする
- タイムスタンプはすべて UTC で保存する
- ID は UUID を使用する（GAS版の連番IDとは異なる）
- GAS版からのマッピングは GAS_TO_SUPABASE_MAPPING.md を参照する

---

## テーブルスキーマ

### membership_plans（コースマスタ）

```sql
CREATE TABLE membership_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code TEXT UNIQUE NOT NULL,          -- 例：PLAN-001
  plan_name TEXT NOT NULL,                 -- 例：一般コース
  monthly_fee INTEGER NOT NULL,            -- 月会費（円）
  enrollment_fee INTEGER NOT NULL,         -- 入会金（円）
  card_key_fee INTEGER NOT NULL,           -- カードキー発行料（円）
  description TEXT,                        -- コース説明
  is_active BOOLEAN NOT NULL DEFAULT TRUE, -- 有効フラグ
  display_order INTEGER NOT NULL DEFAULT 0,-- 表示順
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE membership_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_can_manage_plans" ON membership_plans
  FOR ALL USING (auth.role() = 'authenticated');
```

### fee_rules（料金ルール）

```sql
CREATE TABLE fee_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key TEXT UNIQUE NOT NULL,           -- 設定キー（例：prorating_rounding）
  rule_name TEXT NOT NULL,                 -- ルール名
  rule_type TEXT NOT NULL,                 -- prorating / discount / surcharge
  value NUMERIC NOT NULL,                  -- 値
  unit TEXT NOT NULL,                      -- yen / percent / days
  description TEXT,                        -- 説明
  effective_from DATE NOT NULL,            -- 適用開始日
  effective_to DATE,                       -- 適用終了日（NULLは無期限）
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE fee_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_can_manage_fee_rules" ON fee_rules
  FOR ALL USING (auth.role() = 'authenticated');
```

### settings（システム設定）

```sql
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,        -- 設定キー
  setting_value TEXT NOT NULL,             -- 設定値
  description TEXT,                        -- 説明
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_can_read_settings" ON settings
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "admin_can_update_settings" ON settings
  FOR UPDATE USING (auth.role() = 'authenticated');
```

### key_cards（鍵番号管理）

```sql
CREATE TABLE key_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_card_code TEXT UNIQUE NOT NULL,      -- 鍵番号（例：K-001）
  status TEXT NOT NULL DEFAULT 'available',-- in_use / available / lost / damaged
  member_id UUID,                          -- 使用中会員（FKはmembers作成後に追加）
  issued_date DATE,                        -- 発行日
  returned_date DATE,                      -- 返却日
  notes TEXT,                              -- 備考
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE key_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_can_manage_key_cards" ON key_cards
  FOR ALL USING (auth.role() = 'authenticated');
```

### intake_applications（入会申込）

```sql
CREATE TABLE intake_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_code TEXT UNIQUE NOT NULL,   -- 受付番号（例：APP-20260501-0001）
  application_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- 基本情報
  family_name TEXT NOT NULL,
  given_name TEXT NOT NULL,
  family_name_kana TEXT NOT NULL,
  given_name_kana TEXT NOT NULL,
  birth_date DATE NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female', 'other')),
  occupation TEXT,
  -- 住所
  postal_code TEXT NOT NULL,
  prefecture TEXT NOT NULL,
  city TEXT NOT NULL,
  address1 TEXT NOT NULL,
  address2 TEXT,
  -- 連絡先
  phone_mobile TEXT NOT NULL,
  phone_home TEXT,
  email TEXT,
  -- 緊急連絡先
  emergency_contact_name TEXT NOT NULL,
  emergency_contact_relation TEXT NOT NULL,
  emergency_contact_phone TEXT NOT NULL,
  -- コース・紹介
  plan_id UUID REFERENCES membership_plans(id),
  referrer_member_code TEXT,               -- 紹介者会員番号（文字列で保存）
  notes TEXT,
  privacy_agreed BOOLEAN NOT NULL DEFAULT FALSE,
  -- 確認ステータス
  review_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  -- 割り当て情報（承認後に設定）
  assigned_member_id UUID,                 -- 承認後に設定（membersのid）
  assigned_key_card_id UUID REFERENCES key_cards(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE intake_applications ENABLE ROW LEVEL SECURITY;

-- 誰でも申込を送信できる（入会フォームは認証不要）
CREATE POLICY "anyone_can_submit_intake" ON intake_applications
  FOR INSERT WITH CHECK (true);

-- スタッフのみ申込を確認・更新できる
CREATE POLICY "staff_can_read_intake" ON intake_applications
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "staff_can_update_intake" ON intake_applications
  FOR UPDATE USING (auth.role() = 'authenticated');
```

### members（会員マスタ）

```sql
CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_code TEXT UNIQUE NOT NULL,        -- 会員番号（例：W-0001）
  -- 基本情報
  family_name TEXT NOT NULL,
  given_name TEXT NOT NULL,
  family_name_kana TEXT NOT NULL,
  given_name_kana TEXT NOT NULL,
  birth_date DATE NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female', 'other')),
  occupation TEXT,
  -- 住所
  postal_code TEXT NOT NULL,
  prefecture TEXT NOT NULL,
  city TEXT NOT NULL,
  address1 TEXT NOT NULL,
  address2 TEXT,
  -- 連絡先
  phone_mobile TEXT NOT NULL,
  phone_home TEXT,
  email TEXT,
  -- 緊急連絡先
  emergency_contact_name TEXT NOT NULL,
  emergency_contact_relation TEXT NOT NULL,
  emergency_contact_phone TEXT NOT NULL,
  -- 会員情報
  plan_id UUID NOT NULL REFERENCES membership_plans(id),
  key_card_id UUID REFERENCES key_cards(id),
  join_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'pause', 'withdrawn')),
  referrer_member_id UUID REFERENCES members(id),
  intake_application_id UUID REFERENCES intake_applications(id),
  notes TEXT,
  -- メタ
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_can_manage_members" ON members
  FOR ALL USING (auth.role() = 'authenticated');

-- key_cards の member_id 外部キーを追加
ALTER TABLE key_cards
  ADD CONSTRAINT fk_key_cards_member
  FOREIGN KEY (member_id) REFERENCES members(id);

-- intake_applications の assigned_member_id 外部キーを追加
ALTER TABLE intake_applications
  ADD CONSTRAINT fk_intake_assigned_member
  FOREIGN KEY (assigned_member_id) REFERENCES members(id);
```

### status_histories（ステータス変更履歴）

```sql
CREATE TABLE status_histories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id),
  change_type TEXT NOT NULL CHECK (change_type IN ('pause', 'withdraw', 'restart')),
  status_before TEXT NOT NULL CHECK (status_before IN ('active', 'pause', 'withdrawn')),
  status_after TEXT NOT NULL CHECK (status_after IN ('active', 'pause', 'withdrawn')),
  effective_date DATE NOT NULL,
  end_date DATE,                           -- 休会終了予定日
  reason TEXT,
  processed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE status_histories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_can_manage_status_histories" ON status_histories
  FOR ALL USING (auth.role() = 'authenticated');
```

### payments（支払い記録）

```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id),
  payment_type TEXT NOT NULL CHECK (payment_type IN ('initial', 'monthly', 'other')),
  payment_date DATE NOT NULL,
  amount INTEGER NOT NULL,                 -- 金額（円）
  breakdown JSONB,                         -- 内訳（JSON形式）
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'bank_transfer')),
  billing_month TEXT,                      -- 対象月（YYYY-MM形式）
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_can_manage_payments" ON payments
  FOR ALL USING (auth.role() = 'authenticated');
```

### referrals（紹介者管理）

```sql
CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_member_id UUID NOT NULL REFERENCES members(id),
  referred_member_id UUID NOT NULL REFERENCES members(id),
  referral_date DATE NOT NULL,
  benefit_applied BOOLEAN NOT NULL DEFAULT FALSE,
  benefit_description TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_can_manage_referrals" ON referrals
  FOR ALL USING (auth.role() = 'authenticated');
```

### billing_exports（集金代行データ）

```sql
CREATE TABLE billing_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_month TEXT NOT NULL,             -- YYYY-MM形式
  export_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  exported_by UUID REFERENCES auth.users(id),
  member_count INTEGER NOT NULL,
  total_amount INTEGER NOT NULL,           -- 合計金額（円）
  file_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'exported'
    CHECK (status IN ('exported', 'submitted', 'completed')),
  submitted_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE billing_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_can_manage_billing_exports" ON billing_exports
  FOR ALL USING (auth.role() = 'authenticated');
```

### audit_logs（操作ログ）

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  operator UUID REFERENCES auth.users(id),
  operator_email TEXT,                     -- auth.users削除後も記録が残るよう保存
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'view', 'export', 'approve', 'reject')),
  target_table TEXT NOT NULL,              -- 対象テーブル名
  target_id UUID,                          -- 対象レコードのID
  field_name TEXT,                         -- 変更フィールド名
  old_value TEXT,                          -- 変更前の値
  new_value TEXT,                          -- 変更後の値
  description TEXT,                        -- 操作の説明
  ip_address TEXT,                         -- IPアドレス（可能であれば）
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- スタッフは自分の操作を INSERT できる
CREATE POLICY "staff_can_create_audit_logs" ON audit_logs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- スタッフは audit_logs を読める（削除・更新は不可）
CREATE POLICY "staff_can_read_audit_logs" ON audit_logs
  FOR SELECT USING (auth.role() = 'authenticated');
```

---

## インデックス設計

```sql
-- 会員番号の検索を高速化
CREATE INDEX idx_members_member_code ON members(member_code);

-- ステータスでの絞り込みを高速化
CREATE INDEX idx_members_status ON members(status);

-- 氏名カナ検索を高速化（前方一致検索）
CREATE INDEX idx_members_family_name_kana ON members(family_name_kana text_pattern_ops);

-- 申込の確認ステータスでの絞り込みを高速化
CREATE INDEX idx_intake_review_status ON intake_applications(review_status);

-- StatusHistory の会員IDでの絞り込みを高速化
CREATE INDEX idx_status_histories_member_id ON status_histories(member_id);

-- Payments の会員IDと請求月での絞り込みを高速化
CREATE INDEX idx_payments_member_id ON payments(member_id);
CREATE INDEX idx_payments_billing_month ON payments(billing_month);

-- AuditLogs の日付順表示を高速化
CREATE INDEX idx_audit_logs_log_date ON audit_logs(log_date DESC);
```

---

## 更新日時の自動更新トリガー

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 各テーブルにトリガーを設定
CREATE TRIGGER set_updated_at BEFORE UPDATE ON membership_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON intake_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON key_cards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON billing_exports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```
