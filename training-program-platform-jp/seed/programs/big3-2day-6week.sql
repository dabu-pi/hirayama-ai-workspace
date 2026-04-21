-- Seed: BIG3 2-Day 6-Week (Full Rotation)
-- Run in Supabase Dashboard > SQL Editor
--
-- Prerequisites:
--   - gzclp-base-v2.sql already executed
--     (exercises: squat / bench-press / deadlift must exist)
--
-- Design: all 6 permutations of 3 exercises into T1/T2/T3, used twice.
--
--   Pattern A: T1 Squat  / T2 Bench  / T3 Dead
--   Pattern B: T1 Bench  / T2 Dead   / T3 Squat
--   Pattern C: T1 Dead   / T2 Squat  / T3 Bench
--   Pattern D: T1 Squat  / T2 Dead   / T3 Bench
--   Pattern E: T1 Bench  / T2 Squat  / T3 Dead
--   Pattern F: T1 Dead   / T2 Bench  / T3 Squat
--
-- Session schedule (12 sessions):
--   W1D1=A  W1D2=B
--   W2D1=C  W2D2=D
--   W3D1=E  W3D2=F
--   W4D1=A  W4D2=B  (repeat)
--   W5D1=C  W5D2=D  (repeat)
--   W6D1=E  W6D2=F  (repeat)
--
-- Tier frequency per exercise (perfect balance):
--   Squat:  T1x4 (A,D x2) / T2x4 (C,E x2) / T3x4 (B,F x2)
--   Bench:  T1x4 (B,E x2) / T2x4 (A,F x2) / T3x4 (C,D x2)
--   Dead:   T1x4 (C,F x2) / T2x4 (B,D x2) / T3x4 (A,E x2)
--
-- Within-week T1 variety: each week has 2 different T1 exercises.
-- Consecutive sessions always have different T1 exercises.
--
-- Per-session layout (3 exercises, order_index 1-3):
--   1: T1 main lift   (5 sets x 3+)
--   2: T2 practice    (3 sets x 10)
--   3: T3 finish      (3 sets x 15+)
--
-- Total rows in program_day_exercises: 3 x 12 = 36
--
-- Safe to re-run: guarded by slug existence check.

do $$
declare
  ex_squat    uuid;
  ex_bench    uuid;
  ex_deadlift uuid;

  prog_id uuid;

  w1 uuid; w2 uuid; w3 uuid; w4 uuid; w5 uuid; w6 uuid;
  w1d1 uuid; w1d2 uuid;
  w2d1 uuid; w2d2 uuid;
  w3d1 uuid; w3d2 uuid;
  w4d1 uuid; w4d2 uuid;
  w5d1 uuid; w5d2 uuid;
  w6d1 uuid; w6d2 uuid;

  tag_strength  uuid;
  tag_barbell   uuid;
  tag_full_body uuid;

  -- Shared progression guide fragments (reused per pattern)
  guide_a text;
  guide_b text;
  guide_c text;
  guide_d text;
  guide_e text;
  guide_f text;
  notes_a text;
  notes_b text;
  notes_c text;
  notes_d text;
  notes_e text;
  notes_f text;
begin
  -- 1. Resolve exercise UUIDs
  select id into ex_squat    from public.exercises where slug = 'squat';
  select id into ex_bench    from public.exercises where slug = 'bench-press';
  select id into ex_deadlift from public.exercises where slug = 'deadlift';

  if ex_squat    is null then raise exception 'Exercise not found: squat'; end if;
  if ex_bench    is null then raise exception 'Exercise not found: bench-press'; end if;
  if ex_deadlift is null then raise exception 'Exercise not found: deadlift'; end if;

  -- 2. Guard: skip if already seeded
  if exists (select 1 from public.programs where slug = 'big3-2day-6week') then
    raise notice 'big3-2day-6week already exists -- skipping.';
    return;
  end if;

  -- 3. Progression guide text per pattern (plain UTF-8)
  guide_a := 'Cycle A: T1 スクワット 5x3+: 毎回5kg増を目標。T2 ベンチプレス 3x10: 10回で次回2.5kg増。T3 デッドリフト 3x15+: 15回到達で次回重量増。';
  notes_a := 'Cycle A: T1 スクワット 5x3+, T2 ベンチプレス 3x10, T3 デッドリフト 3x15+';

  guide_b := 'Cycle B: T1 ベンチプレス 5x3+: 毎回2.5kg増を目標。T2 デッドリフト 3x10: 10回で次回5kg増。T3 スクワット 3x15+: 15回到達で次回重量増。';
  notes_b := 'Cycle B: T1 ベンチプレス 5x3+, T2 デッドリフト 3x10, T3 スクワット 3x15+';

  guide_c := 'Cycle C: T1 デッドリフト 5x3+: 毎回5kg増を目標。T2 スクワット 3x10: 10回で次回5kg増。T3 ベンチプレス 3x15+: 15回到達で次回重量増。';
  notes_c := 'Cycle C: T1 デッドリフト 5x3+, T2 スクワット 3x10, T3 ベンチプレス 3x15+';

  guide_d := 'Cycle D: T1 スクワット 5x3+: 毎回5kg増を目標。T2 デッドリフト 3x10: 10回で次回5kg増。T3 ベンチプレス 3x15+: 15回到達で次回重量増。';
  notes_d := 'Cycle D: T1 スクワット 5x3+, T2 デッドリフト 3x10, T3 ベンチプレス 3x15+';

  guide_e := 'Cycle E: T1 ベンチプレス 5x3+: 毎回2.5kg増を目標。T2 スクワット 3x10: 10回で次回5kg増。T3 デッドリフト 3x15+: 15回到達で次回重量増。';
  notes_e := 'Cycle E: T1 ベンチプレス 5x3+, T2 スクワット 3x10, T3 デッドリフト 3x15+';

  guide_f := 'Cycle F: T1 デッドリフト 5x3+: 毎回5kg増を目標。T2 ベンチプレス 3x10: 10回で次回2.5kg増。T3 スクワット 3x15+: 15回到達で次回重量増。';
  notes_f := 'Cycle F: T1 デッドリフト 5x3+, T2 ベンチプレス 3x10, T3 スクワット 3x15+';

  -- 4. Program
  insert into public.programs
    (slug, title, description, duration_weeks, days_per_week, level,
     source_program_name, source_fidelity, source_notes, is_public, methodology)
  values (
    'big3-2day-6week',
    'BIG3 2-Day 6週',
    'BIG3の3種目の全6パターン（A〜F）を2周する週2日・6週プログラム。各種目がT1/T2/T3を完全均等に担当する（各種目 T1x4 / T2x4 / T3x4）。',
    6, 2, 'beginner',
    null, 'custom',
    'BIG3の3種目の全6通りのT1/T2/T3割り当て（A〜F）を完全ローテーション。各種目 T1x4 / T2x4 / T3x4 で完全対称。1セッション内に同一種目の重複なし。',
    true,
    'gzcl'
  )
  returning id into prog_id;

  -- 5. Weeks (6 weeks)
  insert into public.program_weeks (program_id, week_number, label)
  values
    (prog_id, 1, 'Week 1'),
    (prog_id, 2, 'Week 2'),
    (prog_id, 3, 'Week 3'),
    (prog_id, 4, 'Week 4'),
    (prog_id, 5, 'Week 5'),
    (prog_id, 6, 'Week 6');

  select id into w1 from public.program_weeks where program_id = prog_id and week_number = 1;
  select id into w2 from public.program_weeks where program_id = prog_id and week_number = 2;
  select id into w3 from public.program_weeks where program_id = prog_id and week_number = 3;
  select id into w4 from public.program_weeks where program_id = prog_id and week_number = 4;
  select id into w5 from public.program_weeks where program_id = prog_id and week_number = 5;
  select id into w6 from public.program_weeks where program_id = prog_id and week_number = 6;

  -- 6. Days (12 days)
  -- Weeks 1-3: patterns A,B / C,D / E,F
  -- Weeks 4-6: repeat A,B / C,D / E,F
  insert into public.program_days (program_week_id, day_number, progression_guide, notes)
  values
    (w1, 1, guide_a, notes_a),   -- W1D1 = Cycle A
    (w1, 2, guide_b, notes_b),   -- W1D2 = Cycle B
    (w2, 1, guide_c, notes_c),   -- W2D1 = Cycle C
    (w2, 2, guide_d, notes_d),   -- W2D2 = Cycle D
    (w3, 1, guide_e, notes_e),   -- W3D1 = Cycle E
    (w3, 2, guide_f, notes_f),   -- W3D2 = Cycle F
    (w4, 1, guide_a, notes_a),   -- W4D1 = Cycle A (repeat)
    (w4, 2, guide_b, notes_b),   -- W4D2 = Cycle B (repeat)
    (w5, 1, guide_c, notes_c),   -- W5D1 = Cycle C (repeat)
    (w5, 2, guide_d, notes_d),   -- W5D2 = Cycle D (repeat)
    (w6, 1, guide_e, notes_e),   -- W6D1 = Cycle E (repeat)
    (w6, 2, guide_f, notes_f);   -- W6D2 = Cycle F (repeat)

  select id into w1d1 from public.program_days where program_week_id = w1 and day_number = 1;
  select id into w1d2 from public.program_days where program_week_id = w1 and day_number = 2;
  select id into w2d1 from public.program_days where program_week_id = w2 and day_number = 1;
  select id into w2d2 from public.program_days where program_week_id = w2 and day_number = 2;
  select id into w3d1 from public.program_days where program_week_id = w3 and day_number = 1;
  select id into w3d2 from public.program_days where program_week_id = w3 and day_number = 2;
  select id into w4d1 from public.program_days where program_week_id = w4 and day_number = 1;
  select id into w4d2 from public.program_days where program_week_id = w4 and day_number = 2;
  select id into w5d1 from public.program_days where program_week_id = w5 and day_number = 1;
  select id into w5d2 from public.program_days where program_week_id = w5 and day_number = 2;
  select id into w6d1 from public.program_days where program_week_id = w6 and day_number = 1;
  select id into w6d2 from public.program_days where program_week_id = w6 and day_number = 2;

  -- 7. Exercises per day (3 per day x 12 days = 36 rows)
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

    -- W2D2 = Cycle D: T1 Squat / T2 Dead / T3 Bench
    (w2d2, ex_squat,    'T1', 5, '3+',  1),
    (w2d2, ex_deadlift, 'T2', 3, '10',  2),
    (w2d2, ex_bench,    'T3', 3, '15+', 3),

    -- W3D1 = Cycle E: T1 Bench / T2 Squat / T3 Dead
    (w3d1, ex_bench,    'T1', 5, '3+',  1),
    (w3d1, ex_squat,    'T2', 3, '10',  2),
    (w3d1, ex_deadlift, 'T3', 3, '15+', 3),

    -- W3D2 = Cycle F: T1 Dead / T2 Bench / T3 Squat
    (w3d2, ex_deadlift, 'T1', 5, '3+',  1),
    (w3d2, ex_bench,    'T2', 3, '10',  2),
    (w3d2, ex_squat,    'T3', 3, '15+', 3),

    -- W4D1 = Cycle A (repeat): T1 Squat / T2 Bench / T3 Dead
    (w4d1, ex_squat,    'T1', 5, '3+',  1),
    (w4d1, ex_bench,    'T2', 3, '10',  2),
    (w4d1, ex_deadlift, 'T3', 3, '15+', 3),

    -- W4D2 = Cycle B (repeat): T1 Bench / T2 Dead / T3 Squat
    (w4d2, ex_bench,    'T1', 5, '3+',  1),
    (w4d2, ex_deadlift, 'T2', 3, '10',  2),
    (w4d2, ex_squat,    'T3', 3, '15+', 3),

    -- W5D1 = Cycle C (repeat): T1 Dead / T2 Squat / T3 Bench
    (w5d1, ex_deadlift, 'T1', 5, '3+',  1),
    (w5d1, ex_squat,    'T2', 3, '10',  2),
    (w5d1, ex_bench,    'T3', 3, '15+', 3),

    -- W5D2 = Cycle D (repeat): T1 Squat / T2 Dead / T3 Bench
    (w5d2, ex_squat,    'T1', 5, '3+',  1),
    (w5d2, ex_deadlift, 'T2', 3, '10',  2),
    (w5d2, ex_bench,    'T3', 3, '15+', 3),

    -- W6D1 = Cycle E (repeat): T1 Bench / T2 Squat / T3 Dead
    (w6d1, ex_bench,    'T1', 5, '3+',  1),
    (w6d1, ex_squat,    'T2', 3, '10',  2),
    (w6d1, ex_deadlift, 'T3', 3, '15+', 3),

    -- W6D2 = Cycle F (repeat): T1 Dead / T2 Bench / T3 Squat
    (w6d2, ex_deadlift, 'T1', 5, '3+',  1),
    (w6d2, ex_bench,    'T2', 3, '10',  2),
    (w6d2, ex_squat,    'T3', 3, '15+', 3);

  -- 8. Tag assignments (soft -- skipped if tags not yet seeded)
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

  raise notice 'Seed complete: big3-2day-6week program_id = %', prog_id;
end;
$$;

-- Verification query: expected 36 rows
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
-- where p.slug = 'big3-2day-6week'
-- order by pw.week_number, pd.day_number, pde.order_index;

-- Tier balance verification (expect T1x4 / T2x4 / T3x4 per exercise):
-- select
--   e.name_en,
--   pde.exercise_type,
--   count(*) as appearances
-- from public.program_day_exercises pde
-- join public.program_days pd    on pd.id = pde.program_day_id
-- join public.program_weeks pw   on pw.id = pd.program_week_id
-- join public.programs p         on p.id  = pw.program_id
-- join public.exercises e        on e.id  = pde.exercise_id
-- where p.slug = 'big3-2day-6week'
-- group by e.name_en, pde.exercise_type
-- order by e.name_en, pde.exercise_type;
