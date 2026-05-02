-- Enable Row Level Security (RLS) and define minimum policies.
--
-- Design principles:
--   1. Public reference data (programs, exercises, program structure) is readable
--      by all — including unauthenticated (anon) users — when is_public = true.
--   2. User-owned data (enrollments, sessions, session_exercises, sets) is
--      accessible only to the row's owner via auth.uid() = user_id.
--   3. Only SELECT / INSERT / UPDATE policies are defined. There are no
--      application-level DELETE paths (workout_sets use logical delete via
--      deleted_at; other tables cascade on session delete).
--   4. All policies use the `authenticated` role for writes and `anon` + `authenticated`
--      for public reads.
--
-- Prerequisite: migrations 000006 + 000007 must have run first so that
-- user_id IS NOT NULL before RLS depends on it.

begin;

-- ============================================================
-- Public reference tables
-- ============================================================

-- programs: readable by everyone when is_public = true
alter table public.programs enable row level security;

create policy "Public programs are readable by everyone"
  on public.programs
  for select
  to anon, authenticated
  using (is_public = true);

-- exercises: readable by everyone (pure reference data, no user ownership)
alter table public.exercises enable row level security;

create policy "Exercises are readable by everyone"
  on public.exercises
  for select
  to anon, authenticated
  using (true);

-- program_weeks: readable by everyone (immutable program structure)
alter table public.program_weeks enable row level security;

create policy "Program weeks are readable by everyone"
  on public.program_weeks
  for select
  to anon, authenticated
  using (true);

-- program_days: readable by everyone
alter table public.program_days enable row level security;

create policy "Program days are readable by everyone"
  on public.program_days
  for select
  to anon, authenticated
  using (true);

-- program_day_exercises: readable by everyone
alter table public.program_day_exercises enable row level security;

create policy "Program day exercises are readable by everyone"
  on public.program_day_exercises
  for select
  to anon, authenticated
  using (true);

-- ============================================================
-- users (public.users mirrors auth.users 1:1)
-- ============================================================

alter table public.users enable row level security;

create policy "Users can read own profile"
  on public.users
  for select
  to authenticated
  using (auth.uid() = id);

-- ============================================================
-- program_enrollments
-- ============================================================

alter table public.program_enrollments enable row level security;

create policy "Users can read own enrollments"
  on public.program_enrollments
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own enrollments"
  on public.program_enrollments
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own enrollments"
  on public.program_enrollments
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- workout_sessions
-- ============================================================

alter table public.workout_sessions enable row level security;

create policy "Users can read own sessions"
  on public.workout_sessions
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own sessions"
  on public.workout_sessions
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own sessions"
  on public.workout_sessions
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- workout_session_exercises
-- (no user_id column — ownership resolved via workout_sessions)
-- ============================================================

alter table public.workout_session_exercises enable row level security;

create policy "Users can read own session exercises"
  on public.workout_session_exercises
  for select
  to authenticated
  using (
    exists (
      select 1 from public.workout_sessions ws
      where ws.id = workout_session_exercises.workout_session_id
        and ws.user_id = auth.uid()
    )
  );

create policy "Users can insert session exercises for own sessions"
  on public.workout_session_exercises
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.workout_sessions ws
      where ws.id = workout_session_exercises.workout_session_id
        and ws.user_id = auth.uid()
    )
  );

create policy "Users can update own session exercises"
  on public.workout_session_exercises
  for update
  to authenticated
  using (
    exists (
      select 1 from public.workout_sessions ws
      where ws.id = workout_session_exercises.workout_session_id
        and ws.user_id = auth.uid()
    )
  );

-- ============================================================
-- workout_sets
-- (ownership resolved via workout_session_exercises → workout_sessions)
-- ============================================================

alter table public.workout_sets enable row level security;

create policy "Users can read own workout sets"
  on public.workout_sets
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.workout_session_exercises wse
      join public.workout_sessions ws on ws.id = wse.workout_session_id
      where wse.id = workout_sets.workout_session_exercise_id
        and ws.user_id = auth.uid()
    )
  );

create policy "Users can insert workout sets for own sessions"
  on public.workout_sets
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.workout_session_exercises wse
      join public.workout_sessions ws on ws.id = wse.workout_session_id
      where wse.id = workout_sets.workout_session_exercise_id
        and ws.user_id = auth.uid()
    )
  );

create policy "Users can update own workout sets"
  on public.workout_sets
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.workout_session_exercises wse
      join public.workout_sessions ws on ws.id = wse.workout_session_id
      where wse.id = workout_sets.workout_session_exercise_id
        and ws.user_id = auth.uid()
    )
  );

commit;
