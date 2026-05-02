create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'user' check (role in ('admin', 'user')),
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_ja text not null,
  name_en text not null,
  category text,
  created_at timestamptz not null default now()
);

create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  creator_user_id uuid references public.users (id) on delete set null,
  title text not null,
  description text,
  duration_weeks integer not null default 1 check (duration_weeks > 0),
  days_per_week integer not null default 1 check (days_per_week > 0),
  level text,
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.program_weeks (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  week_number integer not null check (week_number > 0),
  label text,
  created_at timestamptz not null default now(),
  unique (program_id, week_number)
);

create table if not exists public.program_days (
  id uuid primary key default gen_random_uuid(),
  program_week_id uuid not null references public.program_weeks (id) on delete cascade,
  day_number integer not null check (day_number > 0),
  progression_guide text,
  notes text,
  created_at timestamptz not null default now(),
  unique (program_week_id, day_number)
);

create table if not exists public.program_day_exercises (
  id uuid primary key default gen_random_uuid(),
  program_day_id uuid not null references public.program_days (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  exercise_type text not null check (exercise_type in ('T1', 'T2', 'T3')),
  set_count integer not null default 1 check (set_count > 0),
  target_reps_text text,
  order_index integer not null default 1 check (order_index > 0),
  created_at timestamptz not null default now(),
  unique (program_day_id, order_index)
);

create table if not exists public.program_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  program_id uuid not null references public.programs (id) on delete cascade,
  current_week integer not null default 1 check (current_week > 0),
  current_day integer not null default 1 check (current_day > 0),
  started_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active', 'paused', 'completed'))
);

create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  program_enrollment_id uuid references public.program_enrollments (id) on delete set null,
  program_day_id uuid references public.program_days (id) on delete set null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'cancelled'))
);

create table if not exists public.workout_session_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_session_id uuid not null references public.workout_sessions (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  exercise_type text not null check (exercise_type in ('T1', 'T2', 'T3')),
  order_index integer not null default 1 check (order_index > 0),
  was_swapped boolean not null default false,
  was_added boolean not null default false,
  created_at timestamptz not null default now(),
  unique (workout_session_id, order_index)
);

create table if not exists public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  workout_session_exercise_id uuid not null references public.workout_session_exercises (id) on delete cascade,
  set_number integer not null check (set_number > 0),
  target_reps_text text,
  weight_kg numeric(6,2),
  reps_done integer,
  is_completed boolean not null default false,
  is_locked boolean not null default false,
  is_auto_filled boolean not null default false,
  deleted_at timestamptz,
  completed_at timestamptz,
  rpe integer,
  note text not null default '',
  created_at timestamptz not null default now(),
  unique (workout_session_exercise_id, set_number)
);

comment on column public.workout_sets.deleted_at is
  'Logical delete timestamp. Active train queries must filter deleted_at is null.';

create index if not exists idx_program_weeks_program_id
  on public.program_weeks (program_id);

create index if not exists idx_program_days_program_week_id
  on public.program_days (program_week_id);

create index if not exists idx_program_day_exercises_program_day_id
  on public.program_day_exercises (program_day_id);

create index if not exists idx_program_enrollments_user_id
  on public.program_enrollments (user_id);

create index if not exists idx_workout_sessions_user_id_started_at
  on public.workout_sessions (user_id, started_at desc);

create index if not exists idx_workout_session_exercises_session_id
  on public.workout_session_exercises (workout_session_id);

create index if not exists idx_workout_session_exercises_exercise_id
  on public.workout_session_exercises (exercise_id);

create index if not exists idx_workout_sets_exercise_set_number
  on public.workout_sets (workout_session_exercise_id, set_number);

create index if not exists idx_workout_sets_visible_order
  on public.workout_sets (workout_session_exercise_id, deleted_at, set_number);
