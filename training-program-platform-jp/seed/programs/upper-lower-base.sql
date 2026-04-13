-- Seed: Upper Lower Base Program
-- Run in Supabase Dashboard > SQL Editor
-- Run program-metadata.sql afterwards to assign tags.
--
-- Structure:
--   4 weeks × 4 days/week
--   Odd days (D1, D3) — Upper: Bench Press (T1) + Overhead Press (T2) + Barbell Row (T2)
--   Even days (D2, D4) — Lower: Squat (T1) + Deadlift (T1)
--
-- slug は trigger が title から自動採番する
--   title = 'Upper Lower Base' → slug = 'upper-lower-base'

do $$
declare
  ex_bench    uuid;
  ex_press    uuid;
  ex_row      uuid;
  ex_squat    uuid;
  ex_deadlift uuid;

  prog_id uuid;

  w1 uuid; w2 uuid; w3 uuid; w4 uuid;

  w1d1 uuid; w1d2 uuid; w1d3 uuid; w1d4 uuid;
  w2d1 uuid; w2d2 uuid; w2d3 uuid; w2d4 uuid;
  w3d1 uuid; w3d2 uuid; w3d3 uuid; w3d4 uuid;
  w4d1 uuid; w4d2 uuid; w4d3 uuid; w4d4 uuid;

begin
  -- ─── 1. exercises (upsert by slug) ──────────────────────────────────
  insert into public.exercises (slug, name_ja, name_en, category)
  values
    ('bench-press',    'ベンチプレス',        'Bench Press',    'chest'),
    ('overhead-press', 'オーバーヘッドプレス',  'Overhead Press', 'shoulders'),
    ('barbell-row',    'バーベルロウ',        'Barbell Row',    'back'),
    ('squat',          'スクワット',          'Squat',          'legs'),
    ('deadlift',       'デッドリフト',        'Deadlift',       'back')
  on conflict (slug) do nothing;

  select id into ex_bench    from public.exercises where slug = 'bench-press';
  select id into ex_press    from public.exercises where slug = 'overhead-press';
  select id into ex_row      from public.exercises where slug = 'barbell-row';
  select id into ex_squat    from public.exercises where slug = 'squat';
  select id into ex_deadlift from public.exercises where slug = 'deadlift';

  -- ─── 2. program ────────────────────────────────────────────────────
  if exists (select 1 from public.programs where slug = 'upper-lower-base') then
    raise notice 'upper-lower-base already exists, skipping.';
    return;
  end if;

  insert into public.programs
    (title, description, duration_weeks, days_per_week, level, is_public)
  values
    (
      'Upper Lower Base',
      '上半身・下半身に分割した週4回の中級バーベルプログラム。'
      'ベンチ・プレス・ロウを上半身日に、スクワット・デッドリフトを下半身日に集中させる。',
      4, 4, 'intermediate', true
    )
  returning id into prog_id;

  -- ─── 3. weeks ──────────────────────────────────────────────────────
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

  -- ─── 4. days (Upper = D1/D3, Lower = D2/D4) ────────────────────────
  insert into public.program_days (program_week_id, day_number, notes)
  values
    (w1, 1, 'Upper: ベンチ + プレス + ロウ'),
    (w1, 2, 'Lower: スクワット + デッドリフト'),
    (w1, 3, 'Upper: ベンチ + プレス + ロウ'),
    (w1, 4, 'Lower: スクワット + デッドリフト'),
    (w2, 1, 'Upper: ベンチ + プレス + ロウ'),
    (w2, 2, 'Lower: スクワット + デッドリフト'),
    (w2, 3, 'Upper: ベンチ + プレス + ロウ'),
    (w2, 4, 'Lower: スクワット + デッドリフト'),
    (w3, 1, 'Upper: ベンチ + プレス + ロウ'),
    (w3, 2, 'Lower: スクワット + デッドリフト'),
    (w3, 3, 'Upper: ベンチ + プレス + ロウ'),
    (w3, 4, 'Lower: スクワット + デッドリフト'),
    (w4, 1, 'Upper: ベンチ + プレス + ロウ'),
    (w4, 2, 'Lower: スクワット + デッドリフト'),
    (w4, 3, 'Upper: ベンチ + プレス + ロウ'),
    (w4, 4, 'Lower: スクワット + デッドリフト');

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

  -- ─── 5. program_day_exercises ──────────────────────────────────────
  -- Upper pattern: Bench T1 4×5 / Press T2 3×6 / Row T2 3×8
  -- Lower pattern: Squat T1 4×5 / Deadlift T1 1×5

  -- Week 1
  insert into public.program_day_exercises
    (program_day_id, exercise_id, exercise_type, set_count, target_reps_text, order_index)
  values
    (w1d1, ex_bench,    'T1', 4, '5', 1),
    (w1d1, ex_press,    'T2', 3, '6', 2),
    (w1d1, ex_row,      'T2', 3, '8', 3),
    (w1d2, ex_squat,    'T1', 4, '5', 1),
    (w1d2, ex_deadlift, 'T1', 1, '5', 2),
    (w1d3, ex_bench,    'T1', 4, '5', 1),
    (w1d3, ex_press,    'T2', 3, '6', 2),
    (w1d3, ex_row,      'T2', 3, '8', 3),
    (w1d4, ex_squat,    'T1', 4, '5', 1),
    (w1d4, ex_deadlift, 'T1', 1, '5', 2);

  -- Week 2
  insert into public.program_day_exercises
    (program_day_id, exercise_id, exercise_type, set_count, target_reps_text, order_index)
  values
    (w2d1, ex_bench,    'T1', 4, '5', 1),
    (w2d1, ex_press,    'T2', 3, '6', 2),
    (w2d1, ex_row,      'T2', 3, '8', 3),
    (w2d2, ex_squat,    'T1', 4, '5', 1),
    (w2d2, ex_deadlift, 'T1', 1, '5', 2),
    (w2d3, ex_bench,    'T1', 4, '5', 1),
    (w2d3, ex_press,    'T2', 3, '6', 2),
    (w2d3, ex_row,      'T2', 3, '8', 3),
    (w2d4, ex_squat,    'T1', 4, '5', 1),
    (w2d4, ex_deadlift, 'T1', 1, '5', 2);

  -- Week 3
  insert into public.program_day_exercises
    (program_day_id, exercise_id, exercise_type, set_count, target_reps_text, order_index)
  values
    (w3d1, ex_bench,    'T1', 4, '5', 1),
    (w3d1, ex_press,    'T2', 3, '6', 2),
    (w3d1, ex_row,      'T2', 3, '8', 3),
    (w3d2, ex_squat,    'T1', 4, '5', 1),
    (w3d2, ex_deadlift, 'T1', 1, '5', 2),
    (w3d3, ex_bench,    'T1', 4, '5', 1),
    (w3d3, ex_press,    'T2', 3, '6', 2),
    (w3d3, ex_row,      'T2', 3, '8', 3),
    (w3d4, ex_squat,    'T1', 4, '5', 1),
    (w3d4, ex_deadlift, 'T1', 1, '5', 2);

  -- Week 4
  insert into public.program_day_exercises
    (program_day_id, exercise_id, exercise_type, set_count, target_reps_text, order_index)
  values
    (w4d1, ex_bench,    'T1', 4, '5', 1),
    (w4d1, ex_press,    'T2', 3, '6', 2),
    (w4d1, ex_row,      'T2', 3, '8', 3),
    (w4d2, ex_squat,    'T1', 4, '5', 1),
    (w4d2, ex_deadlift, 'T1', 1, '5', 2),
    (w4d3, ex_bench,    'T1', 4, '5', 1),
    (w4d3, ex_press,    'T2', 3, '6', 2),
    (w4d3, ex_row,      'T2', 3, '8', 3),
    (w4d4, ex_squat,    'T1', 4, '5', 1),
    (w4d4, ex_deadlift, 'T1', 1, '5', 2);

  raise notice 'Seed complete: upper-lower-base program_id = %', prog_id;
end;
$$;

-- 確認クエリ
-- select p.slug, pw.week_number, pd.day_number, pde.order_index,
--        e.slug as exercise_slug, pde.exercise_type, pde.set_count, pde.target_reps_text
-- from public.programs p
-- join public.program_weeks pw on pw.program_id = p.id
-- join public.program_days pd on pd.program_week_id = pw.id
-- join public.program_day_exercises pde on pde.program_day_id = pd.id
-- join public.exercises e on e.id = pde.exercise_id
-- where p.slug = 'upper-lower-base'
-- order by pw.week_number, pd.day_number, pde.order_index;
