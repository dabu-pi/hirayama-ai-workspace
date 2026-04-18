-- Migration: add swap_group_slug to program_day_exercises and workout_session_exercises
-- NULL = no restriction (show all exercises in swap modal).

alter table public.program_day_exercises
  add column if not exists swap_group_slug text
    references public.exercise_swap_groups(slug) on delete set null;

alter table public.workout_session_exercises
  add column if not exists swap_group_slug text
    references public.exercise_swap_groups(slug) on delete set null;
