-- S-6: Add app_deleted_at to public.users (app-level soft delete)
--
-- PURPOSE:
--   Tracks when a user has self-deleted their app account (Phase S-7).
--   This is COMPLETELY SEPARATE from gym membership state.
--
-- IMPORTANT DESIGN DECISIONS:
--   - app_deleted_at IS NOT gym cancellation. Do NOT conflate with cancelled_at.
--   - membership_status is NOT changed when app_deleted_at is set.
--   - cancelled_at is NOT changed when app_deleted_at is set.
--   - The gym membership contract continues independently of app_deleted_at.
--   - Middleware redirects users with non-null app_deleted_at to /account-deleted.
--
-- ROLLBACK:
--   ALTER TABLE public.users DROP COLUMN IF EXISTS app_deleted_at;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS app_deleted_at TIMESTAMPTZ;

COMMENT ON COLUMN public.users.app_deleted_at IS
  'Timestamp when the user self-deleted their app account (Phase S-7 self-service deletion). '
  'NOT related to gym membership. membership_status and cancelled_at remain unchanged. '
  'Middleware blocks app access when this is non-null (/account-deleted redirect). '
  'Admin can restore access by setting this to null.';
