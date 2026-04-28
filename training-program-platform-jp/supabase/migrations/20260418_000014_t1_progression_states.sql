-- Migration: t1_progression_states
--
-- Tracks T1 exercise weight and phase per enrollment.
-- current_weight_kg = recommendation for the NEXT session (updated on every session finish).
-- phase values: '5x3' → '6x2' → '10x1' → 'retest_required'
--
-- Design notes:
--   - Separate table (not a column on program_enrollments) because each enrollment
--     can have up to 4 T1 exercises (Squat / Bench / OHP / Deadlift).
--   - (enrollment_id, exercise_id) unique pair — one row per lift per enrollment.
--   - Cascades on enrollment delete so archived / deleted enrollments clean up automatically.
--   - Writes always come from the service-role admin client (bypasses RLS).
--   - Reads come from the cookie-scoped server client (RLS select policy required).

create table if not exists public.t1_progression_states (
  id                uuid         primary key default gen_random_uuid(),
  enrollment_id     uuid         not null references public.program_enrollments(id) on delete cascade,
  exercise_id       uuid         not null references public.exercises(id) on delete cascade,
  phase             text         not null default '5x3'
                                 check (phase in ('5x3', '6x2', '10x1', 'retest_required')),
  current_weight_kg numeric(6,2) not null,
  last_result       text         check (last_result in ('success', 'fail')),
  updated_at        timestamptz  not null default now(),
  unique (enrollment_id, exercise_id)
);

comment on table public.t1_progression_states is
  'T1 phase / weight progression state per exercise per enrollment. '
  'current_weight_kg is the recommended weight for the next session. '
  'Populated automatically when a session is finished (POST /api/workout-sessions/[id]/finish).';

alter table public.t1_progression_states enable row level security;

create policy "t1_progression_states: users read own"
  on public.t1_progression_states
  for select
  using (
    (select user_id from public.program_enrollments where id = enrollment_id) = auth.uid()
  );

create policy "t1_progression_states: users modify own"
  on public.t1_progression_states
  for all
  using (
    (select user_id from public.program_enrollments where id = enrollment_id) = auth.uid()
  );

-- Hot-path index: enrollment + exercise lookup (used on every session load)
create index if not exists idx_t1_progression_states_enrollment_exercise
  on public.t1_progression_states (enrollment_id, exercise_id);
