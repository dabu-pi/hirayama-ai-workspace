-- Seed: Starting Strength Base Program
-- Run in Supabase Dashboard > SQL Editor
--
-- Structure:
--   3 weeks x 3 days/week
--   Week 1: A / B / A
--   Week 2: B / A / B
--   Week 3: A / B / A
--
-- Workout A:
--   Squat 3x5
--   Bench Press 3x5
--   Deadlift 1x5
--
-- Workout B:
--   Squat 3x5
--   Overhead Press 3x5
--   Power Clean 5x3
--
-- GZCLP Base と同じ初心者バーベル軸だが、
-- こちらは「スクワット毎回 + A/B交互 + パワークリーン入り」の
-- クラシックな novice linear progression として区別する。
--
-- slug は trigger (trg_programs_assign_slug) が title から自動採番するため
-- title = 'Starting Strength Base' -> slug = 'starting-strength-base' になる

do $$
declare
  -- exercises
  ex_squat uuid;
  ex_bench uuid;
  ex_press uuid;
  ex_deadlift uuid;
  ex_power_clean uuid;

  -- program
  prog_id uuid;

  -- weeks
  w1 uuid; w2 uuid; w3 uuid;

  -- days
  w1d1 uuid; w1d2 uuid; w1d3 uuid;
  w2d1 uuid; w2d2 uuid; w2d3 uuid;
  w3d1 uuid; w3d2 uuid; w3d3 uuid;

begin
  -- 1. exercises (upsert by slug)
  insert into public.exercises (slug, name_ja, name_en, category)
  values
    ('squat', 'スクワット', 'Squat', 'legs'),
    ('bench-press', 'ベンチプレス', 'Bench Press', 'chest'),
    ('overhead-press', 'オーバーヘッドプレス', 'Overhead Press', 'shoulders'),
    ('deadlift', 'デッドリフト', 'Deadlift', 'back'),
    ('power-clean', 'パワークリーン', 'Power Clean', 'back')
  on conflict (slug) do nothing;

  select id into ex_squat from public.exercises where slug = 'squat';
  select id into ex_bench from public.exercises where slug = 'bench-press';
  select id into ex_press from public.exercises where slug = 'overhead-press';
  select id into ex_deadlift from public.exercises where slug = 'deadlift';
  select id into ex_power_clean from public.exercises where slug = 'power-clean';

  if ex_squat is null
    or ex_bench is null
    or ex_press is null
    or ex_deadlift is null
    or ex_power_clean is null then
    raise exception 'Exercise lookup failed for starting-strength-base seed.';
  end if;

  -- 2. program
  -- Skip if already exists (idempotent)
  if exists (select 1 from public.programs where slug = 'starting-strength-base') then
    raise notice 'starting-strength-base already exists, skipping.';
    return;
  end if;

  insert into public.programs
    (title, description, duration_weeks, days_per_week, level, is_public)
  values
    (
      'Starting Strength Base',
      'スクワットを毎回行い、ベンチプレスとオーバーヘッドプレスを交互に進める初心者向けA/Bプログラム。GZCLP Baseよりも種目構成を絞り、パワークリーンを含むクラシックな線形進歩の土台として使いやすい構成にしている。',
      3, 3, 'beginner', true
    )
  returning id into prog_id;

  -- 3. weeks
  insert into public.program_weeks (program_id, week_number, label)
  values
    (prog_id, 1, 'Week 1'),
    (prog_id, 2, 'Week 2'),
    (prog_id, 3, 'Week 3');

  select id into w1 from public.program_weeks where program_id = prog_id and week_number = 1;
  select id into w2 from public.program_weeks where program_id = prog_id and week_number = 2;
  select id into w3 from public.program_weeks where program_id = prog_id and week_number = 3;

  -- 4. days
  insert into public.program_days (program_week_id, day_number, progression_guide, notes)
  values
    (
      w1, 1,
      'スクワットとベンチプレスは全セット完遂で次回 +2.5kg、デッドリフトは +5kg を目安に進める。',
      'Workout A: スクワット 3x5 / ベンチプレス 3x5 / デッドリフト 1x5'
    ),
    (
      w1, 2,
      'スクワットは継続して +2.5kg、オーバーヘッドプレスは +2.5kg、パワークリーンはフォーム優先で小刻みに進める。',
      'Workout B: スクワット 3x5 / オーバーヘッドプレス 3x5 / パワークリーン 5x3'
    ),
    (
      w1, 3,
      'Week 1 の A を再実施。フォームを崩さず完遂できる重量で線形進歩を続ける。',
      'Workout A: スクワット 3x5 / ベンチプレス 3x5 / デッドリフト 1x5'
    ),
    (
      w2, 1,
      'Week 2 は B から開始。前週の完遂状況に応じてオーバーヘッドプレスとパワークリーンを微増する。',
      'Workout B: スクワット 3x5 / オーバーヘッドプレス 3x5 / パワークリーン 5x3'
    ),
    (
      w2, 2,
      'Workout A に戻る。スクワットは毎回実施、上半身種目は A/B で交互に進める。',
      'Workout A: スクワット 3x5 / ベンチプレス 3x5 / デッドリフト 1x5'
    ),
    (
      w2, 3,
      'Week 2 の締めを Workout B で行う。パワークリーンは速度が落ちたら据え置きを許容する。',
      'Workout B: スクワット 3x5 / オーバーヘッドプレス 3x5 / パワークリーン 5x3'
    ),
    (
      w3, 1,
      'Week 3 は A から再開。A/B 交互のリズムを保ったまま線形進歩を継続する。',
      'Workout A: スクワット 3x5 / ベンチプレス 3x5 / デッドリフト 1x5'
    ),
    (
      w3, 2,
      'Workout B。疲労が強い場合もセット数は維持し、重量だけを保守的に調整する。',
      'Workout B: スクワット 3x5 / オーバーヘッドプレス 3x5 / パワークリーン 5x3'
    ),
    (
      w3, 3,
      '3週目の締めを Workout A で行う。次の実運用では同パターンを継続するか、別プログラムへ進む判断材料にする。',
      'Workout A: スクワット 3x5 / ベンチプレス 3x5 / デッドリフト 1x5'
    );

  select id into w1d1 from public.program_days where program_week_id = w1 and day_number = 1;
  select id into w1d2 from public.program_days where program_week_id = w1 and day_number = 2;
  select id into w1d3 from public.program_days where program_week_id = w1 and day_number = 3;
  select id into w2d1 from public.program_days where program_week_id = w2 and day_number = 1;
  select id into w2d2 from public.program_days where program_week_id = w2 and day_number = 2;
  select id into w2d3 from public.program_days where program_week_id = w2 and day_number = 3;
  select id into w3d1 from public.program_days where program_week_id = w3 and day_number = 1;
  select id into w3d2 from public.program_days where program_week_id = w3 and day_number = 2;
  select id into w3d3 from public.program_days where program_week_id = w3 and day_number = 3;

  -- 5. program_day_exercises
  -- Week 1 Day 1: Workout A
  insert into public.program_day_exercises
    (program_day_id, exercise_id, exercise_type, set_count, target_reps_text, order_index)
  values
    (w1d1, ex_squat, 'T1', 3, '5', 1),
    (w1d1, ex_bench, 'T1', 3, '5', 2),
    (w1d1, ex_deadlift, 'T2', 1, '5', 3);

  -- Week 1 Day 2: Workout B
  insert into public.program_day_exercises
    (program_day_id, exercise_id, exercise_type, set_count, target_reps_text, order_index)
  values
    (w1d2, ex_squat, 'T1', 3, '5', 1),
    (w1d2, ex_press, 'T1', 3, '5', 2),
    (w1d2, ex_power_clean, 'T2', 5, '3', 3);

  -- Week 1 Day 3: Workout A
  insert into public.program_day_exercises
    (program_day_id, exercise_id, exercise_type, set_count, target_reps_text, order_index)
  values
    (w1d3, ex_squat, 'T1', 3, '5', 1),
    (w1d3, ex_bench, 'T1', 3, '5', 2),
    (w1d3, ex_deadlift, 'T2', 1, '5', 3);

  -- Week 2 Day 1: Workout B
  insert into public.program_day_exercises
    (program_day_id, exercise_id, exercise_type, set_count, target_reps_text, order_index)
  values
    (w2d1, ex_squat, 'T1', 3, '5', 1),
    (w2d1, ex_press, 'T1', 3, '5', 2),
    (w2d1, ex_power_clean, 'T2', 5, '3', 3);

  -- Week 2 Day 2: Workout A
  insert into public.program_day_exercises
    (program_day_id, exercise_id, exercise_type, set_count, target_reps_text, order_index)
  values
    (w2d2, ex_squat, 'T1', 3, '5', 1),
    (w2d2, ex_bench, 'T1', 3, '5', 2),
    (w2d2, ex_deadlift, 'T2', 1, '5', 3);

  -- Week 2 Day 3: Workout B
  insert into public.program_day_exercises
    (program_day_id, exercise_id, exercise_type, set_count, target_reps_text, order_index)
  values
    (w2d3, ex_squat, 'T1', 3, '5', 1),
    (w2d3, ex_press, 'T1', 3, '5', 2),
    (w2d3, ex_power_clean, 'T2', 5, '3', 3);

  -- Week 3 Day 1: Workout A
  insert into public.program_day_exercises
    (program_day_id, exercise_id, exercise_type, set_count, target_reps_text, order_index)
  values
    (w3d1, ex_squat, 'T1', 3, '5', 1),
    (w3d1, ex_bench, 'T1', 3, '5', 2),
    (w3d1, ex_deadlift, 'T2', 1, '5', 3);

  -- Week 3 Day 2: Workout B
  insert into public.program_day_exercises
    (program_day_id, exercise_id, exercise_type, set_count, target_reps_text, order_index)
  values
    (w3d2, ex_squat, 'T1', 3, '5', 1),
    (w3d2, ex_press, 'T1', 3, '5', 2),
    (w3d2, ex_power_clean, 'T2', 5, '3', 3);

  -- Week 3 Day 3: Workout A
  insert into public.program_day_exercises
    (program_day_id, exercise_id, exercise_type, set_count, target_reps_text, order_index)
  values
    (w3d3, ex_squat, 'T1', 3, '5', 1),
    (w3d3, ex_bench, 'T1', 3, '5', 2),
    (w3d3, ex_deadlift, 'T2', 1, '5', 3);

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
-- where p.slug = 'starting-strength-base'
-- order by pw.week_number, pd.day_number, pde.order_index;
