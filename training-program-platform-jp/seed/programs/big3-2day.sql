-- Seed: BIG3 2-Day (rotation variant)
-- Run in Supabase Dashboard > SQL Editor
--
-- Prerequisites:
--   - gzclp-base-v2.sql already executed
--     (exercises: squat / bench-press / deadlift must exist)
--
-- Rotation design (3-cycle: A -> B -> C repeating):
--   Cycle A: T1 Squat     / T2 Bench    / T3 Deadlift
--   Cycle B: T1 Bench     / T2 Deadlift / T3 Squat
--   Cycle C: T1 Deadlift  / T2 Squat   / T3 Bench
--
-- Session schedule (8 sessions total):
--   W1D1 = A: T1 Squat    / T2 Bench   / T3 Dead
--   W1D2 = B: T1 Bench    / T2 Dead    / T3 Squat
--   W2D1 = C: T1 Dead     / T2 Squat   / T3 Bench
--   W2D2 = A: T1 Squat    / T2 Bench   / T3 Dead
--   W3D1 = B: T1 Bench    / T2 Dead    / T3 Squat
--   W3D2 = C: T1 Dead     / T2 Squat   / T3 Bench
--   W4D1 = A: T1 Squat    / T2 Bench   / T3 Dead
--   W4D2 = B: T1 Bench    / T2 Dead    / T3 Squat
--
-- Tier frequency across 8 sessions:
--   Squat:  T1x3 / T2x2 / T3x3
--   Bench:  T1x3 / T2x3 / T3x2
--   Dead:   T1x2 / T2x3 / T3x3
--   (8 is not divisible by 3 -- this is minimum possible imbalance)
--
-- Per-session layout (3 exercises, order_index 1-3):
--   1: T1 main lift    (5 sets x 3+)
--   2: T2 practice     (3 sets x 10)
--   3: T3 finish       (3 sets x 15+)
--
-- Total rows in program_day_exercises: 3 x 8 = 24
--
-- Safe to re-run: guarded by slug existence check.

do $$
declare
  ex_squat    uuid;
  ex_bench    uuid;
  ex_deadlift uuid;

  prog_id uuid;

  w1 uuid; w2 uuid; w3 uuid; w4 uuid;
  w1d1 uuid; w1d2 uuid;
  w2d1 uuid; w2d2 uuid;
  w3d1 uuid; w3d2 uuid;
  w4d1 uuid; w4d2 uuid;

  tag_strength  uuid;
  tag_barbell   uuid;
  tag_full_body uuid;
begin
  -- ── 1. Resolve exercise UUIDs ─────────────────────────────────────────────
  select id into ex_squat    from public.exercises where slug = 'squat';
  select id into ex_bench    from public.exercises where slug = 'bench-press';
  select id into ex_deadlift from public.exercises where slug = 'deadlift';

  if ex_squat    is null then raise exception 'Exercise not found: squat'; end if;
  if ex_bench    is null then raise exception 'Exercise not found: bench-press'; end if;
  if ex_deadlift is null then raise exception 'Exercise not found: deadlift'; end if;

  -- ── 2. Guard: skip if already seeded ──────────────────────────────────────
  if exists (select 1 from public.programs where slug = 'big3-2day') then
    raise notice 'big3-2day already exists -- skipping.';
    return;
  end if;

  -- ── 3. Program ────────────────────────────────────────────────────────────
  insert into public.programs
    (slug, title, description, duration_weeks, days_per_week, level,
     source_program_name, source_fidelity, source_notes, is_public, methodology)
  values (
    'big3-2day',
    'BIG3 2-Day',
    U&'\30B9\30AF\30EF\30C3\30C8\30FB\30D9\30F3\30C1\30D7\30EC\30B9\30FB\30C7\30C3\30C9\30EA\30D5\30C8\306E3\7A2E\76EE\3067\69CB\6210\3059\308B\9031\FF12\65E5\30D7\30ED\30B0\30E9\30E0\3002A/B/C\306E3\30B5\30A4\30AF\30EB\30ED\30FC\30C6\30FC\30B7\30E7\30F3\3067\5404\7A2E\76EE\304C\6BD4\8F7D\7684\5747\7B49\306B T1/T2/T3 \3092\62C5\5F53\3059\308B\3002',
    4, 2, 'beginner',
    null, 'custom',
    U&'BIG3\306E3\7A2E\76EE\306E\307F\3002\30ED\30FC\30C6\30FC\30B7\30E7\30F3\578B\9031\FF12\65E5\69CB\6210\3002A\28T1\30B9\30AF\30EF\30C3\30C8\29/B\28T1\30D9\30F3\30C1\29/C\28T1\30C7\30C3\30C9\29\306E3\30B5\30A4\30AF\30EB\3067\5404\7A2E\76EE\304C T1\22C5T2\22C5T3 \3092\9806\756A\306B\56DE\3059\3002',
    true,
    'gzcl'
  )
  returning id into prog_id;

  -- ── 4. Weeks ──────────────────────────────────────────────────────────────
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

  -- ── 5. Days ───────────────────────────────────────────────────────────────
  -- Cycle A: T1 Squat / T2 Bench / T3 Dead  (W1D1, W2D2, W4D1)
  -- Cycle B: T1 Bench / T2 Dead  / T3 Squat (W1D2, W3D1, W4D2)
  -- Cycle C: T1 Dead  / T2 Squat / T3 Bench (W2D1, W3D2)
  insert into public.program_days (program_week_id, day_number, progression_guide, notes)
  values
    -- Week 1
    (w1, 1,
     U&'Cycle A \2014 T1 \30B9\30AF\30EF\30C3\30C8 5\00D73+: \6BCE\56DE5kg\5897\3092\76EE\6A19\3002\5931\6557\6642\306F\540C\91CD\91CF\3067\518D\6311\6226\3002T2 \30D9\30F3\30C1\30D7\30EC\30B9 3\00D710: 10\56DE\3053\306A\305B\305F\3089\6B21\56DE2.5kg\5897\3002T3 \30C7\30C3\30C9\30EA\30D5\30C8 3\00D715+: \6700\7D42\30BB\30C3\30C8\306E15\56DE\5230\9054\3067\6B21\56DE\91CD\91CF\5897\3002',
     U&'W1D1 (Cycle A): T1 \30B9\30AF\30EF\30C3\30C8 5\00D73+, T2 \30D9\30F3\30C1\30D7\30EC\30B9 3\00D710, T3 \30C7\30C3\30C9\30EA\30D5\30C8 3\00D715+'),
    (w1, 2,
     U&'Cycle B \2014 T1 \30D9\30F3\30C1\30D7\30EC\30B9 5\00D73+: \6BCE\56DE2.5kg\5897\3092\76EE\6A19\3002T2 \30C7\30C3\30C9\30EA\30D5\30C8 3\00D710: 10\56DE\3053\306A\305B\305F\3089\6B21\56DE5kg\5897\3002T3 \30B9\30AF\30EF\30C3\30C8 3\00D715+: \6700\7D42\30BB\30C3\30C8\306E15\56DE\5230\9054\3067\6B21\56DE\91CD\91CF\5897\3002',
     U&'W1D2 (Cycle B): T1 \30D9\30F3\30C1\30D7\30EC\30B9 5\00D73+, T2 \30C7\30C3\30C9\30EA\30D5\30C8 3\00D710, T3 \30B9\30AF\30EF\30C3\30C8 3\00D715+'),
    -- Week 2
    (w2, 1,
     U&'Cycle C \2014 T1 \30C7\30C3\30C9\30EA\30D5\30C8 5\00D73+: \6BCE\56DE5kg\5897\3092\76EE\6A19\3002T2 \30B9\30AF\30EF\30C3\30C8 3\00D710: 10\56DE\3053\306A\305B\305F\3089\6B21\56DE5kg\5897\3002T3 \30D9\30F3\30C1\30D7\30EC\30B9 3\00D715+: \6700\7D42\30BB\30C3\30C8\306E15\56DE\5230\9054\3067\6B21\56DE\91CD\91CF\5897\3002',
     U&'W2D1 (Cycle C): T1 \30C7\30C3\30C9\30EA\30D5\30C8 5\00D73+, T2 \30B9\30AF\30EF\30C3\30C8 3\00D710, T3 \30D9\30F3\30C1\30D7\30EC\30B9 3\00D715+'),
    (w2, 2,
     U&'Cycle A \2014 T1 \30B9\30AF\30EF\30C3\30C8 5\00D73+\3002T2 \30D9\30F3\30C1\30D7\30EC\30B9 3\00D710\3002T3 \30C7\30C3\30C9\30EA\30D5\30C8 3\00D715+\3002',
     U&'W2D2 (Cycle A): T1 \30B9\30AF\30EF\30C3\30C8 5\00D73+, T2 \30D9\30F3\30C1\30D7\30EC\30B9 3\00D710, T3 \30C7\30C3\30C9\30EA\30D5\30C8 3\00D715+'),
    -- Week 3
    (w3, 1,
     U&'Cycle B \2014 T1 \30D9\30F3\30C1\30D7\30EC\30B9 5\00D73+\3002T2 \30C7\30C3\30C9\30EA\30D5\30C8 3\00D710\3002T3 \30B9\30AF\30EF\30C3\30C8 3\00D715+\3002',
     U&'W3D1 (Cycle B): T1 \30D9\30F3\30C1\30D7\30EC\30B9 5\00D73+, T2 \30C7\30C3\30C9\30EA\30D5\30C8 3\00D710, T3 \30B9\30AF\30EF\30C3\30C8 3\00D715+'),
    (w3, 2,
     U&'Cycle C \2014 T1 \30C7\30C3\30C9\30EA\30D5\30C8 5\00D73+\3002T2 \30B9\30AF\30EF\30C3\30C8 3\00D710\3002T3 \30D9\30F3\30C1\30D7\30EC\30B9 3\00D715+\3002',
     U&'W3D2 (Cycle C): T1 \30C7\30C3\30C9\30EA\30D5\30C8 5\00D73+, T2 \30B9\30AF\30EF\30C3\30C8 3\00D710, T3 \30D9\30F3\30C1\30D7\30EC\30B9 3\00D715+'),
    -- Week 4
    (w4, 1,
     U&'Cycle A \2014 T1 \30B9\30AF\30EF\30C3\30C8 5\00D73+\3002T2 \30D9\30F3\30C1\30D7\30EC\30B9 3\00D710\3002T3 \30C7\30C3\30C9\30EA\30D5\30C8 3\00D715+\3002',
     U&'W4D1 (Cycle A): T1 \30B9\30AF\30EF\30C3\30C8 5\00D73+, T2 \30D9\30F3\30C1\30D7\30EC\30B9 3\00D710, T3 \30C7\30C3\30C9\30EA\30D5\30C8 3\00D715+'),
    (w4, 2,
     U&'Cycle B \2014 T1 \30D9\30F3\30C1\30D7\30EC\30B9 5\00D73+\3002T2 \30C7\30C3\30C9\30EA\30D5\30C8 3\00D710\3002T3 \30B9\30AF\30EF\30C3\30C8 3\00D715+\3002',
     U&'W4D2 (Cycle B): T1 \30D9\30F3\30C1\30D7\30EC\30B9 5\00D73+, T2 \30C7\30C3\30C9\30EA\30D5\30C8 3\00D710, T3 \30B9\30AF\30EF\30C3\30C8 3\00D715+');

  select id into w1d1 from public.program_days where program_week_id = w1 and day_number = 1;
  select id into w1d2 from public.program_days where program_week_id = w1 and day_number = 2;
  select id into w2d1 from public.program_days where program_week_id = w2 and day_number = 1;
  select id into w2d2 from public.program_days where program_week_id = w2 and day_number = 2;
  select id into w3d1 from public.program_days where program_week_id = w3 and day_number = 1;
  select id into w3d2 from public.program_days where program_week_id = w3 and day_number = 2;
  select id into w4d1 from public.program_days where program_week_id = w4 and day_number = 1;
  select id into w4d2 from public.program_days where program_week_id = w4 and day_number = 2;

  -- ── 6. Exercises per day (3 per day x 8 days = 24 rows) ──────────────────
  -- order_index 1: T1 main    (5 sets x 3+)
  -- order_index 2: T2 practice (3 sets x 10)
  -- order_index 3: T3 finish  (3 sets x 15+)
  insert into public.program_day_exercises
    (program_day_id, exercise_id, exercise_type, set_count, target_reps_text, order_index)
  values
    -- W1D1 = Cycle A: T1 Squat / T2 Bench / T3 Dead
    (w1d1, ex_squat,    'T1', 5, '3+',  1),
    (w1d1, ex_bench,    'T2', 3, '10',  2),
    (w1d1, ex_deadlift, 'T3', 3, '15+', 3),

    -- W1D2 = Cycle B: T1 Bench / T2 Dead / T3 Squat
    (w1d2, ex_bench,    'T1', 5, '3+',  1),
    (w1d2, ex_deadlift, 'T2', 3, '10',  2),
    (w1d2, ex_squat,    'T3', 3, '15+', 3),

    -- W2D1 = Cycle C: T1 Dead / T2 Squat / T3 Bench
    (w2d1, ex_deadlift, 'T1', 5, '3+',  1),
    (w2d1, ex_squat,    'T2', 3, '10',  2),
    (w2d1, ex_bench,    'T3', 3, '15+', 3),

    -- W2D2 = Cycle A: T1 Squat / T2 Bench / T3 Dead
    (w2d2, ex_squat,    'T1', 5, '3+',  1),
    (w2d2, ex_bench,    'T2', 3, '10',  2),
    (w2d2, ex_deadlift, 'T3', 3, '15+', 3),

    -- W3D1 = Cycle B: T1 Bench / T2 Dead / T3 Squat
    (w3d1, ex_bench,    'T1', 5, '3+',  1),
    (w3d1, ex_deadlift, 'T2', 3, '10',  2),
    (w3d1, ex_squat,    'T3', 3, '15+', 3),

    -- W3D2 = Cycle C: T1 Dead / T2 Squat / T3 Bench
    (w3d2, ex_deadlift, 'T1', 5, '3+',  1),
    (w3d2, ex_squat,    'T2', 3, '10',  2),
    (w3d2, ex_bench,    'T3', 3, '15+', 3),

    -- W4D1 = Cycle A: T1 Squat / T2 Bench / T3 Dead
    (w4d1, ex_squat,    'T1', 5, '3+',  1),
    (w4d1, ex_bench,    'T2', 3, '10',  2),
    (w4d1, ex_deadlift, 'T3', 3, '15+', 3),

    -- W4D2 = Cycle B: T1 Bench / T2 Dead / T3 Squat
    (w4d2, ex_bench,    'T1', 5, '3+',  1),
    (w4d2, ex_deadlift, 'T2', 3, '10',  2),
    (w4d2, ex_squat,    'T3', 3, '15+', 3);

  -- ── 7. Tag assignments (soft -- skipped if tags not yet seeded) ───────────
  select id into tag_strength   from public.program_tags where slug = 'strength';
  select id into tag_barbell    from public.program_tags where slug = 'barbell';
  select id into tag_full_body  from public.program_tags where slug = 'full-body';

  if tag_strength is not null and tag_barbell is not null and tag_full_body is not null then
    insert into public.program_tag_assignments (program_id, tag_id, axis)
    values
      (prog_id, tag_strength,  'goal'),
      (prog_id, tag_barbell,   'equipment'),
      (prog_id, tag_full_body, 'split')
    on conflict do nothing;
  else
    raise notice 'program_tags not found -- tag assignments skipped.';
  end if;

  raise notice 'Seed complete: big3-2day program_id = %', prog_id;
end;
$$;

-- Verification query: expected 24 rows with A/B/C rotation visible
-- select
--   pw.week_number,
--   pd.day_number,
--   pde.order_index,
--   pde.exercise_type,
--   e.name_en,
--   pde.set_count,
--   pde.target_reps_text
-- from public.program_day_exercises pde
-- join public.program_days pd    on pd.id = pde.program_day_id
-- join public.program_weeks pw   on pw.id = pd.program_week_id
-- join public.programs p         on p.id  = pw.program_id
-- join public.exercises e        on e.id  = pde.exercise_id
-- where p.slug = 'big3-2day'
-- order by pw.week_number, pd.day_number, pde.order_index;
