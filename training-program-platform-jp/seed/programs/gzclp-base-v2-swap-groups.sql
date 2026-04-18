-- Seed: gzclp-base-v2 Swap Groups
--
-- Run AFTER:
--   1. gzclp-base-v2.sql  (exercises + program structure)
--   2. 20260418_000011_exercise_swap_groups.sql
--   3. 20260418_000012_swap_group_slug_columns.sql
--
-- What this does:
--   - Upserts 8 new pool-only exercises (never appear in fixed program structure)
--   - Creates 4 swap groups: squat-aux / bench-aux / deadlift-aux / ohp-aux
--   - Populates group members (pool candidates + current gzclp-base-v2 defaults)
--   - Assigns swap_group_slug to gzclp-base-v2 program_day_exercises at order_index 4 and 5
--
-- Safe to re-run: all inserts use on conflict do nothing / do update.

do $$
declare
  -- Pool-only new exercises
  ex_chest_press        uuid;
  ex_dips               uuid;
  ex_leg_press          uuid;
  ex_hack_squat         uuid;
  ex_bulgarian_split    uuid;
  ex_good_morning       uuid;
  ex_hip_thrust         uuid;
  ex_rear_delt_fly      uuid;

  -- Already-seeded exercises (gzclp-base-v2 defaults + dumbbell-full-body-base)
  ex_leg_curl           uuid;
  ex_triceps_pushdown   uuid;
  ex_lateral_raise      uuid;
  ex_back_extension     uuid;
  ex_incline_db_press   uuid;
  ex_leg_extension      uuid;
  ex_romanian_deadlift  uuid;
  ex_db_bench_press     uuid;  -- slug: db-bench-press (Dumbbell Bench Press)
  ex_db_shoulder_press  uuid;  -- slug: db-shoulder-press (Dumbbell Shoulder Press)

  prog_id uuid;

begin
  -- ── 1. Upsert pool-only exercises ──────────────────────────────────────────

  insert into public.exercises (slug, name_ja, name_en, category)
  values
    ('chest-press',        U&'\30C1\30A7\30B9\30C8\30D7\30EC\30B9',                                         'Chest Press',                 'chest'),
    ('dips',               U&'\30C7\30A3\30C3\30D7\30B9',                                                    'Dips',                        'chest'),
    ('leg-press',          U&'\30EC\30C3\30B0\30D7\30EC\30B9',                                               'Leg Press',                   'legs'),
    ('hack-squat',         U&'\30CF\30C3\30AF\30B9\30AF\30EF\30C3\30C8',                                     'Hack Squat',                  'legs'),
    ('bulgarian-split-squat', U&'\30D6\30EB\30AC\30EA\30A2\30F3\30B9\30D7\30EA\30C3\30C8\30B9\30AF\30EF\30C3\30C8', 'Bulgarian Split Squat',  'legs'),
    ('good-morning',       U&'\30B0\30C3\30C9\30E2\30FC\30CB\30F3\30B0',                                     'Good Morning',                'back'),
    ('hip-thrust',         U&'\30D2\30C3\30D7\30B9\30E9\30B9\30C8',                                         'Hip Thrust',                  'legs'),
    ('rear-delt-fly',      U&'\30EA\30A2\30C7\30EB\30C8\30D5\30E9\30A4',                                     'Rear Delt Fly',               'shoulders')
  on conflict (slug) do nothing;

  -- ── 2. Resolve all exercise UUIDs ──────────────────────────────────────────

  -- Pool-only (just inserted above)
  select id into ex_chest_press       from public.exercises where slug = 'chest-press';
  select id into ex_dips              from public.exercises where slug = 'dips';
  select id into ex_leg_press         from public.exercises where slug = 'leg-press';
  select id into ex_hack_squat        from public.exercises where slug = 'hack-squat';
  select id into ex_bulgarian_split   from public.exercises where slug = 'bulgarian-split-squat';
  select id into ex_good_morning      from public.exercises where slug = 'good-morning';
  select id into ex_hip_thrust        from public.exercises where slug = 'hip-thrust';
  select id into ex_rear_delt_fly     from public.exercises where slug = 'rear-delt-fly';

  -- Already-seeded
  select id into ex_leg_curl          from public.exercises where slug = 'leg-curl';
  select id into ex_triceps_pushdown  from public.exercises where slug = 'triceps-pushdown';
  select id into ex_lateral_raise     from public.exercises where slug = 'lateral-raise';
  select id into ex_back_extension    from public.exercises where slug = 'back-extension';
  select id into ex_incline_db_press  from public.exercises where slug = 'incline-dumbbell-press';
  select id into ex_leg_extension     from public.exercises where slug = 'leg-extension';
  select id into ex_romanian_deadlift from public.exercises where slug = 'romanian-deadlift';
  select id into ex_db_bench_press    from public.exercises where slug = 'db-bench-press';
  select id into ex_db_shoulder_press from public.exercises where slug = 'db-shoulder-press';

  if ex_chest_press      is null then raise exception 'Exercise not found: chest-press'; end if;
  if ex_dips             is null then raise exception 'Exercise not found: dips'; end if;
  if ex_leg_press        is null then raise exception 'Exercise not found: leg-press'; end if;
  if ex_hack_squat       is null then raise exception 'Exercise not found: hack-squat'; end if;
  if ex_bulgarian_split  is null then raise exception 'Exercise not found: bulgarian-split-squat'; end if;
  if ex_good_morning     is null then raise exception 'Exercise not found: good-morning'; end if;
  if ex_hip_thrust       is null then raise exception 'Exercise not found: hip-thrust'; end if;
  if ex_rear_delt_fly    is null then raise exception 'Exercise not found: rear-delt-fly'; end if;
  if ex_leg_curl         is null then raise exception 'Exercise not found: leg-curl'; end if;
  if ex_triceps_pushdown is null then raise exception 'Exercise not found: triceps-pushdown'; end if;
  if ex_lateral_raise    is null then raise exception 'Exercise not found: lateral-raise'; end if;
  if ex_back_extension   is null then raise exception 'Exercise not found: back-extension'; end if;
  if ex_incline_db_press is null then raise exception 'Exercise not found: incline-dumbbell-press'; end if;
  if ex_leg_extension    is null then raise exception 'Exercise not found: leg-extension'; end if;
  if ex_romanian_deadlift is null then raise exception 'Exercise not found: romanian-deadlift'; end if;
  -- db-bench-press and db-shoulder-press are soft (optional — from dumbbell-full-body-base)

  -- ── 3. Upsert swap groups ────────────────────────────────────────────────

  insert into public.exercise_swap_groups (slug, label)
  values
    ('squat-aux',    'Squat Assistance'),
    ('bench-aux',    'Bench Press Assistance'),
    ('deadlift-aux', 'Deadlift Assistance'),
    ('ohp-aux',      'Overhead Press Assistance')
  on conflict (slug) do update
    set label = excluded.label;

  -- ── 4. Populate group members ────────────────────────────────────────────
  -- Includes both the spec candidates AND the current gzclp-base-v2 defaults
  -- so users can always swap back to the original.

  -- squat-aux: Leg Press / Hack Squat / Bulgarian Split Squat / Leg Extension (current A2 T2-sup default)
  insert into public.exercise_swap_group_members (group_slug, exercise_id)
  values
    ('squat-aux', ex_leg_press),
    ('squat-aux', ex_hack_squat),
    ('squat-aux', ex_bulgarian_split),
    ('squat-aux', ex_leg_extension)
  on conflict do nothing;

  -- bench-aux: Chest Press / DB Bench Press / Dips / Triceps Pushdown (A1 T2-sup) / Incline DB Press (A2 T1-sup)
  insert into public.exercise_swap_group_members (group_slug, exercise_id)
  values
    ('bench-aux', ex_chest_press),
    ('bench-aux', ex_dips),
    ('bench-aux', ex_triceps_pushdown),
    ('bench-aux', ex_incline_db_press)
  on conflict do nothing;

  -- db-bench-press is optional (from dumbbell-full-body-base seed — soft insert)
  if ex_db_bench_press is not null then
    insert into public.exercise_swap_group_members (group_slug, exercise_id)
    values ('bench-aux', ex_db_bench_press)
    on conflict do nothing;
  end if;

  -- deadlift-aux: Leg Curl (A1 T1-sup) / Good Morning / Hip Thrust / Back Extension (B1 T2-sup) / Romanian Deadlift (B2 T1-sup)
  insert into public.exercise_swap_group_members (group_slug, exercise_id)
  values
    ('deadlift-aux', ex_leg_curl),
    ('deadlift-aux', ex_good_morning),
    ('deadlift-aux', ex_hip_thrust),
    ('deadlift-aux', ex_back_extension),
    ('deadlift-aux', ex_romanian_deadlift)
  on conflict do nothing;

  -- ohp-aux: Lateral Raise (B1 T1-sup + B2 T2-sup) / Rear Delt Fly
  insert into public.exercise_swap_group_members (group_slug, exercise_id)
  values
    ('ohp-aux', ex_lateral_raise),
    ('ohp-aux', ex_rear_delt_fly)
  on conflict do nothing;

  -- db-shoulder-press is optional (from dumbbell-full-body-base seed — soft insert)
  if ex_db_shoulder_press is not null then
    insert into public.exercise_swap_group_members (group_slug, exercise_id)
    values ('ohp-aux', ex_db_shoulder_press)
    on conflict do nothing;
  end if;

  -- ── 5. Assign swap_group_slug to gzclp-base-v2 program_day_exercises ─────
  --
  -- Rotation mapping:
  --   A1 (order 4: T1-sup for Squat)   → deadlift-aux   (default: leg-curl)
  --   A1 (order 5: T2-sup for Bench)   → bench-aux      (default: triceps-pushdown)
  --   B1 (order 4: T1-sup for OHP)     → ohp-aux        (default: lateral-raise)
  --   B1 (order 5: T2-sup for DL)      → deadlift-aux   (default: back-extension)
  --   A2 (order 4: T1-sup for Bench)   → bench-aux      (default: incline-dumbbell-press)
  --   A2 (order 5: T2-sup for Squat)   → squat-aux      (default: leg-extension)
  --   B2 (order 4: T1-sup for DL)      → deadlift-aux   (default: romanian-deadlift)
  --   B2 (order 5: T2-sup for OHP)     → ohp-aux        (default: lateral-raise)

  select id into prog_id from public.programs where slug = 'gzclp-base-v2';

  if prog_id is null then
    raise notice 'gzclp-base-v2 not found — swap_group_slug assignment skipped. Run gzclp-base-v2.sql first.';
    return;
  end if;

  -- A1 days: Squat T1 / Bench T2 → order 4 = deadlift-aux, order 5 = bench-aux
  update public.program_day_exercises pde
  set swap_group_slug = 'deadlift-aux'
  where pde.order_index = 4
    and pde.program_day_id in (
      select pd.id from public.program_days pd
      join public.program_weeks pw on pw.id = pd.program_week_id
      where pw.program_id = prog_id
        and pd.day_number = 1            -- A1 = week day 1
        and pw.week_number in (1, 3)     -- A1 appears in weeks 1 and 3 (days 1)
        -- A1: week1/day1 and week3/day1 (A1 = day1 of weeks where rotation = A1)
    );

  -- The rotation for gzclp-base-v2 follows: W1D1=A1, W1D2=B1, W1D3=A2, W2D1=B2, W2D2=A1, W2D3=B1, ...
  -- Easier to identify by exercise pattern: A1 days have squat at order_index=1
  -- Use exercise_id-based identification for safety

  update public.program_day_exercises pde
  set swap_group_slug = case
    when pde.order_index = 4 then 'deadlift-aux'
    when pde.order_index = 5 then 'bench-aux'
  end
  where pde.order_index in (4, 5)
    and pde.program_day_id in (
      -- A1 days: Squat is T1 (order_index=1)
      select pde2.program_day_id
      from public.program_day_exercises pde2
      join public.program_days pd on pd.id = pde2.program_day_id
      join public.program_weeks pw on pw.id = pd.program_week_id
      where pw.program_id = prog_id
        and pde2.order_index = 1
        and pde2.exercise_id = (select id from public.exercises where slug = 'squat')
        and pde2.exercise_type = 'T1'
    );

  update public.program_day_exercises pde
  set swap_group_slug = case
    when pde.order_index = 4 then 'ohp-aux'
    when pde.order_index = 5 then 'deadlift-aux'
  end
  where pde.order_index in (4, 5)
    and pde.program_day_id in (
      -- B1 days: OHP is T1 (order_index=1)
      select pde2.program_day_id
      from public.program_day_exercises pde2
      join public.program_days pd on pd.id = pde2.program_day_id
      join public.program_weeks pw on pw.id = pd.program_week_id
      where pw.program_id = prog_id
        and pde2.order_index = 1
        and pde2.exercise_id = (select id from public.exercises where slug = 'overhead-press')
        and pde2.exercise_type = 'T1'
    );

  update public.program_day_exercises pde
  set swap_group_slug = case
    when pde.order_index = 4 then 'bench-aux'
    when pde.order_index = 5 then 'squat-aux'
  end
  where pde.order_index in (4, 5)
    and pde.program_day_id in (
      -- A2 days: Bench is T1 (order_index=1)
      select pde2.program_day_id
      from public.program_day_exercises pde2
      join public.program_days pd on pd.id = pde2.program_day_id
      join public.program_weeks pw on pw.id = pd.program_week_id
      where pw.program_id = prog_id
        and pde2.order_index = 1
        and pde2.exercise_id = (select id from public.exercises where slug = 'bench-press')
        and pde2.exercise_type = 'T1'
    );

  update public.program_day_exercises pde
  set swap_group_slug = case
    when pde.order_index = 4 then 'deadlift-aux'
    when pde.order_index = 5 then 'ohp-aux'
  end
  where pde.order_index in (4, 5)
    and pde.program_day_id in (
      -- B2 days: Deadlift is T1 (order_index=1)
      select pde2.program_day_id
      from public.program_day_exercises pde2
      join public.program_days pd on pd.id = pde2.program_day_id
      join public.program_weeks pw on pw.id = pd.program_week_id
      where pw.program_id = prog_id
        and pde2.order_index = 1
        and pde2.exercise_id = (select id from public.exercises where slug = 'deadlift')
        and pde2.exercise_type = 'T1'
    );

  raise notice 'gzclp-base-v2 swap groups seeded successfully.';
end;
$$;
