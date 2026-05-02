-- Enforce one active enrollment per user across all programs.
--
-- The previous constraint idx_program_enrollments_active_user_program was
-- (user_id, program_id) WHERE status='active' — it only prevented two active
-- rows for the same (user, program) pair, not two rows for different programs.
--
-- This migration:
--   1. Resolves any existing violations by pausing all but the most-recently-
--      updated active enrollment per user.
--   2. Drops the now-subsumed (user_id, program_id) constraint.
--   3. Adds a stricter (user_id) partial unique index so the DB rejects any
--      INSERT or UPDATE that would create a second active enrollment for a user.

-- 1. Pause duplicate active enrollments (keep the most recently updated one).
with ranked as (
  select
    id,
    row_number() over (
      partition by user_id
      order by updated_at desc nulls last
    ) as rn
  from public.program_enrollments
  where status = 'active'
    and user_id is not null
),
to_pause as (
  select id from ranked where rn > 1
)
update public.program_enrollments
set
  status     = 'paused',
  updated_at = now()
where id in (select id from to_pause);

-- 2. Drop the old (user_id, program_id) partial index — subsumed by the new one.
drop index if exists idx_program_enrollments_active_user_program;

-- 3. Add stricter (user_id) partial unique index.
--    Partial on (status = 'active' and user_id is not null) so that:
--      - completed / paused rows are not affected
--      - the rare null user_id (legacy) is also excluded
create unique index if not exists idx_program_enrollments_one_active_per_user
  on public.program_enrollments (user_id)
  where status = 'active'
    and user_id is not null;
