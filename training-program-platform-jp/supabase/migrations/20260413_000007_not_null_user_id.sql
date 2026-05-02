-- Restore NOT NULL constraints on user_id columns.
--
-- Context:
--   workout_sessions.user_id was made nullable in migration 000003.
--   program_enrollments.user_id was made nullable in migration 000004.
--   Both are now safe to restore after the null row cleanup in migration 000006.
--
-- Prerequisite: migration 000006_cleanup_null_user_id must have run first.
-- If any null rows remain, this migration will fail with a constraint violation —
-- which is the correct behaviour (fix the data, then re-run).

begin;

-- 1. workout_sessions.user_id → NOT NULL
alter table public.workout_sessions
  alter column user_id set not null;

-- 2. program_enrollments.user_id → NOT NULL
alter table public.program_enrollments
  alter column user_id set not null;

-- 3. Refresh partial unique index on program_enrollments.
--    The old index (from migration 000004) had:
--      WHERE status = 'active' AND user_id IS NOT NULL
--    Since user_id is now always NOT NULL, the guard is redundant.
--    Drop and recreate with the simplified predicate.
drop index if exists public.idx_program_enrollments_active_user_program;

create unique index idx_program_enrollments_active_user_program
  on public.program_enrollments (user_id, program_id)
  where status = 'active';

commit;
