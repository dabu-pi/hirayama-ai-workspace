-- S-8: Fix FK constraints to allow auth.users physical deletion
--
-- BACKGROUND:
--   Phase S-8 requires supabase.auth.admin.deleteUser() to delete auth.users.
--   Six FK constraints currently block this operation:
--     - 5 × NO ACTION constraints that prevent public.users from being deleted
--     - 1 × RESTRICT constraint that prevents user_exercises from being deleted
--
-- CHANGES:
--   1. account_deletion_requests.user_id  — DROP NOT NULL, FK → SET NULL
--   2. account_deletion_requests.reviewed_by — FK → SET NULL
--   3. membership_pause_requests.user_id  — DROP NOT NULL, FK → SET NULL
--   4. membership_pause_requests.reviewed_by — FK → SET NULL
--   5. billing_cutoff_records.confirmed_by — FK → SET NULL
--   6. workout_session_exercises.user_exercise_id — FK → CASCADE
--
-- EFFECT after this migration:
--   supabase.auth.admin.deleteUser(userId) will:
--     - CASCADE-delete public.users → program_enrollments → workout_sessions → sets
--     - CASCADE-delete user_exercises → custom-exercise session rows (CASCADE)
--     - SET NULL: account_deletion_requests.user_id / reviewed_by
--     - SET NULL: membership_pause_requests.user_id / reviewed_by
--     - SET NULL: billing_cutoff_records.confirmed_by
--     - SET NULL: account_deletion_logs.user_id (already SET NULL from migration 000036)
--
-- SAFETY:
--   - membership_status and cancelled_at are NOT touched (gym membership is separate).
--   - account_deletion_logs rows are preserved with user_id = null (audit trail).
--   - All other tables (gym_consultation_requests etc.) are unaffected.
--
-- ROLLBACK:
--   See bottom of file for rollback SQL.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. account_deletion_requests.user_id
--    Drop NOT NULL constraint, then change FK to ON DELETE SET NULL.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.account_deletion_requests
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.account_deletion_requests
  DROP CONSTRAINT account_deletion_requests_user_id_fkey;

ALTER TABLE public.account_deletion_requests
  ADD CONSTRAINT account_deletion_requests_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES public.users(id)
  ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. account_deletion_requests.reviewed_by
--    Already nullable; change FK to ON DELETE SET NULL.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.account_deletion_requests
  DROP CONSTRAINT account_deletion_requests_reviewed_by_fkey;

ALTER TABLE public.account_deletion_requests
  ADD CONSTRAINT account_deletion_requests_reviewed_by_fkey
  FOREIGN KEY (reviewed_by)
  REFERENCES public.users(id)
  ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. membership_pause_requests.user_id
--    Drop NOT NULL constraint, then change FK to ON DELETE SET NULL.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.membership_pause_requests
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.membership_pause_requests
  DROP CONSTRAINT membership_pause_requests_user_id_fkey;

ALTER TABLE public.membership_pause_requests
  ADD CONSTRAINT membership_pause_requests_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES public.users(id)
  ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. membership_pause_requests.reviewed_by
--    Already nullable; change FK to ON DELETE SET NULL.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.membership_pause_requests
  DROP CONSTRAINT membership_pause_requests_reviewed_by_fkey;

ALTER TABLE public.membership_pause_requests
  ADD CONSTRAINT membership_pause_requests_reviewed_by_fkey
  FOREIGN KEY (reviewed_by)
  REFERENCES public.users(id)
  ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. billing_cutoff_records.confirmed_by
--    Already nullable; change FK to ON DELETE SET NULL.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.billing_cutoff_records
  DROP CONSTRAINT billing_cutoff_records_confirmed_by_fkey;

ALTER TABLE public.billing_cutoff_records
  ADD CONSTRAINT billing_cutoff_records_confirmed_by_fkey
  FOREIGN KEY (confirmed_by)
  REFERENCES public.users(id)
  ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. workout_session_exercises.user_exercise_id
--    Change from RESTRICT to CASCADE.
--    When user_exercises is deleted (via auth.users CASCADE), rows referencing
--    that custom exercise are also deleted instead of blocking the deletion.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.workout_session_exercises
  DROP CONSTRAINT workout_session_exercises_user_exercise_id_fkey;

ALTER TABLE public.workout_session_exercises
  ADD CONSTRAINT workout_session_exercises_user_exercise_id_fkey
  FOREIGN KEY (user_exercise_id)
  REFERENCES public.user_exercises(id)
  ON DELETE CASCADE;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK SQL (do NOT run unless reverting this migration)
-- ─────────────────────────────────────────────────────────────────────────────
--
-- BEGIN;
--
-- -- Restore account_deletion_requests.user_id (re-add NOT NULL + original FK)
-- UPDATE public.account_deletion_requests SET user_id = '00000000-0000-0000-0000-000000000000' WHERE user_id IS NULL;
-- ALTER TABLE public.account_deletion_requests ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE public.account_deletion_requests DROP CONSTRAINT account_deletion_requests_user_id_fkey;
-- ALTER TABLE public.account_deletion_requests ADD CONSTRAINT account_deletion_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);
--
-- -- Restore account_deletion_requests.reviewed_by
-- ALTER TABLE public.account_deletion_requests DROP CONSTRAINT account_deletion_requests_reviewed_by_fkey;
-- ALTER TABLE public.account_deletion_requests ADD CONSTRAINT account_deletion_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);
--
-- -- Restore membership_pause_requests.user_id (re-add NOT NULL + original FK)
-- UPDATE public.membership_pause_requests SET user_id = '00000000-0000-0000-0000-000000000000' WHERE user_id IS NULL;
-- ALTER TABLE public.membership_pause_requests ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE public.membership_pause_requests DROP CONSTRAINT membership_pause_requests_user_id_fkey;
-- ALTER TABLE public.membership_pause_requests ADD CONSTRAINT membership_pause_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);
--
-- -- Restore membership_pause_requests.reviewed_by
-- ALTER TABLE public.membership_pause_requests DROP CONSTRAINT membership_pause_requests_reviewed_by_fkey;
-- ALTER TABLE public.membership_pause_requests ADD CONSTRAINT membership_pause_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);
--
-- -- Restore billing_cutoff_records.confirmed_by
-- ALTER TABLE public.billing_cutoff_records DROP CONSTRAINT billing_cutoff_records_confirmed_by_fkey;
-- ALTER TABLE public.billing_cutoff_records ADD CONSTRAINT billing_cutoff_records_confirmed_by_fkey FOREIGN KEY (confirmed_by) REFERENCES public.users(id);
--
-- -- Restore workout_session_exercises.user_exercise_id to RESTRICT
-- ALTER TABLE public.workout_session_exercises DROP CONSTRAINT workout_session_exercises_user_exercise_id_fkey;
-- ALTER TABLE public.workout_session_exercises ADD CONSTRAINT workout_session_exercises_user_exercise_id_fkey FOREIGN KEY (user_exercise_id) REFERENCES public.user_exercises(id) ON DELETE RESTRICT;
--
-- COMMIT;
