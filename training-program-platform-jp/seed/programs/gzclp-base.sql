-- Seed: GZCLP Base Program
-- Run in Supabase Dashboard > SQL Editor
--
-- Structure:
--   3 weeks × 3 days/week
--   Week 1 Day 1: Bench Press (T1) + Squat (T1)
--   Week 1 Day 2: Overhead Press (T1) + Squat (T1)
--   Week 1 Day 3: Bench Press (T1) + Deadlift (T1)
--   Week 2-3: same exercise pattern (heavier loads applied by user)
--
-- slug は trigger (trg_programs_assign_slug) が title から自動採番するため
-- title = 'GZCLP Base' → slug = 'gzclp-base' になる

do $$
declare
  -- exercises
  ex_bench    uuid;
  ex_squat    uuid;
  ex_press    uuid;
  ex_deadlift uuid;

  -- program
  prog_id uuid;

  -- weeks
  w1 uuid; w2 uuid; w3 uuid;

  -- days
  w1d1 uuid; w1d2 uuid; w1d3 uuid;
  w2d1 uuid; w2d2 uuid; w2d3 uuid;
  w3d1 uuid; w3d2 uuid; w3d3 uuid;

begin
  -- ─── 1. exercises (upsert by slug) ──────────────────────────────────
  insert into public.exercises (slug, name_ja, name_en, category)
  values
    ('bench-press',      'ベンチプレス',      'Bench Press',      'chest'),
    ('squat',            'スクワット',        'Squat',            'legs'),
    ('overhead-press',   'オーバーヘッドプレス', 'Overhead Press', 'shoulders'),
    ('deadlift',         'デッドリフト',      'Deadlift',         'back')
  on conflict (slug) do nothing;

  select id into ex_bench    from public.exercises where slug = 'bench-press';
  select id into ex_squat    from public.exercises where slug = 'squat';
  select id into ex_press    from public.exercises where slug = 'overhead-press';
  select id into ex_deadlift from public.exercises where slug = 'deadlift';

  -- ─── 2. program ────────────────────────────────────────────────────
  -- Skip if already exists (idempotent)
  if exists (select 1 from public.programs where slug = 'gzclp-base') then
    raise notice 'gzclp-base already exists, skipping.';
    return;
  end if;

  insert into public.programs
    (title, description, duration_weeks, days_per_week, level, is_public)
  values
    (
      'GZCLP Base',
      '週3回フルボディの初心者向け線形進歩プログラム。'
      'ベンチ・スクワット・プレス・デッドリフトの4種目を中心に構成。',
      3, 3, 'beginner', true
    )
  returning id into prog_id;

  -- ─── 3. weeks ──────────────────────────────────────────────────────
  insert into public.program_weeks (program_id, week_number, label)
  values
    (prog_id, 1, 'Week 1'),
    (prog_id, 2, 'Week 2'),
    (prog_id, 3, 'Week 3');
  -- RETURNING INTO は1行のみ対応。複数行 INSERT 後は SELECT INTO で個別取得する

  select id into w1 from public.program_weeks where program_id = prog_id and week_number = 1;
  select id into w2 from public.program_weeks where program_id = prog_id and week_number = 2;
  select id into w3 from public.program_weeks where program_id = prog_id and week_number = 3;

  -- ─── 4. days ───────────────────────────────────────────────────────
  insert into public.program_days (program_week_id, day_number, notes)
  values
    (w1, 1, 'Day A: ベンチ + スクワット'),
    (w1, 2, 'Day B: プレス + スクワット'),
    (w1, 3, 'Day C: ベンチ + デッドリフト'),
    (w2, 1, 'Day A: ベンチ + スクワット'),
    (w2, 2, 'Day B: プレス + スクワット'),
    (w2, 3, 'Day C: ベンチ + デッドリフト'),
    (w3, 1, 'Day A: ベンチ + スクワット'),
    (w3, 2, 'Day B: プレス + スクワット'),
    (w3, 3, 'Day C: ベンチ + デッドリフト');

  select id into w1d1 from public.program_days where program_week_id = w1 and day_number = 1;
  select id into w1d2 from public.program_days where program_week_id = w1 and day_number = 2;
  select id into w1d3 from public.program_days where program_week_id = w1 and day_number = 3;
  select id into w2d1 from public.program_days where program_week_id = w2 and day_number = 1;
  select id into w2d2 from public.program_days where program_week_id = w2 and day_number = 2;
  select id into w2d3 from public.program_days where program_week_id = w2 and day_number = 3;
  select id into w3d1 from public.program_days where program_week_id = w3 and day_number = 1;
  select id into w3d2 from public.program_days where program_week_id = w3 and day_number = 2;
  select id into w3d3 from public.program_days where program_week_id = w3 and day_number = 3;

  -- ─── 5. program_day_exercises ──────────────────────────────────────
  -- Week 1 Day 1: Bench(T1) + Squat(T1)
  insert into public.program_day_exercises
    (program_day_id, exercise_id, exercise_type, set_count, target_reps_text, order_index)
  values
    (w1d1, ex_bench,    'T1', 5, '5', 1),
    (w1d1, ex_squat,    'T1', 3, '5', 2);

  -- Week 1 Day 2: Press(T1) + Squat(T1)
  insert into public.program_day_exercises
    (program_day_id, exercise_id, exercise_type, set_count, target_reps_text, order_index)
  values
    (w1d2, ex_press,    'T1', 5, '5', 1),
    (w1d2, ex_squat,    'T1', 3, '5', 2);

  -- Week 1 Day 3: Bench(T1) + Deadlift(T1)
  insert into public.program_day_exercises
    (program_day_id, exercise_id, exercise_type, set_count, target_reps_text, order_index)
  values
    (w1d3, ex_bench,    'T1', 5, '5', 1),
    (w1d3, ex_deadlift, 'T1', 1, '5', 2);

  -- Week 2 Day 1
  insert into public.program_day_exercises
    (program_day_id, exercise_id, exercise_type, set_count, target_reps_text, order_index)
  values
    (w2d1, ex_bench,    'T1', 5, '5', 1),
    (w2d1, ex_squat,    'T1', 3, '5', 2);

  -- Week 2 Day 2
  insert into public.program_day_exercises
    (program_day_id, exercise_id, exercise_type, set_count, target_reps_text, order_index)
  values
    (w2d2, ex_press,    'T1', 5, '5', 1),
    (w2d2, ex_squat,    'T1', 3, '5', 2);

  -- Week 2 Day 3
  insert into public.program_day_exercises
    (program_day_id, exercise_id, exercise_type, set_count, target_reps_text, order_index)
  values
    (w2d3, ex_bench,    'T1', 5, '5', 1),
    (w2d3, ex_deadlift, 'T1', 1, '5', 2);

  -- Week 3 Day 1
  insert into public.program_day_exercises
    (program_day_id, exercise_id, exercise_type, set_count, target_reps_text, order_index)
  values
    (w3d1, ex_bench,    'T1', 5, '5', 1),
    (w3d1, ex_squat,    'T1', 3, '5', 2);

  -- Week 3 Day 2
  insert into public.program_day_exercises
    (program_day_id, exercise_id, exercise_type, set_count, target_reps_text, order_index)
  values
    (w3d2, ex_press,    'T1', 5, '5', 1),
    (w3d2, ex_squat,    'T1', 3, '5', 2);

  -- Week 3 Day 3
  insert into public.program_day_exercises
    (program_day_id, exercise_id, exercise_type, set_count, target_reps_text, order_index)
  values
    (w3d3, ex_bench,    'T1', 5, '5', 1),
    (w3d3, ex_deadlift, 'T1', 1, '5', 2);

  raise notice 'Seed complete: program_id = %', prog_id;
end;
$$;

-- 確認クエリ（実行後に別途貼り付けて確認）
-- select p.slug, pw.week_number, pd.day_number, pd.id as day_id
-- from public.programs p
-- join public.program_weeks pw on pw.program_id = p.id
-- join public.program_days pd on pd.program_week_id = pw.id
-- where p.slug = 'gzclp-base'
-- order by pw.week_number, pd.day_number;
