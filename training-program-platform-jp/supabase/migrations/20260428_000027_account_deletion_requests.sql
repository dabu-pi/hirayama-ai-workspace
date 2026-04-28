-- D-1: Account deletion requests
-- Users submit requests; admins approve (→ cancelled) or reject.
-- No physical deletion of auth.users, public.users, or session data.

CREATE TABLE IF NOT EXISTS account_deletion_requests (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES public.users(id),
  reason        text        NULL,
  status        text        NOT NULL DEFAULT 'pending',
  requested_at  timestamptz NOT NULL DEFAULT now(),
  reviewed_at   timestamptz NULL,
  reviewed_by   uuid        NULL REFERENCES public.users(id),
  admin_note    text        NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE account_deletion_requests
  ADD CONSTRAINT account_deletion_requests_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled_by_user'));

-- One pending request per user at a time.
CREATE UNIQUE INDEX account_deletion_requests_one_pending_per_user
  ON account_deletion_requests (user_id)
  WHERE status = 'pending';

CREATE INDEX account_deletion_requests_user_id_idx ON account_deletion_requests (user_id);
CREATE INDEX account_deletion_requests_status_idx  ON account_deletion_requests (status);

COMMENT ON TABLE account_deletion_requests IS
  'User-submitted account deletion requests. Approval sets membership_status=cancelled; no rows are physically deleted.';

-- RLS
ALTER TABLE account_deletion_requests ENABLE ROW LEVEL SECURITY;

-- Users: read own requests
CREATE POLICY "Users can select own deletion requests"
  ON account_deletion_requests FOR SELECT
  USING (auth.uid() = user_id);

-- Users: insert own requests (RLS enforces user_id = own uid)
CREATE POLICY "Users can insert own deletion requests"
  ON account_deletion_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins: read all
CREATE POLICY "Admins can select all deletion requests"
  ON account_deletion_requests FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Admins: update (approve / reject)
CREATE POLICY "Admins can update deletion requests"
  ON account_deletion_requests FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );
