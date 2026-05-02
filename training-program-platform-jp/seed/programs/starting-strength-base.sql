-- Seed: Starting Strength Phase 2 Base Program
-- Run in Supabase Dashboard > SQL Editor
--
-- Source reference:
--   Starting Strength Novice Program - Phase 2
--
-- This seed keeps the current route slug (`starting-strength-base`) for
-- compatibility, but the title explicitly states that this is a Phase 2
-- snapshot of the novice program.
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
-- Note:
--   Starting Strength alternates bench and press across the week. This seed
--   fixes Bench on A and Press on B to make the seed deterministic while
--   preserving the official Phase 2 A/B structure.

do $$
declare
  ex_squat uuid;
  ex_bench uuid;
  ex_press uuid;
  ex_deadlift uuid;
  ex_power_clean uuid;

  prog_id uuid;

  w1 uuid; w2 uuid; w3 uuid;

  w1d1 uuid; w1d2 uuid; w1d3 uuid;
  w2d1 uuid; w2d2 uuid; w2d3 uuid;
  w3d1 uuid; w3d2 uuid; w3d3 uuid;
begin
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

  if exists (select 1 from public.programs where slug = 'starting-strength-base') then
    raise notice 'starting-strength-base already exists, skipping.';
    return;
  end if;

  insert into public.programs
    (slug, title, description, duration_weeks, days_per_week, level, is_public)
  values
    (
      'starting-strength-base',
      'Starting Strength Phase 2 Base',
      'Official Starting Strength novice Phase 2 snapshot: squat every session, bench and press alternate across A/B days, deadlift on A days, and power clean on B days.',
      3,
      3,
      'beginner',
      true
    )
  returning id into prog_id;

  insert into public.program_weeks (program_id, week_number, label)
  values
    (prog_id, 1, 'Week 1'),
    (prog_id, 2, 'Week 2'),
    (prog_id, 3, 'Week 3');

  select id into w1 from public.program_weeks where program_id = prog_id and week_number = 1;
  select id into w2 from public.program_weeks where program_id = prog_id and week_number = 2;
  select id into w3 from public.program_weeks where program_id = prog_id and week_number = 3;

  insert into public.program_days (program_week_id, day_number, progression_guide, notes)
  values
    (w1, 1, 'Day A — 各セッションでフォームを保てる範囲で重量を増やすことを目標にします。スクワットとベンチプレスは2.5kg、デッドリフトは5kg刻みで増やします。回数が安定して達成できているうちは毎回重量を上げ続けます。', 'Day A: スクワット 3×5、ベンチプレス 3×5、デッドリフト 1×5'),
    (w1, 2, 'Day B — スクワットは毎回行い、オーバーヘッドプレスも正しいフォームを保ちながら少しずつ重量を増やします。パワークリーンはバーのスピードとフォームが維持できている間だけ重量を増やします。', 'Day B: スクワット 3×5、オーバーヘッドプレス 3×5、パワークリーン 5×3'),
    (w1, 3, 'Day A（繰り返し）— スクワット・ベンチプレス・デッドリフトの3種目を引き続き行います。A/Bを交互に繰り返すことで、ベンチプレスとオーバーヘッドプレスが均等に強化されます。', 'Day A: スクワット 3×5、ベンチプレス 3×5、デッドリフト 1×5'),
    (w2, 1, 'Day B（繰り返し）— スクワットは毎回行い、上半身のプレス種目をベンチとオーバーヘッドで交互に担当します。無理なく記録を伸ばしていきましょう。', 'Day B: スクワット 3×5、オーバーヘッドプレス 3×5、パワークリーン 5×3'),
    (w2, 2, 'Day A（繰り返し）— ベンチプレスの重量増加幅が大きく感じたら、プレートを細かく分けてマイクロロードを使うことも選択肢のひとつです。', 'Day A: スクワット 3×5、ベンチプレス 3×5、デッドリフト 1×5'),
    (w2, 3, 'Day B（繰り返し）— スクワットは引き続き毎回行います。フェーズ2ではパワークリーンをデッドリフトの代わりに使い、全身の連動性を高めます。', 'Day B: スクワット 3×5、オーバーヘッドプレス 3×5、パワークリーン 5×3'),
    (w3, 1, 'Day A（繰り返し）— 回復ができている間は毎回重量を増やし続けます。フォームが崩れてきたら重量を少し落として立て直しましょう。', 'Day A: スクワット 3×5、ベンチプレス 3×5、デッドリフト 1×5'),
    (w3, 2, 'Day B（繰り返し）— プレスやパワークリーンの伸びが鈍くなってきたら、増加幅を小さくして継続します。焦らず積み上げることが大切です。', 'Day B: スクワット 3×5、オーバーヘッドプレス 3×5、パワークリーン 5×3'),
    (w3, 3, 'Day A（繰り返し）— この3週間のプログラムは線形漸進フェーズの基礎スナップショットです。ここで培った土台をもとに次のフェーズへと進みます。', 'Day A: スクワット 3×5、ベンチプレス 3×5、デッドリフト 1×5');

  select id into w1d1 from public.program_days where program_week_id = w1 and day_number = 1;
  select id into w1d2 from public.program_days where program_week_id = w1 and day_number = 2;
  select id into w1d3 from public.program_days where program_week_id = w1 and day_number = 3;
  select id into w2d1 from public.program_days where program_week_id = w2 and day_number = 1;
  select id into w2d2 from public.program_days where program_week_id = w2 and day_number = 2;
  select id into w2d3 from public.program_days where program_week_id = w2 and day_number = 3;
  select id into w3d1 from public.program_days where program_week_id = w3 and day_number = 1;
  select id into w3d2 from public.program_days where program_week_id = w3 and day_number = 2;
  select id into w3d3 from public.program_days where program_week_id = w3 and day_number = 3;

  insert into public.program_day_exercises
    (program_day_id, exercise_id, exercise_type, set_count, target_reps_text, order_index)
  values
    (w1d1, ex_squat, 'T1', 3, '5', 1),
    (w1d1, ex_bench, 'T1', 3, '5', 2),
    (w1d1, ex_deadlift, 'T2', 1, '5', 3),
    (w1d2, ex_squat, 'T1', 3, '5', 1),
    (w1d2, ex_press, 'T1', 3, '5', 2),
    (w1d2, ex_power_clean, 'T2', 5, '3', 3),
    (w1d3, ex_squat, 'T1', 3, '5', 1),
    (w1d3, ex_bench, 'T1', 3, '5', 2),
    (w1d3, ex_deadlift, 'T2', 1, '5', 3),
    (w2d1, ex_squat, 'T1', 3, '5', 1),
    (w2d1, ex_press, 'T1', 3, '5', 2),
    (w2d1, ex_power_clean, 'T2', 5, '3', 3),
    (w2d2, ex_squat, 'T1', 3, '5', 1),
    (w2d2, ex_bench, 'T1', 3, '5', 2),
    (w2d2, ex_deadlift, 'T2', 1, '5', 3),
    (w2d3, ex_squat, 'T1', 3, '5', 1),
    (w2d3, ex_press, 'T1', 3, '5', 2),
    (w2d3, ex_power_clean, 'T2', 5, '3', 3),
    (w3d1, ex_squat, 'T1', 3, '5', 1),
    (w3d1, ex_bench, 'T1', 3, '5', 2),
    (w3d1, ex_deadlift, 'T2', 1, '5', 3),
    (w3d2, ex_squat, 'T1', 3, '5', 1),
    (w3d2, ex_press, 'T1', 3, '5', 2),
    (w3d2, ex_power_clean, 'T2', 5, '3', 3),
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
