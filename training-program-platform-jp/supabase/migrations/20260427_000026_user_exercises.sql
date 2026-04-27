-- U-1: user_exercises table + workout_session_exercises schema update
--
-- Design:
--   - user_exercises: per-user custom exercise library (scoped by user_id).
--   - workout_session_exercises.exercise_id made nullable.
--   - workout_session_exercises.user_exercise_id added as nullable FK.
--   - Check constraint ensures exactly one source is always set.
--   - Existing rows are unaffected (exercise_id stays non-null for all current rows).

begin;

-- ── 1. user_exercises ────────────────────────────────────────────────────────

create table public.user_exercises (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  name          text        not null,
  category      text,
  default_unit  text        not null default 'kg',
  memo          text        not null default '',
  is_archived   boolean     not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── RLS ──────────────────────────────────────────────────────────────────────

alter table public.user_exercises enable row level security;

create policy "Users can select own exercises"
  on public.user_exercises for select to authenticated
  using (user_id = auth.uid());

create policy "Users can insert own exercises"
  on public.user_exercises for insert to authenticated
  with check (user_id = auth.uid());

create policy "Users can update own exercises"
  on public.user_exercises for update to authenticated
  using (user_id = auth.uid());

create policy "Users can delete own exercises"
  on public.user_exercises for delete to authenticated
  using (user_id = auth.uid());

-- ── updated_at trigger ───────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger user_exercises_updated_at
  before update on public.user_exercises
  for each row execute procedure public.set_updated_at();

-- ── 2. workout_session_exercises schema update ───────────────────────────────
-- Make exercise_id nullable so rows can reference user_exercises instead.
-- Add user_exercise_id FK.
-- Enforce: exactly one source must be non-null.

alter table public.workout_session_exercises
  alter column exercise_id drop not null;

alter table public.workout_session_exercises
  add column user_exercise_id uuid references public.user_exercises(id) on delete restrict;

alter table public.workout_session_exercises
  add constraint workout_session_exercises_exercise_source_check
  check (
    (exercise_id is not null and user_exercise_id is null) or
    (exercise_id is null  and user_exercise_id is not null)
  );

commit;
