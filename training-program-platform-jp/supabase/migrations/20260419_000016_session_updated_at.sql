-- Phase 1 sync guard: add updated_at to workout_sessions for optimistic-lock / staleness detection.
-- Trigger keeps updated_at current on every row mutation.

alter table public.workout_sessions
  add column if not exists updated_at timestamptz not null default now();

-- Back-fill existing rows so the column is never null.
update public.workout_sessions
  set updated_at = coalesce(finished_at, started_at)
  where updated_at = now();

-- Auto-maintain updated_at on future mutations.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_workout_sessions_updated_at on public.workout_sessions;
create trigger trg_workout_sessions_updated_at
  before update on public.workout_sessions
  for each row execute function public.set_updated_at();
