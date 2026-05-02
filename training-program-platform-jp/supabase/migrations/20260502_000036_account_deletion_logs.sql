-- S-6: account_deletion_logs — immutable audit log for app account deletions
--
-- PURPOSE:
--   Records each app account deletion event for audit and support purposes.
--   Created by selfDeleteAccount() Server Action (Phase S-7).
--   Separate from account_deletion_requests (which is for the admin-approval workflow).
--
-- DESIGN:
--   - Rows are IMMUTABLE. No UPDATE or DELETE RLS policies.
--   - INSERT is performed only from Server Actions using the admin client (service role).
--   - user_id is SET NULL if the referenced public.users row is eventually deleted,
--     so the audit log survives physical deletion.
--   - Snapshots (email, display_name, membership_status) are recorded at deletion time
--     to support post-deletion support/audit even after the user row is anonymised.
--   - membership_status_snapshot records the gym status at deletion time but does NOT
--     change it — gym membership is managed separately.
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS public.account_deletion_logs;

CREATE TABLE IF NOT EXISTS public.account_deletion_logs (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References the user who deleted their account.
  -- ON DELETE SET NULL so this row persists even if public.users is eventually deleted.
  user_id                     UUID        REFERENCES public.users(id) ON DELETE SET NULL,

  -- Snapshots taken at deletion time for audit purposes.
  -- Stored here because public.users fields may be anonymised after deletion.
  email_snapshot              TEXT,
  display_name_snapshot       TEXT,
  membership_status_snapshot  TEXT,

  -- How the deletion was performed.
  deletion_method             TEXT        NOT NULL DEFAULT 'self_service'
    CONSTRAINT account_deletion_logs_method_check
    CHECK (deletion_method IN ('self_service', 'admin_forced')),

  -- Optional reason provided by the user at deletion time.
  reason                      TEXT,

  -- When the deletion occurred.
  deleted_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.account_deletion_logs IS
  'Immutable audit log of app account deletions. '
  'Created by selfDeleteAccount() Server Action. '
  'membership_status_snapshot is informational only — gym membership is unchanged on deletion.';

COMMENT ON COLUMN public.account_deletion_logs.user_id IS
  'ON DELETE SET NULL: if public.users is eventually physically deleted, '
  'this column becomes null but the log row is preserved for audit.';

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- INSERT: performed via admin client (service role) only — no RLS INSERT policy needed.
-- SELECT: admins only.
-- UPDATE / DELETE: no policy (immutable audit log).

ALTER TABLE public.account_deletion_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can select account deletion logs"
  ON public.account_deletion_logs FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- ── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX account_deletion_logs_user_id_idx
  ON public.account_deletion_logs (user_id);

CREATE INDEX account_deletion_logs_deleted_at_idx
  ON public.account_deletion_logs (deleted_at DESC);
