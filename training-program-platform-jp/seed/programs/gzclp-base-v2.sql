-- Seed: GZCLP 5-Exercise Base (v2)
-- Run in Supabase Dashboard > SQL Editor
--
-- Source reference:
--   Cody Lefever, "The GZCL Method" (GZCLP section, February 2016)
--   Extended variant: original 3-exercise structure + 2 T3 accessories per session.
--
-- DESIGN DECISION:
--   New slug (gzclp-base-v2) rather than modifying gzclp-base.
--   gzclp-base is preserved intact for users with existing enrollments.
--   v2 adds two T3 accessories per session beyond the original three-exercise layout.
--
-- Structure:
--   Week 1: A1 / B1 / A2
--   Week 2: B2 / A1 / B1
--   Week 3: A2 / B2 / A1
--   Week 4: B1 / A2 / B2
--
-- Per-session layout (5 exercises, order_index 1–5):
--   1: T1 main lift       (5×3+)
--   2: T2 practice lift   (3×10)
--   3: T3 pull — fixed    (3×15+)
--   4: T3 T1-support      (3×15+)
--   5: T3 T2-support      (3×15+)
--
-- Workout A1: Squat / Bench Press / Lat Pulldown / Leg Curl / Triceps Pushdown
-- Workout B1: OHP   / Deadlift    / DB Row       / Lateral Raise / Back Extension
-- Workout A2: Bench / Squat       / Lat Pulldown / Incline DB Press / Leg Extension
-- Workout B2: Deadlift / OHP      / DB Row       / Romanian Deadlift / Lateral Raise
--
-- T1 fail protocol: 5×3+ → 6×2+ → 10×1+, retest 5RM and restart at 85%
-- T2 fail protocol: 3×10 → 3×8 → 3×6, then restart slightly heavier
-- T3 progression:   add weight when the final set reaches 25 reps

do $$
declare
  -- core barbell lifts (existing)
  ex_squat        uuid;
  ex_bench        uuid;
  ex_press        uuid;
  ex_deadlift     uuid;
  ex_lat_pulldown uuid;
  ex_db_row       uuid;

  -- new T3 accessories
  ex_leg_curl          uuid;
  ex_triceps_pushdown  uuid;
  ex_lateral_raise     uuid;
  ex_back_extension    uuid;
  ex_incline_db_press  uuid;
  ex_leg_extension     uuid;
  ex_romanian_deadlift uuid;

  prog_id uuid;

  w1 uuid; w2 uuid; w3 uuid; w4 uuid;
  w1d1 uuid; w1d2 uuid; w1d3 uuid;
  w2d1 uuid; w2d2 uuid; w2d3 uuid;
  w3d1 uuid; w3d2 uuid; w3d3 uuid;
  w4d1 uuid; w4d2 uuid; w4d3 uuid;

  -- tags (optional — skipped gracefully if program_tags table not yet seeded)
  tag_strength  uuid;
  tag_barbell   uuid;
  tag_full_body uuid;
begin
  -- ----------------------------------------------------------------
  -- Upsert exercises (safe to re-run)
  -- ----------------------------------------------------------------
  insert into public.exercises (slug, name_ja, name_en, category)
  values
    ('squat',                U&'\30B9\30AF\30EF\30C3\30C8',                                        'Squat',                 'legs'),
    ('bench-press',          U&'\30D9\30F3\30C1\30D7\30EC\30B9',                                   'Bench Press',           'chest'),
    ('overhead-press',       U&'\30AA\30FC\30D0\30FC\30D8\30C3\30C9\30D7\30EC\30B9',               'Overhead Press',        'shoulders'),
    ('deadlift',             U&'\30C7\30C3\30C9\30EA\30D5\30C8',                                   'Deadlift',              'back'),
    ('lat-pulldown',         U&'\30E9\30C3\30C8\30D7\30EB\30C0\30A6\30F3',                         'Lat Pulldown',          'back'),
    ('dumbbell-row',         U&'\30C0\30F3\30D9\30EB\30ED\30A6',                                   'Dumbbell Row',          'back'),
    ('leg-curl',             U&'\30EC\30C3\30B0\30AB\30FC\30EB',                                   'Leg Curl',              'legs'),
    ('triceps-pushdown',     U&'\30C8\30E9\30A4\30BB\30D7\30B9\30D7\30C3\30B7\30E5\30C0\30A6\30F3','Triceps Pushdown',      'arms'),
    ('lateral-raise',        U&'\30B5\30A4\30C9\30EC\30A4\30BA',                                   'Lateral Raise',         'shoulders'),
    ('back-extension',       U&'\30D0\30C3\30AF\30A8\30AF\30B9\30C6\30F3\30B7\30E7\30F3',          'Back Extension',        'back'),
    ('incline-dumbbell-press', U&'\30A4\30F3\30AF\30E9\30A4\30F3\30C0\30F3\30D9\30EB\30D7\30EC\30B9','Incline Dumbbell Press','chest'),
    ('leg-extension',        U&'\30EC\30C3\30B0\30A8\30AF\30B9\30C6\30F3\30B7\30E7\30F3',          'Leg Extension',         'legs'),
    ('romanian-deadlift',    U&'\30EB\30FC\30DE\30CB\30A2\30F3\30C7\30C3\30C9\30EA\30D5\30C8',     'Romanian Deadlift',     'back')
  on conflict (slug) do nothing;

  select id into ex_squat             from public.exercises where slug = 'squat';
  select id into ex_bench             from public.exercises where slug = 'bench-press';
  select id into ex_press             from public.exercises where slug = 'overhead-press';
  select id into ex_deadlift          from public.exercises where slug = 'deadlift';
  select id into ex_lat_pulldown      from public.exercises where slug = 'lat-pulldown';
  select id into ex_db_row            from public.exercises where slug = 'dumbbell-row';
  select id into ex_leg_curl          from public.exercises where slug = 'leg-curl';
  select id into ex_triceps_pushdown  from public.exercises where slug = 'triceps-pushdown';
  select id into ex_lateral_raise     from public.exercises where slug = 'lateral-raise';
  select id into ex_back_extension    from public.exercises where slug = 'back-extension';
  select id into ex_incline_db_press  from public.exercises where slug = 'incline-dumbbell-press';
  select id into ex_leg_extension     from public.exercises where slug = 'leg-extension';
  select id into ex_romanian_deadlift from public.exercises where slug = 'romanian-deadlift';

  if ex_squat is null or ex_bench is null or ex_press is null
    or ex_deadlift is null or ex_lat_pulldown is null or ex_db_row is null
    or ex_leg_curl is null or ex_triceps_pushdown is null or ex_lateral_raise is null
    or ex_back_extension is null or ex_incline_db_press is null
    or ex_leg_extension is null or ex_romanian_deadlift is null then
    raise exception 'Exercise lookup failed for gzclp-base-v2 seed.';
  end if;

  -- ----------------------------------------------------------------
  -- Guard: skip if already seeded
  -- ----------------------------------------------------------------
  if exists (select 1 from public.programs where slug = 'gzclp-base-v2') then
    raise notice 'gzclp-base-v2 already exists — skipping program insert.';
    return;
  end if;

  -- ----------------------------------------------------------------
  -- Program
  -- ----------------------------------------------------------------
  insert into public.programs
    (slug, title, description, duration_weeks, days_per_week, level,
     source_program_name, source_fidelity, source_notes, is_public)
  values (
    'gzclp-base-v2',
    'GZCLP 基礎プログラム（改良版）',
    '週3日で全身をしっかり鍛える改良版GZCLPプログラムです。T1のメイン種目で重さを伸ばし、T2の補助種目でフォームと基礎筋力を高め、T3のアクセサリー種目で弱点補強や筋肉量アップを狙います。種目の入れ替えに対応しており、バリエーションを持たせながら継続できます。',
    4, 3, 'beginner',
    'GZCLP', 'adapted',
    'Cody Lefever オリジナルをベースに、各セッションのT3アクセサリーを拡張した改良版。T1/T2/T3の3段階構成はそのままに、セッションあたり5種目に増加。',
    true
  )
  returning id into prog_id;

  -- ----------------------------------------------------------------
  -- Weeks
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
  -- Days (rotation W1:A1,B1,A2 | W2:B2,A1,B1 | W3:A2,B2,A1 | W4:B1,A2,B2)
  -- ----------------------------------------------------------------
  insert into public.program_days (program_week_id, day_number, progression_guide, notes)
  values
    (w1, 1, 'スクワット中心の日 — T1 スクワットは 5×3+ → 6×2+ → 10×1+ の順に進みます。規定回数をこなせなくなったら5RMを再テストし、85%の重量から再スタートします。T2 ベンチプレスは 3×10 → 3×8 → 3×6 の順で進みます。T3は最終セットが25回できたら次回から重量を増やします。',
            'T1 スクワット 5×3+、T2 ベンチプレス 3×10、T3 ラットプルダウン / レッグカール / トライセップスプッシュダウン 3×15+'),
    (w1, 2, 'プレス中心の日 — T1 オーバーヘッドプレスは 5×3+ → 6×2+ → 10×1+ の順に進みます。規定回数をこなせなくなったら5RMを再テストし、85%の重量から再スタートします。T2 デッドリフトは 3×10 → 3×8 → 3×6 の順で進みます。T3は最終セットが25回できたら次回から重量を増やします。',
            'T1 オーバーヘッドプレス 5×3+、T2 デッドリフト 3×10、T3 ダンベルロー / サイドレイズ / バックエクステンション 3×15+'),
    (w1, 3, 'ベンチプレス中心の日 — T1 ベンチプレスは 5×3+ → 6×2+ → 10×1+ の順に進みます。規定回数をこなせなくなったら5RMを再テストし、85%の重量から再スタートします。T2 スクワットは 3×10 → 3×8 → 3×6 の順で進みます。T3は最終セットが25回できたら次回から重量を増やします。',
            'T1 ベンチプレス 5×3+、T2 スクワット 3×10、T3 ラットプルダウン / インクラインダンベルプレス / レッグエクステンション 3×15+'),
    (w2, 1, 'デッドリフト中心の日 — T1 デッドリフトは 5×3+ → 6×2+ → 10×1+ の順に進みます。規定回数をこなせなくなったら5RMを再テストし、85%の重量から再スタートします。T2 オーバーヘッドプレスは 3×10 → 3×8 → 3×6 の順で進みます。T3は最終セットが25回できたら次回から重量を増やします。',
            'T1 デッドリフト 5×3+、T2 オーバーヘッドプレス 3×10、T3 ダンベルロー / ルーマニアンデッドリフト / サイドレイズ 3×15+'),
    (w2, 2, 'スクワット中心の日 — T1 スクワットは 5×3+ → 6×2+ → 10×1+ の順に進みます。規定回数をこなせなくなったら5RMを再テストし、85%の重量から再スタートします。T2 ベンチプレスは 3×10 → 3×8 → 3×6 の順で進みます。T3は最終セットが25回できたら次回から重量を増やします。',
            'T1 スクワット 5×3+、T2 ベンチプレス 3×10、T3 ラットプルダウン / レッグカール / トライセップスプッシュダウン 3×15+'),
    (w2, 3, 'プレス中心の日 — T1 オーバーヘッドプレスは 5×3+ → 6×2+ → 10×1+ の順に進みます。規定回数をこなせなくなったら5RMを再テストし、85%の重量から再スタートします。T2 デッドリフトは 3×10 → 3×8 → 3×6 の順で進みます。T3は最終セットが25回できたら次回から重量を増やします。',
            'T1 オーバーヘッドプレス 5×3+、T2 デッドリフト 3×10、T3 ダンベルロー / サイドレイズ / バックエクステンション 3×15+'),
    (w3, 1, 'ベンチプレス中心の日 — T1 ベンチプレスは 5×3+ → 6×2+ → 10×1+ の順に進みます。規定回数をこなせなくなったら5RMを再テストし、85%の重量から再スタートします。T2 スクワットは 3×10 → 3×8 → 3×6 の順で進みます。T3は最終セットが25回できたら次回から重量を増やします。',
            'T1 ベンチプレス 5×3+、T2 スクワット 3×10、T3 ラットプルダウン / インクラインダンベルプレス / レッグエクステンション 3×15+'),
    (w3, 2, 'デッドリフト中心の日 — T1 デッドリフトは 5×3+ → 6×2+ → 10×1+ の順に進みます。規定回数をこなせなくなったら5RMを再テストし、85%の重量から再スタートします。T2 オーバーヘッドプレスは 3×10 → 3×8 → 3×6 の順で進みます。T3は最終セットが25回できたら次回から重量を増やします。',
            'T1 デッドリフト 5×3+、T2 オーバーヘッドプレス 3×10、T3 ダンベルロー / ルーマニアンデッドリフト / サイドレイズ 3×15+'),
    (w3, 3, 'スクワット中心の日 — T1 スクワットは 5×3+ → 6×2+ → 10×1+ の順に進みます。規定回数をこなせなくなったら5RMを再テストし、85%の重量から再スタートします。T2 ベンチプレスは 3×10 → 3×8 → 3×6 の順で進みます。T3は最終セットが25回できたら次回から重量を増やします。',
            'T1 スクワット 5×3+、T2 ベンチプレス 3×10、T3 ラットプルダウン / レッグカール / トライセップスプッシュダウン 3×15+'),
    (w4, 1, 'プレス中心の日 — T1 オーバーヘッドプレスは 5×3+ → 6×2+ → 10×1+ の順に進みます。規定回数をこなせなくなったら5RMを再テストし、85%の重量から再スタートします。T2 デッドリフトは 3×10 → 3×8 → 3×6 の順で進みます。T3は最終セットが25回できたら次回から重量を増やします。',
            'T1 オーバーヘッドプレス 5×3+、T2 デッドリフト 3×10、T3 ダンベルロー / サイドレイズ / バックエクステンション 3×15+'),
    (w4, 2, 'ベンチプレス中心の日 — T1 ベンチプレスは 5×3+ → 6×2+ → 10×1+ の順に進みます。規定回数をこなせなくなったら5RMを再テストし、85%の重量から再スタートします。T2 スクワットは 3×10 → 3×8 → 3×6 の順で進みます。T3は最終セットが25回できたら次回から重量を増やします。',
            'T1 ベンチプレス 5×3+、T2 スクワット 3×10、T3 ラットプルダウン / インクラインダンベルプレス / レッグエクステンション 3×15+'),
    (w4, 3, 'デッドリフト中心の日 — T1 デッドリフトは 5×3+ → 6×2+ → 10×1+ の順に進みます。規定回数をこなせなくなったら5RMを再テストし、85%の重量から再スタートします。T2 オーバーヘッドプレスは 3×10 → 3×8 → 3×6 の順で進みます。T3は最終セットが25回できたら次回から重量を増やします。',
            'T1 デッドリフト 5×3+、T2 オーバーヘッドプレス 3×10、T3 ダンベルロー / ルーマニアンデッドリフト / サイドレイズ 3×15+');

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

  -- ----------------------------------------------------------------
  -- Exercises per day (5 per day × 12 days = 60 rows)
  -- order 1: T1 main | order 2: T2 practice
  -- order 3: T3 pull | order 4: T3 T1-support | order 5: T3 T2-support
  -- ----------------------------------------------------------------
  insert into public.program_day_exercises
    (program_day_id, exercise_id, exercise_type, set_count, target_reps_text, order_index)
  values
    -- W1D1 = A1
    (w1d1, ex_squat,            'T1', 5, '3+',  1),
    (w1d1, ex_bench,            'T2', 3, '10',  2),
    (w1d1, ex_lat_pulldown,     'T3', 3, '15+', 3),
    (w1d1, ex_leg_curl,         'T3', 3, '15+', 4),
    (w1d1, ex_triceps_pushdown, 'T3', 3, '15+', 5),
    -- W1D2 = B1
    (w1d2, ex_press,            'T1', 5, '3+',  1),
    (w1d2, ex_deadlift,         'T2', 3, '10',  2),
    (w1d2, ex_db_row,           'T3', 3, '15+', 3),
    (w1d2, ex_lateral_raise,    'T3', 3, '15+', 4),
    (w1d2, ex_back_extension,   'T3', 3, '15+', 5),
    -- W1D3 = A2
    (w1d3, ex_bench,              'T1', 5, '3+',  1),
    (w1d3, ex_squat,              'T2', 3, '10',  2),
    (w1d3, ex_lat_pulldown,       'T3', 3, '15+', 3),
    (w1d3, ex_incline_db_press,   'T3', 3, '15+', 4),
    (w1d3, ex_leg_extension,      'T3', 3, '15+', 5),
    -- W2D1 = B2
    (w2d1, ex_deadlift,           'T1', 5, '3+',  1),
    (w2d1, ex_press,              'T2', 3, '10',  2),
    (w2d1, ex_db_row,             'T3', 3, '15+', 3),
    (w2d1, ex_romanian_deadlift,  'T3', 3, '15+', 4),
    (w2d1, ex_lateral_raise,      'T3', 3, '15+', 5),
    -- W2D2 = A1
    (w2d2, ex_squat,            'T1', 5, '3+',  1),
    (w2d2, ex_bench,            'T2', 3, '10',  2),
    (w2d2, ex_lat_pulldown,     'T3', 3, '15+', 3),
    (w2d2, ex_leg_curl,         'T3', 3, '15+', 4),
    (w2d2, ex_triceps_pushdown, 'T3', 3, '15+', 5),
    -- W2D3 = B1
    (w2d3, ex_press,            'T1', 5, '3+',  1),
    (w2d3, ex_deadlift,         'T2', 3, '10',  2),
    (w2d3, ex_db_row,           'T3', 3, '15+', 3),
    (w2d3, ex_lateral_raise,    'T3', 3, '15+', 4),
    (w2d3, ex_back_extension,   'T3', 3, '15+', 5),
    -- W3D1 = A2
    (w3d1, ex_bench,              'T1', 5, '3+',  1),
    (w3d1, ex_squat,              'T2', 3, '10',  2),
    (w3d1, ex_lat_pulldown,       'T3', 3, '15+', 3),
    (w3d1, ex_incline_db_press,   'T3', 3, '15+', 4),
    (w3d1, ex_leg_extension,      'T3', 3, '15+', 5),
    -- W3D2 = B2
    (w3d2, ex_deadlift,           'T1', 5, '3+',  1),
    (w3d2, ex_press,              'T2', 3, '10',  2),
    (w3d2, ex_db_row,             'T3', 3, '15+', 3),
    (w3d2, ex_romanian_deadlift,  'T3', 3, '15+', 4),
    (w3d2, ex_lateral_raise,      'T3', 3, '15+', 5),
    -- W3D3 = A1
    (w3d3, ex_squat,            'T1', 5, '3+',  1),
    (w3d3, ex_bench,            'T2', 3, '10',  2),
    (w3d3, ex_lat_pulldown,     'T3', 3, '15+', 3),
    (w3d3, ex_leg_curl,         'T3', 3, '15+', 4),
    (w3d3, ex_triceps_pushdown, 'T3', 3, '15+', 5),
    -- W4D1 = B1
    (w4d1, ex_press,            'T1', 5, '3+',  1),
    (w4d1, ex_deadlift,         'T2', 3, '10',  2),
    (w4d1, ex_db_row,           'T3', 3, '15+', 3),
    (w4d1, ex_lateral_raise,    'T3', 3, '15+', 4),
    (w4d1, ex_back_extension,   'T3', 3, '15+', 5),
    -- W4D2 = A2
    (w4d2, ex_bench,              'T1', 5, '3+',  1),
    (w4d2, ex_squat,              'T2', 3, '10',  2),
    (w4d2, ex_lat_pulldown,       'T3', 3, '15+', 3),
    (w4d2, ex_incline_db_press,   'T3', 3, '15+', 4),
    (w4d2, ex_leg_extension,      'T3', 3, '15+', 5),
    -- W4D3 = B2
    (w4d3, ex_deadlift,           'T1', 5, '3+',  1),
    (w4d3, ex_press,              'T2', 3, '10',  2),
    (w4d3, ex_db_row,             'T3', 3, '15+', 3),
    (w4d3, ex_romanian_deadlift,  'T3', 3, '15+', 4),
    (w4d3, ex_lateral_raise,      'T3', 3, '15+', 5);

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

  raise notice 'Seed complete: gzclp-base-v2 program_id = %', prog_id;
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
-- where p.slug = 'gzclp-base-v2'
-- order by pw.week_number, pd.day_number, pde.order_index;
-- Expected: 60 rows (12 days × 5 exercises)
