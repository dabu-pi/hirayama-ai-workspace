-- Phase M-C: Add cancel workflow fields to account_deletion_requests
--
-- effective_date:                退会適用日（当月末 or 翌月末）
-- next_month_billing_confirmed:  申請時の口座振替確定状況スナップショット
-- key_returned_at:               鍵返却記録
-- refund_500_paid_at:            500円返金完了記録
--
-- Rollback:
--   ALTER TABLE account_deletion_requests
--     DROP COLUMN effective_date,
--     DROP COLUMN next_month_billing_confirmed,
--     DROP COLUMN key_returned_at,
--     DROP COLUMN refund_500_paid_at;

ALTER TABLE account_deletion_requests
  ADD COLUMN IF NOT EXISTS effective_date               date,
  ADD COLUMN IF NOT EXISTS next_month_billing_confirmed boolean,
  ADD COLUMN IF NOT EXISTS key_returned_at              timestamptz,
  ADD COLUMN IF NOT EXISTS refund_500_paid_at           timestamptz;

COMMENT ON COLUMN account_deletion_requests.effective_date IS
  'Calculated last day of membership. '
  'Before billing confirmed: last day of current month. '
  'After billing confirmed: last day of next month.';

COMMENT ON COLUMN account_deletion_requests.next_month_billing_confirmed IS
  'Snapshot of whether next month billing was confirmed at request time. '
  'Used to determine effective_date and to display billing notice to admin.';

COMMENT ON COLUMN account_deletion_requests.key_returned_at IS
  'Timestamp when the gym key was physically returned to reception.';

COMMENT ON COLUMN account_deletion_requests.refund_500_paid_at IS
  'Timestamp when the 500-yen key deposit refund was paid to the member.';
