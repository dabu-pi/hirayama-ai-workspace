-- Seed: Upper Lower Base Program
-- Run in Supabase Dashboard > SQL Editor
-- Run program-metadata.sql afterwards to assign tags and source metadata.
--
-- This is an internal custom MVP template, not a named published source
-- program. It should remain classified as custom unless it is explicitly
-- rewritten to match a single documented source.
--
-- Structure:
--   4 weeks x 4 days/week
--   Upper days (D1, D3): Bench Press (T1) + Overhead Press (T2) + Barbell Row (T2)
--   Lower days (D2, D4): Squat (T1) + Deadlift (T1)

do $$
declare
  ex_bench uuid;
  ex_press uuid;
  ex_row uuid;
  ex_squat uuid;
  ex_deadlift uuid;

  prog_id uuid;

  w1 uuid; w2 uuid; w3 uuid; w4 uuid;

  w1d1 uuid; w1d2 uuid; w1d3 uuid; w1d4 uuid;
  w2d1 uuid; w2d2 uuid; w2d3 uuid; w2d4 uuid;
  w3d1 uuid; w3d2 uuid; w3d3 uuid; w3d4 uuid;
  w4d1 uuid; w4d2 uuid; w4d3 uuid; w4d4 uuid;
begin
  insert into public.exercises (slug, name_ja, name_en, category)
  values
    ('bench-press', U&'\30D9\30F3\30C1\30D7\30EC\30B9', 'Bench Press', 'chest'),
    ('overhead-press', U&'\30AA\30FC\30D0\30FC\30D8\30C3\30C9\30D7\30EC\30B9', 'Overhead Press', 'shoulders'),
    ('barbell-row', U&'\30D0\30FC\30D9\30EB\30ED\30A6', 'Barbell Row', 'back'),
    ('squat', U&'\30B9\30AF\30EF\30C3\30C8', 'Squat', 'legs'),
    ('deadlift', U&'\30C7\30C3\30C9\30EA\30D5\30C8', 'Deadlift', 'back')
  on conflict (slug) do nothing;

  select id into ex_bench from public.exercises where slug = 'bench-press';
  select id into ex_press from public.exercises where slug = 'overhead-press';
  select id into ex_row from public.exercises where slug = 'barbell-row';
  select id into ex_squat from public.exercises where slug = 'squat';
  select id into ex_deadlift from public.exercises where slug = 'deadlift';

  if ex_bench is null
    or ex_press is null
    or ex_row is null
    or ex_squat is null
    or ex_deadlift is null then
    raise exception 'Exercise lookup failed for upper-lower-base seed.';
  end if;

  if exists (select 1 from public.programs where slug = 'upper-lower-base') then
    raise notice 'upper-lower-base already exists, skipping.';
    return;
  end if;

  insert into public.programs
    (slug, title, description, duration_weeks, days_per_week, level, is_public)
  values
    (
      'upper-lower-base',
      'Upper Lower Base',
      'Internal MVP upper/lower strength split. No single named published source program is being represented by this seed.',
      4,
      4,
      'intermediate',
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
    (w1, 1, 'Upper day progression is intentionally custom. Increase load only when all prescribed reps are clean and repeatable.', 'Upper: Bench Press 4x5, Overhead Press 3x6, Barbell Row 3x8'),
    (w1, 2, 'Lower day progression is intentionally custom. Increase load only when all prescribed reps are clean and repeatable.', 'Lower: Squat 4x5, Deadlift 1x5'),
    (w1, 3, 'Upper day progression is intentionally custom. Increase load only when all prescribed reps are clean and repeatable.', 'Upper: Bench Press 4x5, Overhead Press 3x6, Barbell Row 3x8'),
    (w1, 4, 'Lower day progression is intentionally custom. Increase load only when all prescribed reps are clean and repeatable.', 'Lower: Squat 4x5, Deadlift 1x5'),
    (w2, 1, 'Upper day progression is intentionally custom. Increase load only when all prescribed reps are clean and repeatable.', 'Upper: Bench Press 4x5, Overhead Press 3x6, Barbell Row 3x8'),
    (w2, 2, 'Lower day progression is intentionally custom. Increase load only when all prescribed reps are clean and repeatable.', 'Lower: Squat 4x5, Deadlift 1x5'),
    (w2, 3, 'Upper day progression is intentionally custom. Increase load only when all prescribed reps are clean and repeatable.', 'Upper: Bench Press 4x5, Overhead Press 3x6, Barbell Row 3x8'),
    (w2, 4, 'Lower day progression is intentionally custom. Increase load only when all prescribed reps are clean and repeatable.', 'Lower: Squat 4x5, Deadlift 1x5'),
    (w3, 1, 'Upper day progression is intentionally custom. Increase load only when all prescribed reps are clean and repeatable.', 'Upper: Bench Press 4x5, Overhead Press 3x6, Barbell Row 3x8'),
    (w3, 2, 'Lower day progression is intentionally custom. Increase load only when all prescribed reps are clean and repeatable.', 'Lower: Squat 4x5, Deadlift 1x5'),
    (w3, 3, 'Upper day progression is intentionally custom. Increase load only when all prescribed reps are clean and repeatable.', 'Upper: Bench Press 4x5, Overhead Press 3x6, Barbell Row 3x8'),
    (w3, 4, 'Lower day progression is intentionally custom. Increase load only when all prescribed reps are clean and repeatable.', 'Lower: Squat 4x5, Deadlift 1x5'),
    (w4, 1, 'Upper day progression is intentionally custom. Increase load only when all prescribed reps are clean and repeatable.', 'Upper: Bench Press 4x5, Overhead Press 3x6, Barbell Row 3x8'),
    (w4, 2, 'Lower day progression is intentionally custom. Increase load only when all prescribed reps are clean and repeatable.', 'Lower: Squat 4x5, Deadlift 1x5'),
    (w4, 3, 'Upper day progression is intentionally custom. Increase load only when all prescribed reps are clean and repeatable.', 'Upper: Bench Press 4x5, Overhead Press 3x6, Barbell Row 3x8'),
    (w4, 4, 'Lower day progression is intentionally custom. Increase load only when all prescribed reps are clean and repeatable.', 'Lower: Squat 4x5, Deadlift 1x5');

  select id into w1d1 from public.program_days where program_week_id = w1 and day_number = 1;
  select id into w1d2 from public.program_days where program_week_id = w1 and day_number = 2;
  select id into w1d3 from public.program_days where program_week_id = w1 and day_number = 3;
  select id into w1d4 from public.program_days where program_week_id = w1 and day_number = 4;
  select id into w2d1 from public.program_days where program_week_id = w2 and day_number = 1;
  select id into w2d2 from public.program_days where program_week_id = w2 and day_number = 2;
  select id into w2d3 from public.program_days where program_week_id = w2 and day_number = 3;
  select id into w2d4 from public.program_days where program_week_id = w2 and day_number = 4;
  select id into w3d1 from public.program_days where program_week_id = w3 and day_number = 1;
  select id into w3d2 from public.program_days where program_week_id = w3 and day_number = 2;
  select id into w3d3 from public.program_days where program_week_id = w3 and day_number = 3;
  select id into w3d4 from public.program_days where program_week_id = w3 and day_number = 4;
  select id into w4d1 from public.program_days where program_week_id = w4 and day_number = 1;
  select id into w4d2 from public.program_days where program_week_id = w4 and day_number = 2;
  select id into w4d3 from public.program_days where program_week_id = w4 and day_number = 3;
  select id into w4d4 from public.program_days where program_week_id = w4 and day_number = 4;

  insert into public.program_day_exercises
    (program_day_id, exercise_id, exercise_type, set_count, target_reps_text, order_index)
  values
    (w1d1, ex_bench, 'T1', 4, '5', 1),
    (w1d1, ex_press, 'T2', 3, '6', 2),
    (w1d1, ex_row, 'T2', 3, '8', 3),
    (w1d2, ex_squat, 'T1', 4, '5', 1),
    (w1d2, ex_deadlift, 'T1', 1, '5', 2),
    (w1d3, ex_bench, 'T1', 4, '5', 1),
    (w1d3, ex_press, 'T2', 3, '6', 2),
    (w1d3, ex_row, 'T2', 3, '8', 3),
    (w1d4, ex_squat, 'T1', 4, '5', 1),
    (w1d4, ex_deadlift, 'T1', 1, '5', 2),
    (w2d1, ex_bench, 'T1', 4, '5', 1),
    (w2d1, ex_press, 'T2', 3, '6', 2),
    (w2d1, ex_row, 'T2', 3, '8', 3),
    (w2d2, ex_squat, 'T1', 4, '5', 1),
    (w2d2, ex_deadlift, 'T1', 1, '5', 2),
    (w2d3, ex_bench, 'T1', 4, '5', 1),
    (w2d3, ex_press, 'T2', 3, '6', 2),
    (w2d3, ex_row, 'T2', 3, '8', 3),
    (w2d4, ex_squat, 'T1', 4, '5', 1),
    (w2d4, ex_deadlift, 'T1', 1, '5', 2),
    (w3d1, ex_bench, 'T1', 4, '5', 1),
    (w3d1, ex_press, 'T2', 3, '6', 2),
    (w3d1, ex_row, 'T2', 3, '8', 3),
    (w3d2, ex_squat, 'T1', 4, '5', 1),
    (w3d2, ex_deadlift, 'T1', 1, '5', 2),
    (w3d3, ex_bench, 'T1', 4, '5', 1),
    (w3d3, ex_press, 'T2', 3, '6', 2),
    (w3d3, ex_row, 'T2', 3, '8', 3),
    (w3d4, ex_squat, 'T1', 4, '5', 1),
    (w3d4, ex_deadlift, 'T1', 1, '5', 2),
    (w4d1, ex_bench, 'T1', 4, '5', 1),
    (w4d1, ex_press, 'T2', 3, '6', 2),
    (w4d1, ex_row, 'T2', 3, '8', 3),
    (w4d2, ex_squat, 'T1', 4, '5', 1),
    (w4d2, ex_deadlift, 'T1', 1, '5', 2),
    (w4d3, ex_bench, 'T1', 4, '5', 1),
    (w4d3, ex_press, 'T2', 3, '6', 2),
    (w4d3, ex_row, 'T2', 3, '8', 3),
    (w4d4, ex_squat, 'T1', 4, '5', 1),
    (w4d4, ex_deadlift, 'T1', 1, '5', 2);

  raise notice 'Seed complete: upper-lower-base program_id = %', prog_id;
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
-- where p.slug = 'upper-lower-base'
-- order by pw.week_number, pd.day_number, pde.order_index;
