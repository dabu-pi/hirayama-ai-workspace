-- Seed: BIG3 2-Day 6-Week (Cyclic Rotation)
-- Run in Supabase Dashboard > SQL Editor
--
-- Prerequisites:
--   - exercises: squat / bench-press / deadlift must exist
--
-- Design: 3-pattern cyclic rotation (A, B, C) using all valid week pairings.
--
--   Pattern A: T1 Squat  / T2 Bench  / T3 Dead
--   Pattern B: T1 Bench  / T2 Dead   / T3 Squat
--   Pattern C: T1 Dead   / T2 Squat  / T3 Bench
--
-- Week schedule:
--   W1: A + B      W2: C + A      W3: B + C
--   W4: A + B      W5: C + A      W6: B + C   (repeat)
--
-- Within-week tier check (no same-tier for same exercise in same week):
--   W1(A+B): Squat T1/T3  Bench T2/T1  Dead T3/T2  (all different)
--   W2(C+A): Squat T2/T1  Bench T3/T2  Dead T1/T3  (all different)
--   W3(B+C): Squat T3/T2  Bench T1/T3  Dead T2/T1  (all different)
--
-- T1 sequence across sessions: Sq, Bn, Dl, Sq, Bn, Dl (cyclic)
--
-- Tier frequency per exercise (12 sessions total):
--   Squat: T1x4 (A) / T2x4 (C) / T3x4 (B)
--   Bench: T1x4 (B) / T2x4 (A) / T3x4 (C)
--   Dead:  T1x4 (C) / T2x4 (B) / T3x4 (A)
--
-- Per-session layout (3 exercises, order_index 1-3):
--   1: T1 main lift    (5 sets x 3+)
--   2: T2 practice     (3 sets x 10)
--   3: T3 finish       (3 sets x 15+)
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

  guide_a text;
  guide_b text;
  guide_c text;
  notes_a text;
  notes_b text;
  notes_c text;
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

  -- 3. Progression guide text (3 patterns, plain UTF-8)
  guide_a := 'Pattern A: T1 スクワット 5x3+: 毎回5kg増を目標。T2 ベンチプレス 3x10: 10回で次回2.5kg増。T3 デッドリフト 3x15+: 15回到達で次回重量増。';
  notes_a := 'Pattern A: T1 スクワット 5x3+, T2 ベンチプレス 3x10, T3 デッドリフト 3x15+';

  guide_b := 'Pattern B: T1 ベンチプレス 5x3+: 毎回2.5kg増を目標。T2 デッドリフト 3x10: 10回で次回5kg増。T3 スクワット 3x15+: 15回到達で次回重量増。';
  notes_b := 'Pattern B: T1 ベンチプレス 5x3+, T2 デッドリフト 3x10, T3 スクワット 3x15+';

  guide_c := 'Pattern C: T1 デッドリフト 5x3+: 毎回5kg増を目標。T2 スクワット 3x10: 10回で次回5kg増。T3 ベンチプレス 3x15+: 15回到達で次回重量増。';
  notes_c := 'Pattern C: T1 デッドリフト 5x3+, T2 スクワット 3x10, T3 ベンチプレス 3x15+';

  -- 4. Program
  insert into public.programs
    (slug, title, description, duration_weeks, days_per_week, level,
     source_program_name, source_fidelity, source_notes, is_public, methodology)
  values (
    'big3-2day-6week',
    'BIG3 2-Day 6週',
    'BIG3の3種目をA/B/Cの3パターンで週2日・6週間ローテーション。各種目がT1/T2/T3を完全均等に担当し（各 T1x4 / T2x4 / T3x4）、同一週内でTierが重複しない設計。',
    6, 2, 'beginner',
    null, 'custom',
    '3パターン（A: T1スクワット, B: T1ベンチ, C: T1デッドリフト）の全ペア組合せをローテーション。週ペア: W1/W4=A+B, W2/W5=C+A, W3/W6=B+C。各種目 T1x4/T2x4/T3x4の完全対称。同一週内でTier重複なし。',
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
  -- W1: A+B  W2: C+A  W3: B+C
  -- W4: A+B  W5: C+A  W6: B+C  (repeat)
  insert into public.program_days (program_week_id, day_number, progression_guide, notes)
  values
    (w1, 1, guide_a, notes_a),   -- W1D1 = Pattern A
    (w1, 2, guide_b, notes_b),   -- W1D2 = Pattern B
    (w2, 1, guide_c, notes_c),   -- W2D1 = Pattern C
    (w2, 2, guide_a, notes_a),   -- W2D2 = Pattern A
    (w3, 1, guide_b, notes_b),   -- W3D1 = Pattern B
    (w3, 2, guide_c, notes_c),   -- W3D2 = Pattern C
    (w4, 1, guide_a, notes_a),   -- W4D1 = Pattern A (repeat)
    (w4, 2, guide_b, notes_b),   -- W4D2 = Pattern B (repeat)
    (w5, 1, guide_c, notes_c),   -- W5D1 = Pattern C (repeat)
    (w5, 2, guide_a, notes_a),   -- W5D2 = Pattern A (repeat)
    (w6, 1, guide_b, notes_b),   -- W6D1 = Pattern B (repeat)
    (w6, 2, guide_c, notes_c);   -- W6D2 = Pattern C (repeat)

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
  -- order_index 1: T1 main lift  (5 sets x 3+)
  -- order_index 2: T2 practice   (3 sets x 10)
  -- order_index 3: T3 finish     (3 sets x 15+)
  insert into public.program_day_exercises
    (program_day_id, exercise_id, exercise_type, set_count, target_reps_text, order_index)
  values
    -- W1D1 = Pattern A: T1 Squat / T2 Bench / T3 Dead
    (w1d1, ex_squat,    'T1', 5, '3+',  1),
    (w1d1, ex_bench,    'T2', 3, '10',  2),
    (w1d1, ex_deadlift, 'T3', 3, '15+', 3),

    -- W1D2 = Pattern B: T1 Bench / T2 Dead / T3 Squat
    (w1d2, ex_bench,    'T1', 5, '3+',  1),
    (w1d2, ex_deadlift, 'T2', 3, '10',  2),
    (w1d2, ex_squat,    'T3', 3, '15+', 3),

    -- W2D1 = Pattern C: T1 Dead / T2 Squat / T3 Bench
    (w2d1, ex_deadlift, 'T1', 5, '3+',  1),
    (w2d1, ex_squat,    'T2', 3, '10',  2),
    (w2d1, ex_bench,    'T3', 3, '15+', 3),

    -- W2D2 = Pattern A: T1 Squat / T2 Bench / T3 Dead
    (w2d2, ex_squat,    'T1', 5, '3+',  1),
    (w2d2, ex_bench,    'T2', 3, '10',  2),
    (w2d2, ex_deadlift, 'T3', 3, '15+', 3),

    -- W3D1 = Pattern B: T1 Bench / T2 Dead / T3 Squat
    (w3d1, ex_bench,    'T1', 5, '3+',  1),
    (w3d1, ex_deadlift, 'T2', 3, '10',  2),
    (w3d1, ex_squat,    'T3', 3, '15+', 3),

    -- W3D2 = Pattern C: T1 Dead / T2 Squat / T3 Bench
    (w3d2, ex_deadlift, 'T1', 5, '3+',  1),
    (w3d2, ex_squat,    'T2', 3, '10',  2),
    (w3d2, ex_bench,    'T3', 3, '15+', 3),

    -- W4D1 = Pattern A (repeat): T1 Squat / T2 Bench / T3 Dead
    (w4d1, ex_squat,    'T1', 5, '3+',  1),
    (w4d1, ex_bench,    'T2', 3, '10',  2),
    (w4d1, ex_deadlift, 'T3', 3, '15+', 3),

    -- W4D2 = Pattern B (repeat): T1 Bench / T2 Dead / T3 Squat
    (w4d2, ex_bench,    'T1', 5, '3+',  1),
    (w4d2, ex_deadlift, 'T2', 3, '10',  2),
    (w4d2, ex_squat,    'T3', 3, '15+', 3),

    -- W5D1 = Pattern C (repeat): T1 Dead / T2 Squat / T3 Bench
    (w5d1, ex_deadlift, 'T1', 5, '3+',  1),
    (w5d1, ex_squat,    'T2', 3, '10',  2),
    (w5d1, ex_bench,    'T3', 3, '15+', 3),

    -- W5D2 = Pattern A (repeat): T1 Squat / T2 Bench / T3 Dead
    (w5d2, ex_squat,    'T1', 5, '3+',  1),
    (w5d2, ex_bench,    'T2', 3, '10',  2),
    (w5d2, ex_deadlift, 'T3', 3, '15+', 3),

    -- W6D1 = Pattern B (repeat): T1 Bench / T2 Dead / T3 Squat
    (w6d1, ex_bench,    'T1', 5, '3+',  1),
    (w6d1, ex_deadlift, 'T2', 3, '10',  2),
    (w6d1, ex_squat,    'T3', 3, '15+', 3),

    -- W6D2 = Pattern C (repeat): T1 Dead / T2 Squat / T3 Bench
    (w6d2, ex_deadlift, 'T1', 5, '3+',  1),
    (w6d2, ex_squat,    'T2', 3, '10',  2),
    (w6d2, ex_bench,    'T3', 3, '15+', 3);

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
