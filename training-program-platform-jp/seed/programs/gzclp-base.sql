-- Seed: GZCLP Base Program
-- Run in Supabase Dashboard > SQL Editor
--
-- Source reference:
--   Cody Lefever, "The GZCL Method" (GZCLP section, February 2016)
--
-- This seed intentionally models the original 3-day base month rather than
-- the later 12-week Boostcamp app build.
--
-- Structure:
--   Week 1: A1 / B1 / A2
--   Week 2: B2 / A1 / B1
--   Week 3: A2 / B2 / A1
--   Week 4: B1 / A2 / B2
--
-- Workout A1:
--   T1 Squat 5x3+
--   T2 Bench Press 3x10
--   T3 Lat Pulldown 3x15+
--
-- Workout B1:
--   T1 Overhead Press 5x3+
--   T2 Deadlift 3x10
--   T3 Dumbbell Row 3x15+
--
-- Workout A2:
--   T1 Bench Press 5x3+
--   T2 Squat 3x10
--   T3 Lat Pulldown 3x15+
--
-- Workout B2:
--   T1 Deadlift 5x3+
--   T2 Overhead Press 3x10
--   T3 Dumbbell Row 3x15+
--
-- T1 fail protocol:
--   5x3+ -> 6x2+ -> 10x1+, then retest 5RM and restart at 85%
--
-- T2 fail protocol:
--   3x10 -> 3x8 -> 3x6, then restart slightly heavier
--
-- T3 progression:
--   Add weight when the last set reaches 25 reps

do $$
declare
  ex_squat uuid;
  ex_bench uuid;
  ex_press uuid;
  ex_deadlift uuid;
  ex_lat_pulldown uuid;
  ex_db_row uuid;

  prog_id uuid;

  w1 uuid; w2 uuid; w3 uuid; w4 uuid;

  w1d1 uuid; w1d2 uuid; w1d3 uuid;
  w2d1 uuid; w2d2 uuid; w2d3 uuid;
  w3d1 uuid; w3d2 uuid; w3d3 uuid;
  w4d1 uuid; w4d2 uuid; w4d3 uuid;
begin
  insert into public.exercises (slug, name_ja, name_en, category)
  values
    ('squat', U&'\30B9\30AF\30EF\30C3\30C8', 'Squat', 'legs'),
    ('bench-press', U&'\30D9\30F3\30C1\30D7\30EC\30B9', 'Bench Press', 'chest'),
    ('overhead-press', U&'\30AA\30FC\30D0\30FC\30D8\30C3\30C9\30D7\30EC\30B9', 'Overhead Press', 'shoulders'),
    ('deadlift', U&'\30C7\30C3\30C9\30EA\30D5\30C8', 'Deadlift', 'back'),
    ('lat-pulldown', U&'\30E9\30C3\30C8\30D7\30EB\30C0\30A6\30F3', 'Lat Pulldown', 'back'),
    ('dumbbell-row', U&'\30C0\30F3\30D9\30EB\30ED\30A6', 'Dumbbell Row', 'back')
  on conflict (slug) do nothing;

  select id into ex_squat from public.exercises where slug = 'squat';
  select id into ex_bench from public.exercises where slug = 'bench-press';
  select id into ex_press from public.exercises where slug = 'overhead-press';
  select id into ex_deadlift from public.exercises where slug = 'deadlift';
  select id into ex_lat_pulldown from public.exercises where slug = 'lat-pulldown';
  select id into ex_db_row from public.exercises where slug = 'dumbbell-row';

  if ex_squat is null
    or ex_bench is null
    or ex_press is null
    or ex_deadlift is null
    or ex_lat_pulldown is null
    or ex_db_row is null then
    raise exception 'Exercise lookup failed for gzclp-base seed.';
  end if;

  if exists (select 1 from public.programs where slug = 'gzclp-base') then
    raise notice 'gzclp-base already exists, skipping.';
    return;
  end if;

  insert into public.programs
    (slug, title, description, duration_weeks, days_per_week, level, is_public)
  values
    (
      'gzclp-base',
      'GZCLP Base',
      'Original Cody Lefever GZCLP base month: 3 days per week, four rotating workouts, and the standard T1/T2/T3 progression model.',
      4,
      3,
      'beginner',
      true
    )
  returning id into prog_id;

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

  insert into public.program_days (program_week_id, day_number, progression_guide, notes)
  values
    (w1, 1, 'A1 progression: T1 squat 5x3+ -> 6x2+ -> 10x1+, then retest 5RM and restart at 85%. T2 bench 3x10 -> 3x8 -> 3x6. T3 lat pulldown adds weight when the final set reaches 25 reps.', 'A1: T1 Squat 5x3+, T2 Bench Press 3x10, T3 Lat Pulldown 3x15+'),
    (w1, 2, 'B1 progression: T1 press 5x3+ -> 6x2+ -> 10x1+, then retest 5RM and restart at 85%. T2 deadlift 3x10 -> 3x8 -> 3x6. T3 dumbbell row adds weight when the final set reaches 25 reps.', 'B1: T1 Overhead Press 5x3+, T2 Deadlift 3x10, T3 Dumbbell Row 3x15+'),
    (w1, 3, 'A2 progression: T1 bench 5x3+ -> 6x2+ -> 10x1+, then retest 5RM and restart at 85%. T2 squat 3x10 -> 3x8 -> 3x6. T3 lat pulldown adds weight when the final set reaches 25 reps.', 'A2: T1 Bench Press 5x3+, T2 Squat 3x10, T3 Lat Pulldown 3x15+'),
    (w2, 1, 'B2 progression: T1 deadlift 5x3+ -> 6x2+ -> 10x1+, then retest 5RM and restart at 85%. T2 press 3x10 -> 3x8 -> 3x6. T3 dumbbell row adds weight when the final set reaches 25 reps.', 'B2: T1 Deadlift 5x3+, T2 Overhead Press 3x10, T3 Dumbbell Row 3x15+'),
    (w2, 2, 'A1 progression: T1 squat 5x3+ -> 6x2+ -> 10x1+, then retest 5RM and restart at 85%. T2 bench 3x10 -> 3x8 -> 3x6. T3 lat pulldown adds weight when the final set reaches 25 reps.', 'A1: T1 Squat 5x3+, T2 Bench Press 3x10, T3 Lat Pulldown 3x15+'),
    (w2, 3, 'B1 progression: T1 press 5x3+ -> 6x2+ -> 10x1+, then retest 5RM and restart at 85%. T2 deadlift 3x10 -> 3x8 -> 3x6. T3 dumbbell row adds weight when the final set reaches 25 reps.', 'B1: T1 Overhead Press 5x3+, T2 Deadlift 3x10, T3 Dumbbell Row 3x15+'),
    (w3, 1, 'A2 progression: T1 bench 5x3+ -> 6x2+ -> 10x1+, then retest 5RM and restart at 85%. T2 squat 3x10 -> 3x8 -> 3x6. T3 lat pulldown adds weight when the final set reaches 25 reps.', 'A2: T1 Bench Press 5x3+, T2 Squat 3x10, T3 Lat Pulldown 3x15+'),
    (w3, 2, 'B2 progression: T1 deadlift 5x3+ -> 6x2+ -> 10x1+, then retest 5RM and restart at 85%. T2 press 3x10 -> 3x8 -> 3x6. T3 dumbbell row adds weight when the final set reaches 25 reps.', 'B2: T1 Deadlift 5x3+, T2 Overhead Press 3x10, T3 Dumbbell Row 3x15+'),
    (w3, 3, 'A1 progression: T1 squat 5x3+ -> 6x2+ -> 10x1+, then retest 5RM and restart at 85%. T2 bench 3x10 -> 3x8 -> 3x6. T3 lat pulldown adds weight when the final set reaches 25 reps.', 'A1: T1 Squat 5x3+, T2 Bench Press 3x10, T3 Lat Pulldown 3x15+'),
    (w4, 1, 'B1 progression: T1 press 5x3+ -> 6x2+ -> 10x1+, then retest 5RM and restart at 85%. T2 deadlift 3x10 -> 3x8 -> 3x6. T3 dumbbell row adds weight when the final set reaches 25 reps.', 'B1: T1 Overhead Press 5x3+, T2 Deadlift 3x10, T3 Dumbbell Row 3x15+'),
    (w4, 2, 'A2 progression: T1 bench 5x3+ -> 6x2+ -> 10x1+, then retest 5RM and restart at 85%. T2 squat 3x10 -> 3x8 -> 3x6. T3 lat pulldown adds weight when the final set reaches 25 reps.', 'A2: T1 Bench Press 5x3+, T2 Squat 3x10, T3 Lat Pulldown 3x15+'),
    (w4, 3, 'B2 progression: T1 deadlift 5x3+ -> 6x2+ -> 10x1+, then retest 5RM and restart at 85%. T2 press 3x10 -> 3x8 -> 3x6. T3 dumbbell row adds weight when the final set reaches 25 reps.', 'B2: T1 Deadlift 5x3+, T2 Overhead Press 3x10, T3 Dumbbell Row 3x15+');

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

  insert into public.program_day_exercises
    (program_day_id, exercise_id, exercise_type, set_count, target_reps_text, order_index)
  values
    (w1d1, ex_squat, 'T1', 5, '3+', 1),
    (w1d1, ex_bench, 'T2', 3, '10', 2),
    (w1d1, ex_lat_pulldown, 'T3', 3, '15+', 3),
    (w1d2, ex_press, 'T1', 5, '3+', 1),
    (w1d2, ex_deadlift, 'T2', 3, '10', 2),
    (w1d2, ex_db_row, 'T3', 3, '15+', 3),
    (w1d3, ex_bench, 'T1', 5, '3+', 1),
    (w1d3, ex_squat, 'T2', 3, '10', 2),
    (w1d3, ex_lat_pulldown, 'T3', 3, '15+', 3),
    (w2d1, ex_deadlift, 'T1', 5, '3+', 1),
    (w2d1, ex_press, 'T2', 3, '10', 2),
    (w2d1, ex_db_row, 'T3', 3, '15+', 3),
    (w2d2, ex_squat, 'T1', 5, '3+', 1),
    (w2d2, ex_bench, 'T2', 3, '10', 2),
    (w2d2, ex_lat_pulldown, 'T3', 3, '15+', 3),
    (w2d3, ex_press, 'T1', 5, '3+', 1),
    (w2d3, ex_deadlift, 'T2', 3, '10', 2),
    (w2d3, ex_db_row, 'T3', 3, '15+', 3),
    (w3d1, ex_bench, 'T1', 5, '3+', 1),
    (w3d1, ex_squat, 'T2', 3, '10', 2),
    (w3d1, ex_lat_pulldown, 'T3', 3, '15+', 3),
    (w3d2, ex_deadlift, 'T1', 5, '3+', 1),
    (w3d2, ex_press, 'T2', 3, '10', 2),
    (w3d2, ex_db_row, 'T3', 3, '15+', 3),
    (w3d3, ex_squat, 'T1', 5, '3+', 1),
    (w3d3, ex_bench, 'T2', 3, '10', 2),
    (w3d3, ex_lat_pulldown, 'T3', 3, '15+', 3),
    (w4d1, ex_press, 'T1', 5, '3+', 1),
    (w4d1, ex_deadlift, 'T2', 3, '10', 2),
    (w4d1, ex_db_row, 'T3', 3, '15+', 3),
    (w4d2, ex_bench, 'T1', 5, '3+', 1),
    (w4d2, ex_squat, 'T2', 3, '10', 2),
    (w4d2, ex_lat_pulldown, 'T3', 3, '15+', 3),
    (w4d3, ex_deadlift, 'T1', 5, '3+', 1),
    (w4d3, ex_press, 'T2', 3, '10', 2),
    (w4d3, ex_db_row, 'T3', 3, '15+', 3);

  raise notice 'Seed complete: program_id = %', prog_id;
end;
$$;

-- Confirmation query
-- select
--   p.slug,
--   pw.week_number,
--   pd.day_number,
--   pde.order_index,
--   e.slug as exercise_slug,
--   pde.exercise_type,
--   pde.set_count,
--   pde.target_reps_text
-- from public.programs p
-- join public.program_weeks pw on pw.program_id = p.id
-- join public.program_days pd on pd.program_week_id = pw.id
-- join public.program_day_exercises pde on pde.program_day_id = pd.id
-- join public.exercises e on e.id = pde.exercise_id
-- where p.slug = 'gzclp-base'
-- order by pw.week_number, pd.day_number, pde.order_index;
