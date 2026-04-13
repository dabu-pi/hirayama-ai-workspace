-- ==========================================================================
-- GZCLP Base — Live Correction SQL
-- ==========================================================================
--
-- Purpose:
--   Replace the existing live `gzclp-base` program structure with the
--   canonical 4-week / 3-day base month per Cody Lefever's original
--   GZCLP method (A1/B1/A2/B2 rotation, T1/T2/T3 tiers).
--
-- Audit outcome:
--   source_fidelity = 'original'
--   Structure target: 4 weeks × 3 days = 12 sessions
--   Rotation: W1[A1,B1,A2] W2[B2,A1,B1] W3[A2,B2,A1] W4[B1,A2,B2]
--
-- Safety:
--   • Wrapped in a transaction. Any error rolls back the entire correction.
--   • Pre-check MUST be run before the correction block.
--   • slug is preserved (route / enrollment continuity).
--   • program.id is preserved (FK from workout_sessions).
--   • program_weeks deletion cascades to program_days / program_day_exercises.
--   • workout_sessions.program_day_id is SET NULL on delete — not broken.
--   • program_enrollments uses integer columns — not broken.
--
-- Run order in Supabase Dashboard SQL Editor:
--   1. STEP 0 — pre-check SELECT (read-only, run separately)
--   2. STEP 1 — correction block (transaction, run as one block)
--   3. STEP 2 — post-check SELECT (read-only, run separately)
--
-- ==========================================================================



-- ==========================================================================
-- STEP 0: PRE-CHECK (run first, separately — read-only)
-- ==========================================================================
--
-- Paste and run this block alone before touching anything.
-- Expected output:
--   • gzclp_exists   = true
--   • weeks_count    = current week count (may differ from 4 if stale)
--   • days_count     = total day rows
--   • exercises_count = total exercise rows
--   • active_enrollments = number of active enrollments (ideally 0)
--   • orphaned_sessions  = sessions whose program_day_id is now NULL or stale

/*
select
  (select exists (select 1 from public.programs where slug = 'gzclp-base'))
    as gzclp_exists,
  (select count(*) from public.program_weeks pw
     join public.programs p on p.id = pw.program_id
     where p.slug = 'gzclp-base')
    as weeks_count,
  (select count(*) from public.program_days pd
     join public.program_weeks pw on pw.id = pd.program_week_id
     join public.programs p on p.id = pw.program_id
     where p.slug = 'gzclp-base')
    as days_count,
  (select count(*) from public.program_day_exercises pde
     join public.program_days pd on pd.id = pde.program_day_id
     join public.program_weeks pw on pw.id = pd.program_week_id
     join public.programs p on p.id = pw.program_id
     where p.slug = 'gzclp-base')
    as exercises_count,
  (select count(*) from public.program_enrollments pe
     join public.programs p on p.id = pe.program_id
     where p.slug = 'gzclp-base' and pe.status = 'active')
    as active_enrollments,
  (select p.title, p.duration_weeks, p.days_per_week, p.level,
          p.source_fidelity, p.source_program_name
     from public.programs p where p.slug = 'gzclp-base')
    as current_program_row;
*/



-- ==========================================================================
-- STEP 1: CORRECTION BLOCK (run as one block)
-- ==========================================================================

begin;

do $$
declare
  prog_id uuid;

  ex_squat        uuid;
  ex_bench        uuid;
  ex_press        uuid;
  ex_deadlift     uuid;
  ex_lat_pulldown uuid;
  ex_db_row       uuid;

  w1 uuid; w2 uuid; w3 uuid; w4 uuid;

  -- Week 1
  w1d1 uuid; w1d2 uuid; w1d3 uuid;
  -- Week 2
  w2d1 uuid; w2d2 uuid; w2d3 uuid;
  -- Week 3
  w3d1 uuid; w3d2 uuid; w3d3 uuid;
  -- Week 4
  w4d1 uuid; w4d2 uuid; w4d3 uuid;

  enrollment_count integer;
begin

  -- ------------------------------------------------------------------
  -- Guard: verify slug exists
  -- ------------------------------------------------------------------
  select id into prog_id
  from public.programs
  where slug = 'gzclp-base';

  if prog_id is null then
    raise exception 'gzclp-base not found. Abort — nothing was changed.';
  end if;

  -- ------------------------------------------------------------------
  -- Advisory: warn if active enrollments exist
  -- (Does NOT block the correction — structure is still safe to replace
  --  because program_enrollments uses integer week/day columns, not FKs.)
  -- ------------------------------------------------------------------
  select count(*) into enrollment_count
  from public.program_enrollments
  where program_id = prog_id and status = 'active';

  if enrollment_count > 0 then
    raise notice
      '% active enrollment(s) found for gzclp-base. '
      'Their current_week / current_day integers are preserved. '
      'workout_sessions.program_day_id will be SET NULL for affected sessions. '
      'Proceeding with correction.',
      enrollment_count;
  end if;

  -- ------------------------------------------------------------------
  -- Upsert exercises
  -- (safe to run even if exercises already exist)
  -- ------------------------------------------------------------------
  insert into public.exercises (slug, name_ja, name_en, category)
  values
    ('squat',          U&'\30B9\30AF\30EF\30C3\30C8',                       'Squat',           'legs'),
    ('bench-press',    U&'\30D9\30F3\30C1\30D7\30EC\30B9',                  'Bench Press',     'chest'),
    ('overhead-press', U&'\30AA\30FC\30D0\30FC\30D8\30C3\30C9\30D7\30EC\30B9', 'Overhead Press', 'shoulders'),
    ('deadlift',       U&'\30C7\30C3\30C9\30EA\30D5\30C8',                  'Deadlift',        'back'),
    ('lat-pulldown',   U&'\30E9\30C3\30C8\30D7\30EB\30C0\30A6\30F3',        'Lat Pulldown',    'back'),
    ('dumbbell-row',   U&'\30C0\30F3\30D9\30EB\30ED\30A6',                  'Dumbbell Row',    'back')
  on conflict (slug) do nothing;

  select id into ex_squat        from public.exercises where slug = 'squat';
  select id into ex_bench        from public.exercises where slug = 'bench-press';
  select id into ex_press        from public.exercises where slug = 'overhead-press';
  select id into ex_deadlift     from public.exercises where slug = 'deadlift';
  select id into ex_lat_pulldown from public.exercises where slug = 'lat-pulldown';
  select id into ex_db_row       from public.exercises where slug = 'dumbbell-row';

  if ex_squat is null or ex_bench is null or ex_press is null
    or ex_deadlift is null or ex_lat_pulldown is null or ex_db_row is null then
    raise exception 'Exercise lookup failed. Abort.';
  end if;

  -- ------------------------------------------------------------------
  -- Update program header
  -- (title / description / source metadata / structural dimensions)
  -- ------------------------------------------------------------------
  update public.programs
  set
    title            = 'GZCLP Base',
    description      = 'Original Cody Lefever GZCLP base month: 3 days per week, four rotating workouts (A1/B1/A2/B2), and the standard T1/T2/T3 progression model.',
    duration_weeks   = 4,
    days_per_week    = 3,
    level            = 'beginner',
    source_program_name = 'GZCLP',
    source_fidelity  = 'original',
    source_notes     = 'Original Cody Lefever base month: 3-day schedule, A1/B1/A2/B2 rotation, and standard T1/T2/T3 progression.'
  where id = prog_id;

  -- ------------------------------------------------------------------
  -- Replace program structure
  -- Deleting program_weeks cascades to program_days → program_day_exercises.
  -- workout_sessions.program_day_id becomes NULL (SET NULL FK) — not broken.
  -- ------------------------------------------------------------------
  delete from public.program_weeks where program_id = prog_id;

  -- Weeks
  insert into public.program_weeks (program_id, week_number, label)
  values
    (prog_id, 1, 'Week 1'),
    (prog_id, 2, 'Week 2'),
    (prog_id, 3, 'Week 3'),
    (prog_id, 4, 'Week 4');

  select id into w1 from public.program_weeks where program_id = prog_id and week_number = 1;
  select id into w2 from public.program_weeks where program_id = prog_id and week_number = 2;
  select id into w3 from public.program_weeks where program_id = prog_id and week_number = 3;
  select id into w4 from public.program_weeks where program_id = prog_id and week_number = 4;

  -- Days
  -- A1 = Squat T1 / Bench T2 / Lat Pulldown T3
  -- B1 = Press T1 / Deadlift T2 / DB Row T3
  -- A2 = Bench T1 / Squat T2 / Lat Pulldown T3
  -- B2 = Deadlift T1 / Press T2 / DB Row T3
  --
  -- W1: A1, B1, A2
  -- W2: B2, A1, B1
  -- W3: A2, B2, A1
  -- W4: B1, A2, B2
  insert into public.program_days (program_week_id, day_number, progression_guide, notes)
  values
    -- Week 1
    (w1, 1,
      'A1 — T1 Squat: 5×3+ → 6×2+ → 10×1+, retest 5RM and restart at 85%. T2 Bench: 3×10 → 3×8 → 3×6. T3 Lat Pulldown: add weight when final set reaches 25 reps.',
      'A1: T1 Squat 5×3+, T2 Bench Press 3×10, T3 Lat Pulldown 3×15+'),
    (w1, 2,
      'B1 — T1 Press: 5×3+ → 6×2+ → 10×1+, retest 5RM and restart at 85%. T2 Deadlift: 3×10 → 3×8 → 3×6. T3 DB Row: add weight when final set reaches 25 reps.',
      'B1: T1 Overhead Press 5×3+, T2 Deadlift 3×10, T3 Dumbbell Row 3×15+'),
    (w1, 3,
      'A2 — T1 Bench: 5×3+ → 6×2+ → 10×1+, retest 5RM and restart at 85%. T2 Squat: 3×10 → 3×8 → 3×6. T3 Lat Pulldown: add weight when final set reaches 25 reps.',
      'A2: T1 Bench Press 5×3+, T2 Squat 3×10, T3 Lat Pulldown 3×15+'),
    -- Week 2
    (w2, 1,
      'B2 — T1 Deadlift: 5×3+ → 6×2+ → 10×1+, retest 5RM and restart at 85%. T2 Press: 3×10 → 3×8 → 3×6. T3 DB Row: add weight when final set reaches 25 reps.',
      'B2: T1 Deadlift 5×3+, T2 Overhead Press 3×10, T3 Dumbbell Row 3×15+'),
    (w2, 2,
      'A1 — T1 Squat: 5×3+ → 6×2+ → 10×1+, retest 5RM and restart at 85%. T2 Bench: 3×10 → 3×8 → 3×6. T3 Lat Pulldown: add weight when final set reaches 25 reps.',
      'A1: T1 Squat 5×3+, T2 Bench Press 3×10, T3 Lat Pulldown 3×15+'),
    (w2, 3,
      'B1 — T1 Press: 5×3+ → 6×2+ → 10×1+, retest 5RM and restart at 85%. T2 Deadlift: 3×10 → 3×8 → 3×6. T3 DB Row: add weight when final set reaches 25 reps.',
      'B1: T1 Overhead Press 5×3+, T2 Deadlift 3×10, T3 Dumbbell Row 3×15+'),
    -- Week 3
    (w3, 1,
      'A2 — T1 Bench: 5×3+ → 6×2+ → 10×1+, retest 5RM and restart at 85%. T2 Squat: 3×10 → 3×8 → 3×6. T3 Lat Pulldown: add weight when final set reaches 25 reps.',
      'A2: T1 Bench Press 5×3+, T2 Squat 3×10, T3 Lat Pulldown 3×15+'),
    (w3, 2,
      'B2 — T1 Deadlift: 5×3+ → 6×2+ → 10×1+, retest 5RM and restart at 85%. T2 Press: 3×10 → 3×8 → 3×6. T3 DB Row: add weight when final set reaches 25 reps.',
      'B2: T1 Deadlift 5×3+, T2 Overhead Press 3×10, T3 Dumbbell Row 3×15+'),
    (w3, 3,
      'A1 — T1 Squat: 5×3+ → 6×2+ → 10×1+, retest 5RM and restart at 85%. T2 Bench: 3×10 → 3×8 → 3×6. T3 Lat Pulldown: add weight when final set reaches 25 reps.',
      'A1: T1 Squat 5×3+, T2 Bench Press 3×10, T3 Lat Pulldown 3×15+'),
    -- Week 4
    (w4, 1,
      'B1 — T1 Press: 5×3+ → 6×2+ → 10×1+, retest 5RM and restart at 85%. T2 Deadlift: 3×10 → 3×8 → 3×6. T3 DB Row: add weight when final set reaches 25 reps.',
      'B1: T1 Overhead Press 5×3+, T2 Deadlift 3×10, T3 Dumbbell Row 3×15+'),
    (w4, 2,
      'A2 — T1 Bench: 5×3+ → 6×2+ → 10×1+, retest 5RM and restart at 85%. T2 Squat: 3×10 → 3×8 → 3×6. T3 Lat Pulldown: add weight when final set reaches 25 reps.',
      'A2: T1 Bench Press 5×3+, T2 Squat 3×10, T3 Lat Pulldown 3×15+'),
    (w4, 3,
      'B2 — T1 Deadlift: 5×3+ → 6×2+ → 10×1+, retest 5RM and restart at 85%. T2 Press: 3×10 → 3×8 → 3×6. T3 DB Row: add weight when final set reaches 25 reps.',
      'B2: T1 Deadlift 5×3+, T2 Overhead Press 3×10, T3 Dumbbell Row 3×15+');

  -- Fetch day IDs
  select id into w1d1 from public.program_days where program_week_id = w1 and day_number = 1;
  select id into w1d2 from public.program_days where program_week_id = w1 and day_number = 2;
  select id into w1d3 from public.program_days where program_week_id = w1 and day_number = 3;
  select id into w2d1 from public.program_days where program_week_id = w2 and day_number = 1;
  select id into w2d2 from public.program_days where program_week_id = w2 and day_number = 2;
  select id into w2d3 from public.program_days where program_week_id = w2 and day_number = 3;
  select id into w3d1 from public.program_days where program_week_id = w3 and day_number = 1;
  select id into w3d2 from public.program_days where program_week_id = w3 and day_number = 2;
  select id into w3d3 from public.program_days where program_week_id = w3 and day_number = 3;
  select id into w4d1 from public.program_days where program_week_id = w4 and day_number = 1;
  select id into w4d2 from public.program_days where program_week_id = w4 and day_number = 2;
  select id into w4d3 from public.program_days where program_week_id = w4 and day_number = 3;

  -- Exercises per day
  insert into public.program_day_exercises
    (program_day_id, exercise_id, exercise_type, set_count, target_reps_text, order_index)
  values
    -- W1D1 = A1
    (w1d1, ex_squat,        'T1', 5, '3+',  1),
    (w1d1, ex_bench,        'T2', 3, '10',  2),
    (w1d1, ex_lat_pulldown, 'T3', 3, '15+', 3),
    -- W1D2 = B1
    (w1d2, ex_press,        'T1', 5, '3+',  1),
    (w1d2, ex_deadlift,     'T2', 3, '10',  2),
    (w1d2, ex_db_row,       'T3', 3, '15+', 3),
    -- W1D3 = A2
    (w1d3, ex_bench,        'T1', 5, '3+',  1),
    (w1d3, ex_squat,        'T2', 3, '10',  2),
    (w1d3, ex_lat_pulldown, 'T3', 3, '15+', 3),
    -- W2D1 = B2
    (w2d1, ex_deadlift,     'T1', 5, '3+',  1),
    (w2d1, ex_press,        'T2', 3, '10',  2),
    (w2d1, ex_db_row,       'T3', 3, '15+', 3),
    -- W2D2 = A1
    (w2d2, ex_squat,        'T1', 5, '3+',  1),
    (w2d2, ex_bench,        'T2', 3, '10',  2),
    (w2d2, ex_lat_pulldown, 'T3', 3, '15+', 3),
    -- W2D3 = B1
    (w2d3, ex_press,        'T1', 5, '3+',  1),
    (w2d3, ex_deadlift,     'T2', 3, '10',  2),
    (w2d3, ex_db_row,       'T3', 3, '15+', 3),
    -- W3D1 = A2
    (w3d1, ex_bench,        'T1', 5, '3+',  1),
    (w3d1, ex_squat,        'T2', 3, '10',  2),
    (w3d1, ex_lat_pulldown, 'T3', 3, '15+', 3),
    -- W3D2 = B2
    (w3d2, ex_deadlift,     'T1', 5, '3+',  1),
    (w3d2, ex_press,        'T2', 3, '10',  2),
    (w3d2, ex_db_row,       'T3', 3, '15+', 3),
    -- W3D3 = A1
    (w3d3, ex_squat,        'T1', 5, '3+',  1),
    (w3d3, ex_bench,        'T2', 3, '10',  2),
    (w3d3, ex_lat_pulldown, 'T3', 3, '15+', 3),
    -- W4D1 = B1
    (w4d1, ex_press,        'T1', 5, '3+',  1),
    (w4d1, ex_deadlift,     'T2', 3, '10',  2),
    (w4d1, ex_db_row,       'T3', 3, '15+', 3),
    -- W4D2 = A2
    (w4d2, ex_bench,        'T1', 5, '3+',  1),
    (w4d2, ex_squat,        'T2', 3, '10',  2),
    (w4d2, ex_lat_pulldown, 'T3', 3, '15+', 3),
    -- W4D3 = B2
    (w4d3, ex_deadlift,     'T1', 5, '3+',  1),
    (w4d3, ex_press,        'T2', 3, '10',  2),
    (w4d3, ex_db_row,       'T3', 3, '15+', 3);

  raise notice 'GZCLP Base correction complete. program_id = %', prog_id;

end;
$$;

commit;



-- ==========================================================================
-- STEP 2: POST-CHECK (run after STEP 1 succeeds — read-only)
-- ==========================================================================
--
-- Expected results:
--   • weeks: 4 rows (week_number 1–4)
--   • days:  12 rows total (3 per week)
--   • exercises: 36 rows total (3 per day × 12 days)
--   • program row: duration_weeks=4, days_per_week=3, level=beginner,
--                  source_fidelity=original
--
-- Rotation verification:
--   W1D1=A1(Squat T1), W1D2=B1(Press T1), W1D3=A2(Bench T1)
--   W2D1=B2(Deadlift T1), W2D2=A1(Squat T1), W2D3=B1(Press T1)
--   W3D1=A2(Bench T1), W3D2=B2(Deadlift T1), W3D3=A1(Squat T1)
--   W4D1=B1(Press T1), W4D2=A2(Bench T1), W4D3=B2(Deadlift T1)

/*
select
  pw.week_number,
  pd.day_number,
  pde.order_index,
  e.slug      as exercise_slug,
  pde.exercise_type,
  pde.set_count,
  pde.target_reps_text
from public.programs p
join public.program_weeks pw           on pw.program_id    = p.id
join public.program_days pd            on pd.program_week_id = pw.id
join public.program_day_exercises pde  on pde.program_day_id = pd.id
join public.exercises e                on e.id             = pde.exercise_id
where p.slug = 'gzclp-base'
order by pw.week_number, pd.day_number, pde.order_index;

-- Summary counts
select
  (select duration_weeks  from public.programs where slug = 'gzclp-base') as duration_weeks,
  (select days_per_week   from public.programs where slug = 'gzclp-base') as days_per_week,
  (select level           from public.programs where slug = 'gzclp-base') as level,
  (select source_fidelity from public.programs where slug = 'gzclp-base') as source_fidelity,
  (select count(*) from public.program_weeks pw
     join public.programs p on p.id = pw.program_id
     where p.slug = 'gzclp-base')
    as weeks_count,
  (select count(*) from public.program_days pd
     join public.program_weeks pw on pw.id = pd.program_week_id
     join public.programs p on p.id = pw.program_id
     where p.slug = 'gzclp-base')
    as days_count,
  (select count(*) from public.program_day_exercises pde
     join public.program_days pd on pd.id = pde.program_day_id
     join public.program_weeks pw on pw.id = pd.program_week_id
     join public.programs p on p.id = pw.program_id
     where p.slug = 'gzclp-base')
    as exercises_count;
*/
