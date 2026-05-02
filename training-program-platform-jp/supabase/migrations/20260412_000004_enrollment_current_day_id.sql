-- Redesign program_enrollments to use current_program_day_id directly.
--
-- Rationale:
--   The original schema stored current_week + current_day as integers.
--   Resolving "the next day" then required a JOIN to program_weeks/program_days
--   in application code AND in the DB.
--   Storing the UUID directly means:
--     - One less resolution step per request
--     - Rename / reorder days in the future without breaking enrollment state
--     - The day ID is the canonical key already used by workout_sessions
--
-- The old integer columns are dropped so the schema stays minimal.
-- user_id FK is kept nullable to match the workout_sessions nullable pattern
-- for MVP (will be tightened after auth is stabilised).

-- 1. Drop FK constraint that enforces NOT NULL user_id
alter table public.program_enrollments
  drop constraint if exists program_enrollments_user_id_fkey;

-- 2. Recreate user_id as nullable with the same FK behaviour
alter table public.program_enrollments
  alter column user_id drop not null;

alter table public.program_enrollments
  add constraint program_enrollments_user_id_fkey
  foreign key (user_id) references public.users(id) on delete cascade;

-- 3. Drop the old integer progress columns
alter table public.program_enrollments
  drop column if exists current_week;

alter table public.program_enrollments
  drop column if exists current_day;

-- 4. Add current_program_day_id (nullable = enrollment started but day not yet resolved)
alter table public.program_enrollments
  add column if not exists current_program_day_id uuid
  references public.program_days(id) on delete set null;

-- 5. Add updated_at for tracking last progression event
alter table public.program_enrollments
  add column if not exists updated_at timestamptz not null default now();

-- 6. Unique constraint: one active enrollment per (user_id, program_id)
--    Partial unique index allows nulls in user_id while still preventing
--    two active rows for the same (user_id, program_id) pair.
create unique index if not exists idx_program_enrollments_active_user_program
  on public.program_enrollments (user_id, program_id)
  where status = 'active' and user_id is not null;

-- 7. Index for fast lookup by program_day_id
create index if not exists idx_program_enrollments_current_day
  on public.program_enrollments (current_program_day_id);
