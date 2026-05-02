-- C-13 Step 1: Add methodology column to programs.
--
-- Purpose:
--   Introduce a methodology layer that describes the training structure
--   a program follows. Used to resolve exerciseRoleLabel (T1→"T1" for GZCL,
--   T1→"Primary" for linear, no badge for generic) without changing
--   existing exercise_type storage or any user-facing behavior.
--
-- Values:
--   gzcl    — GZCL T1/T2/T3 slot structure (Tier 1/2/3 naming)
--   linear  — Linear progression programs (e.g. Starting Strength)
--   generic — No methodology-specific structure or progression state
--
-- Safe to run:
--   - NOT NULL DEFAULT 'gzcl' keeps existing rows valid with no data migration risk
--   - UPDATE statements are idempotent (ON CONFLICT-safe slug lookups)
--   - No existing table structure or RLS policies are changed

begin;

alter table public.programs
  add column if not exists methodology text
  not null default 'gzcl'
  check (methodology in ('gzcl', 'linear', 'generic'));

comment on column public.programs.methodology is
  'Training methodology. gzcl = GZCL T1/T2/T3 slot structure; linear = linear progression (e.g. Starting Strength); generic = no methodology-specific structure.';

-- ── Per-program assignments ─────────────────────────────────────────────────
-- gzclp-base / gzclp-base-v2: GZCL methodology (default, no change needed)
-- upper-lower-base: uses T1/T2/T3 slot structure → gzcl (default, no change)
-- starting-strength-base: linear progression model
-- dumbbell-full-body-base: custom, no progression structure → generic

update public.programs
set methodology = 'linear'
where slug = 'starting-strength-base';

update public.programs
set methodology = 'generic'
where slug = 'dumbbell-full-body-base';

commit;
