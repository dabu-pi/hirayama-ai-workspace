-- Phase 1: membership status foundation
--
-- Adds membership_status to public.users so future phases can gate
-- feature access (e.g. /train) without touching enrollments or sessions.
--
-- Existing rows receive DEFAULT 'active' automatically — no data migration needed.
-- New users also default to 'active' via the column default, so the
-- handle_new_user trigger requires no changes.
--
-- Rollback:
--   ALTER TABLE public.users DROP COLUMN membership_status;

ALTER TABLE public.users
ADD COLUMN membership_status text
NOT NULL DEFAULT 'active'
CHECK (membership_status IN ('active', 'paused', 'cancelled'));
