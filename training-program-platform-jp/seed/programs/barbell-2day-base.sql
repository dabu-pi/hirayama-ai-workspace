-- Seed: Barbell 2-Day Full Body Base Program
-- Run in Supabase Dashboard > SQL Editor
--
-- A beginner-friendly 2-day/week barbell full-body template.
-- Covers all five fundamental barbell movements across two sessions.
-- Requires no new exercises — all slugs exist from prior seeds
-- (gzclp-base.sql or upper-lower-base.sql must have run first).
--
-- Structure:
--   4 weeks x 2 days/week = 8 sessions total (fixed, no A/B rotation)
--
-- Day 1 (Squat emphasis):
--   Squat          T1  4x5   — primary lower-body strength
--   Bench Press    T2  3x8   — horizontal push
--   Barbell Row    T2  3x8   — horizontal pull
--
-- Day 2 (Hinge emphasis):
--   Deadlift       T1  1x5   — primary hinge strength
--   Overhead Press T2  3x8   — vertical push
--   Barbell Row    T2  3x8   — horizontal pull
--
-- Metadata (tags) are applied inline at the end of this block.
-- Tags required: strength (goal), barbell (equipment), full-body (split).
-- Run program-metadata.sql first if tags do not yet exist in the DB.
--
-- Idempotent: if barbell-2day-base already exists, the block exits early.

do $$
declare
  ex_squat    uuid;
  ex_bench    uuid;
  ex_row      uuid;
  ex_deadlift uuid;
  ex_ohp      uuid;

  prog_id uuid;

  tag_strength  uuid;
  tag_barbell   uuid;
  tag_full_body uuid;

  w1 uuid; w2 uuid; w3 uuid; w4 uuid;

  w1d1 uuid; w1d2 uuid;
  w2d1 uuid; w2d2 uuid;
  w3d1 uuid; w3d2 uuid;
  w4d1 uuid; w4d2 uuid;

  guide_d1 text := '全セットをフォームを保って完了できたら、次のセッションで2.5〜5kg増やしてください。できない場合は同じ重量で繰り返しましょう。';
  guide_d2 text := '全セットをフォームを保って完了できたら、次のセッションで2.5〜5kg増やしてください。できない場合は同じ重量で繰り返しましょう。';
begin
  -- All exercises should already exist. ON CONFLICT DO NOTHING as safety net.
  insert into public.exercises (slug, name_ja, name_en, category)
  values
    ('squat',          U&'\30B9\30AF\30EF\30C3\30C8',                         'Squat',          'legs'),
    ('bench-press',    U&'\30D9\30F3\30C1\30D7\30EC\30B9',                    'Bench Press',    'chest'),
    ('barbell-row',    U&'\30D0\30FC\30D9\30EB\30ED\30A6',                    'Barbell Row',    'back'),
    ('deadlift',       U&'\30C7\30C3\30C9\30EA\30D5\30C8',                    'Deadlift',       'back'),
    ('overhead-press', U&'\30AA\30FC\30D0\30FC\30D8\30C3\30C9\30D7\30EC\30B9','Overhead Press', 'shoulders')
  on conflict (slug) do nothing;

  select id into ex_squat    from public.exercises where slug = 'squat';
  select id into ex_bench    from public.exercises where slug = 'bench-press';
  select id into ex_row      from public.exercises where slug = 'barbell-row';
  select id into ex_deadlift from public.exercises where slug = 'deadlift';
  select id into ex_ohp      from public.exercises where slug = 'overhead-press';

  if ex_squat    is null
    or ex_bench    is null
    or ex_row      is null
    or ex_deadlift is null
    or ex_ohp      is null then
    raise exception 'Exercise lookup failed for barbell-2day-base — ensure gzclp-base.sql or upper-lower-base.sql has been run first.';
  end if;

  if exists (select 1 from public.programs where slug = 'barbell-2day-base') then
    raise notice 'barbell-2day-base already exists, skipping.';
    return;
  end if;

  -- ── programs ──────────────────────────────────────────────────────────────
  insert into public.programs
    (slug, title, description, duration_weeks, days_per_week, level, is_public,
     source_program_name, source_fidelity, source_notes)
  values (
    'barbell-2day-base',
    'Barbell 2-Day Full Body Base',
    '週2回のバーベル全身プログラム。スクワット・デッドリフト・ベンチプレス・オーバーヘッドプレス・バーベルロウの5種目で全身を効率よく鍛えます。ジムに週2回しか来られない初心者・再開者に最適です。',
    4,
    2,
    'beginner',
    true,
    null,
    'custom',
    'Internal beginner barbell 2-day full-body template. No single published source program is being represented.'
  )
  returning id into prog_id;

  -- ── program_weeks ──────────────────────────────────────────────────────────
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

  -- ── program_days ───────────────────────────────────────────────────────────
  -- Same Day 1 / Day 2 structure repeated every week (no A/B rotation).
  insert into public.program_days (program_week_id, day_number, progression_guide, notes)
  values
    (w1, 1, guide_d1, 'Day 1: スクワット 4x5 / ベンチプレス 3x8 / バーベルロウ 3x8'),
    (w1, 2, guide_d2, 'Day 2: デッドリフト 1x5 / オーバーヘッドプレス 3x8 / バーベルロウ 3x8'),
    (w2, 1, guide_d1, 'Day 1: スクワット 4x5 / ベンチプレス 3x8 / バーベルロウ 3x8'),
    (w2, 2, guide_d2, 'Day 2: デッドリフト 1x5 / オーバーヘッドプレス 3x8 / バーベルロウ 3x8'),
    (w3, 1, guide_d1, 'Day 1: スクワット 4x5 / ベンチプレス 3x8 / バーベルロウ 3x8'),
    (w3, 2, guide_d2, 'Day 2: デッドリフト 1x5 / オーバーヘッドプレス 3x8 / バーベルロウ 3x8'),
    (w4, 1, guide_d1, 'Day 1: スクワット 4x5 / ベンチプレス 3x8 / バーベルロウ 3x8'),
    (w4, 2, guide_d2, 'Day 2: デッドリフト 1x5 / オーバーヘッドプレス 3x8 / バーベルロウ 3x8');

  select id into w1d1 from public.program_days where program_week_id = w1 and day_number = 1;
  select id into w1d2 from public.program_days where program_week_id = w1 and day_number = 2;
  select id into w2d1 from public.program_days where program_week_id = w2 and day_number = 1;
  select id into w2d2 from public.program_days where program_week_id = w2 and day_number = 2;
  select id into w3d1 from public.program_days where program_week_id = w3 and day_number = 1;
  select id into w3d2 from public.program_days where program_week_id = w3 and day_number = 2;
  select id into w4d1 from public.program_days where program_week_id = w4 and day_number = 1;
  select id into w4d2 from public.program_days where program_week_id = w4 and day_number = 2;

  -- ── program_day_exercises ──────────────────────────────────────────────────
  -- Day 1: Squat T1 4x5 / Bench T2 3x8 / Row T2 3x8
  insert into public.program_day_exercises
    (program_day_id, exercise_id, exercise_type, set_count, target_reps_text, order_index)
  values
    (w1d1, ex_squat, 'T1', 4, '5', 1),
    (w1d1, ex_bench, 'T2', 3, '8', 2),
    (w1d1, ex_row,   'T2', 3, '8', 3),
    (w2d1, ex_squat, 'T1', 4, '5', 1),
    (w2d1, ex_bench, 'T2', 3, '8', 2),
    (w2d1, ex_row,   'T2', 3, '8', 3),
    (w3d1, ex_squat, 'T1', 4, '5', 1),
    (w3d1, ex_bench, 'T2', 3, '8', 2),
    (w3d1, ex_row,   'T2', 3, '8', 3),
    (w4d1, ex_squat, 'T1', 4, '5', 1),
    (w4d1, ex_bench, 'T2', 3, '8', 2),
    (w4d1, ex_row,   'T2', 3, '8', 3);

  -- Day 2: Deadlift T1 1x5 / OHP T2 3x8 / Row T2 3x8
  insert into public.program_day_exercises
    (program_day_id, exercise_id, exercise_type, set_count, target_reps_text, order_index)
  values
    (w1d2, ex_deadlift, 'T1', 1, '5', 1),
    (w1d2, ex_ohp,      'T2', 3, '8', 2),
    (w1d2, ex_row,      'T2', 3, '8', 3),
    (w2d2, ex_deadlift, 'T1', 1, '5', 1),
    (w2d2, ex_ohp,      'T2', 3, '8', 2),
    (w2d2, ex_row,      'T2', 3, '8', 3),
    (w3d2, ex_deadlift, 'T1', 1, '5', 1),
    (w3d2, ex_ohp,      'T2', 3, '8', 2),
    (w3d2, ex_row,      'T2', 3, '8', 3),
    (w4d2, ex_deadlift, 'T1', 1, '5', 1),
    (w4d2, ex_ohp,      'T2', 3, '8', 2),
    (w4d2, ex_row,      'T2', 3, '8', 3);

  -- ── Tag assignments (inline, gracefully skipped if tags not yet created) ───
  -- Required: run program-metadata.sql first so that strength/barbell/full-body tags exist.
  select id into tag_strength  from public.program_tags where slug = 'strength';
  select id into tag_barbell   from public.program_tags where slug = 'barbell';
  select id into tag_full_body from public.program_tags where slug = 'full-body';

  if tag_strength is null or tag_barbell is null or tag_full_body is null then
    raise notice 'One or more tags not found — tag assignments skipped for barbell-2day-base. Run program-metadata.sql first, then re-run this file.';
  else
    delete from public.program_tag_assignments where program_id = prog_id;
    insert into public.program_tag_assignments (program_id, tag_id, axis)
    values
      (prog_id, tag_strength,  'goal'),
      (prog_id, tag_barbell,   'equipment'),
      (prog_id, tag_full_body, 'split');
    raise notice 'Tag assignments applied for barbell-2day-base.';
  end if;

  raise notice 'Seed complete: barbell-2day-base  program_id = %  (4 weeks x 2 days = 8 sessions)', prog_id;
end;
$$;

-- Confirmation query (uncomment to verify after running)
-- select
--   p.slug,
--   pw.week_number,
--   pd.day_number,
--   pd.notes,
--   pde.order_index,
--   e.slug  as exercise_slug,
--   e.name_en,
--   pde.exercise_type,
--   pde.set_count,
--   pde.target_reps_text
-- from public.programs p
-- join public.program_weeks pw          on pw.program_id   = p.id
-- join public.program_days pd           on pd.program_week_id = pw.id
-- join public.program_day_exercises pde on pde.program_day_id = pd.id
-- join public.exercises e               on e.id = pde.exercise_id
-- where p.slug = 'barbell-2day-base'
-- order by pw.week_number, pd.day_number, pde.order_index;
