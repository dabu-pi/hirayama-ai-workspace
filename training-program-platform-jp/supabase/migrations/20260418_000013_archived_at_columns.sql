-- Migration: add archived_at to program_enrollments and workout_sessions
--
-- NULL = visible (default). Non-null = soft-deleted / hidden from all active
-- and history views. Consistent with workout_sets.deleted_at pattern.
--
-- Archived rows are preserved for audit / future restore. No physical delete.

alter table public.program_enrollments
  add column if not exists archived_at timestamptz null;

comment on column public.program_enrollments.archived_at
  is 'Soft-archive timestamp. Active and history queries must filter archived_at IS NULL.';

alter table public.workout_sessions
  add column if not exists archived_at timestamptz null;

comment on column public.workout_sessions.archived_at
  is 'Soft-archive timestamp. Session-history and in-progress detection must filter archived_at IS NULL.';

-- Partial index for active, non-archived enrollment lookup (most common hot path).
create index if not exists idx_program_enrollments_active_not_archived
  on public.program_enrollments (user_id, program_id)
  where status = 'active' and archived_at is null;

-- Index to speed up session history query (excludes archived rows).
create index if not exists idx_workout_sessions_history_not_archived
  on public.workout_sessions (user_id, started_at desc)
  where archived_at is null;
