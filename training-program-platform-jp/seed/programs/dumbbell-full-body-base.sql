-- Seed: Dumbbell Full Body Base Program
-- Run in Supabase Dashboard > SQL Editor
-- Run program-metadata.sql afterwards to assign tags and source metadata.
--
-- This is an internal custom beginner template, not a named published source
-- program. It should remain classified as custom unless it is explicitly
-- rewritten to match a single documented source.
--
-- Structure:
--   4 weeks x 3 days/week
--   A/B alternating:
--     Week 1: A / B / A
--     Week 2: B / A / B
--     Week 3: A / B / A
--     Week 4: B / A / B
--
-- Day A:
--   DB Goblet Squat    T1  3x12
--   DB Bench Press     T1  3x10
--   DB Row             T2  3x10
--
-- Day B:
--   DB Romanian Deadlift  T1  3x12
--   DB Shoulder Press     T1  3x10
--   DB Curl               T2  3x12

do $$
declare
  ex_goblet_squat uuid;
  ex_db_bench uuid;
  ex_db_row uuid;
  ex_rdl uuid;
  ex_db_press uuid;
  ex_curl uuid;

  prog_id uuid;

  w1 uuid; w2 uuid; w3 uuid; w4 uuid;

  w1d1 uuid; w1d2 uuid; w1d3 uuid;
  w2d1 uuid; w2d2 uuid; w2d3 uuid;
  w3d1 uuid; w3d2 uuid; w3d3 uuid;
  w4d1 uuid; w4d2 uuid; w4d3 uuid;
begin
  insert into public.exercises (slug, name_ja, name_en, category)
  values
    ('db-goblet-squat',        U&'\30C0\30F3\30D9\30EB\30B4\30D6\30EC\30C3\30C8\30B9\30AF\30EF\30C3\30C8', 'Dumbbell Goblet Squat',        'legs'),
    ('db-bench-press',         U&'\30C0\30F3\30D9\30EB\30D9\30F3\30C1\30D7\30EC\30B9',                     'Dumbbell Bench Press',         'chest'),
    ('db-row',                 U&'\30C0\30F3\30D9\30EB\30ED\30A6',                                         'Dumbbell Row',                 'back'),
    ('db-romanian-deadlift',   U&'\30C0\30F3\30D9\30EB\30EB\30FC\30DE\30CB\30A2\30F3\30C7\30C3\30C9\30EA\30D5\30C8', 'Dumbbell Romanian Deadlift', 'back'),
    ('db-shoulder-press',      U&'\30C0\30F3\30D9\30EB\30B7\30E7\30EB\30C0\30FC\30D7\30EC\30B9',           'Dumbbell Shoulder Press',      'shoulders'),
    ('db-curl',                U&'\30C0\30F3\30D9\30EB\30AB\30FC\30EB',                                    'Dumbbell Curl',                'arms')
  on conflict (slug) do nothing;

  select id into ex_goblet_squat from public.exercises where slug = 'db-goblet-squat';
  select id into ex_db_bench     from public.exercises where slug = 'db-bench-press';
  select id into ex_db_row       from public.exercises where slug = 'db-row';
  select id into ex_rdl          from public.exercises where slug = 'db-romanian-deadlift';
  select id into ex_db_press     from public.exercises where slug = 'db-shoulder-press';
  select id into ex_curl         from public.exercises where slug = 'db-curl';

  if ex_goblet_squat is null
    or ex_db_bench   is null
    or ex_db_row     is null
    or ex_rdl        is null
    or ex_db_press   is null
    or ex_curl       is null then
    raise exception 'Exercise lookup failed for dumbbell-full-body-base seed.';
  end if;

  if exists (select 1 from public.programs where slug = 'dumbbell-full-body-base') then
    raise notice 'dumbbell-full-body-base already exists, skipping.';
    return;
  end if;

  insert into public.programs
    (slug, title, description, duration_weeks, days_per_week, level, is_public)
  values
    (
      'dumbbell-full-body-base',
      'Dumbbell Full Body Base',
      'Internal beginner dumbbell full-body template. No single named published source program is being represented by this seed.',
      4,
      3,
      'beginner',
      true
    )
  returning id into prog_id;

  -- ── program_weeks ────────────────────────────────────────────
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

  -- ── program_days ─────────────────────────────────────────────
  -- Week 1: A / B / A
  insert into public.program_days (program_week_id, day_number, progression_guide, notes)
  values
    (w1, 1, 'Choose a weight you can complete all reps with good form. When all sets feel manageable, add a small increment next session.', 'Day A: Goblet Squat 3x12, DB Bench Press 3x10, DB Row 3x10'),
    (w1, 2, 'Choose a weight you can complete all reps with good form. When all sets feel manageable, add a small increment next session.', 'Day B: Romanian Deadlift 3x12, DB Shoulder Press 3x10, DB Curl 3x12'),
    (w1, 3, 'Choose a weight you can complete all reps with good form. When all sets feel manageable, add a small increment next session.', 'Day A: Goblet Squat 3x12, DB Bench Press 3x10, DB Row 3x10');

  -- Week 2: B / A / B
  insert into public.program_days (program_week_id, day_number, progression_guide, notes)
  values
    (w2, 1, 'Choose a weight you can complete all reps with good form. When all sets feel manageable, add a small increment next session.', 'Day B: Romanian Deadlift 3x12, DB Shoulder Press 3x10, DB Curl 3x12'),
    (w2, 2, 'Choose a weight you can complete all reps with good form. When all sets feel manageable, add a small increment next session.', 'Day A: Goblet Squat 3x12, DB Bench Press 3x10, DB Row 3x10'),
    (w2, 3, 'Choose a weight you can complete all reps with good form. When all sets feel manageable, add a small increment next session.', 'Day B: Romanian Deadlift 3x12, DB Shoulder Press 3x10, DB Curl 3x12');

  -- Week 3: A / B / A
  insert into public.program_days (program_week_id, day_number, progression_guide, notes)
  values
    (w3, 1, 'Choose a weight you can complete all reps with good form. When all sets feel manageable, add a small increment next session.', 'Day A: Goblet Squat 3x12, DB Bench Press 3x10, DB Row 3x10'),
    (w3, 2, 'Choose a weight you can complete all reps with good form. When all sets feel manageable, add a small increment next session.', 'Day B: Romanian Deadlift 3x12, DB Shoulder Press 3x10, DB Curl 3x12'),
    (w3, 3, 'Choose a weight you can complete all reps with good form. When all sets feel manageable, add a small increment next session.', 'Day A: Goblet Squat 3x12, DB Bench Press 3x10, DB Row 3x10');

  -- Week 4: B / A / B
  insert into public.program_days (program_week_id, day_number, progression_guide, notes)
  values
    (w4, 1, 'Choose a weight you can complete all reps with good form. When all sets feel manageable, add a small increment next session.', 'Day B: Romanian Deadlift 3x12, DB Shoulder Press 3x10, DB Curl 3x12'),
    (w4, 2, 'Choose a weight you can complete all reps with good form. When all sets feel manageable, add a small increment next session.', 'Day A: Goblet Squat 3x12, DB Bench Press 3x10, DB Row 3x10'),
    (w4, 3, 'Choose a weight you can complete all reps with good form. When all sets feel manageable, add a small increment next session.', 'Day B: Romanian Deadlift 3x12, DB Shoulder Press 3x10, DB Curl 3x12');

  -- ── day UUID 取得 ─────────────────────────────────────────────
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

  -- ── program_day_exercises ─────────────────────────────────────
  -- Week 1 Day 1 (A): Goblet Squat / DB Bench / DB Row
  insert into public.program_day_exercises
    (program_day_id, exercise_id, exercise_type, set_count, target_reps_text, order_index)
  values
    (w1d1, ex_goblet_squat, 'T1', 3, '12', 1),
    (w1d1, ex_db_bench,     'T1', 3, '10', 2),
    (w1d1, ex_db_row,       'T2', 3, '10', 3);

  -- Week 1 Day 2 (B): RDL / DB Shoulder Press / DB Curl
  insert into public.program_day_exercises
    (program_day_id, exercise_id, exercise_type, set_count, target_reps_text, order_index)
  values
    (w1d2, ex_rdl,       'T1', 3, '12', 1),
    (w1d2, ex_db_press,  'T1', 3, '10', 2),
    (w1d2, ex_curl,      'T2', 3, '12', 3);

  -- Week 1 Day 3 (A)
  insert into public.program_day_exercises
    (program_day_id, exercise_id, exercise_type, set_count, target_reps_text, order_index)
  values
    (w1d3, ex_goblet_squat, 'T1', 3, '12', 1),
    (w1d3, ex_db_bench,     'T1', 3, '10', 2),
    (w1d3, ex_db_row,       'T2', 3, '10', 3);

  -- Week 2 Day 1 (B)
  insert into public.program_day_exercises
    (program_day_id, exercise_id, exercise_type, set_count, target_reps_text, order_index)
  values
    (w2d1, ex_rdl,       'T1', 3, '12', 1),
    (w2d1, ex_db_press,  'T1', 3, '10', 2),
    (w2d1, ex_curl,      'T2', 3, '12', 3);

  -- Week 2 Day 2 (A)
  insert into public.program_day_exercises
    (program_day_id, exercise_id, exercise_type, set_count, target_reps_text, order_index)
  values
    (w2d2, ex_goblet_squat, 'T1', 3, '12', 1),
    (w2d2, ex_db_bench,     'T1', 3, '10', 2),
    (w2d2, ex_db_row,       'T2', 3, '10', 3);

  -- Week 2 Day 3 (B)
  insert into public.program_day_exercises
    (program_day_id, exercise_id, exercise_type, set_count, target_reps_text, order_index)
  values
    (w2d3, ex_rdl,       'T1', 3, '12', 1),
    (w2d3, ex_db_press,  'T1', 3, '10', 2),
    (w2d3, ex_curl,      'T2', 3, '12', 3);

  -- Week 3 Day 1 (A)
  insert into public.program_day_exercises
    (program_day_id, exercise_id, exercise_type, set_count, target_reps_text, order_index)
  values
    (w3d1, ex_goblet_squat, 'T1', 3, '12', 1),
    (w3d1, ex_db_bench,     'T1', 3, '10', 2),
    (w3d1, ex_db_row,       'T2', 3, '10', 3);

  -- Week 3 Day 2 (B)
  insert into public.program_day_exercises
    (program_day_id, exercise_id, exercise_type, set_count, target_reps_text, order_index)
  values
    (w3d2, ex_rdl,       'T1', 3, '12', 1),
    (w3d2, ex_db_press,  'T1', 3, '10', 2),
    (w3d2, ex_curl,      'T2', 3, '12', 3);

  -- Week 3 Day 3 (A)
  insert into public.program_day_exercises
    (program_day_id, exercise_id, exercise_type, set_count, target_reps_text, order_index)
  values
    (w3d3, ex_goblet_squat, 'T1', 3, '12', 1),
    (w3d3, ex_db_bench,     'T1', 3, '10', 2),
    (w3d3, ex_db_row,       'T2', 3, '10', 3);

  -- Week 4 Day 1 (B)
  insert into public.program_day_exercises
    (program_day_id, exercise_id, exercise_type, set_count, target_reps_text, order_index)
  values
    (w4d1, ex_rdl,       'T1', 3, '12', 1),
    (w4d1, ex_db_press,  'T1', 3, '10', 2),
    (w4d1, ex_curl,      'T2', 3, '12', 3);

  -- Week 4 Day 2 (A)
  insert into public.program_day_exercises
    (program_day_id, exercise_id, exercise_type, set_count, target_reps_text, order_index)
  values
    (w4d2, ex_goblet_squat, 'T1', 3, '12', 1),
    (w4d2, ex_db_bench,     'T1', 3, '10', 2),
    (w4d2, ex_db_row,       'T2', 3, '10', 3);

  -- Week 4 Day 3 (B)
  insert into public.program_day_exercises
    (program_day_id, exercise_id, exercise_type, set_count, target_reps_text, order_index)
  values
    (w4d3, ex_rdl,       'T1', 3, '12', 1),
    (w4d3, ex_db_press,  'T1', 3, '10', 2),
    (w4d3, ex_curl,      'T2', 3, '12', 3);

  raise notice 'Seed complete: dumbbell-full-body-base program_id = %', prog_id;
end;
$$;

-- Confirmation query
-- select
--   p.slug,
--   pw.week_number,
--   pd.day_number,
--   pd.notes,
--   pde.order_index,
--   e.slug as exercise_slug,
--   e.name_en,
--   pde.exercise_type,
--   pde.set_count,
--   pde.target_reps_text
-- from public.programs p
-- join public.program_weeks pw on pw.program_id = p.id
-- join public.program_days pd on pd.program_week_id = pw.id
-- join public.program_day_exercises pde on pde.program_day_id = pd.id
-- join public.exercises e on e.id = pde.exercise_id
-- where p.slug = 'dumbbell-full-body-base'
-- order by pw.week_number, pd.day_number, pde.order_index;
