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
    ('squat', U&'\30B9\30AF\30EF\30C3\30C8', 'Squat', 'legs'),
    ('bench-press', U&'\30D9\30F3\30C1\30D7\30EC\30B9', 'Bench Press', 'chest'),
    ('overhead-press', U&'\30AA\30FC\30D0\30FC\30D8\30C3\30C9\30D7\30EC\30B9', 'Overhead Press', 'shoulders'),
    ('deadlift', U&'\30C7\30C3\30C9\30EA\30D5\30C8', 'Deadlift', 'back'),
    ('power-clean', U&'\30D1\30EF\30FC\30AF\30EA\30FC\30F3', 'Power Clean', 'back')
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
      U&'\30B9\30AF\30EF\30C3\30C8\3092\6BCE\56DE\884C\3044\3001\30D9\30F3\30C1\30D7\30EC\30B9\3068\30AA\30FC\30D0\30FC\30D8\30C3\30C9\30D7\30EC\30B9\3092\4EA4\4E92\306B\9032\3081\308B\521D\5FC3\8005\5411\3051A/B\30D7\30ED\30B0\30E9\30E0\3002GZCLP Base\3088\308A\3082\7A2E\76EE\69CB\6210\3092\7D5E\308A\3001\30D1\30EF\30FC\30AF\30EA\30FC\30F3\3092\542B\3080\30AF\30E9\30B7\30C3\30AF\306A\7DDA\5F62\9032\6B69\306E\571F\53F0\3068\3057\3066\4F7F\3044\3084\3059\3044\69CB\6210\306B\3057\3066\3044\308B\3002',
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
      U&'\30B9\30AF\30EF\30C3\30C8\3068\30D9\30F3\30C1\30D7\30EC\30B9\306F\5168\30BB\30C3\30C8\5B8C\9042\3067\6B21\56DE +2.5kg\3001\30C7\30C3\30C9\30EA\30D5\30C8\306F +5kg \3092\76EE\5B89\306B\9032\3081\308B\3002',
      U&'Workout A: \30B9\30AF\30EF\30C3\30C8 3x5 / \30D9\30F3\30C1\30D7\30EC\30B9 3x5 / \30C7\30C3\30C9\30EA\30D5\30C8 1x5'
    ),
    (
      w1, 2,
      U&'\30B9\30AF\30EF\30C3\30C8\306F\7D99\7D9A\3057\3066 +2.5kg\3001\30AA\30FC\30D0\30FC\30D8\30C3\30C9\30D7\30EC\30B9\306F +2.5kg\3001\30D1\30EF\30FC\30AF\30EA\30FC\30F3\306F\30D5\30A9\30FC\30E0\512A\5148\3067\5C0F\523B\307F\306B\9032\3081\308B\3002',
      U&'Workout B: \30B9\30AF\30EF\30C3\30C8 3x5 / \30AA\30FC\30D0\30FC\30D8\30C3\30C9\30D7\30EC\30B9 3x5 / \30D1\30EF\30FC\30AF\30EA\30FC\30F3 5x3'
    ),
    (
      w1, 3,
      U&'Week 1 \306E A \3092\518D\5B9F\65BD\3002\30D5\30A9\30FC\30E0\3092\5D29\3055\305A\5B8C\9042\3067\304D\308B\91CD\91CF\3067\7DDA\5F62\9032\6B69\3092\7D9A\3051\308B\3002',
      U&'Workout A: \30B9\30AF\30EF\30C3\30C8 3x5 / \30D9\30F3\30C1\30D7\30EC\30B9 3x5 / \30C7\30C3\30C9\30EA\30D5\30C8 1x5'
    ),
    (
      w2, 1,
      U&'Week 2 \306F B \304B\3089\958B\59CB\3002\524D\9031\306E\5B8C\9042\72B6\6CC1\306B\5FDC\3058\3066\30AA\30FC\30D0\30FC\30D8\30C3\30C9\30D7\30EC\30B9\3068\30D1\30EF\30FC\30AF\30EA\30FC\30F3\3092\5FAE\5897\3059\308B\3002',
      U&'Workout B: \30B9\30AF\30EF\30C3\30C8 3x5 / \30AA\30FC\30D0\30FC\30D8\30C3\30C9\30D7\30EC\30B9 3x5 / \30D1\30EF\30FC\30AF\30EA\30FC\30F3 5x3'
    ),
    (
      w2, 2,
      U&'Workout A \306B\623B\308B\3002\30B9\30AF\30EF\30C3\30C8\306F\6BCE\56DE\5B9F\65BD\3001\4E0A\534A\8EAB\7A2E\76EE\306F A/B \3067\4EA4\4E92\306B\9032\3081\308B\3002',
      U&'Workout A: \30B9\30AF\30EF\30C3\30C8 3x5 / \30D9\30F3\30C1\30D7\30EC\30B9 3x5 / \30C7\30C3\30C9\30EA\30D5\30C8 1x5'
    ),
    (
      w2, 3,
      U&'Week 2 \306E\7DE0\3081\3092 Workout B \3067\884C\3046\3002\30D1\30EF\30FC\30AF\30EA\30FC\30F3\306F\901F\5EA6\304C\843D\3061\305F\3089\636E\3048\7F6E\304D\3092\8A31\5BB9\3059\308B\3002',
      U&'Workout B: \30B9\30AF\30EF\30C3\30C8 3x5 / \30AA\30FC\30D0\30FC\30D8\30C3\30C9\30D7\30EC\30B9 3x5 / \30D1\30EF\30FC\30AF\30EA\30FC\30F3 5x3'
    ),
    (
      w3, 1,
      U&'Week 3 \306F A \304B\3089\518D\958B\3002A/B \4EA4\4E92\306E\30EA\30BA\30E0\3092\4FDD\3063\305F\307E\307E\7DDA\5F62\9032\6B69\3092\7D99\7D9A\3059\308B\3002',
      U&'Workout A: \30B9\30AF\30EF\30C3\30C8 3x5 / \30D9\30F3\30C1\30D7\30EC\30B9 3x5 / \30C7\30C3\30C9\30EA\30D5\30C8 1x5'
    ),
    (
      w3, 2,
      U&'Workout B\3002\75B2\52B4\304C\5F37\3044\5834\5408\3082\30BB\30C3\30C8\6570\306F\7DAD\6301\3057\3001\91CD\91CF\3060\3051\3092\4FDD\5B88\7684\306B\8ABF\6574\3059\308B\3002',
      U&'Workout B: \30B9\30AF\30EF\30C3\30C8 3x5 / \30AA\30FC\30D0\30FC\30D8\30C3\30C9\30D7\30EC\30B9 3x5 / \30D1\30EF\30FC\30AF\30EA\30FC\30F3 5x3'
    ),
    (
      w3, 3,
      U&'3\9031\76EE\306E\7DE0\3081\3092 Workout A \3067\884C\3046\3002\6B21\306E\5B9F\904B\7528\3067\306F\540C\30D1\30BF\30FC\30F3\3092\7D99\7D9A\3059\308B\304B\3001\5225\30D7\30ED\30B0\30E9\30E0\3078\9032\3080\5224\65AD\6750\6599\306B\3059\308B\3002',
      U&'Workout A: \30B9\30AF\30EF\30C3\30C8 3x5 / \30D9\30F3\30C1\30D7\30EC\30B9 3x5 / \30C7\30C3\30C9\30EA\30D5\30C8 1x5'
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
