-- Phase M-B: membership_pause_requests + users pause columns
--
-- (1) users: paused_at, prepaid_month_credit
-- (2) membership_pause_requests table

-- ── users 拡張 ────────────────────────────────────────────────────────────────

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS paused_at            timestamptz,
  ADD COLUMN IF NOT EXISTS prepaid_month_credit  boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.paused_at IS
  'Timestamp when membership_status was set to paused. Null when active/cancelled.';

COMMENT ON COLUMN public.users.prepaid_month_credit IS
  'True when the user paid for a month that should be credited on resume. '
  'Set when a pause request is approved after next-month billing was already confirmed.';

-- ── membership_pause_requests ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS membership_pause_requests (
  id                            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                       uuid        NOT NULL REFERENCES public.users(id),
  reason                        text,
  status                        text        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled_by_user')),
  -- Billing context snapshot at the time of request
  next_month_billing_confirmed  boolean     NOT NULL,
  -- Effective start of pause (set on approval)
  effective_from                date,
  -- Admin fields
  requested_at                  timestamptz NOT NULL DEFAULT now(),
  reviewed_at                   timestamptz,
  reviewed_by                   uuid        REFERENCES public.users(id),
  admin_note                    text,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE membership_pause_requests IS
  'User-submitted pause (休会) requests. Approval sets membership_status=paused. '
  'next_month_billing_confirmed is a snapshot at request time to determine effective_from.';

-- One pending request per user at a time.
CREATE UNIQUE INDEX membership_pause_requests_one_pending_per_user
  ON membership_pause_requests (user_id)
  WHERE status = 'pending';

CREATE INDEX membership_pause_requests_user_id_idx ON membership_pause_requests (user_id);
CREATE INDEX membership_pause_requests_status_idx  ON membership_pause_requests (status);

-- RLS
ALTER TABLE membership_pause_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own pause requests"
  ON membership_pause_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own pause requests"
  ON membership_pause_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can select all pause requests"
  ON membership_pause_requests FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Admins can update pause requests"
  ON membership_pause_requests FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  ));
