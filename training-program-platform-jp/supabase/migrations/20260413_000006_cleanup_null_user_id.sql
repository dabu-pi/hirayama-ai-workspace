-- Remove all rows where user_id IS NULL from user-scoped tables.
--
-- Context:
--   During Phase A MVP, workout_sessions.user_id and program_enrollments.user_id
--   were made nullable so unauthenticated sessions could be created during
--   development / E2E testing (migrations 000003 and 000004).
--   Phase B Step 1 + Step 2 enforce auth in the application layer, so no new
--   null rows should appear after this point.
--
-- This migration removes the legacy null rows so that the NOT NULL constraints
-- in migration 000007 can be applied cleanly.
--
-- Safe to run multiple times (DELETE WHERE ... is idempotent when no rows match).
-- Must run BEFORE migration 000007.

begin;

-- 1. workout_sets — deepest dependency, delete first
delete from public.workout_sets
where workout_session_exercise_id in (
  select wse.id
  from public.workout_session_exercises wse
  join public.workout_sessions ws on ws.id = wse.workout_session_id
  where ws.user_id is null
);

-- 2. workout_session_exercises
delete from public.workout_session_exercises
where workout_session_id in (
  select id from public.workout_sessions where user_id is null
);

-- 3. workout_sessions
delete from public.workout_sessions
where user_id is null;

-- 4. program_enrollments
delete from public.program_enrollments
where user_id is null;

commit;
