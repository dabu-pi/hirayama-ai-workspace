-- Seed: gzclp-base-v2-4day Swap Groups
--
-- Run AFTER:
--   1. gzclp-base-v2.sql            (exercises: squat / bench / ohp / deadlift / lat-pulldown /
--                                               dumbbell-row / leg-press / chest-press /
--                                               lateral-raise / hip-thrust / hack-squat /
--                                               good-morning / rear-delt-fly)
--   2. gzclp-base-v2-4day.sql       (exercises: dumbbell-press; program structure)
--   3. gzclp-base-v2-swap-groups.sql (exercises: bulgarian-split-squat / dips / leg-curl)
--   4. migration 20260418_000011_exercise_swap_groups.sql
--   5. migration 20260418_000012_swap_group_slug_columns.sql
--
-- What this does:
--   - Upserts 1 new exercise: upright-row (アップライトロウ)
--   - Creates 4 new swap groups specific to gzclp-base-v2-4day:
--       gzcl4-squat-t3    / gzcl4-bench-t3 / gzcl4-ohp-t3 / gzcl4-deadlift-t3
--   - Populates each group with exactly 3 candidates per user spec
--   - Assigns swap_group_slug to gzclp-base-v2-4day order_index 4 and 5
--
-- T3 candidate mapping:
--   gzcl4-squat-t3    → Leg Press / Bulgarian Split Squat / Hack Squat
--   gzcl4-bench-t3    → Chest Press / Dumbbell Press / Dips
--   gzcl4-ohp-t3      → Lateral Raise / Rear Delt Fly / Upright Row
--   gzcl4-deadlift-t3 → Hip Thrust / Good Morning / Leg Curl
--
-- Swap assignment:
--   A1 pos4 (T1=Squat support)    → gzcl4-squat-t3    default: leg-press
--   A1 pos5 (T2=Bench support)    → gzcl4-bench-t3    default: chest-press
--   B1 pos4 (T1=OHP support)      → gzcl4-ohp-t3      default: lateral-raise
--   B1 pos5 (T2=Deadlift support) → gzcl4-deadlift-t3 default: hip-thrust
--   A2 pos4 (T1=Bench support)    → gzcl4-bench-t3    default: dumbbell-press
--   A2 pos5 (T2=Squat support)    → gzcl4-squat-t3    default: hack-squat
--   B2 pos4 (T1=Deadlift support) → gzcl4-deadlift-t3 default: good-morning
--   B2 pos5 (T2=OHP support)      → gzcl4-ohp-t3      default: rear-delt-fly
--
-- Safe to re-run: all inserts use on conflict do nothing / do update.

do $$
declare
  -- New exercise
  ex_upright_row      uuid;

  -- Already-seeded exercises (from earlier seeds)
  ex_leg_press        uuid;
  ex_bulgarian_split  uuid;
  ex_hack_squat       uuid;
  ex_chest_press      uuid;
  ex_dumbbell_press   uuid;
  ex_dips             uuid;
  ex_lateral_raise    uuid;
  ex_rear_delt_fly    uuid;
  ex_hip_thrust       uuid;
  ex_good_morning     uuid;
  ex_leg_curl         uuid;

  prog_id uuid;

begin
  -- ── 1. Upsert new exercise ──────────────────────────────────────────────────

  insert into public.exercises (slug, name_ja, name_en, category)
  values
    ('upright-row', U&'\30A2\30C3\30D7\30E9\30A4\30C8\30ED\30A6', 'Upright Row', 'shoulders')
  on conflict (slug) do nothing;

  -- ── 2. Resolve all exercise UUIDs ──────────────────────────────────────────

  select id into ex_upright_row    from public.exercises where slug = 'upright-row';
  select id into ex_leg_press      from public.exercises where slug = 'leg-press';
  select id into ex_bulgarian_split from public.exercises where slug = 'bulgarian-split-squat';
  select id into ex_hack_squat     from public.exercises where slug = 'hack-squat';
  select id into ex_chest_press    from public.exercises where slug = 'chest-press';
  select id into ex_dumbbell_press from public.exercises where slug = 'dumbbell-press';
  select id into ex_dips           from public.exercises where slug = 'dips';
  select id into ex_lateral_raise  from public.exercises where slug = 'lateral-raise';
  select id into ex_rear_delt_fly  from public.exercises where slug = 'rear-delt-fly';
  select id into ex_hip_thrust     from public.exercises where slug = 'hip-thrust';
  select id into ex_good_morning   from public.exercises where slug = 'good-morning';
  select id into ex_leg_curl       from public.exercises where slug = 'leg-curl';

  if ex_upright_row    is null then raise exception 'Exercise not found: upright-row'; end if;
  if ex_leg_press      is null then raise exception 'Exercise not found: leg-press'; end if;
  if ex_bulgarian_split is null then raise exception 'Exercise not found: bulgarian-split-squat'; end if;
  if ex_hack_squat     is null then raise exception 'Exercise not found: hack-squat'; end if;
  if ex_chest_press    is null then raise exception 'Exercise not found: chest-press'; end if;
  if ex_dumbbell_press is null then raise exception 'Exercise not found: dumbbell-press'; end if;
  if ex_dips           is null then raise exception 'Exercise not found: dips'; end if;
  if ex_lateral_raise  is null then raise exception 'Exercise not found: lateral-raise'; end if;
  if ex_rear_delt_fly  is null then raise exception 'Exercise not found: rear-delt-fly'; end if;
  if ex_hip_thrust     is null then raise exception 'Exercise not found: hip-thrust'; end if;
  if ex_good_morning   is null then raise exception 'Exercise not found: good-morning'; end if;
  if ex_leg_curl       is null then raise exception 'Exercise not found: leg-curl'; end if;

  -- ── 3. Upsert swap groups (4-day specific) ─────────────────────────────────

  insert into public.exercise_swap_groups (slug, label)
  values
    ('gzcl4-squat-t3',    'スクワット系T3候補'),
    ('gzcl4-bench-t3',    'ベンチプレス系T3候補'),
    ('gzcl4-ohp-t3',      'OHP系T3候補'),
    ('gzcl4-deadlift-t3', 'デッドリフト系T3候補')
  on conflict (slug) do update
    set label = excluded.label;

  -- ── 4. Populate group members (3 per group) ────────────────────────────────

  -- gzcl4-squat-t3: Leg Press / Bulgarian Split Squat / Hack Squat
  insert into public.exercise_swap_group_members (group_slug, exercise_id)
  values
    ('gzcl4-squat-t3', ex_leg_press),
    ('gzcl4-squat-t3', ex_bulgarian_split),
    ('gzcl4-squat-t3', ex_hack_squat)
  on conflict do nothing;

  -- gzcl4-bench-t3: Chest Press / Dumbbell Press / Dips
  insert into public.exercise_swap_group_members (group_slug, exercise_id)
  values
    ('gzcl4-bench-t3', ex_chest_press),
    ('gzcl4-bench-t3', ex_dumbbell_press),
    ('gzcl4-bench-t3', ex_dips)
  on conflict do nothing;

  -- gzcl4-ohp-t3: Lateral Raise / Rear Delt Fly / Upright Row
  insert into public.exercise_swap_group_members (group_slug, exercise_id)
  values
    ('gzcl4-ohp-t3', ex_lateral_raise),
    ('gzcl4-ohp-t3', ex_rear_delt_fly),
    ('gzcl4-ohp-t3', ex_upright_row)
  on conflict do nothing;

  -- gzcl4-deadlift-t3: Hip Thrust / Good Morning / Leg Curl
  insert into public.exercise_swap_group_members (group_slug, exercise_id)
  values
    ('gzcl4-deadlift-t3', ex_hip_thrust),
    ('gzcl4-deadlift-t3', ex_good_morning),
    ('gzcl4-deadlift-t3', ex_leg_curl)
  on conflict do nothing;

  -- ── 5. Assign swap_group_slug to gzclp-base-v2-4day ───────────────────────

  select id into prog_id from public.programs where slug = 'gzclp-base-v2-4day';

  if prog_id is null then
    raise notice 'gzclp-base-v2-4day not found — swap_group_slug assignment skipped. Run gzclp-base-v2-4day.sql first.';
    return;
  end if;

  -- A1 days (T1=Squat): pos4=gzcl4-squat-t3, pos5=gzcl4-bench-t3
  update public.program_day_exercises pde
  set swap_group_slug = case
    when pde.order_index = 4 then 'gzcl4-squat-t3'
    when pde.order_index = 5 then 'gzcl4-bench-t3'
  end
  where pde.order_index in (4, 5)
    and pde.program_day_id in (
      select pde2.program_day_id
      from public.program_day_exercises pde2
      join public.program_days pd on pd.id = pde2.program_day_id
      join public.program_weeks pw on pw.id = pd.program_week_id
      where pw.program_id = prog_id
        and pde2.order_index = 1
        and pde2.exercise_id = (select id from public.exercises where slug = 'squat')
        and pde2.exercise_type = 'T1'
    );

  -- B1 days (T1=OHP): pos4=gzcl4-ohp-t3, pos5=gzcl4-deadlift-t3
  update public.program_day_exercises pde
  set swap_group_slug = case
    when pde.order_index = 4 then 'gzcl4-ohp-t3'
    when pde.order_index = 5 then 'gzcl4-deadlift-t3'
  end
  where pde.order_index in (4, 5)
    and pde.program_day_id in (
      select pde2.program_day_id
      from public.program_day_exercises pde2
      join public.program_days pd on pd.id = pde2.program_day_id
      join public.program_weeks pw on pw.id = pd.program_week_id
      where pw.program_id = prog_id
        and pde2.order_index = 1
        and pde2.exercise_id = (select id from public.exercises where slug = 'overhead-press')
        and pde2.exercise_type = 'T1'
    );

  -- A2 days (T1=Bench): pos4=gzcl4-bench-t3, pos5=gzcl4-squat-t3
  update public.program_day_exercises pde
  set swap_group_slug = case
    when pde.order_index = 4 then 'gzcl4-bench-t3'
    when pde.order_index = 5 then 'gzcl4-squat-t3'
  end
  where pde.order_index in (4, 5)
    and pde.program_day_id in (
      select pde2.program_day_id
      from public.program_day_exercises pde2
      join public.program_days pd on pd.id = pde2.program_day_id
      join public.program_weeks pw on pw.id = pd.program_week_id
      where pw.program_id = prog_id
        and pde2.order_index = 1
        and pde2.exercise_id = (select id from public.exercises where slug = 'bench-press')
        and pde2.exercise_type = 'T1'
    );

  -- B2 days (T1=Deadlift): pos4=gzcl4-deadlift-t3, pos5=gzcl4-ohp-t3
  update public.program_day_exercises pde
  set swap_group_slug = case
    when pde.order_index = 4 then 'gzcl4-deadlift-t3'
    when pde.order_index = 5 then 'gzcl4-ohp-t3'
  end
  where pde.order_index in (4, 5)
    and pde.program_day_id in (
      select pde2.program_day_id
      from public.program_day_exercises pde2
      join public.program_days pd on pd.id = pde2.program_day_id
      join public.program_weeks pw on pw.id = pd.program_week_id
      where pw.program_id = prog_id
        and pde2.order_index = 1
        and pde2.exercise_id = (select id from public.exercises where slug = 'deadlift')
        and pde2.exercise_type = 'T1'
    );

  raise notice 'gzclp-base-v2-4day swap groups seeded successfully.';
end;
$$;

-- Verification query — run after the seed to confirm assignments.
-- Expected: 32 rows (16 days × order_index 4 and 5), each with non-null swap_group_slug.
--
-- select
--   pw.week_number,
--   pd.day_number,
--   pde.order_index,
--   e.name_en            as current_exercise,
--   pde.swap_group_slug
-- from public.program_day_exercises pde
-- join public.program_days pd    on pd.id = pde.program_day_id
-- join public.program_weeks pw   on pw.id = pd.program_week_id
-- join public.programs p         on p.id  = pw.program_id
-- join public.exercises e        on e.id  = pde.exercise_id
-- where p.slug = 'gzclp-base-v2-4day'
--   and pde.order_index in (4, 5)
-- order by pw.week_number, pd.day_number, pde.order_index;
