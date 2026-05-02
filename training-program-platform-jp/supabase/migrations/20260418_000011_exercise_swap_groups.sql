-- Migration: exercise_swap_groups + exercise_swap_group_members
-- Enables role-restricted swap candidate pools for program day exercises.

create table if not exists public.exercise_swap_groups (
  slug  text primary key,
  label text not null
);

create table if not exists public.exercise_swap_group_members (
  group_slug  text not null references public.exercise_swap_groups(slug) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  primary key (group_slug, exercise_id)
);

-- Read access is public (needed by /api/exercises without auth)
alter table public.exercise_swap_groups      enable row level security;
alter table public.exercise_swap_group_members enable row level security;

create policy "exercise_swap_groups_read" on public.exercise_swap_groups
  for select using (true);

create policy "exercise_swap_group_members_read" on public.exercise_swap_group_members
  for select using (true);
