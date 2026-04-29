-- Seed: GZCLP 5-Exercise Base — 4 Day / Week variant
-- Run in Supabase Dashboard > SQL Editor
--
-- Source reference:
--   Cody Lefever, "The GZCL Method" (GZCLP section, February 2016)
--   4-day variant: full A1/B1/A2/B2 cycle completed every single week.
--
-- DESIGN DECISION:
--   New slug (gzclp-base-v2-4day) rather than modifying gzclp-base-v2.
--   gzclp-base-v2 (3-day) is preserved intact for existing enrollments.
--
-- Structure:
--   Every week: A1 / B1 / A2 / B2  (4 days per week × 4 weeks = 16 sessions)
--
-- Per-session layout (5 exercises, order_index 1–5):
--   1: T1 main lift           (5×3+)
--   2: T2 practice lift       (3×10)
--   3: T3 pull — fixed        (3×15+)
--   4: T3 T1-support (swap)   (3×15+)
--   5: T3 T2-support (swap)   (3×15+)
--
-- Workout A1: Squat        / Bench Press / Lat Pulldown / Leg Press     / Chest Press
-- Workout B1: OHP          / Deadlift    / Seated Row   / Lateral Raise / Hip Thrust
-- Workout A2: Bench Press  / Squat       / Lat Pulldown / Dumbbell Press/ Hack Squat
-- Workout B2: Deadlift     / OHP         / Barbell Row  / Good Morning  / Rear Delt Fly
--
-- Pull system: 縦引き=Lat Pulldown(A日), 横引き=Seated Row(B1)/Barbell Row(B2)
--
-- T3 swap groups (4-day specific — 3 candidates each):
--   gzcl4-squat-t3    → Leg Press / Bulgarian Split Squat / Hack Squat
--   gzcl4-bench-t3    → Chest Press / Dumbbell Press / Dips
--   gzcl4-ohp-t3      → Lateral Raise / Rear Delt Fly / Arnold Press
--   gzcl4-deadlift-t3 → Hip Thrust / Good Morning / Leg Curl
--
-- Run AFTER: gzclp-base-v2.sql (exercises must exist)
-- Then run:  gzclp-base-v2-4day-swap-groups.sql

do $$
declare
  -- Exercises (must already exist from gzclp-base-v2.sql)
  ex_squat          uuid;
  ex_bench          uuid;
  ex_press          uuid;
  ex_deadlift       uuid;
  ex_lat_pulldown   uuid;
  ex_seated_row     uuid;
  ex_barbell_row    uuid;
  ex_leg_press      uuid;
  ex_chest_press    uuid;
  ex_lateral_raise  uuid;
  ex_hip_thrust     uuid;
  ex_dumbbell_press uuid;
  ex_hack_squat     uuid;
  ex_good_morning   uuid;
  ex_rear_delt_fly  uuid;

  prog_id uuid;

  w1 uuid; w2 uuid; w3 uuid; w4 uuid;
  w1d1 uuid; w1d2 uuid; w1d3 uuid; w1d4 uuid;
  w2d1 uuid; w2d2 uuid; w2d3 uuid; w2d4 uuid;
  w3d1 uuid; w3d2 uuid; w3d3 uuid; w3d4 uuid;
  w4d1 uuid; w4d2 uuid; w4d3 uuid; w4d4 uuid;

  tag_strength  uuid;
  tag_barbell   uuid;
  tag_full_body uuid;
begin
  -- ----------------------------------------------------------------
  -- Upsert new exercises not in gzclp-base-v2
  -- (dumbbell-press = flat DB bench; arnold-press added in swap-groups file)
  -- ----------------------------------------------------------------
  insert into public.exercises (slug, name_ja, name_en, category)
  values
    ('dumbbell-press', U&'\30C0\30F3\30D9\30EB\30D7\30EC\30B9', 'Dumbbell Press', 'chest'),
    ('seated-row',     U&'\30B7\30FC\30C6\30C3\30C9\30ED\30A6',   'Seated Row',     'back'),
    ('barbell-row',    U&'\30D0\30FC\30D9\30EB\30ED\30A6',         'Barbell Row',    'back')
  on conflict (slug) do nothing;

  -- ----------------------------------------------------------------
  -- Resolve exercise UUIDs
  -- ----------------------------------------------------------------
  select id into ex_squat         from public.exercises where slug = 'squat';
  select id into ex_bench         from public.exercises where slug = 'bench-press';
  select id into ex_press         from public.exercises where slug = 'overhead-press';
  select id into ex_deadlift      from public.exercises where slug = 'deadlift';
  select id into ex_lat_pulldown  from public.exercises where slug = 'lat-pulldown';
  select id into ex_seated_row    from public.exercises where slug = 'seated-row';
  select id into ex_barbell_row   from public.exercises where slug = 'barbell-row';
  select id into ex_leg_press     from public.exercises where slug = 'leg-press';
  select id into ex_chest_press   from public.exercises where slug = 'chest-press';
  select id into ex_lateral_raise from public.exercises where slug = 'lateral-raise';
  select id into ex_hip_thrust    from public.exercises where slug = 'hip-thrust';
  select id into ex_dumbbell_press from public.exercises where slug = 'dumbbell-press';
  select id into ex_hack_squat    from public.exercises where slug = 'hack-squat';
  select id into ex_good_morning  from public.exercises where slug = 'good-morning';
  select id into ex_rear_delt_fly from public.exercises where slug = 'rear-delt-fly';

  if ex_squat         is null then raise exception 'Exercise not found: squat'; end if;
  if ex_bench         is null then raise exception 'Exercise not found: bench-press'; end if;
  if ex_press         is null then raise exception 'Exercise not found: overhead-press'; end if;
  if ex_deadlift      is null then raise exception 'Exercise not found: deadlift'; end if;
  if ex_lat_pulldown  is null then raise exception 'Exercise not found: lat-pulldown'; end if;
  if ex_seated_row    is null then raise exception 'Exercise not found: seated-row'; end if;
  if ex_barbell_row   is null then raise exception 'Exercise not found: barbell-row'; end if;
  if ex_leg_press     is null then raise exception 'Exercise not found: leg-press'; end if;
  if ex_chest_press   is null then raise exception 'Exercise not found: chest-press'; end if;
  if ex_lateral_raise is null then raise exception 'Exercise not found: lateral-raise'; end if;
  if ex_hip_thrust    is null then raise exception 'Exercise not found: hip-thrust'; end if;
  if ex_dumbbell_press is null then raise exception 'Exercise not found: dumbbell-press'; end if;
  if ex_hack_squat    is null then raise exception 'Exercise not found: hack-squat'; end if;
  if ex_good_morning  is null then raise exception 'Exercise not found: good-morning'; end if;
  if ex_rear_delt_fly is null then raise exception 'Exercise not found: rear-delt-fly'; end if;

  -- ----------------------------------------------------------------
  -- Guard: skip if already seeded
  -- ----------------------------------------------------------------
  if exists (select 1 from public.programs where slug = 'gzclp-base-v2-4day') then
    raise notice 'gzclp-base-v2-4day already exists — skipping program insert.';
    return;
  end if;

  -- ----------------------------------------------------------------
  -- Program
  -- ----------------------------------------------------------------
  insert into public.programs
    (slug, title, description, duration_weeks, days_per_week, level,
     source_program_name, source_fidelity, source_notes, is_public)
  values (
    'gzclp-base-v2-4day',
    'GZCLP 基礎 4日/週（4週）',
    '週4回で全身をしっかり鍛えるGZCLPプログラムです。T1のメイン種目で重さを伸ばし、T2の補助種目でフォームと基礎筋力を高め、T3のアクセサリー種目で弱点補強や筋肉量アップを狙います。無理に重量を上げるのではなく、決められた回数を丁寧にこなしながら、少しずつ成長していく内容です。',
    4, 4, 'beginner',
    'GZCLP', 'adapted',
    'gzclp-base-v2 をベースに週4日版へ拡張。T3候補は動作パターン別（スクワット系/ベンチ系/OHP系/デッドリフト系）に各3種から選択可能。',
    true
  )
  returning id into prog_id;

  -- ----------------------------------------------------------------
  -- Weeks (4 weeks, all identical A1/B1/A2/B2 structure)
  -- ----------------------------------------------------------------
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

  -- ----------------------------------------------------------------
  -- Days (each week: Day1=A1, Day2=B1, Day3=A2, Day4=B2)
  -- ----------------------------------------------------------------
  insert into public.program_days (program_week_id, day_number, progression_guide, notes)
  values
    -- Week 1
    (w1, 1,
     'スクワット中心の日 — T1 スクワットは 5×3+ → 6×2+ → 10×1+ の順に進みます。規定回数をこなせなくなったら5RMを再テストし、85%の重量から再スタートします。T2 ベンチプレスは 3×10 → 3×8 → 3×6 の順で進みます。T3は最終セットが25回できたら次回から重量を増やします。',
     'T1 スクワット 5×3+、T2 ベンチプレス 3×10、T3 ラットプルダウン / レッグプレス / チェストプレス 3×15+'),
    (w1, 2,
     'プレス中心の日 — T1 オーバーヘッドプレスは 5×3+ → 6×2+ → 10×1+ の順に進みます。規定回数をこなせなくなったら5RMを再テストし、85%の重量から再スタートします。T2 デッドリフトは 3×10 → 3×8 → 3×6 の順で進みます。T3は最終セットが25回できたら次回から重量を増やします。',
     'T1 オーバーヘッドプレス 5×3+、T2 デッドリフト 3×10、T3 シーテッドロー / サイドレイズ / ヒップスラスト 3×15+'),
    (w1, 3,
     'ベンチプレス中心の日 — T1 ベンチプレスは 5×3+ → 6×2+ → 10×1+ の順に進みます。規定回数をこなせなくなったら5RMを再テストし、85%の重量から再スタートします。T2 スクワットは 3×10 → 3×8 → 3×6 の順で進みます。T3は最終セットが25回できたら次回から重量を増やします。',
     'T1 ベンチプレス 5×3+、T2 スクワット 3×10、T3 ラットプルダウン / ダンベルプレス / ハックスクワット 3×15+'),
    (w1, 4,
     'デッドリフト中心の日 — T1 デッドリフトは 5×3+ → 6×2+ → 10×1+ の順に進みます。規定回数をこなせなくなったら5RMを再テストし、85%の重量から再スタートします。T2 オーバーヘッドプレスは 3×10 → 3×8 → 3×6 の順で進みます。T3は最終セットが25回できたら次回から重量を増やします。',
     'T1 デッドリフト 5×3+、T2 オーバーヘッドプレス 3×10、T3 バーベルロー / グッドモーニング / リアデルトフライ 3×15+'),
    -- Week 2 (same rotation)
    (w2, 1,
     'スクワット中心の日 — T1 スクワットは 5×3+ → 6×2+ → 10×1+ の順に進みます。規定回数をこなせなくなったら5RMを再テストし、85%の重量から再スタートします。T2 ベンチプレスは 3×10 → 3×8 → 3×6 の順で進みます。T3は最終セットが25回できたら次回から重量を増やします。',
     'T1 スクワット 5×3+、T2 ベンチプレス 3×10、T3 ラットプルダウン / レッグプレス / チェストプレス 3×15+'),
    (w2, 2,
     'プレス中心の日 — T1 オーバーヘッドプレスは 5×3+ → 6×2+ → 10×1+ の順に進みます。規定回数をこなせなくなったら5RMを再テストし、85%の重量から再スタートします。T2 デッドリフトは 3×10 → 3×8 → 3×6 の順で進みます。T3は最終セットが25回できたら次回から重量を増やします。',
     'T1 オーバーヘッドプレス 5×3+、T2 デッドリフト 3×10、T3 シーテッドロー / サイドレイズ / ヒップスラスト 3×15+'),
    (w2, 3,
     'ベンチプレス中心の日 — T1 ベンチプレスは 5×3+ → 6×2+ → 10×1+ の順に進みます。規定回数をこなせなくなったら5RMを再テストし、85%の重量から再スタートします。T2 スクワットは 3×10 → 3×8 → 3×6 の順で進みます。T3は最終セットが25回できたら次回から重量を増やします。',
     'T1 ベンチプレス 5×3+、T2 スクワット 3×10、T3 ラットプルダウン / ダンベルプレス / ハックスクワット 3×15+'),
    (w2, 4,
     'デッドリフト中心の日 — T1 デッドリフトは 5×3+ → 6×2+ → 10×1+ の順に進みます。規定回数をこなせなくなったら5RMを再テストし、85%の重量から再スタートします。T2 オーバーヘッドプレスは 3×10 → 3×8 → 3×6 の順で進みます。T3は最終セットが25回できたら次回から重量を増やします。',
     'T1 デッドリフト 5×3+、T2 オーバーヘッドプレス 3×10、T3 バーベルロー / グッドモーニング / リアデルトフライ 3×15+'),
    -- Week 3 (same rotation)
    (w3, 1,
     'スクワット中心の日 — T1 スクワットは 5×3+ → 6×2+ → 10×1+ の順に進みます。規定回数をこなせなくなったら5RMを再テストし、85%の重量から再スタートします。T2 ベンチプレスは 3×10 → 3×8 → 3×6 の順で進みます。T3は最終セットが25回できたら次回から重量を増やします。',
     'T1 スクワット 5×3+、T2 ベンチプレス 3×10、T3 ラットプルダウン / レッグプレス / チェストプレス 3×15+'),
    (w3, 2,
     'プレス中心の日 — T1 オーバーヘッドプレスは 5×3+ → 6×2+ → 10×1+ の順に進みます。規定回数をこなせなくなったら5RMを再テストし、85%の重量から再スタートします。T2 デッドリフトは 3×10 → 3×8 → 3×6 の順で進みます。T3は最終セットが25回できたら次回から重量を増やします。',
     'T1 オーバーヘッドプレス 5×3+、T2 デッドリフト 3×10、T3 シーテッドロー / サイドレイズ / ヒップスラスト 3×15+'),
    (w3, 3,
     'ベンチプレス中心の日 — T1 ベンチプレスは 5×3+ → 6×2+ → 10×1+ の順に進みます。規定回数をこなせなくなったら5RMを再テストし、85%の重量から再スタートします。T2 スクワットは 3×10 → 3×8 → 3×6 の順で進みます。T3は最終セットが25回できたら次回から重量を増やします。',
     'T1 ベンチプレス 5×3+、T2 スクワット 3×10、T3 ラットプルダウン / ダンベルプレス / ハックスクワット 3×15+'),
    (w3, 4,
     'デッドリフト中心の日 — T1 デッドリフトは 5×3+ → 6×2+ → 10×1+ の順に進みます。規定回数をこなせなくなったら5RMを再テストし、85%の重量から再スタートします。T2 オーバーヘッドプレスは 3×10 → 3×8 → 3×6 の順で進みます。T3は最終セットが25回できたら次回から重量を増やします。',
     'T1 デッドリフト 5×3+、T2 オーバーヘッドプレス 3×10、T3 バーベルロー / グッドモーニング / リアデルトフライ 3×15+'),
    -- Week 4 (same rotation)
    (w4, 1,
     'スクワット中心の日 — T1 スクワットは 5×3+ → 6×2+ → 10×1+ の順に進みます。規定回数をこなせなくなったら5RMを再テストし、85%の重量から再スタートします。T2 ベンチプレスは 3×10 → 3×8 → 3×6 の順で進みます。T3は最終セットが25回できたら次回から重量を増やします。',
     'T1 スクワット 5×3+、T2 ベンチプレス 3×10、T3 ラットプルダウン / レッグプレス / チェストプレス 3×15+'),
    (w4, 2,
     'プレス中心の日 — T1 オーバーヘッドプレスは 5×3+ → 6×2+ → 10×1+ の順に進みます。規定回数をこなせなくなったら5RMを再テストし、85%の重量から再スタートします。T2 デッドリフトは 3×10 → 3×8 → 3×6 の順で進みます。T3は最終セットが25回できたら次回から重量を増やします。',
     'T1 オーバーヘッドプレス 5×3+、T2 デッドリフト 3×10、T3 シーテッドロー / サイドレイズ / ヒップスラスト 3×15+'),
    (w4, 3,
     'ベンチプレス中心の日 — T1 ベンチプレスは 5×3+ → 6×2+ → 10×1+ の順に進みます。規定回数をこなせなくなったら5RMを再テストし、85%の重量から再スタートします。T2 スクワットは 3×10 → 3×8 → 3×6 の順で進みます。T3は最終セットが25回できたら次回から重量を増やします。',
     'T1 ベンチプレス 5×3+、T2 スクワット 3×10、T3 ラットプルダウン / ダンベルプレス / ハックスクワット 3×15+'),
    (w4, 4,
     'デッドリフト中心の日 — T1 デッドリフトは 5×3+ → 6×2+ → 10×1+ の順に進みます。規定回数をこなせなくなったら5RMを再テストし、85%の重量から再スタートします。T2 オーバーヘッドプレスは 3×10 → 3×8 → 3×6 の順で進みます。T3は最終セットが25回できたら次回から重量を増やします。',
     'T1 デッドリフト 5×3+、T2 オーバーヘッドプレス 3×10、T3 バーベルロー / グッドモーニング / リアデルトフライ 3×15+');

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

  -- ----------------------------------------------------------------
  -- Exercises per day (5 per day × 16 days = 80 rows)
  -- order 1: T1 main | order 2: T2 practice
  -- order 3: T3 pull (fixed) | order 4: T3 T1-support | order 5: T3 T2-support
  --
  -- pos3 pull exercises (fixed, no swap):
  --   A1/A2: lat-pulldown (縦引き)
  --   B1:    seated-row   (横引き・ケーブル)
  --   B2:    barbell-row  (横引き・バーベル)
  --
  -- Default T3 pos4/5 (swap candidates in gzclp-base-v2-4day-swap-groups.sql):
  --   A1: pos4=leg-press (squat-t3)    pos5=chest-press (bench-t3)
  --   B1: pos4=lateral-raise (ohp-t3)  pos5=hip-thrust (deadlift-t3)
  --   A2: pos4=dumbbell-press (bench-t3) pos5=hack-squat (squat-t3)
  --   B2: pos4=good-morning (deadlift-t3) pos5=rear-delt-fly (ohp-t3)
  -- ----------------------------------------------------------------
  insert into public.program_day_exercises
    (program_day_id, exercise_id, exercise_type, set_count, target_reps_text, order_index)
  values
    -- W1D1 = A1
    (w1d1, ex_squat,          'T1', 5, '3+',  1),
    (w1d1, ex_bench,          'T2', 3, '10',  2),
    (w1d1, ex_lat_pulldown,   'T3', 3, '15+', 3),
    (w1d1, ex_leg_press,      'T3', 3, '15+', 4),
    (w1d1, ex_chest_press,    'T3', 3, '15+', 5),
    -- W1D2 = B1
    (w1d2, ex_press,          'T1', 5, '3+',  1),
    (w1d2, ex_deadlift,       'T2', 3, '10',  2),
    (w1d2, ex_seated_row,         'T3', 3, '15+', 3),
    (w1d2, ex_lateral_raise,  'T3', 3, '15+', 4),
    (w1d2, ex_hip_thrust,     'T3', 3, '15+', 5),
    -- W1D3 = A2
    (w1d3, ex_bench,          'T1', 5, '3+',  1),
    (w1d3, ex_squat,          'T2', 3, '10',  2),
    (w1d3, ex_lat_pulldown,   'T3', 3, '15+', 3),
    (w1d3, ex_dumbbell_press, 'T3', 3, '15+', 4),
    (w1d3, ex_hack_squat,     'T3', 3, '15+', 5),
    -- W1D4 = B2
    (w1d4, ex_deadlift,       'T1', 5, '3+',  1),
    (w1d4, ex_press,          'T2', 3, '10',  2),
    (w1d4, ex_barbell_row,    'T3', 3, '15+', 3),
    (w1d4, ex_good_morning,   'T3', 3, '15+', 4),
    (w1d4, ex_rear_delt_fly,  'T3', 3, '15+', 5),
    -- W2D1 = A1
    (w2d1, ex_squat,          'T1', 5, '3+',  1),
    (w2d1, ex_bench,          'T2', 3, '10',  2),
    (w2d1, ex_lat_pulldown,   'T3', 3, '15+', 3),
    (w2d1, ex_leg_press,      'T3', 3, '15+', 4),
    (w2d1, ex_chest_press,    'T3', 3, '15+', 5),
    -- W2D2 = B1
    (w2d2, ex_press,          'T1', 5, '3+',  1),
    (w2d2, ex_deadlift,       'T2', 3, '10',  2),
    (w2d2, ex_seated_row,         'T3', 3, '15+', 3),
    (w2d2, ex_lateral_raise,  'T3', 3, '15+', 4),
    (w2d2, ex_hip_thrust,     'T3', 3, '15+', 5),
    -- W2D3 = A2
    (w2d3, ex_bench,          'T1', 5, '3+',  1),
    (w2d3, ex_squat,          'T2', 3, '10',  2),
    (w2d3, ex_lat_pulldown,   'T3', 3, '15+', 3),
    (w2d3, ex_dumbbell_press, 'T3', 3, '15+', 4),
    (w2d3, ex_hack_squat,     'T3', 3, '15+', 5),
    -- W2D4 = B2
    (w2d4, ex_deadlift,       'T1', 5, '3+',  1),
    (w2d4, ex_press,          'T2', 3, '10',  2),
    (w2d4, ex_barbell_row,    'T3', 3, '15+', 3),
    (w2d4, ex_good_morning,   'T3', 3, '15+', 4),
    (w2d4, ex_rear_delt_fly,  'T3', 3, '15+', 5),
    -- W3D1 = A1
    (w3d1, ex_squat,          'T1', 5, '3+',  1),
    (w3d1, ex_bench,          'T2', 3, '10',  2),
    (w3d1, ex_lat_pulldown,   'T3', 3, '15+', 3),
    (w3d1, ex_leg_press,      'T3', 3, '15+', 4),
    (w3d1, ex_chest_press,    'T3', 3, '15+', 5),
    -- W3D2 = B1
    (w3d2, ex_press,          'T1', 5, '3+',  1),
    (w3d2, ex_deadlift,       'T2', 3, '10',  2),
    (w3d2, ex_seated_row,         'T3', 3, '15+', 3),
    (w3d2, ex_lateral_raise,  'T3', 3, '15+', 4),
    (w3d2, ex_hip_thrust,     'T3', 3, '15+', 5),
    -- W3D3 = A2
    (w3d3, ex_bench,          'T1', 5, '3+',  1),
    (w3d3, ex_squat,          'T2', 3, '10',  2),
    (w3d3, ex_lat_pulldown,   'T3', 3, '15+', 3),
    (w3d3, ex_dumbbell_press, 'T3', 3, '15+', 4),
    (w3d3, ex_hack_squat,     'T3', 3, '15+', 5),
    -- W3D4 = B2
    (w3d4, ex_deadlift,       'T1', 5, '3+',  1),
    (w3d4, ex_press,          'T2', 3, '10',  2),
    (w3d4, ex_barbell_row,    'T3', 3, '15+', 3),
    (w3d4, ex_good_morning,   'T3', 3, '15+', 4),
    (w3d4, ex_rear_delt_fly,  'T3', 3, '15+', 5),
    -- W4D1 = A1
    (w4d1, ex_squat,          'T1', 5, '3+',  1),
    (w4d1, ex_bench,          'T2', 3, '10',  2),
    (w4d1, ex_lat_pulldown,   'T3', 3, '15+', 3),
    (w4d1, ex_leg_press,      'T3', 3, '15+', 4),
    (w4d1, ex_chest_press,    'T3', 3, '15+', 5),
    -- W4D2 = B1
    (w4d2, ex_press,          'T1', 5, '3+',  1),
    (w4d2, ex_deadlift,       'T2', 3, '10',  2),
    (w4d2, ex_seated_row,         'T3', 3, '15+', 3),
    (w4d2, ex_lateral_raise,  'T3', 3, '15+', 4),
    (w4d2, ex_hip_thrust,     'T3', 3, '15+', 5),
    -- W4D3 = A2
    (w4d3, ex_bench,          'T1', 5, '3+',  1),
    (w4d3, ex_squat,          'T2', 3, '10',  2),
    (w4d3, ex_lat_pulldown,   'T3', 3, '15+', 3),
    (w4d3, ex_dumbbell_press, 'T3', 3, '15+', 4),
    (w4d3, ex_hack_squat,     'T3', 3, '15+', 5),
    -- W4D4 = B2
    (w4d4, ex_deadlift,       'T1', 5, '3+',  1),
    (w4d4, ex_press,          'T2', 3, '10',  2),
    (w4d4, ex_barbell_row,    'T3', 3, '15+', 3),
    (w4d4, ex_good_morning,   'T3', 3, '15+', 4),
    (w4d4, ex_rear_delt_fly,  'T3', 3, '15+', 5);

  -- ----------------------------------------------------------------
  -- Tag assignments (soft — skipped if tags not yet seeded)
  -- ----------------------------------------------------------------
  select id into tag_strength  from public.program_tags where slug = 'strength';
  select id into tag_barbell   from public.program_tags where slug = 'barbell';
  select id into tag_full_body from public.program_tags where slug = 'full-body';

  if tag_strength is not null and tag_barbell is not null and tag_full_body is not null then
    insert into public.program_tag_assignments (program_id, tag_id, axis)
    values
      (prog_id, tag_strength,  'goal'),
      (prog_id, tag_barbell,   'equipment'),
      (prog_id, tag_full_body, 'split')
    on conflict do nothing;
  else
    raise notice 'program_tags not found — tag assignments skipped. Run program-metadata.sql separately if needed.';
  end if;

  raise notice 'Seed complete: gzclp-base-v2-4day program_id = %', prog_id;
end;
$$;

-- Post-check (run separately after seed):
-- select pw.week_number, pd.day_number, pde.order_index,
--        e.slug as exercise_slug, pde.exercise_type, pde.set_count, pde.target_reps_text
-- from public.programs p
-- join public.program_weeks pw          on pw.program_id     = p.id
-- join public.program_days pd           on pd.program_week_id = pw.id
-- join public.program_day_exercises pde on pde.program_day_id = pd.id
-- join public.exercises e               on e.id              = pde.exercise_id
-- where p.slug = 'gzclp-base-v2-4day'
-- order by pw.week_number, pd.day_number, pde.order_index;
-- Expected: 80 rows (16 days × 5 exercises)
