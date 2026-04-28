-- D-2: Add cancelled_at to public.users
-- Records when membership_status was changed to 'cancelled'.
-- Used as the reference date for the 1-year data retention / deletion eligibility policy.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

COMMENT ON COLUMN public.users.cancelled_at IS
  'Timestamp when membership_status was set to cancelled. '
  'Null for active/paused members. '
  'Used to determine 1-year retention window before deletion eligibility (D-3).';
